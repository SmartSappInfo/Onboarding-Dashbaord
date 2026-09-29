# SmartSapp MCP & Agentic Infrastructure on Google Cloud Run
**Architectural Blueprint, Runtime Topology & Operational Governance**

---

## 1. Executive Summary & Infrastructure Context

SmartSapp operates in production on **Google Cloud Run** using a dual-surface architecture deployed from a single container image built in GitHub Actions (see `.github/workflows/deploy-cloudrun.yml` and `docs/architecture/backoffice-isolation-plan.md`). 

The introduction of the **Model Context Protocol (MCP) 2026-07-28** and autonomous agent runtime must natively align with Cloud Run's serverless operational characteristics:
1. **Stateless Protocol Core**: MCP `2026-07-28` operates statelessly over **Streamable HTTP**. This eliminates legacy SSE session-stickiness constraints and enables seamless load-balancing across horizontally autoscaled Cloud Run container instances.
2. **Dual-Surface Isolation**: The public client surface (`smartsapp-app` on `go.smartsapp.com`) and the operator control plane (`smartsapp-backoffice` on `goadmin.smartsapp.com`) maintain strict process isolation governed by the `APP_SURFACE` environment variable and `src/lib/platform/app-surface.ts`.
3. **Ambient Credential Security**: Cloud Run runs with Google Cloud Workload Identity Federation and the runtime service account (`GCP_RUNTIME_SA`). No static `serviceAccountKey.json` files exist inside container images.
4. **Durable Task Decoupling**: Because Cloud Run throttles CPU outside of active HTTP request lifecycles and scales instances to zero, long-running agent workflows cannot run as unmanaged background promises. Multi-step executions must be driven by **Google Cloud Tasks** (`@google-cloud/tasks`) with state persisted in Firestore.

---

## 2. Cloud Run Service Topography

```
                                    INTERNET / OPERATORS
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             go.smartsapp.com                            goadmin.smartsapp.com
        ┌─────────────────────────┐                 ┌─────────────────────────┐
        │  Cloud Run Service:     │                 │  Cloud Run Service:     │
        │  smartsapp-app          │                 │  smartsapp-backoffice   │
        │  (APP_SURFACE=client)   │                 │  (APP_SURFACE=backoffice│
        └────────────┬────────────┘                 └────────────┬────────────┘
                     │                                           │
                     ├───────────────────┐                       │
                     ▼                   ▼                       ▼
            User Web Application   Remote MCP Endpoints   Backoffice Control Plane
            Next.js App Router     Streamable HTTP        Agent Registry
            CRM, Portals, Studios  CRM, Portals, Sales    Kill-Switches, Audits
                     │                   │                       │
                     └───────────────────┼───────────────────────┘
                                         ▼
                           CANONICAL CAPABILITY LAYER
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
             Google Cloud Tasks Queue            Firestore / Qdrant
             Async Agent Execution Workers       System of Record & Memory
```

### Container Specifications
* **CPU / Memory**: 1 vCPU / 1 GiB RAM (configurable to 2 GiB for vector/RAG-heavy instances).
* **Port**: `8080` (managed container port).
* **Concurrency**: `80` requests per instance.
* **Min / Max Instances**: Min `0` (scales to zero to conserve cost), Max `10` (governed autoscaling).
* **Request Timeout**: 300 seconds (5 minutes) ceiling.
* **Payload Limit**: ~32 MB HTTP request ceiling enforced by Cloud Run edge.

---

## 3. MCP Protocol Architecture on Cloud Run

### 3.1 Stateless Streamable HTTP (Spec 2026-07-28)
Legacy MCP implementations relied on long-lived Server-Sent Events (SSE) connections with in-memory session IDs (`Mcp-Session-Id`). On serverless Cloud Run, instances scale down or spin up dynamically, causing connection breakage and session loss.

