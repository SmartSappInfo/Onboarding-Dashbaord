# SaaS Field Mapping Audit

## Executive Summary

This document audits the existing `InstitutionData` interface against the SaaS industry requirements to identify field mappings and missing features.

**Current Status**: The existing `InstitutionData` contains SaaS B2B account management fields that need to be mapped to the new `SaaSInstitutionData` interface.

**Key Finding**: The current system IS a SaaS B2B CRM where schools are customers (accounts), NOT education institutions. All existing schools must migrate to "SaaS" industry vertical.

---

## Field Mapping Analysis

### Existing InstitutionData Fields

```typescript
export interface InstitutionData {
  nominalRoll?: number;                    // ✅ Maps to companySize
  subscriptionPackageId?: string;          // ⚠️  Needs transformation
  subscriptionRate?: number;               // ✅ Direct mapping
  billingAddress?: string;                 // ✅ Direct mapping
  currency?: string;                       // ✅ Direct mapping
  modules?: {                              // ✅ Maps to features[]
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }[];
  implementationDate?: string;             // ✅ Maps to signupDate
  referee?: string;                        // ❌ Not in SaaS model
  website?: string;                        // ❌ Not in SaaS model
  initials?: string;                       // ❌ Entity-level field
  slogan?: string;                         // ❌ Entity-level field
  logoUrl?: string;                        // ❌ Entity-level field
  heroImageUrl?: string;                   // ❌ Entity-level field
  discountPercentage?: number;             // ❌ Not in SaaS model
  arrearsBalance?: number;                 // ❌ Not in SaaS model
  creditBalance?: number;                  // ❌ Not in SaaS model
  location?: {                             // ❌ Entity-level field
    zone?: { id: string; name: string };
    locationString?: string;
  };
}
```

### Target SaaSInstitutionData Fields

```typescript
export interface SaaSInstitutionData {
  industry: 'SaaS';                        // 🆕 New field
  entityType: 'institution';               // 🆕 New field
  companySize: number;                     // ✅ FROM nominalRoll
  planType: string;                        // ✅ FROM subscriptionPackage
  features: string[];                      // ✅ FROM modules
  signupDate: string;                      // ✅ FROM implementationDate
  billingAddress?: string;                 // ✅ Direct mapping
  currency?: string;                       // ✅ Direct mapping
  subscriptionRate?: number;               // ✅ Direct mapping
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned'; // 🆕 New field
  renewalDate?: string;                    // 🆕 New field
  customerTier?: 'basic' | 'pro' | 'enterprise'; // 🆕 New field
  trialIds?: string[];                     // 🆕 New collection reference
  onboardingIds?: string[];                // 🆕 New collection reference
  subscriptionIds?: string[];              // 🆕 New collection reference
  supportTicketIds?: string[];             // 🆕 New collection reference
  healthScoreIds?: string[];               // 🆕 New collection reference
}
```

---

## Detailed Field Mappings

### ✅ Direct Mappings (No Transformation Required)

| Existing Field | Target Field | Notes |
|----------------|--------------|-------|
| `billingAddress` | `billingAddress` | Direct copy |
| `currency` | `currency` | Direct copy |
| `subscriptionRate` | `subscriptionRate` | Direct copy |

### ✅ Transformation Mappings

| Existing Field | Target Field | Transformation Logic |
|----------------|--------------|----------------------|
| `nominalRoll` | `companySize` | Direct rename: `companySize = nominalRoll` |
| `subscriptionPackageId` + `subscriptionPackageName` | `planType` | Use package name: `planType = subscriptionPackageName` |
| `modules[]` | `features[]` | Extract names: `features = modules.map(m => m.name)` |
| `implementationDate` | `signupDate` | Direct rename: `signupDate = implementationDate` |

### 🆕 New Required Fields

| Field | Type | Default Value | Notes |
|-------|------|---------------|-------|
| `industry` | `'SaaS'` | `'SaaS'` | All existing schools are SaaS accounts |
| `entityType` | `'institution'` | `'institution'` | All existing schools are institutions |
| `accountStatus` | enum | `'active'` | Derive from `status` field or default to `'active'` |
| `renewalDate` | string | `null` | Calculate from `signupDate` + billing cycle if available |
| `customerTier` | enum | `null` | Derive from `planType` or leave null |

### 🆕 New Collection Reference Fields

| Field | Type | Default Value | Notes |
|-------|------|---------------|-------|
| `trialIds` | `string[]` | `[]` | Empty array initially, populated by new trial management feature |
| `onboardingIds` | `string[]` | `[]` | Empty array initially, populated by new onboarding feature |
| `subscriptionIds` | `string[]` | `[]` | Empty array initially, populated by new subscription management |
| `supportTicketIds` | `string[]` | `[]` | Empty array initially, populated by new support ticket feature |
| `healthScoreIds` | `string[]` | `[]` | Empty array initially, populated by new health scoring feature |

