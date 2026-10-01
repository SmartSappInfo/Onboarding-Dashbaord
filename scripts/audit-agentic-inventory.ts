/**
 * @fileOverview Agentic Capability Inventory & Coverage Matrix (Phase 0, tools §7.1–7.3)
 *
 * Run: `pnpm audit:agentic-inventory`
 *
 * Parses every capability surface with the TypeScript compiler API and writes:
 * - docs/agentic/inventory.json — one record per exported capability (full detail)
 * - docs/agentic/tool-registry-capability-matrix.md — coverage matrix + the §7.3 gap lists
 *
 * Surfaces: server actions, ALL API routes (incl. webhooks, cron, task workers, MCP), Genkit
 * flows, services, lead intelligence, portal blocks.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Facts (collections, guards, permission ids, external APIs) are extracted from the
 *   capability's OWN function body plus same-file helpers it calls — not from the whole file.
 * - Nothing is fabricated: no permission id → empty list; no guard → auth-gap list.
 * - Risk and catalog mapping are heuristics and are labelled as such in the reports.
 * - Pure logic lives in scripts/agentic-inventory/analysis.ts (unit-tested).
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  analyzeNode,
  classifyByName,
  classifyHttpMethod,
  duplicateSignature,
  extractCatalogToolNames,
  matchScore,
  mergeFacts,
  parseCatalogTool,
  routeKindFor,
  type Classification,
  type NodeFacts,
  type Operation,
  type RiskLevel,
  type RouteKind,
} from './agentic-inventory/analysis';
import { exportKey, sweepRepository } from './agentic-inventory/server-action-sweep';
import { PUBLIC_SERVER_ACTIONS } from '../src/platform/__tests__/security/public-server-actions';

export type CapabilityDomain =
  | 'identity_access'
  | 'crm_contacts'
  | 'school_operations'
  | 'deals_revenue'
  | 'meetings_conversations'
  | 'communication_messaging'
  | 'campaigns_marketing'
  | 'forms_surveys'
  | 'automation_workflows'
  | 'finance_subscriptions'
  | 'media_creative'
  | 'knowledge_memory'
  | 'tasks_productivity'
  | 'lead_intelligence'
  | 'analytics_reporting'
  | 'ai_governance'
  | 'platform_integrations'
  | 'experience_portal';

type Category = 'server_action' | 'api_route' | 'genkit_flow' | 'service' | 'portal_block';

/** tools §7.1 statuses, plus `unmapped` for existing capabilities with no catalog counterpart. */
type ImplementationStatus = 'reuse' | 'wrap' | 'extend' | 'unmapped';

interface DiscoveredItem {
  id: string;
  name: string;
  category: Category;
  routeKind?: RouteKind;
  httpMethod?: string;
  domain: CapabilityDomain;
  domainConfidence: 'path_match' | 'fallback';
  filePath: string;
  exportName: string;
  operation: Operation;
  riskLevel: RiskLevel;
  riskConfidence: Classification['confidence'];
  status: ImplementationStatus;
  suggestedCatalogTools: string[];
  authChecks: string[];
  permissionsRequired: string[];
  validatesInput: boolean;
  dataTouched: { collections: string[]; externalApis: string[] };
  cloudRunSafe: boolean;
  consumers: { ui: boolean; ai: boolean; automation: boolean; api: boolean };
  hasTests: boolean;
  /**
   * Server actions only: the STRICT sweep's verdict (agents_mcp PR-2, FU-8). 'guarded' = a verified
   * identity guard; 'public' = in PUBLIC_SERVER_ACTIONS with a reason; 'unguarded' otherwise.
   */
  sweepVerdict?: 'guarded' | 'public' | 'unguarded';
}

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'agentic');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'inventory.json');
const OUTPUT_MATRIX = path.join(OUTPUT_DIR, 'tool-registry-capability-matrix.md');
const CATALOG_DOC = path.join(ROOT_DIR, 'docs', 'agents_mcp', 'agents_mcp_tools.md');

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walkDir(dir: string, filter: (filePath: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'scratch', '.git'].includes(entry.name)) results.push(...walkDir(fullPath, filter));
    } else if (entry.isFile() && filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

const isSource = (f: string) => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f);
const isTest = (f: string) => /\.test\.(ts|tsx)$/.test(f) || f.includes(`${path.sep}__tests__${path.sep}`);

