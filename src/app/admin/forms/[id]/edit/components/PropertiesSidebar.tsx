'use client';

import * as React from 'react';
import type { FormFieldInstance, AppField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Trash2, Sliders, Type, HelpCircle, EyeOff, Check } from 'lucide-react';

interface PropertiesSidebarProps {
  selectedInstance: FormFieldInstance | null;
  appField: AppField | undefined;
  onUpdate: (instanceId: string, updates: Partial<FormFieldInstance>) => void;
  onRemove: (instanceId: string) => void;
  onClose: () => void;
}

export default function PropertiesSidebar({
  selectedInstance,
  appField,
  onUpdate,
  onRemove,
  onClose,
}: PropertiesSidebarProps) {
  // Local state buffers to prevent typing re-render waterfalls
  const [label, setLabel] = React.useState('');
  const [placeholder, setPlaceholder] = React.useState('');
  const [helpText, setHelpText] = React.useState('');
  const [defaultValue, setDefaultValue] = React.useState('');

  // Sync state when selection changes
  React.useEffect(() => {
    if (selectedInstance) {
      setLabel(selectedInstance.labelOverride ?? '');
      setPlaceholder(selectedInstance.placeholderOverride ?? '');
      setHelpText(selectedInstance.helpTextOverride ?? '');
      
      const defVal = selectedInstance.defaultValueOverride;
      setDefaultValue(typeof defVal === 'string' ? defVal : defVal ? JSON.stringify(defVal) : '');
    }
  }, [selectedInstance]);

  if (!selectedInstance || !appField) {
    return (
      <aside className="w-[320px] border-l bg-card/40 flex flex-col items-center justify-center p-6 text-center text-muted-foreground shrink-0 select-none">
        <Sliders className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <h4 className="font-semibold text-xs text-foreground/80">Properties Panel</h4>
        <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
          Select any field on the canvas to configure labels, placeholders, validation, and layout.
        </p>
      </aside>
    );
  }

  // Handle local text updates and sync on blur
  const handleBlurLabel = () => {
    onUpdate(selectedInstance.id, { labelOverride: label.trim() || undefined });
  };

  const handleBlurPlaceholder = () => {
    onUpdate(selectedInstance.id, { placeholderOverride: placeholder.trim() || undefined });
  };

  const handleBlurHelpText = () => {
    onUpdate(selectedInstance.id, { helpTextOverride: helpText.trim() || undefined });
  };

  const handleBlurDefaultValue = () => {
    let parsed: any = defaultValue.trim();
    if (!parsed) {
      onUpdate(selectedInstance.id, { defaultValueOverride: undefined });
      return;
    }
    // Attempt parsing numbers/JSON, fallback to raw string
    try {
      if (parsed === 'true') parsed = true;
      else if (parsed === 'false') parsed = false;
      else if (!isNaN(Number(parsed))) parsed = Number(parsed);
      else if (parsed.startsWith('{') || parsed.startsWith('[')) parsed = JSON.parse(parsed);
    } catch {
      // fallback to string
    }
    onUpdate(selectedInstance.id, { defaultValueOverride: parsed });
  };

  return (
    <aside className="w-[320px] border-l bg-card/40 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-foreground truncate">
            {label || appField.label}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
            {appField.variableName}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 text-left">
          {/* Label Override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Type className="h-3 w-3" /> Label Override
            </Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={handleBlurLabel}
              placeholder={appField.label}
              className="h-9 text-xs rounded-lg bg-background/50"
            />
          </div>

          {/* Placeholder Override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Sliders className="h-3 w-3" /> Placeholder Text
            </Label>
            <Input
              value={placeholder}
              onChange={e => setPlaceholder(e.target.value)}
              onBlur={handleBlurPlaceholder}
              placeholder={appField.placeholder || 'Enter value...'}
              className="h-9 text-xs rounded-lg bg-background/50"
            />
          </div>

          {/* Help Text Override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Help/Hint Text
            </Label>
            <Input
              value={helpText}
              onChange={e => setHelpText(e.target.value)}
              onBlur={handleBlurHelpText}
              placeholder={appField.helpText || 'Optional field instructions'}
              className="h-9 text-xs rounded-lg bg-background/50"
            />
          </div>

          {/* Default Value Override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Sliders className="h-3 w-3" /> Default Value
            </Label>
            <Input
              value={defaultValue}
              onChange={e => setDefaultValue(e.target.value)}
              onBlur={handleBlurDefaultValue}
              placeholder="Prepopulated value"
              className="h-9 text-xs rounded-lg bg-background/50"
            />
          </div>

          {/* Layout Options */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Width</Label>
              <Select
                value={selectedInstance.width || 'full'}
                onValueChange={v => onUpdate(selectedInstance.id, { width: v as any })}
              >
                <SelectTrigger className="h-9 rounded-lg text-xs bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="full">Full Width</SelectItem>
                  <SelectItem value="half">Half (50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Type</Label>
              <div className="h-9 border border-border/40 rounded-lg flex items-center px-3 text-xs bg-muted/20 text-muted-foreground select-none truncate">
                {appField.type.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Validation Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-background/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Required Field</Label>
                <p className="text-[9px] text-muted-foreground">Block submission if empty.</p>
              </div>
              <Switch
                checked={selectedInstance.required}
                onCheckedChange={v => onUpdate(selectedInstance.id, { required: v })}
                className="scale-90"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border bg-background/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> Hidden Field
                </Label>
                <p className="text-[9px] text-muted-foreground">Prepopulate value silently.</p>
              </div>
              <Switch
                checked={selectedInstance.hidden}
                onCheckedChange={v => onUpdate(selectedInstance.id, { hidden: v })}
                className="scale-90"
              />
            </div>
          </div>

          {/* Delete Action */}
          <div className="pt-6">
            <Button
              variant="destructive"
              className="w-full rounded-xl font-bold h-10 text-xs gap-2 shadow-sm"
              onClick={() => onRemove(selectedInstance.id)}
            >
              <Trash2 className="h-4 w-4" /> Remove Field
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
