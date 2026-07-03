'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTenant } from '@/context/TenantContext';
import { getGlobalPrompts, getTenantOverrides, deleteTenantOverride } from '@/lib/pms-repository';
import type { GlobalPrompt, TenantPromptOverride } from '@/lib/pms-types';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Sparkles,
  Bot,
  Sliders,
  RotateCcw,
  CheckCircle,
  FileText
} from 'lucide-react';

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

interface MergedPrompt {
  id: string; // flowName
  title: string;
  description: string;
  category: string;
  tags: string[];
  variables: string[];
  aiModels: string[];
  isCustomized: boolean;
  overrideId?: string;
  version: number;
  status?: string;
}

export default function PromptsLibraryClient() {
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [globalPrompts, setGlobalPrompts] = React.useState<GlobalPrompt[]>([]);
  const [overrides, setOverrides] = React.useState<TenantPromptOverride[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const loadData = React.useCallback(async () => {
    if (!activeOrganizationId) return;
    setIsLoading(true);
    const [globalRes, overridesRes] = await Promise.all([
      getGlobalPrompts(),
      getTenantOverrides(activeOrganizationId, activeWorkspaceId)
    ]);

    if (globalRes.success && globalRes.data) {
      setGlobalPrompts(globalRes.data);
    }
    if (overridesRes.success && overridesRes.data) {
      setOverrides(overridesRes.data);
    }
    setIsLoading(false);
  }, [activeOrganizationId, activeWorkspaceId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge globals with local overrides
  const mergedPrompts = React.useMemo<MergedPrompt[]>(() => {
    return globalPrompts.map((global) => {
      // Find override by flowName match
      const matched = overrides.find(o => o.flowName === global.id && o.isActive);
      if (matched) {
        return {
          id: global.id,
          title: matched.title || global.title,
          description: matched.description || global.description,
          category: matched.category || global.category,
          tags: matched.tags || global.tags,
          variables: matched.variables || global.variables,
          aiModels: matched.aiModels || global.aiModels,
          isCustomized: true,
          overrideId: matched.id,
          version: matched.version,
          status: matched.status
        };
      }
      return {
        id: global.id,
        title: global.title,
        description: global.description,
        category: global.category,
        tags: global.tags,
        variables: global.variables,
        aiModels: global.aiModels,
        isCustomized: false,
        version: global.version
      };
    });
  }, [globalPrompts, overrides]);

  const filteredPrompts = React.useMemo(() => {
    return mergedPrompts.filter(p => {
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [mergedPrompts, search, selectedCategory]);

  const handleRevert = async (overrideId: string) => {
    if (!confirm('Are you sure you want to revert this prompt back to the system default template? All customizations will be permanently deleted.')) return;
    setIsLoading(true);
    const result = await deleteTenantOverride(overrideId);
    if (result.success) {
      toast({ title: 'Prompt reverted to default.' });
      loadData();
    } else {
      toast({ variant: 'destructive', title: 'Failed to revert template.', description: result.error });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('all')}
            size="sm"
            className="rounded-xl px-4"
          >
            All
          </Button>
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat)}
              size="sm"
              className="rounded-xl px-4 capitalize"
            >
              {cat.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse border-border">
              <CardHeader className="space-y-2">
                <div className="h-6 w-32 bg-accent rounded" />
                <div className="h-4 w-48 bg-accent rounded" />
              </CardHeader>
              <CardContent className="h-24 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/10">
          <Bot className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No prompts found</h3>
          <p className="text-muted-foreground text-sm mt-1">Try refining your search queries or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(p => (
            <Card
              key={p.id}
              className="border-border bg-gradient-to-b from-card to-background relative overflow-hidden flex flex-col group/card shadow-sm hover:shadow-md transition-shadow rounded-2xl"
            >
              <CardHeader className="pb-3 text-center flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wide font-black">
                    {p.category.replace('_', ' ')}
                  </Badge>
                  {p.isCustomized ? (
                    <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/15 border-amber-500/20 text-[9px] font-bold">
                      Customized
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 border-emerald-500/20 text-[9px] font-bold">
                      Subscribed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-foreground leading-tight text-center w-full truncate">
                  {p.title}
                </CardTitle>
                <div className="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr] transition-all duration-300 ease-in-out w-full overflow-hidden">
                  <CardDescription className="text-xs text-muted-foreground text-center min-h-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pt-1">
                    {p.description}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="pb-4 pt-0 text-left flex-1 flex flex-col justify-between">
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Active Version</span>
                    <span className="font-mono bg-accent px-1.5 rounded font-semibold text-foreground">v{p.version}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Engine Providers</span>
                    <span className="font-semibold text-foreground truncate max-w-[120px]">{p.aiModels.join(', ')}</span>
                  </div>
                  {p.variables.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground font-bold mb-1">Supported Variables</p>
                      <div className="flex flex-wrap gap-1">
                        {p.variables.map(v => (
                          <code key={v} className="text-[8px] font-mono bg-accent px-1.5 py-0.5 rounded text-slate-400">{`{{${v}}}`}</code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/40">
                  <Button asChild size="sm" className="flex-1 rounded-xl h-9 text-xs font-bold" variant={p.isCustomized ? 'outline' : 'default'}>
                    <Link href={`/admin/ai-prompts/${p.id}`}>
                      <Sliders className="h-3 w-3 mr-1.5" />
                      {p.isCustomized ? 'Configure Override' : 'Customize Template'}
                    </Link>
                  </Button>
                  {p.isCustomized && p.overrideId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevert(p.overrideId!)}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Revert to Default"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
