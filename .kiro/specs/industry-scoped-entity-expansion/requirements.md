# Requirements Document: Industry-Scoped Entity Expansion

## Introduction

This document specifies the requirements for expanding SmartSapp from a SaaS B2B CRM platform into a multi-industry vertical CRM system. The current system manages ~1000+ school accounts as B2B SaaS customers with features like subscription packages, billing, nominal roll (company size), and implementation tracking. This expansion will add five new industry verticals (School Enrollment, Law Firms, Marketing Agencies, Real Estate, Consultancy) while preserving the existing SaaS implementation.

**Current System Architecture**: SmartSapp is a SaaS platform where schools are B2B accounts. Current features (nominalRoll, subscriptionPackage, modules, billing, implementationDate) are SaaS account management features, NOT education-specific features.

**Implementation Priority**: SaaS (current system) → Marketing → School Enrollment → Consultancy → Real Estate → Law Firm. SaaS is prioritized because it represents the current production system that needs validation and completion.

The transformation introduces industry-specific data models, workflows, features, and UI adaptations while preserving the core unified entity architecture (entities + workspace_entities). Each workspace will be scoped to a single industry vertical, with industry-specific terminology, pipeline stages, and data fields.

## Glossary

- **Industry_Vertical**: One of six supported business domains (SaaS, School Enrollment, Law, Marketing, Real Estate, Consultancy)
- **SaaS_Industry**: The CURRENT system implementation managing B2B accounts (schools as SaaS customers)
- **School_Enrollment_Industry**: A NEW vertical for education institutions managing student admissions (separate from current SaaS implementation)
- **Workspace**: An operational partition within an organization, scoped to one Industry_Vertical
- **Entity**: A unified contact identity (institution, family, or person) with industry-agnostic core data
- **Industry_Data**: Polymorphic data structure containing industry-specific fields for an Entity
- **Contact_Scope**: The entity type a Workspace manages (institution, family, or person)
- **Scope_Lock**: Immutable constraint preventing Workspace contact_scope changes after first Entity link
- **Migration_Status**: Field tracking school-to-entity migration progress (legacy, migrated, dual-write)
- **Adapter_Layer**: Software component providing unified API across legacy and new data models
- **Pipeline**: A customizable workflow with stages for tracking Entity lifecycle
- **Stage**: A step within a Pipeline representing Entity status or progress
- **Global_Tag**: Identity-level tag visible across all Workspaces
- **Workspace_Tag**: Operational tag scoped to a single Workspace
- **Industry_Module**: Industry-specific feature set (e.g., Trial_Management for SaaS, Admissions_Management for School Enrollment)
- **Terminology_Map**: Industry-specific labels for UI elements (e.g., "Accounts" for SaaS vs "Schools" for School Enrollment vs "Clients" for Law)
- **Backoffice**: Platform control plane for organization and workspace management
- **Zero_Downtime**: Requirement that existing users experience no service interruption during migration
- **Backward_Compatibility**: Requirement that existing SaaS workspaces continue functioning without changes
- **SaaS_Account**: Current production entities representing schools as B2B customers (NOT education institutions)

## Requirements

### Requirement 1: Industry Vertical Support

**User Story:** As a platform administrator, I want to support multiple industry verticals, so that SmartSapp can serve diverse business domains beyond the current SaaS B2B model.

#### Acceptance Criteria

1. THE System SHALL support exactly six Industry_Verticals: SaaS, School Enrollment, Law, Marketing, Real Estate, Consultancy
2. WHEN an Organization is created, THE System SHALL allow optional Industry_Vertical selection at organization level
3. WHEN a Workspace is created, THE System SHALL require Industry_Vertical selection
4. THE System SHALL store Industry_Vertical as an immutable field on Workspace documents after first Entity link
5. THE System SHALL validate that Industry_Vertical is one of the six supported values
6. THE System SHALL prioritize implementation in order: SaaS (current) → Marketing → School Enrollment → Consultancy → Real Estate → Law

### Requirement 2: Workspace Industry Scoping

**User Story:** As a workspace administrator, I want my workspace scoped to a specific industry, so that I see industry-relevant features and terminology.

#### Acceptance Criteria

1. WHEN a Workspace is created, THE System SHALL require Industry_Vertical selection before Entity creation
2. THE System SHALL lock Workspace Industry_Vertical after first Entity is linked (Scope_Lock)
3. THE System SHALL prevent Industry_Vertical changes after Scope_Lock is enabled
4. THE System SHALL display industry-specific terminology in Workspace UI based on Industry_Vertical
5. THE System SHALL filter available features based on Workspace Industry_Vertical
6. WHEN Industry_Vertical is locked, THE System SHALL log workspace_scope_locked activity

### Requirement 3: Industry-Specific Data Models

**User Story:** As a developer, I want polymorphic industry data structures, so that each industry can store relevant fields without schema conflicts.

#### Acceptance Criteria

1. THE Entity interface SHALL include an optional industry field indicating Industry_Vertical
2. THE Entity interface SHALL support polymorphic Industry_Data fields for each Industry_Vertical
3. WHEN entityType is institution AND industry is SaaS, THE System SHALL store SaaSInstitutionData
4. WHEN entityType is institution AND industry is SchoolEnrollment, THE System SHALL store SchoolEnrollmentInstitutionData
5. WHEN entityType is institution AND industry is Law, THE System SHALL store LawInstitutionData
6. WHEN entityType is institution AND industry is Marketing, THE System SHALL store MarketingInstitutionData
7. WHEN entityType is institution AND industry is RealEstate, THE System SHALL store RealEstateInstitutionData
8. WHEN entityType is institution AND industry is Consultancy, THE System SHALL store ConsultancyInstitutionData
9. THE System SHALL validate Industry_Data structure matches declared Industry_Vertical
10. THE System SHALL audit existing InstitutionData fields against SaaS requirements to identify missing features


### Requirement 4: School Enrollment Industry Data Model

**User Story:** As an education administrator, I want comprehensive school enrollment data fields, so that I can manage student admissions and enrollment processes effectively.

#### Acceptance Criteria

1. THE SchoolEnrollmentInstitutionData interface SHALL include applications field for admission tracking
2. THE SchoolEnrollmentInstitutionData interface SHALL include enrollments field for student enrollment records
3. THE SchoolEnrollmentInstitutionData interface SHALL include schoolVisits field for tour scheduling
4. THE SchoolEnrollmentInstitutionData interface SHALL include conversionTracking for admissions funnel analytics
5. THE SchoolEnrollmentInstitutionData interface SHALL include gradeOfferings array for available grade levels
6. THE SchoolEnrollmentInstitutionData interface SHALL include academicYear field for enrollment cycle tracking
7. THE System SHALL support applications collection for admission tracking
8. THE System SHALL support enrollments collection for student enrollment records
9. THE System SHALL support schoolVisits collection for tour scheduling
10. THE System SHALL support conversionTracking for admissions funnel analytics
11. THE System SHALL distinguish School Enrollment industry from SaaS industry (separate verticals)

### Requirement 5: Law Firm Industry Data Model

**User Story:** As a law firm manager, I want legal practice management fields, so that I can track matters, conflicts, and client relationships.

#### Acceptance Criteria

1. THE LawInstitutionData interface SHALL include firmType field (solo, partnership, corporate)
2. THE LawInstitutionData interface SHALL include practiceAreas array (litigation, corporate, family, criminal)
3. THE LawInstitutionData interface SHALL include barAssociations array for professional memberships
4. THE LawInstitutionData interface SHALL include conflictCheckRequired boolean flag
5. THE LawPersonData interface SHALL include clientType field (individual, company)
6. THE LawPersonData interface SHALL include legalIssueType field
7. THE LawPersonData interface SHALL include urgency field (low, medium, high, critical)
8. THE System SHALL support matters collection for case management
9. THE System SHALL support intakeForms collection for client intake
10. THE System SHALL support conflictChecks collection for conflict of interest validation
11. THE System SHALL support consultations collection for meeting tracking
12. THE System SHALL support relatedParties collection for case stakeholders
13. THE System SHALL support legalDocuments collection for document management
14. THE System SHALL support timeTracking collection for billable hours
15. THE System SHALL support courtDates collection for deadline management

### Requirement 6: Marketing Agency Industry Data Model

