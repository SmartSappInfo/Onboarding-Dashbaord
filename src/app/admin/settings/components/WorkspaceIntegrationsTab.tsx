'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction } from '@/lib/workspace-actions';
import { Key, Smartphone, ShieldCheck, Loader2 } from 'lucide-react';

export interface WorkspaceIntegrationsTabProps {
  workspace: Workspace;
  onSaveSuccess: () => void;
}

export default function WorkspaceIntegrationsTab({ workspace, onSaveSuccess }: WorkspaceIntegrationsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [isSaving, setIsSaving] = React.useState(false);
  const [defaultSmsSenderId, setDefaultSmsSenderId] = React.useState(workspace.defaultSmsSenderId || '');

  React.useEffect(() => {
    setDefaultSmsSenderId(workspace.defaultSmsSenderId || '');
  }, [workspace]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate Sender ID character limits & patterns
    const senderId = defaultSmsSenderId.trim();
    if (senderId !== '') {
      if (senderId.length > 11) {
        toast({ variant: 'destructive', title: 'Validation Alert', description: 'Default SMS Sender ID must be at most 11 characters.' });
        return;
      }
      if (!/^[a-zA-Z0-9]+$/.test(senderId)) {
        toast({ variant: 'destructive', title: 'Validation Alert', description: 'Default SMS Sender ID must contain only alphanumeric characters.' });
        return;
      }
    }

    setIsSaving(true);
    try {
      const result = await saveWorkspaceAction(
        workspace.id,
        {
          defaultSmsSenderId: senderId || undefined,
        },
        user.uid
      );

      if (result.success) {
        toast({ title: 'Workspace Integrations Saved', description: 'SMS Sender configuration updated successfully.' });
        onSaveSuccess();
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({ variant: 'destructive', title: 'Error saving integrations', description: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden text-left">
      <CardHeader className="p-8 border-b">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          Workspace Integrations & AI
        </CardTitle>
        <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
          Configure default SMS sender profiles and gateway overrides for this hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* SMS Sender Configuration */}
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Default SMS Sender ID</Label>
              <Badge variant="outline" className="text-[8px] font-semibold uppercase px-1.5 h-4">Messaging</Badge>
            </div>
            
            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed px-1">
              Configure the default Sender ID for SMS dispatches sent from this workspace. 
              This ID is restricted by telecommunication regulations to a maximum of 11 alphanumeric characters. 
              If left blank, 'SmartSapp' will be used as default.
            </p>

            <div className="space-y-2 pt-2">
              <Input 
                value={defaultSmsSenderId} 
                onChange={e => {
                  const val = e.target.value;
                  // Allow alphanumeric characters only, max 11 chars
                  if (val === '' || /^[a-zA-Z0-9]{0,11}$/.test(val)) {
                    setDefaultSmsSenderId(val);
                  }
                }} 
                placeholder="e.g. SmartSapp" 
                className="h-11 rounded-xl bg-muted/20 border-none font-bold text-sm px-4 shadow-inner" 
              />
              {defaultSmsSenderId.length > 11 && (
                <p className="text-[10px] font-medium text-destructive px-1">Sender ID must be at most 11 characters.</p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4 max-w-2xl shadow-inner">
            <Smartphone className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-blue-900 ">Gateway Credentials</p>
              <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed tracking-tighter text-left">
                API keys and routing credentials (such as Gemini API, Resend, and mNotify API key) are governed globally by the organization settings to ensure centralized billing. 
                Sender profiles can be customized at the workspace level.
              </p>
            </div>
          </div>

          {/* Form Save Button Footer */}
          <div className="pt-6 border-t flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving || defaultSmsSenderId.length > 11} 
              className="rounded-xl font-semibold px-10 shadow-2xl bg-primary text-white text-xs h-12 active:scale-[0.97] transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving SMS Configs...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Save Workspace Integrations
                </>
              )}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
