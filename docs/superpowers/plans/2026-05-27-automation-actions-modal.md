# Automation Actions Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified triggers and actions selection modal (Bento Grid layout) in the automation builder, complete with real-time search, sidebar categorization, and smart insertion (auto-linking to the selected node).

**Architecture:** Create a standalone client component `ElementLibraryModal.tsx` for the modal selection, dynamically imported in `AutomationBuilder.tsx` to reduce bundle sizes. The builder's `addNode` function will be updated to accept payload parameters for pre-configuring nodes and establishing automatic edges.

**Tech Stack:** Next.js, React Flow, Radix UI Dialog (shadcn/ui), Tailwind CSS, Lucide React

---

## File Structure of Changes

- **NEW** `src/app/admin/automations/components/ElementLibraryModal.tsx`: Selection modal component.
- **MODIFY** `src/app/admin/automations/components/AutomationBuilder.tsx`: Hook up button, add modal integration, implement smart insertion and edge connection logic.

---

## Pitfalls & Mitigations

1. **State Update Collision & Sync Loops**:
   - *Risk*: React Flow triggers debounced synchronization loops. Adding a node and edge in separate state setters could create out-of-order updates.
   - *Mitigation*: Perform node and edge creation together in single atomic state updates (e.g. `setNodes(nds => [...nds, newNode])` and `setEdges(eds => [...eds, newEdge])`).
2. **Duplicate Start Triggers**:
   - *Risk*: Multiple starting triggers might be added inappropriately or attached downstream of action nodes where they do not belong.
   - *Mitigation*: Triggers will only support adding to the canvas. If an existing node is selected, triggers will be visually disabled or labeled as "Canvas-only entry points" in the modal sidebar to prevent incorrect sequencing.
3. **Canvas Overlap**:
   - *Risk*: Placing a new node at $y + 140$ might overlap an existing node if the parent already has downstream branches.
   - *Mitigation*: Check if any existing node is within a 50px radius of the target coordinates. If so, shift the coordinate to the right by 220px to prevent visual collisions.

---

### Task 1: Create the Element Library Modal Component

**Files:**
- Create: `src/app/admin/automations/components/ElementLibraryModal.tsx`

- [ ] **Step 1: Write the ElementLibraryModal component**
  Create the component defining all triggers and actions categorized in the ActiveCampaign style. Use React render-time derivation for search filtering.

