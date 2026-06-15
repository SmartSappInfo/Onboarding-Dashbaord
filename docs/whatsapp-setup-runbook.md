# WhatsApp Integration — Setup Runbook

How to connect an organization's WhatsApp Business Account (Meta Cloud API) to the app, and the platform configuration it depends on.

---

## 1. Platform prerequisite (one-time, ops)

Set a 32-byte encryption key used to seal every org's WhatsApp tokens at rest:

```bash
# Generate (Node):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to the deploy environment:

```
WHATSAPP_ENCRYPTION_KEY=<64-hex-chars>
```

Optional (key rotation): `WHATSAPP_ENCRYPTION_KEY_ID` (label for the current key, default `default`) and `WHATSAPP_ENCRYPTION_KEYS_RETIRED` (JSON `{ "<id>": "<hex>" }` of previous keys, so tokens sealed before a rotation stay decryptable). See [crypto-vault.ts](../src/lib/whatsapp/crypto-vault.ts).

> Without `WHATSAPP_ENCRYPTION_KEY`, saving a connection fails fast with a clear error.

---

## 2. What the org needs from Meta

In **Meta Business Manager** / the WhatsApp app:

| Value | Where to find it |
|---|---|
| **WhatsApp Business Account ID (WABA)** | WhatsApp Manager → Account tools → IDs |
| **Phone Number ID** | WhatsApp → API Setup (the sending number's ID, *not* the display number) |
| **Display phone number** | The human-readable number, e.g. `+233 20 000 0000` |
| **System User access token** | Business Settings → Users → System Users → generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`. Prefer a **long-lived / never-expiring** system-user token. |
| **App secret** (optional but recommended) | App → Settings → Basic → App Secret. Enables inbound webhook signature validation. |

---

## 3. Connect in the app

1. Go to **Admin → Settings → Integrations**.
2. In **WhatsApp Business (Meta Cloud API)**, enter WABA ID, Phone Number ID, display number, and paste the access token (+ app secret).
3. **Save credentials** — the token is encrypted before storage and never shown again (only the last 4 digits display).
4. **Test connection** — pulls the number's quality rating + messaging tier from Meta and sets status to *Connected*.

Only org admins (management → systemSettings permission) can manage credentials. Platform admins can view all orgs' connections at **Backoffice → WhatsApp Registry** (read-only + force-disconnect; secrets never shown).

---

## 4. Configure the inbound webhook (for two-way + delivery status)

In the Meta app's **WhatsApp → Configuration → Webhook**:

- **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp`
- **Verify token**: the per-connection token (generated on save; stored on the connection). The GET handshake echoes the challenge when the token matches.
- **Subscribe** to the `messages` field (covers inbound messages + delivery/read statuses).

The webhook validates Meta's `X-Hub-Signature-256` against the org's app secret, dedupes retries, and acks fast (processing runs after the response). Inbound messages refresh the 24-hour customer-service window; `STOP`/`UNSUBSCRIBE` opt the contact out of WhatsApp.

---

## 5. Templates

WhatsApp messages outside an open 24h session **must** use a Meta-approved template.

1. Create/submit templates in **WhatsApp Manager** (Meta reviews them).
2. In the app: **Admin → Messaging → Templates → WhatsApp Templates → Sync from Meta**.
3. Approved templates can be **adopted** — map each positional `{{1..n}}` parameter to a variable key. Adopted templates then appear anywhere templates are selected (composer, campaigns, automations, survey/form alerts) on the WhatsApp channel.

---

## 6. Sending

- **Composer / Automations / Campaigns / Survey & Form alerts**: pick the WhatsApp channel and an approved template.
- The engine resolves the org's WABA from the encrypted connection, re-checks the session window at send time, enforces approved-template/session rules, and records the Meta message id for delivery/read reconciliation.
- Bulk/campaign sends are throttle-aware of the org's Meta messaging tier.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "No WhatsApp connection configured" | Org hasn't saved/tested credentials. |
| "template is REJECTED/PAUSED; cannot send" | Re-sync from Meta; fix or replace the template. |
| "requires an approved template outside the 24-hour window" | The contact hasn't messaged in 24h; use a template. |
| Webhook 401 | App secret mismatch between Meta and the saved connection. |
| Save fails immediately | `WHATSAPP_ENCRYPTION_KEY` not set in the environment. |
