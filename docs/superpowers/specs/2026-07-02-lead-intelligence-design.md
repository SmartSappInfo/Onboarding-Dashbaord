# Lead Intelligence Platform Design Spec

## Goal Description
Build a modern, provider-agnostic **Lead Intelligence Platform** inside SmartSapp that aggregates local business data, technology stacks, contact details, and AI opportunities. It serves as the front door to SmartSapp's CRM, deals pipeline, messaging campaigns, and automation triggers.

This design implements a flat sidebar module with a tabbed interior dashboard and connects deeply into existing CRM contacts and deals views. It uses a provider-agnostic engine that queries real data keys (Google Places, BuiltWith, Hunter.io) when configured, falling back to a dynamic, hyper-realistic Gemini-driven AI generator when keys are absent. It also provides a sideloadable Chrome Extension to scan websites directly from the browser and sync them to the CRM.

---

## User Interface & Integration Layout

### Flat Sidebar Navigation Link
- Add a new flat sidebar link **"Lead Intelligence"** in [AdminSidebar.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/components/AdminSidebar.tsx) under the "Operations" nav group, mapping to `/admin/lead-intelligence`.
- Uses a modern icon like `Sparkles` or `Globe`.

### Tabbed Dashboard System
The `/admin/lead-intelligence` page will serve as the hub, rendering a header and a premium client-side tabs navigation system (`Tabs` from shadcn/ui):
1. **Dashboard (`/admin/lead-intelligence?tab=dashboard`):** Displays overall discovery statistics, search volume charts, recent scan activities, and high-value AI opportunity callouts.
2. **Prospect Finder (`/admin/lead-intelligence?tab=finder`):** Map-centric interface combining search inputs (country, city, industry, radius) and filters (claimed GMB status, reviews rating, digital maturity) with a list of prospects and inline sync buttons.
3. **Website Scanners (`/admin/lead-intelligence?tab=scanner`):** Simple domain scanner form (e.g. input `school.com`) to run website audits, scrape metadata, and tech lists on demand.
4. **Saved Searches (`/admin/lead-intelligence?tab=searches`):** List of saved searches with quick actions to rerun or trigger bulk prospecting runs.
5. **Chrome Ext & Settings (`/admin/lead-intelligence?tab=settings`):** Workspace API credentials form (Google Places, BuiltWith, Hunter) and Chrome Extension token generator, download ZIP link, and instructions.

### CRM Details Page Integrations
1. **Contacts Tab:** Modify [EntitiesClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/entities/EntitiesClient.tsx) or contact detail view to add a **"Lead Intelligence"** tab for synced leads. Displays the website scan tech stack, opportunity score, detected opportunities, recommended SmartSapp product pitch, and download buttons for AI proposals or scripting.
2. **Deals Inspector:** Add an AI pitch block, objections assistant, and script generator inside the Deal inspect modal to support sales reps directly during calls.

---

## Firestore Database Models (Option B: Cohesive Document-Centric)

To optimize Firestore speed and minimize document read costs, all core lead metadata (scores, scans, contacts, opportunities) are consolidated into a single document in the `prospects` collection.