```typescript
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Mail, MessageSquare, Clock, ArrowRightLeft, Tag, Layers, Target, CheckSquare, PlusCircle, Trash, Play, Info, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define the shape of library items
interface LibraryItem {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  // Node mapping info
  nodeType: 'triggerNode' | 'actionNode' | 'conditionNode' | 'delayNode' | 'tagConditionNode' | 'tagActionNode';
  payload?: {
    actionType?: string;
    trigger?: string;
    action?: string; // for tagActionNode ('ADD' | 'REMOVE')
    config?: Record<string, any>;
  };
}

interface CategoryGroup {
  id: string;
  name: string;
  icon: any;
  items: LibraryItem[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    id: 'triggers',
    name: 'Start Triggers',
    icon: Play,
    items: [
      { id: 't_field', title: 'Entity Field Changed', desc: 'Fires when an entity profile field changes value.', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'ENTITY_FIELD_CHANGED' } },
      { id: 't_date', title: 'Date Reached', desc: 'Runs on, before, or after a specific date field.', icon: Clock, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'DATE_REACHED' } },
      { id: 't_deal_stage', title: 'Deal Stage Changed', desc: 'Fires when a deal moves to a new pipeline stage.', icon: ArrowRightLeft, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'DEAL_STAGE_CHANGED' } },
      { id: 't_form', title: 'Form Submitted', desc: 'Fires when a workspace form is submitted.', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'FORM_SUBMITTED' } },
      { id: 't_tag_added', title: 'Tag Added', desc: 'Fires when a tag is applied to an entity.', icon: Tag, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'TAG_ADDED' } },
      { id: 't_webhook', title: 'Webhook Received', desc: 'Fires when data is POSTed to this endpoint.', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'triggerNode', payload: { trigger: 'WEBHOOK_RECEIVED' } }
    ]
  },
  {
    id: 'sending',
    name: 'Sending Options',
    icon: Mail,
    items: [
      { id: 'a_email', title: 'Send Email', desc: 'Send an automated template email to the contact or manager.', icon: Mail, color: 'text-blue-500 bg-blue-500/10', nodeType: 'actionNode', payload: { actionType: 'SEND_MESSAGE', config: { channel: 'email' } } },
      { id: 'a_sms', title: 'Send SMS', desc: 'Send an automated SMS message to the contact\'s device.', icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', nodeType: 'actionNode', payload: { actionType: 'SEND_MESSAGE', config: { channel: 'sms' } } }
    ]
  },
  {
    id: 'workflow',
    name: 'Conditions & Flow',
    icon: ArrowRightLeft,
    items: [
      { id: 'a_delay', title: 'Wait / Delay', desc: 'Pause automation progress for a specified duration.', icon: Clock, color: 'text-purple-500 bg-purple-500/10', nodeType: 'delayNode', payload: { config: { value: 5, unit: 'Minutes' } } },
      { id: 'a_condition', title: 'If/Else Split', desc: 'Split the flow based on rules and criteria.', icon: ArrowRightLeft, color: 'text-purple-500 bg-purple-500/10', nodeType: 'conditionNode' },
      { id: 'a_tag_condition', title: 'Tag Split', desc: 'Branch contacts based on presence of active tags.', icon: Tag, color: 'text-purple-500 bg-purple-500/10', nodeType: 'tagConditionNode' },
      { id: 'a_chain', title: 'Run Automation', desc: 'Chain another automation flow by ID.', icon: Play, color: 'text-purple-500 bg-purple-500/10', nodeType: 'actionNode', payload: { actionType: 'RUN_AUTOMATION' } }
    ]
  },
  {
    id: 'contacts',
    name: 'Contacts & Data',
    icon: Tag,
    items: [
      { id: 'a_add_tag', title: 'Add Tag', desc: 'Apply a workspace tag to the contact.', icon: Tag, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'tagActionNode', payload: { action: 'ADD' } },
      { id: 'a_remove_tag', title: 'Remove Tag', desc: 'Strip an existing tag from the contact.', icon: Trash, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'tagActionNode', payload: { action: 'REMOVE' } },
      { id: 'a_update_entity', title: 'Update Entity', desc: 'Modify custom or standard fields of the contact profile.', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'actionNode', payload: { actionType: 'UPDATE_ENTITY' } },
      { id: 'a_assign', title: 'Assign Entity', desc: 'Set the designated manager or owner.', icon: Target, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'actionNode', payload: { actionType: 'ASSIGN_ENTITY' } },
      { id: 'a_note', title: 'Add Note', desc: 'Log a plain-text note directly to the entity history.', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10', nodeType: 'actionNode', payload: { actionType: 'ADD_NOTE' } }
    ]
  },
  {
    id: 'crm',
    name: 'CRM & Sales',
    icon: Target,
    items: [
      { id: 'a_create_deal', title: 'Create Deal', desc: 'Instantiate a deal inside an active pipeline.', icon: Target, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'CREATE_DEAL' } },
      { id: 'a_deal_stage', title: 'Update Deal Stage', desc: 'Shift a deal to another step on the Kanban board.', icon: ArrowRightLeft, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'UPDATE_DEAL_STAGE' } },
      { id: 'a_deal_value', title: 'Update Deal Value', desc: 'Adjust estimated value metrics of the deal.', icon: Target, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'UPDATE_DEAL_VALUE' } },
      { id: 'a_deal_status', title: 'Update Deal Status', desc: 'Set status to Won, Lost, or Reopened.', icon: Play, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'UPDATE_DEAL_STATUS' } },
      { id: 'a_create_task', title: 'Create Task', desc: 'Add a scheduled task for your sales reps.', icon: CheckSquare, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'CREATE_TASK' } },
      { id: 'a_update_task', title: 'Update Task', desc: 'Update assignee or mark a CRM task done.', icon: CheckSquare, color: 'text-amber-500 bg-amber-500/10', nodeType: 'actionNode', payload: { actionType: 'UPDATE_TASK' } }
    ]
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: Layers,
    items: [
      { id: 'a_webhook', title: 'Call Webhook', desc: 'Post workspace payload to an external server URL.', icon: Layers, color: 'text-teal-500 bg-teal-500/10', nodeType: 'actionNode', payload: { actionType: 'TRIGGER_OUTBOUND_WEBHOOK' } }
    ]
  }
];

interface ElementLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: LibraryItem) => void;
  hasParentSelected: boolean;
}

export function ElementLibraryModal({ isOpen, onClose, onSelect, hasParentSelected }: ElementLibraryModalProps) {
  const [search, setSearch] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('triggers');

  // React derived state for filtered search results
  const filteredCategories = React.useMemo(() => {
    if (!search.trim()) {
      return CATEGORIES.map(cat => {
        // Disable Triggers category if a parent is selected (smart insertion restricts middle triggers)
        const isDisabled = cat.id === 'triggers' && hasParentSelected;
        return { ...cat, isDisabled };
      });
    }
    const query = search.toLowerCase();
    return CATEGORIES.map(cat => {
      const matchingItems = cat.items.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          item.desc.toLowerCase().includes(query)
      );
      const isDisabled = cat.id === 'triggers' && hasParentSelected;
      return {
        ...cat,
        items: matchingItems,
        isDisabled
      };
    }).filter(cat => cat.items.length > 0);
  }, [search, hasParentSelected]);

  // Determine items to display in bento grid
  const displayedItems = React.useMemo(() => {
    if (search.trim()) {
      return filteredCategories.flatMap(c => c.items);
    }
    const active = filteredCategories.find(c => c.id === activeCategory);
    return active ? active.items : [];
  }, [filteredCategories, activeCategory, search]);

  React.useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setActiveCategory('triggers');
    } else if (hasParentSelected) {
      setActiveCategory('sending');
    }
  }, [isOpen, hasParentSelected]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[850px] p-0 overflow-hidden rounded-[2rem] border-none bg-background shadow-2xl flex flex-col md:h-[550px] outline-none">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
            <span className="p-1.5 bg-primary/10 rounded-lg text-primary text-sm font-bold">⚡</span>
            Add Elements library
          </DialogTitle>
        </DialogHeader>

        {/* Search Header */}
        <div className="px-6 py-3 border-b border-border/40 bg-muted/20 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search triggers, logic, send options, and updates..."
              className="h-10 pl-10 pr-4 rounded-xl border border-border/50 bg-background font-medium text-xs shadow-inner outline-none transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
            />
          </div>
        </div>

        {/* Workspace Panels */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar */}
          {!search.trim() && (
            <div className="w-full md:w-[220px] bg-muted/10 border-r border-border/40 p-3 flex flex-col gap-1 overflow-y-auto select-none">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    disabled={cat.isDisabled}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all duration-300",
                      cat.isDisabled && "opacity-40 cursor-not-allowed",
                      activeCategory === cat.id && !cat.isDisabled
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            {displayedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-bold text-muted-foreground/60">No matching automation elements found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {displayedItems.map((item) => {
                  const Icon = item.icon;
                  const isTriggerDisabled = item.nodeType === 'triggerNode' && hasParentSelected;

                  return (
                    <button
                      key={item.id}
                      disabled={isTriggerDisabled}
                      onClick={() => onSelect(item)}
                      className={cn(
                        "group p-4 border border-border/60 hover:border-primary/50 bg-card hover:bg-muted/10 rounded-2xl flex flex-col items-start gap-3.5 text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5",
                        isTriggerDisabled && "opacity-40 cursor-not-allowed border-dashed hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300", item.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors duration-300">{item.title}</span>
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{item.nodeType === 'triggerNode' ? 'Start trigger' : 'Execution action'}</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed leading-tighter">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info banner */}
        <div className="p-3 border-t border-border/40 bg-muted/10 shrink-0 text-center flex items-center justify-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground/80 leading-none">
            {hasParentSelected 
              ? "Smart Insertion Mode Active: Node will be automatically connected below the selected node."
              : "Select a card to place the node in the center of the canvas."}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/automations/components/ElementLibraryModal.tsx
git commit -m "feat: implement element library selection modal layout"
```

