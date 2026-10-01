'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Enterprise Export Modal Dialog
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Exports sanitized CSV (OWASP formula injection protected) and structured JSON datasets.
 * 2. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportSurveyDataAction } from '@/lib/surveys/survey-analytics-actions';
import { Download, FileSpreadsheet, FileCode, Loader2, ShieldCheck } from 'lucide-react';

export interface ExportSurveyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  workspaceId: string;
}

export function ExportSurveyDataDialog({
  open,
  onOpenChange,
  surveyId,
  workspaceId,
}: ExportSurveyDataDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = React.useState<'csv' | 'json'>('csv');
  const [channelFilter, setChannelFilter] = React.useState<string>('all');
  const [includeContactDetails, setIncludeContactDetails] = React.useState<boolean>(true);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const handleExport = async () => {
    if (!surveyId || !workspaceId) return;
    setIsExporting(true);

    try {
      const res = await exportSurveyDataAction({
        surveyId,
        workspaceId,
        format,
        channelFilter,
        includeContactDetails,
      });

      if (!res.success || !res.content) {
        toast({ variant: 'destructive', title: 'Export Failed', description: res.error || 'Could not export dataset' });
        return;
      }

      // Trigger browser file download
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Dataset Exported',
        description: `Successfully exported ${res.recordCount} responses.`,
      });
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Export Error', description: 'Failed to download export file.' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden sm:rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold">Export Survey Responses</DialogTitle>
              <CardInfoTooltip text="Download survey responses with entity name, contact person, phone, email, and role." />
              <DialogDescription className="sr-only">
                Download survey responses with entity name, contact person, phone, email, and role.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold">Export File Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={format === 'csv' ? 'default' : 'outline'}
                onClick={() => setFormat('csv')}
                className="h-11 flex items-center justify-center gap-2 rounded-xl active:scale-[0.97]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-bold">CSV Spreadsheet</span>
              </Button>
              <Button
                type="button"
                variant={format === 'json' ? 'default' : 'outline'}
                onClick={() => setFormat('json')}
                className="h-11 flex items-center justify-center gap-2 rounded-xl active:scale-[0.97]"
              >
                <FileCode className="h-4 w-4" />
                <span className="font-bold">JSON Document</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold">Distribution Channel Filter</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-11 rounded-xl text-xs">
                <SelectValue placeholder="All Distribution Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Channels</SelectItem>
                <SelectItem value="web" className="text-xs">Direct Web Links</SelectItem>
                <SelectItem value="whatsapp" className="text-xs">WhatsApp Cloud</SelectItem>
                <SelectItem value="email" className="text-xs">Email Invitations</SelectItem>
                <SelectItem value="sms" className="text-xs">SMS Text Blasts</SelectItem>
                <SelectItem value="embed" className="text-xs">Web Embeds</SelectItem>
                <SelectItem value="kiosk" className="text-xs">Physical Kiosks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="space-y-0.5 pr-2">
              <Label className="text-xs font-bold">Include Entity & Contact Details</Label>
              <p className="text-[11px] text-muted-foreground">Includes entity name, contact person name, phone, email, and role for linked and non-linked respondents.</p>
            </div>
            <Switch checked={includeContactDetails} onCheckedChange={setIncludeContactDetails} />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[11px]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>OWASP formula injection defense active. Neutralizes malicious spreadsheet macros.</span>
          </div>
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 rounded-xl text-xs font-semibold active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="h-10 px-4 rounded-xl text-xs font-bold active:scale-[0.97]"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            {isExporting ? 'Generating Dataset...' : 'Download File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
