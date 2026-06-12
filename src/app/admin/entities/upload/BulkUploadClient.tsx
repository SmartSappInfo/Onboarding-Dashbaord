'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { 
    Upload, 
    Map, 
    Settings2, 
    Eye, 
    PartyPopper, 
    Check
} from 'lucide-react';
import { collection, query, where, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { useTerminology } from '@/hooks/use-terminology';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ingestBatchAction } from '@/lib/bulk-upload-actions';
import { cn } from '@/lib/utils';
import type { DuplicateStrategy, DealImportConfig, NotificationConfig } from '@/lib/import-types';

// Step sub-components
import { UploadStep } from './components/UploadStep';
import { MappingStep } from './components/MappingStep';
import { DefaultSettingsStep } from './components/DefaultSettingsStep';
import { ImportPreviewStep } from './components/ImportPreviewStep';
import { ExecutionStep } from './components/ExecutionStep';
import { CompleteStep } from './components/CompleteStep';
import { CorrectionStep } from './components/CorrectionStep';
import { RowEditorDialog } from './components/RowEditorDialog';

/**
 * Base fields shown in the mapping step (always visible regardless of scope).
 */
const BASE_TARGET_FIELDS = [
    { key: 'name',          label: 'Name',                    required: true },
    { key: 'status',        label: 'Status',                  required: false },
    { key: 'locationString', label: 'Physical Address',       required: false },
    { key: 'locationRegion', label: 'Region',                 required: false },
    { key: 'locationDistrict', label: 'District',             required: false },
    { key: 'workspaceTags', label: 'Tags (Comma Separated)',  required: false },
    { key: 'currentNeeds',     label: 'Current Needs',        required: false },
    { key: 'currentChallenges', label: 'Current Challenges',  required: false },
    { key: 'interests',        label: 'Interests',            required: false },
];

