# Design Document: Industry-Scoped Entity Expansion

## Overview

### Purpose

This design document specifies the technical architecture for transforming SmartSapp from a SaaS B2B CRM platform into a multi-industry vertical CRM system. The current system manages ~1000+ school accounts as B2B SaaS customers with features like subscription packages, billing, nominal roll (company size), and implementation tracking. This expansion adds five new industry verticals (School Enrollment, Law Firms, Marketing Agencies, Real Estate, Consultancy) while preserving the existing SaaS implementation.

### Current System Context

**Critical Understanding**: SmartSapp currently operates as a SaaS B2B platform where schools are customers (B2B accounts), NOT education institutions. The existing features are SaaS account management features:
- `nominalRoll` → Company size (number of employees/users)
- `subscriptionPackage` → SaaS plan type (Basic, Pro, Enterprise)
- `modules` → Enabled SaaS features
- `implementationDate` → SaaS account signup date
- Billing fields → SaaS subscription billing

**Migration Implication**: Existing schools must migrate to "SaaS" industry vertical, NOT "School Enrollment" industry. School Enrollment is a NEW vertical for education institutions managing student admissions.

### Implementation Priority

The system will be implemented in phases:
1. **SaaS** (Priority 1) - Current system validation and completion
2. **Marketing** (Priority 2) - Marketing agency CRM
3. **School Enrollment** (Priority 3) - Education admissions management
4. **Consultancy** (Priority 4) - Consulting engagement tracking
5. **Real Estate** (Priority 5) - Property and transaction management
6. **Law** (Priority 6) - Legal practice management

### Design Goals

1. **Zero Downtime**: Existing SaaS customers experience no service interruption
2. **Backward Compatibility**: Current SaaS workspaces continue functioning without changes
3. **Data Integrity**: No data loss during migration or operation
4. **Performance**: Maintain sub-2-second page loads for 10,000+ entities
5. **Scalability**: Support 6+ industries, 10,000+ entities per industry, 1,000+ organizations
6. **Maintainability**: Modular architecture allowing new industries without affecting existing ones
7. **Security**: Strict data isolation between organizations and workspaces

### Key Architectural Decisions

1. **Polymorphic Industry Data**: Use TypeScript discriminated unions for type-safe industry-specific data
2. **Workspace-Scoped Industries**: Each workspace belongs to exactly one industry (immutable after first entity link)
3. **Adapter Pattern**: Unified API layer for legacy and new data models
4. **Dual-Read Migration**: Support both legacy `schools` collection and new `entities` model during transition
5. **Industry-Specific Collections**: Separate Firestore collections per industry for specialized data
6. **Terminology Mapping**: Dynamic UI labels based on workspace industry
7. **Modular Feature System**: Industry-specific features as pluggable modules

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │   React UI   │  │   Context    │          │
│  │  App Router  │  │  Components  │  │  Providers   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Industry Adapter Layer                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Industry Context Provider (Workspace Industry Detection) │  │
│  │  Terminology Mapper │ Feature Gate │ UI Component Router  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Entity     │  │   Industry   │  │   Pipeline   │          │
│  │   Actions    │  │   Actions    │  │   Actions    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Messaging   │  │  Automation  │  │   Billing    │          │
│  │   Actions    │  │   Actions    │  │   Actions    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Access Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Contact Adapter (Legacy/New Model Bridge)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Firestore  │  │   Firebase   │  │   Firebase   │          │
│  │   Queries    │  │     Auth     │  │   Storage    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Firestore Database                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   entities   │  │  workspace_  │  │  workspaces  │          │
│  │              │  │   entities   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │organizations │  │    schools   │  │     tags     │          │
│  │              │  │   (legacy)   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Industry-Specific Collections                    │   │
│  │  trials │ onboarding │ subscriptions │ applications │... │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Industry Vertical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Organization Level                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Optional Industry Default (for new workspaces)           │  │
│  │  Branding │ Billing │ User Management                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Workspace Level                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Industry: SaaS | SchoolEnrollment | Law | Marketing |   │  │
│  │            RealEstate | Consultancy                       │  │
│  │  (Immutable after first entity link - Scope Lock)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Terminology  │  │   Pipeline   │  │   Features   │          │
│  │   Mapping    │  │   Template   │  │    Gates     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Entity Level                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Core Data (industry-agnostic)                            │  │
│  │  name │ email │ phone │ address │ status │ createdAt     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Industry Data (polymorphic)                              │  │
│  │  SaaSInstitutionData | SchoolEnrollmentInstitutionData |  │  │
│  │  LawInstitutionData | MarketingInstitutionData | ...     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Action (Create SaaS Account)
        │
        ▼
