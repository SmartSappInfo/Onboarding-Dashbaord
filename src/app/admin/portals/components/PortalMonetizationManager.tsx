'use client';

/**
 * {{Org_name}} Experience Platform — Admin Monetization & Affiliates Studio
 *
 * Visual studio management component for commercial pricing packages,
 * discount coupons, automated entitlement mappings, affiliate partner management,
 * and order transaction receipts.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { useToast } from '@/hooks/use-toast';
import {
  createOfferAction,
  deleteOfferAction,
  createCouponAction,
  deleteCouponAction,
  updateAffiliatePartnerStatusAction,
} from '@/app/actions/commerce-actions';
import type {
  PortalOffer,
  PortalCoupon,
  PortalOrder,
  AffiliatePartner,
  OfferType,
  BillingInterval,
  CouponDiscountType,
} from '@/lib/types/commerce';
import type { Course } from '@/lib/types/learning';
import type { MembershipPlan } from '@/lib/types/membership';
import {
  CreditCard,
  Tag,
  Users,
  Receipt,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Award,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  Loader2,
} from 'lucide-react';

interface PortalMonetizationManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalMonetizationManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['commerce'],
}: PortalMonetizationManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('offers');

  // 1. Query Offers
  const offersQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'portal_offers'),
            where('portalId', '==', portalId),
            orderBy('price', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: offers, isLoading: isLoadingOffers } = useCollection<PortalOffer>(offersQuery);

  // 2. Query Coupons
  const couponsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'portal_coupons'),
            where('portalId', '==', portalId),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: coupons, isLoading: isLoadingCoupons } = useCollection<PortalCoupon>(couponsQuery);

  // 3. Query Affiliates
  const affiliatesQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'affiliate_partners'), where('portalId', '==', portalId))
        : null,
    [firestore, portalId]
  );
  const { data: affiliates, isLoading: isLoadingAffiliates } = useCollection<AffiliatePartner>(affiliatesQuery);

  // 4. Query Orders
  const ordersQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'portal_orders'),
            where('portalId', '==', portalId),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: orders, isLoading: isLoadingOrders } = useCollection<PortalOrder>(ordersQuery);

  // 5. Query Plans and Courses for Entitlement Dropdowns
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'membership_plans'), where('portalId', '==', portalId))
        : null,
    [firestore, portalId]
  );
  const { data: plans } = useCollection<MembershipPlan>(plansQuery);

  const coursesQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'courses'), where('portalId', '==', portalId))
        : null,
    [firestore, portalId]
  );
  const { data: courses } = useCollection<Course>(coursesQuery);

  // Modal States
  const [isCreateOfferOpen, setIsCreateOfferOpen] = React.useState(false);
  const [isCreateCouponOpen, setIsCreateCouponOpen] = React.useState(false);

  // Create Offer Form State
  const [offerTitle, setOfferTitle] = React.useState('');
  const [offerPrice, setOfferPrice] = React.useState<number | ''>(199);
  const [offerCurrency, setOfferCurrency] = React.useState('USD');
  const [offerType, setOfferType] = React.useState<OfferType>('one_time');
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>('yearly');
  const [grantedPlanId, setGrantedPlanId] = React.useState<string>('none');
  const [grantedCourseId, setGrantedCourseId] = React.useState<string>('none');
  const [offerDescription, setOfferDescription] = React.useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = React.useState(false);

  // Create Coupon Form State
  const [couponCode, setCouponCode] = React.useState('');
  const [discountType, setDiscountType] = React.useState<CouponDiscountType>('percentage');
  const [discountValue, setDiscountValue] = React.useState<number | ''>(20);
  const [maxUses, setMaxUses] = React.useState<number | ''>(100);
  const [isSubmittingCoupon, setIsSubmittingCoupon] = React.useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerTitle.trim() || offerPrice === '') return;

    setIsSubmittingOffer(true);
    try {
      const res = await createOfferAction(
        {
          organizationId,
          portalId,
          workspaceIds,
          title: offerTitle.trim(),
          price: Number(offerPrice),
          currency: offerCurrency,
          offerType,
          billingInterval: offerType === 'subscription' ? billingInterval : undefined,
          grantedPlanId: grantedPlanId !== 'none' ? grantedPlanId : undefined,
          grantedCourseIds: grantedCourseId !== 'none' ? [grantedCourseId] : undefined,
          description: offerDescription.trim() || undefined,
          isActive: true,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Offer Created! 🏷️', description: `Created "${res.data?.title}".` });
      setOfferTitle('');
      setOfferDescription('');
      setIsCreateOfferOpen(false);
    } catch (err: any) {
      toast({ title: 'Error Creating Offer', description: err?.message });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this commercial offer?')) return;
    try {
      await deleteOfferAction(offerId, portalId, portalSlug);
      toast({ title: 'Offer Removed', description: 'Commercial package deleted.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || discountValue === '') return;

    setIsSubmittingCoupon(true);
    try {
      const res = await createCouponAction({
        organizationId,
        portalId,
        code: couponCode.trim(),
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses !== '' ? Number(maxUses) : undefined,
      });

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Coupon Created! 🎟️', description: `Code "${res.data?.code}" is now active.` });
      setCouponCode('');
      setIsCreateCouponOpen(false);
    } catch (err: any) {
      toast({ title: 'Error Creating Coupon', description: err?.message });
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await deleteCouponAction(couponId, portalId);
      toast({ title: 'Coupon Deleted', description: 'Discount code removed.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  const handleUpdatePartnerStatus = async (partnerId: string, status: 'pending' | 'active' | 'suspended') => {
    try {
      await updateAffiliatePartnerStatusAction(partnerId, status, portalId);
      toast({ title: 'Status Updated', description: `Partner is now ${status}.` });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err?.message });
    }
  };

  const totalRevenue = React.useMemo(() => {
    return (orders || []).reduce((acc, o) => acc + (o.paymentStatus === 'completed' ? o.totalAmount : 0), 0);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Navigation ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-10 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger value="offers" className="rounded-xl text-xs font-bold gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Pricing Offers ({offers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="coupons" className="rounded-xl text-xs font-bold gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Coupons ({coupons?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="rounded-xl text-xs font-bold gap-1.5">
              <Users className="w-3.5 h-3.5" /> Affiliates ({affiliates?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-xl text-xs font-bold gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Orders ({orders?.length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'offers' ? (
          <Button
            onClick={() => setIsCreateOfferOpen(true)}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Pricing Offer
          </Button>
        ) : activeTab === 'coupons' ? (
          <Button
            onClick={() => setIsCreateCouponOpen(true)}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Discount Coupon
          </Button>
        ) : null}
      </div>

      {/* ── Tab 1: Pricing Offers Studio ──────────────────────────────── */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          {isLoadingOffers ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading commercial packages...</div>
          ) : (!offers || offers.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <CreditCard className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Pricing Offers Configured</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create one-time purchases, recurring subscriptions, or bundles to monetize courses and community spaces.
              </p>
              <Button
                onClick={() => setIsCreateOfferOpen(true)}
                className="rounded-xl font-bold text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Offer
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map(offer => (
                <Card
                  key={offer.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-bold uppercase capitalize bg-primary/10 text-primary"
                      >
                        {offer.offerType.replace('_', ' ')}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-foreground">{offer.title}</h4>
                      <div className="flex items-baseline gap-1 pt-1">
                        <span className="font-black text-2xl text-foreground">
                          {offer.currency} {offer.price}
                        </span>
                        {offer.offerType === 'subscription' && (
                          <span className="text-xs text-muted-foreground">/{offer.billingInterval}</span>
                        )}
                      </div>
                    </div>

                    {offer.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {offer.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-border space-y-1 text-xs text-muted-foreground">
                      {offer.grantedPlanId && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                          <Award className="w-3.5 h-3.5" /> Grants Membership Plan
                        </div>
                      )}
                      {offer.grantedCourseIds && offer.grantedCourseIds.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-primary" /> Unlocks {offer.grantedCourseIds.length} Course(s)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono text-[10px]">/checkout/{offer.slug}</span>
                    <a
                      href={`/portal/${portalSlug}/checkout/${offer.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-bold text-[11px] flex items-center gap-1 hover:underline"
                    >
                      Checkout Link <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Coupons Studio ─────────────────────────────────────── */}
      {activeTab === 'coupons' && (
        <div className="space-y-4">
          {isLoadingCoupons ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading coupons...</div>
          ) : (!coupons || coupons.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Tag className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Coupons Configured</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create promotional discount codes (% off or fixed amounts) to drive checkout conversions.
              </p>
              <Button
                onClick={() => setIsCreateCouponOpen(true)}
                className="rounded-xl font-bold text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Coupon
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map(coupon => (
                <Card
                  key={coupon.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-primary text-white font-mono font-black text-xs px-2.5 py-0.5">
                        {coupon.code}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="pt-1">
                      <span className="font-black text-xl text-foreground">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% OFF`
                          : `$${coupon.discountValue} OFF`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Used: {coupon.usedCount} {coupon.maxUses ? `/ ${coupon.maxUses}` : 'times'}</span>
                    <span className="font-bold text-emerald-600 text-[11px]">Active ✓</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Affiliate Partners ─────────────────────────────────── */}
      {activeTab === 'affiliates' && (
        <div className="space-y-4">
          {isLoadingAffiliates ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading affiliate partners...</div>
          ) : (!affiliates || affiliates.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Users className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Affiliate Partners Registered</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Members can join your partner program from their dashboard to earn referral commissions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {affiliates.map(partner => (
                <Card
                  key={partner.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-4 bg-card shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold uppercase capitalize ${
                          partner.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : ''
                        }`}
                      >
                        {partner.status}
                      </Badge>
                      <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                        ?ref={partner.referralCode}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-foreground">{partner.partnerName}</h4>
                    <p className="text-xs text-muted-foreground">{partner.partnerEmail}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                    <div className="p-2 bg-muted/30 rounded-xl">
                      <span className="font-black text-sm block">{partner.totalConversions}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Sales</span>
                    </div>
                    <div className="p-2 bg-muted/30 rounded-xl">
                      <span className="font-black text-sm text-primary block">${partner.totalEarnings}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Earned</span>
                    </div>
                    <div className="p-2 bg-muted/30 rounded-xl">
                      <span className="font-black text-sm text-amber-600 block">${partner.pendingBalance}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Unpaid</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Commission: {partner.commissionRate}%</span>
                    {partner.status === 'pending' ? (
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePartnerStatus(partner.id, 'active')}
                        className="h-7 text-xs font-bold bg-emerald-600 text-white rounded-xl"
                      >
                        Approve
                      </Button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600">Active Partner ✓</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 4: Orders & Revenue Ledger ────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Metrics Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold">Total Platform Revenue</span>
              <h3 className="text-2xl sm:text-3xl font-black text-primary">${totalRevenue.toLocaleString()}</h3>
            </Card>
            <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold">Total Orders</span>
              <h3 className="text-2xl sm:text-3xl font-black text-foreground">{orders?.length || 0}</h3>
            </Card>
            <Card className="p-5 rounded-3xl border-2 border-border bg-card space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-bold">Active Offers</span>
              <h3 className="text-2xl sm:text-3xl font-black text-foreground">{offers?.length || 0}</h3>
            </Card>
          </div>

          {/* Orders Table */}
          {isLoadingOrders ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading transaction receipts...</div>
          ) : (!orders || orders.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Receipt className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Orders Placed Yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Completed purchases and checkout transactions will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map(order => (
                <Card
                  key={order.id}
                  className="rounded-2xl border-2 border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-foreground">{order.offerTitle}</span>
                      <Badge className="bg-emerald-500 text-white text-[9px] font-bold py-0 capitalize">
                        {order.paymentStatus}
                      </Badge>
                      {order.couponCode && (
                        <Badge variant="outline" className="text-[9px] font-mono font-bold py-0">
                          {order.couponCode}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Customer: <span className="font-semibold text-foreground">{order.customerName}</span> ({order.customerEmail})
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="font-black text-base text-foreground">
                        {order.currency} {order.totalAmount}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Offer Modal ────────────────────────────────────────── */}
      <Dialog open={isCreateOfferOpen} onOpenChange={setIsCreateOfferOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <CreditCard className="w-4 h-4" /> Offer Builder Studio
            </div>
            <DialogTitle className="text-xl font-bold">Create Pricing Package</DialogTitle>
            <DialogDescription className="text-xs">
              Configure commercial pricing models and automatic entitlement unlocks.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOffer} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Offer Title</Label>
              <Input
                placeholder="e.g. Annual School Bursar Certification Pass"
                value={offerTitle}
                onChange={e => setOfferTitle(e.target.value)}
                className="h-10 text-xs rounded-xl font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Price</Label>
                <Input
                  type="number"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-10 text-xs rounded-xl font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Currency</Label>
                <Select value={offerCurrency} onValueChange={setOfferCurrency}>
                  <SelectTrigger className="h-10 text-xs rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payment Model</Label>
                <Select value={offerType} onValueChange={(val: OfferType) => setOfferType(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="one_time">One-Time Purchase</SelectItem>
                    <SelectItem value="subscription">Recurring Subscription</SelectItem>
                    <SelectItem value="installment">Installment Plan</SelectItem>
                    <SelectItem value="trial">Free Trial Access</SelectItem>
                    <SelectItem value="bundle">All-In-One Bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {offerType === 'subscription' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Billing Interval</Label>
                  <Select value={billingInterval} onValueChange={(val: BillingInterval) => setBillingInterval(val)}>
                    <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <span className="text-xs font-bold text-foreground block">Automated Entitlements Provisioning</span>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Grant Membership Plan</Label>
                <Select value={grantedPlanId} onValueChange={setGrantedPlanId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">None (Course Only)</SelectItem>
                    {plans?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.interval})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Grant Specific Course Access</Label>
                <Select value={grantedCourseId} onValueChange={setGrantedCourseId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">None (All Entitled Courses)</SelectItem>
                    {courses?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold">Package Description & Sales Copy</Label>
              <Textarea
                placeholder="What valuable modules and perks does the student receive?"
                value={offerDescription}
                onChange={e => setOfferDescription(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOfferOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingOffer}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Offer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Coupon Modal ───────────────────────────────────────── */}
      <Dialog open={isCreateCouponOpen} onOpenChange={setIsCreateCouponOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Tag className="w-4 h-4" /> Coupon Generator
            </div>
            <DialogTitle className="text-xl font-bold">Create Discount Code</DialogTitle>
            <DialogDescription className="text-xs">
              Generate percentage or fixed amount discount vouchers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Coupon Code</Label>
              <Input
                placeholder="e.g. LAUNCH20"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="h-10 text-xs rounded-xl font-mono font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Discount Type</Label>
                <Select value={discountType} onValueChange={(val: CouponDiscountType) => setDiscountType(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage">Percentage (% OFF)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($ OFF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Discount Value</Label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-10 text-xs rounded-xl font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Max Uses (Optional)</Label>
              <Input
                type="number"
                placeholder="Leave empty for unlimited"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateCouponOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCoupon}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Coupon'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