const ADVANCED_TEMPLATE_FIELDS: Record<string, { key: string; label: string; required: boolean }[]> = {
    institution: [
        { key: 'company',           label: 'Organization',            required: false },
        { key: 'initials',          label: 'Initials / Acronym',      required: false },
        { key: 'slogan',            label: 'Motto / Slogan',          required: false },
        { key: 'nominalRoll',       label: 'Nominal Roll',            required: false },
        { key: 'contact_0_name',    label: 'Contact Name',            required: false },
        { key: 'contact_0_email',   label: 'Contact Email',           required: false },
        { key: 'contact_0_phone',   label: 'Contact Phone',           required: false },
        { key: 'contact_0_role',    label: 'Contact Role',            required: false },
        { key: 'status',            label: 'Status',                  required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'leadSource',        label: 'Lead Source',             required: false },
        { key: 'subscriptionPackageName', label: 'Subscription Package', required: false },
        { key: 'subscriptionRate',  label: 'Subscription Rate',       required: false },
        { key: 'currency',          label: 'Currency',                required: false },
        { key: 'billingAddress',    label: 'Billing Address',         required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        { key: 'currentNeeds',      label: 'Current Needs',           required: false },
        { key: 'currentChallenges', label: 'Current Challenges',      required: false },
        { key: 'interests',         label: 'Interests',               required: false },
    ],
    person: [
        { key: 'firstName',         label: 'First Name',              required: false },
        { key: 'lastName',          label: 'Last Name',               required: false },
        { key: 'contact_0_email',   label: 'Contact Email',           required: false },
        { key: 'contact_0_phone',   label: 'Contact Phone',           required: false },
        { key: 'company',           label: 'Company / Organisation',  required: false },
        { key: 'jobTitle',          label: 'Job Title',               required: false },
        { key: 'leadSource',        label: 'Lead Source',             required: false },
        { key: 'status',            label: 'Status',                  required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        { key: 'currentNeeds',      label: 'Current Needs',           required: false },
        { key: 'currentChallenges', label: 'Current Challenges',      required: false },
        { key: 'interests',         label: 'Interests',               required: false },
    ],
    family: [
        { key: 'contact_0_name',    label: 'Guardian Name',           required: true },
        { key: 'contact_0_email',   label: 'Contact Email',           required: false },
        { key: 'contact_0_phone',   label: 'Contact Phone',           required: false },
        { key: 'contact_0_role',    label: 'Guardian Relationship',   required: false },
        { key: 'leadSource',        label: 'Lead Source',             required: false },
        { key: 'status',            label: 'Status',                  required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        { key: 'currentNeeds',      label: 'Current Needs',           required: false },
        { key: 'currentChallenges', label: 'Current Challenges',      required: false },
        { key: 'interests',         label: 'Interests',               required: false },
    ],
};

type StepName = 'UPLOAD' | 'MAPPING' | 'SETTINGS' | 'PREVIEW' | 'EXECUTING' | 'COMPLETE' | 'CORRECTION';

export default function BulkUploadClient() {
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const terms = useTerminology();
    const { activeWorkspace } = useWorkspace();
    const firestore = useFirestore();
    const contactScope = activeWorkspace?.contactScope || 'institution';

    // Fetch lists for default settings steps
    const regionsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'regions'), orderBy('name')) : null,
    [firestore]);
    const { data: regionsList } = useCollection<any>(regionsQuery);

    const districtsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'districts'), orderBy('name')) : null,
    [firestore]);
    const { data: districtsList } = useCollection<any>(districtsQuery);

    const packagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'subscription_packages'), where('isActive', '==', true)) : null,
    [firestore]);
    const { data: packagesList } = useCollection<any>(packagesQuery);

    const modulesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        const orgId = activeWorkspace?.organizationId || 'smartsapp-hq';
        return query(
            collection(firestore, 'modules'), 
            where('organizationId', '==', orgId),
            orderBy('order')
        );
    }, [firestore, activeWorkspace?.organizationId]);
    const { data: modulesList } = useCollection<any>(modulesQuery);

    const pipelinesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pipelines'), orderBy('name', 'asc')) : null,
    [firestore]);
    const { data: pipelinesList } = useCollection<any>(pipelinesQuery);

    const stagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc')) : null,
    [firestore]);
    const { data: stagesList } = useCollection<any>(stagesQuery);

    const automationsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(
                collection(firestore, 'automations'), 
                where('workspaceIds', 'array-contains', activeWorkspace.id),
                where('isActive', '==', true)
            ) : null, 
    [firestore, activeWorkspace?.id]);
    const { data: automationsList } = useCollection<any>(automationsQuery);

    const appFieldsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspace?.id) return null;
        return query(
            collection(firestore, 'app_fields'),
            where('workspaceId', '==', activeWorkspace.id),
            where('status', '==', 'active')
        );
    }, [firestore, activeWorkspace?.id]);
    const { data: appFieldsList } = useCollection<any>(appFieldsQuery);

    // States
    const [currentStep, setCurrentStep] = React.useState<StepName>('UPLOAD');
    const [fileName, setFileName] = React.useState('');
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [rawData, setRawData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [defaultValues, setDefaultValues] = React.useState<Record<string, string>>({});
    const [contactSlotCount, setContactSlotCount] = React.useState(1);
    const [selectedGlobalTags, setSelectedGlobalTags] = React.useState<string[]>([]);
    const [autoCreateTags, setAutoCreateTags] = React.useState(false);
    const [enableTitleCase, setEnableTitleCase] = React.useState(false);
    const [createDealForImport, setCreateDealForImport] = React.useState(false);
    const [dealImportConfig, setDealImportConfig] = React.useState<DealImportConfig>({
        pipelineId: '',
        stageId: '',
        nameTemplate: '{{name}}',
        value: 0,
        suppressAutomations: true,
        assignmentStrategy: 'pipeline',
    });
    const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
    const [notificationConfig, setNotificationConfig] = React.useState<NotificationConfig>({
        sendInAppNotification: true,
        sendEmailNotification: true,
        sendSmsNotification: false,
    });
    const [lastImportLogId, setLastImportLogId] = React.useState<string | null>(null);
    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);
    const [executionResults, setExecutionResults] = React.useState<{ row: number; status: 'success' | 'error'; entityName?: string; error?: string }[]>([]);
    const [failedRowIndices, setFailedRowIndices] = React.useState<number[]>([]);

    // Subscribe to import log changes
    const importLogRef = useMemoFirebase(() => {
        if (!firestore || !lastImportLogId) return null;
        return doc(firestore, 'import_logs', lastImportLogId);
    }, [firestore, lastImportLogId]);
    const { data: activeImportLog } = useDoc<any>(importLogRef);

    const workspaceStatuses = React.useMemo(() => {
        if (activeWorkspace?.statuses && activeWorkspace.statuses.length > 0) {
            return activeWorkspace.statuses;
        }
        return [
            { value: 'Onboarding', label: 'Onboarding', color: '#3B5FFF' },
            { value: 'Active', label: 'Active', color: '#10b981' },
            { value: 'Churned', label: 'Churned', color: '#ef4444' }
        ];
    }, [activeWorkspace]);

    // Build fields dynamically
    const TARGET_FIELDS = React.useMemo(() => {
        const advanced = ADVANCED_TEMPLATE_FIELDS[contactScope] || ADVANCED_TEMPLATE_FIELDS.institution;
        const merged = [...advanced];
        
        BASE_TARGET_FIELDS.forEach(bf => {
            if (!merged.find(f => f.key === bf.key)) merged.push(bf);
        });

        // Merge active, non-hidden custom fields compatible with the current contact scope
        if (appFieldsList) {
            appFieldsList.forEach((field: any) => {
                const key = field.variableName;
                const label = field.label || field.name;
                const isCompatible = field.compatibilityScope?.includes('common') || 
                                     field.compatibilityScope?.includes(contactScope);
                
                if (key && field.type !== 'hidden' && isCompatible) {
                    if (!merged.find(f => f.key === key)) {
                        merged.push({
                            key: key,
                            label: label,
                            required: false
                        });
                    }
                }
            });
        }

        const mapped = merged.map(f => f.key === 'name' ? { ...f, label: `${terms.singular} Name` } : f);
        return mapped.sort((a, b) => a.key === 'name' ? -1 : b.key === 'name' ? 1 : 0);
    }, [contactScope, terms.singular, appFieldsList]);

    const allMappableFields = React.useMemo(() => {
        const entityFields = TARGET_FIELDS.filter(f => !f.key.startsWith('contact_'));
        const contactFields: { key: string; label: string; required: boolean }[] = [];
        for (let i = 0; i < contactSlotCount; i++) {
            const prefix = i === 0 ? '' : ` ${i + 1}`;
            contactFields.push(
                { key: `contact_${i}_name`,  label: `Contact${prefix} Name`,  required: false },
                { key: `contact_${i}_email`, label: `Contact${prefix} Email`, required: false },
                { key: `contact_${i}_phone`, label: `Contact${prefix} Phone`, required: false },
                { key: `contact_${i}_role`,  label: `Contact${prefix} Role`,  required: false },
            );
        }
        return [...entityFields, ...contactFields];
    }, [TARGET_FIELDS, contactSlotCount]);

    const autoMapHeaders = (fileHeaders: string[]) => {
        setCurrentStep('MAPPING');
        const initialMapping: Record<string, string> = {};
        const mappedHeaders = new Set<string>();
        
        // Exact matches
        allMappableFields.forEach(f => {
            const targetLabel = f.label.toLowerCase();
            const targetKey = f.key.toLowerCase();
            
            const exactMatch = fileHeaders.find(header => {
                const h = header.toLowerCase().trim();
                return h === targetLabel || h === targetKey;
            });
            
            if (exactMatch) {
                initialMapping[f.key] = exactMatch;
                mappedHeaders.add(exactMatch);
            }
        });
        
        // Heuristic matches
        fileHeaders.forEach(header => {
            if (mappedHeaders.has(header)) return;
            const h = header.toLowerCase().trim();
            let matchedKey: string | null = null;
            
            if (h.includes('name') && !h.includes('contact') && !initialMapping['name']) {
                matchedKey = 'name';
            } else if (h.includes('organization') && contactScope === 'institution' && !initialMapping['name']) {
                matchedKey = 'name';
            }
            
            if (matchedKey) {
                initialMapping[matchedKey] = header;
                mappedHeaders.add(header);
            }
        });

        setMapping(initialMapping);
    };

    const handleFileProcessed = (pFileName: string, pHeaders: string[], pData: any[]) => {
        setFileName(pFileName);
        setHeaders(pHeaders);
        setRawData(pData);
        autoMapHeaders(pHeaders);
    };

    const startExecution = async (indicesToProcess?: number[]) => {
        if (!user || !activeWorkspace?.id) return;
        const rowsToProcess = indicesToProcess 
            ? indicesToProcess.map(i => rawData[i])
            : rawData;
        
        setCurrentStep('EXECUTING');
        setExecutionResults([]);

        if (defaultValues['leadSource'] && activeWorkspace?.id) {
            const val = defaultValues['leadSource'];
            const baseSources = ['Referral', 'Website', 'Social Media', 'Event', 'Partner', 'Cold Outreach', 'Other'];
            if (!baseSources.includes(val)) {
                const customSources = activeWorkspace.customLeadSources || [];
                if (!customSources.includes(val)) {
                    try {
                        const wsRef = doc(firestore, 'workspaces', activeWorkspace.id);
                        await updateDoc(wsRef, {
                            customLeadSources: arrayUnion(val)
                        });
                    } catch (err) {
                        console.error("Failed to save custom lead source to workspace", err);
                    }
                }
            }
        }

        try {
            const sanitizedRows = JSON.parse(JSON.stringify(rowsToProcess));
            const sanitizedMapping = JSON.parse(JSON.stringify(mapping));
            const sanitizedDefaultValues = JSON.parse(JSON.stringify(defaultValues));

            const result = await ingestBatchAction({
                rows: sanitizedRows,
                mapping: sanitizedMapping,
                userId: user.uid,
                filename: fileName,
                workspaceId: activeWorkspace.id,
                organizationId: activeWorkspace.organizationId || 'smartsapp-hq',
                entityType: contactScope,
                autoCreateTags,
                defaultValues: sanitizedDefaultValues,
                globalTagIds: selectedGlobalTags,
                automationId: selectedAutomationId || undefined,
                manualTagNames: [],
                enableTitleCase,
                dealConfig: createDealForImport ? dealImportConfig : undefined,
                notificationConfig
            });

            setLastImportLogId(result.importLogId);
            toast({ 
                title: 'Import Queued', 
                description: `${sanitizedRows.length} records are being processed in the background.` 
            });
            setCurrentStep('COMPLETE');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Import Failed', description: e.message });
            setCurrentStep('PREVIEW');
        }
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

    // Stepper logic
    const flowSteps = [
        { id: 'UPLOAD',   label: 'Upload',   icon: Upload },
        { id: 'MAPPING',  label: 'Map',      icon: Map },
        { id: 'SETTINGS', label: 'Settings', icon: Settings2 },
        { id: 'PREVIEW',  label: 'Preview',  icon: Eye },
        { id: 'COMPLETE', label: 'Done',     icon: PartyPopper },
    ];
    
    const activeIdx = currentStep === 'EXECUTING'
        ? 3
        : currentStep === 'CORRECTION'
            ? 4
            : flowSteps.findIndex(s => s.id === currentStep);

    const stepperMarkup = (
        <div className="w-full">
            <div className="relative mx-auto max-w-2xl px-4 py-6">
                <div className="absolute top-[48px] left-[10%] right-[10%] h-[1px] bg-primary/20 hidden sm:block" />
                <div
                    className="absolute top-[48px] left-[10%] h-[1px] bg-primary transition-all duration-700 ease-in-out hidden sm:block"
                    style={{ width: `${(Math.max(0, activeIdx) / (flowSteps.length - 1)) * 80}%` }}
                />
                <div className="relative grid grid-cols-5 gap-0">
                    {flowSteps.map((step, idx) => {
                        const StepIcon = step.icon;
                        const isPast    = idx < activeIdx;
                        const isCurrent = idx === activeIdx;
                        return (
                            <div key={step.id} className="flex flex-col items-center gap-3">
                                <div className={cn(
                                    "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
                                    isPast
                                        ? "bg-primary text-white shadow-primary/20"
                                        : isCurrent
                                            ? "bg-white dark:bg-slate-900 text-primary border-2 border-primary/20 shadow-xl scale-110"
                                            : "bg-white/50 dark:bg-slate-900/50 text-muted-foreground border border-border"
                                )}>
                                    {isPast
                                        ? <Check size={20} strokeWidth={3} />
                                        : <StepIcon size={20} />}
                                    {isCurrent && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-white dark:border-slate-900 shadow-sm" />
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest transition-colors text-center leading-none hidden sm:block",
                                    isCurrent ? "text-primary" : "text-muted-foreground/60"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-full py-4 space-y-6 relative">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none -z-10" />

            <div className="max-w-5xl mx-auto w-full px-4 pb-20 space-y-6">
                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <UploadStep
                            key="upload"
                            terms={terms}
                            contactScope={contactScope}
                            activeWorkspace={activeWorkspace}
                            onFileProcessed={handleFileProcessed}
                            stepperMarkup={stepperMarkup}
                        />
                    )}

                    {currentStep === 'MAPPING' && (
                        <MappingStep
                            key="mapping"
                            terms={terms}
                            contactScope={contactScope}
                            activeWorkspace={activeWorkspace}
                            headers={headers}
                            rawData={rawData}
                            mapping={mapping}
                            setMapping={setMapping}
                            defaultValues={defaultValues}
                            setDefaultValues={setDefaultValues}
                            contactSlotCount={contactSlotCount}
                            setContactSlotCount={setContactSlotCount}
                            allMappableFields={allMappableFields}
                            regionsList={regionsList}
                            districtsList={districtsList}
                            packagesList={packagesList}
                            modulesList={modulesList}
                            workspaceStatuses={workspaceStatuses}
                            onBack={() => setCurrentStep('UPLOAD')}
                            onNext={() => setCurrentStep('SETTINGS')}
                            stepperMarkup={stepperMarkup}
                            appFieldsList={appFieldsList}
                        />
                    )}

                    {currentStep === 'SETTINGS' && (
                        <DefaultSettingsStep
                            key="settings"
                            selectedGlobalTags={selectedGlobalTags}
                            setSelectedGlobalTags={setSelectedGlobalTags}
                            autoCreateTags={autoCreateTags}
                            setAutoCreateTags={setAutoCreateTags}
                            enableTitleCase={enableTitleCase}
                            setEnableTitleCase={setEnableTitleCase}
                            createDealForImport={createDealForImport}
                            setCreateDealForImport={setCreateDealForImport}
                            dealImportConfig={dealImportConfig}
                            setDealImportConfig={setDealImportConfig}
                            pipelinesList={pipelinesList}
                            stagesList={stagesList}
                            selectedAutomationId={selectedAutomationId}
                            setSelectedAutomationId={setSelectedAutomationId}
                            automationsList={automationsList}
                            notificationConfig={notificationConfig}
                            setNotificationConfig={setNotificationConfig}
                            onBack={() => setCurrentStep('MAPPING')}
                            onNext={() => setCurrentStep('PREVIEW')}
                            stepperMarkup={stepperMarkup}
                        />
                    )}

                    {currentStep === 'PREVIEW' && (
                        <ImportPreviewStep
                            key="preview"
                            terms={terms}
                            rawData={rawData}
                            mapping={mapping}
                            targetFields={TARGET_FIELDS}
                            onBack={() => setCurrentStep('SETTINGS')}
                            onExecute={() => startExecution()}
                            stepperMarkup={stepperMarkup}
                        />
                    )}

                    {currentStep === 'EXECUTING' && (
                        <ExecutionStep
                            key="executing"
                            totalRows={rawData.length}
                            entityPluralName={terms.plural}
                            workspaceName={activeWorkspace?.name}
                        />
                    )}

                    {currentStep === 'COMPLETE' && (
                        <CompleteStep
                            key="complete"
                            terms={terms}
                            rawData={rawData}
                            failedRowIndices={failedRowIndices}
                            executionResults={executionResults}
                            activeImportLog={activeImportLog}
                            lastImportLogId={lastImportLogId}
                            onImportAnother={() => {
                                setRawData([]);
                                setExecutionResults([]);
                                setFailedRowIndices([]);
                                setCurrentStep('UPLOAD');
                            }}
                            onViewImports={() => router.push(`/admin/entities/imports${lastImportLogId ? `?logId=${lastImportLogId}` : ''}`)}
                            onGoToEntities={() => router.push('/admin/entities')}
                            onStartCorrection={() => setCurrentStep('CORRECTION')}
                        />
                    )}

                    {currentStep === 'CORRECTION' && (
                        <CorrectionStep
                            key="correction"
                            terms={terms}
                            failedRowIndices={failedRowIndices}
                            setFailedRowIndices={setFailedRowIndices}
                            rawData={rawData}
                            mapping={mapping}
                            executionResults={executionResults}
                            setEditingRowIdx={setEditingRowIdx}
                            onReExecute={startExecution}
                            onBack={() => setCurrentStep('COMPLETE')}
                        />
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
