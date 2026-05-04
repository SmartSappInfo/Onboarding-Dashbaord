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
    Zap,
    Plus,
    UserPlus,
    Trash2,
    Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
// AI Mapping removed in favor of exact string matching
import { ingestBatchAction, type BatchResult } from '@/lib/bulk-upload-actions';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
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

type Step = 'UPLOAD' | 'MAPPING' | 'SETTINGS' | 'PREVIEW' | 'EXECUTING' | 'COMPLETE' | 'CORRECTION';


/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BULK IMPORT FIELD REGISTRY
 * ─────────────────────────────────────────────────────────────────────────────
 * GOVERNANCE: When you add/rename/remove fields in the NewEntityPage form,
 * you MUST update these three areas:
 *   1. SIMPLE_TEMPLATE_FIELDS — the basic starter columns (name, email, phone)
 *   2. ADVANCED_TEMPLATE_FIELDS — all importable fields, keyed by contactScope
 *   3. SAMPLE_ROWS — realistic sample data rows for each industry
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** 
 * Base fields shown in the mapping step (always visible regardless of scope).
 * NOTE: Contact fields (name, email, phone, role) are handled separately
 * via the dynamic contact slot system — NOT listed here.
 */
const BASE_TARGET_FIELDS = [
    { key: 'name',          label: 'Name',                    required: true },
    { key: 'status',        label: 'Status',                  required: false },
    { key: 'lifecycleStatus', label: 'Operational State',     required: false },
    { key: 'locationString', label: 'Physical Address',       required: false },
    { key: 'locationRegion', label: 'Region',                 required: false },
    { key: 'locationDistrict', label: 'District',             required: false },
    { key: 'workspaceTags', label: 'Tags (Comma Separated)',  required: false },
    { key: 'currentNeeds',     label: 'Current Needs',        required: false },
    { key: 'currentChallenges', label: 'Current Challenges',  required: false },
    { key: 'interests',        label: 'Interests',            required: false },
];

/** 
 * Simple template: the minimal columns to get started.
 * Same across all industries. 
 */
const SIMPLE_TEMPLATE_FIELDS = [
    { key: 'contact_0_name',  label: 'Contact Name',    required: true },
    { key: 'contact_0_email', label: 'Contact Email',   required: false },
    { key: 'contact_0_phone', label: 'Contact Phone',   required: false },
    { key: 'company',         label: 'Organization',    required: false },
];

const SIMPLE_SAMPLE_ROW: Record<string, string> = {
    'Contact Name':    'Kwame Asante',
    'Contact Email':   'info@gis.edu.gh',
    'Contact Phone':   '+233302777163',
    'Organization':    'Ghana International School',
};

/** 
 * Advanced template fields keyed by contactScope.
 * Add/update when fields are added to the NewEntityPage form.
 */
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
        { key: 'lifecycleStatus',   label: 'Operational State',       required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'leadSource',        label: 'Lead Source',             required: false },
        { key: 'subscriptionPackageName', label: 'Subscription Package', required: false },
        { key: 'subscriptionRate',  label: 'Subscription Rate',       required: false },
        { key: 'currency',          label: 'Currency',                required: false },
        { key: 'billingAddress',    label: 'Billing Address',         required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        // ── Narrative Fields (all industries) ────────────────────────────────
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
        { key: 'lifecycleStatus',   label: 'Operational State',       required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        // ── Narrative Fields (all industries) ────────────────────────────────
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
        { key: 'lifecycleStatus',   label: 'Operational State',       required: false },
        { key: 'locationString',    label: 'Physical Address',        required: false },
        { key: 'locationRegion',    label: 'Region',                  required: false },
        { key: 'locationDistrict',  label: 'District',                required: false },
        { key: 'workspaceTags',     label: 'Tags (Comma Separated)',  required: false },
        // ── Narrative Fields (all industries) ────────────────────────────────
        { key: 'currentNeeds',      label: 'Current Needs',           required: false },
        { key: 'currentChallenges', label: 'Current Challenges',      required: false },
        { key: 'interests',         label: 'Interests',               required: false },
    ],
};

