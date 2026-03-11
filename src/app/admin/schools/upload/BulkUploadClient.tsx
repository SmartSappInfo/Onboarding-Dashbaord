
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
    Table as TableIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { suggestBulkMapping } from '@/ai/flows/bulk-mapping-flow';
import { ingestSchoolRowAction } from '@/lib/bulk-upload-actions';
import { cn } from '@/lib/utils';

type Step = 'UPLOAD' | 'MAPPING' | 'EXECUTING' | 'COMPLETE';

const TARGET_FIELDS = [
    { key: 'name', label: 'School Name', required: true },
    { key: 'initials', label: 'Initials/Acronym' },
    { key: 'location', label: 'Physical Location' },
    { key: 'nominalRoll', label: 'Student Roll' },
    { key: 'zone', label: 'Regional Zone' },
    { key: 'assignedTo', label: 'Account Manager' },
    { key: 'package', label: 'Subscription Tier' },
    { key: 'modules', label: 'Requested Modules' },
    { key: 'contactName', label: 'Primary Contact' },
    { key: 'contactEmail', label: 'Contact Email' },
    { key: 'contactPhone', label: 'Contact Phone' },
];

export default function BulkUploadClient() {
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();

    // State Machine
    const [currentStep, setCurrentStep] = React.useState<Step>('UPLOAD');
    const [fileName, setFileName] = React.useState('');
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [rawData, setRawData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [isAiMapping, setIsAiMapping] = React.useState(false);
    
    // Execution State
    const [results, setResults] = React.useState<{ row: number; status: 'success' | 'error'; schoolName?: string; error?: string }[]>([]);
    const [currentRowIdx, setCurrentRowIdx] = React.useState(0);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length > 0) {
                        setHeaders(Object.keys(results.data[0] as object));
                        setRawData(results.data);
                        triggerAiMapping(Object.keys(results.data[0] as object), results.data.slice(0, 3));
                    }
                }
            });
        } else if (extension === 'xlsx' || extension === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                if (data.length > 0) {
                    setHeaders(Object.keys(data[0] as object));
                    setRawData(data);
                    triggerAiMapping(Object.keys(data[0] as object), data.slice(0, 3));
                }
            };
            reader.readAsBinaryString(file);
        }
    };

    const triggerAiMapping = async (fileHeaders: string[], samples: any[]) => {
        setCurrentStep('MAPPING');
        setIsAiMapping(true);
        try {
            const result = await suggestBulkMapping({ headers: fileHeaders, sampleRows: samples });
            // The mapping from AI is key: systemField, value: documentHeader
            // We store it as systemField: documentHeader
            setMapping(result.mapping as any);
            toast({ title: 'AI Mapping Success', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Mapping Failed', description: 'Please map fields manually.' });
        } finally {
            setIsAiMapping(false);
        }
    };

    const startExecution = async () => {
        if (!user) return;
        setCurrentStep('EXECUTING');
        setCurrentRowIdx(0);
        setResults([]);

        for (let i = 0; i < rawData.length; i++) {
            setCurrentRowIdx(i);
            try {
                const result = await ingestSchoolRowAction(rawData[i], mapping, user.uid, fileName);
                if (result.success) {
                    setResults(prev => [...prev, { row: i, status: 'success', schoolName: result.schoolName }]);
                } else {
                    setResults(prev => [...prev, { row: i, status: 'error', error: result.error }]);
                }
            } catch (e: any) {
                setResults(prev => [...prev, { row: i, status: 'error', error: e.message }]);
            }
            // Small delay to prevent UI locking and respect burst limits
            await new Promise(r => setTimeout(r, 100));
        }

        setCurrentStep('COMPLETE');
    };

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const progress = rawData.length > 0 ? Math.round(((results.length) / rawData.length) * 100) : 0;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-5xl mx-auto">
                
                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
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
                        </motion.div>
                    )}

                    {currentStep === 'MAPPING' && (
                        <motion.div key="mapping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                                                <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Institutional Intelligence Note</p>
                                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                                    AI will Fuzzy-Match your regional zones and manager names during execution. Multiple focal persons will be automatically extracted if found in the mapped contact columns.
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={startExecution} 
                                            disabled={!mapping['name']}
                                            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-2xl bg-primary text-white uppercase tracking-[0.2em] active:scale-95 transition-all gap-3"
                                        >
                                            <CheckCircle2 className="h-6 w-6" /> Initialize Mission Execution
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
                                    <CardDescription className="text-base font-bold uppercase tracking-[0.3em] text-muted-foreground mt-4">Architecting institutional hubs: {currentRowIdx + 1} of {rawData.length}</CardDescription>
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
                                        {results.slice(-3).reverse().map((res, i) => (
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
                                    <CardHeader className="text-center py-16 bg-emerald-500 text-white relative">
                                        <div className="absolute top-0 right-0 p-8 opacity-10"><Target size={120} /></div>
                                        <div className="mx-auto bg-white/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl backdrop-blur-md border border-white/20">
                                            <CheckCircle2 className="h-12 w-12 text-white" />
                                        </div>
                                        <CardTitle className="text-4xl font-black tracking-tighter uppercase leading-none">Ingestion Successful</CardTitle>
                                        <CardDescription className="text-base font-bold uppercase tracking-[0.3em] text-white/80 mt-4">Mission Debrief: {rawData.length} Identities Scanned</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-12">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                                            <ResultStat label="Hubs Created" value={successCount} sub="Success" color="text-emerald-600" />
                                            <ResultStat label="Records Failed" value={errorCount} sub="Attention Req." color={errorCount > 0 ? "text-rose-600" : "text-muted-foreground"} />
                                            <ResultStat label="Conversion" value={`${Math.round((successCount/rawData.length)*100)}%`} sub="Efficiency" color="text-primary" />
                                        </div>

                                        {errorCount > 0 && (
                                            <div className="mt-16 space-y-6 animate-in slide-in-from-bottom-4">
                                                <div className="flex items-center gap-3 px-2">
                                                    <AlertCircle className="h-5 w-5 text-rose-600" />
                                                    <h3 className="text-xl font-black uppercase tracking-tight text-rose-900">Correction Protocol Required</h3>
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
                                                                {results.filter(r => r.status === 'error').map(err => (
                                                                    <tr key={err.row}>
                                                                        <td className="p-4 pl-8 text-xs font-bold text-rose-900 uppercase">Row {err.row + 1}</td>
                                                                        <td className="p-4 text-xs font-medium text-rose-800">{err.error}</td>
                                                                        <td className="p-4 text-right pr-8">
                                                                            <Button variant="ghost" size="sm" className="h-8 rounded-lg font-black text-[9px] uppercase tracking-tighter text-rose-600 hover:bg-rose-100">
                                                                                Manual Fix
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
                </AnimatePresence>
            </div>
        </div>
    );
}

function ResultStat({ label, value, sub, color }: { label: string, value: string | number, sub: string, color: string }) {
    return (
        <div className="text-center space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 leading-none mb-2">{label}</p>
            <p className={cn("text-5xl font-black tabular-nums tracking-tighter", color)}>{value}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{sub}</p>
        </div>
    );
}
