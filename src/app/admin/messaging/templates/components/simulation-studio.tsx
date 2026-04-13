'use client';

import * as React from 'react';
import { 
    MonitorPlay, 
    SeparatorVertical, 
    Monitor, 
    Smartphone as PhoneIcon, 
    Loader2, 
    Zap 
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { resolveVariables } from '@/lib/messaging-utils';
import type { MessageTemplate, WorkspaceEntity, Meeting, Survey, PDFForm } from '@/lib/types';

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
    resolvedPreview: (tmpl: MessageTemplate, vars: Record<string, any>) => string;
}

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
    resolvedPreview
}: SimulationStudioProps) {
    const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop');

    return (
 <div className="absolute inset-0 flex flex-col bg-muted/10 animate-in fade-in duration-500">
 <div className="p-6 border-b bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
 <div className="flex items-center gap-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl">
 <MonitorPlay className="h-5 w-5 text-primary" />
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
 <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border shadow-inner">
 <Button variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('desktop')}>
 <Monitor className="h-3.5 w-3.5" /> Desktop
                    </Button>
 <Button variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-semibold text-[10px] " onClick={() => setPreviewDevice('mobile')}>
 <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                    </Button>
                </div>
            </div>
            
 <div className="flex-1 overflow-auto p-8 flex justify-center">
 <div className={cn(
                    "transition-all duration-700 bg-card shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white relative",
                    previewDevice === 'mobile' ? "w-[375px] h-[667px]" : "w-full max-w-4xl",
                    template.channel === 'sms' && "p-12 flex flex-col justify-center items-center"
                )}>
                    {isSimLoading && (
 <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
 <Loader2 className="h-10 w-10 animate-spin text-primary" />
 <p className="text-[10px] font-semibold tracking-[0.3em] text-primary">Synchronizing Data Hub...</p>
                        </div>
                    )}
                    
                    {template.channel === 'sms' ? (
 <div className="w-full max-w-sm space-y-10">
 <div className="flex items-center justify-between opacity-20">
 <Zap className="text-primary h-6 w-6" />
 <span className="text-[10px] font-semibold text-primary tracking-[0.3em]">SMS Uplink Simulation</span>
                            </div>
 <div className="p-8 bg-card border border-slate-200 rounded-[2rem] relative shadow-xl">
 <div className="absolute -left-3 top-10 w-6 h-6 bg-card border-l border-b border-slate-200 rotate-45 rounded-sm" />
 <p className="text-lg text-slate-900 font-bold whitespace-pre-wrap leading-relaxed">
                                    {resolvedPreview(template, simVariables)}
                                </p>
                            </div>
 <div className="pt-8 border-t border-slate-100 text-center">
 <span className="text-[9px] font-semibold text-slate-300">
                                    ~ {Math.ceil(resolvedPreview(template, simVariables).length / 160)} SMS Segments
                                </span>
                            </div>
                        </div>
                    ) : (
 <div className="flex flex-col h-full">
 <div className="p-8 bg-muted/20 border-b space-y-2">
 <span className="text-[10px] font-semibold text-muted-foreground tracking-[0.3em] opacity-40">Resolved Subject Payload</span>
 <p className="font-semibold text-xl text-foreground">
                                    {resolveVariables(template.subject || '', simVariables) || '(No Subject)'}
                                </p>
                            </div>
 <iframe srcDoc={resolvedPreview(template, simVariables)} className="flex-1 w-full border-none bg-card" title="High Fidelity Preview" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
