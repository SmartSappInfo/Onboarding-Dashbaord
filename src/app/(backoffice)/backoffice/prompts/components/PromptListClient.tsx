'use client';

import * as React from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Pencil,
  Bot,
  Terminal,
  Bookmark
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getGlobalPrompts, saveGlobalPrompt } from '@/lib/pms-repository';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { GlobalPrompt } from '@/lib/pms-types';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = [
  'marketing',
  'sales',
  'meetings',
  'call_scripts',
  'emails',
  'crm',
  'workflows',
  'reports',
  'general'
];

const CATEGORY_COLORS: Record<string, string> = {
  marketing: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  sales: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  meetings: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  call_scripts: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  emails: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  crm: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  workflows: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  reports: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  general: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

interface PromptFormState {
  id: string;
  title: string;
  description: string;
  category: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string;
  aiModels: string;
}

const defaultForm: PromptFormState = {
  id: '',
  title: '',
  description: '',
  category: 'general',
  systemPrompt: '',
  userPromptTemplate: '',
  variables: '',
  aiModels: 'googleai/gemini-2.0-flash'
};

export default function PromptListClient() {
  const { can, profile } = useBackoffice();
  const { toast } = useToast();
  const [prompts, setPrompts] = React.useState<GlobalPrompt[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  
  // Editor Dialog State
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPrompt, setEditingPrompt] = React.useState<GlobalPrompt | null>(null);
  const [form, setForm] = React.useState<PromptFormState>(defaultForm);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    setIsLoading(true);
    const result = await getGlobalPrompts();
    if (result.success && result.data) {
      setPrompts(result.data);
    }
    setIsLoading(false);
  }

  const filteredPrompts = React.useMemo(() => {
    return prompts.filter((p) => {
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [prompts, search, categoryFilter]);

  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (prompt: GlobalPrompt) => {
    setEditingPrompt(prompt);
    setForm({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      category: prompt.category,
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      variables: prompt.variables.join(', '),
      aiModels: prompt.aiModels.join(', ')
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.title.trim()) {
      toast({ variant: 'destructive', title: 'Flow ID and Title are required.' });
      return;
    }
    if (!profile) return;

    setIsSaving(true);
    const variablesList = form.variables
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const modelsList = form.aiModels
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      systemPrompt: form.systemPrompt,
      userPromptTemplate: form.userPromptTemplate,
      variables: variablesList,
      aiModels: modelsList,
      tags: [],
      updatedBy: profile.id,
    };

    const result = await saveGlobalPrompt(form.id, payload, profile.id);
    if (result.success) {
      toast({ title: 'Global prompt saved successfully.' });
      setIsDialogOpen(false);
      loadPrompts();
    } else {
      toast({ variant: 'destructive', title: 'Failed to save global prompt.', description: result.error });
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Global Prompts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system-wide AI prompt templates for all subscribed organizations.
          </p>
        </div>
        {can('templates', 'create') && (
          <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> New Prompt
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search global prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredPrompts.length} global prompts
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-left">
                Prompt Details
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-left">
                Category
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-left">
                Model & Variables
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                Version
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-accent animate-pulse" />
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-accent rounded animate-pulse" />
                        <div className="h-3 w-20 bg-accent rounded animate-pulse" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><div className="h-4 w-24 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-accent rounded animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="h-5 w-10 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredPrompts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-12">
                  <Bot className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No global prompts configured.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredPrompts.map((p) => (
                <TableRow
                  key={p.id}
                  className="border-border hover:bg-accent/20 transition-colors"
                >
                  <TableCell className="text-left">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/50 border border-border mt-0.5">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[240px]">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">{p.id}</p>
                        <p className="text-xs text-muted-foreground/70 truncate max-w-[300px] mt-0.5">{p.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-left">
                    <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 h-4 ${CATEGORY_COLORS[p.category] || 'bg-slate-500/15 border-slate-500/20'}`}>
                      {p.category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-[10px] font-mono text-muted-foreground font-bold">{p.aiModels.join(', ')}</span>
                      {p.variables.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.variables.map(v => (
                            <code key={v} className="text-[8px] bg-accent px-1 rounded font-mono text-slate-400">{`{{${v}}}`}</code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[8px] text-muted-foreground italic">No variables</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono bg-accent px-1.5 py-0.5 rounded text-foreground font-semibold">v{p.version}</span>
                  </TableCell>
                  <TableCell>
                    {can('templates', 'edit') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(p)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-left">
              {editingPrompt ? 'Edit Global Prompt' : 'Create Global Prompt'}
            </DialogTitle>
            <DialogDescription className="text-left">
              Manage the baseline instructions and variable placeholders for this AI flow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Flow ID (Technical Name)</label>
                <Input
                  disabled={!!editingPrompt}
                  placeholder="e.g. summarizeEntityNotesFlow"
                  value={form.id}
                  onChange={e => setForm(prev => ({ ...prev, id: e.target.value }))}
                  className="bg-muted/50 border-border text-sm rounded-xl h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Display Title</label>
                <Input
                  placeholder="e.g. Entity Notes Briefing"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-muted/50 border-border text-sm rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <Select
                  value={form.category}
                  onValueChange={val => setForm(prev => ({ ...prev, category: val }))}
                >
                  <SelectTrigger className="bg-muted/50 border-border text-foreground rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Description</label>
                <Input
                  placeholder="Summary of prompt functionality"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-muted/50 border-border text-sm rounded-xl h-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> System Prompt (Model Rules)
              </label>
              <Textarea
                placeholder="You are an expert analyst..."
                value={form.systemPrompt}
                onChange={e => setForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                className="bg-muted/50 border-border text-sm rounded-xl min-h-[100px] resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" /> User Prompt Template
              </label>
              <Textarea
                placeholder="Here is the context: {{notesContext}}"
                value={form.userPromptTemplate}
                onChange={e => setForm(prev => ({ ...prev, userPromptTemplate: e.target.value }))}
                className="bg-muted/50 border-border text-sm rounded-xl min-h-[100px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Variables (Comma-separated)</label>
                <Input
                  placeholder="e.g. entityName, notesContext"
                  value={form.variables}
                  onChange={e => setForm(prev => ({ ...prev, variables: e.target.value }))}
                  className="bg-muted/50 border-border text-sm rounded-xl h-10 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">AI Models (Comma-separated)</label>
                <Input
                  placeholder="e.g. googleai/gemini-2.0-flash"
                  value={form.aiModels}
                  onChange={e => setForm(prev => ({ ...prev, aiModels: e.target.value }))}
                  className="bg-muted/50 border-border text-sm rounded-xl h-10 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving} className="rounded-xl h-10">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-6 font-bold">
              {isSaving ? 'Saving...' : 'Save Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
