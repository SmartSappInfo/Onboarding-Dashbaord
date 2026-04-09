# Product Overview

SmartSapp is a comprehensive multi-tenant CRM and onboarding platform designed specifically for educational institutions. The system provides end-to-end management of institutional relationships, family admissions, and individual contacts through a unified entity architecture with advanced workflow automation and AI-powered features.

---

## Core Value Proposition

SmartSapp enables educational organizations to:
- Streamline student onboarding and admissions processes
- Manage complex multi-institutional relationships
- Automate communication and workflow tasks
- Track engagement through customizable pipelines
- Generate insights through activity logging and analytics
- Scale operations across multiple workspaces and teams

---

## System Architecture

### Multi-Tenancy Model

**Three-Tier Hierarchy**:
1. **Organizations** - Top-level tenant for branding, billing, and governance
2. **Workspaces** - Operational partitions within an organization (e.g., "Admissions", "Billing", "Alumni")
3. **Entities** - Contacts and institutions managed within workspaces

**Key Features**:
- Organization-level settings and branding
- Workspace isolation for different departments/functions
- Cross-workspace entity visibility with shared data
- Role-based access control at organization and workspace levels

### Entity Model

**Unified Contact Architecture**:
- **Institutions** - Schools, universities, educational organizations
- **Families** - Parent/guardian groups with multiple children
- **Persons** - Individual contacts (students, parents, staff)

**Data Structure**:
- `entities` collection - Global identity and core attributes
- `workspace_entities` collection - Workspace-specific state (pipeline, stage, tags)
- Dual-tier tagging: global identity tags + workspace-scoped operational tags

---

## Core Capabilities

### 1. Contact & Relationship Management

**Institutional Management**:
- School/institution profiles with branding (logo, colors)
- Focal person management with signatory designation
- Billing profiles and subscription tracking
- Nominal roll (student count) tracking
- Multi-workspace visibility for shared institutions

**Family & Person Management**:
- Family grouping with parent-child relationships
- Individual contact profiles with custom fields
- Contact history and interaction tracking
- Duplicate detection and merging

**Features**:
- Advanced search and filtering
- Bulk operations (import, export, tag, assign)
- Zone-based geographic organization
- Status management (Active, Inactive, Archived)

### 2. Pipeline & Lifecycle Tracking

**Customizable Pipelines**:
- Multi-stage workflows for different processes
- Visual pipeline boards (Kanban-style)
- Stage-specific automation triggers
- Pipeline templates for common workflows

**Stage Management**:
- Drag-and-drop stage progression
- Stage-specific fields and requirements
- Automated stage transitions based on rules
- Stage duration tracking and analytics

**Track System**:
- Prospect tracking (lead generation)
- Onboarding tracking (admissions process)
- Custom tracks for different workflows
- Track conversion protocols

### 3. Forms & Data Collection

**Survey Builder**:
- Drag-and-drop form designer
- Conditional logic and branching
- Multiple question types (text, choice, rating, file upload)
- Response validation and required fields
- Anonymous or authenticated responses
- Response analytics and export

**PDF Form Builder**:
- Template-based PDF generation
- Dynamic field mapping
- Digital signature collection
- Form versioning and templates
- Bulk form generation

**Contract Management**:
- Contract templates with variables
- Digital signature workflows
- Contract status tracking
- Automated reminders and follow-ups
- Contract archival and retrieval

### 4. Messaging & Communication

**Multi-Channel Messaging**:
- Email campaigns (individual and bulk)
- SMS messaging (individual and bulk)
- WhatsApp integration
- In-app notifications

**Message Composer**:
- Rich text editor with templates
- Entity selector with filtering
- Attachment support
- Scheduled sending
- Delivery tracking and analytics

**Automation Engine**:
- Trigger-based messaging (stage change, date, action)
- Drip campaigns and sequences
- Conditional messaging logic
- A/B testing support
- Unsubscribe management

### 5. Tagging & Segmentation

**Two-Tier Tag System**:

**Global Identity Tags** (Cross-workspace):
- Persistent attributes (e.g., "VIP", "Alumni", "Scholarship")
- Shared across all workspaces
- Organization-level management
- Used for identity and classification

**Workspace Tags** (Operational):
- Workspace-specific labels (e.g., "Follow-up Needed", "Payment Pending")
- Scoped to individual workspaces
- Used for workflow and segmentation
- Temporary or process-specific

**Tag Features**:
- Tag categories for organization
- Color coding and icons
- Bulk tagging operations
- Tag-based filtering and search
- Tag analytics and usage tracking

### 6. Automation & Workflows

**Automation Engine**:
- Event-driven triggers (stage change, date, field update)
- Multi-step workflow sequences
- Conditional logic and branching
- Delay and scheduling controls
- Action types: send message, update field, assign user, create task

**Automation Processor**:
- Background job processing
- Retry logic for failed actions
- Execution logging and monitoring
- Performance optimization

**Common Automation Scenarios**:
- Welcome sequences for new contacts
- Follow-up reminders based on stage
- Birthday/anniversary messages
- Payment reminders
- Re-engagement campaigns

### 7. Billing & Invoicing

**Billing Profiles**:
- Customizable billing rates per institution
- Subscription package management
- Currency support (multi-currency)
- Billing cycle configuration

**Invoice Management**:
- Automated invoice generation
- Invoice templates with branding
- Payment tracking and reconciliation
- Overdue notifications
- Invoice history and reporting

**Features**:
- Bulk invoice generation
- Payment method tracking
- Credit/debit notes
- Tax calculation support

### 8. Activity Logging & Audit Trails

