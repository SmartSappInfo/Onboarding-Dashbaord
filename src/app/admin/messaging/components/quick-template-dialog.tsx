
'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, MessageStyle, MessageBlock } from '@/lib/types';
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
    Tag, 
    Mail, 
    Smartphone, 
    Check,
    Info,
    Wand2,
    X,
    Layout,
    Type,
    Heading1,
    MousePointer2,
    Quote,
    Square
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';

interface QuickTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (templateId: string) => void;
    category: MessageTemplate['category'];
    channel: MessageTemplate['channel'];
}

export default function QuickTemplateDialog({ 
    open, 
    onOpenChange, 
    onCreated, 
    category, 
    channel 
}: QuickTemplateDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [name, setName] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [showAiInput, setShowAiInput] = React.useState(false);

    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    const subjectRef = React.useRef<HTMLInputElement>(null);

    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);

    const contextVariables = React.useMemo(() => {
        if (!variables) return [];
        // FILTER HIDDEN VARIABLES
        const filtered = variables.filter(v => (v.category === 'general' || v.category === category) && !v.hidden);
        const uniqueMap = new Map();
        filtered.forEach(v => {
            if (!uniqueMap.has(v.key)) uniqueMap.set(v.key, v);
        });
        return Array.from(uniqueMap.values());
    }, [variables, category]);

    const handleAiArchitect = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel,
                availableVariables: contextVariables.map(v => v.key)
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
                active.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else {
            setBody(prev => prev + tag);
        }
    };

    const handleCreate = async () => {
        if (!name || (!body && blocks.length === 0) || !firestore) return;
        setIsSubmitting(true);

        const varMatches = `${subject} ${body} ${JSON.stringify(blocks)}`.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        // SANITIZATION: Strictly ensure no undefined values are sent to Firestore
        const templateData: any = {
            name: name.trim(),
            category,
            channel,
            body: body.trim(),
            variables: variableList,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (channel === 'email') {
            templateData.subject = subject.trim();
            if (blocks && blocks.length > 0) {
                templateData.blocks = blocks;
            }
        }

        try {
            const docRef = await addDoc(collection(firestore, 'message_templates'), templateData);

            toast({ title: 'Template Created' });
            onCreated(docRef.id);
            reset();
            onOpenChange(false);
        } catch (e) {
            console.error("Quick Create Failed:", e);
            toast({ variant: 'destructive', title: 'Failed to create template' });
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
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-3 rounded-2xl border shadow-xl",
                                channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100"
                            )}>
                                {channel === 'email' ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Quick Template</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Context: {category}</DialogDescription>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                            onClick={() => setShowAiInput(!showAiInput)}
                        >
                            <Sparkles className="h-4 w-4" />
                            {showAiInput ? 'Manual Entry' : 'Architect with AI'}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {showAiInput ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="p-8 rounded-[2rem] bg-primary/5 border-2 border-dashed border-primary/20 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary text-white rounded-xl shadow-lg"><Wand2 className="h-4 w-4" /></div>
                                        <Label className="text-sm font-black uppercase tracking-tight text-primary">AI Architect</Label>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Describe your communication objective</Label>
                                        <Textarea 
                                            value={aiPrompt} 
                                            onChange={e => setAiPrompt(e.target.value)}
                                            placeholder="e.g. A formal admission offer. Mention orientation dates and include a call-to-action button."
                                            className="min-h-[150px] rounded-2xl bg-white border-none shadow-inner p-4 leading-relaxed"
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleAiArchitect} 
                                        disabled={isAiProcessing || !aiPrompt.trim()}
                                        className="w-full h-12 rounded-xl font-black shadow-xl"
                                    >
                                        {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Generate Template Structure
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name</Label>
                                    <Input 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        placeholder="e.g. Welcome Message" 
                                        className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                                    />
                                </div>

                                {channel === 'email' && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject Line</Label>
                                        <Input 
                                            ref={subjectRef}
                                            value={subject} 
                                            onChange={e => setSubject(e.target.value)} 
                                            placeholder="Email subject..." 
                                            className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{channel === 'email' ? 'Email Body' : 'SMS Message'}</Label>
                                        {blocks.length > 0 && <Badge className="bg-emerald-50/10 text-emerald-600 border-none text-[8px] font-black uppercase h-5">Block System Active</Badge>}
                                    </div>
                                    <Textarea 
                                        ref={bodyRef}
                                        value={body} 
                                        onChange={e => setBody(e.target.value)}
                                        className="min-h-[250px] rounded-2xl bg-muted/20 border-none p-4 font-medium leading-relaxed resize-none shadow-inner"
                                        placeholder={blocks.length > 0 ? "[ Blocks are active. Use the Template Studio for full editing. ]" : `Hi {{contact_name}}, welcome to...`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-72 border-l bg-muted/5 p-4 shrink-0 overflow-hidden flex flex-col gap-4">
                        <div className="flex items-center gap-2 px-1">
                            <Database className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Variable Library</span>
                        </div>
                        
                        <ScrollArea className="flex-1">
                            <div className="space-y-2 pr-3 pb-10">
                                {contextVariables.map(v => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => handleInsert(v.key)}
                                        className="w-full text-left p-3 rounded-xl bg-white border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[8px] font-black uppercase text-primary/40 group-hover:text-primary transition-colors">{v.sourceName || 'Core'}</span>
                                            <Plus className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                        <p className="text-xs font-bold truncate leading-none">{v.label}</p>
                                        <code className="text-[9px] font-mono text-muted-foreground opacity-60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                Click a variable to inject it at your cursor position.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold">Discard</Button>
                    <Button 
                        onClick={handleCreate} 
                        disabled={isSubmitting || !name || (blocks.length === 0 && !body)}
                        className="px-12 rounded-[1.25rem] font-black shadow-xl active:scale-95 transition-all text-base uppercase tracking-widest"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Save Template
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
