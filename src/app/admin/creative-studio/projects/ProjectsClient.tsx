'use client';

/**
 * ARCHITECTURE:
 * Creative Projects Hub & Gallery Client (Creative Studio 2.0 - Phase 1)
 * 
 * Provides filterable gallery of all workspace creative projects across formats,
 * statuses, and campaigns with instant search and project management actions.
 * 
 * CAUTION:
 * Mobile responsive layout with min-h-[44px] touch targets.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { CreativeProject, CreativeProjectType } from '@/lib/creative/creative-types';
import { FORMAT_PRESETS } from '@/lib/creative/creative-types';
import { createCreativeProjectAction, deleteCreativeProjectAction } from '@/app/actions/creative-project-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Layers,
  Video,
  Instagram,
  Megaphone,
  Mail,
  Trash2,
  Edit3,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ProjectsClient() {
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);

  const projectsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'creative_projects'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: projects, isLoading } = useCollection<CreativeProject>(projectsQuery);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      const matchSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.campaignName && p.campaignName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = selectedType === 'all' || p.type === selectedType;
      return matchSearch && matchType;
    });
  }, [projects, searchTerm, selectedType]);

  const handleCreateNew = async (type: CreativeProjectType) => {
    if (!activeWorkspaceId) {
      toast({ title: 'Workspace required', description: 'Please select an active workspace first.' });
      return;
    }

    setIsCreating(true);
    const format = FORMAT_PRESETS[type];
    const res = await createCreativeProjectAction({
      workspaceId: activeWorkspaceId,
      name: `Untitled ${format.label.split(' ')[0]} Project`,
      type,
    });

    setIsCreating(false);

    if (res.success && res.data) {
      toast({ title: 'Project Created', description: `Opened ${res.data.project.name}` });
      router.push(`/admin/creative-studio/projects/${res.data.project.id}`);
    } else {
      toast({ title: 'Creation failed', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeWorkspaceId) return;

    if (!confirm('Are you sure you want to delete this creative project?')) return;

    const res = await deleteCreativeProjectAction(projectId, activeWorkspaceId);
    if (res.success) {
      toast({ title: 'Project Deleted', description: 'The project and its documents were removed.' });
    } else {
      toast({ title: 'Delete Failed', description: res.error, variant: 'destructive' });
    }
  };

  const TYPE_TABS = [
    { id: 'all', label: 'All Formats' },
    { id: 'youtube_thumbnail', label: 'YouTube Covers' },
    { id: 'social', label: 'Social Square' },
    { id: 'ad', label: 'Ads' },
    { id: 'email', label: 'Email' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Creative Projects</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">
            Manage, edit, and organize all visual assets and campaign creative projects.
          </p>
        </div>

        {/* Create Project Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isCreating}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] font-black text-slate-950 rounded-xl text-xs h-10 px-5 shadow-lg shadow-emerald-500/20 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-200 rounded-xl p-1 shadow-2xl">
            <DropdownMenuItem
              onClick={() => handleCreateNew('youtube_thumbnail')}
              className="cursor-pointer font-bold text-xs p-2.5 rounded-lg hover:bg-slate-800 flex items-center gap-2"
            >
              <Video className="w-4 h-4 text-rose-400" /> YouTube Cover (16:9)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreateNew('social')}
              className="cursor-pointer font-bold text-xs p-2.5 rounded-lg hover:bg-slate-800 flex items-center gap-2"
            >
              <Instagram className="w-4 h-4 text-pink-400" /> Social Square (1:1)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreateNew('ad')}
              className="cursor-pointer font-bold text-xs p-2.5 rounded-lg hover:bg-slate-800 flex items-center gap-2"
            >
              <Megaphone className="w-4 h-4 text-amber-400" /> Ad Banner (1200×628)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCreateNew('email')}
              className="cursor-pointer font-bold text-xs p-2.5 rounded-lg hover:bg-slate-800 flex items-center gap-2"
            >
              <Mail className="w-4 h-4 text-emerald-400" /> Email Graphic (600×300)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Type Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all min-h-[36px] active:scale-[0.97]',
                selectedType === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects..."
            className="pl-10 h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-video rounded-2xl bg-slate-900 animate-pulse border border-slate-850" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 border border-slate-850 rounded-3xl bg-slate-900/20 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Layers className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-200">No Projects Found</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search or format filters, or create a new project above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => (
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

                <button
                  onClick={(e) => handleDelete(e, proj.id)}
                  title="Delete Project"
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors opacity-0 group-hover:opacity-100 min-h-[32px] min-w-[32px] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
    </div>
  );
}
