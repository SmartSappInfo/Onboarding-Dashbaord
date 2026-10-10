'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction } from '@/lib/workspace-actions';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { Palette, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';

export interface WorkspaceBrandingTabProps {
  workspace: Workspace;
  onSaveSuccess: () => void;
}

export default function WorkspaceBrandingTab({ workspace, onSaveSuccess }: WorkspaceBrandingTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [isSaving, setIsSaving] = React.useState(false);
  const [color, setColor] = React.useState(workspace.color || '#3B5FFF');

  React.useEffect(() => {
    setColor(workspace.color || '#3B5FFF');
  }, [workspace]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const result = await saveWorkspaceAction(
        workspace.id,
        {
          color: color.trim(),
        },
        user.uid
      );

      if (result.success) {
        toast({ title: 'Workspace Branding Saved', description: 'Theme colors updated successfully.' });
        onSaveSuccess();
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({ variant: 'destructive', title: 'Error saving branding', description: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-border/80 shadow-sm bg-card text-card-foreground overflow-hidden text-left">
      <CardHeader className="p-6 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-bold">
            Workspace Brand & Styling
          </CardTitle>
          <CardInfoTooltip text="Customize the aesthetic primary colors of this hub workspace." />
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSave} className="space-y-8">
          
          <div className="space-y-4 max-w-md">
            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Theme (Color)</Label>
            <div className="flex gap-4 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <button 
                    type="button" 
                    className="w-14 h-14 rounded-2xl border-2 shadow-md shrink-0 active:scale-95 transition-transform" 
                    style={{ backgroundColor: color, borderColor: color + '40' }} 
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 rounded-2xl border-none shadow-2xl" align="start">
                  <div className="grid grid-cols-6 gap-2">
                    {ONBOARDING_STAGE_COLORS.map(c => (
                      <button 
                        key={c} 
                        type="button" 
                        onClick={() => setColor(c)} 
                        className="w-7 h-7 rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-transform" 
                        style={{ backgroundColor: c }} 
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex-1 space-y-1">
                <div className="flex items-center rounded-xl bg-white dark:bg-card border border-border/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden px-3">
                  <span className="text-sm font-semibold text-muted-foreground mr-1">HEX</span>
                  <Input 
                    value={color} 
                    onChange={e => setColor(e.target.value)} 
                    className="h-11 bg-transparent border-none font-mono font-bold text-base focus-visible:ring-0 shadow-none px-0" 
                  />
                </div>
                <p className="text-[10px] font-medium text-muted-foreground ml-1">
                  Click the swatch or enter a hex color code to override the primary styling.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 max-w-2xl">
            <Palette className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-blue-950 dark:text-blue-200">Workspace Personalization</p>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed text-left">
                Theme colors are applied across header banners, metrics highlights, and workflow progress paths inside this workspace.
              </p>
            </div>
          </div>

          {/* Form Save Button Footer */}
          <div className="pt-6 border-t flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving || !color.trim()} 
              className="rounded-xl font-bold px-8 shadow-sm bg-primary text-primary-foreground text-xs h-11 active:scale-[0.97] transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Aesthetics...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Save Brand & Styling
                </>
              )}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
