'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, MessageBlock, Survey } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
    Plus, 
    Loader2, 
    Sparkles, 
    Database, 
    Mail, 
    Smartphone, 
    Check, 
    Info,
    Wand2,
    ClipboardList,
    Building,
    Globe,
    Zap,
    Trophy,
    Save,
    CopyPlus,
    Pencil,
    Banknote,
    FlaskConical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';
import TestDispatchDialog from './TestDispatchDialog';
import { useTenant } from '@/context/TenantContext';

interface QuickTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (templateId: string) => void;
    category: MessageTemplate['category'];
    channel: MessageTemplate['channel'];
    fixedSourceId?: string; // If provided, locks the dialog to a specific survey
    templateId?: string; // If provided, loads existing template for editing
}

export default function QuickTemplateDialog({ 
    open, 
    onOpenChange, 
    onCreated, 
    category, 
    channel,
    fixedSourceId,
    templateId
}: QuickTemplateDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeOrganizationId } = useTenant();
    
    const [name, setName] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [showAiInput, setShowAiInput] = React.useState(false);
    const [isLoadingTemplate, setIsLoadingTemplate] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    
    // Context Selection
    const [selectedSurveyId, setSelectedSurveyId] = React.useState<string | undefined>(fixedSourceId);

    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    const subjectRef = React.useRef<HTMLInputElement>(null);

    // Queries optimized for indices
    const surveysQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'surveys'), 
            where('status', '==', 'published'), 
            orderBy('internalName', 'asc')
        ) : null, 
    [firestore]);

    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);

    // ORG-SCOPED USER QUERY
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true),
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: allVariables } = useCollection<VariableDefinition>(varsQuery);

    // Load Template if templateId is provided
    React.useEffect(() => {
        if (open && templateId && firestore) {
            const loadTemplate = async () => {
                setIsLoadingTemplate(true);
                try {
                    const docSnap = await getDoc(doc(firestore, 'message_templates', templateId));
                    if (docSnap.exists()) {
                        const data = docSnap.data() as MessageTemplate;
                        setName(data.name);
                        setSubject(data.subject || '');
                        setBody(data.body);
                        setBlocks(data.blocks || []);
                    }
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to load template.' });
                } finally {
                    setIsLoadingTemplate(false);
                }
            };
            loadTemplate();
        }
    }, [open, templateId, firestore, toast]);

    // Filtered & Grouped Variables Logic
    const groupedVariables = React.useMemo(() => {
        if (!allVariables) return { survey: [], metrics: [], core: [], finance: [], constants: [] };

        const surveyVars: VariableDefinition[] = [];
        const metricVars: VariableDefinition[] = [];
        const coreVars: VariableDefinition[] = [];
        const financeVars: VariableDefinition[] = [];
        const constantVars: VariableDefinition[] = [];

        allVariables.forEach(v => {
            if (v.hidden) return;

            // 1. Core Metrics (survey_score, max_score, outcome_label, result_url)
            const isResultMetric = v.entity === 'SurveyResponse' && ['survey_score', 'max_score', 'outcome_label', 'result_url'].includes(v.key);
            
            // 2. Question-specific context
            const isQuestionFromSurvey = v.source === 'survey' && v.sourceId === selectedSurveyId;

            if (isResultMetric) {
                metricVars.push(v);
            } else if (isQuestionFromSurvey) {
                surveyVars.push(v);
            } else if (v.category === 'finance' || (category === 'contracts' && v.category === 'finance')) {
                financeVars.push(v);
            } else if (v.category === category && v.source === 'survey' && !selectedSurveyId) {
                surveyVars.push(v);
            } else if (v.source === 'static' && v.category === 'general') {
                coreVars.push(v);
            } else if (v.source === 'constant') {
                constantVars.push(v);
            }
        });

        return { 
            survey: surveyVars.sort((a, b) => a.label.localeCompare(b.label)), 
            metrics: metricVars.sort((a, b) => a.label.localeCompare(b.label)), 
            core: coreVars, 
            finance: financeVars,
            constants: constantVars 
        };
    }, [allVariables, selectedSurveyId, category]);

    const handleAiArchitect = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const availableKeys = [
                ...groupedVariables.survey.map(v => v.key),
                ...groupedVariables.metrics.map(v => v.key),
                ...groupedVariables.core.map(v => v.key),
                ...groupedVariables.finance.map(v => v.key),
                ...groupedVariables.constants.map(v => v.key)
            ];

            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel,
                availableVariables: availableKeys
            });

            setName(result.name);
            setSubject(result.subject || '');
            setBody(result.body);
            if (result.blocks) setBlocks(result.blocks as any);
            setShowAiInput(false);
            toast({ title: 'AI Architecture Generated', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleInsert = (key: string) => {
        const tag = `{{${key}}}`;
        const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            const start = active.selectionStart || 0;
            const end = active.selectionEnd || 0;
            const val = active.value;
            active.value = val.substring(0, start) + tag + val.substring(end);
            active.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                active.focus();
                active.setRangeText ? active.setRangeText(tag) : null;
                active.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else {
            setBody(prev => prev + tag);
        }
    };

    const handleCommit = async (mode: 'update' | 'new') => {
        if (!name || (!body && blocks.length === 0) || !firestore) return;
        setIsSubmitting(true);

        const varMatches = `${subject} ${body} ${JSON.stringify(blocks)}`.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const templateData: any = {
            name: name.trim(),
            category,
            channel,
            body: body.trim(),
            variables: variableList,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        if (channel === 'email') {
            templateData.subject = subject.trim();
            if (blocks && blocks.length > 0) {
                templateData.blocks = blocks;
            }
        }

        try {
            if (mode === 'update' && templateId) {
                await updateDoc(doc(firestore, 'message_templates', templateId), templateData);
                onCreated(templateId);
                toast({ title: 'Template Updated' });
            } else {
                const docRef = await addDoc(collection(firestore, 'message_templates'), {
                    ...templateData,
                    createdAt: new Date().toISOString(),
                });
                onCreated(docRef.id);
                toast({ title: 'Template Created' });
            }
            reset();
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const reset = () => {
        setName('');
        setSubject('');
        setBody('');
        setBlocks([]);
        setAiPrompt('');
        setShowAiInput(false);
        if (!fixedSourceId) setSelectedSurveyId(undefined);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            reset();
        }
        onOpenChange(isOpen);
    };

    const VariableSection = ({ title, icon: Icon, items, badge }: { title: string, icon: any, items: VariableDefinition[], badge?: string }) => {
        if (items.length === 0) return null;
        return (
 <div className="space-y-3 pt-4 first:pt-0">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Icon className="h-3 w-3 text-primary opacity-60" />
 <span className="text-[9px] font-semibold text-primary/60">{title}</span>
                    </div>
                    {badge && <Badge variant="outline" className="text-[7px] h-4 font-semibold uppercase border-primary/20 bg-primary/5 text-primary">{badge}</Badge>}
                </div>
 <div className="space-y-2">
                    {items.map(v => (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => handleInsert(v.key)}
 className="w-full text-left p-3 rounded-xl bg-white border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm"
                        >
 <p className="text-xs font-bold truncate leading-none text-foreground/80">{v.label}</p>
 <code className="text-[9px] font-mono text-muted-foreground opacity-60 mt-1.5 block">{"{{" + v.key + "}}"}</code>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
 <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
 <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
 <div className="flex items-center justify-between text-left">
 <div className="flex items-center gap-4">
 <div className={cn(
                                "p-3 rounded-2xl border shadow-xl",
                                channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100"
                            )}>
 {channel === 'email' ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                            </div>
                            <div>
 <DialogTitle className="text-2xl font-semibold tracking-tight">
                                    {templateId ? 'Template Editor' : 'Quick Template Studio'}
                                </DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground">Drafting {channel} protocol for {category}</DialogDescription>
                            </div>
                        </div>
 <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                size="sm" 
 className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                onClick={() => setIsTestModalOpen(true)}
                            >
 <FlaskConical className="h-4 w-4" /> Send Test
                            </Button>
                            {!templateId && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
 className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                    onClick={() => setShowAiInput(!showAiInput)}
                                >
 <Sparkles className="h-4 w-4" />
                                    {showAiInput ? 'Designer Mode' : 'Draft with AI'}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

 <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
 <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background relative text-left">
                        {isLoadingTemplate && (
 <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
 <Loader2 className="h-10 w-10 animate-spin text-primary" />
 <p className="text-[10px] font-semibold opacity-40">Loading Template...</p>
                            </div>
                        )}

                        {showAiInput ? (
 <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
 <div className="p-10 rounded-[3rem] bg-primary/5 border-2 border-dashed border-primary/20 space-y-8">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary text-white rounded-xl shadow-lg"><Wand2 className="h-4 w-4" /></div>
 <Label className="text-base font-semibold tracking-tight text-primary">AI Content Architect</Label>
                                    </div>
 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Communication Objective</Label>
                                        <Textarea 
                                            value={aiPrompt} 
                                            onChange={e => setAiPrompt(e.target.value)}
                                            placeholder="Describe the tone and goal... e.g. A friendly email confirming enrollment and mentioning the orientation date."
 className="min-h-[180px] rounded-[2rem] bg-white border-none shadow-inner p-6 leading-relaxed text-lg"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleAiArchitect} 
                                        disabled={isAiProcessing || !aiPrompt.trim()}
 className="w-full h-14 rounded-2xl font-semibold shadow-2xl text-lg active:scale-95 transition-all"
                                    >
 {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Generate Draft Structure
                                    </Button>
                                </div>
                            </div>
                        ) : (
 <div className="space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template Label</Label>
                                        <Input 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            placeholder="e.g. Admission Confirmation" 
 className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-6"
                                        />
                                    </div>

                                    {channel === 'email' && (
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label>
                                            <Input 
                                                ref={subjectRef}
                                                value={subject} 
                                                onChange={e => setSubject(e.target.value)} 
                                                placeholder="Resolved in inbox..." 
 className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-6"
                                            />
                                        </div>
                                    )}
                                </div>

 <div className="space-y-2">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-muted-foreground">Message Composition</Label>
                                        {blocks.length > 0 && <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-semibold uppercase h-5 px-2">Block Engine Active</Badge>}
                                    </div>
 <div className="relative group">
                                        <Textarea 
                                            ref={bodyRef}
                                            value={body} 
                                            onChange={e => setBody(e.target.value)}
 className="min-h-[350px] rounded-[2rem] bg-muted/20 border-none p-8 font-medium leading-relaxed resize-none shadow-inner text-lg placeholder:italic"
                                            placeholder={blocks.length > 0 ? "Blocks are driving this template. Use Template Studio for full control." : "Hi {{contact_name}}, ..."}
                                        />
 <div className="absolute top-4 right-4 opacity-20">
 <Zap className="h-12 w-12 text-primary" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* VARIABLE PANEL */}
 <div className="w-full lg:w-80 border-l bg-muted/10 p-6 shrink-0 overflow-hidden flex flex-col gap-6 text-left">
 <div className="space-y-4 shrink-0">
 <div className="flex items-center gap-2">
 <Database className="h-4 w-4 text-primary" />
 <span className="text-[10px] font-semibold text-primary">Contextual Registry</span>
                            </div>
                            
                            {!fixedSourceId && category === 'surveys' && (
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Source Survey Filter</Label>
                                    <Select value={selectedSurveyId || 'none'} onValueChange={setSelectedSurveyId}>
 <SelectTrigger className="h-10 rounded-xl border-primary/10 bg-white font-bold text-xs shadow-sm">
                                            <SelectValue placeholder="All Sources" />
                                        </SelectTrigger>
 <SelectContent className="rounded-xl">
                                            <SelectItem value="none">Universal Context</SelectItem>
                                            {surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.internalName || s.title}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        
 <ScrollArea className="flex-1 -mx-2 px-2">
 <div className="space-y-8 pb-20 divide-y divide-primary/5">
                                {category === 'surveys' && (
                                    <>
                                        <VariableSection title="Submission Metrics" icon={Trophy} items={groupedVariables.metrics} badge="Real-time" />
                                        <VariableSection title="Dynamic Survey Data" icon={ClipboardList} items={groupedVariables.survey} />
                                    </>
                                )}
                                <VariableSection title="Institutional Tags" icon={Building} items={groupedVariables.core} />
                                <VariableSection title="Financial Logic" icon={Banknote} items={groupedVariables.finance} />
                                <VariableSection title="Custom Constants" icon={Globe} items={groupedVariables.constants} />
                                
                                {category === 'surveys' && groupedVariables.survey.length === 0 && !selectedSurveyId && (
 <div className="py-10 text-center opacity-40 space-y-2 border-t mt-4 pt-4">
 <Info className="h-6 w-6 mx-auto" />
 <p className="text-[9px] font-semibold tracking-tighter">Select a survey to view<br/>question-specific tags</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

 <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3 mt-auto">
 <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-primary/80 leading-relaxed tracking-tighter">
                                Click any tag to inject it into your active input field.
                            </p>
                        </div>
                    </div>
                </div>

 <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
 <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                    
 <div className="flex-grow shrink-0 flex gap-3 sm:justify-end">
                        {templateId && (
                            <Button 
                                variant="outline"
                                onClick={() => handleCommit('new')} 
                                disabled={isSubmitting || !name || (blocks.length === 0 && !body)}
 className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 gap-2"
                            >
 <CopyPlus className="h-4 w-4" />
                                Save as New
                            </Button>
                        )}
                        <Button 
                            onClick={() => handleCommit(templateId ? 'update' : 'new')} 
                            disabled={isSubmitting || !name || (blocks.length === 0 && !body)}
 className="px-16 rounded-2xl font-semibold shadow-2xl h-12 text-sm transition-all active:scale-95 flex-grow sm:flex-grow-0"
                        >
 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : templateId ? <Save className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                            {templateId ? 'Update Current' : 'Save Template'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>

            <TestDispatchDialog 
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                channel={channel as 'email' | 'sms'}
                rawBody={body}
                rawSubject={subject}
                templateId={templateId}
            />
        </Dialog>
    );
}