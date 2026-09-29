# Comprehensive Security & Threat Model (Phase 0)
**Document 11 in the Agentic Architecture Suite**

---

## 1. The Trust Boundary Matrix (Rule 13)

Every piece of data entering the agent runtime is strictly classified:

| Trust Classification | Source | Handling & Boundary Policy |
| :--- | :--- | :--- |
| **`SYSTEM_TRUST`** | Codebase contracts, server env vars | Trusted; internal authority |
| **`USER_TRUST`** | Authenticated user session | Governed by user's assigned RBAC role |
| **`TENANT_TRUST`** | Workspace/Org records | Scoped to active tenant; filtered in Firestore/Qdrant |
| **`UNTRUSTED_CONTENT`** | Form submissions, transcripts, notes | Untrusted reference data; sanitized via XML boundary |
| **`UNTRUSTED_TOOL_OUTPUT`**| External MCP tools, scraper results | Untrusted data; validated via Zod schema (Rule 48) |
| **`MODEL_PROPOSAL`** | LLM-generated arguments | Proposal only; validated via policy before execution (Rule 47) |

---

## 2. Core Security Axioms

* **Rule 47: Never Trust the Model**: Model-generated arguments must always pass schema validation, policy authorization, and TOCTOU version checks before reaching the domain executor.
* **Rule 48: Never Trust the Tool Either**: Data returned by external tools or MCP servers cannot contain instructions that override tenant security or model system prompts.

---

## 3. Server-Side Request Forgery (SSRF) Defense (Rule 34)

Cloud Run containers have access to ambient credentials via the Google Cloud Metadata Server. To prevent SSRF attacks:
* Egress requests must route through `safeUrlFetch()`.
* Direct connections to `169.254.169.254`, `metadata.google.internal`, `localhost`, and RFC-1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are strictly rejected.
* DNS pre-resolution blocks DNS rebinding attacks.

---

## 4. Public Resource Isolation (Rule 49)

Public booking links, survey forms, and portal landing pages must never grant public unauthenticated access to raw Firestore collections. Public access must route through scoped public tokens with minimum data projection.
