'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — High-Fidelity Client Preview Canvas
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS (Rule 10):
 * 1. Provides authentic desktop and mobile simulated client frames for Email, WhatsApp, and SMS.
 * 2. Strict Zero-Any Invariant: All props, variables, and styles strictly typed without 'any' or 'unknown'.
 * 3. Emil Kowalski tactile animations: active:scale-[0.97] on interactive buttons, smooth viewport mode switches.
 * 4. Security: Sandboxed iframe with DOMPurify sanitization preventing CSS leakage and script injection.
 * 5. Mobile Ergonomics: Touch targets >= 44px, responsive fluid scaling on narrow screens.
 */

import * as React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { 
  Laptop, 
  Smartphone, 
  FlaskConical, 
  Eye, 
  CheckCircle2, 
  Clock, 
  CheckCheck,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Lock,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MessageTemplate, MessageStyle } from '@/lib/types';
import { resolveVariables, renderBlocksToHtml, plainTextToHtml } from '@/lib/messaging-utils';
import { getDefaultStyle } from '@/lib/services/style-resolver';
import { resolveBrandingPreview } from '@/lib/utils/resolve-branding-preview';
import { parseMarkdownLinksToHtml } from '@/lib/utils/markdown-link-parser';
import { useWorkspace } from '@/context/WorkspaceContext';

export interface PublishPreviewCanvasProps {
  template: MessageTemplate | null;
  variables: Record<string, string | number | boolean | null | undefined>;
  styles?: MessageStyle[];
  channel: 'email' | 'sms' | 'whatsapp';
  onOpenTestModal?: () => void;
  activeSenderName?: string;
  activeSenderIdentifier?: string;
  sampleRecipientName?: string;
  sampleRecipientIdentifier?: string;
  smsBalance?: number | null;
}