### ❌ Fields Not Migrated to SaaSInstitutionData

These fields remain at the Entity level or are deprecated:

| Field | Reason | New Location |
|-------|--------|--------------|
| `referee` | Not SaaS-specific | Could be custom field or deprecated |
| `website` | Entity-level attribute | Remains on `Entity` |
| `initials` | Entity-level branding | Remains on `Entity` |
| `slogan` | Entity-level branding | Remains on `Entity` |
| `logoUrl` | Entity-level branding | Remains on `Entity` |
| `heroImageUrl` | Entity-level branding | Remains on `Entity` |
| `discountPercentage` | Billing-specific | Move to billing/invoice system |
| `arrearsBalance` | Billing-specific | Move to billing/invoice system |
| `creditBalance` | Billing-specific | Move to billing/invoice system |
| `location` | Entity-level attribute | Remains on `Entity` |

---

## Missing SaaS Features Analysis

### Requirements 8.17–8.23: New SaaS Collections

The following collections are defined in types but NOT yet implemented with server actions:

| Collection | Status | Interface Defined | Actions Needed |
|------------|--------|-------------------|----------------|
| `trials` | ❌ Missing | ✅ Yes (`Trial`) | `createTrial`, `getTrialsForEntity`, `updateTrialStatus` |
| `onboarding` | ❌ Missing | ✅ Yes (`Onboarding`) | `createOnboarding`, `updateOnboardingMilestone` |
| `subscriptions` | ❌ Missing | ✅ Yes (`IndustrySubscription`) | `createSubscription`, `updateSubscription` |
| `supportTickets` | ❌ Missing | ✅ Yes (`SupportTicket`) | `createSupportTicket`, `updateSupportTicket` |
| `healthScores` | ❌ Missing | ✅ Yes (`HealthScore`) | `createHealthScore`, `getLatestHealthScore` |
| `productUsage` | ❌ Missing | ✅ Yes (`ProductUsage`) | `recordProductUsage` |
| `featureAdoption` | ❌ Missing | ✅ Yes (`FeatureAdoption`) | `recordFeatureAdoption` |

### Requirements 8A.1–8A.15: Additional Missing Features

From the SaaS requirements document (docs/Entity_institution_expansion_sass.md):

| Feature Dataset | Status | Notes |
|-----------------|--------|-------|
| Enquiries/Leads | ❌ Missing | Source, status, qualification tracking |
| Opportunities/Deals | ❌ Missing | Deal value, sales stage, probability, close date |
| Trial/Onboarding | ❌ Missing | Trial dates, onboarding status, activation milestones |
| Product Usage/Behavioral | ❌ Missing | Feature usage, frequency, session duration, engagement |
| Feature Adoption | ❌ Missing | Feature usage status, adoption date, depth of usage |
| Subscription & Billing | ⚠️ Partial | Billing cycle, payment status, upgrade/downgrade history |
| Support/Ticket | ❌ Missing | Issue type, priority, resolution time, satisfaction |
| Customer Health/Analytics | ❌ Missing | Health score, usage score, support score, churn risk |
| Churn & Retention | ❌ Missing | Churn date, churn reason, retention actions, win-back |
| Loyalty/Expansion | ❌ Missing | Lifetime value, upsell history, referral activity, advocacy |

---

## Migration Strategy

### Phase 1: Core Field Mapping (Task 9.1) ✅

1. Document all field mappings (this document)
2. Identify transformation logic for each field
3. Validate mapping completeness

### Phase 2: Server Actions Implementation (Task 9.2)

Create `src/lib/saas-actions.ts` with the following functions:

```typescript
// Trial Management
export async function createTrial(params: CreateTrialParams): Promise<Trial>
export async function getTrialsForEntity(entityId: string): Promise<Trial[]>
export async function updateTrialStatus(trialId: string, status: Trial['trialStatus']): Promise<void>

// Onboarding Tracking
export async function createOnboarding(params: CreateOnboardingParams): Promise<Onboarding>
export async function updateOnboardingMilestone(onboardingId: string, milestoneName: string, completed: boolean): Promise<void>

// Subscription Management
export async function createSubscription(params: CreateSubscriptionParams): Promise<IndustrySubscription>
export async function updateSubscription(subscriptionId: string, updates: Partial<IndustrySubscription>): Promise<void>

// Support Ticket Management
export async function createSupportTicket(params: CreateSupportTicketParams): Promise<SupportTicket>
export async function updateSupportTicket(ticketId: string, updates: Partial<SupportTicket>): Promise<void>

// Health Score Tracking
export async function createHealthScore(params: CreateHealthScoreParams): Promise<HealthScore>
export async function getLatestHealthScore(entityId: string): Promise<HealthScore | null>

// Product Usage Analytics
export async function recordProductUsage(params: RecordProductUsageParams): Promise<ProductUsage>

// Feature Adoption Tracking
export async function recordFeatureAdoption(params: RecordFeatureAdoptionParams): Promise<FeatureAdoption>
```

