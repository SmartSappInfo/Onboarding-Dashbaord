'use client';

import * as React from 'react';
import { Eye, Building2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Form, FormSubmission } from '@/lib/types';
import { getSubmissionPreview } from '@/lib/forms-utils';

interface Props {
  submissions: FormSubmission[];
  form: Form;
  onSelect: (s: FormSubmission) => void;
}

function EntityChip({ entityId, contactScope }: { entityId?: string; contactScope?: string }) {
  if (!entityId) return <span className="text-muted-foreground/50 text-xs font-mono">—</span>;
  const Icon = contactScope === 'institution' ? Building2 : User;
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-mono text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
    >
      <Icon className="h-3 w-3" />
      {entityId.slice(-6)}
    </Badge>
  );
}

function ResolutionBar({ entityId }: { entityId?: string }) {
  return (
    <span
      className={`inline-block w-1 h-8 rounded-full mr-3 shrink-0 ${
        entityId ? 'bg-emerald-400' : 'bg-border'
      }`}
    />
  );
}

export default function SubmissionsTable({ submissions, form, onSelect }: Props) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-16 text-center">
        <p className="text-muted-foreground text-sm">No submissions yet.</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Share your form to start collecting responses.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
            <TableHead className="w-8 pl-4" />
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">#</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Submitted At</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Response</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">CRM Record</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s, idx) => (
            <TableRow
              key={s.id}
              className="cursor-pointer hover:bg-muted/20 transition-colors border-border/20"
              onClick={() => onSelect(s)}
              style={{ contentVisibility: 'auto' } as React.CSSProperties}
            >
              <TableCell className="pl-4 pr-0 py-3">
                <ResolutionBar entityId={s.entityId} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground py-3">
                {idx + 1}
              </TableCell>
              <TableCell className="py-3">
                <span className="text-sm font-medium">
                  {new Date(s.submittedAt).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-muted-foreground block">
                  {new Date(s.submittedAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </TableCell>
              <TableCell className="py-3 max-w-xs">
                <p className="text-sm text-muted-foreground truncate">
                  {getSubmissionPreview(s.data, form.fields?.map(f => ({ variableName: f.appFieldId, label: f.labelOverride || f.appFieldId } as any)) ?? [])}
                </p>
              </TableCell>
              <TableCell className="py-3">
                <EntityChip entityId={s.entityId} contactScope={form.contactScope} />
              </TableCell>
              <TableCell className="py-3 pr-4">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg opacity-60 hover:opacity-100">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
