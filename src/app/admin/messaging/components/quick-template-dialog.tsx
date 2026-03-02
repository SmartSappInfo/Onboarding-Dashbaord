'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, MessageStyle } from '@/lib/types';
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
    Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
    const [styleId, setStyleId] = React.useState('none');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    const subjectRef = React.useRef<HTMLInputElement>(null);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || channel !== 'email') return null;
        return query(collection(firestore, 'message_styles'), orderBy('name', 'asc'));
    }, [firestore, channel]);

    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);

    const contextVariables = React.useMemo(() => {
        if (!variables) return [];
        const general = variables.filter(v => v.category === 'general');
        const specific = variables.filter(v => v.category === category);
        return [...general, ...specific];
    }, [variables, category]);

    const handleInsert = (key: string) => {
        const tag = `{{${key}}}`;
        const target = document.activeElement === subjectRef.current ? 'subject' : 'body';
        
        if (target === 'body') {
            const el = bodyRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            setBody(body.substring(0, start) + tag + body.substring(end));
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else {
            const el = subjectRef.current;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            setSubject(subject.substring(0, start) + tag + subject.substring(end));
            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        }
    };

    const handleCreate = async () => {
        if (!name || !body || !firestore) return;
        setIsSubmitting(true);

        const varMatches = `${subject} ${body}`.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        try {
            const docRef = await addDoc(collection(firestore, 'message_templates'), {
                name: name.trim(),
                category,
                channel,
                subject: channel === 'email' ? subject.trim() : undefined,
                body: body.trim(),
                styleId: channel === 'email' && styleId !== 'none' ? styleId : undefined,
                variables: variableList,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            toast({ title: 'Template Created' });
            onCreated(docRef.id);
            reset();
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to create template' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const reset = () => {
        setName('');
        setSubject('');
        setBody('');
        setStyleId('none');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl border shadow-xl",
                            channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100"
                        )}>
                            {channel === 'email' ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">New {channel} Template</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Context: {category}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Editor Side */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name</Label>
                            <Input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g. Booking Confirmation" 
                                className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                            />
                        </div>

                        {channel === 'email' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Branding Style</Label>
                                    <Select value={styleId} onValueChange={setStyleId}>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none">Plain Text Layout</SelectItem>
                                            {styles?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message Content</Label>
                                <Badge variant="outline" className="text-[8px] h-5 font-bold uppercase border-primary/20 bg-primary/5 text-primary">
                                    <Sparkles className="h-2.5 w-2.5 mr-1" /> Variable Ready
                                </Badge>
                            </div>
                            <Textarea 
                                ref={bodyRef}
                                value={body} 
                                onChange={e => setBody(e.target.value)}
                                className="min-h-[250px] rounded-2xl bg-muted/20 border-none p-4 font-medium leading-relaxed resize-none shadow-inner"
                                placeholder={`Hi {{contact_name}}, your request for {{school_name}} is being processed...`}
                            />
                        </div>
                    </div>

                    {/* Variable Sidebar */}
                    <div className="w-full lg:w-72 border-l bg-muted/5 p-4 shrink-0 overflow-hidden flex flex-col gap-4">
                        <div className="flex items-center gap-2 px-1">
                            <Database className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Variable Library</span>
                        </div>
                        
                        <ScrollArea className="flex-1">
                            <div className="space-y-2 pr-3 pb-10">
                                {contextVariables.length > 0 ? contextVariables.map(v => (
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
                                )) : (
                                    <div className="py-10 text-center opacity-30 flex flex-col items-center gap-2">
                                        <Tag className="h-8 w-8" />
                                        <p className="text-[9px] font-black uppercase tracking-widest">No Library Tags</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                Use tags to inject live school, meeting, or respondent data automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold">Discard</Button>
                    <Button 
                        onClick={handleCreate} 
                        disabled={isSubmitting || !name || !body}
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
