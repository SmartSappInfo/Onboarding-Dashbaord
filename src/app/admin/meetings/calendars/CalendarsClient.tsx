'use client';

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { MeetingsNavigation } from '../components/MeetingsNavigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getCalendarConnectionsAction,
  disconnectCalendarConnectionAction,
  toggleCalendarConflictCheckAction,
  setPrimarySyncCalendarAction,
  getGoogleAuthUrlAction,
  getMicrosoftAuthUrlAction,
} from '@/app/actions/calendar-connection-actions';
import type { CalendarConnection } from '@/lib/meetings/types/calendar';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function CalendarsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [connections, setConnections] = React.useState<CalendarConnection[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchConnections = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getCalendarConnectionsAction(activeWorkspaceId);
      if (res.success && res.connections) {
        setConnections(res.connections);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error loading calendars',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleConnectGoogle = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await getGoogleAuthUrlAction(activeWorkspaceId, activeOrganizationId || '');
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error(res.error || 'Failed to generate Google auth URL');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Google Auth Error',
        description: getErrorMessage(err),
      });
    }
  };

  const handleConnectMicrosoft = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await getMicrosoftAuthUrlAction(activeWorkspaceId, activeOrganizationId, user?.uid);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error(res.error || 'Failed to generate Microsoft auth URL');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Microsoft Auth Error',
        description: getErrorMessage(err),
      });
    }
  };

  const handleToggleConflict = async (connectionId: string, current: boolean) => {
    setIsUpdating(true);
    try {
      const res = await toggleCalendarConflictCheckAction(connectionId, !current);
      if (res.success) {
        setConnections(prev =>
          prev.map(c => (c.id === connectionId ? { ...c, checkConflicts: !current } : c))
        );
        toast({
          title: !current ? 'Conflict Check Enabled' : 'Conflict Check Disabled',
          description: !current
            ? 'SmartSapp will now block booking slots during your external calendar busy times.'
            : 'SmartSapp will no longer check this calendar for booking conflicts.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetPrimary = async (connectionId: string) => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsUpdating(true);
    try {
      const res = await setPrimarySyncCalendarAction(connectionId, activeWorkspaceId, user.uid);
      if (res.success) {
        setConnections(prev =>
          prev.map(c => ({
            ...c,
            isPrimaryDestination: c.id === connectionId,
          }))
        );
        toast({
          title: 'Primary Calendar Updated',
          description: 'New bookings will now automatically be created on this calendar.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDisconnect = async (connection: CalendarConnection) => {
    if (!activeWorkspaceId) return;
    const ok = await confirm({
      title: 'Disconnect Calendar?',
      description: `Are you sure you want to disconnect ${connection.email}? Existing bookings will remain in SmartSapp, but future conflict checking and 2-way sync will cease.`,
      confirmText: 'Disconnect',
      variant: 'destructive',
    });

    if (!ok) return;

    setIsUpdating(true);
    try {
      const res = await disconnectCalendarConnectionAction(connection.id, activeWorkspaceId);
      if (res.success) {
        setConnections(prev => prev.filter(c => c.id !== connection.id));
        toast({
          title: 'Calendar Disconnected',
          description: `Successfully disconnected ${connection.email}.`,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Disconnect failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const googleConnections = connections.filter(c => c.provider === 'google_calendar');
  const microsoftConnections = connections.filter(c => c.provider === 'microsoft_outlook');

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Connected Calendars & Sync
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external calendars to prevent double-bookings and automatically sync confirmed appointments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConnections}
            disabled={isLoading || isUpdating}
            className="rounded-xl min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Information Banner */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Zero Double-Booking Guarantee</p>
          <p>
            When conflict checking is enabled, SmartSapp scans your external calendars in real time and automatically
            removes busy times from your public scheduling pages.
          </p>
        </div>
      </div>

      {/* Calendar Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Calendar Card */}
        <Card className="rounded-2xl border shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 font-bold text-lg">
                  G
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Google Calendar</CardTitle>
                  <CardDescription className="text-xs">Google Workspace & Gmail</CardDescription>
                </div>
              </div>
              <Button
                onClick={handleConnectGoogle}
                size="sm"
                className="rounded-xl min-h-[40px] gap-1.5 active:scale-[0.97]"
              >
                <Plus className="h-4 w-4" />
                Connect Google
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : googleConnections.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <CalendarDays className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-sm font-medium">No Google Calendars connected</p>
                <p className="text-xs max-w-xs mx-auto">
                  Connect your Google account to check for conflicts and sync meetings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {googleConnections.map(conn => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/10 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{conn.email}</p>
                          <p className="text-xs text-muted-foreground">{conn.calendarName || 'Primary Calendar'}</p>
                        </div>
                      </div>
                      {conn.isPrimaryDestination && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] uppercase font-bold">
                          Primary Sync
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`conflict-${conn.id}`}
                          checked={conn.checkConflicts}
                          onCheckedChange={() => handleToggleConflict(conn.id, conn.checkConflicts)}
                          disabled={isUpdating}
                        />
                        <label htmlFor={`conflict-${conn.id}`} className="cursor-pointer text-muted-foreground">
                          Check for conflicts
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        {!conn.isPrimaryDestination && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(conn.id)}
                            disabled={isUpdating}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Set Primary
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDisconnect(conn)}
                          disabled={isUpdating}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Microsoft Outlook Card */}
        <Card className="rounded-2xl border shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 font-bold text-lg">
                  M
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Microsoft Outlook</CardTitle>
                  <CardDescription className="text-xs">Office 365 & Microsoft Teams</CardDescription>
                </div>
              </div>
              <Button
                onClick={handleConnectMicrosoft}
                size="sm"
                className="rounded-xl min-h-[40px] gap-1.5 active:scale-[0.97]"
              >
                <Plus className="h-4 w-4" />
                Connect Outlook
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : microsoftConnections.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <CalendarDays className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-sm font-medium">No Outlook Calendars connected</p>
                <p className="text-xs max-w-xs mx-auto">
                  Connect your Microsoft account to sync appointments and detect conflicts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {microsoftConnections.map(conn => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/10 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-sky-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{conn.email}</p>
                          <p className="text-xs text-muted-foreground">{conn.calendarName || 'Default Calendar'}</p>
                        </div>
                      </div>
                      {conn.isPrimaryDestination && (
                        <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 text-[10px] uppercase font-bold">
                          Primary Sync
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`conflict-${conn.id}`}
                          checked={conn.checkConflicts}
                          onCheckedChange={() => handleToggleConflict(conn.id, conn.checkConflicts)}
                          disabled={isUpdating}
                        />
                        <label htmlFor={`conflict-${conn.id}`} className="cursor-pointer text-muted-foreground">
                          Check for conflicts
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        {!conn.isPrimaryDestination && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(conn.id)}
                            disabled={isUpdating}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Set Primary
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDisconnect(conn)}
                          disabled={isUpdating}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
