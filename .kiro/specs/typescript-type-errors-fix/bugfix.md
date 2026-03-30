# Bugfix Requirements Document

## Introduction

The application has 312 TypeScript type errors across 54 files preventing successful builds. These errors stem from type mismatches between null/undefined, missing required properties on types, incorrect function signatures, and type incompatibilities. The errors primarily affect test files and business logic modules, blocking the build process and preventing deployment.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `assignedTo` property is set to `null` on `WorkspaceEntity` objects THEN the system rejects it with error "Type 'null' is not assignable to type '{ userId: string | null; name: string | null; email: string | null; } | undefined'"

1.2 WHEN `ResolvedContact` objects are created in test files without the `tags` property THEN the system reports "Property 'tags' is missing in type ... but required in type 'ResolvedContact'"

1.3 WHEN `School` type objects are created with `workspaceId` property THEN the system reports "Object literal may only specify known properties, but 'workspaceId' does not exist in type 'School'. Did you mean to write 'workspaceIds'?"

1.4 WHEN `School` type objects are created with `updatedAt` property THEN the system reports "Object literal may only specify known properties, and 'updatedAt' does not exist in type 'School'"

1.5 WHEN `School` type objects are created without required properties (`status`, `schoolStatus`, `pipelineId`, `createdAt`) THEN the system reports "Type ... is missing the following properties from type 'School': status, schoolStatus, pipelineId, createdAt"

1.6 WHEN `entityId` or `entityType` properties with value `null` are assigned to types expecting `string | undefined` or `EntityType | undefined` THEN the system reports "Type 'null' is not assignable to type 'string | undefined'" or similar

1.7 WHEN `linkEntityToWorkspaceAction` mock is created without `scopeLocked` property THEN the system reports "Property 'scopeLocked' is missing in type ... but required in type ..."

1.8 WHEN `Workspace` objects are created without `status` and `statuses` properties THEN the system reports "Type ... is missing the following properties from type 'Workspace': status, statuses"

1.9 WHEN `InstitutionData` objects are created with `focalPersons` property THEN the system reports "Object literal may only specify known properties, and 'focalPersons' does not exist in type 'InstitutionData'"

1.10 WHEN `firestore` is imported from '@/firebase/config' THEN the system reports "Module '"@/firebase/config"' has no exported member 'firestore'"

1.11 WHEN `resolveContact` function is called in `messaging-actions.ts` THEN the system reports "Cannot find name 'resolveContact'"

1.12 WHEN `MigrationEngine` is imported from './migration-types' THEN the system reports "Module '"./migration-types"' has no exported member 'MigrationEngine'"

1.13 WHEN `TaskCategory` value 'follow_up' is used THEN the system reports "Type '"follow_up"' is not assignable to type 'TaskCategory'"

1.14 WHEN meeting name 'Kickoff Meeting' is used THEN the system reports "Type '"Kickoff Meeting"' is not assignable to type '"Parent Engagement" | "Kickoff" | "Training'""

1.15 WHEN `EntitySettings` objects are created with `organizationId` or `settings` properties THEN the system reports these properties don't exist on the type

1.16 WHEN `School.status` is compared to 'archived' THEN the system reports "This comparison appears to be unintentional because the types 'SchoolStatusState' and '"archived"' have no overlap"

1.17 WHEN `modules` array contains string values like 'billing' or 'admissions' THEN the system reports "Type 'string' is not assignable to type '{ id: string; name: string; abbreviation: string; color: string; }'"

1.18 WHEN `ContactIdentifier` with nullable `schoolId` is passed to `resolveContact` THEN the system reports "Type 'string | null | undefined' is not assignable to type 'string | undefined'"

### Expected Behavior (Correct)

2.1 WHEN `assignedTo` property is set to `null` on `WorkspaceEntity` objects THEN the system SHALL accept it as a valid value (type should be `{ userId: string | null; name: string | null; email: string | null; } | undefined | null`)

2.2 WHEN `ResolvedContact` objects are created in test files THEN the system SHALL accept them with the `tags` property included (or make `tags` optional if appropriate)

2.3 WHEN `School` type objects are created with `workspaceId` property THEN the system SHALL accept it (add `workspaceId` to `School` type or use correct property name)

2.4 WHEN `School` type objects are created with `updatedAt` property THEN the system SHALL accept it (add `updatedAt` to `School` type)

2.5 WHEN `School` type objects are created in tests THEN the system SHALL accept them with all required properties provided or make properties optional where appropriate

2.6 WHEN `entityId` or `entityType` properties with value `null` are assigned THEN the system SHALL accept them (types should allow `null` in addition to `undefined`)

2.7 WHEN `linkEntityToWorkspaceAction` mock is created THEN the system SHALL accept it with `scopeLocked` property included in the return type

2.8 WHEN `Workspace` objects are created in tests THEN the system SHALL accept them with `status` and `statuses` properties included or make these optional

2.9 WHEN `InstitutionData` objects are created THEN the system SHALL accept them without `focalPersons` property (remove from test or add to type)

2.10 WHEN `firestore` is imported from '@/firebase/config' THEN the system SHALL successfully import it (export `firestore` from the module)

2.11 WHEN `resolveContact` function is called in `messaging-actions.ts` THEN the system SHALL find the function (import it or use correct function name)

2.12 WHEN `MigrationEngine` is imported from './migration-types' THEN the system SHALL successfully import it (export `MigrationEngine` from the module)

2.13 WHEN `TaskCategory` value 'follow_up' is used THEN the system SHALL accept it (add 'follow_up' to `TaskCategory` enum or use correct value)

2.14 WHEN meeting name 'Kickoff Meeting' is used THEN the system SHALL accept it (use 'Kickoff' or update the type to allow 'Kickoff Meeting')

2.15 WHEN `EntitySettings` objects are created THEN the system SHALL accept them with correct properties matching the type definition

2.16 WHEN `School.status` is compared to 'archived' THEN the system SHALL perform a valid comparison (add 'archived' to `SchoolStatusState` type or use correct status value)

2.17 WHEN `modules` array is created THEN the system SHALL accept module objects with correct structure or string values if type allows

2.18 WHEN `ContactIdentifier` is passed to `resolveContact` THEN the system SHALL accept identifiers with nullable properties (update type to allow `null`)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN valid TypeScript code with correct types is compiled THEN the system SHALL CONTINUE TO compile successfully without errors

3.2 WHEN runtime behavior of functions is executed THEN the system SHALL CONTINUE TO function correctly with the same logic

3.3 WHEN existing tests with correct type usage are run THEN the system SHALL CONTINUE TO pass without modification

3.4 WHEN production code with proper type definitions is built THEN the system SHALL CONTINUE TO build successfully

3.5 WHEN type inference is used in correctly typed code THEN the system SHALL CONTINUE TO infer types accurately

3.6 WHEN optional properties are omitted from object literals THEN the system SHALL CONTINUE TO accept them as valid

3.7 WHEN union types are used correctly THEN the system SHALL CONTINUE TO accept all valid union members

3.8 WHEN generic types are properly constrained THEN the system SHALL CONTINUE TO enforce type safety correctly