---

### Task 2: Integrate Modal & Upgrade Smart Node Placement

**Files:**
- Modify: `src/app/admin/automations/components/AutomationBuilder.tsx`

- [ ] **Step 1: Write code modifications to AutomationBuilder.tsx**
  Add state for the library modal, load the modal dynamically, update node generation logic to set appropriate values and setup edges atomically.

Target change around lines 43-44 in `AutomationBuilder.tsx`:
```typescript
import { NodeInspector } from './NodeInspector';
import dynamic from 'next/dynamic';

const ElementLibraryModal = dynamic(
  () => import('./ElementLibraryModal').then((mod) => mod.ElementLibraryModal),
  { ssr: false }
);
```

Target change inside component (replacing line 67-68):
```typescript
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
```

Target update to `addNode` to support specific action type inputs & auto-connecting edges (replacing lines 114-139):
```typescript
    const addLibraryNode = (item: any) => {
        const id = `${item.nodeType}_${Date.now()}`;
        const label = item.title;
        
        let nodeData: any = {
            label,
            config: item.payload?.config || {}
        };
        if (item.payload?.actionType) {
            nodeData.actionType = item.payload.actionType;
        }
        if (item.payload?.trigger) {
            nodeData.trigger = item.payload.trigger;
        }
        if (item.payload?.action) {
            nodeData.action = item.payload.action; // e.g. for tagActionNode
        }

        // Calculate Smart Position
        let position = { x: 400 + Math.random() * 50, y: 300 + Math.random() * 50 };
        const parentNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
        
        if (parentNode) {
            let targetX = parentNode.position.x;
            let targetY = parentNode.position.y + 140;

            // Collision check: Shift horizontally if another node is placed within 50px radius
            const collides = nodes.some(n => 
                Math.abs(n.position.x - targetX) < 50 && 
                Math.abs(n.position.y - targetY) < 50
            );
            if (collides) {
                targetX += 220;
            }
            position = { x: targetX, y: targetY };
        }

        const newNode = {
            id,
            type: item.nodeType,
            position,
            data: nodeData,
        };

        // Batch Node and Edge states
        setNodes(nds => [...nds, newNode]);

        if (parentNode && item.nodeType !== 'triggerNode') {
            const newEdge = {
                id: `e_${parentNode.id}_${id}`,
                source: parentNode.id,
                target: id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 3 },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))', width: 20, height: 20 }
            };
            setEdges(eds => [...eds, newEdge]);
        }

        setSelectedNodeId(id);
        setIsLibraryOpen(false);
    };
```

