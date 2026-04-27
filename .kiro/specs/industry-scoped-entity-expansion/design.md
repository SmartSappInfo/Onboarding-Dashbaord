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

test
## Migration Strategy

### Migration Phases

The migration follows a 4-phase approach to ensure zero downtime and full rollback capability.

**Phase 1: Audit & Preparation**
- Read all existing `schools` collection documents
- Read all existing `entities` with `entityType: institution`
- Identify SaaS-specific fields: `nominalRoll`, `subscriptionPackage`, `modules`, `implementationDate`, billing fields
- Validate data integrity and flag anomalies
- Create full Firestore backup before proceeding

**Phase 2: Schema Extension**
- Add `industry` field to `Workspace` interface (default: `'SaaS'`)
- Add `industryData` polymorphic field to `Entity` interface
- Create all industry-specific TypeScript interfaces
- Deploy updated Firestore security rules
- Create composite indexes for new query patterns

**Phase 3: Data Transformation**
- Update all existing `workspaces` with `industry: 'SaaS'`
- Transform existing `InstitutionData` → `SaaSInstitutionData`:
  - `nominalRoll` → `companySize`
  - `subscriptionPackage` → `planType`
  - `modules` → `features`
  - `implementationDate` → `signupDate`
- Set `accountStatus: 'active'` as default for existing accounts
- Set `migrationStatus: 'dual-write'` on all transformed entities
- Write to both `schools` (legacy) and `entities` (new) simultaneously

**Phase 4: Validation & Cutover**
- Validate all relationships post-migration
- Run data integrity checks across all collections
- Switch `migrationStatus` from `'dual-write'` to `'migrated'`
- Create migration audit logs
- Keep `schools` collection intact for 90-day rollback window

### Dual-Read Adapter Pattern

```typescript
// src/lib/contact-adapter.ts (extended)
export async function getEntity(
  entityId: string,
  workspaceId: string
): Promise<Entity> {
  const workspaceEntity = await getWorkspaceEntity(workspaceId, entityId);
  
  if (!workspaceEntity) throw new Error('Entity not found');
  
  const migrationStatus = workspaceEntity.migrationStatus ?? 'legacy';
  
  switch (migrationStatus) {
    case 'legacy':
      // Read from schools collection, map to Entity shape
      return await readFromLegacySchools(workspaceEntity.legacySchoolId!);
    case 'dual-write':
      // Read from entities, fall back to schools on error
      try {
        return await readFromEntities(entityId);
      } catch {
        return await readFromLegacySchools(workspaceEntity.legacySchoolId!);
      }
    case 'migrated':
      return await readFromEntities(entityId);
  }
}

function mapSchoolToSaaSEntity(school: LegacySchool): Entity {
  return {
    id: school.id,
    organizationId: school.organizationId,
    entityType: 'institution',
    industry: 'SaaS',
    name: school.name,
    email: school.email,
    phone: school.phone,
    status: school.status ?? 'active',
    migrationStatus: 'legacy',
    legacySchoolId: school.id,
    industryData: {
      industry: 'SaaS',
      entityType: 'institution',
      companySize: school.nominalRoll ?? 0,
      planType: school.subscriptionPackage ?? '',
      features: school.modules ?? [],
      signupDate: school.implementationDate,
      accountStatus: 'active',
      billingAddress: school.billingAddress,
      currency: school.currency,
      subscriptionRate: school.subscriptionRate,
    } as SaaSInstitutionData,
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
  };
}
```

### Rollback Strategy

```typescript
// Migration rollback: revert workspace industry lock
async function rollbackMigration(workspaceId: string): Promise<void> {
  const batch = db.batch();
  
  // Reset workspace migration state
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  batch.update(workspaceRef, {
    industryScopeLocked: false,
    industryScopeLockedAt: null,
  });
  
  // Revert entity migration status to legacy
  const entities = await db.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .get();
  
  entities.docs.forEach(doc => {
    batch.update(doc.ref, { migrationStatus: 'legacy' });
  });
  
  await batch.commit();
  
  // Log rollback event
  await logActivity({
    type: 'migration_rolled_back',
    workspaceId,
    timestamp: Timestamp.now(),
  });
}
```


