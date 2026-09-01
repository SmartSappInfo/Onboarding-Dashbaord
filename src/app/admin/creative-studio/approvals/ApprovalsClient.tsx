'use client';

/**
 * ARCHITECTURE:
 * Creative Studio Approval Center Client (Phase 7 - Real-Time Collaboration)
 * 
 * Pipeline board managing designs in editorial review, change requests, and final sign-offs.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CreativeProject } from '@/lib/creative/creative-types';
import {
  approveCreativeProjectAction,
  requestProjectChangesAction,
} from '@/app/actions/creative-collab-actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalsClientProps {
  initialProjects: CreativeProject[];
}

export function ApprovalsClient({ initialProjects }: ApprovalsClientProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<CreativeProject[]>(initialProjects);
  const [activeTab, setActiveTab] = useState<'all' | 'in_review' | 'changes_requested' | 'approved'>('all');

  const filteredProjects = useMemo(() => {
    if (activeTab === 'all') return projects;
    return projects.filter((p) => p.status === activeTab);
  }, [projects, activeTab]);

  const handleQuickApprove = async (projectId: string) => {
    const res = await approveCreativeProjectAction(
      projectId,
      'Art Director',
      'director@smartsapp.com',
      'One-click approval from Approval Center.'
    );
    if (res.success && res.data) {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? res.data! : p)));
      toast({ title: 'Approved', description: 'Creative marked as approved for publishing.' });
    }
  };

  const handleQuickRequestChanges = async (projectId: string) => {
    const res = await requestProjectChangesAction(
      projectId,
      'Art Director',
      'director@smartsapp.com',
      'Please review contrast and adjust safe zones.'
    );
    if (res.success && res.data) {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? res.data! : p)));
      toast({ title: 'Changes Requested', description: 'Revision notice sent to author.' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header */}
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
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white">Approval Center</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Review submitted designs, manage change requests, and provide sign-offs before multi-platform publication.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
          {(['all', 'in_review', 'changes_requested', 'approved'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all active:scale-[0.97]',
                activeTab === tab
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Pipeline Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-slate-850 bg-slate-900/20 space-y-3">
          <div className="text-sm font-bold text-slate-300">No creative projects in this view</div>
          <p className="text-xs text-slate-500">All submissions have been reviewed or no designs match the filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="p-5 rounded-3xl border border-slate-850 bg-slate-900/60 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 uppercase">
                    {project.type.replace('_', ' ')}
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center gap-1',
                      project.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : project.status === 'in_review'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : project.status === 'changes_requested'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    )}
                  >
                    {project.status === 'approved' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : project.status === 'in_review' ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {project.status?.replace('_', ' ') || 'draft'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white">{project.name}</h3>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
                <Link href={`/admin/creative-studio/projects/${project.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold border-slate-800 bg-slate-950 text-slate-200 hover:text-white rounded-xl"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Open Canvas
                  </Button>
                </Link>

                <div className="flex items-center gap-1.5">
                  {project.status !== 'approved' && (
                    <Button
                      onClick={() => handleQuickApprove(project.id)}
                      size="sm"
                      className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-slate-950 rounded-xl active:scale-[0.97]"
                    >
                      Approve
                    </Button>
                  )}
                  {project.status === 'in_review' && (
                    <Button
                      onClick={() => handleQuickRequestChanges(project.id)}
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs font-bold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-xl"
                    >
                      Changes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
