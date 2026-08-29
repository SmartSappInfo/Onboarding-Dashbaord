Viewed 2026-07-02-lead-intelligence-design.md:1-217
Viewed types.ts:1-124
Viewed LeadIntelligenceEngine.ts:1-413
Viewed lead-enrichment-flow.ts:1-253
Viewed lead-intelligence-actions.ts:1-313
Viewed page.tsx:1-24
Viewed LeadIntelligenceClient.tsx:1-392
Viewed DashboardTab.tsx:1-103
Viewed ProspectFinderTab.tsx:1-302
Viewed WebsiteScannerTab.tsx:1-150
Viewed SavedSearchesTab.tsx:1-50
Viewed SettingsTab.tsx:1-145
Viewed EntityLeadIntelTab.tsx:1-219
Viewed route.ts:1-90
Viewed route.ts:1-128
Viewed route.ts:1-191
Viewed 2026-06-11-lead-scoring-design.md:1-177
Viewed 2026-07-10-expanded-lead-scoring-design.md:1-121
Viewed scoring-performance-engine.ts:1-800
Viewed meeting-lead-capture-action.ts:1-303
Viewed lead-actions.ts:1-339
Searched for files: *
Viewed popup.js:1-216
Viewed page.tsx:1-800
Searched for "LeadIntelligence"

# Comprehensive Technical & Functional Review: SmartSapp Lead Intelligence Platform

> **Target Audience:** Technical Architects, Lead Gen / CRM Product Managers, AI Engineers, and Enterprise SaaS Reviewers.  
> **Purpose:** Full structural, architectural, and algorithmic breakdown of the current implementation, followed by an actionable roadmap for maturing the platform into an enterprise-grade intelligence engine (comparable to *Apollo.io*, *Clay*, *ZoomInfo*, and *Clearbit*).

---

## 1. Executive Summary & Module Vision

The **Lead Intelligence Module** in SmartSapp is an end-to-end prospect discovery, technographic auditing, AI opportunity diagnosis, and CRM ingestion engine. It acts as the acquisition and intelligence layer feeding SmartSapp's core CRM, communication pipelines (WhatsApp/SMS/Email), call center campaigns, and automation workflows.

### Primary Capabilities Today
1. **Multi-Source Prospect Discovery:** Location- and industry-based local business discovery supporting **Google Places API** with fallback to an **AI-driven localized lead generator**.
2. **Technographic & Network Auditing:** Integrates with **BuiltWith API** (CMS, frameworks, analytics, widgets) and **Hunter.io API** (decision-maker email addresses and confidence scores), plus SSL and web performance diagnostics.
3. **AI Opportunity Diagnostic ("Opportunity Stethoscope"):** A **Genkit-powered AI workflow** (Gemini 2.5/3.5 Flash with automatic failover to Anthropic Claude 3.5 Sonnet) that analyzes the business profile, diagnoses digital weaknesses, computes need scores, recommends matching products, formulates custom elevator pitches, and generates tailored objection-handling strategies.
4. **Standalone Chrome Extension (Manifest V3):** Allows sales reps to visit any prospect website, instantly run a technographic and AI opportunity audit from their browser toolbar, and sync the lead directly into the CRM.
5. **Direct CRM Sync & Transactional Data Mapping:** Converts raw prospects into multi-tenant **Global Entities (`entities`)** and **Workspace-Scoped Entities (`workspace_entities`)**, creating contact sub-structures, initial lead scores, and activity audit trails.
6. **Multi-Layer Lead Scoring & Hygiene Engine:** Contact- and entity-level score aggregation, real-time engagement score triggers (survey completions, email opens/clicks, call outcomes, document signing), and contact hygiene filtering (bounced email detection, verification scores).
7. **In-Context CRM Inspection Tab:** A dedicated **Lead Intelligence Tab** directly embedded within contact and institution profile pages in the CRM for on-demand re-enrichment during live sales calls.