### 1. `prospects` (Collection)
Keyed by: `${organizationId}_${workspaceId}_${prospectId}` (where `prospectId` is either the Google Places ID or a hashed website URL).
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
  
  // Website Scan Results (BuiltWith & Scraping details)
  websiteScan?: {
    scannedAt: string;
    technologies: string[]; // e.g. ['wordpress', 'react', 'cloudflare', 'stripe']
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

  // Contacts Scraped (Hunter/Clearbit or Dynamic Simulation)
  contacts: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
    confidence: number; // 0 - 100
    verificationStatus: 'verified' | 'unverified' | 'unknown';
  }>;

  // Intelligence & Opportunity Scores
  scoring: {
    overallScore: number; // 0 - 100
    needScore: number;
    digitalMaturity: number;
    buyingIntent: number;
    budgetProbability: number;
    decisionMakerFound: number;
    engagement: number;
  };

  // AI Opportunities Report (Generated from Website scan + Reviews + Jobs)
  aiInsights?: {
    summary: string;
    problemsFound: string[];
    opportunities: string[]; // e.g. ['No booking engine', 'Poor parent communication']
    suggestedProducts: string[]; // e.g. ['SmartSapp Pay', 'Parent App']
    estimatedRevenueOpportunity: number; // Annual value in USD
    recommendedPitch: string;
    objectionsAnswered: Array<{ objection: string; counter: string }>;
  };

  syncStatus: 'unregistered' | 'synced';
  syncedEntityId?: string; // Links to CRM WorkspaceEntity doc
  createdAt: string;
  updatedAt: string;
}
```

### 2. `prospect_activities` (Sub-collection under `prospects`)
Used for historical timelines of emails, proposals, calls, and meetings.
```typescript
interface ProspectActivity {
  id: string;
  prospectId: string;
  workspaceId: string;
  type: 'log_call' | 'send_email' | 'add_note' | 'generate_proposal' | 'create_deal';
  userId: string;
  userName: string;
  content: string; // The note content, proposal summary, or call details
  metadata?: any;  // e.g. links to generated PDFs or script files
  createdAt: string;
}
```

### 3. `saved_searches` (Collection)
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

### 4. `lead_enrichment_jobs` (Collection)
Tracks status of background tasks.
```typescript
interface EnrichmentJob {
  id: string;
  organizationId: string;
  workspaceId: string;
  type: 'search' | 'website_scan' | 'enrich';
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: any;
  resultsCount?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}
```

---

## Provider Engine & AI Fallback Architecture

We define a service class `src/lib/lead-intelligence/LeadIntelligenceEngine.ts` that acts as the entry point. It resolves integration credentials from `system_settings/lead_intelligence_keys`.

```mermaid
graph TD
    UserQuery[User Searches or Crawls URL] --> Engine[LeadIntelligenceEngine]
    Engine --> HasKeys{API Keys in settings?}
    
    HasKeys -- Yes -- RealAPIs[Call Google Places / BuiltWith / Hunter] --> Standardize[Normalize Results]
    HasKeys -- No -- AISim[Invoke Gemini AI Generator Flow] --> Standardize
    
    Standardize --> GenkitFlow[Run Genkit Enrichment Flow]
    GenkitFlow --> AIResults[Enrich scores, opportunities, objections, pitches]
    AIResults --> SaveDB[Save to Firestore prospects collection]
```

### 1. The Genkit Enrichment Flow
We will implement `src/ai/flows/lead-enrichment-flow.ts` to perform the structured JSON generation using Gemini 1.5/2.0 Flash. It uses a typed schema for `aiInsights` and `scoring`.

### 2. Synchronization with SmartSapp CRM
When the user triggers a sync:
- A new document is added to the global `entities` collection.
- A matching document is created in the `workspace_entities` collection.
- If a contact is synced, its `syncStatus` changes to `synced` and `syncedEntityId` points to the CRM id.

---

## Chrome Extension Manifest V3 Integration

### File Layout (`public/extension/`)
- `manifest.json`: Defines background service workers and popups.
- `popup.html`: Compact SmartSapp-themed UI.
- `popup.js`: Script to query URL, call API with Bearer token, and display scan details.
- `background.js`: Saves authentication state in `chrome.storage`.

### Next.js API Routes for Extension & Packaging
1. `GET /api/lead-intelligence/extension/scan?url=...`: Requires Bearer Token validation. Resolves lead intelligence for tab URL.
2. `POST /api/lead-intelligence/extension/sync`: Syncs lead directly to CRM from Chrome popup.
3. `GET /api/lead-intelligence/extension/download`: Compiles `public/extension` into a ZIP. Dynamically overwrites `config.json` inside the ZIP to embed the user's generated API token and website hostname, so the user can download, unzip, and load the extension immediately.

---

## Verification Plan

### Automated Tests
- Run backend unit tests for `LeadIntelligenceEngine` to confirm it accurately delegates between real API clients and the fallback AI simulator.
- Test endpoint parameters and JSON schemas of Genkit flows.

### Manual Verification
- Deploy local dev server, access the new "Lead Intelligence" tab.
- Perform a search in the Finder (verifying map representation, filter sidebar, and list sync events).
- Trigger a website scan for a school domain.
- Create a test deal and verify that the AI Pitch suggestions appear correctly in the details card.
- Download the packaged ZIP, load unpacked in Chrome developer tools, and scan a mockup test website tab.
