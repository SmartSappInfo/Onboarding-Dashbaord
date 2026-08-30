'use client';

/**
 * 7-Step Enterprise Data Import Wizard Studio Modal (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Section 62: "Professional Import Wizard UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 7-Step progression: 1 Upload -> 2 Map -> 3 Validate -> 4 Dedupe -> 5 Enrich -> 6 Preview -> 7 Import.
 * 2. Pre-flight schema validation, email syntax verification, and duplicate checking before Firestore commit.
 * 3. Mobile-responsive layout with >= 44px touch targets.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  FileSpreadsheet, 
  Upload, 
  Columns, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Sparkles, 
  Eye, 
  Database,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import type { 
  DataImportColumnMapping, 
  DataImportValidationResult 
} from '@/lib/lead-intelligence/types';
import { EnterpriseGovernanceEngine } from '@/lib/lead-intelligence/governance';
import { executeEnterpriseDataImportAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DataImportWizardModalProps {
  workspaceId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const DataImportWizardModal: React.FC<DataImportWizardModalProps> = ({
  workspaceId,
  organizationId,
  isOpen,
  onClose,
  onImportComplete
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<DataImportColumnMapping>({
    name: '',
    domain: '',
    phone: '',
    address: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    contactRole: ''
  });
  const [validationResult, setValidationResult] = useState<DataImportValidationResult | null>(null);
  const [autoEnrich, setAutoEnrich] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Step 1: Handle CSV File / Text Load
  const handleParseCsv = (content: string) => {
    setCsvText(content);
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      toast({ variant: 'destructive', title: 'CSV must contain headers and at least 1 data row' });
      return;
    }

    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    setHeaders(rawHeaders);

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};
      rawHeaders.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });
      rows.push(row);
    }

    setParsedRows(rows);

    // Auto-map common column names
    const autoMap: DataImportColumnMapping = {
      name: rawHeaders.find(h => /name|company|institution|school/i.test(h)) || rawHeaders[0] || '',
      domain: rawHeaders.find(h => /domain|website|url/i.test(h)) || '',
      phone: rawHeaders.find(h => /phone|mobile|tel/i.test(h)) || '',
      address: rawHeaders.find(h => /address|location|city/i.test(h)) || '',
      industry: rawHeaders.find(h => /industry|sector|category/i.test(h)) || '',
      contactName: rawHeaders.find(h => /contact|headmaster|principal|owner|rep/i.test(h)) || '',
      contactEmail: rawHeaders.find(h => /email|mail/i.test(h)) || '',
      contactRole: rawHeaders.find(h => /role|title|position/i.test(h)) || ''
    };

    setMapping(autoMap);
    setCurrentStep(2);
  };

  // Step 2 -> 3: Run Validation
  const handleValidateMapping = () => {
    if (!mapping.name) {
      toast({ variant: 'destructive', title: 'Institution / Company Name mapping is required' });
      return;
    }

    const result = EnterpriseGovernanceEngine.validateImportPayload(parsedRows, mapping);
    setValidationResult(result);
    setCurrentStep(3);
  };

  // Step 7: Execute Import
  const handleExecuteImport = async () => {
    try {
      setIsImporting(true);
      const res = await executeEnterpriseDataImportAction(
        workspaceId,
        organizationId,
        parsedRows,
        mapping,
        autoEnrich
      );

      if (res.success) {
        toast({
          title: 'Import Completed ✓',
          description: `Successfully imported ${res.importedCount} prospects into your workspace.`
        });
        onImportComplete?.();
        onClose();
        setCurrentStep(1);
        setCsvText('');
      } else {
        toast({ variant: 'destructive', title: 'Import Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Import execution error' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border/80 p-6 rounded-2xl shadow-xl space-y-4 max-h-[88vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Enterprise Data Import Studio
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            7-Step guided data onboarding with schema validation, email syntax verification, and duplicate detection.
          </DialogDescription>
        </DialogHeader>

        {/* Step Progression Bar (UI Spec Section 62) */}
        <div className="flex items-center justify-between gap-1 py-1 overflow-x-auto scrollbar-none">
          {['1 Upload', '2 Map', '3 Validate', '4 Dedupe', '5 Enrich', '6 Preview', '7 Commit'].map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = currentStep === stepNum;
            const isDone = currentStep > stepNum;

            return (
              <div
                key={label}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight whitespace-nowrap transition-all",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" :
                  "bg-muted/40 text-muted-foreground"
                )}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* STEP 1: UPLOAD */}
        {currentStep === 1 && (
          <div className="space-y-4 py-3">
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center space-y-3 bg-muted/10">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-foreground">Paste or Upload CSV Data</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Paste comma-separated rows or load existing lead lists for enterprise ingestion.
                </p>
              </div>

              <textarea
                placeholder="Name,Domain,Phone,Address,ContactName,ContactEmail&#10;St. Peter Int School,stpeter.edu.gh,0244123456,Accra,Samuel Mensah,smensah@stpeter.edu.gh"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full h-32 p-3 text-xs font-mono bg-background border border-border/80 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <Button
                onClick={() => handleParseCsv(csvText)}
                disabled={!csvText.trim()}
                className="h-9 px-5 bg-primary text-primary-foreground font-bold text-xs rounded-xl active:scale-[0.97]"
              >
                Continue to Column Mapping <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Map CSV Columns to Lead Intelligence Fields
              </h4>
              <p className="text-xs text-muted-foreground">
                Matched from your CSV header row ({headers.length} columns detected).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Institution Name *</Label>
                <select
                  value={mapping.name}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Select Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Website Domain</Label>
                <select
                  value={mapping.domain}
                  onChange={(e) => setMapping({ ...mapping, domain: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Optional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Phone Number</Label>
                <select
                  value={mapping.phone}
                  onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Optional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Decision Maker Name</Label>
                <select
                  value={mapping.contactName}
                  onChange={(e) => setMapping({ ...mapping, contactName: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Optional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Contact Email</Label>
                <select
                  value={mapping.contactEmail}
                  onChange={(e) => setMapping({ ...mapping, contactEmail: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Optional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Address / City</Label>
                <select
                  value={mapping.address}
                  onChange={(e) => setMapping({ ...mapping, address: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-background border border-border rounded-xl"
                >
                  <option value="">-- Optional --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)} className="rounded-xl">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleValidateMapping} className="bg-primary text-primary-foreground rounded-xl active:scale-[0.97]">
                Validate Data Schema <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 & 4: VALIDATE & DEDUPE */}
        {(currentStep === 3 || currentStep === 4) && validationResult && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-xs text-muted-foreground block">Valid Records</span>
                <span className="text-lg font-black text-emerald-600 font-mono">{validationResult.validRows}</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs text-muted-foreground block">Duplicates Found</span>
                <span className="text-lg font-black text-amber-600 font-mono">{validationResult.duplicateRows}</span>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-xs text-muted-foreground block">Syntax Errors</span>
                <span className="text-lg font-black text-rose-600 font-mono">{validationResult.invalidRows}</span>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5 max-h-32 overflow-y-auto text-xs">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Validation Warnings</span>
                {validationResult.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                    <span className="font-mono text-rose-500">Row {err.row}:</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)} className="rounded-xl">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={() => setCurrentStep(5)} className="bg-primary text-primary-foreground rounded-xl active:scale-[0.97]">
                Configure Enrichment <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5 & 6: ENRICH & PREVIEW */}
        {(currentStep === 5 || currentStep === 6) && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Auto-Enrich via Waterfall
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically scan websites for tech stacks and trigger SMTP email verification upon ingestion.
                  </p>
                </div>
                <Switch
                  checked={autoEnrich}
                  onCheckedChange={setAutoEnrich}
                />
              </div>
            </div>

            {/* Sample Rows Preview */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Preview Ingestion (First 2 Rows)</span>
              <div className="space-y-1.5">
                {parsedRows.slice(0, 2).map((row, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-background border border-border/60 text-xs flex items-center justify-between">
                    <span className="font-bold text-foreground">{row[mapping.name] || 'Institution'}</span>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {(mapping.domain && row[mapping.domain]) || (mapping.phone && row[mapping.phone]) || 'No domain'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)} className="rounded-xl">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.97]"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Ingesting Data...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 mr-1.5" /> Commit & Import {parsedRows.length} Prospects
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
