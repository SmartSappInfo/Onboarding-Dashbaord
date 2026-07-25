'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, Sheet, FormInput, FileText } from 'lucide-react';
import type { BuilderResources } from '@/lib/types';

interface ActionTargetModalProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly resources: BuilderResources;
  readonly onSelect: (action: 'receipt_request' | 'open_modal_form' | 'open_modal_survey' | 'open_modal_agreement', targetId: string) => void;
  readonly defaultTab?: 'form' | 'survey' | 'agreement';
}

/**
 * ActionTargetModal component renders a Radix-based dialog overlay allowing users
 * to select a modal overlay target (Form, Survey, Agreement) from the active workspace resources.
 * 
 * FUTURE MAINTENANCE NOTE:
 * - Ensure all new resource categories (e.g. Calendar bookings, Video player overlays) are mapped here.
 * - Review styling classes to ensure contrast matches editor themes.
 * - Testability: Ensure buttons trigger the correct callbacks with appropriate parameters.
 */
export function ActionTargetModal({ isOpen, onOpenChange, resources, onSelect, defaultTab }: ActionTargetModalProps) {
  const [search, setSearch] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'form' | 'survey' | 'agreement'>(defaultTab || 'form');

  // Sync activeTab when defaultTab changes or modal opens
  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Reset search when opening/closing
  React.useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const filteredForms = (resources.forms || []).filter(f => 
    (f.title || '').toLowerCase().includes(search.toLowerCase()) || 
    (f.internalName || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredSurveys = (resources.surveys || []).filter(s => 
    (s.title || '').toLowerCase().includes(search.toLowerCase()) || 
    (s.internalName || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredAgreements = (resources.agreements || []).filter(a => 
    (a.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-md font-bold text-white">Select Action Target</DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Pick the resource modal overlay that this CTA button triggers.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar input with search icon */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Category selection Tabs */}
        <div className="flex border-b border-slate-800 text-xs mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`pb-2 px-3 flex items-center gap-1.5 font-semibold transition-colors duration-150 ${activeTab === 'form' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FormInput className="h-3.5 w-3.5" /> Forms
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('survey')}
            className={`pb-2 px-3 flex items-center gap-1.5 font-semibold transition-colors duration-150 ${activeTab === 'survey' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Sheet className="h-3.5 w-3.5" /> Surveys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agreement')}
            className={`pb-2 px-3 flex items-center gap-1.5 font-semibold transition-colors duration-150 ${activeTab === 'agreement' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileText className="h-3.5 w-3.5" /> Agreements
          </button>
        </div>

        {/* Resources Scroll Area */}
        <div className="max-h-48 overflow-y-auto space-y-1 mt-3 pr-1 scrollbar-thin scrollbar-thumb-slate-850">
          {activeTab === 'form' && filteredForms.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onSelect('open_modal_form', f.id);
                onOpenChange(false);
              }}
              className="w-full text-left h-9 px-3 text-xs rounded-lg hover:bg-slate-800/80 transition-all flex items-center justify-between group active:scale-[0.99] border border-transparent hover:border-slate-700"
            >
              <span className="truncate pr-2">{f.title || f.internalName || f.id}</span>
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
            </button>
          ))}

          {activeTab === 'survey' && filteredSurveys.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect('open_modal_survey', s.id);
                onOpenChange(false);
              }}
              className="w-full text-left h-9 px-3 text-xs rounded-lg hover:bg-slate-800/80 transition-all flex items-center justify-between group active:scale-[0.99] border border-transparent hover:border-slate-700"
            >
              <span className="truncate pr-2">{s.title || s.internalName || s.id}</span>
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
            </button>
          ))}

          {activeTab === 'agreement' && filteredAgreements.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onSelect('open_modal_agreement', a.id);
                onOpenChange(false);
              }}
              className="w-full text-left h-9 px-3 text-xs rounded-lg hover:bg-slate-800/80 transition-all flex items-center justify-between group active:scale-[0.99] border border-transparent hover:border-slate-700"
            >
              <span className="truncate pr-2">{a.title || a.id}</span>
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
            </button>
          ))}

          {activeTab === 'form' && filteredForms.length === 0 && (
            <div className="text-[11px] text-slate-500 text-center py-6">No forms found matching search.</div>
          )}
          {activeTab === 'survey' && filteredSurveys.length === 0 && (
            <div className="text-[11px] text-slate-500 text-center py-6">No surveys found matching search.</div>
          )}
          {activeTab === 'agreement' && filteredAgreements.length === 0 && (
            <div className="text-[11px] text-slate-500 text-center py-6">No agreements found matching search.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
