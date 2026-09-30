'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
  Table as TableIcon,
  Layers,
  ArrowRight,
  FileCheck,
  X,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { AdHocContactItem } from '@/lib/types/composer-audience';
import { validateAndNormalizeTarget } from '@/lib/messaging/contact-tokenizer';
import { cn } from '@/lib/utils';

export interface SpreadsheetRecipientImporterProps {
  channel: 'email' | 'sms' | 'whatsapp';
  defaultCountry?: string;
  declaredVariables?: string[]; // Template variables to map, e.g. ['student_name', 'fee_due']
  onImportComplete: (items: AdHocContactItem[], columnMapping: Record<string, string>) => void;
  onCancel?: () => void;
  className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface ParsedSpreadsheet {
  name: string;
  size: number;
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Smart heuristic to auto-detect target contact column based on messaging channel.
 */
export function detectTargetColumn(
  headers: string[],
  channel: 'email' | 'sms' | 'whatsapp'
): string {
  if (headers.length === 0) return '';

  if (channel === 'email') {
    // 1. Exact match for email keywords
    const emailExact = headers.find((h) => /^(email|e-mail)$/i.test(h.trim()));
    if (emailExact) return emailExact;

    // 2. Substring match for email
    const emailContains = headers.find((h) => /email|e-mail/i.test(h.trim()));
    if (emailContains) return emailContains;

    // 3. Exact match for recipient / contact
    const recipientExact = headers.find((h) => /^(recipient|contact)$/i.test(h.trim()));
    if (recipientExact) return recipientExact;

    // 4. Substring match for recipient / contact
    const recipientContains = headers.find((h) => /recipient|contact/i.test(h.trim()));
    if (recipientContains) return recipientContains;

    return '';
  }

  // Channel is SMS or WhatsApp
  // 1. Exact match for phone / mobile / tel / telephone
  const phoneExact = headers.find((h) =>
    /^(phone|mobile|tel|telephone|cell)$/i.test(h.trim())
  );
  if (phoneExact) return phoneExact;

  // 2. Substring match for phone / mobile / tel / telephone
  const phoneContains = headers.find((h) =>
    /phone|mobile|tel|telephone|cell/i.test(h.trim())
  );
  if (phoneContains) return phoneContains;

  // 3. Exact match for contact / recipient
  const contactExact = headers.find((h) => /^(contact|recipient)$/i.test(h.trim()));
  if (contactExact) return contactExact;

  // 4. Substring match for contact / recipient
  const contactContains = headers.find((h) => /contact|recipient/i.test(h.trim()));
  if (contactContains) return contactContains;

  return '';
}

/**
 * Smart heuristic to auto-detect name column.
 */
export function detectNameColumn(headers: string[], excludeColumn?: string): string {
  const candidates = headers.filter((h) => h !== excludeColumn);
  if (candidates.length === 0) return '';

  // 1. Exact match for standard full name variants
  const nameExact = candidates.find((h) =>
    /^(full[\s_-]?name|contact[\s_-]?name|first[\s_-]?name|name)$/i.test(h.trim())
  );
  if (nameExact) return nameExact;

  // 2. Substring match for full name or contact name
  const nameCompound = candidates.find((h) =>
    /(full[\s_-]?name|contact[\s_-]?name|first[\s_-]?name)/i.test(h.trim())
  );
  if (nameCompound) return nameCompound;

  // 3. Contains generic name
  const nameContains = candidates.find((h) => /name/i.test(h.trim()));
  if (nameContains) return nameContains;

  return '';
}

/**
 * Fuzzy matches a template variable to the best matching discovered header.
 */
export function matchTemplateVariable(varName: string, headers: string[]): string {
  if (headers.length === 0) return '';

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanVar = clean(varName);

  // 1. Exact normalized match: e.g. student_name matches "Student Name" or "Student_Name"
  const exact = headers.find((h) => clean(h) === cleanVar);
  if (exact) return exact;

  // 2. Substring match
  const substringMatch = headers.find((h) => {
    const cleanHeader = clean(h);
    return cleanHeader.includes(cleanVar) || cleanVar.includes(cleanHeader);
  });
  if (substringMatch) return substringMatch;

  // 3. Word token overlap
  const varTokens = varName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let bestMatch = '';
  let bestScore = 0;

  for (const h of headers) {
    const hTokens = h
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const shared = varTokens.filter((t) => hTokens.includes(t)).length;
    if (shared > bestScore) {
      bestScore = shared;
      bestMatch = h;
    }
  }

  if (bestScore > 0) return bestMatch;

  return '';
}

/**
 * Format bytes to readable string (e.g. 1.2 MB or 45 KB).
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads a File as UTF-8 string across standard browser and test environments.
 */
function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file as text'));
    reader.readAsText(file);
  });
}