**User Story:** As a marketing agency owner, I want campaign and client management fields, so that I can track deliverables and performance.

#### Acceptance Criteria

1. THE MarketingInstitutionData interface SHALL include industry field for client industry
2. THE MarketingInstitutionData interface SHALL include businessSize field (employees, revenue)
3. THE MarketingInstitutionData interface SHALL include targetAudience field
4. THE MarketingInstitutionData interface SHALL include monthlyBudget field
5. THE MarketingPersonData interface SHALL include role field
6. THE MarketingPersonData interface SHALL include influenceLevel field (decision-maker, influencer, user)
7. THE MarketingPersonData interface SHALL include approvalAuthority boolean flag
8. THE System SHALL support campaigns collection for campaign management
9. THE System SHALL support proposals collection for proposal tracking
10. THE System SHALL support deliverables collection for work tracking
11. THE System SHALL support performanceMetrics collection for analytics
12. THE System SHALL support clientReports collection for reporting
13. THE System SHALL support strategyDocs collection for strategy documentation

### Requirement 7: Real Estate Industry Data Model

**User Story:** As a real estate agent, I want property and transaction fields, so that I can manage listings, viewings, and deals.

#### Acceptance Criteria

1. THE RealEstateInstitutionData interface SHALL include propertyPortfolio array for owned properties
2. THE RealEstateInstitutionData interface SHALL include developerType field (residential, commercial, mixed)
3. THE RealEstateInstitutionData interface SHALL include investmentFocus field
4. THE RealEstatePersonData interface SHALL include clientType field (buyer, seller, tenant, landlord, investor)
5. THE RealEstatePersonData interface SHALL include budgetRange object with min and max values
6. THE RealEstatePersonData interface SHALL include preferredLocations array
7. THE System SHALL support properties collection for property listings
8. THE System SHALL support propertyPreferences collection for client preferences
9. THE System SHALL support viewings collection for site visit scheduling
10. THE System SHALL support offers collection for offer management
11. THE System SHALL support negotiations collection for negotiation tracking
12. THE System SHALL support deals collection for transaction management
13. THE System SHALL support propertyDocuments collection for document storage

### Requirement 8: SaaS Company Industry Data Model (CURRENT SYSTEM)

**User Story:** As a SaaS customer success manager, I want subscription and usage tracking fields, so that I can monitor account health and prevent churn.

**NOTE**: This represents the CURRENT production system. Existing schools are SaaS B2B accounts, not education institutions.

#### Acceptance Criteria

1. THE SaaSInstitutionData interface SHALL include companySize field (maps to existing nominalRoll)
2. THE SaaSInstitutionData interface SHALL include industry field
3. THE SaaSInstitutionData interface SHALL include planType field (maps to existing subscriptionPackage)
4. THE SaaSInstitutionData interface SHALL include accountStatus field (lead, trial, active, suspended, churned)
5. THE SaaSInstitutionData interface SHALL include signupDate field (maps to existing implementationDate)
6. THE SaaSInstitutionData interface SHALL include renewalDate field
7. THE SaaSInstitutionData interface SHALL include features array (maps to existing modules)
8. THE SaaSInstitutionData interface SHALL include billingAddress field (existing)
9. THE SaaSInstitutionData interface SHALL include currency field (existing)
10. THE SaaSInstitutionData interface SHALL include subscriptionRate field (existing)
11. THE SaaSPersonData interface SHALL include role field (admin, manager, user)
12. THE SaaSPersonData interface SHALL include lastLoginDate field
13. THE SaaSPersonData interface SHALL include activationStatus field
14. THE System SHALL audit existing InstitutionData fields against SaaS requirements document
15. THE System SHALL identify MISSING SaaS features: trials, onboarding, productUsage, subscriptions, supportTickets, featureAdoption, healthScores
16. THE System SHALL add acceptance criteria for implementing missing SaaS features
17. THE System SHALL support trials collection for trial management (NEW FEATURE)
18. THE System SHALL support onboarding collection for onboarding tracking (NEW FEATURE)
19. THE System SHALL support productUsage collection for usage analytics (NEW FEATURE)
20. THE System SHALL support subscriptions collection for subscription management (NEW FEATURE)
21. THE System SHALL support supportTickets collection for support tracking (NEW FEATURE)
22. THE System SHALL support featureAdoption collection for feature usage (NEW FEATURE)
23. THE System SHALL support healthScores collection for account health monitoring (NEW FEATURE)

### Requirement 8A: SaaS Feature Completeness Validation

**User Story:** As a platform administrator, I want to validate current features against SaaS requirements, so that I can identify and implement missing SaaS capabilities.

**NOTE**: This requirement audits the current system to ensure all SaaS features from the requirements document are implemented.

#### Acceptance Criteria

1. THE System SHALL audit existing InstitutionData fields against docs/Entity_institution_expansion_sass.md
2. THE System SHALL validate presence of Account/Organization dataset fields (companySize, planType, accountStatus, signupDate, renewalDate, customerTier)
3. THE System SHALL validate presence of Users/Contacts dataset support
4. THE System SHALL identify MISSING feature: Enquiries/Leads dataset (source, status, qualification)
5. THE System SHALL identify MISSING feature: Opportunities/Deals dataset (dealValue, salesStage, probability, expectedCloseDate)
6. THE System SHALL identify MISSING feature: Trial/Onboarding dataset (trialStartDate, trialEndDate, onboardingStatus, activationMilestone)
7. THE System SHALL identify MISSING feature: Product Usage/Behavioral dataset (featureUsed, frequency, sessionDuration, engagementScore)
8. THE System SHALL identify MISSING feature: Feature Adoption dataset (featureUsageStatus, adoptionDate, depthOfUsage)
9. THE System SHALL identify MISSING feature: Subscription & Billing dataset (billingCycle, paymentStatus, upgradeDowngradeHistory)
10. THE System SHALL identify MISSING feature: Support/Ticket dataset (issueType, priority, resolutionTime, satisfactionRating)
11. THE System SHALL identify MISSING feature: Customer Health/Analytics dataset (healthScore, usageScore, supportScore, churnRisk)
12. THE System SHALL identify MISSING feature: Churn & Retention dataset (churnDate, churnReason, retentionActions, winBackAttempts)
13. THE System SHALL identify MISSING feature: Loyalty/Expansion dataset (lifetimeValue, upsellHistory, referralActivity, advocacyStatus)
14. THE System SHALL create implementation plan for missing SaaS features
15. THE System SHALL prioritize SaaS feature implementation before other industry verticals


### Requirement 9: Consultancy Industry Data Model

**User Story:** As a consulting partner, I want engagement and outcome tracking fields, so that I can manage projects and demonstrate value.

#### Acceptance Criteria

1. THE ConsultancyInstitutionData interface SHALL include industry field
2. THE ConsultancyInstitutionData interface SHALL include companySize field (employees, revenue)
3. THE ConsultancyInstitutionData interface SHALL include strategicPriorities array
4. THE ConsultancyInstitutionData interface SHALL include painPoints array
5. THE ConsultancyPersonData interface SHALL include role field
6. THE ConsultancyPersonData interface SHALL include department field
7. THE ConsultancyPersonData interface SHALL include influenceLevel field (decision-maker, influencer, user)
8. THE ConsultancyPersonData interface SHALL include decisionMakingStyle field (fast, consensus, hierarchical)
9. THE System SHALL support discoveries collection for needs assessment
10. THE System SHALL support proposals collection for proposal management
11. THE System SHALL support engagements collection for project tracking
12. THE System SHALL support deliverables collection for deliverable tracking
13. THE System SHALL support milestones collection for milestone management
14. THE System SHALL support outcomes collection for impact measurement
15. THE System SHALL support retainers collection for retainer management

### Requirement 10: Industry-Specific Collections

