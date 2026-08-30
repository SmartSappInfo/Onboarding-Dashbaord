# Notes Module: Comprehensive Architectural Documentation & Technical Specification

**Document Version:** 1.0.0  
**Status:** Active / Production-Grade  
**System Classification:** Core Workspace & CRM Communications Subsystem  
**Target Audience:** Technical Architects, Lead Engineers, External Auditors, System Integrators  

---

## 1. Executive Summary & Mission

The **Notes Module** in the SmartSapp Platform is a unified, multi-tenant intelligence and knowledge capture subsystem. It provides a dual-paradigm notes experience:
1. **Workspace Quick Notes (Knowledge Base & Board View):** A workspace-level, category-indexed, Notion-grade rich-text note repository equipped with semantic AI search, automated synthesis, and cross-record tagging.
2. **Entity & Record-Linked CRM Notes:** Context-specific operational notes attached to CRM contacts, schools/institutions, pipeline deals, tasks, and call centre interactions.
3. **Global Floating HUD (Heads-Up Display):** A globally accessible, theme-adaptive, draggable floating composer available across all admin pages with contextual entity detection and zero-overhead real-time persistence.

The architecture is built upon clean domain-driven design (DDD), structural AST document representations (TipTap JSON), server-side AI orchestration via Genkit, and multi-tenant Firestore isolation.

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       USER INTERFACE LAYER                                       │
│                                                                                                 │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌─────────────────────────────┐  │
│  │   Quick Notes Board       │  │    Floating Notes HUD     │  │   Entity CRM Notes Widget   │  │
│  │  (/admin/quick-notes)     │  │   (Global Layout Mount)   │  │  (/admin/entities/[id])     │  │
│  │  • CategoryRail.tsx       │  │  • FloatingNotesHUD.tsx   │  │  • EntityNotesWidget.tsx    │  │
│  │  • QuickNoteCard.tsx      │  │  • FloatingNotesContext   │  │  • EntityNotesTab.tsx       │  │
│  │  • AggregatedNoteCard.tsx │  │  • Draggable Ref Physics  │  │  • LinkedQuickNotesPanel    │  │
│  │  • NoteEditorDialog.tsx   │  │  • Auto Entity Detection  │  │  • XSS Sanitized Composer   │  │
│  │  • NoteBlockEditor.tsx    │  │  • Radix Dropdowns        │  │                             │  │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────────────┬──────────────┘  │
└────────────────┼──────────────────────────────┼───────────────────────────────┼─────────────────┘
                 │                              │                               │
┌────────────────▼──────────────────────────────▼───────────────────────────────▼─────────────────┐
│                                   CLIENT HOOKS & DOMAIN LAYER                                   │
│                                                                                                 │
│  • quick-notes-hooks.ts: useQuickNotes(), useNoteCategories(), useLinkedQuickNotes()            │
│  • quick-notes-domain.ts: plainTextToTipTap(), deriveTitleFromText(), extractPlainText()        │
│  • Client CRUD: createQuickNote(), updateQuickNote(), deleteQuickNote(), toggleQuickNotePin()    │
└────────────────┬──────────────────────────────────────────────────────────────┬─────────────────┘
                 │                                                              │
┌────────────────▼─────────────────────────────┐              ┌─────────────────▼─────────────────┐
│        SERVER ACTIONS & AI ORCHESTRATION     │              │    LEGACY AGGREGATION ADAPTERS    │
│                                              │              │                                   │
│  • quick-notes-actions.ts: logActivity()     │              │  • note-source-adapters/          │
│  • quick-notes-ai-actions.ts:                │              │    - entity-note-adapter.ts       │
│    - generateQuickNoteInsight()              │              │    - task-note-adapter.ts         │
│    - generateQuickNotesDigest()              │              │    - call-note-adapter.ts         │
│    - createTaskFromActionItem()              │              │    - types.ts (UnifiedNote model) │
│  • quick-notes-search-actions.ts:            │              │  • quick-notes-aggregator.ts      │
│    - semanticSearchNotes() (Vector Search)   │              │  • quick-notes-feed-actions.ts    │
│  • Genkit Flows (ai/flows/):                 │              └─────────────────┬─────────────────┘
│    - summarize-quick-note-flow.ts            │                                │
│    - quick-notes-digest-flow.ts              │                                │
│    - embed-note-flow.ts (text-embedding-004) │                                │
│    - get-link-metadata-flow.ts (SSRF Safe)   │                                │
└────────────────┬─────────────────────────────┘                                │
                 │                                                              │
