'use client';

/**
 * {{Org_name}} Experience Platform — Visual Configurator Studio
 *
 * Full-featured visual studio with multi-tab configuration and split-screen
 * real-time responsive preview for Experience Portals.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Save,
  PlayCircle,
  PauseCircle,
  ExternalLink,
  Copy,
  Sparkles,
  Paintbrush,
  Compass,
  Sliders,
  ShieldCheck,
  Globe,
  Eye,
  Loader2,
  Check,
} from 'lucide-react';
import { PortalThemeCustomizer } from '../components/PortalThemeCustomizer';
import { PortalNavigationBuilder } from '../components/PortalNavigationBuilder';
import { PortalAccessPolicyEditor } from '../components/PortalAccessPolicyEditor';
import { PortalSeoEditor } from '../components/PortalSeoEditor';
import { PortalLivePreviewCanvas } from '../components/PortalLivePreviewCanvas';
import { PortalContentManager } from '../components/PortalContentManager';
import { PortalMemberManager } from '../components/PortalMemberManager';
import {
  updatePortalAction,
  publishPortalAction,
  suspendPortalAction,
} from '@/app/actions/portal-actions';
import type {
  Portal,
  PortalThemeConfig,
  PortalBranding,
  PortalNavigationConfig,
  PortalAccessPolicy,
  PortalFeatureToggles,
  PortalSeoConfig,
  PortalMode,
} from '@/lib/types/portal';
import CreateQRButton from '@/components/qr-studio/create-qr-button';

interface PortalStudioClientProps {
  portalId: string;
}

export default function PortalStudioClient({ portalId }: PortalStudioClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganization, allAccessibleWorkspaces } = useTenant();

  const portalDocRef = React.useMemo(
    () => (firestore && portalId ? doc(firestore, 'portals', portalId) : null),
    [firestore, portalId]
  );

  const { data: initialPortal, isLoading } = useDoc<Portal>(portalDocRef);

  // Local draft state for real-time reactivity
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [primaryMode, setPrimaryMode] = React.useState<PortalMode>('academy');
  const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);
  const [theme, setTheme] = React.useState<PortalThemeConfig | null>(null);
  const [branding, setBranding] = React.useState<PortalBranding | null>(null);
  const [navigation, setNavigation] = React.useState<PortalNavigationConfig | null>(null);
  const [accessPolicy, setAccessPolicy] = React.useState<PortalAccessPolicy | null>(null);
  const [features, setFeatures] = React.useState<PortalFeatureToggles | null>(null);
  const [seo, setSeo] = React.useState<PortalSeoConfig | null>(null);

  const [activeTab, setActiveTab] = React.useState('identity');
  const [showPreviewMobile, setShowPreviewMobile] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Initialize draft state from Firestore
  React.useEffect(() => {
    if (initialPortal) {
      setName(initialPortal.name);
      setSlug(initialPortal.slug);
      setDescription(initialPortal.description || '');
      setPrimaryMode(initialPortal.primaryMode);
      setWorkspaceIds(initialPortal.workspaceIds || ['default']);
      setTheme(initialPortal.theme);
      setBranding(initialPortal.branding);
      setNavigation(initialPortal.navigation);
      setAccessPolicy(initialPortal.accessPolicy);
      setFeatures(initialPortal.features);
      setSeo(initialPortal.seo);
      setHasChanges(false);
    }
  }, [initialPortal]);

  const markDirty = () => setHasChanges(true);

  // Save changes
  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Portal name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updatePortalAction(portalId, {
        name,
        slug,
        description,
        primaryMode,
        workspaceIds,
        theme: theme || undefined,
        branding: branding || undefined,
        navigation: navigation || undefined,
        accessPolicy: accessPolicy || undefined,
        features: features || undefined,
        seo: seo || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to save changes.');

      toast({
        title: 'Changes Saved 🎉',
        description: 'Your portal configuration has been updated.',
      });
      setHasChanges(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.';
      toast({ title: 'Error', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish / Suspend
  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const res = await publishPortalAction(portalId);
      if (!res.success) throw new Error(res.error || 'Publish failed.');
      toast({ title: 'Portal Published Live! 🚀', description: 'Your portal is now accessible to visitors.' });
    } catch (err) {
      toast({ title: 'Publish Error', description: err instanceof Error ? err.message : 'Failed to publish.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    setIsSaving(true);
    try {
      const res = await suspendPortalAction(portalId, 'Curriculum update in progress');
      if (!res.success) throw new Error(res.error || 'Suspend failed.');
      toast({ title: 'Portal Suspended', description: 'Portal is now in maintenance mode.' });
    } catch (err) {
      toast({ title: 'Suspend Error', description: err instanceof Error ? err.message : 'Failed to suspend.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/portal/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link Copied', description: 'Public portal URL ready to share.' });
  };

  if (isLoading || !initialPortal || !theme || !branding || !navigation || !accessPolicy || !features || !seo) {
    return (
      <PageContainerFluid>
        <div className="space-y-6 py-6">
          <Skeleton className="h-14 w-1/3 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[600px] rounded-2xl" />
            <Skeleton className="h-[600px] rounded-2xl" />
          </div>
        </div>
      </PageContainerFluid>
    );
  }

  const orgName = activeOrganization?.name || 'Organization';
  const publicPath = `/portal/${slug}`;

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-24 w-full">
        {/* ── Studio Header Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-card border-2 border-border shadow-xs">
          <div className="flex items-center gap-3">
            <Link href="/admin/portals">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  {orgName} Experience Studio
                </span>
                <Badge
                  variant={initialPortal.status === 'published' ? 'default' : 'secondary'}
                  className="rounded-full text-[10px] uppercase font-bold"
                >
                  {initialPortal.status}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-foreground">{name}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-10 rounded-xl font-bold text-xs gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>

            <CreateQRButton
              resourceType="public_portal"
              resourceId={portalId}
              resourceName={name}
              destinationUrl={typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath}
              variant="compact"
            />

            <a href={publicPath} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> View Live
              </Button>
            </a>

            {initialPortal.status === 'published' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuspend}
                disabled={isSaving}
                className="h-10 rounded-xl font-bold text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10 gap-1.5"
              >
                <PauseCircle className="w-4 h-4" /> Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublish}
                disabled={isSaving}
                className="h-10 rounded-xl font-bold text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
              >
                <PlayCircle className="w-4 h-4" /> Publish Live
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-5 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* ── Main Split View Grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Configurator Tabs (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-auto p-1.5 bg-card border border-border rounded-2xl grid grid-cols-4 sm:grid-cols-8 gap-1 shadow-xs">
                <TabsTrigger
                  value="identity"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Identity
                </TabsTrigger>
                <TabsTrigger
                  value="content"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Content
                </TabsTrigger>
                <TabsTrigger
                  value="members"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Members
                </TabsTrigger>
                <TabsTrigger
                  value="theme"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Theme
                </TabsTrigger>
                <TabsTrigger
                  value="navigation"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Navigation
                </TabsTrigger>
                <TabsTrigger
                  value="modules"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Modules
                </TabsTrigger>
                <TabsTrigger
                  value="access"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  Access
                </TabsTrigger>
                <TabsTrigger
                  value="seo"
                  className="rounded-xl text-xs font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  SEO
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Content Vault ────────────────────────────────── */}
              <TabsContent value="content" className="mt-6">
                <PortalContentManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={initialPortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              </TabsContent>

              {/* ── Tab: Members & Tiers ──────────────────────────────── */}
              <TabsContent value="members" className="mt-6">
                <PortalMemberManager
                  portalId={portalId}
                  portalSlug={slug}
                  organizationId={initialPortal.organizationId}
                  workspaceIds={workspaceIds}
                />
              </TabsContent>

              {/* ── Tab 1: Identity & Scoping ─────────────────────────── */}
              <TabsContent value="identity" className="space-y-6 mt-6">
                <Card className="rounded-2xl border-2 border-border shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold">General Identity</CardTitle>
                    <CardDescription className="text-xs">
                      Configure portal title, public URL slug, and workspace assignments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-xs font-bold">
                        Portal Name
                      </Label>
                      <Input
                        id="edit-name"
                        value={name}
                        onChange={e => (setName(e.target.value), markDirty())}
                        className="h-10 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-slug" className="text-xs font-bold">
                        URL Slug
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-3 py-2 rounded-xl border border-border">
                          /portal/
                        </span>
                        <Input
                          id="edit-slug"
                          value={slug}
                          onChange={e => (setSlug(e.target.value), markDirty())}
                          className="h-10 rounded-xl text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-desc" className="text-xs font-bold">
                        Tagline / Summary
                      </Label>
                      <Textarea
                        id="edit-desc"
                        value={description}
                        onChange={e => (setDescription(e.target.value), markDirty())}
                        className="rounded-xl text-xs min-h-[72px] resize-none"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label className="text-xs font-bold">Workspace Scoping & Sharing</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Select which workspaces can manage and access this portal:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(allAccessibleWorkspaces || []).map(ws => {
                          const isSelected = workspaceIds.includes(ws.id);
                          return (
                            <button
                              key={ws.id}
                              type="button"
                              onClick={() => {
                                setWorkspaceIds(prev =>
                                  prev.includes(ws.id)
                                    ? prev.length > 1
                                      ? prev.filter(id => id !== ws.id)
                                      : prev
                                    : [...prev, ws.id]
                                );
                                markDirty();
                              }}
                              className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                              }`}
                            >
                              {ws.name || ws.id}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Tab 2: Theme Customizer ───────────────────────────── */}
              <TabsContent value="theme" className="mt-6">
                <PortalThemeCustomizer
                  theme={theme}
                  branding={branding}
                  onChangeTheme={t => (setTheme(t), markDirty())}
                  onChangeBranding={b => (setBranding(b), markDirty())}
                />
              </TabsContent>

              {/* ── Tab 3: Navigation Builder ─────────────────────────── */}
              <TabsContent value="navigation" className="mt-6">
                <PortalNavigationBuilder
                  navigation={navigation}
                  onChangeNavigation={n => (setNavigation(n), markDirty())}
                />
              </TabsContent>

              {/* ── Tab 4: Modules & Spaces ───────────────────────────── */}
              <TabsContent value="modules" className="space-y-6 mt-6">
                <Card className="rounded-2xl border-2 border-border shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm">
                      <Sliders className="w-4 h-4" /> Active Experience Spaces & Modules
                    </div>
                    <CardDescription className="text-xs">
                      Toggle active feature modules in this portal.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {[
                      { key: 'enableCourses', label: 'Curriculum & Courses', desc: 'Structured learning modules with lessons and tracking' },
                      { key: 'enableDocs', label: 'Documentation & Help Base', desc: 'Technical documentation, articles, and searchable knowledge' },
                      { key: 'enableCommunity', label: 'Community Feed & Groups', desc: 'Social discussion posts, comments, and member spaces' },
                      { key: 'enableResources', label: 'Resource Library & Downloads', desc: 'Downloadable templates, toolkits, and PDFs' },
                      { key: 'enableEvents', label: 'Live Events & Coaching Calls', desc: 'Google Meet & Zoom workshop sessions' },
                      { key: 'enableGamification', label: 'Badges & Certificates', desc: 'Verifiable credentials and milestones' },
                      { key: 'enableAiTutor', label: 'AI Learning Tutor', desc: 'Grounded AI assistant answering questions on portal materials' },
                      { key: 'enableAffiliates', label: 'Affiliate & Referral Engine', desc: 'Partner links and revenue tracking' },
                    ].map(mod => (
                      <div key={mod.key} className="flex items-center justify-between p-3 rounded-xl border border-border">
                        <div>
                          <p className="text-xs font-bold text-foreground">{mod.label}</p>
                          <p className="text-[11px] text-muted-foreground">{mod.desc}</p>
                        </div>
                        <Switch
                          checked={Boolean(features[mod.key as keyof PortalFeatureToggles])}
                          onCheckedChange={checked => {
                            setFeatures({ ...features, [mod.key]: checked });
                            markDirty();
                          }}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Tab 5: Access Policy ──────────────────────────────── */}
              <TabsContent value="access" className="mt-6">
                <PortalAccessPolicyEditor
                  accessPolicy={accessPolicy}
                  onChangeAccessPolicy={p => (setAccessPolicy(p), markDirty())}
                />
              </TabsContent>

              {/* ── Tab 6: SEO & Social Preview ───────────────────────── */}
              <TabsContent value="seo" className="mt-6">
                <PortalSeoEditor
                  seo={seo}
                  branding={branding}
                  portalName={name}
                  slug={slug}
                  onChangeSeo={s => (setSeo(s), markDirty())}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right / Live Responsive Preview Frame (5 Cols) */}
          <div className="lg:col-span-5 sticky top-6 h-[720px]">
            <PortalLivePreviewCanvas
              portal={initialPortal}
              theme={theme}
              branding={branding}
              navigation={navigation}
              features={features}
              primaryMode={primaryMode}
              portalName={name}
              slug={slug}
            />
          </div>
        </div>
      </div>
    </PageContainerFluid>
  );
}
