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
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
            No global templates registered. Click "Seed Global Blueprints" above to populate the database.
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