// Path-based domain mapping (heuristic; the file path decides, not the function name).
// CAUTION: `crm_contacts` is the fallback and is reported as `domainConfidence: 'fallback'`.
function inferDomain(filePath: string): CapabilityDomain {
  const norm = filePath.toLowerCase();

  // School Operations (Domain 18)
  if (
    norm.includes('school') ||
    norm.includes('student') ||
    norm.includes('academic') ||
    norm.includes('teacher') ||
    norm.includes('grade') ||
    norm.includes('admission') ||
    norm.includes('attendance') ||
    norm.includes('classroom') ||
    norm.includes('curriculum')
  ) {
    return 'school_operations';
  }

  // Experience Portal (Domain 17)
  if (
    norm.includes('portal') ||
    norm.includes('membership') ||
    norm.includes('experience') ||
    norm.includes('course') ||
    norm.includes('learning') ||
    norm.includes('lesson') ||
    norm.includes('credential') ||
    norm.includes('certificate') ||
    norm.includes('community') ||
    norm.includes('quiz') ||
    norm.includes('tutor') ||
    norm.includes('pedagogy')
  ) {
    return 'experience_portal';
  }

  // AI Governance (Domain 16)
  if (
    norm.includes('governance') ||
    norm.includes('audit') ||
    norm.includes('policy') ||
    norm.includes('ai-admin') ||
    norm.includes('approval') ||
    norm.includes('risk') ||
    norm.includes('safety') ||
    norm.includes('guardrail')
  ) {
    return 'ai_governance';
  }

  // Lead Intelligence (Domain 14)
  if (
    norm.includes('lead-intelligence') ||
    norm.includes('sales-workforce') ||
    norm.includes('workforce') ||
    norm.includes('enrichment') ||
    norm.includes('scoring') ||
    norm.includes('sdr') ||
    norm.includes('attribution') ||
    norm.includes('visitor-radar') ||
    norm.includes('icp-scoring') ||
    norm.includes('recommendation')
  ) {
    return 'lead_intelligence';
  }

  // Deals & Revenue (Domain 4)
  if (
    norm.includes('deal') ||
    norm.includes('pipeline') ||
    norm.includes('revenue') ||
    norm.includes('opportunity') ||
    norm.includes('forecast') ||
    norm.includes('sales')
  ) {
    return 'deals_revenue';
  }

  // Meetings & Conversations (Domain 5)
  if (
    norm.includes('meeting') ||
    norm.includes('zoom') ||
    norm.includes('calendar') ||
    norm.includes('appointment') ||
    norm.includes('transcription')
  ) {
    return 'meetings_conversations';
  }

  // Communication & Messaging (Domain 6)
  if (
    norm.includes('messaging') ||
    norm.includes('whatsapp') ||
    norm.includes('resend') ||
    norm.includes('mnotify') ||
    norm.includes('onesignal') ||
    norm.includes('broadcast') ||
    norm.includes('message-tracking') ||
    norm.includes('sender-profile') ||
    norm.includes('email') ||
    norm.includes('sms')
  ) {
    return 'communication_messaging';
  }

  // Campaigns & Marketing (Domain 7)
  if (norm.includes('campaign') || norm.includes('audience') || norm.includes('segment')) {
    return 'campaigns_marketing';
  }

  // Forms & Surveys (Domain 8)
  if (norm.includes('survey') || norm.includes('form') || norm.includes('response') || norm.includes('feedback')) {
    return 'forms_surveys';
  }

  // Automation & Workflows (Domain 9)
  if (
    norm.includes('automation') ||
    norm.includes('call-centre') ||
    norm.includes('scheduler') ||
    norm.includes('workflow') ||
    norm.includes('trigger') ||
    norm.includes('agent-step')
  ) {
    return 'automation_workflows';
  }

  // Finance & Subscriptions (Domain 10)
  if (
    norm.includes('finance') ||
    norm.includes('invoice') ||
    norm.includes('billing') ||
    norm.includes('payment') ||
    norm.includes('paystack') ||
    norm.includes('stripe') ||
    norm.includes('subscription') ||
    norm.includes('ledger') ||
    norm.includes('credit-note') ||
    norm.includes('statement') ||
    norm.includes('reconciliation') ||
    norm.includes('aging') ||
    norm.includes('commerce')
  ) {
    return 'finance_subscriptions';
  }

  // Media & Creative (Domain 11)
  if (
    norm.includes('media') ||
    norm.includes('qr') ||
    norm.includes('thumbnail') ||
    norm.includes('page-builder') ||
    norm.includes('image') ||
    norm.includes('asset') ||
    norm.includes('upload')
  ) {
    return 'media_creative';
  }

  // Knowledge & Memory (Domain 12)
  if (
    norm.includes('knowledge') ||
    norm.includes('note') ||
    norm.includes('memory') ||
    norm.includes('brain') ||
    norm.includes('vector') ||
    norm.includes('embedding') ||
    norm.includes('qdrant') ||
    norm.includes('graph')
  ) {
    return 'knowledge_memory';
  }

  // Tasks & Productivity (Domain 13)
  if (norm.includes('task') || norm.includes('reminder') || norm.includes('todo') || norm.includes('checklist')) {
    return 'tasks_productivity';
  }

  // Identity & Access (Domain 1)
  if (
    norm.includes('auth') ||
    norm.includes('user') ||
    norm.includes('role') ||
    norm.includes('permission') ||
    norm.includes('workspace') ||
    norm.includes('organization') ||
    norm.includes('clerk') ||
    norm.includes('entitlement')
  ) {
    return 'identity_access';
  }

  // Analytics & Reporting (Domain 15)
  if (
    norm.includes('analytics') ||
    norm.includes('report') ||
    norm.includes('metric') ||
    norm.includes('dashboard') ||
    norm.includes('telemetry') ||
    norm.includes('materialized')
  ) {
    return 'analytics_reporting';
  }

  // Platform Integrations (Domain 17)
  if (
    norm.includes('webhook') ||
    norm.includes('task-client') ||
    norm.includes('gcp') ||
    norm.includes('integration') ||
    norm.includes('gateway') ||
    norm.includes('sync') ||
    norm.includes('pms-')
  ) {
    return 'platform_integrations';
  }

  // CRM & Contacts (Domain 2) — explicit matches first, then the fallback
  return 'crm_contacts';
}

