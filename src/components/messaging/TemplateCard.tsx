'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, CheckCircle, Mail, Smartphone } from 'lucide-react';
import type { MessageTemplate } from '@/lib/types';

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MessageTemplate['status'], { label: string; className: string; dot: string }> = {
  active:           { label: 'Active',           className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
  draft:            { label: 'Draft',             className: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
  archived:         { label: 'Archived',          className: 'bg-slate-500/15 text-muted-foreground border-slate-500/20', dot: 'bg-slate-500' },
};

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

// ── Props ──────────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: MessageTemplate;
  onEdit: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TemplateCard({ template, onEdit, onDelete, onApprove }: TemplateCardProps) {
  const status = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.draft;
  const categoryColor = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.general;

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors group">
      {/* Left: name + badges */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} />
        </div>
        <span className="text-sm font-medium text-foreground truncate">{template.name}</span>
        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 h-4 shrink-0 ${categoryColor}`}>
          {template.category}
        </Badge>
        <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 shrink-0 bg-muted/50 text-muted-foreground border-border flex items-center gap-1">
          {template.channel === 'email' ? <Mail className="h-2.5 w-2.5" /> : template.channel === 'sms' ? <Smartphone className="h-2.5 w-2.5" /> : null}
          {template.channel.replace('_', ' ')}
        </Badge>
        {template.recipientType && (
          <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 shrink-0 bg-slate-500/15 text-slate-300 border-slate-500/20">
            {template.recipientType.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-2 h-5 ${status.className}`}>
          {status.label}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onApprove && template.status !== 'active' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              onClick={onApprove}
              aria-label="Activate template"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            aria-label="Edit template"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              onClick={onDelete}
              aria-label="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
