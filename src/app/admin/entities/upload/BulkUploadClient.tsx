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
    Sparkles, 
    Database, 
    ChevronRight, 
    ArrowLeft, 
    ShieldCheck, 
    AlertCircle,
    Building,
    Target,
    Layers,
    Table as TableIcon,
    RefreshCw,
    AlertTriangle,
    Wand2,
    Check,
    Eye,
    Pencil,
    User,
    BadgePercent,
    MapPin,
    Trash2,
    Info,
    ArrowRight,
    Save,
    Download,
    Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { suggestBulkMapping } from '@/ai/flows/bulk-mapping-flow';
import { ingestSchoolRowAction } from '@/lib/bulk-upload-actions';
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
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

type Step = 'UPLOAD' | 'MAPPING' | 'EXECUTING' | 'COMPLETE' | 'CORRECTION';

const TARGET_FIELDS = [
    { key: 'name', label: 'School Name', required: true },
    { key: 'initials', label: 'Initials/Acronym' },
    { key: 'slogan', label: 'Motto/Slogan' },
    { key: 'location', label: 'Physical Location' },
    { key: 'zone', label: 'Regional Zone' },
    { key: 'nominalRoll', label: 'Student Roll' },
    { key: 'assignedTo', label: 'Account Manager' },
    { key: 'package', label: 'Subscription Tier' },
    { key: 'modules', label: 'Requested Modules' },
    { key: 'implementationDate', label: 'Go-Live Date' },
    { key: 'referee', label: 'Referral Source' },
    { key: 'includeDroneFootage', label: 'Drone Footage' },
    { key: 'contactName', label: 'Primary Contact' },
    { key: 'contactEmail', label: 'Contact Email' },
    { key: 'contactPhone', label: 'Contact Phone' },
    { key: 'contactRole', label: 'Contact Role' },
    { key: 'isSignatory', label: 'Is Signatory' },
    { key: 'billingAddress', label: 'Billing Address' },
    { key: 'currency', label: 'Currency' },
    { key: 'subscriptionRate', label: 'Effective Rate' },
    { key: 'discountPercentage', label: 'Discount %' },
    { key: 'arrearsBalance', label: 'Initial Arrears' },
    { key: 'creditBalance', label: 'Initial Credit' },
];

/**
 * @fileOverview Institutional Import Engine.
 * Uses AI for field mapping and logical functions for data importing.
 */
