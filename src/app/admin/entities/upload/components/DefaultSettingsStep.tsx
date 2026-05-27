'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Settings2, TrendingUp, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagSelector } from '@/components/tags/TagSelector';
import { cn } from '@/lib/utils';
import type { DealImportConfig } from '@/lib/import-types';

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

interface DefaultSettingsStepProps {
    selectedGlobalTags: string[];
    setSelectedGlobalTags: React.Dispatch<React.SetStateAction<string[]>>;
    autoCreateTags: boolean;
    setAutoCreateTags: (val: boolean) => void;
    enableTitleCase: boolean;
    setEnableTitleCase: (val: boolean) => void;
    createDealForImport: boolean;
    setCreateDealForImport: (val: boolean) => void;
    dealImportConfig: DealImportConfig;
    setDealImportConfig: React.Dispatch<React.SetStateAction<DealImportConfig>>;
    pipelinesList: any[] | null | undefined;
    stagesList: any[] | null | undefined;
    selectedAutomationId: string | null;
    setSelectedAutomationId: (val: string | null) => void;
    automationsList: any[] | null | undefined;
    onBack: () => void;
    onNext: () => void;
    stepperMarkup?: React.ReactNode;
}

export function DefaultSettingsStep({
    selectedGlobalTags,
    setSelectedGlobalTags,
    autoCreateTags,
    setAutoCreateTags,
    enableTitleCase,
    setEnableTitleCase,
    createDealForImport,
    setCreateDealForImport,
    dealImportConfig,
    setDealImportConfig,
    pipelinesList,
    stagesList,
    selectedAutomationId,
    setSelectedAutomationId,
    automationsList,
    onBack,
    onNext,
    stepperMarkup,
}: DefaultSettingsStepProps) {
    const stagesByPipeline = React.useMemo(() => {
        const map = new Map<string, any[]>();
        stagesList?.forEach(s => {
            if (!map.has(s.pipelineId)) map.set(s.pipelineId, []);
            map.get(s.pipelineId)!.push(s);
        });
        return map;
    }, [stagesList]);

    const handlePipelineChange = React.useCallback((val: string) => {
        const pipelineStages = stagesByPipeline.get(val) || [];
        const firstStageId = pipelineStages[0]?.id || '';
        setDealImportConfig(prev => ({ ...prev, pipelineId: val, stageId: firstStageId }));
    }, [stagesByPipeline, setDealImportConfig]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Import Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">Configure automation and metadata for this batch.</p>
                </div>
                <Button variant="ghost" onClick={onBack} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5 animate-none">
                    <ArrowLeft size={16} className="mr-2" /> Back to Mapping
                </Button>
            </div>

            {stepperMarkup}

            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                            <Settings2 size={22} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold">Configuration</CardTitle>
                            <CardDescription className="text-xs font-medium">Set global tags and trigger workflows.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-12">
                    {/* Global Tags Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold">Apply Tags</h3>
                            <p className="text-sm text-muted-foreground">Select tags to apply to all records in this batch import.</p>
                        </div>
                        
                        <TagSelector
                            currentTagIds={selectedGlobalTags}
                            onTagsChange={(tagIds) => {
                                React.startTransition(() => {
                                    setSelectedGlobalTags(tagIds);
                                });
                            }}
                        />

                        <div className="w-full p-4 mt-6 rounded-xl bg-background border flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-sm">Auto-Create Missing Mapped Tags</p>
                                    <p className="text-xs text-muted-foreground">If a tag in the CSV doesn&apos;t exist, create it automatically.</p>
                                </div>
                                <Switch checked={autoCreateTags} onCheckedChange={setAutoCreateTags} />
                            </div>
                            <div className="border-t my-2 border-border/50" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-sm">Convert Text Fields to Title Case</p>
                                    <p className="text-xs text-muted-foreground">Clean formatting by converting ALL CAPS or all lowercase text values to Title Case.</p>
                                </div>
                                <Switch checked={enableTitleCase} onCheckedChange={setEnableTitleCase} />
                            </div>
                        </div>
                    </div>

                    {/* Deal Opportunity Section */}
                    <div className="space-y-4 pt-8 border-t">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <TrendingUp className={cn("h-5 w-5", createDealForImport ? "text-emerald-500" : "text-muted-foreground")} />
                                    Auto-Create Deals
                                </h3>
                                <p className="text-sm text-muted-foreground">Automatically create and link a pipeline deal for every imported record.</p>
                            </div>
                            <Switch 
                                checked={createDealForImport} 
                                onCheckedChange={setCreateDealForImport} 
                            />
                        </div>

                        <AnimatePresence>
                            {createDealForImport && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className={cn(
                                        "p-6 rounded-xl bg-background border flex flex-col gap-6 relative mt-4",
                                        "border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/10 shadow-sm"
                                    )}>
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/20 via-teal-500/40 to-emerald-500/20 rounded-t-xl" />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Pipeline */}
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold">Pipeline</Label>
                                                <Select 
                                                    value={dealImportConfig.pipelineId} 
                                                    onValueChange={handlePipelineChange}
                                                >
                                                    <SelectTrigger className="w-full h-11 bg-background">
                                                        <SelectValue placeholder="Select pipeline" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {pipelinesList?.map((pipeline: any) => (
                                                            <SelectItem key={pipeline.id} value={pipeline.id} className="font-semibold">
                                                                {pipeline.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Stage */}
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold">Stage</Label>
                                                <Select 
                                                    value={dealImportConfig.stageId} 
                                                    onValueChange={(val) => setDealImportConfig(prev => ({ ...prev, stageId: val }))}
                                                    disabled={!dealImportConfig.pipelineId}
                                                >
                                                    <SelectTrigger className="w-full h-11 bg-background">
                                                        <SelectValue placeholder="Select stage" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {(stagesByPipeline.get(dealImportConfig.pipelineId) || []).map((stage: any) => {
                                                            const pillClass = getStageColor(stage.name);
                                                            return (
                                                                <SelectItem key={stage.id} value={stage.id} className="font-semibold">
                                                                    <span className={cn("px-2 py-0.5 rounded text-xs border font-medium inline-block", pillClass)}>
                                                                        {stage.name}
                                                                    </span>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Name Template */}
                                            <div className="space-y-2">
                                                <Label htmlFor="deal-name-template" className="text-sm font-semibold">Deal Name Template</Label>
                                                <Input
                                                    id="deal-name-template"
                                                    value={dealImportConfig.nameTemplate}
                                                    onChange={(e) => setDealImportConfig(prev => ({ ...prev, nameTemplate: e.target.value }))}
                                                    placeholder="e.g. {{name}} - Onboarding"
                                                    className="h-11 rounded-xl bg-background"
                                                />
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Supported variables: <code className="text-primary font-mono font-bold bg-primary/5 px-1 rounded">{"{{name}}"}</code> (inserts entity name), <code className="text-primary font-mono font-bold bg-primary/5 px-1 rounded">{"{{date}}"}</code> (inserts current date).
                                                </p>
                                            </div>

                                            {/* Default Deal Value */}
                                            <div className="space-y-2">
                                                <Label htmlFor="deal-default-value" className="text-sm font-semibold">Default Deal Value</Label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-3 text-sm text-muted-foreground font-semibold">$</span>
                                                    <Input
                                                        id="deal-default-value"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={dealImportConfig.value || ''}
                                                        onChange={(e) => setDealImportConfig(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                                        placeholder="0.00"
                                                        className="h-11 rounded-xl pl-8 bg-background text-emerald-500 font-semibold"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Est. value of each created deal in USD.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Suppress Automations */}
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/50">
                                            <div className="flex items-start gap-3">
                                                <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-sm">Suppress Automation Workflows</p>
                                                    <p className="text-xs text-muted-foreground">Skip triggering any automated protocols or background action plans when deals are created. Recommended to prevent system-wide spam during large imports.</p>
                                                </div>
                                            </div>
                                            <Switch 
                                                checked={dealImportConfig.suppressAutomations} 
                                                onCheckedChange={(checked) => setDealImportConfig(prev => ({ ...prev, suppressAutomations: checked }))} 
                                            />
                                        </div>

                                        {/* Automation Warning alert inside config */}
                                        {selectedAutomationId && !dealImportConfig.suppressAutomations && (
                                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 dark:text-amber-400 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold">Automation Storm Risk</p>
                                                    <p className="mt-0.5 font-medium leading-relaxed">Both deal creation and active batch automation triggers are enabled, and Suppress Automations is off. Every imported record will fire all automated DEAL_CREATED trigger workflows. For large datasets, this may cause significant rate-limit issues or system slowdowns. Consider checking &quot;Suppress Automation Workflows&quot;.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Automations Section */}
                    <div className="space-y-4 pt-8 border-t">
                        <div>
                            <h3 className="text-lg font-bold">Trigger Automation</h3>
                            <p className="text-sm text-muted-foreground">Launch an automation workflow for every successfully imported record.</p>
                        </div>

                        <Select value={selectedAutomationId || 'none'} onValueChange={(val) => setSelectedAutomationId(val === 'none' ? null : val)}>
                            <SelectTrigger className="w-full h-12 rounded-xl bg-background">
                                <SelectValue placeholder="Do not trigger any specific automation" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none" className="font-semibold">Do not trigger any automation</SelectItem>
                                {automationsList?.map((auto: any) => (
                                    <SelectItem key={auto.id} value={auto.id} className="font-semibold">
                                        {auto.name} <span className="text-xs text-muted-foreground font-normal ml-2">({auto.trigger})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] font-bold text-muted-foreground mt-2">
                            Note: The default &quot;Record Created&quot; automations may still run based on your workspace settings.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="bg-primary/5 p-8 border-t">
                    <Button onClick={onNext} className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98] animate-none">
                        Review & Import <ArrowRight size={20} />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