Industry Context Detection (Workspace.industry = "SaaS")
        │
        ▼
Terminology Mapping ("Account" instead of "Entity")
        │
        ▼
Feature Gate Check (SaaS features enabled)
        │
        ▼
Entity Action (createEntity with SaaSInstitutionData)
        │
        ▼
Data Validation (Zod schema for SaaSInstitutionData)
        │
        ▼
Firestore Write (entities + workspace_entities)
        │
        ▼
Industry Collection Write (trials, subscriptions, etc.)
        │
        ▼
Activity Log (account_created with industry context)
        │
        ▼
UI Update (Display "Account" with SaaS-specific fields)
```

## Components and Interfaces

### Core Type Definitions

```typescript
// Industry Vertical Enum
export type IndustryVertical = 
  | 'SaaS'
  | 'SchoolEnrollment'
  | 'Law'
  | 'Marketing'
  | 'RealEstate'
  | 'Consultancy';

// Organization Interface (Updated)
export interface Organization {
  id: string;
  name: string;
  industry?: IndustryVertical; // Optional default for new workspaces
  logo?: string;
  primaryColor?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'suspended' | 'deleted';
}

// Workspace Interface (Updated)
export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  industry: IndustryVertical; // Required, immutable after first entity link
  industryScopeLocked: boolean; // True after first entity link
  industryScopeLockedAt?: Timestamp;
  contactScope?: 'institution' | 'family' | 'person'; // Locked with industry
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'archived';
}

// Entity Interface (Updated)
export interface Entity {
  id: string;
  organizationId: string;
  entityType: 'institution' | 'family' | 'person';
  industry?: IndustryVertical; // Optional, inherited from workspace
  
  // Core fields (industry-agnostic)
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  status: 'active' | 'inactive' | 'archived';
  
  // Industry-specific data (polymorphic)
  industryData?: IndustryData;
  
  // Migration fields
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write';
  legacySchoolId?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Polymorphic Industry Data
export type IndustryData =
  | SaaSInstitutionData
  | SchoolEnrollmentInstitutionData
  | LawInstitutionData
  | MarketingInstitutionData
  | RealEstateInstitutionData
  | ConsultancyInstitutionData
  | SaaSPersonData
  | LawPersonData
  | MarketingPersonData
  | RealEstatePersonData
  | ConsultancyPersonData;

// SaaS Industry Data (Current System)
export interface SaaSInstitutionData {
  industry: 'SaaS';
  entityType: 'institution';
  
  // Mapped from existing fields
  companySize: number; // Maps from nominalRoll
  planType: string; // Maps from subscriptionPackage
  features: string[]; // Maps from modules
  signupDate: Timestamp; // Maps from implementationDate
  
  // Existing billing fields
  billingAddress?: Address;
  currency?: string;
  subscriptionRate?: number;
  
  // New SaaS-specific fields
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned';
  renewalDate?: Timestamp;
  customerTier?: 'basic' | 'pro' | 'enterprise';
  
  // References to industry-specific collections
  trialIds?: string[];
  onboardingIds?: string[];
  subscriptionIds?: string[];
  supportTicketIds?: string[];
  healthScoreIds?: string[];
}

export interface SaaSPersonData {
  industry: 'SaaS';
  entityType: 'person';
  role: 'admin' | 'manager' | 'user';
  lastLoginDate?: Timestamp;
  activationStatus: 'pending' | 'active' | 'inactive';
}

// School Enrollment Industry Data (NEW)
export interface SchoolEnrollmentInstitutionData {
  industry: 'SchoolEnrollment';
  entityType: 'institution';
  
