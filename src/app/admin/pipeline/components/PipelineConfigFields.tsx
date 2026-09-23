'use client';

/**
 * @fileOverview Reusable Pipeline Configuration Fields (Single Source of Truth)
 * 
 * ARCHITECTURAL POINTER & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. This component is the SINGLE SOURCE OF TRUTH for pipeline configuration fields.
 *    It is shared between:
 *    - Full Page Config Tab: PipelineConfigView.tsx (variant="full")
 *    - Draft-First Popup Modal: CreatePipelineModal.tsx (variant="modal")
 *    - Backoffice Settings: PipelineSettingsClient.tsx (variant="full")
 * 2. It is a strictly typed, pure controlled component without internal database side-effects.
 * 3. Strict zero 'any' / 'any[]' compliance (Rule 5).
 * 4. Mobile touch targets >= 44px on interactive controls (Rule 7).
 */

import * as React from 'react';
import type { PipelineType } from '@/lib/types';
import { 
    ShieldCheck, 
    Settings2, 
    Layout, 
    Users, 
    Calendar, 
    DollarSign,
    Bookmark 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateExpectedCloseDate } from '../utils/deal-expected-close';

export interface PipelineFormData {
  name: string;
  description: string;
  type: PipelineType;
  defaultProbability: number;
  workspaceIds: string[];
  columnWidth: number;
  showDealTotals: boolean;
  defaultPresetViewId?: string;
  accessRoles: string[];
  assignmentStrategy: 'direct' | 'round-robin' | 'value-based' | 'unassigned';
  assignmentUserIds: string[];
  defaultCloseDateOffsetValue: number | '';
  defaultCloseDateOffsetUnit: 'hours' | 'days' | 'months';
}

export interface PipelineConfigOption {
  label: string;
  value: string;
  sublabel?: string;
  keywords?: string[];
}

export interface PipelineConfigFieldsProps {
  formData: PipelineFormData;
  onChange: <K extends keyof PipelineFormData>(key: K, value: PipelineFormData[K]) => void;
  workspaceOptions: PipelineConfigOption[];
  roleOptions: PipelineConfigOption[];
  workspaceUserOptions: PipelineConfigOption[];
  variant?: 'full' | 'modal';
  disabled?: boolean;
}

