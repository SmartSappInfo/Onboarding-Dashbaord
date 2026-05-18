'use client';

import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Mail, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '@/app/admin/components/MessagingTemplateSelector';
import type { TemplateCategory, RecipientType } from '@/lib/types';

interface MessagingChannelBlockProps {
  enableLabel: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  channels: ('email' | 'sms')[];
  onChannelsChange: (v: ('email' | 'sms')[]) => void;
  category: TemplateCategory;
  recipientType: RecipientType;
  templateTypePrefix: string;
  emailValue: string;
  onEmailChange: (v: string) => void;
  smsValue: string;
  onSmsChange: (v: string) => void;
  placeholderEmail?: string;
  placeholderSms?: string;
  showChannelsToggle?: boolean;
  hideSwitch?: boolean;
  /** Direct children rendered below switches/dropdowns, e.g., nested sub-sections */
  children?: React.ReactNode;
}

export const MessagingChannelBlock = React.memo(function MessagingChannelBlock({
  enableLabel,
  enabled,
  onEnabledChange,
  channels,
  onChannelsChange,
  category,
  recipientType,
  templateTypePrefix,
  emailValue,
  onEmailChange,
  smsValue,
  onSmsChange,
  placeholderEmail = "Select email template...",
  placeholderSms = "Select SMS template...",
  showChannelsToggle = true,
  hideSwitch = false,
  children,
}: MessagingChannelBlockProps) {

  const toggleChannel = React.useCallback((ch: 'email' | 'sms') => {
    const set = new Set(channels);
    if (set.has(ch)) {
      set.delete(ch);
    } else {
      set.add(ch);
    }
    onChannelsChange(Array.from(set) as ('email' | 'sms')[]);
  }, [channels, onChannelsChange]);

  return (
    <div className="space-y-4">
      {!hideSwitch && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold">{enableLabel}</Label>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      )}

      {(enabled || hideSwitch) && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Channel Selector Buttons */}
          {showChannelsToggle && (
            <div className="flex items-center gap-1">
              {(['email', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                    channels.includes(ch)
                      ? ch === 'email'
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-green-500/10 text-green-600"
                      : "bg-muted/20 text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                >
                  {ch === 'email' ? (
                    <Mail className="h-3 w-3" />
                  ) : (
                    <Smartphone className="h-3 w-3" />
                  )}
                  {ch}
                </button>
              ))}
            </div>
          )}

          {/* Template Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.includes('email') && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                  <Mail className="h-2.5 w-2.5" /> Email Template
                </span>
                <MessagingTemplateSelector
                  category={category}
                  recipientType={recipientType}
                  channel="email"
                  templateTypePrefix={templateTypePrefix}
                  value={emailValue}
                  onValueChange={onEmailChange}
                  placeholder={placeholderEmail}
                  className="h-9 rounded-xl text-[10px] font-bold"
                />
              </div>
            )}
            {channels.includes('sms') && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                  <Smartphone className="h-2.5 w-2.5" /> SMS Template
                </span>
                <MessagingTemplateSelector
                  category={category}
                  recipientType={recipientType}
                  channel="sms"
                  templateTypePrefix={templateTypePrefix}
                  value={smsValue}
                  onValueChange={onSmsChange}
                  placeholder={placeholderSms}
                  className="h-9 rounded-xl text-[10px] font-bold"
                />
              </div>
            )}
          </div>

          {/* Nested Children (for sub-sections) */}
          {children}
        </div>
      )}
    </div>
  );
});
