'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Enterprise Multi-Party Contract & Envelope Dispatch Wizard (Phase 2, P2.5 UI).
 * 2. 4-Step Architecture:
 *    Step 1: Template Architecture Selection
 *    Step 2: Multi-Party Recipients & Drag-and-Drop Sequential/Parallel Routing (`RecipientRoutingEditor`)
 *    Step 3: High-Fidelity Vector Canvas Simulation & Variable Verification (`PdfFormRenderer`)
 *    Step 4: Outbound Protocol Selection & Transactional Dispatch (`createEnvelopeAction`)
 * 3. Backward Compatibility & Dual Mode:
 *    Preserves legacy single-signer contracts and automations seamlessly while unlocking
 *    enterprise multi-signatory capabilities.
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

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
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { 
    FileText, 
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
    Info,
    FlaskConical,
    Building,
    MessageSquareOff,
    GitFork
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { PDFForm, WorkspaceEntity, Entity } from '@/lib/types';
import { upsertContractAction, sendContractAction } from '@/lib/contract-actions';
import { createEnvelopeAction } from '@/lib/documents/envelope-actions';
import type { EnvelopeRoutingMode } from '@/lib/types/document-signing';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import PdfFormRenderer from '@/app/forms/[pdfId]/components/PdfFormRenderer';
import TestDispatchDialog from '../../../messaging/components/TestDispatchDialog';
import { Switch } from '@/components/ui/switch';
import { MessagingTemplateSelector } from '../../../components/MessagingTemplateSelector';
import RecipientRoutingEditor, { type RecipientDraft } from './RecipientRoutingEditor';

const wizardSchema = z.object({
    pdfId: z.string().min(1, "Please select a contract template."),
    emailTemplateId: z.string().optional(),
    smsTemplateId: z.string().optional(),
    skipMessaging: z.boolean().default(false),
});

type WizardData = z.infer<typeof wizardSchema>;

interface ContractWizardProps {
    entities: (WorkspaceEntity & { identity?: Entity })[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const stepTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
};

export default function ContractWizard({ entities, open, onOpenChange }: ContractWizardProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    
    const [step, setStep] = React.useState(1);
    const [previewIndex, setPreviewIndex] = React.useState(0);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [progress, setProgress] = React.useState({ current: 0, total: entities.length });

    // Multi-Party Routing State (Phase 2, P2.5)
    const [isMultiParty, setIsMultiParty] = React.useState(false);
    const [routingMode, setRoutingMode] = React.useState<EnvelopeRoutingMode>('sequential');
    const [recipients, setRecipients] = React.useState<RecipientDraft[]>([]);

    const currentEntity = entities[previewIndex];

    // Seed default signatories when current entity changes
    React.useEffect(() => {
        if (!currentEntity) return;

        const designatedSignatory = currentEntity.identity?.contacts?.find(p => p.isSignatory) || currentEntity.identity?.contacts?.[0];

        const initialSigner: RecipientDraft = {
            id: 'rec_draft_primary',
            name: designatedSignatory?.name || currentEntity.displayName || 'Primary Signatory',
            email: designatedSignatory?.email || 'signatory@company.com',
            phone: designatedSignatory?.phone || '',
            role: 'signer',
            routingOrder: 1,
        };

        const initialCountersigner: RecipientDraft = {
            id: 'rec_draft_counsel',
            name: user?.displayName || 'Executive Management',
            email: user?.email || 'legal@internal.com',
            phone: '',
            role: 'countersigner',
            routingOrder: 2,
        };

        setRecipients([initialSigner, initialCountersigner]);
    }, [currentEntity, user]);

    // Form Initialization
    const methods = useForm<WizardData>({
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            pdfId: '',
            emailTemplateId: '',
            smsTemplateId: '',
            skipMessaging: false,
        }
    });

    const { watch, setValue, handleSubmit } = methods;
    const watchedPdfId = watch('pdfId');
    const watchedEmailId = watch('emailTemplateId');
    const watchedSmsId = watch('smsTemplateId');
    const watchedSkipMessaging = watch('skipMessaging');

    // Data Subscriptions
    const pdfsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pdfs'), where('isContractDocument', '==', true), where('status', '==', 'published')) : null, 
    [firestore]);

    const { data: pdfTemplates } = useCollection<PDFForm>(pdfsQuery);

    const selectedPdf = React.useMemo(() => 
        pdfTemplates?.find(p => p.id === watchedPdfId),
    [pdfTemplates, watchedPdfId]);

    const getPublicUrl = (entity: WorkspaceEntity) => {
        if (!selectedPdf) return '';
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        return `${base}/forms/${selectedPdf.slug || selectedPdf.id}?entityId=${entity.entityId}`;
    };

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const onSubmit = async (data: WizardData) => {
        if (!user || !selectedPdf) return;
        
        const noMessagingSelected = !data.emailTemplateId && !data.smsTemplateId;
        
        if (noMessagingSelected && !data.skipMessaging) {
            toast({ variant: 'destructive', title: 'Template Required', description: 'Please select a template or enable manual dispatch mode.' });
            return;
        }

        setIsSaving(true);
        let successCount = 0;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            setProgress({ current: i + 1, total: entities.length });

            try {
                if (isMultiParty) {
                    // Phase 2: Multi-Party Envelope Creation Action
                    const envelopeRes = await createEnvelopeAction({
                        workspaceId: entity.workspaceId || 'default',
                        title: `${selectedPdf.name} - ${entity.displayName}`,
                        templateId: selectedPdf.id,
                        entityId: entity.entityId,
                        routingMode,
                        documentStoragePath: selectedPdf.storagePath || '',
                        preExecutionSha256: selectedPdf.slug || 'sha256_placeholder',
                        recipients: recipients.map((r) => ({
                            name: r.name,
                            email: r.email,
                            phone: r.phone,
                            role: r.role,
                            routingOrder: r.routingOrder,
                            entityId: entity.entityId,
                        })),
                    });

                    if (envelopeRes.success) {
                        successCount++;
                    } else {
                        console.error(`Envelope dispatch error for ${entity.displayName}:`, envelopeRes.error);
                    }
                } else {
                    // Standard Single-Signer Flow
                    const upsertRes = await upsertContractAction({
                        entityId: entity.entityId,
                        entityName: entity.displayName,
                        pdfId: data.pdfId,
                        pdfName: selectedPdf.name,
                        status: 'sent',
                        userId: user.uid,
                        workspaceId: entity.workspaceId || ''
                    });

                    if (upsertRes.success && upsertRes.id && !data.skipMessaging && !noMessagingSelected) {
                        const signatory = entity.identity?.contacts?.find(p => p.isSignatory) || entity.identity?.contacts?.[0];
                        if (signatory) {
                            await sendContractAction({
                                contractId: upsertRes.id,
                                entityId: entity.entityId,
                                entityName: entity.displayName,
                                emailTemplateId: data.emailTemplateId,
                                smsTemplateId: data.smsTemplateId,
                                recipients: [{ name: signatory.name, email: signatory.email, phone: signatory.phone, type: signatory.type }],
                                userId: user.uid,
                                publicUrl: getPublicUrl(entity)
                            });
                        }
                    }
                    
                    if (upsertRes.success) {
                        successCount++;
                    }
                }
            } catch (err) {
                console.error(`Failed to process ${entity.displayName}:`, err);
            }
        }

        toast({
            title: isMultiParty ? 'Multi-Party Envelopes Dispatched' : 'Bulk Execution Complete',
            description: `${successCount} institutional agreements successfully queued and registered.`
        });
        setIsSaving(false);
        onOpenChange(false);
    };

    const stepLabel = (num: number, label: string) => (
        <div className={cn(
            "flex items-center gap-2 text-[10px] font-semibold uppercase transition-all",
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
                        <div className="flex items-center gap-4 text-left">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-semibold tracking-tight">Legal Execution Hub</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground">Initializing {entities.length} Institutional Agreements</DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                            {stepLabel(1, "Template")}
                            {stepLabel(2, "Routing")}
                            {stepLabel(3, "Simulation")}
                            {stepLabel(4, "Dispatch")}
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative bg-background">
                    <FormProvider {...methods}>
                        <AnimatePresence mode="wait">
                            {/* STEP 1: TEMPLATE ARCHITECTURE */}
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition} className="absolute inset-0 p-8 sm:p-12 overflow-y-auto">
                                    <div className="max-w-2xl mx-auto space-y-10 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-xl"><FileText className="h-5 w-5 text-primary" /></div>
                                            <Label className="text-base font-semibold tracking-tight">Select Contract Architecture</Label>
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
                                                            <p className="font-semibold text-sm truncate">{p.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground ">{p.fields?.length || 0} Dynamic Tags</p>
                                                        </div>
                                                        {watchedPdfId === p.id && <Check className="h-5 w-5 text-primary animate-in zoom-in" />}
                                                    </CardContent>
                                                </Card>
                                            )) : (
                                                <div className="col-span-2 py-20 text-center border-2 border-dashed rounded-3xl opacity-30">
                                                    <Zap className="h-12 w-12 mx-auto mb-4" />
                                                    <p className="text-[10px] font-semibold ">No published contracts found</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 2: RECIPIENTS & ROUTING */}
                            {step === 2 && (
                                <motion.div key="step2" {...stepTransition} className="absolute inset-0 p-8 sm:p-12 overflow-y-auto">
                                    <div className="max-w-3xl mx-auto space-y-8 text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                                                    <GitFork className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold tracking-tight">Recipient Signatory Matrix</h3>
                                                    <p className="text-xs text-muted-foreground">Configure sequential chains or parallel cohorts for execution.</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant={!isMultiParty ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setIsMultiParty(false)}
                                                    className="rounded-xl text-xs h-9 min-h-[44px] font-semibold active:scale-[0.97]"
                                                >
                                                    Single Signer (Quick)
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={isMultiParty ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setIsMultiParty(true)}
                                                    className="rounded-xl text-xs h-9 min-h-[44px] font-semibold active:scale-[0.97]"
                                                >
                                                    Multi-Party Routing
                                                </Button>
                                            </div>
                                        </div>

                                        {isMultiParty ? (
                                            <RecipientRoutingEditor
                                                recipients={recipients}
                                                routingMode={routingMode}
                                                onRecipientsChange={setRecipients}
                                                onRoutingModeChange={setRoutingMode}
                                                disabled={isSaving}
                                            />
                                        ) : (
                                            <div className="p-6 rounded-2xl bg-muted/40 border space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                                        <Users className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold">Designated Signatory Mode</h4>
                                                        <p className="text-xs text-muted-foreground">
                                                            Agreements will be addressed directly to each entity&apos;s registered primary signatory.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                                    <div className="p-3 bg-card rounded-xl border">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Primary Signatory</Label>
                                                        <p className="text-sm font-semibold truncate pt-1">
                                                            {currentEntity?.identity?.contacts?.find(p => p.isSignatory)?.name || currentEntity?.displayName}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-card rounded-xl border">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Notification Email</Label>
                                                        <p className="text-sm font-semibold truncate pt-1">
                                                            {currentEntity?.identity?.contacts?.find(p => p.isSignatory)?.email || 'Will use entity default email'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: HIGH-FIDELITY SIMULATION */}
                            {step === 3 && (
                                <motion.div key="step3" {...stepTransition} className="absolute inset-0 bg-muted/10 overflow-hidden flex flex-col">
                                    <div className="p-4 bg-card border-b flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold text-[10px] uppercase px-3 h-7">
                                                <Eye className="h-3 w-3 mr-1.5" /> High-Fidelity Simulation
                                            </Badge>
                                            <div className="h-6 w-px bg-border" />
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-lg active:scale-[0.97]" 
                                                    disabled={previewIndex === 0}
                                                    onClick={() => setPreviewIndex(prev => prev - 1)}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                                                    Record {previewIndex + 1} of {entities.length}
                                                </span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-lg active:scale-[0.97]" 
                                                    disabled={previewIndex === entities.length - 1}
                                                    onClick={() => setPreviewIndex(prev => prev + 1)}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-primary">
                                            <Building className="h-3.5 w-3.5" />
                                            <p className="text-[10px] font-semibold ">{currentEntity.displayName}</p>
                                        </div>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <div className="p-8 sm:p-12 flex justify-center">
                                            <div className="max-w-4xl w-full">
                                                {selectedPdf && (
                                                    <PdfFormRenderer 
                                                        pdfForm={selectedPdf} 
                                                        entity={currentEntity}
                                                        identity={currentEntity.identity} 
                                                        isPreview={true} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </motion.div>
                            )}

                            {/* STEP 4: PROTOCOLS & EXECUTION */}
                            {step === 4 && (
                                <motion.div key="step4" {...stepTransition} className="absolute inset-0 p-8 sm:p-12 overflow-y-auto">
                                    <div className="max-w-4xl mx-auto space-y-12 text-left">
                                        {isSaving ? (
                                            <div className="py-20 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
                                                <div className="relative">
                                                    <Loader2 className="h-20 w-20 animate-spin text-primary opacity-20" />
                                                    <Zap className="h-10 w-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-2xl font-semibold tracking-tight">Executing Protocols</h3>
                                                    <p className="text-sm font-medium text-muted-foreground">Initializing {progress.current} of {progress.total} institutional records...</p>
                                                </div>
                                                <div className="w-full max-w-md h-2 bg-muted rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-primary"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                <div className="space-y-10">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-primary/10 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                                                            <Label className="text-base font-semibold tracking-tight">Batch Target Summary</Label>
                                                        </div>
                                                        <ScrollArea className="h-64 border rounded-2xl bg-background p-4">
                                                            <div className="space-y-2">
                                                                {entities.map(s => (
                                                                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                                                                        <span className="text-xs font-semibold truncate pr-4">{s.displayName}</span>
                                                                        <Badge variant="outline" className="text-[8px] font-bold h-5 uppercase tracking-tighter shrink-0 bg-muted/10">
                                                                            {isMultiParty ? `${recipients.length} Signatories` : (s.identity?.contacts?.find(p => p.isSignatory)?.name.split(' ')[0] || 'Unassigned')}
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                </div>

                                                <div className="space-y-10">
                                                    <div className="space-y-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-primary/10 rounded-xl"><Mail className="h-5 w-5 text-primary" /></div>
                                                            <Label className="text-base font-semibold tracking-tight">Protocol Selection</Label>
                                                        </div>
                                                        
                                                        <div className={cn("space-y-4", watchedSkipMessaging && "opacity-40 pointer-events-none transition-opacity")}>
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-semibold text-blue-600 ml-1">Email Template</Label>
                                                                <Controller
                                                                    name="emailTemplateId"
                                                                    control={methods.control}
                                                                    render={({ field }) => (
                                                                        <MessagingTemplateSelector 
                                                                            category="agreements"
                                                                            recipientType="entity"
                                                                            channel="email"
                                                                            value={field.value}
                                                                            onValueChange={field.onChange}
                                                                            placeholder="No email blueprint"
                                                                            compact
                                                                        />
                                                                    )}
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-semibold text-orange-600 ml-1">SMS Template</Label>
                                                                <Controller
                                                                    name="smsTemplateId"
                                                                    control={methods.control}
                                                                    render={({ field }) => (
                                                                        <MessagingTemplateSelector 
                                                                            category="agreements"
                                                                            recipientType="entity"
                                                                            channel="sms"
                                                                            value={field.value}
                                                                            onValueChange={field.onChange}
                                                                            placeholder="No SMS blueprint"
                                                                            compact
                                                                        />
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 border-t pt-6 mt-4 border-dashed">
                                                            <div className={cn(
                                                                "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                                                                watchedSkipMessaging ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
                                                            )}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn("p-2 rounded-xl", watchedSkipMessaging ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                                        <MessageSquareOff className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <Label className="text-xs font-semibold tracking-tight">Manual Dispatch Mode</Label>
                                                                        <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Assign records without sending notifications</p>
                                                                    </div>
                                                                </div>
                                                                <Controller 
                                                                    name="skipMessaging"
                                                                    control={methods.control}
                                                                    render={({ field }) => (
                                                                        <Switch 
                                                                            checked={field.value} 
                                                                            onCheckedChange={field.onChange}
                                                                        />
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="p-6 rounded-3xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 flex items-start gap-4">
                                                            <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                                                            <p className="text-[10px] font-bold text-blue-800 dark:text-blue-200 leading-relaxed opacity-80">
                                                                {watchedSkipMessaging ? "The system will initialize institutional contract records but will suppress all automated messaging. Finalize manually after this process." : "Bulk dispatches will resolve unique institutional signing URLs and signatory context for every record before delivery."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </FormProvider>
                </div>

                <DialogFooter className="p-8 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex gap-3">
                        {step > 1 && !isSaving && (
                            <Button variant="ghost" onClick={handlePrev} className="rounded-xl font-bold h-12 min-h-[44px] px-8 gap-2 text-left active:scale-[0.97]">
                                <ChevronLeft className="h-4 w-4" /> Back
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="rounded-xl font-bold h-12 min-h-[44px] px-8 active:scale-[0.97]">Discard</Button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {step === 4 && !isSaving && (
                            <Button 
                                variant="outline" 
                                onClick={() => setIsTestModalOpen(true)}
                                disabled={watchedSkipMessaging || (!watchedEmailId && !watchedSmsId)}
                                className="rounded-xl font-bold h-14 min-h-[44px] border-primary/20 text-primary px-8 gap-2 active:scale-[0.97]"
                            >
                                <FlaskConical className="h-5 w-5" /> Send Test
                            </Button>
                        )}
                        {step < 4 ? (
                            <Button 
                                onClick={handleNext} 
                                disabled={isSaving || (step === 1 && !watchedPdfId)}
                                className="rounded-2xl font-semibold h-14 min-h-[44px] px-16 shadow-2xl tracking-[0.1em] active:scale-[0.97] transition-all gap-2"
                            >
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                Next Phase <ChevronRight className="h-5 w-5" />
                            </Button>
                        ) : (
                            !isSaving && (
                                <Button 
                                    onClick={handleSubmit(onSubmit)} 
                                    disabled={isSaving || (!watchedSkipMessaging && !watchedEmailId && !watchedSmsId)}
                                    className="rounded-2xl font-semibold h-14 min-h-[44px] px-20 shadow-2xl bg-primary text-white tracking-[0.1em] active:scale-[0.97] transition-all gap-3"
                                >
                                    {watchedSkipMessaging ? <ShieldCheck className="h-6 w-6" /> : <Send className="h-6 w-6" />}
                                    {watchedSkipMessaging ? 'Finalize Manual Assignment' : isMultiParty ? 'Dispatch Envelopes' : 'Launch Bulk Dispatch'}
                                </Button>
                            )
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>

            {currentEntity && (
                <TestDispatchDialog 
                    open={isTestModalOpen}
                    onOpenChange={setIsTestModalOpen}
                    channel={watchedEmailId ? 'email' : 'sms'}
                    templateId={watchedEmailId || watchedSmsId}
                    variables={{
                        school_name: currentEntity.displayName,
                        contact_name: 'Test Recipient',
                        contract_link: getPublicUrl(currentEntity),
                        agreement_url: getPublicUrl(currentEntity),
                        link: getPublicUrl(currentEntity),
                        event_type: 'Agreement Signature Required (Test)'
                    }}
                    entityId={currentEntity.entityId}
                />
            )}
        </Dialog>
    );
}