---

## 2. System Architecture & Component Interactions

```mermaid
graph TB
    subgraph Client & Ingestion Layer
        WebUI[SmartSapp Web Console<br/>/admin/lead-intelligence]
        ExtUI[Chrome Extension MV3<br/>Popup Toolbar]
        CRMExt[CRM Entity Detail Page<br/>EntityLeadIntelTab]
    end

    subgraph Server Action & API Gateway
        ActSearch[searchProspectsAction]
        ActEnrich[enrichProspectAction]
        ActSync[syncProspectToCRMAction]
        APIScan[/api/lead-intelligence/extension/scan]
        APISync[/api/lead-intelligence/extension/sync]
        APIDownload[/api/lead-intelligence/extension/download]
    end

    subgraph Core Engine: LeadIntelligenceEngine
        Engine[LeadIntelligenceEngine.ts]
        HasKeys{API Keys Configured?}
        RealGoogle[Google Places API]
        RealBW[BuiltWith API]
        RealHunter[Hunter.io API]
        GenkitFlow[Genkit AI Enrichment Flow<br/>Gemini / Claude Fallback]
    end

    subgraph Storage & CRM Persistence
        DB_Prospects[(Firestore: prospects)]
        DB_Settings[(Firestore: system_settings)]
        DB_Entities[(Firestore: entities)]
        DB_WSEntities[(Firestore: workspace_entities)]
        DB_Scoring[(Firestore: leadScores & leadScoreHistory)]
        DB_Effort[(Firestore: effortEvents & userEffortSummary)]
    end

    %% Client to Actions
    WebUI --> ActSearch & ActEnrich & ActSync
    CRMExt --> ActEnrich
    ExtUI --> APIScan & APISync
    WebUI --> APIDownload

    %% Actions to Engine
    ActSearch --> Engine
    ActEnrich --> Engine
    APIScan --> Engine

    %% Engine Logic
    Engine --> HasKeys
    HasKeys -- Yes --> RealGoogle & RealBW & RealHunter
    HasKeys -- No / Fallback --> GenkitFlow
    RealGoogle & RealBW & RealHunter --> GenkitFlow

    %% Persistence
    GenkitFlow --> DB_Prospects
    ActSync & APISync --> DB_Entities & DB_WSEntities & DB_Prospects
    ActSync & APISync --> DB_Scoring & DB_Effort
    APIDownload --> DB_Settings
```

---

## 3. Deep-Dive: Core Subsystems & How They Work

### 3.1. Prospect Finder & Discovery Subsystem
- **Entry Point:** `src/app/admin/lead-intelligence/components/ProspectFinderTab.tsx`
- **Engine Logic:** `LeadIntelligenceEngine.searchProspects()` in `src/lib/lead-intelligence/LeadIntelligenceEngine.ts`
- **Execution Flow:**
  1. Checks workspace settings for a valid `googlePlacesApiKey`.
  2. **Real API Execution (if key exists):**
     - Queries `https://maps.googleapis.com/maps/api/place/textsearch/json` using the keyword, city, and country.
     - Spawns parallel detail queries (`maps/api/place/details/json`) for the top 8 candidates to resolve website URLs, phone numbers, and geometric coordinates.
     - Strips and standardizes URLs into clean root domain names.
  3. **Dynamic AI Fallback Simulation (if key is absent):**
     - Invokes a Genkit structured schema generator via Gemini.
     - Analyzes target geography (e.g., Accra, Kumasi, Nairobi, London) and requested industry.
     - Generates 6 hyper-realistic local business profiles with geo-accurate coordinates (latitude/longitude), realistic phone prefixes, review counts, Google My Business claimed status, and domains.
     - If AI generation times out or fails, falls back gracefully to a hardcoded local registry (`MOCK_GHANA_PROSPECTS`).
  4. **Persistence:** Search results are batch-written to the Firestore `prospects` collection with `syncStatus: 'unregistered'`.
  5. **UI Presentation:** Displays an interactive **Target Area Map Pins Canvas**, searchable table with claimed badges, review ratings, need score badges, on-demand "Enrich" triggers, and a **Side Drawer Detail Sheet**.

