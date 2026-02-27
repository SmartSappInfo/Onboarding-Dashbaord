'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageTemplate, MessageStyle, SenderProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
    FileType, 
    Plus, 
    Trash2, 
    Mail, 
    Smartphone, 
    Code,
    X,
    Loader2,
    ArrowLeft,
    AlertCircle,
    Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    
    // Form State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [styleId, setStyleId] = React.useState('none');
    const [variables, setVariables] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const stylesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_styles'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: templates, isLoading } = useCollection<MessageTemplate>(templatesQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !body) return;
        
        const variableList = variables.split(',').map(v => v.trim()).filter(Boolean);

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_templates'), {
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
            setName('');
            setBody('');
            setVariables('');
            setSubject('');
            setIsAdding(false);
            toast({ title: 'Template Created', description: 'Message template is ready for use.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create template.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (template: MessageTemplate) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'message_templates', template.id);
        await updateDoc(docRef, { isActive: !template.isActive, updatedAt: new Date().toISOString() });
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Are you sure?')) return;
        await deleteDoc(doc(firestore, 'message_templates', id));
        toast({ title: 'Template Deleted' });
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileType className="h-8 w-8 text-primary" />
                        Message Templates
                    </h1>
                    <p className="text-muted-foreground">Dynamic content definitions for SMS and Email automation.</p>
                </div>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isAdding ? 'Cancel' : 'New Template'}
                </Button>
            </div>

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle>Create Dynamic Template</CardTitle>
                        <CardDescription>Templates support handlebars-style placeholders like &#123;&#123;name&#125;&#125;.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Message" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General Notification</SelectItem>
                                        <SelectItem value="forms">Doc Signing</SelectItem>
                                        <SelectItem value="surveys">Surveys</SelectItem>
                                        <SelectItem value="meetings">Meetings</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Channel</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sms">SMS (Text only)</SelectItem>
                                        <SelectItem value="email">Email (HTML)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {channel === 'email' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-primary/10">
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Style Wrapper</Label>
                                    <Select value={styleId} onValueChange={setStyleId}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Wrapper (Plain HTML)</SelectItem>
                                            {styles?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pt-4 border-t border-primary/10">
                            <div className="flex justify-between items-center">
                                <Label>Message Body</Label>
                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Use &#123;&#123;var_name&#125;&#125; for dynamic data
                                </span>
                            </div>
                            <Textarea 
                                value={body} 
                                onChange={e => setBody(e.target.value)} 
                                className="min-h-[150px] bg-white text-sm" 
                                placeholder={channel === 'sms' ? "Hi {{name}}, welcome to SmartSapp..." : "<h1>Hello {{name}}</h1>..."}
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Required Variables (Comma separated)</Label>
                            <Input 
                                value={variables} 
                                onChange={e => setVariables(e.target.value)} 
                                placeholder="name, school_name, date" 
                            />
                            <p className="text-[10px] text-muted-foreground">The composer UI will automatically create input fields for these names.</p>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleAdd} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Template
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-40 animate-pulse bg-muted" />)
                ) : templates?.length ? (
                    templates.map((template) => (
                        <Card key={template.id} className="group relative border-border/50 hover:shadow-md transition-all">
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(template.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardHeader className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("p-2 rounded-lg", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                            {template.channel === 'sms' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{template.name}</CardTitle>
                                            <CardDescription className="text-[10px] uppercase font-bold tracking-widest">{template.category}</CardDescription>
                                        </div>
                                    </div>
                                    <Switch 
                                        checked={template.isActive} 
                                        onCheckedChange={() => toggleActive(template)}
                                        className="scale-75"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-muted/30 rounded-lg border border-dashed text-xs text-muted-foreground italic line-clamp-2">
                                    {template.body}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {template.variables.map(v => (
                                        <Badge key={v} variant="outline" className="text-[9px] h-5 bg-white border-primary/20 text-primary font-bold">
                                            &#123;&#123;{v}&#125;&#125;
                                        </Badge>
                                    ))}
                                    {template.variables.length === 0 && <span className="text-[10px] text-muted-foreground/50">No variables defined</span>}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                        <FileType className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">No templates found. Start by creating one for Surveys or Forms.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