/**
 * Reads a File as ArrayBuffer across standard browser and test environments.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('Failed to read binary file'));
    reader.readAsArrayBuffer(file);
  });
}

export function SpreadsheetRecipientImporter({
  channel,
  defaultCountry = 'GH',
  declaredVariables = [],
  onImportComplete,
  onCancel,
  className,
}: SpreadsheetRecipientImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedSpreadsheet | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setParsedFile(null);
    setTargetColumn('');
    setNameColumn('');
    setVariableMappings({});
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleProcessFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      // 1. File size validation
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage('File size exceeds the 5MB limit. Please upload a smaller file.');
        return;
      }

      // 2. Format validation
      const fileNameLower = file.name.toLowerCase();
      const isCsv = fileNameLower.endsWith('.csv');
      const isXlsx = fileNameLower.endsWith('.xlsx');
      const isXls = fileNameLower.endsWith('.xls');

      if (!isCsv && !isXlsx && !isXls) {
        setErrorMessage('Unsupported file format. Please upload a .xlsx, .xls, or .csv file.');
        return;
      }

      try {
        let columns: string[] = [];
        let rows: Record<string, string>[] = [];

        if (isCsv) {
          const csvText = await readFileAsText(file);
          if (!csvText.trim()) {
            setErrorMessage('The uploaded file is empty. Please upload a file with contact data.');
            return;
          }

          const parsed = Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
          });

          columns = (parsed.meta.fields || []).map((f) => f.trim()).filter(Boolean);
          rows = (parsed.data || [])
            .map((rawRow) => {
              const cleaned: Record<string, string> = {};
              for (const col of columns) {
                cleaned[col] = String(rawRow[col] ?? '').trim();
              }
              return cleaned;
            })
            .filter((row) => Object.values(row).some((val) => val.length > 0));
        } else {
          // Excel .xlsx or .xls
          const arrayBuffer = await readFileAsArrayBuffer(file);
          if (arrayBuffer.byteLength === 0) {
            setErrorMessage('The uploaded file is empty. Please upload a file with contact data.');
            return;
          }

          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];

          if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
            setErrorMessage('The uploaded spreadsheet contains no sheets or readable data.');
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rawSheetData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

          if (!rawSheetData || rawSheetData.length === 0) {
            setErrorMessage('The uploaded spreadsheet is empty.');
            return;
          }

          const firstRow = (rawSheetData[0] || []) as unknown[];
          columns = firstRow.map((c) => String(c ?? '').trim()).filter(Boolean);

          const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
            defval: '',
            raw: false,
          });

          rows = rawRows
            .map((rawRow) => {
              const cleaned: Record<string, string> = {};
              for (const col of columns) {
                cleaned[col] = String(rawRow[col] ?? '').trim();
              }
              return cleaned;
            })
            .filter((row) => Object.values(row).some((val) => val.length > 0));
        }

        if (columns.length === 0 || rows.length === 0) {
          setErrorMessage('The uploaded file contains no rows or header columns.');
          return;
        }

        // Auto-detect columns
        const detectedTarget = detectTargetColumn(columns, channel);
        const detectedName = detectNameColumn(columns, detectedTarget);

        // Auto-match declared variables
        const initialVarMappings: Record<string, string> = {};
        for (const varName of declaredVariables) {
          initialVarMappings[varName] = matchTemplateVariable(varName, columns);
        }

        setParsedFile({
          name: file.name,
          size: file.size,
          columns,
          rows,
        });
        setTargetColumn(detectedTarget);
        setNameColumn(detectedName);
        setVariableMappings(initialVarMappings);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to parse file';
        setErrorMessage(`Failed to process spreadsheet: ${message}`);
      }
    },
    [channel, declaredVariables]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  // Compute metrics and valid normalized items reactively
  const { validItems, validCount, invalidCount, duplicateCount, totalRows } = useMemo(() => {
    if (!parsedFile || !targetColumn) {
      return {
        validItems: [] as AdHocContactItem[],
        validCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        totalRows: parsedFile?.rows.length || 0,
      };
    }

    const seenTargets = new Set<string>();
    const items: AdHocContactItem[] = [];
    let duplicates = 0;
    let invalids = 0;

    for (let i = 0; i < parsedFile.rows.length; i++) {
      const row = parsedFile.rows[i];
      const rawTarget = String(row[targetColumn] ?? '').trim();

      if (!rawTarget) {
        invalids++;
        continue;
      }

      const { target, isValid, validationError } = validateAndNormalizeTarget(
        rawTarget,
        channel,
        defaultCountry
      );

      if (!isValid) {
        invalids++;
        continue;
      }

      const canonical = target.toLowerCase();
      if (seenTargets.has(canonical)) {
        duplicates++;
        continue;
      }
      seenTargets.add(canonical);

      const displayName = nameColumn && row[nameColumn] ? String(row[nameColumn]).trim() : undefined;

      const customVars: Record<string, string> = {};
      for (const varName of declaredVariables) {
        const mappedCol = variableMappings[varName];
        if (mappedCol && row[mappedCol] !== undefined) {
          customVars[varName] = String(row[mappedCol]).trim();
        }
      }

      items.push({
        id: `adhoc_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        rawInput: rawTarget,
        target,
        displayName: displayName || undefined,
        isValid: true,
        validationError,
        customVars: Object.keys(customVars).length > 0 ? customVars : undefined,
      });
    }

    return {
      validItems: items,
      validCount: items.length,
      invalidCount: invalids,
      duplicateCount: duplicates,
      totalRows: parsedFile.rows.length,
    };
  }, [parsedFile, targetColumn, nameColumn, variableMappings, channel, defaultCountry, declaredVariables]);

  const handleImport = () => {
    if (validItems.length === 0 || !targetColumn) return;

    const columnMapping: Record<string, string> = {
      target: targetColumn,
      ...(nameColumn ? { name: nameColumn } : {}),
      ...variableMappings,
    };

    onImportComplete(validItems, columnMapping);
  };

  const previewRows = useMemo(() => {
    return parsedFile ? parsedFile.rows.slice(0, 5) : [];
  }, [parsedFile]);

  return (
    <div className={cn('w-full flex flex-col gap-4', className)}>
      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition-all duration-200"
        >
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {!parsedFile ? (
        /* Upload & Dropzone View */
        <div className="flex flex-col gap-3">
          <div
            data-testid="spreadsheet-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all duration-200 text-center',
              isDragging
                ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[0.99]'
                : 'border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/30'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" aria-hidden="true" />
            </div>

            <p className="text-sm font-semibold text-foreground">
              Drag & drop your Excel (.xlsx, .xls) or CSV file here, or browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports .xlsx, .xls, .csv up to 5MB
            </p>

            <input
              ref={fileInputRef}
              type="file"
              id="spreadsheet-file-input"
              aria-label="Spreadsheet file input"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={handleFileInputChange}
              className="sr-only"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'mt-4 min-h-[44px] px-5 py-2.5 inline-flex items-center gap-2 text-xs font-semibold rounded-lg',
                'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
                'active:scale-[0.97] transition-all duration-200'
              )}
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              Browse File
            </button>
          </div>

          {onCancel && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className={cn(
                  'min-h-[44px] px-4 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground',
                  'hover:bg-muted/60 border border-border/60 active:scale-[0.97] transition-all duration-200'
                )}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Parsed File View: Mapping, Metrics & Preview Table */
        <div className="flex flex-col gap-4">
          {/* File Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border/70 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground break-all">
                  {parsedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(parsedFile.size)} • {totalRows}{' '}
                  {totalRows === 1 ? 'row' : 'rows'} detected
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetState}
              className={cn(
                'min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg',
                'text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/70',
                'active:scale-[0.97] transition-all duration-200'
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Change File
            </button>
          </div>

          {/* Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                'bg-muted text-foreground border border-border'
              )}
            >
              <Layers className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              {totalRows} {totalRows === 1 ? 'Total Row' : 'Total Rows'}
            </span>

            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {validCount} Valid
            </span>

            {invalidCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                {invalidCount} Invalid
              </span>
            )}

            {duplicateCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                )}
              >
                {duplicateCount} {duplicateCount === 1 ? 'Duplicate' : 'Duplicates'}
              </span>
            )}
          </div>

          {/* Column Mapping Section */}
          <div className="p-4 rounded-xl border border-border/80 bg-background/60 flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Column Mapping
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Target Column */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="target-column-select"
                  className="text-xs font-medium text-foreground flex items-center justify-between"
                >
                  <span>
                    Target Column ({channel === 'email' ? 'Email' : 'Phone'}){' '}
                    <span className="text-rose-500">*</span>
                  </span>
                  {targetColumn && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                      Auto-detected
                    </span>
                  )}
                </label>
                <select
                  id="target-column-select"
                  aria-label="Target column"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  className={cn(
                    'w-full min-h-[44px] px-3 py-2 text-sm rounded-lg border border-input bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all duration-200'
                  )}
                >
                  <option value="">-- Select Target Column --</option>
                  {parsedFile.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name Column (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="name-column-select"
                  className="text-xs font-medium text-foreground flex items-center justify-between"
                >
                  <span>Contact Name Column (Optional)</span>
                  {nameColumn && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                      Auto-detected
                    </span>
                  )}
                </label>
                <select
                  id="name-column-select"
                  aria-label="Name column"
                  value={nameColumn}
                  onChange={(e) => setNameColumn(e.target.value)}
                  className={cn(
                    'w-full min-h-[44px] px-3 py-2 text-sm rounded-lg border border-input bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all duration-200'
                  )}
                >
                  <option value="">-- Do Not Map Name --</option>
                  {parsedFile.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Variables Mapping */}
            {declaredVariables.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border/60 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">
                    Template Variable Mappings
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Map dynamic fields found in your message template
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {declaredVariables.map((varName) => (
                    <div key={varName} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`var-mapping-${varName}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Variable: <span className="font-mono text-foreground font-semibold">`{varName}`</span>
                      </label>
                      <select
                        id={`var-mapping-${varName}`}
                        aria-label={`Map variable: ${varName}`}
                        value={variableMappings[varName] || ''}
                        onChange={(e) =>
                          setVariableMappings((prev) => ({
                            ...prev,
                            [varName]: e.target.value,
                          }))
                        }
                        className={cn(
                          'w-full min-h-[44px] px-3 py-2 text-sm rounded-lg border border-input bg-background',
                          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-all duration-200'
                        )}
                      >
                        <option value="">-- Unmapped --</option>
                        {parsedFile.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <TableIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Spreadsheet Preview (First 5 Rows)
              </span>
              <span>Showing {previewRows.length} sample rows</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/80 bg-background/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[11px] font-semibold">
                  <tr>
                    <th scope="col" className="px-3.5 py-2.5 w-12 text-center">
                      #
                    </th>
                    {parsedFile.columns.map((col) => {
                      const isTarget = col === targetColumn;
                      const isName = col === nameColumn;
                      const mappedVar = Object.entries(variableMappings).find(
                        ([, mappedCol]) => mappedCol === col
                      )?.[0];

                      return (
                        <th key={col} scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{col}</span>
                            {isTarget && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Target
                              </span>
                            )}
                            {isName && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                Name
                              </span>
                            )}
                            {mappedVar && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border border-violet-300 dark:border-violet-800 font-mono">
                                Var: {mappedVar}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3.5 py-2 text-center text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      {parsedFile.columns.map((col) => (
                        <td
                          key={col}
                          className="px-3.5 py-2 whitespace-nowrap font-medium text-foreground select-text"
                        >
                          {row[col] || (
                            <span className="text-muted-foreground/40 italic">empty</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className={cn(
                    'min-h-[44px] px-4 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground',
                    'hover:bg-muted/60 border border-border/60 active:scale-[0.97] transition-all duration-200'
                  )}
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={validCount === 0 || !targetColumn}
              className={cn(
                'min-h-[44px] px-6 py-2.5 inline-flex items-center gap-2 text-xs font-semibold rounded-lg',
                'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:pointer-events-none'
              )}
            >
              <span>Import {validCount} {validCount === 1 ? 'Contact' : 'Contacts'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