---

### 3.2. Technographic Scanner & Multi-Provider Enrichment
- **Engine Logic:** `LeadIntelligenceEngine.enrichProspect()`
- **AI Flow:** `src/ai/flows/lead-enrichment-flow.ts`
- **Data Enrichment Sequence:**
  1. **BuiltWith API Lookup:** If `builtwithApiKey` is configured, queries `https://api.builtwith.com/v20/api.json?lookup={domain}` to retrieve active technologies, frameworks, CMS instances, analytics trackers, and payment gateways.
  2. **Hunter.io API Lookup:** If `hunterApiKey` is configured, queries `https://api.hunter.io/v2/domain-search?domain={domain}` to extract verified employee names, job titles, professional email addresses, confidence levels, and deliverability verification statuses.
  3. **Genkit AI "Stethoscope" Pipeline:**
     - Passes the aggregate profile (business name, domain, industry, rating, reviews count, detected tech, scraped text snapshot) into `leadEnrichmentFlow`.
     - **Resilient AI Pipeline Architecture:**
       - Primary: Gemini (`gemini-3.5-flash` / `gemini-2.5-flash`).
       - Rate-limit (`429` / `RESOURCE_EXHAUSTED`) or server overload (`503` / `UNAVAILABLE`) trigger an automatic failover to **Anthropic Claude 3.5 Sonnet** with prompt-guided JSON parsing and exponential backoff (2s, 4s).
     - **Structured Insights Generated:**
       - `websiteScan`: SSL validity, estimated load times (ms), meta title/description, social handles (Facebook, Instagram, LinkedIn, X), broken links.
       - `contacts`: Predicted key decision-makers (Principal, IT Director, Head of Finance, Managing Director) with confidence scores.
       - `scoring`: Granular score breakdown (detailed below).
       - `aiInsights`: Comprehensive executive summary, problems found, transformation opportunities, suggested SmartSapp product modules, estimated annual contract value (USD), customized sales pitch, and dynamic objection-handling Q&A pairs.

```typescript
// Core Scoring Breakdown Schema generated per prospect
export interface ProspectScoring {
  overallScore: number;        // 0 - 100 (Readiness to buy / conversion index)
  needScore: number;           // 0 - 25  (Pain points and digital gaps)
  digitalMaturity: number;     // 0 - 15  (Lower maturity = higher software upside)
  buyingIntent: number;        // 0 - 20  (Market activity, reviews velocity)
  budgetProbability: number;   // 0 - 15  (Estimated business size / pricing capacity)
  decisionMakerFound: number;  // 0 - 10  (Confidence in direct executive contact)
  engagement: number;          // 0 - 15  (Interactions recorded)
}
```

---

### 3.3. Chrome Extension (Manifest V3) & Dynamic Packager
- **Extension Directory:** `public/extension/` (`manifest.json`, `popup.html`, `popup.js`, `background.js`)
- **API Endpoints:**
  - `GET /api/lead-intelligence/extension/scan?url={url}`
  - `POST /api/lead-intelligence/extension/sync`
  - `GET /api/lead-intelligence/extension/download?workspaceId={id}&token={token}`