## API Design

### Industry-Aware Server Actions

```typescript
// src/lib/entity-actions.ts (extended)

export async function createEntity(
  params: CreateEntityParams,
  workspaceId: string
): Promise<Entity> {
  const workspace = await getWorkspace(workspaceId);
  
  // Validate industry data matches workspace industry
  if (params.industryData) {
    validateIndustryData(params.industryData, workspace.industry);
  }
  
  // Inject industry from workspace
  const entity: Omit<Entity, 'id'> = {
    ...params,
    industry: workspace.industry,
    organizationId: workspace.organizationId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const ref = await db.collection('entities').add(entity);
  
  // Lock workspace scope after first entity
  if (!workspace.industryScopeLocked) {
    await lockWorkspaceScope(workspaceId);
  }
  
  // Log activity with industry context
  await logActivity({
    type: 'entity_created',
    entityId: ref.id,
    workspaceId,
    industry: workspace.industry,
    timestamp: Timestamp.now(),
  });
  
  return { id: ref.id, ...entity };
}

function validateIndustryData(
  data: IndustryData,
  workspaceIndustry: IndustryVertical
): void {
  if (data.industry !== workspaceIndustry) {
    throw new Error(
      `Industry data mismatch: expected ${workspaceIndustry}, got ${data.industry}`
    );
  }
  
  // Validate using Zod schema
  const result = IndustryDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid industry data: ${result.error.message}`);
  }
}
```

### Industry-Specific Collection Actions

```typescript
// src/lib/saas-actions.ts (NEW)

export async function createTrial(
  params: CreateTrialParams,
  workspaceId: string
): Promise<Trial> {
  const workspace = await getWorkspace(workspaceId);
  
  // Validate workspace industry
  if (workspace.industry !== 'SaaS') {
    throw new Error('Trials are only available for SaaS workspaces');
  }
  
  const trial: Omit<Trial, 'id'> = {
    ...params,
    organizationId: workspace.organizationId,
    workspaceId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const ref = await db.collection('trials').add(trial);
  
  // Update entity with trial reference
  await db.collection('entities').doc(params.entityId).update({
    'industryData.trialIds': FieldValue.arrayUnion(ref.id),
  });
  
  return { id: ref.id, ...trial };
}

export async function getTrialsForEntity(
  entityId: string,
  workspaceId: string
): Promise<Trial[]> {
  const snapshot = await db.collection('trials')
    .where('workspaceId', '==', workspaceId)
    .where('entityId', '==', entityId)
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trial));
}
```

### API Versioning

```typescript
// src/app/api/v2/entities/route.ts (NEW)

export async function POST(request: Request) {
  const { workspaceId, ...params } = await request.json();
  
  // V2 API includes industry context in response
  const entity = await createEntity(params, workspaceId);
  
  return Response.json({
    data: entity,
    meta: {
      industry: entity.industry,
      version: 'v2',
    },
  });
}

// src/app/api/v1/schools/route.ts (LEGACY - maintained for backward compatibility)

