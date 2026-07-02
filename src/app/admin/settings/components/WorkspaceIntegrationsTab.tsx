'use client';

import * as React from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Workspace, CalendarConnection } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { saveWorkspaceAction } from '@/lib/workspace-actions';
import { collection, query, where } from 'firebase/firestore';
import { 
  getGoogleAuthUrlAction, 
  getMicrosoftAuthUrlAction, 
  getZoomAuthUrlAction, 
  disconnectConnectionAction 
} from '@/app/actions/scheduler-actions';
import { 
  Key, 
  Smartphone, 
  ShieldCheck, 
  Loader2, 
  Calendar as CalendarIcon, 
  Video, 
  Link2, 
  Link2Off,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export interface WorkspaceIntegrationsTabProps {
  workspace: Workspace;
  onSaveSuccess: () => void;
}

export default function WorkspaceIntegrationsTab({ workspace, onSaveSuccess }: WorkspaceIntegrationsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [defaultSmsSenderId, setDefaultSmsSenderId] = React.useState(workspace.defaultSmsSenderId || '');
  const [loadingOAuth, setLoadingOAuth] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDefaultSmsSenderId(workspace.defaultSmsSenderId || '');
  }, [workspace]);

  // Query connections for this workspace
  const connectionsQuery = useMemoFirebase(() => 
    firestore && workspace.id 
      ? query(
          collection(firestore, 'calendar_connections'), 
          where('workspaceId', '==', workspace.id)
        ) 
      : null, 
  [firestore, workspace.id]);

  const { data: connections, isLoading: loadingConnections } = useCollection<CalendarConnection>(connectionsQuery);

  const googleConnection = React.useMemo(() => 
    connections?.find(c => c.provider === 'google_calendar'), 
  [connections]);

  const microsoftConnection = React.useMemo(() => 
    connections?.find(c => c.provider === 'microsoft_teams'), 
  [connections]);

  const zoomConnection = React.useMemo(() => 
    connections?.find(c => c.provider === 'zoom'), 
  [connections]);

  const handleOAuthConnect = async (provider: 'google' | 'microsoft' | 'zoom') => {
    setLoadingOAuth(provider);
    try {
      let res;
      const orgId = workspace.organizationId || '';
      
      if (provider === 'google') {
        res = await getGoogleAuthUrlAction(workspace.id, orgId);
      } else if (provider === 'microsoft') {
        res = await getMicrosoftAuthUrlAction(workspace.id, orgId);
      } else {
        res = await getZoomAuthUrlAction(workspace.id, orgId);
      }

      if (res.success && res.data) {
        window.location.href = res.data;
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Connection Error', 
          description: res.error || 'Failed to generate connection URL' 
        });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'OAuth request failed' 
      });
    } finally {
      setLoadingOAuth(null);
    }
  };

  const handleDisconnect = async (connectionId: string, providerName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${providerName}?`)) {
      return;
    }
    try {
      const res = await disconnectConnectionAction(connectionId);
      if (res.success) {
        toast({ 
          title: 'Disconnected', 
          description: `${providerName} disconnected successfully.` 
        });
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Disconnect Failed', 
          description: res.error 
        });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'Disconnect failed' 
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
    <div className="space-y-8 text-left">
      <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
        <CardHeader className="p-8 border-b">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Workspace Integrations & AI
          </CardTitle>
          <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
            Configure default SMS sender profiles and calendar/conferencing OAuth connections for this workspace hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          
          {/* Calendar & Conferencing Integrations */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-foreground">Calendar & Conferencing Connections</h3>
              <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 leading-relaxed max-w-xl">
                Connect external accounts to sync scheduled bookings, meetings, and check for calendar conflicts automatically.
              </p>
            </div>

            {loadingConnections ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">Checking connection status...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
                {/* 1. Google Calendar Card */}
                <Card className="border rounded-2xl p-5 bg-card/40 flex flex-col justify-between min-h-[160px] relative">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      {googleConnection ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[8px] border-none flex items-center gap-1">
                          <CheckCircle className="h-2.5 w-2.5" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground opacity-60">Disconnected</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">Google Calendar</h4>
                      <p className="text-[9px] font-semibold text-muted-foreground leading-relaxed">
                        Create Google Meet links and sync booking events automatically.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    {googleConnection ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(googleConnection.id, 'Google Calendar')}
                        className="w-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/20 h-9 rounded-xl active:scale-[0.97]"
                      >
                        <Link2Off className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingOAuth !== null}
                        onClick={() => handleOAuthConnect('google')}
                        className="w-full text-xs font-bold h-9 rounded-xl active:scale-[0.97] hover:border-primary/40"
                      >
                        {loadingOAuth === 'google' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Connect Account
                      </Button>
                    )}
                  </div>
                </Card>

                {/* 2. Microsoft Teams Card */}
                <Card className="border rounded-2xl p-5 bg-card/40 flex flex-col justify-between min-h-[160px] relative">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Video className="h-5 w-5" />
                      </div>
                      {microsoftConnection ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[8px] border-none flex items-center gap-1">
                          <CheckCircle className="h-2.5 w-2.5" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground opacity-60">Disconnected</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">Microsoft Teams</h4>
                      <p className="text-[9px] font-semibold text-muted-foreground leading-relaxed">
                        Create Microsoft Teams conferences directly on calendar slots.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    {microsoftConnection ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(microsoftConnection.id, 'Microsoft Teams')}
                        className="w-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/20 h-9 rounded-xl active:scale-[0.97]"
                      >
                        <Link2Off className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingOAuth !== null}
                        onClick={() => handleOAuthConnect('microsoft')}
                        className="w-full text-xs font-bold h-9 rounded-xl active:scale-[0.97] hover:border-primary/40"
                      >
                        {loadingOAuth === 'microsoft' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Connect Account
                      </Button>
                    )}
                  </div>
                </Card>

                {/* 3. Zoom Meetings Card */}
                <Card className="border rounded-2xl p-5 bg-card/40 flex flex-col justify-between min-h-[160px] relative">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                        <Video className="h-5 w-5" />
                      </div>
                      {zoomConnection ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[8px] border-none flex items-center gap-1">
                          <CheckCircle className="h-2.5 w-2.5" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground opacity-60">Disconnected</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">Zoom Meeting</h4>
                      <p className="text-[9px] font-semibold text-muted-foreground leading-relaxed">
                        Provision Zoom video URLs and store host/join credentials.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    {zoomConnection ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(zoomConnection.id, 'Zoom Meetings')}
                        className="w-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/20 h-9 rounded-xl active:scale-[0.97]"
                      >
                        <Link2Off className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingOAuth !== null}
                        onClick={() => handleOAuthConnect('zoom')}
                        className="w-full text-xs font-bold h-9 rounded-xl active:scale-[0.97] hover:border-primary/40"
                      >
                        {loadingOAuth === 'zoom' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Connect Account
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>

          <hr className="border-border/50" />

          {/* SMS Sender Configuration Form */}
          <form onSubmit={handleSave} className="space-y-8">
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
    </div>
  );
}
