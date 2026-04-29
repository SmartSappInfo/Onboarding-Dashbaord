'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, 
    FileText, 
    CheckCircle2, 
    X, 
    Loader2, 
    Database, 
    ArrowLeft, 
    AlertCircle,
    Table as TableIcon,
    RefreshCw,
    Wand2,
    Check,
    Pencil,
    MapPin,
    Info,
    ArrowRight,
    Download,
    Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { suggestBulkMapping } from '@/ai/flows/bulk-mapping-flow';
import { ingestBatchAction, type BatchResult } from '@/lib/bulk-upload-actions';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { useTerminology } from '@/hooks/use-terminology';
import { useWorkspace } from '@/context/WorkspaceContext';

type Step = 'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'EXECUTING' | 'COMPLETE' | 'CORRECTION';

/** Sample data for each entity type */
const SAMPLE_ROWS: Record<string, string[]> = {
    institution: [
        "Ghana International School", "GIS", "Understanding of each other.", "Cantonments Accra", 
        "Airport / Legon Zone", "1500", "Default Admin", "Level A (Platinum)", 
        "Billing Security Attendance", "2024-09-01", "Referral", "Yes", 
        "Dr. Mary Ashun", "principal@gis.edu.gh", "+233302777163", "Principal", 
        "Yes", "P.O. Box 845 Accra", "GHS", "89.95", "0", "0", "0"
    ],
    person: [
        "John Doe", "john@example.com", "+1234567890",
        "Acme Corp", "Sales Manager", "Website", "Onboarding"
    ],
    family: [
        "Smith Family", "Jane Smith", "+1234567890", "jane@example.com",
        "Mother", "Emma", "Smith", "Grade 5", "Referral", "Onboarding"
    ],
};

/**
 * @fileOverview Entity Import Engine — scope-aware bulk upload.
 * Uses AI for field mapping and logical functions for data importing.
 */
