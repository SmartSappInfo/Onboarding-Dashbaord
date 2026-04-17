'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ToggleRight,
  Search,
  MoreHorizontal,
  Eye,
  AlertTriangle,
  Play,
  Pause,
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
import { listAllFeatures, toggleFeatureKillSwitch } from '@/lib/backoffice/backoffice-feature-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformFeature } from '@/lib/backoffice/backoffice-types';

const STABILITY_COLORS: Record<string, string> = {
  stable: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  beta: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  internal: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

export default function FeatureListClient() {
  const { can, profile } = useBackoffice();
  const [features, setFeatures] = React.useState<PlatformFeature[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  React.useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    setIsLoading(true);
    const result = await listAllFeatures();
    if (result.success && result.data) {
      setFeatures(result.data);
    }
    setIsLoading(false);
  }

  // Filter features
  const filteredFeatures = React.useMemo(() => {
    return features.filter((feat) => {
      const matchesSearch =
        !search ||
        feat.key.toLowerCase().includes(search.toLowerCase()) ||
        feat.label.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        categoryFilter === 'all' || feat.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [features, search, categoryFilter]);

  const categories = React.useMemo(() => {
    const cats = new Set(features.map(f => f.category));
    return Array.from(cats).sort();
  }, [features]);

  async function handleToggleKillSwitch(feature: PlatformFeature) {
    if (!profile) return;
    const newState = !feature.killSwitch;
    
    if (newState && !confirm('Are you sure you want to KILL this feature? This overrides all rollouts.')) {
      return;
    }
    
    const result = await toggleFeatureKillSwitch(feature.id, newState, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });

    if (result.success) loadFeatures();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Features & Rollouts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage global platform feature flags and gradual rollouts.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by key or label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center"
        >
          {filteredFeatures.length} feature{filteredFeatures.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Feature
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                Category & Stability
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                State
              </TableHead>
              <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">
                Rollout Rules
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
                  <TableCell className="text-center"><div className="h-4 w-8 bg-accent rounded animate-pulse mx-auto" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filteredFeatures.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={5} className="text-center py-12">
                  <ToggleRight className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No feature flags found.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredFeatures.map((feat) => {
                const activeRulesCount = feat.rolloutRules?.filter(r => r.enabled).length || 0;
                
                return (
                  <TableRow
                    key={feat.id}
                    className="border-border hover:bg-accent/20 transition-colors cursor-pointer"
                  >
                    <TableCell>
                      <Link
                        href={`/backoffice/features/${feat.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${feat.killSwitch ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                          <ToggleRight className={`h-4 w-4 ${feat.killSwitch ? 'text-red-400' : 'text-emerald-400'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">{feat.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono" title={feat.key}>{feat.key}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 items-start">
                         <span className="text-xs text-foreground/80 font-semibold">{feat.category}</span>
                         <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold px-1.5 h-4 ${STABILITY_COLORS[feat.stability] || STABILITY_COLORS.internal}`}
                        >
                          {feat.stability}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                       {feat.killSwitch ? (
                          <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/20 text-[10px] uppercase tracking-wider">
                             Killed (OFF)
                          </Badge>
                       ) : (
                          <Badge variant="outline" className={feat.defaultState ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] uppercase tracking-wider' : 'bg-slate-500/15 text-muted-foreground border-slate-500/20 text-[10px] uppercase tracking-wider'}>
                             {feat.defaultState ? 'Default ON' : 'Default OFF'}
                          </Badge>
                       )}
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="text-sm text-foreground/80 font-semibold">{activeRulesCount} active</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label={`Actions for ${feat.label}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-muted border-border rounded-xl"
                        >
                          <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                            <Link href={`/backoffice/features/${feat.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {can('features', 'edit') ? (
                            <>
                              <DropdownMenuSeparator className="bg-accent" />
                              <DropdownMenuItem
                                onClick={() => handleToggleKillSwitch(feat)}
                                className={`cursor-pointer rounded-lg ${feat.killSwitch ? 'text-emerald-400 focus:text-emerald-400' : 'text-red-400 focus:text-red-400'}`}
                              >
                                {feat.killSwitch ? (
                                   <><Play className="h-4 w-4 mr-2" /> Remove Kill Switch</>
                                ) : (
                                   <><AlertTriangle className="h-4 w-4 mr-2" /> Enable Kill Switch</>
                                )}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
