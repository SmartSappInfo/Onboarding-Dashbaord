/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Query Intent Router & Dispatcher
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Store Query Intent Classification:
 *    - Relational: Questions about entity connections, organizational structure, reporting chains,
 *      or deals route primarily to Knowledge Graph traversal (`KnowledgeGraphService`).
 *    - Semantic: Conceptual, natural language, meeting takeaways, and policy queries
 *      route to Qdrant vector retrieval (`SemanticSearchService`).
 *    - Exact: Specific identifiers, quotes, dates, or code strings route to Firestore queries.
 *    - Hybrid: Queries mentioning specific entities alongside conceptual intent combine Qdrant
 *      retrieval with 1-hop Graph neighborhood expansion.
 * 2. Zero-`any` Standard:
 *    - All routing decisions and classification outputs are strictly typed.
 * 3. High-Performance Deterministic Heuristics:
 *    - Evaluates in < 1ms without requiring external LLM roundtrips for search dispatch.
 *
 * @testability Covered in `src/lib/memory/__tests__/organization-memory-service.test.ts`.
 */

export type QueryIntent = 'semantic' | 'relational' | 'exact' | 'hybrid';

export interface QueryRoutingDecision {
  intent: QueryIntent;
  confidence: number;
  extractedEntities: string[];
  exactKeywords: string[];
  requiresGraphExpansion: boolean;
  reasoning: string;
}

// Patterns indicative of relational inquiries
const RELATIONAL_KEYWORDS = [
  'connected to',
  'connection between',
  'relationship between',
  'linked to',
  'reports to',
  'reporting to',
  'who reports',
  'reporting chain',
  'who is connected',
  'who knows',
  'who works with',
  'works with',
  'team of',
  'network of',
  'associated with',
  'hierarchy',
  'stakeholder tree',
];

// Patterns indicative of exact quotes or transaction tokens
const EXACT_PHRASE_REGEX = /"([^"]+)"|'([^']+)'/;
const DATE_TOKEN_REGEX = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
const ID_TOKEN_REGEX = /\b(?:mem|note|contact|deal|org|user)-[a-zA-Z0-9_-]+\b/;

// Proper noun / entity regex (consecutive capitalized tokens like "Acme Corp", "John Doe")
const PROPER_NOUN_REGEX = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

export class MemoryRouter {
  /**
   * Evaluates a search query and determines the optimal retrieval intent and store target.
   *
   * @param rawQuery The user or agent search query string
   * @returns Strongly typed QueryRoutingDecision
   */
  public static routeQuery(rawQuery: string): QueryRoutingDecision {
    const query = (rawQuery || '').trim();
    if (!query) {
      return {
        intent: 'semantic',
        confidence: 0.5,
        extractedEntities: [],
        exactKeywords: [],
        requiresGraphExpansion: false,
        reasoning: 'Empty query defaults to semantic vector search.',
      };
    }

    const lower = query.toLowerCase();

    // 1. Check for explicit relational cues
    const isRelational = RELATIONAL_KEYWORDS.some((kw) => lower.includes(kw));
    if (isRelational) {
      const properNouns = query.match(PROPER_NOUN_REGEX) || [];
      return {
        intent: 'relational',
        confidence: 0.9,
        extractedEntities: Array.from(new Set(properNouns)),
        exactKeywords: [],
        requiresGraphExpansion: true,
        reasoning: 'Query asks for entity relationships, network ties, or reporting hierarchy.',
      };
    }

    // 2. Check for exact quoted strings, date patterns, or system IDs
    const quotedMatch = query.match(EXACT_PHRASE_REGEX);
    const dateMatch = query.match(DATE_TOKEN_REGEX);
    const idMatch = query.match(ID_TOKEN_REGEX);

    const exactKeywords: string[] = [];
    if (quotedMatch) exactKeywords.push(quotedMatch[1] || quotedMatch[2]);
    if (dateMatch) exactKeywords.push(dateMatch[0]);
    if (idMatch) exactKeywords.push(idMatch[0]);

    if (exactKeywords.length > 0 && !lower.startsWith('how') && !lower.startsWith('why')) {
      return {
        intent: 'exact',
        confidence: 0.85,
        extractedEntities: [],
        exactKeywords,
        requiresGraphExpansion: false,
        reasoning: `Query specifies exact verbatim token(s): ${exactKeywords.join(', ')}.`,
      };
    }

    // 3. Check for Named Entities alongside conceptual questions -> Hybrid
    const properNouns = query.match(PROPER_NOUN_REGEX) || [];
    const isConceptual =
      lower.includes('feel') ||
      lower.includes('think') ||
      lower.includes('opinion') ||
      lower.includes('how') ||
      lower.includes('why') ||
      lower.includes('feedback') ||
      lower.includes('reaction') ||
      lower.includes('lesson') ||
      lower.includes('strategy') ||
      lower.includes('roadmap') ||
      lower.includes('decision');

    if (properNouns.length > 0 && isConceptual) {
      return {
        intent: 'hybrid',
        confidence: 0.88,
        extractedEntities: Array.from(new Set(properNouns)),
        exactKeywords,
        requiresGraphExpansion: true,
        reasoning: `Query involves specific entity (${properNouns.join(', ')}) with conceptual depth.`,
      };
    }

    // 4. Default: Semantic Vector Search
    return {
      intent: 'semantic',
      confidence: 0.8,
      extractedEntities: Array.from(new Set(properNouns)),
      exactKeywords,
      requiresGraphExpansion: false,
      reasoning: 'Broad conceptual knowledge or policy query suitable for dense vector embedding.',
    };
  }
}
