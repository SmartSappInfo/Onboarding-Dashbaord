/**
 * @fileOverview Pure analysis helpers for the agentic capability inventory (Phase 0, tools §7).
 *
 * Everything here is deterministic and unit-tested (`__tests__/analysis.test.ts`). The scanner
 * (`scripts/audit-agentic-inventory.ts`) only walks files and writes reports.
 *
 * HONESTY RULES — read before changing:
 * - Never invent data. A permission id is recorded only when a string literal is passed to a
 *   known guard. No guard found = `authChecks: []`, which lands on the auth-gap list.
 * - Heuristic outputs (risk, catalog mapping) carry a confidence flag and are labelled as
 *   suggestions in the reports; they need human confirmation before Phase 1 relies on them.
 */

import ts from 'typescript';

// ── Identifier tokenization ─────────────────────────────────────────────────
const SUFFIX_NOISE = new Set(['action', 'actions', 'flow', 'service', 'handler', 'impl']);

export function tokenize(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0 && !SUFFIX_NOISE.has(t));
}

/** Crude singularization so `contacts` matches `contact`. */
export function singular(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') || token.endsWith('xes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
  return token;
}

// ── Operation & risk (token-based: "getLeadSettings" is a read, not a "set") ──
export type RiskLevel =
  | 'L0_READ'
  | 'L1_INTERNAL_DRAFT'
  | 'L2_STATE_MUTATION'
  | 'L3_EXTERNAL_COMMUNICATION_FINANCE'
  | 'L4_PRIVILEGED_DESTRUCTIVE';

export type Operation = 'read' | 'search' | 'analyze' | 'draft' | 'create' | 'update' | 'delete' | 'execute' | 'publish';

const VERBS: Record<string, Operation> = {
  get: 'read', fetch: 'read', load: 'read', list: 'read', read: 'read', count: 'read', lookup: 'read',
  check: 'read', validate: 'read', verify: 'read', is: 'read', has: 'read', can: 'read', export: 'read', download: 'read',
  search: 'search', find: 'search', query: 'search', filter: 'search',
  analyze: 'analyze', score: 'analyze', audit: 'analyze', summarize: 'analyze', diagnose: 'analyze', classify: 'analyze',
  draft: 'draft', preview: 'draft', simulate: 'draft', generate: 'draft', suggest: 'draft', propose: 'draft', calculate: 'draft', compute: 'draft', estimate: 'draft',
  create: 'create', add: 'create', new: 'create', insert: 'create', register: 'create', import: 'create', duplicate: 'create', clone: 'create', upload: 'create',
  update: 'update', edit: 'update', set: 'update', save: 'update', upsert: 'update', rename: 'update', move: 'update', assign: 'update',
  link: 'update', unlink: 'update', apply: 'update', toggle: 'update', mark: 'update', reorder: 'update', merge: 'update', restore: 'update', convert: 'update', sync: 'update',
  delete: 'delete', remove: 'delete', purge: 'delete', destroy: 'delete', wipe: 'delete', archive: 'delete', revoke: 'delete',
  publish: 'publish', send: 'execute', dispatch: 'execute', launch: 'execute', schedule: 'execute', trigger: 'execute', execute: 'execute',
  run: 'execute', process: 'execute', approve: 'execute', reject: 'execute', cancel: 'execute', retry: 'execute', resend: 'execute',
  charge: 'execute', refund: 'execute', payout: 'execute', invite: 'execute', notify: 'execute', broadcast: 'execute', rotate: 'execute',
  // verbs common in this codebase (from the low-confidence report)
  resolve: 'draft', synthesize: 'draft', decompose: 'draft', refine: 'draft', ask: 'draft',
  detect: 'analyze', extract: 'analyze', evaluate: 'analyze', scan: 'analyze', explain: 'analyze',
  submit: 'create', record: 'create', seed: 'create', log: 'create',
  enrich: 'update', clear: 'update', rollback: 'update', promote: 'update', refresh: 'update', dismiss: 'update', reconcile: 'update',
};

