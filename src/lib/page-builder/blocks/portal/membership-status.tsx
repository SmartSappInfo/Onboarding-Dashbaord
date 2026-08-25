import React from 'react';
import { z } from 'zod';
import { Crown, Sparkles, Check, ArrowRight } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const schema = z.object({
  tierName: z.string().default('Executive School Leader Tier'),
  status: z.enum(['active', 'trial', 'past_due', 'canceled']).default('active'),
  renewalDate: z.string().default('March 31, 2026'),
  benefits: z.array(z.string()).default([]),
  upgradeButtonText: z.string().default('Upgrade Membership'),
  upgradeHref: z.string().default('#'),
}).catchall(z.unknown());

type MembershipStatusProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_membership_status',
  label: 'Portal: Membership Tier Status',
  category: 'portal',
  icon: Crown,
  fields: [
    { kind: 'text', key: 'tierName', label: 'Tier Name' },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'trial', label: 'Free Trial' },
        { value: 'past_due', label: 'Payment Due' },
        { value: 'canceled', label: 'Canceled' },
      ],
    },
    { kind: 'text', key: 'renewalDate', label: 'Next Renewal Date' },
    {
      kind: 'list',
      key: 'benefits',
      label: 'Included Benefits',
      itemFields: [{ kind: 'text', key: 'benefit', label: 'Benefit Item' }],
    },
    { kind: 'text', key: 'upgradeButtonText', label: 'Upgrade Button Label' },
    { kind: 'text', key: 'upgradeHref', label: 'Upgrade Link' },
  ],
  defaults: schema.parse({
    tierName: 'Executive School Leader Tier',
    status: 'active',
    renewalDate: 'March 31, 2026',
    benefits: [
      'Unlimited access to all 17 Academy masterclasses',
      'Weekly live executive office hours with senior advisors',
      'Direct WhatsApp emergency operations support desk',
      'Verified completion certificates and credential badges',
    ],
    upgradeButtonText: 'Upgrade to Enterprise',
    upgradeHref: '#',
  }),
  schema,
  render: (props: MembershipStatusProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <div
        className={`p-6 rounded-3xl border-2 transition-all space-y-5 max-w-lg mx-auto ${
          isDark ? 'border-primary/30 bg-primary/5' : 'border-primary/20 bg-primary/5 shadow-md'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Current Plan
              </span>
              <h4 className="font-extrabold text-base text-foreground leading-tight">{props.tierName}</h4>
            </div>
          </div>

          <Badge variant="default" className="text-[10px] font-bold uppercase rounded-full bg-emerald-500 text-white">
            {props.status}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Next billing cycle renewal on <strong className="text-foreground">{props.renewalDate}</strong>.
        </p>

        <div className="space-y-2 border-t border-border/80 pt-4">
          <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider block">
            Included Privileges:
          </span>
          {props.benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-foreground">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{typeof benefit === 'string' ? benefit : (benefit as any).benefit}</span>
            </div>
          ))}
        </div>

        {props.upgradeButtonText && (
          <a href={props.upgradeHref} className="block pt-2">
            <Button className="w-full rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[40px] gap-2">
              <Sparkles className="w-4 h-4" /> {props.upgradeButtonText} <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        )}
      </div>
    );
  },
});