**User Story:** As a developer, I want industry-specific Firestore collections, so that each industry can store specialized data without schema conflicts.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL create trials, onboarding, productUsage, subscriptions, supportTickets, featureAdoption, healthScores collections
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL create applications, enrollments, schoolVisits collections
3. WHEN Workspace industry is Law, THE System SHALL create matters, intakeForms, conflictChecks, consultations, relatedParties, legalDocuments, timeTracking, courtDates collections
4. WHEN Workspace industry is Marketing, THE System SHALL create campaigns, proposals, deliverables, performanceMetrics, clientReports, strategyDocs collections
5. WHEN Workspace industry is RealEstate, THE System SHALL create properties, propertyPreferences, viewings, offers, negotiations, deals, propertyDocuments collections
6. WHEN Workspace industry is Consultancy, THE System SHALL create discoveries, proposals, engagements, deliverables, milestones, outcomes, retainers collections
7. THE System SHALL scope all industry-specific collections by organizationId and workspaceId
8. THE System SHALL create composite indexes for industry-specific collection queries
9. THE System SHALL validate collection access based on Workspace Industry_Vertical

### Requirement 11: Backward Compatibility for SaaS Workspaces

**User Story:** As an existing SaaS customer, I want my workspace to continue functioning without changes, so that I experience zero disruption during the platform upgrade.

**NOTE**: Existing schools in production are SaaS B2B accounts, NOT education institutions. They must migrate to "SaaS" industry, not "School Enrollment" industry.

#### Acceptance Criteria

1. THE System SHALL preserve all existing schools collection data during migration
2. THE System SHALL default existing Workspaces to industry SaaS if industry field is missing
3. THE System SHALL maintain existing InstitutionData structure for SaaS industry
4. THE System SHALL map existing fields: nominalRoll → companySize, subscriptionPackage → planType, modules → features, implementationDate → signupDate
5. THE System SHALL preserve existing Pipeline configurations for SaaS workspaces
6. THE System SHALL maintain existing permission structure for SaaS workspaces
7. THE System SHALL update existing terminology from "Schools" to "Accounts" for SaaS workspaces
8. THE System SHALL support dual-read pattern via Adapter_Layer for migrated and legacy data
9. WHEN Migration_Status is legacy, THE System SHALL read from schools collection
10. WHEN Migration_Status is migrated, THE System SHALL read from entities and workspace_entities collections
11. THE System SHALL maintain existing API contracts for SaaS-specific endpoints
12. THE System SHALL identify and implement missing SaaS features (trials, onboarding, productUsage, subscriptions, supportTickets, featureAdoption, healthScores)

### Requirement 12: Migration Safety and Rollback

**User Story:** As a platform administrator, I want safe migration with rollback capability, so that I can recover from migration failures without data loss.

#### Acceptance Criteria

1. THE System SHALL create migration audit logs for all data transformations
2. THE System SHALL implement rollback scripts for each migration phase
3. THE System SHALL validate data integrity before and after migration
4. THE System SHALL preserve original data in schools collection during migration
5. THE System SHALL support Migration_Status field with values (legacy, migrated, dual-write)
6. WHEN migration fails, THE System SHALL revert to legacy data model
7. THE System SHALL log all migration errors with entity identifiers
8. THE System SHALL provide migration progress reporting
9. THE System SHALL support incremental migration (batch processing)
10. THE System SHALL validate all relationships after migration

### Requirement 13: Industry-Specific Terminology

**User Story:** As a workspace user, I want industry-appropriate terminology in the UI, so that the system feels native to my business domain.

**NOTE**: Current system displays "Schools" but these are actually SaaS "Accounts". Terminology must be updated to reflect SaaS nature.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL display "Accounts" for institutions
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL display "Schools" for institutions
3. WHEN Workspace industry is Law, THE System SHALL display "Clients" for institutions
4. WHEN Workspace industry is Marketing, THE System SHALL display "Clients" for institutions
5. WHEN Workspace industry is RealEstate, THE System SHALL display "Clients" for institutions
6. WHEN Workspace industry is Consultancy, THE System SHALL display "Clients" for institutions
7. THE System SHALL store Terminology_Map for each Industry_Vertical
8. THE System SHALL apply Terminology_Map to sidebar navigation labels
9. THE System SHALL apply Terminology_Map to page titles and headers
10. THE System SHALL apply Terminology_Map to button labels and actions
11. THE System SHALL apply Terminology_Map to form field labels
12. THE System SHALL support custom terminology overrides at Workspace level


### Requirement 14: Industry-Specific Pipeline Templates

**User Story:** As a workspace administrator, I want industry-specific pipeline templates, so that I can quickly set up workflows relevant to my business.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide Customer Pipeline template with stages (Lead, Trial, Onboarding, Active, Renewal, Churned)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide Admissions Pipeline template with stages (Enquiry, Application, Review, Accepted, Enrolled)
3. WHEN Workspace industry is Law, THE System SHALL provide Matter Pipeline template with stages (Intake, Conflict Check, Consultation, Engagement, Active, Closed)
4. WHEN Workspace industry is Marketing, THE System SHALL provide Campaign Pipeline template with stages (Discovery, Proposal, Planning, Execution, Reporting, Retention)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide Sales Pipeline template with stages (Enquiry, Viewing, Offer, Negotiation, Documentation, Closed)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide Engagement Pipeline template with stages (Enquiry, Discovery, Proposal, Engagement, Delivery, Outcome)
7. THE System SHALL allow customization of pipeline templates
8. THE System SHALL support multiple pipelines per Workspace
9. THE System SHALL validate Stage transitions based on Pipeline configuration
10. THE System SHALL log pipeline_stage_changed activity for all Stage transitions

### Requirement 15: Industry-Specific Features

**User Story:** As a workspace user, I want access to industry-relevant features, so that I can perform domain-specific tasks efficiently.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL enable Trial Management, Onboarding Tracking, Usage Analytics, Health Scoring features
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL enable Admissions, Enrollments, School Visits features
3. WHEN Workspace industry is Law, THE System SHALL enable Matter Management, Conflict Checking, Time Tracking, Court Dates features
4. WHEN Workspace industry is Marketing, THE System SHALL enable Campaign Management, Performance Tracking, Client Reporting features
5. WHEN Workspace industry is RealEstate, THE System SHALL enable Property Listings, Viewing Scheduling, Offer Management features
6. WHEN Workspace industry is Consultancy, THE System SHALL enable Discovery Sessions, Proposal Management, Engagement Tracking, Outcome Measurement features
7. THE System SHALL hide features not applicable to Workspace Industry_Vertical
8. THE System SHALL validate feature access based on Workspace Industry_Vertical
9. THE System SHALL support feature toggles at Organization and Workspace levels
10. THE System SHALL log feature usage for analytics

### Requirement 16: Industry-Specific Permissions

**User Story:** As an organization administrator, I want industry-appropriate permissions, so that I can control access to domain-specific features.

#### Acceptance Criteria

1. THE System SHALL support generic permissions (contacts_view, contacts_edit, contacts_create, contacts_delete, pipeline_view, pipeline_manage, finance_view, finance_manage)
2. WHEN Workspace industry is SaaS, THE System SHALL support saas_trials_manage, saas_usage_view permissions
3. WHEN Workspace industry is SchoolEnrollment, THE System SHALL support schoolenrollment_admissions_manage permission
4. WHEN Workspace industry is Law, THE System SHALL support law_matters_manage, law_conflict_check permissions
5. WHEN Workspace industry is Marketing, THE System SHALL support marketing_campaigns_manage permission
6. WHEN Workspace industry is RealEstate, THE System SHALL support realestate_properties_manage, realestate_viewings_manage permissions
7. WHEN Workspace industry is Consultancy, THE System SHALL support consultancy_engagements_manage permission
8. THE System SHALL validate permission checks based on Workspace Industry_Vertical
9. THE System SHALL support role-based permission assignment
10. THE System SHALL log permission violations for security auditing

### Requirement 17: Sidebar Navigation Adaptation

**User Story:** As a workspace user, I want industry-specific sidebar navigation, so that I can quickly access relevant features.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL display sidebar items (Accounts, Users, Trials, Subscriptions, Health, Support)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL display sidebar items (Schools, Families, Pipeline, Admissions, Enrollments)
3. WHEN Workspace industry is Law, THE System SHALL display sidebar items (Clients, Matters, Intake, Consultations, Deadlines, Time Tracking)
4. WHEN Workspace industry is Marketing, THE System SHALL display sidebar items (Clients, Campaigns, Proposals, Deliverables, Reports)
5. WHEN Workspace industry is RealEstate, THE System SHALL display sidebar items (Clients, Properties, Viewings, Offers, Deals)
6. WHEN Workspace industry is Consultancy, THE System SHALL display sidebar items (Clients, Engagements, Proposals, Deliverables, Outcomes)
7. THE System SHALL dynamically render sidebar based on Workspace Industry_Vertical
8. THE System SHALL support sidebar customization at Workspace level
9. THE System SHALL persist sidebar state (collapsed, expanded) per user
10. THE System SHALL highlight active sidebar item based on current route