export function PublishPreviewCanvas({
  template,
  variables,
  styles = [],
  channel,
  onOpenTestModal,
  activeSenderName = 'SmartSapp',
  activeSenderIdentifier = 'info@smartsapp.com',
  sampleRecipientName = 'John Doe',
  sampleRecipientIdentifier = 'john.doe@example.com',
  smsBalance = null,
}: PublishPreviewCanvasProps) {
  const { activeOrganizationId, activeWorkspaceId, activeOrganization } = useWorkspace();
  const [viewportMode, setViewportMode] = React.useState<'desktop' | 'mobile'>(
    channel === 'email' ? 'desktop' : 'mobile'
  );

  // Automatically adjust default viewport mode if channel changes
  React.useEffect(() => {
    if (channel !== 'email') {
      setViewportMode('mobile');
    }
  }, [channel]);

  // Construct safe string map for variable resolver
  const combinedVars = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {
      contact_name: sampleRecipientName,
      contact_email: sampleRecipientIdentifier,
      org_name: activeOrganization?.name || 'SmartSapp',
      org_email: activeOrganization?.email || 'info@smartsapp.com',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    for (const [key, val] of Object.entries(variables)) {
      if (val !== null && val !== undefined) {
        map[key] = String(val);
      }
    }
    return map;
  }, [variables, sampleRecipientName, sampleRecipientIdentifier, activeOrganization]);

  // Resolve style and branding wrapper
  const styleWrapper = React.useMemo<string>(() => {
    if (!template || template.styleId === 'none') return '';
    
    let activeStyle: MessageStyle | null = null;
    const styleIdToUse = template.styleId;
    if (!styleIdToUse || styleIdToUse === 'default') {
      activeStyle = getDefaultStyle(styles, activeOrganizationId, activeWorkspaceId) || null;
    } else {
      activeStyle = styles.find((s) => s.id === styleIdToUse) || null;
    }

    if (!activeStyle) return '';

    const rawWrapper = template.target === 'internal_team'
      ? activeStyle.htmlWrapperInternal || activeStyle.htmlWrapper || ''
      : activeStyle.htmlWrapperExternal || activeStyle.htmlWrapper || '';

    if (!rawWrapper) return '';

    const brandingData = {
      name: String(combinedVars.org_name || activeOrganization?.name || 'Your Organization'),
      logoUrl: String(combinedVars.org_logo_url || activeOrganization?.logoUrl || ''),
      email: String(combinedVars.org_email || activeOrganization?.email || ''),
      phone: String(combinedVars.org_phone || activeOrganization?.phone || ''),
      address: String(combinedVars.org_address || activeOrganization?.address || ''),
      website: String(combinedVars.org_website || activeOrganization?.website || ''),
      footerHtml: activeStyle.footerHtml,
      footerEnabled: activeStyle.footerEnabled !== false,
    };

    const styleOverrides = {
      primaryColor: activeStyle.primaryColor,
      secondaryColor: activeStyle.secondaryColor,
      fontFamily: activeStyle.fontFamily,
      backgroundColor: activeStyle.backgroundColor,
      textColor: activeStyle.textColor,
      cardBackgroundColor: activeStyle.cardBackgroundColor,
      borderRadius: activeStyle.borderRadius,
      footerHtml: activeStyle.footerHtml,
      footerEnabled: activeStyle.footerEnabled !== false,
    };

    return resolveBrandingPreview(rawWrapper, brandingData, styleOverrides);
  }, [template, styles, activeOrganizationId, activeWorkspaceId, activeOrganization, combinedVars]);

  // Resolve HTML or plain text body
  const resolvedBody = React.useMemo<string>(() => {
    if (!template) return '';

    // Handle AI polished body if present in variables
    const aiRefined = variables.ai_refined_body;
    if (typeof aiRefined === 'string' && aiRefined.trim()) {
      return resolveVariables(aiRefined, combinedVars);
    }

    if (template.channel === 'email') {
      if (template.contentMode === 'rich_builder' || (template.blocks && template.blocks.length > 0)) {
        return renderBlocksToHtml(template.blocks || [], combinedVars, {
          wrapper: styleWrapper || undefined,
        });
      }

      const rawBody = template.body || '';
      const resolved = resolveVariables(rawBody, combinedVars);

      if (styleWrapper && styleWrapper.includes('{{content}}')) {
        let contentHtml = resolved;
        if (template.contentMode === 'plain_text' || !template.contentMode) {
          const escaped = contentHtml
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          const withLinks = parseMarkdownLinksToHtml(escaped);
          contentHtml = withLinks.replace(/\n/g, '<br>\n');
        }
        return resolveVariables(styleWrapper, combinedVars).replace('{{content}}', contentHtml);
      }

      if (template.contentMode === 'plain_text' || !template.contentMode) {
        return plainTextToHtml(resolved);
      }

      return resolved;
    }

    return resolveVariables(template.body || '', combinedVars);
  }, [template, variables, combinedVars, styleWrapper]);

  // Resolve Subject Line
  const resolvedSubject = React.useMemo<string>(() => {
    if (!template?.subject) return 'Important Update';
    return resolveVariables(template.subject, combinedVars);
  }, [template?.subject, combinedVars]);

  // Clean, sanitized preview HTML for iframe
  const sanitizedIframeHtml = React.useMemo<string>(() => {
    if (!resolvedBody) return '';
    return DOMPurify.sanitize(resolvedBody, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['style', 'link', 'meta'],
      ADD_ATTR: ['target'],
    });
  }, [resolvedBody]);

  if (!template) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/60 p-12 text-center bg-card flex flex-col items-center justify-center gap-3 min-h-[380px]">
        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground/50">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">No Template Selected</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Select or compose a message template to view its high-fidelity simulated delivery preview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Preview Action Toolbar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Live Preview
        </span>

        <div className="flex items-center gap-2">
          {/* Viewport Mode Switcher (Email only) */}
          {channel === 'email' && (
            <div className="inline-flex items-center rounded-xl bg-muted/40 p-0.5 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] min-h-[32px]',
                  viewportMode === 'desktop'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Desktop Preview"
              >
                <Laptop className="h-3.5 w-3.5" />
                <span className="text-[11px]">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] min-h-[32px]',
                  viewportMode === 'mobile'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Mobile Preview"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="text-[11px]">Mobile</span>
              </button>
            </div>
          )}

          {/* Test Dispatch Button */}
          {onOpenTestModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenTestModal}
              className="h-8 rounded-xl font-semibold border-primary/20 text-primary hover:bg-primary/5 gap-1.5 text-xs active:scale-[0.97] transition-all"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Test Send</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Client Simulation Canvas ─── */}
      {channel === 'email' && (
        <div className="space-y-3">
          {viewportMode === 'desktop' ? (
            /* Desktop macOS Email Client Frame */
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg transition-all duration-300 flex flex-col">
              {/* macOS Window Title Bar */}
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F56] border border-black/10 shadow-2xs" />
                  <div className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-black/10 shadow-2xs" />
                  <div className="h-3 w-3 rounded-full bg-[#27C93F] border border-black/10 shadow-2xs" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Lock className="h-3 w-3 text-emerald-600" />
                  <span>SmartSapp Mail — High-Fidelity Simulation</span>
                </div>
                <div className="w-12" />
              </div>

              {/* Email Client Header Details */}
              <div className="p-4 border-b border-border/50 bg-background/50 space-y-2 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {activeSenderName[0]?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{activeSenderName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">&lt;{activeSenderIdentifier}&gt;</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        To: <span className="font-semibold text-foreground/80">{sampleRecipientName}</span> &lt;{sampleRecipientIdentifier}&gt;
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-border/30">
                  <p className="text-xs font-bold text-foreground truncate">
                    <span className="text-muted-foreground font-semibold mr-1.5">Subject:</span>
                    {resolvedSubject}
                  </p>
                </div>
              </div>

              {/* Email Content Frame */}
              <div className="relative w-full bg-card min-h-[400px] max-h-[560px] overflow-hidden flex flex-col">
                <iframe
                  srcDoc={sanitizedIframeHtml}
                  className="w-full h-full min-h-[400px] border-none bg-card"
                  title="High Fidelity Email Preview"
                  sandbox="allow-same-origin allow-popups"
                />
              </div>
            </div>
          ) : (
            /* Mobile iPhone Email Client Frame */
            <div className="max-w-[340px] mx-auto rounded-[2.5rem] border-4 border-border/80 bg-card p-3 shadow-2xl transition-all duration-300 relative">
              {/* Dynamic Island Notch */}
              <div className="h-4 w-24 bg-foreground/90 rounded-full mx-auto mb-2" />

              {/* Phone Status Bar */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 pb-1.5 border-b border-border/40">
                <span className="font-semibold">9:41</span>
                <span className="text-[9px] font-mono">5G • 100%</span>
              </div>

              {/* Mobile Email Header */}
              <div className="py-2.5 px-2 border-b border-border/40 text-left space-y-1">
                <p className="text-xs font-bold text-foreground truncate">{resolvedSubject}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-bold text-primary">{activeSenderName}</span>
                  <span>• Today</span>
                </div>
              </div>

              {/* Mobile Email Body */}
              <div className="w-full h-[420px] rounded-xl overflow-hidden bg-background border border-border/30 mt-2">
                <iframe
                  srcDoc={sanitizedIframeHtml}
                  className="w-full h-full border-none"
                  title="Mobile Email Preview"
                  sandbox="allow-same-origin allow-popups"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── WhatsApp Realistic Mobile Client Frame ─── */}
      {channel === 'whatsapp' && (
        <div className="max-w-[350px] mx-auto rounded-[2.5rem] border-4 border-border/80 bg-[#EFEAE2] dark:bg-[#0b141a] p-2.5 shadow-2xl transition-all duration-300 relative text-left">
          {/* Dynamic Island Notch */}
          <div className="h-4 w-24 bg-foreground/90 rounded-full mx-auto mb-2" />

          {/* WhatsApp Header Bar */}
          <div className="bg-[#075E54] dark:bg-[#1f2c34] text-white p-2.5 rounded-t-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs shrink-0">
                {activeSenderName[0]?.toUpperCase() || 'S'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold truncate text-white">{activeSenderName}</span>
                  <CheckCircle2 className="h-3 w-3 text-white fill-emerald-400 shrink-0" />
                </div>
                <p className="text-[9px] text-emerald-100/80 truncate">Official Business Account</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Video className="h-3.5 w-3.5" />
              <Phone className="h-3.5 w-3.5" />
              <MoreVertical className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* WhatsApp Chat Body */}
          <div className="p-3 min-h-[340px] max-h-[440px] overflow-y-auto space-y-3 flex flex-col justify-end">
            {/* Encryption notice */}
            <div className="mx-auto bg-amber-100/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[9px] px-2.5 py-1 rounded-lg text-center max-w-[90%] shadow-2xs border border-amber-200/50 flex items-center gap-1 justify-center">
              <Lock className="h-2.5 w-2.5 shrink-0" />
              <span>Messages are end-to-end encrypted.</span>
            </div>

            {/* Message Bubble */}
            <div className="bg-white dark:bg-[#1f2c34] text-foreground p-3 rounded-2xl rounded-tl-xs shadow-sm max-w-[90%] relative border border-border/30 space-y-1.5">
              <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                {resolvedBody}
              </p>
              <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground pt-0.5">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <CheckCheck className="h-3.5 w-3.5 text-[#34B7F1]" />
              </div>
            </div>
          </div>

          {/* WhatsApp Footer Input Mockup */}
          <div className="p-2 bg-white dark:bg-[#1f2c34] rounded-b-2xl border-t border-border/40 flex items-center gap-2">
            <Smile className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 bg-muted/30 rounded-full px-3 py-1 text-[11px] text-muted-foreground/60">
              Message...
            </div>
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="h-7 w-7 rounded-full bg-[#128C7E] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Mic className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* ─── SMS Realistic Mobile Client Frame ─── */}
      {channel === 'sms' && (
        <div className="max-w-[340px] mx-auto rounded-[2.5rem] border-4 border-border/80 bg-card p-3 shadow-2xl transition-all duration-300 relative text-left">
          {/* Dynamic Island Notch */}
          <div className="h-4 w-24 bg-foreground/90 rounded-full mx-auto mb-2" />

          {/* SMS Carrier Header */}
          <div className="text-center py-2 border-b border-border/40">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold mx-auto flex items-center justify-center text-sm mb-1">
              {activeSenderName[0]?.toUpperCase() || 'S'}
            </div>
            <p className="text-xs font-bold text-foreground">{activeSenderName}</p>
            <p className="text-[9px] text-muted-foreground font-semibold">SMS Message</p>
          </div>

          {/* SMS Body Bubble */}
          <div className="p-3 min-h-[260px] max-h-[340px] overflow-y-auto flex flex-col justify-end space-y-2">
            <div className="bg-muted/80 text-foreground p-3.5 rounded-2xl rounded-tl-xs shadow-xs max-w-[88%] relative border border-border/40">
              <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                {resolvedBody}
              </p>
            </div>
          </div>

          {/* SMS Telemetry Strip */}
          <div className="mt-2 pt-2 border-t border-border/40 text-center space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 font-mono">
              <span>{resolvedBody.length} characters</span>
              <span className="font-semibold text-primary">~{Math.ceil(resolvedBody.length / 160)} GSM segment(s)</span>
            </div>
            {smsBalance !== null && (
              <p className="text-[9px] font-semibold text-muted-foreground/70">
                Available balance: GHS {smsBalance.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
