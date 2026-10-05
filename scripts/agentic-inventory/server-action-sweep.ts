/**
 * @fileOverview Server-action guard sweep (agents_mcp build plan PR-0 §4.0.3, Rules 51 / P8).
 *
 * WHY: every export of a `'use server'` module is a public HTTP endpoint. The audit Phase 4 metric
 * only counted files touching `adminDb` and accepted caller-trusting checks such as
 * `canUser(userId, …)` as "guards", which is how the unguarded CRM and MCP-governance actions (N1/N2)
 * went unnoticed. This sweep is deliberately STRICT:
 *
 *   An export is guarded only if its body — or a same-file helper it calls (transitively, depth ≤ 4) —
 *   calls a function in VERIFIED_IDENTITY_GUARDS, i.e. one that derives identity from the session
 *   cookie, a verified Firebase ID token, the backoffice auth, or a cron/task secret.
 *
 * `canUser(uid, …)` / `checkWorkspaceAccess(uid, …)` on their own are NOT guards: they check whatever uid
 * the caller passes. CAUTION: only add a name to VERIFIED_IDENTITY_GUARDS after reading its body.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/** Functions that establish a VERIFIED identity. Each entry names the file that proves it. */
export const VERIFIED_IDENTITY_GUARDS: ReadonlyMap<string, string> = new Map([
  ['requireAuth', 'src/lib/auth/require-auth.ts (session cookie)'],
  ['requireWorkspace', 'src/lib/auth/require-auth.ts'],
  ['requireOrganization', 'src/lib/auth/require-auth.ts'],
  ['requireUserManager', 'src/lib/auth/require-user-manager.ts (requireOrganization + canManageUsers)'],
  ['requireUserManagerForUser', 'src/lib/auth/require-user-manager.ts (requireUserManager / requireSystemAdmin)'],
  ['requireSystemAdmin', 'src/lib/auth/require-auth.ts, require-org-admin.ts (ID token)'],
  ['requireOrgAdmin', 'src/lib/auth/require-org-admin.ts (ID token)'],
  ['authenticateApiRequest', 'src/lib/auth/api-auth-guard.ts (Bearer ID token)'],
  ['authenticateCronRequest', 'src/lib/security/cron-auth.ts (CRON_SECRET)'],
  ['authorizeBackoffice', 'src/lib/backoffice/backoffice-auth.ts (ID token + backoffice RBAC)'],
  ['authorizeBackofficeSession', 'src/lib/backoffice/backoffice-auth.ts'],
  ['authorizeWorkspaceOrBackoffice', 'src/lib/backoffice/backoffice-auth.ts'],
  ['requirePortalAdmin', 'src/lib/auth/require-portal-access.ts (session)'],
  ['requirePortalOrganizationAdmin', 'src/lib/auth/require-portal-access.ts (session)'],
  ['requirePortalUser', 'src/lib/auth/require-portal-access.ts (ID token)'],
  ['requirePortalMember', 'src/lib/auth/require-portal-access.ts (ID token)'],
  ['resolvePortalViewer', 'src/lib/auth/require-portal-access.ts (public reads; anonymous allowed by design)'],
  ['isPortalAdminCaller', 'src/lib/auth/require-portal-access.ts (session)'],
  ['verifyIdToken', 'firebase-admin auth (ID token)'],
  ['verifyCaller', 'src/app/actions/ai-admin-actions.ts (verifyIdToken)'],
  ['verifyCallerContext', 'src/app/actions/identity-actions.ts (verifyIdToken)'],
  ['verifyCallerAuth', 'src/app/actions/authorization-actions.ts (verifyIdToken)'],
  ['checkMediaPermissionAction', 'src/lib/media/rbac-service.ts (requireWorkspace)'],
  ['checkDocumentPermissionAction', 'src/lib/documents/enterprise-security-actions.ts (requireWorkspace)'],
  ['requireDocSigningPermission', 'src/lib/documents/docsigning-authz.ts (requireWorkspace + canUser RBAC)'],
  ['requireMeetingsPermission', 'src/lib/meetings/meeting-auth.ts (requireWorkspace + meetings_manage)'],
  ['requireMeetingAccess', 'src/lib/meetings/meeting-auth.ts (requireWorkspace + permission + meeting ownership)'],
  ['verifyRecipientToken', 'src/lib/documents/signing-token-service.ts (hashed capability token + expiry + revocation; public signing links)'],
]);

export interface ServerActionExport {
  /** Repo-relative path with forward slashes. */
  file: string;
  name: string;
  guarded: boolean;
  /** Guards found (for reporting). */
  guards: string[];
}

/** `file#exportName`: the stable key used by the baseline and the public allowlist. */
export function exportKey(e: Pick<ServerActionExport, 'file' | 'name'>): string {
  return `${e.file}#${e.name}`;
}

function hasUseServerDirective(sourceFile: ts.SourceFile): boolean {
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

function calleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/** Names called anywhere inside `node` (including nested arrow functions). */
function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n.expression);
      if (name) names.add(name);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Same-file function-like declarations by name (declarations and `const x = () => …`). */
function collectLocalFunctions(sourceFile: ts.SourceFile): Map<string, ts.Node> {
  const functions = new Map<string, ts.Node>();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          functions.set(decl.name.text, decl.initializer);
        }
      }
    }
  }
  return functions;
}

const MAX_HELPER_DEPTH = 4;

/** Verified guards reachable from `root` through same-file helpers (bounded, cycle-safe). */
function reachableGuards(root: ts.Node, locals: Map<string, ts.Node>): string[] {
  const guards = new Set<string>();
  const seen = new Set<ts.Node>([root]);
  let frontier: ts.Node[] = [root];
  for (let depth = 0; depth <= MAX_HELPER_DEPTH && frontier.length > 0; depth++) {
    const next: ts.Node[] = [];
    for (const node of frontier) {
      for (const name of calledNames(node)) {
        if (VERIFIED_IDENTITY_GUARDS.has(name)) guards.add(name);
        const helper = locals.get(name);
        if (helper && !seen.has(helper)) {
          seen.add(helper);
          next.push(helper);
        }
      }
    }
    frontier = next;
  }
  return [...guards].sort();
}

/** Analyzes one file. Returns [] for files without a file-level `'use server'` directive. */
export function sweepSource(fileName: string, text: string): ServerActionExport[] {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (!hasUseServerDirective(sourceFile)) return [];
  const locals = collectLocalFunctions(sourceFile);
  const results: ServerActionExport[] = [];

  const record = (name: string, body: ts.Node) => {
    const guards = reachableGuards(body, locals);
    results.push({ file: fileName, name, guarded: guards.length > 0, guards });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      record(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) record(decl.name.text, decl.initializer);
      }
    } else if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      // Re-exports from a 'use server' module are endpoints too; their bodies live elsewhere, so they
      // can only be accepted via the public allowlist or the baseline.
      for (const element of statement.exportClause.elements) {
        if (!statement.isTypeOnly && !element.isTypeOnly) {
          results.push({ file: fileName, name: element.name.text, guarded: false, guards: [] });
        }
      }
    }
  }
  return results;
}

const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', 'e2e']);

/** Walks `roots` (repo-relative) and sweeps every `.ts` / `.tsx` file. */
export function sweepRepository(repoRoot: string, roots: string[] = ['src']): ServerActionExport[] {
  const results: ServerActionExport[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
        results.push(...sweepSource(rel, fs.readFileSync(abs, 'utf8')));
      }
    }
  };
  for (const root of roots) walk(path.join(repoRoot, root));
  return results.sort((a, b) => exportKey(a).localeCompare(exportKey(b)));
}
