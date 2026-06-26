# Script Builder Entity Simulation Feature

## Overview

This document outlines the implementation plan for adding entity simulation capabilities to the Call Centre Script Builder. The feature will allow users to select an entity and contact to simulate script execution across all views (Visual Builder, Playground Outline, Interactive Script, and Legacy Text).

## Current State

The script builder currently has:
- **Four view modes:**
  - `flow` - Visual canvas with ReactFlow nodes
  - `list` - Split view / playbook outline
  - `interactive` - Interactive step-by-step script execution
  - `text` - Legacy plain text editor
  
- **Existing simulation infrastructure:**
  - `simulatedEntityId` and `simulatedContactId` state
  - `simulatedEntityData` with entity contacts array
  - `resolveSimulatedText()` function for variable replacement
  - `updateSimulatedEntityContact()` for contact manipulation
  - Entity/contact selectors in modals (`isSimModalOpen`, `isSimDetailsModalOpen`)

- **Partial simulation support:**
  - ✅ Action nodes can be tested with simulated entity
  - ✅ Outcome automation nodes can be tested
  - ✅ Variable resolution works in isolated contexts
  - ❌ **No persistent simulation UI in the main editor**
  - ❌ **Simulation not integrated into all views**
  - ❌ **No visual "simulation active" state**

## Problem Statement

Users need a way to:
1. **Select an entity** to simulate script execution with real data
2. **Choose a specific contact** from that entity for personalized simulation
3. **Start/stop simulation** mode to control when simulation is active
4. **See simulation applied** across ALL editor views (flow, list, interactive, text)
5. **Access simulation controls easily** without hunting through modals

## Proposed Solution

### A. Entity Simulation Control Bar

Add a **dedicated simulation control row** that sits **above the three-column layout** on the script design page. This provides persistent, visible access to simulation controls.

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Top Toolbar (Back, Save, Publish, Undo/Redo)                    │
├─────────────────────────────────────────────────────────────────┤
│ Simulation Control Bar (NEW - Only on /scripts/new)             │
│  [Simulation Off ▼] [Select Entity] [Select Contact] [Test ⚡]  │
├─────────────────────────────────────────────────────────────────┤
│  Tab Bar (Flow / List / Interactive / Text)                     │
├───────────────┬───────────────────────────────────┬─────────────┤
│  Left Sidebar │        Canvas / Editor            │Right Panel  │
│  (Toolbar/    │                                   │(Properties) │
│   Variables)  │                                   │             │
└───────────────┴───────────────────────────────────┴─────────────┘
```

#### Control Bar Components

1. **Simulation Toggle**
   - Dropdown button: `[Simulation Off ▼]` / `[🟢 Simulation Active ▼]`
   - States: `off`, `active`
   - When OFF: entity/contact selectors are disabled/hidden
   - When ACTIVE: entity/contact selectors are enabled
   - Visual indicator: Green dot icon when active

2. **Entity Selector**
   - Uses existing `EntityCombobox` component
   - Filtered by workspace
   - Shows: Entity name, type icon, primary contact
   - Disabled when simulation is OFF

3. **Contact Selector**
   - Dropdown populated from selected entity's `entityContacts` array
   - Shows: Contact name, role, email, phone
   - Disabled when no entity is selected
   - Auto-selects primary contact when entity changes

4. **Test Button**
   - Icon button with lightning bolt (⚡)
   - Opens detailed simulation modal with:
     - Current entity/contact details
     - Resolved variables preview
     - Quick test actions (send test SMS, email, etc.)
   - Badge shows number of resolved variables

### B. Simulation State Management

```typescript
// Add to ScriptBuilderClient state
interface SimulationState {
  isActive: boolean;              // Master switch
  entityId: string | null;
  contactId: string | null;
  entityData: SimulatedEntity | null;
  resolvedVariables: Record<string, string>; // Cached resolved vars
}

// Actions
type SimulationAction =
  | { type: 'START_SIMULATION'; entity: Entity; contact: EntityContact }
  | { type: 'STOP_SIMULATION' }
  | { type: 'CHANGE_ENTITY'; entity: Entity }
  | { type: 'CHANGE_CONTACT'; contact: EntityContact }
  | { type: 'UPDATE_CONTACT_DATA'; updates: Partial<EntityContact> };
```

### C. Integration with Each View

#### 1. Visual Flow Canvas

**Changes needed:**
- Node content should show resolved variables when simulation is active
- Add visual indicator on nodes (e.g., small green badge)
- Real-time preview of script text with {{VARIABLES}} replaced
- Action nodes show "Test with [Entity Name]" button

**Implementation:**
```typescript
// In VisualScriptCanvas node rendering
const displayText = simulationState.isActive
  ? resolveSimulatedText(node.data.text, simulationState.entityData, simulationState.contactData)
  : node.data.text;