export async function POST(request: Request) {
  const params = await request.json();
  
  // V1 API maintains legacy "schools" terminology
  // Internally maps to SaaS entities
  const entity = await createEntity(
    {
      ...params,
      entityType: 'institution',
      industryData: mapLegacySchoolToSaaSData(params),
    },
    params.workspaceId
  );
  
  // Return in legacy format
  return Response.json(mapEntityToLegacySchool(entity));
}
```

## Security & Data Isolation

### Firestore Security Rules

```javascript
// firestore.rules (extended)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function belongsToOrganization(orgId) {
      return isAuthenticated() && 
             request.auth.token.organizationId == orgId;
    }
    
    function hasWorkspaceAccess(workspaceId) {
      return isAuthenticated() &&
             exists(/databases/$(database)/documents/workspace_members/$(workspaceId + '_' + request.auth.uid));
    }
    
    function workspaceIndustryMatches(workspaceId, industry) {
      let workspace = get(/databases/$(database)/documents/workspaces/$(workspaceId));
      return workspace.data.industry == industry;
    }
    
    // Entities collection
    match /entities/{entityId} {
      allow read: if belongsToOrganization(resource.data.organizationId);
      allow create: if belongsToOrganization(request.resource.data.organizationId);
      allow update, delete: if belongsToOrganization(resource.data.organizationId);
    }
    
    // Workspace entities
    match /workspace_entities/{workspaceEntityId} {
      allow read: if hasWorkspaceAccess(resource.data.workspaceId);
      allow create: if hasWorkspaceAccess(request.resource.data.workspaceId);
      allow update, delete: if hasWorkspaceAccess(resource.data.workspaceId);
    }
    
    // Industry-specific collections (SaaS)
    match /trials/{trialId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'SaaS');
    }
    
    match /subscriptions/{subscriptionId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'SaaS');
    }
    
    // Industry-specific collections (School Enrollment)
    match /applications/{applicationId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'SchoolEnrollment');
    }
    
    // Industry-specific collections (Law)
    match /matters/{matterId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'Law');
    }
    
    // Industry-specific collections (Marketing)
    match /campaigns/{campaignId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'Marketing');
    }
    
    // Industry-specific collections (Real Estate)
    match /properties/{propertyId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'RealEstate');
    }
    
    // Industry-specific collections (Consultancy)
    match /engagements/{engagementId} {
      allow read, write: if hasWorkspaceAccess(resource.data.workspaceId) &&
                            workspaceIndustryMatches(resource.data.workspaceId, 'Consultancy');
    }
  }
}
```

### Permission System

```typescript
// src/lib/permissions.ts (extended)

export type Permission =
  // Generic permissions
  | 'contacts_view'
  | 'contacts_edit'
  | 'contacts_create'
  | 'contacts_delete'
  | 'pipeline_view'
  | 'pipeline_manage'
  | 'finance_view'
  | 'finance_manage'
  // SaaS permissions
  | 'saas_trials_manage'
  | 'saas_usage_view'
  | 'saas_health_view'
  // School Enrollment permissions
  | 'schoolenrollment_admissions_manage'
  | 'schoolenrollment_enrollments_manage'
  // Law permissions
  | 'law_matters_manage'
  | 'law_conflict_check'
  | 'law_time_tracking'
  // Marketing permissions
  | 'marketing_campaigns_manage'
  | 'marketing_reports_view'
  // Real Estate permissions
  | 'realestate_properties_manage'
  | 'realestate_viewings_manage'
  // Consultancy permissions
  | 'consultancy_engagements_manage'
  | 'consultancy_outcomes_view';

export function getIndustryPermissions(industry: IndustryVertical): Permission[] {
  const basePermissions: Permission[] = [
    'contacts_view',
    'contacts_edit',
    'contacts_create',
    'contacts_delete',
    'pipeline_view',
    'pipeline_manage',
  ];
  
  const industryPermissions: Record<IndustryVertical, Permission[]> = {
    SaaS: ['saas_trials_manage', 'saas_usage_view', 'saas_health_view'],
    SchoolEnrollment: ['schoolenrollment_admissions_manage', 'schoolenrollment_enrollments_manage'],
    Law: ['law_matters_manage', 'law_conflict_check', 'law_time_tracking'],
    Marketing: ['marketing_campaigns_manage', 'marketing_reports_view'],
    RealEstate: ['realestate_properties_manage', 'realestate_viewings_manage'],
    Consultancy: ['consultancy_engagements_manage', 'consultancy_outcomes_view'],
  };
  
  return [...basePermissions, ...industryPermissions[industry]];
}

export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<boolean> {
  const workspace = await getWorkspace(workspaceId);
  const userRole = await getUserRole(userId, workspaceId);
  
  // Get industry-specific permissions for this workspace
  const allowedPermissions = getIndustryPermissions(workspace.industry);
  
  // Check if permission is valid for this industry
  if (!allowedPermissions.includes(permission)) {
    return false;
  }
  
  // Check role-based access
  return roleHasPermission(userRole, permission);
}
```


## Performance Optimization

### Composite Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "entityType", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "industry", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workspace_entities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityType", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "addedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workspaces",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "industry", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "trials",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "trialStatus", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "matters",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "campaigns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workspaceId", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Caching Strategy

```typescript
// src/lib/industry-cache.ts

