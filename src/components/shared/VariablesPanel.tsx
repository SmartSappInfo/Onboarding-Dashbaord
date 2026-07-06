'use client';

import * as React from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Info, 
  Sparkles, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw 
} from 'lucide-react';
import type { UnifiedVariable } from '@/lib/types/variables';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service';

export interface VariablesPanelProps {
  workspaceId: string;
  organizationId?: string;
  featureContext?: 'common' | 'meeting' | 'form' | 'survey' | 'agreement' | 'campaign' | 'all';
  sourceId?: string;
  terminology?: { singular: string; plural: string };
  onSelect?: (key: string) => void;
  className?: string;
}

export function VariablesPanel({
  workspaceId,
  organizationId,
  featureContext = 'common',
  sourceId,
  terminology,
  onSelect,
  className = '',
}: VariablesPanelProps) {
  const [variables, setVariables] = React.useState<UnifiedVariable[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showSpecificContacts, setShowSpecificContacts] = React.useState<boolean>(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  
  // Accordion state
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    core: true,
    feature: true,
    custom: false,
    industry: false,
  });

  // Fetch variables
  const fetchVariables = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await FieldsVariablesService.getVariables({
        workspaceId,
        organizationId,
        featureContext,
        sourceId,
        terminology,
      });
      setVariables(data);
    } catch (err) {
      console.error('[VariablesPanel] Failed to fetch variables:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, organizationId, featureContext, sourceId, terminology]);

  React.useEffect(() => {
    fetchVariables();
  }, [fetchVariables]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Filter variables by search and category settings
  const filteredVariables = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return variables.filter((v) => {
      // 1. Filter out specific contacts if toggle is off
      if (v.category === 'contact_specific' && !showSpecificContacts) {
        return false;
      }

      // 2. Search match
      if (!query) return true;
      return (
        v.key.toLowerCase().includes(query) ||
        v.label.toLowerCase().includes(query) ||
        (v.description && v.description.toLowerCase().includes(query))
      );
    });
  }, [variables, searchQuery, showSpecificContacts]);

  // Group variables for layout
  const groupedVars = React.useMemo(() => {
    const groups = {
      core: [] as UnifiedVariable[],
      feature: [] as UnifiedVariable[],
      custom: [] as UnifiedVariable[],
      industry: [] as UnifiedVariable[],
    };

    filteredVariables.forEach((v) => {
      if (v.category === 'core' || v.category === 'contact_specific') {
        groups.core.push(v);
      } else if (v.category === 'feature') {
        groups.feature.push(v);
      } else if (v.category === 'custom') {
        groups.custom.push(v);
      } else if (v.category === 'industry') {
        groups.industry.push(v);
      }
    });

    return groups;
  }, [filteredVariables]);

  const handleSelect = (key: string) => {
    if (onSelect) {
      onSelect(`{{${key}}}`);
    } else {
      // Fallback: Copy to clipboard with success check animation
      navigator.clipboard.writeText(`{{${key}}}`).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      });
    }
  };

  const renderVariableItem = (v: UnifiedVariable) => {
    const isCopied = copiedKey === v.key;
    return (
      <div 
        key={v.key}
        className="group relative flex flex-col p-2.5 rounded-lg border border-border bg-card/40 hover:bg-accent/40 hover:border-accent-foreground/20 transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
        onClick={() => handleSelect(v.key)}
      >
        <div className="flex items-center justify-between">
          <code className="text-xs font-mono font-bold text-primary group-hover:text-primary-foreground transition-colors duration-150">
            {`{{${v.key}}}`}
          </code>
          {isCopied ? (
            <span className="text-[10px] text-green-500 font-semibold flex items-center gap-1 animate-fade-in">
              <Check className="w-3 h-3" /> Copied
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Click to insert
            </span>
          )}
        </div>
        
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {v.label}
          </span>
          {v.description && (
            <div className="relative group/tooltip flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Info className="w-3.5 h-3.5" />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-popover text-popover-foreground text-[10px] rounded border border-border shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50">
                {v.description}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-background border border-border rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Search Header */}
      <div className="p-4 border-b border-border bg-card/25 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <h3 className="font-semibold text-sm tracking-wide text-foreground">Available Variables</h3>
          </div>
          <button 
            onClick={fetchVariables}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            disabled={loading}
            title="Refresh variables"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search variable tags..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-accent/40 rounded-lg border border-border hover:border-accent-foreground/20 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* Variables List / Accordions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading unified registry...</span>
          </div>
        ) : filteredVariables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No active variables match your query.
          </div>
        ) : (
          <>
            {/* Core Section */}
            {groupedVars.core.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('core')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.core ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Core Identity & Contacts
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.core.length}
                  </span>
                </button>
                {openSections.core && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60 transition-all duration-300">
                    {groupedVars.core.map(renderVariableItem)}
                    
                    {/* Specific Contacts Toggle Switch */}
                    <div className="mt-2 pt-3 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        {showSpecificContacts ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                        Show specific roles & contacts
                      </span>
                      <button
                        onClick={() => setShowSpecificContacts(!showSpecificContacts)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-1 ${showSpecificContacts ? 'bg-primary' : 'bg-muted-foreground/35'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${showSpecificContacts ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feature System Section */}
            {groupedVars.feature.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('feature')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.feature ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    App & Feature Variables
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.feature.length}
                  </span>
                </button>
                {openSections.feature && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.feature.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}

            {/* Industry Specific Section */}
            {groupedVars.industry.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('industry')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.industry ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Industry Mapped Fields
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.industry.length}
                  </span>
                </button>
                {openSections.industry && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.industry.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}

            {/* Custom Variables Section */}
            {groupedVars.custom.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('custom')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.custom ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Workspace Custom Fields
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.custom.length}
                  </span>
                </button>
                {openSections.custom && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.custom.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
