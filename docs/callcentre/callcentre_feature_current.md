# SmartSapp Call Centre Module - Architecture & Capabilities Review

## 1. Overview and Core Philosophy
The Call Centre module is a comprehensive, branching, script-driven calling tool and dialer designed for organizations to run campaigns (outbound or guided inbound). It supports visual script building, interactive guided scripts for agents, and automated back-office actions triggered mid-call or post-call based on script outcomes. It strictly adheres to design principles, typed data contracts, and a central orchestration logic that cleanly separates UI configuration from backend execution.

## 2. Current Capabilities
### Visual Script Builder (`ReactFlow`)
- **Drag-and-Drop Canvas:** Agents can design scripts visually with nodes for `start`, `script_block`, `question`, `multiple_choice`, `condition`, `objection`, `action`, `outcome`, and `end`.
- **Dynamic Variable Injection:** Scripts support injecting CRM data dynamically (e.g., `{{CURRENT_CONTACT_NAME}}`, `{{COMPANY}}`) strictly via the `FieldsVariablesService` to prevent arbitrary regex string replacements.
- **Objection Handling:** Built-in objection blocks allow facilitators to click on "Too Expensive" and immediately see pre-approved rebuttals without losing their place in the core script graph.
- **Mid-Call Action Triggers (Automations):** Allows triggering CRM and back-office actions mid-call automatically as the agent hits an `action` node.
- **Graph Validation:** Real-time topology checking detects cycles, orphaned nodes, empty labels, missing endpoints, and ensures exactly one `start` and `end` node (`call-centre-graph.ts`).

### Campaign Execution & Dialer
- **Campaign Wizard:** Configures audiences (via `EntityFilters` / CRM query matching), links scripts, and configures post-call automations.
- **Queue Management:** Maintains a robust call queue per campaign (status transitions: `scheduled` -> `in_progress` -> `completed`, `callback_scheduled`, `deferred`, `skipped`).
- **Interactive Script Playbook View:** Guides the live agent step-by-step. Hides branching complexity behind a linear, focus-driven UI.

### Comprehensive Action & Trigger System (Automations)
Both mid-call action nodes and post-call outcome rules trigger actions synchronously through `executeCallActionEffect` inside `call-centre-service.ts`.
Supported Actions:
1. `SEND_SMS`, `SEND_EMAIL`, `SEND_WHATSAPP`: Communicates with contacts using templates (via Resend, Twilio/WhatsApp, mNotify).
2. `CREATE_TASK`: Schedules follow-up tasks (assigns to specific agents, round-robin, or the caller).
3. `CHANGE_STAGE`, `ADD_TO_PIPELINE`: Moves CRM entities through pipelines and changes deal stages.
4. `ADD_TAG`, `REMOVE_TAG`: Edits contact tags (using canonical TagServices).
5. `SCHEDULE_MEETING`: Integrates with meeting types to auto-invite callers via a unified scheduler.
6. `ADD_TO_CALL_CAMPAIGN`: Cascades contacts to other dialer lists (cross-campaign propagation).
7. `UPDATE_CONTACT`: Inline CRM contact updates (updating names, emails, phones dynamically).
8. `TRANSFER_CALL`: Logs telephony routing intentions and call transfers.
9. `WEBHOOK`: Pings external systems natively via POST/PUT/GET.
10. `LOG_NOTE`: Adds contextual CRM entity notes.
11. `ADD_TO_MEMBERSHIP_PORTAL`: Automatically provisions secure cryptographic invitations to external membership portals and dispatches via email idempotently.