  gradeOfferings: string[]; // e.g., ['K', '1', '2', ..., '12']
  academicYear: string; // e.g., '2024-2025'
  enrollmentCapacity?: number;
  currentEnrollment?: number;
  
  // References to industry-specific collections
  applicationIds?: string[];
  enrollmentIds?: string[];
  schoolVisitIds?: string[];
}

// Law Industry Data
export interface LawInstitutionData {
  industry: 'Law';
  entityType: 'institution';
  
  firmType: 'solo' | 'partnership' | 'corporate';
  practiceAreas: string[]; // e.g., ['litigation', 'corporate', 'family']
  barAssociations?: string[];
  conflictCheckRequired: boolean;
  
  // References to industry-specific collections
  matterIds?: string[];
  intakeFormIds?: string[];
  conflictCheckIds?: string[];
}

export interface LawPersonData {
  industry: 'Law';
  entityType: 'person';
  clientType: 'individual' | 'company';
  legalIssueType?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// Marketing Industry Data
export interface MarketingInstitutionData {
  industry: 'Marketing';
  entityType: 'institution';
  
  clientIndustry: string;
  businessSize: {
    employees?: number;
    revenue?: number;
  };
  targetAudience?: string;
  monthlyBudget?: number;
  
  // References to industry-specific collections
  campaignIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}

export interface MarketingPersonData {
  industry: 'Marketing';
  entityType: 'person';
  role: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  approvalAuthority: boolean;
}

// Real Estate Industry Data
export interface RealEstateInstitutionData {
  industry: 'RealEstate';
  entityType: 'institution';
  
  propertyPortfolio?: string[];
  developerType: 'residential' | 'commercial' | 'mixed';
  investmentFocus?: string;
  
  // References to industry-specific collections
  propertyIds?: string[];
}

export interface RealEstatePersonData {
  industry: 'RealEstate';
  entityType: 'person';
  clientType: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor';
  budgetRange?: {
    min: number;
    max: number;
  };
  preferredLocations?: string[];
}

// Consultancy Industry Data
export interface ConsultancyInstitutionData {
  industry: 'Consultancy';
  entityType: 'institution';
  
  clientIndustry: string;
  companySize: {
    employees?: number;
    revenue?: number;
  };
  strategicPriorities?: string[];
  painPoints?: string[];
  
