'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus, Video, Phone, MapPin, Globe } from 'lucide-react';
import type { MeetingLocationType, EventTypeFormat } from '@/lib/meetings/types';
import { createEventTypeAction } from '@/app/actions/event-type-actions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function NewEventTypePage() {
  const router = useRouter();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [name, setName] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState(30);
  const [locationType, setLocationType] = React.useState<MeetingLocationType>('google_meet');
  const [locationDetails, setLocationDetails] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [format, setFormat] = React.useState<EventTypeFormat>('one_to_one');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Please enter an event type name.' });
      return;
    }
    if (!activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Error', description: 'No active workspace selected.' });
      return;
    }

    setIsCreating(true);
    try {
      const res = await createEventTypeAction(activeWorkspaceId, activeOrganizationId || 'default', {
        name: name.trim(),
        description: description.trim(),
        durationMinutes,
        locationType,
        locationDetails: locationDetails.trim() || undefined,
        format,
        status: 'active',
      });

      if (res.success && res.eventTypeId) {
        toast({ title: 'Event Type Created', description: 'Redirecting to event configuration...' });
        router.push(`/admin/meetings/event-types/${res.eventTypeId}/edit`);
      } else {
        toast({ variant: 'destructive', title: 'Creation Failed', description: res.error || 'Failed to create.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6 pb-16">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Link href="/admin/meetings/event-types">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Create New Event Type</h1>
            <p className="text-sm text-muted-foreground">
              Define a new bookable session for your schedule.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate}>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Event Details</CardTitle>
              <CardDescription>
                Enter the basic parameters to generate your public booking link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-name" className="text-sm font-semibold">
                  Event Name *
                </Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. 30-Minute Strategy Session"
                  className="rounded-xl min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="new-duration" className="text-sm font-semibold">
                    Duration
                  </Label>
                  <Select
                    value={String(durationMinutes)}
                    onValueChange={v => setDurationMinutes(parseInt(v, 10))}
                  >
                    <SelectTrigger id="new-duration" className="rounded-xl min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="20">20 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-format" className="text-sm font-semibold">
                    Format
                  </Label>
                  <Select
                    value={format}
                    onValueChange={(v: EventTypeFormat) => setFormat(v)}
                  >
                    <SelectTrigger id="new-format" className="rounded-xl min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="one_to_one">One-on-One (1:1)</SelectItem>
                      <SelectItem value="group">Group Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-loc-type" className="text-sm font-semibold">
                  Location Provider
                </Label>
                <Select
                  value={locationType}
                  onValueChange={(v: MeetingLocationType) => setLocationType(v)}
                >
                  <SelectTrigger id="new-loc-type" className="rounded-xl min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="zoom">Zoom Video</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="in_person">In-Person Address</SelectItem>
                    <SelectItem value="custom">Custom Online Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-desc" className="text-sm font-semibold">
                  Description (Optional)
                </Label>
                <Textarea
                  id="new-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide brief context for invitees..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Link href="/admin/meetings/event-types">
                  <Button type="button" variant="outline" className="rounded-xl min-h-[44px]">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl min-h-[44px] px-6 font-semibold gap-2 shadow-sm"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Continue to Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
}