/** Sample data rows for each industry — shown in the downloaded template */
const ADVANCED_SAMPLE_ROWS: Record<string, Record<string, string>> = {
    institution: {
        'Organization':          'Ghana International School',
        'Initials / Acronym':    'GIS',
        'Motto / Slogan':        'Excellence in Education',
        'Nominal Roll':          '1500',
        'Contact Name':          'Dr. Mary Ashun',
        'Contact Email':         'info@gis.edu.gh',
        'Contact Phone':         '+233302777163',
        'Contact Role':          'Principal',
        'Status':                'active',
        'Operational State':     'Active',
        'Physical Address':      'Cantonments Road, Accra',
        'Region':                'Greater Accra',
        'District':              'Accra Metropolitan',
        'Lead Source':           'Referral',
        'Subscription Package':  'Level A (Platinum)',
        'Subscription Rate':     '89.95',
        'Currency':              'GHS',
        'Billing Address':       'P.O. Box 845 Accra',
        'Tags (Comma Separated)': 'Private,International',
        'Current Needs':         'Learning management system integration',
        'Current Challenges':    'Managing student attendance digitally',
        'Interests':             'EdTech, Sports, Arts',
    },
    person: {
        'First Name':            'John',
        'Last Name':             'Mensah',
        'Contact Email':         'john.mensah@example.com',
        'Contact Phone':         '+233244123456',
        'Company / Organisation': 'Acme Corp',
        'Job Title':             'Sales Manager',
        'Lead Source':           'Website',
        'Status':                'active',
        'Operational State':     'Onboarding',
        'Physical Address':      '45 Liberation Road, Accra',
        'Region':                'Greater Accra',
        'District':              'Accra Metropolitan',
        'Tags (Comma Separated)': 'Hot Lead,Follow Up',
        'Current Needs':         'CRM software for team',
        'Current Challenges':    'Tracking leads manually',
        'Interests':             'Technology, Sales Automation',
    },
    family: {
        'Guardian Name':         'Kwame Asante',
        'Contact Email':         'kwame.asante@example.com',
        'Contact Phone':         '+233201234567',
        'Guardian Relationship': 'Father',
        'Lead Source':           'Referral',
        'Status':                'active',
        'Operational State':     'Onboarding',
        'Physical Address':      '12 Airport Residential Area, Accra',
        'Region':                'Greater Accra',
        'District':              'Accra Metropolitan',
        'Tags (Comma Separated)': 'New Family',
        'Current Needs':         'After-school program',
        'Current Challenges':    'Work-school schedule conflicts',
        'Interests':             'STEM, Football, Music',
    },
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
    const fieldsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(collection(firestore, 'app_fields'), where('workspaceId', '==', activeWorkspace.id), where('status', '==', 'active'))
            : null,
    [firestore, activeWorkspace?.id]);
    const { data: registryFields } = useCollection<any>(fieldsQuery);

    // Fetch Workspace Tags
    const tagsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspace.id))
            : null,
    [firestore, activeWorkspace?.id]);
    const { data: tagsList } = useCollection<any>(tagsQuery);

    // Fetch Workspace Automations
    const automationsQuery = useMemoFirebase(() => 
        firestore && activeWorkspace?.id 
            ? query(
                collection(firestore, 'automations'), 
                where('workspaceIds', 'array-contains', activeWorkspace.id),
                where('isActive', '==', true)
            ) : null, 
    [firestore, activeWorkspace?.id]);
    const { data: automationsList } = useCollection<any>(automationsQuery);

    // Build TARGET_FIELDS from the advanced template fields + base fallback for the mapping step
    // Override the 'name' field label with the workspace's custom entity terminology
    const TARGET_FIELDS = React.useMemo(() => {
        const advanced = ADVANCED_TEMPLATE_FIELDS[contactScope] || ADVANCED_TEMPLATE_FIELDS.institution;
        // Merge advanced fields with base fields, deduplicating by key
        const merged = [...advanced];
        BASE_TARGET_FIELDS.forEach(bf => {
            if (!merged.find(f => f.key === bf.key)) merged.push(bf);
        });
        // Apply workspace terminology to the name field
        const mapped = merged.map(f => f.key === 'name' ? { ...f, label: `${terms.singular} Name` } : f);
        // Ensure 'name' is always at the very top of the list
        return mapped.sort((a, b) => a.key === 'name' ? -1 : b.key === 'name' ? 1 : 0);
    }, [contactScope, terms.singular]);

    const [currentStep, setCurrentStep] = React.useState<Step>('UPLOAD');
    const [fileName, setFileName] = React.useState('');
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [rawData, setRawData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [isAiMapping, setIsAiMapping] = React.useState(false);
    const [autoCreateTags, setAutoCreateTags] = React.useState(false);
    
    // ── Additional Import Settings ───────────────────────────────────────────
    const [defaultValues, setDefaultValues] = React.useState<Record<string, string>>({});
    const [selectedGlobalTags, setSelectedGlobalTags] = React.useState<string[]>([]);
    const [manualTags, setManualTags] = React.useState<string[]>([]);
    const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
    
    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);
    const [executionResults, setExecutionResults] = React.useState<{ row: number; status: 'success' | 'error'; entityName?: string; error?: string }[]>([]);
    const [currentRowIdx, setCurrentRowIdx] = React.useState(0);
    const [failedRowIndices, setFailedRowIndices] = React.useState<number[]>([]);

    // ── Dynamic Contact Slots ────────────────────────────────────────────────
    // Each slot represents one entity contact with name, email, phone, role fields
    const [contactSlotCount, setContactSlotCount] = React.useState(1);

    // Build the full list of mappable fields: entity fields + dynamic contact slots
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

    // Template download — scope-aware targeting the correct ADVANCED_TEMPLATE_FIELDS
    const handleDownloadTemplate = (mode: 'simple' | 'advanced' = 'simple') => {
        const wsName = (activeWorkspace?.name || 'SmartSapp').replace(/\s+/g, '_');

        if (mode === 'simple') {
            const headers = SIMPLE_TEMPLATE_FIELDS.map(f => f.label);
            const sampleValues = headers.map(h => SIMPLE_SAMPLE_ROW[h] || '');
            const csvContent = headers.map(h => `"${h}"`).join(',') + '\n' + sampleValues.map(v => `"${v}"`).join(',') + '\n';
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${wsName}_${terms.singular}_Simple_Template.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const fields = (ADVANCED_TEMPLATE_FIELDS[contactScope] || ADVANCED_TEMPLATE_FIELDS.institution)
                .map(f => f.key === 'name' ? { ...f, label: `${terms.singular} Name` } : f);
            const sampleRow = ADVANCED_SAMPLE_ROWS[contactScope] || ADVANCED_SAMPLE_ROWS.institution;
            const headers = fields.map(f => f.label);
            // Map sample values, falling back to the static 'Entity Name' key for the name field
            const sampleValues = headers.map(h => sampleRow[h] || (h === `${terms.singular} Name` ? sampleRow['Entity Name'] || '' : ''));
            const csvContent = headers.map(h => `"${h}"`).join(',') + '\n' + sampleValues.map(v => `"${v}"`).join(',') + '\n';
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${wsName}_${terms.singular}_Advanced_Template.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
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
                
                // Automatically map fields using column headers
                autoMapHeaders(h);
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

    const autoMapHeaders = (fileHeaders: string[]) => {
        setCurrentStep('MAPPING');
        setIsAiMapping(true); // Briefly show loading state for UX
        
        setTimeout(() => {
            const initialMapping: Record<string, string> = {};
            
            fileHeaders.forEach(header => {
                const h = header.toLowerCase().trim();
                
                // Find a matching field in our system fields
                let match = allMappableFields.find(f => 
                    f.label.toLowerCase() === h || 
                    f.key.toLowerCase() === h ||
                    (f.key === 'name' && h.includes('name') && !h.includes('contact'))
                );
                
                // By Default, link the organization name to the entity for contact type institutions
                if (h.includes('organization') && contactScope === 'institution') {
                    match = allMappableFields.find(f => f.key === 'name');
                }
                
                if (match) {
                    initialMapping[match.key] = header;
                }
            });

            setMapping(initialMapping as any);
            setIsAiMapping(false);
        }, 300);
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
            const sanitizedDefaultValues = JSON.parse(JSON.stringify(defaultValues));

            const batch = await ingestBatchAction(
                sanitizedRows,
                sanitizedMapping,
                user.uid,
                fileName,
                activeWorkspace.id,
                activeWorkspace.organizationId || 'smartsapp-hq',
                contactScope,
                autoCreateTags,
                sanitizedDefaultValues,
                selectedGlobalTags,
                selectedAutomationId || undefined,
                manualTags
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

    const flowSteps = [
        { id: 'UPLOAD', label: 'Upload Data' },
        { id: 'MAPPING', label: 'Map Columns' },
        { id: 'SETTINGS', label: 'Import Settings' },
        { id: 'PREVIEW', label: 'Preview & Run' },
        { id: 'COMPLETE', label: 'Finished' },
    ];
    
    // Determine stepper index
    const activeIdx = currentStep === 'EXECUTING' ? 3 : currentStep === 'CORRECTION' ? 4 : flowSteps.findIndex(s => s.id === currentStep);

    return (
        <div className="h-full overflow-y-auto text-left relative z-0">
            {/* Main Background Gradient for the screen */}
            <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />

            <div className="space-y-8 max-w-5xl mx-auto w-full pt-8 pb-20">
                {/* Stepper UI */}
                {currentStep !== 'UPLOAD' && currentStep !== 'COMPLETE' && currentStep !== 'CORRECTION' && (
                    <div className="w-full flex justify-between items-center mb-12 px-4 sm:px-12 relative max-w-4xl mx-auto">
                        {/* Background Line */}
                        <div className="absolute top-5 left-16 right-16 h-[2px] bg-muted -z-10" />
                        {/* Progress Line */}
                        <div 
                            className="absolute top-5 left-16 h-[2px] bg-primary transition-all duration-500 ease-in-out -z-10" 
                            style={{ width: `calc(${(Math.max(0, activeIdx) / (flowSteps.length - 1)) * 100}% - 4rem)` }}
                        />
                        {flowSteps.map((step, idx) => {
                            const isPast = idx < activeIdx;
                            const isCurrent = idx === activeIdx;
                            return (
                                <div key={step.id} className="flex flex-col items-center gap-3 w-28">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm",
                                        isPast ? "bg-primary text-white" : 
                                        isCurrent ? "bg-background border-[3px] border-primary text-primary" : 
                                        "bg-muted/30 text-muted-foreground border border-border"
                                    )}>
                                        {isPast ? <Check size={18} strokeWidth={3} /> : idx + 1}
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-extrabold uppercase tracking-widest hidden sm:block transition-colors text-center",
                                        isCurrent ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" {...stepTransition} className="w-full">
                            
                            <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
                                <div>
                                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent pb-2">
                                        Account Import
                                    </h1>
                                    <p className="text-muted-foreground font-medium text-lg">
                                        Automate onboarding by mapping spreadsheet data instantly.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleDownloadTemplate('simple')} 
                                        className="gap-2 rounded-full font-bold shadow-sm border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all h-12 px-5 bg-background/50 backdrop-blur-md"
                                    >
                                        <Download size={16} className="text-primary" /> Simple Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleDownloadTemplate('advanced')} 
                                        className="gap-2 rounded-full font-bold shadow-sm border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5 transition-all h-12 px-5 bg-background/50 backdrop-blur-md text-violet-600 dark:text-violet-400"
                                    >
                                        <Download size={16} /> Advanced Template
                                    </Button>
                                </div>
                            </div>

                            <Card className="rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden bg-card/60 backdrop-blur-3xl relative">
                                {/* Subtle internal glow */}
                                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                                
                                <CardContent className="p-8 sm:p-16 relative z-10">
                                    <label htmlFor="bulk-file" className="w-full mx-auto block cursor-pointer group">
                                        <div className="border-[3px] border-dashed border-border/40 rounded-[3rem] p-16 sm:p-24 text-center transition-all duration-500 group-hover:border-primary/50 group-hover:bg-primary/[0.03] group-hover:shadow-inner flex flex-col items-center justify-center gap-8 relative overflow-hidden bg-background/30 backdrop-blur-sm">
                                            
                                            {/* Hover Glow Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                            
                                            <div className="p-8 bg-card rounded-3xl shadow-xl shadow-black/5 border border-border/50 group-hover:scale-110 group-hover:shadow-[0_0_40px_-10px] group-hover:shadow-primary/30 transition-all duration-500 relative z-10">
                                                <FileText size={56} className="text-primary" />
                                            </div>
                                            
                                            <div className="space-y-3 relative z-10">
                                                <p className="text-3xl font-bold tracking-tight group-hover:text-primary transition-colors duration-300">
                                                    Drop Document Here
                                                </p>
                                                <p className="text-muted-foreground font-medium text-base">
                                                    Supports .csv, .xlsx, .xls files
                                                </p>
                                            </div>
                                            
                                            <Input id="bulk-file" type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                                        </div>
                                    </label>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'MAPPING' && (
                        <motion.div key="mapping" {...stepTransition} className="w-full">
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
                                                Map each column from your file to a {terms.singular.toLowerCase()} field.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 space-y-8">
                                    {/* Contact Slots Controls & Explicit Mapping */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-lg font-bold">Entity Contacts Mapping</p>
                                                <p className="text-sm text-muted-foreground">Map your spreadsheet columns to specific contact properties.</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setContactSlotCount(c => c + 1)} className="gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 font-bold text-xs h-9 px-4 rounded-xl">
                                                <UserPlus size={14} /> Add Another Contact
                                            </Button>
                                        </div>

                                        {Array.from({ length: contactSlotCount }).map((_, idx) => (
                                            <div key={idx} className="p-5 rounded-xl border border-violet-200/50 bg-violet-500/5 relative">
                                                {idx > 0 && idx === contactSlotCount - 1 && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="absolute top-3 right-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8"
                                                        onClick={() => {
                                                            setMapping(prev => {
                                                                const next = { ...prev };
                                                                delete next[`contact_${idx}_name`];
                                                                delete next[`contact_${idx}_email`];
                                                                delete next[`contact_${idx}_phone`];
                                                                delete next[`contact_${idx}_role`];
                                                                return next;
                                                            });
                                                            setContactSlotCount(c => c - 1);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                )}
                                                <h4 className="font-bold text-sm mb-4 text-violet-700 flex items-center gap-2">
                                                    <Users size={16} /> Contact {idx + 1} {idx === 0 ? '(Primary & Signatory)' : ''}
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {['name', 'email', 'phone', 'role'].map(prop => {
                                                        const fieldKey = `contact_${idx}_${prop}`;
                                                        const currentHeader = mapping[fieldKey] || 'none';
                                                        return (
                                                            <div key={prop} className="space-y-1.5">
                                                                <Label className="text-xs font-semibold capitalize text-violet-800">{prop}</Label>
                                                                <Select 
                                                                    value={currentHeader}
                                                                    onValueChange={(headerVal) => {
                                                                        setMapping(prev => {
                                                                            const next = { ...prev };
                                                                            if (headerVal === 'none') {
                                                                                delete next[fieldKey];
                                                                            } else {
                                                                                Object.keys(next).forEach(k => {
                                                                                    if (next[k] === headerVal && k.startsWith('contact_')) delete next[k];
                                                                                });
                                                                                next[fieldKey] = headerVal;
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-10 bg-background border-violet-200 text-violet-900 font-semibold shadow-sm">
                                                                        <SelectValue placeholder="-- Unmapped --" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-[300px]">
                                                                        <SelectItem value="none">-- Unmapped --</SelectItem>
                                                                        {headers.map(h => {
                                                                            const mappedTo = Object.entries(mapping).find(([k, v]) => v === h && k.startsWith('contact_'))?.[0];
                                                                            const isUsed = mappedTo && mappedTo !== fieldKey;
                                                                            return (
                                                                                <SelectItem key={h} value={h} disabled={!!isUsed} className={cn(isUsed && "opacity-40 font-medium", !isUsed && "font-semibold")}>
                                                                                    {h} {isUsed ? `(Used)` : ''}
                                                                                </SelectItem>
                                                                            );
                                                                        })}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* CSV Column → Entity Field Mapping */}
                                    <div className="pt-8 border-t border-border/50">
                                        <div className="mb-6">
                                            <p className="text-lg font-bold">Additional {terms.singular} Details</p>
                                            <p className="text-sm text-muted-foreground">Map remaining columns to {terms.singular.toLowerCase()}-level properties.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                            {headers.map((csvHeader) => {
                                                const entityMappedFieldKey = Object.entries(mapping).find(([k, v]) => v === csvHeader && !k.startsWith('contact_'))?.[0] || 'none';
                                                const mappedContactFields = Object.entries(mapping).filter(([k, v]) => v === csvHeader && k.startsWith('contact_'));
                                                
                                                if (mappedContactFields.length > 0) {
                                                    return null;
                                                }

                                                return (
                                                    <div key={csvHeader} className="space-y-2">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
                                                            <FileText className="h-3 w-3 text-primary/50" />
                                                            {csvHeader}
                                                        </Label>
                                                        <Select 
                                                            value={entityMappedFieldKey} 
                                                            onValueChange={(entityKey) => {
                                                                setMapping(prev => {
                                                                    const next = { ...prev };
                                                                    Object.keys(next).forEach(k => {
                                                                        if (next[k] === csvHeader && !k.startsWith('contact_')) delete next[k];
                                                                    });
                                                                    if (entityKey !== 'none') {
                                                                        delete next[entityKey];
                                                                        next[entityKey] = csvHeader;
                                                                    }
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <SelectTrigger className={cn(
                                                                "h-12 rounded-xl border-none shadow-inner font-bold transition-colors",
                                                                entityMappedFieldKey === 'none' 
                                                                    ? "bg-background/50 text-muted-foreground"
                                                                    : "bg-primary/5 text-primary ring-1 ring-primary/20"
                                                            )}>
                                                                <SelectValue placeholder="-- Skip Column --" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl max-h-[350px]">
                                                                <SelectItem value="none">-- Skip Column --</SelectItem>
                                                                <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50 mt-1">Entity Fields</div>
                                                                {allMappableFields.filter(f => !f.key.startsWith('contact_')).map(f => {
                                                                    const alreadyMappedTo = mapping[f.key];
                                                                    const isUsed = alreadyMappedTo && alreadyMappedTo !== csvHeader;
                                                                    return (
                                                                        <SelectItem key={f.key} value={f.key} disabled={!!isUsed} className={cn("font-semibold", isUsed && "opacity-40")}>
                                                                            {f.label} {f.required ? '(Required)' : ''} {isUsed ? `← ${alreadyMappedTo}` : ''}
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Default Values Controls */}
                                    <div className="pt-6 border-t border-border/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-amber-500/10 rounded-xl"><Plus size={16} className="text-amber-600" /></div>
                                                <div>
                                                    <p className="text-sm font-bold">Default Field Values</p>
                                                    <p className="text-[10px] text-muted-foreground font-medium">Apply a fixed value to all records if missing or unmapped</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Select onValueChange={(key) => {
                                                    if (key && key !== 'none' && defaultValues[key] === undefined) {
                                                        setDefaultValues(prev => ({ ...prev, [key]: '' }));
                                                    }
                                                }} value="none">
                                                    <SelectTrigger className="h-9 px-4 rounded-xl border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold text-xs gap-1.5 w-[180px]">
                                                        <Plus size={14} /> Add Default
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl max-h-[300px]">
                                                        <SelectItem value="none" className="hidden">Select Field...</SelectItem>
                                                        {allMappableFields.filter(f => 
                                                            defaultValues[f.key] === undefined && 
                                                            !(mapping[f.key] && mapping[f.key] !== 'none') && 
                                                            !f.key.startsWith('contact_')
                                                        ).map(f => (
                                                            <SelectItem key={f.key} value={f.key} className="font-semibold">{f.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {Object.keys(defaultValues).length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                                {Object.entries(defaultValues).map(([key, val]) => {
                                                    const field = allMappableFields.find(f => f.key === key);
                                                    return (
                                                        <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/30">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] font-bold text-muted-foreground flex items-center gap-2">
                                                                    {field?.label || key}
                                                                </Label>
                                                                <button onClick={() => {
                                                                    setDefaultValues(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[key];
                                                                        return next;
                                                                    });
                                                                }} className="text-muted-foreground hover:text-rose-500 transition-colors">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                            <Input 
                                                                value={val} 
                                                                onChange={e => setDefaultValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                                placeholder="Enter value..."
                                                                className="h-8 text-xs bg-background"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Mapping summary */}
                                    <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            Mapped: {Object.keys(mapping).filter(k => mapping[k] && mapping[k] !== 'none').length} of {headers.length} columns
                                        </p>
                                        <Badge variant="outline" className="text-[10px] font-bold border-violet-200 text-violet-600 bg-violet-500/5">
                                            {Object.keys(mapping).filter(k => k.startsWith('contact_') && mapping[k] && mapping[k] !== 'none').length} contact fields mapped
                                        </Badge>
                                    </div>
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
                                    <Button 
                                        onClick={() => setCurrentStep('SETTINGS')} 
                                        disabled={(!mapping['name'] && !mapping['contact_0_name']) || !activeWorkspace?.id} 
                                        className="w-full h-16 rounded-[1.5rem] font-semibold text-xl shadow-2xl bg-primary text-white gap-3"
                                    >
                                        Continue to Settings <ArrowRight size={24} />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── SETTINGS STEP ─── */}
                    {currentStep === 'SETTINGS' && (
                        <motion.div key="settings" {...stepTransition} className="w-full">
                            <div className="flex items-center justify-between mb-8">
                                <Button variant="ghost" onClick={() => setCurrentStep('MAPPING')} className="font-bold gap-2">
                                    <ArrowLeft size={16} /> Back to Mapping
                                </Button>
                            </div>
                            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                                <CardHeader className="bg-card/20 border-b p-8 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-2xl font-semibold">Import Settings</CardTitle>
                                    <CardDescription className="text-sm font-medium">Configure tags and automations for the imported records.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 space-y-12">
                                    {/* Global Tags Section */}
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-bold">Apply Tags</h3>
                                            <p className="text-sm text-muted-foreground">Select tags to apply to all records in this batch import.</p>
                                        </div>
                                        
                                        <MultiSelect
                                            options={[
                                                ...(tagsList?.map((t: any) => ({ label: t.name, value: t.id })) || []),
                                                ...manualTags.map((t: string) => ({ label: t, value: t }))
                                            ]}
                                            value={selectedGlobalTags}
                                            onChange={setSelectedGlobalTags}
                                            placeholder="Create or Search Tags"
                                            onCreate={(newTagName) => {
                                                if (!manualTags.includes(newTagName)) {
                                                    setManualTags(prev => [...prev, newTagName]);
                                                    setSelectedGlobalTags(prev => [...prev, newTagName]);
                                                }
                                            }}
                                        />

                                        <div className="w-full p-4 mt-6 rounded-xl bg-background border flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-sm">Auto-Create Missing Mapped Tags</p>
                                                    <p className="text-xs text-muted-foreground">If a tag in the CSV doesn't exist, create it automatically.</p>
                                                </div>
                                                <Switch checked={autoCreateTags} onCheckedChange={setAutoCreateTags} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Automations Section */}
                                    <div className="space-y-4 pt-8 border-t">
                                        <div>
                                            <h3 className="text-lg font-bold">Trigger Automation</h3>
                                            <p className="text-sm text-muted-foreground">Launch an automation workflow for every successfully imported record.</p>
                                        </div>

                                        <Select value={selectedAutomationId || 'none'} onValueChange={(val) => setSelectedAutomationId(val === 'none' ? null : val)}>
                                            <SelectTrigger className="w-full h-12 rounded-xl bg-background">
                                                <SelectValue placeholder="Do not trigger any specific automation" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none" className="font-semibold">Do not trigger any automation</SelectItem>
                                                {automationsList?.map((auto: any) => (
                                                    <SelectItem key={auto.id} value={auto.id} className="font-semibold">
                                                        {auto.name} <span className="text-xs text-muted-foreground font-normal ml-2">({auto.trigger})</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] font-bold text-muted-foreground mt-2">
                                            Note: The default "Record Created" automations may still run based on your workspace settings.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-primary/5 p-10 border-t">
                                    <Button onClick={() => setCurrentStep('PREVIEW')} className="w-full h-16 rounded-[1.5rem] font-semibold text-xl shadow-2xl bg-primary text-white gap-3">
                                        Review & Import <ArrowRight size={24} />
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
                                <CardHeader className="bg-card/20 border-b p-8 flex flex-row items-center justify-between space-y-0">
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
                                <CardFooter className="p-8 border-t bg-primary/5">
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
                            <Card className="rounded-[2.5rem] border border-border shadow-2xl overflow-hidden bg-card relative">
                                <CardHeader className={cn("py-16 text-center border-b relative overflow-hidden", failedRowIndices.length === 0 ? "bg-emerald-500/5" : "bg-rose-500/5")}>
                                    {/* Background Ambient Glow */}
                                    <div className={cn("absolute inset-0 opacity-20 blur-3xl", failedRowIndices.length === 0 ? "bg-emerald-400" : "bg-rose-400")} />
                                    
                                    <div className="relative z-10 flex flex-col items-center gap-6">
                                        <div className="w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-xl bg-card border border-white/10 backdrop-blur-sm">
                                            {failedRowIndices.length === 0
                                                ? <CheckCircle2 size={48} className="text-emerald-500" />
                                                : <AlertCircle size={48} className="text-rose-500" />
                                            }
                                        </div>
                                        <div>
                                            <CardTitle className="text-4xl font-black tracking-tight">Import Complete</CardTitle>
                                            <p className="text-muted-foreground font-medium text-base mt-3">
                                                {failedRowIndices.length === 0 
                                                    ? 'All records were successfully processed and ingested.' 
                                                    : 'Some records encountered validation issues and were skipped.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-12">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                        <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
                                            <p className="text-5xl font-black text-emerald-600 mb-2">{executionResults.filter(r => r.status === 'success').length}</p>
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Created</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-rose-500/5 border border-rose-500/10 shadow-sm">
                                            <p className="text-5xl font-black text-rose-600 mb-2">{failedRowIndices.length}</p>
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Failed</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-primary/5 border border-primary/10 shadow-sm">
                                            <p className="text-5xl font-black text-primary mb-2">{rawData.length > 0 ? Math.round((executionResults.filter(r => r.status === 'success').length / rawData.length) * 100) : 0}%</p>
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Success Rate</p>
                                        </div>
                                    </div>
                                    {/* Error Detail List */}
                                    {failedRowIndices.length > 0 && (
                                        <div className="mb-10 rounded-2xl border border-rose-200/50 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 bg-rose-500/10 border-b border-rose-200/50">
                                                <p className="text-sm font-bold text-rose-700">Failed Rows — {failedRowIndices.length} issue{failedRowIndices.length > 1 ? 's' : ''}</p>
                                            </div>
                                            <ScrollArea className="max-h-[200px] bg-card/50">
                                                {executionResults.filter(r => r.status === 'error').map(r => (
                                                    <div key={r.row} className="px-6 py-4 border-b border-rose-100 last:border-0 flex items-center gap-4">
                                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-none text-[10px] shrink-0 font-bold px-3 py-1">Row {r.row + 1}</Badge>
                                                        <p className="text-sm font-medium text-rose-700 truncate">{r.error}</p>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {failedRowIndices.length > 0 && (
                                            <Button onClick={() => setCurrentStep('CORRECTION')} variant="outline" className="flex-1 h-16 rounded-2xl font-bold text-lg gap-3 border-rose-200 text-rose-600 hover:bg-rose-50">
                                                <Pencil size={20} /> Fix & Retry Failures
                                            </Button>
                                        )}
                                        <Button onClick={() => router.push('/admin/entities')} className="flex-1 h-16 rounded-2xl font-bold text-lg shadow-xl gap-3 bg-primary hover:bg-primary/90 text-white">
                                            Open Directory <ArrowRight size={20} />
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
