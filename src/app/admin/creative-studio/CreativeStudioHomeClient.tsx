'use client';

/**
 * ARCHITECTURE:
 * Creative Studio Home Client Dashboard (Creative Studio 2.0 - Phase 1)
 * 
 * Command centre for creators and marketing teams with Quick Create presets,
 * recent projects, live attention health statistics, and direct AI initiation.
 * 
 * CAUTION:
 * Mobile responsive layout with min-h-[44px] touch targets.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { CreativeProject, CreativeProjectType } from '@/lib/creative/creative-types';
import { FORMAT_PRESETS } from '@/lib/creative/creative-types';
import { createCreativeProjectAction } from '@/app/actions/creative-project-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Plus,
  Wand2,
  Video,
  Instagram,
  Megaphone,
  Mail,
  ArrowRight,
  Clock,
  Layers,
  Edit3,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CreativeStudioHomeClient() {
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [aiPrompt, setAiPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Subscribed to recent projects
  const projectsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'creative_projects'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('updatedAt', 'desc'),
      limit(6)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: recentProjects, isLoading } = useCollection<CreativeProject>(projectsQuery);

  const handleQuickCreate = async (type: CreativeProjectType) => {
    if (!activeWorkspaceId) {
      toast({ title: 'Workspace required', description: 'Please select an active workspace first.' });
      return;
    }

    setIsCreating(true);
    const format = FORMAT_PRESETS[type];
    const res = await createCreativeProjectAction({
      workspaceId: activeWorkspaceId,
      name: `New ${format.label.split(' ')[0]} Creative`,
      type,
    });

    setIsCreating(false);

    if (res.success && res.data) {
      toast({ title: 'Project Created', description: `Opened ${res.data.project.name}` });
      router.push(`/admin/creative-studio/projects/${res.data.project.id}`);
    } else {
      toast({ title: 'Creation failed', description: res.error || 'Could not initialize project.', variant: 'destructive' });
    }
  };

  const handleAiCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    if (!activeWorkspaceId) {
      toast({ title: 'Workspace required', description: 'Please select an active workspace first.' });
      return;
    }

    setIsCreating(true);
    const res = await createCreativeProjectAction({
      workspaceId: activeWorkspaceId,
      name: aiPrompt.trim().substring(0, 40),
      type: 'youtube_thumbnail',
      description: aiPrompt.trim(),
    });

    setIsCreating(false);

    if (res.success && res.data) {
      router.push(`/admin/creative-studio/projects/${res.data.project.id}?prompt=${encodeURIComponent(aiPrompt)}`);
    } else {
      toast({ title: 'AI initiation failed', description: res.error, variant: 'destructive' });
    }
  };

  const QUICK_PRESETS = [
    {
      type: 'youtube_thumbnail' as CreativeProjectType,
      label: 'YouTube Cover',
      sub: '16:9 - 1280×720',
      icon: Video,
      color: 'from-rose-500/20 to-red-600/20 border-red-500/30 text-rose-400',
    },
    {
      type: 'social' as CreativeProjectType,
      label: 'Social Square',
      sub: '1:1 - 1080×1080',
      icon: Instagram,
      color: 'from-fuchsia-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
    },
    {
      type: 'ad' as CreativeProjectType,
      label: 'Ad Banner',
      sub: '1200×628',
      icon: Megaphone,
      color: 'from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-400',
    },
    {
      type: 'email' as CreativeProjectType,
      label: 'Email Graphic',
      sub: '600×300',
      icon: Mail,
      color: 'from-teal-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-10 animate-in fade-in duration-300">
      {/* Hero Banner with AI Direct Prompt */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Creative Command Centre
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Design high-converting creatives with{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              AI Intelligence
            </span>
          </h1>
          <p className="text-sm sm:text-base font-medium text-slate-400 max-w-2xl">
            Produce YouTube covers, social assets, and campaign banners informed by CTR formulas, brand governance, and CRM context.
          </p>

          {/* AI Quick Input Bar */}
          <form onSubmit={handleAiCreate} className="pt-2 flex flex-col sm:flex-row gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Wand2 className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-400" />
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your video topic, headline, or campaign..."
                className="pl-10 h-12 bg-slate-950/80 border-slate-800 text-sm font-semibold text-slate-100 placeholder:text-slate-500 rounded-2xl focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <Button
              type="submit"
              disabled={isCreating || !aiPrompt.trim()}
              className="h-12 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.97] transition-all min-h-[44px]"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate with AI
            </Button>
          </form>
        </div>
      </section>

      {/* Quick Format Creation Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Quick Create</h2>
            <p className="text-xs text-slate-400 font-medium">Select a format blueprint to start designing immediately.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {QUICK_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.type}
                onClick={() => handleQuickCreate(preset.type)}
                disabled={isCreating}
                className={cn(
                  'group text-left p-5 rounded-2xl border bg-gradient-to-b transition-all shadow-md active:scale-[0.97] min-h-[110px] flex flex-col justify-between hover:border-slate-700',
                  preset.color
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <Icon className="w-5 h-5" />
                  </div>
                  <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {preset.label}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">{preset.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Projects Hub */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Recent Projects</h2>
            <p className="text-xs text-slate-400 font-medium">Jump back into your active designs and review drafts.</p>
          </div>
          <Link href="/admin/creative-studio/projects">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl">
              View All Projects <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="aspect-video rounded-2xl bg-slate-900 animate-pulse border border-slate-850" />
            ))}
          </div>
        ) : !recentProjects || recentProjects.length === 0 ? (
          <div className="p-12 border border-slate-850 rounded-3xl bg-slate-900/20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-200">No Creative Projects Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Start by picking a format blueprint above or describing your concept to the AI Creative Director.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {recentProjects.map((proj) => (
              <Link
                key={proj.id}
                href={`/admin/creative-studio/projects/${proj.id}`}
                className="group relative border border-slate-850 bg-slate-900/40 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col shadow-lg hover:shadow-emerald-500/5 active:scale-[0.98]"
              >
                <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-850">
                  {proj.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={proj.thumbnailUrl}
                      alt={proj.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-600 text-xs font-bold gap-1">
                      <Layers className="w-6 h-6 text-slate-700" />
                      <span>Canvas Draft</span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-sm text-[10px] font-bold text-slate-300 border border-slate-800 uppercase tracking-wider">
                    {proj.type.replace('_', ' ')}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-200 group-hover:text-emerald-400 transition-colors truncate" title={proj.name}>
                      {proj.name}
                    </div>
                    {proj.campaignName && (
                      <div className="text-[11px] font-semibold text-emerald-400/80 truncate mt-0.5">
                        Campaign: {proj.campaignName}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Edit <Edit3 className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
