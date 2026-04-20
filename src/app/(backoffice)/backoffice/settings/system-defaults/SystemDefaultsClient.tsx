'use client';

import * as React from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { seedSystemTemplates } from '@/lib/seed-templates';

export default function SystemDefaultsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isReseeding, setIsReseeding] = React.useState(false);
    const [templates, setTemplates] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchTemplates = async () => {
            if (!firestore) return;
            try {
                const snap = await getDoc(doc(firestore, 'system_settings', 'templates'));
                if (snap.exists()) {
                    setTemplates(snap.data());
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Fetch Error', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, [firestore, toast]);

    const handleSave = async () => {
        if (!firestore || !templates) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'system_settings', 'templates'), {
                ...templates,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Templates Updated', description: 'System-wide defaults have been synchronized.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReseed = async () => {
        if (!firestore || !confirm('This will reset all system templates to factory defaults. Continue?')) return;
        setIsReseeding(true);
        try {
            await seedSystemTemplates(firestore);
            const snap = await getDoc(doc(firestore, 'system_settings', 'templates'));
            if (snap.exists()) setTemplates(snap.data());
            toast({ title: 'System Reset', description: 'Factory templates have been restored.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
        } finally {
            setIsReseeding(false);
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
                        <Sparkles className="h-10 w-10 text-primary" />
                        System Defaults
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg mt-1">
                        Global message templates and baseline configuration
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={handleReseed} disabled={isReseeding} className="rounded-xl font-bold">
                        {isReseeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Factory Reset
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Invitation Template */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">User Invitation</CardTitle>
                                    <CardDescription>Sent when a new member is invited to an organization.</CardDescription>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Email</Badge>
                                <Badge variant="secondary">SMS</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Subject</label>
                            <Input 
                                value={templates?.invitation?.subject || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, subject: e.target.value } })}
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Body (HTML Supported)</label>
                            <Textarea 
                                value={templates?.invitation?.emailHtml || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, emailHtml: e.target.value } })}
                                className="rounded-xl min-h-[200px] font-mono text-sm"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SMS Message</label>
                            <Textarea 
                                value={templates?.invitation?.smsBody || ''} 
                                onChange={(e) => setTemplates({ ...templates, invitation: { ...templates.invitation, smsBody: e.target.value } })}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Password Reset Template */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden">
                    <CardHeader className="bg-warning/5 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-warning/10 text-warning rounded-2xl">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Password Reset</CardTitle>
                                    <CardDescription>Sent during administrative or phone-based password recovery.</CardDescription>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary">Email</Badge>
                                <Badge variant="secondary">SMS</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Subject</label>
                            <Input 
                                value={templates?.passwordReset?.subject || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, subject: e.target.value } })}
                                className="rounded-xl h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Body (HTML Supported)</label>
                            <Textarea 
                                value={templates?.passwordReset?.emailHtml || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, emailHtml: e.target.value } })}
                                className="rounded-xl min-h-[200px] font-mono text-sm"
                            />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SMS Message</label>
                            <Textarea 
                                value={templates?.passwordReset?.smsBody || ''} 
                                onChange={(e) => setTemplates({ ...templates, passwordReset: { ...templates.passwordReset, smsBody: e.target.value } })}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Legend */}
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Supported Dynamic Variables</h4>
                    <div className="flex flex-wrap gap-2">
                        {['userName', 'email', 'orgName', 'tempPassword', 'loginLink'].map(v => (
                            <Badge key={v} variant="outline" className="bg-background font-mono text-[10px]">
                                {'{{'}{v}{'}}'}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