### Requirement 18: Organization-Level Industry Configuration

**User Story:** As an organization administrator, I want to set a default industry at organization level, so that new workspaces inherit appropriate settings.

#### Acceptance Criteria

1. THE Organization interface SHALL include optional industry field
2. WHEN Organization industry is set, THE System SHALL default new Workspaces to Organization industry
3. THE System SHALL allow Workspace industry override if Organization industry is not set
4. THE System SHALL support multi-industry Organizations (no Organization-level industry constraint)
5. THE System SHALL display Organization industry in Backoffice settings
6. THE System SHALL validate Organization industry is one of six supported values
7. THE System SHALL apply Organization-level industry templates to new Workspaces
8. THE System SHALL support Organization-level industry-specific defaults


### Requirement 19: Workspace Industry Selection UI

**User Story:** As a workspace creator, I want a clear industry selection interface, so that I can choose the appropriate industry for my workspace.

#### Acceptance Criteria

1. WHEN creating a Workspace, THE System SHALL display industry selection dropdown with six options
2. THE System SHALL display industry descriptions for each option
3. THE System SHALL display industry icons for visual identification
4. THE System SHALL require industry selection before Workspace creation
5. THE System SHALL display confirmation dialog showing selected industry and implications
6. THE System SHALL prevent industry changes after Workspace creation
7. THE System SHALL display industry badge on Workspace card in Backoffice
8. THE System SHALL filter Workspace list by industry in Backoffice

### Requirement 20: Firebase Composite Indexes

**User Story:** As a developer, I want optimized Firestore queries, so that industry-specific data retrieval is performant.

#### Acceptance Criteria

1. THE System SHALL create composite index on entities collection (organizationId ASC, entityType ASC, status ASC, createdAt DESC)
2. THE System SHALL create composite index on workspace_entities collection (workspaceId ASC, entityType ASC, status ASC, addedAt DESC)
3. THE System SHALL create composite index on workspaces collection (organizationId ASC, industry ASC, status ASC)
4. THE System SHALL create composite indexes for each industry-specific collection
5. THE System SHALL validate index creation before deployment
6. THE System SHALL monitor query performance for index optimization
7. THE System SHALL document all composite indexes in firestore.indexes.json

### Requirement 21: Data Migration Phases

**User Story:** As a platform administrator, I want phased data migration, so that I can minimize risk and validate each step.

**NOTE**: Existing schools must migrate to SaaS industry (not School Enrollment), as they are B2B SaaS accounts.

#### Acceptance Criteria

1. THE Migration Phase 1 SHALL read all existing schools from schools collection
2. THE Migration Phase 1 SHALL read all existing entities with entityType institution
3. THE Migration Phase 1 SHALL identify SaaS-specific fields (nominalRoll, subscriptionPackage, modules, implementationDate, billing fields)
4. THE Migration Phase 1 SHALL validate data integrity
5. THE Migration Phase 2 SHALL add industry field to Workspace interface with default SaaS
6. THE Migration Phase 2 SHALL add industryData polymorphic field to Entity interface
7. THE Migration Phase 2 SHALL create industry-specific data interfaces
8. THE Migration Phase 2 SHALL migrate InstitutionData to SaaSInstitutionData
9. THE Migration Phase 3 SHALL update all existing Workspaces with industry SaaS
10. THE Migration Phase 3 SHALL transform existing InstitutionData to SaaSInstitutionData structure
11. THE Migration Phase 3 SHALL map fields: nominalRoll → companySize, subscriptionPackage → planType, modules → features, implementationDate → signupDate
12. THE Migration Phase 3 SHALL preserve all existing fields
13. THE Migration Phase 3 SHALL add new SaaS-specific fields with defaults (accountStatus, renewalDate)
14. THE Migration Phase 3 SHALL update workspace_entities with industry context
15. THE Migration Phase 3 SHALL verify data integrity post-migration
16. THE Migration Phase 4 SHALL create migration audit logs
17. THE Migration Phase 4 SHALL implement rollback scripts
18. THE Migration Phase 4 SHALL test data integrity
19. THE Migration Phase 4 SHALL validate all relationships

### Requirement 22: Zero Downtime Migration

**User Story:** As an existing customer, I want uninterrupted service during migration, so that my business operations are not affected.

#### Acceptance Criteria

1. THE System SHALL maintain 99.9% uptime during migration
2. THE System SHALL perform migration during low-traffic periods
3. THE System SHALL use dual-write pattern for transitional state
4. THE System SHALL validate data consistency between old and new models
5. THE System SHALL monitor error rates during migration
6. THE System SHALL provide real-time migration status dashboard
7. THE System SHALL support incremental migration (batch processing)
8. THE System SHALL implement circuit breakers for migration failures
9. THE System SHALL maintain read performance during migration
10. THE System SHALL maintain write performance during migration

### Requirement 23: Industry Data Validation

**User Story:** As a developer, I want strict data validation, so that industry-specific data integrity is maintained.

#### Acceptance Criteria

1. WHEN Entity industry is SaaS, THE System SHALL validate SaaSInstitutionData schema
2. WHEN Entity industry is SchoolEnrollment, THE System SHALL validate SchoolEnrollmentInstitutionData schema
3. WHEN Entity industry is Law, THE System SHALL validate LawInstitutionData schema
4. WHEN Entity industry is Marketing, THE System SHALL validate MarketingInstitutionData schema
5. WHEN Entity industry is RealEstate, THE System SHALL validate RealEstateInstitutionData schema
6. WHEN Entity industry is Consultancy, THE System SHALL validate ConsultancyInstitutionData schema
7. THE System SHALL reject invalid industry data with descriptive error messages
8. THE System SHALL validate required fields for each industry
9. THE System SHALL validate field types and constraints
10. THE System SHALL log validation errors for debugging

### Requirement 24: Industry-Specific Form Templates

**User Story:** As a workspace administrator, I want industry-specific form templates, so that I can quickly create relevant data collection forms.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide Trial Signup, Onboarding Survey, Support Request form templates
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide Admission Application, Student Enrollment, School Visit Request form templates
3. WHEN Workspace industry is Law, THE System SHALL provide Client Intake, Conflict Check, Consultation Request form templates
4. WHEN Workspace industry is Marketing, THE System SHALL provide Campaign Brief, Client Onboarding, Performance Report form templates
5. WHEN Workspace industry is RealEstate, THE System SHALL provide Property Inquiry, Viewing Request, Offer Submission form templates
6. WHEN Workspace industry is Consultancy, THE System SHALL provide Discovery Request, Proposal Request, Engagement Feedback form templates
7. THE System SHALL allow customization of form templates
8. THE System SHALL map form responses to industry-specific data fields
9. THE System SHALL validate form submissions against industry schemas
10. THE System SHALL support conditional logic in industry-specific forms


### Requirement 25: Industry-Specific Automation Templates

**User Story:** As a workspace administrator, I want industry-specific automation templates, so that I can quickly set up relevant workflows.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide automation templates (Trial Expiry Warning, Onboarding Milestone, Usage Report)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide automation templates (Welcome New School, Admission Follow-up, Enrollment Confirmation)
3. WHEN Workspace industry is Law, THE System SHALL provide automation templates (New Client Welcome, Consultation Reminder, Matter Update Notification)
4. WHEN Workspace industry is Marketing, THE System SHALL provide automation templates (Campaign Launch Notification, Performance Report Delivery, Client Check-in)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide automation templates (Property Match Alert, Viewing Reminder, Offer Status Update)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide automation templates (Discovery Confirmation, Proposal Follow-up, Engagement Milestone)
7. THE System SHALL allow customization of automation templates
8. THE System SHALL validate automation triggers against industry context
9. THE System SHALL support industry-specific automation actions
10. THE System SHALL log automation execution for debugging

### Requirement 26: Industry-Specific Reporting

