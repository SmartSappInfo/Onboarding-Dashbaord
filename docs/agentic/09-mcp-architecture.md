# Model Context Protocol (MCP) Architecture (Phase 0)
**Document 09 in the Agentic Architecture Suite**

---

## 1. Specification Compliance & SDK Alignment (Rule 11)

SmartSapp's MCP implementation strictly adheres to the **MCP Specification `2026-07-28`**:
* **Stateless Core**: Replaces sticky legacy SSE transports with stateless Streamable HTTP. Any autoscaled Cloud Run instance can process any interaction round-trip.
* **SDK Version**: Utilizes `@modelcontextprotocol/server` (TypeScript SDK v2).
* **Deprecated Features Banned (Rule 38)**: No new implementations may depend on legacy Roots, Sampling, or Logging. Telemetry routes through OpenTelemetry.

---

## 2. Server Partitioning Topology

Rather than exposing an unwieldy 100-tool monolithic server, SmartSapp exposes domain-partitioned endpoints:

| Endpoint | Primary Capabilities | Target Client |
| :--- | :--- | :--- |
| `POST /api/mcp/v2/crm` | Contacts, Deals, Stages, Tags, Activities | Cursor, Claude Desktop, Internal Copilots |
| `POST /api/mcp/v2/portals` | Portals, Memberships, Courses, Credentials, Community | Experience Portal Clients, Learning Assistants |
| `POST /api/mcp/v2/messaging` | Templates, Resend, WhatsApp, SMS, Verification | Outbound Automation, Campaigns |
| `POST /api/mcp/v2/sales` | Lead Intelligence, SDR Enrichment, Scoring | Prospecting & Sales Copilots |
| `POST /api/mcp/v2/knowledge` | Notes, Semantic Memory, Context Graph | Research & Executive Briefing |

---

## 3. Tool Poisoning & Rug-Pull Defense (Rule 14)

Every exposed tool is cryptographically fingerprinted:
```typescript
interface ToolFingerprint {
  toolId: string;
  version: string;
  schemaHash: string; // SHA-256 of input/output schema
  descriptionHash: string;
  permissionHash: string;
  riskHash: string;
  approvedAt: string;
  approvedBy: string;
}
```
If a tool's parameters, permissions, or risk change in production without an updated fingerprint, execution is blocked and flagged in the Backoffice Security Command Center.

---

## 4. Server Allowlisting & Supply-Chain Controls (Rule 15)

External MCP servers consumed by SmartSapp must pass a formal security review lifecycle:
`Discovered → Security Review → Dependency Scan → Capability Review → Tested → Approved → Connected → Monitored`. Arbitrary remote server URLs are blocked by default.
