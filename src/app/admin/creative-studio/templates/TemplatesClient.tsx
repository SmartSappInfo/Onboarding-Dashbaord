'use client';

/**
 * ARCHITECTURE:
 * Template Marketplace Catalog Client (Phase 5 - Templates & Brand Intelligence)
 * 
 * Interactive template hub featuring category filtering, live search, visual canvas previews,
 * baseline health score badges, and one-click project instantiation from templates.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-templates.test.ts
 */

import * as React from 'react';
import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CreativeTemplate } from '@/lib/creative/creative-types';
import { createProjectFromTemplateAction } from '@/app/actions/creative-template-actions';
import ThumbnailCanvas from '@/components/shared/thumbnail-designer/ThumbnailCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Search,
  Layout,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplatesClientProps {
  initialTemplates: CreativeTemplate[];
  workspaceId: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'education', label: '🎓 Education & Courses' },
  { id: 'podcast', label: '🎙️ Podcasts & Shows' },
  { id: 'finance', label: '📈 Finance & Markets' },
  { id: 'business', label: '💼 B2B SaaS & Tech' },
  { id: 'social', label: '📱 Social & Reels' },
];

export function TemplatesClient({
  initialTemplates,
  workspaceId,
}: TemplatesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [templates] = useState<CreativeTemplate[]>(initialTemplates);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [activeInstantiatingId, setActiveInstantiatingId] = useState<string | null>(null);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tmpl) => {
      const matchCategory =
        selectedCategory === 'all' || tmpl.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleUseTemplate = (tmpl: CreativeTemplate) => {
    setActiveInstantiatingId(tmpl.id);
    startTransition(async () => {
      const res = await createProjectFromTemplateAction(tmpl.id, workspaceId, tmpl.name);
      if (res.success && res.data) {
        toast({
          title: 'Template Instantiated',
          description: `Created new project from "${tmpl.name}".`,
        });
        router.push(`/admin/creative-studio/projects/${res.data.projectId}`);
      } else {
        toast({
          title: 'Instantiation Error',
          description: res.error || 'Failed to instantiate template.',
          variant: 'destructive',
        });
        setActiveInstantiatingId(null);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/creative-studio/projects"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layout className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white">Template Marketplace</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Browse pre-validated, high-CTR templates across education, podcasting, finance, and B2B SaaS.
          </p>
        </div>

        {/* Subsurface Navigation Links */}
        <div className="flex items-center gap-2">
          <Link href="/admin/creative-studio/brand">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs font-bold bg-slate-900 border-slate-800 text-slate-300 hover:text-white rounded-xl active:scale-[0.97]"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Brand Studio
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-[0.97]',
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 h-9 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-slate-850 bg-slate-900/20 space-y-3">
          <div className="text-sm font-bold text-slate-300">No templates found</div>
          <p className="text-xs text-slate-500">Try adjusting your search query or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((tmpl) => {
            const isInstantiating = activeInstantiatingId === tmpl.id;

            return (
              <div
                key={tmpl.id}
                className="p-4 rounded-3xl border border-slate-850 hover:border-slate-700 bg-slate-900/60 transition-all flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl hover:scale-[1.01]"
              >
                {/* Top Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                      {tmpl.category}
                    </span>
                    <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {tmpl.baselineHealthScore}/100 Health
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-white">{tmpl.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mt-1">
                      {tmpl.description}
                    </p>
                  </div>
                </div>

                {/* Live Canvas Preview */}
                <div className="aspect-video w-full rounded-2xl overflow-hidden relative shadow-lg bg-slate-950 border border-slate-800/80">
                  <ThumbnailCanvas
                    backgroundColor={tmpl.backgroundColor}
                    backgroundGradient={tmpl.backgroundGradient}
                    backgroundImage={tmpl.backgroundImage}
                    elements={tmpl.elements}
                    selectedId={null}
                    onSelectElement={() => {}}
                    onUpdateElement={() => {}}
                    onDeleteElement={() => {}}
                    zoomPercent={100}
                    panX={0}
                    panY={0}
                    onPanChange={() => {}}
                  />
                </div>

                {/* Footer Action */}
                <div className="pt-2">
                  <Button
                    onClick={() => handleUseTemplate(tmpl)}
                    disabled={isPending}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black text-xs h-10 rounded-xl shadow-lg shadow-emerald-500/10 min-h-[40px]"
                  >
                    {isInstantiating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Instantiating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Use Template <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
