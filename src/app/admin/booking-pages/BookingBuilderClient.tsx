'use client';

import * as React from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { BookingPage, BookingQuestion, ConferencingProvider } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { 
  saveBookingPageAction, 
  deleteBookingPageAction, 
  ensureWorkspaceAvailabilityAction 
} from '@/app/actions/scheduler-actions';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Edit, 
  Code, 
  Link2, 
  CheckCircle, 
  Loader2, 
  Calendar, 
  Sparkles,
  Settings,
  Eye,
  PlusCircle
} from 'lucide-react';

export default function BookingBuilderClient() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form States
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState(30);
  const [meetingProvider, setMeetingProvider] = React.useState<ConferencingProvider>('GOOGLE_MEET');
  const [bufferMinutes, setBufferMinutes] = React.useState(15);
  const [publishStatus, setPublishStatus] = React.useState<'draft' | 'published'>('published');
  const [questions, setQuestions] = React.useState<BookingQuestion[]>([]);

  // Embed Modal State
  const [embedModalPage, setEmbedModalPage] = React.useState<BookingPage | null>(null);

  // Make sure default availability document exists
  React.useEffect(() => {
    if (activeWorkspaceId && activeOrganizationId && user?.uid) {
      ensureWorkspaceAvailabilityAction(activeWorkspaceId, activeOrganizationId, user.uid);
    }
  }, [activeWorkspaceId, activeOrganizationId, user]);

  // Query Workspace Booking Pages
  const bookingPagesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId 
      ? query(
          collection(firestore, 'booking_pages'), 
          where('workspaceId', '==', activeWorkspaceId)
        ) 
      : null, 
  [firestore, activeWorkspaceId]);

  const { data: bookingPages, isLoading: loadingPages } = useCollection<BookingPage>(bookingPagesQuery);

  const openCreateDialog = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setDurationMinutes(30);
    setMeetingProvider('GOOGLE_MEET');
    setBufferMinutes(15);
    setPublishStatus('published');
    setQuestions([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (page: BookingPage) => {
    setEditingId(page.id);
    setTitle(page.title);
    setSlug(page.slug);
    setDurationMinutes(page.durationMinutes);
    setMeetingProvider(page.meetingProvider);
    setBufferMinutes(page.bufferMinutes);
    setPublishStatus(page.publishStatus);
    setQuestions(page.questions || []);
    setIsDialogOpen(true);
  };

  const handleAddQuestion = () => {
    const newQuestion: BookingQuestion = {
      id: uuidv4(),
      label: '',
      type: 'text',
      required: false,
    };
    setQuestions(prev => [...prev, newQuestion]);
  };

  const handleUpdateQuestion = (id: string, updates: Partial<BookingQuestion>) => {
    setQuestions(prev => 
      prev.map(q => q.id === id ? { ...q, ...updates } : q)
    );
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !activeOrganizationId) return;

    if (!title.trim() || !slug.trim()) {
      toast({ variant: 'destructive', title: 'Validation Failed', description: 'Title and URL Slug are required.' });
      return;
    }

    setIsSaving(true);
    try {
      const pageId = editingId || uuidv4();
      const res = await saveBookingPageAction({
        id: pageId,
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''),
        title: title.trim(),
        durationMinutes,
        availabilityId: activeWorkspaceId, // Availability scoped at workspace ID level
        questions,
        meetingProvider,
        bufferMinutes,
        publishStatus,
      });

      if (res.success) {
        toast({ title: 'Success', description: 'Booking Page configuration template saved.' });
        setIsDialogOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'Save request failed' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking page?')) return;

    try {
      const res = await deleteBookingPageAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: 'Booking page deleted successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'Delete failed' 
      });
    }
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: msg });
  };

  return (
    <div className="space-y-8 pb-12 w-full text-left">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            Public Booking Pages Builder
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            Configure Calendly-like booking page links, customize forms, and embed them in emails or websites.
          </p>
        </div>
        <Button 
          onClick={openCreateDialog}
          className="rounded-2xl font-bold h-12 px-6 active:scale-[0.97] transition-all bg-primary hover:bg-primary-hover text-white flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Booking Page
        </Button>
      </div>

      {/* Pages List */}
      {loadingPages ? (
        <div className="flex flex-col items-center justify-center p-24 min-h-[300px]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground mt-4">Syncing Booking Templates...</p>
        </div>
      ) : !bookingPages || bookingPages.length === 0 ? (
        <Card className="border-none bg-background/40 ring-1 ring-border rounded-[2.5rem] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No Booking Pages Configuration</h3>
            <p className="text-xs font-semibold text-muted-foreground max-w-sm">
              Create dynamic landing pages for clients, parents, or prospects to schedule meetings with you directly.
            </p>
          </div>
          <Button onClick={openCreateDialog} variant="outline" className="rounded-xl font-bold mt-2">
            Set Up Your First Link
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          {bookingPages.map(page => {
            const publicUrl = `${window.location.origin}/book/${page.slug}`;
            return (
              <Card key={page.id} className="border-none bg-background/40 backdrop-blur-sm ring-1 ring-border rounded-[2rem] overflow-hidden shadow-xl p-6 flex flex-col justify-between min-h-[220px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/10 text-primary border-none font-bold text-[8px] px-2 py-0.5 rounded-lg capitalize">
                      {page.meetingProvider.replace('_', ' ').toLowerCase()}
                    </Badge>
                    <Badge variant={page.publishStatus === 'published' ? 'default' : 'outline'} className="text-[8px] font-bold">
                      {page.publishStatus}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">{page.title}</h3>
                    {page.description && (
                      <p className="text-[10px] font-semibold text-muted-foreground line-clamp-2 leading-relaxed">
                        {page.description}
                      </p>
                    )}
                    <p className="text-[9px] font-bold text-slate-500 tabular-nums pt-1">
                      Duration: {page.durationMinutes} mins | Buffer: {page.bufferMinutes} mins
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border/50 flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(page)}
                      className="h-9 w-9 rounded-xl hover:bg-muted/80"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEmbedModalPage(page)}
                      className="h-9 w-9 rounded-xl hover:bg-muted/80"
                    >
                      <Code className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(page.id)}
                      className="h-9 w-9 rounded-xl hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 text-destructive/80 hover:text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(publicUrl, 'Public link copied to clipboard.')}
                      className="text-[10px] font-bold h-9 px-3 rounded-xl flex items-center gap-1"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(publicUrl, '_blank')}
                      className="text-[10px] font-bold h-9 px-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 1. Edit / Create Dialog Modal */}
      <AnimatePresence>
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-8 space-y-6 text-left"
            >
              <div className="flex justify-between items-start border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingId ? 'Edit Booking Page' : 'Create New Booking Page'}
                  </h2>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">
                    Design a page template with scheduling limits and custom guest forms.
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsDialogOpen(false)} 
                  className="rounded-full text-slate-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Event Title *</Label>
                    <Input
                      required
                      value={title}
                      onChange={e => {
                        setTitle(e.target.value);
                        if (!editingId) {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                        }
                      }}
                      placeholder="e.g. Intro Strategy Sync"
                      className="h-11 rounded-xl bg-white/[0.02] border-white/10 text-white text-sm"
                    />
                  </div>

                  {/* Slug */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL Slug *</Label>
                    <Input
                      required
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      placeholder="e.g. strategy-sync"
                      className="h-11 rounded-xl bg-white/[0.02] border-white/10 text-white text-sm"
                    />
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Duration (Minutes)</Label>
                    <select
                      value={durationMinutes}
                      onChange={e => setDurationMinutes(Number(e.target.value))}
                      className="h-11 w-full rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-sm px-3"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>

                  {/* Buffer */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Time Buffer (Mins)</Label>
                    <select
                      value={bufferMinutes}
                      onChange={e => setBufferMinutes(Number(e.target.value))}
                      className="h-11 w-full rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-sm px-3"
                    >
                      <option value={0}>No buffer</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>

                  {/* Provider */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Meeting Provider</Label>
                    <select
                      value={meetingProvider}
                      onChange={e => setMeetingProvider(e.target.value as ConferencingProvider)}
                      className="h-11 w-full rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-sm px-3"
                    >
                      <option value="GOOGLE_MEET">Google Meet (Google Calendar Connection)</option>
                      <option value="ZOOM">Zoom Meeting (Zoom Connection)</option>
                      <option value="MICROSOFT_TEAMS">Microsoft Teams (Teams Connection)</option>
                      <option value="PHONE">Phone Call (Guest inputs phone number)</option>
                      <option value="IN_PERSON">In Person Meeting</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Publish Status</Label>
                    <select
                      value={publishStatus}
                      onChange={e => setPublishStatus(e.target.value as 'draft' | 'published')}
                      className="h-11 w-full rounded-xl bg-slate-950 border border-white/10 text-slate-100 text-sm px-3"
                    >
                      <option value="published">Active & Bookable</option>
                      <option value="draft">Draft (Offline)</option>
                    </select>
                  </div>
                </div>

                {/* Custom Questions Section */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white">Custom Form Questions</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddQuestion}
                      className="h-8 text-[10px] font-bold rounded-lg border-primary/20 text-primary hover:bg-primary/10 flex items-center gap-1.5"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Add Field
                    </Button>
                  </div>

                  <p className="text-[9px] font-semibold text-slate-400 leading-normal">
                    Guest Name and Email are included by default. Add additional fields to capture specific booking answers.
                  </p>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3 relative">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Field #{idx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="h-7 w-7 rounded-lg text-destructive/75 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-semibold text-slate-400">Label *</Label>
                            <Input
                              required
                              value={q.label}
                              onChange={e => handleUpdateQuestion(q.id, { label: e.target.value })}
                              placeholder="e.g. Reason for meeting"
                              className="h-9 rounded-lg bg-slate-950 border-white/10 text-white text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[9px] font-semibold text-slate-400">Input Type</Label>
                            <select
                              value={q.type}
                              onChange={e => handleUpdateQuestion(q.id, { type: e.target.value as BookingQuestion['type'] })}
                              className="h-9 w-full rounded-lg bg-slate-950 border border-white/10 text-slate-100 text-xs px-2"
                            >
                              <option value="text">Short Text</option>
                              <option value="textarea">Paragraph Box</option>
                              <option value="dropdown">Dropdown Options</option>
                              <option value="checkbox">Checkboxes (Multi-select)</option>
                              <option value="radio">Radio Buttons (Single-select)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 pt-6">
                            <input
                              type="checkbox"
                              id={`req_${q.id}`}
                              checked={q.required}
                              onChange={e => handleUpdateQuestion(q.id, { required: e.target.checked })}
                              className="h-4 w-4 rounded border-white/10 text-primary bg-transparent focus:ring-primary focus:ring-offset-0"
                            />
                            <Label htmlFor={`req_${q.id}`} className="text-xs font-semibold text-slate-300">
                              Mark Required
                            </Label>
                          </div>
                        </div>

                        {/* Options input for select/dropdown fields */}
                        {(q.type === 'dropdown' || q.type === 'checkbox' || q.type === 'radio') && (
                          <div className="space-y-1.5 pt-1">
                            <Label className="text-[9px] font-bold text-slate-400">Options (Comma separated) *</Label>
                            <Input
                              required
                              value={q.options?.join(', ') || ''}
                              onChange={e => handleUpdateQuestion(q.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="e.g. Strategy, Support, General Consulting"
                              className="h-9 rounded-lg bg-slate-950 border-white/10 text-white text-xs"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Footer */}
                <div className="pt-6 border-t border-white/5 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="rounded-xl font-bold h-11 px-6 active:scale-[0.97] transition-all"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl font-bold h-11 px-8 active:scale-[0.97] bg-primary text-white hover:bg-primary-hover flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving template...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" /> Save Configuration
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Embed Code & Snippet Popover Modal */}
      <AnimatePresence>
        {embedModalPage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-xl shadow-2xl p-8 space-y-6 text-left"
            >
              <div className="flex justify-between items-start border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Embed and Integration Code</h2>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">
                    Copy HTML buttons or responsive iframe snippets to embed this booking template anywhere.
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setEmbedModalPage(null)} 
                  className="rounded-full text-slate-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-6">
                {/* Public Link */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Direct Scheduling Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/book/${embedModalPage.slug}`}
                      className="h-10 rounded-xl bg-slate-950 border-white/10 text-white text-xs font-mono select-all"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.origin}/book/${embedModalPage.slug}`, 'Direct URL copied.')}
                      className="h-10 rounded-xl font-bold flex items-center gap-1 shrink-0"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                </div>

                {/* Iframe Embed */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Website IFrame Widget</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`<iframe src="${window.location.origin}/book/${embedModalPage.slug}" width="100%" height="650" style="border:none; border-radius:1.5rem; background:transparent; overflow:hidden;"></iframe>`}
                      className="h-10 rounded-xl bg-slate-950 border-white/10 text-white text-xs font-mono select-all"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(`<iframe src="${window.location.origin}/book/${embedModalPage.slug}" width="100%" height="650" style="border:none; border-radius:1.5rem; background:transparent; overflow:hidden;"></iframe>`, 'Iframe snippet copied.')}
                      className="h-10 rounded-xl font-bold flex items-center gap-1 shrink-0"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                </div>

                {/* Email Template Button */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Button Embed (Resend / Campaign HTML)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`<a href="${window.location.origin}/book/${embedModalPage.slug}?email={{contact.email}}" style="background-color:#10b981; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:12px; font-weight:bold; display:inline-block;">Schedule Appointment</a>`}
                      className="h-10 rounded-xl bg-slate-950 border-white/10 text-white text-xs font-mono select-all"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(`<a href="${window.location.origin}/book/${embedModalPage.slug}?email={{contact.email}}" style="background-color:#10b981; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:12px; font-weight:bold; display:inline-block;">Schedule Appointment</a>`, 'Email HTML button snippet copied.')}
                      className="h-10 rounded-xl font-bold flex items-center gap-1 shrink-0"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                  <p className="text-[9px] font-semibold text-slate-400 leading-normal ml-1">
                    Passes visitor emails dynamically from contact databases to automatically prepopulate email fields on slots confirmations.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end">
                <Button
                  onClick={() => setEmbedModalPage(null)}
                  className="rounded-xl font-bold h-10 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