- **How It Works:**
  1. **Instant Token Generator & Packager:**
     - Administrators generate a secure workspace token in the settings tab (`tok_{timestamp}_{random}`).
     - When clicking **"Download ZIP Archive"**, the server uses `JSZip` to dynamically compile the extension files on-the-fly, injecting a pre-configured `config.json` containing the workspace URL and token.
     - The user unzips and sideloads the extension into Chrome (`chrome://extensions` via Developer Mode) without needing manual configuration.
  2. **Active Tab Scraping:**
     - Reps click the extension icon on any prospect site.
     - `popup.js` extracts the active URL, validates credentials against `chrome.storage.local` (or `config.json`), and calls `/api/lead-intelligence/extension/scan`.
     - The backend checks if the domain already exists; if not, it enriches the domain in real-time and returns the full audit profile.
  3. **Toolbar Capabilities:**
     - Displays company name, overall score, website technographics, decision-maker emails, and problems found.
     - **"AI Pitch" button:** Instantly opens the customized sales script.
     - **"Import to SmartSapp Contacts" button:** Calls `/api/lead-intelligence/extension/sync` to create CRM records with zero context switching.

---

### 3.4. Transactional CRM Ingestion Pipeline
- **Implementation:** `syncProspectToCRMAction` in `src/app/actions/lead-intelligence-actions.ts` and `POST /api/lead-intelligence/extension/sync`
- **Atomicity & Data Integrity:**
  Executed inside an **atomic Firestore Transaction**:
  1. **Duplicate Prevention:** Reads `prospect.syncStatus`. If already synced, aborts. Queries `workspace_entities` for case-insensitive name collisions (`displayNameLower`).
  2. **Entity Graph Creation:**
     - **Global `entities` Document:** Holds master data, location string, canonical `entityContacts` list, and global audit metadata.
     - **Workspace `workspace_entities` Document:** Holds tenant-scoped search projections, `workspaceTags: ['synced-lead']`, normalized contact indicators (`primaryEmail`, `primaryPhone`, `primaryContactName`), and initial `leadScore`.
  3. **State Transition & Activity Logging:**
     - Updates `prospects/{id}` with `syncStatus: 'synced'` and `syncedEntityId: entityId`.
     - Creates an audit record in `prospects/{id}/activities` (`type: 'create_deal'`).
  4. **Lead Scoring Ledger Integration:**
     - Invokes `adjustLeadScoreAction` from `scoring-performance-engine.ts`.
     - Sets the contact's initial score in `leadScores/{contactId}` and logs the change in `leadScoreHistory`.

---

### 3.5. Multi-Level Lead Scoring, Hygiene & Activity Engine
- **Engine Logic:** `src/lib/scoring-performance-engine.ts`
- **Scoring Management Console:** `src/app/admin/entities/lead-scoring/page.tsx`
- **Scoring Capabilities:**
  1. **Dual-Scope Aggregation:** Contact-level scores (`entityContacts[i].score`) automatically sum up to parent institution scores (`entities.leadScore` and `workspace_entities.leadScore`) within Firestore transactions.
  2. **Event-Bus Engagement Routing (`emitScoringEvent`):**
     - Listens to system activities across channels and maps them to workspace rules:
       - `email_opened` (+2), `email_clicked` (+5), `email_bounced` (-10)
       - `sms_link_clicked` (+5), `sms_failed` (-5)
       - `survey_started` (+2), `survey_completed` (+15)
       - `meeting_attended` (+20), `document_signed` (+30)
       - `call_completed`: Supports positive outcome rule sets (`callCampaignPositiveOutcomes`) or granular overrides (`call_outcome:decision_maker_interested`).
  3. **Salesperson Effort & Gamification (`userEffortSummary`):**
     - Scores staff actions (calls made, meetings booked, tasks completed, deals created, proposals sent) and maintains real-time team leaderboards.
  4. **Contact Hygiene & Cleaning Tools:**
     - Detects deliverability flags, low verification scores (<40), and hard bounces.
     - Offers one-click single verification, bulk email cleaning, bulk archiving, and bulk lead re-assignment.

---

## 4. Firestore Data Models & Schema Reference

### 4.1. `prospects` Collection
*Document ID:* `gplaces_{place_id}` or `cscan_{workspaceId}_{timestamp}` or `sim_{org}_{ws}_{timestamp}_{idx}`

