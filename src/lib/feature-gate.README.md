# Feature Gate System

The feature gate system provides a robust mechanism for controlling the visibility and availability of industry-specific features in SmartSapp. It ensures that users only see features relevant to their workspace's industry vertical.

## Overview

SmartSapp supports six industry verticals:
- **SaaS** - B2B SaaS customer management
- **SchoolEnrollment** - Education admissions management
- **Law** - Legal practice management
- **Marketing** - Marketing agency CRM
- **RealEstate** - Property and transaction management
- **Consultancy** - Consulting engagement tracking

Each industry has its own set of enabled features, and the feature gate system ensures that only relevant features are accessible.

## Requirements

This implementation satisfies:
- **Requirement 15.7**: Hide features not applicable to Workspace Industry_Vertical
- **Requirement 15.8**: Validate feature access based on Workspace Industry_Vertical
- **Requirement 15.9**: Support feature toggles at Organization and Workspace levels
- **Design Property 8**: Feature gate enforcement - features absent from INDUSTRY_CONFIG return false

## Core Components

### 1. Feature Gate Functions (`src/lib/feature-gate.ts`)

Server-side and client-side utility functions for checking feature availability.

```typescript
import { isFeatureEnabled } from '@/lib/feature-gate';

// Check if a feature is enabled for an industry
const enabled = isFeatureEnabled('trials', 'SaaS'); // true
const disabled = isFeatureEnabled('trials', 'Law'); // false
```

**Available Functions:**
- `isFeatureEnabled(feature, industry)` - Check single feature
- `getEnabledFeatures(industry)` - Get all enabled features
- `areAllFeaturesEnabled(features, industry)` - Check if all features are enabled
- `isAnyFeatureEnabled(features, industry)` - Check if any feature is enabled
- `getFeatureGateConfig(industry)` - Get complete feature configuration

### 2. React Hook (`useFeatureGate`)

Client-side hook for checking features in React components.

```typescript
import { useFeatureGate } from '@/context/IndustryContext';

function MyComponent() {
  const isFeatureEnabled = useFeatureGate();
  
  if (!isFeatureEnabled('trials')) {
    return null;
  }
  
  return <div>Trials content</div>;
}
```

### 3. FeatureGate Component (`src/components/FeatureGate.tsx`)

Declarative component for conditional rendering based on feature availability.

```typescript
import { FeatureGate } from '@/components/FeatureGate';

function MyComponent() {
  return (
    <FeatureGate feature="trials">
      <TrialsPanel />
    </FeatureGate>
  );
}
```

## Usage Patterns

### Pattern 1: Simple Feature Gate

Hide content when feature is not available:

```tsx
<FeatureGate feature="trials">
  <TrialsManagementPanel />
</FeatureGate>
```

### Pattern 2: Feature Gate with Fallback

Show alternative content when feature is disabled:

```tsx
<FeatureGate 
  feature="matters" 
  fallback={<div>Matter management not available</div>}
>
  <MattersPanel />
</FeatureGate>
```

### Pattern 3: Feature Gate with Callback

Execute logic when feature is disabled:

```tsx
<FeatureGate 
  feature="campaigns"
  onDisabled={() => console.log('Campaigns not available')}
>
  <CampaignsPanel />
</FeatureGate>
```

### Pattern 4: Multiple Features (ALL)

Require all features to be enabled:

```tsx
<FeatureGateMultiple features={['trials', 'subscriptions']} mode="all">
  <TrialsAndSubscriptionsPanel />
</FeatureGateMultiple>
```

### Pattern 5: Multiple Features (ANY)

Require at least one feature to be enabled:

```tsx
<FeatureGateMultiple features={['matters', 'campaigns']} mode="any">
  <CaseOrCampaignPanel />
</FeatureGateMultiple>
```

### Pattern 6: Higher-Order Component

Wrap components with feature gating:

```tsx
import { withFeatureGate } from '@/components/FeatureGate';

const PropertiesPanel = () => <div>Properties content</div>;
const GatedPropertiesPanel = withFeatureGate('properties', PropertiesPanel);

// Usage
<GatedPropertiesPanel />
```

### Pattern 7: Hook-Based Conditional Rendering

Use the hook for more complex logic:

```tsx
function DynamicPanel() {
  const isFeatureEnabled = useFeatureGate();
  
  return (
    <div>
      {isFeatureEnabled('trials') && <TrialsSection />}
      {isFeatureEnabled('applications') && <ApplicationsSection />}
      {isFeatureEnabled('matters') && <MattersSection />}
    </div>
  );
}
```

### Pattern 8: Server-Side Feature Checks

Use in server components or server actions:

```typescript
import { isFeatureEnabled } from '@/lib/feature-gate';

export async function getEntityData(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId);
  
  if (isFeatureEnabled('trials', workspace.industry)) {
    // Include trials data
  }
  
  if (isFeatureEnabled('matters', workspace.industry)) {
    // Include matters data
  }
}
```

### Pattern 9: Conditional Navigation

Show/hide navigation items based on features:

```tsx
function Navigation() {
  const isFeatureEnabled = useFeatureGate();
  
  return (
    <nav>
      <NavItem href="/dashboard">Dashboard</NavItem>
      {isFeatureEnabled('trials') && <NavItem href="/trials">Trials</NavItem>}
      {isFeatureEnabled('matters') && <NavItem href="/matters">Matters</NavItem>}
      {isFeatureEnabled('campaigns') && <NavItem href="/campaigns">Campaigns</NavItem>}
    </nav>
  );
}
```

### Pattern 10: Conditional Form Fields

Show/hide form fields based on features:

```tsx
function EntityForm() {
  const isFeatureEnabled = useFeatureGate();
  
  return (
    <form>
      <input name="name" />
      
      {isFeatureEnabled('trials') && (
        <select name="trialStatus">
          <option>Active</option>
          <option>Expired</option>
        </select>
      )}
      
      {isFeatureEnabled('applications') && (
        <select name="applicationStatus">
          <option>Submitted</option>
          <option>Under Review</option>
        </select>
      )}
    </form>
  );
}
```

## Feature Matrix

| Feature | SaaS | School | Law | Marketing | RealEstate | Consultancy |
|---------|------|--------|-----|-----------|------------|-------------|
| trials | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| onboarding | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| subscriptions | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| healthScores | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| supportTickets | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| applications | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| enrollments | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| schoolVisits | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| matters | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| conflictChecks | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| timeTracking | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| courtDates | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| campaigns | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| proposals | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| deliverables | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| performanceMetrics | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| clientReports | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| properties | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| viewings | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| offers | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| negotiations | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| deals | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| engagements | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| discoveries | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| milestones | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| outcomes | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| retainers | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## Testing

### Unit Tests

Run feature gate tests:

```bash
pnpm test:run src/lib/__tests__/feature-gate.test.ts
pnpm test:run src/components/__tests__/FeatureGate.test.tsx
```

### Test Coverage

The test suite covers:
- ✓ Feature availability for each industry
- ✓ Feature isolation (SaaS features not available in Law, etc.)
- ✓ Multiple feature checks (all/any logic)
- ✓ Component rendering based on feature gates
- ✓ Fallback content rendering
- ✓ Callback execution on disabled features
- ✓ Higher-order component wrapping
- ✓ Design Property 8 enforcement

## Best Practices

### 1. Use Declarative Components

Prefer `<FeatureGate>` over imperative checks:

```tsx
// ✓ Good
<FeatureGate feature="trials">
  <TrialsPanel />
</FeatureGate>

// ✗ Avoid (unless complex logic required)
{isFeatureEnabled('trials') && <TrialsPanel />}
```

### 2. Provide Fallback Content

Always consider what users should see when a feature is disabled:

```tsx
<FeatureGate 
  feature="matters" 
  fallback={<EmptyState message="Feature not available" />}
>
  <MattersPanel />
</FeatureGate>
```

### 3. Server-Side Checks

Use server-side checks for data fetching and API routes:

```typescript
// In server action
export async function getEntityData(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId);
  
  if (!isFeatureEnabled('trials', workspace.industry)) {
    throw new Error('Trials feature not available');
  }
  
  // Fetch trials data
}
```

### 4. Type Safety

Always use typed feature keys:

```typescript
// ✓ Good - TypeScript will catch typos
isFeatureEnabled('trials', 'SaaS')

// ✗ Bad - No type checking
isFeatureEnabled('trial', 'SaaS') // Typo!
```

### 5. Performance

The `useFeatureGate` hook is memoized and efficient:

```tsx
function MyComponent() {
  const isFeatureEnabled = useFeatureGate();
  
  // This won't cause re-renders unless features change
  const showTrials = isFeatureEnabled('trials');
  const showMatters = isFeatureEnabled('matters');
  
  return <div>...</div>;
}
```

## Troubleshooting

### Feature Not Showing

1. Check workspace industry: `console.log(workspace.industry)`
2. Verify feature is enabled: `console.log(INDUSTRY_CONFIG[industry].features)`
3. Check component is wrapped in `IndustryProvider`

### TypeScript Errors

Ensure you're importing types correctly:

```typescript
import type { FeatureGate } from '@/lib/industry-config';
```

### Testing Issues

Mock the `useFeatureGate` hook in tests:

```typescript
vi.mock('@/context/IndustryContext', () => ({
  useFeatureGate: vi.fn(() => (feature) => feature === 'trials'),
}));
```

## Related Files

- `src/lib/feature-gate.ts` - Core feature gate logic
- `src/lib/industry-config.ts` - Industry configuration registry
- `src/context/IndustryContext.tsx` - Industry context provider
- `src/components/FeatureGate.tsx` - Feature gate components
- `src/components/examples/FeatureGateExamples.tsx` - Usage examples

## Future Enhancements

Potential improvements for future iterations:

1. **Organization-Level Overrides**: Allow organizations to enable/disable features
2. **User-Level Permissions**: Combine feature gates with user permissions
3. **Feature Flags Service**: Integrate with external feature flag service (LaunchDarkly, etc.)
4. **Analytics**: Track feature usage and adoption
5. **A/B Testing**: Support gradual feature rollouts
6. **Dynamic Configuration**: Load feature configuration from database