**User Story:** As a workspace manager, I want industry-relevant reports, so that I can track key performance indicators for my business.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide reports (Trial Conversion, Churn Analysis, Feature Adoption)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide reports (Admissions Funnel, Enrollment Trends, School Pipeline)
3. WHEN Workspace industry is Law, THE System SHALL provide reports (Matter Status, Time Tracking, Conflict Check Summary)
4. WHEN Workspace industry is Marketing, THE System SHALL provide reports (Campaign Performance, Client Retention, Deliverable Status)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide reports (Property Listings, Viewing Conversion, Deal Pipeline)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide reports (Engagement Status, Outcome Metrics, Proposal Win Rate)
7. THE System SHALL support custom report creation
8. THE System SHALL export reports in CSV and Excel formats
9. THE System SHALL schedule automated report delivery
10. THE System SHALL visualize report data with charts and graphs

### Requirement 27: Industry-Specific Dashboard Widgets

**User Story:** As a workspace user, I want industry-relevant dashboard widgets, so that I can monitor key metrics at a glance.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL display widgets (Active Trials, Churn Risk, Health Score Distribution)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL display widgets (Admissions Pipeline, Enrollment Count, School Status Distribution)
3. WHEN Workspace industry is Law, THE System SHALL display widgets (Active Matters, Upcoming Deadlines, Billable Hours)
4. WHEN Workspace industry is Marketing, THE System SHALL display widgets (Active Campaigns, Client Count, Campaign Performance)
5. WHEN Workspace industry is RealEstate, THE System SHALL display widgets (Active Listings, Scheduled Viewings, Deal Pipeline)
6. WHEN Workspace industry is Consultancy, THE System SHALL display widgets (Active Engagements, Proposal Status, Outcome Metrics)
7. THE System SHALL allow widget customization
8. THE System SHALL support widget drag-and-drop positioning
9. THE System SHALL persist widget configuration per user
10. THE System SHALL refresh widget data in real-time

### Requirement 28: Industry-Specific Contact Types

**User Story:** As a workspace administrator, I want industry-appropriate contact types, so that I can categorize contacts relevant to my business.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide contact types (Admin, Manager, User, Billing Contact)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide contact types (Principal, Administrator, Accountant, School Owner)
3. WHEN Workspace industry is Law, THE System SHALL provide contact types (Managing Partner, Associate, Paralegal, Client Contact)
4. WHEN Workspace industry is Marketing, THE System SHALL provide contact types (Marketing Manager, Creative Director, Account Manager, Stakeholder)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide contact types (Property Owner, Buyer, Seller, Agent, Investor)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide contact types (Partner, Consultant, Client Stakeholder, Decision Maker)
7. THE System SHALL allow custom contact type creation
8. THE System SHALL validate contact type against Workspace Industry_Vertical
9. THE System SHALL support contact type templates
10. THE System SHALL migrate existing contact types to industry-specific types

### Requirement 29: Performance Requirements

**User Story:** As a platform user, I want fast system performance, so that I can work efficiently regardless of data volume.

#### Acceptance Criteria

1. THE System SHALL load Entity list page within 2 seconds for 10,000 entities
2. THE System SHALL load Entity detail page within 1 second
3. THE System SHALL execute industry-specific queries within 500ms
4. THE System SHALL support pagination for large result sets (100 items per page)
5. THE System SHALL cache frequently accessed industry data
6. THE System SHALL optimize Firestore queries with composite indexes
7. THE System SHALL implement lazy loading for industry-specific collections
8. THE System SHALL monitor query performance with Sentry
9. THE System SHALL maintain 99.9% uptime for production environment
10. THE System SHALL handle 1000 concurrent users without performance degradation

### Requirement 30: Security and Data Isolation

**User Story:** As an organization administrator, I want strict data isolation, so that industry-specific data is secure and compliant.

#### Acceptance Criteria

1. THE System SHALL enforce organizationId-based data isolation for all industry collections
2. THE System SHALL enforce workspaceId-based data isolation for workspace-specific collections
3. THE System SHALL validate user permissions before industry data access
4. THE System SHALL log all industry data access for audit trails
5. THE System SHALL encrypt industry-specific data at rest
6. THE System SHALL encrypt industry-specific data in transit
7. THE System SHALL implement Firestore security rules for industry collections
8. THE System SHALL validate industry data access based on Workspace membership
9. THE System SHALL prevent cross-industry data leakage
10. THE System SHALL support GDPR-compliant data deletion for industry data


### Requirement 31: Scalability Requirements

**User Story:** As a platform administrator, I want the system to scale, so that I can support growth across multiple industries.

#### Acceptance Criteria

1. THE System SHALL support 6 or more Industry_Verticals without architecture changes
2. THE System SHALL support 10,000 or more Entities per Industry_Vertical
3. THE System SHALL support 100 or more Workspaces per Organization
4. THE System SHALL support 1,000 or more Organizations
5. THE System SHALL support 10,000 or more concurrent users
6. THE System SHALL implement horizontal scaling for industry-specific services
7. THE System SHALL implement caching strategies for industry data
8. THE System SHALL optimize database queries for large datasets
9. THE System SHALL support incremental data loading
10. THE System SHALL monitor system resources and auto-scale

### Requirement 32: Maintainability Requirements

**User Story:** As a developer, I want modular industry architecture, so that I can add new industries without affecting existing ones.

#### Acceptance Criteria

1. THE System SHALL implement industry-specific logic as modular plugins
2. THE System SHALL separate industry data models into distinct TypeScript interfaces
3. THE System SHALL separate industry UI components into distinct directories
4. THE System SHALL separate industry business logic into distinct action files
5. THE System SHALL document industry-specific APIs
6. THE System SHALL implement unit tests for each industry module
7. THE System SHALL implement integration tests for industry workflows
8. THE System SHALL support feature flags for industry-specific features
9. THE System SHALL version industry data schemas
10. THE System SHALL provide migration scripts for schema changes

### Requirement 33: API Compatibility

**User Story:** As an API consumer, I want backward-compatible APIs, so that my integrations continue working after the industry expansion.

#### Acceptance Criteria

1. THE System SHALL maintain existing API endpoints for Education industry
2. THE System SHALL version new industry-specific API endpoints
3. THE System SHALL document API changes in changelog
4. THE System SHALL provide API migration guides
5. THE System SHALL support API versioning (v1, v2)
6. THE System SHALL deprecate old endpoints with 6-month notice
7. THE System SHALL return industry field in Entity API responses
8. THE System SHALL accept industry parameter in Entity creation requests
9. THE System SHALL validate industry parameter against supported values
10. THE System SHALL return industry-specific error messages

### Requirement 34: Webhook Adaptations

**User Story:** As a webhook consumer, I want industry context in webhook payloads, so that I can process events appropriately.

#### Acceptance Criteria

1. THE System SHALL include industry field in all Entity webhook payloads
2. THE System SHALL include industryData field in Entity webhook payloads
3. THE System SHALL trigger industry-specific webhook events
4. THE System SHALL document industry-specific webhook schemas
5. THE System SHALL validate webhook payload structure
6. THE System SHALL support webhook filtering by industry
7. THE System SHALL include Workspace industry in workspace webhook payloads
8. THE System SHALL maintain backward compatibility for existing webhooks
9. THE System SHALL version webhook payloads
10. THE System SHALL log webhook delivery failures

### Requirement 35: User Onboarding for New Industries

**User Story:** As a new user, I want guided onboarding for my industry, so that I can quickly set up my workspace.

#### Acceptance Criteria

1. WHEN creating first Workspace, THE System SHALL display industry selection wizard
2. THE System SHALL display industry-specific onboarding checklist
3. THE System SHALL provide industry-specific tutorial videos
4. THE System SHALL create sample data for selected industry
5. THE System SHALL configure default Pipeline for selected industry
6. THE System SHALL configure default contact types for selected industry
7. THE System SHALL configure default form templates for selected industry
8. THE System SHALL configure default automation templates for selected industry
9. THE System SHALL display industry-specific help documentation
10. THE System SHALL track onboarding completion progress

### Requirement 36: Cross-Industry User Support

**User Story:** As a user with access to multiple industries, I want seamless switching between workspaces, so that I can manage different business domains efficiently.

