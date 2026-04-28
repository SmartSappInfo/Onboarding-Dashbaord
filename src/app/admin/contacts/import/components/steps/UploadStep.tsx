import React, { useCallback, useState } from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Play, Info, Asterisk } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INSTITUTION_TEMPLATE_HEADER, INSTITUTION_SAMPLE_ROW, INSTITUTION_FIELD_INSTRUCTIONS } from '@/lib/import-export/institution-template';
import { PERSON_TEMPLATE_HEADER, PERSON_SAMPLE_ROW, PERSON_FIELD_INSTRUCTIONS } from '@/lib/import-export/person-template';
import { FAMILY_TEMPLATE_HEADER, FAMILY_SAMPLE_ROW, FAMILY_FIELD_INSTRUCTIONS } from '@/lib/import-export/family-template';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getContactPolicyLabel } from '@/lib/contact-policy';
import { Badge } from '@/components/ui/badge';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
}

export function UploadStep({ state, updateState, onNext }: Props) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const { activeWorkspace } = useWorkspace();

  const contactPolicy = activeWorkspace?.contactPolicy || 'phone_or_email';
  const contactScope = activeWorkspace?.contactScope || 'institution';

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Invalid file type', description: 'Please upload a CSV file', variant: 'destructive' });
      return;
    }
    
    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsing(false);
        if (results.errors.length && !results.data.length) {
          toast({ title: 'Error reading CSV', description: results.errors[0].message, variant: 'destructive' });
          return;
        }

        const headers = results.meta.fields || [];
        updateState({
          file,
          csvData: results.data as Record<string, string>[],
          headers,
          // Auto-infer entity type loosely by headers
          entityType: headers.some(h => /nominalRoll|focalperson/i.test(h)) 
            ? 'institution' 
            : headers.some(h => /family|guardian/i.test(h))
              ? 'family'
              : 'person'
        });
      },
      error: () => {
        setIsParsing(false);
        toast({ title: 'Failed to parse', description: 'Could not read that CSV format', variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = (type: 'person' | 'family' | 'institution') => {
    let content = '';
    let filename = '';
    if (type === 'person') {
      content = `${PERSON_TEMPLATE_HEADER}\n${PERSON_SAMPLE_ROW}`;
      filename = 'person-import-template.csv';
    } else if (type === 'family') {
      content = `${FAMILY_TEMPLATE_HEADER}\n${FAMILY_SAMPLE_ROW}`;
      filename = 'family-import-template.csv';
    } else if (type === 'institution') {
      content = `${INSTITUTION_TEMPLATE_HEADER}\n${INSTITUTION_SAMPLE_ROW}`;
      filename = 'institution-import-template.csv';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get the right field instructions based on the selected or workspace entity type
  const activeType = state.entityType || contactScope;
  const fieldInstructions = activeType === 'person'
    ? PERSON_FIELD_INSTRUCTIONS
    : activeType === 'family'
      ? FAMILY_FIELD_INSTRUCTIONS
      : INSTITUTION_FIELD_INSTRUCTIONS;

  // Determine which phone/email fields are policy-required based on type
  const policyRequiredFields = (() => {
    const phoneField = activeType === 'institution' ? 'focalPerson_phone' 
      : activeType === 'family' ? 'guardian1_phone' : 'phone';
    const emailField = activeType === 'institution' ? 'focalPerson_email'
      : activeType === 'family' ? 'guardian1_email' : 'email';
    
    if (contactPolicy === 'phone_only') return [phoneField];
    if (contactPolicy === 'email_only') return [emailField];
    return []; // phone_or_email — either works, neither strictly required
  })();

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex gap-6 w-full max-w-5xl mx-auto items-stretch h-full">
        {/* Left column: File Dropper */}
        <div className="flex-1 flex flex-col space-y-4">
          <label className="text-sm font-medium text-foreground">Upload CSV File</label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl transition-all h-64
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border'}
              ${state.file ? 'border-green-500/50 bg-green-500/5' : ''}
              cursor-pointer overflow-hidden
            `}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            
            {isParsing ? (
              <div className="flex flex-col items-center animate-pulse">
                <UploadCloud className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">Parsing large CSV...</p>
              </div>
            ) : state.file ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{state.file.name}</h3>
                <p className="text-muted-foreground mt-1">
                  {state.csvData.length.toLocaleString()} rows detected
                </p>
                <div className="mt-4 px-3 py-1 bg-background/50 rounded-full border text-xs font-medium text-muted-foreground">
                  Click or drag to replace
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Drop your CSV here</h3>
                <p className="text-muted-foreground mt-1 text-sm max-w-[250px]">
                  Supports up to 5,000 rows per batch. Download the templates if you need a schema.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <FileType className="w-4 h-4" /> Download Template:
            </span>
            <div className="space-x-2">
              <Button variant="link" className={`h-auto p-0 ${contactScope === 'person' ? 'text-primary font-bold' : 'text-muted-foreground'}`} onClick={() => handleDownloadTemplate('person')}>Person</Button>
              <Button variant="link" className={`h-auto p-0 ${contactScope === 'family' ? 'text-primary font-bold' : 'text-muted-foreground'}`} onClick={() => handleDownloadTemplate('family')}>Family</Button>
              <Button variant="link" className={`h-auto p-0 ${contactScope === 'institution' ? 'text-primary font-bold' : 'text-muted-foreground'}`} onClick={() => handleDownloadTemplate('institution')}>Institution</Button>
            </div>
          </div>
        </div>

        {/* Right column: Target Selection + Field Guide */}
        <div className="w-[340px] flex flex-col space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">What are you importing?</label>
            <Select 
              value={state.entityType || ''} 
              onValueChange={(val: any) => updateState({ entityType: val })}
              disabled={!state.file}
            >
              <SelectTrigger className="w-full bg-background/50">
                <SelectValue placeholder="Select Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Persons / Leads</SelectItem>
                <SelectItem value="family">Families / Households</SelectItem>
                <SelectItem value="institution">Institutions / B2B</SelectItem>
              </SelectContent>
            </Select>
            {!state.entityType && state.file && (
              <p className="text-xs flex items-center text-amber-500 mt-1">
                <AlertCircle className="w-3 h-3 mr-1" /> Could not infer type from headers.
              </p>
            )}
          </div>

          {/* Workspace Policy Badge */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold text-foreground">Workspace Policy</span>
              <Badge variant="outline" className="text-[8px] font-bold ml-auto h-4 px-1.5">{getContactPolicyLabel(contactPolicy)}</Badge>
            </div>
            <p className="text-[9px] font-medium text-muted-foreground leading-relaxed">
              {contactPolicy === 'phone_only' && 'Phone number is required for each contact. Email is optional.'}
              {contactPolicy === 'email_only' && 'Email address is required for each contact. Phone is optional.'}
              {contactPolicy === 'phone_or_email' && 'Either a phone number or email address must be provided.'}
            </p>
          </div>

          {/* Field Guide */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <label className="text-[10px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Asterisk className="w-3 h-3 text-red-500" /> Field Guide
              <span className="text-[8px] font-medium text-muted-foreground/60 ml-auto">* = required</span>
            </label>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {fieldInstructions.map((fi) => {
                const isRequired = fi.field.endsWith('*');
                const isPolicyRequired = policyRequiredFields.includes(fi.field);
                return (
                  <div 
                    key={fi.field} 
                    className={`flex items-start gap-2 p-2 rounded-lg text-[9px] ${
                      isRequired ? 'bg-red-500/5 border border-red-500/15' 
                      : isPolicyRequired ? 'bg-amber-500/5 border border-amber-500/15'
                      : 'bg-muted/30'
                    }`}
                  >
                    <span className={`font-mono font-bold min-w-[130px] shrink-0 ${
                      isRequired ? 'text-red-600' : isPolicyRequired ? 'text-amber-600' : 'text-foreground'
                    }`}>
                      {fi.field}{isPolicyRequired && !isRequired ? '†' : ''}
                    </span>
                    <span className="text-muted-foreground font-medium leading-relaxed">{fi.description}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[8px] text-muted-foreground mt-1.5 pt-1.5 border-t">
              <span className="text-red-500 font-bold">*</span> Always required &nbsp;
              {policyRequiredFields.length > 0 && <><span className="text-amber-500 font-bold">†</span> Required by workspace policy</>}
            </p>
          </div>

          {state.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{state.error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button 
                onClick={onNext} 
                disabled={!state.file || !state.entityType || isParsing}
                className="w-full h-12 shadow-md hover:shadow-lg transition-all"
            >
              Continue to Database Mapping
              <Play className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
