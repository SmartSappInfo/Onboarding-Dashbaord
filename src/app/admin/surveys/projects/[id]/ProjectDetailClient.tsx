'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Project Detail & Longitudinal Workspace
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Longitudinal Multi-Wave Workspace: Overview, Longitudinal Analytics, and Settings tabs.
 * 2. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SurveyProject, Survey } from '@/lib/types';
import { getSurveyProjectsAction } from '@/lib/surveys/survey-project-actions';
import { LongitudinalStudyView } from '../components/LongitudinalStudyView';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FolderGit2,
  Layers,
  ArrowLeft,
  Calendar,
  Sparkles,
  BarChart3,
  Settings,
  Plus,
  Loader2,
  FileQuestion,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

export interface ProjectDetailClientProps {
  projectId: string;
}

export default function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [project, setProject] = React.useState<SurveyProject | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('analytics');

  const fetchProjectDetails = React.useCallback(async () => {
    if (!activeWorkspaceId || !projectId) return;
    setIsLoading(true);
    try {
      const res = await getSurveyProjectsAction(activeWorkspaceId);
      if (res.success && res.projects) {
        const matched = res.projects.find((p) => p.id === projectId);
        if (matched) {
          setProject(matched);
        } else {
          toast({
            variant: 'destructive',
            title: 'Project Not Found',
            description: 'Could not find this research project in the active workspace.',
          });
        }
      }
    } catch (err) {
      console.error('[ProjectDetailClient] fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, projectId, toast]);

  React.useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Loading Research Project Workspace...</p>
        </div>
      </PageContainer>
    );
  }

  if (!project) {
    return (
      <PageContainer>
        <div className="text-center py-20 space-y-4">
          <FolderGit2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-base font-bold text-foreground">Project Not Found</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/surveys/projects">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 max-w-7xl mx-auto pb-16 text-left">
        {/* Navigation & Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <Link href="/admin/surveys/projects">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back to All Projects
              </Link>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <FolderGit2 className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">{project.name}</h1>
                <Badge variant="outline" className="text-xs font-mono uppercase">
                  {project.projectType || 'Research'}
                </Badge>
                <Badge
                  className="text-[10px] font-semibold capitalize"
                  variant={project.status === 'active' ? 'default' : 'secondary'}
                >
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground max-w-2xl">{project.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" variant="outline" className="h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
                <Link href="/admin/surveys/new">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Survey
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/40 p-1 rounded-xl h-11 border border-border">
            <TabsTrigger
              value="analytics"
              className="rounded-lg h-9 px-4 text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-3.5 w-3.5 text-purple-600" />
              Longitudinal Analytics
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg h-9 px-4 text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Project Settings & Retention
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="m-0 focus-visible:outline-none">
            <LongitudinalStudyView projectId={projectId} workspaceId={activeWorkspaceId || ''} />
          </TabsContent>

          <TabsContent value="settings" className="m-0 focus-visible:outline-none">
            <Card className="rounded-2xl border-border bg-card shadow-sm p-6 space-y-6">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold text-foreground">Project Configuration & Rules</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Manage metadata, longitudinal cohort criteria, and data retention policy.
                </CardDescription>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Project Name</span>
                  <p className="text-sm font-bold text-foreground">{project.name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Study Classification</span>
                  <p className="text-sm font-bold text-foreground capitalize">{project.projectType}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Created Date</span>
                  <p className="text-sm font-bold text-foreground">
                    {project.createdAt ? format(new Date(project.createdAt), 'PPP') : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Linked Surveys Count</span>
                  <p className="text-sm font-bold text-foreground">{project.surveyIds?.length || 0} Surveys</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
