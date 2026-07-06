# Design Spec: Unified Fields & Variables Registry Service

**Date**: 2026-07-06  
**Status**: APPROVED  
**Target Path**: `docs/superpowers/specs/2026-07-06-fields-variables-registry-design.md`

---

## 1. Goal & Context
Currently, variable definitions, registries, display names, and template resolution compilation logic are scattered across multiple modules and collections in the application. This causes architectural bloat, layout inconsistencies in UI sidebars, and different behaviors when resolving variables in email previews, SMS dispatches, automations, and PDF signing workflows.

This design implements a **single source of truth** for all variables and fields. It exposes a unified service (`FieldsVariablesService`) for resolving variables, a unified React component (`<VariablesPanel>`) for selecting variables, and strictly purges deprecated variables (such as legacy `focal_person_*` and `school_*` tags).

---

## 2. Core Architectural Decisions

### Runtime Aggregator & Resolver (Hybrid Model)
*   The service acts as a runtime aggregator. It does not replace the underlying storage collections (e.g. `app_fields` for custom fields, `template_variables` for dynamic form fields), but it acts as the *exclusive gateway* for all variable lookups, listings, and text resolutions.
*   The service accepts explicit context parameters (`workspaceId`, `organizationId`, etc.) for background queues and testing, and provides fallback database queries if parameters are omitted.

### Strict Variable Separation & Deprecations
*   **No Entity Email/Phone**: Top-level entity records only have name/branding and identity attributes. All actual contact details (email, phone, role) live inside the contacts list.
*   **Core Generic Contacts**: Exposed in the main UI list as:
    - `contact_name`
    - `contact_email`
    - `contact_phone`
    - `contact_role`
    (Resolves to the recipient receiving the message, falling back to the primary contact if none specified).
*   **Role-Based Specific Contacts (Upon Demand)**:
    - Hidden by default in the selection panel behind a **"Show role-based & specific contacts"** toggle.
    - When expanded, shows detailed roles: `contact_name_primary`, `contact_email_signatory`, `contact_phone_manager`, etc.
*   **Complete Purge of Legacy Tags**:
    - Legacy variables (e.g. `school_name`, `focal_person_name`, `focal_person_phone`, `contact_person_name`) are hidden from all selection panels, autocomplete lists, and validation.
    - If found in templates during editor saves or compilation, they fail validation (encouraging active replacement by the editor).

---

## 3. Data Schema & Types

A normalized `UnifiedVariable` structure will be defined in `src/lib/types/variables.ts`:

```typescript
export interface UnifiedVariable {
  key: string;            // E.g. "entity_name", "contact_name", "meeting_title", "form_fields.my_field"
  label: string;          // Dynamic display label translated with active terminology (e.g., "Campus Name")
  category: 'core' | 'custom' | 'industry' | 'feature' | 'contact_specific';
  dataType: 'string' | 'number' | 'date' | 'url' | 'boolean';
  description?: string;   // Tooltip info for developers and users
  source: 'static' | 'custom_field' | 'contact_role' | 'feature_system' | 'dynamic_form';
  path?: string;          // Path to resolve on target documents (e.g. "entityContacts[isPrimary].email")
  isDeprecated?: boolean;
  featureContext?: 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign';
  exampleValue?: string;  // For sandbox previews
}
```

---

## 4. Resolver Service API (`fields-variables-service.ts`)

The service module `src/lib/services/fields-variables-service.ts` will expose the following operations:

```typescript
export class FieldsVariablesService {
  /**
   * Returns all normalized variables available for a specific context.
   * Scopes Custom Fields (from app_fields) by workspace industry vertical.
   * Maps dynamic form/survey questions if sourceId is provided.
   */
  static async getVariables(params: {
    workspaceId: string;
    organizationId?: string;
    featureContext?: 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign';
    sourceId?: string; // formId or surveyId
    terminology?: { singular: string; plural: string }; // Client-side terminology overrides
  }): Promise<UnifiedVariable[]>;

  /**
   * Replaces all {{tag}} tokens in standard template text.
   * Resolves generic contact_* to recipientContact first, then falls back to isPrimary contact.
   */
  static async resolveTemplateVariables(
    templateText: string,
    context: {
      workspaceId: string;
      entityId?: string;
      recipientContact?: string; // Email or phone of current recipient
      meetingId?: string;
      formId?: string;
      surveyId?: string;
      agreementId?: string;
      submissionId?: string;
      responseId?: string;
      extraVars?: Record<string, any>; // Call-site overrides/trigger payloads
    }
  ): Promise<string>;
}
```

---

## 5. Standardized UI Component (`VariablesPanel.tsx`)

We will build `src/components/shared/VariablesPanel.tsx`:
*   **UI Groups**: Accordion categories for **Core Entity & Contacts**, **Industry Fields**, **Custom Fields**, and **Feature Settings** (meeting/survey/form details).
*   **Search**: Reactive filter input searching keys, labels, and descriptions.
*   **Toggle Switch**: A switch labeled **"Show role-based & specific contacts"** that controls the visibility of `contact_specific` category variables.
*   **Callbacks**: Exposes `onSelect(key: string)` to insert standard variables into visual email blocks, plain textareas, and autocomplete menus.

---

## 6. Integration Scope & Verification

### Affected Components
1.  **Messaging Engine**: Replaces manual variable resolution in `messaging-engine.ts` dispatches.
2.  **Visual Template Workshop**: Sidebar variables panel and simulation text previews in `template-workshop.tsx`.
3.  **PDF/Agreement signing**: Standardizes token remapping in `pdf-actions.ts`.
4.  **Call Centre Scripts**: Dialer screen rendering in `InteractiveScriptView.tsx` and `ScriptBodyDisplay.tsx`.
5.  **Automations Engine**: Node config parsing in `automations/variables.ts` and dynamic deal creation in `deal-automation-actions.ts`.

### Verification & Automated Testing
*   **Unit Tests**: We will write a suite in `src/lib/__tests__/fields-variables-service.test.ts` validating:
    - Key mapping of generic `contact_name` vs specific role-based `contact_name_primary`.
    - Verification that `school_*` and `focal_person_*` are not resolved.
    - Correct output under SaaS / SchoolEnrollment workspace scopes.
*   **Build Typechecks**: Running `pnpm typecheck` to verify no compilation regressions.

---

## 7. Development Governance (Preventing Future Divergence)

1.  **Workspace Agent Rule**:
    We will append a rule to `.agents/AGENTS.md` specifying that all variables display, mapping, rendering, and parsing must exclusively route through `FieldsVariablesService` and `<VariablesPanel>`.
2.  **Legacy Code Cleanup**:
    We will delete old files `src/lib/contact-variable-definitions.ts` and `src/lib/system-variable-definitions.ts` to prevent duplication.
3.  **Compile constraints**:
    Any custom regex matching `/\{\{(.*?)\}\}/g` outside the resolver will be marked as deprecated.
