# Unified Organization & Workspace Switcher Implementation

## Overview

This document outlines the implementation of a unified organization and workspace switcher that consolidates context management into the app title area, replacing the previous separate switchers.

## Key Features

### 1. Unified Switcher Component
- **Location**: App header (title area) next to the logo
- **Display**: Shows organization logo/name and current workspace
- **Functionality**: Single dropdown for switching both organizations and workspaces

### 2. Organization Management
- **New Page**: `/admin/settings/organizations`
- **Features**:
  - Create/edit organizations
  - Set organization logo, contact info, and default settings
  - Archive/delete organizations (with dependency checks)
  - View all organizations (super admin only)

### 3. Workspace Management (Enhanced)
- **Filtered by Organization**: Workspaces now filtered by active organization
- **Organization Context**: Shows which organization's workspaces are being managed
- **Auto-assignment**: New workspaces automatically assigned to active organization

### 4. Auto-selection Behavior
- When switching organizations, the first workspace is automatically selected
- Maintains workspace selection within the same organization
- Persists selections in localStorage

## Files Created

### Components
1. **`src/app/admin/components/UnifiedOrgWorkspaceSwitcher.tsx`**
   - Main unified switcher component
   - Handles organization and workspace switching
   - Shows hierarchical menu (org → workspaces)
   - Includes management action buttons

2. **`src/app/admin/components/OrganizationManagementDialog.tsx`**
   - Modal for creating/editing organizations
   - Form fields for all organization properties
   - Settings configuration (currency, timezone, language)

### Pages
3. **`src/app/admin/settings/organizations/page.tsx`**
   - Organization management page
   - Grid view of all organizations
   - Quick actions (edit, archive, delete)

4. **`src/app/admin/settings/organizations/OrganizationsClient.tsx`**
   - Client component for organization management
   - CRUD operations for organizations
   - Confirmation dialogs for destructive actions

### Actions
5. **`src/lib/organization-actions.ts`**
   - Server actions for organization management
   - `saveOrganizationAction`: Create/update organizations
   - `deleteOrganizationAction`: Delete with dependency checks
   - `archiveOrganizationAction`: Archive/restore organizations

## Files Modified

### 1. `src/app/admin/layout-client.tsx`
**Changes**:
- Replaced separate `OrganizationSwitcher` and `WorkspaceSwitcher` with `UnifiedOrgWorkspaceSwitcher`
- Updated imports

### 2. `src/app/admin/settings/components/WorkspaceEditor.tsx`
**Changes**:
- Added `useTenant` hook to get active organization
- Updated query to filter workspaces by `organizationId`
- Modified `handleSave` to include `organizationId` when creating workspaces
- Updated header to show organization context
- Disabled "New Workspace" button when no organization is selected

### 3. `src/lib/types.ts`
**Changes**:
- Extended `Organization` interface with new fields:
  - `description?: string`
  - `website?: string`
  - `email?: string`
  - `phone?: string`
  - `address?: string`
  - `status?: 'active' | 'archived'`
  - `settings?: { defaultCurrency, defaultTimezone, defaultLanguage }`
  - `createdBy?: string`
  - `updatedBy?: string`

### 4. `firestore.indexes.json`
**Changes**:
- Added composite index for `workspace_entities`:
  ```json
  {
    "collectionGroup": "workspace_entities",
    "fields": [
      { "fieldPath": "workspaceId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "displayName", "order": "ASCENDING" }
    ]
  }
  ```

## User Experience Flow

### For Super Admins
1. Click unified switcher in header
2. See all organizations with expandable workspace sub-menus
3. Hover/click organization to see its workspaces
4. Select workspace from any organization
5. Organization auto-switches when workspace from different org is selected
6. Access "Manage Organizations" and "Manage Workspaces" buttons at bottom

### For Regular Users
1. Click unified switcher in header
2. See only workspaces they have access to (filtered by their organization)
3. Select workspace from dropdown
4. Cannot switch organizations (locked to assigned org)
5. Access "Manage Workspaces" button (if they have permission)

## Navigation Structure

```
Unified Switcher Dropdown
├── [Super Admin Only] Organizations
│   ├── Organization A
│   │   ├── Workspace 1
│   │   ├── Workspace 2
│   │   └── Workspace 3
│   └── Organization B
│       ├── Workspace 4
│       └── Workspace 5
├── [Regular User] Workspaces
│   ├── Workspace 1
│   ├── Workspace 2
│   └── Workspace 3
├── ─────────────────
├── Manage Organizations (Super Admin only)
└── Manage Workspaces
```

## Data Model

### Organization Collection (`organizations`)
```typescript
{
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: 'active' | 'archived';
  settings?: {
    defaultCurrency?: string;
    defaultTimezone?: string;
    defaultLanguage?: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
```

### Workspace Collection (`workspaces`)
```typescript
{
  id: string;
  organizationId: string; // Links to organization
  name: string;
  description?: string;
  color?: string;
  contactScope: 'institution' | 'family' | 'person';
  statuses: WorkspaceStatus[];
  // ... other fields
}
```

## Security Considerations

1. **Organization Deletion**: Checks for dependent workspaces and users before allowing deletion
2. **Workspace Filtering**: Firestore security rules ensure users only see workspaces they have access to
3. **Permission Checks**: Super admin checks before showing organization management features
4. **Audit Trail**: All organization changes tracked with `createdBy` and `updatedBy` fields

## Deployment Steps

1. **Deploy Firestore Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Update Firestore Security Rules** (if needed):
   - Ensure `organizations` collection has proper read/write rules
   - Verify `workspaces` collection filters by `organizationId`

3. **Data Migration** (if existing data):
   - Ensure all existing workspaces have `organizationId` field
   - Create default organization if none exists
   - Assign workspaces to organizations

4. **Deploy Application**:
   ```bash
   pnpm build
   # Deploy to your hosting platform
   ```

## Testing Checklist

- [ ] Super admin can see all organizations in switcher
- [ ] Super admin can switch between organizations
- [ ] First workspace auto-selects when switching organizations
- [ ] Regular users only see their organization's workspaces
- [ ] Organization creation works with all fields
- [ ] Organization editing preserves existing data
- [ ] Organization deletion blocked when dependencies exist
- [ ] Workspace creation assigns to active organization
- [ ] Workspace list filters by active organization
- [ ] Settings page shows correct organization context
- [ ] Manage Organizations link only visible to super admins
- [ ] Manage Workspaces link works for all authorized users

## Future Enhancements

1. **Organization Branding**: Apply organization colors/logo throughout the app
2. **Workspace Templates**: Create workspace templates for quick setup
3. **Bulk Operations**: Bulk archive/delete workspaces
4. **Organization Switching History**: Track recent organization switches
5. **Workspace Search**: Search/filter workspaces in large organizations
6. **Organization Settings Page**: Dedicated page for organization-wide settings
7. **Multi-organization Users**: Support users with access to multiple organizations

## Support

For issues or questions, refer to:
- `docs/structure.md` - Project structure
- `docs/product.md` - Product overview
- `docs/tech.md` - Tech stack details