#### Acceptance Criteria

1. THE System SHALL support user access to multiple Workspaces with different industries
2. THE System SHALL display industry badge on Workspace selector
3. THE System SHALL persist last active Workspace per user
4. THE System SHALL switch UI context when changing Workspaces
5. THE System SHALL load industry-specific navigation when switching Workspaces
6. THE System SHALL load industry-specific terminology when switching Workspaces
7. THE System SHALL clear industry-specific filters when switching Workspaces
8. THE System SHALL maintain separate browser history per Workspace
9. THE System SHALL support keyboard shortcuts for Workspace switching
10. THE System SHALL display industry-specific quick actions per Workspace

### Requirement 37: Industry-Specific Search

**User Story:** As a workspace user, I want industry-relevant search, so that I can find entities and data using domain-specific terms.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL search across planType, accountStatus, companySize fields
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL search across gradeOfferings, academicYear fields
3. WHEN Workspace industry is Law, THE System SHALL search across practiceAreas, legalIssueType fields
4. WHEN Workspace industry is Marketing, THE System SHALL search across industry, targetAudience fields
5. WHEN Workspace industry is RealEstate, THE System SHALL search across propertyType, location fields
6. WHEN Workspace industry is Consultancy, THE System SHALL search across industry, strategicPriorities fields
7. THE System SHALL support full-text search across industry-specific fields
8. THE System SHALL support faceted search by industry-specific attributes
9. THE System SHALL highlight search terms in results
10. THE System SHALL rank search results by relevance


### Requirement 38: Industry-Specific Export Formats

**User Story:** As a workspace administrator, I want industry-appropriate export formats, so that I can share data in formats familiar to my industry.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL export data with columns (Account Name, Plan Type, Account Status, Renewal Date, Company Size)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL export data with columns (School Name, Grade Offerings, Academic Year, Enrollment Count)
3. WHEN Workspace industry is Law, THE System SHALL export data with columns (Client Name, Practice Areas, Active Matters, Billable Hours)
4. WHEN Workspace industry is Marketing, THE System SHALL export data with columns (Client Name, Industry, Active Campaigns, Monthly Budget)
5. WHEN Workspace industry is RealEstate, THE System SHALL export data with columns (Client Name, Property Type, Budget Range, Preferred Locations)
6. WHEN Workspace industry is Consultancy, THE System SHALL export data with columns (Client Name, Industry, Active Engagements, Strategic Priorities)
7. THE System SHALL support CSV export for all industries
8. THE System SHALL support Excel export for all industries
9. THE System SHALL include industry-specific metadata in exports
10. THE System SHALL validate export data integrity

### Requirement 39: Industry-Specific Import Mappings

**User Story:** As a workspace administrator, I want industry-appropriate import mappings, so that I can migrate data from industry-specific tools.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide import templates with fields (Account Name, Plan Type, Account Status, Company Size)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide import templates with fields (School Name, Grade Offerings, Academic Year)
3. WHEN Workspace industry is Law, THE System SHALL provide import templates with fields (Client Name, Practice Areas, Legal Issue Type)
4. WHEN Workspace industry is Marketing, THE System SHALL provide import templates with fields (Client Name, Industry, Target Audience, Monthly Budget)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide import templates with fields (Client Name, Property Type, Budget Range)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide import templates with fields (Client Name, Industry, Strategic Priorities)
7. THE System SHALL validate imported data against industry schemas
8. THE System SHALL provide import error reports with line numbers
9. THE System SHALL support bulk import for industry-specific collections
10. THE System SHALL log all import operations for audit trails

### Requirement 40: Industry-Specific Activity Types

**User Story:** As a workspace user, I want industry-relevant activity logging, so that I can track domain-specific events.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL log activities (trial_started, onboarding_completed, subscription_renewed, support_ticket_created)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL log activities (admission_application_submitted, student_enrolled, school_visit_scheduled)
3. WHEN Workspace industry is Law, THE System SHALL log activities (matter_opened, conflict_check_completed, consultation_scheduled, court_date_added)
4. WHEN Workspace industry is Marketing, THE System SHALL log activities (campaign_launched, deliverable_submitted, performance_report_sent)
5. WHEN Workspace industry is RealEstate, THE System SHALL log activities (property_listed, viewing_scheduled, offer_submitted, deal_closed)
6. WHEN Workspace industry is Consultancy, THE System SHALL log activities (discovery_completed, proposal_sent, engagement_started, milestone_achieved)
7. THE System SHALL include industry context in activity metadata
8. THE System SHALL filter activities by industry type
9. THE System SHALL support activity-based automation triggers
10. THE System SHALL export activity logs with industry context

### Requirement 41: Industry-Specific Notification Templates

**User Story:** As a workspace administrator, I want industry-appropriate notification templates, so that I can communicate effectively with my contacts.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide notification templates (Trial Welcome, Onboarding Milestone, Renewal Reminder)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide notification templates (Admission Confirmation, Enrollment Welcome, School Visit Reminder)
3. WHEN Workspace industry is Law, THE System SHALL provide notification templates (Consultation Confirmation, Matter Update, Deadline Reminder)
4. WHEN Workspace industry is Marketing, THE System SHALL provide notification templates (Campaign Launch, Deliverable Ready, Performance Report)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide notification templates (Property Match, Viewing Confirmation, Offer Status)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide notification templates (Discovery Confirmation, Proposal Delivery, Engagement Update)
7. THE System SHALL support template customization
8. THE System SHALL support template variables for industry-specific fields
9. THE System SHALL validate template syntax
10. THE System SHALL preview templates before sending

### Requirement 42: Industry-Specific Bulk Operations

**User Story:** As a workspace administrator, I want industry-relevant bulk operations, so that I can efficiently manage large datasets.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL support bulk operations (Update Plan Type, Set Renewal Date, Assign CSM)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL support bulk operations (Update Grade Offerings, Set Academic Year, Assign Admissions Officer)
3. WHEN Workspace industry is Law, THE System SHALL support bulk operations (Assign Practice Area, Update Matter Status, Set Billing Rate)
4. WHEN Workspace industry is Marketing, THE System SHALL support bulk operations (Assign Campaign, Update Budget, Set Account Manager)
5. WHEN Workspace industry is RealEstate, THE System SHALL support bulk operations (Update Property Status, Assign Agent, Set Price Range)
6. WHEN Workspace industry is Consultancy, THE System SHALL support bulk operations (Assign Engagement, Update Status, Set Deliverable Date)
7. THE System SHALL validate bulk operation data
8. THE System SHALL provide bulk operation progress indicators
9. THE System SHALL log bulk operations for audit trails
10. THE System SHALL support bulk operation rollback

### Requirement 43: Industry-Specific Field Validation

**User Story:** As a developer, I want strict field validation, so that industry-specific data quality is maintained.

#### Acceptance Criteria

1. WHEN Entity industry is SaaS, THE System SHALL validate renewalDate is future date
2. WHEN Entity industry is SaaS, THE System SHALL validate companySize is positive integer
3. WHEN Entity industry is SchoolEnrollment, THE System SHALL validate gradeOfferings is non-empty array
4. WHEN Entity industry is Law, THE System SHALL validate practiceAreas is non-empty array
5. WHEN Entity industry is Marketing, THE System SHALL validate monthlyBudget is positive number
6. WHEN Entity industry is RealEstate, THE System SHALL validate budgetRange has valid min and max values
7. WHEN Entity industry is Consultancy, THE System SHALL validate strategicPriorities is non-empty array
8. THE System SHALL display field-specific error messages
9. THE System SHALL validate required fields before save
10. THE System SHALL validate field formats (email, phone, URL)
11. THE System SHALL validate field constraints (min, max, length)


### Requirement 44: Industry-Specific Error Messages

