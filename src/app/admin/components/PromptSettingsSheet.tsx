'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getGlobalPromptById, getTenantOverrides, saveTenantOverride, deleteTenantOverride } from '@/lib/pms-repository';
import type { GlobalPrompt, TenantPromptOverride } from '@/lib/pms-types';
import { Loader2, Sparkles, Sliders, RotateCcw, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase';
interface PromptSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowName: string;
  organizationId: string;
  workspaceId: string;
}

export default function PromptSettingsSheet({
  open,
  onOpenChange,
  flowName,
  organizationId,
  workspaceId
}: PromptSettingsSheetProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const [globalPrompt, setGlobalPrompt] = React.useState<GlobalPrompt | null>(null);
  const [override, setOverride] = React.useState<TenantPromptOverride | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form
  const [title, setTitle] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [userPromptTemplate, setUserPromptTemplate] = React.useState('');

  const loadPromptData = React.useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    const [globalRes, overridesRes] = await Promise.all([
      getGlobalPromptById(flowName),
      getTenantOverrides(organizationId, workspaceId)
    ]);

    if (globalRes.success && globalRes.data) {
      setGlobalPrompt(globalRes.data);
      setTitle(globalRes.data.title);
      setSystemPrompt(globalRes.data.systemPrompt);
      setUserPromptTemplate(globalRes.data.userPromptTemplate);
    }

    if (overridesRes.success && overridesRes.data) {
      const matched = overridesRes.data.find((o: TenantPromptOverride) => o.flowName === flowName && o.isActive);
      if (matched) {
        setOverride(matched);
        setTitle(matched.title);
        setSystemPrompt(matched.systemPrompt);
        setUserPromptTemplate(matched.userPromptTemplate);
      } else {
        setOverride(null);
      }
    }
    setIsLoading(false);
  }, [flowName, organizationId, workspaceId]);

  React.useEffect(() => {
    if (open) {
      loadPromptData();
    }
  }, [open, loadPromptData]);

  const handleSave = async () => {
    setIsSaving(true);
    const docId = override?.id || `${organizationId}_${workspaceId || 'global'}_${flowName}`;
    const payload: Omit<TenantPromptOverride, 'id' | 'updatedAt' | 'version'> = {
      parentPromptId: flowName,
      organizationId,
      workspaceId: workspaceId || '',
      flowName,
      title: title || globalPrompt?.title || 'Entity Summary Override',
      description: globalPrompt?.description || '',
      category: globalPrompt?.category || 'general',
      tags: globalPrompt?.tags || [],
      systemPrompt,
      userPromptTemplate,
      variables: globalPrompt?.variables || [],
      aiModels: globalPrompt?.aiModels || ['googleai/gemini-2.0-flash'],
      status: 'production',
      isActive: true,
      updatedBy: user?.uid || 'admin'
    };

    const result = await saveTenantOverride(docId, payload, 'notes-sheet');
    if (result.success) {
      toast({ title: 'AI Brief prompt overrides updated.' });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Failed to update prompt overrides.', description: result.error });
    }
    setIsSaving(false);
  };

  const handleRevert = async () => {
    if (!override) return;
    setIsSaving(true);
    const result = await deleteTenantOverride(override.id);
    if (result.success) {
      toast({ title: 'Reverted to system default template.' });
      setOverride(null);
      loadPromptData();
    } else {
      toast({ variant: 'destructive', title: 'Failed to revert overrides.', description: result.error });
    }
    setIsSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-md w-[90vw] p-6 flex flex-col text-left bg-card border-border text-foreground">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-foreground font-bold">
            <Sliders className="h-5 w-5 text-indigo-500" />
            AI Prompt Settings
          </SheetTitle>
          <SheetDescription className="text-muted-foreground mt-1">
            Customize the system persona and user templates for the AI Intelligence Brief.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="flex-grow overflow-auto py-6 space-y-5 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Prompt Title</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-muted/30 border-border text-sm rounded-xl h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">System Rules (System Prompt)</label>
              <Textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="min-h-[120px] resize-none bg-muted/30 border-border text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">User Template</label>
              <Textarea
                value={userPromptTemplate}
                onChange={e => setUserPromptTemplate(e.target.value)}
                className="min-h-[140px] resize-none bg-muted/30 border-border text-sm rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Context placeholders: {globalPrompt?.variables.map((v: string) => <code key={v} className="bg-muted px-1 rounded mx-0.5">{`{{${v}}}`}</code>)}
              </p>

            </div>

            {override && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs leading-normal text-amber-400">
                  <span className="font-bold">Active Override Staged.</span> Changes apply instantly to all subsequent AI brief requests.
                </div>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="border-t pt-4 mt-auto flex flex-row items-center gap-2">
          {override && (
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={handleRevert}
              className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 h-10 px-4"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Revert
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10"
          >
            {isSaving ? 'Saving...' : 'Apply Overrides'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
