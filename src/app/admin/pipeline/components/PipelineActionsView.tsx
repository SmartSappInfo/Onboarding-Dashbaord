'use client';

import * as React from 'react';
import type { Pipeline, OnboardingStage, Automation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Zap, Plus, ExternalLink, ArrowRight, Play, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { isAutomationLinkedToStage } from '@/lib/automation-stage-helpers';
import { toggleAutomationStatusAction } from '@/lib/automation-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn, toTitleCase } from '@/lib/utils';

interface PipelineActionsViewProps {
    pipeline: Pipeline;
    stages: OnboardingStage[];
    automations?: Automation[];
}

/**
 * ARCHITECTURAL POINTER (Pipeline Stage Actions View):
 * Displays all automations configured for the current pipeline, grouped stage-by-stage.
 * Provides live active/pause toggles, workflow step previews, and 1-click creation shortcuts.
 *
 * CAUTION FOR MAINTAINERS:
 * Ensure active status toggles update Firestore safely using `toggleAutomationStatusAction`.
 * Maintain 44x44px touch targets on mobile viewports.
 *
 * TESTABILITY POINTER:
 * Verify that creating or toggling an automation instantly updates both this view and stage column headers.
 */
export default function PipelineActionsView({ pipeline, stages, automations = [] }: PipelineActionsViewProps) {
    const { user } = useUser();
    const { toast } = useToast();
    const [togglingIds, setTogglingIds] = React.useState<Record<string, boolean>>({});

    const handleAddAutomationToStage = (stage: OnboardingStage) => {
        const url = `/admin/automations/new?pipelineId=${encodeURIComponent(pipeline.id)}&stageId=${encodeURIComponent(stage.id)}&pipelineName=${encodeURIComponent(pipeline.name)}&stageName=${encodeURIComponent(stage.name)}`;
        window.open(url, '_blank');
    };

    const handleToggleStatus = async (auto: Automation, currentActive: boolean) => {
        if (!user) return;
        setTogglingIds(prev => ({ ...prev, [auto.id]: true }));
        try {
            const res = await toggleAutomationStatusAction(auto.id, !currentActive, user.uid);
            if (res.success) {
                toast({
                    title: !currentActive ? 'Automation Activated' : 'Automation Paused',
                    description: `Workflow "${auto.name}" is now ${!currentActive ? 'active' : 'paused'}.`,
                });
            } else {
                throw new Error(res.error || 'Failed to update automation status.');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Update Failed', description: error });
        } finally {
            setTogglingIds(prev => ({ ...prev, [auto.id]: false }));
        }
    };

    const stageAutomationsMap = React.useMemo(() => {
        const map = new Map<string, Automation[]>();
        stages.forEach(s => {
            const list = automations.filter(a => !a.isArchived && isAutomationLinkedToStage(a, pipeline.id, s.id));
            map.set(s.id, list);
        });
        return map;
    }, [stages, automations, pipeline.id]);

    const totalAttachedCount = React.useMemo(() => {
        let count = 0;
        stageAutomationsMap.forEach(list => count += list.length);
        return count;
    }, [stageAutomationsMap]);

    return (
        <div className="h-full overflow-y-auto p-6 space-y-8 max-w-7xl mx-auto scrollbar-thin">
            {/* Top Overview Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-purple-500/10 border border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Pipeline Automations Engine
                        </Badge>
                        <span className="text-xs font-bold text-muted-foreground">• {stages.length} Stages</span>
                    </div>
                    <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                        Stage Action Rules for {pipeline.name}
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        Automations configured for each stage fire automatically when deals are moved into that stage. Manage rules, inspect workflow steps, or add new triggers directly below.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden md:block mr-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Workflows</p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalAttachedCount}</p>
                    </div>
                    {stages.length > 0 && (
                        <Button
                            onClick={() => handleAddAutomationToStage(stages[0])}
                            className="h-10 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.97] transition-all"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Stage Automation</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Stage-by-Stage Automation List */}
            <div className="space-y-6">
                {stages.map((stage, idx) => {
                    const stageAutos = stageAutomationsMap.get(stage.id) || [];
                    const stageColor = stage.color || '#3B5FFF';

                    return (
                        <Card key={stage.id} className="rounded-2xl border border-border/80 overflow-hidden shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="p-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm" style={{ backgroundColor: stageColor }}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-sm font-bold tracking-tight text-foreground">
                                                {toTitleCase(stage.name)}
                                            </CardTitle>
                                            <Badge
                                                variant="outline"
                                                className="rounded-full text-[10px] font-bold h-5 px-2 border-none"
                                                style={{ backgroundColor: `${stageColor}20`, color: stageColor }}
                                            >
                                                {stageAutos.length} {stageAutos.length === 1 ? 'Rule' : 'Rules'}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                            Triggers automatically when a deal enters "{stage.name}"
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddAutomationToStage(stage)}
                                    className="h-8 rounded-xl font-bold text-xs border-dashed border-border hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 flex items-center shrink-0"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Automation
                                </Button>
                            </CardHeader>

                            <CardContent className="p-4 bg-card">
                                {stageAutos.length === 0 ? (
                                    <div className="py-8 px-4 text-center rounded-xl bg-muted/10 border border-dashed border-border/60 flex flex-col items-center gap-2">
                                        <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground/40">
                                            <Sparkles className="h-5 w-5" />
                                        </div>
                                        <p className="text-xs font-semibold text-muted-foreground">No automations attached to this stage</p>
                                        <p className="text-[10px] text-muted-foreground/60 max-w-sm">
                                            Create automated tasks, SMS alerts, email workflows, or tag assignments when deals reach this milestone.
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAddAutomationToStage(stage)}
                                            className="mt-1 h-7 rounded-lg text-xs font-bold text-primary hover:bg-primary/10"
                                        >
                                            + Create First Stage Rule
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {stageAutos.map((auto) => {
                                            const nodeCount = Array.isArray(auto.nodes) ? auto.nodes.length : 0;
                                            const isToggling = Boolean(togglingIds[auto.id]);

                                            return (
                                                <div
                                                    key={auto.id}
                                                    className="p-4 rounded-xl bg-background border border-border/70 hover:border-primary/40 shadow-sm flex flex-col justify-between gap-3 transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="space-y-1 min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <Zap className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                                                                <h4 className="text-xs font-extrabold text-foreground truncate group-hover:text-primary transition-colors">
                                                                    {auto.name}
                                                                </h4>
                                                            </div>
                                                            {auto.description && (
                                                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                                    {auto.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Switch
                                                                checked={auto.isActive}
                                                                disabled={isToggling}
                                                                onCheckedChange={() => handleToggleStatus(auto, auto.isActive)}
                                                                className="data-[state=checked]:bg-emerald-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Steps Summary & Footer Actions */}
                                                    <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2 text-[10px]">
                                                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                                            <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold rounded-md bg-muted/40 border-none">
                                                                {nodeCount} {nodeCount === 1 ? 'Step' : 'Steps'}
                                                            </Badge>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "h-5 px-1.5 text-[9px] font-bold rounded-md border-none",
                                                                    auto.isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                                                                )}
                                                            >
                                                                {auto.isActive ? 'Active' : 'Paused'}
                                                            </Badge>
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => window.open(`/admin/automations/${auto.id}/edit`, '_blank')}
                                                            className="h-7 px-2 rounded-lg font-bold text-[10px] text-primary hover:bg-primary/10 gap-1 flex items-center"
                                                        >
                                                            <span>Edit Workflow</span>
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