SmartSapp MCP adopts the **MCP 2026-07-28 specification**:
* **Transport**: Stateless Streamable HTTP POST endpoints (`/api/mcp/v2/*`).
* **Header-Based Routing**: Multi-round-trip requests carry cryptographic transaction and correlation headers (`Mcp-Transaction-Id`, `X-SmartSapp-Correlation-Id`). Any Cloud Run instance behind the Google Cloud load balancer can service any step of an interaction.
* **Stateless Handler**:
  ```typescript
  import { createMcpHandler } from '@modelcontextprotocol/server';
  import { capabilityRegistry } from '@/platform/capabilities';

  export const POST = createMcpHandler(async (req) => {
    // Authenticate principal, enforce tenant isolation, and bind capability registry
    return createDomainMcpServer({
      domain: 'crm',
      registry: capabilityRegistry,
      surface: 'client',
    });
  });
  ```

### 3.2 Domain-Partitioned MCP Endpoints
To prevent LLM context bloat and stay within Cloud Run resource limits, SmartSapp exposes focused, domain-partitioned endpoints rather than a single monolithic server:
* `POST /api/mcp/v2/crm` — Contacts, Deals, Pipelines, Activities.
* `POST /api/mcp/v2/portals` — Portals, Memberships, Courses, Community, Credentials.
* `POST /api/mcp/v2/messaging` — Templates, Omnichannel Dispatch, Verification.
* `POST /api/mcp/v2/sales` — Lead Intelligence, SDR Enrichment, Scoring.
* `POST /api/mcp/v2/knowledge` — Notes, Semantic Memory, Context Builder.

---

## 4. Authentication, Tenancy & Credential Management

### 4.1 Ambient Google Cloud Credentials
* In development, `firebase-admin.ts` can load from `serviceAccountKey.json`.
* In production on Cloud Run, **no service account key is packaged in the Docker container**. 
* The runtime environment relies on **ambient credentials** provided by `GCP_RUNTIME_SA` via the Google Cloud Metadata Server (`http://169.254.169.254` or `http://metadata.google.internal`).
* `FIREBASE_CONFIG` is injected as a container environment variable at deploy time:
  ```json
  {"projectId":"studio-9220106300-f74cb","storageBucket":"studio-9220106300-f74cb.firebasestorage.app"}
  ```
  Firebase Admin initializes automatically via ambient credentials with zero file dependencies.

### 4.2 Secret Manager Integration
All external third-party API keys (Resend, mNotify, OneSignal, WhatsApp AES-256 Vault Key, Cloud Tasks Secret) are mounted directly from Google Cloud Secret Manager at deployment:
```bash
--set-secrets "CRON_SECRET=cron-secret:latest,WHATSAPP_ENCRYPTION_KEY=whatsapp-encryption-key:latest,RESEND_WEBHOOK_SECRET=resend-webhook-secret:latest,RESEND_API_KEY=resend-api-key:latest,MNOTIFY_API_KEY=mnotify-api-key:latest,CLOUD_TASKS_SECRET=CLOUD_TASKS_SECRET:latest"
```

### 4.3 Multi-Tenant Isolation
* Every incoming MCP and agent request must provide a verified identity token (JWT / Firebase Auth or MCP OAuth token).
* The Cloud Run handler extracts `organizationId` and `workspaceId` and sets the execution context.
* Under no circumstances can a request without an authenticated workspace scope execute a capability.

---

## 5. Overcoming Cloud Run Lifecycles: Durable Tasks & Cloud Tasks

### 5.1 The CPU Throttling Challenge
Cloud Run allocates CPU strictly during request processing. Once an HTTP response is returned, the container instance's CPU is throttled to near zero, and the instance may be terminated at any time.

**Anti-Pattern (Prohibited)**:
```typescript
// NEVER DO THIS ON CLOUD RUN:
async function handleAgentRun(goal: string) {
  setTimeout(async () => {
    await executeMultiStepPlan(); // WILL FAIL: Instance throttled or killed!
  }, 10000);
}
```

### 5.2 The Google Cloud Tasks Pattern (Required)
Long-running agent workflows, multi-step SDR research, and scheduled follow-ups are dispatched to **Google Cloud Tasks**:
1. **Agent Initiates Long Task**: The in-app agent or MCP client requests an asynchronous job (e.g. `lead.deep_research`).
2. **Durable Record Created**: An `agent_runs` document is created in Firestore with status `queued` and a state checkpoint.
3. **Cloud Task Enqueued**: A task is dispatched via `src/lib/gcp-tasks-client.ts` targeting `/api/tasks/agent-step` with payload `{ runId, stepNumber, token }`.
4. **Cloud Run Worker Executes Single Step**: Cloud Run spins up an instance to handle the HTTP webhook from Cloud Tasks, loads the checkpoint from Firestore, executes the typed capability, writes the output, and updates the checkpoint.
5. **Next Step or Completion**: If further steps are required, a subsequent Cloud Task is scheduled. If an approval is required, the run transitions to `waiting_for_approval` and sleeps until human intervention.
6. **Task Idempotency**: Every step carries an `idempotencyKey` ensuring that Cloud Tasks retries never execute duplicate side effects.

