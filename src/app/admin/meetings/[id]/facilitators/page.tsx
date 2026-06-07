'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useMeetingContext } from '../layout';
import type { MeetingFacilitator, MediaAsset } from '@/lib/types';
import { resendFacilitatorLinksAction } from '@/app/actions/meeting-facilitator-actions';
import { getPersonalizedMeetingUrl } from '@/lib/meeting-tokens';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Plus, 
  Camera, 
  Pencil, 
  Check, 
  X, 
  UserPlus, 
  Copy, 
  CopyCheck, 
  Send, 
  Trash2, 
  MoreHorizontal,
  Mail,
  Smartphone,
  Info,
  Loader2
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';

const CUSTOM_FACILITATOR_SENTINEL = '__add_custom__';

const getInitials = (name?: string) =>
  name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

export default function MeetingFacilitatorsPage() {
  const { activeOrganizationId } = useTenant();
  const firestore = useFirestore();
  const { toast } = useToast();
  const params = useParams();
  const meetingId = params.id as string;

  const { meeting, meetingDocRef } = useMeetingContext();

  const [copiedLinkId, setCopiedLinkId] = React.useState<string | null>(null);
  const [isSendingId, setIsSendingId] = React.useState<string | null>(null);
  const [isAddingCustom, setIsAddingCustom] = React.useState(false);
  const [customFacilitator, setCustomFacilitator] = React.useState({
    name: '', email: '', phone: '', role: '', bio: '', image: '',
  });

  // Load team users from the organization
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeOrganizationId)
    );
  }, [firestore, activeOrganizationId]);

  const { data: teamUsers, isLoading: isLoadingUsers } = useCollection<any>(usersQuery);

  // Derived: Available team members not yet added
  const availableTeamUsers = React.useMemo(() => {
    const facilitators = meeting?.facilitators || [];
    const filtered = (teamUsers || []).filter(
      (u: any) => !facilitators.some((f: any) => f.userId === u.id)
    );
    return filtered.sort((a: any, b: any) =>
      (a.name || a.email || '').localeCompare(b.name || b.email || '')
    );
  }, [teamUsers, meeting?.facilitators]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkId(type);
    toast({ title: "Link Copied!", description: "Saved to clipboard." });
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  // Add team member as facilitator
  const handleAddTeamMember = async (userId: string) => {
    if (userId === CUSTOM_FACILITATOR_SENTINEL) {
      setIsAddingCustom(true);
      return;
    }

    const selected = teamUsers?.find((u: any) => u.id === userId);
    if (!selected || !meetingDocRef) return;

    const currentFacs = meeting?.facilitators || [];
    if (currentFacs.some((f: any) => f.userId === userId)) return;

    // Generate unique ID
    const newId = Math.random().toString(36).substring(2, 9);
    const newFacilitator: MeetingFacilitator = {
      id: newId,
      type: 'workspace_user',
      userId: selected.id,
      name: selected.name || selected.email,
      email: selected.email,
      phone: selected.phone || '',
      role: selected.facilitatorRole || 'Facilitator',
      bio: selected.facilitatorBio || '',
      image: selected.photoURL || '',
      joinLink: Math.random().toString(36).substring(2, 12),
    };

    try {
      await updateDoc(meetingDocRef, {
        facilitators: [...currentFacs, newFacilitator]
      });
      toast({ title: 'Facilitator Added', description: `${newFacilitator.name} is now assigned.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to add', description: err.message });
    }
  };

  // Add custom presenter
  const handleAddCustomFacilitator = async () => {
    if (!customFacilitator.name || !meetingDocRef) return;

    const currentFacs = meeting?.facilitators || [];
    const newId = Math.random().toString(36).substring(2, 9);
    const newFacilitator: MeetingFacilitator = {
      id: newId,
      type: 'custom',
      name: customFacilitator.name,
      email: customFacilitator.email,
      phone: customFacilitator.phone,
      role: customFacilitator.role || 'External Presenter',
      bio: customFacilitator.bio,
      image: customFacilitator.image,
      joinLink: Math.random().toString(36).substring(2, 12),
    };

    try {
      await updateDoc(meetingDocRef, {
        facilitators: [...currentFacs, newFacilitator]
      });
      toast({ title: 'Presenter Added', description: `${newFacilitator.name} is now assigned.` });
      setIsAddingCustom(false);
      setCustomFacilitator({ name: '', email: '', phone: '', role: '', bio: '', image: '' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to add', description: err.message });
    }
  };

  // Update facilitator inline
  const handleUpdateFacilitator = async (facId: string, updates: Partial<MeetingFacilitator>) => {
    if (!meetingDocRef) return;
    const currentFacs = meeting?.facilitators || [];
    const updatedFacs = currentFacs.map((f: any) => {
      if (f.id === facId) {
        return { ...f, ...updates };
      }
      return f;
    });

    try {
      await updateDoc(meetingDocRef, { facilitators: updatedFacs });
      toast({ title: 'Profile Updated', description: 'Changes saved successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
  };

  // Delete facilitator
  const handleDeleteFacilitator = async (facId: string, name: string) => {
    if (!meetingDocRef) return;
    if (window.confirm(`Are you sure you want to remove ${name} as a facilitator?`)) {
      const currentFacs = meeting?.facilitators || [];
      const updatedFacs = currentFacs.filter((f: any) => f.id !== facId);

      try {
        await updateDoc(meetingDocRef, { facilitators: updatedFacs });
        toast({ title: 'Facilitator Removed', description: `${name} has been removed.` });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Removal failed', description: err.message });
      }
    }
  };

  // Resend linking template
  const handleResendLink = async (fac: MeetingFacilitator) => {
    setIsSendingId(fac.id);
    try {
      const result = await resendFacilitatorLinksAction(
        meeting.id,
        meeting.entityName || 'Meeting',
        [fac],
        meeting.workspaceIds?.[0] || 'onboarding'
      );
      if (result.success) {
        toast({ title: 'Invitation Sent', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Failed to send email', description: result.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSendingId(null);
    }
  };

  const handleResendAll = async () => {
    const facs = meeting?.facilitators || [];
    if (facs.length === 0) return;
    setIsSendingId('all');
    try {
      const result = await resendFacilitatorLinksAction(
        meeting.id,
        meeting.entityName || 'Meeting',
        facs,
        meeting.workspaceIds?.[0] || 'onboarding'
      );
      if (result.success) {
        toast({ title: 'Invitations Sent', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Failed to send emails', description: result.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSendingId(null);
    }
  };

  const facilitators = meeting?.facilitators || [];

  return (
    <div className="w-full space-y-6">
      {/* Upper Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Session Facilitators</h2>
        <div className="flex items-center gap-3">
          {facilitators.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-10 font-bold border-slate-200"
              onClick={handleResendAll}
              disabled={isSendingId !== null}
            >
              {isSendingId === 'all' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending to All...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Resend All Briefings
                </>
              )}
            </Button>
          )}

          {/* Quick Select Dropdown */}
          <Select onValueChange={handleAddTeamMember} value="">
            <SelectTrigger className="w-56 bg-background border-none ring-1 ring-border shadow-sm h-10 rounded-xl font-semibold text-xs text-left">
              <SelectValue placeholder="Add Presenter..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {availableTeamUsers.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Team Members
                  </div>
                  {availableTeamUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <SelectItem value={CUSTOM_FACILITATOR_SENTINEL} className="text-primary font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Custom Presenter...
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inline Composer Custom Facilitator */}
      {isAddingCustom && (
        <Card className="rounded-2xl border-none ring-1 ring-primary/20 bg-primary/[0.02] overflow-hidden">
          <CardHeader className="py-4 border-b border-primary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Add Custom Presenter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">Full Name *</Label>
                <Input
                  placeholder="e.g. Dr. John Doe"
                  value={customFacilitator.name}
                  onChange={(e) => setCustomFacilitator({ ...customFacilitator, name: e.target.value })}
                  className="rounded-xl h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">Designation / Role</Label>
                <Input
                  placeholder="e.g. Principal Presenter"
                  value={customFacilitator.role}
                  onChange={(e) => setCustomFacilitator({ ...customFacilitator, role: e.target.value })}
                  className="rounded-xl h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">Email Address</Label>
                <Input
                  type="email"
                  placeholder="name@organization.com"
                  value={customFacilitator.email}
                  onChange={(e) => setCustomFacilitator({ ...customFacilitator, email: e.target.value })}
                  className="rounded-xl h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500">WhatsApp / Phone Number</Label>
                <Input
                  placeholder="+1 (555) 019-2834"
                  value={customFacilitator.phone}
                  onChange={(e) => setCustomFacilitator({ ...customFacilitator, phone: e.target.value })}
                  className="rounded-xl h-10 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500">Brief Biography</Label>
              <Textarea
                placeholder="Write a brief profile description..."
                value={customFacilitator.bio}
                onChange={(e) => setCustomFacilitator({ ...customFacilitator, bio: e.target.value })}
                className="rounded-xl text-sm"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => setIsAddingCustom(false)}>Cancel</Button>
              <Button size="sm" className="rounded-xl font-bold px-5" onClick={handleAddCustomFacilitator} disabled={!customFacilitator.name}>Save Presenter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Facilitators List */}
      <div className="space-y-4">
        {facilitators.length === 0 ? (
          <div className="p-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 bg-muted/10">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No Presenters Assigned</p>
              <p className="text-xs text-muted-foreground">Assign team members or add custom profile cards to track briefings.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {facilitators.map((fac) => (
              <FacilitatorItemRow
                key={fac.id}
                fac={fac}
                meeting={meeting}
                copiedLinkId={copiedLinkId}
                isSendingId={isSendingId}
                onCopyLink={(link) => handleCopy(link, fac.id)}
                onResendLink={() => handleResendLink(fac)}
                onDelete={() => handleDeleteFacilitator(fac.id, fac.name)}
                onUpdate={(updates) => handleUpdateFacilitator(fac.id, updates)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact Facilitator Profile Card Component ──────────────────────────────
interface FacilitatorItemRowProps {
  fac: MeetingFacilitator;
  meeting: any;
  copiedLinkId: string | null;
  isSendingId: string | null;
  onCopyLink: (link: string) => void;
  onResendLink: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<MeetingFacilitator>) => void;
}

function FacilitatorItemRow({
  fac,
  meeting,
  copiedLinkId,
  isSendingId,
  onCopyLink,
  onResendLink,
  onDelete,
  onUpdate,
}: FacilitatorItemRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isMediaOpen, setIsMediaOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState(fac.name || '');
  const [draftRole, setDraftRole] = React.useState(fac.role || '');
  const [draftBio, setDraftBio] = React.useState(fac.bio || '');

  React.useEffect(() => {
    if (isEditing) {
      setDraftName(fac.name || '');
      setDraftRole(fac.role || '');
      setDraftBio(fac.bio || '');
    }
  }, [isEditing, fac]);

  const commitEdits = () => {
    if (
      draftName !== fac.name ||
      draftRole !== fac.role ||
      draftBio !== fac.bio
    ) {
      onUpdate({ name: draftName, role: draftRole, bio: draftBio });
    }
    setIsEditing(false);
  };

  const handleMediaSelect = (asset: MediaAsset) => {
    onUpdate({ image: asset.url });
    setIsMediaOpen(false);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullLink = getPersonalizedMeetingUrl(origin, meeting, fac.joinLink);
  const whatsappText = `Hello ${fac.name}, here is your unique presenter joining link for ${meeting?.heroTitle || 'the meeting'}: ${fullLink}`;
  const whatsappUrl = fac.phone
    ? `https://api.whatsapp.com/send?phone=${fac.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(whatsappText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

  return (
    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl bg-card overflow-hidden transition-all duration-200">
      <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Avatar Area with Selector Dialogue */}
          <div className="relative group shrink-0">
            <Avatar className="h-16 w-16 border rounded-full overflow-hidden shadow-sm">
              <AvatarImage src={fac.image} className="object-cover" />
              <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                {getInitials(fac.name)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => setIsMediaOpen(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              title="Change profile picture"
            >
              <Camera className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Profile Text Block */}
          <div className="space-y-1.5 flex-1 min-w-0 text-left">
            {isEditing ? (
              <div className="space-y-2.5 max-w-lg mt-1">
                <div className="flex gap-2">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Presenter Name"
                    className="h-8 text-xs font-semibold rounded-lg bg-background"
                  />
                  <Input
                    value={draftRole}
                    onChange={(e) => setDraftRole(e.target.value)}
                    placeholder="Role"
                    className="h-8 text-xs font-medium rounded-lg bg-background"
                  />
                </div>
                <Textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  placeholder="Biography profile text..."
                  className="text-xs rounded-lg bg-background"
                  rows={2}
                />
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 rounded-lg" onClick={commitEdits}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 rounded-lg" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {fac.name}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 border-none">
                    {fac.role || 'Presenter'}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditing(true)}
                    title="Edit Name/Bio"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                  {fac.bio || <span className="text-slate-400 italic">No Bio Specified</span>}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-0.5">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {fac.email || 'No Email'}</span>
                  {fac.phone && <span className="flex items-center gap-1"><Smartphone className="h-3 w-3 text-slate-400" /> {fac.phone}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          {/* Copy Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => onCopyLink(fullLink)}
            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50"
            title="Copy Joining Link"
          >
            {copiedLinkId === fac.id ? (
              <CopyCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-slate-600" />
            )}
          </Button>

          {/* WhatsApp Share Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(whatsappUrl, '_blank')}
            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-emerald-50/50"
            title="Share Link via WhatsApp"
          >
            <svg className="h-4 w-4 text-emerald-500 fill-emerald-500" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </Button>

          {/* Send Briefing Action Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onResendLink}
            disabled={isSendingId !== null}
            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50"
            title="Send Briefing Link"
          >
            {isSendingId === fac.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Send className="h-4 w-4 text-slate-600" />
            )}
          </Button>

          {/* Meatball Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
              <p className="text-[10px] font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">Presenter Management</p>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCopyLink(fullLink)} className="rounded-lg text-xs font-semibold">
                <Copy className="h-4 w-4 mr-2" /> Copy Joining Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(whatsappUrl, '_blank')} className="rounded-lg text-xs font-semibold">
                <svg className="h-4 w-4 mr-2 text-emerald-500 fill-emerald-500" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg> WhatsApp Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResendLink} disabled={isSendingId !== null} className="rounded-lg text-xs font-semibold text-primary focus:text-primary focus:bg-primary/5">
                <Send className="h-4 w-4 mr-2" /> Send Briefing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="rounded-lg text-xs font-bold text-destructive focus:bg-destructive/5">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Presenter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      {/* Media Selector Dialog */}
      <MediaSelectorDialog
        open={isMediaOpen}
        onOpenChange={setIsMediaOpen}
        onSelectAsset={handleMediaSelect}
      />
    </Card>
  );
}
