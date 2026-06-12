'use client';

import * as React from 'react';
import { Mail, Phone, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { shareOrgSetupInviteAction } from '@/lib/backoffice/backoffice-org-actions';
import { useBackoffice } from '../../context/BackofficeProvider';

interface ShareOrgInviteProps {
  organizationId: string;
  defaultEmail?: string;
  defaultPhone?: string;
  /** Called with the (possibly rotated) token + link after a successful share. */
  onShared?: (result: { joinToken?: string; link?: string }) => void;
}

/**
 * Email/SMS sharing of an org's setup credentials. Re-used in the
 * "Organization Pre-Created" modal and the org detail page. The server action
 * re-reads the org and rotates/renews the token, so this only collects
 * recipients and reports per-channel delivery.
 */
export default function ShareOrgInvite({ organizationId, defaultEmail, defaultPhone, onShared }: ShareOrgInviteProps) {
  const { toast } = useToast();
  const { profile } = useBackoffice();
  const [email, setEmail] = React.useState(defaultEmail ?? '');
  const [phone, setPhone] = React.useState(defaultPhone ?? '');
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => { if (defaultEmail) setEmail(defaultEmail); }, [defaultEmail]);

  const handleShare = async () => {
    const hasEmail = email.trim().length > 0;
    const hasPhone = phone.trim().length > 0;
    if (!hasEmail && !hasPhone) {
      toast({ variant: 'destructive', title: 'Add a recipient', description: 'Enter an email and/or phone number to share.' });
      return;
    }
    if (!profile) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Action requires a logged-in super admin.' });
      return;
    }

    const channel = hasEmail && hasPhone ? 'both' : hasEmail ? 'email' : 'sms';
    setIsSending(true);
    try {
      const res = await shareOrgSetupInviteAction(
        { organizationId, email: hasEmail ? email.trim() : undefined, phone: hasPhone ? phone.trim() : undefined, channel },
        { userId: profile.id, name: profile.name, email: profile.email, role: 'super_admin' }
      );
      if (res.success) {
        const parts: string[] = [];
        if (res.sentTo?.email) parts.push('email');
        if (res.sentTo?.sms) parts.push('SMS');
        toast({ title: 'Invitation sent', description: `Setup credentials sent via ${parts.join(' & ') || 'the selected channel'}.` });
        onShared?.({ joinToken: res.joinToken, link: res.link });
      } else {
        toast({ variant: 'destructive', title: 'Could not send', description: res.error || 'Please try again.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to share invitation.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Share setup credentials with the administrator</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3 w-3" /> Email
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@acme.com"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Phone (SMS)
          </Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 24 000 0000"
            className="h-10 rounded-xl"
          />
        </div>
      </div>
      <Button onClick={handleShare} disabled={isSending} className="w-full h-10 rounded-xl font-bold gap-2">
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {isSending ? 'Sending…' : 'Send Invitation'}
      </Button>
    </div>
  );
}
