'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileStack,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Archive,
  RefreshCw,
  Plus
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
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  deprecated: 'bg-red-500/15 text-red-400 border-red-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  messaging: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  form: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  survey: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  automation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
};

export default function TemplateListClient() {
  const { can, profile } = useBackoffice();
  const [templates, setTemplates] = React.useState<PlatformTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  React.useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setIsLoading(true);
    const result = await listAllTemplates();
    if (result.success && result.data) {
      setTemplates(result.data);
    }
    setIsLoading(false);
  }

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        !search ||
        tpl.name.toLowerCase().includes(search.toLowerCase());

      const matchesType = typeFilter === 'all' || tpl.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || tpl.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [templates, search, typeFilter, statusFilter]);

  const types = React.useMemo(() => {
    const s = new Set(templates.map(t => t.type));
    return Array.from(s).sort();
  }, [templates]);

  async function handlePublish(tpl: PlatformTemplate) {
    if (!profile) return;
    if (!confirm('Are you sure you want to publish this template? It will become available to all active organizations.')) return;
    
    const result = await publishTemplate(tpl.id, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadTemplates();
  }

  async function handleDeprecate(tpl: PlatformTemplate) {
    if (!profile) return;
    if (!confirm('Deprecating this template means orgs missing it cannot select it anymore, but existing users will keep it. Proceed?')) return;
    
    const result = await deprecateTemplate(tpl.id, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadTemplates();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            System Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage globally available system templates across all organizations.
          </p>
        </div>
        {can('templates', 'create') && (
           <Button className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4">
              <Plus className="h-4 w-4 mr-2" /> New Template
           </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredTemplates.length} templates
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Template
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Type
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                Version & Usage
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-accent animate-pulse" />
                      <div>
                        <div className="h-4 w-32 bg-accent rounded animate-pulse" />
                        <div className="h-3 w-20 bg-accent rounded animate-pulse mt-1" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><div className="h-4 w-24 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="h-5 w-16 bg-accent rounded-full animate-pulse mx-auto" /></TableCell>
                  <TableCell className="text-center"><div className="h-4 w-12 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredTemplates.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-12">
                  <FileStack className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No templates found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((tpl) => (
                <TableRow
                  key={tpl.id}
                  className="border-border hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/backoffice/templates/${tpl.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/50 border border-border`}>
                        <FileStack className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">{tpl.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={tpl.description}>{tpl.description || 'No description'}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold px-1.5 h-4 ${TYPE_COLORS[tpl.type] || 'bg-slate-500/15 text-muted-foreground border-slate-500/20'}`}
                      >
                        {tpl.type}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[tpl.status]}`}
                      >
                        {tpl.status}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                      <div className="flex flex-col gap-1 items-center">
                         <span className="text-xs text-foreground font-mono bg-accent px-1.5 rounded">v{tpl.version}</span>
                         <span className="text-[10px] text-muted-foreground">{tpl.usageCount} uses</span>
                      </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={`Actions for ${tpl.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 bg-muted border-border rounded-xl"
                      >
                        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                          <Link href={`/backoffice/templates/${tpl.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {can('templates', 'edit') ? (
                          <>
                            <DropdownMenuSeparator className="bg-accent" />
                            {tpl.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() => handlePublish(tpl)}
                                className="cursor-pointer rounded-lg text-emerald-400 focus:text-emerald-400"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Publish Now
                              </DropdownMenuItem>
                            )}
                            {tpl.status === 'published' && (
                              <DropdownMenuItem
                                onClick={() => handleDeprecate(tpl)}
                                className="cursor-pointer rounded-lg text-amber-400 focus:text-amber-400"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Deprecate
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
