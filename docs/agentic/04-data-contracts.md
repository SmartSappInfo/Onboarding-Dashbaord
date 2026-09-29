# Data Contracts & Schema Validation (Phase 0)
**Document 04 in the Agentic Architecture Suite**

---

## 1. Schema Validation & Typing Policies

### 1.1 Modified Rule 4: The Trust Boundary Rule
> **Never use `any`, `any[]`, or unchecked casts in application/domain code. Prefer inferred and explicit module types. `unknown` may be used only at external trust boundaries and must be immediately validated/narrowed with a schema before entering domain logic. Never propagate unvalidated `unknown`.**

### 1.2 Rule 31: Output & Argument Validation
Every interaction between an agent and a capability contract must undergo strict validation:
```
MODEL GENERATED JSON
        ↓
UNTRUSTED BOUNDARY (unknown)
        ↓
ZOD SCHEMA VALIDATION
        ↓
BUSINESS POLICY & PERMISSION VALIDATION
        ↓
CANONICAL CAPABILITY EXECUTION
```

---

## 2. Core Data Contracts

### 2.1 Entity & Contact Schema (`crm_contacts`)
```typescript
import { z } from 'zod';

export const ContactIdentitySchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  entityType: z.enum(['school', 'legal_client', 'property_buyer', 'saas_account', 'consultancy_client', 'marketing_lead']),
  displayName: z.string().min(1),
  primaryEmail: z.string().email().optional(),
  primaryPhone: z.string().min(5).optional(),
  tags: z.array(z.string()).default([]),
  industryData: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().nonnegative(),
});

export type ContactIdentity = z.infer<typeof ContactIdentitySchema>;
```

### 2.2 Experience Portal & Membership Schema (`experience_portal`)
```typescript
export const MembershipPlanSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  portalId: z.string().min(1),
  name: z.string().min(1),
  tier: z.enum(['free', 'standard', 'pro', 'enterprise']),
  billingInterval: z.enum(['monthly', 'quarterly', 'annual', 'lifetime']),
  priceGhs: z.number().nonnegative(),
  features: z.array(z.string()),
  maxSeats: z.number().int().positive().default(1),
  active: z.boolean().default(true),
  version: z.number().int().nonnegative(),
});

export type MembershipPlan = z.infer<typeof MembershipPlanSchema>;
```

### 2.3 Template Message Dispatch Schema (`communication_messaging`)
```typescript
export const SendTemplateMessageInputSchema = z.object({
  workspaceId: z.string().min(1),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  recipientId: z.string().min(1),
  recipientAddress: z.string().min(1),
  templateId: z.string().min(1),
  customVariables: z.record(z.string(), z.string()).optional(),
  idempotencyKey: z.string().min(16), // Mandatory for all L3 dispatches
});

export type SendTemplateMessageInput = z.infer<typeof SendTemplateMessageInputSchema>;
```

---

## 3. Variables & Tag Single Sources of Truth

* **Variables Substitution**: Any template string containing tokens (e.g. `{{contact.name}}`, `{{portal.title}}`) must exclusively be parsed through `FieldsVariablesService.resolveTemplateVariables(template, context)`.
* **Tags Application**: All tag assignments must pass validated tag IDs to `tag-actions.ts`. Direct string delimiter manipulation is strictly forbidden.
