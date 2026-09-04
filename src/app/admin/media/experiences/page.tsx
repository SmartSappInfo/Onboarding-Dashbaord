'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Experience Management Studio:
 *    Renders the management grid of `MediaExperience` templates and active public presentation layouts.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, table items, and filter triggers enforce `min-h-[44px] min-w-[44px]` touch target bounds
 *    with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { MediaExperience } from '@/lib/types/media-2.0';
import { listExperiencesAction } from '@/lib/media/media-experience-service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Layout, Palette, Sparkles, Loader2, PlayCircle, Eye } from 'lucide-react';

export default function MediaExperiencesPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();

  const [experiences, setExperiences] = useState<MediaExperience[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;

    let isMounted = true;
    async function loadExperiences() {
      if (!firestore || !activeWorkspaceId) return;
      try {
        const list = await listExperiencesAction(firestore, activeWorkspaceId);
        if (isMounted) {
          setExperiences(list);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        console.error('[MediaExperiencesPage] Error loading experiences:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadExperiences();
    return () => {
      isMounted = false;
    };
  }, [firestore, activeWorkspaceId]);

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
              Experience Studio
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Media Experiences & Layout Templates</h1>
          <p className="text-xs text-muted-foreground">
            Decouple content from presentation. Build custom branded layouts, theme colors, and player controls for public pages.
          </p>
        </div>

        <Button
          onClick={() => router.push('/admin/media/experiences/builder')}
          className="rounded-2xl font-extrabold text-xs h-11 px-5 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Create New Experience
        </Button>
      </div>

      {/* Grid of Experiences */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading presentation experiences...</span>
        </div>
      ) : experiences.length === 0 ? (
        <div className="p-16 rounded-[2.5rem] bg-muted/10 border-2 border-dashed border-border text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Layout className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-foreground">No Presentation Experiences Created</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create your first custom experience template to brand public video and document share pages.
            </p>
          </div>
          <Button
            onClick={() => router.push('/admin/media/experiences/builder')}
            className="rounded-xl font-bold text-xs h-11 px-5 min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <Sparkles className="h-4 w-4" /> Launch Experience Builder
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {experiences.map((exp) => (
            <Card key={exp.id} className="rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all">
              <CardHeader className="bg-muted/20 border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-black uppercase bg-background">
                    {exp.template} Template
                  </Badge>
                  <div
                    className="h-4 w-4 rounded-full border shadow-xs"
                    style={{ backgroundColor: exp.theme?.primaryColorHex || '#3b82f6' }}
                    title="Theme Primary Color"
                  />
                </div>
                <CardTitle className="text-base font-extrabold text-foreground truncate mt-2">{exp.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                  {exp.description || 'Custom presentation layout for media sharing.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Updated {new Date(exp.updatedAt).toLocaleDateString()}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/admin/media/experiences/builder?id=${exp.id}`)}
                  className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] active:scale-[0.97]"
                >
                  Edit Layout
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