function isExplicitCrm(filePath: string): boolean {
  const norm = filePath.toLowerCase();
  return ['contact', 'entity', 'entities', 'crm', 'tag', 'company', 'companies', 'lead', 'person', 'people'].some((k) => norm.includes(k));
}


// ── Consumer & test indexes (identifier → files that mention it) ────────────
function buildIdentifierIndex(files: string[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const match of text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{3,}\b/g)) {
      const bucket = index.get(match[0]) ?? new Set<string>();
      bucket.add(path.relative(ROOT_DIR, file));
      index.set(match[0], bucket);
    }
  }
  return index;
}

// ── Per-file scan ───────────────────────────────────────────────────────────
interface ScannedExport {
  exportName: string;
  node: ts.Node;
}

function exportedCapabilities(sourceFile: ts.SourceFile): ScannedExport[] {
  const found: ScannedExport[] = [];
  const isExported = (n: ts.Node) =>
    ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt)) {
      found.push({ exportName: stmt.name.text, node: stmt });
    } else if (ts.isClassDeclaration(stmt) && stmt.name && isExported(stmt)) {
      found.push({ exportName: stmt.name.text, node: stmt });
    } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const init = decl.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isCallExpression(init)) {
          found.push({ exportName: decl.name.text, node: decl });
        }
      }
    }
  }
  return found;
}

/** Top-level functions and constants in the file, by name (candidates for transitive facts). */
function localBindings(sourceFile: ts.SourceFile): Map<string, ts.Node> {
  const bindings = new Map<string, ts.Node>();
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) bindings.set(stmt.name.text, stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        // Functions AND module-level constants (e.g. `const SECRET = process.env.CRON_SECRET`).
        if (ts.isIdentifier(decl.name) && decl.initializer) bindings.set(decl.name.text, decl);
      }
    }
  }
  return bindings;
}

function referencedIdentifiers(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const collect = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) names.add(n.text);
    ts.forEachChild(n, collect);
  };
  collect(node);
  return names;
}

const MAX_HELPER_DEPTH = 4;

/**
 * Facts of the capability's own body plus every same-file function/constant it reaches
 * transitively (depth-limited), e.g. GET → isAuthorized() → SECRET (CRON_SECRET).
 */
