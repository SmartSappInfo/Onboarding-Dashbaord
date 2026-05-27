'use client';

import * as React from 'react';
import { 
    collection, 
    query, 
    orderBy, 
    addDoc, 
    doc, 
    deleteDoc, 
    updateDoc, 
    where, 
    writeBatch, 
    onSnapshot 
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MessageStyle, MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
    Palette, 
    Plus, 
    Trash2, 
    Code,
    Eye,
    X,
    Loader2,
    Sparkles,
    Check,
    Pencil,
    Save,
    Share2,
    Layout,
    AlertCircle,
    ShieldCheck,
    ChevronDown,
    Globe,
    Mail,
    Phone,
    MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateVisualStyle } from '@/ai/flows/generate-visual-style-flow';
import { MediaSelect } from '../../entities/components/media-select';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import MediaSelectorTrigger from '../../components/MediaSelectorTrigger';
import { PageContainerFluid } from '@/components/ui/page-container';

export default function MessageStylesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId, allowedWorkspaces } = useWorkspace();
    const router = useRouter();
    
    // Deletion prevention state
    const [styleInUseToDelete, setStyleInUseToDelete] = React.useState<MessageStyle | null>(null);
    
    // UI State
    const [activeTab, setActiveTab] = React.useState('library');
    const [isAdding, setIsAdding] = React.useState(false);
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);
    const [previewStyle, setPreviewStyle] = React.useState<MessageStyle | null>(null);
    
    // Edit Style State
    const [editingStyle, setEditingStyle] = React.useState<MessageStyle | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHtml, setEditHtml] = React.useState('');
    const [editWorkspaceIds, setEditWorkspaceIds] = React.useState<string[]>([]);
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Manual Create Style State
    const [name, setName] = React.useState('');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);
    const [htmlWrapper, setHtmlWrapper] = React.useState('<html>\n  <body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">\n    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">\n      <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">\n        <img src="{{org_logo_url}}" alt="{{org_name}}" style="height: 40px; width: auto;" />\n      </div>\n      <div style="padding: 32px;">\n        {{content}}\n      </div>\n      <div style="padding: 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">\n        <p style="margin: 0;">© {{current_year}} {{org_name}}</p>\n        <p style="margin: 4px 0 0;">{{org_address}}</p>\n        <p style="margin: 12px 0 0; font-size: 10px; color: #a1a1aa;">{{unsubscribe_copy}}</p>\n      </div>\n    </div>\n  </body>\n</html>');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // AI Generation State
    const [aiName, setAiName] = React.useState('');
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [aiInspirationUrl, setAiInspirationUrl] = React.useState('');
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [generatedHtml, setGeneratedHtml] = React.useState<string | null>(null);

    // Org Settings Subscription
    const [orgData, setOrgData] = React.useState<any>(null);
    const [isOrgLoading, setIsOrgLoading] = React.useState(true);

    // Brand Aesthetics Form States
    const [brandLogo, setBrandLogo] = React.useState('');
    const [brandPrimary, setBrandPrimary] = React.useState('#3B5FFF');
    const [brandSecondary, setBrandSecondary] = React.useState('#8B5CF6');
    const [brandFont, setBrandFont] = React.useState('Figtree');
    const [brandUnsubscribe, setBrandUnsubscribe] = React.useState('');
    const [brandWebsite, setBrandWebsite] = React.useState('');
    const [brandEmail, setBrandEmail] = React.useState('');
    const [brandPhone, setBrandPhone] = React.useState('');
    const [brandAddress, setBrandAddress] = React.useState('');
    const [isSavingBrand, setIsSavingBrand] = React.useState(false);

    // Sync Active Workspace ID when workspace changes
    React.useEffect(() => {
        if (activeWorkspaceId) {
            setWorkspaceIds([activeWorkspaceId]);
        }
    }, [activeWorkspaceId]);

    // Load active organization details
    React.useEffect(() => {
        if (!firestore || !activeOrganizationId) return;
        setIsOrgLoading(true);
        const unsubscribe = onSnapshot(doc(firestore, 'organizations', activeOrganizationId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setOrgData(data);
                setBrandLogo(data.logoUrl || '');
                setBrandPrimary(data.brandPrimaryColor || '#3B5FFF');
                setBrandSecondary(data.brandSecondaryColor || '#8B5CF6');
                setBrandFont(data.brandFontFamily || 'Figtree');
                setBrandUnsubscribe(data.unsubscribeCopy || '');
                setBrandWebsite(data.website || '');
                setBrandEmail(data.email || '');
                setBrandPhone(data.phone || '');
                setBrandAddress(data.address || '');
            }
            setIsOrgLoading(false);
        }, (err) => {
            console.error('Error fetching organization aesthetics:', err);
            setIsOrgLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, activeOrganizationId]);

    // Data Subscriptions - GLOBAL + WORKSPACE styles
    const stylesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_styles'), 
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: allStyles, isLoading } = useCollection<MessageStyle>(stylesQuery);

    // Data Subscriptions - message_templates to check style usage
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: allTemplates } = useCollection<MessageTemplate>(templatesQuery);

    // Filter and Deduplicate styles relevant to workspace / scope
    const styles = React.useMemo(() => {
        if (!allStyles) return [];
        // Local styles scoped to this workspace
        const localStyles = allStyles.filter(s => s.workspaceIds?.includes(activeWorkspaceId));
        // Global system blueprint styles
        const globalStyles = allStyles.filter(s => !s.workspaceIds || s.workspaceIds.length === 0 || s.scope === 'global');
        
        return [...localStyles, ...globalStyles];
    }, [allStyles, activeWorkspaceId]);

    const styleInUseTemplates = React.useMemo(() => {
        if (!styleInUseToDelete || !allTemplates) return [];
        return allTemplates.filter(t => t.styleId === styleInUseToDelete.id);
    }, [styleInUseToDelete, allTemplates]);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Branding resolution utility for previews
    const resolveBrandingInHtml = React.useCallback((html: string, data?: any) => {
        if (!html) return '';
        const currentYear = new Date().getFullYear().toString();
        const orgName = data?.name || 'Your Organization';
        const logo = data?.logoUrl || '';
        const emailAddr = data?.email || 'contact@yourdomain.com';
        const phoneNum = data?.phone || '+1 (555) 000-0000';
        const addressStr = data?.address || '123 Main St, City, Country';
        const webUrl = data?.website || 'https://yourdomain.com';
        const unsubCopy = data?.unsubscribeCopy || 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.';
        const primaryCol = data?.brandPrimaryColor || '#3B5FFF';
        const secondaryCol = data?.brandSecondaryColor || '#8B5CF6';
        const fontFam = data?.brandFontFamily || 'Figtree';

        return html
            .replaceAll('{{org_name}}', orgName)
            .replaceAll('{{org_logo_url}}', logo)
            .replaceAll('{{org_email}}', emailAddr)
            .replaceAll('{{org_phone}}', phoneNum)
            .replaceAll('{{org_address}}', addressStr)
            .replaceAll('{{org_website}}', webUrl)
            .replaceAll('{{unsubscribe_copy}}', unsubCopy)
            .replaceAll('{{brand_primary_color}}', primaryCol)
            .replaceAll('{{brand_secondary_color}}', secondaryCol)
            .replaceAll('{{brand_font_family}}', fontFam)
            .replaceAll('{{current_year}}', currentYear);
    }, []);

    // Manual Create Style Submit
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !htmlWrapper) return;
        
        if (!htmlWrapper.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: name.trim(),
                htmlWrapper: htmlWrapper.trim(),
                workspaceIds: workspaceIds.length > 0 ? workspaceIds : [activeWorkspaceId],
                organizationId: activeOrganizationId || '',
                scope: 'organization',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setWorkspaceIds([activeWorkspaceId]);
            setIsAdding(false);
            toast({ title: 'Style Created' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Style adoption handler
    const handleAdoptStyle = async (blueprint: MessageStyle) => {
        if (!firestore || !activeWorkspaceId || !activeOrganizationId) return;
        setIsSubmitting(true);
        try {
            // Check for name collision in existing styles
            let newName = `${blueprint.name} (Adopted)`;
            let counter = 1;
            const existingNames = styles.map(s => s.name.toLowerCase());
            while (existingNames.includes(newName.toLowerCase())) {
                counter++;
                newName = `${blueprint.name} (Adopted) ${counter}`;
            }

            const docRef = await addDoc(collection(firestore, 'message_styles'), {
                name: newName,
                htmlWrapper: blueprint.htmlWrapper,
                workspaceIds: [activeWorkspaceId],
                organizationId: activeOrganizationId,
                scope: 'organization',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            toast({ 
                title: 'Blueprint Adopted', 
                description: `"${newName}" has been customized for your workspace.` 
            });

            // Automatically route to edit page for newly cloned adopted style
            router.push(`/admin/messaging/styles/${docRef.id}`);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Adoption Failed', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (style: MessageStyle) => {
        setEditingStyle(style);
        setEditName(style.name);
        setEditHtml(style.htmlWrapper);
        setEditWorkspaceIds(style.workspaceIds || [activeWorkspaceId]);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingStyle || !editName || !editHtml) return;

        if (!editHtml.includes('{{content}}')) {
            toast({ variant: 'destructive', title: 'Invalid Wrapper', description: 'HTML must include the {{content}} placeholder.' });
            return;
        }

        setIsUpdating(true);
        try {
            await updateDoc(doc(firestore, 'message_styles', editingStyle.id), {
                name: editName.trim(),
                htmlWrapper: editHtml.trim(),
                workspaceIds: editWorkspaceIds,
                updatedAt: new Date().toISOString(),
            });
            setEditingStyle(null);
            toast({ title: 'Style Updated' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiName || !aiPrompt) return;
        setIsAiProcessing(true);
        try {
            let photoDataUri = undefined;
            if (aiInspirationUrl) {
                const response = await fetch(aiInspirationUrl);
                const blob = await response.blob();
                photoDataUri = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }

            const result = await generateVisualStyle({
                name: aiName,
                prompt: aiPrompt,
                photoDataUri
            });

            setGeneratedHtml(result.htmlWrapper);
            toast({ title: 'AI Style Generated', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Generation Failed', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!firestore || !aiName || !generatedHtml) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'message_styles'), {
                name: aiName.trim(),
                htmlWrapper: generatedHtml.trim(),
                workspaceIds: [activeWorkspaceId],
                organizationId: activeOrganizationId || '',
                scope: 'organization',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setGeneratedHtml(null);
            setIsAiGenerating(false);
            toast({ title: 'AI Style Created' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (style: MessageStyle) => {
        if (!firestore) return;
        const isGlobal = !style.workspaceIds || style.workspaceIds.length === 0 || style.scope === 'global';
        if (isGlobal) {
            toast({ variant: 'destructive', title: 'Unauthorized', description: 'Global blueprints cannot be deleted from workspaces.' });
            return;
        }

        // Check if style is in use
        const templatesUsingStyle = allTemplates?.filter(t => t.styleId === style.id) || [];
        if (templatesUsingStyle.length > 0) {
            setStyleInUseToDelete(style);
            return;
        }

        if (!confirm('Permanently purge this style? Templates using it may render incorrectly.')) return;
        await deleteDoc(doc(firestore, 'message_styles', style.id));
        toast({ title: 'Style Purged' });
    };

    const handleSetDefault = async (style: MessageStyle) => {
        if (!firestore || !activeWorkspaceId) return;
        const isGlobal = !style.workspaceIds || style.workspaceIds.length === 0 || style.scope === 'global';
        const targetValue = !style.isDefault;

        // Toggling "default style" on a global style automatically adopts it
        if (isGlobal) {
            if (!targetValue) {
                // Cannot simply turn off a global default from here
                toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'To remove this global blueprint as default, set another style as default.' });
                return;
            }

            setIsSubmitting(true);
            try {
                let newName = `${style.name} (Adopted)`;
                let counter = 1;
                const existingNames = styles.map(s => s.name.toLowerCase());
                while (existingNames.includes(newName.toLowerCase())) {
                    counter++;
                    newName = `${style.name} (Adopted) ${counter}`;
                }

                const batch = writeBatch(firestore);
                
                // Set all other local styles default to false
                if (allStyles) {
                    allStyles.forEach(s => {
                        if (s.isDefault) {
                            batch.update(doc(firestore, 'message_styles', s.id), { isDefault: false });
                        }
                    });
                }

                // Create adopted local style as default
                const newDocRef = doc(collection(firestore, 'message_styles'));
                batch.set(newDocRef, {
                    name: newName,
                    htmlWrapper: style.htmlWrapper,
                    workspaceIds: [activeWorkspaceId],
                    organizationId: activeOrganizationId || '',
                    scope: 'organization',
                    isDefault: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await batch.commit();
                toast({
                    title: 'Blueprint Adopted & Set Default',
                    description: `"${style.name}" has been adopted and set as default for this workspace.`
                });
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Standard local style default toggle
        try {
            const batch = writeBatch(firestore);
            if (targetValue) {
                if (allStyles) {
                    allStyles.forEach(s => {
                        if (s.isDefault && s.id !== style.id) {
                            batch.update(doc(firestore, 'message_styles', s.id), { isDefault: false });
                        }
                    });
                }
            }
            batch.update(doc(firestore, 'message_styles', style.id), { isDefault: targetValue });
            await batch.commit();
            toast({
                title: targetValue ? 'Default Style Set' : 'Default Style Removed',
                description: targetValue
                    ? `"${style.name}" is now the default brand style.`
                    : `"${style.name}" is no longer the default brand style.`
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        }
    };

    // Save Brand Aesthetics settings
    const handleSaveBrand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !activeOrganizationId) return;
        setIsSavingBrand(true);
        try {
            await updateDoc(doc(firestore, 'organizations', activeOrganizationId), {
                logoUrl: brandLogo.trim(),
                brandPrimaryColor: brandPrimary.trim(),
                brandSecondaryColor: brandSecondary.trim(),
                brandFontFamily: brandFont.trim(),
                unsubscribeCopy: brandUnsubscribe.trim(),
                website: brandWebsite.trim(),
                email: brandEmail.trim(),
                phone: brandPhone.trim(),
                address: brandAddress.trim(),
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Brand Aesthetics Saved', description: 'Organization branding assets updated successfully.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setIsSavingBrand(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <PageContainerFluid>
                <div className="space-y-8">
                {/* Page Title Header */}
                <div className="flex items-center justify-between border-b pb-6 shrink-0 flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Template Styles</h1>
                        <p className="text-xs text-muted-foreground font-bold mt-1">
                            Manage global blueprints, local styles, and organization branding
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <RainbowButton onClick={() => setIsAiGenerating(true)} className="h-11 px-6 gap-2 font-semibold text-[10px] shadow-xl">
                            <Sparkles className="h-4 w-4" /> AI Style Generator
                        </RainbowButton>
                        <Button onClick={() => router.push('/admin/messaging/styles/new')} variant="outline" className="h-11 rounded-xl font-bold border-primary/20 text-primary bg-background/50 hover:bg-muted">
                            <Plus className="mr-2 h-4 w-4" /> Create Style
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-background border p-1 h-11 rounded-2xl shadow-sm">
                        <TabsTrigger value="library" className="text-xs font-semibold px-6 rounded-xl gap-2">
                            <Palette className="h-4 w-4" /> Style Library
                        </TabsTrigger>
                        <TabsTrigger value="aesthetics" className="text-xs font-semibold px-6 rounded-xl gap-2">
                            <Sparkles className="h-4 w-4" /> Brand Aesthetics
                        </TabsTrigger>
                    </TabsList>

                    {/* STYLE LIBRARY TAB */}
                    <TabsContent value="library" className="space-y-6 focus-visible:outline-none">

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2.5rem]" />)
                            ) : styles?.length ? (
                                styles.map((style) => {
                                    const isGlobal = !style.workspaceIds || style.workspaceIds.length === 0 || style.scope === 'global';
                                    return (
                                        <Card key={style.id} className="group relative overflow-hidden border-none ring-1 ring-border hover:ring-primary/20 hover:shadow-xl transition-all duration-500 rounded-[1.5rem] bg-card flex flex-col h-[230px] w-full">
                                            {/* Preview / Iframe Area */}
                                            <div className="relative flex-1 bg-slate-50 overflow-hidden">
                                                <ResponsiveIframePreview 
                                                    srcDoc={resolveBrandingInHtml(style.htmlWrapper, orgData).replace('{{content}}', '<div style="height: 100px; background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-family: sans-serif; font-size: 12px; color: #94a3b8; border-radius: 12px; margin: 20px;">[ Content Gateway ]</div>')}
                                                    className="pointer-events-none border-none opacity-85 group-hover:opacity-95 transition-opacity"
                                                    title={`Preview of ${style.name}`}
                                                />
                                                <div className="absolute inset-0 bg-transparent" />
                                                
                                                {/* Default Pill (when not hovered) */}
                                                {style.isDefault && (
                                                    <div className="absolute top-2 left-2 group-hover:opacity-0 transition-opacity">
                                                        <Badge className="bg-emerald-500 text-white border-none text-[8px] font-bold uppercase h-5 shadow-sm">
                                                            <Check className="h-2.5 w-2.5 mr-0.5" /> Default
                                                        </Badge>
                                                    </div>
                                                )}

                                                {/* Overlay on Hover */}
                                                <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                                    <div className="flex items-center gap-1 bg-background/95 backdrop-blur-md p-1 rounded-xl border shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className={cn("h-7 w-7 rounded-lg transition-colors", style.isDefault ? "text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-muted-foreground hover:bg-muted")} 
                                                            onClick={() => handleSetDefault(style)}
                                                            title={style.isDefault ? "Default Style" : "Set Default"}
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" 
                                                            onClick={() => setPreviewStyle(style)}
                                                            title="Preview"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {isGlobal ? (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 rounded-lg text-primary hover:text-primary hover:bg-primary/10" 
                                                                onClick={() => handleAdoptStyle(style)}
                                                                title="Adopt & Customize"
                                                            >
                                                                <Sparkles className="h-3.5 w-3.5" />
                                                            </Button>
                                                        ) : (
                                                            <>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" 
                                                                    onClick={() => router.push(`/admin/messaging/styles/${style.id}`)}
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg" 
                                                                    onClick={() => handleDelete(style)}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Info Footer */}
                                            <div className="px-4 py-3 bg-card border-t flex items-center justify-between shrink-0 h-14">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-foreground truncate pr-2" title={style.name}>{style.name}</p>
                                                    <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                                        {isGlobal ? 'System Blueprint' : 'Workspace Style'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {style.workspaceIds && style.workspaceIds.length > 1 && (
                                                        <Badge variant="secondary" className="text-[8px] font-bold h-5 px-2 bg-blue-500/10 text-blue-600 border-none">
                                                            Shared
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center gap-4 opacity-30">
                                    <Palette className="h-16 w-16" />
                                    <p className="font-semibold text-xs">No styles in this workspace hub</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* BRAND AESTHETICS TAB */}
                    <TabsContent value="aesthetics" className="space-y-6 focus-visible:outline-none">
                        <Card className="rounded-[2.5rem] border border-border/50 shadow-xl overflow-hidden bg-card">
                            <CardHeader className="p-8 bg-muted/10 border-b">
                                <CardTitle className="text-xl font-semibold tracking-tight">Organization Brand Identity</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Configure core brand variables. Use placeholders like <code>&#123;&#123;brand_primary_color&#125;&#125;</code> and <code>&#123;&#123;unsubscribe_copy&#125;&#125;</code> in your wrappers to dynamically sync brand styling across templates.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                {isOrgLoading ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Skeleton className="h-14 rounded-xl" />
                                            <Skeleton className="h-14 rounded-xl" />
                                        </div>
                                        <Skeleton className="h-32 rounded-2xl" />
                                        <Skeleton className="h-12 w-48 self-end" />
                                    </div>
                                ) : (
                                    <form onSubmit={handleSaveBrand} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">
                                                    Brand Logo
                                                </Label>
                                                <MediaSelectorTrigger 
                                                    value={brandLogo}
                                                    onSelect={setBrandLogo}
                                                    label="Upload Brand Logo"
                                                    workspaceId={activeWorkspaceId}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">
                                                    Brand Font Family
                                                </Label>
                                                <select 
                                                    value={brandFont}
                                                    onChange={e => setBrandFont(e.target.value)}
                                                    className="h-11 w-full rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 text-sm"
                                                >
                                                    <option value="Figtree">Figtree</option>
                                                    <option value="Inter">Inter</option>
                                                    <option value="Roboto">Roboto</option>
                                                    <option value="Outfit">Outfit</option>
                                                    <option value="Montserrat">Montserrat</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">
                                                    Primary Brand Color
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="color" 
                                                        value={brandPrimary} 
                                                        onChange={e => setBrandPrimary(e.target.value)} 
                                                        className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl" 
                                                    />
                                                    <Input 
                                                        value={brandPrimary} 
                                                        onChange={e => setBrandPrimary(e.target.value)} 
                                                        placeholder="#3B5FFF" 
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">
                                                    Secondary Brand Color
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        type="color" 
                                                        value={brandSecondary} 
                                                        onChange={e => setBrandSecondary(e.target.value)} 
                                                        className="w-12 h-11 p-1 bg-muted/20 border-none cursor-pointer rounded-xl" 
                                                    />
                                                    <Input 
                                                        value={brandSecondary} 
                                                        onChange={e => setBrandSecondary(e.target.value)} 
                                                        placeholder="#8B5CF6" 
                                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4 flex-1" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Globe className="h-3.5 w-3.5" /> Website URL
                                                </Label>
                                                <Input 
                                                    value={brandWebsite} 
                                                    onChange={e => setBrandWebsite(e.target.value)} 
                                                    placeholder="https://example.com" 
                                                    type="url"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Mail className="h-3.5 w-3.5" /> Support Email Address
                                                </Label>
                                                <Input 
                                                    value={brandEmail} 
                                                    onChange={e => setBrandEmail(e.target.value)} 
                                                    placeholder="support@example.com" 
                                                    type="email"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <Phone className="h-3.5 w-3.5" /> Contact Phone Number
                                                </Label>
                                                <Input 
                                                    value={brandPhone} 
                                                    onChange={e => setBrandPhone(e.target.value)} 
                                                    placeholder="+1 (555) 123-4567" 
                                                    type="tel"
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5" /> Office Address
                                                </Label>
                                                <Input 
                                                    value={brandAddress} 
                                                    onChange={e => setBrandAddress(e.target.value)} 
                                                    placeholder="123 Main St, City, Country" 
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" 
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-muted-foreground ml-1">
                                                Unsubscribe Disclaimer Copy (Max 300 characters)
                                            </Label>
                                            <Textarea 
                                                value={brandUnsubscribe} 
                                                onChange={e => {
                                                    if (e.target.value.length <= 300) {
                                                        setBrandUnsubscribe(e.target.value);
                                                    }
                                                }} 
                                                placeholder="e.g. You are receiving this because you signed up for our newsletter. Click here to unsubscribe." 
                                                className="min-h-[100px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium leading-relaxed" 
                                            />
                                            <div className="text-[10px] text-muted-foreground text-right font-bold">
                                                {brandUnsubscribe.length}/300 characters
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={isSavingBrand} 
                                                className="rounded-xl h-12 px-12 font-semibold text-xs shadow-xl"
                                            >
                                                {isSavingBrand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Save Brand Settings
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* AI Generator Dialog */}
            <Dialog open={isAiGenerating} onOpenChange={setIsAiGenerating}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-xl"><Sparkles size={24} className="text-primary" /></div>
                            <div className="text-left">
                                <DialogTitle className="text-xl font-semibold tracking-tight">AI Style Generator</DialogTitle>
                                <DialogDescription className="text-xs font-bold opacity-60">Generate responsive brand wrappers via AI</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        <div className="w-full lg:w-1/2 p-8 border-r flex flex-col gap-8 overflow-y-auto bg-muted/10">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Identity Label</Label>
                                <Input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="e.g. Modern Campus Dark Theme" className="h-12 rounded-xl bg-card border-primary/10 shadow-sm font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Design Directives</Label>
                                <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. Create a clean design with a deep blue header, centered white logo, and a minimal footer." className="min-h-[180px] rounded-2xl text-sm leading-relaxed bg-card border-primary/10 shadow-inner p-4" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Visual Inspiration (Optional)</Label>
                                <MediaSelect value={aiInspirationUrl} onValueChange={setAiInspirationUrl} filterType="image" className="rounded-2xl" />
                            </div>
                            <RainbowButton onClick={handleAiGenerate} disabled={isAiProcessing} className="h-14 w-full font-semibold text-lg gap-2 shadow-2xl">
                                {isAiProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                {isAiProcessing ? 'Generating…' : 'Generate Style'}
                            </RainbowButton>
                        </div>

                        <div className="w-full lg:w-1/2 p-8 flex flex-col bg-card">
                            <div className="flex items-center justify-between mb-6">
                                <Label className="text-[10px] font-semibold text-primary flex items-center gap-2"><Eye className="h-3 w-3" /> Live Render</Label>
                                {generatedHtml && <Badge className="bg-emerald-50 text-emerald-600 border-none font-semibold text-[8px] uppercase">Logic Verified</Badge>}
                            </div>
                            <div className="flex-1 rounded-[2.5rem] bg-muted/10 border-2 border-dashed border-border flex items-center justify-center relative overflow-hidden shadow-inner p-4">
                                {generatedHtml ? (
                                    <div className="w-full h-full bg-card rounded-2xl shadow-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: resolveBrandingInHtml(generatedHtml, orgData).replace('{{content}}', '<div style="background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; font-weight: 900; border-radius: 12px; margin: 20px;">[ PROTOTYPE CONTENT ]</div>') }} />
                                ) : (
                                    <div className="text-center space-y-4 opacity-20">
                                        <Palette size={64} className="mx-auto" />
                                        <p className="text-[10px] font-semibold tracking-[0.3em]">Awaiting Simulation</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setIsAiGenerating(false)} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                        <Button onClick={handleSaveGenerated} disabled={!generatedHtml || isSubmitting} className="rounded-xl font-semibold px-12 shadow-2xl h-12 text-xs active:scale-95 transition-all">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit AI Style
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Standard Preview Dialog */}
            <Dialog open={!!previewStyle} onOpenChange={() => setPreviewStyle(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-background">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl"><Eye className="h-5 w-5 text-primary" /></div>
                            <div>
                                <DialogTitle className="text-xl font-semibold tracking-tight">Atmospheric Preview</DialogTitle>
                                <DialogDescription className="text-xs font-bold">{previewStyle?.name}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden relative bg-background flex justify-center">
                        <ScrollArea className="h-full w-full">
                            <div className="w-full max-w-[650px] mx-auto p-6">
                                {previewStyle && (
                                    <div dangerouslySetInnerHTML={{ __html: resolveBrandingInHtml(previewStyle.htmlWrapper, orgData).replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Resolved Template Payload</p></div>') }} />
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="p-4 bg-card border-t shrink-0 flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setPreviewStyle(null)} className="rounded-xl h-11 px-6 text-xs font-semibold">
                            Close
                        </Button>
                        {previewStyle && !(!previewStyle.workspaceIds || previewStyle.workspaceIds.length === 0 || previewStyle.scope === 'global') && (
                            <Button 
                                onClick={() => {
                                    const styleToEdit = previewStyle;
                                    setPreviewStyle(null);
                                    router.push(`/admin/messaging/styles/${styleToEdit.id}`);
                                }} 
                                className="rounded-xl h-11 px-6 text-xs font-semibold shadow-lg shadow-primary/20"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Style
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Blocked Dialog */}
            <AlertDialog open={!!styleInUseToDelete} onOpenChange={(o) => !o && setStyleInUseToDelete(null)}>
                <AlertDialogContent className="rounded-[2.5rem] max-w-md p-8 border-none shadow-2xl bg-card text-left">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto p-4 bg-amber-500/10 text-amber-500 rounded-full w-fit">
                            <AlertCircle size={32} />
                        </div>
                        <div className="space-y-2 text-center">
                            <AlertDialogTitle className="font-semibold text-lg tracking-tight">Deletion Blocked</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                The style <span className="font-bold text-foreground">"{styleInUseToDelete?.name}"</span> is currently being used by <span className="font-bold text-foreground">{styleInUseTemplates.length} template{styleInUseTemplates.length !== 1 ? 's' : ''}</span>. 
                                To delete this style, you must first change the style of those templates.
                            </AlertDialogDescription>
                        </div>
                    </AlertDialogHeader>
                    
                    {/* Templates List */}
                    <div className="my-6 max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                        {styleInUseTemplates.map((tmpl) => (
                            <div key={tmpl.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                                <span className="text-xs font-bold truncate max-w-[200px] text-foreground">{tmpl.name}</span>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                                    onClick={() => {
                                        setStyleInUseToDelete(null);
                                        // Router push to templates page with edit search param
                                        router.push(`/admin/messaging/templates?edit=${tmpl.id}`);
                                    }}
                                >
                                    <Pencil size={12} /> Edit Template
                                </Button>
                            </div>
                        ))}
                    </div>
                    
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="w-full rounded-xl font-bold border-none bg-muted/65 hover:bg-muted text-foreground">
                            Close
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </PageContainerFluid>
        </div>
    );
}

interface ResponsiveIframePreviewProps {
    srcDoc: string;
    className?: string;
    title?: string;
}

function ResponsiveIframePreview({ 
    srcDoc, 
    className, 
    title = "Preview" 
}: ResponsiveIframePreviewProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(0.25);
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
    const [isMeasured, setIsMeasured] = React.useState(false);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        
        const observer = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            if (width <= 0 || height <= 0) return;
            
            const virtualWidth = 800;
            const newScale = width / virtualWidth;
            setScale(newScale);
            setDimensions({ width: virtualWidth, height: height / newScale });
            setIsMeasured(true);
        });
        
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden relative bg-slate-50 flex items-center justify-center">
            <iframe 
                srcDoc={srcDoc}
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
                className={cn(
                    "pointer-events-none border-none transition-opacity duration-300",
                    isMeasured ? "opacity-100" : "opacity-0",
                    className
                )}
                title={title}
                loading="lazy"
            />
        </div>
    );
}

