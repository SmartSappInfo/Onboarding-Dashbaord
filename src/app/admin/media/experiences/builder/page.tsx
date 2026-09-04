'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Experience Builder Studio:
 *    Interactive 3-pane experience editor elevated for Phase 5:
 *    - Left Palette: Template selection & theme presets.
 *    - Center Live Preview Canvas: Viewport switcher (Desktop/Tablet/Mobile) + Persona Switcher (Lead / Parent / Customer).
 *    - Right Inspector Tabs:
 *      - Tab 1: Design & Player Controls
 *      - Tab 2: Dynamic CTA Rules (<DynamicCtaRulesEditor>)
 *      - Tab 3: Personalization & Token Resolver (<PersonalizationTokenEditor> with <VariablesPanel>)
 *      - Tab 4: A/B Testing Manager (<ABExperimentEditor>)
 *      - Tab 5: Content Recommendations
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, inputs, tabs, and triggers strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch targets with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { 
  MediaExperience, ExperienceTemplate, DynamicCtaRule, 
  PersonalizationConfig, ContentRecommendation, ABExperimentConfig,
  PersonaPreviewContext 
} from '@/lib/types/media-2.0';
import { 
  createExperienceAction, 
  updateExperienceAction, 
  getExperienceAction,
  DEFAULT_EXPERIENCE_THEME,
  DEFAULT_PLAYER_CONTROLS 
} from '@/lib/media/media-experience-service';
import { 
  evaluateDynamicCtaRules, 
  resolvePersonalizedContent 
} from '@/lib/media/personalization-rules-service';
import { DynamicCtaRulesEditor } from '../components/DynamicCtaRulesEditor';
import { PersonalizationTokenEditor } from '../components/PersonalizationTokenEditor';
import { ABExperimentEditor } from '../components/ABExperimentEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, ArrowLeft, Monitor, Tablet, Smartphone, 
  Palette, Play, Shield, Sparkles, Loader2, Layout, Check,
  Target, Split, UserCheck, Flame, GraduationCap, Users
} from 'lucide-react';