export default function BulkUploadClient() {
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const terms = useTerminology();
    const { activeWorkspace } = useWorkspace();
    const firestore = useFirestore();
    const contactScope = activeWorkspace?.contactScope || 'institution';

    // Fetch dynamic fields from the registry
    const fieldsQuery = React.useMemo(() => 
        firestore && activeWorkspace?.id 
            ? query(collection(firestore, 'app_fields'), where('workspaceId', '==', activeWorkspace.id), where('status', '==', 'active'))
            : null,
    [firestore, activeWorkspace?.id]);
    const { data: registryFields } = useCollection<any>(fieldsQuery);

    const TARGET_FIELDS = React.useMemo(() => {
        if (!registryFields) return [];
        // Map registry fields to the format expected by the uploader
        return registryFields
            .filter(f => !f.compatibilityScope || f.compatibilityScope.includes(contactScope) || f.compatibilityScope.includes('common'))
            .map(f => ({
                key: f.variableName,
                label: f.label,
                required: f.variableName === 'name' || f.variableName === 'school_name' || f.variableName === 'company_name'
            }));
    }, [registryFields, contactScope]);

    const [currentStep, setCurrentStep] = React.useState<Step>('UPLOAD');
    const [fileName, setFileName] = React.useState('');
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [rawData, setRawData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [isAiMapping, setIsAiMapping] = React.useState(false);
    
    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);
    const [executionResults, setExecutionResults] = React.useState<{ row: number; status: 'success' | 'error'; entityName?: string; error?: string }[]>([]);
    const [currentRowIdx, setCurrentRowIdx] = React.useState(0);
    const [failedRowIndices, setFailedRowIndices] = React.useState<number[]>([]);

    const handleDownloadTemplate = () => {
        const templateHeaders = TARGET_FIELDS.map(f => f.label);
        const sampleRow = SAMPLE_ROWS[contactScope] || SAMPLE_ROWS.institution;

        const csvContent = templateHeaders.map(h => `"${h}"`).join(",") + "\n" + sampleRow.map(v => `"${v}"`).join(",") + "\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const wsName = (activeWorkspace?.name || 'SmartSapp').replace(/\s+/g, '_');
        link.setAttribute("download", `${wsName}_${terms.singular}_Import_Template.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const extension = file.name.split('.').pop()?.toLowerCase();

        const processResults = (data: any[]) => {
            if (data.length > 0) {
                const h = Object.keys(data[0] as object);
                setHeaders(h);
                
                // Keep ALL rows including the sample row — don't filter out template data
                setRawData(data);
                
                // DETECT STANDARD HEADERS
                const matches = TARGET_FIELDS.filter(f => h.includes(f.label));
                if (matches.length > (TARGET_FIELDS.length / 2)) {
                    const autoMap: Record<string, string> = {};
                    TARGET_FIELDS.forEach(f => { if (h.includes(f.label)) autoMap[f.key] = f.label; });
                    setMapping(autoMap);
                    setCurrentStep('MAPPING');
                    toast({ title: 'Standard Template Recognized', description: 'Headers mapped automatically.' });
                } else {
                    triggerAiMapping(h, data.slice(0, 3));
                }
            }
        };

        if (extension === 'csv') {
             Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => processResults(res.data) });
        } else {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target?.result as string, { type: 'binary' });
                processResults(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
            };
            reader.readAsBinaryString(file);
        }
    };

    const triggerAiMapping = async (fileHeaders: string[], samples: any[]) => {
        setCurrentStep('MAPPING');
        setIsAiMapping(true);
        try {
            const sanitizedHeaders = JSON.parse(JSON.stringify(fileHeaders));
            const sanitizedSamples = JSON.parse(JSON.stringify(samples));

            const result = await suggestBulkMapping({ 
                headers: sanitizedHeaders, 
                sampleRows: sanitizedSamples 
            });
            setMapping(result.mapping as any);
            toast({ title: 'AI Mapping Success' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Mapping Failed' });
        } finally {
            setIsAiMapping(false);
        }
    };

    const startExecution = async (indicesToProcess?: number[]) => {
        if (!user || !activeWorkspace?.id) return;
        const rowsToProcess = indicesToProcess 
            ? indicesToProcess.map(i => rawData[i])
            : rawData;
        
        setCurrentStep('EXECUTING');
        setExecutionResults([]);

        try {
            const sanitizedRows = JSON.parse(JSON.stringify(rowsToProcess));
            const sanitizedMapping = JSON.parse(JSON.stringify(mapping));

            const batch = await ingestBatchAction(
                sanitizedRows,
                sanitizedMapping,
                user.uid,
                fileName,
                activeWorkspace.id,
                activeWorkspace.organizationId || 'smartsapp-hq',
                contactScope
            );

            setExecutionResults(batch.results);
            setFailedRowIndices(batch.results.filter(r => r.status === 'error').map(r => r.row));
        } catch (e: any) {
            setExecutionResults([{ row: 0, status: 'error', error: e.message }]);
            setFailedRowIndices([0]);
        }

        setCurrentStep('COMPLETE');
    };

    const handleUpdateRow = (idx: number, updated: any) => {
        const next = [...rawData];
        next[idx] = updated;
        setRawData(next);
        setEditingRowIdx(null);
        toast({ 
            title: 'Record Corrected', 
            description: `Modifications applied to row #${idx + 1}.` 
        });
    };

    const progress = rawData.length > 0 ? Math.round((executionResults.length / rawData.length) * 100) : 0;
    const stepTransition = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { type: 'spring' as const, damping: 25, stiffness: 200 } };

    return (
        <div className="h-full overflow-y-auto text-left">
            <div className="space-y-8">
                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" {...stepTransition}>
                            <div className="flex justify-end mb-6">
                                <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 rounded-xl font-bold">
                                    <Download size={16} /> {terms.singular} Template
                                </Button>
                            </div>
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <CardHeader className="text-center py-16 bg-card/20 border-b">
                                    <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl">
                                        <Upload className="h-10 w-10 text-primary" />
                                    </div>
                                    <CardTitle className="text-4xl font-semibold tracking-tight">
                                        {terms.singular} Import
                                    </CardTitle>
                                    <CardDescription className="text-lg font-medium max-w-md mx-auto mt-4">
                                        Automate {terms.singular.toLowerCase()} onboarding by mapping spreadsheet data directly to our database.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-12">
                                    <label htmlFor="bulk-file" className="w-full max-w-xl mx-auto block cursor-pointer">
                                        <div className="border-4 border-dashed border-border/20 rounded-[2.5rem] p-16 text-center transition-all hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center gap-6">
                                            <div className="p-6 bg-card rounded-3xl shadow-xl border border-border/50">
                                                <FileText size={48} className="text-primary" />
                                            </div>
                                            <p className="text-xl font-semibold">Drop Document Here</p>
                                            <Input id="bulk-file" type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                                        </div>
                                    </label>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'MAPPING' && (
                        <motion.div key="mapping" {...stepTransition}>
                            <div className="flex items-center justify-between mb-8">
                                <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="font-bold gap-2">
                                    <ArrowLeft size={16} /> Change File
                                </Button>
                                <Badge className="bg-primary px-4 h-8 uppercase font-semibold">
                                    {rawData.length} {rawData.length === 1 ? terms.singular : terms.plural} Identified
                                </Badge>
                            </div>
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <CardHeader className="bg-card/20 border-b p-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                            <TableIcon size={24} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl font-semibold">Schema Correlation</CardTitle>
                                            <CardDescription className="text-xs font-bold opacity-60">
                                                Map columns to {terms.singular.toLowerCase()} system fields.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {TARGET_FIELDS.map((field) => (
                                        <div key={field.key} className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">
                                                {field.label} {field.required && '*'}
                                            </Label>
                                            <Select value={mapping[field.key] || 'none'} onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}>
                                                <SelectTrigger className="h-12 rounded-xl bg-background/50 border-none shadow-inner font-bold">
                                                    <SelectValue placeholder="Ignore field" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="none">-- Ignore --</SelectItem>
                                                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </CardContent>
                                <CardFooter className="bg-primary/5 p-10 border-t flex flex-col gap-6">
                                    {/* Workspace Context Banner */}
                                    <div className="w-full p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-xl"><Database size={18} className="text-primary" /></div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Target Workspace</p>
                                            <p className="text-sm font-semibold">{activeWorkspace?.name || 'Unknown'} · <span className="text-muted-foreground capitalize">{contactScope}</span></p>
                                        </div>
                                    </div>
                                    {rawData.length > 500 && (
                                        <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
                                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                            <p className="text-[10px] text-amber-700 font-bold">Large dataset detected ({rawData.length} rows). Import may take a few minutes.</p>
                                        </div>
                                    )}
                                    {contactScope === 'institution' && (
                                        <div className="w-full p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-4">
                                            <Zap size={18} className="text-blue-500 mt-0.5 shrink-0" />
                                            <p className="text-[10px] text-blue-700 font-bold opacity-80 leading-relaxed">
                                                Zones, Managers, and Packages will be fuzzy-matched from your data during import.
                                            </p>
                                        </div>
                                    )}
                                    <Button onClick={() => setCurrentStep('PREVIEW')} disabled={!mapping['name'] || !activeWorkspace?.id} className="w-full h-16 rounded-[1.5rem] font-semibold text-xl shadow-2xl bg-primary text-white gap-3">
                                        <ArrowRight size={24} /> Preview & Confirm
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── PREVIEW STEP ─── */}
                    {currentStep === 'PREVIEW' && (
                        <motion.div key="preview" {...stepTransition}>
                            <div className="flex items-center justify-between mb-8">
                                <Button variant="ghost" onClick={() => setCurrentStep('MAPPING')} className="font-bold gap-2">
                                    <ArrowLeft size={16} /> Adjust Mapping
                                </Button>
                                <Badge variant="outline" className="px-4 h-8 font-semibold">{rawData.length} rows ready</Badge>
                            </div>
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <CardHeader className="bg-card/20 border-b p-8">
                                    <CardTitle className="text-2xl font-semibold">Data Preview</CardTitle>
                                    <CardDescription className="text-xs font-bold opacity-60">
                                        Showing first {Math.min(rawData.length, 5)} of {rawData.length} rows. Verify mapped values before importing.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        <Table>
                                            <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="pl-6 py-3 text-[10px] font-bold w-12">#</TableHead>
                                                    {TARGET_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== 'none').map(f => (
                                                        <TableHead key={f.key} className="py-3 text-[10px] font-bold">{f.label}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rawData.slice(0, 5).map((row, i) => (
                                                    <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                                                        <TableCell className="pl-6 font-semibold text-xs text-muted-foreground">{i + 1}</TableCell>
                                                        {TARGET_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== 'none').map(f => (
                                                            <TableCell key={f.key} className="text-xs font-medium max-w-[200px] truncate">
                                                                {String(row[mapping[f.key]] || '—')}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                                <CardFooter className="p-8 border-t bg-primary/5 flex flex-col gap-4">
                                    <Button onClick={() => startExecution()} className="w-full h-16 rounded-[1.5rem] font-semibold text-xl shadow-2xl bg-primary text-white gap-3">
                                        <Zap size={24} /> Import {rawData.length} {terms.plural}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'EXECUTING' && (
                        <motion.div key="executing" className="flex flex-col items-center justify-center py-20 gap-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                                <Loader2 className="h-20 w-20 animate-spin text-primary relative" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-3xl font-semibold">Processing Import</h2>
                                <p className="mt-3 text-muted-foreground font-bold">
                                    Importing {rawData.length} {terms.plural.toLowerCase()} into {activeWorkspace?.name || 'workspace'}…
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 'COMPLETE' && (
                        <motion.div key="complete" className="space-y-8">
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <CardHeader className={cn("py-12 text-center", failedRowIndices.length === 0 ? "bg-emerald-500/10" : "bg-orange-500/10")}>
                                    <div className="mx-auto w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl bg-card">
                                        {failedRowIndices.length === 0
                                            ? <CheckCircle2 size={40} className="text-emerald-500" />
                                            : <AlertCircle size={40} className="text-orange-500" />
                                        }
                                    </div>
                                    <CardTitle className="text-3xl font-semibold">Import Complete</CardTitle>
                                </CardHeader>
                                <CardContent className="p-10">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-6 mb-10">
                                        <div className="text-center p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                            <p className="text-3xl font-bold text-emerald-600">{executionResults.filter(r => r.status === 'success').length}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">Created</p>
                                        </div>
                                        <div className="text-center p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                                            <p className="text-3xl font-bold text-rose-600">{failedRowIndices.length}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">Failed</p>
                                        </div>
                                        <div className="text-center p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                            <p className="text-3xl font-bold text-primary">{rawData.length > 0 ? Math.round((executionResults.filter(r => r.status === 'success').length / rawData.length) * 100) : 0}%</p>
                                            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">Success Rate</p>
                                        </div>
                                    </div>
                                    {/* Error Detail List */}
                                    {failedRowIndices.length > 0 && (
                                        <div className="mb-8 rounded-2xl border border-rose-200/50 overflow-hidden">
                                            <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-200/50">
                                                <p className="text-xs font-bold text-rose-700">Failed Rows — {failedRowIndices.length} issue{failedRowIndices.length > 1 ? 's' : ''}</p>
                                            </div>
                                            <ScrollArea className="max-h-[200px]">
                                                {executionResults.filter(r => r.status === 'error').map(r => (
                                                    <div key={r.row} className="px-6 py-3 border-b border-rose-100 last:border-0 flex items-center gap-3">
                                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-none text-[9px] shrink-0">Row {r.row + 1}</Badge>
                                                        <p className="text-xs text-rose-700 truncate">{r.error}</p>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    )}
                                    <div className="flex gap-4">
                                        {failedRowIndices.length > 0 && (
                                            <Button onClick={() => setCurrentStep('CORRECTION')} variant="outline" className="flex-1 h-14 rounded-xl font-semibold gap-2 border-orange-200 text-orange-600 hover:bg-orange-50">
                                                <Pencil size={16} /> Fix & Retry
                                            </Button>
                                        )}
                                        <Button onClick={() => router.push('/admin/entities')} className="flex-1 h-14 rounded-xl font-semibold shadow-xl gap-2">
                                            Open Directory <ArrowRight size={16} />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'CORRECTION' && (
                        <motion.div key="correction" className="space-y-8">
                            <div className="flex items-center justify-between mb-8">
                                <Button variant="ghost" onClick={() => setCurrentStep('COMPLETE')} className="font-bold gap-2">
                                    <ArrowLeft size={16} /> Summary
                                </Button>
                                <h2 className="text-2xl font-semibold text-rose-600">Correction Console</h2>
                            </div>
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <ScrollArea className="h-[500px]">
                                    <Table>
                                        <TableHeader className="bg-card/20 sticky top-0 z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="pl-8 py-4 font-semibold text-[10px]">Row</TableHead>
                                                <TableHead className="py-4 font-semibold text-[10px]">{terms.singular}</TableHead>
                                                <TableHead className="py-4 font-semibold text-[10px]">Error</TableHead>
                                                <TableHead className="text-right pr-8 font-semibold text-[10px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {failedRowIndices.map(idx => (
                                                <TableRow key={idx} className="group hover:bg-rose-50/30 transition-colors">
                                                    <TableCell className="pl-8 font-semibold text-xs">#{idx + 1}</TableCell>
                                                    <TableCell className="font-bold text-xs">{rawData[idx][mapping['name']] || 'Untitled'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-none text-[10px]">
                                                            {executionResults.find(r => r.row === idx)?.error || 'Logic Error'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-4">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingRowIdx(idx)} className="h-8 w-8 text-rose-600">
                                                            <Pencil size={14} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setFailedRowIndices(p => p.filter(i => i !== idx))} className="h-8 w-8 text-muted-foreground">
                                                            <X size={14} />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                                <CardFooter className="bg-rose-500/10 p-8 border-t">
                                    <Button onClick={() => startExecution(failedRowIndices)} disabled={failedRowIndices.length === 0} className="w-full h-14 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold gap-2 shadow-lg">
                                        <RefreshCw size={16} /> Re-Execute Failures
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <RowEditorDialog open={editingRowIdx !== null} onOpenChange={(o) => !o && setEditingRowIdx(null)} rowIndex={editingRowIdx || 0} data={editingRowIdx !== null ? rawData[editingRowIdx] : {}} onSave={handleUpdateRow} />
        </div>
    );
}

function RowEditorDialog({ open, onOpenChange, rowIndex, data, onSave }: { open: boolean, onOpenChange: (o: boolean) => void, rowIndex: number, data: any, onSave: (idx: number, updated: any) => void }) {
    const [localData, setLocalData] = React.useState<any>(data);
    React.useEffect(() => { if (open) setLocalData(data); }, [open, data]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card">
                <DialogHeader className="p-8 bg-card/20 border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary text-white rounded-xl shadow-lg"><Pencil size={24} /></div>
                        <div className="text-left">
                            <DialogTitle className="text-xl font-semibold">Edit Record</DialogTitle>
                            <DialogDescription className="text-xs font-bold opacity-60">Manual Correction for Row #{rowIndex + 1}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-[400px]">
                        <div className="p-8 space-y-6">
                            {Object.entries(localData).map(([key, val]) => (
                                <div key={key} className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{key}</Label>
                                    <Input value={String(val || '')} onChange={e => setLocalData((p: any) => ({ ...p, [key]: e.target.value }))} className="h-11 rounded-xl bg-background/50 border-none font-bold shadow-inner" />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 bg-card/20 border-t flex justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
                    <Button onClick={() => onSave(rowIndex, localData)} className="rounded-xl font-semibold px-8 shadow-xl bg-primary text-white text-xs">Apply Corrections</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
