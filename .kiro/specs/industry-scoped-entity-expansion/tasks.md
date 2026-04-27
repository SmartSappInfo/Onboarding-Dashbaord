# Implementation Plan: Industry-Scoped Entity Expansion

## Overview

Transform SmartSapp from a SaaS B2B CRM into a multi-industry vertical CRM supporting 6 industries: SaaS (current), Marketing, School Enrollment, Consultancy, Real Estate, and Law. Implementation follows the priority order: SaaS → Marketing → School Enrollment → Consultancy → Real Estate → Law.

The plan covers: core type system, industry configuration registry, Zod validation, contact adapter migration, workspace scoping, per-industry data models and server actions, UI adaptation (sidebar, terminology, feature gates), Firestore security rules and indexes, migration scripts, and property-based tests.

## Tasks

- [ ] 1. Core type definitions and interfaces
  - Add `IndustryVertical` union type to `src/lib/types.ts`
  - Update `Organization` interface with optional `industry?: IndustryVertical`
  - Update `Workspace` interface with required `industry: IndustryVertical`, `industryScopeLocked: boolean`, `industryScopeLockedAt?: Timestamp`
  - Update `Entity` interface with optional `industry?: IndustryVertical` and `industryData?: IndustryData`
  - Add `migrationStatus`, `legacySchoolId` fields to `Entity`
  - Define all polymorphic `IndustryData` discriminated union types: `SaaSInstitutionData`, `SaaSPersonData`, `SchoolEnrollmentInstitutionData`, `LawInstitutionData`, `LawPersonData`, `MarketingInstitutionData`, `MarketingPersonData`, `RealEstateInstitutionData`, `RealEstatePersonData`, `ConsultancyInstitutionData`, `ConsultancyPersonData`
  - _Requirements: 1.1, 3.1, 3.2, 8.1–8.13_

- [ ] 2. Industry-specific collection interfaces
  - [ ] 2.1 Define SaaS collection interfaces in `src/lib/types.ts`
    - `Trial`, `Onboarding`, `Subscription`, `SupportTicket`, `HealthScore`, `ProductUsage`, `FeatureAdoption`
    - _Requirements: 8.17–8.23_
  - [ ] 2.2 Define School Enrollment collection interfaces
    - `Application`, `Enrollment`, `SchoolVisit`
    - _Requirements: 4.1–4.10_
  - [ ] 2.3 Define Law collection interfaces
    - `Matter`, `IntakeForm`, `ConflictCheck`, `Consultation`, `RelatedParty`, `LegalDocument`, `TimeTracking`, `CourtDate`
    - _Requirements: 5.8–5.15_
  - [ ] 2.4 Define Marketing collection interfaces
    - `Campaign`, `Proposal`, `Deliverable`, `PerformanceMetric`, `ClientReport`, `StrategyDoc`
    - _Requirements: 6.8–6.13_
  - [ ] 2.5 Define Real Estate collection interfaces
    - `Property`, `PropertyPreference`, `Viewing`, `Offer`, `Negotiation`, `Deal`, `PropertyDocument`
    - _Requirements: 7.7–7.13_
  - [ ] 2.6 Define Consultancy collection interfaces
    - `Discovery`, `Engagement`, `Milestone`, `Outcome`, `Retainer`
    - _Requirements: 9.9–9.15_

- [ ] 3. Industry configuration registry
  - Create `src/lib/industry-config.ts` exporting `INDUSTRY_CONFIG: Record<IndustryVertical, IndustryContext>`
  - Define `TerminologyMap`, `FeatureGate`, `PipelineTemplate`, `IndustryContext` interfaces
  - Implement full config entries for all 6 industries: terminology, feature gates, pipeline templates, sidebar items, contact types
  - Export `getSidebarItemsForIndustry(industry)` helper
  - Export `getEnabledIndustries()` using feature flags
  - _Requirements: 13.7, 14.1–14.6, 15.1–15.9, 17.1–17.7_

- [ ] 4. Feature flags for phased industry rollout
  - Create `src/lib/feature-flags.ts` with `INDUSTRY_FEATURE_FLAGS` constants driven by `NEXT_PUBLIC_*` env vars
  - SaaS always enabled; Marketing, SchoolEnrollment, Consultancy, RealEstate, Law gated by env vars
  - Export `getEnabledIndustries()` consuming the flags
  - Document required env vars in a comment block
  - _Requirements: 1.6, 15.9_