Target update to add the Open Library button inside the visual panel `Panel` trigger buttons (replacing lines 167-180):
```typescript
                    <Card className="rounded-2xl border-none shadow-2xl p-1.5 flex flex-col gap-1.5 bg-background/95 backdrop-blur-md ring-1 ring-black/5">
                        <TooltipProvider>
                            <ToolBtn icon={PlusCircle} label="Open Element Library" color="text-violet-600 bg-violet-50 font-bold border border-violet-200" onClick={() => setIsLibraryOpen(true)} />
                            <div className="h-[1px] bg-border mx-2 my-1" />
                            <ToolBtn icon={Zap} label="Add Trigger" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('triggerNode')} />
                            <ToolBtn icon={Play} label="Add Action" color="text-blue-600 bg-blue-50" onClick={() => addNode('actionNode')} />
                            <ToolBtn icon={ArrowRightLeft} label="Add Condition" color="text-amber-600 bg-amber-50" onClick={() => addNode('conditionNode')} />
                            <ToolBtn icon={Tag} label="Add Tag Condition" color="text-violet-600 bg-violet-50" onClick={() => addNode('tagConditionNode')} />
                            <ToolBtn icon={TagIcon} label="Add Tag Action" color="text-emerald-600 bg-emerald-50" onClick={() => addNode('tagActionNode')} />
                            <ToolBtn icon={Clock} label="Add Delay" color="text-purple-600 bg-purple-50" onClick={() => addNode('delayNode')} />
                            <ToolBtn 
                                icon={isFullScreen ? Minimize2 : Maximize2} 
                                label={isFullScreen ? "Exit Hub" : "Zen View"} 
                                onClick={() => setIsFullScreen(!isFullScreen)} 
                            />
                        </TooltipProvider>
                    </Card>
```

Add the Modal element inside the return block of `AutomationBuilder` component:
```typescript
            {/* Element Library Dialog Modal */}
            <ElementLibraryModal 
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                onSelect={addLibraryNode}
                hasParentSelected={!!selectedNodeId}
            />
```

- [ ] **Step 2: Run build to make sure code compiles without lint or TS errors**
  Run: `npm run build` or local compiler checks.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/automations/components/AutomationBuilder.tsx
git commit -m "feat: integrate ElementLibraryModal and implement smart node insertion and edge generation logic"
```

---

### Task 3: Manual Verification

- [ ] **Step 1: Run the dev environment**
  Run: `npm run dev`

- [ ] **Step 2: Perform the validation checklist**
  - Verify that clicking the "PlusCircle" button launches the Elements Library Modal.
  - Type "SMS" into the search bar and verify that only "Send SMS" card remains.
  - Clear the search, select "Wait / Delay" card, and verify it inserts a Delay Node.
  - Select the Delay Node, click the PlusCircle button, and verify that the Triggers category is disabled.
  - With the Delay Node selected, select "Send SMS" and verify that:
    1. The node is added below the Delay Node.
    2. An edge connects the Delay Node to the Send SMS node.
    3. Clicking the new Send SMS node opens the Logic Inspector displaying "SMS" as the active channel option.
