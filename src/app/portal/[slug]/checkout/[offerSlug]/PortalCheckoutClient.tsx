'use client';

/**
 * {{Org_name}} Experience Platform — High-Converting Checkout Page
 *
 * Streamlined member checkout page with order summary, live coupon validation,
 * multiple payment gateways (Card, Mobile Money, Bank Settlement),
 * and automated instant entitlement unlock.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  validateCouponAction,
  processCheckoutOrderAction,
} from '@/app/actions/commerce-actions';
import type { PortalOffer, PaymentMethodType, PortalCoupon } from '@/lib/types/commerce';
import type { Portal } from '@/lib/types/portal';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Tag,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Smartphone,
  Building,
  Lock,
  Loader2,
  Gift,
} from 'lucide-react';

interface PortalCheckoutClientProps {
  slug: string;
  offerSlug: string;
}

export function PortalCheckoutClient({ slug, offerSlug }: PortalCheckoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const affiliateRef = searchParams.get('ref') || undefined;

  // Form State
  const [customerName, setCustomerName] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodType>('card');

  // Coupon State
  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<PortalCoupon | null>(null);
  const [discountAmount, setDiscountAmount] = React.useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setCustomerName(user.displayName || '');
      setCustomerEmail(user.email || '');
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

  // 2. Query Offer
  const offerQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && offerSlug
        ? query(
            collection(firestore, 'portal_offers'),
            where('portalId', '==', portal.id),
            where('slug', '==', offerSlug),
            limit(1)
          )
        : null,
    [firestore, portal?.id, offerSlug]
  );
  const { data: offers, isLoading: isLoadingOffer } = useCollection<PortalOffer>(offerQuery);
  const offer = offers?.[0] ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !portal || !offer) return;
    setIsValidatingCoupon(true);
    try {
      const res = await validateCouponAction({
        portalId: portal.id,
        offerId: offer.id,
        code: couponInput.trim(),
      });

      if (!res.success || !res.data?.isValid) {
        toast({ title: 'Invalid Coupon', description: res.data?.message || 'Code could not be applied.' });
        setAppliedCoupon(null);
        setDiscountAmount(0);
      } else {
        setAppliedCoupon(res.data.coupon || null);
        setDiscountAmount(res.data.discountAmount);
        toast({ title: 'Coupon Applied! 🎉', description: `Saved ${offer.currency} ${res.data.discountAmount}.` });
      }
    } catch (err: any) {
      toast({ title: 'Validation Error', description: err?.message });
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponInput('');
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim() || !customerName.trim()) {
      toast({ title: 'Missing Information', description: 'Please provide your name and email.' });
      return;
    }
    if (!portal || !offer) return;

    setIsProcessingOrder(true);
    try {
      const res = await processCheckoutOrderAction(
        {
          organizationId: portal.organizationId,
          portalId: portal.id,
          offerId: offer.id,
          userId: user?.uid || `guest_${Date.now()}`,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          paymentMethod,
          couponCode: appliedCoupon?.code,
          affiliateCode: affiliateRef,
        },
        slug,
        offerSlug
      );

      if (!res.success) throw new Error(res.error);

      toast({
        title: 'Order Confirmed! 🌟',
        description: `Welcome to ${offer.title}. Entitlements unlocked!`,
      });

      // Redirect to Member Learning Dashboard
      router.push(`/portal/${slug}/dashboard`);
    } catch (err: any) {
      toast({ title: 'Checkout Failed', description: err?.message });
    } finally {
      setIsProcessingOrder(false);
    }
  };

  if (isLoadingPortal || isLoadingOffer) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!portal || !offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <Card className="max-w-md p-8 rounded-3xl border-2 border-border space-y-3">
          <h2 className="text-xl font-bold">Offer Not Found</h2>
          <p className="text-xs text-muted-foreground">This commercial pricing package is currently unavailable.</p>
          <Link href={`/portal/${slug}`}>
            <Button variant="outline" className="rounded-xl text-xs font-bold">
              Return to Academy Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const theme = portal.theme;
  const branding = portal.branding;
  const brandTitle = branding.brandName || portal.name;
  const finalTotal = Math.max(0, offer.price - discountAmount);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Top Header ────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}`}>
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
            <span className="font-bold text-sm tracking-tight">{brandTitle} Checkout</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-foreground">256-Bit SSL Encrypted</span>
        </div>
      </header>

      {/* ── Main Checkout Split Layout ────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Order Summary (5 Cols) */}
          <div className="md:col-span-5 space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 sm:p-7 space-y-5 bg-card shadow-xs">
              <div className="space-y-2 border-b border-border pb-4">
                <Badge
                  variant="secondary"
                  className="text-[9px] font-bold uppercase bg-primary/10 text-primary capitalize"
                >
                  {offer.offerType.replace('_', ' ')}
                </Badge>
                <h2 className="text-xl font-black text-foreground">{offer.title}</h2>
                {offer.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{offer.description}</p>
                )}
              </div>

              {/* What's Included */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Included in this Pass
                </h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Instant Digital Curriculum Access</span>
                  </li>
                  <li className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>All Interactive Masterclasses & Replays</span>
                  </li>
                  <li className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Private Peer Community & Discussion</span>
                  </li>
                  <li className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Verified Completion Credentials (+50 Pts)</span>
                  </li>
                </ul>
              </div>

              {/* Coupon Code Section */}
              <div className="pt-4 border-t border-border space-y-2">
                <Label className="text-xs font-bold">Have a Promo Code?</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. LAUNCH20"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    disabled={Boolean(appliedCoupon)}
                    className="h-10 text-xs font-mono font-bold rounded-xl"
                  />
                  {appliedCoupon ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveCoupon}
                      className="h-10 text-xs font-bold rounded-xl text-rose-500"
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      className="h-10 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 shadow-2xs"
                    >
                      {isValidatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                    </Button>
                  )}
                </div>

                {appliedCoupon && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Code {appliedCoupon.code} applied (-{offer.currency} {discountAmount})
                  </p>
                )}
              </div>

              {/* Pricing Math Ledger */}
              <div className="pt-4 border-t border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{offer.currency} {offer.price}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-{offer.currency} {discountAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-black text-foreground pt-2 border-t border-border">
                  <span>Total Due</span>
                  <span>{offer.currency} {finalTotal}</span>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>100% Satisfaction Guarantee • Instant Automated Unlock</span>
              </div>
            </Card>
          </div>

          {/* Right Column: Customer Details & Payment Methods (7 Cols) */}
          <div className="md:col-span-7 space-y-6">
            <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card shadow-xs">
              <div className="border-b border-border pb-3">
                <h3 className="font-extrabold text-base text-foreground">Customer & Billing Information</h3>
                <p className="text-xs text-muted-foreground">Enter your account information to access the academy.</p>
              </div>

              <form onSubmit={handleCompleteOrder} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Full Name</Label>
                  <Input
                    placeholder="e.g. Kwame Mensah"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-10 text-xs rounded-xl font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="e.g. kwame@school.edu"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">WhatsApp Mobile Number</Label>
                    <Input
                      type="tel"
                      placeholder="e.g. +233 24 123 4567"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* Payment Gateway Picker */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-bold block">Select Payment Method</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                        paymentMethod === 'card'
                          ? 'border-primary bg-primary/5 shadow-2xs'
                          : 'border-border bg-muted/20 hover:border-primary/40'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-primary" />
                      <span className="font-bold text-xs text-foreground">Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mobile_money')}
                      className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                        paymentMethod === 'mobile_money'
                          ? 'border-primary bg-primary/5 shadow-2xs'
                          : 'border-border bg-muted/20 hover:border-primary/40'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-primary" />
                      <span className="font-bold text-xs text-foreground">MoMo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-primary bg-primary/5 shadow-2xs'
                          : 'border-border bg-muted/20 hover:border-primary/40'
                      }`}
                    >
                      <Building className="w-5 h-5 text-primary" />
                      <span className="font-bold text-xs text-foreground">Bank</span>
                    </button>
                  </div>
                </div>

                {/* Submit Checkout */}
                <Button
                  type="submit"
                  disabled={isProcessingOrder}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-primary text-white hover:bg-primary/90 gap-2 shadow-md"
                >
                  {isProcessingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Finalizing Enrollment...
                    </>
                  ) : (
                    <>
                      Complete Order • {offer.currency} {finalTotal} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by SmartSapp Experience Platform.</p>
      </footer>
    </div>
  );
}
