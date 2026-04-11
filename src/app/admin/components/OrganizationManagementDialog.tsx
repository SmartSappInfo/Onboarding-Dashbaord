'use client';

import * as React from 'react';
import { useFirestore, useUser } from '@/firebase';
import type { Organization } from '@/lib/types';
import { 
    Building, 
    Plus, 
    Trash2, 
    Pencil, 
    Loader2, 
    Upload,
    X,
    Globe,
    Mail,
    Phone,
    MapPin,
    Eye,
    EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { saveOrganizationAction, deleteOrganizationAction } from '@/lib/organization-actions';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import MediaSelectorTrigger from './MediaSelectorTrigger';

interface OrganizationManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organization?: Organization | null;
}

export default function OrganizationManagementDialog({ 
    open, 
    onOpenChange, 
    organization 
}: OrganizationManagementDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    const [isSaving, setIsSaving] = React.useState(false);

    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [logoUrl, setLogoUrl] = React.useState('');
    const [website, setWebsite] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    
    // AI Keys
    const [geminiApiKey, setGeminiApiKey] = React.useState('');
    const [openRouterApiKey, setOpenRouterApiKey] = React.useState('');
    const [openaiApiKey, setOpenaiApiKey] = React.useState('');
    const [claudeApiKey, setClaudeApiKey] = React.useState('');
    
    // UI State
    const [showApiKeys, setShowApiKeys] = React.useState(false);

    // Settings
    const [defaultCurrency, setDefaultCurrency] = React.useState('USD');
    const [defaultTimezone, setDefaultTimezone] = React.useState('UTC');
    const [defaultLanguage, setDefaultLanguage] = React.useState('en');

    React.useEffect(() => {
        if (organization) {
            setName(organization.name);
            setDescription(organization.description || '');
            setLogoUrl(organization.logoUrl || '');
            setWebsite(organization.website || '');
            setEmail(organization.email || '');
            setPhone(organization.phone || '');
            setAddress(organization.address || '');
            setDefaultCurrency(organization.settings?.defaultCurrency || 'USD');
            setDefaultTimezone(organization.settings?.defaultTimezone || 'UTC');
            setDefaultLanguage(organization.settings?.defaultLanguage || 'en');
            
            setGeminiApiKey(organization.geminiApiKey || '');
            setOpenRouterApiKey(organization.openRouterApiKey || '');
            setOpenaiApiKey(organization.openaiApiKey || '');
            setClaudeApiKey(organization.claudeApiKey || '');
        } else {
            // Reset for new organization
            setName('');
            setDescription('');
            setLogoUrl('');
            setWebsite('');
            setEmail('');
            setPhone('');
            setAddress('');
            setDefaultCurrency('USD');
            setDefaultTimezone('UTC');
            setDefaultLanguage('en');

            setGeminiApiKey('');
            setOpenRouterApiKey('');
            setOpenaiApiKey('');
            setClaudeApiKey('');
        }
    }, [organization, open]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;
        setIsSaving(true);

        const result = await saveOrganizationAction(
            organization?.id || null,
            { 
                name: name.trim(), 
                description: description.trim(),
                logoUrl: logoUrl.trim(),
                website: website.trim(),
                email: email.trim(),
                phone: phone.trim(),
                address: address.trim(),
                settings: {
                    defaultCurrency,
                    defaultTimezone,
                    defaultLanguage,
                },
                geminiApiKey: geminiApiKey.trim(),
                openRouterApiKey: openRouterApiKey.trim(),
                openaiApiKey: openaiApiKey.trim(),
                claudeApiKey: claudeApiKey.trim()
            },
            user.uid
        );

        if (result.success) {
            toast({ 
                title: organization ? 'Organization Updated' : 'Organization Created', 
                description: 'Organization saved successfully.' 
            });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                <Building className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                    {organization ? 'Edit Organization' : 'New Organization'}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Configure organization identity and default settings
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden relative bg-background">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-8">
                                {/* Basic Information */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">Basic Information</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Organization Name *
                                            </Label>
                                            <Input 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="e.g. Acme Corporation" 
                                                className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-4" 
                                                required 
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Organization Logo
                                            </Label>
                                            <MediaSelectorTrigger 
                                                value={logoUrl}
                                                onSelect={setLogoUrl}
                                                label="Upload Organization Logo"
                                                workspaceId="global"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                            Description
                                        </Label>
                                        <Textarea 
                                            value={description} 
                                            onChange={e => setDescription(e.target.value)} 
                                            placeholder="Brief description of the organization..." 
                                            className="min-h-[100px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                        />
                                    </div>
                                </div>

                                <Separator />

                                {/* Contact Information */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">Contact Information</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                                                <Globe className="h-3 w-3" /> Website
                                            </Label>
                                            <Input 
                                                value={website} 
                                                onChange={e => setWebsite(e.target.value)} 
                                                placeholder="https://example.com" 
                                                type="url"
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                                                <Mail className="h-3 w-3" /> Email
                                            </Label>
                                            <Input 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                placeholder="contact@example.com" 
                                                type="email"
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                                                <Phone className="h-3 w-3" /> Phone
                                            </Label>
                                            <Input 
                                                value={phone} 
                                                onChange={e => setPhone(e.target.value)} 
                                                placeholder="+1 (555) 123-4567" 
                                                type="tel"
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                                                <MapPin className="h-3 w-3" /> Address
                                            </Label>
                                            <Input 
                                                value={address} 
                                                onChange={e => setAddress(e.target.value)} 
                                                placeholder="123 Main St, City, Country" 
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Default Settings */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">Default Settings</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Currency
                                            </Label>
                                            <Input 
                                                value={defaultCurrency} 
                                                onChange={e => setDefaultCurrency(e.target.value)} 
                                                placeholder="USD" 
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Timezone
                                            </Label>
                                            <Input 
                                                value={defaultTimezone} 
                                                onChange={e => setDefaultTimezone(e.target.value)} 
                                                placeholder="UTC" 
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Language
                                            </Label>
                                            <Input 
                                                value={defaultLanguage} 
                                                onChange={e => setDefaultLanguage(e.target.value)} 
                                                placeholder="en" 
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* AI Configuration */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-primary">AI Configuration</h4>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => setShowApiKeys(!showApiKeys)}
                                                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                {showApiKeys ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                                {showApiKeys ? 'Hide Keys' : 'Show Keys'}
                                            </Button>
                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">Per Organization</span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Gemini API Key
                                            </Label>
                                            <Input 
                                                value={geminiApiKey} 
                                                onChange={e => setGeminiApiKey(e.target.value)} 
                                                placeholder="AIza..." 
                                                type={showApiKeys ? "text" : "password"}
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                OpenRouter API Key
                                            </Label>
                                            <Input 
                                                value={openRouterApiKey} 
                                                onChange={e => setOpenRouterApiKey(e.target.value)} 
                                                placeholder="sk-or-v1-..." 
                                                type={showApiKeys ? "text" : "password"}
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                OpenAI API Key
                                            </Label>
                                            <Input 
                                                value={openaiApiKey} 
                                                onChange={e => setOpenaiApiKey(e.target.value)} 
                                                placeholder="sk-..." 
                                                type={showApiKeys ? "text" : "password"}
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                Claude API Key (Optional)
                                            </Label>
                                            <Input 
                                                value={claudeApiKey} 
                                                onChange={e => setClaudeApiKey(e.target.value)} 
                                                placeholder="sk-ant-..." 
                                                type={showApiKeys ? "text" : "password"}
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                            />
                                            <p className="text-[9px] text-muted-foreground ml-1 uppercase font-bold">Recommended: Use OpenRouter for Claude</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)} 
                            className="rounded-xl font-bold px-8"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving || !name.trim()} 
                            className="rounded-xl font-black px-12 shadow-2xl bg-primary text-white uppercase text-xs"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building className="h-4 w-4" />}
                            <span className="ml-2">{organization ? 'Update' : 'Create'} Organization</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
