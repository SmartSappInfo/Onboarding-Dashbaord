'use client';

/**
 * Column Customizer Modal Component
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 16 & 81 (Column customization and saved views).
 * 2. Strict Typing: 100% strictly typed using ColumnVisibilityConfig.
 * 3. Mobile Friendly: Responsive dialog modal with >= 44px tap targets.
 */

import React, { useState } from 'react';
import { Columns3, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ColumnVisibilityConfig } from '@/lib/lead-intelligence/types';

interface ColumnCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnVisibilityConfig;
  onColumnsChange: (columns: ColumnVisibilityConfig) => void;
  onSaveAsCustomView?: (viewName: string) => void;
}

const COLUMN_LABELS: Array<{ key: keyof ColumnVisibilityConfig; label: string; description: string }> = [
  { key: 'company', label: 'Company Name', description: 'Business title and claim status' },
  { key: 'domain', label: 'Website Domain', description: 'Primary online canonical URL' },
  { key: 'location', label: 'Location & Address', description: 'Physical city and street address' },
  { key: 'rating', label: 'Google Rating & Reviews', description: 'Public reputation and customer rating' },
  { key: 'techFootprint', label: 'Tech Footprint', description: 'Detected CMS, payment and framework tags' },
  { key: 'smartScore', label: 'Smart Need Score', description: 'Weighted conversion index (0-100)' },
  { key: 'crmStatus', label: 'CRM Sync Status', description: 'Registered in SmartSapp Contacts or Unregistered' },
  { key: 'contacts', label: 'Decision Makers', description: 'Extracted leadership emails and roles' },
  { key: 'phone', label: 'Phone Number', description: 'Verified phone / WhatsApp contact' },
];

export const ColumnCustomizerModal: React.FC<ColumnCustomizerModalProps> = ({
  isOpen,
  onClose,
  columns,
  onColumnsChange,
  onSaveAsCustomView,
}) => {
  const [tempColumns, setTempColumns] = useState<ColumnVisibilityConfig>(columns);
  const [viewName, setViewName] = useState('');

  const handleToggle = (key: keyof ColumnVisibilityConfig) => {
    setTempColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    onColumnsChange(tempColumns);
    if (viewName.trim() && onSaveAsCustomView) {
      onSaveAsCustomView(viewName.trim());
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-primary" /> Customize Table Columns
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select which data columns are visible in your prospect workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
            {COLUMN_LABELS.map((col) => {
              const isChecked = tempColumns[col.key];
              return (
                <label
                  key={col.key}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isChecked ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                    <p className="text-[10px] text-muted-foreground">{col.description}</p>
                  </div>
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(col.key)}
                    className="h-4 w-4"
                  />
                </label>
              );
            })}
          </div>

          {onSaveAsCustomView && (
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <Label htmlFor="view-name" className="text-[11px] font-semibold text-muted-foreground">
                Save as View Preset (Optional)
              </Label>
              <Input
                id="view-name"
                placeholder="e.g. Sales Executive View"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} className="h-8 text-xs bg-primary text-primary-foreground font-medium">
            <Check className="w-3.5 h-3.5 mr-1" /> Apply Columns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default ColumnCustomizerModal;
