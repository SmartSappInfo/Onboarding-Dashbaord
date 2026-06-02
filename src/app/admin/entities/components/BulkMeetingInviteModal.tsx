'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarRange, Mail } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { bulkRegisterParticipantsAction } from '@/app/actions/bulk-meeting-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface BulkMeetingInviteModalProps {
  entityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  preSelectedContactIds?: string[];
}

export default function BulkMeetingInviteModal({
  entityIds,
  open,
  onOpenChange,
  onComplete,
  preSelectedContactIds,
}: BulkMeetingInviteModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [meetingId, setMeetingId] = React.useState('');
  const [actionType, setActionType] = React.useState<'invite' | 'register'>('invite');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('initial');

  // Contact list states
  const [entities, setEntities] = React.useState<any[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = React.useState(false);
  const [selectedContacts, setSelectedContacts] = React.useState<string[]>([]);

  // Notification channels selection
  const [sendEmail, setSendEmail] = React.useState(true);
  const [sendSms, setSendSms] = React.useState(true);

  // Fetch target canonical entities with their contacts list
  React.useEffect(() => {
    if (open && activeWorkspaceId && entityIds.length > 0 && firestore) {
      setIsLoadingEntities(true);
      Promise.all(
        entityIds.map(async (id) => {
          const docRef = doc(firestore, 'entities', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return { id, ...docSnap.data() };
          }
          return null;
        })
      ).then((results) => {
        setEntities(results.filter(Boolean));
        setIsLoadingEntities(false);
      }).catch((err) => {
        console.error("Error fetching entities:", err);
        setIsLoadingEntities(false);
      });
    } else {
      setEntities([]);
    }
  }, [open, activeWorkspaceId, entityIds, firestore]);

  // Extract contact options and map synthetic primary identifiers if contacts array is empty
  const contactOptions = React.useMemo(() => {
    const options: { id: string; name: string; email?: string; phone?: string; entityName: string; isPrimary: boolean; role: string }[] = [];
    entities.forEach(e => {
      const contacts = e.entityContacts || [];
      if (contacts.length === 0) {
        if (e.primaryEmail) {
          options.push({
            id: `${e.id}_primary`,
            name: e.primaryContactName || e.displayName || e.name || 'Primary Contact',
            email: e.primaryEmail,
            phone: e.primaryPhone,
            entityName: e.name || e.displayName || e.entityName || 'Entity',
            isPrimary: true,
            role: 'Primary Contact',
          });
        }
      } else {
        contacts.forEach((c: any) => {
          options.push({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            entityName: e.name || e.displayName || e.entityName || 'Entity',
            isPrimary: c.isPrimary,
            role: c.typeLabel || c.typeKey || 'Contact',
          });
        });
      }
    });
    return options;
  }, [entities]);

  const isBulk = entityIds.length > 1;
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);

  // 1. Group contact options by role
  const roleGroups = React.useMemo(() => {
    const groups: Record<string, { label: string; count: number; ids: string[] }> = {};
    contactOptions.forEach(opt => {
      const roleLabel = opt.role || 'Contact';
      if (!groups[roleLabel]) {
        groups[roleLabel] = {
          label: roleLabel,
          count: 0,
          ids: []
        };
      }
      if (opt.email) { // Only count/add contacts that have email addresses
        groups[roleLabel].count += 1;
        groups[roleLabel].ids.push(opt.id);
      }
    });
    return Object.values(groups).filter(g => g.count > 0);
  }, [contactOptions]);

  // Handle contact pre-selection based on primary flags or direct action overrides
  React.useEffect(() => {
    if (open) {
      if (isBulk) {
        // Automatically select roles that contain "primary" or the first available role group
        const defaultRoles = roleGroups
          .filter(g => g.label.toLowerCase().includes('primary'))
          .map(g => g.label);
        
        if (defaultRoles.length > 0) {
          setSelectedRoles(defaultRoles);
        } else if (roleGroups.length > 0) {
          setSelectedRoles([roleGroups[0].label]);
        } else {
          setSelectedRoles([]);
        }
      } else {
        if (preSelectedContactIds && preSelectedContactIds.length > 0) {
          setSelectedContacts(preSelectedContactIds);
        } else {
          const primaryIds = contactOptions.filter(o => o.isPrimary && o.email).map(o => o.id);
          setSelectedContacts(primaryIds);
        }
      }
    }
  }, [open, contactOptions, preSelectedContactIds, isBulk, roleGroups]);

  // Sync selected contacts based on selected roles in bulk mode
  React.useEffect(() => {
    if (isBulk) {
      const ids: string[] = [];
      selectedRoles.forEach(roleLabel => {
        const group = roleGroups.find(g => g.label === roleLabel);
        if (group) {
          ids.push(...group.ids);
        }
      });
      setSelectedContacts([...new Set(ids)]);
    }
  }, [selectedRoles, roleGroups, isBulk]);

  // Fetch recent meetings for the current workspace
  const meetingsQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId
      ? query(
          collection(firestore, 'meetings'),
          where('workspaceIds', 'array-contains', activeWorkspaceId),
          orderBy('meetingTime', 'desc')
        )
      : null,
    [firestore, activeWorkspaceId]
  );
  
  const { data: meetings, isLoading: isLoadingMeetings } = useCollection<any>(meetingsQuery);

  const upcomingMeetings = React.useMemo(() => {
    if (!meetings) return [];
    // Keep meetings scheduled in the future (within 30 minutes in the past is also fine as buffer, but let's check straight upcoming)
    const now = Date.now();
    return meetings.filter((m: any) => {
      if (!m.meetingTime) return false;
      return new Date(m.meetingTime).getTime() > now;
    });
  }, [meetings]);

  React.useEffect(() => {
    if (open) {
      setActionType('invite');
      if (upcomingMeetings && upcomingMeetings.length > 0) {
        setMeetingId(upcomingMeetings[0].id);
      } else {
        setMeetingId('');
      }
    }
  }, [open, upcomingMeetings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId || selectedContacts.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await bulkRegisterParticipantsAction({
        entityIds,
        meetingId,
        workspaceId: activeWorkspaceId!,
        sendInvites: actionType === 'invite',
        templateId: selectedTemplateId,
        selectedContactIds: selectedContacts,
        channels: [
          sendEmail ? 'email' : null,
          sendSms ? 'sms' : null
        ].filter(Boolean) as ('email' | 'sms')[],
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Bulk registrations handled',
        description: result.message || `Successfully handled registrations for ${result.count} contacts.`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Meeting operation failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = 
    isSubmitting || 
    !meetingId || 
    selectedContacts.length === 0 ||
    (actionType === 'invite' && !sendEmail && !sendSms);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border border-border/50 dark:border-border/50 shadow-2xl overflow-hidden bg-white dark:bg-[#0f1117] text-left">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 border-b border-border/50 bg-white dark:bg-[#0f1117] shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Bulk Session Scheduler</DialogTitle>
            <DialogDescription className="sr-only">
              Invite contacts to meeting sessions and configure registration strategy.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* 1. Select Meeting Session */}
            <div className="space-y-2">
              <Label htmlFor="meeting-select" className="text-xs font-bold text-muted-foreground ml-1">
                Select Meeting Session
              </Label>
              <Select value={meetingId} onValueChange={setMeetingId} disabled={isLoadingMeetings}>
                <SelectTrigger id="meeting-select" className="h-10 rounded-xl font-bold bg-muted/20 dark:bg-muted/10 border-border/50 text-foreground hover:border-primary/30 transition-colors shadow-inner text-xs">
                  <SelectValue placeholder="Select Meeting" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/50 bg-white dark:bg-[#0f1117] text-foreground shadow-xl">
                  {upcomingMeetings.map((m: any) => {
                    const formattedDate = m.meetingTime
                      ? new Date(m.meetingTime).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'No date';
                    const title = m.title || m.heroTitle || m.entityName || m.type?.name || 'Webinar Session';
                    return (
                      <SelectItem key={m.id} value={m.id} className="font-bold text-xs hover:bg-muted/40 dark:hover:bg-muted/20 focus:bg-muted/40 dark:focus:bg-muted/20 text-foreground">
                        {title} ({formattedDate})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Select Contacts to Invite */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground ml-1">
                {isBulk ? 'Filter Contacts by Role' : 'Select Contacts to Invite'}
              </Label>
              <div className="min-h-[70px] max-h-[220px] overflow-y-auto border border-border/50 rounded-xl p-3 bg-muted/20 dark:bg-muted/5">
                {isLoadingEntities ? (
                  <div className="flex items-center justify-center py-6 text-xs font-semibold text-muted-foreground gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Loading contacts...
                  </div>
                ) : isBulk ? (
                  roleGroups.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground font-semibold text-center py-4">No contacts with email addresses found in selected entities.</p>
                  ) : (
                    <div className="space-y-4 text-left">
                      {/* Aggregated count indicator */}
                      <div className="flex justify-between items-center bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs font-bold text-foreground">
                        <span>Total Contacts in Selected Roles:</span>
                        <span className="bg-primary text-primary-foreground text-xs px-2.5 py-0.5 rounded-full font-black">
                          {selectedContacts.length}
                        </span>
                      </div>

                      {/* Listview of roles with checkboxes */}
                      <div className="border border-border/50 rounded-xl divide-y divide-border/40 overflow-hidden bg-background">
                        {roleGroups.map((group) => {
                          const isSelected = selectedRoles.includes(group.label);
                          return (
                            <div
                              key={group.label}
                              className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  id={`role-check-${group.label}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedRoles(prev => [...prev, group.label]);
                                    } else {
                                      setSelectedRoles(prev => prev.filter(r => r !== group.label));
                                    }
                                  }}
                                  className="border-border/60 data-[state=checked]:bg-primary"
                                />
                                <label
                                  htmlFor={`role-check-${group.label}`}
                                  className="font-bold text-foreground cursor-pointer select-none"
                                >
                                  {group.label}
                                </label>
                              </div>
                              <Badge variant="secondary" className="px-2 py-0.5 font-bold rounded-lg bg-muted text-muted-foreground">
                                {group.count} contacts
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : contactOptions.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground font-semibold text-center py-6">No contacts with email addresses found.</p>
                ) : (
                  <div className="space-y-2.5">
                    {contactOptions.map(option => {
                      const isSelected = selectedContacts.includes(option.id);
                      const hasEmail = !!option.email;
                      return (
                        <div key={option.id} className="flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Checkbox
                              id={`contact-${option.id}`}
                              checked={isSelected}
                              disabled={!hasEmail}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedContacts(prev => [...prev, option.id]);
                                } else {
                                  setSelectedContacts(prev => prev.filter(id => id !== option.id));
                                }
                              }}
                              className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0"
                            />
                            <label
                              htmlFor={`contact-${option.id}`}
                              className={cn(
                                "font-bold truncate cursor-pointer select-none flex items-center gap-1.5 flex-1 min-w-0",
                                hasEmail ? "text-foreground hover:text-primary transition-colors" : "text-muted-foreground/40 line-through cursor-not-allowed"
                              )}
                            >
                              <span className="truncate">{option.name}</span>
                              <span className="text-[8px] font-extrabold uppercase px-1 py-0.5 rounded bg-muted/65 dark:bg-muted/20 text-muted-foreground shrink-0 border border-border/40">
                                {option.role}
                              </span>
                            </label>
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 font-semibold shrink-0">
                            {option.email || '(No Email)'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Registration & Communication Strategy */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground ml-1">
                Registration & Communication Strategy
              </Label>
              <RadioGroup
                value={actionType}
                onValueChange={v => setActionType(v as 'invite' | 'register')}
                className="flex flex-col gap-3"
              >
                <div
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    actionType === 'invite' ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/10'
                  )}
                  onClick={() => setActionType('invite')}
                >
                  <RadioGroupItem value="invite" id="invite-radio" className="mt-1 border-border/60 text-primary" />
                  <Label htmlFor="invite-radio" className="cursor-pointer">
                    <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-primary" /> Mark as Pending & Send Invite
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                      Adds participants as 'pending' and dispatches an invitation from the series.
                    </p>
                  </Label>
                </div>
                
                {actionType === 'invite' && meetingId && (
                  <div className="pl-10 pr-4 pb-2 animate-in fade-in slide-in-from-top-2">
                     <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="h-9 rounded-lg font-bold bg-muted/20 dark:bg-muted/10 border-border/50 text-foreground shadow-inner text-xs">
                          <SelectValue placeholder="Select Invitation Stage" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-border/50 bg-white dark:bg-[#0f1117] text-foreground shadow-xl">
                          {meetings?.find((m: any) => m.id === meetingId)?.messagingConfig?.invitationSeries?.filter((s: any) => s.enabled)?.map((s: any) => (
                            <SelectItem key={s.id} value={s.id} className="font-bold text-xs hover:bg-muted/40 dark:hover:bg-muted/20 focus:bg-muted/40 dark:focus:bg-muted/20 text-foreground">
                              {s.label}
                            </SelectItem>
                          )) || (
                            <SelectItem value="initial" className="font-bold text-xs">
                              Initial Invitation
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                  </div>
                )}

                <div
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    actionType === 'register' ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/10'
                  )}
                  onClick={() => setActionType('register')}
                >
                  <RadioGroupItem value="register" id="register-radio" className="mt-1 border-border/60 text-primary" />
                  <Label htmlFor="register-radio" className="cursor-pointer">
                    <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <CalendarRange className="h-4 w-4 text-emerald-500" /> Silently Approve Attendance
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                      Registers participants in the database as approved attendees without triggering Resend email alerts.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 4. Select Channels (Email/SMS) */}
            {actionType === 'invite' && (
              <div className="space-y-2.5 border-t border-border/50 pt-3.5">
                <Label className="text-xs font-bold text-muted-foreground ml-1">Select Channels to Use</Label>
                <div className="flex items-center gap-6 ml-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="channel-email"
                      checked={sendEmail}
                      onCheckedChange={(checked) => setSendEmail(!!checked)}
                      className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <label htmlFor="channel-email" className="text-xs font-bold text-foreground cursor-pointer select-none">
                      Email Channel
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="channel-sms"
                      checked={sendSms}
                      onCheckedChange={(checked) => setSendSms(!!checked)}
                      className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <label htmlFor="channel-sms" className="text-xs font-bold text-foreground cursor-pointer select-none">
                      SMS Channel
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border/50 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-6 text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="rounded-xl font-bold h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95 border-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-foreground" /> Processing...
                </>
              ) : (
                <>
                  Confirm Action
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
