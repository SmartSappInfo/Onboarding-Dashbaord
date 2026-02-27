
# Feature: Messaging Engine

## 1. Purpose
A centralized communication infrastructure for dispatching SMS and Email across the platform. It handles both manual bulk dispatches and automated system triggers.

## 2. Core Infrastructure (Configuration)

### Sender Profiles
- **Identities**: Verified SMS Sender IDs (e.g., "SMARTSAPP") and Email "From" addresses.
- **Status**: Active/Inactive toggles and default profile management.

### Visual Styles
- **HTML Wrappers**: Branded layout architectures for emails.
- **AI Generator**: Describe a brand vibe, and the AI generates a responsive, cross-client compatible HTML wrapper with a `{{content}}` injection point.

### Message Templates
- **Categorization**: Grouped by module (Forms, Surveys, Meetings, General).
- **Dynamic Variables**: Uses `{{variable_name}}` syntax for real-time resolution during dispatch.
- **Channel Specific**: Specialized editors for SMS (text-only) and Email (rich subject + styled body).

---

## 3. Operations (Execution)

### Message Composer
- **Single Mode**: Quick dispatch to a specific recipient with manual variable entry.
- **Bulk Mode**: Upload CSV recipient lists. The system automatically maps CSV columns to template variables.
- **Live Preview**: Real-time render of the message (applying the Visual Style for emails) before dispatch.
- **Progress Tracking**: Real-time progress bar and processed/total counters for bulk jobs.

### Communication Logs
- **Audit Trail**: Detailed record of every message sent.
- **Context**: Captures the resolved body, variables used, and associated school/template.
- **Status Monitoring**: Tracks `sent` vs. `failed` states with explicit error reporting for debugging.

---

## 4. System Integrations
- **Surveys**: Triggers dispatches upon submission (to respondent or admin).
- **Doc Signing**: Triggers "Signature Received" notifications.
- **Meetings**: Composer pre-fills invite links and meeting details via deep-linking.
