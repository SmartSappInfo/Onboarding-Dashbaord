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
import { EntityCombobox } from '@/components/entities/EntityCombobox';
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
    simVariables: Record<string, unknown>;
    isSimLoading: boolean;
    simEntity: string;
    setSimEntity: (val: string) => void;
    simRecordId: string;
    setSimRecordId: (val: string) => void;
    meetings?: Meeting[];
    surveys?: Survey[];
    pdfs?: PDFForm[];
    resolvedPreview: (tmpl: MessageTemplate, vars: Record<string, unknown>, isDark?: boolean) => string;
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

    const isSms = template.channel === 'sms';
    const activeDevice = isSms ? 'mobile' : previewDevice;

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
                        <Select value={simEntity} onValueChange={(v: string) => { setSimEntity(v); setSimRecordId('none'); }}>
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
                        {simEntity === 'School' ? (
                            <EntityCombobox
                                value={simRecordId}
                                onChange={setSimRecordId}
                                valueKey="id"
                                noneLabel="Select Instance..."
                                noneValue="none"
                                placeholder="Pick Record..."
                                className="h-10 w-[200px] text-xs"
                            />
                        ) : simEntity !== 'none' && (
                            <Select value={simRecordId} onValueChange={setSimRecordId}>
                                <SelectTrigger className="h-10 w-[200px] rounded-xl bg-muted/20 border-none font-bold text-xs">
                                    <SelectValue placeholder="Pick Record..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="none">Select Instance...</SelectItem>
                                    {simEntity === 'Meeting' && meetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.entityName} - {m.type.name}</SelectItem>)}
                                    {simEntity === 'Survey' && surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                    {simEntity === 'Submission' && pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!isSms && (
                        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border shadow-inner">
                            <Button variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('desktop')}>
                                <Monitor className="h-3.5 w-3.5" /> Desktop
                            </Button>
                            <Button variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('mobile')}>
                                <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                            </Button>
                        </div>
                    )}
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
                <div className="flex-1 overflow-auto p-8 flex justify-center items-center">
                    <div className={cn(
                        "transition-all duration-700 bg-card shadow-2xl relative flex flex-col overflow-hidden",
                        activeDevice === 'mobile'
                            ? "w-[375px] h-[720px] rounded-[3rem] border-[12px] border-slate-900 dark:border-zinc-800 shrink-0"
                            : "w-full max-w-5xl h-full rounded-[2.5rem] border-8 border-white dark:border-slate-800"
                    )}>
                        {isSimLoading && (
                            <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                <p className="text-[10px] font-semibold tracking-[0.3em] text-blue-600">Synchronizing Data Hub...</p>
                            </div>
                        )}
                        
                        {isSms ? (
                            <div className="flex flex-col h-full bg-[#f4f4f7] dark:bg-zinc-950">
                                {/* Simulated Status Bar */}
                                <div className="h-10 bg-slate-100 dark:bg-zinc-900 flex items-center justify-between px-6 text-[10px] font-semibold text-slate-800 dark:text-zinc-300 select-none relative shrink-0">
                                    <span>9:41</span>
                                    {/* Notch */}
                                    <div className="w-32 h-5 bg-slate-900 dark:bg-zinc-950 rounded-b-2xl absolute top-0 left-1/2 -translate-x-1/2" />
                                    <div className="flex items-center gap-1.5">
                                        {/* Cellular bars */}
                                        <div className="flex items-end gap-0.5 h-2.5">
                                            <div className="w-0.5 h-1 bg-current rounded-xs" />
                                            <div className="w-0.5 h-1.5 bg-current rounded-xs" />
                                            <div className="w-0.5 h-2 bg-current rounded-xs" />
                                            <div className="w-0.5 h-2.5 bg-current rounded-xs" />
                                        </div>
                                        {/* Wifi Icon */}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5a13.3 13.3 0 0 1 14 0"/><path d="M8.5 16.5a7.5 7.5 0 0 1 7 0"/><path d="M12 20h.01"/></svg>
                                        {/* Battery Icon */}
                                        <div className="w-4 h-2 border border-current rounded-xs p-0.5 flex items-center">
                                            <div className="w-full h-full bg-current rounded-2xs" />
                                        </div>
                                    </div>
                                </div>

                                {/* Simulated App Header */}
                                <div className="h-14 bg-slate-100 dark:bg-zinc-900 border-b flex items-center justify-between px-4 text-slate-800 dark:text-zinc-200 shrink-0 select-none">
                                    <div className="flex items-center gap-1 text-xs font-semibold cursor-pointer text-blue-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-slate-650 dark:text-zinc-350 shadow-inner">
                                            SS
                                        </div>
                                        <span className="text-[10px] font-bold tracking-tight">SmartSapp</span>
                                    </div>
                                    <div className="w-4" /> {/* Spacer */}
                                </div>

                                {/* Chat Body Area */}
                                <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-none flex flex-col">
                                    <div className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-wider my-2">iMessage • Today 9:41 AM</div>
                                    
                                    {/* Simulated incoming text bubble */}
                                    <div className="flex items-end gap-1.5 max-w-[85%] self-start select-text relative">
                                        <div className="bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-150 px-4 py-2.5 rounded-2xl rounded-bl-xs text-xs font-semibold leading-relaxed shadow-sm text-left">
                                            <p className="whitespace-pre-wrap">{resolvedText || '(No Content)'}</p>
                                        </div>
                                    </div>
                                    <span className="text-[8px] font-semibold text-slate-400 self-start ml-2">Delivered</span>
                                </div>

                                {/* Simulated Message Input Bar */}
                                <div className="h-16 bg-slate-100 dark:bg-zinc-900 border-t flex items-center px-4 gap-3 shrink-0 select-none pb-2">
                                    {/* App store/Camera icons */}
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                    </div>
                                    {/* Pill Text Input Mock */}
                                    <div className="flex-1 h-9 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-full px-4 flex items-center text-slate-400 text-xs font-semibold justify-between shadow-inner">
                                        <span>iMessage</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                    </div>
                                </div>

                                {/* Segment statistics card */}
                                <div className="p-3 bg-card border-t border-slate-200 dark:border-zinc-800 text-center space-y-1.5 shrink-0">
                                    <span className={cn(
                                        "text-[9px] font-semibold",
                                        smsSegmentInfo?.isMultiSegment
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-slate-400"
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
                                <iframe srcDoc={resolvedText} className="flex-1 w-full border-none bg-card min-h-0" title="High Fidelity Preview" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
