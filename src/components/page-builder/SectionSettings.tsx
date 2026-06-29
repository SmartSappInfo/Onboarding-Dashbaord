'use client';

/**
 * Section-level settings panel, driven by a `SECTION_FIELDS` descriptor and the
 * shared `FieldControl` (same controls as block props). Emits prop patches via
 * `onUpdate`, which the builder routes to `updateSectionProps`. The renderer
 * consumes `heading` and `background`.
 */
import { Label } from '@/components/ui/label';
import { SlidersHorizontal } from 'lucide-react';
import { FieldControl } from './AutoBlockEditor';
import type { BlockField } from '@/lib/page-builder/fields';
import type { BuilderResources, PageSection } from '@/lib/types';

export const SECTION_FIELDS: ReadonlyArray<BlockField> = [
  { kind: 'text', key: 'heading', label: 'Section Heading' },
  { kind: 'color', key: 'background', label: 'Background Color' },
];

const NO_RESOURCES: BuilderResources = { forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] };

interface SectionSettingsProps {
  section: PageSection;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function SectionSettings({ section, onUpdate }: SectionSettingsProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Section Settings</h4>
      </div>
      <div className="space-y-4">
        {SECTION_FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase">{field.label}</Label>
            <FieldControl field={field} value={section.props[field.key]} resources={NO_RESOURCES} onChange={(v) => onUpdate({ [field.key]: v })} />
          </div>
        ))}
      </div>
    </div>
  );
}
