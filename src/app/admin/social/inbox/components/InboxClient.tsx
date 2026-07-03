'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, doc, setDoc, getDocs, limit } from 'firebase/firestore';
import { 
  MessageSquare, 
  Linkedin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Youtube, 
  Globe, 
  Sparkles, 
  Send, 
  UserPlus, 
  UserCheck, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  Link2
} from 'lucide-react';
import { 
  simulateInboundMessageAction, 
  generateInboxReplyAction, 
  sendInboxManualReplyAction, 
  linkInboxToCRMAction 
} from '@/app/actions/social-composer-actions';
import type { SocialInboxItem, WorkspaceEntity } from '@/lib/types';
import { cn } from '@/lib/utils';

const platformIcons: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

const sentimentColors = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  negative: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export default function InboxClient() {
  const db = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<'unread' | 'pending' | 'resolved'>('unread');
  const [replyText, setReplyText] = React.useState('');
  const [isDraftingAI, setIsDraftingAI] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isSimulating, setIsSimulating] = React.useState(false);

  // CRM Contact Search/Link state
  const [searchContactQuery, setSearchContactQuery] = React.useState('');
  const [isLinking, setIsLinking] = React.useState(false);

  // CRM New Contact Form state
  const [newContactFirstName, setNewContactFirstName] = React.useState('');
  const [newContactLastName, setNewContactLastName] = React.useState('');
  const [newContactEmail, setNewContactEmail] = React.useState('');
  const [newContactPhone, setNewContactPhone] = React.useState('');
  const [isCreatingContact, setIsCreatingContact] = React.useState(false);

  // Conversation scroll ref
  const chatScrollRef = React.useRef<HTMLDivElement | null>(null);

  // 1. Load Social Inbox items
  const inboxQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialInbox'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', filterStatus)
    );
  }, [db, activeWorkspaceId, filterStatus]);

  const { data: inboxRaw, isLoading: isLoadingInbox } = useCollection<SocialInboxItem>(inboxQuery);
  const threads = inboxRaw || [];

  // 2. Load CRM Person Contacts
  const contactsQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId),
      where('entityType', '==', 'person')
    );
  }, [db, activeWorkspaceId]);

  const { data: contactsRaw } = useCollection<WorkspaceEntity>(contactsQuery);
  const contacts = contactsRaw || [];

  const activeThread = React.useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  // Set default active thread
  React.useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  // Auto-scroll chat log on update
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeThread?.replies]);

  // Simulate Inbound Message
  const handleSimulateInbound = async (platform: 'linkedin' | 'facebook' | 'instagram' | 'x') => {
    setIsSimulating(true);
    try {
      const res = await simulateInboundMessageAction(platform, activeWorkspaceId, activeOrganizationId);
      if (res.success && res.threadId) {
        setActiveThreadId(res.threadId);
        toast({
          title: 'Simulation Complete',
          description: `Spawned mock message thread from a parent on ${platform}.`,
        });
      } else {
        throw new Error(res.error || 'Simulate Inbound action failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation error';
      toast({
        title: 'Simulation Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate on-demand AI reply
  const handleDraftAI = async () => {
    if (!activeThreadId) return;
    setIsDraftingAI(true);
    try {
      const res = await generateInboxReplyAction(activeThreadId, activeWorkspaceId, activeOrganizationId);
      if (res.success && res.text) {
        setReplyText(res.text);
        toast({
          title: 'AI Draft Generated',
          description: 'Tone guidelines and message history incorporated successfully.',
        });
      } else {
        throw new Error(res.error || 'AI Drafter returned empty result');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI drafting error';
      toast({
        title: 'Drafting Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsDraftingAI(false);
    }
  };

  // Submit manual response reply
  const handleSendReply = async () => {
    if (!activeThreadId || !replyText.trim()) return;
    setIsSending(true);
    try {
      const res = await sendInboxManualReplyAction(activeThreadId, replyText.trim(), 'Staff Member');
      if (res.success) {
        setReplyText('');
        toast({
          title: 'Reply Sent',
          description: 'Simulated response recorded successfully.',
        });
      } else {
        throw new Error(res.error || 'Manual Send Action failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send error';
      toast({
        title: 'Send Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Link inbox thread to existing CRM Contact
  const handleLinkCRM = async (contactId: string) => {
    if (!activeThreadId) return;
    setIsLinking(true);
    try {
      const res = await linkInboxToCRMAction(activeThreadId, contactId || null);
      if (res.success) {
        toast({
          title: 'CRM Link Saved',
          description: 'Conversation successfully linked to Lead profile.',
        });
      } else {
        throw new Error(res.error || 'CRM link failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CRM link error';
      toast({
        title: 'Linkage Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Create new CRM Contact & Link
  const handleCreateContactAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !newContactFirstName.trim() || !newContactLastName.trim()) return;

    if (!db) {
      toast({
        title: 'Connection Lost',
        description: 'Firestore instance not active.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingContact(true);
    try {
      const displayName = `${newContactFirstName.trim()} ${newContactLastName.trim()}`;
      const contactId = `contact_${Math.random().toString(36).substring(2, 11)}`;

      const newEntity: WorkspaceEntity = {
        id: contactId,
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        entityId: contactId,
        entityType: 'person',
        displayName,
        primaryEmail: newContactEmail.trim() || undefined,
        primaryPhone: newContactPhone.trim() || undefined,
        status: 'active',
        workspaceTags: ['social-lead'],
        entityContacts: [],
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create contact profile
      await setDoc(doc(db, 'workspace_entities', contactId), newEntity);

      // Link to thread
      const linkRes = await linkInboxToCRMAction(activeThreadId, contactId);

      if (linkRes.success) {
        toast({
          title: 'Lead Profile Created',
          description: `Created CRM contact for ${displayName} and linked conversation.`,
        });
        setNewContactFirstName('');
        setNewContactLastName('');
        setNewContactEmail('');
        setNewContactPhone('');
      } else {
        throw new Error(linkRes.error || 'Create CRM contact link failed');
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create contact error';
      toast({
        title: 'Creation Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingContact(false);
    }
  };

  // Resolve linked CRM Contact data
  const linkedContact = React.useMemo(() => {
    if (!activeThread?.crmContactId) return null;
    return contacts.find((c) => c.id === activeThread.crmContactId) || null;
  }, [contacts, activeThread?.crmContactId]);

  // Filter contacts by search query
  const filteredCRMContacts = React.useMemo(() => {
    if (!searchContactQuery.trim()) return contacts.slice(0, 10);
    const q = searchContactQuery.toLowerCase();
    return contacts
      .filter((c) => c.displayName.toLowerCase().includes(q))
      .slice(0, 5);
  }, [contacts, searchContactQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-7xl mx-auto py-6 px-4 gap-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Social Inbox
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Monitor and respond to customer questions, DMs, and reviews in a single hub linked directly to CRM records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Simulate parent inquiry:</span>
          {['facebook', 'instagram', 'linkedin', 'x'].map((platform) => {
            const Icon = platformIcons[platform] || Globe;
            return (
              <Button
                key={platform}
                size="sm"
                variant="outline"
                onClick={() => handleSimulateInbound(platform as 'linkedin' | 'facebook' | 'instagram' | 'x')}
                disabled={isSimulating}
                className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 active:scale-[0.97] transition-all"
              >
                {isSimulating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3 shrink-0" />
                )}
                {platform}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 overflow-hidden">
        {/* Column 1: Conversations list (3/12) */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden border border-border/20 rounded-3xl bg-card/20 backdrop-blur-md p-4">
          <div className="flex gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/10">
            {['unread', 'pending', 'resolved'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status as 'unread' | 'pending' | 'resolved');
                  setActiveThreadId(null);
                }}
                className={cn(
                  "flex-1 text-[10px] font-bold tracking-wider uppercase py-1.5 rounded-xl transition-all",
                  filterStatus === status 
                    ? "bg-background/80 text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-none">
            {isLoadingInbox ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading threads...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 p-4 text-center">
                <MessageSquare className="h-6 w-6 opacity-35" />
                <span className="text-[10px] font-bold uppercase tracking-wider">No threads found</span>
              </div>
            ) : (
              threads.map((thread) => {
                const Icon = platformIcons[thread.platform] || Globe;
                const isSelected = thread.id === activeThreadId;

                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-1.5 active:scale-[0.99]",
                      isSelected 
                        ? "bg-background/60 border-emerald-500/30 text-foreground shadow-lg shadow-emerald-500/2"
                        : "bg-background/20 border-border/20 hover:border-border/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex justify-between items-center gap-2 w-full">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{thread.senderName}</span>
                      </div>
                      <Badge className={cn("text-[9px] uppercase tracking-wider h-5 px-2 border", sentimentColors[thread.sentiment])} variant="outline">
                        {thread.sentiment}
                      </Badge>
                    </div>
                    <p className="text-[10px] leading-relaxed truncate w-full text-muted-foreground/90 font-medium">
                      {thread.content}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Chat panel (6/12) */}
        <div className="lg:col-span-6 flex flex-col border border-border/20 rounded-3xl bg-card/10 backdrop-blur-md overflow-hidden relative">
          {activeThread ? (
            <>
              {/* Active Header */}
              <div className="border-b border-border/20 p-4 bg-muted/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeThread.senderAvatar ? (
                    <img 
                      src={activeThread.senderAvatar} 
                      alt={activeThread.senderName} 
                      className="h-9 w-9 rounded-xl object-cover border border-border/30"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-muted border flex items-center justify-center font-bold text-xs uppercase">
                      {activeThread.senderName.substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <span className="font-extrabold text-xs block text-foreground">{activeThread.senderName}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold capitalize flex items-center gap-1">
                      {React.createElement(platformIcons[activeThread.platform] || Globe, { className: "h-3 w-3" })}
                      via {activeThread.platform}
                    </span>
                  </div>
                </div>

                {linkedContact && (
                  <Badge className="h-6 rounded-xl bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1" variant="outline">
                    <UserCheck className="h-3 w-3" /> Linked to Lead
                  </Badge>
                )}
              </div>

              {/* Chat Scroll Panel */}
              <div 
                ref={chatScrollRef}
                className="flex-1 p-4 overflow-y-auto space-y-4 pr-1 scrollbar-none"
              >
                {/* Incoming Message */}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className="p-3 bg-muted/40 border border-border/10 rounded-2xl text-xs font-semibold leading-relaxed text-foreground rounded-tl-none">
                    {activeThread.content}
                  </div>
                  <span className="text-[9px] text-muted-foreground px-1 font-bold">Parent Inquirer</span>
                </div>

                {/* Replies Log */}
                {activeThread.replies.map((reply) => {
                  const isAI = reply.sender === 'ai';
                  const isStaff = reply.sender === 'user';

                  return (
                    <div 
                      key={reply.id} 
                      className={cn(
                        "flex flex-col gap-1 max-w-[80%]",
                        (isAI || isStaff) ? "ml-auto items-end" : "mr-auto"
                      )}
                    >
                      <div className={cn(
                        "p-3 border rounded-2xl text-xs font-semibold leading-relaxed rounded-tr-none",
                        isAI 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                          : "bg-background border-border/30 text-foreground"
                      )}>
                        {reply.content}
                      </div>
                      <span className="text-[9px] text-muted-foreground px-1 font-bold">
                        {isAI ? 'SmartSapp AI (Autopilot)' : reply.senderName}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Suggested bubbles & Text Composer */}
              <div className="border-t border-border/20 p-4 bg-muted/10 space-y-3 relative">
                {/* Suggestion Bubbles */}
                {activeThread.suggestedReplies && activeThread.suggestedReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeThread.suggestedReplies.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => setReplyText(sug)}
                        className="px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 transition-all active:scale-[0.97]"
                      >
                        ⚡ {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* Composer Textarea */}
                <div className="relative">
                  <Textarea
                    placeholder="Type a manual response here..."
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="rounded-2xl border-border/30 bg-background text-xs leading-relaxed pb-12"
                  />
                  <div className="absolute bottom-2.5 right-3.5 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleDraftAI}
                      disabled={isDraftingAI}
                      className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-500/15 text-emerald-500 gap-1 active:scale-[0.97] transition-all border border-emerald-500/10 bg-emerald-500/5"
                    >
                      {isDraftingAI ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Draft with AI
                    </Button>
                    <Button
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs active:scale-[0.97] transition-all gap-1 px-4"
                    >
                      {isSending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 gap-1">
              <MessageSquare className="h-10 w-10 opacity-30 mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Select a conversation thread</span>
            </div>
          )}
        </div>

        {/* Column 3: CRM & Sentiment details (3/12) */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto border border-border/20 rounded-3xl bg-card/20 backdrop-blur-md p-4 scrollbar-none">
          {activeThread ? (
            <>
              {/* Sentiment Card */}
              <Card className="border border-border/20 rounded-2xl bg-background/50 overflow-hidden">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sentiment Summary</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-[10px] uppercase font-bold tracking-widest px-3.5 py-1 border border-border/10", sentimentColors[activeThread.sentiment])}>
                      {activeThread.sentiment}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* CRM Link Panel */}
              {linkedContact ? (
                <Card className="border border-border/20 rounded-2xl bg-background/50 overflow-hidden">
                  <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" /> Linked Lead Profile
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLinkCRM('')}
                      disabled={isLinking}
                      className="h-6 text-[9px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                    >
                      Unlink
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-5">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-foreground block">{linkedContact.displayName}</span>
                      {linkedContact.primaryEmail && (
                        <span className="text-[10px] text-muted-foreground block truncate">{linkedContact.primaryEmail}</span>
                      )}
                      {linkedContact.primaryPhone && (
                        <span className="text-[10px] text-muted-foreground block">{linkedContact.primaryPhone}</span>
                      )}
                    </div>
                    {linkedContact.workspaceTags && linkedContact.workspaceTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedContact.workspaceTags.map((tag) => (
                          <Badge key={tag} className="text-[9px] uppercase tracking-wider font-semibold py-0 h-4 bg-muted/60 text-muted-foreground border border-border/10" variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Link Dropdown */}
                  <Card className="border border-border/20 rounded-2xl bg-background/50 overflow-hidden">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Link CRM Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      <div className="relative">
                        <Input
                          placeholder="Search contacts..."
                          value={searchContactQuery}
                          onChange={(e) => setSearchContactQuery(e.target.value)}
                          className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
                        />
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-none">
                        {filteredCRMContacts.length === 0 ? (
                          <span className="text-[9px] text-muted-foreground block italic p-1">No matches found. Create new contact below.</span>
                        ) : (
                          filteredCRMContacts.map((contact) => (
                            <button
                              key={contact.id}
                              onClick={() => handleLinkCRM(contact.id)}
                              disabled={isLinking}
                              className="w-full text-left p-2 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/10 text-[10px] font-bold flex items-center justify-between"
                            >
                              <span className="truncate">{contact.displayName}</span>
                              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
                            </button>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Create Lead Form */}
                  <Card className="border border-border/20 rounded-2xl bg-background/50 overflow-hidden">
                    <CardHeader className="pb-3 pt-4">
                      <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <UserPlus className="h-3.5 w-3.5 text-emerald-500" /> Create CRM Contact
                      </CardTitle>
                    </CardHeader>
                    <form onSubmit={handleCreateContactAndLink}>
                      <CardContent className="space-y-3 pb-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="fname-input" className="text-[9px] font-bold uppercase text-muted-foreground">First Name</Label>
                            <Input
                              id="fname-input"
                              placeholder="Sarah"
                              value={newContactFirstName}
                              onChange={(e) => setNewContactFirstName(e.target.value)}
                              className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="lname-input" className="text-[9px] font-bold uppercase text-muted-foreground">Last Name</Label>
                            <Input
                              id="lname-input"
                              placeholder="Jenkins"
                              value={newContactLastName}
                              onChange={(e) => setNewContactLastName(e.target.value)}
                              className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="cemail-input" className="text-[9px] font-bold uppercase text-muted-foreground">Email</Label>
                          <Input
                            id="cemail-input"
                            type="email"
                            placeholder="sarah@example.com"
                            value={newContactEmail}
                            onChange={(e) => setNewContactEmail(e.target.value)}
                            className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="cphone-input" className="text-[9px] font-bold uppercase text-muted-foreground">Phone</Label>
                          <Input
                            id="cphone-input"
                            placeholder="555-0199"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            className="h-8 rounded-lg border-border/30 bg-background text-[10px]"
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isCreatingContact}
                          className="w-full h-8 mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider active:scale-[0.97] transition-all gap-1"
                        >
                          {isCreatingContact ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          Create & Link
                        </Button>
                      </CardContent>
                    </form>
                  </Card>
                </>
              )}
            </>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-1.5 p-6">
              <HelpCircle className="h-6 w-6 opacity-35" />
              <span className="text-[10px] font-bold uppercase tracking-wider">No Thread Selected</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
