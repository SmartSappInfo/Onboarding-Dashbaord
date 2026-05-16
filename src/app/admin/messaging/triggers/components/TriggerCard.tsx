import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Smartphone, Globe, Building2, Bell, Users, Zap, RefreshCw, PenSquare, Eye } from 'lucide-react';
import type { MessagingTrigger, MessageTemplate, MessageChannel } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TriggerCardProps {
  trigger: MessagingTrigger;
  activeTemplates: Record<string, MessageTemplate | null>; // channel -> template
  onCustomize: (trigger: MessagingTrigger, channel: MessageChannel, existingOverride?: MessageTemplate) => void;
  onRevert: (templateId: string) => void;
}

export function TriggerCard({ trigger, activeTemplates, onCustomize, onRevert }: TriggerCardProps) {
  const getTargetIcon = () => {
    switch (trigger.target) {
      case 'external_client': return <Globe className="h-3.5 w-3.5" />;
      case 'internal_team': return <Building2 className="h-3.5 w-3.5" />;
      default: return <Users className="h-3.5 w-3.5" />;
    }
  };

  const getRecipientIcon = () => {
    switch (trigger.recipientType) {
      case 'internal_alert':
      case 'external_alert': return <Bell className="h-3.5 w-3.5" />;
      default: return <Users className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col hover:border-primary/30 transition-colors">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {trigger.name}
            </CardTitle>
            <CardDescription className="text-xs">{trigger.description}</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 gap-1 bg-background">
            {getTargetIcon()}
            {trigger.target.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 gap-1 bg-background text-muted-foreground">
            {getRecipientIcon()}
            {trigger.recipientType?.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 bg-card">
        <div className="divide-y">
          {trigger.supportedChannels.map(channel => {
            const activeTemplate = activeTemplates[channel];
            const isCustomOverride = activeTemplate?.scope === 'organization';
            
            return (
              <div key={channel} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl shrink-0 shadow-sm border",
                    channel === 'email' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                    channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                    "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize leading-none">{channel}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {activeTemplate ? (
                        <Badge variant={isCustomOverride ? "default" : "secondary"} className={cn("text-[9px] uppercase font-bold tracking-wider h-5 px-1.5", isCustomOverride && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20")}>
                          {isCustomOverride ? 'Custom Override' : 'System Default'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider h-5 px-1.5 text-muted-foreground border-dashed">
                          No Default Set
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCustomOverride ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs font-bold gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => onCustomize(trigger, channel, activeTemplate)}
                      >
                        <PenSquare className="h-3.5 w-3.5" /> Edit Override
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Revert to System Default"
                        onClick={() => activeTemplate?.id && onRevert(activeTemplate.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-bold gap-1 bg-background hover:bg-muted/50"
                      onClick={() => onCustomize(trigger, channel)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Customize
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