export default function BulkUploadClient() {
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();

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
        const sampleRow = [
            "Ghana International School", "GIS", "Understanding of each other.", "Cantonments, Accra", 
            "Airport / Legon Zone", "1500", "Default Admin", "Level A (Platinum)", 
            "Billing, Security, Attendance", "2024-09-01", "Referral", "Yes", 
            "Dr. Mary Ashun", "principal@gis.edu.gh", "+233302777163", "Principal", 
            "Yes", "P.O. Box 845, Accra", "GHS", "89.95", "0", "0", "0"
        ];

        const csvContent = templateHeaders.map(h => `"${h}"`).join(",") + "\n" + sampleRow.map(v => `"${v}"`).join(",") + "\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "SmartSapp_Import_Template.csv");
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
                
                // Filter out the template example row if present
                const actualData = data.filter(row => {
                    const firstVal = String(row[h[0]] || '').toLowerCase();
                    return !firstVal.includes('ghana international school');
                });

                setRawData(actualData);
                
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
            // Data sanitization for server function
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
        if (!user) return;
        const rowsToProcess = indicesToProcess || Array.from({ length: rawData.length }, (_, i) => i);
        
        setCurrentStep('EXECUTING');
        setExecutionResults([]);
        const freshFailedIndices: number[] = [];

        for (let i = 0; i < rowsToProcess.length; i++) {
            const actualIdx = rowsToProcess[i];
            setCurrentRowIdx(i);
            try {
                // Ensure data is plain object
                const sanitizedRow = JSON.parse(JSON.stringify(rawData[actualIdx]));
                const sanitizedMapping = JSON.parse(JSON.stringify(mapping));

                const res = await ingestSchoolRowAction(
                    sanitizedRow, 
                    sanitizedMapping, 
                    user.uid, 
                    fileName
                );
                if (res.success) {
                    setExecutionResults(p => [...p, { row: actualIdx, status: 'success', entityName: res.entityName }]);
                } else {
                    freshFailedIndices.push(actualIdx);
                    setExecutionResults(p => [...p, { row: actualIdx, status: 'error', error: res.error }]);
                }
            } catch (e: any) {
                freshFailedIndices.push(actualIdx);
                setExecutionResults(p => [...p, { row: actualIdx, status: 'error', error: e.message }]);
            }
        }
        setFailedRowIndices(freshFailedIndices);
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
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-8">
                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" {...stepTransition}>
                            <div className="flex justify-end mb-6"><Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 rounded-xl font-bold"><Download size={16} /> Template</Button></div>
                            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="text-center py-16 bg-muted/30 border-b">
                                    <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl"><Upload className="h-10 w-10 text-primary" /></div>
                                    <CardTitle className="text-4xl font-black tracking-tight uppercase">Institutional Import</CardTitle>
                                    <CardDescription className="text-lg font-medium max-w-md mx-auto mt-4">Automate school onboarding by mapping spreadsheet data directly to our database.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-12">
                                    <label htmlFor="bulk-file" className="w-full max-w-xl mx-auto block cursor-pointer">
                                        <div className="border-4 border-dashed border-muted-foreground/10 rounded-[2.5rem] p-16 text-center transition-all hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center gap-6">
                                            <div className="p-6 bg-white rounded-3xl shadow-xl border"><FileText size={48} className="text-primary" /></div>
                                            <p className="text-xl font-black uppercase">Drop Document Here</p>
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
                                <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="font-bold gap-2"><ArrowLeft size={16} /> Change File</Button>
                                <Badge className="bg-primary px-4 h-8 uppercase font-black">{rawData.length} Schools Identified</Badge>
                            </div>
                            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-muted/30 border-b p-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><TableIcon size={24} /></div>
                                        <div><CardTitle className="text-2xl font-black uppercase">Schema Correlation</CardTitle><CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Map columns to institutional system fields.</CardDescription></div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    {TARGET_FIELDS.map((field) => (
                                        <div key={field.key} className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{field.label} {field.required && '*'}</Label>
                                            <Select value={mapping[field.key] || 'none'} onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}>
                                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold"><SelectValue placeholder="Ignore field" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="none">-- Ignore --</SelectItem>
                                                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </CardContent>
                                <CardFooter className="bg-primary/5 p-10 border-t flex flex-col gap-6">
                                    <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-5 shadow-inner">
                                        <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm border border-blue-100"><Zap size={24} /></div>
                                        <p className="text-[10px] text-blue-700 font-bold uppercase tracking-widest opacity-80 leading-relaxed">Systematic logic will resolve your Regional Zones and Managers using deterministic matching during import.</p>
                                    </div>
                                    <Button onClick={() => startExecution()} disabled={!mapping['name']} className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-2xl bg-primary text-white uppercase tracking-widest gap-3"><Zap size={24} /> Launch Hub Import</Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'EXECUTING' && (
                        <motion.div key="executing" className="text-center py-20"><Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-8" /><h2 className="text-4xl font-black uppercase">Task Execution</h2><p className="mt-4 text-muted-foreground font-bold">{currentRowIdx + 1} of {rawData.length} Hubs Synchronized</p><div className="max-w-2xl mx-auto mt-8"><Progress value={progress} className="h-2" /></div></motion.div>
                    )}

                    {currentStep === 'COMPLETE' && (
                        <motion.div key="complete" className="space-y-8">
                            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white text-center">
                                <CardHeader className={cn("py-16 text-white", failedRowIndices.length === 0 ? "bg-emerald-50" : "bg-orange-50")}>
                                    <div className="mx-auto bg-white/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl"><Check size={48} /></div>
                                    <CardTitle className="text-4xl font-black uppercase">Import Report</CardTitle>
                                    <p className="text-base font-bold uppercase tracking-widest mt-4">{executionResults.filter(r => r.status === 'success').length} Records Synchronized</p>
                                </CardHeader>
                                <CardContent className="p-12">
                                    <div className="flex justify-between max-w-3xl mx-auto border-b pb-8 mb-8 text-left">
                                        <div><p className="text-sm font-black uppercase text-muted-foreground mb-1">Success Rate</p><p className="text-4xl font-black text-emerald-600">{rawData.length > 0 ? Math.round((executionResults.filter(r => r.status === 'success').length / rawData.length) * 100) : 0}%</p></div>
                                        {failedRowIndices.length > 0 && <Button onClick={() => setCurrentStep('CORRECTION')} variant="outline" className="h-14 px-8 rounded-xl font-black uppercase tracking-widest text-xs gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"><AlertCircle size={16} /> Manage {failedRowIndices.length} Failures</Button>}
                                    </div>
                                    <Button onClick={() => router.push('/admin/entities')} className="h-16 px-16 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl">Open Directory <ArrowRight className="ml-2" /></Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'CORRECTION' && (
                        <motion.div key="correction" className="space-y-8">
                            <div className="flex items-center justify-between mb-8"><Button variant="ghost" onClick={() => setCurrentStep('COMPLETE')} className="font-bold gap-2"><ArrowLeft size={16} /> Summary</Button><h2 className="text-2xl font-black uppercase text-rose-600">Correction Console</h2></div>
                            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <ScrollArea className="h-[500px]">
                                    <Table>
                                        <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm"><TableRow><TableHead className="pl-8 py-4 uppercase font-black text-[10px]">Row</TableHead><TableHead className="py-4 uppercase font-black text-[10px]">Identity</TableHead><TableHead className="py-4 uppercase font-black text-[10px]">Logic Failure</TableHead><TableHead className="text-right pr-8 uppercase font-black text-[10px]">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {failedRowIndices.map(idx => (
                                                <TableRow key={idx} className="group hover:bg-rose-50/30 transition-colors">
                                                    <TableCell className="pl-8 font-black text-xs">#{idx + 1}</TableCell>
                                                    <TableCell className="font-bold text-xs">{rawData[idx][mapping['name']] || 'Untitled'}</TableCell>
                                                    <TableCell><Badge variant="outline" className="bg-rose-50 text-rose-600 border-none text-[10px]">{executionResults.find(r => r.row === idx)?.error || 'Logic Error'}</Badge></TableCell>
                                                    <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-4">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingRowIdx(idx)} className="h-8 w-8 text-rose-600"><Pencil size={14} /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setFailedRowIndices(p => p.filter(i => i !== idx))} className="h-8 w-8 text-muted-foreground"><X size={14} /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                                <CardFooter className="bg-rose-50 p-8 border-t"><Button onClick={() => startExecution(failedRowIndices)} disabled={failedRowIndices.length === 0} className="w-full h-14 rounded-xl bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-widest gap-2 shadow-lg"><RefreshCw size={16} /> Re-Execute Failures</Button></CardFooter>
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
            <DialogContent className="sm:max-w-xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary text-white rounded-xl shadow-lg"><Pencil size={24} /></div>
                        <div className="text-left"><DialogTitle className="text-xl font-black uppercase">Edit Record</DialogTitle><DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Manual Correction for Row #{rowIndex + 1}</DialogDescription></div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden"><ScrollArea className="h-[400px]"><div className="p-8 space-y-6">{Object.entries(localData).map(([key, val]) => (<div key={key} className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{key}</Label><Input value={String(val || '')} onChange={e => setLocalData((p: any) => ({ ...p, [key]: e.target.value }))} className="h-11 rounded-xl bg-muted/20 border-none font-bold" /></div>))}</div></ScrollArea></div>
                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between"><Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button><Button onClick={() => onSave(rowIndex, localData)} className="rounded-xl font-black px-8 shadow-xl bg-primary text-white uppercase text-xs tracking-widest">Apply Corrections</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