const INDUSTRY_CONFIG_TTL = 5 * 60 * 1000; // 5 minutes
const WORKSPACE_INDUSTRY_TTL = 10 * 60 * 1000; // 10 minutes

// LRU cache for workspace industry lookups
const workspaceIndustryCache = new Map<string, {
  industry: IndustryVertical;
  expiresAt: number;
}>();

export async function getWorkspaceIndustry(
  workspaceId: string
): Promise<IndustryVertical> {
  const cached = workspaceIndustryCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.industry;
  }

  const workspace = await getWorkspace(workspaceId);
  workspaceIndustryCache.set(workspaceId, {
    industry: workspace.industry,
    expiresAt: Date.now() + WORKSPACE_INDUSTRY_TTL,
  });

  return workspace.industry;
}

// Invalidate cache when workspace is updated
export function invalidateWorkspaceCache(workspaceId: string): void {
  workspaceIndustryCache.delete(workspaceId);
}
```

### Pagination for Industry Collections

```typescript
// src/lib/industry-actions.ts

export async function getIndustryCollectionPage<T>(
  collection: string,
  workspaceId: string,
  options: {
    pageSize?: number;
    cursor?: string;
    orderBy?: string;
    filters?: Record<string, unknown>;
  } = {}
): Promise<{ items: T[]; nextCursor: string | null }> {
  const { pageSize = 100, cursor, orderBy = 'createdAt', filters = {} } = options;

  let query = db.collection(collection)
    .where('workspaceId', '==', workspaceId);

  // Apply additional filters
  for (const [field, value] of Object.entries(filters)) {
    query = query.where(field, '==', value);
  }

  query = query.orderBy(orderBy, 'desc').limit(pageSize + 1);

  if (cursor) {
    const cursorDoc = await db.collection(collection).doc(cursor).get();
    query = query.startAfter(cursorDoc);
  }

  const snapshot = await query.get();
  const items = snapshot.docs.slice(0, pageSize).map(
    doc => ({ id: doc.id, ...doc.data() } as T)
  );
  const nextCursor = snapshot.docs.length > pageSize
    ? snapshot.docs[pageSize - 1].id
    : null;

  return { items, nextCursor };
}
```

### Lazy Loading for Industry-Specific Data

```typescript
// Industry data is loaded on-demand, not with the entity list
// Entity list returns core fields only; industryData fetched on detail view

export async function getEntityList(
  workspaceId: string,
  options: PaginationOptions
): Promise<EntitySummary[]> {
  // Returns only core fields — no industryData
  const snapshot = await db.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .orderBy('addedAt', 'desc')
    .limit(options.pageSize)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.data().entityId,
    name: doc.data().name,
    status: doc.data().status,
    pipelineStage: doc.data().pipelineStage,
    // industryData NOT included here
  }));
}

export async function getEntityDetail(entityId: string): Promise<Entity> {
  // Full entity including industryData — only called on detail view
  const doc = await db.collection('entities').doc(entityId).get();
  return { id: doc.id, ...doc.data() } as Entity;
}
```

## Testing Strategy

### Property-Based Tests for Industry Data Validation

```typescript
// src/lib/__tests__/industry-validation.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { IndustryDataSchema, SaaSInstitutionDataSchema } from '@/lib/types';

