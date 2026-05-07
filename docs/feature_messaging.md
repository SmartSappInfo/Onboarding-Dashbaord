
# Feature: Messaging Engine

## 1. Purpose
A centralized communication infrastructure for dispatching SMS and Email across the platform. It handles both manual bulk dispatches, campaign sends, and automated system triggers.

## 2. Core Infrastructure (Configuration)

### Sender Profiles
- **Identities**: Verified SMS Sender IDs (e.g., "SMARTSAPP") and Email "From" addresses.
- **Status**: Active/Inactive toggles and default profile management.

### Visual Styles
- **HTML Wrappers**: Branded layout architectures for emails.
- **Dynamic Branding**: Styles use `{{org_logo_url}}`, `{{org_name}}`, `{{org_address}}`, `{{org_email}}`, `{{org_phone}}`, `{{org_website}}`, and `{{current_year}}` placeholders — never hardcoded org details.
- **Optional**: Templates can exist without a style. `styleId` is nullable.
- **AI Generator**: Describe a brand vibe, and the AI generates a responsive, cross-client compatible HTML wrapper with a `{{content}}` injection point and dynamic org placeholders.

### Message Templates
- **Three-Axis Classification**:
  - `channel`: `email` | `sms`
  - `category`: `surveys` | `meetings` | `forms` | `agreements` | `campaigns` | `reminders` | `tasks` | `automations` | `qr_codes` | `general`
  - `target`: `external_client` (uses workspace terminology) | `internal_team`
- **Content Modes** (email only):
  - `plain_text`: Simple text with `{{variable}}` placeholders
  - `html_code`: Raw HTML/CSS with live preview
  - `rich_builder`: Visual block editor with drag-and-drop
- **Dynamic Variables**: Uses `{{variable_name}}` syntax for real-time resolution during dispatch.
- **Filtering**: Consumers (Survey, Meeting, Automation modules) filter templates on all three axes to show only relevant options.

---

## 3. Operations (Execution)

### Message Composer
- **Single Mode**: Quick dispatch to a specific recipient with manual variable entry.
- **Bulk Mode**: Upload CSV recipient lists. The system automatically maps CSV columns to template variables.
- **Live Preview**: Real-time render of the message (applying the Visual Style for emails) before dispatch.
- **Progress Tracking**: Real-time progress bar and processed/total counters for bulk jobs.

### Campaign System
- **Campaign Entity**: Persistent `message_campaigns` records with lifecycle tracking (draft → scheduled → sending → sent).
- **Audience Builder**: Tag-based, role-based, and manual entity selection with saved segments.
- **Campaign Analytics**: Per-campaign delivery, open, click, and failure metrics.
- **Recovery Actions**: Resend to failed, resend to non-openers, clone campaign.

### Communication Logs
- **Audit Trail**: Detailed record of every message sent.
- **Context**: Captures the resolved body, variables used, and associated entity/template.
- **Status Monitoring**: Tracks `sent` vs. `failed` states with explicit error reporting for debugging.

---

## 4. System Integrations
- **Surveys**: Triggers dispatches upon submission (to respondent or admin). Filters templates by `channel + surveys + target`.
- **Doc Signing**: Triggers "Signature Received" notifications. Filters by `channel + forms + target`.
- **Meetings**: Composer pre-fills invite links and meeting details. Filters by `channel + meetings + target`.
- **Automations**: Automation actions resolve templates by `channel + category + target`.

---

## 5. Dynamic Organization Branding
- **Logo**: `{{org_logo_url}}` resolves from `Organization.logoUrl` at send time.
- **Footer**: `{{org_name}}`, `{{org_email}}`, `{{org_phone}}`, `{{org_address}}`, `{{org_website}}` all resolve from the organization record.
- **Year**: `{{current_year}}` resolves to the current calendar year.
- **No Hardcoding**: Style wrappers and global templates must use these placeholders, not literal values.
