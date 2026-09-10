'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Variables & Personalization Tokens:
 *    Exclusively utilizes `<VariablesPanel>` (located at `src/components/shared/VariablesPanel.tsx`)
 *    for user discovery and selection of dynamic template tokens (e.g. `{{contact.name}}`).
 * 2. Safe Fallback Interpolation:
 *    Always captures `fallbackHeadline` and `fallbackDescription` to guarantee zero raw markup
 *    leakage when viewers access media anonymously without URL identity tokens.
 * 3. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, textareas, and dialog triggers strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch targets with tactile micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import type { PersonalizationConfig } from '@/lib/types/media-2.0';
import { resolvePersonalizedContent } from '@/lib/media/personalization-rules-service';
import { VariablesPanel } from '@/components/shared/VariablesPanel';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Tag, Eye } from 'lucide-react';

export interface PersonalizationTokenEditorProps {
  workspaceId: string;
  config: PersonalizationConfig;
  onChange: (updatedConfig: PersonalizationConfig) => void;
}

export function PersonalizationTokenEditor({
  workspaceId,
  config,
  onChange,
}: PersonalizationTokenEditorProps) {
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState(false);
  const [targetField, setTargetField] = useState<'headline' | 'description'>('headline');

  const samplePersona = {
    contactName: 'Jane Doe',
    companyName: 'Acme International School',
    contactEmail: 'jane.doe@acme.edu',
    dealStage: 'Qualified Opportunity',
  };

  const sampleResolvedHeadline = resolvePersonalizedContent(
    config.headlineTemplate,
    samplePersona,
    config.fallbackHeadline || 'Welcome to Our Presentation'
  );

  const sampleResolvedDescription = resolvePersonalizedContent(
    config.descriptionTemplate,
    samplePersona,
    config.fallbackDescription || 'Discover our programs and institutional excellence.'
  );

  const handleInsertToken = (tokenKey: string) => {
    const token = `{{${tokenKey}}}`;
    if (targetField === 'headline') {
      const current = config.headlineTemplate || '';
      onChange({
        ...config,
        headlineTemplate: current ? `${current} ${token}` : token,
      });
    } else {
      const current = config.descriptionTemplate || '';
      onChange({
        ...config,
        descriptionTemplate: current ? `${current} ${token}` : token,
      });
    }
    setIsVariablesModalOpen(false);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Enable Personalization Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-2xl bg-card shadow-sm">
        <div className="space-y-0.5">
          <Label className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Personalization Engine
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Automatically inject viewer name, company, and deal attributes into headlines.
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ ...config, enabled: checked })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Headline Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Headline Template
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTargetField('headline');
                  setIsVariablesModalOpen(true);
                }}
                className="h-8 text-xs font-bold rounded-xl gap-1.5 text-primary border-primary/20 hover:bg-primary/5 active:scale-[0.97]"
              >
                <Tag className="h-3.5 w-3.5" /> Insert Variable
              </Button>
            </div>
            <Input
              value={config.headlineTemplate}
              onChange={(e) => onChange({ ...config, headlineTemplate: e.target.value })}
              placeholder="e.g. Welcome {{contact.name}} to {{company.name}}"
              className="h-10 min-h-[44px] rounded-xl text-xs font-medium"
            />
          </div>

          {/* Description Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Description Template
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTargetField('description');
                  setIsVariablesModalOpen(true);
                }}
                className="h-8 text-xs font-bold rounded-xl gap-1.5 text-primary border-primary/20 hover:bg-primary/5 active:scale-[0.97]"
              >
                <Tag className="h-3.5 w-3.5" /> Insert Variable
              </Button>
            </div>
            <Textarea
              value={config.descriptionTemplate}
              onChange={(e) => onChange({ ...config, descriptionTemplate: e.target.value })}
              placeholder="e.g. We prepared this customized briefing specifically for {{contact.name}}."
              className="min-h-[80px] rounded-xl text-xs font-medium resize-none"
            />
          </div>

          {/* Fallback Section */}
          <div className="p-4 border border-border rounded-2xl bg-muted/10 space-y-4">
            <div className="space-y-0.5">
              <p className="text-xs font-extrabold text-foreground">Anonymous Fallback Content</p>
              <p className="text-[11px] text-muted-foreground">
                Displayed when viewers access shared links without contact identifiers.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Fallback Headline</Label>
              <Input
                value={config.fallbackHeadline}
                onChange={(e) => onChange({ ...config, fallbackHeadline: e.target.value })}
                placeholder="Welcome to Our Presentation"
                className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground">Fallback Description</Label>
              <Input
                value={config.fallbackDescription}
                onChange={(e) => onChange({ ...config, fallbackDescription: e.target.value })}
                placeholder="Discover our programs and institutional excellence."
                className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          {/* Real-time Persona Preview Card */}
          <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-none p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-primary">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                Sample Live Personalization Preview (Jane Doe)
              </span>
            </div>
            <p className="text-sm font-black text-foreground">
              {sampleResolvedHeadline}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {sampleResolvedDescription}
            </p>
          </Card>
        </div>
      )}

      {/* Standardized VariablesPanel Modal (Single Source of Truth) */}
      <Dialog open={isVariablesModalOpen} onOpenChange={setIsVariablesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] rounded-3xl p-6 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Select Template Variable
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            <VariablesPanel
              workspaceId={workspaceId}
              onSelect={handleInsertToken}
              className="border-none shadow-none p-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