function factsFor(node: ts.Node, sourceFile: ts.SourceFile, bindings: Map<string, ts.Node>, selfName: string): NodeFacts {
  const own = analyzeNode(node, sourceFile);
  const visited = new Set<string>([selfName]);
  let frontier = [...referencedIdentifiers(node)];
  const helperFacts: NodeFacts[] = [];
  for (let depth = 0; depth < MAX_HELPER_DEPTH && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const name of frontier) {
      const helper = bindings.get(name);
      if (!helper || visited.has(name)) continue;
      visited.add(name);
      helperFacts.push(analyzeNode(helper, sourceFile));
      next.push(...referencedIdentifiers(helper));
    }
    frontier = next;
  }
  return mergeFacts(own, helperFacts);
}

function scanFile(filePath: string, category: Category, forcedDomain?: CapabilityDomain): DiscoveredItem[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const relPath = path.relative(ROOT_DIR, filePath);
  const domain = forcedDomain ?? inferDomain(relPath);
  const domainConfidence: DiscoveredItem['domainConfidence'] =
    forcedDomain || domain !== 'crm_contacts' || isExplicitCrm(relPath) ? 'path_match' : 'fallback';
  const bindings = localBindings(sourceFile);
  const routePath = category === 'api_route' ? relPath.replace(/^src\/app\/api\//, '').replace(/\/route\.(ts|js)$/, '') : '';
  const routeKind = category === 'api_route' ? routeKindFor(routePath) : undefined;

  return exportedCapabilities(sourceFile)
    .filter(({ exportName }) => category !== 'api_route' || HTTP_METHODS.includes(exportName))
    .map(({ exportName, node }) => {
      const facts = factsFor(node, sourceFile, bindings, exportName);
      const classification =
        category === 'api_route' && routeKind ? classifyHttpMethod(exportName, routeKind) : classifyByName(exportName);
      const id = category === 'api_route' ? `api.${routePath}.${exportName}` : `${domain}.${exportName}`;
      return {
        id,
        name: category === 'api_route' ? `${exportName} /api/${routePath}` : exportName,
        category: exportName.endsWith('Flow') ? 'genkit_flow' : category,
        routeKind,
        httpMethod: category === 'api_route' ? exportName : undefined,
        domain,
        domainConfidence,
        filePath: relPath,
        exportName,
        operation: classification.operation,
        riskLevel: classification.riskLevel,
        riskConfidence: classification.confidence,
        status: 'unmapped',
        suggestedCatalogTools: [],
        authChecks: facts.authChecks,
        permissionsRequired: facts.permissionsRequired,
        validatesInput: facts.validatesInput,
        dataTouched: { collections: facts.collections, externalApis: facts.externalApis },
        cloudRunSafe: !facts.usesTimers,
        consumers: { ui: false, ai: false, automation: false, api: false },
        hasTests: false,
      };
    });
}

// ── Markdown helpers ────────────────────────────────────────────────────────
const cell = (value: string) => value.replace(/\|/g, '\\|');
const code = (value: string) => (value ? `\`${cell(value)}\`` : '—');
const list = (values: string[]) => (values.length ? values.map(code).join(', ') : '—');

function runInventoryAudit(): void {
  console.log('>>> Agentic capability inventory (TypeScript AST)…');

  // 1. Discover surfaces
  // Server actions come from the strict sweep (same parser as the CI guard test): every export of
  // every 'use server' module, whatever the file is called (PR-2: the old filename filter missed
  // modules such as forms/identity-resolution.ts).
  const sweep = sweepRepository(ROOT_DIR);
  const sweepVerdicts = new Map(
    sweep.map((e) => [exportKey(e), e.guarded ? 'guarded' : exportKey(e) in PUBLIC_SERVER_ACTIONS ? 'public' : 'unguarded'] as const)
  );
  const actionFiles = [...new Set(sweep.map((e) => path.join(ROOT_DIR, e.file)))];
  const routeFiles = walkDir(path.join(SRC_DIR, 'app', 'api'), (f) => /route\.(ts|js)$/.test(f));
  const flowFiles = walkDir(path.join(SRC_DIR, 'ai', 'flows'), (f) => isSource(f) && !isTest(f));
  const serviceFiles = [
    ...walkDir(path.join(SRC_DIR, 'lib', 'services'), (f) => isSource(f) && !isTest(f)),
    ...walkDir(path.join(SRC_DIR, 'lib', 'lead-intelligence'), (f) => isSource(f) && !isTest(f)),
    // PR-2: the CompanyBrain / agent stack predates Phase 1 and must be in the inventory too.
    ...['mcp', 'agents', 'memory', 'workflows', 'supervisor'].flatMap((dir) =>
      walkDir(path.join(SRC_DIR, 'lib', dir), (f) => isSource(f) && !isTest(f))
    ),
  ];
  const portalFiles = walkDir(path.join(SRC_DIR, 'lib', 'page-builder', 'blocks', 'portal'), (f) => isSource(f) && !isTest(f));

  const scanned: DiscoveredItem[] = [
    ...actionFiles.flatMap((f) => scanFile(f, 'server_action')),
    ...routeFiles.flatMap((f) => scanFile(f, 'api_route')),
    ...flowFiles.flatMap((f) => scanFile(f, 'genkit_flow')),
    ...serviceFiles.flatMap((f) => scanFile(f, 'service')),
    ...portalFiles.flatMap((f) => scanFile(f, 'portal_block', 'experience_portal')),
  ];

  // 2. Unique ids: same export in the same file (re-scanned surfaces) collapses; a same-named
  //    export in a DIFFERENT file is kept and disambiguated, never dropped.
  const byKey = new Map<string, DiscoveredItem>();
  const idCounts = new Map<string, number>();
  for (const item of scanned) {
    const key = `${item.filePath}#${item.exportName}`;
    if (byKey.has(key)) continue;
    const seen = idCounts.get(item.id) ?? 0;
    idCounts.set(item.id, seen + 1);
    if (seen > 0) item.id = `${item.id}@${item.filePath}`;
    byKey.set(key, item);
  }
  const inventory = [...byKey.values()];
  for (const item of inventory) {
    const verdict = sweepVerdicts.get(`${item.filePath.split(path.sep).join('/')}#${item.exportName}`);
    if (verdict) item.sweepVerdict = verdict;
    else if (item.category === 'server_action') item.sweepVerdict = 'unguarded';
  }

  // 3. Consumers and tests
  const allSource = walkDir(SRC_DIR, isSource);
  const testIndex = buildIdentifierIndex(allSource.filter(isTest));
  const usageIndex = buildIdentifierIndex(allSource.filter((f) => !isTest(f)));
  for (const item of inventory) {
    const users = [...(usageIndex.get(item.exportName) ?? [])].filter((f) => f !== item.filePath);
    item.consumers = {
      ui: users.some((f) => f.endsWith('.tsx') && (f.startsWith('src/components') || f.startsWith('src/app'))),
      ai: users.some((f) => f.startsWith('src/ai')),
      automation: users.some((f) => f.includes('automation')),
      api: users.some((f) => f.startsWith('src/app/api')),
    };
    const routeTestDir = path.join(path.dirname(item.filePath), '__tests__');
    item.hasTests =
      item.category === 'api_route'
        ? fs.existsSync(path.join(ROOT_DIR, routeTestDir))
        : (testIndex.get(item.exportName)?.size ?? 0) > 0;
  }

  // 4. Reconcile with the target catalog (tools §7.1 step 3) — heuristic suggestions
  const catalog = fs.existsSync(CATALOG_DOC) ? extractCatalogToolNames(fs.readFileSync(CATALOG_DOC, 'utf-8')).map(parseCatalogTool) : [];
  const candidates = inventory.filter((i) => i.category !== 'api_route' && i.category !== 'portal_block');
  const catalogCoverage = catalog.map((tool) => {
    const matches = candidates
      .map((item) => ({ item, score: matchScore(tool, item.exportName) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((m) => m.item);
    for (const match of matches) match.suggestedCatalogTools.push(tool.name);
    return { tool: tool.name, matches };
  });
  for (const item of inventory) {
    if (item.suggestedCatalogTools.length === 0) {
      item.status = 'unmapped';
    } else if (item.authChecks.length > 0 && item.validatesInput) {
      item.status = 'reuse';
    } else if (item.authChecks.length > 0) {
      item.status = 'wrap';
    } else {
      item.status = 'extend';
    }
  }

  // 5. Gap lists (tools §7.3)
  const missingTools = catalogCoverage.filter((c) => c.matches.length === 0).map((c) => c.tool);
  const unmapped = inventory.filter((i) => i.status === 'unmapped' && (i.category === 'server_action' || i.category === 'service'));
  // Server actions: the strict sweep's verdict (a caller-trusting check is NOT a guard). API routes
  // keep the guard-call heuristic until the route sweep exists (FU-4).
  const authGaps = inventory.filter(
    (i) =>
      i.sweepVerdict === 'unguarded' ||
      (i.category === 'api_route' && i.authChecks.length === 0)
  );
  const testGaps = inventory.filter((i) => !i.hasTests && (i.category === 'server_action' || i.category === 'api_route'));
  const duplicates = new Map<string, DiscoveredItem[]>();
  for (const item of inventory.filter((i) => i.category === 'server_action' || i.category === 'service')) {
    const sig = duplicateSignature(item.exportName);
    if (!sig) continue;
    duplicates.set(sig, [...(duplicates.get(sig) ?? []), item]);
  }
  const duplicateGroups = [...duplicates.entries()]
    .filter(([, items]) => new Set(items.map((i) => i.filePath)).size > 1)
    .sort((a, b) => b[1].length - a[1].length);

  // 6. Summary
  const countBy = <K extends string>(pick: (i: DiscoveredItem) => K | undefined) =>
    inventory.reduce<Record<string, number>>((acc, i) => {
      const k = pick(i);
      if (k) acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    surfaces: {
      serverActionFiles: actionFiles.length,
      apiRouteFiles: routeFiles.length,
      apiRouteFilesWithHandlers: new Set(inventory.filter((i) => i.category === 'api_route').map((i) => i.filePath)).size,
      genkitFlowFiles: flowFiles.length,
      serviceFiles: serviceFiles.length,
      portalBlockFiles: portalFiles.length,
    },
    totalCapabilities: inventory.length,
    byCategory: countBy((i) => i.category),
    byRouteKind: countBy((i) => i.routeKind),
    byDomain: countBy((i) => i.domain),
    domainFallbackCount: inventory.filter((i) => i.domainConfidence === 'fallback').length,
    byRiskLevel: countBy((i) => i.riskLevel),
    lowConfidenceRisk: inventory.filter((i) => i.riskConfidence === 'low').length,
    byStatus: countBy((i) => i.status),
    withAuthCheck: inventory.filter((i) => i.authChecks.length > 0).length,
    withPermissionId: inventory.filter((i) => i.permissionsRequired.length > 0).length,
    catalogTools: catalog.length,
    catalogToolsWithCandidate: catalog.length - missingTools.length,
    // The sweep is authoritative for server actions (some exports, e.g. constants or Genkit flows,
    // are categorised differently in the list below).
    serverActionSweep: {
      exports: sweep.length,
      guarded: [...sweepVerdicts.values()].filter((v) => v === 'guarded').length,
      public: [...sweepVerdicts.values()].filter((v) => v === 'public').length,
      unguarded: [...sweepVerdicts.values()].filter((v) => v === 'unguarded').length,
    },
    gaps: {
      missingCatalogTools: missingTools.length,
      unmappedCapabilities: unmapped.length,
      authGaps: authGaps.length,
      testGaps: testGaps.length,
      duplicateGroups: duplicateGroups.length,
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ summary, capabilities: inventory }, null, 2), 'utf-8');

  // 7. Matrix
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);
  push(
    '# SmartSapp Capability Coverage Matrix (tools §7.3)',
    '',
    `Generated ${summary.generatedAt} by \`pnpm audit:agentic-inventory\`. Do not edit by hand.`,
    '',
    '> **How to read this.** Collections, guards, permission ids and external APIs are extracted from each',
    '> capability\'s own code. **Risk** and **catalog mapping** are name-based heuristics: treat them as',
    '> suggestions to confirm, not decisions. An empty permissions cell means no permission id was found — nothing is invented.',
    '',
    '## Summary',
    '',
    '| Measure | Value |',
    '| --- | --- |',
    `| Capabilities discovered | ${summary.totalCapabilities} |`,
    `| API route files / with handlers found | ${summary.surfaces.apiRouteFiles} / ${summary.surfaces.apiRouteFilesWithHandlers} |`,
    `| With an auth/permission guard detected | ${summary.withAuthCheck} |`,
    `| With an explicit permission id | ${summary.withPermissionId} |`,
    `| Domain assigned by fallback (\`crm_contacts\`) | ${summary.domainFallbackCount} |`,
    `| Risk assigned with low confidence | ${summary.lowConfidenceRisk} |`,
    `| Catalog tools with at least one candidate | ${summary.catalogToolsWithCandidate} / ${summary.catalogTools} |`,
    `| Missing catalog tools | ${summary.gaps.missingCatalogTools} |`,
    `| Unmapped existing capabilities (actions/services) | ${summary.gaps.unmappedCapabilities} |`,
    `| Server action exports (strict sweep): guarded / public by design / unguarded | ${summary.serverActionSweep.guarded} / ${summary.serverActionSweep.public} / ${summary.serverActionSweep.unguarded} (of ${summary.serverActionSweep.exports}) |`,
    `| Auth gaps listed below (unguarded server actions + API routes with no guard call) | ${summary.gaps.authGaps} |`,
    `| Test gaps (actions/routes with no test reference) | ${summary.gaps.testGaps} |`,
    `| Duplicate-implementation groups | ${summary.gaps.duplicateGroups} |`,
    '',
    '## By domain',
    '',
    '| Domain | Capabilities | reuse | wrap | extend | unmapped |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  for (const [domain, count] of Object.entries(summary.byDomain).sort((a, b) => b[1] - a[1])) {
    const items = inventory.filter((i) => i.domain === domain);
    const n = (s: ImplementationStatus) => items.filter((i) => i.status === s).length;
    push(`| \`${domain}\` | ${count} | ${n('reuse')} | ${n('wrap')} | ${n('extend')} | ${n('unmapped')} |`);
  }

  push('', '## Target catalog coverage (suggested mapping)', '', '| Catalog tool | Candidate implementations (best first) |', '| --- | --- |');
  for (const c of catalogCoverage) {
    push(`| \`${c.tool}\` | ${c.matches.length ? c.matches.map((m) => `\`${cell(m.exportName)}\` (${cell(m.filePath)})`).join('<br>') : '**missing**'} |`);
  }

  push('', `## Auth gaps (${authGaps.length})`, '', 'Server actions and API routes where no known guard was detected in the function or the same-file helpers it calls. Verify each: some may be guarded by a wrapper this scanner does not know yet (add it to `GUARD_CALLS`).', '', '| Capability | Kind | Risk | File |', '| --- | --- | --- | --- |');
  for (const i of [...authGaps].sort((a, b) => b.riskLevel.localeCompare(a.riskLevel))) {
    push(`| ${code(i.name)} | ${i.routeKind ?? i.category} | \`${i.riskLevel}\` | ${cell(i.filePath)} |`);
  }

  push('', `## Duplicate-implementation candidates (${duplicateGroups.length})`, '', '| Signature | Implementations |', '| --- | --- |');
  for (const [sig, items] of duplicateGroups) {
    push(`| \`${sig}\` | ${items.map((i) => `\`${cell(i.exportName)}\` (${cell(i.filePath)})`).join('<br>')} |`);
  }

  push('', `## Missing catalog tools (${missingTools.length})`, '', missingTools.map((t) => `\`${t}\``).join(', ') || '—');

  push('', `## Unmapped existing capabilities (${unmapped.length})`, '', 'Existing actions/services with no suggested catalog tool. Each needs a tool, an internal-only decision, or an explicit exclusion.', '', '| Capability | Domain | File |', '| --- | --- | --- |');
  for (const i of unmapped) push(`| ${code(i.exportName)} | \`${i.domain}\` | ${cell(i.filePath)} |`);

  push('', `## Test gaps (${testGaps.length})`, '', '| Capability | Kind | Risk | File |', '| --- | --- | --- | --- |');
  for (const i of testGaps) push(`| ${code(i.name)} | ${i.routeKind ?? i.category} | \`${i.riskLevel}\` | ${cell(i.filePath)} |`);

  push('', `## Full inventory (${inventory.length})`, '', '| Capability | Domain | Op | Risk | Status | Guards | Permissions | Collections | File |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const i of [...inventory].sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id))) {
    push(
      `| ${code(i.name)} | \`${i.domain}\`${i.domainConfidence === 'fallback' ? '*' : ''} | ${i.operation} | \`${i.riskLevel}\`${i.riskConfidence === 'low' ? '*' : ''} | ${i.status} | ${list(i.authChecks)} | ${list(i.permissionsRequired)} | ${list(i.dataTouched.collections)} | ${cell(i.filePath)} |`
    );
  }
  push('', '`*` = assigned by fallback / low confidence.', '');

  fs.writeFileSync(OUTPUT_MATRIX, lines.join('\n'), 'utf-8');
  console.log(`>>> Wrote ${path.relative(ROOT_DIR, OUTPUT_JSON)} and ${path.relative(ROOT_DIR, OUTPUT_MATRIX)}`);
  console.log(JSON.stringify(summary, null, 2));
}

runInventoryAudit();