**User Story:** As a workspace user, I want industry-appropriate error messages, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL display error messages using SaaS terminology (e.g., "Account not found" instead of "Entity not found")
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL display error messages using education terminology (e.g., "School not found" instead of "Entity not found")
3. WHEN Workspace industry is Law, THE System SHALL display error messages using legal terminology (e.g., "Matter not found" instead of "Record not found")
4. WHEN Workspace industry is Marketing, THE System SHALL display error messages using marketing terminology (e.g., "Campaign not found" instead of "Record not found")
5. WHEN Workspace industry is RealEstate, THE System SHALL display error messages using real estate terminology (e.g., "Property not found" instead of "Record not found")
6. WHEN Workspace industry is Consultancy, THE System SHALL display error messages using consultancy terminology (e.g., "Engagement not found" instead of "Record not found")
7. THE System SHALL provide actionable error messages with resolution steps
8. THE System SHALL log errors with industry context
9. THE System SHALL display error codes for technical support
10. THE System SHALL support error message localization

### Requirement 45: Industry-Specific Help Documentation

**User Story:** As a workspace user, I want industry-relevant help documentation, so that I can learn features specific to my business domain.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL display help articles (Trial Management, Usage Analytics, Churn Prevention)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL display help articles (Managing Schools, Tracking Admissions, Enrollment Workflows)
3. WHEN Workspace industry is Law, THE System SHALL display help articles (Managing Matters, Conflict Checking, Time Tracking)
4. WHEN Workspace industry is Marketing, THE System SHALL display help articles (Campaign Management, Performance Tracking, Client Reporting)
5. WHEN Workspace industry is RealEstate, THE System SHALL display help articles (Property Listings, Viewing Management, Deal Tracking)
6. WHEN Workspace industry is Consultancy, THE System SHALL display help articles (Engagement Management, Outcome Tracking, Proposal Creation)
7. THE System SHALL provide contextual help based on current page
8. THE System SHALL support help article search
9. THE System SHALL track help article views for analytics
10. THE System SHALL support help article feedback

### Requirement 46: Industry-Specific Quick Actions

**User Story:** As a workspace user, I want industry-relevant quick actions, so that I can perform common tasks efficiently.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide quick actions (Add Account, Start Trial, Create Ticket)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide quick actions (Add School, Schedule Visit, Create Application)
3. WHEN Workspace industry is Law, THE System SHALL provide quick actions (Add Client, Open Matter, Schedule Consultation)
4. WHEN Workspace industry is Marketing, THE System SHALL provide quick actions (Add Client, Launch Campaign, Create Proposal)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide quick actions (Add Client, List Property, Schedule Viewing)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide quick actions (Add Client, Start Discovery, Create Proposal)
7. THE System SHALL display quick actions in sidebar
8. THE System SHALL support keyboard shortcuts for quick actions
9. THE System SHALL validate permissions before displaying quick actions
10. THE System SHALL track quick action usage for analytics

### Requirement 47: Industry-Specific Filters

**User Story:** As a workspace user, I want industry-relevant filters, so that I can segment data using domain-specific criteria.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide filters (Plan Type, Account Status, Health Score, Renewal Date Range)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide filters (Grade Offerings, Academic Year, Enrollment Status)
3. WHEN Workspace industry is Law, THE System SHALL provide filters (Practice Area, Matter Status, Billing Rate)
4. WHEN Workspace industry is Marketing, THE System SHALL provide filters (Industry, Budget Range, Campaign Status)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide filters (Property Type, Budget Range, Location)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide filters (Industry, Engagement Status, Strategic Priority)
7. THE System SHALL support multi-select filters
8. THE System SHALL support filter combinations (AND, OR logic)
9. THE System SHALL persist filter state per user
10. THE System SHALL support saved filter presets

### Requirement 48: Industry-Specific Sorting Options

**User Story:** As a workspace user, I want industry-relevant sorting options, so that I can organize data by domain-specific criteria.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide sort options (Plan Value, Renewal Date, Health Score)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide sort options (Enrollment Count, Academic Year, Last Contact)
3. WHEN Workspace industry is Law, THE System SHALL provide sort options (Matter Count, Billable Hours, Last Activity)
4. WHEN Workspace industry is Marketing, THE System SHALL provide sort options (Budget, Campaign Count, Last Report Date)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide sort options (Budget Range, Viewing Count, Last Contact)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide sort options (Engagement Value, Last Milestone, Outcome Score)
7. THE System SHALL support ascending and descending sort
8. THE System SHALL support multi-column sort
9. THE System SHALL persist sort preferences per user
10. THE System SHALL indicate active sort column in UI

### Requirement 49: Industry-Specific Keyboard Shortcuts

**User Story:** As a power user, I want industry-relevant keyboard shortcuts, so that I can navigate and perform actions quickly.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL provide shortcuts (Ctrl+Shift+A for Add Account, Ctrl+Shift+T for Start Trial)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL provide shortcuts (Ctrl+Shift+S for Add School, Ctrl+Shift+A for Add Application)
3. WHEN Workspace industry is Law, THE System SHALL provide shortcuts (Ctrl+Shift+C for Add Client, Ctrl+Shift+M for Open Matter)
4. WHEN Workspace industry is Marketing, THE System SHALL provide shortcuts (Ctrl+Shift+C for Add Client, Ctrl+Shift+K for Launch Campaign)
5. WHEN Workspace industry is RealEstate, THE System SHALL provide shortcuts (Ctrl+Shift+C for Add Client, Ctrl+Shift+P for List Property)
6. WHEN Workspace industry is Consultancy, THE System SHALL provide shortcuts (Ctrl+Shift+C for Add Client, Ctrl+Shift+E for Start Engagement)
7. THE System SHALL display keyboard shortcut help modal (Ctrl+/)
8. THE System SHALL support customizable keyboard shortcuts
9. THE System SHALL prevent shortcut conflicts
10. THE System SHALL persist shortcut preferences per user

### Requirement 50: Industry-Specific Mobile Adaptations

**User Story:** As a mobile user, I want industry-optimized mobile views, so that I can access relevant features on the go.

#### Acceptance Criteria

1. WHEN Workspace industry is SaaS, THE System SHALL prioritize mobile views (Account List, Health Dashboard, Quick Add Ticket)
2. WHEN Workspace industry is SchoolEnrollment, THE System SHALL prioritize mobile views (School List, Admissions Pipeline, Quick Add School)
3. WHEN Workspace industry is Law, THE System SHALL prioritize mobile views (Client List, Matter Status, Time Entry)
4. WHEN Workspace industry is Marketing, THE System SHALL prioritize mobile views (Client List, Campaign Status, Quick Report)
5. WHEN Workspace industry is RealEstate, THE System SHALL prioritize mobile views (Property List, Viewing Schedule, Quick Add Viewing)
6. WHEN Workspace industry is Consultancy, THE System SHALL prioritize mobile views (Client List, Engagement Status, Quick Add Milestone)
7. THE System SHALL optimize mobile navigation for industry workflows
8. THE System SHALL support touch gestures for common actions
9. THE System SHALL adapt forms for mobile input
10. THE System SHALL maintain responsive design across all screen sizes


## Risk Mitigation Requirements

### Requirement 51: Data Loss Prevention

**User Story:** As a platform administrator, I want comprehensive data loss prevention, so that no customer data is lost during migration or operation.

#### Acceptance Criteria

1. THE System SHALL create full database backups before migration
2. THE System SHALL implement point-in-time recovery for all collections
3. THE System SHALL validate data integrity after each migration batch
4. THE System SHALL maintain transaction logs for all data operations
5. THE System SHALL implement soft delete for all Entity records
6. THE System SHALL retain deleted data for 90 days minimum
7. THE System SHALL implement automated backup verification
8. THE System SHALL monitor backup success rates
9. THE System SHALL alert administrators on backup failures
10. THE System SHALL provide data restoration procedures

### Requirement 52: Performance Degradation Prevention

**User Story:** As an existing customer, I want consistent performance, so that the industry expansion does not slow down my workflows.

#### Acceptance Criteria

1. THE System SHALL maintain query response times within 10% of baseline
2. THE System SHALL monitor query performance in real-time
3. THE System SHALL implement query optimization for industry-specific collections
4. THE System SHALL use connection pooling for database access
5. THE System SHALL implement caching for frequently accessed industry data
6. THE System SHALL implement lazy loading for large datasets
7. THE System SHALL monitor memory usage and prevent leaks
8. THE System SHALL implement circuit breakers for slow queries
9. THE System SHALL alert on performance degradation
10. THE System SHALL provide performance dashboards for monitoring

### Requirement 53: User Confusion Prevention

