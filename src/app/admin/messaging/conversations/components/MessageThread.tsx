import * as React from 'react';
import {
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ArrowLeft,
  Info,
  PanelLeftOpen,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadGroup } from '../ConversationsClient';
import DOMPurify from 'isomorphic-dompurify';
import { Button } from '@/components/ui/button';

export interface MessageThreadProps {
  thread: ThreadGroup;
  onBack?: () => void;
  isThreadListCollapsed?: boolean;
  onExpandThreadList?: () => void;
  isPropertiesCollapsed?: boolean;
  onToggleProperties?: () => void;
  className?: string;
}

const statusConfig = {
  sent: { icon: CheckCircle2, label: 'Delivered', className: 'text-emerald-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-destructive' },
  scheduled: { icon: Clock, label: 'Scheduled', className: 'text-amber-500' },
};

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Normalizes email HTML strings for light & dark theme compatibility.
 * In email templates, hardcoded inline styles (background-color: #FFFFFF, color: #1e293b, etc.)
 * clash with application dark themes, causing washed-out/invisible white-on-white text.
 * This helper neutralizes hardcoded light backgrounds and near-black text colors so they
 * inherit the semantic CSS variables (--card, --foreground, --border).
 */
export function normalizeEmailHtmlForTheme(html: string): string {
  if (!html) return '';
  let cleaned = html;

  // 1. Neutralize hardcoded white / light backgrounds in inline styles
  cleaned = cleaned.replace(
    /(?:background-color|background)\s*:\s*(?:#(?:fff(?:fff)?|f8fafc|f1f5f9|f9fafc|f3f4f6|fafafa|f5f5f5|e2e8f0)\b|white|rgba?\(\s*2(?:4[5-9]|5[0-5])\s*,\s*2(?:4[5-9]|5[0-5])\s*,\s*2(?:4[5-9]|5[0-5])(?:\s*,\s*[0-9.]+\s*)?\))/gi,
    'background-color: transparent'
  );

  // 2. Neutralize hardcoded dark text colors in inline styles so text inherits theme foreground
  cleaned = cleaned.replace(
    /(?<![a-zA-Z-])color\s*:\s*(?:#(?:000(?:000)?|111(?:111)?|222(?:222)?|333(?:333)?|0f172a|1e293b|334155|111827)\b|black|rgba?\(\s*(?:[0-4]?[0-9]|50)\s*,\s*(?:[0-4]?[0-9]|50)\s*,\s*(?:[0-4]?[0-9]|50)(?:\s*,\s*[0-9.]+\s*)?\))/gi,
    'color: inherit'
  );

  // 3. Neutralize light border dividers so they use semantic CSS border variable
  cleaned = cleaned.replace(
    /border(?:-[a-z]+)?\s*:\s*1px solid #(?:e2e8f0|f1f5f9|e5e5e5|eee(?:eee)?)\b/gi,
    'border: 1px solid hsl(var(--border) / 0.6)'
  );

  return cleaned;
}

// We reverse the array so newest is at the bottom like a chat app
export default function MessageThread({
  thread,
  onBack,
  isThreadListCollapsed,
  onExpandThreadList,
  isPropertiesCollapsed,
  onToggleProperties,
  className,
}: MessageThreadProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Sort oldest to newest for rendering
  const chronologicalMessages = React.useMemo(() => {
    return [...thread.messages].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
  }, [thread.messages]);

  // Auto-scroll to bottom on thread change or new message
  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [thread.entityId, thread.messages.length]);

  const displayName = thread.contactName || thread.entityName;
  const channelDetails = [thread.email, thread.phone].filter(Boolean).join(' • ');

  return (
    <div className={cn('flex-1 flex flex-col min-w-0 bg-background/50', className)}>
      {/* Thread Header */}
      <div className="h-16 border-b border-border/80 bg-card/95 dark:bg-card backdrop-blur-md shadow-xs flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Mobile Back to Inbox Button (WhatsApp style navigation) */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="md:hidden -ml-1 mr-0.5 h-10 px-2 text-xs font-semibold rounded-xl active:scale-[0.95] flex items-center gap-1 min-h-[44px]"
              aria-label="Back to conversations Inbox"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-semibold">Inbox</span>
            </Button>
          )}

          {/* Desktop Expand Left Contacts Panel Button */}
          {isThreadListCollapsed && onExpandThreadList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpandThreadList}
              title="Expand contacts list"
              className="hidden md:inline-flex h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] mr-1"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}

          {/* Contact & Institution Title (Clickable to trigger details) */}
          <button
            type="button"
            onClick={onToggleProperties}
            className="min-w-0 text-left cursor-pointer group/header hover:opacity-85 transition-opacity"
            title="View contact details"
          >
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate group-hover/header:text-primary transition-colors">
                {displayName}
              </h2>
              {thread.institutionName && thread.institutionName !== displayName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-muted dark:bg-muted/70 text-muted-foreground border border-border/70 shrink-0 truncate max-w-[200px] leading-tight shadow-2xs">
                  {thread.institutionName}
                </span>
              )}
            </div>
            <p className="text-[10px] font-medium text-muted-foreground truncate tabular-nums">
              {channelDetails ? `${channelDetails} · ` : ''}
              {thread.totalMessages} Messages · Last active{' '}
              {fullDateFormatter.format(new Date(thread.lastMessageTimestamp))}
            </p>
          </button>
        </div>

        {/* Right Details Button Trigger (Info Icon) */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleProperties && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleProperties}
              title={isPropertiesCollapsed ? 'Show contact details' : 'Hide contact details'}
              className={cn(
                'h-9 w-9 rounded-xl transition-all active:scale-[0.97] border-border/80 min-h-[36px] min-w-[36px] flex items-center justify-center',
                !isPropertiesCollapsed
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={isPropertiesCollapsed ? 'Show contact details' : 'Hide contact details'}
            >
              <Info className="h-4 w-4" />
              <span className="sr-only">Details</span>
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 sm:px-6" ref={scrollRef}>
        <div className="py-6 space-y-6 flex flex-col justify-end min-h-full">
          {chronologicalMessages.map((msg, index) => {
            const config = statusConfig[msg.status] || statusConfig.sent;
            const StatusIcon = config.icon;

            const isEmail = msg.channel === 'email';
            const showDateHeader =
              index === 0 ||
              new Date(msg.sentAt).toDateString() !==
                new Date(chronologicalMessages[index - 1].sentAt).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {/* Date separator */}
                {showDateHeader && (
                  <div className="flex justify-center my-4 sticky top-2 z-10">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold bg-background/80 backdrop-blur-md px-3 py-1 shadow-xs border-border/50"
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      }).format(new Date(msg.sentAt))}
                    </Badge>
                  </div>
                )}

                <div
                  className={cn(
                    'group flex flex-col w-full max-w-2xl mx-auto',
                    isEmail ? 'items-stretch' : 'items-end ml-auto'
                  )}
                >
                  {/* Meta header (Name & Time) */}
                  <div
                    className={cn(
                      'flex items-center gap-2 mb-1.5 px-1',
                      isEmail ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <span className="text-[11px] font-bold text-foreground">
                      {msg.senderName || 'SmartSapp'}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {new Intl.DateTimeFormat(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(msg.sentAt))}
                    </span>
                  </div>

                  {/* Message Bubble/Card */}
                  <div
                    className={cn(
                      'relative overflow-hidden transition-all',
                      isEmail
                        ? 'rounded-2xl rounded-tl-sm border bg-card shadow-xs p-4 sm:p-6'
                        : 'rounded-2xl rounded-tr-sm bg-primary text-primary-foreground p-3.5 sm:p-4 shadow-xs max-w-[85%]'
                    )}
                  >
                    {isEmail && msg.subject && (
                      <h4 className="text-sm font-bold mb-3.5 pb-3 border-b border-border/50 text-foreground">
                        {msg.subject}
                      </h4>
                    )}

                    {isEmail ? (
                      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-6 md:p-7 overflow-hidden shadow-xs">
                        <div
                          className={cn(
                            'prose prose-sm max-w-none text-foreground dark:prose-invert text-[13px] leading-relaxed [&_a]:text-blue-500 [&_a]:underline',
                            // Enforce generous internal padding on email wrapper classes so text never touches container borders
                            '[&_.container]:w-full [&_.container]:max-w-full [&_.container]:rounded-xl [&_.container]:overflow-hidden [&_.container]:border [&_.container]:border-border/60 [&_.container]:shadow-xs [&_.container]:my-1',
                            '[&_.container:not(:has(.content))]:!p-6 sm:[&_.container:not(:has(.content))]:!p-8 md:[&_.container:not(:has(.content))]:!p-10',
                            '[&_.header]:!p-5 sm:[&_.header]:!p-6 md:[&_.header]:!p-7 [&_.header]:border-b [&_.header]:border-border/40',
                            '[&_.content]:!p-6 sm:[&_.content]:!p-8 md:[&_.content]:!p-10 [&_.content]:space-y-4',
                            '[&_.footer]:!p-5 sm:[&_.footer]:!p-6 md:[&_.footer]:!p-7 [&_.footer]:border-t [&_.footer]:border-border/40',
                            // Table & block element fallback padding
                            '[&_table]:w-full [&_table]:border-collapse',
                            '[&_td]:!p-4 sm:[&_td]:!p-6',
                            '[&_th]:!p-4 sm:[&_th]:!p-6',
                            // Direct text blocks inside unstyled containers
                            '[&>p]:px-3 sm:[&>p]:px-4 [&>div]:px-3 sm:[&>div]:px-4',
                            // Ensure dark mode harmony and prevent unpadded harsh white boxes
                            'dark:[&_table]:!bg-transparent dark:[&_tr]:!bg-transparent dark:[&_td]:!bg-transparent dark:[&_th]:!bg-transparent dark:[&_tbody]:!bg-transparent dark:[&_thead]:!bg-transparent',
                            'dark:[&_div]:!bg-transparent dark:[&_div]:!border-border/40',
                            'dark:[&_.container]:!bg-card/90 dark:[&_.container]:!border-border/60 dark:[&_.container]:!text-foreground',
                            'dark:[&_.header]:!bg-muted/20 dark:[&_.header]:!border-border/40',
                            'dark:[&_.content]:!bg-card/95 dark:[&_.content]:!text-foreground',
                            'dark:[&_.footer]:!bg-muted/20 dark:[&_.footer]:!border-border/40 dark:[&_.footer-text]:!text-muted-foreground',
                            'dark:[&_p]:!text-foreground dark:[&_span]:!text-foreground dark:[&_div]:!text-foreground dark:[&_li]:!text-foreground dark:[&_td]:!text-foreground dark:[&_th]:!text-foreground',
                            'dark:[&_strong]:!text-foreground dark:[&_b]:!text-foreground dark:[&_h1]:!text-foreground dark:[&_h2]:!text-foreground dark:[&_h3]:!text-foreground dark:[&_h4]:!text-foreground',
                            'dark:[&_a]:!text-blue-400 [&_a]:underline font-medium'
                          )}
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(normalizeEmailHtmlForTheme(msg.body), { ADD_ATTR: ['target'] }),
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed font-medium">
                        {msg.body}
                      </p>
                    )}

                    {msg.error && (
                      <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-[10px] font-bold text-destructive">Error: {msg.error}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer metadata (Status & Channel) */}
                  <div
                    className={cn(
                      'flex items-center gap-2 mt-1.5 px-1 opacity-70 group-hover:opacity-100 transition-opacity',
                      isEmail ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {msg.channel === 'email' && <Mail className="h-3 w-3 text-muted-foreground" />}
                      {msg.channel === 'sms' && <Smartphone className="h-3 w-3 text-muted-foreground" />}
                      {msg.channel === 'whatsapp' && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
                        {msg.channel}
                      </span>
                    </div>
                    <span className="text-border/50">•</span>
                    <div className="flex items-center gap-1">
                      <StatusIcon className={cn('h-3 w-3', config.className)} />
                      <span className={cn('text-[9px] uppercase font-bold tracking-wider', config.className)}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply Area Hint */}
      <div className="p-4 bg-background border-t border-border/50 shrink-0">
        <div className="flex gap-3">
          <div
            className="flex-1 h-12 rounded-xl bg-muted/30 border border-border/50 flex items-center px-4 cursor-text text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'c' });
              document.dispatchEvent(evt);
            }}
          >
            Press <kbd className="mx-1.5 px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono shadow-xs text-foreground">C</kbd> to quick compose a message
          </div>
          <Button
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'c' });
              document.dispatchEvent(evt);
            }}
            size="icon"
            className="h-12 w-12 rounded-xl shadow-xs hover:scale-105 active:scale-95 transition-transform bg-primary"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
