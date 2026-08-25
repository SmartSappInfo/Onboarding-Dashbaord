'use client';

/**
 * @fileoverview Visual Conference Provider Card and Configuration Component for Meeting Occurrences.
 * Displays live conference status, join links, host controls, dial-in credentials, and provider settings.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  MapPin,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Phone,
  Settings,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ConferenceSession, ConferenceProvider } from '@/lib/meetings/types';
import { formatConferenceDetails } from '@/lib/meetings/conference-adapters';
import { createOrUpdateConferenceSessionAction } from '@/app/actions/conference-session-actions';

interface ConferenceSessionCardProps {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  title: string;
  session?: ConferenceSession | null;
  onSessionUpdated?: (session: ConferenceSession) => void;
}

export function ConferenceSessionCard({
  meetingId,
  workspaceId,
  organizationId,
  title,
  session,
  onSessionUpdated,
}: ConferenceSessionCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [provider, setProvider] = React.useState<ConferenceProvider>(
    session?.provider || 'google_meet'
  );
  const [customLink, setCustomLink] = React.useState(session?.joinUrl || '');
  const [physicalAddress, setPhysicalAddress] = React.useState(session?.physicalAddress || '');
  const [dialInPhone, setDialInPhone] = React.useState(session?.dialIn?.phone || '');
  const [dialInPin, setDialInPin] = React.useState(session?.dialIn?.pin || '');

  React.useEffect(() => {
    if (session) {
      setProvider(session.provider);
      setCustomLink(session.joinUrl || '');
      setPhysicalAddress(session.physicalAddress || '');
      setDialInPhone(session.dialIn?.phone || '');
      setDialInPin(session.dialIn?.pin || '');
    }
  }, [session]);

  const handleCopyLink = () => {
    if (!session?.joinUrl) return;
    navigator.clipboard.writeText(session.joinUrl);
    setCopied(true);
    toast({ title: 'Join URL Copied', description: 'Conference link copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await createOrUpdateConferenceSessionAction({
        meetingId,
        workspaceId,
        organizationId,
        provider,
        title,
        customLink: customLink.trim() || undefined,
        physicalAddress: physicalAddress.trim() || undefined,
        dialIn: dialInPhone.trim() ? { phone: dialInPhone.trim(), pin: dialInPin.trim() || undefined } : undefined,
      });

      if (res.success && res.session) {
        toast({ title: 'Conference Settings Updated', description: 'Provider settings saved successfully.' });
        setIsConfigOpen(false);
        if (onSessionUpdated) onSessionUpdated(res.session);
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: res.error || 'Failed to save.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save.';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const formatted = session ? formatConferenceDetails(session) : null;

  return (
    <>
      <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {formatted?.isPhysical ? <MapPin className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Conference & Location</CardTitle>
                <CardDescription className="text-xs">
                  {formatted ? formatted.providerLabel : 'Not configured'}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(true)}
              className="rounded-xl h-8 text-xs gap-1.5 active:scale-[0.97]"
            >
              <Settings className="w-3.5 h-3.5" /> Configure
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3 text-sm">
          {session ? (
            <>
              {formatted?.isPhysical ? (
                <div className="flex items-start gap-2 text-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs">Venue Location</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.physicalAddress || 'Physical address not specified.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-border">
                    <div className="truncate text-xs font-mono text-muted-foreground">
                      {session.joinUrl || 'No join URL configured'}
                    </div>
                    {session.joinUrl && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyLink}
                          className="h-7 w-7 rounded-lg active:scale-[0.97]"
                          title="Copy Link"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-7 w-7 rounded-lg active:scale-[0.97]"
                          title="Open Link"
                        >
                          <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>

                  {formatted?.dialInText && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span>{formatted.dialInText}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-xs text-muted-foreground">
              <p>No conference session assigned yet.</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setIsConfigOpen(true)}
                className="text-xs h-auto p-0 mt-1"
              >
                Set up location or video room
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Configure Conference & Location</DialogTitle>
            <DialogDescription>
              Select your video conferencing platform or set a physical meeting location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveConfig} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Location Type / Provider</Label>
              <Select
                value={provider}
                onValueChange={(val: ConferenceProvider) => setProvider(val)}
              >
                <SelectTrigger className="rounded-xl min-h-[44px]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="zoom">Zoom Meeting</SelectItem>
                  <SelectItem value="microsoft_teams">Microsoft Teams</SelectItem>
                  <SelectItem value="smart_sapp">SmartSapp Direct Video</SelectItem>
                  <SelectItem value="physical">In-Person / Physical Address</SelectItem>
                  <SelectItem value="custom">Custom Webhook / External Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {provider === 'physical' ? (
              <div className="space-y-2">
                <Label htmlFor="address-input" className="text-xs font-semibold">Physical Address / Venue</Label>
                <Input
                  id="address-input"
                  value={physicalAddress}
                  onChange={e => setPhysicalAddress(e.target.value)}
                  placeholder="e.g. Suite 400, 100 Main St, New York, NY"
                  className="rounded-xl min-h-[44px]"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="link-input" className="text-xs font-semibold">Meeting / Join URL</Label>
                <Input
                  id="link-input"
                  type="url"
                  value={customLink}
                  onChange={e => setCustomLink(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl min-h-[44px]"
                />
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Dial-In Details (Optional)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={dialInPhone}
                  onChange={e => setDialInPhone(e.target.value)}
                  placeholder="Phone number"
                  className="rounded-xl min-h-[44px]"
                />
                <Input
                  value={dialInPin}
                  onChange={e => setDialInPin(e.target.value)}
                  placeholder="PIN / Passcode"
                  className="rounded-xl min-h-[44px]"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsConfigOpen(false)}
                className="rounded-xl min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-xl min-h-[44px] px-6 active:scale-[0.97]"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Conference
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
