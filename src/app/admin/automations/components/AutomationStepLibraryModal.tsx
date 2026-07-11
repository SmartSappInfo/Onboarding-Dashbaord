'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';
import { 
  Zap, 
  Mail, 
  Smartphone, 
  Clock, 
  ArrowRightLeft, 
  Tag, 
  Settings2, 
  Database, 
  Globe, 
  Target, 
  CheckSquare, 
  Building,
  Search,
  X,
  Lock,
  ChevronRight,
  Info,
  Bell,
  SplitSquareVertical,
  Sparkles,
  UserCog,
  Milestone
} from 'lucide-react';

interface AutomationStepLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: any) => void;
  hasParentSelected?: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All Steps', icon: Globe },
  { id: 'start_triggers', label: 'Start Triggers', icon: Zap },
  { id: 'sending_options', label: 'Sending Options', icon: Mail },
  { id: 'conditions_flow', label: 'Conditions & Flow', icon: ArrowRightLeft },
  { id: 'contacts_data', label: 'Contacts & Data', icon: Tag },
  { id: 'crm_sales', label: 'CRM & Sales', icon: Target },
  { id: 'integrations', label: 'Integrations', icon: Globe },
] as const;

const LIBRARY_ITEMS = [
  // Start Triggers
  {
    id: 'field_changed',
    title: 'Field Changed',
    description: 'Fires when a specific standard or custom field on an entity changes value.',
    category: 'start_triggers',
    icon: Settings2,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Field Changed', trigger: 'ENTITY_FIELD_CHANGED' }
  },
  {
    id: 'date_reached',
    title: 'Date Reached',
    description: 'Fires on, before, or after a specific date property of an entity.',
    category: 'start_triggers',
    icon: Clock,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Date Reached', trigger: 'DATE_REACHED' }
  },
  {
    id: 'deal_stage_changed',
    title: 'Deal Stage Changed',
    description: 'Fires when a deal moves stages on the pipeline board.',
    category: 'start_triggers',
    icon: ArrowRightLeft,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Deal Stage Changed', trigger: 'DEAL_STAGE_CHANGED' }
  },
  {
    id: 'form_submitted',
    title: 'Form Submitted',
    description: 'Fires when a workspace onboarding or registration form is submitted.',
    category: 'start_triggers',
    icon: Database,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Form Submitted', trigger: 'FORM_SUBMITTED' }
  },
  {
    id: 'tag_added',
    title: 'Tag Added',
    description: 'Fires when a dynamic tag is applied to an entity profile.',
    category: 'start_triggers',
    icon: Tag,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Tag Added', trigger: 'TAG_ADDED' }
  },
  {
    id: 'webhook_received',
    title: 'Webhook Received',
    description: 'Fires when external JSON payloads are POSTed to this automation ingress URL.',
    category: 'start_triggers',
    icon: Globe,
    nodeType: 'triggerNode',
    payload: { type: 'triggerNode', label: 'Webhook Received', trigger: 'WEBHOOK_RECEIVED' }
  },

  // Sending Options
  {
    id: 'send_email',
    title: 'Send Email',
    description: 'Send a transactional email template customized with dynamic profile properties.',
    category: 'sending_options',
    icon: Mail,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send Email', actionType: 'SEND_MESSAGE', channel: 'email' }
  },
  {
    id: 'direct_email',
    title: 'Direct Email',
    description: 'Send an email message directly without using a predefined template. Supports dynamic workflow variables.',
    category: 'sending_options',
    icon: Mail,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Direct Email', actionType: 'DIRECT_EMAIL' }
  },
  {
    id: 'send_sms',
    title: 'Send SMS',
    description: 'Deliver a text message notification or alert to the contact mobile device.',
    category: 'sending_options',
    icon: Smartphone,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send SMS', actionType: 'SEND_MESSAGE', channel: 'sms' }
  },
  {
    id: 'direct_sms',
    title: 'Direct SMS',
    description: 'Deliver an SMS message directly without using a predefined template. Supports dynamic workflow variables.',
    category: 'sending_options',
    icon: Smartphone,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Direct SMS', actionType: 'DIRECT_SMS' }
  },
  {
    id: 'send_notification_email',
    title: 'Send Notification (Email)',
    description: 'Send an email notification internally to workspace assignees, selected team members or custom emails.',
    category: 'sending_options',
    icon: Mail,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send Notification (Email)', actionType: 'SEND_NOTIFICATION_EMAIL' }
  },
  {
    id: 'send_notification_sms',
    title: 'Send Notification (SMS)',
    description: 'Deliver an administrative SMS text alert to assignees, team members or custom numbers.',
    category: 'sending_options',
    icon: Smartphone,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send Notification (SMS)', actionType: 'SEND_NOTIFICATION_SMS' }
  },
  {
    id: 'send_notification_in_app',
    title: 'Send Notification (In-App)',
    description: 'Trigger a real-time, in-app notification badge inside the workspace app portal.',
    category: 'sending_options',
    icon: Bell,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send Notification (In-App)', actionType: 'SEND_NOTIFICATION_IN_APP' }
  },
  {
    id: 'send_notification_push',
    title: 'Send Notification (Push)',
    description: 'Send a native push notification to workspace assignees or team members.',
    category: 'sending_options',
    icon: Smartphone,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Send Notification (Push)', actionType: 'SEND_NOTIFICATION_PUSH' }
  },

  // Conditions & Flow
  {
    id: 'delay',
    title: 'Delay',
    description: 'Pause automation execution for a specified duration of minutes, hours, or days.',
    category: 'conditions_flow',
    icon: Clock,
    nodeType: 'delayNode',
    payload: { type: 'delayNode', label: 'Temporal Wait', config: { value: 5, unit: 'Minutes' } }
  },
  {
    id: 'if_else_split',
    title: 'If/Else Split',
    description: 'Branch the flow into two pathways based on logical conditions or field values.',
    category: 'conditions_flow',
    icon: ArrowRightLeft,
    nodeType: 'conditionNode',
    payload: { type: 'conditionNode', label: 'Logical Decision' }
  },
  {
    id: 'tag_split',
    title: 'Tag Split',
    description: 'Separate contacts into branches depending on whether they possess specific tags.',
    category: 'conditions_flow',
    icon: Tag,
    nodeType: 'tagConditionNode',
    payload: { type: 'tagConditionNode', label: 'Tag Condition' }
  },
  {
    id: 'run_automation',
    title: 'Run Automation',
    description: 'Trigger another sub-automation flow sequentially by its reference ID.',
    category: 'conditions_flow',
    icon: Zap,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Run Automation', actionType: 'RUN_AUTOMATION' }
  },
  {
    id: 'ab_split',
    title: 'A/B Split',
    description: 'Statelessly route contacts down two branching paths based on a configured split ratio.',
    category: 'conditions_flow',
    icon: SplitSquareVertical,
    nodeType: 'abSplitNode',
    payload: { type: 'abSplitNode', label: 'A/B Split (50/50)', config: { splitRatio: 50 } }
  },
  {
    id: 'jump_to',
    title: 'Jump To (Goal)',
    description: 'Jump contacts to this step from other parts of the automation when they meet specific milestone conditions.',
    category: 'conditions_flow',
    icon: Milestone,
    nodeType: 'jumpToNode',
    payload: { 
      type: 'jumpToNode', 
      label: 'Jump To Milestone', 
      config: { groups: [], relation: 'and', jumpFromAnywhere: true, sequentialBehavior: 'wait' } 
    }
  },

  // Contacts & Data
  {
    id: 'add_tag',
    title: 'Add Tag',
    description: 'Apply one or more custom tags to the contact record at this step.',
    category: 'contacts_data',
    icon: Tag,
    nodeType: 'tagActionNode',
    payload: { type: 'tagActionNode', label: 'Add Tag', actionType: 'ADD_TAG' }
  },
  {
    id: 'remove_tag',
    title: 'Remove Tag',
    description: 'Strip tags from the contact record to update lifecycle lists.',
    category: 'contacts_data',
    icon: Tag,
    nodeType: 'tagActionNode',
    payload: { type: 'tagActionNode', label: 'Remove Tag', actionType: 'REMOVE_TAG' }
  },
  {
    id: 'update_entity',
    title: 'Update Entity',
    description: 'Modify standard profile fields or custom field schemas automatically.',
    category: 'contacts_data',
    icon: Building,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Entity', actionType: 'UPDATE_ENTITY' }
  },
  {
    id: 'assign_entity',
    title: 'Assign Entity',
    description: 'Assign ownership of the entity to a specific workspace team member.',
    category: 'contacts_data',
    icon: Building,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Assign Entity', actionType: 'ASSIGN_ENTITY' }
  },
  {
    id: 'add_note',
    title: 'Add Note',
    description: 'Append an administrative timeline note to the entity record history.',
    category: 'contacts_data',
    icon: Database,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Add Note', actionType: 'ADD_NOTE' }
  },
  {
    id: 'add_contact_to_entity',
    title: 'Add Contact to Entity',
    description: 'Locate an existing business entity via Exact Match and append a secondary contact.',
    category: 'contacts_data',
    icon: Tag,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Add Contact to Entity', actionType: 'ADD_CONTACT_TO_ENTITY' }
  },
  {
    id: 'update_contact',
    title: 'Update Contact',
    description: 'Locate an existing contact inside an entity using filters, and update their details.',
    category: 'contacts_data',
    icon: UserCog,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Contact', actionType: 'UPDATE_CONTACT', config: { matchLogic: 'all', caseInsensitive: false } }
  },
  {
    id: 'add_to_call_campaign',
    title: 'Add to Call Campaign',
    description: 'Add the target contact or entity to a specific call campaign for automated queueing.',
    category: 'contacts_data',
    icon: Tag,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Add to Call Campaign', actionType: 'ADD_TO_CALL_CAMPAIGN', config: { campaignId: '', contactScope: 'primary' } }
  },
  {
    id: 'create_entity',
    title: 'Create Entity',
    description: 'Create a new CRM contact or business entity using mapped webhook payload attributes.',
    category: 'contacts_data',
    icon: Building,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Create Entity', actionType: 'CREATE_ENTITY' }
  },
  {
    id: 'update_lead_score',
    title: 'Adjust Lead Score',
    description: 'Add, subtract, or set a score for the triggering contact.',
    category: 'contacts_data',
    icon: Sparkles,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Adjust Lead Score', actionType: 'UPDATE_LEAD_SCORE' }
  },

  // CRM & Sales
  {
    id: 'create_deal',
    title: 'Create Deal',
    description: 'Initiate a sales deal card in the active pipeline board with value tags.',
    category: 'crm_sales',
    icon: Target,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Create Deal', actionType: 'CREATE_DEAL' }
  },
  {
    id: 'update_deal_stage',
    title: 'Update Deal Stage',
    description: 'Shift a deal to another step on the Kanban pipeline board.',
    category: 'crm_sales',
    icon: ArrowRightLeft,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Deal Stage', actionType: 'UPDATE_DEAL_STAGE' }
  },
  {
    id: 'update_deal_value',
    title: 'Update Deal Value',
    description: 'Adjust estimated value metrics of the active deal.',
    category: 'crm_sales',
    icon: Target,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Deal Value', actionType: 'UPDATE_DEAL_VALUE' }
  },
  {
    id: 'update_deal_status',
    title: 'Update Deal Status',
    description: 'Set status to Won, Lost, or Reopened.',
    category: 'crm_sales',
    icon: CheckSquare,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Deal Status', actionType: 'UPDATE_DEAL_STATUS' }
  },
  {
    id: 'create_task',
    title: 'Create Task',
    description: 'Assign a CRM task with deadline offset to standard agents or supervisors.',
    category: 'crm_sales',
    icon: CheckSquare,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Initialize Task', actionType: 'CREATE_TASK' }
  },
  {
    id: 'update_task',
    title: 'Update Task',
    description: 'Mark existing active tasks complete or reschedule priorities.',
    category: 'crm_sales',
    icon: CheckSquare,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Update Task', actionType: 'UPDATE_TASK' }
  },

  // Integrations
  {
    id: 'call_webhook',
    title: 'Call Webhook',
    description: 'Send an outbound POST request with current profile payload to external services.',
    category: 'integrations',
    icon: Globe,
    nodeType: 'actionNode',
    payload: { type: 'actionNode', label: 'Call Webhook', actionType: 'TRIGGER_OUTBOUND_WEBHOOK' }
  },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  start_triggers: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/5',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20 group-hover:border-emerald-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  },
  sending_options: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/5',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20 group-hover:border-blue-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  conditions_flow: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/5',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20 group-hover:border-amber-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  },
  contacts_data: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/5',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/20 group-hover:border-violet-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]',
  },
  crm_sales: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/5',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20 group-hover:border-rose-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  },
  integrations: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/5',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20 group-hover:border-indigo-500/50',
    glow: 'group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]',
  },
};

