'use client';

import * as React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getNodeTypeColor, getRelationDisplayLabel } from '@/lib/quick-notes-domain';
import type {
  GraphNodeType,
  KnowledgeRelationType,
  KnowledgeGraphFilterOptions,
} from '@/lib/quick-notes-types';

interface GraphFiltersProps {
  filterOptions: KnowledgeGraphFilterOptions;
  onChangeFilters: (filters: KnowledgeGraphFilterOptions) => void;
  nodeTypeCounts: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  className?: string;
}

const COMMON_NODE_TYPES: Array<{ id: GraphNodeType; label: string }> = [
  { id: 'note', label: 'Notes' },
  { id: 'idea', label: 'Ideas' },
  { id: 'insight', label: 'Insights' },
  { id: 'decision', label: 'Decisions' },
  { id: 'school', label: 'Schools' },
  { id: 'contact', label: 'Contacts' },
  { id: 'deal', label: 'Deals' },
  { id: 'task', label: 'Tasks' },
];

const COMMON_REL_TYPES: Array<{ id: KnowledgeRelationType; label: string }> = [
  { id: 'supports', label: 'Supports' },
  { id: 'contradicts', label: 'Contradicts' },
  { id: 'depends_on', label: 'Depends On' },
  { id: 'derived_from', label: 'Derived From' },
  { id: 'evidences', label: 'Evidences' },
  { id: 'about_school', label: 'About School' },
  { id: 'about_contact', label: 'About Contact' },
];

export function GraphFilters({
  filterOptions,
  onChangeFilters,
  nodeTypeCounts,
  totalNodes,
  totalEdges,
  className = '',
}: GraphFiltersProps) {
  const activeNodeTypes = new Set(filterOptions.nodeTypes || []);
  const activeRelTypes = new Set(filterOptions.relationTypes || []);

  const toggleNodeType = (type: GraphNodeType) => {
    const next = new Set(activeNodeTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChangeFilters({
      ...filterOptions,
      nodeTypes: next.size > 0 ? Array.from(next) : undefined,
    });
  };

  const toggleRelType = (type: KnowledgeRelationType) => {
    const next = new Set(activeRelTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChangeFilters({
      ...filterOptions,
      relationTypes: next.size > 0 ? Array.from(next) : undefined,
    });
  };

  const clearAllFilters = () => {
    onChangeFilters({
      searchQuery: '',
      nodeTypes: undefined,
      relationTypes: undefined,
      minConfidence: undefined,
    });
  };

  const hasActiveFilters =
    (filterOptions.searchQuery && filterOptions.searchQuery.trim().length > 0) ||
    activeNodeTypes.size > 0 ||
    activeRelTypes.size > 0;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Top Search Bar & Summary */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filterOptions.searchQuery || ''}
            onChange={(e) => onChangeFilters({ ...filterOptions, searchQuery: e.target.value })}
            placeholder="Search nodes in graph…"
            className="pl-9 pr-8 h-9 text-xs rounded-xl bg-background/80"
          />
          {filterOptions.searchQuery && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filterOptions, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metrics Pill & Clear Filters */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-normal py-1 px-2.5 rounded-lg">
            <span className="font-semibold text-foreground mr-1">{totalNodes}</span> nodes ·{' '}
            <span className="font-semibold text-foreground mx-1">{totalEdges}</span> connections
          </Badge>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips Ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Types:
        </span>

        {COMMON_NODE_TYPES.map((t) => {
          const isSelected = activeNodeTypes.has(t.id);
          const count = nodeTypeCounts[t.id] || 0;
          const color = getNodeTypeColor(t.id);

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleNodeType(t.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-[0.98] border ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background hover:bg-muted/50 text-muted-foreground border-border'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color.hex }}
              />
              <span>{t.label}</span>
              {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