export function PipelineConfigFields({
  formData,
  onChange,
  workspaceOptions,
  roleOptions,
  workspaceUserOptions,
  variant = 'full',
  disabled = false,
}: PipelineConfigFieldsProps) {
  const sampleCloseDate = React.useMemo(() => {
    const num = typeof formData.defaultCloseDateOffsetValue === 'number' && formData.defaultCloseDateOffsetValue > 0
      ? formData.defaultCloseDateOffsetValue
      : null;
    if (!num) return null;
    return calculateExpectedCloseDate({
      defaultCloseDateOffsetValue: num,
      defaultCloseDateOffsetUnit: formData.defaultCloseDateOffsetUnit,
    }, null);
  }, [formData.defaultCloseDateOffsetValue, formData.defaultCloseDateOffsetUnit]);

  // Master Blueprint Fields (Rendered identically in both variants)
  const renderMasterBlueprint = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Pipeline Name
          </Label>
          <Input 
            value={formData.name} 
            onChange={(e) => onChange('name', e.target.value)} 
            placeholder="e.g. Enterprise Sales"
            disabled={disabled}
            className="min-h-[44px] rounded-xl border border-border bg-background shadow-xs text-sm px-4 focus-visible:ring-1 focus-visible:ring-primary/30 font-medium" 
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Pipeline Type
          </Label>
          <Select 
            value={formData.type} 
            onValueChange={(val: PipelineType) => onChange('type', val)}
            disabled={disabled}
          >
            <SelectTrigger className="min-h-[44px] rounded-xl text-xs font-medium bg-background border-border">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border shadow-xl">
              <SelectItem value="sales">Sales Pipeline</SelectItem>
              <SelectItem value="new_business">New Business</SelectItem>
              <SelectItem value="renewal">Renewals &amp; Retention</SelectItem>
              <SelectItem value="upsell">Upsell &amp; Expansion</SelectItem>
              <SelectItem value="cross_sell">Cross-sell</SelectItem>
              <SelectItem value="partnership">Strategic Partnerships</SelectItem>
              <SelectItem value="enrollment">Student Enrollment</SelectItem>
              <SelectItem value="implementation">Implementation &amp; Onboarding</SelectItem>
              <SelectItem value="customer_success">Customer Success</SelectItem>
              <SelectItem value="custom">Custom Workflow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-0.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Default Baseline Probability
          </Label>
          <Badge variant="outline" className="font-mono text-[11px] bg-background border-primary/20 text-primary rounded-lg font-bold">
            {formData.defaultProbability}%
          </Badge>
        </div>
        <Slider 
          value={[formData.defaultProbability]} 
          onValueChange={([v]) => onChange('defaultProbability', v)} 
          min={0} 
          max={100} 
          step={5} 
          disabled={disabled}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-0.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Column Density (Width)
          </Label>
          <Badge variant="outline" className="font-mono text-[11px] bg-background border-primary/20 text-primary rounded-lg font-bold">
            {formData.columnWidth}px
          </Badge>
        </div>
        <Slider 
          value={[formData.columnWidth]} 
          onValueChange={([v]) => onChange('columnWidth', v)} 
          min={280} 
          max={500} 
          step={10} 
          disabled={disabled}
        />
      </div>

      {/* Kanban Board Financial Metrics Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-border transition-colors">
        <div className="space-y-0.5 pr-4 text-left">
          <Label htmlFor="showDealTotals" className="text-xs font-bold flex items-center gap-2 cursor-pointer text-foreground">
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            Show Financial Totals in Kanban Columns
          </Label>
          <p className="text-[11px] text-muted-foreground font-normal leading-relaxed">
            Display cumulative deal value and weighted forecast in stage headers. Disabled by default.
          </p>
        </div>
        <Switch
          id="showDealTotals"
          checked={formData.showDealTotals}
          onCheckedChange={(val) => onChange('showDealTotals', val)}
          disabled={disabled}
          className="shrink-0"
        />
      </div>

      {/* Default Landing Filter Preset Selector */}
      <div className="space-y-2 text-left">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Bookmark size={13} className="text-primary" /> Default Landing Filter Preset
        </Label>
        <Select
          value={formData.defaultPresetViewId || 'preset_all_deals'}
          onValueChange={(val) => onChange('defaultPresetViewId', val)}
          disabled={disabled}
        >
          <SelectTrigger className="h-11 rounded-xl border border-border bg-background font-semibold text-xs px-3 focus-visible:ring-1 focus-visible:ring-primary/30">
            <SelectValue placeholder="Select default view..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="preset_all_deals" className="text-xs font-semibold">All Deals (Default)</SelectItem>
            <SelectItem value="preset_my_deals" className="text-xs font-semibold">My Deals (Assigned to user)</SelectItem>
            <SelectItem value="preset_closing_this_month" className="text-xs font-semibold">Closing This Month</SelectItem>
            <SelectItem value="preset_at_risk" className="text-xs font-semibold">At Risk (SLA breached / low health)</SelectItem>
            <SelectItem value="preset_stalled" className="text-xs font-semibold">Stalled Deals (Inactive)</SelectItem>
            <SelectItem value="preset_high_value" className="text-xs font-semibold">High Value (Top opportunities)</SelectItem>
            <SelectItem value="preset_won_quarter" className="text-xs font-semibold">Won This Quarter</SelectItem>
            <SelectItem value="preset_no_next_steps" className="text-xs font-semibold">Without Next Steps</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground font-normal leading-relaxed">
          The filter preset automatically applied when team members open this pipeline.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Scope Description
        </Label>
        <Textarea 
          value={formData.description} 
          onChange={(e) => onChange('description', e.target.value)} 
          placeholder="Describe target deals, customer tiers, or operational goals..."
          disabled={disabled}
          className="min-h-[84px] rounded-xl border border-border bg-background shadow-xs text-xs p-3.5 focus-visible:ring-1 focus-visible:ring-primary/30 font-medium leading-relaxed" 
        />
      </div>
    </div>
  );

  // Access & Routing Fields
  const renderAccessAndRouting = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Layout size={13} className="text-primary" /> Shared Workspace Context
        </Label>
        <MultiSelect 
          options={workspaceOptions} 
          value={formData.workspaceIds} 
          onChange={(val) => onChange('workspaceIds', val)} 
          placeholder="Assign to workspaces..." 
          disabled={disabled}
          className="rounded-xl border-border shadow-xs text-xs min-h-[44px]" 
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-primary" /> Authorized User Roles
        </Label>
        <MultiSelect 
          options={roleOptions} 
          value={formData.accessRoles} 
          onChange={(val) => onChange('accessRoles', val)} 
          placeholder="Grant visibility to roles (empty = all)..." 
          disabled={disabled}
          className="rounded-xl border-border shadow-xs text-xs min-h-[44px]" 
        />
      </div>

      <div className="space-y-4 pt-2 border-t border-border/50">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} className="text-primary" /> Routing Strategy
          </Label>
          <Select 
            value={formData.assignmentStrategy} 
            onValueChange={(val: 'direct' | 'round-robin' | 'value-based' | 'unassigned') => onChange('assignmentStrategy', val)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full min-h-[44px] rounded-xl bg-background border border-border px-3 text-xs font-medium">
              <SelectValue placeholder="Select strategy..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border shadow-xl">
              <SelectItem value="direct" className="text-xs">Manual (Inherit from deal creator/contact owner)</SelectItem>
              <SelectItem value="round-robin" className="text-xs">Round Robin (Equal lead distribution)</SelectItem>
              <SelectItem value="value-based" className="text-xs">Value-Based (Weight routing by deal size)</SelectItem>
              <SelectItem value="unassigned" className="text-xs">Leave Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(formData.assignmentStrategy === 'round-robin' || formData.assignmentStrategy === 'value-based') && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Assignee Pool
            </Label>
            <MultiSelect 
              options={workspaceUserOptions} 
              value={formData.assignmentUserIds} 
              onChange={(val) => onChange('assignmentUserIds', val)} 
              placeholder="Select eligible team members..." 
              searchPlaceholder="Search team members by name or email..."
              disabled={disabled}
              className="rounded-xl border border-border shadow-xs text-xs min-h-[44px]" 
            />
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={13} className="text-primary" /> Default Expected Close Date Offset
        </Label>
        <div className="flex items-center gap-3">
          <Input 
            type="number"
            min={1}
            value={formData.defaultCloseDateOffsetValue}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
              onChange('defaultCloseDateOffsetValue', isNaN(val as number) ? '' : val);
            }}
            placeholder="e.g. 30"
            disabled={disabled}
            className="w-28 min-h-[44px] rounded-xl text-xs font-medium"
          />
          <Select
            value={formData.defaultCloseDateOffsetUnit}
            onValueChange={(val: 'hours' | 'days' | 'months') => onChange('defaultCloseDateOffsetUnit', val)}
            disabled={disabled}
          >
            <SelectTrigger className="w-36 min-h-[44px] rounded-xl text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border shadow-xl">
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="months">Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sampleCloseDate && (
          <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Sample close date: <span className="font-semibold text-foreground">{sampleCloseDate}</span>
          </p>
        )}
      </div>
    </div>
  );

  // Variant Branching:
  // "modal" presents a compact segmented tab view optimized for dialog scrolling.
  // "full" presents the multi-card desktop grid layout.
  if (variant === 'modal') {
    return (
      <Tabs defaultValue="blueprint" className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-11 p-1 bg-muted/30 rounded-xl mb-4">
          <TabsTrigger value="blueprint" className="rounded-lg text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Blueprint &amp; Layout
          </TabsTrigger>
          <TabsTrigger value="routing" className="rounded-lg text-xs font-bold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Access &amp; Routing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="blueprint" className="mt-0 focus-visible:outline-none">
          {renderMasterBlueprint()}
        </TabsContent>
        <TabsContent value="routing" className="mt-0 focus-visible:outline-none">
          {renderAccessAndRouting()}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0">
              <Settings2 size={18} />
            </div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Master Blueprint</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          {renderMasterBlueprint()}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0">
              <ShieldCheck size={18} />
            </div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Access Architecture &amp; Rules</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          {renderAccessAndRouting()}
        </CardContent>
      </Card>
    </div>
  );
}