const defaultStyle = {
  bg: 'bg-slate-500/10 dark:bg-slate-500/5',
  text: 'text-slate-600 dark:text-slate-400',
  border: 'border-slate-500/20 group-hover:border-slate-500/50',
  glow: 'group-hover:shadow-sm',
};

export default function AutomationStepLibraryModal({
  open,
  onOpenChange,
  onSelect,
  hasParentSelected = false,
}: AutomationStepLibraryModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const { singular } = useTerminology();

  // Reset category and search query on open
  React.useEffect(() => {
    if (open) {
      setSearchQuery('');
      setActiveCategory('all');
    }
  }, [open]);

  // Localize library items based on active vertical terminology
  const localizedLibraryItems = React.useMemo(() => {
    return LIBRARY_ITEMS.map((item) => {
      if (item.id === 'create_entity') {
        return {
          ...item,
          title: `Create ${singular}`,
          description: `Create a new CRM ${singular.toLowerCase()} entity using mapped webhook payload attributes.`,
          payload: {
            ...item.payload,
            label: `Create ${singular}`,
          },
        };
      }
      return item;
    });
  }, [singular]);

  // Real-time client-side filter
  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return localizedLibraryItems.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesQuery = !query || 
        item.title.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, activeCategory, localizedLibraryItems]);

  const getCategoryCount = React.useCallback((catId: string) => {
    const query = searchQuery.trim().toLowerCase();
    return localizedLibraryItems.filter((item) => {
      const matchesCategory = catId === 'all' || item.category === catId;
      const matchesQuery = !query || 
        item.title.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    }).length;
  }, [searchQuery, localizedLibraryItems]);

  const isTriggerCategoryDisabled = React.useCallback((catId: string) => {
    return hasParentSelected && catId === 'start_triggers';
  }, [hasParentSelected]);

  const isItemDisabled = React.useCallback((item: any) => {
    return hasParentSelected && item.category === 'start_triggers';
  }, [hasParentSelected]);

  const handleItemSelect = (item: any) => {
    if (isItemDisabled(item)) return;
    onSelect(item.payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[650px] p-0 overflow-hidden rounded-3xl border border-border bg-card text-left shadow-2xl flex flex-col focus:outline-none">
        <DialogHeader className="p-6 bg-muted/10 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">Automation Step Library</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                Select triggers, options, logic splits, or CRM integrations to architect your automation step workflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 border-r border-border bg-muted/5 p-4 flex flex-col justify-between overflow-y-auto shrink-0 select-none">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-3 mb-3">
                Categories
              </p>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const isDisabled = isTriggerCategoryDisabled(cat.id);
                const count = getCategoryCount(cat.id);
                
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left font-bold text-xs transition-all relative group/btn",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.98]",
                      isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent text-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0 transition-colors",
                        isActive 
                          ? "bg-white/20 text-white" 
                          : "bg-muted text-muted-foreground group-hover/btn:bg-muted-foreground/10 group-hover/btn:text-foreground"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="truncate">{cat.label}</span>
                    </div>
                    {isDisabled ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full shrink-0",
                        isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {hasParentSelected && (
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2.5 text-left mt-6">
                <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[9px] font-semibold text-amber-600/90 leading-normal">
                  Start triggers are entry-only and cannot be placed after other automation steps.
                </p>
              </div>
            )}
          </div>

          {/* Right Content Grid */}
          <div className="flex-1 flex flex-col min-w-0 bg-background/30">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-border flex items-center justify-between gap-4 bg-card/30 backdrop-blur-md shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search operational protocols, actions, triggers..."
                  className="pl-10 pr-9 h-11 rounded-2xl bg-muted/20 border-border shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-semibold text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Elements Cards Bento Grid */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {filteredItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const style = CATEGORY_STYLES[item.category] || defaultStyle;
                    const isDisabled = isItemDisabled(item);
                    
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleItemSelect(item)}
                        className={cn(
                          "group flex flex-col items-start p-5 rounded-3xl border border-border bg-card hover:bg-card/80 text-left transition-all duration-300 hover:border-transparent hover:scale-[1.01] hover:-translate-y-0.5",
                          style.glow,
                          isDisabled && "opacity-40 cursor-not-allowed hover:scale-100 hover:translate-y-0 hover:bg-card hover:border-border hover:shadow-none"
                        )}
                      >
                        <div className="flex items-start gap-4 mb-3 w-full">
                          <div className={cn(
                            "p-3 rounded-2xl transition-all shadow-sm shrink-0",
                            style.bg,
                            style.text
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                              {item.title}
                            </h4>
                            {isDisabled ? (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all group-hover:translate-x-0.5 shrink-0" />
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-3xl border-border bg-background/50 m-2">
                  <Search className="h-10 w-10 text-muted-foreground/30 mb-4 animate-bounce" />
                  <h3 className="font-bold text-sm text-foreground mb-1">No steps found</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    We couldn&apos;t find anything matching &ldquo;{searchQuery}&rdquo; in this category. Try adjusting your query or selecting a different category.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
