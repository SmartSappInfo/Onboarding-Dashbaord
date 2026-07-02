'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Zap, 
  GitCommit, 
  Play, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  ArrowDown, 
  Sparkles, 
  Tag, 
  Bell, 
  Edit3, 
  CheckCircle,
  HelpCircle,
  X
} from 'lucide-react';
import type { SocialAutomationRule } from '@/lib/types';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type ActionType = 'draft_ai_reply' | 'crm_tag_lead' | 'notify_admin';

interface ActionItem {
  id: string;
  type: ActionType;
  params: {
    tagName?: string;
    aiTone?: string;
    notifyInApp?: boolean;
    notifyEmail?: boolean;
  };
}

interface ActionRowProps {
  action: ActionItem;
  index: number;
  onTypeChange: (id: string, type: ActionType) => void;
  onParamsChange: (id: string, patch: Partial<ActionItem['params']>) => void;
  onRemove: (id: string) => void;
}

// Memoized action card row to optimize typing changes re-renders
const ActionRow = React.memo(function ActionRow({
  action,
  index,
  onTypeChange,
  onParamsChange,
  onRemove,
}: ActionRowProps) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="p-4 rounded-2xl border border-border/20 bg-background/50 space-y-3 relative"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge className="h-5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider">
            Step {index + 1}
          </Badge>
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase">Flow Action</span>
        </div>

        <div className="flex items-center gap-2">
          <Select 
            value={action.type} 
            onValueChange={(val: ActionType) => onTypeChange(action.id, val)}
          >
            <SelectTrigger className="h-8 w-44 rounded-xl border-border/30 text-[10px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl font-medium text-xs">
              <SelectItem value="draft_ai_reply">⚡ Draft AI Suggestion</SelectItem>
              <SelectItem value="crm_tag_lead">🏷️ Tag CRM Lead Profile</SelectItem>
              <SelectItem value="notify_admin">🔔 Send Admin Alert</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onRemove(action.id)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conditional Fields based on action type */}
      {action.type === 'draft_ai_reply' && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={`tone-input-${action.id}`} className="text-[9px] font-bold uppercase text-muted-foreground">AI Draft Tone Preset</Label>
          <Select
            value={action.params.aiTone || 'professional'}
            onValueChange={(val) => onParamsChange(action.id, { aiTone: val })}
          >
            <SelectTrigger id={`tone-input-${action.id}`} className="h-8 rounded-lg border-border/30 text-[10px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs font-semibold">
              <SelectItem value="professional">Professional & Helpful</SelectItem>
              <SelectItem value="friendly">Warm & Friendly</SelectItem>
              <SelectItem value="concise">Concise & Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {action.type === 'crm_tag_lead' && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={`tag-input-${action.id}`} className="text-[9px] font-bold uppercase text-muted-foreground">CRM Tag Label to Append</Label>
          <Input
            id={`tag-input-${action.id}`}
            placeholder="e.g., admissions-lead"
            value={action.params.tagName || ''}
            onChange={(e) => onParamsChange(action.id, { tagName: e.target.value })}
            className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
          />
        </div>
      )}

      {action.type === 'notify_admin' && (
        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-foreground cursor-pointer select-none">
            <Checkbox 
              checked={action.params.notifyInApp || false} 
              onCheckedChange={(val) => onParamsChange(action.id, { notifyInApp: !!val })} 
            />
            <Bell className="h-3.5 w-3.5 text-muted-foreground" /> Push Notification
          </label>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-foreground cursor-pointer select-none">
            <Checkbox 
              checked={action.params.notifyEmail || false} 
              onCheckedChange={(val) => onParamsChange(action.id, { notifyEmail: !!val })} 
            />
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Email Alerts Dispatch
          </label>
        </div>
      )}
    </motion.div>
  );
});

ActionRow.displayName = 'ActionRow';

