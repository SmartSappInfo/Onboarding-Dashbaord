'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Search, RotateCcw, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { listTemplates, revertToGlobal } from '@/lib/template-actions';
import type { MessageTemplate, TemplateCategory } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  forms:      'bg-purple-500/15 text-purple-400 border-purple-500/20',
  surveys:    'bg-pink-500/15 text-pink-400 border-pink-500/20',
  meetings:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  agreements: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  campaigns:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  reminders:  'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  tasks:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  automations:'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  qr_codes:   'bg-rose-500/15 text-rose-400 border-rose-500/20',
  general:    'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'forms', label: 'Forms' },
  { value: 'surveys', label: 'Surveys' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'agreements', label: 'Agreements' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'automations', label: 'Automations' },
  { value: 'qr_codes', label: 'QR Codes' },
  { value: 'general', label: 'General' },
];

// ── Template Card Component ────────────────────────────────────────────────

interface TemplateCardProps {
  template: MessageTemplate;
  onOverride: () => void;
  onEdit: () => void;
  onRevert?: () => void;
}

function TemplateCard({ template, onOverride, onEdit, onRevert }: TemplateCardProps) {
  const isOrgOverride = template.scope === 'organization';
  const categoryColor = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.general;

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors group border-b border-border last:border-0">
      {/* Left: name + badges */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate">{template.name}</span>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 h-4 ${categoryColor}`}>
            {template.category}
          </Badge>
          
          <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 bg-muted/50 text-muted-foreground border-border">
            {template.channel.replace('_', ' ')}
          </Badge>

          {template.recipientType && (
            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 bg-slate-500/15 text-slate-300 border-slate-500/20">
              {template.recipientType.replace('_', ' ')}
            </Badge>
          )}

          {isOrgOverride && template.globalTemplateId && (
            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
              <Copy className="h-2.5 w-2.5" />
              Override
            </Badge>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {isOrgOverride ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit Override
            </Button>
            {onRevert && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                onClick={onRevert}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Revert to Global
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onOverride}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Override
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function OrgTemplateListClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganization } = useTenant();

  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [channelFilter, setChannelFilter] = React.useState<string>('all');
  const [recipientFilter, setRecipientFilter] = React.useState<string>('all');

  // Revert confirmation dialog state
  const [revertDialog, setRevertDialog] = React.useState<{ open: boolean; template: MessageTemplate | null }>({
    open: false,
    template: null,
  });

  // Load templates
  React.useEffect(() => {
    if (!activeOrganization?.id) return;

    async function load() {
      try {
        setLoading(true);
        const data = await listTemplates(activeOrganization!.id, {
          status: 'approved',
          isActive: true,
        });
        setTemplates(data);
      } catch (error) {
        console.error('Failed to load templates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load templates',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [activeOrganization, toast]);

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.templateType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchesChannel = channelFilter === 'all' || t.channel === channelFilter;
      const matchesRecipient = recipientFilter === 'all' || t.recipientType === recipientFilter;
      return matchesSearch && matchesCategory && matchesChannel && matchesRecipient;
    });
  }, [templates, searchQuery, categoryFilter, channelFilter, recipientFilter]);

  // Group by category
  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, MessageTemplate[]> = {};
    filteredTemplates.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTemplates]);

  // Handlers
  const handleOverride = (template: MessageTemplate) => {
    router.push(`/admin/settings/messaging/templates/${template.id}/override`);
  };

  const handleEdit = (template: MessageTemplate) => {
    router.push(`/admin/settings/messaging/templates/${template.id}/override`);
  };

  const handleRevertClick = (template: MessageTemplate) => {
    setRevertDialog({ open: true, template });
  };

  const handleRevertConfirm = async () => {
    if (!revertDialog.template) return;

    try {
      await revertToGlobal(revertDialog.template.id);
      toast({
        title: 'Success',
        description: 'Template reverted to global default',
      });
      // Reload templates
      const data = await listTemplates(activeOrganization!.id, {
        status: 'approved',
        isActive: true,
      });
      setTemplates(data);
    } catch (error) {
      console.error('Failed to revert template:', error);
      toast({
        title: 'Error',
        description: 'Failed to revert template',
        variant: 'destructive',
      });
    } finally {
      setRevertDialog({ open: false, template: null });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-border"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-border">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[140px] bg-muted/30 border-border">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="in_app">In-App</SelectItem>
              <SelectItem value="push">Push</SelectItem>
            </SelectContent>
          </Select>

          <Select value={recipientFilter} onValueChange={setRecipientFilter}>
            <SelectTrigger className="w-[160px] bg-muted/30 border-border">
              <SelectValue placeholder="All Recipients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recipients</SelectItem>
              <SelectItem value="respondent">Respondent</SelectItem>
              <SelectItem value="internal_alert">Internal Alert</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
              <SelectItem value="entity">Entity</SelectItem>
              <SelectItem value="external_alert">External Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Template groups */}
        {Object.keys(groupedTemplates).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No templates found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const items = groupedTemplates[cat.value];
              if (!items || items.length === 0) return null;

              return (
                <div key={cat.value} className="space-y-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-4">
                    {cat.label}
                  </h2>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {items.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onOverride={() => handleOverride(t)}
                        onEdit={() => handleEdit(t)}
                        onRevert={t.scope === 'organization' ? () => handleRevertClick(t) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={revertDialog.open} onOpenChange={(open) => setRevertDialog({ open, template: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Global Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete your organization&apos;s custom version of &quot;{revertDialog.template?.name}&quot; and restore the global default template.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertConfirm} className="bg-amber-500 hover:bg-amber-600">
              Revert to Global
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
