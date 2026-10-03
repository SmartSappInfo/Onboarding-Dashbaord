'use client';

/**
 * @fileoverview Physical Rooms & Equipment Resource Inventory for SmartSapp Meetings 2.0.
 *
 * ARCHITECTURE & DESIGN SYSTEM ALIGNMENT:
 * - Strictly conforms to theme.md §8 (Standardized Modal Architecture SSOT).
 * - Demarcated header with <CardInfoTooltip> and sr-only <DialogDescription>.
 * - Mobile touch targets >= 44px (or responsive sm:min-h-[36px]/[38px]).
 * - Rounded-2xl card surfaces with high-contrast borders.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  MapPin,
} from 'lucide-react';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getWorkspaceResourcesAction,
  saveWorkspaceResourceAction,
  deleteWorkspaceResourceAction,
} from '@/app/actions/meeting-resource-actions';
import type {
  MeetingRoomResource,
  MeetingResourceType,
} from '@/lib/meetings/types/resources';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function ResourcesClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [resources, setResources] = React.useState<MeetingRoomResource[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<MeetingResourceType>('boardroom');
  const [capacity, setCapacity] = React.useState('12');
  const [locationAddress, setLocationAddress] = React.useState('');
  const [floorBuilding, setFloorBuilding] = React.useState('');
  const [amenitiesInput, setAmenitiesInput] = React.useState('4K Screen, Video Bar, Whiteboard');
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchResources = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceResourcesAction(activeWorkspaceId);
      if (res.success && res.resources) {
        setResources(res.resources);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load resources',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspaceId) return;

    setIsSaving(true);
    try {
      const amenities = amenitiesInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await saveWorkspaceResourceAction({
        workspaceId: activeWorkspaceId,
        name: name.trim(),
        type,
        capacity: parseInt(capacity, 10) || 10,
        locationAddress: locationAddress.trim() || undefined,
        floorBuilding: floorBuilding.trim() || undefined,
        amenities,
      });

      if (res.success) {
        toast({ title: 'Resource Added!', description: `"${name}" is now available for in-person meetings.` });
        setModalOpen(false);
        setName('');
        setLocationAddress('');
        setFloorBuilding('');
        fetchResources();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: getErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await deleteWorkspaceResourceAction(id, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Resource deleted' });
        fetchResources();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.warn('[delete resource]', err);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: getErrorMessage(err),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with CardInfoTooltip (zero raw descriptions) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Physical Rooms & Resource Booking
          </h2>
          <CardInfoTooltip text="Manage physical boardrooms, broadcast studios, and shared equipment with automated double-booking prevention." />
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="rounded-xl min-h-[44px] gap-2 font-semibold shadow-sm active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Add Room / Resource
        </Button>
      </div>

      {/* Resource Cards */}
      {resources.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-12 text-center space-y-3">
          <Building2 className="h-12 w-12 mx-auto text-primary opacity-30 animate-pulse" />
          <h3 className="text-base font-semibold text-foreground">No physical rooms configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add physical meeting rooms or equipment to allow attendees to book in-person consultations.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Add First Resource
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(res => (
            <Card key={res.id} className="rounded-2xl border border-border/80 shadow-sm p-5 space-y-3 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{res.name}</h3>
                  <Badge variant="secondary" className="text-[10px] font-semibold mt-1 uppercase">
                    {res.type}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(res.id)}
                  className="h-9 w-9 min-h-[36px] min-w-[36px] text-rose-500 hover:text-rose-700 rounded-lg active:scale-[0.95]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/80">
                {res.capacity && (
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Capacity: {res.capacity} people
                  </p>
                )}
                {res.locationAddress && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {res.locationAddress} {res.floorBuilding ? `(${res.floorBuilding})` : ''}
                  </p>
                )}
              </div>

              {res.amenities && res.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-border/80">
                  {res.amenities.map((am, i) => (
                    <Badge key={i} variant="outline" className="text-[9px]">
                      {am}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Resource Modal (theme.md §8 Standardized Modal Architecture) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl max-w-md p-0 overflow-hidden font-figtree">
          <DialogHeader demarcated>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Add Physical Room / Resource
              </DialogTitle>
            </div>
            <CardInfoTooltip text="Configure physical meeting spaces, podcast studios, or equipment with address, capacity, and amenities." />
            <DialogDescription className="sr-only">
              Configure room details, location, and capacity for in-person meetings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Resource Name *</Label>
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Executive Boardroom A"
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground">Type</Label>
                <Select value={type} onValueChange={v => setType(v as MeetingResourceType)}>
                  <SelectTrigger className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="boardroom">Boardroom</SelectItem>
                    <SelectItem value="room">Meeting Room</SelectItem>
                    <SelectItem value="studio">Podcast / Video Studio</SelectItem>
                    <SelectItem value="equipment">Hardware Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground">Capacity</Label>
                <Input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Address / Building</Label>
              <Input
                value={locationAddress}
                onChange={e => setLocationAddress(e.target.value)}
                placeholder="e.g. 123 Innovation Drive, Accra"
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Floor / Suite</Label>
              <Input
                value={floorBuilding}
                onChange={e => setFloorBuilding(e.target.value)}
                placeholder="e.g. 3rd Floor, Suite 302"
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Amenities (Comma separated)</Label>
              <Input
                value={amenitiesInput}
                onChange={e => setAmenitiesInput(e.target.value)}
                placeholder="4K Screen, Video Bar, Whiteboard"
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs"
              />
            </div>

            {/* Demarcated Footer inside Form */}
            <div className="pt-4 border-t border-border/80 flex flex-row items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs px-4 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-xl min-h-[44px] sm:min-h-[36px] text-xs px-5 font-semibold active:scale-[0.97]"
              >
                {isSaving ? 'Saving...' : 'Save Resource'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