```typescript
interface Prospect {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  domain: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewsCount?: number;
  claimed?: boolean;
  industry?: string;
  location?: { lat: number; lng: number };
  
  websiteScan?: {
    scannedAt: string;
    technologies: string[];
    sslValid: boolean;
    sslExpiresAt?: string;
    loadTimeMs?: number;
    metaTitle?: string;
    metaDescription?: string;
    hasFacebook: boolean;
    hasInstagram: boolean;
    hasLinkedIn: boolean;
    hasTwitter: boolean;
    brokenLinks?: string[];
  };

  contacts: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
    confidence: number;
    verificationStatus: 'verified' | 'unverified' | 'unknown';
  }>;

  scoring: {
    overallScore: number;
    needScore: number;
    digitalMaturity: number;
    buyingIntent: number;
    budgetProbability: number;
    decisionMakerFound: number;
    engagement: number;
  };

  aiInsights?: {
    summary: string;
    problemsFound: string[];
    opportunities: string[];
    suggestedProducts: string[];
    estimatedRevenueOpportunity: number;
    recommendedPitch: string;
    objectionsAnswered: Array<{ objection: string; counter: string }>;
  };

  syncStatus: 'unregistered' | 'synced';
  syncedEntityId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2. `system_settings/keys_{workspaceId}` Document
```typescript
interface LeadIntelligenceSettings {
  workspaceId: string;
  organizationId: string;
  googlePlacesApiKey?: string;
  builtwithApiKey?: string;
  hunterApiKey?: string;
  chromeExtensionToken?: string;
  updatedAt: string;
}
```

### 4.3. `saved_searches` Collection
```typescript
interface SavedSearch {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  filters: {
    country?: string;
    city?: string;
    industry?: string;
    radius?: number;
    technologies?: string[];
    claimed?: boolean;
    ratingMin?: number;
  };
  prospectsCount: number;
  createdAt: string;
}
```

### 4.4. Lead Scoring & Effort Collections
- **`leadScores/{contactId}`**: `{ id: string, contactId: string, currentScore: number }`
- **`leadScoreHistory/{historyId}`**: Detailed ledger containing `oldScore`, `newScore`, `change`, `reason`, `source`, `actorId`, `actorType`, `createdAt`.
- **`effortRules/{workspaceId}_{eventType}`**: Custom points configuration per organization event.
- **`userEffortSummary/{userId}`**: Aggregated points for sales reps (calls, meetings, tasks, deals won).

---

## 5. API Endpoints & Server Actions Directory

| Route / Server Action | Method / Type | Purpose | Security & Validation |
| :--- | :--- | :--- | :--- |
| `searchProspectsAction` | Server Action | Searches local businesses via Google Places or AI simulation; persists unregistered records | Authenticated workspace session |
| `enrichProspectAction` | Server Action | Runs BuiltWith, Hunter.io, and Genkit AI diagnostics for a prospect | Validates prospect ID & workspace bounds |
| `syncProspectToCRMAction` | Server Action | Converts prospect into CRM `entities` & `workspace_entities` | Firestore transaction, name deduplication |
| `getRecentProspectsAction` | Server Action | Fetches recent workspace discoveries | Scoped to active `workspaceId`, limit 30 |
| `saveSearchAction` / `getSavedSearchesAction` | Server Action | Stores and retrieves query configurations | Scoped to active `workspaceId` |
| `getLeadSettingsAction` / `saveLeadSettingsAction` | Server Action | Manages third-party API keys and extension auth tokens | Scoped to `keys_{workspaceId}` |
| `/api/lead-intelligence/extension/scan` | `GET` | Endpoint called by Chrome Extension to audit active tab URL | `Bearer {chromeExtensionToken}` header validation, CORS headers |
| `/api/lead-intelligence/extension/sync` | `POST` | Endpoint called by Chrome Extension to sync lead directly into CRM | `Bearer {chromeExtensionToken}` header validation, transactional write |
| `/api/lead-intelligence/extension/download` | `GET` | Dynamically packages and downloads customized Chrome Extension ZIP | Token & workspace match verification |

---

## 6. Current Strengths vs. Architectural Limitations

### Current Strengths
- **Resilient AI Pipeline:** Genkit with Gemini 3.5/2.5 Flash and automatic Anthropic Claude 3.5 Sonnet fallback prevents downtime from quota exhaustion or model degradation.
- **Graceful Degradation:** Can operate with zero third-party API keys using realistic simulation, or seamlessly upgrade when keys are supplied.
- **Deep CRM Cohesion:** Leads do not stay in a silo; syncing creates fully compatible CRM records with contact hierarchies, scoring records, and audit logs.
- **Frictionless Browser Integration:** Sideloadable Chrome extension with zero-config token injection provides an instant prospecting tool for reps.
- **Granular Scoring & Hygiene:** Combines contact and parent-entity score rollups with email verification hygiene.

### Critical Limitations & Gaps (Opportunities for Maturation)
1. **Synchronous Real-Time Processing:** Scraping and enrichment currently run in the HTTP request lifecycle; bulk operations risk timing out on large sets without an async worker queue.
2. **Limited Scraping Depth:** Web audits rely primarily on APIs (BuiltWith/Hunter) or AI estimation rather than headless browser DOM parsing (e.g., Puppeteer, Playwright, or Crawlee) for on-page text extraction, meta tags, and live technology signatures.
3. **Single Contact Discovery Provider:** Relies solely on Hunter.io without waterfall enrichment (e.g., falling back to Apollo, Clearbit, Lusha, or Prospeo if an email is not found).
4. **Lack of Continuous Signal Tracking:** No background monitoring for job postings, funding news, DNS/MX changes, or website technology stack updates.
5. **No AI Outbound Sequencing Integration:** While pitches and objection handlers are generated, there is no one-click path to enroll the lead into an automated, personalized AI outreach cadence (email/WhatsApp/voice).
6. **Stateless Deduplication:** Matching on sync checks exact lowercase name; fuzzy matching (Levenshtein distance) and domain-level alias mapping are not yet implemented.

---

## 7. Enterprise Maturation Blueprint (Roadmap to Apollo / Clay Grade)

To transform this module into an industry-grade B2B intelligence engine, the following enhancements are recommended:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     Enterprise Lead Intelligence Roadmap                        │
├──────────────────────┬──────────────────────┬───────────────────────────────────┤
│ Phase 1: Ingestion & │ Phase 2: Live Signal │ Phase 3: Autonomous AI SDR &      │
│ Waterfall Enrichment │ & Intent Engine      │ Multi-Channel Execution           │
├──────────────────────┼──────────────────────┼───────────────────────────────────┤
│ • Async Worker Queue │ • DNS/MX Monitoring  │ • 1-Click AI Cadence Enrollment   │
│ • Multi-Vendor API   │ • Hiring / Tech Shift│ • Dynamic Variable Injection      │
│   Waterfall          │   Signals            │ • Conversational WhatsApp / Voice │
│ • Deep DOM Scraper   │ • Real-time Intent   │ • Automated Account-Based         │
│ • MX / SMTP Verifier │   Scoring            │   Campaigns                       │
└──────────────────────┴──────────────────────┴───────────────────────────────────┘
```

