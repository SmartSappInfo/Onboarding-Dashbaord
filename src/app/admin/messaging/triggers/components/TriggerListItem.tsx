import * as React from 'react';
import type { MessagingTrigger, MessageTemplate } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Mail, Smartphone, Globe, Building2, Bell, Users, ShieldAlert, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TriggerListItemProps {
  trigger: MessagingTrigger;
  isActive: boolean;
  activeTemplates: Record<string, MessageTemplate | null>;
  onClick: () => void;
}

function TriggerListItemComponent({ trigger, isActive, activeTemplates, onClick }: TriggerListItemProps) {
  const getTargetIcon = () => {
    switch (trigger.target) {
      case 'external_client': return <Globe className="h-3 w-3" />;
      case 'internal_team': return <Building2 className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const getRecipientIcon = () => {
    switch (trigger.recipientType) {
      case 'internal_alert':
      case 'external_alert': return <Bell className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  // Determine channels that have custom overrides
  const customOverrideChannels = Object.entries(activeTemplates)
    .filter(([_, tpl]) => tpl?.scope === 'organization')
    .map(([channel]) => channel);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 group relative overflow-hidden",
        isActive 
          ? "bg-amber-500/5 border-amber-500/30 shadow-sm shadow-amber-500/5 ring-1 ring-amber-500/10" 
          : "bg-card hover:bg-muted/30 border-border hover:border-border/80"
      )}
    >
      {/* Decorative vertical border indicator */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[4px] transition-all duration-300",
          isActive ? "bg-amber-500" : "bg-transparent group-hover:bg-muted-foreground/30"
        )} 
      />

      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm tracking-tight text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
            {trigger.name}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[240px]">
            {trigger.id}
          </p>
        </div>

        {customOverrideChannels.length > 0 && (
          <Badge 
            variant="outline" 
            className="shrink-0 text-[8px] font-bold tracking-wider uppercase bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-1 h-5 px-1.5"
          >
            <Award className="h-2.5 w-2.5" /> Overridden
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pl-1 mt-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 gap-1 bg-background">
            {getTargetIcon()}
            {trigger.target.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 gap-1 bg-background text-muted-foreground">
            {getRecipientIcon()}
            {trigger.recipientType?.replace('_', ' ')}
          </Badge>
        </div>

        {/* Supported Channels Badges */}
        <div className="flex items-center gap-1">
          {trigger.supportedChannels.map(channel => {
            const hasOverride = customOverrideChannels.includes(channel);
            const isEmail = channel === 'email';
            const isSms = channel === 'sms';

            return (
              <div
                key={channel}
                title={`${channel.toUpperCase()} ${hasOverride ? '(Custom Override)' : '(System Default)'}`}
                className={cn(
                  "p-1 rounded-lg border text-[10px] font-bold uppercase shrink-0 transition-all",
                  hasOverride
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : isEmail
                      ? "bg-blue-500/5 text-blue-600 border-blue-500/10"
                      : isSms
                        ? "bg-orange-500/5 text-orange-500 border-orange-500/10"
                        : "bg-primary/5 text-primary border-primary/10"
                )}
              >
                {channel === 'email' ? <Mail className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
              </div>
            );
          })}
        </div>
      </div>
    </button>
  );
}

// Custom memoized component to optimize render loops
export const TriggerListItem = React.memo(TriggerListItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.trigger.id === nextProps.trigger.id &&
    // Shallow check of activeTemplates overrides to re-render row if a template overrides state shifts
    Object.keys(prevProps.activeTemplates).every(key => {
      const prevTpl = prevProps.activeTemplates[key];
      const nextTpl = nextProps.activeTemplates[key];
      return prevTpl?.scope === nextTpl?.scope && prevTpl?.id === nextTpl?.id;
    })
  );
});