---

## 6. Request Limits, Payload Ceilings & SSRF Defense

### 6.1 The 32 MB Request Ceiling
Cloud Run enforces an HTTP request limit of 32 MB. 
* Never stream large files, heavy PDFs, raw videos, or multi-megabyte datasets directly through MCP tool arguments.
* **Direct Storage Pattern**: When tools require large attachments (e.g. creative assets, survey exports, audio recordings), the capability generates a signed Firebase Storage upload/download URL. The agent receives only the secure URI reference.

### 6.2 SSRF & Metadata Server Protection
Because MCP tools allow models to request external HTTP resources, Cloud Run instances are at risk of Server-Side Request Forgery (SSRF) aimed at stealing the instance's Google Cloud IAM token.
* **Strict Blacklist**: The shared network egress layer strictly blocks:
  - `http://169.254.169.254/*` (GCP Metadata server)
  - `http://metadata.google.internal/*`
  - `http://localhost:*`, `http://127.0.0.1:*`
  - Private RFC-1918 IP blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
* Any tool attempting an outbound fetch must route through `safeUrlFetch()`, which performs DNS pre-resolution and IP validation before connection establishment.

---

## 7. Backoffice Agent Control Plane on `smartsapp-backoffice`

In alignment with Rule 61 and Rule 62 of `agents_mcp_rules.md`, operational controls for agents must reside on the isolated backoffice surface:
1. **Isolated Routing**: Route `/backoffice/ai/**` is only accessible on `goadmin.smartsapp.com` (`APP_SURFACE=backoffice`). Attempting to access it on `go.smartsapp.com` results in an immediate redirect or 404 in `src/proxy.ts`.
2. **Zero-Code Operational Controls**:
   * **Global Kill-Switch**: Disable autonomous execution workspace-wide or organization-wide in Firestore without a redeployment.
   * **Capability Registry Viewer**: Inspect tool versions, failure rates, latencies, and permissions.
   * **Agent Run Center**: View live execution traces, tool arguments, evidence packs, and approval queues.
   * **Security Command Center**: Real-time alerts for tool poisoning, prompt injection attempts, and cross-tenant access denials.

---

## 8. CI/CD & Deployment Protocol

### 8.1 Automated Deployment Workflow
* Cloud Run deployments are automated via GitHub Actions (`.github/workflows/deploy-cloudrun.yml`).
* Triggered on merge to `deployment` or via manual `workflow_dispatch`.
* Deploys sequentially: first `smartsapp-app`, then `smartsapp-backoffice`, sharing the identical immutable Docker image tag `${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/smartsapp-app:${GITHUB_SHA}`.

### 8.2 Automated Smoke Testing
Every deployment executes an authenticated smoke test using self-impersonated IAM identity tokens:
* Verifies `https://go.smartsapp.com/` returns `200` and validates Firestore connectivity under ambient credentials.
* Verifies `https://goadmin.smartsapp.com/backoffice` returns a healthy `307` redirect to `/login`.
* Fails and halts rollout immediately if any error code is returned.

---

## 9. Alignment with Master Roadmap & Phase 0 Checklist

In Phase 0, Cloud Run alignment requires:
* [x] Document Cloud Run infrastructure constraints, ambient credentials, and stateless MCP behavior.
* [x] Validate that all capability contract schemas account for the 32 MB payload limit and Cloud Tasks asynchronous execution.
* [x] Verify that SSRF network defense guards cover the Google Cloud metadata endpoint.
* [x] Ensure the Backoffice Agent Control Plane is isolated to `APP_SURFACE=backoffice`.
* [x] Verify that zero service account keys are stored or committed in container build contexts.