### Phase 1: Resilient Async Ingestion & Waterfall Enrichment
1. **Background Job Orchestration (BullMQ / Inngest / Cloud Tasks):**
   - Decouple prospect discovery and enrichment from synchronous HTTP request lifecycles.
   - Support bulk discovery jobs (e.g., scanning 5,000 businesses across a region) with progress tracking and retry semantics.
2. **Waterfall Data Enrichment Engine:**
   - Chain providers sequentially to maximize match rates while minimizing API spend:
     - **Email:** Hunter.io $\rightarrow$ Apollo.io $\rightarrow$ Anymail Finder $\rightarrow$ Dropcontact.
     - **Technographics & Firmographics:** BuiltWith $\rightarrow$ Wappalyzer $\rightarrow$ Clearbit $\rightarrow$ Ocean.io.
3. **Integrated Headless Scraping Worker:**
   - Deploy a lightweight headless crawler (Playwright/Cheerio) to scrape actual homepage text, header tags, team/about pages, and privacy policy contact disclosures.
4. **Real-time SMTP & MX Verification Pipeline:**
   - Implement syntax validation, DNS MX record lookup, disposable email detection, and live SMTP handshake checks before committing emails as "verified".

### Phase 2: Intent Signals & Predictive Scoring Models
1. **Continuous Intent & Technographic Signals:**
   - Schedule recurring delta scans (every 30 days) to detect changes in a prospect's tech stack (e.g., added Shopify, dropped WooCommerce, installed Google Tag Manager).
   - Track hiring intent by monitoring careers pages or job board APIs for relevant keywords.