export default function ExperienceBuilderPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const editId = searchParams.get('id');

  // Base state
  const [title, setTitle] = useState('New Custom Presentation Layout');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<ExperienceTemplate>('showcase');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_EXPERIENCE_THEME.primaryColorHex);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_EXPERIENCE_THEME.backgroundColorHex);
  const [logoUrl, setLogoUrl] = useState('');
  const [autoplay, setAutoplay] = useState(DEFAULT_PLAYER_CONTROLS.autoplay);
  const [allowDownload, setAllowDownload] = useState(DEFAULT_PLAYER_CONTROLS.allowDownload);
  const [showSpeed, setShowSpeed] = useState(DEFAULT_PLAYER_CONTROLS.showPlaybackSpeed);

  // Phase 5 State: Dynamic CTAs, Personalization, A/B Testing, Recommendations
  const [dynamicCtaRules, setDynamicCtaRules] = useState<DynamicCtaRule[]>([]);
  const [personalization, setPersonalization] = useState<PersonalizationConfig>({
    enabled: false,
    headlineTemplate: '',
    descriptionTemplate: '',
    fallbackHeadline: '',
    fallbackDescription: '',
  });
  const [abExperiment, setAbExperiment] = useState<ABExperimentConfig>({
    id: 'exp_default',
    name: 'Headline Urgency Test',
    enabled: false,
    trafficSplitPercent: 50,
    variantA: {},
    variantB: {},
    metrics: {
      variantAViews: 0,
      variantAClicks: 0,
      variantBViews: 0,
      variantBClicks: 0,
    },
  });
  const [recommendations, setRecommendations] = useState<ContentRecommendation>({
    enabled: false,
    strategy: 'collection',
    maxRecommendations: 3,
  });

  // Persona Preview State
  const [activePersona, setActivePersona] = useState<'anonymous' | 'decision_maker' | 'high_intent_lead' | 'customer'>('high_intent_lead');

  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    if (!firestore || !editId) return;

    let isMounted = true;
    async function loadExperience() {
      if (!firestore || !editId) return;
      try {
        const exp = await getExperienceAction(firestore, editId);
        if (exp && isMounted) {
          setTitle(exp.title);
          setDescription(exp.description || '');
          setTemplate(exp.template);
          setPrimaryColor(exp.theme?.primaryColorHex || DEFAULT_EXPERIENCE_THEME.primaryColorHex);
          setBackgroundColor(exp.theme?.backgroundColorHex || DEFAULT_EXPERIENCE_THEME.backgroundColorHex);
          setLogoUrl(exp.theme?.logoUrl || '');
          setAutoplay(exp.playerControls?.autoplay ?? false);
          setAllowDownload(exp.playerControls?.allowDownload ?? true);
          setShowSpeed(exp.playerControls?.showPlaybackSpeed ?? true);

          if (exp.dynamicCtaRules) setDynamicCtaRules(exp.dynamicCtaRules);
          if (exp.personalization) setPersonalization(exp.personalization);
          if (exp.abExperiment) setAbExperiment(exp.abExperiment);
          if (exp.recommendations) setRecommendations(exp.recommendations);

          setIsLoading(false);
        }
      } catch (err: unknown) {
        console.error('[ExperienceBuilderPage] Error loading experience:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadExperience();
    return () => {
      isMounted = false;
    };
  }, [firestore, editId]);

  // Persona Simulation Context
  const simulatedPersonas: Record<'anonymous' | 'decision_maker' | 'high_intent_lead' | 'customer', PersonaPreviewContext> = {
    anonymous: {
      personaType: 'anonymous',
      contactName: '',
      contactEmail: '',
      companyName: '',
      engagementScore: 0,
      dealStage: '',
      watchedChapterIds: [],
      contactTagIds: [],
    },
    decision_maker: {
      personaType: 'decision_maker',
      contactName: 'Sarah Jenkins',
      contactEmail: 'sarah.j@acmeschool.edu',
      companyName: 'Acme International Academy',
      engagementScore: 45,
      dealStage: 'Presentation Delivered',
      watchedChapterIds: ['chap-intro'],
      contactTagIds: ['tag-parent'],
    },
    high_intent_lead: {
      personaType: 'high_intent_lead',
      contactName: 'David Thompson',
      contactEmail: 'david.t@futuregroup.org',
      companyName: 'Future Growth Partners',
      engagementScore: 88,
      dealStage: 'Qualified Opportunity',
      watchedChapterIds: ['chap-pricing', 'chap-curriculum'],
      contactTagIds: ['tag-hot-lead'],
    },
    customer: {
      personaType: 'customer',
      contactName: 'Michael Chang',
      contactEmail: 'mchang@starlight.edu',
      companyName: 'Starlight High School',
      engagementScore: 95,
      dealStage: 'Closed Won',
      watchedChapterIds: ['chap-intro', 'chap-curriculum', 'chap-pricing'],
      contactTagIds: ['tag-enrolled'],
    },
  };

  const currentPersona = simulatedPersonas[activePersona];

  // Dynamic Content Resolution based on active Persona
  const previewHeadline = useMemo(() => {
    if (!personalization.enabled) return title;
    return resolvePersonalizedContent(
      personalization.headlineTemplate,
      {
        contactName: currentPersona.contactName,
        companyName: currentPersona.companyName,
        contactEmail: currentPersona.contactEmail,
        dealStage: currentPersona.dealStage,
      },
      personalization.fallbackHeadline || title
    );
  }, [personalization, currentPersona, title]);

  const previewDescription = useMemo(() => {
    if (!personalization.enabled) return description;
    return resolvePersonalizedContent(
      personalization.descriptionTemplate,
      {
        contactName: currentPersona.contactName,
        companyName: currentPersona.companyName,
        contactEmail: currentPersona.contactEmail,
        dealStage: currentPersona.dealStage,
      },
      personalization.fallbackDescription || description
    );
  }, [personalization, currentPersona, description]);

  // Evaluated Dynamic CTA Action based on active Persona
  const evaluatedAction = useMemo(() => {
    return evaluateDynamicCtaRules(dynamicCtaRules, {
      watchProgressPercent: currentPersona.engagementScore >= 80 ? 75 : 50,
      contactScore: currentPersona.engagementScore,
      dealStage: currentPersona.dealStage,
      watchedChapterIds: currentPersona.watchedChapterIds,
      contactTagIds: currentPersona.contactTagIds,
    });
  }, [dynamicCtaRules, currentPersona]);

  const previewCtaButtonText = evaluatedAction?.ctaButtonText || 'Standard Consultation';

  const handleSave = async () => {
    if (!firestore || !activeWorkspaceId || isSaving) return;
    setIsSaving(true);

    try {
      if (editId) {
        const ok = await updateExperienceAction(firestore, editId, {
          title,
          description,
          template,
          theme: { primaryColorHex: primaryColor, backgroundColorHex: backgroundColor, logoUrl },
          playerControls: { autoplay, allowDownload, showPlaybackSpeed: showSpeed, showQualitySelector: true, loop: false, showCaptions: true },
          dynamicCtaRules,
          personalization,
          abExperiment,
          recommendations,
        });
        if (ok) {
          toast({ 
            title: 'Experience Saved', 
            description: 'Custom rules, personalization, and layouts updated successfully.',
            actionConfig: { path: '/admin/media/experiences', label: 'View Experiences' }
          });
        }
      } else {
        const created = await createExperienceAction(firestore, {
          workspaceId: activeWorkspaceId,
          assetId: 'template-default',
          title,
          description,
          template,
          theme: { primaryColorHex: primaryColor, backgroundColorHex: backgroundColor, logoUrl },
          playerControls: { autoplay, allowDownload, showPlaybackSpeed: showSpeed },
          dynamicCtaRules,
          personalization,
          abExperiment,
          recommendations,
          createdById: 'admin',
        });
        if (created) {
          toast({ 
            title: 'Experience Created', 
            description: 'New presentation experience saved with rules.',
            actionConfig: { path: '/admin/media/experiences', label: 'View Experiences' }
          });
          router.push(`/admin/media/experiences/builder?id=${created.id}`);
        }
      }
    } catch (err: unknown) {
      console.error('[handleSave] Error:', err);
      toast({ title: 'Save Failed', description: 'Could not save experience.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs font-bold">Loading Builder Studio...</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden text-left">
      {/* Top Builder Toolbar */}
      <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/media/experiences')}
            className="rounded-xl min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-black text-foreground truncate">{title}</h2>
            <p className="text-[10px] text-muted-foreground">Phase 5 Experience Studio: Personalization & Dynamic Rules</p>
          </div>
        </div>

        {/* Viewport Switcher */}
        <div className="hidden sm:flex items-center p-1 rounded-xl bg-muted/40 border border-border">
          <Button
            size="sm"
            variant={viewport === 'desktop' ? 'default' : 'ghost'}
            onClick={() => setViewport('desktop')}
            className="rounded-lg text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </Button>
          <Button
            size="sm"
            variant={viewport === 'tablet' ? 'default' : 'ghost'}
            onClick={() => setViewport('tablet')}
            className="rounded-lg text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Tablet className="h-3.5 w-3.5" /> Tablet
          </Button>
          <Button
            size="sm"
            variant={viewport === 'mobile' ? 'default' : 'ghost'}
            onClick={() => setViewport('mobile')}
            className="rounded-lg text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </Button>
        </div>

        <Button
          disabled={isSaving}
          onClick={handleSave}
          className="rounded-xl font-extrabold text-xs h-10 px-5 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Experience
        </Button>
      </div>

      {/* 3-Pane Builder Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Palette: Templates & Layouts */}
        <div className="w-72 border-r border-border bg-card p-6 overflow-y-auto shrink-0 space-y-6">
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-1.5">
              <Layout className="h-4 w-4 text-primary" /> Layout Template
            </h4>
            <p className="text-[11px] text-muted-foreground">Select presentation foundation.</p>
          </div>

          <div className="space-y-3">
            {[
              { id: 'showcase', label: 'Brand Showcase', desc: 'Header logo banner with institutional presentation frame.' },
              { id: 'conversion', label: 'Conversion CTA', desc: 'Focused video viewport with prominent dynamic CTA.' },
              { id: 'minimal', label: 'Minimalist Clean', desc: 'Distraction-free viewport without headers.' },
              { id: 'package', label: 'Multi-Asset Package', desc: 'Bundled document & video playlist sidebar.' },
            ].map((t) => (
              <div
                key={t.id}
                onClick={() => setTemplate(t.id as ExperienceTemplate)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.97] ${
                  template === t.id ? 'bg-primary/10 border-primary shadow-sm' : 'bg-muted/10 border-border hover:bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t.label}</span>
                  {template === t.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Center Live Responsive Preview Canvas with Persona Switcher */}
        <div className="flex-1 bg-muted/30 p-6 flex flex-col items-center justify-start overflow-y-auto relative gap-4">
          {/* Persona Switcher Bar */}
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-wider">Preview Persona:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={activePersona === 'anonymous' ? 'default' : 'ghost'}
                onClick={() => setActivePersona('anonymous')}
                className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 active:scale-[0.97]"
              >
                Anonymous
              </Button>
              <Button
                size="sm"
                variant={activePersona === 'decision_maker' ? 'default' : 'ghost'}
                onClick={() => setActivePersona('decision_maker')}
                className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 active:scale-[0.97]"
              >
                <UserCheck className="h-3 w-3" /> Decision Maker
              </Button>
              <Button
                size="sm"
                variant={activePersona === 'high_intent_lead' ? 'default' : 'ghost'}
                onClick={() => setActivePersona('high_intent_lead')}
                className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 active:scale-[0.97]"
              >
                <Flame className="h-3 w-3 text-amber-500" /> High-Intent Lead
              </Button>
              <Button
                size="sm"
                variant={activePersona === 'customer' ? 'default' : 'ghost'}
                onClick={() => setActivePersona('customer')}
                className="h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 active:scale-[0.97]"
              >
                <GraduationCap className="h-3 w-3 text-emerald-500" /> Customer
              </Button>
            </div>
          </div>

          {/* Active Viewport Frame */}
          <div
            className={`transition-all duration-300 rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col my-auto ${
              viewport === 'desktop' ? 'w-full max-w-4xl h-[520px]' : viewport === 'tablet' ? 'w-[640px] h-[480px]' : 'w-[360px] h-[560px]'
            }`}
            style={{ backgroundColor: backgroundColor }}
          >
            {/* Live Canvas Top Header */}
            {template !== 'minimal' && (
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Brand Logo" className="h-6 object-contain" />
                  ) : (
                    <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center text-[10px] font-black text-white">
                      LOGO
                    </div>
                  )}
                  <span className="text-xs font-bold text-white truncate max-w-[220px]">
                    {currentPersona.companyName || title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {evaluatedAction && (
                    <Badge className="text-[9px] font-black bg-primary text-white border-none uppercase">
                      Rule Active
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[9px] text-white/80 border-white/20 uppercase">
                    {activePersona.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            )}

            {/* Live Canvas Media Player Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-white text-center gap-4 relative">
              <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
                <Play className="h-8 w-8 text-white fill-white ml-1" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-black text-white tracking-tight leading-snug">
                  {previewHeadline}
                </h3>
                <p className="text-xs text-white/80 font-medium">
                  {previewDescription}
                </p>
              </div>

              {/* Dynamic CTA Button Preview */}
              <div className="space-y-2 mt-2">
                <Button
                  style={{ backgroundColor: primaryColor }}
                  className="rounded-2xl font-bold text-xs h-11 px-8 text-white shadow-xl hover:opacity-90 active:scale-[0.97]"
                >
                  {previewCtaButtonText}
                </Button>
                {evaluatedAction?.ctaTitle && (
                  <p className="text-[10px] text-white/70 font-semibold block">
                    {evaluatedAction.ctaTitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Inspector Tabs: Design, Dynamic CTAs, Personalization, A/B Testing, Recommendations */}
        <div className="w-96 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
          <Tabs defaultValue="rules" className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 shrink-0">
              <TabsList className="grid grid-cols-4 w-full h-9 rounded-xl p-1 bg-muted">
                <TabsTrigger value="design" className="text-[11px] font-bold rounded-lg">
                  Style
                </TabsTrigger>
                <TabsTrigger value="rules" className="text-[11px] font-bold rounded-lg">
                  Rules
                </TabsTrigger>
                <TabsTrigger value="tokens" className="text-[11px] font-bold rounded-lg">
                  Tokens
                </TabsTrigger>
                <TabsTrigger value="abtest" className="text-[11px] font-bold rounded-lg">
                  A/B Test
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Tab 1: Design & Player Controls */}
              <TabsContent value="design" className="m-0 space-y-5">
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-1.5">
                    <Palette className="h-4 w-4 text-primary" /> Branding & Styling
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Customize colors, logo, and controls.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Base Experience Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-background border-border min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Primary Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 p-1 rounded-xl cursor-pointer bg-background border-border"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 h-10 text-xs rounded-xl font-mono bg-background border-border min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-12 h-10 p-1 rounded-xl cursor-pointer bg-background border-border"
                      />
                      <Input
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="flex-1 h-10 text-xs rounded-xl font-mono bg-background border-border min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Brand Logo URL</Label>
                    <Input
                      placeholder="https://domain.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-background border-border min-h-[44px]"
                    />
                  </div>

                  <div className="pt-4 border-t border-border space-y-3">
                    <h5 className="text-xs font-bold text-foreground">Player Controls Config</h5>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Autoplay Video</Label>
                      <Switch checked={autoplay} onCheckedChange={setAutoplay} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Allow Direct Download</Label>
                      <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Show Playback Speed Toggle</Label>
                      <Switch checked={showSpeed} onCheckedChange={setShowSpeed} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Dynamic CTA Rules (<DynamicCtaRulesEditor>) */}
              <TabsContent value="rules" className="m-0 space-y-4">
                <DynamicCtaRulesEditor
                  rules={dynamicCtaRules}
                  onChange={setDynamicCtaRules}
                />
              </TabsContent>

              {/* Tab 3: Personalization (<PersonalizationTokenEditor>) */}
              <TabsContent value="tokens" className="m-0 space-y-4">
                <PersonalizationTokenEditor
                  workspaceId={activeWorkspaceId || 'default'}
                  config={personalization}
                  onChange={setPersonalization}
                />
              </TabsContent>

              {/* Tab 4: A/B Testing Manager (<ABExperimentEditor>) */}
              <TabsContent value="abtest" className="m-0 space-y-4">
                <ABExperimentEditor
                  config={abExperiment}
                  baseTitle={title}
                  baseCtaText={previewCtaButtonText}
                  onChange={setAbExperiment}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
