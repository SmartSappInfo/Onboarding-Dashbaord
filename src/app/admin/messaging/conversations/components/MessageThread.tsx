import * as React from 'react';
import { Mail, Smartphone, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadGroup } from '../ConversationsClient';
import DOMPurify from 'isomorphic-dompurify';
import { Button } from '@/components/ui/button';

interface MessageThreadProps {
  thread: ThreadGroup;
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

// We reverse the array so newest is at the bottom like a chat app
export default function MessageThread({ thread }: MessageThreadProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  // Sort oldest to newest for rendering
  const chronologicalMessages = React.useMemo(() => {
    return [...thread.messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background/50">
      {/* Thread Header */}
      <div className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 z-10">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{thread.entityName}</h2>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {thread.totalMessages} Messages · Last active {fullDateFormatter.format(new Date(thread.lastMessageTimestamp))}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="py-6 space-y-6 flex flex-col justify-end min-h-full">
          {chronologicalMessages.map((msg, index) => {
            const config = statusConfig[msg.status] || statusConfig.sent;
            const StatusIcon = config.icon;
            
            // Render logic based on channel
            const isEmail = msg.channel === 'email';
            const showDateHeader = index === 0 || 
              new Date(msg.sentAt).toDateString() !== new Date(chronologicalMessages[index - 1].sentAt).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {/* Date separator */}
                {showDateHeader && (
                  <div className="flex justify-center my-4 sticky top-2 z-10">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-background/80 backdrop-blur-md px-3 py-1 shadow-sm border-border/50">
                      {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(msg.sentAt))}
                    </Badge>
                  </div>
                )}

                <div className={cn("group flex flex-col w-full max-w-2xl mx-auto", isEmail ? "items-stretch" : "items-end ml-auto")}>
                  {/* Meta header (Name & Time) */}
                  <div className={cn(
                    "flex items-center gap-2 mb-1.5 px-1",
                    isEmail ? "justify-start" : "justify-end"
                  )}>
                    <span className="text-[11px] font-bold text-foreground">SmartSapp</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(msg.sentAt))}
                    </span>
                  </div>

                  {/* Message Bubble/Card */}
                  <div className={cn(
                    "relative overflow-hidden transition-all",
                    isEmail 
                      ? "rounded-2xl rounded-tl-sm border bg-card shadow-sm p-5" 
                      : "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground p-3.5 shadow-md max-w-[85%]"
                  )}>
                    {isEmail && msg.subject && (
                      <h4 className="text-sm font-bold mb-3 pb-3 border-b border-border/50 text-foreground">
                        {msg.subject}
                      </h4>
                    )}
                    
                    {isEmail ? (
                      <div 
                        className="prose prose-sm max-w-none text-foreground dark:prose-invert text-[13px] leading-relaxed [&_a]:text-blue-500 [&_a]:underline"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(msg.body, { ADD_ATTR: ['target'] }) 
                        }} 
                      />
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
                  <div className={cn(
                    "flex items-center gap-2 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
                    isEmail ? "justify-start" : "justify-end"
                  )}>
                    <div className="flex items-center gap-1">
                      {isEmail ? <Mail className="h-3 w-3 text-muted-foreground" /> : <Smartphone className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">{msg.channel}</span>
                    </div>
                    <span className="text-border/50">•</span>
                    <div className="flex items-center gap-1">
                      <StatusIcon className={cn("h-3 w-3", config.className)} />
                      <span className={cn("text-[9px] uppercase font-bold tracking-wider", config.className)}>{config.label}</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Reply Area Hint (Just visual, actual reply is via Quick Compose FAB) */}
      <div className="p-4 bg-background border-t border-border/50 shrink-0">
        <div className="flex gap-3">
          <div className="flex-1 h-12 rounded-xl bg-muted/30 border border-border/50 flex items-center px-4 cursor-text text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
               onClick={() => {
                 // Trigger global quick compose
                 const evt = new KeyboardEvent('keydown', { key: 'c' });
                 document.dispatchEvent(evt);
               }}>
            Press <kbd className="mx-1.5 px-1.5 py-0.5 bg-background border rounded text-[10px] font-mono shadow-sm text-foreground">C</kbd> to quick compose a message
          </div>
          <Button onClick={() => {
                 const evt = new KeyboardEvent('keydown', { key: 'c' });
                 document.dispatchEvent(evt);
               }} 
               size="icon" 
               className="h-12 w-12 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-transform bg-primary"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