2. **Dynamic Decay & Predictive Propensity Scoring:**
   - Introduce time-decay algorithms to reduce lead scores when a prospect remains inactive for 30, 60, or 90 days.
   - Transition from fixed heuristics to weighted propensity models that calculate conversion probability based on historical closed-won deals in the workspace.

### Phase 3: Autonomous AI SDR & Outbound Workflow Orchestration
1. **One-Click AI Multi-Channel Sequences:**
   - Connect enriched prospects directly into automated outreach cadences across WhatsApp, SMS, and Email.
   - Use the `aiInsights.recommendedPitch` and `aiInsights.problemsFound` as context variables in message templates (e.g., `{{lead_pitch}}`, `{{detected_gaps}}`).
2. **AI Voice SDR Calling Agent:**
   - Feed the prospect's profile, digital diagnosis, and objection counters into an AI voice calling engine (e.g., Vapi / Retell / LiveKit) for automated qualification calls.

### Phase 4: Enterprise Governance, Security & Compliance
1. **Compliance & Privacy Guardrails:**
   - Built-in verification for **GDPR Article 6/14**, **CAN-SPAM**, and **CCPA** compliance.
   - Global suppression lists, opt-out registries, and automated unsubscribe synchronization.
2. **Token Encryption & Role-Based Access Controls:**
   - Encrypt third-party API keys in Firestore at rest using Google Cloud KMS.
   - Granular permissions restricting who can export prospect lists, download extensions, or modify scoring rules.

---

## 8. Summary Review Checklist for Technical Evaluators

| Dimension | Current Implementation Status | Production Readiness Score | Next Milestone |
| :--- | :--- | :---: | :--- |
| **Core Architecture** | Next.js 15 Server Actions + API Routes + Genkit AI | **9 / 10** | Add async queue (Cloud Tasks / BullMQ) |
| **Data Enrichment** | Google Places + BuiltWith + Hunter + Gemini/Claude | **8 / 10** | Implement waterfall enrichment providers |
| **AI Insights Depth** | Structured JSON schema: scoring, pitches, objections, revenue | **9.5 / 10** | Ground AI prompts with live scraped DOM text |
| **Browser Extension** | Sideloadable Manifest V3 with dynamic token ZIP builder | **8.5 / 10** | Publish to official Chrome Web Store |
| **CRM Integration** | Atomic Firestore transactions with deduplication | **9 / 10** | Add Levenshtein fuzzy matching on import |
| **Scoring & Hygiene** | Multi-level rollups, event triggers, cleaning tools | **8.5 / 10** | Add time-decay curves & ML propensity models |
| **Outbound Bridge** | Manual pitch viewing & deal linking | **7 / 10** | Build 1-click enrollment into AI messaging cadences |

---

*This document represents the complete technical baseline of the SmartSapp Lead Intelligence platform. It can be shared directly with technical reviewers, architects, and engineering leadership.*