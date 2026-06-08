# SmartSapp: Comprehensive App Features, Functions, & Nuances Summary

This master document provides a detailed breakdown of all features, operational logic, database designs, and architectural nuances in the SmartSapp application. It serves as the definitive developer blueprint for context preservation.

---

## 1. Architectural & Identity Design

SmartSapp is a multi-tenant, multi-vertical relational system built on a serverless architecture.

```
       +---------------------------------------------+
       |             GLOBAL DATA LAYER               |
       |  - Countries (Global)                       |
       |  - Regions (Global)                         |
       |  - Entities (Identity, name, contacts)      |
       +----------------------|----------------------+
                              | (linked by entityId)
                              v
       +---------------------------------------------+
       |           WORKSPACE DATA LAYER              |
       |  - Workspace Entities (Pipeline, Stage, Tags)|
       |  - Tasks, Deals, Automations, Meetings      |
       |  - Districts (Org-scoped)                   |
       |  - Zones (Workspace-scoped)                 |
       +---------------------------------------------+
```

### 1.1. Dual-Tier Contact Model
To solve the problem of sharing unified contact records across isolated workspace departments or business pipelines, SmartSapp uses a split-database strategy in Firestore:
* **The Identity File (`entities` collection)**:
  - Contains core business details that are globally consistent: `name`, `slug`, `logoUrl`, list of focal persons/contacts (`FocalPerson[]` including `name`, `email`, `phone`, `role`), geographic coordinates, social/online presence links (`website`, `whatsapp`, `instagram`, `x`, etc.).
  - Tracks the global metadata field `entityType` which can be `'institution'`, `'family'`, or `'person'`.
* **The Operational Record (`workspace_entities` collection)**:
  - Keyed by `${workspaceId}_${entityId}` to enforce unique workspace membership constraints.
  - Controls local state: `pipelineId`, `stageId`, `status` (`'active'`, `'archived'`, `'converted'`), workspace-specific tags (`workspaceTags: string[]`), assignees (assigned users), and local date timestamps (`addedAt`, `updatedAt`).

### 1.2. Dynamic Multi-Vertical Engine (`useTerminology` & `resolveTerminologyFromWorkspace`)
Rather than hardcoding terms like "Schools", "Accounts", or "Clients", the UI reads labels from a terminology hook.
* **Vertical Terminology Map**:
  - `SchoolEnrollment`: Entity -> `School`/`Schools`, Person -> `Student`/`Students`, pipeline stages default to Admissions milestones.
  - `SaaS`: Entity -> `Account`/`Accounts`, Person -> `User`/`Users`.
  - `Law`: Entity -> `Client`/`Clients`, Person -> `Contact`/`Contacts`.
  - `Marketing`, `RealEstate`, `Consultancy`: Dynamically adapts to custom plural/singular configurations defined at either the industry level (`industry-config.ts`) or overridden in the workspace document (`workspace.terminology`).
* **Fallback Resolution Nuance**:
  - If a workspace has an industry vertical (e.g. `SchoolEnrollment`) but no custom terms are saved, the system checks `workspace.contactScope`.
  - If `contactScope` is `'family'`, it overrides the default industry term (*School*) and populates the interface with `Family`/`Families` terminology.

### 1.3. Hierarchical Location Selectors
Geographical mapping is layered to support complex municipal structures:
1. **Countries**: Queryable from a global, read-only collection (`countries`). Ghana (`GH`) is pinned at the top of select dropdowns by default.
2. **Regions**: Stored in a global collection (`regions`), indexed by `countryId`. Dynamically populated client-side as soon as a country is selected.
3. **Districts**: Organization-level custom administrative units stored in `districts` and filtered by `regionId` and `organizationId`.
4. **Zones**: Workspace-specific classifications (e.g., "Dansoman Zone") used to route sales reps and cluster entities.

---

## 2. Deep-Dive: Feature Modules & Operational Nuances