- [ ] 5. Zod validation schemas for all industry data types
  - Create `src/lib/industry-schemas.ts`
  - Implement Zod schemas: `SaaSInstitutionDataSchema`, `SaaSPersonDataSchema`, `SchoolEnrollmentInstitutionDataSchema`, `LawInstitutionDataSchema`, `LawPersonDataSchema`, `MarketingInstitutionDataSchema`, `MarketingPersonDataSchema`, `RealEstateInstitutionDataSchema`, `RealEstatePersonDataSchema`, `ConsultancyInstitutionDataSchema`, `ConsultancyPersonDataSchema`
  - Implement `IndustryDataSchema` as `z.discriminatedUnion('industry', [...])`
  - Implement `EntitySchema` with optional `industryData`
  - Export `validateIndustryData(data, workspaceIndustry)` throwing on mismatch or schema failure
  - _Requirements: 23.1–23.10_

- [ ]* 5.1 Write property tests for industry data validation schemas
  - **Property 1: Industry data consistency** — For any entity with `industryData` present, `industryData.industry === entity.industry` must always hold
  - **Property 2: Invalid industry data is rejected** — For any `industryData` whose `industry` field differs from the workspace industry, `validateIndustryData` must throw
  - **Property 3: Terminology completeness** — For every `IndustryVertical`, `INDUSTRY_CONFIG[industry].terminology` defines all required keys
  - **Property 4: Feature gate enforcement** — For any workspace industry `I`, features absent from `INDUSTRY_CONFIG[I].features` return `false`
  - **Validates: Requirements 3.9, 23.1–23.9, Design Properties 2, 4, 8**

- [ ] 6. Workspace industry scoping logic
  - In `src/lib/entity-actions.ts`, add `lockWorkspaceScope(workspaceId)` that sets `industryScopeLocked: true` and `industryScopeLockedAt`
  - Update `createEntity` to: inject `industry` from workspace, call `validateIndustryData`, call `lockWorkspaceScope` if not yet locked, log `entity_created` activity with industry context
  - Add `getWorkspaceIndustry(workspaceId)` with LRU cache in `src/lib/industry-cache.ts`
  - Add `invalidateWorkspaceCache(workspaceId)` called on workspace updates
  - _Requirements: 2.1–2.6, 1.4_

- [ ]* 6.1 Write property tests for workspace scope lock
  - **Property 5: Scope lock trigger** — After the first entity is linked to a workspace, `industryScopeLocked` must be `true` on all subsequent reads
  - **Property 6: Industry immutability** — Once `industryScopeLocked` is `true`, `workspace.industry` must never change
  - **Validates: Requirements 2.2, 2.3, Design Properties 1, 7**

- [ ]* 6.2 Write unit tests for workspace scoping
  - Test `createEntity` rejects `industryData` mismatching workspace industry
  - Test `createEntity` calls `lockWorkspaceScope` only when not yet locked
  - Test `createEntity` does not re-lock an already-locked workspace
  - _Requirements: 2.2, 2.3_

- [ ] 7. Contact adapter extension for dual-read migration pattern
  - Extend `src/lib/contact-adapter.ts` with `mapSchoolToSaaSEntity(school: LegacySchool): Entity`
  - Update `getEntity` to branch on `migrationStatus`: `legacy` → read from `schools`, `dual-write` → read from `entities` with fallback to `schools`, `migrated` → read from `entities`
  - Add `readFromLegacySchools(legacySchoolId)` and `readFromEntities(entityId)` helpers
  - _Requirements: 11.8–11.10, 22.3_

- [ ]* 7.1 Write property tests for dual-read adapter
  - **Property 7: Backward compatibility** — Any entity with `migrationStatus: 'legacy'` must be readable via the adapter and return a valid `Entity` shape with `industry: 'SaaS'`
  - **Property 8: Migration idempotency** — Running the migration transformation on an already-migrated entity produces the same result as running it once
  - **Validates: Requirements 11.8–11.10, Design Properties 5, 6**

- [ ] 8. Checkpoint — Core foundation complete
  - Ensure all types compile with `pnpm typecheck`
  - Ensure all property and unit tests pass with `pnpm test:run`
  - Ask the user if questions arise before proceeding to industry implementations

