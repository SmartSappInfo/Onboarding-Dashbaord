'use client';

/**
 * ARCHITECTURE:
 * Backoffice Management Console for Creative Studio 2.0 (Phase 1)
 * 
 * Provides Superadmins with no-code governance tools to seed global blueprints,
 * execute Fetch-Enrich-Restore (FER) migrations, and monitor AI quotas.
 * 
 * CAUTION:
 * Superadmin access only.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { CreativeTemplate } from '@/lib/creative/creative-types';
import { seedGlobalCreativeBlueprintsAction } from '@/lib/creative/seed-creative-blueprints';
import { migrateLegacyThumbnailsFERAction } from '@/lib/creative/migrate-creative-fer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Database,
  Zap,
  RefreshCw,
  Layers,
  Sparkles,
  CheckCircle2,
  Loader2,
  Globe,
  FlaskConical,
  BarChart3,
  Download,
} from 'lucide-react';

export function BackofficeCreativeClient() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSeeding, setIsSeeding] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStats, setMigrationStats] = useState<{
    totalFetched: number;
    migratedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  // Global Templates Query
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'creative_templates'), where('scope', '==', 'global'));
  }, [firestore]);

  const { data: globalTemplates, isLoading: isTemplatesLoading } = useCollection<CreativeTemplate>(templatesQuery);

  const handleSeedBlueprints = async () => {
    setIsSeeding(true);
    const res = await seedGlobalCreativeBlueprintsAction();
    setIsSeeding(false);

    if (res.success) {
      toast({ title: 'Blueprints Seeded', description: res.message });
    } else {
      toast({ title: 'Seeding Failed', description: res.message, variant: 'destructive' });
    }
  };

  const handleRunFERMigration = async () => {
    setIsMigrating(true);
    const res = await migrateLegacyThumbnailsFERAction();
    setIsMigrating(false);

    if (res.success) {
      setMigrationStats(res);
      toast({
        title: 'FER Migration Finished',
        description: `Successfully migrated ${res.migratedCount} of ${res.totalFetched} legacy thumbnails.`,
      });
    } else {
      toast({ title: 'Migration Failed', description: 'Encountered migration error.', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" /> Superadmin Governance
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Creative Studio Backoffice</h1>
        <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">
          Seed global blueprint formulas, execute legacy FER migrations, and monitor AI routing.
        </p>
      </div>

      {/* Primary Operation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seed Blueprints Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Seed Global Blueprints</h2>
              <p className="text-[11px] text-slate-400 font-medium">Standardized YouTube, Social & Ad templates</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Seeds standard global formulas with verified high-CTR visual layouts into the `creative_templates` collection.
          </p>

          <Button
            onClick={handleSeedBlueprints}
            disabled={isSeeding}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black rounded-xl text-xs h-10 min-h-[44px]"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Zap className="w-4 h-4 mr-1.5" />}
            Seed Global Templates (1-Click)
          </Button>
        </div>

        {/* FER Migration Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Legacy FER Migration</h2>
              <p className="text-[11px] text-slate-400 font-medium">Fetch-Enrich-Restore Thumbnail Designs</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Migrates legacy `thumbnail_designs` records to `creative_projects` and `creative_documents` without data loss.
          </p>

          <Button
            onClick={handleRunFERMigration}
            disabled={isMigrating}
            variant="outline"
            className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-[0.97] font-black rounded-xl text-xs h-10 min-h-[44px]"
          >
            {isMigrating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Run FER Migration Pipeline
          </Button>
        </div>

        {/* Canvas Engine & Snapping Calibration Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Canvas Snapping & Guides</h2>
              <p className="text-[11px] text-slate-400 font-medium">Precision alignment tolerances</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure magnetic snapping distance thresholds and dynamic equidistant spacing guide sensitivity.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <div className="text-xs font-bold text-white">Tight (4px)</div>
              <div className="text-[10px] text-slate-500">Fine control</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-xl border border-emerald-500/40 text-center shadow-sm">
              <div className="text-xs font-bold text-emerald-400">Standard (8px)</div>
              <div className="text-[10px] text-emerald-500/80">Active Default</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <div className="text-xs font-bold text-white">Magnetic (12px)</div>
              <div className="text-[10px] text-slate-500">Strong snap</div>
            </div>
          </div>
        </div>

        {/* Frame Shapes Registry Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Clipping Frame Presets</h2>
              <p className="text-[11px] text-slate-400 font-medium">Shape masks for images and avatars</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 flex items-center justify-between">
              <span>Circle Avatar</span>
              <span className="text-[10px] text-emerald-400 uppercase">Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 flex items-center justify-between">
              <span>Squircle Frame</span>
              <span className="text-[10px] text-emerald-400 uppercase">Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 flex items-center justify-between">
              <span>Phone Mockup</span>
              <span className="text-[10px] text-emerald-400 uppercase">Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 flex items-center justify-between">
              <span>Rounded Pill</span>
              <span className="text-[10px] text-emerald-400 uppercase">Active</span>
            </div>
          </div>
        </div>

        {/* AI Creative Director Model Routing Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Director Routing</h2>
              <p className="text-[11px] text-slate-400 font-medium">Model architecture and fallbacks</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Active LLM routing gateway for multi-concept generation, canvas NLP commands, and copy variation formulas.
          </p>

          <div className="space-y-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between">
              <div>
                <div className="text-emerald-400">Gemini 2.5 Flash</div>
                <div className="text-[10px] text-slate-500 font-normal">Primary Gateway (Fast Latency)</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-mono">
                Primary
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-400">
              <div>
                <div>Gemini 1.5 Pro / GPT-4o</div>
                <div className="text-[10px] text-slate-600 font-normal">Deep Reasoning & Visual Audit</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-500 uppercase font-mono">
                Standby
              </span>
            </div>
          </div>
        </div>

        {/* AI System Prompt Templates Card */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">System Prompt Templates</h2>
              <p className="text-[11px] text-slate-400 font-medium">No-code AI behavior fine-tuning</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div>Concept Generator</div>
              <div className="text-[10px] text-emerald-400 mt-1">v3.2 Production</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div>Canvas NLP Parser</div>
              <div className="text-[10px] text-emerald-400 mt-1">v2.4 Production</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div>Copy Matrix Formula</div>
              <div className="text-[10px] text-emerald-400 mt-1">v1.8 Production</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div>Visual Health Linter</div>
              <div className="text-[10px] text-emerald-400 mt-1">v2.0 Production</div>
            </div>
          </div>
        </div>

        {/* Creative Health Standards & Quality Gates Card (Phase 4) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Health Standards & Quality Gates</h2>
              <p className="text-[11px] text-slate-400 font-medium">Publishing compliance & WCAG gates</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure automated quality gates required before publishing creative documents directly to external channels.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Minimum Passing Score</span>
                <span className="text-emerald-400 font-mono">80 / 100</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Strict Publishing Gate</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span>WCAG Contrast Gate</span>
                <span className="text-cyan-400 font-mono">AA (4.5:1)</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Automated Stroke Fallback</div>
            </div>
          </div>
        </div>

        {/* Template Marketplace & Blueprints Hub (Phase 5) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Template Marketplace Blueprints</h2>
              <p className="text-[11px] text-slate-400 font-medium">Global catalog management & seeding</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Seed 6 high-converting starter blueprints (Education, Podcast, Finance, B2B SaaS) into the global template catalog.
          </p>

          <div className="pt-1">
            <Button
              onClick={handleSeedBlueprints}
              disabled={isSeeding}
              className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-slate-950 font-black text-xs h-10 rounded-xl"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Seeding Global Blueprints...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Seed Global Blueprints
                </>
              )}
            </Button>
          </div>
        </div>

        {/* CRM Attribution & Programmatic Batch Limits Hub (Phase 6) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">CRM Creative Attribution & Batch Limits</h2>
              <p className="text-[11px] text-slate-400 font-medium">Pipeline revenue tracking & rate limits</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure multi-touch conversion attribution models and maximum contact batch processing limits.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Attribution Model</span>
                <span className="text-cyan-400 font-mono">First-Touch</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Pipeline Lead Attribution</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Batch Limit</span>
                <span className="text-emerald-400 font-mono">100 / run</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Chunked Concurrency (10x)</div>
            </div>
          </div>
        </div>

        {/* Editorial Approval Gates & Review Roles Hub (Phase 7) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Editorial Approval Gates & Review Roles</h2>
              <p className="text-[11px] text-slate-400 font-medium">Pre-publishing review & sign-off policy</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Require formal art director approval before publishing and configure review turnaround SLA targets.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Mandatory Gate</span>
                <span className="text-amber-400 font-mono">Enforced</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Blocks Unapproved Publishing</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Review SLA</span>
                <span className="text-emerald-400 font-mono">24 Hours</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Turnaround Target</div>
            </div>
          </div>
        </div>

        {/* Multi-Channel Publishing & Distribution Hub (Phase 8) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Multi-Channel Publishing & Rate Limits</h2>
              <p className="text-[11px] text-slate-400 font-medium">Platform channel enablement & hourly caps</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure external channel adapters (YouTube, Facebook, Instagram, LinkedIn) and hourly API publication quotas.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-blue-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Channel Adapters</span>
                <span className="text-blue-400 font-mono">5 Active</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">YouTube, FB, IG, LI, CRM</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Hourly Limit</span>
                <span className="text-emerald-400 font-mono">50 / hour</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Rate Limit Protection</div>
            </div>
          </div>
        </div>

        {/* Experimentation & Statistical Significance Hub (Phase 9) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">A/B Testing & Statistical Rigor</h2>
              <p className="text-[11px] text-slate-400 font-medium">Confidence thresholds & sample size policy</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure two-proportion z-test confidence requirements ($p &lt; 0.05$) and minimum sample size gates.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Confidence Target</span>
                <span className="text-emerald-400 font-mono">95% (p&lt;0.05)</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">Statistical Threshold</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Min Sample Size</span>
                <span className="text-emerald-400 font-mono">500 / variant</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">False Positive Barrier</div>
            </div>
          </div>
        </div>

        {/* Performance Intelligence & Export Warehouse Hub (Phase 10) */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Performance Attribution & Export Warehouse</h2>
              <p className="text-[11px] text-slate-400 font-medium">Attribution window lookback & export resolution</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Configure CRM pipeline attribution windows and ultra-high resolution production export limits.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-slate-200">
              <div className="flex justify-between items-center">
                <span>Attribution Window</span>
                <span className="text-emerald-400 font-mono">30 Days</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">CRM Pipeline Lookback</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1"><Download className="w-3 h-3 text-blue-400" /> Max Export</span>
                <span className="text-blue-400 font-mono">4× Ultra-HD</span>
              </div>
              <div className="text-[10px] text-slate-500 font-normal mt-0.5">300 DPI Print Quality</div>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Report */}
      {migrationStats && (
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Migration Audit Report
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-lg font-black text-white">{migrationStats.totalFetched}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Fetched</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-lg font-black text-emerald-400">{migrationStats.migratedCount}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Migrated</div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-lg font-black text-slate-400">{migrationStats.skippedCount}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Skipped</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Global Blueprints List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Active Global Templates</h2>
          <span className="text-xs font-bold text-slate-400">{globalTemplates?.length || 0} Registered</span>
        </div>

        {isTemplatesLoading ? (
          <div className="text-xs text-slate-500">Loading templates...</div>
        ) : !globalTemplates || globalTemplates.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/20 border border-slate-800 text-center text-xs text-slate-400">
            No global templates registered. Click &quot;Seed Global Blueprints&quot; above to populate the database.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {globalTemplates.map((t) => (
              <div key={t.id} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
                <div className="font-bold text-xs text-white">{t.name}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2">{t.description}</div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-bold">
                  <span className="text-emerald-400">Score: {t.baselineHealthScore}/100</span>
                  <span className="text-slate-500 uppercase">{t.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