export default function AutomationBuilderClient() {
  const db = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [activeRuleId, setActiveRuleId] = React.useState<string | null>(null);
  const [ruleName, setRuleName] = React.useState('Auto-responder Flow');
  
  // Triggers & Conditions
  const [triggerType, setTriggerType] = React.useState<SocialAutomationRule['trigger']>('inbound_message');
  const [conditionType, setConditionType] = React.useState<SocialAutomationRule['condition']>('all');
  const [conditionKeywords, setConditionKeywords] = React.useState<string[]>([]);
  const [keywordInput, setKeywordInput] = React.useState('');

  // Actions list state
  const [actions, setActions] = React.useState<ActionItem[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // 1. Fetch Automations rules
  const rulesQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialAutomations'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: rulesRaw, isLoading: isLoadingRules } = useCollection<SocialAutomationRule>(rulesQuery);
  const rules = rulesRaw || [];

  // Load selected rule configurations
  const loadRuleConfig = (rule: SocialAutomationRule) => {
    setActiveRuleId(rule.id);
    setRuleName(rule.name);
    setTriggerType(rule.trigger);
    setConditionType(rule.condition);
    setConditionKeywords(rule.conditionKeywords || []);
    setActions(
      (rule.actions || []).map((act) => ({
        id: act.id,
        type: act.type,
        params: act.params,
      }))
    );
  };

  // Switch to new rule layout
  const handleNewRule = () => {
    setActiveRuleId(null);
    setRuleName('New Auto-responder Flow');
    setTriggerType('inbound_message');
    setConditionType('all');
    setConditionKeywords([]);
    setActions([]);
  };

  // Add flow action card with stable ID
  const handleAddAction = React.useCallback(() => {
    const newAction: ActionItem = {
      id: `act_${Math.random().toString(36).substring(2, 11)}`,
      type: 'draft_ai_reply',
      params: {
        aiTone: 'professional',
        notifyInApp: true,
      },
    };
    setActions((prev) => [...prev, newAction]);
  }, []);

  // Action change handlers
  const handleTypeChange = React.useCallback((id: string, type: ActionType) => {
    setActions((prev) => 
      prev.map((act) => 
        act.id === id 
          ? { ...act, type, params: type === 'draft_ai_reply' ? { aiTone: 'professional' } : type === 'crm_tag_lead' ? { tagName: 'social-lead' } : { notifyInApp: true } }
          : act
      )
    );
  }, []);

  const handleParamsChange = React.useCallback((id: string, patch: Partial<ActionItem['params']>) => {
    setActions((prev) => 
      prev.map((act) => 
        act.id === id 
          ? { ...act, params: { ...act.params, ...patch } } 
          : act
      )
    );
  }, []);

  const handleRemoveAction = React.useCallback((id: string) => {
    setActions((prev) => prev.filter((act) => act.id !== id));
  }, []);

  // Save automation rule profile
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeWorkspaceId) return;

    setIsSaving(true);
    try {
      const activeId = activeRuleId || `rule_${Math.random().toString(36).substring(2, 11)}`;
      const payload: SocialAutomationRule = {
        id: activeId,
        orgId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name: ruleName.trim(),
        trigger: triggerType,
        condition: conditionType,
        conditionKeywords,
        actions: actions.map((act) => ({
          id: act.id,
          type: act.type,
          params: act.params,
        })),
        active: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'socialAutomations', activeId), payload);
      setActiveRuleId(activeId);

      toast({
        title: 'Automation Flow Saved',
        description: `Visual flow rules configured successfully under "${ruleName}".`,
      });
    } catch (err: unknown) {
      console.error('[AUTOMATIONS:SAVE] Error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save automation flow';
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete rule configuration
  const handleDeleteRule = async () => {
    if (!activeRuleId || !db) return;
    try {
      await deleteDoc(doc(db, 'socialAutomations', activeRuleId));
      toast({
        title: 'Flow Profile Deleted',
        description: 'Selected automation flow resolved successfully.',
      });
      handleNewRule();
    } catch (err: unknown) {
      console.error('[AUTOMATIONS:DELETE] Error:', err);
      toast({
        title: 'Delete Failed',
        description: 'Could not resolve rule document deletion.',
        variant: 'destructive',
      });
    }
  };

  // Keyword tags builder
  const handleAddKeywordTag = () => {
    if (!keywordInput.trim()) return;
    const clean = keywordInput.trim().toLowerCase();
    if (!conditionKeywords.includes(clean)) {
      setConditionKeywords((prev) => [...prev, clean]);
    }
    setKeywordInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-7xl mx-auto py-6 px-4 gap-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Automation Builder</h1>
            <p className="text-muted-foreground text-xs font-medium">Design instant triggers to tag leads, generate drafts, and alert teams in real-time.</p>
          </div>
        </div>

        <Button 
          onClick={handleNewRule}
          className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10 self-end sm:self-auto"
        >
          <Plus className="h-4 w-4" /> New Flow Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 overflow-hidden">
        {/* Column 1: Rules profiles list (3/12) */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden border border-border/20 rounded-3xl bg-card/20 backdrop-blur-md p-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Saved Workflows</span>
          
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-none">
            {isLoadingRules ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading rules...</span>
              </div>
            ) : rules.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 p-4 text-center">
                <GitCommit className="h-6 w-6 opacity-35" />
                <span className="text-[10px] font-bold uppercase tracking-wider">No workflows set</span>
              </div>
            ) : (
              rules.map((rule) => {
                const isSelected = rule.id === activeRuleId;
                return (
                  <button
                    key={rule.id}
                    onClick={() => loadRuleConfig(rule)}
                    className={cn(
                      "w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col gap-1 active:scale-[0.99]",
                      isSelected 
                        ? "bg-background/60 border-emerald-500/30 text-foreground shadow-lg shadow-emerald-500/2"
                        : "bg-background/20 border-border/20 hover:border-border/40 text-muted-foreground"
                    )}
                  >
                    <span className="font-extrabold text-xs text-foreground block truncate">{rule.name}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                      {rule.trigger} ⚡ {rule.actions.length} Steps
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Visual Node Flow (9/12) */}
        <div className="lg:col-span-9 flex flex-col border border-border/20 rounded-3xl bg-card/10 backdrop-blur-md overflow-hidden relative">
          <form onSubmit={handleSaveRule} className="flex flex-col h-full">
            <div className="border-b border-border/20 p-4 bg-muted/10 flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="h-9 font-extrabold text-xs rounded-lg border-border/30 bg-transparent text-foreground focus-visible:bg-background"
                  required
                />
              </div>

              {activeRuleId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteRule}
                  className="h-8 px-3 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                >
                  Delete Flow
                </Button>
              )}
            </div>

            {/* Node Flow scrollable area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-none max-w-2xl mx-auto w-full">
              {/* NODE 1: TRIGGER */}
              <div className="p-5 rounded-3xl border border-border/30 bg-background/40 backdrop-blur shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border/10 pb-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </div>
                  <span className="text-xs font-black uppercase text-foreground">1. Automation Trigger</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trigger-picker" className="text-[10px] font-bold uppercase text-muted-foreground">Select System Event Trigger</Label>
                  <Select 
                    value={triggerType} 
                    onValueChange={(val: SocialAutomationRule['trigger']) => setTriggerType(val)}
                  >
                    <SelectTrigger id="trigger-picker" className="h-10 rounded-xl border-border/30 bg-background">
                      <SelectValue placeholder="Select trigger event" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs font-semibold">
                      <SelectItem value="inbound_message">💬 New Direct Message (DM/Comment) received</SelectItem>
                      <SelectItem value="brand_mention">📢 Keyword/Brand mention captured in listening</SelectItem>
                      <SelectItem value="negative_sentiment">⚠️ Negative Sentiment comment identified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CONNECTOR ARROW */}
              <div className="flex justify-center py-1">
                <ArrowDown className="h-5 w-5 text-muted-foreground/30 animate-pulse" />
              </div>

              {/* NODE 2: CONDITIONS */}
              <div className="p-5 rounded-3xl border border-border/30 bg-background/40 backdrop-blur shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border/10 pb-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Edit3 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase text-foreground">2. Filter Conditions</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="condition-picker" className="text-[10px] font-bold uppercase text-muted-foreground">Match Criteria</Label>
                    <Select 
                      value={conditionType} 
                      onValueChange={(val: SocialAutomationRule['condition']) => setConditionType(val)}
                    >
                      <SelectTrigger id="condition-picker" className="h-10 rounded-xl border-border/30 bg-background">
                        <SelectValue placeholder="Select condition criteria" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs font-semibold">
                        <SelectItem value="all">Match all inquiries</SelectItem>
                        <SelectItem value="contains_keywords">Contains specific keywords</SelectItem>
                        <SelectItem value="negative_only">Filter negative sentiments only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {conditionType === 'contains_keywords' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="flow-kw-input" className="text-[10px] font-bold uppercase text-muted-foreground">Target Keywords</Label>
                      <div className="flex gap-2">
                        <Input
                          id="flow-kw-input"
                          placeholder="tuition, fee"
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeywordTag(); } }}
                          className="h-10 rounded-xl border-border/30 bg-background text-xs"
                        />
                        <Button type="button" onClick={handleAddKeywordTag} className="rounded-xl h-10 px-4 bg-muted hover:bg-muted/80 text-xs font-bold">
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {conditionType === 'contains_keywords' && conditionKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {conditionKeywords.map((tag) => (
                      <Badge key={tag} className="h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold uppercase text-[9px] gap-1">
                        {tag}
                        <button type="button" onClick={() => setConditionKeywords(prev => prev.filter(k => k !== tag))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* CONNECTOR ARROW */}
              <div className="flex justify-center py-1">
                <ArrowDown className="h-5 w-5 text-muted-foreground/30 animate-pulse" />
              </div>

              {/* NODE 3: DYNAMIC ACTIONS LIST */}
              <div className="p-5 rounded-3xl border border-border/30 bg-background/40 backdrop-blur shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <CheckCircle className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase text-foreground">3. Dispatch Actions</span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddAction}
                    className="h-7 gap-1 text-[10px] active:scale-[0.97] transition-all rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Step Action
                  </Button>
                </div>

                {actions.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/60 italic py-4 text-center leading-relaxed">
                    No steps added yet. Click "Add Step Action" to build your responder chain.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {actions.map((action, idx) => (
                        <ActionRow
                          key={action.id}
                          action={action}
                          index={idx}
                          onTypeChange={handleTypeChange}
                          onParamsChange={handleParamsChange}
                          onRemove={handleRemoveAction}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Save bar */}
            <div className="border-t border-border/20 p-4 bg-muted/10 flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase active:scale-[0.97] transition-all gap-1.5 shadow-lg shadow-emerald-500/10"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Automation Flow
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
