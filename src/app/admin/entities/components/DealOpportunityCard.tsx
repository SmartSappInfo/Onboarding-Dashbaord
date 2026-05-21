'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, TrendingUp, Calendar, Tag, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Module-level constants — NOT inside component to prevent recreation on every render (vercel best practices)
const STAGE_COLOR_MAP: Record<string, string> = {
  lead: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  qualified: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  proposal: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  negotiation: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function getStageColor(stageName: string): string {
  const key = stageName.toLowerCase().replace(/\s+/g, '');
  return STAGE_COLOR_MAP[key] ?? 'bg-muted/10 text-muted-foreground border-border/20';
}

export interface DealConfig {
  enabled: boolean;
  pipelineId: string;
  stageId: string;
  name: string;
  value: number;
  expectedCloseDate: string;
  suppressAutomations: boolean;
}

interface DealOpportunityCardProps {
  config: DealConfig;
  onChange: (patch: Partial<DealConfig>) => void;
  pipelines: any[];
  stages: any[];
  dealNameManuallyEdited: React.MutableRefObject<boolean>;
}

export const DealOpportunityCard = React.memo(function DealOpportunityCard({
  config,
  onChange,
  pipelines,
  stages,
  dealNameManuallyEdited,
}: DealOpportunityCardProps) {
  // Filter stages based on selected pipeline using a memoized O(1) lookup map (vercel best practices)
  const stagesByPipeline = React.useMemo(() => {
    const map = new Map<string, any[]>();
    stages?.forEach(stage => {
      const pipelineId = stage.pipelineId;
      if (!map.has(pipelineId)) {
        map.set(pipelineId, []);
      }
      map.get(pipelineId)!.push(stage);
    });
    return map;
  }, [stages]);

  const activeStages = React.useMemo(() => {
    if (!config.pipelineId) return [];
    return stagesByPipeline.get(config.pipelineId) || [];
  }, [config.pipelineId, stagesByPipeline]);

  const handleToggle = React.useCallback((checked: boolean) => {
    onChange({ enabled: checked });
  }, [onChange]);

  const handlePipelineChange = React.useCallback((val: string) => {
    const pipelineStages = stagesByPipeline.get(val) || [];
    const firstStageId = pipelineStages[0]?.id || '';
    onChange({ pipelineId: val, stageId: firstStageId });
  }, [onChange, stagesByPipeline]);

  const handleStageChange = React.useCallback((val: string) => {
    onChange({ stageId: val });
  }, [onChange]);

  const handleNameChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dealNameManuallyEdited.current = true;
    onChange({ name: e.target.value });
  }, [onChange, dealNameManuallyEdited]);

  const handleValueChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    onChange({ value: val });
  }, [onChange]);

  const handleDateChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ expectedCloseDate: e.target.value });
  }, [onChange]);

  const handleSuppressChange = React.useCallback((checked: boolean) => {
    onChange({ suppressAutomations: checked });
  }, [onChange]);

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 ${
      config.enabled 
        ? 'border-emerald-500/30 bg-emerald-950/5 dark:bg-emerald-950/10 shadow-md shadow-emerald-500/5' 
        : 'border-border/50 bg-card'
    }`}>
      {/* Decorative premium revenue line */}
      {config.enabled && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/40 via-teal-500/60 to-emerald-500/40" />
      )}

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className={`h-4 w-4 ${config.enabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            Deal Opportunity
          </CardTitle>
          <CardDescription className="text-xs">
            Auto-create pipeline record
          </CardDescription>
        </div>
        <Switch 
          checked={config.enabled} 
          onCheckedChange={handleToggle}
          aria-label="Enable linked deal creation"
        />
      </CardHeader>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        config.enabled ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <CardContent className="px-4 pb-4 pt-1 space-y-3.5 border-t border-border/20">
          {/* Pipeline & Stage */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Pipeline</Label>
              <Select value={config.pipelineId} onValueChange={handlePipelineChange}>
                <SelectTrigger className="h-8.5 rounded-lg text-xs bg-background/50">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines?.map(pipeline => (
                    <SelectItem key={pipeline.id} value={pipeline.id} className="text-xs">
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Stage</Label>
              <Select 
                value={config.stageId} 
                onValueChange={handleStageChange}
                disabled={!config.pipelineId || activeStages.length === 0}
              >
                <SelectTrigger className="h-8.5 rounded-lg text-xs bg-background/50">
                  <SelectValue placeholder={config.pipelineId ? "Select stage" : "Choose pipeline first"} />
                </SelectTrigger>
                <SelectContent>
                  {activeStages.map(stage => {
                    const pillClass = getStageColor(stage.name);
                    return (
                      <SelectItem key={stage.id} value={stage.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] border ${pillClass}`}>
                            {stage.name}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deal Name */}
          <div className="space-y-1">
            <Label htmlFor="deal-name" className="text-xs font-medium text-muted-foreground">Deal Name</Label>
            <div className="relative">
              <Input
                id="deal-name"
                value={config.name}
                onChange={handleNameChange}
                placeholder="Enter deal name"
                className="h-8.5 rounded-lg text-xs pl-8 bg-background/50"
              />
              <Tag className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Value & Close Date */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="deal-value" className="text-xs font-medium text-muted-foreground">Deal Value</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-muted-foreground font-semibold">$</span>
                <Input
                  id="deal-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.value || ''}
                  onChange={handleValueChange}
                  placeholder="0.00"
                  className="h-8.5 rounded-lg text-xs pl-6 bg-background/50 text-emerald-400 font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="deal-close-date" className="text-xs font-medium text-muted-foreground">Est. Close Date</Label>
              <div className="relative">
                <Input
                  id="deal-close-date"
                  type="date"
                  value={config.expectedCloseDate}
                  onChange={handleDateChange}
                  className="h-8.5 rounded-lg text-xs pl-8 bg-background/50 [color-scheme:dark]"
                />
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Suppress Automations Switch */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/30">
            <div className="flex items-start gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor="suppress-automations" className="text-[11px] font-medium leading-none flex items-center gap-1">
                  Suppress Automations
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-[10px] p-2 bg-popover border border-border">
                        When enabled, deal creation won't fire automated triggers (e.g. email notifications or background protocols). Recommended to prevent spam.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <p className="text-[10px] text-muted-foreground">Skip automated workflow triggers</p>
              </div>
            </div>
            <Switch
              id="suppress-automations"
              checked={config.suppressAutomations}
              onCheckedChange={handleSuppressChange}
              aria-label="Suppress automations for this deal"
            />
          </div>
        </CardContent>
      </div>
    </Card>
  );
});