**User Story:** As an existing SaaS customer, I want clear communication about changes, so that I understand how the platform evolution affects me.

**NOTE**: Existing customers are SaaS B2B accounts (schools as customers), not education institutions.

#### Acceptance Criteria

1. THE System SHALL display migration announcement banner 30 days before migration
2. THE System SHALL provide migration FAQ documentation explaining SaaS industry classification
3. THE System SHALL send email notifications about migration timeline and terminology changes
4. THE System SHALL provide video tutorials for new features
5. THE System SHALL offer live training sessions for industry features
6. THE System SHALL maintain changelog with detailed release notes
7. THE System SHALL provide in-app tooltips for new UI elements (e.g., "Accounts" instead of "Schools")
8. THE System SHALL offer customer support during migration period
9. THE System SHALL collect user feedback on changes
10. THE System SHALL provide rollback communication if needed
11. THE System SHALL explain distinction between SaaS industry (current) and School Enrollment industry (new vertical)

### Requirement 54: Feature Parity Validation

**User Story:** As a platform administrator, I want feature parity across industries, so that all customers have equivalent capabilities.

#### Acceptance Criteria

1. THE System SHALL provide core CRM features for all industries (contacts, pipeline, messaging, automation)
2. THE System SHALL provide equivalent form builder capabilities for all industries
3. THE System SHALL provide equivalent reporting capabilities for all industries
4. THE System SHALL provide equivalent import/export capabilities for all industries
5. THE System SHALL provide equivalent permission systems for all industries
6. THE System SHALL document feature availability per industry
7. THE System SHALL validate feature completeness before industry launch
8. THE System SHALL track feature usage per industry
9. THE System SHALL prioritize feature gaps based on usage
10. THE System SHALL communicate feature roadmap per industry

## Testing Requirements

### Requirement 55: Unit Testing for Industry Modules

**User Story:** As a developer, I want comprehensive unit tests, so that industry-specific logic is validated.

#### Acceptance Criteria

1. THE System SHALL achieve 80% or greater code coverage for industry-specific modules
2. THE System SHALL test all industry data validation functions
3. THE System SHALL test all industry-specific business logic
4. THE System SHALL test all industry-specific UI components
5. THE System SHALL test all industry-specific API endpoints
6. THE System SHALL test error handling for industry operations
7. THE System SHALL test edge cases for industry data
8. THE System SHALL use property-based testing for industry data validation
9. THE System SHALL run unit tests on every commit
10. THE System SHALL fail builds on test failures

### Requirement 56: Integration Testing for Industry Workflows

**User Story:** As a QA engineer, I want integration tests, so that industry workflows are validated end-to-end.

#### Acceptance Criteria

1. THE System SHALL test Entity creation workflow for each industry
2. THE System SHALL test Pipeline progression workflow for each industry
3. THE System SHALL test Form submission workflow for each industry
4. THE System SHALL test Automation execution workflow for each industry
5. THE System SHALL test Messaging workflow for each industry
6. THE System SHALL test Import/Export workflow for each industry
7. THE System SHALL test Permission validation workflow for each industry
8. THE System SHALL test Migration workflow for Education industry
9. THE System SHALL use Firebase emulators for integration tests
10. THE System SHALL run integration tests before deployment

### Requirement 57: End-to-End Testing for Industry Features

**User Story:** As a QA engineer, I want E2E tests, so that industry features are validated from user perspective.

#### Acceptance Criteria

1. THE System SHALL test complete user journey for each industry (signup to first Entity creation)
2. THE System SHALL test Workspace creation with industry selection
3. THE System SHALL test Entity creation with industry-specific fields
4. THE System SHALL test Pipeline navigation with industry-specific stages
5. THE System SHALL test Form creation with industry-specific templates
6. THE System SHALL test Automation creation with industry-specific triggers
7. THE System SHALL test Report generation with industry-specific metrics
8. THE System SHALL test Export with industry-specific formats
9. THE System SHALL use Playwright for E2E tests
10. THE System SHALL run E2E tests on staging environment

### Requirement 58: Performance Testing for Industry Scale

**User Story:** As a platform administrator, I want performance tests, so that industry features scale appropriately.

#### Acceptance Criteria

1. THE System SHALL test query performance with 10,000 Entities per industry
2. THE System SHALL test concurrent user load (1,000 users)
3. THE System SHALL test bulk operation performance (1,000 records)
4. THE System SHALL test import performance (10,000 records)
5. THE System SHALL test export performance (10,000 records)
6. THE System SHALL test automation execution performance (1,000 automations)
7. THE System SHALL test messaging performance (10,000 messages)
8. THE System SHALL measure response times for industry-specific queries
9. THE System SHALL identify performance bottlenecks
10. THE System SHALL optimize based on performance test results

### Requirement 59: Security Testing for Industry Data

**User Story:** As a security engineer, I want security tests, so that industry data is protected.

#### Acceptance Criteria

1. THE System SHALL test data isolation between Organizations
2. THE System SHALL test data isolation between Workspaces
3. THE System SHALL test permission enforcement for industry features
4. THE System SHALL test authentication for industry API endpoints
5. THE System SHALL test authorization for industry data access
6. THE System SHALL test SQL injection prevention for industry queries
7. THE System SHALL test XSS prevention for industry UI
8. THE System SHALL test CSRF prevention for industry forms
9. THE System SHALL perform penetration testing for industry features
10. THE System SHALL address all critical security vulnerabilities before launch

### Requirement 60: Accessibility Testing for Industry UI

**User Story:** As an accessibility advocate, I want accessible industry features, so that all users can use the platform.

#### Acceptance Criteria

1. THE System SHALL meet WCAG 2.1 Level AA standards for industry UI
2. THE System SHALL test keyboard navigation for industry features
3. THE System SHALL test screen reader compatibility for industry UI
4. THE System SHALL test color contrast for industry UI elements
5. THE System SHALL test focus indicators for industry forms
6. THE System SHALL provide alt text for industry-specific images
7. THE System SHALL provide ARIA labels for industry UI components
8. THE System SHALL test with assistive technologies
9. THE System SHALL address accessibility issues before launch
10. THE System SHALL maintain accessibility in future updates

---

## Summary

This requirements document specifies 60 comprehensive requirements for expanding SmartSapp from a SaaS B2B CRM platform into a multi-industry vertical CRM system. The requirements cover:

**CRITICAL ARCHITECTURAL CONTEXT**:
- **Current System**: SmartSapp is a SaaS B2B platform managing ~1000+ school accounts as B2B customers
- **Current Features**: nominalRoll (company size), subscriptionPackage (plan type), modules (features), billing, implementationDate (signup date) are SaaS account management features
- **School Enrollment**: A NEW industry vertical for education institutions (separate from current SaaS implementation)
- **Implementation Priority**: SaaS (current) → Marketing → School Enrollment → Consultancy → Real Estate → Law

**Requirements Coverage**:
- **Industry Support** (Requirements 1-2): Core industry vertical architecture with six verticals (SaaS, School Enrollment, Law, Marketing, Real Estate, Consultancy)
- **Data Models** (Requirements 3-9): Industry-specific data structures for all six verticals, with SaaS as current system
- **Collections** (Requirement 10): Industry-specific Firestore collections
- **Migration** (Requirements 11-12, 21-22): Safe migration with backward compatibility for existing SaaS workspaces
- **UI/UX** (Requirements 13-19, 37, 46-50): Industry-specific terminology, navigation, and interactions
- **Infrastructure** (Requirements 20, 29-31): Performance, scalability, and database optimization
- **Features** (Requirements 14-16, 24-28, 38-45): Industry-specific capabilities and workflows
- **Integration** (Requirements 33-34): API and webhook compatibility
- **User Experience** (Requirements 35-36): Onboarding and cross-industry support
- **Risk Mitigation** (Requirements 51-54): Data loss prevention, performance protection, user communication
- **Testing** (Requirements 55-60): Comprehensive test coverage across all layers

All requirements follow EARS patterns and INCOSE quality rules, ensuring clarity, testability, and completeness. The system will support SaaS (current), School Enrollment, Law Firms, Marketing Agencies, Real Estate, and Consultancy industries while maintaining zero downtime and backward compatibility for existing SaaS customers (currently labeled as "schools" but actually B2B accounts).

