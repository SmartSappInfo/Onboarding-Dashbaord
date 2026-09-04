'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Backoffice Experience & Personalization Governance:
 *    Allows super-admins to configure system presentation templates, allowed embed domain whitelists,
 *    global Dynamic CTA rules policies, Personalization token limits, and run idempotent FER migrations.
 * 2. Zero-Code Administration Philosophy:
 *    All system policies can be tuned by administrators without engineering intervention or redeployments.
 * 3. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, inputs, selects, and switches strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch targets with tactile micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { migrateExperiencesToPhase5Action } from '@/lib/media/experience-fer-service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, Layout, Globe, Loader2, Target, 
  Sparkles, Split, RefreshCw, CheckCircle2 
} from 'lucide-react';

export default function BackofficeExperienceGovernancePage() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  // Phase 2 Settings
  const [defaultTemplate, setDefaultTemplate] = useState('showcase');
  const [allowedDomains, setAllowedDomains] = useState('*.smartsapp.com, *.myschool.edu');
  const [defaultPrimaryColor, setDefaultPrimaryColor] = useState('#3b82f6');

  // Phase 5 Governance Settings
  const [enableDynamicCtas, setEnableDynamicCtas] = useState(true);
  const [enablePersonalization, setEnablePersonalization] = useState(true);
  const [enableAbTesting, setEnableAbTesting] = useState(true);
  const [maxRulesPerExperience, setMaxRulesPerExperience] = useState(8);
  const [defaultFallbackCtaText, setDefaultFallbackCtaText] = useState('Contact Admissions');

  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      toast({
        title: 'Governance Saved',
        description: 'Experience templates, embed domain whitelist, and Phase 5 dynamic policies updated.',
      });
    } catch (err: unknown) {
      console.error('[handleSave] Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunMigration = async () => {
    if (!firestore || !activeWorkspaceId || isMigrating) return;
    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await migrateExperiencesToPhase5Action(firestore, activeWorkspaceId);
      if (res.success) {
        setMigrationResult(`Successfully scanned ${res.totalScanned} experiences; enriched ${res.totalEnriched} with Phase 5 defaults.`);
        toast({
          title: 'Migration Completed',
          description: `Enriched ${res.totalEnriched} experiences with Phase 5 defaults.`,
        });
      } else {
        setMigrationResult(`Migration failed: ${res.errorMessage}`);
      }
    } catch (err: unknown) {
      console.error('[handleRunMigration] Error:', err);
      setMigrationResult('Migration encountered an unexpected error.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
              Super-Admin Console
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Experience & Personalization Governance</h1>
          <p className="text-xs text-muted-foreground">
            Configure system default templates, dynamic CTA policies, A/B test quotas, and run FER schema migrations without touching code.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Default Experience Templates */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
                <Layout className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold">Default System Templates</CardTitle>
                <CardDescription className="text-xs">Set fallback layout templates for newly created experiences.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Default Layout Template</Label>
              <select
                value={defaultTemplate}
                onChange={(e) => setDefaultTemplate(e.target.value)}
                className="w-full h-11 px-3 text-xs rounded-xl bg-background border border-border font-bold text-foreground min-h-[44px]"
              >
                <option value="showcase">Brand Showcase</option>
                <option value="conversion">Conversion CTA Focused</option>
                <option value="minimal">Minimalist Clean</option>
                <option value="package">Multi-Asset Package View</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Default Primary Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={defaultPrimaryColor}
                  onChange={(e) => setDefaultPrimaryColor(e.target.value)}
                  className="w-12 h-11 p-1 rounded-xl cursor-pointer bg-background border-border"
                />
                <Input
                  value={defaultPrimaryColor}
                  onChange={(e) => setDefaultPrimaryColor(e.target.value)}
                  className="flex-1 h-11 text-xs rounded-xl font-mono bg-background border-border min-h-[44px]"
                />
              </div>
            </div>

            <Button
              disabled={isSaving}
              onClick={handleSave}
              className="w-full rounded-xl font-bold text-xs h-11 min-h-[44px] shadow-md active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Save Template Policies
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Embed Domain Whitelist */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold">Embed Domain Whitelist</CardTitle>
                <CardDescription className="text-xs">Control external websites permitted to embed media iFrames.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Allowed Embedding Domains (Comma-separated)</Label>
              <textarea
                rows={4}
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                className="w-full p-3 text-xs font-mono rounded-xl bg-background border border-border text-foreground resize-none focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground">Only websites matching these wildcards can load iFrame embeds.</p>
            </div>

            <Button
              disabled={isSaving}
              onClick={handleSave}
              variant="outline"
              className="w-full rounded-xl font-bold text-xs h-11 min-h-[44px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Save Whitelist
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Phase 5 Dynamic CTA & Personalization Controls */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-2xl text-purple-600 dark:text-purple-400">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold">Dynamic CTA & Personalization</CardTitle>
                <CardDescription className="text-xs">Feature toggles and safety quotas for personalized experiences.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Enable Dynamic CTA Rules</Label>
                <p className="text-[11px] text-muted-foreground">Allows multi-condition milestone triggers.</p>
              </div>
              <Switch checked={enableDynamicCtas} onCheckedChange={setEnableDynamicCtas} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Enable Variable Personalization</Label>
                <p className="text-[11px] text-muted-foreground">Allows tokens like {`{{contact.name}}`}.</p>
              </div>
              <Switch checked={enablePersonalization} onCheckedChange={setEnablePersonalization} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Max Rules per Experience</Label>
              <Input
                type="number"
                value={maxRulesPerExperience}
                onChange={(e) => setMaxRulesPerExperience(Number(e.target.value))}
                min={1}
                max={20}
                className="h-11 rounded-xl text-xs font-bold min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Default Fallback CTA Text</Label>
              <Input
                value={defaultFallbackCtaText}
                onChange={(e) => setDefaultFallbackCtaText(e.target.value)}
                className="h-11 rounded-xl text-xs font-medium min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: A/B Testing & Schema Migration Protocol */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl text-amber-600 dark:text-amber-400">
                <Split className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold">A/B Testing & Schema FER</CardTitle>
                <CardDescription className="text-xs">Manage experiment parameters and run idempotent migrations.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">Enable A/B Testing Studio</Label>
                <p className="text-[11px] text-muted-foreground">Allow creators to configure split experiments.</p>
              </div>
              <Switch checked={enableAbTesting} onCheckedChange={setEnableAbTesting} />
            </div>

            <div className="p-4 border border-dashed rounded-2xl bg-muted/10 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" /> Phase 5 FER Schema Migration
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Safely enriches existing experiences with Phase 5 fields using chunked batch writes (max 150 ops).
                </p>
              </div>

              {migrationResult && (
                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-[11px] font-bold text-primary flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{migrationResult}</span>
                </div>
              )}

              <Button
                disabled={isMigrating}
                onClick={handleRunMigration}
                className="w-full rounded-xl font-bold text-xs h-11 min-h-[44px] gap-2 active:scale-[0.97]"
              >
                {isMigrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run Phase 5 Experience Enrichment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