┌────────────────▼──────────────────────────────────────────────────────────────▼─────────────────┐
│                                   DATA PERSISTENCE & STORAGE                                    │
│                                                                                                 │
│  Cloud Firestore Collections:                                                                   │
│  ├── /quick_notes/{noteId}              (Workspace Knowledge Notes, TipTap JSON, pinned, tags)  │
│  ├── /quick_note_categories/{catId}     (Workspace Category Registry & Swatches)                │
│  ├── /entity_notes/{noteId}             (CRM Contact Notes, parent-child replies, deal tags)    │
│  └── /note_index/{rowId}                (Denormalized Vector Index, 768-dim embeddings)         │
│                                                                                                 │
│  Firebase Storage:                                                                              │
│  └── /workspaces/{wsId}/quick-notes/    (Media, Documents, Scraped Link Thumbnails)             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models & Schemas

### 3.1. TipTap Document Representation (`NoteDocument`)
Rather than storing unformatted plain text or vulnerable raw HTML strings, Quick Notes stores rich text strictly as a TipTap JSON Abstract Syntax Tree (AST):

```typescript
export interface NoteDocument {
  type?: string;
  text?: string;
  content?: NoteDocument[];
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
```

#### Advantages:
- **Zero Raw HTML Injection (XSS Prevention):** Content is parsed and rendered through structured React node views.
- **Deterministic Server-Side Projection:** A pure function (`extractPlainText`) recursively traverses the AST to extract clean text for AI analysis and vector embeddings without stripping HTML tags with regex.
- **Structural Integrity:** Enforces validation boundaries via `noteDocumentSchema` (Zod).

---

### 3.2. Firestore Collection Specifications

#### 1. `/quick_notes/{noteId}` (Native Workspace Notes)
```typescript
export interface QuickNote {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  content: NoteDocument;               // TipTap JSON AST
  plainText: string;                   // Derived server-side projection
  contentVersion: number;              // Schema versioning guard (currently: 1)
  categoryId?: string;                 // FK -> /quick_note_categories/{id}
  tags: string[];                      // Normalized, deduplicated string tags
  attachments: QuickNoteAttachment[];  // Array of files, images, links
  links: QuickNoteLinks;               // Associated CRM entities, deals, tasks
  isPinned: boolean;                   // Pinned status (floats to top)
  pinnedAt?: string;
  pinnedBy?: string;
  embeddingVersion?: number;           // Vector generation version tracking
  ai?: QuickNoteAiMeta;                // Cached AI summary, sentiment, tags
  createdBy: string;                   // Firebase Auth UID
  createdByName?: string;              // Denormalized user display name
  createdAt: string;                   // ISO 8601 Timestamp
  updatedAt: string;                   // ISO 8601 Timestamp
}
```

#### 2. `/quick_note_categories/{categoryId}` (Categorization Rail)
```typescript
export interface QuickNoteCategory {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;                        // e.g. "Strategy", "Client Meeting", "Research"
  color: 'slate' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose';
  icon?: string;
  order: number;                       // Ascending sort order in category rail
  createdBy: string;
  createdAt: string;
}
```