describe('Industry Data Validation - Property Tests', () => {
  it('SaaSInstitutionData: companySize must always be positive', () => {
    fc.assert(
      fc.property(
        fc.record({
          industry: fc.constant('SaaS'),
          entityType: fc.constant('institution'),
          companySize: fc.integer({ min: -1000, max: 0 }),
          planType: fc.string({ minLength: 1 }),
          features: fc.array(fc.string()),
          signupDate: fc.constant(new Date()),
          accountStatus: fc.constantFrom('lead', 'trial', 'active', 'suspended', 'churned'),
        }),
        (data) => {
          const result = SaaSInstitutionDataSchema.safeParse(data);
          expect(result.success).toBe(false);
        }
      )
    );
  });

  it('Industry data industry field must match workspace industry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'),
        fc.constantFrom('SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'),
        (dataIndustry, workspaceIndustry) => {
          if (dataIndustry !== workspaceIndustry) {
            expect(() =>
              validateIndustryData({ industry: dataIndustry } as any, workspaceIndustry)
            ).toThrow();
          }
        }
      )
    );
  });

  it('SchoolEnrollmentInstitutionData: gradeOfferings must be non-empty', () => {
    fc.assert(
      fc.property(
        fc.record({
          industry: fc.constant('SchoolEnrollment'),
          entityType: fc.constant('institution'),
          gradeOfferings: fc.constant([]),
          academicYear: fc.constant('2024-2025'),
        }),
        (data) => {
          const result = IndustryDataSchema.safeParse(data);
          expect(result.success).toBe(false);
        }
      )
    );
  });
});
```

### Unit Tests for Industry Modules

```typescript
// src/lib/__tests__/industry-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEntity, validateIndustryData } from '@/lib/entity-actions';

describe('createEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects industryData that does not match workspace industry', async () => {
    const mockWorkspace = { industry: 'SaaS', industryScopeLocked: false };
    vi.mocked(getWorkspace).mockResolvedValue(mockWorkspace);

    await expect(
      createEntity(
        {
          name: 'Test',
          entityType: 'institution',
          industryData: { industry: 'Law', entityType: 'institution' } as any,
        },
        'workspace-1'
      )
    ).rejects.toThrow('Industry data mismatch');
  });

  it('locks workspace scope after first entity creation', async () => {
    const mockWorkspace = { industry: 'SaaS', industryScopeLocked: false };
    vi.mocked(getWorkspace).mockResolvedValue(mockWorkspace);
    const lockSpy = vi.mocked(lockWorkspaceScope);

    await createEntity({ name: 'Test', entityType: 'institution' }, 'workspace-1');

    expect(lockSpy).toHaveBeenCalledWith('workspace-1');
  });

  it('does not re-lock already locked workspace', async () => {
    const mockWorkspace = { industry: 'SaaS', industryScopeLocked: true };
    vi.mocked(getWorkspace).mockResolvedValue(mockWorkspace);
    const lockSpy = vi.mocked(lockWorkspaceScope);

    await createEntity({ name: 'Test', entityType: 'institution' }, 'workspace-1');

    expect(lockSpy).not.toHaveBeenCalled();
  });
});

describe('Terminology mapping', () => {
  it('returns "Accounts" for SaaS industry', () => {
    const config = INDUSTRY_CONFIG['SaaS'];
    expect(config.terminology.entityPlural).toBe('Accounts');
  });

  it('returns "Schools" for SchoolEnrollment industry', () => {
    const config = INDUSTRY_CONFIG['SchoolEnrollment'];
    expect(config.terminology.entityPlural).toBe('Schools');
  });

  it('returns "Clients" for Law industry', () => {
    const config = INDUSTRY_CONFIG['Law'];
    expect(config.terminology.entityPlural).toBe('Clients');
  });
});
```

### Integration Tests

```typescript
// src/lib/__tests__/industry-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Industry Data Isolation', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: { rules: firestoreRules },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('SaaS workspace cannot access Law matters collection', async () => {
    const saasUser = testEnv.authenticatedContext('user-1', {
      organizationId: 'org-1',
    });

    // Attempt to read matters from a Law workspace
    await expect(
      saasUser.firestore()
        .collection('matters')
        .where('workspaceId', '==', 'law-workspace-1')
        .get()
    ).rejects.toThrow();
  });

  it('Entity creation triggers workspace scope lock', async () => {
    const workspace = await createWorkspace({ industry: 'Marketing' });
    expect(workspace.industryScopeLocked).toBe(false);

    await createEntity({ name: 'Client A', entityType: 'institution' }, workspace.id);

    const updated = await getWorkspace(workspace.id);
    expect(updated.industryScopeLocked).toBe(true);
  });

  it('Dual-read adapter falls back to legacy schools on entity read failure', async () => {
    const legacySchool = await createLegacySchool({ name: 'Test School' });
    const entity = await getEntity(legacySchool.id, 'workspace-1');

    expect(entity.name).toBe('Test School');
    expect(entity.industry).toBe('SaaS');
    expect(entity.migrationStatus).toBe('legacy');
  });
});
```

### E2E Tests

```typescript
// src/e2e/industry-workspace.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Industry Workspace Creation', () => {
  test('creates SaaS workspace and shows Accounts terminology', async ({ page }) => {
    await page.goto('/backoffice/workspaces/new');

    await page.selectOption('[data-testid="industry-select"]', 'SaaS');
    await page.fill('[data-testid="workspace-name"]', 'My SaaS Workspace');
    await page.click('[data-testid="create-workspace"]');

    await expect(page.locator('h1')).toContainText('Accounts');
    await expect(page.locator('[data-testid="sidebar-entities"]')).toContainText('Accounts');
  });

  test('creates SchoolEnrollment workspace and shows Schools terminology', async ({ page }) => {
    await page.goto('/backoffice/workspaces/new');

    await page.selectOption('[data-testid="industry-select"]', 'SchoolEnrollment');
    await page.fill('[data-testid="workspace-name"]', 'Admissions Workspace');
    await page.click('[data-testid="create-workspace"]');

    await expect(page.locator('h1')).toContainText('Schools');
    await expect(page.locator('[data-testid="sidebar-entities"]')).toContainText('Schools');
  });

  test('prevents industry change after first entity is linked', async ({ page }) => {
    await page.goto('/workspace/saas-workspace-1/settings');

    const industrySelect = page.locator('[data-testid="industry-select"]');
    await expect(industrySelect).toBeDisabled();
    await expect(page.locator('[data-testid="scope-lock-notice"]')).toBeVisible();
  });
});
```

## Deployment Strategy

### Feature Flags

```typescript
// src/lib/feature-flags.ts

