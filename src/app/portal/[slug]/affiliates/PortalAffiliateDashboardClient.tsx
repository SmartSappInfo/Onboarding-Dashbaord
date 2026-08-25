'use client';

/**
 * {{Org_name}} Experience Platform — Member Affiliate Partner Hub
 *
 * Self-service affiliate dashboard for students and influencers:
 * Personalized tracking links (?ref=CODE), metrics cards, commission earnings ledger,
 * and partner onboarding.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  registerAffiliatePartnerAction,
} from '@/app/actions/commerce-actions';
import type { AffiliatePartner, AffiliateReferral } from '@/lib/types/commerce';
import type { Portal } from '@/lib/types/portal';
import {
  Users,
  DollarSign,
  TrendingUp,
  Share2,
  Copy,
  Check,
  Award,
  Sparkles,
  ArrowLeft,
  Gift,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface PortalAffiliateDashboardClientProps {
  slug: string;
}

export function PortalAffiliateDashboardClient({ slug }: PortalAffiliateDashboardClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [copied, setCopied] = React.useState(false);

  // Registration Form State
  const [partnerName, setPartnerName] = React.useState('');
  const [partnerEmail, setPartnerEmail] = React.useState('');
  const [customCode, setCustomCode] = React.useState('');
  const [payoutMethod, setPayoutMethod] = React.useState('Mobile Money');
  const [payoutDetails, setPayoutDetails] = React.useState('');
  const [isRegistering, setIsRegistering] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setPartnerName(user.displayName || '');
      setPartnerEmail(user.email || '');
      if (user.displayName) {
        setCustomCode(user.displayName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''));
      }
    }
  }, [user]);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Affiliate Partner Record for User
  const partnerQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'affiliate_partners'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: partners, isLoading: isLoadingPartner } = useCollection<AffiliatePartner>(partnerQuery);
  const partner = partners?.[0] ?? null;

  // 3. Query Referrals
  const referralsQuery = useMemoFirebase(
    () =>
      firestore && partner?.id
        ? query(
            collection(firestore, 'affiliate_referrals'),
            where('partnerId', '==', partner.id)
          )
        : null,
    [firestore, partner?.id]
  );
  const { data: referrals, isLoading: isLoadingReferrals } = useCollection<AffiliateReferral>(referralsQuery);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !user) {
      toast({ title: 'Sign In Required', description: 'Please sign in to join the partner program.' });
      return;
    }

    setIsRegistering(true);
    try {
      const res = await registerAffiliatePartnerAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          userId: user.uid,
          partnerName: partnerName.trim(),
          partnerEmail: partnerEmail.trim(),
          referralCode: customCode.trim() || undefined,
          payoutMethod,
          payoutDetails: payoutDetails.trim() || undefined,
        },
        slug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Welcome Partner! 🚀', description: 'Your affiliate link is active.' });
    } catch (err: any) {
      toast({ title: 'Registration Failed', description: err?.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCopyLink = () => {
    if (!partner) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/portal/${slug}?ref=${partner.referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: 'Referral Link Copied! 📋', description: 'Share this link to earn 20% commission.' });
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoadingPortal || isLoadingPartner) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 rounded-3xl border-2 border-border space-y-3">
          <h2 className="text-xl font-bold">Portal Not Found</h2>
          <Link href="/">
            <Button variant="outline" className="rounded-xl text-xs font-bold">Return Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Top Header ────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}/dashboard`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight">{brandTitle} Partner Program</span>
          </Link>
        </div>

        <Link href={`/portal/${slug}/dashboard`}>
          <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">
            Back to Dashboard
          </Button>
        </Link>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10 space-y-8">
        {!partner ? (
          /* ── Case 1: Partner Program Registration Hero ───────────────── */
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="rounded-3xl border-2 border-border p-8 sm:p-10 text-center space-y-4 bg-card shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
                <Gift className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <Badge variant="secondary" className="text-[10px] font-bold uppercase bg-primary/10 text-primary">
                  Earn 20% Recurring Commission
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                  Join the {brandTitle} Partner Program
                </h1>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Earn generous 20% commission on every new student or school you refer to the academy.
                  Automatic attribution, monthly payouts, and real-time conversion tracking.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4 text-left pt-4 max-w-md mx-auto">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Your Name / Organization</Label>
                  <Input
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    className="h-10 text-xs rounded-xl font-bold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Email Address</Label>
                  <Input
                    type="email"
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
                    className="h-10 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Custom Referral Code</Label>
                  <Input
                    placeholder="e.g. KWAME20"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="h-10 text-xs font-mono font-bold rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Preferred Payout Details (MoMo / Bank)</Label>
                  <Input
                    placeholder="e.g. MTN Mobile Money: 0244123456"
                    value={payoutDetails}
                    onChange={e => setPayoutDetails(e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
                >
                  {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate Partner Account 🚀'}
                </Button>
              </form>
            </Card>
          </div>
        ) : (
          /* ── Case 2: Active Affiliate Dashboard ──────────────────────── */
          <div className="space-y-6">
            {/* Share Link Banner */}
            <Card className="rounded-3xl border-2 border-primary/30 p-6 sm:p-8 bg-primary/5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-white text-[10px] font-bold">
                      {partner.commissionRate}% Commission Active
                    </Badge>
                    <span className="text-xs text-muted-foreground">Code: <strong className="text-foreground">{partner.referralCode}</strong></span>
                  </div>
                  <h2 className="text-xl font-black text-foreground">Your Exclusive Referral Link</h2>
                  <p className="text-xs text-muted-foreground">Share this link to earn 20% on all referred memberships.</p>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/portal/${slug}?ref=${partner.referralCode}` : `https://.../portal/${slug}?ref=${partner.referralCode}`}
                    className="h-11 text-xs font-mono rounded-xl bg-card border-border max-w-xs"
                  />
                  <Button
                    onClick={handleCopyLink}
                    className="h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shrink-0 shadow-2xs"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Referred Sales</span>
                <h3 className="text-2xl font-black text-foreground">{partner.totalConversions}</h3>
              </Card>

              <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Earnings</span>
                <h3 className="text-2xl font-black text-primary">${partner.totalEarnings}</h3>
              </Card>

              <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Unpaid / Pending</span>
                <h3 className="text-2xl font-black text-amber-600">${partner.pendingBalance}</h3>
              </Card>

              <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Paid</span>
                <h3 className="text-2xl font-black text-emerald-600">${partner.paidBalance}</h3>
              </Card>
            </div>

            {/* Referrals Ledger */}
            <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-xs">
              <div className="border-b border-border pb-3">
                <h3 className="font-extrabold text-base text-foreground">Commission History & Referrals</h3>
                <p className="text-xs text-muted-foreground">Detailed record of student enrollments from your link.</p>
              </div>

              {isLoadingReferrals ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading referral transactions...</div>
              ) : (!referrals || referrals.length === 0) ? (
                <div className="p-12 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/10">
                  <Share2 className="w-8 h-8 mx-auto text-primary/60" />
                  <p className="font-bold text-xs text-foreground">No referrals recorded yet</p>
                  <p className="text-[11px] text-muted-foreground">Share your referral link on WhatsApp or social media to begin earning!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {referrals.map(ref => (
                    <div
                      key={ref.id}
                      className="p-3 rounded-2xl border border-border flex items-center justify-between text-xs bg-muted/20"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-foreground">Referred Sale</span>
                        <p className="text-[10px] text-muted-foreground">{new Date(ref.createdAt).toLocaleDateString()}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] text-emerald-600 font-bold">
                          +{ref.currency} {ref.commissionAmount}
                        </Badge>
                        <Badge className="text-[9px] capitalize bg-primary/10 text-primary py-0">
                          {ref.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by SmartSapp Experience Platform.</p>
      </footer>
    </div>
  );
}
