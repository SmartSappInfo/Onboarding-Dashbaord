'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PageSection } from '@/lib/types';

interface PublishTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  section: PageSection | null;
  onSave: (name: string, category: string, visibility: string) => Promise<void>;
}

export default function PublishTemplateModal({
  isOpen,
  onOpenChange,
  section,
  onSave,
}: PublishTemplateModalProps) {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('Custom');
  const [visibility, setVisibility] = React.useState('workspace');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory('Custom');
      setVisibility('workspace');
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSave(name, category, visibility);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Publish Section Preset
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Save this section configuration to your template library for reuse across pages.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-name" className="text-xs font-semibold text-slate-300">
              Preset Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g. Hero Section - Summer Promo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500/50 text-slate-200 text-sm h-10 rounded-xl"
              required
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-category" className="text-xs font-semibold text-slate-300">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={submitting}
              >
                <SelectTrigger
                  id="template-category"
                  className="bg-slate-950 border-slate-800 focus:ring-emerald-500/50 text-slate-300 rounded-xl h-10"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                  <SelectItem value="Hero">Hero Sections</SelectItem>
                  <SelectItem value="CTA">Call to Actions</SelectItem>
                  <SelectItem value="Testimonials">Testimonials</SelectItem>
                  <SelectItem value="Custom">Custom Presets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-visibility" className="text-xs font-semibold text-slate-300">
                Sharing Level
              </Label>
              <Select
                value={visibility}
                onValueChange={setVisibility}
                disabled={submitting}
              >
                <SelectTrigger
                  id="template-visibility"
                  className="bg-slate-950 border-slate-800 focus:ring-emerald-500/50 text-slate-300 rounded-xl h-10"
                >
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                  <SelectItem value="workspace">Workspace Only</SelectItem>
                  <SelectItem value="organization">Organization-wide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl h-10 text-xs"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl h-10 px-4 text-xs transition-all active:scale-[0.97]"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Publishing...' : 'Publish Preset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
