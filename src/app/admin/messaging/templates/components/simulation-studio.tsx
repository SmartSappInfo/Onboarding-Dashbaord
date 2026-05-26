'use client';

import * as React from 'react';
import { 
    MonitorPlay, 
    SeparatorVertical, 
    Monitor, 
    Smartphone as PhoneIcon, 
    Loader2, 
    Zap,
    PenLine,
    AlertTriangle,
    ArrowRight
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { resolveVariables } from '@/lib/messaging-utils';
import type { MessageTemplate, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';
import { useTheme } from 'next-themes';

interface SimulationStudioProps {
    template: MessageTemplate;
    simVariables: Record<string, any>;
    isSimLoading: boolean;
    simEntity: string;
    setSimEntity: (val: any) => void;
    simRecordId: string;
    setSimRecordId: (val: string) => void;
    entities?: WorkspaceEntity[];
    meetings?: Meeting[];
    surveys?: Survey[];
    pdfs?: PDFForm[];
    resolvedPreview: (tmpl: MessageTemplate, vars: Record<string, any>, isDark?: boolean) => string;
    onNextStep?: () => void;
}

/**
 * Colocated mock input panel — isolated from the main SimulationStudio tree.
 * Typing in these fields ONLY re-renders this sub-component and the preview,
 * never the parent TemplateWorkshop (Vercel state-colocation pattern).
 */
const SimulationInputPanel = React.memo(function SimulationInputPanel({
    detectedVars,
    mockValues,
    onMockChange,
}: {
    detectedVars: string[];
    mockValues: Record<string, string>;
    onMockChange: (key: string, value: string) => void;
}) {
    if (detectedVars.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6 opacity-40">
                <PenLine className="h-8 w-8 mb-3" />
                <p className="text-[10px] font-semibold leading-relaxed">
                    No dynamic variables detected.<br />
                    Add {'{{variables}}'} to your template to enable live mocking.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <PenLine className="h-3 w-3 text-blue-600" />
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                        Live Mock Values
                    </span>
                </div>
                <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-semibold uppercase h-5"
                >
                    {detectedVars.length} vars
                </Badge>
            </div>

            <div className="space-y-3">
                {detectedVars.map(varKey => (
                    <div key={varKey} className="space-y-1">
                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-blue-600 shrink-0" />
                            {varKey.replace(/_/g, ' ')}
                        </Label>
                        <Input
                            value={mockValues[varKey] || ''}
                            onChange={e => onMockChange(varKey, e.target.value)}
                            placeholder={`e.g. Sample ${varKey.replace(/_/g, ' ')}`}
                            className="h-8 rounded-lg bg-card border border-blue-500/5 shadow-sm font-bold text-[11px] px-3"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

export function SimulationStudio({
    template,
    simVariables,
    isSimLoading,
    simEntity,
    setSimEntity,
    simRecordId,
    setSimRecordId,
    entities,
    meetings,
    surveys,
    pdfs,
    resolvedPreview,
    onNextStep
}: SimulationStudioProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop');
    const [mockValues, setMockValues] = React.useState<Record<string, string>>({});

    // Auto-detect all variable tokens from the template body, subject, and previewText
    const detectedVars = React.useMemo(() => {
        const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
        const matches = content.match(/\{\{([^{}]+?)\}\}/g);
        if (!matches) return [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
    }, [template.subject, template.previewText, template.body, template.blocks]);

    // Merge mock values with sim context variables — mock values take priority
    const mergedVars = React.useMemo(() => ({
        ...simVariables,
        ...mockValues,
    }), [simVariables, mockValues]);

    const handleMockChange = React.useCallback((key: string, value: string) => {
        setMockValues(prev => ({ ...prev, [key]: value }));
    }, []);

    // SMS segment cost analysis for substituted content
    const resolvedText = React.useMemo(
        () => resolvedPreview(template, mergedVars, isDark),
        [template, mergedVars, resolvedPreview, isDark]
    );

    const smsSegmentInfo = React.useMemo(() => {
        if (template.channel !== 'sms') return null;
        const len = resolvedText.length;
        const count = len <= 160 ? 1 : Math.ceil(len / 153);
        return { count, length: len, isMultiSegment: count > 1 };
    }, [template.channel, resolvedText]);

    return (
        <div className="absolute inset-0 flex flex-col bg-muted/10 animate-in fade-in duration-500">
            {/* Header bar */}
            <div className="p-6 border-b bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <MonitorPlay className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-tight">Simulation Studio</h3>
                            <p className="text-[10px] font-bold text-muted-foreground tracking-tighter">Live data record binding</p>
                        </div>
                    </div>
                    <Separator orientation="vertical" className="h-10 hidden sm:block" />
                    <div className="flex items-center gap-3">
                        <Select value={simEntity} onValueChange={(v: any) => { setSimEntity(v); setSimRecordId('none'); }}>
                            <SelectTrigger className="h-10 w-[160px] rounded-xl bg-muted/20 border-none font-semibold text-[10px] ">
                                <SelectValue placeholder="Pick Source..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none">Empty State</SelectItem>
                                <SelectItem value="School">School Directory</SelectItem>
                                <SelectItem value="Meeting">Meeting Record</SelectItem>
                                <SelectItem value="Survey">Survey Result</SelectItem>
                                <SelectItem value="Submission">Doc Signing Submission</SelectItem>
                            </SelectContent>
                        </Select>
                        {simEntity !== 'none' && (
                            <Select value={simRecordId} onValueChange={setSimRecordId}>
                                <SelectTrigger className="h-10 w-[200px] rounded-xl bg-muted/20 border-none font-bold text-xs">
                                    <SelectValue placeholder="Pick Record..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="none">Select Instance...</SelectItem>
                                    {simEntity === 'School' && entities?.map(s => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}
                                    {simEntity === 'Meeting' && meetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.entityName} - {m.type.name}</SelectItem>)}
                                    {simEntity === 'Survey' && surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                    {simEntity === 'Submission' && pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border shadow-inner">
                        <Button variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('desktop')}>
                            <Monitor className="h-3.5 w-3.5" /> Desktop
                        </Button>
                        <Button variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('mobile')}>
                            <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                        </Button>
                    </div>
                    {onNextStep && (
                        <Button 
                            onClick={onNextStep} 
                            className="h-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-4 gap-1.5 active:scale-95 transition-all shadow-md shrink-0"
                        >
                            Next: Publish <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Main content area: Input sidebar + Preview */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left sidebar: Interactive variable mock inputs */}
                <div className="w-[260px] shrink-0 border-r bg-card overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1">
                        <div className="p-4">
                            <SimulationInputPanel
                                detectedVars={detectedVars}
                                mockValues={mockValues}
                                onMockChange={handleMockChange}
                            />
                        </div>
                    </ScrollArea>
                </div>

                {/* Right area: Device preview */}
                <div className="flex-1 overflow-auto p-8 flex justify-center">
                    <div className={cn(
                        "transition-all duration-700 bg-card shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white dark:border-slate-800 relative",
                        previewDevice === 'mobile' ? "w-[375px] h-[667px]" : "w-full max-w-4xl",
                        template.channel === 'sms' && "p-12 flex flex-col justify-center items-center"
                    )}>
                        {isSimLoading && (
                            <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                <p className="text-[10px] font-semibold tracking-[0.3em] text-blue-600">Synchronizing Data Hub...</p>
                            </div>
                        )}
                        
                        {template.channel === 'sms' ? (
                            <div className="w-full max-w-sm space-y-10">
                                <div className="flex items-center justify-between opacity-20">
                                    <Zap className="text-blue-600 h-6 w-6" />
                                    <span className="text-[10px] font-semibold text-blue-600 tracking-[0.3em]">SMS Uplink Simulation</span>
                                </div>
                                <div className="p-8 bg-card border border-slate-200 dark:border-slate-800 rounded-[2rem] relative shadow-xl">
                                    <div className="absolute -left-3 top-10 w-6 h-6 bg-card border-l border-b border-slate-200 dark:border-slate-800 rotate-45 rounded-sm" />
                                    <p className="text-lg text-slate-900 dark:text-slate-100 font-bold whitespace-pre-wrap leading-relaxed">
                                        {resolvedText}
                                    </p>
                                </div>
                                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
                                    <span className={cn(
                                        "text-[9px] font-semibold",
                                        smsSegmentInfo?.isMultiSegment
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-slate-300"
                                    )}>
                                        ~ {smsSegmentInfo?.count || 1} SMS Segment{(smsSegmentInfo?.count || 1) > 1 ? 's' : ''}
                                        {smsSegmentInfo?.isMultiSegment && ` (${smsSegmentInfo.length} chars)`}
                                    </span>
                                    {smsSegmentInfo?.isMultiSegment && (
                                        <div className="animate-in fade-in duration-300 flex items-center justify-center gap-1.5 text-[8px] font-bold text-amber-600 dark:text-amber-400">
                                            <AlertTriangle className="h-3 w-3" />
                                            Multi-segment messages incur additional carrier costs
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="p-8 bg-muted/20 border-b space-y-2">
                                    <span className="text-[10px] font-semibold text-muted-foreground tracking-[0.3em] opacity-40">Resolved Subject Payload</span>
                                    <p className="font-semibold text-xl text-foreground">
                                        {resolveVariables(template.subject || '', mergedVars) || '(No Subject)'}
                                    </p>
                                </div>
                                <iframe srcDoc={resolvedText} className="flex-1 w-full border-none bg-card" title="High Fidelity Preview" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
