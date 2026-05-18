import * as React from 'react';
import type { MessagingTrigger, MessageTemplate, MessageChannel } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Globe, Building2, Bell, Users, Zap, PenSquare, 
  Eye, Mail, Smartphone, BarChart3, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlueprintDetailPaneProps {
  trigger: MessagingTrigger;
  globalTemplates: MessageTemplate[] | undefined;
  adoptionCount: number;
  onCustomize: (trigger: MessagingTrigger, channel: MessageChannel) => void;
}

export function BlueprintDetailPane({ trigger, globalTemplates, adoptionCount, onCustomize }: BlueprintDetailPaneProps) {
  const [activeTab, setActiveTab] = React.useState<MessageChannel>('email');

  // Auto-select first supported channel on trigger changes
  React.useEffect(() => {
    if (trigger.supportedChannels.length > 0) {
      if (trigger.supportedChannels.includes('email')) {
        setActiveTab('email');
      } else {
        setActiveTab(trigger.supportedChannels[0]);
      }
    }
  }, [trigger]);

  const activeTemplate = globalTemplates?.find(t => t.templateType === trigger.id && t.channel === activeTab);
  const isConfigured = !!activeTemplate;

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
    <div className="flex flex-col h-full gap-6 p-1 text-left">
      {/* Header Info */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-wider text-[9px] px-2.5 py-0.5">
              {trigger.category.replace('_', ' ')} blueprint
            </Badge>
            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 gap-1 bg-muted/40">
              {getTargetIcon()}
              {trigger.target.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 gap-1 bg-muted/40 text-muted-foreground">
              {getRecipientIcon()}
              {trigger.recipientType?.replace('_', ' ')}
            </Badge>
          </div>
          
          <h2 className="text-xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-500 fill-emerald-500/20" /> {trigger.name}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-3xl mt-1">
            {trigger.description || "Sent when the specified automation lifecycle event is fired in the workspace."}
          </p>
        </div>

        {/* Global Adoption Rates */}
        <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tenant Override Density</span>
            <span className="text-xs font-semibold text-foreground">
              {adoptionCount !== undefined ? (
                <span><strong className="text-amber-500 font-extrabold">{adoptionCount} organizations</strong> have overridden this template for custom branding.</span>
              ) : (
                <span className="animate-pulse">Retrieving stats...</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Tab Selection */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {trigger.supportedChannels.map(channel => (
              <button
                key={channel}
                onClick={() => setActiveTab(channel)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 border",
                  activeTab === channel
                    ? "bg-background text-foreground border-border shadow-sm"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                {channel}
              </button>
            ))}
          </div>

          <div>
            <Badge 
              variant={isConfigured ? "default" : "secondary"} 
              className={cn(
                "text-[9px] uppercase font-bold tracking-wider px-2 h-6 border", 
                isConfigured 
                  ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20" 
                  : "bg-slate-500/5 text-slate-500 border-slate-500/10"
              )}
            >
              {isConfigured ? 'Blueprint Active' : 'Not Configured'}
            </Badge>
          </div>
        </div>

        {/* Device Content Preview Container */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {activeTemplate ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Preview Box */}
              <div className="flex-1 flex flex-col rounded-xl border bg-muted/20 overflow-hidden min-h-[180px]">
                {activeTab === 'email' ? (
                  // Email Preview
                  <div className="flex flex-col flex-1">
                    <div className="bg-background px-4 py-2.5 border-b text-[11px] font-medium space-y-1 shrink-0">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="w-12 text-right">Subject:</span>
                        <span className="font-semibold text-foreground truncate">{activeTemplate.subject || '(None)'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="w-12 text-right">Sender:</span>
                        <span className="font-mono text-foreground/80">&lt;system@platform.com&gt;</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 bg-background overflow-y-auto text-xs leading-relaxed font-normal whitespace-pre-wrap select-text text-foreground">
                      {activeTemplate.body || "No template content configured."}
                    </div>
                  </div>
                ) : (
                  // Phone SMS View
                  <div className="flex-1 flex items-center justify-center p-4 bg-muted/10">
                    <div className="w-full max-w-[280px] bg-background rounded-[2rem] border-4 border-muted-foreground/30 shadow-md p-3 relative overflow-hidden flex flex-col">
                      <div className="w-16 h-4 bg-muted rounded-full mx-auto mb-3 shrink-0" />
                      <div className="flex-1 bg-muted/20 rounded-xl p-3 min-h-[140px] flex flex-col justify-end">
                        <div className="bg-emerald-500/10 border border-emerald-500/10 text-foreground text-[10px] p-2.5 rounded-2xl rounded-br-none max-w-[90%] self-end leading-normal whitespace-pre-wrap select-text">
                          {activeTemplate.body || "No text content set."}
                        </div>
                        <span className="text-[8px] text-muted-foreground mt-1 self-end font-bold px-1">Delivered</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Injected Variables */}
              {activeTemplate.variables && activeTemplate.variables.length > 0 && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Injected variables ({activeTemplate.variables.length})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.variables.map((variable: string) => (
                      <code key={variable} className="px-2 py-0.5 rounded-md bg-background text-[10px] font-mono border border-border text-foreground">
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
              <Eye className="h-12 w-12 text-muted-foreground/30 stroke-[1.5]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No global blueprint set</p>
                <p className="text-xs text-muted-foreground max-w-xs">There is no system default messaging blueprint mapped to this trigger's channel.</p>
              </div>
              <Button 
                onClick={() => onCustomize(trigger, activeTab)}
                className="mt-2 font-bold h-9 px-4 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Sparkles className="h-4 w-4" /> Initialize Blueprint
              </Button>
            </div>
          )}
        </div>

        {/* Action Footer */}
        {activeTemplate && (
          <div className="border-t bg-muted/10 px-6 py-4 flex items-center justify-between shrink-0">
            <Button
              onClick={() => onCustomize(trigger, activeTab)}
              className="font-bold h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1.5 px-4"
            >
              <PenSquare className="h-4 w-4" /> Edit Global Blueprint
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
