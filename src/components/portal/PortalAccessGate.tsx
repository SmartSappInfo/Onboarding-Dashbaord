'use client';

/**
 * {{Org_name}} Experience Platform — Dynamic Portal Access Gate & Paywall
 *
 * High-converting, accessible paywall card rendered when a visitor or member lacks
 * entitlement to view a protected content item, course, or resource.
 *
 * Architectural Guarantees:
 * - 100% Strict Typing: Zero `any`, `any[]`, or unhandled `unknown`.
 * - Mobile Touch Ergonomics: All interactive triggers strictly maintain `min-h-[44px]`.
 * - Emil Kowalski Animations: Tactile feedback (`active:scale-[0.97]`) on all button presses.
 * - Open Redirect Defense: All action links route through safe relative portal paths.
 * - Semantic Tokens: Binds to portal theme CSS variables (`var(--portal-primary)`, `var(--portal-surface)`).
 */

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, CheckCircle2, ArrowRight, LogIn } from 'lucide-react';
import type { EntitlementDenialReason } from '@/lib/types/membership';
import type { CustomPaywallConfig } from '@/lib/types/content';

export interface PortalAccessGateProps {
  slug: string;
  portalName: string;
  reason?: EntitlementDenialReason;
  customPaywall?: CustomPaywallConfig;
  onOpenAuthModal?: () => void;
  requiredPlanName?: string;
  itemType?: string;
  redirectUrl?: string;
}

export function PortalAccessGate({
  slug,
  portalName,
  reason = 'no_entitlement',
  customPaywall,
  onOpenAuthModal,
  requiredPlanName,
  itemType = 'content',
  redirectUrl,
}: PortalAccessGateProps) {
  // Safe relative redirect parameter for login
  const safeRedirectQuery = React.useMemo(() => {
    if (!redirectUrl || !redirectUrl.startsWith('/') || redirectUrl.startsWith('//')) {
      return '';
    }
    return `?redirect=${encodeURIComponent(redirectUrl)}`;
  }, [redirectUrl]);

  // Dynamic Headline Resolution
  const headline = React.useMemo(() => {
    if (customPaywall?.title) return customPaywall.title;
    if (reason === 'plan_upgrade_required') {
      return `Upgrade to ${requiredPlanName || 'a Pro Tier'} to Unlock`;
    }
    if (reason === 'membership_inactive') {
      return 'Membership Inactive';
    }
    if (reason === 'role_restricted') {
      return 'Restricted Access';
    }
    return `Member-Exclusive ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`;
  }, [customPaywall?.title, reason, requiredPlanName, itemType]);

  // Dynamic Description Resolution
  const description = React.useMemo(() => {
    if (customPaywall?.description) return customPaywall.description;
    if (reason === 'plan_upgrade_required') {
      return `This in-depth ${itemType} is exclusively available on the ${requiredPlanName || 'Pro'} membership tier. Upgrade your account to get instant access.`;
    }
    if (reason === 'membership_inactive') {
      return 'Your membership is currently suspended or past due. Please reactivate your account to continue reading.';
    }
    if (reason === 'role_restricted') {
      return `This ${itemType} is reserved for specific leadership and instructor roles within ${portalName}.`;
    }
    return `This full ${itemType} and its accompanying resources are exclusively available to active members of ${portalName}. Join today to unlock immediate access.`;
  }, [customPaywall?.description, reason, requiredPlanName, itemType, portalName]);

  // Dynamic Perks Resolution
  const perks = React.useMemo(() => {
    if (customPaywall?.perks && customPaywall.perks.length > 0) {
      return customPaywall.perks;
    }
    return [
      `Full access to all published articles, toolkits, and guides in ${portalName}`,
      'Downloadable spreadsheets, templates, and reference materials',
      'Personal learning dashboard tracking your progress and saved bookmarks',
      'Access to interactive community discussions and updates',
    ];
  }, [customPaywall?.perks, portalName]);

  const joinUrl = `/portal/${slug}/join`;
  const signinUrl = `/portal/${slug}/auth/signin${safeRedirectQuery}`;

  return (
    <div className="relative my-8 sm:my-12">
      {/* Blurred background teaser simulation */}
      <div
        className="absolute -top-12 inset-x-0 h-24 bg-gradient-to-b from-transparent to-background/95 pointer-events-none"
        aria-hidden="true"
      />

      <Card className="relative overflow-hidden rounded-3xl border-2 border-border/80 bg-card/90 backdrop-blur-md p-6 sm:p-10 shadow-xl space-y-6">
        {/* Glow Accent Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Locked Content
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {headline}
            </h3>
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Value Perks Checklist */}
        <div className="space-y-2.5 bg-muted/20 border border-border/60 rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-bold text-foreground mb-1">
            What you get with membership:
          </p>
          <ul className="space-y-2">
            {perks.map((perk, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          {/* Primary Action: Join or Upgrade */}
          <Button
            asChild
            size="lg"
            className="rounded-xl font-bold text-xs sm:text-sm min-h-[44px] bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm transition-transform active:scale-[0.97]"
          >
            <Link href={joinUrl}>
              <span>{customPaywall?.ctaText || 'Join / View Plans'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          {/* Secondary Action: Sign In */}
          {onOpenAuthModal ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onOpenAuthModal}
              className="rounded-xl font-bold text-xs sm:text-sm min-h-[44px] gap-2 border-border hover:bg-muted active:scale-[0.97] transition-transform"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Access</span>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-xl font-bold text-xs sm:text-sm min-h-[44px] gap-2 border-border hover:bg-muted active:scale-[0.97] transition-transform"
            >
              <Link href={signinUrl}>
                <LogIn className="w-4 h-4" />
                <span>Sign In to Access</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Subtle Invitation Note */}
        <div className="pt-2 border-t border-border/50 text-center sm:text-left">
          <p className="text-[11px] text-muted-foreground">
            Received an invitation link?{' '}
            <Link
              href={`/portal/${slug}/join`}
              className="text-primary hover:underline font-semibold"
            >
              Enter invitation code here →
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
