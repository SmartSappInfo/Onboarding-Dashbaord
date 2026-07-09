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
  RefreshCw,
  MapPin,
  CreditCard,
  Heart,
  Settings2,
  ClipboardList,
  User2
} from 'lucide-react';
import type { UnifiedVariable } from '@/lib/types/variables';
import { getVariablesAction } from '@/lib/services/fields-variables-service';

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
    generalIdentity: true,
    regionalMetadata: false,
    financialConfiguration: false,
    interests: false,
    customFields: false,
    dynamicFeature: false,
  });

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

  // Group variables for layout
  const groupedVars = React.useMemo(() => {
    const groups = {
      generalIdentity: [] as UnifiedVariable[],
      regionalMetadata: [] as UnifiedVariable[],
      financialConfiguration: [] as UnifiedVariable[],
      interests: [] as UnifiedVariable[],
      customFields: {
        currentSituation: [] as UnifiedVariable[],
        onlinePresence: [] as UnifiedVariable[],
        general: [] as UnifiedVariable[],
      },
      dynamicFeature: [] as UnifiedVariable[],
    };

    filteredVariables.forEach((v) => {
      const key = v.key.toLowerCase();
      
      // Classify dynamic template variables (e.g. from forms/surveys)
      if (v.source === 'dynamic_form' || v.category === 'feature') {
        groups.dynamicFeature.push(v);
        return;
      }

      // 1. General Identity
      const isGeneralIdentity = 
        v.category === 'core' || 
        v.category === 'contact_specific' ||
        v.source === 'contact_role' ||
        key.includes('name') || 
        key.includes('email') || 
        key.includes('phone') || 
        key.includes('initials') || 
        key.includes('slogan') || 
        key.includes('motto') || 
        key.includes('tag') || 
        key.includes('status') ||
        key.includes('year') ||
        key.includes('date') ||
        key.includes('time') ||
        key.includes('user') ||
        key.includes('logo') ||
        key.includes('organization') ||
        key.includes('workspace');

      if (isGeneralIdentity) {
        groups.generalIdentity.push(v);
        return;
      }

      // 2. Regional Metadata
      const isRegional = 
        key.includes('location') || 
        key.includes('zone') || 
        key.includes('address') || 
        key.includes('latitude') || 
        key.includes('longitude') || 
        key.includes('gps') || 
        key.includes('city') || 
        key.includes('country') || 
        key.includes('region') || 
        key.includes('state') || 
        key.includes('suburb');

      if (isRegional) {
        groups.regionalMetadata.push(v);
        return;
      }

      // 3. Financial Configuration
      const isFinancial = 
        key.includes('subscription') || 
        key.includes('currency') || 
        key.includes('discount') || 
        key.includes('rate') || 
        key.includes('billing') || 
        key.includes('arrears') || 
        key.includes('credit') || 
        key.includes('balance') || 
        key.includes('package') || 
        key.includes('price') || 
        key.includes('fee') || 
        key.includes('bank') || 
        key.includes('account') || 
        key.includes('payment') || 
        key.includes('capacity');

      if (isFinancial) {
        groups.financialConfiguration.push(v);
        return;
      }

      // 4. Interests
      const isInterests = 
        key.includes('interest') || 
        key.includes('module') || 
        key.includes('subject') || 
        key.includes('preference') || 
        key.includes('topic');

      if (isInterests) {
        groups.interests.push(v);
        return;
      }

      // 5. Custom Fields: Current Situation & Online Presence
      if (v.source === 'custom_field' || v.category === 'custom') {
        const isOnlinePresence = 
          key.includes('website') || 
          key.includes('online') || 
          key.includes('presence') || 
          key.includes('facebook') || 
          key.includes('instagram') || 
          key.includes('linkedin') || 
          key.includes('twitter') || 
          key.includes('youtube') || 
          key.includes('social') || 
          key.includes('handle');

        const isCurrentSituation = 
          key.includes('situation') || 
          key.includes('challenge') || 
          key.includes('objective') || 
          key.includes('goal') || 
          key.includes('current') || 
          key.includes('status') || 
          key.includes('needs') || 
          key.includes('requirement');

        if (isOnlinePresence) {
          groups.customFields.onlinePresence.push(v);
        } else if (isCurrentSituation) {
          groups.customFields.currentSituation.push(v);
        } else {
          groups.customFields.general.push(v);
        }
        return;
      }

      // Fallback
      groups.generalIdentity.push(v);
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
        className="group relative flex flex-col p-2.5 rounded-lg border border-border bg-card/30 hover:bg-accent/85 hover:border-primary/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.98]"
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
        
        <div className="mt-1">
          <code className="text-[11px] font-mono text-primary/70 group-hover:text-primary transition-colors duration-150">
            {`{{${v.key}}}`}
          </code>
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
            {/* General Identity Section */}
            {groupedVars.generalIdentity.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('generalIdentity')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.generalIdentity ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <User2 className="w-3.5 h-3.5 text-primary" />
                    General Identity & Contacts
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.generalIdentity.length}
                  </span>
                </button>
                {openSections.generalIdentity && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60 transition-all duration-300">
                    {groupedVars.generalIdentity.map(renderVariableItem)}
                    
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

            {/* Regional Metadata Section */}
            {groupedVars.regionalMetadata.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('regionalMetadata')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.regionalMetadata ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    Regional Metadata
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.regionalMetadata.length}
                  </span>
                </button>
                {openSections.regionalMetadata && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.regionalMetadata.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}

            {/* Financial Configuration Section */}
            {groupedVars.financialConfiguration.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('financialConfiguration')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.financialConfiguration ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                    Financial Configuration
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.financialConfiguration.length}
                  </span>
                </button>
                {openSections.financialConfiguration && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.financialConfiguration.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}

            {/* Interests Section */}
            {groupedVars.interests.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('interests')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.interests ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    Interests
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.interests.length}
                  </span>
                </button>
                {openSections.interests && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.interests.map(renderVariableItem)}
                  </div>
                )}
              </div>
            )}

            {/* Workspace Custom Fields Section */}
            {(groupedVars.customFields.currentSituation.length > 0 ||
              groupedVars.customFields.onlinePresence.length > 0 ||
              groupedVars.customFields.general.length > 0) && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('customFields')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.customFields ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <Settings2 className="w-3.5 h-3.5 text-blue-500" />
                    Workspace Custom Fields
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.customFields.currentSituation.length +
                      groupedVars.customFields.onlinePresence.length +
                      groupedVars.customFields.general.length}
                  </span>
                </button>
                {openSections.customFields && (
                  <div className="p-3 border-t border-border/60 space-y-4">
                    {/* Current Situation Sub-category */}
                    {groupedVars.customFields.currentSituation.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Situation</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {groupedVars.customFields.currentSituation.map(renderVariableItem)}
                        </div>
                      </div>
                    )}

                    {/* Online Presence Sub-category */}
                    {groupedVars.customFields.onlinePresence.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-dashed border-border/60">
                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Online Presence</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {groupedVars.customFields.onlinePresence.map(renderVariableItem)}
                        </div>
                      </div>
                    )}

                    {/* General Custom Fields */}
                    {groupedVars.customFields.general.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-dashed border-border/60">
                        {(groupedVars.customFields.currentSituation.length > 0 || groupedVars.customFields.onlinePresence.length > 0) && (
                          <div className="flex items-center gap-1.5 px-1 py-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Other Custom Fields</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-2">
                          {groupedVars.customFields.general.map(renderVariableItem)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Form & Survey Variables Section */}
            {groupedVars.dynamicFeature.length > 0 && (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card/10">
                <button
                  onClick={() => toggleSection('dynamicFeature')}
                  className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground bg-accent/20 hover:bg-accent/40 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {openSections.dynamicFeature ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <ClipboardList className="w-3.5 h-3.5 text-purple-500" />
                    Form & Survey Variables
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-border text-muted-foreground">
                    {groupedVars.dynamicFeature.length}
                  </span>
                </button>
                {openSections.dynamicFeature && (
                  <div className="p-3 grid grid-cols-1 gap-2 border-t border-border/60">
                    {groupedVars.dynamicFeature.map(renderVariableItem)}
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
