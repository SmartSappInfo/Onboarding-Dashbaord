'use client';

/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Phase 3 CRM Activity Graph - Rule 10):
 * - DealQuickActions provides direct one-click interaction logging for Phone Calls, Meetings, Emails, and WhatsApp messages.
 * - Bridges the Deal Workspace with the CRM Activity Graph and platform Event Bus via logDealInteractionAction.
 * - Strictly typed (zero 'any'), mobile touch targets >= 44px, and actionable toast feedback.
 * 
 * Caution Areas for Future Maintainers:
 * - Interaction submissions automatically touch deal.updatedAt and log unified activities tagged with dealId.
 * - Variable token resolution in email templates delegates strictly to FieldsVariablesService.
 */

import * as React from 'react';
import { 
    PhoneCall, 
    Calendar, 
    Mail, 
    MessageCircle, 
    Plus, 
    Loader2, 
    Check, 
    Clock, 
    User, 
    Video, 
    Send,
    FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import type { Deal, EntityContact } from '@/lib/types';
import type { DealInteractionData } from '@/lib/deals/deal-types';
import { logDealInteractionAction } from '@/app/actions/deal-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';

interface DealQuickActionsProps {
    deal: Deal;
    contacts?: EntityContact[];
}

export default function DealQuickActions({ deal, contacts = [] }: DealQuickActionsProps) {
    const { user } = useUser();
    const { toast } = useToast();
    const { activeWorkspaceId } = useTenant();

    // Active Modal Type
    const [activeModal, setActiveModal] = React.useState<'call' | 'meeting' | 'email' | 'whatsapp' | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Form fields
    const [subject, setSubject] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [outcome, setOutcome] = React.useState('connected');
    const [durationMinutes, setDurationMinutes] = React.useState('15');
    const [selectedContactId, setSelectedContactId] = React.useState('');
    const [locationOrPlatform, setLocationOrPlatform] = React.useState('Zoom');
    const [occurredAt, setOccurredAt] = React.useState('');

    // Available contacts pool (focal contacts + entity contacts)
    const availableContacts = React.useMemo(() => {
        const pool: Array<{ id: string; name: string; email?: string; phone?: string; role?: string }> = [];
        
        // Add deal focal contacts
        (deal.focalContacts || []).forEach(fc => {
            if (fc.id && !pool.some(p => p.id === fc.id)) {
                pool.push({
                    id: fc.id,
                    name: fc.name || 'Focal Contact',
                    email: fc.email,
                    phone: fc.phone,
                    role: fc.role || 'Focal Contact'
                });
            }
        });

        // Add deal secondary contacts
        (deal.contacts || []).forEach(sc => {
            if (sc.entityId && !pool.some(p => p.id === sc.entityId)) {
                pool.push({
                    id: sc.entityId,
                    name: sc.name || 'Secondary Contact',
                    email: sc.email,
                    role: sc.role || 'Secondary Contact'
                });
            }
        });

        // Add entity contacts
        contacts.forEach(c => {
            if (c.id && !pool.some(p => p.id === c.id)) {
                pool.push({
                    id: c.id,
                    name: c.name || 'Contact Person',
                    email: c.email,
                    phone: c.phone,
                    role: c.typeLabel || 'Contact Person'
                });
            }
        });

        return pool;
    }, [deal, contacts]);

    // Open modal with prefilled defaults
    const handleOpenModal = (type: 'call' | 'meeting' | 'email' | 'whatsapp') => {
        const primaryContact = availableContacts[0];
        setSelectedContactId(primaryContact?.id || '');
        setOccurredAt(new Date().toISOString().slice(0, 16));
        setDescription('');

        if (type === 'call') {
            setSubject(`Phone call with ${primaryContact?.name || deal.name}`);
            setOutcome('connected');
            setDurationMinutes('15');
        } else if (type === 'meeting') {
            setSubject(`Meeting with ${primaryContact?.name || deal.name}`);
            setLocationOrPlatform('Zoom');
            setOutcome('scheduled');
            setDurationMinutes('30');
        } else if (type === 'email') {
            setSubject(`Follow-up: ${deal.name}`);
            setOutcome('sent');
        } else if (type === 'whatsapp') {
            setSubject(`WhatsApp update for ${deal.name}`);
            setOutcome('sent');
        }

        setActiveModal(type);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setIsSubmitting(false);
    };

    const handleSubmitInteraction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeModal || !user) return;

        const effectiveWorkspaceId = activeWorkspaceId || deal.workspaceId || 'default';
        const contactObj = availableContacts.find(c => c.id === selectedContactId);

        const payload: DealInteractionData = {
            type: activeModal,
            subject: subject.trim() || `${activeModal.toUpperCase()} Interaction`,
            description: description.trim() || undefined,
            outcome,
            durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
            recipientContactId: selectedContactId || undefined,
            recipientName: contactObj?.name || undefined,
            recipientEmail: contactObj?.email || undefined,
            recipientPhone: contactObj?.phone || undefined,
            locationOrPlatform: activeModal === 'meeting' ? locationOrPlatform : undefined,
            occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        };

        setIsSubmitting(true);
        try {
            const res = await logDealInteractionAction(
                deal.id,
                payload,
                user.uid,
                effectiveWorkspaceId
            );

            if (res.success) {
                const labels: Record<string, string> = {
                    call: 'Phone Call Logged',
                    meeting: 'Meeting Scheduled / Logged',
                    email: 'Email Interaction Logged',
                    whatsapp: 'WhatsApp Message Logged',
                };
                toast({
                    title: labels[activeModal] || 'Interaction Logged',
                    description: `Successfully added to ${deal.name}'s activity timeline.`,
                });
                handleCloseModal();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Failed to Log Activity',
                    description: res.error || 'Please check your permissions and try again.',
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An error occurred';
            toast({
                variant: 'destructive',
                title: 'Interaction Error',
                description: msg,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Quick Actions Toolbar */}
            <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-2xl bg-card border border-border/50 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-2 mr-1">
                    Quick Log:
                </span>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal('call')}
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 cursor-pointer transition-all active:scale-95"
                >
                    <PhoneCall className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Log Call</span>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal('meeting')}
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300 cursor-pointer transition-all active:scale-95"
                >
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Log Meeting</span>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal('email')}
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 cursor-pointer transition-all active:scale-95"
                >
                    <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Log Email</span>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal('whatsapp')}
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300 cursor-pointer transition-all active:scale-95"
                >
                    <MessageCircle className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>Log WhatsApp</span>
                </Button>
            </div>

            {/* Modal Dialog for Call, Meeting, Email, WhatsApp */}
            <Dialog open={activeModal !== null} onOpenChange={open => !open && handleCloseModal()}>
                <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border bg-card shadow-2xl">
                    <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                                {activeModal === 'call' && <PhoneCall className="h-5 w-5" />}
                                {activeModal === 'meeting' && <Calendar className="h-5 w-5" />}
                                {activeModal === 'email' && <Mail className="h-5 w-5" />}
                                {activeModal === 'whatsapp' && <MessageCircle className="h-5 w-5" />}
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    {activeModal === 'call' && 'Log Phone Call Interaction'}
                                    {activeModal === 'meeting' && 'Log / Schedule Meeting'}
                                    {activeModal === 'email' && 'Log Email Interaction'}
                                    {activeModal === 'whatsapp' && 'Log WhatsApp Message'}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium text-muted-foreground">
                                    Record details to update {deal.name}&apos;s activity timeline and engagement score.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmitInteraction} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                        {/* Subject */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-primary" /> Subject / Title *
                            </Label>
                            <Input
                                required
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>

                        {/* Contact Picker */}
                        {availableContacts.length > 0 && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-primary" /> Contact Person
                                </Label>
                                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                                    <SelectTrigger className="rounded-xl min-h-[44px]">
                                        <SelectValue placeholder="Select contact..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {availableContacts.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} {c.role && `(${c.role})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Call Specific: Disposition Outcome & Duration */}
                        {activeModal === 'call' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Call Disposition</Label>
                                    <Select value={outcome} onValueChange={setOutcome}>
                                        <SelectTrigger className="rounded-xl min-h-[44px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="connected">Connected / Discussed</SelectItem>
                                            <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                                            <SelectItem value="busy_no_answer">Busy / No Answer</SelectItem>
                                            <SelectItem value="gatekeeper_blocked">Gatekeeper Blocked</SelectItem>
                                            <SelectItem value="callback_scheduled">Callback Scheduled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-primary" /> Duration (Minutes)
                                    </Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={durationMinutes}
                                        onChange={e => setDurationMinutes(e.target.value)}
                                        className="rounded-xl min-h-[44px]"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Meeting Specific: Platform & Time */}
                        {activeModal === 'meeting' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                        <Video className="h-3.5 w-3.5 text-primary" /> Platform / Location
                                    </Label>
                                    <Select value={locationOrPlatform} onValueChange={setLocationOrPlatform}>
                                        <SelectTrigger className="rounded-xl min-h-[44px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Zoom">Zoom</SelectItem>
                                            <SelectItem value="Google Meet">Google Meet</SelectItem>
                                            <SelectItem value="In-Person">In-Person Onsite</SelectItem>
                                            <SelectItem value="Microsoft Teams">Microsoft Teams</SelectItem>
                                            <SelectItem value="Phone">Conference Call</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-primary" /> Duration (Minutes)
                                    </Label>
                                    <Input
                                        type="number"
                                        min="5"
                                        value={durationMinutes}
                                        onChange={e => setDurationMinutes(e.target.value)}
                                        className="rounded-xl min-h-[44px]"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Date & Time */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-primary" /> Date & Time
                            </Label>
                            <Input
                                type="datetime-local"
                                value={occurredAt}
                                onChange={e => setOccurredAt(e.target.value)}
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>

                        {/* Description / Summary Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-primary" /> 
                                {activeModal === 'call' && 'Call Notes & Discussion Summary'}
                                {activeModal === 'meeting' && 'Meeting Agenda & Action Items'}
                                {activeModal === 'email' && 'Email Content / Key Points'}
                                {activeModal === 'whatsapp' && 'WhatsApp Message Notes'}
                            </Label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Record notes, key discussion points, objections, or agreed next steps..."
                                className="w-full min-h-[90px] rounded-xl p-3 text-xs font-medium bg-muted/10 border border-border shadow-inner outline-none focus-visible:ring-1 focus-visible:ring-primary/40 resize-none"
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t flex flex-row items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleCloseModal}
                                disabled={isSubmitting}
                                className="rounded-xl font-bold min-h-[44px] px-6 cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || !subject.trim()}
                                className="rounded-xl font-bold min-h-[44px] px-8 shadow-lg cursor-pointer bg-primary text-white gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        <span>Logging...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" aria-hidden="true" />
                                        <span>Save Interaction</span>
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
