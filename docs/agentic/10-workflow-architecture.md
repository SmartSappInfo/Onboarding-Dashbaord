# Durable Tasks & Workflow Engine Architecture (Phase 0)
**Document 10 in the Agentic Architecture Suite**

---

## 1. Cloud Run Serverless Decoupling

Because Cloud Run instances scale down to zero and throttle CPU outside of active HTTP requests, multi-step agent tasks must not run as in-process promises.

SmartSapp uses **Google Cloud Tasks** (`@google-cloud/tasks`) with state checkpoints stored in Firestore:
```
INCOMING AGENT GOAL ──► INITIALIZE RUN ──► FIRESTORE CHECKPOINT ──► ENQUEUE CLOUD TASK
                                                                           │
                                                                           ▼
COMPLETED ◄── ADVANCE STATE ◄── EXECUTE CAPABILITY ◄── CLOUD RUN WORKER PULLS TASK
```

---

## 2. True Cancellation Semantics (Rule 26)

Cancellation is not merely stopping a UI spinner. When a user or system cancels an active run:
1. In-flight Cloud Tasks receive an immediate revocation signal via the run checkpoint.
2. Committed external provider calls are recorded and gracefully completed.
3. Pending steps are marked `cancelled`.
4. Required compensating actions are triggered.

---

## 3. The Saga & Compensation Model (Rule 27)

Multi-step operations execute as Sagas with defined forward and compensating actions:
```
Forward Action:   Create Campaign Draft ──► Attach Audience ──► Schedule Provider Send
                                                                     │ (Fails)
                                                                     ▼
Compensating:     Mark Campaign Error   ◄── Detach Audience ◄── Abort Send Queue
```

---

## 4. Circuit Breakers (Rule 24)

External provider integrations (Resend, WhatsApp, mNotify, OpenAI, Anthropic) are wrapped in five-state circuit breakers:
`CLOSED (Healthy) → DEGRADED (Retrying with backoff) → OPEN (Tripped, fast-failing) → HALF-OPEN (Testing recovery) → CLOSED (Recovered)`.
If an external provider experiences an outage, requests fail fast with actionable operator alerts rather than crashing container instances.
