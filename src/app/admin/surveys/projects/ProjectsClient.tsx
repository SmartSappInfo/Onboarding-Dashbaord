'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Projects Client Component
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Longitudinal Research & Multi-Wave Grouping:
 *    - Allows admins to containerize surveys into coherent studies (e.g. Wave 1, Wave 2, Benchmarks).
 * 2. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - All interactive buttons maintain min-h-[44px] touch targets and Emil Kowalski active:scale-[0.97] press states.
 * 3. Strict Zero-Any Invariant:
 *    - All state, props, and callbacks are strictly typed without any or any[].
 */

import * as React from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  PlusCircle,
  Search,
  Layers,
  Sparkles,
  Calendar,
  Tag,
  BarChart3,
  ArrowRight,
  Loader2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  getSurveyProjectsAction,
  createSurveyProjectAction,
} from '@/lib/surveys/survey-project-actions';
import type { SurveyProject } from '@/lib/types';
import { format } from 'date-fns';

export default function ProjectsClient() {
  const { activeWorkspaceId, activeOrganization } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [projects, setProjects] = React.useState<SurveyProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [projectType, setProjectType] = React.useState<SurveyProject['projectType']>('research');
  const [tagsInput, setTagsInput] = React.useState('');

  const fetchProjects = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getSurveyProjectsAction(activeWorkspaceId);
      if (res.success && res.projects) {
        setProjects(res.projects);
      } else if (res.error) {
        toast({
          variant: 'destructive',
          title: 'Error loading projects',
          description: res.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to retrieve survey projects.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await createSurveyProjectAction(
        activeWorkspaceId,
        activeOrganization?.id || activeWorkspaceId,
        {
          name: name.trim(),
          description: description.trim(),
          projectType,
          ownerId: user?.uid || 'user',
          ownerName: user?.displayName || user?.email || undefined,
          tags,
        }
      );

      if (res.success && res.project) {
        toast({
          title: 'Project Created',
          description: `Research study "${res.project.name}" has been initiated.`,
        });
        setIsCreateOpen(false);
        setName('');
        setDescription('');
        setTagsInput('');
        fetchProjects();
      } else {
        toast({
          variant: 'destructive',
          title: 'Creation Failed',
          description: res.error || 'Failed to create survey project.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving the project.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === 'all' || p.projectType === selectedType;
      return matchesSearch && matchesType;
    });
  }, [projects, searchQuery, selectedType]);

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/surveys"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Surveys
              </Link>
              <span className="text-muted-foreground">/</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <FolderGit2 className="h-6 w-6 text-primary" />
                Research Projects
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Containerize longitudinal research, wave studies, and multi-instrument programs across your organization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProjects}
              disabled={isLoading}
              className="h-10 min-h-[44px] active:scale-[0.97] transition-all"
            >
              <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-10 min-h-[44px] px-4 font-semibold shadow-sm active:scale-[0.97] transition-all flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" />
              New Research Project
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search studies by title, description, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 min-h-[44px] w-full"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[200px] h-10 min-h-[44px]">
              <SelectValue placeholder="All Project Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="experience">Experience (CX/PX)</SelectItem>
              <SelectItem value="assessment">Assessment</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading research projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed border-2 p-10 text-center flex flex-col items-center justify-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/60 mb-3" />
            <h3 className="text-lg font-semibold text-foreground">No Research Projects Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
              {searchQuery
                ? 'No projects matched your search criteria. Try adjusting your query.'
                : 'Group multiple survey waves, benchmark studies, and participant cohorts under a unified research project.'}
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="min-h-[44px] active:scale-[0.97] transition-all flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create First Project
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="group hover:border-primary/50 transition-all duration-200 shadow-sm flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="capitalize text-xs font-semibold">
                      {project.projectType}
                    </Badge>
                    <Badge
                      variant={project.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs uppercase tracking-wider"
                    >
                      {project.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground line-clamp-1 mt-2">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                    {project.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Wave & Metric Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>{project.surveyIds.length} {project.surveyIds.length === 1 ? 'Wave' : 'Waves'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {project.createdAt ? format(new Date(project.createdAt), 'MMM yyyy') : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                          #{tag}
                        </Badge>
                      ))}
                      {project.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{project.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Link */}
                  <div className="pt-2 border-t border-border/40">
                    <Link
                      href={`/admin/surveys/projects/${project.id}`}
                      className="inline-flex items-center justify-between w-full text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1"
                    >
                      <span>Open Longitudinal Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Initiate Research Project
              </DialogTitle>
              <DialogDescription>
                Set up a container to track longitudinal survey waves and comparative feedback over time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="proj-name" className="text-xs font-bold uppercase tracking-wider">
                  Project Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="proj-name"
                  placeholder="e.g. 2026 Parent Experience Study"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-type" className="text-xs font-bold uppercase tracking-wider">
                  Research Archetype
                </Label>
                <Select
                  value={projectType}
                  onValueChange={(val) => setProjectType(val as SurveyProject['projectType'])}
                >
                  <SelectTrigger id="proj-type" className="h-10 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">Longitudinal Research</SelectItem>
                    <SelectItem value="experience">Customer / Parent Experience (CX)</SelectItem>
                    <SelectItem value="assessment">Academic / Candidate Assessment</SelectItem>
                    <SelectItem value="feedback">Operational Feedback & CSAT</SelectItem>
                    <SelectItem value="engagement">Employee / Staff Engagement</SelectItem>
                    <SelectItem value="custom">Custom Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-desc" className="text-xs font-bold uppercase tracking-wider">
                  Description & Objectives
                </Label>
                <Textarea
                  id="proj-desc"
                  placeholder="Describe the research goals, target cohorts, and study timeline..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-tags" className="text-xs font-bold uppercase tracking-wider">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="proj-tags"
                  placeholder="e.g. annual, parent, 2026, campus-a"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="h-10 min-h-[44px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="min-h-[44px] active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="min-h-[44px] active:scale-[0.97] font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Project...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