**Critical Validation**: All actions MUST validate `workspace.industry === 'SaaS'` before writing.

### Phase 3: Unit Tests (Task 9.3)

Test coverage requirements:
- ✅ Each action rejects non-SaaS workspaces
- ✅ `createTrial` updates entity `trialIds` array
- ✅ `createHealthScore` stores correct score fields
- ✅ All CRUD operations work correctly
- ✅ Firestore security rules enforce industry scoping

---

## Data Transformation Examples

### Example 1: Mapping Existing School to SaaSInstitutionData

**Input (Existing School)**:
```typescript
{
  id: "school_123",
  name: "Acme Academy",
  nominalRoll: 500,
  subscriptionPackageName: "Enterprise",
  subscriptionRate: 5000,
  currency: "USD",
  modules: [
    { id: "m1", name: "Admissions", abbreviation: "ADM", color: "#blue" },
    { id: "m2", name: "Billing", abbreviation: "BIL", color: "#green" }
  ],
  implementationDate: "2023-01-15T00:00:00Z",
  billingAddress: "123 Main St, City, State 12345",
  status: "Active"
}
```

**Output (SaaSInstitutionData)**:
```typescript
{
  industry: "SaaS",
  entityType: "institution",
  companySize: 500,                    // FROM nominalRoll
  planType: "Enterprise",              // FROM subscriptionPackageName
  features: ["Admissions", "Billing"], // FROM modules.map(m => m.name)
  signupDate: "2023-01-15T00:00:00Z", // FROM implementationDate
  billingAddress: "123 Main St, City, State 12345",
  currency: "USD",
  subscriptionRate: 5000,
  accountStatus: "active",             // FROM status (lowercase)
  renewalDate: "2024-01-15T00:00:00Z", // Calculated (1 year from signup)
  customerTier: "enterprise",          // Derived from planType
  trialIds: [],
  onboardingIds: [],
  subscriptionIds: [],
  supportTicketIds: [],
  healthScoreIds: []
}
```

### Example 2: Creating a Trial Record

```typescript
const trial = await createTrial({
  organizationId: "org_123",
  workspaceId: "ws_456",
  entityId: "entity_789",
  trialStartDate: "2024-01-01T00:00:00Z",
  trialEndDate: "2024-01-31T00:00:00Z",
  trialStatus: "active"
});

// Updates entity.industryData.trialIds
// entity.industryData.trialIds = [...existingIds, trial.id]
```

---

## Validation Checklist

### Field Mapping Validation

- [x] All existing InstitutionData fields reviewed
- [x] Transformation logic documented for each mapped field
- [x] New required fields identified with default values
- [x] Non-migrated fields documented with rationale
- [x] Collection reference fields initialized as empty arrays

### Requirements Coverage

- [x] Requirement 8.14: Field mappings documented
- [x] Requirement 8A.1: Existing fields audited against SaaS requirements
- [x] Requirement 8A.2: Missing features identified
- [x] Requirements 8.17–8.23: New collection interfaces validated
- [x] Requirements 8A.6–8A.11: Missing SaaS features documented

### Implementation Readiness

- [x] All type interfaces exist in `src/lib/types.ts`
- [ ] Server actions file `src/lib/saas-actions.ts` created (Task 9.2)
- [ ] Unit tests written for all actions (Task 9.3)
- [ ] Firestore security rules updated for SaaS collections
- [ ] Firestore indexes created for SaaS collection queries

---

## Conclusion

The audit confirms that:

1. **Existing InstitutionData is SaaS-focused**: All current fields map cleanly to SaaS account management
2. **Field mappings are straightforward**: Most fields require simple renaming or extraction
3. **Missing features identified**: 7 new collections need server actions implementation
4. **Migration path is clear**: Existing schools → SaaS industry → new entity model

**Next Steps**:
1. ✅ Complete Task 9.1 (this audit)
2. ⏭️ Proceed to Task 9.2 (implement `saas-actions.ts`)
3. ⏭️ Proceed to Task 9.3 (write unit tests)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-27  
**Author**: Industry Expansion Implementation Team  
**Status**: ✅ Complete
