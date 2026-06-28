'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    query, 
    orderBy,
    onSnapshot,
    deleteField
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { MessageStyle, MessageTemplate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    ArrowLeft, 
    Save, 
    Trash2, 
    Sparkles, 
    Loader2, 
    Check, 
    Pencil,
    X,
    Code,
    Eye,
    ChevronDown,
    Share2,
    AlertCircle
} from 'lucide-react';
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
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';
import MediaSelectorTrigger from '@/app/admin/components/MediaSelectorTrigger';

import { resolveBrandingPreview as resolveBrandingInHtml } from '@/lib/utils/resolve-branding-preview';

const DEFAULT_HTML = `<html>
  <body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">
        <img src="{{org_logo_url}}" alt="{{org_name}}" style="height: 40px; width: auto;" />
      </div>
      <div style="padding: 32px;">
        {{content}}
      </div>
      {{org_footer}}
    </div>
  </body>
</html>`;

export default function TenantStyleEditorPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const confirm = useConfirm();
    const firestore = useFirestore();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    const { activeOrganizationId } = useTenant();
    const styleId = params.id as string;
    const isNew = styleId === 'new';

    // Page/Style State
    const [style, setStyle] = React.useState<MessageStyle | null>(null);
    const [name, setName] = React.useState('');
    const [htmlWrapperInternal, setHtmlWrapperInternal] = React.useState(DEFAULT_HTML);
    const [htmlWrapperExternal, setHtmlWrapperExternal] = React.useState(DEFAULT_HTML);
    const [activeWrapperTab, setActiveWrapperTab] = React.useState<'internal' | 'external' | 'footer'>('internal');
    
    // Visual Override Fields
    const [primaryColor, setPrimaryColor] = React.useState('#3B5FFF');
    const [secondaryColor, setSecondaryColor] = React.useState('#8B5CF6');
    const [fontFamily, setFontFamily] = React.useState('Figtree');
    const [backgroundColor, setBackgroundColor] = React.useState('#f8fafc');
    const [textColor, setTextColor] = React.useState('#1e293b');
    const [cardBackgroundColor, setCardBackgroundColor] = React.useState('#ffffff');
    const [borderRadius, setBorderRadius] = React.useState('16px');

    const [logoUrl, setLogoUrl] = React.useState('');
    const [footerHtml, setFooterHtml] = React.useState<string | undefined>(undefined);
    const [footerEnabled, setFooterEnabled] = React.useState<'inherit' | 'enabled' | 'disabled'>('inherit');

    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(!isNew);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [isRenaming, setIsRenaming] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const renameInputRef = React.useRef<HTMLInputElement>(null);

    // Deletion blocked prevention state
    const [showDeleteBlocked, setShowDeleteBlocked] = React.useState(false);

    // Org Aesthetics Subscription for resolving brand previews
    const [orgData, setOrgData] = React.useState<any>(null);
    React.useEffect(() => {
        if (!firestore || !activeOrganizationId) return;
        const unsubscribe = onSnapshot(doc(firestore, 'organizations', activeOrganizationId), (snapshot) => {
            if (snapshot.exists()) {
                setOrgData(snapshot.data());
            }
        });
        return () => unsubscribe();
    }, [firestore, activeOrganizationId]);

    // Data Subscriptions - message_templates to check style usage
    const templatesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'message_templates'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: allTemplates } = useCollection<MessageTemplate>(templatesQuery);

    const styleInUseTemplates = React.useMemo(() => {
        if (isNew || !allTemplates) return [];
        return allTemplates.filter(t => t.styleId === styleId);
    }, [styleId, allTemplates, isNew]);

    // Load workspace options
    const workspaceOptions = React.useMemo(() => {
        return allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));
    }, [allowedWorkspaces]);

    // Fetch Style Details
    React.useEffect(() => {
        if (isNew) {
            setStyle({
                id: 'new',
                name: 'New Style Template',
                htmlWrapperInternal: DEFAULT_HTML,
                htmlWrapperExternal: DEFAULT_HTML,
                workspaceIds: [activeWorkspaceId],
                organizationId: activeOrganizationId || '',
                scope: 'organization',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                primaryColor: '#3B5FFF',
                secondaryColor: '#8B5CF6',
                fontFamily: 'Figtree',
                backgroundColor: '#f8fafc',
                textColor: '#1e293b',
                cardBackgroundColor: '#ffffff',
                borderRadius: '16px'
            });
            setName('New Style Template');
            setHtmlWrapperInternal(DEFAULT_HTML);
            setHtmlWrapperExternal(DEFAULT_HTML);
            setPrimaryColor('#3B5FFF');
            setSecondaryColor('#8B5CF6');
            setFontFamily('Figtree');
            setBackgroundColor('#f8fafc');
            setTextColor('#1e293b');
            setCardBackgroundColor('#ffffff');
            setBorderRadius('16px');
            setWorkspaceIds([activeWorkspaceId]);
            setLogoUrl('');
            setFooterHtml(undefined);
            setFooterEnabled('inherit');
            setLoading(false);
            return;
        }

        async function fetchStyle() {
            if (!firestore || !styleId) return;
            setLoading(true);
            try {
                const docRef = doc(firestore, 'message_styles', styleId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data() as MessageStyle;
                    setStyle(data);
                    setName(data.name);
                    setHtmlWrapperInternal(data.htmlWrapperInternal ?? data.htmlWrapper ?? DEFAULT_HTML);
                    setHtmlWrapperExternal(data.htmlWrapperExternal ?? data.htmlWrapper ?? DEFAULT_HTML);
                    setPrimaryColor(data.primaryColor ?? '#3B5FFF');
                    setSecondaryColor(data.secondaryColor ?? '#8B5CF6');
                    setFontFamily(data.fontFamily ?? 'Figtree');
                    setBackgroundColor(data.backgroundColor ?? '#f8fafc');
                    setTextColor(data.textColor ?? '#1e293b');
                    setCardBackgroundColor(data.cardBackgroundColor ?? '#ffffff');
                    setBorderRadius(data.borderRadius ?? '16px');
                    setWorkspaceIds(data.workspaceIds || []);
                    setLogoUrl(data.logoUrl ?? '');
                    setFooterHtml(data.footerHtml ?? undefined);
                    if (data.footerEnabled === undefined) {
                        setFooterEnabled('inherit');
                    } else {
                        setFooterEnabled(data.footerEnabled ? 'enabled' : 'disabled');
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Style blueprint not found.' });
                    router.push('/admin/messaging/styles');
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to fetch style.' });
            } finally {
                setLoading(false);
            }
        }

        fetchStyle();
    }, [firestore, styleId, isNew, activeWorkspaceId, activeOrganizationId, toast, router]);

    // resolveBrandingInHtml is imported from resolve-branding-preview utility

    const handleSave = async () => {
        if (!firestore || !name.trim() || !htmlWrapperInternal.trim() || !htmlWrapperExternal.trim()) return;

        if (!htmlWrapperInternal.includes('{{content}}')) {
            toast({ 
                variant: 'destructive', 
                title: 'Invalid Internal HTML Template', 
                description: 'The internal wrapper template must include the {{content}} placeholder injection point.' 
            });
            return;
        }

        if (!htmlWrapperExternal.includes('{{content}}')) {
            toast({ 
                variant: 'destructive', 
                title: 'Invalid External HTML Template', 
                description: 'The external wrapper template must include the {{content}} placeholder injection point.' 
            });
            return;
        }

        if (workspaceIds.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Workspace Scope Required',
                description: 'Please select at least one workspace to apply this style wrapper.'
            });
            return;
        }

        setSaving(true);
        try {
            const dataToSave: Record<string, unknown> = {
                name: name.trim(),
                htmlWrapper: htmlWrapperExternal.trim(), // fallback
                htmlWrapperInternal: htmlWrapperInternal.trim(),
                htmlWrapperExternal: htmlWrapperExternal.trim(),
                primaryColor: primaryColor.trim(),
                secondaryColor: secondaryColor.trim(),
                fontFamily: fontFamily.trim(),
                backgroundColor: backgroundColor.trim(),
                textColor: textColor.trim(),
                cardBackgroundColor: cardBackgroundColor.trim(),
                borderRadius: borderRadius.trim(),
                workspaceIds,
                organizationId: activeOrganizationId || '',
                scope: 'organization',
                updatedAt: new Date().toISOString()
            };

            if (logoUrl.trim()) {
                dataToSave.logoUrl = logoUrl.trim();
            } else if (!isNew) {
                dataToSave.logoUrl = deleteField();
            }

            if (footerHtml && footerHtml.trim()) {
                dataToSave.footerHtml = footerHtml.trim();
            } else if (!isNew) {
                dataToSave.footerHtml = deleteField();
            }

            if (footerEnabled === 'enabled') {
                dataToSave.footerEnabled = true;
            } else if (footerEnabled === 'disabled') {
                dataToSave.footerEnabled = false;
            } else if (!isNew) {
                dataToSave.footerEnabled = deleteField();
            }

            if (isNew) {
                await addDoc(collection(firestore, 'message_styles'), {
                    ...dataToSave,
                    isDefault: false,
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'Created Style Wrapper', description: `"${name}" has been initialized.` });
            } else {
                await updateDoc(doc(firestore, 'message_styles', styleId), dataToSave);
                toast({ title: 'Saved Style Wrapper', description: `"${name}" changes saved.` });
            }
            router.push('/admin/messaging/styles');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isNew || !firestore) return;

        if (styleInUseTemplates.length > 0) {
            setShowDeleteBlocked(true);
            return;
        }

        if (!(await confirm({ title: 'Delete style template?', description: 'Templates using it may fall back to default layouts.', confirmText: 'Delete', variant: 'destructive' }))) return;

        setDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'message_styles', styleId));
            toast({ title: 'Style Deleted', description: 'Template wrapper removed successfully.' });
            router.push('/admin/messaging/styles');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: err.message });
        } finally {
            setDeleting(false);
        }
    };

    const startRename = () => {
        setRenameValue(name);
        setIsRenaming(true);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const commitRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== name) {
            setName(trimmed);
            toast({ title: 'Label updated (unsaved)', description: `Style renamed to "${trimmed}". Remember to save.` });
        }
        setIsRenaming(false);
    };

    const insertVariable = (key: string) => {
        const tag = `{{${key}}}`;
        if (activeWrapperTab === 'internal') {
            setHtmlWrapperInternal(prev => prev + tag);
        } else if (activeWrapperTab === 'external') {
            setHtmlWrapperExternal(prev => prev + tag);
        } else if (activeWrapperTab === 'footer') {
            setFooterHtml(prev => (prev ?? '') + tag);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!style) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-lg font-semibold">Style not found</p>
                <Button onClick={() => router.push('/admin/messaging/styles')} className="rounded-xl">
                    Back to Styles Library
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-left">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-4 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/messaging/styles')} className="rounded-xl shrink-0 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            {isRenaming ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        ref={renameInputRef}
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commitRename();
                                            if (e.key === 'Escape') setIsRenaming(false);
                                        }}
                                        onBlur={commitRename}
                                        className="text-xl font-bold tracking-tight bg-transparent border-b-2 border-primary focus:outline-none min-w-0 w-[280px] max-w-full"
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <div className="group/title flex items-center gap-2 min-w-0">
                                    <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{name}</h1>
                                    <button
                                        type="button"
                                        onClick={startRename}
                                        className="opacity-0 group-hover/title:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                                        title="Rename"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[8px] h-5 rounded-lg shrink-0">
                                {isNew ? 'New' : 'Workspace override'}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Configure standard layout wrapper and brand integration properties.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!isNew && (
                        <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting || saving} className="rounded-xl h-9 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/20">
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />} Delete
                        </Button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={saving || deleting || !name.trim()} className="rounded-xl h-9 text-xs shadow-lg shadow-primary/20 px-6">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />} Save Wrapper
                    </Button>
                </div>
            </div>

            {/* Main Layout Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Config Panel (Sidebar) */}
                <div className="lg:col-span-4 xl:col-span-3 space-y-6">
                    <Card className="rounded-[1.5rem] border shadow-sm">
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Wrapper Settings</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Determine naming and deployment scope.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Style Label</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Elegant Dark Wrapper" className="h-10 rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-primary ml-1 flex items-center gap-2">
                                        <Share2 className="h-3.5 w-3.5" /> Target Scope (Workspaces)
                                    </Label>
                                    <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} className="rounded-xl" />
                                </div>
                                <div className="space-y-2 pt-4 border-t">
                                    <Label className="text-xs font-bold text-muted-foreground ml-1">Style Logo Override</Label>
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <MediaSelectorTrigger 
                                                value={logoUrl}
                                                onSelect={setLogoUrl}
                                                label="Logo Override"
                                                subLabel={logoUrl ? "Custom logo active for this style wrapper." : "No override. Inheriting default logo."}
                                                workspaceId={activeWorkspaceId || 'global'}
                                                previewClassName="h-16 w-16 shadow-md ring-2 ring-background hover:ring-primary/20 transition-all duration-300 rounded-xl"
                                            />
                                        </div>
                                        {!logoUrl && orgData?.logoUrl && (
                                            <div className="flex flex-col text-left opacity-60 shrink-0">
                                                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Inherited Default</span>
                                                <div className="h-16 w-16 rounded-xl border bg-muted/20 flex items-center justify-center overflow-hidden">
                                                    <img src={orgData.logoUrl} alt="Inherited Logo" className="h-full w-full object-contain p-1" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[1.5rem] border shadow-sm">
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Visual Style Overrides</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Customize the color scheme, typography, and card shapes.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Primary Brand Color</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 p-1 bg-muted/20 border-none cursor-pointer rounded-xl shrink-0" />
                                        <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#3B5FFF" className="h-10 rounded-xl flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Secondary Brand Color</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 p-1 bg-muted/20 border-none cursor-pointer rounded-xl shrink-0" />
                                        <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} placeholder="#8B5CF6" className="h-10 rounded-xl flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Background Color</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-10 h-10 p-1 bg-muted/20 border-none cursor-pointer rounded-xl shrink-0" />
                                        <Input value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} placeholder="#f8fafc" className="h-10 rounded-xl flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Text Color</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-10 p-1 bg-muted/20 border-none cursor-pointer rounded-xl shrink-0" />
                                        <Input value={textColor} onChange={e => setTextColor(e.target.value)} placeholder="#1e293b" className="h-10 rounded-xl flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Card Background Color</Label>
                                    <div className="flex gap-2">
                                        <Input type="color" value={cardBackgroundColor} onChange={e => setCardBackgroundColor(e.target.value)} className="w-10 h-10 p-1 bg-muted/20 border-none cursor-pointer rounded-xl shrink-0" />
                                        <Input value={cardBackgroundColor} onChange={e => setCardBackgroundColor(e.target.value)} placeholder="#ffffff" className="h-10 rounded-xl flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Font Family</Label>
                                    <Input value={fontFamily} onChange={e => setFontFamily(e.target.value)} placeholder="e.g. Figtree, Inter, sans-serif" className="h-10 rounded-xl text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground ml-1">Border Radius</Label>
                                    <Input value={borderRadius} onChange={e => setBorderRadius(e.target.value)} placeholder="e.g. 16px, 1rem, 0px" className="h-10 rounded-xl text-xs" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Main Content Area */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-6">
                    <Tabs value={activeWrapperTab} onValueChange={(val) => setActiveWrapperTab(val as 'internal' | 'external' | 'footer')} className="space-y-4">
                        <TabsList className="bg-background border p-1 h-11 rounded-2xl shadow-sm w-fit">
                            <TabsTrigger value="internal" className="text-xs font-semibold px-6 rounded-xl gap-2">
                                🏢 Internal Wrapper (Admin Comms)
                            </TabsTrigger>
                            <TabsTrigger value="external" className="text-xs font-semibold px-6 rounded-xl gap-2">
                                🌍 External Wrapper (Client Comms)
                            </TabsTrigger>
                            <TabsTrigger value="footer" className="text-xs font-semibold px-6 rounded-xl gap-2">
                                ✉️ Style Footer
                            </TabsTrigger>
                        </TabsList>
                        
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                            {/* Editor Column */}
                            <div className="xl:col-span-7 space-y-4">
                                <TabsContent value="internal" className="mt-0 space-y-2 focus-visible:ring-0">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Code className="h-3.5 w-3.5 text-primary" /> Internal HTML Wrapper</Label>
                                        <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] font-bold uppercase h-5 px-2">Must include &#123;&#123;content&#125;&#125;</Badge>
                                    </div>
                                    <Textarea 
                                        value={htmlWrapperInternal} 
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHtmlWrapperInternal(e.target.value)} 
                                        placeholder="Write internal HTML wrapper template here..."
                                        className="min-h-[420px] font-mono text-xs bg-slate-950 text-blue-400 p-6 rounded-[1.5rem] border-slate-800 shadow-inner focus-visible:ring-primary/20 leading-relaxed resize-none" 
                                    />
                                </TabsContent>
                                <TabsContent value="external" className="mt-0 space-y-2 focus-visible:ring-0">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Code className="h-3.5 w-3.5 text-primary" /> External HTML Wrapper</Label>
                                        <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] font-bold uppercase h-5 px-2">Must include &#123;&#123;content&#125;&#125;</Badge>
                                    </div>
                                    <Textarea 
                                        value={htmlWrapperExternal} 
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHtmlWrapperExternal(e.target.value)} 
                                        placeholder="Write external HTML wrapper template here..."
                                        className="min-h-[420px] font-mono text-xs bg-slate-950 text-blue-400 p-6 rounded-[1.5rem] border-slate-800 shadow-inner focus-visible:ring-primary/20 leading-relaxed resize-none" 
                                    />
                                </TabsContent>
                                <TabsContent value="footer" className="mt-0 space-y-6 focus-visible:ring-0 text-left">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Footer Display Policy</Label>
                                            <div className="flex flex-wrap gap-2 bg-muted/30 p-1 rounded-xl w-fit border">
                                                {[
                                                    { value: 'inherit', label: 'Inherit Default' },
                                                    { value: 'enabled', label: 'Always Enabled' },
                                                    { value: 'disabled', label: 'Always Disabled' }
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setFooterEnabled(option.value as 'inherit' | 'enabled' | 'disabled')}
                                                        className={cn(
                                                            "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                                                            footerEnabled === option.value
                                                                ? "bg-background text-foreground shadow-sm border border-border"
                                                                : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                Control whether this specific style wrapper forces a footer, forces no footer, or inherits the default organization settings.
                                            </p>
                                        </div>

                                        {footerEnabled !== 'disabled' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                        <Code className="h-3.5 w-3.5 text-primary" /> Custom Footer HTML Override
                                                    </Label>
                                                    {footerEnabled === 'inherit' && (
                                                        <Badge variant="outline" className="text-[8px] font-bold uppercase h-5 px-2 bg-muted/50 border-none text-muted-foreground">
                                                            Inheriting Default HTML
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Textarea 
                                                    value={footerHtml ?? ''} 
                                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFooterHtml(e.target.value || undefined)} 
                                                    placeholder={orgData?.footerHtml || "Write custom footer HTML overrides here..."}
                                                    className="min-h-[200px] font-mono text-xs bg-slate-950 text-blue-400 p-6 rounded-[1.5rem] border-slate-800 shadow-inner focus-visible:ring-primary/20 leading-relaxed resize-none" 
                                                />
                                                <p className="text-[10px] text-muted-foreground leading-normal">
                                                    Specify custom HTML to override the footer body for templates using this style. Leave empty to use the default organization footer.
                                                </p>
                                            </div>
                                        )}

                                        {/* Default reference tip */}
                                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-xs space-y-1.5">
                                            <p className="font-bold text-primary flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5" /> Organization Default Reference
                                            </p>
                                            <p className="text-muted-foreground">
                                                Status: <span className="font-semibold text-foreground">{orgData?.footerEnabled !== false ? 'Enabled' : 'Disabled'}</span>
                                            </p>
                                            {orgData?.footerHtml && (
                                                <div className="mt-2">
                                                    <span className="text-[10px] text-muted-foreground font-semibold">Default HTML:</span>
                                                    <pre className="mt-1 p-2 bg-muted/40 rounded-lg text-[9px] font-mono overflow-x-auto max-h-24 leading-normal">
                                                        {orgData.footerHtml}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                                
                                {/* Org Variables Reference Panel */}
                                <details className="group rounded-2xl border bg-card overflow-hidden" open>
                                    <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-muted/30 transition-colors">
                                        <span className="text-xs font-bold text-primary flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Organization Variables Helper</span>
                                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="px-4 pb-4 pt-0 border-t">
                                        <p className="text-[10px] font-semibold text-muted-foreground mb-3 mt-3">Click on any variable parameter to append its placeholder tag inside the wrapper HTML source.</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {[
                                                { key: 'org_name', desc: 'Organization name' },
                                                { key: 'org_logo_url', desc: 'Logo image URL' },
                                                { key: 'org_email', desc: 'Contact email' },
                                                { key: 'org_phone', desc: 'Contact phone' },
                                                { key: 'org_address', desc: 'Physical address' },
                                                { key: 'org_website', desc: 'Website URL' },
                                                { key: 'brand_primary_color', desc: 'Primary brand hex color' },
                                                { key: 'brand_secondary_color', desc: 'Secondary brand hex color' },
                                                { key: 'brand_font_family', desc: 'Typography font family' },
                                                { key: 'unsubscribe_copy', desc: 'Unsubscribe copy disclaimers' },
                                                { key: 'org_footer', desc: 'Org-configured footer (compliance + unsubscribe link)' },
                                                { key: 'current_year', desc: 'Current calendar year (auto)' },
                                                { key: 'content', desc: 'Body payload injection point' },
                                            ].map(v => (
                                                <button
                                                    key={v.key}
                                                    type="button"
                                                    onClick={() => insertVariable(v.key)}
                                                    className="flex flex-col items-start p-2.5 rounded-xl border bg-muted/20 hover:bg-primary/5 hover:border-primary/20 transition-colors text-left"
                                                >
                                                    <span className="text-[10px] font-bold font-mono text-primary">{`{{${v.key}}}`}</span>
                                                    <span className="text-[8px] font-semibold text-muted-foreground mt-0.5">{v.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </details>
                            </div>
                            
                            {/* Preview Column */}
                            <div className="xl:col-span-5 space-y-4 lg:sticky lg:top-6">
                                <div className="flex items-center justify-between px-1">
                                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Live Rendering Preview</Label>
                                    <Badge variant="outline" className="text-[8px] font-bold h-5 uppercase rounded-lg">Sandbox Gateway</Badge>
                                </div>
                                <div className="rounded-[1.5rem] overflow-hidden border bg-background shadow-inner h-[680px]">
                                    <iframe 
                                        srcDoc={resolveBrandingInHtml(
                                            activeWrapperTab === 'internal' ? htmlWrapperInternal : htmlWrapperExternal, 
                                            orgData,
                                            {
                                                primaryColor,
                                                secondaryColor,
                                                fontFamily,
                                                backgroundColor,
                                                textColor,
                                                cardBackgroundColor,
                                                borderRadius,
                                                logoUrl,
                                                footerHtml,
                                                footerEnabled: footerEnabled === 'inherit' ? undefined : (footerEnabled === 'enabled')
                                            }
                                        ).replace('{{content}}', '<div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 60px; text-align: center; color: #64748b; font-family: sans-serif; border-radius: 12px; margin: 20px;"><p style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Resolved Content Block</p><p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8;">This block represents where template body is dynamically injected.</p></div>')}
                                        className="w-full h-full border-none bg-white"
                                        title="Wrapper Dynamic Live Preview"
                                        sandbox="allow-same-origin"
                                    />
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>

            </div>

            {/* Deletion Prevention Warning Dialog */}
            <AlertDialog open={showDeleteBlocked} onOpenChange={setShowDeleteBlocked}>
                <AlertDialogContent className="rounded-[2.5rem] max-w-md p-8 border-none shadow-2xl bg-card text-left">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto p-4 bg-amber-500/10 text-amber-500 rounded-full w-fit">
                            <AlertCircle size={32} />
                        </div>
                        <div className="space-y-2 text-center">
                            <AlertDialogTitle className="font-semibold text-lg tracking-tight">Deletion Blocked</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                                This style wrapper is currently in active use by <span className="font-bold text-foreground">{styleInUseTemplates.length} message template{styleInUseTemplates.length !== 1 ? 's' : ''}</span>.
                                You cannot delete this style until those templates are reassigned to other styles.
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
                                        setShowDeleteBlocked(false);
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
        </div>
    );
}