#### 3. `/entity_notes/{noteId}` (Operational CRM Notes)
```typescript
export interface EntityNote {
  id: string;
  entityId: string;                    // Target Contact / School / Organization ID
  workspaceId: string;
  content: string;                     // Sanitized string / plain text
  noteType?: 'general' | 'call' | 'meeting' | 'escalation' | 'followup';
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  parentNoteId?: string;               // Threading & reply support
  replyCount?: number;
  dealId?: string;                     // Pipeline deal linkage
  dealName?: string;                   // Denormalized deal name
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 4. `/note_index/{rowId}` (Vector & Semantic Search Projection)
```typescript
export interface NoteIndexRow {
  id: string;                          // Format: `${source}:${sourceId}`
  source: 'quick_note' | 'entity_note' | 'task_note' | 'call_note';
  sourceId: string;
  workspaceId: string;
  organizationId: string;
  title: string;
  plainText: string;
  tags: string[];
  embedding: number[];                 // 768-dimensional float vector
  embeddingVersion: number;
  originHref?: string;                 // Deep link to origin record
  createdAt: string;
  indexedAt: string;
}
```

---

## 4. Pure Domain Architecture (`quick-notes-domain.ts`)

To keep the application testable, maintainable, and free of unnecessary I/O dependencies, core domain logic is written as pure, deterministic functions:

| Domain Function | Complexity | Responsibility |
| :--- | :--- | :--- |
| `extractPlainText(doc)` | $\mathcal{O}(N)$ (Depth-capped at 100) | Recursively extracts plain text from a `NoteDocument` AST while introducing appropriate linebreaks for paragraphs, headings, codeblocks, and lists. |
| `plainTextToTipTap(text)` | $\mathcal{O}(M)$ | Converts multiline raw text into a valid, minimal TipTap `NoteDocument` paragraph structure without requiring editor dependencies. |
| `deriveTitleFromText(text)` | $\mathcal{O}(1)$ | Extracts the first non-empty line of draft text, capped at 80 characters, with fallback to `"Quick Note"`. |
| `dedupeTags(tags)` | $\mathcal{O}(T)$ | Trims, case-insensitively deduplicates while preserving original casing, and caps tags array at 30 items. |
| `isSafeHttpUrl(url)` | $\mathcal{O}(1)$ | Defense-in-depth SSRF validator rejecting non-HTTP schemes, localhost, private IPv4 ranges, and cloud metadata hostnames (`.internal`, `metadata.google.internal`). |
| `sortUnifiedNotes(notes)` | $\mathcal{O}(N \log N)$ | Stable comparator sorting pinned notes first, followed by newest timestamp (`updatedAt` $\to$ `createdAt`). |
| `pruneUndefined(object)` | $\mathcal{O}(K)$ | Strips `undefined` properties from payload objects before sending to Firestore to prevent SDK write rejections. |

---

## 5. Normalized Legacy Adapter Layer

The Notes Module provides unified search and feed aggregation across multiple operational subsystems through the Adapter Pattern:

```typescript
export interface NoteSourceAdapter {
  source: Exclude<UnifiedNoteSource, 'quick_note'>;
  readForWorkspace(workspaceId: string, limit: number): Promise<UnifiedNote[]>;
}
```

### Registered Adapters:
1. **`EntityNoteAdapter` (`src/lib/note-source-adapters/entity-note-adapter.ts`):** Reads CRM entity notes (`/entity_notes`), mapping `dealId`, `dealName`, and `entityName` into `UnifiedNote.links`.
2. **`TaskNoteAdapter` (`src/lib/note-source-adapters/task-note-adapter.ts`):** Extracts activity logs and status changes associated with task entities (`/tasks`).
3. **`CallNoteAdapter` (`src/lib/note-source-adapters/call-note-adapter.ts`):** Reads call outcome notes, transcripts, and disposition summaries from Call Centre logs (`/call_logs`).

### Unified Note View-Model (`UnifiedNote`):
```typescript
export interface UnifiedNote {
  id: string;                          // Global ID: `${source}:${sourceId}`
  source: 'quick_note' | 'entity_note' | 'task_note' | 'call_note';
  sourceId: string;
  workspaceId: string;
  title?: string;
  plainText: string;
  noteType?: string;
  tags: string[];
  attachments: QuickNoteAttachment[];
  links: QuickNoteLinks;
  isPinned: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  originHref?: string | null;          // Direct contextual navigation path
  editable: boolean;                   // Only true for native 'quick_note'
}
```

---

## 6. AI Capabilities & RAG Pipeline

All generative AI features run server-side through **Google Genkit** and the **Gemini API** / **Claude 3.5 Sonnet** models.

### 6.1. Per-Note AI Insights (`summarizeQuickNoteFlow`)
- **Trigger:** Manual button click or automated background evaluation inside `AiInsightsPanel.tsx`.
- **Output Schema:**
  - `summary`: 1–2 sentence TL;DR of the note content.
  - `suggestedTags`: Up to 6 lowercase topical tags.
  - `sentiment`: Classified as `positive`, `neutral`, `negative`, or `urgent`.
  - `actionItems`: Extracted array of concrete action steps.
- **Caching:** Persisted to `quick_notes.ai` sub-document to avoid redundant token generation.

### 6.2. Action Item to Task Auto-Conversion
Inside `AiInsightsPanel.tsx`, users can convert any AI-extracted action item into a formal workspace `Task` with a single click:
```typescript
export async function createTaskFromActionItem(params: CreateTaskFromActionItemParams): Promise<ActionResult<{ id: string }>> {
  // Automatically sets priority to 'medium', category to 'follow_up',
  // assigns to requesting user, sets due date to T+3 days,
  // and stamps originating entityId / entityName from the note's links.
}
```

### 6.3. Workspace / Category Synthesis Digest (`quickNotesDigestFlow`)
- **Location:** `DigestButton.tsx` on the Quick Notes board header.
- **Functionality:** Takes the current filtered view (e.g., all notes under "Q3 Strategy" or all pinned notes) and synthesizes:
  - Executive Overview
  - Recurring Key Themes
  - Outstanding Action Items across the entire collection.

### 6.4. Semantic "Ask Your Notes" Vector Search
- **Embedding Model:** `text-embedding-004` (768 dimensions).
- **Index:** Cloud Firestore Vector Index (`COSINE` distance) over `/note_index`.
- **Flow:**
  1. User enters natural language question: *"What did we promise the school regarding payment terms?"*
  2. Server action `semanticSearchNotes` generates vector embedding for the query.
  3. Executes `findNearest('embedding', queryVector, { limit: 10, distanceMeasure: 'COSINE' })` on Firestore.
  4. Returns matching notes with semantic similarity ranking and direct deep-links.

---

## 7. Frontend UI & UX Architecture

### 7.1. Quick Notes Board (`/admin/quick-notes`)
- **View Modes:**
  - **All Notes:** Live real-time Firestore query ordered by `isPinned DESC, updatedAt DESC`.
  - **Category Scoped:** Subscribed to specific category with dedicated index.
  - **Pinned Only:** Filtered view for rapid reference.
  - **Unified "All Sources" Feed:** Lazily fetches aggregated notes across CRM, Call Centre, and Task records with zero real-time listener overhead when inactive.
- **Visual Design:**
  - *Editorial Index Cards* design system with left-edge accent borders (`CATEGORY_SWATCHES`).
  - Pinned dog-ear visual motif on top-right corner.
  - Mobile touch actions with always-accessible interactive controls.

### 7.2. Rich Text Block Editor (`NoteBlockEditor.tsx`)
- Powered by `@tiptap/react` with dynamic client-only loading (`ssr: false`).
- Full formatting toolbar: Bold, Italic, Underline, Strikethrough, Headings (H1/H2/H3), Blockquotes, Bullet/Numbered Lists, Inline Code, Text Alignment, Highlighting, and Links.
- Attachments component (`NoteAttachmentList.tsx`) supporting file uploads, media preview, and OpenGraph link card enrichment.

### 7.3. Floating Notes HUD (`FloatingNotesHUD.tsx`)
- **Global Mounting:** Mounted in `layout-client.tsx` to remain active across entire application.
- **Draggable Physics:** Implemented with React pointer events and direct ref matrix transforms (`translate3d`), achieving silky 60fps drag physics without triggering React state render cycles.
- **Theme-Adaptive:** Uses CSS design tokens (`bg-popover`, `border-border`, `text-foreground`) for native light and dark mode support.
- **Context-Aware Linking:**
  - Automatically identifies when the user is on `/admin/entities/[id]`.
  - Stamped notes carry `links.entityId` and `links.entityName`.
- **Keyboard Shortcuts:**
  - `Escape`: Closes the floating HUD.
  - `Alt + N`: Global hotkey to open/restore the HUD from anywhere.

---

## 8. Security, Multi-Tenancy & Governance

### 8.1. Firestore Security Rules

```javascript
// --- Quick Notes Security Rules ---
match /quick_notes/{noteId} {
  // Read requires authorization and workspace access
  allow read: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(resource.data.workspaceId)
  );

  // Create pins createdBy to the caller to prevent audit forgery
  allow create: if isAuthorized() &&
    request.resource.data.createdBy == request.auth.uid && (
      isSystemAdmin() ||
      hasWorkspaceAccess(request.resource.data.workspaceId)
    );

  // Update ensures workspace boundary immutability and author ownership
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(resource.data.workspaceId) &&
     request.resource.data.workspaceId == resource.data.workspaceId &&
     request.auth.uid == resource.data.createdBy)
  );

  // Delete restricted to author or system admin
  allow delete: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(resource.data.workspaceId) &&
     request.auth.uid == resource.data.createdBy)
  );
}

