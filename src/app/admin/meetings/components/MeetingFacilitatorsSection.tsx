'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Users, Plus, X, Camera, Pencil, Check, UserPlus } from 'lucide-react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/context/TenantContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

// ─── Constants (rerender-no-inline-components) ───────────────────────
const CUSTOM_FACILITATOR_SENTINEL = '__add_custom__';

const getInitials = (name?: string) =>
  name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

// ─── Main Component ──────────────────────────────────────────────────

export function MeetingFacilitatorsSection() {
  const { activeOrganizationId } = useTenant();
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useFormContext();
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'facilitators',
  });

  const [isAddingCustom, setIsAddingCustom] = React.useState(false);
  const [customFacilitator, setCustomFacilitator] = React.useState({
    name: '', email: '', phone: '', role: '', bio: '', image: '',
  });

  // ── Data: Org users ──
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeOrganizationId),
    );
  }, [firestore, activeOrganizationId]);

  const { data: teamUsers, isLoading: isLoadingUsers } = useCollection(usersQuery);

  // ── Derived: available users not yet added ──
  const availableWorkspaceUsers = React.useMemo(() => {
    const filtered = (teamUsers || []).filter(
      (u: any) => !fields.some((f: any) => f.userId === u.id),
    );
    return filtered.sort((a: any, b: any) =>
      (a.name || a.email || '').localeCompare(b.name || b.email || ''),
    );
  }, [teamUsers, fields]);

  // ── Handlers ──
  const handleDropdownChange = React.useCallback((value: string) => {
    if (value === CUSTOM_FACILITATOR_SENTINEL) {
      setIsAddingCustom(true);
      return;
    }

    const selected = teamUsers?.find((u: any) => u.id === value);
    if (!selected) return;
    if (fields.some((f: any) => f.userId === value)) return;

    append({
      id: uuidv4(),
      type: 'workspace_user',
      userId: selected.id,
      name: selected.name || selected.email,
      email: selected.email,
      phone: selected.phone || '',
      role: selected.facilitatorRole || '',
      bio: selected.facilitatorBio || '',
      image: selected.photoURL || '',
      joinLink: uuidv4(),
    });
  }, [teamUsers, fields, append]);

  const handleAddCustom = React.useCallback(() => {
    if (!customFacilitator.name) return;

    append({
      id: uuidv4(),
      type: 'custom',
      name: customFacilitator.name,
      email: customFacilitator.email,
      phone: customFacilitator.phone,
      role: customFacilitator.role || 'External Facilitator',
      bio: customFacilitator.bio,
      image: customFacilitator.image,
      joinLink: uuidv4(),
    });

    setIsAddingCustom(false);
    setCustomFacilitator({ name: '', email: '', phone: '', role: '', bio: '', image: '' });
  }, [customFacilitator, append]);

  const handleUpdateFacilitatorField = React.useCallback(
    async (index: number, key: string, value: string) => {
      const field = fields[index] as any;
      const updated = { ...field, [key]: value };
      update(index, updated);

      // Persist facilitator profile fields back to user doc
      if (field.type === 'workspace_user' && field.userId && firestore) {
        const persistableKeys = ['facilitatorRole', 'facilitatorBio', 'photoURL'];
        const firestoreKey =
          key === 'role' ? 'facilitatorRole' :
          key === 'bio' ? 'facilitatorBio' :
          key === 'image' ? 'photoURL' : null;

        if (firestoreKey && persistableKeys.includes(firestoreKey)) {
          try {
            const userRef = doc(firestore, 'users', field.userId);
            await updateDoc(userRef, { [firestoreKey]: value, updatedAt: new Date().toISOString() });
          } catch {
            // Silently fail — the form state is already updated
          }
        }
      }
    },
    [fields, update, firestore],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-500" />
          Meeting Facilitators
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Select team members or add external facilitators. Each receives a unique join link for attendance tracking.
        </p>
      </div>

      {/* Unified Dropdown */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold text-muted-foreground/60">Add Facilitator</Label>
        <Select onValueChange={handleDropdownChange} disabled={isLoadingUsers} value="">
          <SelectTrigger className="w-full bg-muted/20 border-none shadow-none h-10 rounded-xl">
            <SelectValue placeholder={isLoadingUsers ? 'Loading team...' : 'Select team member or add custom...'} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {availableWorkspaceUsers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest">
                  Team Members
                </div>
                {availableWorkspaceUsers.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback className="text-[8px]">{getInitials(user.name || user.email)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{user.name || user.email}</span>
                      {user.facilitatorRole && (
                        <span className="text-[8px] text-muted-foreground/50 ml-auto">{user.facilitatorRole}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
            <div className="border-t mt-1 pt-1">
              <SelectItem value={CUSTOM_FACILITATOR_SENTINEL} className="text-primary font-bold">
                <span className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Add Custom Facilitator...
                </span>
              </SelectItem>
            </div>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Facilitator Inline Form */}
      {isAddingCustom && (
        <CustomFacilitatorForm
          value={customFacilitator}
          onChange={setCustomFacilitator}
          onSave={handleAddCustom}
          onCancel={() => { setIsAddingCustom(false); setCustomFacilitator({ name: '', email: '', phone: '', role: '', bio: '', image: '' }); }}
        />
      )}

      {/* Facilitator Cards */}
      {fields.length > 0 && (
        <div className="space-y-3 mt-2">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Assigned Facilitators ({fields.length})
          </Label>
          <div className="grid grid-cols-1 gap-3">
            {fields.map((field: any, index) => (
              <FacilitatorCard
                key={field.id}
                field={field}
                index={index}
                onRemove={remove}
                onUpdate={handleUpdateFacilitatorField}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Facilitator Card (hoisted per rerender-no-inline-components) ────

interface FacilitatorCardProps {
  field: any;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, key: string, value: string) => void;
}

function FacilitatorCard({ field, index, onRemove, onUpdate }: FacilitatorCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isMediaOpen, setIsMediaOpen] = React.useState(false);

  // Buffer edits locally so typing doesn't trigger useFieldArray.update() per-keystroke
  const [draftRole, setDraftRole] = React.useState(field.role || '');
  const [draftBio, setDraftBio] = React.useState(field.bio || '');

  // Sync drafts when entering edit mode
  const startEditing = React.useCallback(() => {
    setDraftRole(field.role || '');
    setDraftBio(field.bio || '');
    setIsEditing(true);
  }, [field.role, field.bio]);

  // Commit buffered edits to the parent
  const commitEdits = React.useCallback(() => {
    if (draftRole !== (field.role || '')) onUpdate(index, 'role', draftRole);
    if (draftBio !== (field.bio || '')) onUpdate(index, 'bio', draftBio);
    setIsEditing(false);
  }, [draftRole, draftBio, field.role, field.bio, index, onUpdate]);

  // Handle Enter key in the role input to commit
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdits();
    }
  }, [commitEdits]);

  const handleImageSelect = React.useCallback((asset: MediaAsset) => {
    onUpdate(index, 'image', asset.url);
    setIsMediaOpen(false);
  }, [index, onUpdate]);

  const hasProfileData = field.role || field.bio;

  return (
    <>
      <div className="group relative p-4 bg-muted/10 border border-border/40 rounded-2xl transition-all hover:border-border/70 hover:shadow-sm">
        <div className="flex gap-4">
          {/* Avatar — clickable to change */}
          <button
            type="button"
            onClick={() => setIsMediaOpen(true)}
            className="relative shrink-0 group/avatar"
            title="Click to change photo"
          >
            <Avatar className="h-16 w-16 rounded-xl ring-2 ring-border/30 shadow-sm transition-all group-hover/avatar:ring-primary/30">
              <AvatarImage src={field.image} className="object-cover" />
              <AvatarFallback className="rounded-xl text-sm font-bold bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700">
                {getInitials(field.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Presenter role, e.g. Keynote Speaker"
                  className="h-8 rounded-lg text-xs font-semibold bg-card border"
                  autoFocus
                />
                <Textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Short biography..."
                  className="min-h-[60px] rounded-lg text-xs bg-card border resize-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] font-bold text-primary gap-1"
                  onClick={commitEdits}
                >
                  <Check className="h-3 w-3" /> Done
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold tracking-tight truncate">{field.name}</p>
                  {field.type === 'custom' && (
                    <span className="bg-amber-500/15 text-amber-700 px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider font-bold shrink-0">
                      External
                    </span>
                  )}
                </div>
                {field.role ? (
                  <p className="text-[11px] font-semibold text-primary/80 tracking-tight">{field.role}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/40 italic">No presenter role set</p>
                )}
                {field.bio && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{field.bio}</p>
                )}
                {field.email && (
                  <p className="text-[9px] text-muted-foreground/50 mt-1 truncate">{field.email}</p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            {!isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5"
                onClick={startEditing}
                title="Edit facilitator details"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              onClick={() => onRemove(index)}
              title="Remove facilitator"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Media Library for avatar selection */}
      <MediaSelectorDialog
        open={isMediaOpen}
        onOpenChange={setIsMediaOpen}
        onSelectAsset={handleImageSelect}
        filterType="image"
        title="Select Facilitator Photo"
        description="Choose a profile photo from your media library."
      />
    </>
  );
}

// ─── Custom Facilitator Form (hoisted) ───────────────────────────────

interface CustomFacilitatorFormProps {
  value: { name: string; email: string; phone: string; role: string; bio: string; image: string };
  onChange: (v: any) => void;
  onSave: () => void;
  onCancel: () => void;
}

function CustomFacilitatorForm({ value, onChange, onSave, onCancel }: CustomFacilitatorFormProps) {
  const [isMediaOpen, setIsMediaOpen] = React.useState(false);

  const handleImageSelect = React.useCallback((asset: MediaAsset) => {
    onChange({ ...value, image: asset.url });
    setIsMediaOpen(false);
  }, [value, onChange]);

  return (
    <>
      <div className="p-4 bg-muted/10 border-2 border-dashed border-primary/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> New Custom Facilitator
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 text-[10px] text-muted-foreground">
            Cancel
          </Button>
        </div>

        <div className="flex gap-4">
          {/* Avatar picker */}
          <button
            type="button"
            onClick={() => setIsMediaOpen(true)}
            className="relative shrink-0 group/avatar"
            title="Click to add photo"
          >
            <Avatar className="h-16 w-16 rounded-xl ring-2 ring-dashed ring-primary/20 transition-all group-hover/avatar:ring-primary/40">
              <AvatarImage src={value.image} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-primary/5 text-primary/40">
                <Camera className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            {value.image && (
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-4 w-4 text-white" />
              </div>
            )}
          </button>

          {/* Fields */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground/60">Full Name *</Label>
              <Input
                className="h-8 rounded-lg text-xs"
                value={value.name}
                onChange={e => onChange({ ...value, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground/60">Presenter Role</Label>
              <Input
                className="h-8 rounded-lg text-xs"
                value={value.role}
                onChange={e => onChange({ ...value, role: e.target.value })}
                placeholder="Guest Speaker"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground/60">Email</Label>
              <Input
                className="h-8 rounded-lg text-xs"
                type="email"
                value={value.email}
                onChange={e => onChange({ ...value, email: e.target.value })}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground/60">Phone</Label>
              <Input
                className="h-8 rounded-lg text-xs"
                value={value.phone}
                onChange={e => onChange({ ...value, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-[10px] font-semibold text-muted-foreground/60">Bio</Label>
              <Textarea
                className="min-h-[50px] rounded-lg text-xs resize-none"
                value={value.bio}
                onChange={e => onChange({ ...value, bio: e.target.value })}
                placeholder="Short professional biography..."
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full rounded-xl h-9"
          onClick={onSave}
          disabled={!value.name.trim()}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Facilitator
        </Button>
      </div>

      <MediaSelectorDialog
        open={isMediaOpen}
        onOpenChange={setIsMediaOpen}
        onSelectAsset={handleImageSelect}
        filterType="image"
        title="Select Facilitator Photo"
        description="Choose a profile photo from your media library."
      />
    </>
  );
}