**Comprehensive Activity Tracking**:
- User actions (create, update, delete)
- System events (automation, stage change)
- Communication logs (messages sent, opened)
- Form submissions and responses
- Meeting and interaction logs

**Activity Types**:
- `school_created`, `school_updated`, `school_deleted`
- `pipeline_stage_changed`, `status_changed`
- `user_assigned`, `tag_added`, `tag_removed`
- `message_sent`, `message_opened`, `message_clicked`
- `form_submitted`, `contract_signed`
- `meeting_scheduled`, `meeting_completed`

**Features**:
- Real-time activity feeds
- Filterable activity history
- Export for compliance
- Retention policies

### 9. User & Team Management

**User Roles**:
- Super Admin (cross-organization access)
- Organization Admin (organization-level management)
- Workspace Admin (workspace-level management)
- Team Member (assigned contacts and tasks)
- Viewer (read-only access)

**Assignment System**:
- Contact assignment to users
- Workload balancing
- Assignment history tracking
- Reassignment workflows

**Team Collaboration**:
- Shared notes and comments
- @mentions and notifications
- Task assignment and tracking
- Team activity feeds

### 10. AI-Powered Features

**Genkit Integration**:
- AI-powered content generation
- Message template suggestions
- Form question generation
- Response analysis and insights

**AI Architect**:
- Intelligent school profile creation
- Data enrichment from minimal input
- Automated field population
- Smart recommendations

### 11. Reporting & Analytics

**Dashboard Analytics**:
- Pipeline conversion metrics
- Stage duration analysis
- User performance tracking
- Tag distribution insights
- Message engagement metrics

**Custom Reports**:
- Filterable data views
- Export to CSV/Excel
- Scheduled report delivery
- Visual charts and graphs

### 12. Import & Export

**Bulk Import**:
- CSV/Excel file upload
- Field mapping interface
- Validation and error handling
- Duplicate detection
- Import history and rollback

**Data Export**:
- Filtered data export
- Multiple format support (CSV, Excel, JSON)
- Scheduled exports
- API access for integrations

---

## Technical Features

### Performance & Scalability

- Firebase Firestore for real-time data sync
- Optimized queries with composite indexes
- Lazy loading and pagination
- Caching strategies (LRU cache with TTL)
- Background job processing

### Security & Compliance

- Firebase Authentication with role-based access
- Firestore security rules for data isolation
- Audit logging for compliance
- Data encryption at rest and in transit
- GDPR-compliant data handling

### User Experience

- Responsive design (mobile, tablet, desktop)
- Dark mode support
- Keyboard shortcuts
- Drag-and-drop interfaces
- Real-time updates
- Toast notifications
- Undo/redo functionality

### Integrations

- Firebase services (Auth, Firestore, Storage)
- Google Genai for AI features
- Email service providers
- SMS gateways
- WhatsApp Business API
- Sentry for error tracking and monitoring

---

## Key Workflows

### 1. Institutional Onboarding

1. Lead capture (manual entry, import, or AI Architect)
2. Initial contact and qualification
3. Pipeline progression through stages
4. Form and contract collection
5. Payment processing
6. Onboarding completion
7. Conversion to active status

### 2. Family Admissions

1. Family profile creation
2. Student information collection
3. Document submission via forms
4. Application review and approval
5. Contract signing
6. Payment processing
7. Enrollment confirmation

### 3. Bulk Communication Campaign

1. Define target audience (filters, tags, pipeline stage)
2. Create message content (email/SMS/WhatsApp)
3. Schedule or send immediately
4. Track delivery and engagement
5. Follow-up based on responses
6. Analyze campaign performance

### 4. Automated Workflow

1. Define trigger event (stage change, date, field update)
2. Configure workflow steps (delays, conditions, actions)
3. Test workflow with sample data
4. Activate workflow
5. Monitor execution and performance
6. Optimize based on results

---

## Migration Context

### Current State

The codebase is actively migrating from a legacy `schools` collection to a unified `entities` + `workspace_entities` model.

**Legacy Model**:
- Single `schools` collection with all data
- Workspace association via `workspaceIds` array
- Limited entity type support

**New Unified Model**:
- `entities` collection - Global identity and core attributes
- `workspace_entities` collection - Workspace-specific state
- Support for institutions, families, and persons
- Better data isolation and scalability

**Migration Strategy**:
- Dual-read pattern via contact adapter layer
- Gradual migration with `migrationStatus` field
- Backward compatibility maintained
- Rollback capability for safety

**Code Considerations**:
- Always use contact adapter for reads
- Check `migrationStatus` field before operations
- Support both legacy and new model in queries
- Implement dual-write for new records

---

## User Personas

### 1. Admissions Officer
- Manages prospect pipeline
- Conducts outreach campaigns
- Tracks application progress
- Schedules meetings and follow-ups

### 2. Billing Manager
- Generates invoices
- Tracks payments
- Manages subscription packages
- Handles billing disputes

### 3. Operations Manager
- Oversees team performance
- Analyzes pipeline metrics
- Configures workflows and automation
- Manages workspace settings

### 4. Organization Admin
- Manages multiple workspaces
- Configures organization settings
- Oversees user access and roles
- Reviews system-wide analytics

### 5. Super Admin
- Manages multiple organizations
- System configuration and maintenance
- Data migration and cleanup
- Technical troubleshooting

---

## Future Roadmap Considerations

- Mobile app for field staff
- Advanced AI features (predictive analytics, chatbots)
- Integration marketplace
- Custom field builder
- Advanced reporting and BI tools
- Multi-language support
- Calendar and scheduling integration
- Document management system
- Parent/student portal