match /quick_note_categories/{categoryId} {
  allow read: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(resource.data.workspaceId)
  );
  allow create: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(request.resource.data.workspaceId)
  );
  allow update: if isAuthorized() && (
    isSystemAdmin() ||
    (hasWorkspaceAccess(resource.data.workspaceId) &&
     request.resource.data.workspaceId == resource.data.workspaceId)
  );
  allow delete: if isAuthorized() && (
    isSystemAdmin() ||
    hasWorkspaceAccess(resource.data.workspaceId)
  );
}

// Denormalized vector index is strictly server-mediated (Admin SDK only)
match /note_index/{rowId} {
  allow read, write: if false;
}
```

### 8.2. Security Defense Summary
1. **Tenant Isolation:** All reads and writes verify that `request.auth.uid` has granted access to `workspaceId`.
2. **SSRF Guard:** In `ssrfSafeImageFetch` and `isSafeHttpUrl`, redirects are manually validated hop-by-hop against private IP ranges and internal metadata endpoints.
3. **Open Redirect Protection:** All deep links (`originHref`) rendered in card components are validated to start with `/` to prevent external redirects.
4. **Rate Limiting:** In-memory rate limits applied to AI synthesis and semantic search actions to protect against resource exhaustion and runaway LLM costs.

---

## 9. Performance & Scalability Considerations

- **Listener Overhead:** The floating HUD only initializes Firestore subscriptions (`useNoteCategories`) when `isOpen === true`. When closed or minimized, 0 listener reads occur.
- **Board Note Limit:** Client queries are capped at `BOARD_NOTE_LIMIT = 500` to prevent excessive memory and Firestore document read costs.
- **Optimistic Concurrency Control:** `UpdateQuickNotePatch` accepts `expectedUpdatedAt` timestamps to prevent overwriting concurrent updates.
- **Draft Persistence:** Local draft text is scoped by `${organizationId}_${workspaceId}` in `localStorage`, preventing data leakage across workspaces.

---

## 10. Future Enhancement Roadmap (Recommendations for Next Iterations)

| Area | Feature Proposal | Technical Implementation Approach |
| :--- | :--- | :--- |
| **1. Offline Sync** | Offline draft caching and IndexedDB queue | Integrate Dexie.js / Workbox to queue note writes while disconnected. |
| **2. Real-Time Collaboration** | Multi-user live co-editing | Connect TipTap `Hocuspocus` / WebRTC CRDT provider for live multiplayer editing. |
| **3. Automated Vector Re-indexing** | Event-driven Firestore Trigger | Deploy Cloud Function (`onDocumentWritten('quick_notes/{id}')`) to maintain `/note_index` automatically. |
| **4. Voice Note Audio Capture** | Audio recording with Gemini Multimodal Transcribe | Record audio via MediaRecorder API and send to `gemini-2.0-flash` for transcription and action item extraction. |
| **5. OCR Attachment Parsing** | Document scanning for image/PDF attachments | Extract text from uploaded receipts and contracts to index them in semantic search. |
