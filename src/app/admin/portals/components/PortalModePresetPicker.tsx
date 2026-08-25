'use client';

/**
 * {{Org_name}} Experience Platform — Portal Mode Preset Picker
 *
 * Interactive visual catalog of the 17 Experience Modes with icons, tags,
 * and feature recommendations for quick portal scaffolding.
 */

import * as React from 'react';
import {
  GraduationCap,
  BookOpen,
  Crown,
  Users,
  FileCode,
  Library,
  Compass,
  FolderArchive,
  Newspaper,
  Megaphone,
  School,
  Award,
  UserCheck,
  Cpu,
  ShieldAlert,
  Hourglass,
  Sliders,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PORTAL_MODE_PRESETS } from '@/lib/services/portal-service';
import type { PortalMode, PortalModePreset } from '@/lib/types/portal';

interface PortalModePresetPickerProps {
  selectedMode: PortalMode;
  onSelectMode: (mode: PortalMode) => void;
}

const PRESET_ICONS: Record<PortalMode, React.ComponentType<{ className?: string }>> = {
  academy: GraduationCap,
  course: BookOpen,
  membership: Crown,
  community: Users,
  classroom: School,
  documentation: FileCode,
  knowledge_base: Library,
  blog: Newspaper,
  news: Megaphone,
  resource_center: FolderArchive,
  customer_academy: Compass,
  certification: Award,
  coaching: UserCheck,
  product_training: Cpu,
  internal_academy: ShieldAlert,
  waitlist: Hourglass,
  custom: Sliders,
};

export function PortalModePresetPicker({
  selectedMode,
  onSelectMode,
}: PortalModePresetPickerProps) {
  const presets = React.useMemo(() => Object.values(PORTAL_MODE_PRESETS), []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[420px] overflow-y-auto pr-1 p-1">
      {presets.map((preset: PortalModePreset) => {
        const IconComponent = PRESET_ICONS[preset.id] || Sliders;
        const isSelected = selectedMode === preset.id;

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectMode(preset.id)}
            className={cn(
              'relative flex flex-col items-start p-4 text-left rounded-2xl border-2 transition-all duration-200',
              'hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]',
              isSelected
                ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                  isSelected ? 'bg-primary text-white' : 'bg-muted text-foreground'
                )}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-border">
                  {preset.badge}
                </Badge>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>

            <h4 className="font-bold text-sm text-foreground mb-1 leading-tight">{preset.name}</h4>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {preset.tagline}
            </p>
          </button>
        );
      })}
    </div>
  );
}
