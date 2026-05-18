import * as React from 'react';
import type { MessagingTrigger, MessageTemplate } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Mail, Smartphone, Globe, Building2, Bell, Users, BarChart3, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlueprintListItemProps {
  trigger: MessagingTrigger;
  isActive: boolean;
  globalTemplates: MessageTemplate[] | undefined;
  adoptionCount: number;
  onClick: () => void;
}

function BlueprintListItemComponent({ trigger, isActive, globalTemplates, adoptionCount, onClick }: BlueprintListItemProps) {
  const getTargetIcon = () => {
    switch (trigger.target) {
      case 'external_client': return <Globe className="h-3 w-3" />;
      case 'internal_team': return <Building2 className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  // Determine channels that are configured globally
  const configuredChannels = trigger.supportedChannels.filter(channel => 
    globalTemplates?.some(t => t.templateType === trigger.id && t.channel === channel)
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 group relative overflow-hidden",
        isActive 
          ? "bg-emerald-500/5 border-emerald-500/30 shadow-sm shadow-emerald-500/5 ring-1 ring-emerald-500/10" 
          : "bg-card hover:bg-muted/30 border-border hover:border-border/80"
      )}
    >
      {/* Decorative vertical border indicator */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[4px] transition-all duration-300",
          isActive ? "bg-emerald-500" : "bg-transparent group-hover:bg-muted-foreground/30"
        )} 
      />

      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm tracking-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-500 transition-colors">
            {trigger.name}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[240px]">
            {trigger.id}
          </p>
        </div>

        {adoptionCount > 0 && (
          <Badge 
            variant="outline" 
            className="shrink-0 text-[8px] font-bold tracking-wider uppercase bg-amber-500/5 text-amber-600 border-amber-500/20 gap-1 h-5 px-1.5"
          >
            <BarChart3 className="h-2.5 w-2.5" /> {adoptionCount} overrides
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pl-1 mt-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 gap-1 bg-background">
            {getTargetIcon()}
            {trigger.target.replace('_', ' ')}
          </Badge>
        </div>

        {/* Supported Channels with Activation dots */}
        <div className="flex items-center gap-1.5">
          {trigger.supportedChannels.map(channel => {
            const isConfigured = configuredChannels.includes(channel);
            const isEmail = channel === 'email';

            return (
              <div
                key={channel}
                title={`${channel.toUpperCase()} ${isConfigured ? '(Active Global Blueprint)' : '(Not Configured)'}`}
                className={cn(
                  "p-1 rounded-lg border text-[10px] font-bold uppercase shrink-0 transition-all flex items-center gap-1",
                  isConfigured
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.1)]"
                    : "bg-slate-500/5 text-slate-400 border-slate-500/10"
                )}
              >
                {channel === 'email' ? <Mail className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                {isConfigured && <Check className="h-2 w-2 stroke-[3]" />}
              </div>
            );
          })}
        </div>
      </div>
    </button>
  );
}

// Custom memoized component to optimize render loops
export const BlueprintListItem = React.memo(BlueprintListItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.trigger.id === nextProps.trigger.id &&
    prevProps.adoptionCount === nextProps.adoptionCount &&
    prevProps.globalTemplates?.length === nextProps.globalTemplates?.length
  );
});
