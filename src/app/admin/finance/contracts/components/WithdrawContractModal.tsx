'use client';

import * as React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Trash2, 
    AlertTriangle, 
    FileText, 
    Loader2, 
    Building, 
    History,
    Zap,
    ShieldAlert,
    CheckCircle2,
    X
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { School, PDFForm, Submission } from '@/lib/types';
import { purgeContractAction } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WithdrawContractModalProps {
    school: School;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * @fileOverview Institutional Record Purge Console.
 * Allows selective deletion of signed documents and resetting of contract status.
 */
export default function WithdrawContractModal({ school, open, onOpenChange }: WithdrawContractModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isLoadingData, setIsLoadingData] = React.useState(true);
    const [isPurging, setIsPurging] = React.useState(false);
    const [submissions, setSubmissions] = React.useState<{ id: string, pdfName: string, date: string, pdfId: string }[]>([]);
    const [selectedSubIds, setSelectedIds] = React.useState<string[]>([]);

    // 1. Audit Phase: Locate all relevant legal records
    React.useEffect(() => {
        if (!open || !firestore) return;

        const auditRecords = async () => {
            setIsLoadingData(true);
            try {
                // Fetch all PDFs marked as contracts
                const pdfsQuery = query(collection(firestore, 'pdfs'), where('isContractDocument', '==', true));
                const pdfsSnap = await getDocs(pdfsQuery);
                
                const foundSubmissions: any[] = [];

                for (const pdfDoc of pdfsSnap.docs) {
                    const pdfData = pdfDoc.data();
                    const subCol = collection(firestore, `pdfs/${pdfDoc.id}/submissions`);
                    const subQuery = query(subCol, where('schoolId', '==', school.id));
                    const subSnap = await getDocs(subQuery);
                    
                    subSnap.forEach(subDoc => {
                        foundSubmissions.push({
                            id: subDoc.id,
                            pdfId: pdfDoc.id,
                            pdfName: pdfData.name,
                            date: subDoc.data().submittedAt
                        });
                    });
                }

                setSubmissions(foundSubmissions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                // Default select all if any found
                setSelectedIds(foundSubmissions.map(s => s.id));
            } catch (e) {
                console.error("Audit failed:", e);
            } finally {
                setIsLoadingData(false);
            }
        };

        auditRecords();
    }, [open, firestore, school.id]);

    const handlePurge = async () => {
        if (!firestore) return;
        setIsPurging(true);
        
        try {
            // High-fidelity server-side purge
            const result = await purgeContractAction(school.id, selectedSubIds, 'current-user-placeholder');
            
            if (result.success) {
                toast({ title: 'Records Purged', description: 'Legal history has been successfully sanitized.' });
                onOpenChange(false);
            } else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Purge Failed', description: e.message });
        } finally {
            setIsPurging(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                <DialogHeader className="p-8 bg-rose-50 border-b border-rose-100 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-200">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-rose-950">Record Withdrawal</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-rose-700 opacity-70">Auditing legal submissions for {school.name}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative bg-white">
                    {isLoadingData ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-rose-600 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scanning Document Hubs...</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-10">
                                {/* Institutional Context */}
                                <div className="flex items-center gap-5 p-5 rounded-2xl bg-muted/30 border border-border shadow-inner">
                                    <div className="p-3 bg-white rounded-xl shadow-sm"><Building className="h-6 w-6 text-rose-600" /></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Target Institution</p>
                                        <p className="text-lg font-black uppercase text-foreground">{school.name}</p>
                                    </div>
                                </div>

                                {/* Submission Registry */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-1">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <History className="h-3 w-3" /> Historical Submissions
                                        </Label>
                                        <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[8px] font-black uppercase h-5">{submissions.length} Found</Badge>
                                    </div>

                                    {submissions.length > 0 ? (
                                        <div className="space-y-3">
                                            {submissions.map((sub) => (
                                                <div 
                                                    key={sub.id} 
                                                    onClick={() => toggleSelect(sub.id)}
                                                    className={cn(
                                                        "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                                        selectedSubIds.includes(sub.id) ? "bg-rose-50 border-rose-200 shadow-sm" : "bg-background border-border/50 hover:border-rose-100"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <Checkbox checked={selectedSubIds.includes(sub.id)} />
                                                        <div className="p-2 bg-white rounded-lg shadow-sm border"><FileText className="h-4 w-4 text-rose-600" /></div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-black uppercase tracking-tight text-foreground">{sub.pdfName}</p>
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{format(new Date(sub.date), 'MMMM d, yyyy HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[8px] h-4 opacity-40 font-mono">ID: {sub.id.substring(0,8)}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-16 text-center border-4 border-dashed rounded-[2rem] opacity-30 flex flex-col items-center gap-3">
                                            <Zap className="h-10 w-10" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">No signed records identified</p>
                                        </div>
                                    )}
                                </div>

                                {/* Warning Block */}
                                <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 flex items-start gap-5 shadow-inner">
                                    <div className="p-2.5 bg-white rounded-xl text-rose-600 shadow-sm border border-rose-100 mt-1"><AlertTriangle className="h-5 w-5" /></div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Purge Policy Notice</p>
                                        <p className="text-[10px] text-rose-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                            Withdrawing a contract will reset the school's legal status to "Unprepared". Deleting submissions will permanently remove the signed high-fidelity PDFs from the system.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-8 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPurging} className="font-bold rounded-xl h-14 px-10">Cancel Audit</Button>
                    <Button 
                        onClick={handlePurge} 
                        disabled={isPurging || isLoadingData || (selectedSubIds.length === 0 && submissions.length > 0)}
                        className="rounded-2xl font-black h-14 px-12 shadow-2xl bg-rose-600 hover:bg-rose-700 text-white uppercase tracking-[0.1em] text-sm gap-3 active:scale-95 transition-all"
                    >
                        {isPurging ? <Loader2 className="h-6 w-6 animate-spin" /> : <Trash2 className="h-6 w-6" />}
                        Purge Selected History
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
