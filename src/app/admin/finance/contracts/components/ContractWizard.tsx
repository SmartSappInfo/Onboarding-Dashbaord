'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
    FileText, 
    Plus, 
    Check, 
    ChevronRight, 
    ChevronLeft, 
    Loader2, 
    Eye, 
    Users, 
    Send, 
    ShieldCheck, 
    Zap,
    Mail,
    Smartphone,
    Info
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PDFForm, School, MessageTemplate } from '@/lib/types';
import { upsertContractAction, sendContractAction } from '@/lib/contract-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import PdfFormRenderer from '@/app/forms/[pdfId]/components/PdfFormRenderer';

const wizardSchema = z.object({
    pdfId: z.string().min(1, "Please select a contract template."),
    templateId: z.string().min(1, "Please select an invitation template."),
    selectedRecipientEmails: z.array(z.string()).default([]),
});

type WizardData = z.infer<typeof wizardSchema>;

interface ContractWizardProps {
    school: School;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const stepTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
};

export default function ContractWizard({ school, open, onOpenChange }: ContractWizardProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    const [contractId, setContractId] = React.useState<string | null>(null);

    // Form Initialization
    const methods = useForm<WizardData>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            pdfId: '',
            templateId: '',
            selectedRecipientEmails: school.focalPersons?.filter(p => p.email).map(p => p.email) || []
        }
    });

    const { watch, setValue, handleSubmit } = methods;
    const watchedPdfId = watch('pdfId');
    const watchedRecipients = watch('selectedRecipientEmails');
    const watchedTemplateId = watch('templateId');

    // Data Subscriptions
    const pdfsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pdfs'), where('isContractDocument', '==', true), where('status', '==', 'published')) : null, 
    [firestore]);

    const templatesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'message_templates'), where('category', '==', 'contracts'), where('isActive', '==', true)) : null, 
    [firestore]);

    const { data: pdfTemplates } = useCollection<PDFForm>(pdfsQuery);
    const { data: msgTemplates } = useCollection<MessageTemplate>(templatesQuery);

    const selectedPdf = React.useMemo(() => 
        pdfTemplates?.find(p => p.id === watchedPdfId),
    [pdfTemplates, watchedPdfId]);

    const handleNext = async () => {
        if (step === 1) {
            if (!watchedPdfId) return;
            setIsSaving(true);
            const result = await upsertContractAction({
                schoolId: school.id,
                schoolName: school.name,
                pdfId: watchedPdfId,
                pdfName: selectedPdf?.name || 'Contract',
                status: 'draft',
                userId: user?.uid || ''
            });
            if (result.success) {
                setContractId(result.id!);
                setStep(2);
            } else {
                toast({ variant: 'destructive', title: 'Draft Failed', description: result.error });
            }
            setIsSaving(false);
        } else {
            setStep(s => s + 1);
        }
    };

    const onSubmit = async (data: WizardData) => {
        if (!user || !contractId || !selectedPdf) return;
        setIsSaving(true);

        const recipients = (school.focalPersons || [])
            .filter(p => data.selectedRecipientEmails.includes(p.email))
            .map(p => ({ name: p.name, email: p.email, phone: p.phone, type: p.type }));

        const publicUrl = `${window.location.origin}/forms/${selectedPdf.slug || selectedPdf.id}`;

        const result = await sendContractAction({
            contractId,
            schoolId: school.id,
            schoolName: school.name,
            templateId: data.templateId,
            recipients,
            userId: user.uid,
            publicUrl
        });

        if (result.success) {
            toast({ title: 'Agreement Dispatched', description: `Contract for ${school.name} is now pending signature.` });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Send Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const stepLabel = (num: number, label: string) => (
        <div className={cn(
            "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
            step >= num ? "text-primary" : "text-muted-foreground opacity-40"
        )}>
            <div className={cn(
                "w-7 h-7 rounded-xl border-2 flex items-center justify-center",
                step > num ? "bg-primary border-primary text-white" : step === num ? "border-primary text-primary shadow-lg shadow-primary/20 scale-110" : "border-muted-foreground"
            )}>
                {step > num ? <Check className="h-4 w-4" /> : num}
            </div>
            {label}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Legal Execution</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{school.name}</DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            {stepLabel(1, "Template")}
                            {stepLabel(2, "Simulation")}
                            {stepLabel(3, "Dispatch")}
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative bg-background">
                    <FormProvider {...methods}>
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition} className="absolute inset-0 p-12 overflow-y-auto">
                                    <div className="max-w-2xl mx-auto space-y-10 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-xl"><FileText className="h-5 w-5 text-primary" /></div>
                                            <Label className="text-base font-black uppercase tracking-tight">Select Contract Template</Label>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {pdfTemplates?.length ? pdfTemplates.map(p => (
                                                <Card 
                                                    key={p.id} 
                                                    className={cn(
                                                        "cursor-pointer transition-all duration-300 rounded-2xl border-2 hover:border-primary/40",
                                                        watchedPdfId === p.id ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 scale-[1.02]" : "border-border/50"
                                                    )}
                                                    onClick={() => setValue('pdfId', p.id)}
                                                >
                                                    <CardContent className="p-6 flex items-center gap-4 text-left">
                                                        <div className={cn("p-2 rounded-xl", watchedPdfId === p.id ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                            <FileText className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-sm uppercase truncate">{p.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{p.fields?.length || 0} Dynamic Tags</p>
                                                        </div>
                                                        {watchedPdfId === p.id && <Check className="h-5 w-5 text-primary animate-in zoom-in" />}
                                                    </CardContent>
                                                </Card>
                                            )) : (
                                                <div className="col-span-2 py-20 text-center border-2 border-dashed rounded-3xl opacity-30">
                                                    <Zap className="h-12 w-12 mx-auto mb-4" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">No published contracts available</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" {...stepTransition} className="absolute inset-0 bg-slate-50 overflow-hidden flex flex-col">
                                    <div className="p-4 bg-white border-b flex items-center justify-between">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[10px] uppercase tracking-widest px-3 h-7">
                                            <Eye className="h-3 w-3 mr-1.5" /> High-Fidelity Simulation
                                        </Badge>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Resolving variables for {school.name}</p>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <div className="p-12 flex justify-center">
                                            <div className="max-w-4xl w-full">
                                                {selectedPdf && (
                                                    <PdfFormRenderer 
                                                        pdfForm={selectedPdf} 
                                                        school={school} 
                                                        isPreview={true} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" {...stepTransition} className="absolute inset-0 p-12 overflow-y-auto">
                                    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 text-left">
                                        <div className="space-y-10 text-left">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                                                    <Label className="text-base font-black uppercase tracking-tight">Select Recipients</Label>
                                                </div>
                                                <div className="space-y-3">
                                                    {school.focalPersons?.map(person => (
                                                        <div key={person.email} className={cn(
                                                            "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                                                            watchedRecipients.includes(person.email) ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/50 bg-background opacity-60"
                                                        )}>
                                                            <div className="flex items-center gap-4">
                                                                <Checkbox 
                                                                    id={`rec-${person.email}`} 
                                                                    checked={watchedRecipients.includes(person.email)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = [...watchedRecipients];
                                                                        if (checked) current.push(person.email);
                                                                        else {
                                                                            const idx = current.indexOf(person.email);
                                                                            if (idx > -1) current.splice(idx, 1);
                                                                        }
                                                                        setValue('selectedRecipientEmails', current);
                                                                    }}
                                                                />
                                                                <div className="text-left leading-none">
                                                                    <p className="text-sm font-black uppercase tracking-tight">{person.name}</p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{person.type}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {person.email && <Mail className="h-3.5 w-3.5 text-blue-500" />}
                                                                {person.phone && <Smartphone className="h-3.5 w-3.5 text-orange-500" />}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-10 text-left">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><Mail className="h-5 w-5 text-primary" /></div>
                                                    <Label className="text-base font-black uppercase tracking-tight">Communication Template</Label>
                                                </div>
                                                <Controller
                                                    name="templateId"
                                                    control={methods.control}
                                                    render={({ field }) => (
                                                        <Select value={field.value} onValueChange={field.onChange}>
                                                            <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-none shadow-inner font-black text-lg px-6">
                                                                <SelectValue placeholder="Pick a template..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-2xl">
                                                                {msgTemplates?.map(t => (
                                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                                <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 flex items-start gap-4">
                                                    <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] font-bold text-blue-800 uppercase leading-relaxed tracking-widest opacity-80">
                                                        Selected templates will be resolved with the institutional contract link and school context before dispatch.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </FormProvider>
                </div>

                <DialogFooter className="p-8 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex gap-3">
                        {step > 1 && (
                            <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="rounded-xl font-bold h-12 px-8 gap-2">
                                <ChevronLeft className="h-4 w-4" /> Back
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                    </div>
                    
                    {step < 3 ? (
                        <Button 
                            onClick={handleNext} 
                            disabled={isSaving || (step === 1 && !watchedPdfId)}
                            className="rounded-2xl font-black h-14 px-16 shadow-2xl uppercase tracking-[0.1em] active:scale-95 transition-all gap-2"
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                            Next Phase <ChevronRight className="h-5 w-5" />
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleSubmit(onSubmit)} 
                            disabled={isSaving || !watchedTemplateId || watchedRecipients.length === 0}
                            className="rounded-2xl font-black h-14 px-20 shadow-2xl bg-primary text-white uppercase tracking-[0.1em] active:scale-95 transition-all gap-3"
                        >
                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
                            Execute Dispatch
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