### 2.1. Dynamic Form & Field Builder
* **Drag-and-Drop Editor**: Canvas layout allowing workspace admins to construct multi-section intake forms. Supports fields like Text, Textarea, Select, Date, Checkbox, File uploads, and Signature pads.
* **Field Pack Seeding**: Standardized field groups (e.g., admissions documents, billing forms, compliance data) are registered under specific vertical configs. When a new workspace is created, the active field packs are automatically cloned and seeded into the workspace's metadata.
* **Auto-Save & Drafting**: Prevents user data loss by saving form drafts locally using local storage triggers, syncing draft states to Firestore whenever the client is idle.
* **PDF Form Mapping**: Allows administrators to upload static fillable PDF files, detect form fields inside the PDF, and map dynamic inputs from the web form builder directly onto the PDF structure. Upon submission, a server-side action compiles the fields and outputs a completed PDF.

### 2.2. Visual Automation Graph Builder
* **Flow Architecture**: Node-based automation canvas.
  - **Triggers**: Hooks firing workflows (e.g., when a lead is added, when a tag is applied, when a task is overdue, or when a form is submitted).
  - **Conditions**: Logic blocks checking variable attributes (e.g., check if entity location matches a certain zone, check if deal amount is above a threshold).
  - **Actions**: Tasks executed by the background automation runner (e.g., dispatch an automated email, create a checklist task, move the entity stage in the pipeline).
* **Validation Engine**: Node connections are checked to prevent execution loops (e.g. Action A triggering Event B which triggers Action A) and block deployment if incomplete nodes are connected.

### 2.3. Unified Org & Workspace Switcher
* **Session Switcher**: Global navigation bar component allowing users with cross-organization memberships to hop between different workspaces.
* **Breadcrumb Syncer**: Listens to changes in the active workspace and triggers client-side route redirects to update the workspace context (`/admin/workspaces/[id]`) dynamically.

### 2.4. Meetings & Scheduler Component
* **Booking Funnels**: Customizable booking landing pages where external clients select time slots.
* **Credential Manager**: Integrates with Zoom SDK and Google Calendar API. Resolves scheduling conflicts by checking current calendar logs.
* **Host Assignments**: Dynamically routes bookings to specific workspace users (e.g., Round Robin or Assigned Sales Rep routing).

### 2.5. Messaging Suite & Campaigns
* **Bulk Compose**: Action button supporting multiple selected entities. Dynamically parses variable placeholders (e.g., `{{contact.name}}`, `{{entity.displayName}}`) based on adapter properties.
* **Campaign Wizard**: Triggers batch execution schedules. It processes campaigns in chunks (50 messages per minute) to ensure compliance with SMTP limits and prevent spam flags.
* **Outbound Webhooks**:
  - Delivers raw JSON event triggers (`entity_added`, `deal_moved`, `form_submitted`) to third-party endpoints.
  - Provides a status inspection board showing execution time, latency, HTTP response codes, and payload bodies.
  - Automatically schedules retry attempts using an exponential backoff sequence (3, 6, 12, and 24 hours) for failed responses.

### 2.6. Activity Timeline & Analytics
- **Activity Item Alignment**: Action events are mapped on a unified timeline. Icons align directly with the central vertical track using `-translate-x-1/2` centering on `left-4`. 
- **Time Distance Calculations**: Uses `date-fns` to format relative timestamps ("about 11 hours ago").
- **Drop-off Analytics**: Tracks completion funnels for public portal forms, displaying view-to-abandonment ratios to flag high drop-off form fields.

---

## 3. Database Collection Nuances

* **`countries`**: `{ id: string, name: string, code: string, flag: string }`
* **`regions`**: `{ id: string, name: string, countryId: string }`
* **`districts`**: `{ id: string, name: string, regionId: string, organizationId: string }`
* **`entities`**: `{ id: string, name: string, entityType: string, organizationId: string, location?: { country?: {}, region?: {}, district?: {}, zone?: {} }, onlinePresence?: {} }`
* **`workspace_entities`**: `{ id: string, entityId: string, workspaceId: string, pipelineId: string, stageId: string, workspaceTags: string[], status: string, displayName: string }`
* **`activities`**: `{ id: string, workspaceId: string, entityId: string, userId?: string, description: string, timestamp: string, type: string, metadata?: { content?: string } }`
* **`tasks`**: `{ id: string, workspaceId: string, entityId: string, title: string, status: string, dueDate: string, category: string }`
