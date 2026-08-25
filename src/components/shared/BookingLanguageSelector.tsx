'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import type { SupportedMeetingLocale } from '@/lib/meetings/types/localization';

interface BookingLanguageSelectorProps {
  currentLocale: SupportedMeetingLocale;
  onLocaleChange: (locale: SupportedMeetingLocale) => void;
  className?: string;
}

export function BookingLanguageSelector({
  currentLocale,
  onLocaleChange,
  className,
}: BookingLanguageSelectorProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className || ''}`}>
      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select
        value={currentLocale}
        onValueChange={v => onLocaleChange(v as SupportedMeetingLocale)}
      >
        <SelectTrigger className="h-8 rounded-xl text-xs font-semibold px-2.5 bg-muted/30 border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl text-xs">
          <SelectItem value="en">🇺🇸 English</SelectItem>
          <SelectItem value="fr">🇫🇷 Français</SelectItem>
          <SelectItem value="es">🇪🇸 Español</SelectItem>
          <SelectItem value="pt">🇵🇹 Português</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