const DESTRUCTIVE = new Set(['delete', 'purge', 'destroy', 'wipe', 'revoke', 'rotate', 'archive']);
const EXTERNAL_OR_FINANCIAL = new Set(['send', 'dispatch', 'launch', 'charge', 'refund', 'payout', 'publish', 'broadcast', 'notify', 'resend', 'invite']);

export interface Classification {
  operation: Operation;
  riskLevel: RiskLevel;
  /** 'low' when no known verb was found and a conservative default was applied. */
  confidence: 'high' | 'low';
}

export function classifyByName(identifier: string): Classification {
  const tokens = tokenize(identifier);
  const verbToken = tokens.find((t) => t in VERBS);
  if (!verbToken) {
    // Unknown verbs are NOT assumed to be reads: default to a mutation so nothing risky hides at L0.
    return { operation: 'execute', riskLevel: 'L2_STATE_MUTATION', confidence: 'low' };
  }
  const operation = VERBS[verbToken];
  if (operation === 'read' || operation === 'search' || operation === 'analyze') {
    return { operation, riskLevel: 'L0_READ', confidence: 'high' };
  }
  if (tokens.some((t) => DESTRUCTIVE.has(t))) return { operation, riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE', confidence: 'high' };
  if (tokens.some((t) => EXTERNAL_OR_FINANCIAL.has(t))) return { operation, riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE', confidence: 'high' };
  if (operation === 'draft') return { operation, riskLevel: 'L1_INTERNAL_DRAFT', confidence: 'high' };
  return { operation, riskLevel: 'L2_STATE_MUTATION', confidence: 'high' };
}

export function classifyHttpMethod(method: string, routeKind: RouteKind): Classification {
  if (method === 'GET' || method === 'HEAD') {
    // Cron GETs mutate state on a schedule; treat them as executes.
    return routeKind === 'cron'
      ? { operation: 'execute', riskLevel: 'L2_STATE_MUTATION', confidence: 'high' }
      : { operation: 'read', riskLevel: 'L0_READ', confidence: 'high' };
  }
  if (method === 'DELETE') return { operation: 'delete', riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE', confidence: 'high' };
  if (method === 'PUT' || method === 'PATCH') return { operation: 'update', riskLevel: 'L2_STATE_MUTATION', confidence: 'high' };
  return { operation: 'execute', riskLevel: 'L2_STATE_MUTATION', confidence: 'low' };
}

// ── Route kinds ─────────────────────────────────────────────────────────────
export type RouteKind = 'webhook' | 'cron' | 'task_worker' | 'mcp' | 'api';

export function routeKindFor(routePath: string): RouteKind {
  const p = routePath.toLowerCase();
  if (p.includes('webhook')) return 'webhook';
  if (p.includes('cron')) return 'cron';
  if (p.startsWith('tasks/') || p.includes('/worker') || p.includes('automations/resume') || p.includes('bulk-')) return 'task_worker';
  if (p.includes('mcp')) return 'mcp';
  return 'api';
}

// ── Guards (real helpers used in this codebase) ─────────────────────────────
/** Call names that authenticate or authorize. Extend when new guards are introduced. */
export const GUARD_CALLS = new Set([
  // src/lib/auth/require-auth.ts, require-org-admin.ts, api-auth-guard.ts
  'requireAuth', 'requireWorkspace', 'requireOrganization', 'requireOrgAdmin', 'requireSystemAdmin',
  // action-local caller verification helpers
  'verifyCaller', 'verifyCallerContext', 'verifyPermission',
  'checkWorkspaceAccess', 'checkWorkspacePermission', 'checkFullWorkspacePermission', 'checkWorkspaceEntityAccess',
  'checkEntityUpdatePermission', 'assertAutomationManagePermission', 'assertAutomationUserId', 'assertUserTenantPermission',
  'verifyCallerAccess', 'verifyCallerAuth', 'verifyDocumentPermission', 'requireOrgAdmin', 'requireSystemAdmin',
  'hasPlatformAdminClaim', 'verifyBackofficeAdmin', 'hasBackofficeAccess', 'hasBuilderPermission', 'ensureEntitySharedToWorkspace',
  'checkMediaPermissionAction', 'checkDocumentPermissionAction', 'ensureOrgDefaultStyleAdmin',
  'authenticateApiRequest', 'authenticateCronRequest', 'isAuthorizedCloudTaskRequest', 'verifyIdToken',
  'verifySignature', 'hasPermission', 'requirePermission', 'canUser', 'evaluatePrincipalAuthority',
]);

/** Svix / webhook signature verification counts as a guard for webhook routes. */
const SIGNATURE_MARKERS = ['new Webhook(', 'wh.verify(', 'webhook.verify(', 'svix', 'x-hub-signature', 'verifySignature'];

const PERMISSION_ID = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

// ── Per-node analysis ───────────────────────────────────────────────────────
export interface NodeFacts {
  collections: string[];
  authChecks: string[];
  permissionsRequired: string[];
  externalApis: string[];
  validatesInput: boolean;
  usesTimers: boolean;
  calledLocalNames: string[];
}

const EXTERNAL_API_MARKERS: Array<[string, string[]]> = [
  ['Resend', ['resend.emails', 'new Resend(', 'api.resend.com']],
  ['mNotify', ['mnotify', 'mNotify']],
  ['WhatsApp Cloud API', ['graph.facebook.com', 'sendWhatsApp', 'whatsapp-client']],
  ['OneSignal', ['onesignal', 'OneSignal']],
  ['Google Cloud Tasks', ['CloudTasksClient', 'scheduleTaskWithKey', 'createTask(']],
  ['Gemini AI', ['generativelanguage.googleapis.com', '@google/genai', 'ai.generate(', 'googleai/']],
  ['OpenAI', ['new OpenAI(', 'openai.com']],
  ['Anthropic', ['new Anthropic(', 'api.anthropic.com']],
  ['Qdrant', ['QdrantClient', 'qdrant']],
  ['Paystack', ['paystack', 'Paystack']],
  ['Stripe', ['new Stripe(', 'stripe.']],
];

function calleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

export function analyzeNode(node: ts.Node, sourceFile: ts.SourceFile): NodeFacts {
  const collections = new Set<string>();
  const authChecks = new Set<string>();
  const permissions = new Set<string>();
  const called = new Set<string>();
  let validatesInput = false;
  let usesTimers = false;

  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n.expression);
      if (name) {
        called.add(name);
        if (GUARD_CALLS.has(name)) {
          authChecks.add(name);
          for (const arg of n.arguments) {
            if (!ts.isStringLiteralLike(arg)) continue;
            if (PERMISSION_ID.test(arg.text)) permissions.add(arg.text);
            // Coarse levels such as verifyPermission(uid, 'edit', ws) are recorded as `guard:level`.
            else if (/^[a-z][a-z_]{1,30}$/.test(arg.text)) permissions.add(`${name}:${arg.text}`);
          }
        }
        if (name === 'collection') {
          // admin SDK: db.collection('x'); client SDK: collection(db, 'x')
          const literal = n.arguments.find((a) => ts.isStringLiteralLike(a));
          if (literal && ts.isStringLiteralLike(literal) && !literal.text.includes('/')) collections.add(literal.text);
        }
        // Schema validation (Zod-style). `JSON.parse` / `Date.parse` are not validation.
        const receiver = ts.isPropertyAccessExpression(n.expression) ? n.expression.expression : null;
        const isBuiltinParse = receiver !== null && ts.isIdentifier(receiver) && (receiver.text === 'JSON' || receiver.text === 'Date');
        if (!isBuiltinParse && (name === 'safeParse' || name === 'parse' || name === 'parseAsync' || name === 'safeParseAsync')) {
          validatesInput = true;
        }
        if (name === 'setTimeout' || name === 'setInterval') usesTimers = true;
      }
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'COLLECTIONS') {
      collections.add(n.name.text.toLowerCase());
    }
    ts.forEachChild(n, visit);
  };
  visit(node);

  const text = node.getText(sourceFile);
  if (SIGNATURE_MARKERS.some((m) => text.includes(m)) || /headers\.get\(\s*['"][^'"]*signature/i.test(text)) {
    authChecks.add('webhookSignature');
  }
  // Inline shared-secret checks used by cron routes.
  if (text.includes('CRON_SECRET')) authChecks.add('cronSecret');
  const externalApis = EXTERNAL_API_MARKERS.filter(([, markers]) => markers.some((m) => text.includes(m))).map(([api]) => api);

  return {
    collections: [...collections].sort(),
    authChecks: [...authChecks].sort(),
    permissionsRequired: [...permissions].sort(),
    externalApis,
    validatesInput,
    usesTimers,
    calledLocalNames: [...called],
  };
}

/** Merges facts from same-file helpers the capability calls (one level), e.g. a local `requireAdmin()`. */
export function mergeFacts(base: NodeFacts, helpers: NodeFacts[]): NodeFacts {
  const union = (pick: (f: NodeFacts) => string[]) => [...new Set([base, ...helpers].flatMap(pick))].sort();
  return {
    collections: union((f) => f.collections),
    authChecks: union((f) => f.authChecks),
    permissionsRequired: union((f) => f.permissionsRequired),
    externalApis: union((f) => f.externalApis),
    validatesInput: base.validatesInput || helpers.some((h) => h.validatesInput),
    usesTimers: base.usesTimers || helpers.some((h) => h.usesTimers),
    calledLocalNames: base.calledLocalNames,
  };
}

// ── Target catalog reconciliation (tools §7.1 step 3) ───────────────────────
const VERB_GROUPS: string[][] = [
  ['get', 'fetch', 'load', 'read', 'retrieve'],
  ['search', 'find', 'query', 'list'],
  ['create', 'add', 'new', 'insert'],
  ['update', 'edit', 'set', 'save', 'upsert'],
  ['delete', 'remove', 'purge'],
  ['send', 'dispatch', 'resend'],
];

function verbGroup(token: string): string[] {
  return VERB_GROUPS.find((g) => g.includes(token)) ?? [token];
}

/** Catalog namespaces that are organizational, not nouns in function names. */
const NAMESPACE_TOKENS = new Set(['crm', 'ai', 'integration', 'finance', 'knowledge', 'context', 'access', 'identity']);

export interface CatalogTool {
  name: string;
  verb: string | null;
  nouns: string[];
}

export function parseCatalogTool(name: string): CatalogTool {
  const tokens = name.split(/[._]/).filter(Boolean);
  const verb = tokens.find((t) => t in VERBS) ?? null;
  const nouns = tokens.filter((t) => t !== verb && !NAMESPACE_TOKENS.has(t)).map(singular);
  return { name, verb, nouns };
}

/** 0 = no match. Requires the verb (or a synonym) and every catalog noun to appear in the identifier. */
export function matchScore(tool: CatalogTool, identifier: string): number {
  const tokens = tokenize(identifier).map(singular);
  if (tool.verb && !verbGroup(tool.verb).some((v) => tokens.includes(v))) return 0;
  if (tool.nouns.length === 0 || !tool.nouns.every((n) => tokens.includes(n))) return 0;
  // Prefer tight names: penalize extra tokens.
  return 100 - Math.max(0, tokens.length - tool.nouns.length - 1) * 5;
}

/** Extracts backticked `a.b` tool names from the catalog section of agents_mcp_tools.md. */
export function extractCatalogToolNames(markdown: string): string[] {
  const start = markdown.indexOf('# 2. The complete tool catalog');
  const end = markdown.indexOf('# 3. The tools that are easy to miss');
  const section = start >= 0 && end > start ? markdown.slice(start, end) : markdown;
  const names = new Set<string>();
  for (const match of section.matchAll(/`([a-z][a-z_]*(?:\.[a-z_]+)+)`/g)) names.add(match[1]);
  return [...names].sort();
}

/** Signature for duplicate detection: operation verb group + sorted singular nouns. */
export function duplicateSignature(identifier: string): string | null {
  const tokens = tokenize(identifier).map(singular);
  const verb = tokens.find((t) => t in VERBS);
  if (!verb) return null;
  const nouns = tokens.filter((t) => t !== verb && !(t in VERBS)).sort();
  if (nouns.length === 0) return null;
  return `${verbGroup(verb)[0]}:${nouns.join('+')}`;
}