- [ ] 9. SaaS industry — existing field mapping and new collections
  - [ ] 9.1 Audit existing `InstitutionData` fields against SaaS requirements
    - Compare existing fields to `SaaSInstitutionData` interface
    - Document field mappings: `nominalRoll → companySize`, `subscriptionPackage → planType`, `modules → features`, `implementationDate → signupDate`
    - _Requirements: 8.14, 8A.1–8A.2_
  - [ ] 9.2 Create `src/lib/saas-actions.ts`
    - `createTrial`, `getTrialsForEntity`, `updateTrialStatus`
    - `createOnboarding`, `updateOnboardingMilestone`
    - `createSubscription`, `updateSubscription`
    - `createSupportTicket`, `updateSupportTicket`
    - `createHealthScore`, `getLatestHealthScore`
    - `recordProductUsage`, `recordFeatureAdoption`
    - All actions validate `workspace.industry === 'SaaS'` before writing
    - _Requirements: 8.17–8.23, 8A.6–8A.11_
  - [ ]* 9.3 Write unit tests for `saas-actions.ts`
    - Test each action rejects non-SaaS workspaces
    - Test `createTrial` updates entity `trialIds` array
    - Test `createHealthScore` stores correct score fields
    - _Requirements: 8.17–8.23_

- [ ] 10. Marketing industry — data model and server actions
  - [ ] 10.1 Create `src/lib/marketing-actions.ts`
    - `createCampaign`, `updateCampaign`, `getCampaignsForEntity`
    - `createProposal`, `updateProposal`
    - `createDeliverable`, `updateDeliverableStatus`
    - `recordPerformanceMetric`, `createClientReport`, `createStrategyDoc`
    - All actions validate `workspace.industry === 'Marketing'`
    - _Requirements: 6.8–6.13_
  - [ ]* 10.2 Write unit tests for `marketing-actions.ts`
    - Test each action rejects non-Marketing workspaces
    - Test `createCampaign` links campaign to entity `campaignIds`
    - _Requirements: 6.8–6.13_

- [ ] 11. School Enrollment industry — data model and server actions
  - [ ] 11.1 Create `src/lib/school-enrollment-actions.ts`
    - `createApplication`, `updateApplicationStatus`, `getApplicationsForEntity`
    - `createEnrollment`, `updateEnrollmentStatus`
    - `createSchoolVisit`, `updateVisitStatus`
    - All actions validate `workspace.industry === 'SchoolEnrollment'`
    - _Requirements: 4.7–4.10_
  - [ ]* 11.2 Write unit tests for `school-enrollment-actions.ts`
    - Test each action rejects non-SchoolEnrollment workspaces
    - Test `createApplication` links to entity `applicationIds`
    - _Requirements: 4.7–4.10_

- [ ] 12. Consultancy industry — data model and server actions
  - [ ] 12.1 Create `src/lib/consultancy-actions.ts`
    - `createDiscovery`, `updateDiscovery`
    - `createEngagement`, `updateEngagement`
    - `createMilestone`, `updateMilestoneStatus`
    - `createOutcome`, `createRetainer`
    - All actions validate `workspace.industry === 'Consultancy'`
    - _Requirements: 9.9–9.15_
  - [ ]* 12.2 Write unit tests for `consultancy-actions.ts`
    - Test each action rejects non-Consultancy workspaces
    - Test `createEngagement` links to entity `engagementIds`
    - _Requirements: 9.9–9.15_

- [ ] 13. Real Estate industry — data model and server actions
  - [ ] 13.1 Create `src/lib/real-estate-actions.ts`
    - `createProperty`, `updateProperty`, `getPropertiesForEntity`
    - `createPropertyPreference`, `createViewing`, `updateViewingStatus`
    - `createOffer`, `updateOfferStatus`
    - `createNegotiation`, `createDeal`, `createPropertyDocument`
    - All actions validate `workspace.industry === 'RealEstate'`
    - _Requirements: 7.7–7.13_
  - [ ]* 13.2 Write unit tests for `real-estate-actions.ts`
    - Test each action rejects non-RealEstate workspaces
    - Test `createProperty` links to entity `propertyIds`
    - _Requirements: 7.7–7.13_

- [ ] 14. Law industry — data model and server actions
  - [ ] 14.1 Create `src/lib/law-actions.ts`
    - `createMatter`, `updateMatterStatus`, `getMattersForEntity`
    - `createIntakeForm`, `createConflictCheck`, `updateConflictCheckStatus`
    - `createConsultation`, `createRelatedParty`, `createLegalDocument`
    - `createTimeEntry`, `getTimeEntriesForMatter`
    - `createCourtDate`, `updateCourtDate`
    - All actions validate `workspace.industry === 'Law'`
    - _Requirements: 5.8–5.15_
  - [ ]* 14.2 Write unit tests for `law-actions.ts`
    - Test each action rejects non-Law workspaces
    - Test `createMatter` links to entity `matterIds`
    - Test `createConflictCheck` sets correct `checkStatus`
    - _Requirements: 5.8–5.15_

