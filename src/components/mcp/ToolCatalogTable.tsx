/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Governed MCP Tool Catalog Table
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Tool Governance:
 *    - Displays registered MCP tools, risk classifications, and policy states.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Interactive elements have minimum touch targets of >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]` and smooth hover transitions.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed props and handlers.
 */

'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Play, Shield, ShieldAlert, Cpu, SlidersHorizontal } from 'lucide-react';
import type { GovernedToolInfo } from '@/lib/mcp/actions/mcp-governance-actions';
import type { McpCategory, McpRiskLevel } from '@/lib/mcp/types';

export interface ToolCatalogTableProps {
  tools: GovernedToolInfo[];
  onRunTool: (tool: GovernedToolInfo) => void;
  onToggleToolEnabled: (toolName: string, enabled: boolean) => Promise<void>;
  onToggleApprovalRequired: (toolName: string, requiresApproval: boolean) => Promise<void>;
  isLoading?: boolean;
}

const CATEGORIES: Array<{ id: 'all' | McpCategory; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'memory', label: 'Memory' },
  { id: 'context', label: 'Context' },
  { id: 'crm', label: 'CRM' },
  { id: 'deal', label: 'Deals' },
  { id: 'task', label: 'Tasks' },
];

export function ToolCatalogTable({
  tools,
  onRunTool,
  onToggleToolEnabled,
  onToggleApprovalRequired,
  isLoading = false,
}: ToolCatalogTableProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<'all' | McpCategory>('all');

  const filteredTools = React.useMemo(() => {
    return tools.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || tool.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [tools, searchQuery, selectedCategory]);

  const getRiskBadge = (risk: McpRiskLevel) => {
    switch (risk) {
      case 'read_only':
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-medium text-xs">
            READ ONLY
          </Badge>
        );
      case 'low_risk':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-medium text-xs">
            LOW RISK
          </Badge>
        );
      case 'high_risk':
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-medium text-xs">
            HIGH RISK
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 font-medium text-xs">
            CRITICAL
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name or description..."
            className="pl-9 min-h-[44px] bg-white border-slate-200 text-sm focus:border-indigo-500 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all min-h-[44px] shrink-0 active:scale-[0.97] ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[300px] text-xs font-semibold uppercase text-slate-500">Tool Capability</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Category</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Risk Tier</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Human Approval</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-slate-500">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase text-slate-500">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Cpu className="w-8 h-8 text-slate-300" />
                    <p className="font-medium text-slate-700">No tools found</p>
                    <p className="text-xs text-slate-400">Try adjusting your search or category filter.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTools.map((tool) => (
                <TableRow key={tool.name} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">{tool.name}</span>
                        <span className="text-[11px] font-mono text-slate-400">v{tool.version}</span>
                        {tool.isCustomPolicy && (
                          <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-100 text-slate-600 px-1.5 py-0">
                            Custom Policy
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{tool.description}</p>
                    </div>
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
                      {tool.category}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    {getRiskBadge(tool.riskLevel)}
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tool.requiresApproval}
                        onCheckedChange={(checked) => onToggleApprovalRequired(tool.name, checked)}
                        aria-label={`Toggle approval requirement for ${tool.name}`}
                      />
                      <span className="text-xs text-slate-600 font-medium">
                        {tool.requiresApproval ? 'Required' : 'Automatic'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tool.enabled}
                        onCheckedChange={(checked) => onToggleToolEnabled(tool.name, checked)}
                        aria-label={`Toggle enabled state for ${tool.name}`}
                      />
                      <span className={`text-xs font-medium ${tool.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {tool.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right py-3">
                    <Button
                      size="sm"
                      onClick={() => onRunTool(tool)}
                      disabled={!tool.enabled || isLoading}
                      className="min-h-[44px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg active:scale-[0.97] transition-transform"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Run Tool
                    </Button>
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
