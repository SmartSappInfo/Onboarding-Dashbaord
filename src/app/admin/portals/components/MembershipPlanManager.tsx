'use client';

/**
 * {{Org_name}} Experience Platform — Membership Plans & Pricing Tiers Manager
 *
 * Configurator for Free, Monthly, Annual, and Lifetime subscription plans
 * with feature checklists, unlocked resource grants, and pricing settings.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  createPlanAction,
  updatePlanAction,
  archivePlanAction,
} from '@/app/actions/membership-actions';
import type {
  MembershipPlan,
  PlanBillingInterval,
} from '@/lib/types/membership';
import {
  CreditCard,
  Plus,
  Edit2,
  Archive,
  Check,
  Sparkles,
  Zap,
  Shield,
  Loader2,
  Trash2,
} from 'lucide-react';

interface MembershipPlanManagerProps {
  portalId: string;
  organizationId: string;
  workspaceIds: string[];
  plans: MembershipPlan[];
  onPlansUpdated?: () => void;
}

export function MembershipPlanManager({
  portalId,
  organizationId,
  workspaceIds,
  plans,
  onPlansUpdated,
}: MembershipPlanManagerProps) {
  const { toast } = useToast();

  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<MembershipPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState<number>(0);
  const [currency, setCurrency] = React.useState('USD');
  const [interval, setInterval] = React.useState<PlanBillingInterval>('monthly');
  const [trialDays, setTrialDays] = React.useState<number>(0);
  const [badgeText, setBadgeText] = React.useState('');
  const [isPopular, setIsPopular] = React.useState(false);
  const [featureInput, setFeatureInput] = React.useState('');
  const [features, setFeatures] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (editingPlan) {
      setName(editingPlan.name);
      setSlug(editingPlan.slug);
      setDescription(editingPlan.description || '');
      setPrice(editingPlan.price);
      setCurrency(editingPlan.currency);
      setInterval(editingPlan.interval);
      setTrialDays(editingPlan.trialDays || 0);
      setBadgeText(editingPlan.badgeText || '');
      setIsPopular(editingPlan.isPopular || false);
      setFeatures(editingPlan.features || []);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setPrice(0);
      setCurrency('USD');
      setInterval('monthly');
      setTrialDays(0);
      setBadgeText('');
      setIsPopular(false);
      setFeatures(['Unlimited Course Access', 'Community Access', 'Downloadable Toolkits']);
    }
  }, [editingPlan, isEditorOpen]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setIsEditorOpen(true);
  };

  const handleAddFeature = () => {
    if (!featureInput.trim()) return;
    setFeatures([...features, featureInput.trim()]);
    setFeatureInput('');
  };

  const handleRemoveFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Plan Name Required', description: 'Please enter a name for the tier.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPlan) {
        const res = await updatePlanAction(
          editingPlan.id,
          {
            name,
            slug,
            description,
            price,
            currency,
            interval,
            trialDays: trialDays > 0 ? trialDays : undefined,
            features,
            badgeText: badgeText || undefined,
            isPopular,
          },
          portalId
        );

        if (!res.success) throw new Error(res.error || 'Failed to update plan.');
        toast({ title: 'Plan Updated 🎉', description: `Saved changes to "${name}".` });
      } else {
        const res = await createPlanAction({
          portalId,
          organizationId,
          workspaceIds,
          name,
          slug: slug || undefined,
          description,
          price,
          currency,
          interval,
          trialDays: trialDays > 0 ? trialDays : undefined,
          features,
          badgeText: badgeText || undefined,
          isPopular,
        });

        if (!res.success) throw new Error(res.error || 'Failed to create plan.');
        toast({ title: 'Plan Created! 🚀', description: `Created new tier "${name}".` });
      }

      setIsEditorOpen(false);
      onPlansUpdated?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Operation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (plan: MembershipPlan) => {
    if (!confirm(`Are you sure you want to archive "${plan.name}"?`)) return;
    try {
      const res = await archivePlanAction(plan.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to archive plan.');
      toast({ title: 'Plan Archived', description: `"${plan.name}" has been archived.` });
      onPlansUpdated?.();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Archive failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Plans Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Membership Plans & Tiers
          </h4>
          <p className="text-xs text-muted-foreground">
            Configure free, recurring monthly/annual, or one-time lifetime membership packages.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          size="sm"
          className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create New Tier
        </Button>
      </div>

      {/* ── Plan Cards Grid ──────────────────────────────────────────── */}
      {plans.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/20">
          <Sparkles className="w-8 h-8 mx-auto text-primary" />
          <h5 className="font-bold text-xs text-foreground">No Membership Plans Created</h5>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create membership tiers to unlock gated content, courses, and community spaces.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="rounded-xl font-bold text-xs gap-1.5 mt-2">
            <Plus className="w-3.5 h-3.5" /> Add Default Free Tier
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isFree = plan.price === 0;

            return (
              <Card
                key={plan.id}
                className={`rounded-3xl border-2 transition-all flex flex-col justify-between p-6 relative ${
                  plan.isPopular ? 'border-primary shadow-md bg-primary/5' : 'border-border bg-card'
                }`}
              >
                {plan.badgeText && (
                  <Badge className="absolute -top-3 right-6 text-[10px] uppercase font-black bg-primary text-white px-2.5 py-0.5 rounded-full shadow-xs">
                    {plan.badgeText}
                  </Badge>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{plan.name}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{plan.interval.replace('_', ' ')} Plan</p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-foreground">
                        {isFree ? 'Free' : `${plan.currency} ${plan.price}`}
                      </span>
                      {!isFree && <span className="text-[10px] text-muted-foreground block">/{plan.interval}</span>}
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
                  )}

                  <div className="pt-2 border-t border-border space-y-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                      Included Features:
                    </span>
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-border flex items-center justify-between mt-4">
                  <Badge variant={plan.status === 'active' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold">
                    {plan.status}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(plan)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold text-primary gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>

                    {plan.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleArchive(plan)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-amber-600"
                        title="Archive Tier"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Slide-Over Plan Editor ────────────────────────────────────── */}
      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6 md:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <SheetHeader className="pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <CreditCard className="w-4 h-4" /> Plan Editor
              </div>
              <SheetTitle className="text-xl font-bold">
                {editingPlan ? `Edit ${editingPlan.name}` : 'Create Membership Plan'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Define membership pricing, billing frequency, badge branding, and feature checklist.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Plan Name <span className="text-rose-500">*</span></Label>
                <Input
                  placeholder="e.g. Academy VIP Access"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-10 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Price (0 for Free)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl text-xs font-bold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Currency</Label>
                  <Input
                    placeholder="USD or GHS"
                    value={currency}
                    onChange={e => setCurrency(e.target.value.toUpperCase())}
                    className="h-10 rounded-xl text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Billing Interval</Label>
                  <Select value={interval} onValueChange={(i: PlanBillingInterval) => setInterval(i)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual (Yearly)</SelectItem>
                      <SelectItem value="one_time">One-Time Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Trial Days (Optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={trialDays}
                    onChange={e => setTrialDays(parseInt(e.target.value) || 0)}
                    className="h-10 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Badge Text (e.g. POPULAR)</Label>
                  <Input
                    placeholder="e.g. BEST VALUE"
                    value={badgeText}
                    onChange={e => setBadgeText(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 mt-5">
                  <Label className="text-xs font-bold cursor-pointer">Highlight Tier</Label>
                  <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Description</Label>
                <Textarea
                  placeholder="Brief summary of who this plan is tailored for..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="rounded-xl text-xs min-h-[60px] resize-none"
                />
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-bold">Included Features & Bullet Points</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. 1-on-1 Coaching Session"
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                    className="h-10 rounded-xl text-xs"
                  />
                  <Button type="button" onClick={handleAddFeature} size="sm" className="h-10 rounded-xl font-bold text-xs">
                    Add
                  </Button>
                </div>

                <div className="space-y-1.5 pt-1">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-muted/40 text-xs">
                      <span className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> {feat}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="text-muted-foreground hover:text-rose-500 font-bold p-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="flex flex-row items-center justify-between pt-6 border-t border-border mt-6">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)} className="rounded-xl font-bold text-xs">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || !name.trim()}
              onClick={handleSave}
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {editingPlan ? 'Save Changes' : 'Create Tier'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
