'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Layers,
  Sparkles,
  Clock,
  Video,
  Presentation,
  GraduationCap,
  Radio,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getMeetingTemplatesAction, deployMeetingTemplateAction } from '@/app/actions/meeting-template-actions';
import type { MeetingTemplate, TemplateCategory } from '@/lib/meetings/types/templates';

const CATEGORY_TABS: Array<{ label: string; value: TemplateCategory | 'all' }> = [
  { label: 'All Templates', value: 'all' },
  { label: 'Sales & Growth', value: 'sales' },
  { label: 'Education & Consultations', value: 'education' },
  { label: 'Client Onboarding', value: 'onboarding' },
  { label: 'Broadcast Webinars', value: 'webinar' },
  { label: 'Technical Support', value: 'support' },
];

export function TemplatesClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [templates, setTemplates] = React.useState<MeetingTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState<TemplateCategory | 'all'>('all');
  const [deployingId, setDeployingId] = React.useState<string | null>(null);

  const fetchTemplates = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingTemplatesAction(activeWorkspaceId);
      if (res.success && res.templates) {
        setTemplates(res.templates);
      }
    } catch (err) {
      console.warn('[fetch templates]', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDeployTemplate = async (template: MeetingTemplate) => {
    if (!activeWorkspaceId) return;
    setDeployingId(template.id);
    try {
      const res = await deployMeetingTemplateAction(activeWorkspaceId, template.id);
      if (res.success && res.eventType) {
        toast({
          title: 'Template Deployed Successfully! 🎉',
          description: `"${res.eventType.name}" has been created as an active Event Type.`,
          actionConfig: {
            path: '/admin/meetings/event-types',
            label: 'View Event Types',
          },
          duration: 10000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Deployment Failed',
          description: res.error || 'Failed to deploy template.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred during template deployment.',
      });
    } finally {
      setDeployingId(null);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  const getTemplateIcon = (category: TemplateCategory) => {
    switch (category) {
      case 'sales':
        return <Presentation className="w-4 h-4 text-blue-500" />;
      case 'education':
        return <GraduationCap className="w-4 h-4 text-emerald-500" />;
      case 'onboarding':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'webinar':
        return <Radio className="w-4 h-4 text-amber-500" />;
      case 'support':
        return <Wrench className="w-4 h-4 text-rose-500" />;
      default:
        return <Layers className="w-4 h-4 text-primary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Meeting Templates Studio
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deploy pre-built, industry-standard scheduling templates with optimized intake questions, durations, and reminders.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORY_TABS.map(tab => (
          <Button
            key={tab.value}
            variant={activeCategory === tab.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(tab.value)}
            className="rounded-xl text-xs font-semibold shrink-0 min-h-[36px]"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(tmpl => {
          const isDeploying = deployingId === tmpl.id;

          return (
            <Card
              key={tmpl.id}
              className="rounded-3xl border border-border shadow-sm flex flex-col justify-between overflow-hidden hover:shadow-md transition-shadow bg-card"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center">
                    {getTemplateIcon(tmpl.category)}
                  </div>
                  <Badge variant="outline" className="text-[11px] font-bold capitalize">
                    {tmpl.format.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-foreground leading-snug">
                    {tmpl.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {tmpl.durationMinutes} mins
                  </span>
                  <span className="flex items-center gap-1 font-medium capitalize">
                    <Video className="w-3.5 h-3.5 text-primary" />
                    {tmpl.defaultProvider.replace('_', ' ')}
                  </span>
                </div>

                {/* Intake Questions Preview */}
                {tmpl.defaultQuestions.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Intake Questions ({tmpl.defaultQuestions.length})
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      {tmpl.defaultQuestions.slice(0, 2).map((q, idx) => (
                        <li key={idx} className="truncate">
                          {q.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <CardFooter className="p-6 pt-0 border-t border-border/40 mt-4">
                <Button
                  className="w-full rounded-2xl min-h-[44px] text-xs font-bold gap-2 active:scale-[0.97] transition-transform"
                  disabled={isDeploying}
                  onClick={() => handleDeployTemplate(tmpl)}
                >
                  <Plus className="w-4 h-4" />
                  {isDeploying ? 'Deploying Template...' : 'Deploy as Event Type'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