```

#### 2. Playbook / List View (ScriptPlaybookView)

**Changes needed:**
- All script blocks show resolved text when simulation is active
- Question options show with context
- Objection handlers preview resolved responses
- Actions display "Test" buttons

**Implementation:**
- Pass `simulationState` as prop to `ScriptPlaybookView`
- Render resolved text in each section card
- Add simulation badge to section headers

#### 3. Interactive Script View

**Changes needed:**
- Start the interactive walkthrough using simulated entity data
- All prompts and responses show personalized text
- Action execution uses real simulation testing
- Progress tracking shows "Simulating for [Entity Name]"

**Implementation:**
- `InteractiveScriptView` receives `simulationState` prop
- Initialize conversation with entity context
- Track simulation-specific interactions separately

#### 4. Legacy Text View

**Changes needed:**
- Split view: Left shows raw text, Right shows preview with resolved variables
- Highlight {{VARIABLES}} in source text
- Preview pane updates in real-time as text changes

**Implementation:**
```typescript
<div className="grid grid-cols-2 gap-4">
  <div>
    <Label>Script Source</Label>
    <LegacyScriptEditor ref={editorRef} />
  </div>
  {simulationState.isActive && (
    <div>
      <Label>Preview for {entity.name}</Label>
      <div className="prose">
        {resolveSimulatedText(legacyText, simulationState)}
      </div>
    </div>
  )}
</div>
```

### D. Variable Resolution Enhancement

Enhance the existing `resolveScriptVariables()` function:

```typescript
function resolveScriptVariables(
  text: string,
  entity: Entity | null,
  deal: Deal | null,
  agentName: string,
  contact: EntityContact | null
): string {
  if (!entity) return text;
  
  const variables: Record<string, string> = {
    // Entity variables
    ENTITY_NAME: entity.name || '',
    ENTITY_TYPE: entity.entityType || '',
    PRIMARY_CONTACT_NAME: entity.entityContacts?.find(c => c.isPrimary)?.name || '',
    
    // Current contact variables
    CURRENT_CONTACT_NAME: contact?.name || '',
    CURRENT_CONTACT_PHONE: contact?.phone || '',
    CURRENT_CONTACT_EMAIL: contact?.email || '',
    
    // Agent variables
    AGENT_NAME: agentName,
    
    // Custom field resolution
    ...resolveCustomFields(entity),
  };
  
  // Replace all {{VAR}} occurrences
  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, varName) => {
    return variables[varName.toUpperCase()] || match;
  });
}

