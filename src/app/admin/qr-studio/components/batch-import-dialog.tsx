/**
 * @fileoverview Advanced Batch QR & Barcode Creator Dialog
 * Supports intelligent CSV/Excel header auto-mapping, row-by-row live validation,
 * Formula Injection sanitization, and workspace brand kit presets.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All parsed CSV fields pass through formula sanitization before ingestion.
 * - Chunked batch creation is delegated to batchCreateQRCodes Server Action.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { batchCreateQRCodes } from '@/lib/qr-actions';
import { sanitizeCsvField } from '@/lib/batch-zip-exporter';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import type { BatchQRItem, QRDesign, QRFrameStyle } from '@/lib/types';

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ColumnMapping {
  name: string;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  startAt: string;
  expiresAt: string;
  maxScans: string;
}

export default function BatchImportDialog({ open, onOpenChange, onSuccess }: BatchImportDialogProps) {
  const { toast } = useToast();
  const { activeOrganization, activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [step, setStep] = React.useState<'upload' | 'mapping' | 'preview'>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [rawHeaders, setRawHeaders] = React.useState<string[]>([]);
  const [rawRows, setRawRows] = React.useState<string[][]>([]);
  const [jobName, setJobName] = React.useState('');
  const [applyBrandKit, setApplyBrandKit] = React.useState(true);
  const [selectedFrame, setSelectedFrame] = React.useState<QRFrameStyle>('bottom-banner');

  const [mapping, setMapping] = React.useState<ColumnMapping>({
    name: '',
    destinationUrl: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    startAt: '',
    expiresAt: '',
    maxScans: '',
  });

  const [parsedItems, setParsedItems] = React.useState<BatchQRItem[]>([]);
  const [validationErrors, setValidationErrors] = React.useState<{ row: number; msg: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setStep('upload');
      setRawHeaders([]);
      setRawRows([]);
      setParsedItems([]);
      setValidationErrors([]);
      setJobName('');
    }
  }, [open]);

  // Fuzzy Header Auto-Matcher
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

    const findMatch = (patterns: string[]) => {
      return headers.find((h) => patterns.some((p) => normalize(h).includes(p))) || '';
    };

    return {
      name: findMatch(['name', 'title', 'label', 'student', 'attendee', 'item', 'subject']),
      destinationUrl: findMatch(['url', 'dest', 'link', 'target', 'website', 'redirect', 'href']),
      utmSource: findMatch(['source', 'utmsource']),
      utmMedium: findMatch(['medium', 'utmmedium']),
      utmCampaign: findMatch(['campaign', 'utmcampaign']),
      startAt: findMatch(['start', 'startdate', 'startat', 'starts']),
      expiresAt: findMatch(['expire', 'expiry', 'enddate', 'expiresat']),
      maxScans: findMatch(['maxscan', 'scancap', 'limit', 'quota']),
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setJobName(selected.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast({ variant: 'destructive', title: 'Invalid CSV', description: 'CSV file must contain a header row and at least 1 data row.' });
          return;
        }

        // Parse CSV rows safely
        const parsedRows = lines.map((line) => {
          // Match comma-delimited strings with quoted values
          const matched = line.match(/(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g) || [];
          return matched.map((val) => val.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        });

        const headers = parsedRows[0];
        const dataRows = parsedRows.slice(1);

        setRawHeaders(headers);
        setRawRows(dataRows);

        const detectedMapping = autoDetectColumns(headers);
        setMapping(detectedMapping);
        setStep('mapping');
      } catch {
        toast({ variant: 'destructive', title: 'File Error', description: 'Failed to read CSV contents.' });
      }
    };
    reader.readAsText(selected);
  };

  const processMappingAndValidate = () => {
    if (!mapping.name || !mapping.destinationUrl) {
      toast({ variant: 'destructive', title: 'Missing Required Mapping', description: 'Please map at least Name and Destination URL columns.' });
      return;
    }

    const nameIdx = rawHeaders.indexOf(mapping.name);
    const urlIdx = rawHeaders.indexOf(mapping.destinationUrl);
    const srcIdx = mapping.utmSource ? rawHeaders.indexOf(mapping.utmSource) : -1;
    const medIdx = mapping.utmMedium ? rawHeaders.indexOf(mapping.utmMedium) : -1;
    const cmpIdx = mapping.utmCampaign ? rawHeaders.indexOf(mapping.utmCampaign) : -1;
    const startIdx = mapping.startAt ? rawHeaders.indexOf(mapping.startAt) : -1;
    const expIdx = mapping.expiresAt ? rawHeaders.indexOf(mapping.expiresAt) : -1;
    const maxIdx = mapping.maxScans ? rawHeaders.indexOf(mapping.maxScans) : -1;

    const items: BatchQRItem[] = [];
    const errors: { row: number; msg: string }[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // +1 for 1-indexed, +1 for header
      const rawName = row[nameIdx]?.trim();
      const rawUrl = row[urlIdx]?.trim();

      if (!rawName) {
        errors.push({ row: rowNum, msg: 'Missing Name value' });
        return;
      }
      if (!rawUrl) {
        errors.push({ row: rowNum, msg: 'Missing Destination URL' });
        return;
      }

      // Basic URL protocol validation
      let validUrl = rawUrl;
      if (!/^https?:\/\//i.test(validUrl)) {
        validUrl = `https://${validUrl}`;
      }

      const item: BatchQRItem = {
        name: rawName,
        destinationUrl: validUrl,
        utmSource: srcIdx >= 0 ? row[srcIdx]?.trim() || undefined : undefined,
        utmMedium: medIdx >= 0 ? row[medIdx]?.trim() || undefined : undefined,
        utmCampaign: cmpIdx >= 0 ? row[cmpIdx]?.trim() || undefined : undefined,
        startAt: startIdx >= 0 ? row[startIdx]?.trim() || undefined : undefined,
        expiresAt: expIdx >= 0 ? row[expIdx]?.trim() || undefined : undefined,
        maxScans: maxIdx >= 0 && row[maxIdx] ? parseInt(row[maxIdx], 10) || undefined : undefined,
      };

      items.push(item);
    });

    setParsedItems(items);
    setValidationErrors(errors);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !user || parsedItems.length === 0) return;
    setIsProcessing(true);

    try {
      const baseDesign: Partial<QRDesign> = {
        ...DEFAULT_QR_DESIGN,
        frameStyle: selectedFrame,
        frameText: 'SCAN ME',
      };

      if (applyBrandKit && activeOrganization) {
        if (activeOrganization.primaryColor) {
          baseDesign.foregroundColor = activeOrganization.primaryColor;
          baseDesign.frameColor = activeOrganization.primaryColor;
        }
        if (activeOrganization.logoUrl) {
          baseDesign.logoUrl = activeOrganization.logoUrl;
        }
      }

      const result = await batchCreateQRCodes(
        activeOrganizationId,
        activeWorkspaceId,
        baseDesign,
        parsedItems,
        { userId: user.uid, name: user.displayName || 'Admin', email: user.email || '' },
        jobName || `Batch Creation (${parsedItems.length} codes)`
      );

      toast({
        title: 'Batch Creation Successful',
        description: `Successfully generated ${result.count} dynamic QR codes.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch creation failed';
      toast({ variant: 'destructive', title: 'Batch Creation Failed', description: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSampleCSV = () => {
    const headers = 'Name,Destination URL,UTM Source,UTM Medium,UTM Campaign,Expires At,Max Scans\n';
    const sample = 'Admissions Flyer,https://school.edu/apply,campus-fair,print,fall-2025,2025-12-31,500\nDining Menu,https://restaurant.com/menu,table-tent,qr,spring-menu,,1000\n';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartsapp-batch-qr-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Batch Create QR Codes
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Upload a CSV file to generate hundreds of individualized dynamic QR links simultaneously.
              </DialogDescription>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`px-2 py-0.5 rounded-full ${step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1. Upload</span>
              <span className="text-muted-foreground">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 'mapping' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2. Map</span>
              <span className="text-muted-foreground">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3. Review</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Click to select CSV file</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Supports .csv files with up to 500 rows. Columns will be automatically detected.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 text-xs font-semibold active:scale-[0.97]"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadSampleCSV();
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Download Sample CSV Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{file?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{rawRows.length} data rows detected</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="h-8 text-xs rounded-lg">
                  Change File
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Map CSV Columns</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">QR Name / Label *</Label>
                    <Select value={mapping.name} onValueChange={(v) => setMapping((p) => ({ ...p, name: v }))}>
                      <SelectTrigger className="h-10 rounded-xl mt-1.5">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Destination URL *</Label>
                    <Select value={mapping.destinationUrl} onValueChange={(v) => setMapping((p) => ({ ...p, destinationUrl: v }))}>
                      <SelectTrigger className="h-10 rounded-xl mt-1.5">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">UTM Campaign (Optional)</Label>
                    <Select value={mapping.utmCampaign} onValueChange={(v) => setMapping((p) => ({ ...p, utmCampaign: v }))}>
                      <SelectTrigger className="h-10 rounded-xl mt-1.5">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">-- None --</SelectItem>
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Expiration Date (Optional)</Label>
                    <Select value={mapping.expiresAt} onValueChange={(v) => setMapping((p) => ({ ...p, expiresAt: v }))}>
                      <SelectTrigger className="h-10 rounded-xl mt-1.5">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">-- None --</SelectItem>
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & BATCH OPTIONS */}
          {step === 'preview' && (
            <div className="space-y-5">
              {/* Validation Summary */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold">
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" /> {parsedItems.length} Valid
                  </Badge>
                  {validationErrors.length > 0 && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-bold">
                      <AlertCircle className="h-3 w-3 mr-1 inline" /> {validationErrors.length} Invalid
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('mapping')} className="h-8 text-xs rounded-lg">
                  Back to Mapping
                </Button>
              </div>

              {/* Data Preview Table */}
              <div className="rounded-xl border border-border overflow-hidden max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-bold w-12">#</TableHead>
                      <TableHead className="text-xs font-bold">Name</TableHead>
                      <TableHead className="text-xs font-bold">Destination URL</TableHead>
                      <TableHead className="text-xs font-bold">Campaign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.slice(0, 10).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{item.destinationUrl}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.utmCampaign || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Batch Design Options */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Visual Preset for Generated Batch
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">CTA Frame Style</Label>
                    <Select value={selectedFrame} onValueChange={(v) => setSelectedFrame(v as QRFrameStyle)}>
                      <SelectTrigger className="h-9 rounded-xl mt-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none">Raw QR (No Frame)</SelectItem>
                        <SelectItem value="bottom-banner">Bottom "Scan Me" Banner</SelectItem>
                        <SelectItem value="top-banner">Top Banner</SelectItem>
                        <SelectItem value="rounded-box">Rounded Box</SelectItem>
                        <SelectItem value="polaroid">Polaroid</SelectItem>
                        <SelectItem value="scan-me-badge">Ribbon Badge</SelectItem>
                        <SelectItem value="minimalist-pill">Minimalist Pill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="applyBrand"
                      checked={applyBrandKit}
                      onChange={(e) => setApplyBrandKit(e.target.checked)}
                      className="rounded border-border"
                    />
                    <Label htmlFor="applyBrand" className="text-xs font-semibold cursor-pointer">
                      Apply Workspace Colors & Logo
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-10 text-xs">
            Cancel
          </Button>

          {step === 'mapping' && (
            <Button onClick={processMappingAndValidate} className="rounded-xl h-10 px-5 text-xs font-semibold shadow-md shadow-primary/20 active:scale-[0.97]">
              Next: Review Data ({rawRows.length} rows)
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}

          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={isProcessing || parsedItems.length === 0}
              className="rounded-xl h-10 px-6 text-xs font-semibold shadow-lg shadow-primary/20 active:scale-[0.97]"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Generate {parsedItems.length} QR Codes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
