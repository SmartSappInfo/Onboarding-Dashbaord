'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TemplateCard from '@/components/messaging/TemplateCard';
import { listGlobalTemplates } from '@/lib/template-actions';
import { approveTemplate, deleteGlobalTemplate } from '@/lib/template-actions';
import { useBackoffice } from '../../../context/BackofficeProvider';
import type { MessageTemplate, TemplateCategory } from '@/lib/types';

// ── Category display config ────────────────────────────────────────────────

const CATEGORIES: TemplateCategory[] = ['meetings', 'forms', 'surveys', 'agreements', 'campaigns', 'reminders', 'tasks', 'automations', 'qr_codes', 'general'];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  meetings:   'Meetings',
  forms:      'Forms',
  surveys:    'Surveys',
  agreements: 'Agreements',
  campaigns:  'Campaigns',
  reminders:  'Reminders',
  tasks:      'Tasks',
  automations:'Automations',
  qr_codes:   'QR Codes',
  general:    'General',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function MessagingTemplateListClient() {
  const router = useRouter();
  const { can, profile } = useBackoffice();

  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [channelFilter, setChannelFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | MessageTemplate['status']>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<'all' | TemplateCategory>('all');
  const [recipientFilter, setRecipientFilter] = React.useState<string>('all');

  React.useEffect(() => { load(); }, []);

  async function load() {
    setIsLoading(true);
    try {
      const data = await listGlobalTemplates();
      setTemplates(data);
    } finally {
      setIsLoading(false);
    }
  }

  // Client-side filtering
  const filtered = React.useMemo(() => {
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (recipientFilter !== 'all' && t.recipientType !== recipientFilter) return false;
      return true;
    });
  }, [templates, search, channelFilter, statusFilter, categoryFilter, recipientFilter]);

  // Group by category
  const grouped = React.useMemo(() => {
    const map = new Map<TemplateCategory, MessageTemplate[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const t of filtered) {
      const arr = map.get(t.category);
      if (arr) arr.push(t);
    }
    return map;
  }, [filtered]);

  async function handleApprove(id: string) {
    if (!profile) return;
    await approveTemplate(id, profile.id);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await deleteGlobalTemplate(id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Message Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global default templates available to all organizations.
          </p>
        </div>
        {can('templates', 'create') && (
          <Link href="/backoffice/messaging/templates/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4 gap-2">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
          <SelectTrigger className="w-44 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="in_app">In-App</SelectItem>
            <SelectItem value="push">Push</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recipientFilter} onValueChange={setRecipientFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Recipient" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Recipients</SelectItem>
            <SelectItem value="respondent">Respondent</SelectItem>
            <SelectItem value="internal_alert">Internal Alert</SelectItem>
            <SelectItem value="assignee">Assignee</SelectItem>
            <SelectItem value="entity">Entity</SelectItem>
            <SelectItem value="external_alert">External Alert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-36 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center">
          {filtered.length} templates
        </Badge>
      </div>

      {/* Template groups */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
              <div className="h-10 bg-muted/50 animate-pulse" />
              {[1, 2].map((j) => (
                <div key={j} className="h-12 border-t border-border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="h-10 w-10 text-slate-700 mb-4" />
          <p className="text-sm text-muted-foreground">No templates found.</p>
          {can('templates', 'create') && (
            <Link href="/backoffice/messaging/templates/new">
              <Button variant="ghost" className="mt-4 text-emerald-400 gap-2">
                <Plus className="h-4 w-4" /> Create your first template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat} className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="ml-2 text-[10px] text-slate-600">({items.length})</span>
                </div>
                {/* Template rows */}
                <div className="divide-y divide-border">
                  {items.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onEdit={() => router.push(`/backoffice/messaging/templates/${t.id}`)}
                      onDelete={can('templates', 'delete') ? () => handleDelete(t.id, t.name) : undefined}
                      onApprove={can('templates', 'edit') ? () => handleApprove(t.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