## 3. Architecture & Data Flow
- **Data Layer:** Runs natively on Firebase Firestore and Admin SDK. Campaign statuses, scripts, and call logs are heavily cached on the frontend via `react-firebase-hooks` (`useCollection`, `useMemoFirebase`) to prevent unnecessary reads.
- **Frontend Layer (Next.js):** Heavy usage of lazy loading (`next/dynamic`) for large components like `VisualScriptCanvas` and `InteractiveScriptView` to optimize initial bundle sizes and LCP (Largest Contentful Paint).
- **Execution Orchestrator:** The `call-centre-service.ts` acts as the single source of truth for side-effects. It ensures cross-module interactions happen atomically and are tracked centrally in the Activity Timeline Logger (`logActivity`).
- **Security & Idempotency:** Includes strict typechecking (`CallActionParams` vs generic any objects), data extraction safeguards, and prevents duplicate executions (e.g. `PortalInvitationService` checking if a user is already a member before provisioning limits spam/duplicates).

## 4. Cross-Module Integrations
- **CRM / Entities:** Pulls contacts natively, triggers pipeline shifts, tags, and timeline notes.
- **Membership & Portals:** Integrates directly with the Portals ecosystem to invite callers securely.
- **Meetings:** Can schedule follow-ups via the centralized meeting logic.
- **Tasks & Backoffice:** Triggers tasks bound to user assignment queues and dashboards.
- **Messaging Engine:** Dispatches outbound communications dynamically via org-level API keys (Resend, etc.).

## 5. UI/UX and Design Architecture
- **Animation Quality:** The interactive script view leverages fluid, spring-based animations (following Emil Kowalski principles) to prevent visual jarring during fast-paced calls. Layout shifts are mitigated via Framer Motion layouts.
- **Clean Interface:** "Zero HTML/CSS leakage" policy ensures that tags or script structures are fully parsed. Configuration UI (`ActionConfigFields.tsx`) avoids data overload by efficiently limiting queries (e.g., pulling limited templates or membership plans with limits).
- **Mobile & Accessibility:** The guided viewer is mobile-optimized (`min-h-[44px]` touch targets, sticky footers) ensuring that agents or external facilitators can dial and run scripts smoothly from tablets or phones.

## 6. AI Capabilities & Integrations
Currently supported and architected for AI extraction:
- **Pre-Call / Post-Call Insights:** The `CallQueueItem` schemas natively define interface slots for `recordingUrl`, `transcript`, `aiSummary` (summary, suggested outcomes, confidence scores, sentiment tracking), and `aiExtractedActions`.
- **Campaign Insights:** Campaigns support `aiInsights` tracking common objections, frequent questions, and script performance scores over thousands of calls.
- **Prompt Architectures:** Built to handle future Realtime API streaming interactions via the Vercel AI SDK.

## 7. Strategic Recommendations for Improvement (For the Senior Expert)
1. **Queue Scaling Optimization (Database Hotspotting):** The queue logic uses heavy Firestore collections (`adminDb.collection('call_queue')`). For high-throughput call centers (1000+ concurrent agents updating statuses to `in_progress`), this design might trigger Firestore write-contention hotspotting. **Recommendation:** Consider sharding the queue or moving active-queue dispatching to a Redis-backed orchestration layer.
2. **Telephony & SIP Integration (WebRTC):** While `TRANSFER_CALL` logs intent, embedding a WebRTC dialer natively directly in the UI (so agents don't have to switch tabs or pick up hard phones) would vastly improve Average Handle Time (AHT).
3. **AI Audio Analysis (Real-time Coaching):** The architecture has `aiSummary` and `aiExtractedActions` but relies on post-call batch processing. Integrating Vercel AI SDK and OpenAI Realtime API for live coaching or auto-resolving objection handling *mid-call* based on customer streaming audio would be a massive leap.
4. **Offline Resilience & Caching:** ReactFlow scripts are robust, but if an agent's connection drops mid-call, the interactive script view needs aggressive `IndexedDB` or `localStorage` caching for the `InteractiveScriptView` state so they do not lose the call context.
5. **A/B Script Testing Framework:** Introduce A/B testing logic within Campaigns. Allow routing 50% of `CallQueueItems` to `scriptSnapshot_A` and 50% to `scriptSnapshot_B` to measure outcome conversions.