export const INDUSTRY_FEATURE_FLAGS = {
  INDUSTRY_EXPANSION_ENABLED: process.env.NEXT_PUBLIC_INDUSTRY_EXPANSION === 'true',
  SAAS_INDUSTRY_ENABLED: true, // Always on (current system)
  MARKETING_INDUSTRY_ENABLED: process.env.NEXT_PUBLIC_MARKETING_INDUSTRY === 'true',
  SCHOOL_ENROLLMENT_INDUSTRY_ENABLED: process.env.NEXT_PUBLIC_SCHOOL_ENROLLMENT_INDUSTRY === 'true',
  CONSULTANCY_INDUSTRY_ENABLED: process.env.NEXT_PUBLIC_CONSULTANCY_INDUSTRY === 'true',
  REAL_ESTATE_INDUSTRY_ENABLED: process.env.NEXT_PUBLIC_REAL_ESTATE_INDUSTRY === 'true',
  LAW_INDUSTRY_ENABLED: process.env.NEXT_PUBLIC_LAW_INDUSTRY === 'true',
} as const;

export function getEnabledIndustries(): IndustryVertical[] {
  const enabled: IndustryVertical[] = ['SaaS']; // Always enabled

  if (INDUSTRY_FEATURE_FLAGS.MARKETING_INDUSTRY_ENABLED) enabled.push('Marketing');
  if (INDUSTRY_FEATURE_FLAGS.SCHOOL_ENROLLMENT_INDUSTRY_ENABLED) enabled.push('SchoolEnrollment');
  if (INDUSTRY_FEATURE_FLAGS.CONSULTANCY_INDUSTRY_ENABLED) enabled.push('Consultancy');
  if (INDUSTRY_FEATURE_FLAGS.REAL_ESTATE_INDUSTRY_ENABLED) enabled.push('RealEstate');
  if (INDUSTRY_FEATURE_FLAGS.LAW_INDUSTRY_ENABLED) enabled.push('Law');

  return enabled;
}
```

### Phased Rollout Plan

| Phase | Industry | Env Var | Timeline |
|-------|----------|---------|----------|
| 1 | SaaS (current) | Always on | Immediate |
| 2 | Marketing | `NEXT_PUBLIC_MARKETING_INDUSTRY=true` | Sprint 2 |
| 3 | School Enrollment | `NEXT_PUBLIC_SCHOOL_ENROLLMENT_INDUSTRY=true` | Sprint 4 |
| 4 | Consultancy | `NEXT_PUBLIC_CONSULTANCY_INDUSTRY=true` | Sprint 6 |
| 5 | Real Estate | `NEXT_PUBLIC_REAL_ESTATE_INDUSTRY=true` | Sprint 8 |
| 6 | Law | `NEXT_PUBLIC_LAW_INDUSTRY=true` | Sprint 10 |

### Monitoring & Observability

```typescript
// src/lib/industry-monitoring.ts