- [ ] 15. Checkpoint — All industry server actions complete
  - Ensure all industry action files compile and tests pass with `pnpm test:run`
  - Ask the user if questions arise before proceeding to UI layer

- [ ] 16. Industry-specific permissions system
  - Extend `Permission` type in `src/lib/permissions.ts` with all industry-specific permissions from design
  - Implement `getIndustryPermissions(industry: IndustryVertical): Permission[]` returning base + industry permissions
  - Update `checkPermission` to validate permission is valid for the workspace's industry before role check
  - _Requirements: 16.1–16.10_

- [ ]* 16.1 Write unit tests for permissions
  - Test `getIndustryPermissions('SaaS')` includes `saas_trials_manage`
  - Test `checkPermission` returns `false` for a permission not in the workspace's industry
  - _Requirements: 16.1–16.10_

- [ ] 17. Industry context provider
  - Create `src/context/IndustryContext.tsx` wrapping `WorkspaceContext`
  - Expose `useIndustry()` hook returning `{ industry, terminology, features, pipelineTemplate, sidebarItems }`
  - Derive values from `INDUSTRY_CONFIG[workspace.industry]`
  - _Requirements: 2.4, 13.7, 15.5_

- [ ] 18. Sidebar navigation adaptation
  - Update `src/components/AppSidebar.tsx` (or equivalent) to call `getSidebarItemsForIndustry(workspace.industry)`
  - Replace hardcoded sidebar items with dynamic items from industry config
  - Ensure active route highlighting still works with dynamic items
  - _Requirements: 17.1–17.10_

- [ ] 19. Terminology mapping applied to UI
  - Update entity list page title to use `terminology.entityPlural` from `useIndustry()`
  - Update entity detail page title to use `terminology.entitySingular`
  - Update "Add" button labels, form field labels, and empty-state messages to use terminology map
  - Update error messages to use `getIndustryErrorMessage(errorCode, industry)` from `src/lib/industry-monitoring.ts`
  - _Requirements: 13.1–13.12_

- [ ] 20. Feature gate system
  - Create `src/lib/feature-gate.ts` exporting `isFeatureEnabled(feature: keyof FeatureGate, industry: IndustryVertical): boolean`
  - Create `useFeatureGate()` React hook consuming `useIndustry()`
  - Wrap industry-specific UI panels with `<FeatureGate feature="trials">` component that renders `null` when disabled
  - _Requirements: 15.7–15.9, Design Property 8_

- [ ] 21. Industry selection UI for workspace creation
  - Update workspace creation form (in backoffice) to include industry selection step
  - Display all 6 industry options with icons and descriptions (only show enabled industries via `getEnabledIndustries()`)
  - Require industry selection before form submission
  - Show confirmation dialog with selected industry and scope-lock implications
  - Display industry badge on workspace cards in backoffice list
  - Add industry filter to workspace list
  - _Requirements: 19.1–19.8_

- [ ] 22. Industry-specific pipeline templates
  - In `src/lib/pipeline-actions.ts` (or equivalent), add `createDefaultPipelineForIndustry(workspaceId, industry)` using `INDUSTRY_CONFIG[industry].pipelineTemplate`
  - Call this function automatically when a new workspace is created
  - _Requirements: 14.1–14.10_

- [ ] 23. Firestore security rules for industry collections
  - Update `firestore.rules` with helper `workspaceIndustryMatches(workspaceId, industry)`
  - Add rules for all industry-specific collections: `trials`, `onboarding`, `subscriptions`, `supportTickets`, `healthScores`, `applications`, `enrollments`, `schoolVisits`, `matters`, `conflictChecks`, `timeTracking`, `campaigns`, `deliverables`, `properties`, `viewings`, `offers`, `engagements`, `milestones`
  - Each rule gates read/write on `hasWorkspaceAccess` AND `workspaceIndustryMatches`
  - _Requirements: 10.9, 16.8_

- [ ]* 23.1 Write integration tests for Firestore security rules
  - Use `@firebase/rules-unit-testing` with emulator
  - Test SaaS workspace user cannot read `matters` (Law collection)
  - Test SchoolEnrollment workspace user cannot read `trials` (SaaS collection)
  - Test correct-industry workspace user can read its own industry collections
  - _Requirements: 10.9, Design Property 3_

