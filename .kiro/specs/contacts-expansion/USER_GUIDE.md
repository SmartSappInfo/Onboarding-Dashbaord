# SmartSapp Contacts Expansion - User Guide

**Version**: 1.0  
**Last Updated**: January 2025  
**Audience**: SmartSapp End Users, Workspace Administrators

---

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding Workspace Scopes](#understanding-workspace-scopes)
3. [Entity Types](#entity-types)
4. [Creating and Managing Workspaces](#creating-and-managing-workspaces)
5. [Working with Contacts](#working-with-contacts)
6. [Workspace Capabilities](#workspace-capabilities)
7. [Import and Export](#import-and-export)
8. [Tags: Global vs Workspace](#tags-global-vs-workspace)
9. [Multi-Workspace Contacts](#multi-workspace-contacts)
10. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

SmartSapp's contacts expansion transforms how you manage contacts by introducing **workspace scopes**. Instead of managing only schools, you can now create workspaces tailored to three distinct contact types:

- **Institutions** (schools, organizations)
- **Families** (guardians and children)
- **People** (individual leads and contacts)

Each workspace declares exactly one scope, and that scope determines the data fields, UI, workflows, and features available in that workspace.

### Key Benefits

- **Tailored Workflows**: Each workspace shows only the fields and features relevant to its contact type
- **Data Clarity**: No more irrelevant fields cluttering your forms
- **Flexible Organization**: Create separate workspaces for different business units (e.g., Sales manages institutions, Admissions manages families)
- **Independent Operations**: The same contact can exist in multiple workspaces with different pipeline stages and tags

---

## Understanding Workspace Scopes

### What is a Workspace Scope?

A **workspace scope** is the declared contact type that a workspace manages. Every workspace has exactly one scope:

- **Institution Scope**: For managing schools, districts, or organizational clients
- **Family Scope**: For managing families with guardians and children
- **Person Scope**: For managing individual leads, consultants, or contacts

### Scope Rules

1. **One Scope Per Workspace**: Each workspace can only manage one type of contact
2. **Scope is Locked After First Contact**: Once you add the first contact to a workspace, the scope cannot be changed
3. **Contacts Must Match Scope**: You can only add contacts that match the workspace's scope (e.g., you cannot add a family to an institution workspace)

### Visual Indicators

- **Workspace Switcher**: Shows a badge next to each workspace name ("Schools", "Families", or "People")
- **Workspace Settings**: Displays "This workspace manages [scope type]. Only [scope type] records can exist here."
- **Contact Detail Pages**: Show an entity type badge prominently

---

## Entity Types

### Institution

**Use Case**: Managing schools, districts, educational organizations, or institutional clients

**Key Fields**:
- Name and slug (for public URLs)
- Nominal roll (student count)
- Subscription package and rate
- Billing address and currency
- Focal persons (Principal, Accountant, Administrator, School Owner)
- Contract signatory
- Implementation date
- Modules enabled

**Typical Workflows**:
- Onboarding pipeline
- Contract renewal
- Billing and invoicing
- Subscription management

### Family

**Use Case**: Managing families in admissions, enrollment, or family engagement workflows

**Key Fields**:
- Family name
- Guardians (name, phone, email, relationship, primary designation)
- Children (first name, last name, date of birth, grade level, enrollment status)
- Admissions data

**Typical Workflows**:
- Admissions pipeline
- Child progression tracking
- Family engagement
- Enrollment management

### Person

**Use Case**: Managing individual leads, consultants, or personal contacts

**Key Fields**:
- First name and last name (required)
- Company and job title
- Lead source
- Phone and email

**Typical Workflows**:
- Sales pipeline
- Lead nurturing
- Follow-up tasks
- Deal management

---

## Creating and Managing Workspaces

### Creating a New Workspace

1. Navigate to **Workspace Settings**
2. Click **Create New Workspace**
3. Enter workspace name
4. **Select Contact Scope**: Choose Institution, Family, or Person
5. Review the warning: "Scope cannot be changed after the first contact is added"
6. Configure capabilities (see [Workspace Capabilities](#workspace-capabilities))
7. Click **Create Workspace**

### Changing Workspace Scope

**Before First Contact**: You can change the scope freely in workspace settings

**After First Contact**: The scope is **locked** and cannot be changed. You'll see:
- A lock icon next to the scope field
- Tooltip: "Scope is locked because this workspace has active contacts"
- Error message if you attempt to change it: "Scope cannot be changed after activation"

**Why?**: Changing scope after contacts exist would break forms, automations, pipelines, and templates that depend on scope-specific fields.

**Solution**: If you need a different scope, create a new workspace and migrate contacts intentionally.

### Switching Between Workspaces

1. Click the **Workspace Switcher** in the top navigation
2. Select the workspace you want to switch to
3. The UI will automatically adapt to show the correct fields and features for that workspace's scope

**Note**: Each workspace maintains independent data for the same contact (pipeline stage, tags, assignee).

---

## Working with Contacts

### Creating Contacts

#### Institution Contact

1. Navigate to an institution workspace
2. Click **Add Contact** or **New Institution**
3. Fill in required fields:
   - Name
   - At least one focal person (name, phone, email, type)
4. Fill in optional fields:
   - Nominal roll
   - Subscription package
   - Billing address
   - Currency
5. Click **Save**

#### Family Contact

1. Navigate to a family workspace
2. Click **Add Contact** or **New Family**
3. Fill in required fields:
   - Family name
   - At least one guardian (name, phone, email, relationship)
4. Add children (optional):
   - First name, last name
   - Date of birth
   - Grade level
   - Enrollment status
5. Click **Save**

#### Person Contact

1. Navigate to a person workspace
2. Click **Add Contact** or **New Person**
3. Fill in required fields:
   - First name
   - Last name
4. Fill in optional fields:
   - Company
   - Job title
   - Lead source
   - Phone
   - Email
5. Click **Save**

### Viewing Contact Details

Contact detail pages automatically adapt to show relevant information:

**Institution Detail Page**:
- Profile header with name and slug
- Focal persons list
- Pipeline stage (from current workspace)
- Tags (workspace + global)
- Tasks
- Activity timeline
- Billing summary
- Contracts

**Family Detail Page**:
- Family name
- Guardians list
- Children list
- Admissions pipeline stage
- Tags (workspace + global)
- Tasks
- Activity timeline

**Person Detail Page**:
- Full name
- Company and job title
- Lead source
- Pipeline stage
- Tags (workspace + global)
- Tasks
- Activity timeline

### Editing Contacts

1. Open the contact detail page
2. Click **Edit** or click on any editable field
3. Make your changes
4. Click **Save**

**Note**: Changes to identity fields (name, contacts, phone, email) are reflected across all workspaces where the contact exists.

### Deleting Contacts

1. Open the contact detail page
2. Click **More Actions** → **Delete**
3. Confirm deletion

**Note**: Deleting a contact from one workspace does not delete it from other workspaces. To completely remove a contact, delete it from all workspaces.

---

## Workspace Capabilities

Capabilities are feature flags that control which modules are enabled in a workspace. They are **independent of scope** — you can enable or disable features regardless of the workspace's contact type.

### Available Capabilities

| Capability | Description | Typical Use |
|------------|-------------|-------------|
| **Billing** | Invoicing, billing periods, subscription management | Institution workspaces managing school subscriptions |
| **Admissions** | Admissions pipeline, application tracking | Family workspaces managing enrollment |
| **Children** | Children management section on family contacts | Family workspaces tracking child progression |
| **Contracts** | Contract management, signatory designation | Institution workspaces managing agreements |
| **Messaging** | Message composer, SMS/email campaigns | Any workspace needing communication |
| **Automations** | Automation rules, triggers, actions | Any workspace needing workflow automation |
| **Tasks** | Task management, task assignments | Any workspace needing task tracking |

### Configuring Capabilities

1. Navigate to **Workspace Settings**
2. Scroll to **Capabilities** section
3. Toggle capabilities on or off
4. Click **Save Changes**

**Example**: An institution workspace focused only on sales might disable billing and contracts capabilities to simplify the UI.

---

## Import and Export

### Import Templates

SmartSapp provides scope-specific CSV import templates. You must use the correct template for your workspace's scope.

#### Institution Import Template

**Required Columns**:
- `name`

**Optional Columns**:
- `nominalRoll`
- `billingAddress`
- `currency`
- `subscriptionPackageId`
- `focalPerson_name`
- `focalPerson_phone`
- `focalPerson_email`
- `focalPerson_type` (Principal, Accountant, Administrator, School Owner)

**Example**:
```csv
name,nominalRoll,billingAddress,currency,focalPerson_name,focalPerson_phone,focalPerson_email,focalPerson_type
Greenwood Academy,850,"123 Main St, Springfield",USD,Jane Smith,555-0100,jane@greenwood.edu,Principal
```

#### Family Import Template

**Required Columns**:
- `familyName`

**Optional Columns**:
- `guardian1_name`
- `guardian1_phone`
- `guardian1_email`
- `guardian1_relationship` (Father, Mother, Legal Guardian)
- `child1_firstName`
- `child1_lastName`
- `child1_gradeLevel`

**Example**:
```csv
familyName,guardian1_name,guardian1_phone,guardian1_email,guardian1_relationship,child1_firstName,child1_lastName,child1_gradeLevel
Smith Family,John Smith,555-0200,john@example.com,Father,Emma,Smith,5
```

#### Person Import Template

**Required Columns**:
- `firstName`
- `lastName`

**Optional Columns**:
- `company`
- `jobTitle`
- `leadSource`
- `phone`
- `email`

**Example**:
```csv
firstName,lastName,company,jobTitle,leadSource,phone,email
Sarah,Johnson,EduConsult LLC,Senior Consultant,Referral,555-0300,sarah@educonsult.com
```

### Importing Contacts

1. Navigate to the workspace where you want to import contacts
2. Click **Import** → **Import from CSV**
3. Download the appropriate template for your workspace's scope
4. Fill in the template with your data
5. Upload the completed CSV file
6. Review the **Import Preview** (first 10 rows)
7. Check for validation errors
8. Click **Confirm Import**

**Validation Rules**:
- The import will reject rows that don't match the workspace's scope
- Duplicate contacts (same name + organization) will be skipped
- Invalid data will be reported with row number and error reason
- The import continues processing even if some rows fail

### Exporting Contacts

1. Navigate to the workspace you want to export from
2. Click **Export** → **Export to CSV**
3. Select filters (optional):
   - Pipeline stage
   - Assigned to
   - Tags
   - Date range
4. Click **Export**
5. Download the CSV file

**Round-Trip Safety**: Exported CSV files use the same format as import templates, so you can re-import them without modification.

---

## Tags: Global vs Workspace

SmartSapp separates tags into two types:

### Global Tags

**Stored On**: Entity (contact identity)  
**Visible In**: All workspaces where the contact exists  
**Use Case**: Identity-level labels that apply across all contexts

**Examples**:
- `vip`
- `strategic-account`
- `high-priority`
- `board-member`

**How to Apply**:
1. Open contact detail page
2. Click **Add Tag**
3. Select a tag marked as "Global"
4. The tag appears on the contact in all workspaces

### Workspace Tags

**Stored On**: Workspace-entity relationship  
**Visible In**: Only the current workspace  
**Use Case**: Operational labels specific to one workspace's workflow

**Examples**:
- `billing-overdue` (in Finance workspace)
- `contract-renewal-pending` (in Sales workspace)
- `admissions-interview-scheduled` (in Admissions workspace)

**How to Apply**:
1. Open contact detail page in a specific workspace
2. Click **Add Tag**
3. Select a tag marked as "Workspace"
4. The tag appears only in the current workspace

### Tag Management

**Creating Tags**:
1. Navigate to **Settings** → **Tags**
2. Click **Create Tag**
3. Enter tag name and color
4. Select **Scope**: Global or Workspace
5. Click **Save**

**Tag Scope Indicator**: The tag management UI displays a "Scope" column showing whether each tag is "Global" or "Workspace".

---

## Multi-Workspace Contacts

### What Are Multi-Workspace Contacts?

A contact can exist in multiple workspaces simultaneously. Each workspace maintains **independent operational state**:

- **Independent Pipeline Stage**: The contact can be at "Contract Review" in the Onboarding workspace and "Invoice Overdue" in the Billing workspace
- **Independent Assignee**: Different team members can be assigned in different workspaces
- **Independent Workspace Tags**: Tags applied in one workspace don't appear in another
- **Shared Identity Data**: Name, phone, email, and global tags are shared across all workspaces

### Use Cases

**Example 1: School in Multiple Workspaces**
- **Sales Workspace**: Pipeline stage = "Negotiation", Assigned to = Sales Rep A
- **Onboarding Workspace**: Pipeline stage = "Implementation", Assigned to = Onboarding Manager B
- **Billing Workspace**: Pipeline stage = "Active Subscription", Assigned to = Finance Rep C

**Example 2: Consultant Working with Multiple Schools**
- Create a **Person** entity for the consultant
- Link the consultant to multiple **Institution** workspaces
- Each institution workspace tracks the consultant's relationship with that specific school

### Linking Contacts to Multiple Workspaces

1. Open the contact detail page in any workspace
2. Click **Link to Workspace**
3. Select the target workspace
4. **Scope Validation**: The system will reject the link if the contact's type doesn't match the target workspace's scope
5. Click **Confirm**

The contact now appears in both workspaces with independent operational state.

### Viewing Multi-Workspace Contacts

**Shared Contacts Report**:
1. Navigate to **Reports** → **Shared Contacts**
2. View all contacts that exist in 2+ workspaces
3. See per-workspace stage and assignee for each

---

## Frequently Asked Questions

### Can I change a workspace's scope after creating it?

**Before adding contacts**: Yes, you can change the scope freely in workspace settings.

**After adding contacts**: No, the scope is locked. You'll need to create a new workspace with the desired scope and migrate contacts manually.

### What happens if I try to add a family to an institution workspace?

The system will reject the operation with an error: "Family records cannot be added to a workspace that manages Schools." This is enforced by the **ScopeGuard** validation rule.

### Can I have both institution and family contacts in the same workspace?

No. Each workspace can only manage one type of contact. If you need to manage both, create two separate workspaces: one with institution scope and one with family scope.

### What's the difference between global tags and workspace tags?

- **Global tags** are stored on the contact's identity and visible in all workspaces
- **Workspace tags** are stored on the workspace-contact relationship and visible only in that workspace

### Can I import contacts from a CSV file?

Yes! Use the scope-specific import template for your workspace. Download the template from the import wizard, fill it in, and upload it.

### What happens to my existing school contacts?

All existing school contacts continue to work via a backward-compatible adapter layer. They will be migrated to the new entity system during the deployment migration window.

### Can the same person appear as both a focal person and a standalone contact?

Yes. For example, a principal can be a focal person on an institution entity AND a standalone person entity. These are treated as separate records until you explicitly create a relationship between them (future feature).

### How do I know which workspace I'm currently in?

The workspace name appears in the top navigation bar, along with a scope badge ("Schools", "Families", or "People").

### Can I disable features I don't need?

Yes! Use the **Capabilities** toggles in workspace settings to enable or disable modules like billing, admissions, messaging, etc.

### What happens if I delete a contact from one workspace?

The contact is removed from that workspace only. If the contact exists in other workspaces, it remains there. To completely delete a contact, remove it from all workspaces.

---

## Getting Help

If you have questions or encounter issues:

1. **In-App Help**: Click the help icon (?) in the top navigation
2. **Support Email**: support@smartsapp.com
3. **Documentation**: Visit docs.smartsapp.com
4. **Training Videos**: Available in the Help Center

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: March 2025