  // References to industry-specific collections
  discoveryIds?: string[];
  proposalIds?: string[];
  engagementIds?: string[];
}

export interface ConsultancyPersonData {
  industry: 'Consultancy';
  entityType: 'person';
  role: string;
  department?: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  decisionMakingStyle?: 'fast' | 'consensus' | 'hierarchical';
}
```


### Industry-Specific Collection Interfaces

```typescript
// SaaS Industry Collections
export interface Trial {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Reference to Entity
  
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  trialStatus: 'active' | 'expired' | 'converted' | 'cancelled';
  conversionDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Onboarding {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  onboardingStatus: 'not_started' | 'in_progress' | 'completed' | 'stalled';
  activationMilestones: {
    name: string;
    completed: boolean;
    completedAt?: Timestamp;
  }[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Subscription {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  planType: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  currency: string;
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  startDate: Timestamp;
  renewalDate: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SupportTicket {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  issueType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolutionTime?: number; // in hours
  satisfactionRating?: number; // 1-5
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}

export interface HealthScore {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  overallScore: number; // 0-100
  usageScore: number;
  supportScore: number;
  engagementScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  
  calculatedAt: Timestamp;
  createdAt: Timestamp;
}

// School Enrollment Industry Collections
export interface Application {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string; // Family entity
  
  studentName: string;
  gradeApplying: string;
  applicationStatus: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'waitlisted';
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Enrollment {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string;
  
  studentName: string;
  grade: string;
  academicYear: string;
  enrollmentStatus: 'enrolled' | 'withdrawn' | 'graduated';
  enrollmentDate: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SchoolVisit {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string;
  
  visitDate: Timestamp;
  visitType: 'tour' | 'open_house' | 'shadow_day' | 'meeting';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  attendees?: string[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Law Industry Collections
export interface Matter {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  
  matterNumber: string;
  matterType: string;
  practiceArea: string;
  status: 'intake' | 'active' | 'on_hold' | 'closed';
  openedDate: Timestamp;
  closedDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConflictCheck {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  checkStatus: 'pending' | 'clear' | 'conflict_found';
  conflictDetails?: string;
  checkedBy: string;
  checkedAt: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TimeTracking {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  matterId: string;
  
  userId: string; // Attorney/staff
  hours: number;
  billableRate: number;
  description: string;
  date: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Marketing Industry Collections
export interface Campaign {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  
  campaignName: string;
  campaignType: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  budget: number;
  startDate: Timestamp;
  endDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Deliverable {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  
  deliverableName: string;
  deliverableType: string;
  status: 'pending' | 'in_progress' | 'review' | 'approved' | 'delivered';
  dueDate: Timestamp;
  completedDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Real Estate Industry Collections
export interface Property {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity (owner/developer)
  
  propertyType: 'residential' | 'commercial' | 'land' | 'mixed';
  address: Address;
  price: number;
  status: 'available' | 'under_contract' | 'sold' | 'off_market';
  listedDate: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Viewing {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  clientEntityId: string; // Buyer/tenant entity
  
  viewingDate: Timestamp;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  feedback?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Offer {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  buyerEntityId: string;
  
  offerAmount: number;
  status: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'countered';
  submittedAt: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Consultancy Industry Collections
export interface Discovery {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  
  discoveryType: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  findings?: string;
  completedDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Engagement {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  
  engagementName: string;
  engagementType: string;
  status: 'proposal' | 'active' | 'on_hold' | 'completed';
  startDate: Timestamp;
  endDate?: Timestamp;
  value: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Milestone {
  id: string;
  organizationId: string;
  workspaceId: string;
  engagementId: string;
  
  milestoneName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  dueDate: Timestamp;
  completedDate?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Industry Context Provider

```typescript
// Industry Context for React Components
export interface IndustryContext {
  industry: IndustryVertical;
  terminology: TerminologyMap;
  features: FeatureGate;
  pipelineTemplate: PipelineTemplate;
  contactTypes: string[];
}

export interface TerminologyMap {
  entitySingular: string; // "Account" | "School" | "Client"
  entityPlural: string; // "Accounts" | "Schools" | "Clients"
  personSingular: string; // "User" | "Student" | "Contact"
  personPlural: string; // "Users" | "Students" | "Contacts"
  pipelineName: string; // "Customer Pipeline" | "Admissions Pipeline"
  // ... additional terminology mappings
}

export interface FeatureGate {
  trials: boolean;
  onboarding: boolean;
  subscriptions: boolean;
  applications: boolean;
  enrollments: boolean;
  matters: boolean;
  campaigns: boolean;
  properties: boolean;
  engagements: boolean;
  // ... additional feature flags
}

export interface PipelineTemplate {
  name: string;
  stages: {
    name: string;
    order: number;
    color: string;
  }[];
}

// Industry Configuration Registry
export const INDUSTRY_CONFIG: Record<IndustryVertical, IndustryContext> = {
  SaaS: {
    industry: 'SaaS',
    terminology: {
      entitySingular: 'Account',
      entityPlural: 'Accounts',
      personSingular: 'User',
      personPlural: 'Users',
      pipelineName: 'Customer Pipeline',
    },
    features: {
      trials: true,
      onboarding: true,
      subscriptions: true,
      applications: false,
      enrollments: false,
      matters: false,
      campaigns: false,
      properties: false,
      engagements: false,
    },
    pipelineTemplate: {
      name: 'Customer Pipeline',
      stages: [
        { name: 'Lead', order: 1, color: '#gray' },
        { name: 'Trial', order: 2, color: '#blue' },
        { name: 'Onboarding', order: 3, color: '#yellow' },
        { name: 'Active', order: 4, color: '#green' },
        { name: 'Renewal', order: 5, color: '#purple' },
        { name: 'Churned', order: 6, color: '#red' },
      ],
    },
    contactTypes: ['Admin', 'Manager', 'User', 'Billing Contact'],
  },
  SchoolEnrollment: {
    industry: 'SchoolEnrollment',
    terminology: {
      entitySingular: 'School',
      entityPlural: 'Schools',
      personSingular: 'Student',
      personPlural: 'Students',
      pipelineName: 'Admissions Pipeline',
    },
    features: {
      trials: false,
      onboarding: false,
      subscriptions: false,
      applications: true,
      enrollments: true,
      matters: false,
      campaigns: false,
      properties: false,
      engagements: false,
    },
    pipelineTemplate: {
      name: 'Admissions Pipeline',
      stages: [
        { name: 'Enquiry', order: 1, color: '#gray' },
        { name: 'Application', order: 2, color: '#blue' },
        { name: 'Review', order: 3, color: '#yellow' },
        { name: 'Accepted', order: 4, color: '#green' },
        { name: 'Enrolled', order: 5, color: '#purple' },
      ],
    },
    contactTypes: ['Principal', 'Administrator', 'Accountant', 'School Owner'],
  },
  // ... configurations for Law, Marketing, RealEstate, Consultancy
};
```

### Component Architecture

```typescript
// Industry-Aware Component Pattern
export function EntityList() {
  const { workspace } = useWorkspace();
  const industryContext = INDUSTRY_CONFIG[workspace.industry];
  
  return (
    <div>
      <h1>{industryContext.terminology.entityPlural}</h1>
      <EntityTable 
        terminology={industryContext.terminology}
        features={industryContext.features}
      />
    </div>
  );
}

// Industry-Specific Component Router
export function IndustryFeaturePanel() {
  const { workspace } = useWorkspace();
  
  switch (workspace.industry) {
    case 'SaaS':
      return <SaaSFeaturePanel />;
    case 'SchoolEnrollment':
      return <SchoolEnrollmentFeaturePanel />;
    case 'Law':
      return <LawFeaturePanel />;
    case 'Marketing':
      return <MarketingFeaturePanel />;
    case 'RealEstate':
      return <RealEstateFeaturePanel />;
    case 'Consultancy':
      return <ConsultancyFeaturePanel />;
    default:
      return <DefaultFeaturePanel />;
  }
}

// Industry-Specific Sidebar
export function AppSidebar() {
  const { workspace } = useWorkspace();
  const industryContext = INDUSTRY_CONFIG[workspace.industry];
  
  const sidebarItems = getSidebarItemsForIndustry(workspace.industry);
  
  return (
    <Sidebar>
      {sidebarItems.map(item => (
        <SidebarItem 
          key={item.key}
          label={item.label}
          icon={item.icon}
          href={item.href}
        />
      ))}
    </Sidebar>
  );
}

function getSidebarItemsForIndustry(industry: IndustryVertical) {
  const baseItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
  ];
  
  const industryItems: Record<IndustryVertical, any[]> = {
    SaaS: [
      { key: 'accounts', label: 'Accounts', icon: 'Building2', href: '/accounts' },
      { key: 'users', label: 'Users', icon: 'Users', href: '/users' },
      { key: 'trials', label: 'Trials', icon: 'TestTube', href: '/trials' },
      { key: 'subscriptions', label: 'Subscriptions', icon: 'CreditCard', href: '/subscriptions' },
      { key: 'health', label: 'Health', icon: 'Heart', href: '/health' },
      { key: 'support', label: 'Support', icon: 'LifeBuoy', href: '/support' },
    ],
    SchoolEnrollment: [
      { key: 'schools', label: 'Schools', icon: 'School', href: '/schools' },
      { key: 'families', label: 'Families', icon: 'Users', href: '/families' },
      { key: 'pipeline', label: 'Pipeline', icon: 'GitBranch', href: '/pipeline' },
      { key: 'admissions', label: 'Admissions', icon: 'FileText', href: '/admissions' },
      { key: 'enrollments', label: 'Enrollments', icon: 'UserCheck', href: '/enrollments' },
    ],
    // ... other industries
  };
  
  return [...baseItems, ...industryItems[industry]];
}
```

## Data Models

### Entity Data Model Evolution

```
Current Model (Legacy):
┌─────────────────────────────────────┐
│         schools collection          │
│  - id                               │
│  - name                             │
│  - nominalRoll (company size)       │
│  - subscriptionPackage (plan)       │
│  - modules (features)               │
│  - implementationDate (signup)      │
│  - billing fields                   │
│  - workspaceIds[]                   │
└─────────────────────────────────────┘

New Model (Industry-Scoped):
┌─────────────────────────────────────┐
│        entities collection          │
│  - id                               │
│  - organizationId                   │
│  - entityType                       │
│  - industry (optional)              │
│  - name                             │
│  - email, phone, address            │
│  - status                           │
│  - industryData (polymorphic)       │
│  - migrationStatus                  │
│  - legacySchoolId                   │
└─────────────────────────────────────┘
         │
         ├─────────────────────────────┐
         │                             │
┌────────▼──────────┐    ┌─────────────▼────────────┐
│ workspace_entities│    │ Industry Collections     │
│  - workspaceId    │    │  - trials                │
│  - entityId       │    │  - subscriptions         │
│  - pipelineStage  │    │  - applications          │
│  - tags           │    │  - matters               │
│  - assignedTo     │    │  - campaigns             │
└───────────────────┘    │  - properties            │
                         │  - engagements           │
                         └──────────────────────────┘
```

### Polymorphic Industry Data Pattern

```typescript
// Type-safe industry data access using discriminated unions
function getIndustryData(entity: Entity): IndustryData | undefined {
  return entity.industryData;
}

function isSaaSInstitution(data: IndustryData): data is SaaSInstitutionData {
  return data.industry === 'SaaS' && data.entityType === 'institution';
}

// Usage with type narrowing
const entity = await getEntity(entityId);
if (entity.industryData && isSaaSInstitution(entity.industryData)) {
  // TypeScript knows this is SaaSInstitutionData
  console.log(entity.industryData.companySize);
  console.log(entity.industryData.planType);
  console.log(entity.industryData.accountStatus);
}
```

### Data Validation Schemas

```typescript
import { z } from 'zod';

// SaaS Institution Data Schema
export const SaaSInstitutionDataSchema = z.object({
  industry: z.literal('SaaS'),
  entityType: z.literal('institution'),
  companySize: z.number().positive(),
  planType: z.string().min(1),
  features: z.array(z.string()),
  signupDate: z.instanceof(Timestamp),
  billingAddress: AddressSchema.optional(),
  currency: z.string().optional(),
  subscriptionRate: z.number().positive().optional(),
  accountStatus: z.enum(['lead', 'trial', 'active', 'suspended', 'churned']),
  renewalDate: z.instanceof(Timestamp).optional(),
  customerTier: z.enum(['basic', 'pro', 'enterprise']).optional(),
  trialIds: z.array(z.string()).optional(),
  onboardingIds: z.array(z.string()).optional(),
  subscriptionIds: z.array(z.string()).optional(),
  supportTicketIds: z.array(z.string()).optional(),
  healthScoreIds: z.array(z.string()).optional(),
});

// School Enrollment Institution Data Schema
export const SchoolEnrollmentInstitutionDataSchema = z.object({
  industry: z.literal('SchoolEnrollment'),
  entityType: z.literal('institution'),
  gradeOfferings: z.array(z.string()).min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  enrollmentCapacity: z.number().positive().optional(),
  currentEnrollment: z.number().nonnegative().optional(),
  applicationIds: z.array(z.string()).optional(),
  enrollmentIds: z.array(z.string()).optional(),
  schoolVisitIds: z.array(z.string()).optional(),
});

// Polymorphic Industry Data Schema
export const IndustryDataSchema = z.discriminatedUnion('industry', [
  SaaSInstitutionDataSchema,
  SchoolEnrollmentInstitutionDataSchema,
  LawInstitutionDataSchema,
  MarketingInstitutionDataSchema,
  RealEstateInstitutionDataSchema,
  ConsultancyInstitutionDataSchema,
  SaaSPersonDataSchema,
  LawPersonDataSchema,
  MarketingPersonDataSchema,
  RealEstatePersonDataSchema,
  ConsultancyPersonDataSchema,
]);

// Entity Schema with Industry Data
export const EntitySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  entityType: z.enum(['institution', 'family', 'person']),
  industry: z.enum(['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy']).optional(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: AddressSchema.optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  industryData: IndustryDataSchema.optional(),
  migrationStatus: z.enum(['legacy', 'migrated', 'dual-write']).optional(),
  legacySchoolId: z.string().optional(),
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});
```

### Firestore Collection Structure

```
organizations/
  {organizationId}/
    - name, industry, logo, etc.

workspaces/
  {workspaceId}/
    - organizationId
    - industry (immutable after first entity link)
    - industryScopeLocked
    - contactScope

entities/
  {entityId}/
    - organizationId
    - entityType
    - industry
    - name, email, phone, address
    - industryData (polymorphic)
    - migrationStatus
    - legacySchoolId

workspace_entities/
  {workspaceEntityId}/
    - organizationId
    - workspaceId
    - entityId
    - pipelineStage
    - tags
    - assignedTo
    - addedAt

schools/ (legacy - maintained during migration)
  {schoolId}/
    - name
    - nominalRoll
    - subscriptionPackage
    - modules
    - implementationDate
    - billing fields
    - workspaceIds[]

// Industry-Specific Collections (SaaS)
trials/
  {trialId}/
    - organizationId, workspaceId, entityId
    - trialStartDate, trialEndDate
    - trialStatus

onboarding/
  {onboardingId}/
    - organizationId, workspaceId, entityId
    - onboardingStatus
    - activationMilestones[]

subscriptions/
  {subscriptionId}/
    - organizationId, workspaceId, entityId
    - planType, billingCycle
    - amount, currency
    - status, startDate, renewalDate

supportTickets/
  {ticketId}/
    - organizationId, workspaceId, entityId
    - issueType, priority, status
    - resolutionTime, satisfactionRating

healthScores/
  {healthScoreId}/
    - organizationId, workspaceId, entityId
    - overallScore, usageScore, supportScore
    - churnRisk

// Industry-Specific Collections (School Enrollment)
applications/
  {applicationId}/
    - organizationId, workspaceId, entityId
    - studentName, gradeApplying
    - applicationStatus

enrollments/
  {enrollmentId}/
    - organizationId, workspaceId, entityId
    - studentName, grade, academicYear
    - enrollmentStatus

schoolVisits/
  {schoolVisitId}/
    - organizationId, workspaceId, entityId
    - visitDate, visitType, status

// Industry-Specific Collections (Law)
matters/
  {matterId}/
    - organizationId, workspaceId, entityId
    - matterNumber, matterType, practiceArea
    - status

conflictChecks/
  {conflictCheckId}/
    - organizationId, workspaceId, entityId
    - checkStatus, conflictDetails

timeTracking/
  {timeTrackingId}/
    - organizationId, workspaceId, entityId, matterId
    - userId, hours, billableRate

// Industry-Specific Collections (Marketing)
campaigns/
  {campaignId}/
    - organizationId, workspaceId, entityId
    - campaignName, campaignType, status
    - budget, startDate, endDate

deliverables/
  {deliverableId}/
    - organizationId, workspaceId, entityId, campaignId
    - deliverableName, deliverableType, status

// Industry-Specific Collections (Real Estate)
properties/
  {propertyId}/
    - organizationId, workspaceId, entityId
    - propertyType, address, price, status

viewings/
  {viewingId}/
    - organizationId, workspaceId, propertyId, clientEntityId
    - viewingDate, status, feedback

offers/
  {offerId}/
    - organizationId, workspaceId, propertyId, buyerEntityId
    - offerAmount, status

// Industry-Specific Collections (Consultancy)
discoveries/
  {discoveryId}/
    - organizationId, workspaceId, entityId
    - discoveryType, status, findings

engagements/
  {engagementId}/
    - organizationId, workspaceId, entityId
    - engagementName, engagementType, status
    - startDate, endDate, value

milestones/
  {milestoneId}/
    - organizationId, workspaceId, engagementId
    - milestoneName, status, dueDate
```

