# Feature: Tag System

## 1. Purpose
A comprehensive categorization and organizational system enabling users to label, segment, and categorize contacts and entities across the platform. The tag system allows for robust metadata management with support for operational tagging, automation triggering, and extensive filtering.

## 2. Core Infrastructure (Configuration)

### Tag Management
- **Tag Entity**: Defined by name, color, and category (e.g., `status`, `segment`, `priority`, `marketing`).
- **Workspace Scoping**: Tags are managed at the workspace level, keeping datasets partitioned and relevant to specific operational contexts.
- **System Tags**: Read-only tags generated automatically by system logic that handle fundamental data boundaries.

### Display Components
- **Tag Selector**: A fully-featured dropdown that supports finding, creating, and applying tags in real-time with keyboard navigation support.
- **Tag Badges**: Lightweight renderers that safely display tags across tables, profiles, and lists with their designated background colors.

---

## 3. Operations (Execution)

### Bulk Operations
- **Mass Assignment**: The `BulkTagOperations` component enables assigning or removing tags from multiple contacts or entities simultaneously, streamlining data management tasks for large imports.

### Intelligence & Cleanup
- **Tag Merge**: Consolidate duplicate or redundant tags into a single unified tag with `TagMergeDialog`, automatically cleaning up associations across connected records.
- **Tag Cleanup Tools**: Identifying and managing orphaned or unutilized tags.
- **Usage Dashboard**: Visual analytics (`TagUsageDashboard`) tracking tag popularity, most used tags, and general tag distribution across the workspace. 

### Auditing & Security
- **Audit Logs**: Provides a historical trail of who applied or removed tags to what entities at what time (`TagAuditLogViewer`), answering the question "Why is this tag here?"

---

## 4. System Integrations
- **Advanced Filtering**: Use `TagFilter` to dynamically filter vast datasets of contacts or institutions using inclusive (AND/OR) and exclusive (NOT) logical operators.
- **Automations Engine**: Fully integrated as trigger conditions in the automation engine structure (i.e. firing actions when a specific tag is applied/removed via `TagConditionNode` and `TagActionNode`).
- **Contextual Bindings**: Deep linkages inside the tagging structure track operational history tied to entities (Organizations, Schools, Focal Persons).
