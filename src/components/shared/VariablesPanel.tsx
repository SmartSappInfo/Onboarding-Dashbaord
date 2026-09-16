'use client';

import * as React from 'react';
import * as LucideIcons from 'lucide-react';
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
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import { cn } from '@/lib/utils';

/**
 * Type-safe Lucide icon resolver to avoid unchecked any property access.
 */
function getLucideIcon(iconName?: string): React.ComponentType<{ className?: string }> {
  if (!iconName) return LucideIcons.Database;
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[iconName] || LucideIcons.Database;
}

export interface VariableGroupBucket {
  id: string;
  name: string;
  order: number;
  iconName?: string;
  isPrimaryFeature?: boolean;
  variables: UnifiedVariable[];
}

export interface VariablesPanelProps {
  workspaceId: string;
  organizationId?: string;
  featureContext?: UnifiedVariable['featureContext'];
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
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const terminologySingular = terminology?.singular;
  const terminologyPlural = terminology?.plural;

  // Fetch variables
  const fetchVariables = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getVariablesAction({
        workspaceId,
        organizationId,
        featureContext,
        sourceId,
        terminology: terminologySingular && terminologyPlural ? { singular: terminologySingular, plural: terminologyPlural } : undefined,
      });
      setVariables(data);
    } catch (err) {
      console.error('[VariablesPanel] Failed to fetch variables:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, organizationId, featureContext, sourceId, terminologySingular, terminologyPlural]);

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

  // Group variables dynamically by field groups and purpose context
  const groupedVars = React.useMemo<VariableGroupBucket[]>(() => {
    const groupMap = new Map<string, VariableGroupBucket>();

    filteredVariables.forEach((v) => {
      // Determine canonical group name and metadata
      let groupName = v.groupName;
      let order = v.groupOrder ?? 50;
      let iconName = v.groupIcon;
      let isPrimaryFeature = false;

      // Classify dynamic template variables (e.g. from forms/surveys)
      if (v.source === 'dynamic_form') {
        groupName = groupName || 'Dynamic Form Questions';
        iconName = iconName || 'ClipboardList';
        order = 99;
      } else if (!groupName) {
        // Fallback categorization based on context
        if (v.featureContext === 'meeting') {
          groupName = 'Meeting Details';
          iconName = 'Calendar';
          order = 5;
        } else if (v.featureContext === 'survey') {
          groupName = 'Survey Details';
          iconName = 'ClipboardList';
          order = 5;
        } else if (v.featureContext === 'agreement' || v.featureContext === 'finance') {
          groupName = 'Agreement & Finance';
          iconName = 'FileText';
          order = 5;
        } else if (v.featureContext === 'task') {
          groupName = 'Task Details';
          iconName = 'CheckSquare';
          order = 5;
        } else if (v.featureContext === 'automation') {
          groupName = 'Automation Details';
          iconName = 'Activity';
          order = 5;
        } else if (v.featureContext === 'reminder') {
          groupName = 'Reminder Details';
          iconName = 'Clock';
          order = 5;
        } else if (v.featureContext === 'qr_code') {
          groupName = 'QR Code Details';
          iconName = 'QrCode';
          order = 5;
        } else if (v.featureContext === 'user') {
          groupName = 'User & Team';
          iconName = 'User';
          order = 5;
        } else {
          groupName = 'General Identity';
          iconName = 'User2';
          order = 10;
        }
      }

      // Check if this group matches the active template purpose / featureContext
      if (
        featureContext && 
        featureContext !== 'all' && 
        featureContext !== 'common' &&
        (v.featureContext === featureContext || (featureContext === 'agreement' && v.featureContext === 'finance'))
      ) {
        isPrimaryFeature = true;
        order = -100; // Pin to top
      }

      const groupId = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const existing = groupMap.get(groupId);

      if (existing) {
        existing.variables.push(v);
        if (isPrimaryFeature) existing.isPrimaryFeature = true;
      } else {
        groupMap.set(groupId, {
          id: groupId,
          name: groupName,
          order,
          iconName,
          isPrimaryFeature,
          variables: [v],
        });
      }
    });

    // Sort: Primary feature group first, then by order, then alphabetically by name
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.isPrimaryFeature && !b.isPrimaryFeature) return -1;
      if (!a.isPrimaryFeature && b.isPrimaryFeature) return 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }, [filteredVariables, featureContext]);

  // Auto-expand primary feature group and first common groups
  React.useEffect(() => {
    if (groupedVars.length > 0) {
      setOpenSections(prev => {
        const next = { ...prev };
        groupedVars.forEach((g, idx) => {
          if (next[g.id] === undefined) {
            next[g.id] = g.isPrimaryFeature || idx === 0 || idx === 1;
          }
        });
        return next;
      });
    }
  }, [groupedVars]);

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
        role="button"
        tabIndex={0}
        aria-label={`Insert variable tag ${v.label}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect(v.key);
          }
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', `{{${v.key}}}`);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        className="group relative flex flex-col justify-center min-h-[44px] p-2.5 rounded-lg border border-border bg-card/30 hover:bg-accent/85 hover:border-primary/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200 cursor-grab active:cursor-grabbing select-none active:scale-[0.97]"
        onClick={() => handleSelect(v.key)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {v.label}
            </span>
            {v.description && (
              <div className="relative group/tooltip flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
                <Info className="w-3.5 h-3.5" />
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-popover text-popover-foreground text-[10px] rounded border border-border shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50">
                  {v.description}
                </div>
              </div>
            )}
          </div>
          {isCopied ? (
            <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1 shrink-0 animate-fade-in">
              <Check className="w-3 h-3" /> Copied
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
              Click to insert
            </span>
          )}
        </div>
        
        <div className="mt-1 flex items-center justify-between gap-1">
          <code className="text-[11px] font-mono text-primary/70 group-hover:text-primary transition-colors duration-150 truncate">
            {`{{${v.key}}}`}
          </code>
          {v.isCustom && (
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              Custom
            </span>
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
            type="button"
            onClick={fetchVariables}
            className="min-h-[44px] min-w-[44px] p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors duration-150 active:scale-[0.97]"
            disabled={loading}
            title="Refresh variables"
            aria-label="Refresh variables"
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
            className="w-full min-h-[44px] pl-9 pr-4 py-2 text-xs bg-accent/40 rounded-lg border border-border hover:border-accent-foreground/20 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* Variables List / Dynamic Accordions */}
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
          groupedVars.map((group) => {
            const isOpen = openSections[group.id] ?? false;
            const IconComponent = getLucideIcon(group.iconName);
            const isContactGroup = group.id === 'contacts' || group.id === 'entity_contacts';

            return (
              <div
                key={group.id}
                className={cn(
                  "border rounded-lg overflow-hidden transition-all duration-200",
                  group.isPrimaryFeature
                    ? "border-primary/40 bg-primary/[0.03] shadow-sm"
                    : "border-border/80 bg-card/10"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(group.id)}
                  className={cn(
                    "w-full min-h-[44px] flex items-center justify-between p-3 text-xs font-bold transition-colors duration-150 active:scale-[0.99]",
                    group.isPrimaryFeature
                      ? "text-primary bg-primary/10 hover:bg-primary/15"
                      : "text-foreground bg-accent/20 hover:bg-accent/40"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    <IconComponent className={cn("w-3.5 h-3.5 shrink-0", group.isPrimaryFeature ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate">{group.name}</span>
                    {group.isPrimaryFeature && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider shrink-0">
                        Purpose
                      </span>
                    )}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground font-mono shrink-0">
                    {group.variables.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60 transition-all duration-300">
                    {group.variables.map(renderVariableItem)}

                    {/* Specific Contacts Toggle Switch inside Contacts Group */}
                    {isContactGroup && (
                      <div className="mt-2 pt-3 border-t border-border/60 flex items-center justify-between min-h-[44px]">
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          {showSpecificContacts ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                          Show specific roles & contacts
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showSpecificContacts}
                          aria-label="Show specific roles and contacts"
                          onClick={() => setShowSpecificContacts(!showSpecificContacts)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 active:scale-[0.97]",
                            showSpecificContacts ? 'bg-primary' : 'bg-muted-foreground/35'
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
                              showSpecificContacts ? 'translate-x-4' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
