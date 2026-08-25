import React from 'react';
import { z } from 'zod';
import { User, Award, Flame, Zap, ShieldCheck } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const schema = z.object({
  memberName: z.string().default('Kwame Mensah'),
  memberRole: z.string().default('School Administrator'),
  avatarUrl: z.string().default(''),
  points: z.number().default(1450),
  streakDays: z.number().default(12),
  trackName: z.string().default('Fee Masterclass Track'),
  badgesCount: z.number().default(5),
  bio: z.string().default('Head of Finance & Operations at St. Jude Academy.'),
}).catchall(z.unknown());

type MemberProfileProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_member_profile',
  label: 'Portal: Member Profile Card',
  category: 'portal',
  icon: User,
  fields: [
    { kind: 'text', key: 'memberName', label: 'Member Name' },
    { kind: 'text', key: 'memberRole', label: 'Member Role' },
    { kind: 'image', key: 'avatarUrl', label: 'Avatar URL' },
    { kind: 'number', key: 'points', label: 'Reward Points' },
    { kind: 'number', key: 'streakDays', label: 'Learning Streak (Days)' },
    { kind: 'text', key: 'trackName', label: 'Active Track' },
    { kind: 'number', key: 'badgesCount', label: 'Badges Count' },
    { kind: 'textarea', key: 'bio', label: 'Bio / Tagline' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: MemberProfileProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <div
        className={`p-6 rounded-3xl border-2 transition-all space-y-4 max-w-md mx-auto ${
          isDark ? 'border-white/10 bg-card/80' : 'border-black/10 bg-card shadow-md'
        }`}
      >
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 border-2 border-primary">
            <AvatarImage src={props.avatarUrl} alt={props.memberName} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-base">
              {props.memberName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-0.5">
            <h4 className="font-extrabold text-base text-foreground leading-tight flex items-center gap-1.5">
              {props.memberName}
              <ShieldCheck className="w-4 h-4 text-primary" />
            </h4>
            <p className="text-xs text-muted-foreground">{props.memberRole}</p>
            <Badge variant="outline" className="text-[10px] font-bold mt-1">
              {props.trackName}
            </Badge>
          </div>
        </div>

        {props.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed italic border-t border-border pt-3">
            "{props.bio}"
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
          <div className="p-2 rounded-xl bg-muted/40 space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" /> Points
            </span>
            <p className="text-sm font-extrabold text-foreground tabular-nums">{props.points}</p>
          </div>

          <div className="p-2 rounded-xl bg-muted/40 space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-rose-500" /> Streak
            </span>
            <p className="text-sm font-extrabold text-foreground tabular-nums">{props.streakDays}d</p>
          </div>

          <div className="p-2 rounded-xl bg-muted/40 space-y-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase flex items-center justify-center gap-1">
              <Award className="w-3 h-3 text-emerald-500" /> Badges
            </span>
            <p className="text-sm font-extrabold text-foreground tabular-nums">{props.badgesCount}</p>
          </div>
        </div>
      </div>
    );
  },
});
