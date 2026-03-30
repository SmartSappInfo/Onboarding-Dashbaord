# Product Overview

SmartSapp is a multi-tenant CRM and onboarding platform for educational institutions. The system manages institutional relationships, family admissions, and individual contacts through a unified entity model.

## Core Capabilities

- Multi-workspace contact management (institutions, families, persons)
- Pipeline-based onboarding and lifecycle tracking
- Survey and PDF form builder with conditional logic
- Contract management and digital signatures
- Automated messaging and workflow engine
- Tag-based segmentation (global identity tags + workspace-scoped operational tags)
- Billing and invoicing with customizable profiles
- Activity logging and audit trails
- AI-powered content generation (Genkit integration)

## Key Concepts

- **Organizations**: Top-level tenant for branding, billing, and governance
- **Workspaces**: Operational partitions within an organization (e.g., "Admissions", "Billing")
- **Entities**: Unified contact model supporting institutions, families, and persons
- **Pipelines**: Customizable stages for tracking contact lifecycle
- **Tags**: Two-tier system - global identity tags (cross-workspace) and workspace-scoped operational tags

## Migration Context

The codebase is actively migrating from a legacy `schools` collection to a unified `entities` + `workspace_entities` model. Code should handle both legacy and migrated data using the adapter layer pattern.
