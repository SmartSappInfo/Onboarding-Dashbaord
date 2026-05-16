'use client';

import * as React from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { Loader2, Save, Mail, MessageSquare, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function OrganizationInvitationSettings() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeOrganizationId } = useTenant();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [systemDefaults, setSystemDefaults] = React.useState<any>(null);
    const [overrides, setOverrides] = React.useState<any>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            if (!firestore || !activeOrganizationId) return;
            try {
                // 1. Fetch System Defaults
                const systemSnap = await getDoc(doc(firestore, 'system_settings', 'templates'));
                if (systemSnap.exists()) setSystemDefaults(systemSnap.data());

                // 2. Fetch Org Overrides
                const orgSnap = await getDoc(doc(firestore, 'organizations', activeOrganizationId));
                if (orgSnap.exists()) {
                    setOverrides(orgSnap.data().templateOverrides || {});
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Fetch Error', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [firestore, activeOrganizationId, toast]);

    const handleSave = async () => {
        if (!firestore || !activeOrganizationId) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'organizations', activeOrganizationId), {
                templateOverrides: overrides,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Preferences Saved', description: 'Your custom invitation templates are now active.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
    );

    const renderField = (type: 'invitation' | 'passwordReset', field: 'subject' | 'emailHtml' | 'smsBody', label: string, isMultiline = false) => {
        const value = overrides?.[type]?.[field] || '';
        const placeholder = systemDefaults?.[type]?.[field] || 'Default value...';

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
                    {overrides?.[type]?.[field] ? (
                        <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 text-primary border-primary/20">Custom Override</Badge>
                    ) : (
                        <Badge variant="outline" className="text-[9px] h-4 opacity-50">Inherited from System</Badge>
                    )}
                </div>
                {isMultiline ? (
                    <Textarea 
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setOverrides({
                            ...overrides,
                            [type]: { ...overrides[type] || {}, [field]: e.target.value }
                        })}
                        className="rounded-xl min-h-[120px]"
                    />
                ) : (
                    <Input 
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setOverrides({
                            ...overrides,
                            [type]: { ...overrides[type] || {}, [field]: e.target.value }
                        })}
                        className="rounded-xl h-11"
                    />
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-32 w-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Mail className="h-7 w-7 text-primary" />
                        Messaging Hub
                    </h1>
                    <p className="text-muted-foreground font-medium text-sm mt-1">
                        Customize how new members are welcomed to your organization
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Customizations
                </Button>
            </div>

            <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-4">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-1" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-blue-900">Template Inheritance</p>
                    <p className="text-sm text-blue-800/80 leading-relaxed">
                        Fields left blank will automatically use the high-quality system defaults. Only fill in fields where you want a custom institutional voice.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
                {/* Invitation Section */}
                <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                    <CardHeader className="p-8 border-b">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Invitation Templates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {renderField('invitation', 'subject', 'Email Subject')}
                        {renderField('invitation', 'emailHtml', 'Email Body (HTML Content)', true)}
                        <Separator />
                        {renderField('invitation', 'smsBody', 'SMS Message', true)}
                    </CardContent>
                </Card>

                {/* Reset Section */}
                <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
                    <CardHeader className="p-8 border-b">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-warning" />
                            Password Recovery Templates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {renderField('passwordReset', 'subject', 'Email Subject')}
                        {renderField('passwordReset', 'emailHtml', 'Email Body', true)}
                        <Separator />
                        {renderField('passwordReset', 'smsBody', 'SMS Message', true)}
                    </CardContent>
                </Card>

                {/* Variable Legend */}
                <div className="p-6 rounded-2xl bg-muted/30 border border-border">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Available Variables</h4>
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