- [ ] 24. Composite indexes (firestore.indexes.json)
  - Add indexes for `entities` collection: `(organizationId, entityType, status, createdAt)` and `(organizationId, industry, status, createdAt)`
  - Add indexes for `workspace_entities`: `(workspaceId, entityType, status, addedAt)`
  - Add indexes for `workspaces`: `(organizationId, industry, status)`
  - Add indexes for each industry collection: `trials`, `matters`, `campaigns`, `properties`, `engagements` — all on `(workspaceId, entityId, status, createdAt)`
  - _Requirements: 20.1–20.7_

- [ ] 25. Migration script — Phase 1 and 2 (audit and schema extension)
  - Create `scripts/migrate-industry-phase1.ts`
    - Read all `schools` collection documents
    - Read all `entities` with `entityType: institution`
    - Identify and log SaaS-specific fields
    - Validate data integrity; flag anomalies to console
    - Output audit report (counts, anomalies, missing fields)
  - Create `scripts/migrate-industry-phase2.ts`
    - Update all `workspaces` missing `industry` field to default `'SaaS'`
    - Set `industryScopeLocked: false` on workspaces that lack the field
    - _Requirements: 21.1–21.8, 11.2_

- [ ] 26. Migration script — Phase 3 and 4 (data transformation and validation)
  - Create `scripts/migrate-industry-phase3.ts`
    - For each entity with `entityType: institution` and no `industryData`, write `SaaSInstitutionData` mapping legacy fields
    - Set `migrationStatus: 'dual-write'` on transformed entities
    - Process in batches of 500 with progress logging
    - _Requirements: 21.9–21.15_
  - Create `scripts/migrate-industry-phase4.ts`
    - Validate all relationships post-migration
    - Switch `migrationStatus` from `'dual-write'` to `'migrated'` after validation passes
    - Write migration audit log to `migrationAuditLogs` collection
    - _Requirements: 21.16–21.19_

- [ ] 27. Rollback scripts
  - Create `scripts/rollback-industry-migration.ts`
    - Accept `workspaceId` argument
    - Reset `industryScopeLocked: false` on workspace
    - Revert all `workspace_entities` in that workspace to `migrationStatus: 'legacy'`
    - Log `migration_rolled_back` activity
    - _Requirements: 12.2, 12.6_

- [ ] 28. Checkpoint — Infrastructure and migration complete
  - Run `pnpm typecheck` and `pnpm test:run` to confirm all tests pass
  - Verify `firestore.indexes.json` is valid JSON
  - Ask the user if questions arise before proceeding to integration and E2E tests

- [ ] 29. Integration tests for industry workflows
  - [ ]* 29.1 Write integration tests using Firebase emulator
    - Test entity creation triggers workspace scope lock (`industryScopeLocked: true`)
    - Test dual-read adapter falls back to `schools` collection for `migrationStatus: 'legacy'` entities
    - Test industry-specific collection actions write to correct collections
    - _Requirements: 2.2, 11.8–11.10, 22.3_
  - [ ]* 29.2 Write integration tests for migration scripts
    - Test Phase 3 script correctly maps `nominalRoll → companySize`, `subscriptionPackage → planType`
    - Test Phase 4 validation catches missing required fields
    - Test rollback script reverts `migrationStatus` to `'legacy'`
    - _Requirements: 21.9–21.19, 12.2_

- [ ] 30. E2E tests for workspace creation and industry UI
  - [ ]* 30.1 Write Playwright E2E tests for workspace creation flow
    - Test creating a SaaS workspace shows "Accounts" terminology in sidebar and page title
    - Test creating a SchoolEnrollment workspace shows "Schools" terminology
    - Test industry select is disabled after first entity is linked (scope lock UI)
    - _Requirements: 13.1–13.6, 19.1–19.6_
  - [ ]* 30.2 Write Playwright E2E tests for industry feature visibility
    - Test SaaS workspace shows Trials sidebar item; SchoolEnrollment workspace does not
    - Test feature-gated panels are hidden for wrong industry
    - _Requirements: 15.7, 17.1–17.6_

- [ ] 31. Final checkpoint — All tests pass
  - Run `pnpm test:run` (unit + property tests)
  - Run `pnpm test:emulator` (integration tests with Firebase emulator)
  - Run `pnpm typecheck` and `pnpm lint`
  - Ask the user if questions arise before marking the feature complete

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Implementation priority: SaaS (tasks 9) → Marketing (10) → School Enrollment (11) → Consultancy (12) → Real Estate (13) → Law (14)
- All industry server actions must validate `workspace.industry` before writing to industry-specific collections
- The `schools` collection must remain intact throughout migration for the 90-day rollback window
- Property tests use `fast-check` with minimum 100 iterations per property
- Each property test references its design document property number in a comment: `// Feature: industry-scoped-entity-expansion, Property N: <text>`
