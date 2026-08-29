'use client';

/**
 * Discovery Studio Landing Hero Component
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 12 (Discovery Hero Landing Page).
 * 2. Emil Kowalski Motion: Micro-scale hover effects (active:scale-[0.97]) and spring cards.
 * 3. Mobile First: Responsive 3-column bento card grid with min-h-[44px] touch controls.
 */

import React from 'react';
import { Sparkles, Search, FileSpreadsheet, ArrowRight, Layers, ShieldCheck, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DiscoveryStudioLandingProps {
  onSelectAIDiscovery: () => void;
  onSelectAdvancedSearch: () => void;
  onSelectCSVImport: () => void;
}

export const DiscoveryStudioLanding: React.FC<DiscoveryStudioLandingProps> = ({
  onSelectAIDiscovery,
  onSelectAdvancedSearch,
  onSelectCSVImport,
}) => {
  return (
    <div className="py-8 px-4 max-w-4xl mx-auto space-y-8 text-center">
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
          Discovery Studio 2.0
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          How would you like to discover prospects today?
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Choose a discovery path below to find verified businesses, extract decision-makers, and diagnose conversion opportunities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {/* Path 1: AI Conversational Discovery */}
        <div 
          onClick={onSelectAIDiscovery}
          className="group p-5 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-16 h-16 text-sky-400" />
          </div>
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 w-fit text-sky-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              ✦ AI Natural Discovery
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Describe your ideal customer in plain English. AI converts your intent into geo-targeted filters.
            </p>
          </div>
          <Button 
            size="sm" 
            className="w-full h-8 text-xs font-semibold bg-primary text-primary-foreground group-hover:bg-primary/90 active:scale-[0.97]"
          >
            Describe ICP <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>

        {/* Path 2: Advanced Criteria Search */}
        <div 
          onClick={onSelectAdvancedSearch}
          className="group p-5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/60 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Search className="w-16 h-16 text-blue-500" />
          </div>
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 w-fit text-blue-500">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-blue-500 transition-colors">
              Advanced Filter Search
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Build exact faceted criteria using industry, geographic bounds, review ratings, and tech signatures.
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-8 text-xs font-semibold group-hover:border-blue-500/40 active:scale-[0.97]"
          >
            Build Query <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>

        {/* Path 3: CSV Tabular Import */}
        <div 
          onClick={onSelectCSVImport}
          className="group p-5 rounded-2xl bg-card border border-border/80 hover:border-emerald-500/60 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileSpreadsheet className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit text-emerald-500">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-emerald-500 transition-colors">
              Import Spreadsheets
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bring your existing tabular leads or CSV files. Automatically map columns and enrich with AI.
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-8 text-xs font-semibold group-hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 active:scale-[0.97]"
          >
            Upload CSV <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Feature Highlights Ribbon */}
      <div className="pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span>Multi-vendor waterfall enrichment</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>SSRF-protected on-page tech scraper</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="w-4 h-4 text-blue-500 shrink-0" />
          <span>Direct transactional CRM ingestion</span>
        </div>
      </div>
    </div>
  );
};
export default DiscoveryStudioLanding;