// Sentry context enrichment for industry-specific errors
export function setIndustryContext(
  industry: IndustryVertical,
  workspaceId: string
): void {
  Sentry.setContext('industry', {
    vertical: industry,
    workspaceId,
  });

  Sentry.setTag('industry', industry);
}

// Industry-specific error messages
export function getIndustryErrorMessage(
  errorCode: string,
  industry: IndustryVertical
): string {
  const terminology = INDUSTRY_CONFIG[industry].terminology;

  const messages: Record<string, Record<IndustryVertical, string>> = {
    ENTITY_NOT_FOUND: {
      SaaS: `Account not found`,
      SchoolEnrollment: `School not found`,
      Law: `Client not found`,
      Marketing: `Client not found`,
      RealEstate: `Client not found`,
      Consultancy: `Client not found`,
    },
    ENTITY_CREATE_FAILED: {
      SaaS: `Failed to create account`,
      SchoolEnrollment: `Failed to create school`,
      Law: `Failed to create client`,
      Marketing: `Failed to create client`,
      RealEstate: `Failed to create client`,
      Consultancy: `Failed to create client`,
    },
  };

  return messages[errorCode]?.[industry] ?? `An error occurred`;
}

// Activity logging with industry context
export async function logIndustryActivity(params: {
  type: string;
  industry: IndustryVertical;
  workspaceId: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.collection('activities').add({
    ...params,
    timestamp: Timestamp.now(),
    source: 'system',
  });
}
```

## Correctness Properties

The following properties must hold at all times and are validated via property-based tests:

1. **Industry Immutability**: Once `industryScopeLocked` is `true` on a workspace, `workspace.industry` must never change.

2. **Industry Data Consistency**: For any entity `e`, if `e.industryData` is present, then `e.industryData.industry === e.industry` must always be true.

3. **Collection Access Isolation**: A user with access to workspace `W` of industry `I` must never be able to read documents from industry-specific collections belonging to a different industry `I'`.

4. **Terminology Completeness**: For every `IndustryVertical` value, `INDUSTRY_CONFIG[industry].terminology` must define all required keys (`entitySingular`, `entityPlural`, `personSingular`, `personPlural`, `pipelineName`).

5. **Migration Idempotency**: Running the migration script on an already-migrated entity must produce the same result as running it once — no data duplication or field corruption.

6. **Backward Compatibility**: Any entity with `migrationStatus: 'legacy'` must be readable via the adapter layer and return a valid `Entity` shape with `industry: 'SaaS'`.

7. **Scope Lock Trigger**: After the first entity is linked to a workspace, `industryScopeLocked` must be `true` on all subsequent reads of that workspace.

8. **Feature Gate Enforcement**: For any workspace of industry `I`, features not listed in `INDUSTRY_CONFIG[I].features` must return `false` from the feature gate, regardless of user role.

## Summary

This design document specifies the complete technical architecture for the industry-scoped entity expansion. The key design decisions are:

- **Polymorphic discriminated unions** for type-safe industry data with Zod validation
- **Workspace-scoped industry lock** enforced after first entity link, preventing accidental industry changes
- **Dual-read adapter** maintaining zero-downtime migration from legacy `schools` to `entities` model
- **Industry configuration registry** (`INDUSTRY_CONFIG`) as the single source of truth for terminology, features, pipelines, and sidebar navigation per industry
- **Feature flags** enabling phased rollout: SaaS → Marketing → School Enrollment → Consultancy → Real Estate → Law
- **Firestore security rules** enforcing industry-based collection access at the database level
- **Composite indexes** pre-defined for all industry-specific query patterns
- **Property-based tests** validating correctness invariants across all industry data models