// Cache resolved variables for display in the test modal
function getResolvedVariables(
  text: string,
  entity: Entity,
  contact: EntityContact
): Record<string, string> {
  const found = text.match(/\{\{([A-Za-z0-9_]+)\}\}/g) || [];
  const unique = [...new Set(found.map(v => v.replace(/[{}]/g, '')))];
  
  const variables = {} as Record<string, string>;
  unique.forEach(varName => {
    const resolved = resolveScriptVariables(`{{${varName}}}`, entity, null, 'Agent', contact);
    variables[varName] = resolved !== `{{${varName}}}` ? resolved : '(not set)';
  });
  
  return variables;
}
```

## Implementation Plan

### Phase 1: UI Components (Non-Breaking)
**Scope:** Add simulation control bar without breaking existing functionality

**Tasks:**
1. Create `SimulationControlBar.tsx` component
   - Simulation toggle dropdown
   - Entity selector integration
   - Contact dropdown
   - Test modal trigger button
   
2. Create `SimulationTestModal.tsx`
   - Display selected entity/contact details
   - Show all resolved variables in a table
   - Quick action buttons (test SMS, email, etc.)
   - Link to full entity record

3. Add simulation state to `ScriptBuilderClient`
   - New `simulationState` object
   - Actions: start, stop, change entity, change contact
   - Local storage persistence for simulation settings
   
4. Insert control bar into layout
   - Position between top toolbar and tab bar
   - Only render on `/admin/messaging/call-centre/scripts/new`
   - Collapsible on mobile viewports

**Success Criteria:**
- Control bar renders correctly
- Entity/contact selection works
- Simulation can be toggled on/off
- Test modal displays resolved variables
- No impact on existing script editing functionality

### Phase 2: Variable Resolution Integration
**Scope:** Make simulation work in all views

**Tasks:**
1. **Flow View Integration**
   - Pass `simulationState` to `VisualScriptCanvas`
   - Update node rendering to show resolved text
   - Add simulation badge to nodes
   - Test action nodes with entity context

2. **List View Integration**
   - Pass `simulationState` to `ScriptPlaybookView`
   - Resolve variables in all script blocks
   - Add "Previewing for [Entity]" header
   - Enable action testing

3. **Interactive View Integration**
   - Pass `simulationState` to `InteractiveScriptView`
   - Initialize conversation with entity data
   - Resolve all prompts and responses
   - Track simulation interactions separately

4. **Text View Integration**
   - Add split view (source | preview)
   - Highlight {{VARIABLES}} in editor
   - Real-time preview with resolved text
   - Variable insertion helper

**Success Criteria:**
- All views display resolved variables when simulation is active
- Variable resolution is consistent across views
- Raw {{VARIABLES}} visible when simulation is OFF
- No performance degradation

### Phase 3: Testing & Validation
**Scope:** Ensure robust simulation behavior

**Tasks:**
1. **Action Testing**
   - Verify SEND_SMS with simulated contact
   - Verify SEND_EMAIL with simulated contact
   - Verify UPDATE_CONTACT changes reflected
   - Verify CREATE_TASK uses correct entity

2. **Edge Cases**
   - Missing variables show placeholder
   - Invalid entity IDs handled gracefully
   - Contact deleted while simulation active
   - Switch between entities mid-edit

3. **Performance**
   - Variable resolution cached per entity/contact pair
   - Debounced re-resolution on text changes
   - Large scripts (1000+ variables) perform well

4. **UX Polish**
   - Smooth transitions when toggling simulation
   - Clear visual feedback for simulation state
   - Helpful empty states and error messages
   - Keyboard shortcuts (e.g., Cmd+Shift+T for test)

**Success Criteria:**
- All action types work correctly
- Edge cases handled without crashes
- No noticeable lag when typing
- UX feels polished and professional

### Phase 4: Documentation & Training
**Scope:** Enable users to leverage simulation

**Tasks:**
1. In-app tooltips and help text
2. User documentation (help center article)
3. Video tutorial showing simulation workflow
4. Best practices guide for script testing

## Technical Considerations

### 1. Component Architecture

```
ScriptBuilderClient
├── SimulationControlBar (NEW)
│   ├── SimulationToggle
│   ├── EntityCombobox (existing)
│   ├── ContactDropdown (NEW)
│   └── TestButton → SimulationTestModal
├── Tabs (Flow | List | Interactive | Text)
├── LeftSidebar
├── Canvas (Flow/List/Interactive/Text)
│   ├── VisualScriptCanvas (receives simulationState)
│   ├── ScriptPlaybookView (receives simulationState)
│   ├── InteractiveScriptView (receives simulationState)
│   └── LegacyScriptEditor (split view with preview)
└── RightPanel
```

### 2. State Flow

```
User Action → SimulationAction → simulationState update → 
→ Props to child views → Variable resolution → Rendered content
```

### 3. Performance Optimization

**Problem:** Resolving variables on every render can be expensive.

**Solution:** Memoization strategy

```typescript
const resolvedContent = React.useMemo(() => {
  if (!simulationState.isActive) return rawContent;
  return resolveSimulatedText(rawContent, simulationState.entityData, simulationState.contactData);
}, [
  simulationState.isActive,
  simulationState.entityData?.id,
  simulationState.contactData?.id,
  rawContent
]);
```

### 4. Accessibility

- Simulation toggle has clear ARIA labels
- Keyboard navigation: Tab through controls, Enter to activate
- Screen reader announces simulation state changes
- Color is not the only indicator (use icons + text)

### 5. Mobile Considerations

- Control bar collapses to compact mode on small screens
- Entity/contact selectors use native mobile pickers
- Test modal is full-screen on mobile
- Swipe gesture to toggle simulation on/off

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation with large scripts | High | Memoization, debouncing, cached resolution |
| Breaking existing functionality | High | Phased rollout, feature flag, comprehensive testing |
| Confusing UX (too many controls) | Medium | User testing, clear visual hierarchy, progressive disclosure |
| Entity data loading delays | Medium | Loading states, optimistic UI, caching |
| Variable resolution inconsistencies | Medium | Unit tests for all variable types, centralized resolution function |
| Accessibility issues | Low | Follow WCAG 2.1 AA standards, keyboard navigation, ARIA labels |

## Success Metrics

### Quantitative
- 90% of users who open script builder activate simulation at least once
- Average time to select entity and start simulation < 10 seconds
- Zero reported bugs related to simulation after 2 weeks in production
- Page load time remains < 2 seconds with simulation active

### Qualitative
- Users report simulation helps them create better scripts
- Support tickets related to "how do I test scripts" decrease by 50%
- User interviews show high confidence in script quality

## Future Enhancements

### Phase 5+ (Post-MVP)
1. **Multi-entity comparison**
   - Side-by-side preview for 2+ entities
   - Identify script sections that don't work for certain entity types

2. **Simulation history**
   - Record simulation sessions
   - Replay previous simulations
   - Track which entities have been tested

3. **AI-powered suggestions**
   - Suggest entities to test based on script content
   - Flag missing variables that would cause issues
   - Recommend script improvements based on entity data patterns

4. **Collaboration features**
   - Share simulation link with team members
   - Annotate script with entity-specific notes
   - Review mode for approving scripts

## Conclusion

This implementation plan provides a **phased, low-risk approach** to adding entity simulation to the script builder. By following these phases, we can:

✅ Avoid breaking existing functionality  
✅ Deliver value incrementally  
✅ Gather user feedback early  
✅ Build confidence in the feature  
✅ Maintain code quality and testability  

The simulation feature will significantly improve script quality by allowing users to see exactly how their scripts will appear to real contacts, reducing errors and improving conversion rates in call campaigns.
