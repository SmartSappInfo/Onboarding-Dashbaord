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
import type { Zone, UserProfile, SubscriptionPackage, Module } from '@/lib/types';

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
    // Financial Profile Extensions
    { key: 'billingAddress', label: 'Billing Address' },
    { key: 'currency', label: 'Currency' },
    { key: 'subscriptionRate', label: 'Effective Rate' },
    { key: 'discountPercentage', label: 'Discount %' },
    { key: 'arrearsBalance', label: 'Initial Arrears' },
    { key: 'creditBalance', label: 'Initial Credit' },
];

export default function BulkUploadClient() {
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // State Machine
    const [currentStep, setCurrentStep] = React.useState<Step>('UPLOAD');
    const [fileName, setFileName] = React.useState('');
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [rawData, setRawData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [isAiMapping, setIsAiMapping] = React.useState(false);
    
    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);

    // Execution State
    const [executionResults, setExecutionResults] = React.useState<{ row: number; status: 'success' | 'error'; schoolName?: string; error?: string }[]>([]);
    const [currentRowIdx, setCurrentRowIdx] = React.useState(0);
    const [failedRowIndices, setFailedRowIndices] = React.useState<number[]>([]);

    // Context for Normalization
    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true)) : null, [firestore]);
    const { data: users } = useCollection<UserProfile>(usersQuery);

    const handleDownloadTemplate = () => {
        const headers = [
            "School Name",
            "Initials",
            "Slogan",
            "Location",
            "Zone",
            "Nominal Roll",
            "Assigned Manager",
            "Subscription Tier",
            "Modules",
            "Implementation Date",
            "Referee",
            "Drone Footage",
            "Contact Name",
            "Contact Email",
            "Contact Phone",
            "Contact Role",
            "Is Signatory",
            "Billing Address",
            "Currency",
            "Effective Rate",
            "Discount Percentage",
            "Initial Arrears",
            "Initial Credit"
        ];

        const sampleRow = [
            "Ghana International School",
            "GIS",
            "Understanding of each other",
            "2nd Circular Rd, Cantonments, Accra",
            "Airport / Legon Zone",
            "1500",
            "Default Admin",
            "Level A (Platinum)",
            "Billing, Security, Attendance",
            "2024-09-01",
            "Old Student Referral",
            "Yes",
            "Dr. Mary Ashun",
            "principal@gis.edu.gh",
            "+233 30 277 7163",
            "Principal",
            "Yes",
            "P.O. Box 845, Accra",
            "GHS",
            "89.95",
            "0",
            "0",
            "0"
        ];

        // Ensure all values are quoted to prevent CSV splitting on embedded commas (e.g. in addresses)
        const csvContent = headers.join(",") + "\n" + sampleRow.map(v => `"${v}"`).join(",") + "\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "SmartSapp_School_Import_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Template Downloaded' });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const extension = file.name.split('.').pop()?.toLowerCase();

        const processResults = (data: any[]) => {
            if (data.length > 0) {
                // Filter out the sample row if it's identical to the GIS example
                const actualData = data.filter(row => row["School Name"] !== "Ghana International School");
                const h = Object.keys(data[0] as object);
                setHeaders(h);
                setRawData(actualData.length > 0 ? actualData : data);
                
                // Sanitize payload for Server Function transmission
                const sanitizedHeaders = JSON.parse(JSON.stringify(h));
                const sanitizedSamples = JSON.parse(JSON.stringify(data.slice(0, 3)));
                
                triggerAiMapping(sanitizedHeaders, sanitizedSamples);
            }
        };

        if (extension === 'csv') {
             Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processResults(results.data)
            });
        } else if (extension === 'xlsx' || extension === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result as string;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                processResults(data);
            };
            reader.readAsBinaryString(file);
        }
    };

    const triggerAiMapping = async (fileHeaders: string[], samples: any[]) => {
        setCurrentStep('MAPPING');
        setIsAiMapping(true);
        try {
            const result = await suggestBulkMapping({ headers: fileHeaders, sampleRows: samples });
            setMapping(result.mapping as any);
            toast({ title: 'AI Mapping Success', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Mapping Failed', description: 'Please map fields manually.' });
        } finally {
            setIsAiMapping(false);
        }
    };

    const startExecution = async (indicesToProcess?: number[]) => {
        if (!user) return;
        
        const rowsToProcess = indicesToProcess || Array.from({ length: rawData.length }, (_, i) => i);
        
        setCurrentStep('EXECUTING');
        setCurrentRowIdx(0);
        setExecutionResults([]);
        const freshFailedIndices: number[] = [];

        for (let i = 0; i < rowsToProcess.length; i++) {
            const actualIdx = rowsToProcess[i];
            setCurrentRowIdx(i);
            try {
                const sanitizedRawRow = JSON.parse(JSON.stringify(rawData[actualIdx]));
                const sanitizedMapping = JSON.parse(JSON.stringify(mapping));

                const result = await ingestSchoolRowAction(sanitizedRawRow, sanitizedMapping, user.uid, fileName);
                if (result.success) {
                    setExecutionResults(prev => [...prev, { row: actualIdx, status: 'success', schoolName: result.schoolName }]);
                } else {
                    freshFailedIndices.push(actualIdx);
                    setExecutionResults(prev => [...prev, { row: actualIdx, status: 'error', error: result.error }]);
                }
            } catch (e: any) {
                freshFailedIndices.push(actualIdx);
                setExecutionResults(prev => [...prev, { row: actualIdx, status: 'error', error: e.message }]);
            }
            await new Promise(r => setTimeout(r, 100));
        }

        setFailedRowIndices(freshFailedIndices);
        setCurrentStep('COMPLETE');
    };

    const handleUpdateRow = (idx: number, updatedData: any) => {
        const next = [...rawData];
        next[idx] = updatedData;
        setRawData(next);
        setEditingRowIdx(null);
        toast({ title: 'Row Protocol Updated' });
    };

    const handleDiscardRow = (idx: number) => {
        setRawData(prev => prev.filter((_, i) => i !== idx));
        toast({ title: 'Row Discarded' });
    };

    const successCount = executionResults.filter(r => r.status === 'success').length;
    const errorCount = executionResults.filter(r => r.status === 'error').length;
    const totalToProcess = rawData.length;
    const progress = totalToProcess > 0 ? Math.round((executionResults.length / totalToProcess) * 100) : 0;
    
    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" {...stepTransition}>
                            <div className="space-y-6">
                                <div className="flex justify-end">
                                    <Button variant="outline" onClick={handleDownloadTemplate} className="rounded-xl font-bold h-10 border-primary/20 text-primary gap-2">
                                        <Download className="h-4 w-4" /> Download Standard Template
                                    </Button>
                                </div>
                                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                                    <CardHeader className="text-center py-16 bg-muted/30 border-b relative">
                                        <div className="absolute top-0 left-0 p-8 opacity-5"><Layers size={120} /></div>
                                        <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-primary/5">
                                            <Upload className="h-10 w-10 text-primary" />
                                        </div>
                                        <CardTitle className="text-4xl font-black tracking-tight uppercase leading-none">Institutional Ingestion</CardTitle>
                                        <CardDescription className="text-lg font-medium max-w-md mx-auto mt-4">Automate school onboarding by mapping spreadsheet data directly to our regional database.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <label htmlFor="bulk-file" className="w-full max-w-xl group cursor-pointer">
                                                <div className="relative border-4 border-dashed border-muted-foreground/10 rounded-[2.5rem] p-16 text-center transition-all duration-500 group-hover:border-primary/40 group-hover:bg-primary/5 flex flex-col items-center gap-6">
                                                    <div className="p-6 bg-white rounded-3xl shadow-xl border group-hover:scale-110 transition-transform duration-500">
                                                        <FileText className="h-12 w-12 text-primary" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xl font-black uppercase tracking-tight">Drop Document Here</p>
                                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-60">Supports .CSV and .XLSX Formats</p>
                                                    </div>
                                                    <Input id="bulk-file" type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                                                </div>
                                            </label>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/30 p-8 border-t flex justify-center gap-8">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                                            <ShieldCheck className="h-4 w-4" /> Secure Data Transmission
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                                            <Sparkles className="h-4 w-4" /> AI Field Normalization
                                        </div>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 'MAPPING' && (
                        <motion.div key="mapping" {...stepTransition}>
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="font-bold gap-2">
                                        <ArrowLeft className="h-4 w-4" /> Change File
                                    </Button>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-black px-4 h-8 uppercase text-[10px]">
                                            <FileText className="h-3 w-3 mr-2" /> {fileName}
                                        </Badge>
                                        <Badge className="bg-primary h-8 font-black uppercase text-[10px] px-4 rounded-xl">{rawData.length} Schools Identified</Badge>
                                    </div>
                                </div>

                                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                    <CardHeader className="bg-muted/30 border-b p-8">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                                    <TableIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Schema Correlation</CardTitle>
                                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Map spreadsheet columns to institutional system fields.</CardDescription>
                                                </div>
                                            </div>
                                            {isAiMapping && (
                                                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> AI Architecting...
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                            {TARGET_FIELDS.map((field) => (
                                                <div key={field.key} className="space-y-2">
                                                    <div className="flex justify-between items-center px-1">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                                                        </Label>
                                                        {mapping[field.key] && (
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-200 bg-emerald-50 text-emerald-600 px-1.5 h-4">Mapped</Badge>
                                                        )}
                                                    </div>
                                                    <Select 
                                                        value={mapping[field.key] || 'none'} 
                                                        onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}
                                                    >
                                                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold">
                                                            <SelectValue placeholder="Ignore this field" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="none" className="italic opacity-50">-- Ignore / No Match --</SelectItem>
                                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-primary/5 p-10 border-t flex flex-col gap-6">
                                        <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-5 shadow-inner w-full">
                                            <div className="p-3 bg-white rounded-2xl text-blue-600 shadow-sm border border-blue-100"><Sparkles className="h-6 w-6" /></div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Normalization Engine</p>
                                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                                    AI will automatically validate every row, extract focal persons, and fuzzy-match your regional zones and managers during the ingestion phase.
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={() => startExecution()} 
                                            disabled={!mapping['name']}
                                            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-2xl bg-primary text-white uppercase tracking-[0.2em] active:scale-95 transition-all gap-3"
                                        >
                                            <Zap className="h-6 w-6" /> Launch Hub Ingestion
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 'EXECUTING' && (
                        <motion.div key="executing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="text-center py-16 bg-muted/30 border-b">
                                    <div className="mx-auto bg-primary/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-primary/10 relative">
                                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                        <div className="absolute inset-0 rounded-[2.5rem] border-4 border-primary animate-ping opacity-20" />
                                    </div>
                                    <CardTitle className="text-4xl font-black tracking-tighter uppercase leading-none text-foreground">Mission Execution</CardTitle>
                                    <CardDescription className="text-base font-bold uppercase tracking-[0.3em] text-muted-foreground mt-4">
                                        Architecting institutional hubs: {currentRowIdx + 1} of {totalToProcess}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-20 px-12 space-y-16">
                                    <div className="space-y-8 max-w-2xl mx-auto">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Ingestion Velocity</p>
                                            <p className="text-6xl font-black tabular-nums tracking-tighter text-primary">{progress}%</p>
                                        </div>
                                        <div className="h-6 w-full bg-muted/30 rounded-full overflow-hidden border-2 p-1.5 shadow-inner">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className="h-full bg-primary rounded-full shadow-[0_0_25px_rgba(59,95,255,0.6)]"
                                            />
                                        </div>
                                    </div>

                                    <div className="max-w-xl mx-auto space-y-4">
                                        {executionResults.slice(-3).reverse().map((res, i) => (
                                            <motion.div 
                                                key={res.row} 
                                                initial={{ opacity: 0, x: -20 }} 
                                                animate={{ opacity: 1, x: 0 }}
                                                className={cn(
                                                    "p-4 rounded-2xl border flex items-center justify-between shadow-sm",
                                                    res.status === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg", res.status === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                                        {res.status === 'success' ? <Building size={14} /> : <AlertCircle size={14} />}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-tight">{res.schoolName || `Row ${res.row + 1}`}</span>
                                                </div>
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                                                    {res.status === 'success' ? 'Record Synchronized' : `Error: ${res.error}`}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'COMPLETE' && (
                        <motion.div key="complete" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="space-y-8">
                                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                                    <CardHeader className={cn(
                                        "text-center py-16 text-white relative",
                                        errorCount === 0 ? "bg-emerald-500" : "bg-orange-500"
                                    )}>
                                        <div className="absolute top-0 right-0 p-8 opacity-10"><Target size={120} /></div>
                                        <div className="mx-auto bg-white/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl backdrop-blur-md border border-white/20">
                                            {errorCount === 0 ? <CheckCircle2 className="h-12 w-12" /> : <AlertTriangle className="h-12 w-12" />}
                                        </div>
                                        <CardTitle className="text-4xl font-black tracking-tighter uppercase leading-none">
                                            {errorCount === 0 ? 'Ingestion Successful' : 'Ingestion Partial'}
                                        </CardTitle>
                                        <CardDescription className="text-base font-bold uppercase tracking-[0.3em] text-white/80 mt-4">
                                            Mission Debrief: {successCount} synchronized, {errorCount} failed.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-12">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none mb-2">Hubs Created</p>
                                                <p className="text-5xl font-black tabular-nums tracking-tighter text-emerald-600">{successCount}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Success</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none mb-2">Records Failed</p>
                                                <p className={cn("text-5xl font-black tabular-nums tracking-tighter", errorCount > 0 ? "text-rose-600" : "text-muted-foreground")}>{errorCount}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Attention Req.</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none mb-2">Conversion</p>
                                                <p className="text-5xl font-black tabular-nums tracking-tighter text-primary">{Math.round((successCount/(successCount + errorCount || 1))*100)}%</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Efficiency</p>
                                            </div>
                                        </div>

                                        {errorCount > 0 && (
                                            <div className="mt-16 space-y-6 animate-in slide-in-from-bottom-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center gap-3">
                                                        <AlertCircle className="h-5 w-5 text-rose-600" />
                                                        <h3 className="text-xl font-black uppercase tracking-tight text-rose-900">Correction Protocol Required</h3>
                                                    </div>
                                                    <Button onClick={() => setCurrentStep('CORRECTION')} className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-rose-600 hover:bg-rose-700 shadow-lg">
                                                        <Wand2 className="h-4 w-4" /> Manage Failures
                                                    </Button>
                                                </div>
                                                <Card className="border-rose-100 bg-rose-50/30 overflow-hidden rounded-3xl">
                                                    <div className="p-0">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-rose-100/50">
                                                                <tr>
                                                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-rose-900 pl-8">Location</th>
                                                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-rose-900">Failure Logic</th>
                                                                    <th className="p-4 text-right pr-8"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-rose-100">
                                                                {executionResults.filter(r => r.status === 'error').map(err => (
                                                                    <tr key={err.row}>
                                                                        <td className="p-4 pl-8 text-xs font-bold text-rose-900 uppercase">Row {err.row + 1}</td>
                                                                        <td className="p-4 text-xs font-medium text-rose-800">{err.error}</td>
                                                                        <td className="p-4 text-right pr-8">
                                                                            <Button variant="ghost" size="sm" onClick={() => setEditingRowIdx(err.row)} className="h-8 rounded-lg font-bold text-rose-600 hover:bg-rose-100 gap-2">
                                                                                <Pencil className="h-3 w-3" /> Fix
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </Card>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="bg-muted/30 p-10 border-t flex justify-between items-center sm:justify-between">
                                        <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="font-black uppercase tracking-widest text-xs h-12 px-8 rounded-xl">Initialize New Batch</Button>
                                        <Button 
                                            onClick={() => router.push('/admin/schools')} 
                                            className="rounded-2xl font-black h-14 px-12 shadow-2xl bg-primary text-white uppercase tracking-[0.1em] transition-all active:scale-95"
                                        >
                                            Access Schools Directory <ChevronRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 'CORRECTION' && (
                        <motion.div key="correction" {...stepTransition}>
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" onClick={() => setCurrentStep('COMPLETE')} className="font-bold gap-2">
                                        <ArrowLeft className="h-4 w-4" /> Back to Summary
                                    </Button>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-rose-600">Protocol Correction Console</h2>
                                </div>

                                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                    <CardHeader className="bg-rose-50 border-b border-rose-100 p-8">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-200">
                                                <RefreshCw className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl font-black uppercase tracking-tight text-rose-900">Failure Reconciliation</CardTitle>
                                                <CardDescription className="text-xs font-bold text-rose-700/60 uppercase">Adjust field mapping or fix row content before retrying.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="p-8 border-b bg-muted/5">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-4">Refine Current Mappings</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {TARGET_FIELDS.slice(0, 3).map((field) => (
                                                    <div key={field.key} className="space-y-1.5">
                                                        <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">{field.label}</Label>
                                                        <Select 
                                                            value={mapping[field.key] || 'none'} 
                                                            onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}
                                                        >
                                                            <SelectTrigger className="h-10 rounded-xl bg-white border-primary/10 font-bold">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="none">Ignore</SelectItem>
                                                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <ScrollArea className="h-[400px]">
                                            <Table>
                                                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                                                    <TableRow>
                                                        <TableHead className="pl-8 text-[10px] font-black uppercase py-4">Source Row</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase py-4">Context</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase py-4">Failure Reason</TableHead>
                                                        <TableHead className="text-right pr-8 text-[10px] font-black uppercase py-4">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {failedRowIndices.map(idx => {
                                                        const rowData = rawData[idx];
                                                        const rowError = executionResults.find(r => r.row === idx)?.error;
                                                        return (
                                                            <TableRow key={idx} className="group hover:bg-rose-50/20 transition-colors">
                                                                <TableCell className="pl-8 font-black text-xs">#{idx + 1}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="font-bold text-xs">{rowData[mapping['name']] || 'Untitled'}</span>
                                                                        <span className="text-[9px] font-medium text-muted-foreground opacity-60 uppercase">{rowData[mapping['location']] || 'Location Unknown'}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 text-[9px] font-bold uppercase tracking-tighter">
                                                                        {rowError || 'Validation Logic Failure'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right pr-8 flex items-center justify-end gap-2 pt-4">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-100" onClick={() => setEditingRowIdx(idx)}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600 rounded-lg" onClick={() => setFailedRowIndices(p => p.filter(i => i !== idx))}>
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </CardContent>
                                    <CardFooter className="bg-rose-50/50 p-10 border-t flex flex-col gap-6">
                                        <div className="p-6 rounded-[2rem] bg-white border border-rose-100 flex items-start gap-5 shadow-sm w-full">
                                            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg"><Info className="h-6 w-6" /></div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Recovery Protocol</p>
                                                <p className="text-[10px] text-rose-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                                    Retrying will only process the {failedRowIndices.length} rows listed above. Ensure your field mappings or row content align with the system structure.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 w-full">
                                            <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="h-16 flex-1 rounded-2xl font-black uppercase text-xs tracking-widest border-2">Discard & Restart</Button>
                                            <Button 
                                                onClick={() => startExecution(failedRowIndices)} 
                                                disabled={failedRowIndices.length === 0}
                                                className="h-16 flex-[2] rounded-2xl font-black text-xl shadow-2xl bg-rose-600 text-white hover:bg-rose-700 uppercase tracking-[0.2em] active:scale-95 transition-all gap-3"
                                            >
                                                <RefreshCw className="h-6 w-6" /> Re-Execute Failures
                                            </Button>
                                        </div>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <RowEditorDialog 
                open={editingRowIdx !== null} 
                onOpenChange={(o) => !o && setEditingRowIdx(null)}
                rowIndex={editingRowIdx || 0}
                data={editingRowIdx !== null ? rawData[editingRowIdx] : {}}
                onSave={handleUpdateRow}
            />
        </div>
    );
}

function RowEditorDialog({ open, onOpenChange, rowIndex, data, onSave }: { 
    open: boolean, 
    onOpenChange: (o: boolean) => void, 
    rowIndex: number, 
    data: any, 
    onSave: (idx: number, updated: any) => void 
}) {
    const [localData, setLocalData] = React.useState<any>(data);

    React.useEffect(() => { if (open) setLocalData(data); }, [open, data]);

    const handleSave = () => {
        onSave(rowIndex, localData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary text-white rounded-xl shadow-lg">
                            <Pencil className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Row Protocol Modification</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Editing data for record #{rowIndex + 1}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-[400px]">
                        <div className="p-8 space-y-6">
                            {Object.entries(localData).map(([key, val]) => (
                                <div key={key} className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{key}</Label>
                                    <Input 
                                        value={String(val || '')} 
                                        onChange={e => setLocalData((p: any) => ({ ...p, [key]: e.target.value }))}
                                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold"
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between gap-3 sm:justify-between items-center text-left">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                    <Button 
                        onClick={handleSave} 
                        className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-2 uppercase tracking-widest text-xs"
                    >
                        <Save className="h-4 w-4" /> Apply Corrections
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
