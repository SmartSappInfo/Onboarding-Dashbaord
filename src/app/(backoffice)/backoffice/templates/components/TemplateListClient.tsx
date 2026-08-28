/**
 * @fileoverview Platform Template Matrix Catalog & Governance Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Central control plane matrix for all 15 platform template domains.
 * - Supports tab-based category navigation, search filtering, and live propagation fan-out.
 * - Touch targets maintain >= 44px height (`min-h-[44px]` / `h-11`) for mobile accessibility.
 * - Button active states use `active:scale-[0.97]` for responsive tactile feedback (emilkowal-animations).
 *
 * @testability Client component consuming `listAllTemplates`, `publishTemplate`, `deprecateTemplate`, and `propagateTemplateToWorkspaces`.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  FileStack,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Archive,
  RefreshCw,
  Plus,
  Loader2,
  Edit,
  Send,
  MessageSquare,
  Video,
  BarChart3,
  FormInput,
  Workflow,
  Kanban,
  FileCode,
  Layers,
  FileText,
  Banknote,
  QrCode,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  ListTodo,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listAllTemplates, publishTemplate, deprecateTemplate } from '@/lib/backoffice/backoffice-template-actions';
import { seedAllPlatformTemplatesAction } from '@/app/actions/seed-platform-presets-action';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformTemplate, PlatformTemplateType } from '@/lib/backoffice/backoffice-types';
import TemplateDialog from './TemplateDialog';
import PropagateTemplateDialog from './PropagateTemplateDialog';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  published: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  deprecated: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const CATEGORY_TABS: Array<{
  id: string;
  label: string;
  types: PlatformTemplateType[];
  icon: React.ElementType;
}> = [
  { id: 'all', label: 'All Templates', types: [], icon: FileStack },
  { id: 'messaging', label: 'Messaging', types: ['messaging'], icon: MessageSquare },
  { id: 'meetings', label: 'Meetings', types: ['meeting'], icon: Video },
  { id: 'surveys', label: 'Surveys & Forms', types: ['survey', 'form'], icon: BarChart3 },
  { id: 'automations', label: 'Automations & Pipelines', types: ['automation', 'pipeline'], icon: Workflow },
  { id: 'pages', label: 'CMS & Portals', types: ['page', 'section', 'block', 'theme'], icon: Layers },
  { id: 'documents', label: 'PDFs & Dunning', types: ['pdf', 'dunning'], icon: FileText },
  { id: 'credentials', label: 'QR & Credentials', types: ['qr_credential'], icon: QrCode },
  { id: 'governance', label: 'Roles & Prompts', types: ['role_architecture', 'brand_voice', 'prompt', 'task'], icon: ShieldCheck },
];

export default function TemplateListClient() {
  const { can, isLoading: isBackofficeLoading } = useBackoffice();
  const { user, isUserLoading } = useUser();
  const confirm = useConfirm();
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<PlatformTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<PlatformTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [propagationTemplate, setPropagationTemplate] = React.useState<PlatformTemplate | null>(null);
  const [isPropagateOpen, setIsPropagateOpen] = React.useState(false);

  const fetchTemplates = React.useCallback(async () => {
    if (isBackofficeLoading || isUserLoading || !user) {
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await listAllTemplates(idToken);
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load templates',
          description: res.error || 'Unknown error',
        });
      }
    } catch (error: unknown) {
      console.error('Failed to fetch templates:', error);
      if (user) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch templates. Please try refreshing.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isBackofficeLoading, isUserLoading, user, getToken, toast]);

  React.useEffect(() => {
    if (!isBackofficeLoading && !isUserLoading && user) {
      fetchTemplates();
    }
  }, [isBackofficeLoading, isUserLoading, user, fetchTemplates]);

  function handleNewTemplate() {
    setSelectedTemplate(null);
    setIsDialogOpen(true);
  }

  function handleEditTemplate(tpl: PlatformTemplate) {
    setSelectedTemplate(tpl);
    setIsDialogOpen(true);
  }

  function handleOpenPropagate(tpl: PlatformTemplate) {
    setPropagationTemplate(tpl);
    setIsPropagateOpen(true);
  }

  async function handleSyncPresets() {
    if (
      !(await confirm({
        title: 'Sync 15-Domain Platform Presets?',
        description: 'This will seed and synchronize standard master templates across all 15 operational domains in the global catalog.',
        confirmText: 'Sync Presets',
      }))
    )
      return;

    setIsSyncing(true);
    try {
      const idToken = await getToken();
      const result = await seedAllPlatformTemplatesAction(idToken);
      if (result.success && result.seededCount) {
        toast({
          title: 'Presets Synced Successfully',
          description: `Synchronized ${result.seededCount.total} master presets across all 15 operational domains.`,
        });
        await fetchTemplates();
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Failed',
          description: result.error || 'Failed to sync presets',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to trigger preset sync',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handlePublish(tpl: PlatformTemplate) {
    if (
      !(await confirm({
        title: `Publish "${tpl.name}"?`,
        description:
          'Publishing makes this template available for tenant organizations and workspaces.',
        confirmText: 'Publish Template',
      }))
    )
      return;

    try {
      const idToken = await getToken();
      const res = await publishTemplate(tpl.id, idToken);
      if (res.success) {
        toast({ title: 'Template Published', description: `"${tpl.name}" is now published.` });
        fetchTemplates();
      } else {
        toast({
          variant: 'destructive',
          title: 'Publish Failed',
          description: res.error || 'Could not publish template.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    }
  }

  async function handleDeprecate(tpl: PlatformTemplate) {
    if (
      !(await confirm({
        title: `Deprecate "${tpl.name}"?`,
        description:
          'Deprecated templates will no longer be offered as defaults for new tenant workspaces.',
        confirmText: 'Deprecate Template',
      }))
    )
      return;

    try {
      const idToken = await getToken();
      const res = await deprecateTemplate(tpl.id, idToken);
      if (res.success) {
        toast({ title: 'Template Deprecated', description: `"${tpl.name}" has been deprecated.` });
        fetchTemplates();
      } else {
        toast({
          variant: 'destructive',
          title: 'Deprecate Failed',
          description: res.error || 'Could not deprecate template.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    }
  }

  // Filter templates by search, active category tab, and status
  const filteredTemplates = React.useMemo(() => {
    const currentTab = CATEGORY_TABS.find((t) => t.id === activeTab);
    const tabTypes = currentTab?.types || [];

    return templates.filter((t) => {
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());

      const matchesTab = tabTypes.length === 0 || tabTypes.includes(t.type);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      return matchesSearch && matchesTab && matchesStatus;
    });
  }, [templates, search, activeTab, statusFilter]);

  // Compute counts per category tab
  const tabCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const tab of CATEGORY_TABS) {
      if (tab.id === 'all') continue;
      counts[tab.id] = templates.filter((t) => tab.types.includes(t.type)).length;
    }
    return counts;
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileStack className="h-6 w-6 text-emerald-500" />
            Global Template Governance Matrix
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Author, version, preview, and propagate master templates across all 15 operational domains.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {can('templates', 'create') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncPresets}
              disabled={isSyncing}
              className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              ) : (
                <RefreshCw className="h-4 w-4 text-emerald-500" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Presets'}
            </Button>
          )}

          {can('templates', 'create') && (
            <Button
              onClick={handleNewTemplate}
              className="h-11 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.97] transition-all gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.97] ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-full sm:w-[150px] rounded-xl bg-card border-border text-xs font-semibold">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {isLoading || isBackofficeLoading || isUserLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium tracking-wide">Loading platform template matrix...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileStack className="h-7 w-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <p className="text-base font-bold text-foreground">No Templates Available</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {templates.length === 0
                  ? 'The global template catalog is uninitialized. Initialize the standard 15-domain system presets or create a custom master template.'
                  : 'No templates match your current filters. Adjust your search or clear filters to view templates.'}
              </p>
            </div>
            {can('templates', 'create') && (
              <div className="flex items-center gap-3 flex-wrap justify-center mt-2">
                {templates.length === 0 && (
                  <Button
                    onClick={handleSyncPresets}
                    disabled={isSyncing}
                    className="h-11 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.97] transition-all gap-2"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-white" />
                    )}
                    {isSyncing ? 'Initializing Presets...' : 'Initialize Standard System Presets'}
                  </Button>
                )}
                <Button
                  onClick={handleNewTemplate}
                  variant="outline"
                  className="h-11 px-4 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all gap-1.5"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Custom Template
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Template Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Domain</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Version</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((tpl) => (
                  <TableRow key={tpl.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                    <TableCell className="py-4">
                      <div className="space-y-0.5">
                        <Link
                          href={`/backoffice/templates/${tpl.id}`}
                          className="font-bold text-xs sm:text-sm text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          {tpl.name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-md">
                          {tpl.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px] font-semibold rounded-lg px-2 py-0.5 border-border">
                        {tpl.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground">{tpl.category || 'General'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono font-bold text-muted-foreground">v{tpl.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-[10px] font-bold rounded-lg border ${STATUS_COLORS[tpl.status] || ''}`}>
                        {tpl.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {tpl.status === 'published' && can('templates', 'execute') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPropagate(tpl)}
                            title="Propagate to Workspaces"
                            className="h-9 px-2.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.97] transition-all gap-1.5 text-xs font-semibold"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Propagate</span>
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg active:scale-[0.97]">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            <DropdownMenuItem asChild className="text-xs font-semibold cursor-pointer">
                              <Link href={`/backoffice/templates/${tpl.id}`} className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                                View Details
                              </Link>
                            </DropdownMenuItem>

                            {can('templates', 'edit') && (
                              <DropdownMenuItem
                                onClick={() => handleEditTemplate(tpl)}
                                className="text-xs font-semibold cursor-pointer flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4 text-muted-foreground" />
                                Edit Template
                              </DropdownMenuItem>
                            )}

                            {tpl.status === 'published' && can('templates', 'execute') && (
                              <DropdownMenuItem
                                onClick={() => handleOpenPropagate(tpl)}
                                className="text-xs font-semibold cursor-pointer flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
                              >
                                <Send className="h-4 w-4" />
                                Propagate to Workspaces
                              </DropdownMenuItem>
                            )}

                            {tpl.status !== 'published' && can('templates', 'edit') && (
                              <DropdownMenuItem
                                onClick={() => handlePublish(tpl)}
                                className="text-xs font-semibold cursor-pointer flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Publish
                              </DropdownMenuItem>
                            )}

                            {tpl.status === 'published' && can('templates', 'edit') && (
                              <DropdownMenuItem
                                onClick={() => handleDeprecate(tpl)}
                                className="text-xs font-semibold cursor-pointer flex items-center gap-2 text-rose-500"
                              >
                                <Archive className="h-4 w-4" />
                                Deprecate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Template Authoring / Edit Dialog */}
      <TemplateDialog
        template={selectedTemplate}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
          setIsDialogOpen(false);
          fetchTemplates();
        }}
      />

      {/* Multi-Tenant Propagation Dialog */}
      <PropagateTemplateDialog
        template={propagationTemplate}
        open={isPropagateOpen}
        onOpenChange={setIsPropagateOpen}
        onSuccess={() => {
          setIsPropagateOpen(false);
          fetchTemplates();
        }}
      />
    </div>
  );
}
