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
    Check,
    Pencil,
    ArrowRight,
    Download,
    Zap,
    Plus,
    UserPlus,
    Trash2,
    Users,
    Map,
    Settings2,
    Eye,
    PartyPopper,
    ExternalLink,
    ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { ingestBatchAction } from '@/lib/bulk-upload-actions';
import type { DuplicateStrategy } from '@/lib/import-types';
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

interface DefaultValueRowProps {
    fieldKey: string;
    value: string;
    fieldLabel: string;
    onValueChange: (key: string, val: string) => void;
    onDelete: (key: string) => void;
    regionsList: any[] | null | undefined;
    districtsList: any[] | null | undefined;
    packagesList: any[] | null | undefined;
    modulesList: any[] | null | undefined;
    workspaceStatuses: any[];
    parentRegionValue?: string;
}

const DefaultValueRow = React.memo(({
    fieldKey,
    value,
    fieldLabel,
    onValueChange,
    onDelete,
    regionsList,
    districtsList,
    packagesList,
    modulesList,
    workspaceStatuses = [],
    parentRegionValue
}: DefaultValueRowProps) => {

    const regions = regionsList || [];
    const districts = districtsList || [];
    const packages = packagesList || [];
    const modules = modulesList || [];

    // Cascading district list calculation derived synchronously in render
    const filteredDistricts = React.useMemo(() => {
        if (fieldKey !== 'locationDistrict') return [];
        if (!parentRegionValue) return districts;
        const regionDoc = regions.find((r: any) => r.name?.toLowerCase().trim() === parentRegionValue.toLowerCase().trim());
        return regionDoc ? districts.filter((d: any) => d.regionId === regionDoc.id) : districts;
    }, [fieldKey, parentRegionValue, regions, districts]);

    // Handle cascading reset: if region changes and district is no longer in filtered list, we clear it!
    React.useEffect(() => {
        if (fieldKey === 'locationDistrict' && value && parentRegionValue) {
            const hasMatch = filteredDistricts.some((d: any) => d.name?.toLowerCase().trim() === value.toLowerCase().trim());
            if (!hasMatch && filteredDistricts.length > 0) {
                // Wipe orphaned district default
                onValueChange('locationDistrict', '');
            }
        }
    }, [filteredDistricts, fieldKey, value, parentRegionValue, onValueChange]);

    const renderInput = () => {
        switch (fieldKey) {
            case 'locationRegion': {
                if (regions.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter region..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[250px] bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {regions.map((r: any) => (
                                <SelectItem key={r.id} value={r.name} className="font-semibold text-xs py-2">
                                    {r.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'locationDistrict': {
                if (districts.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter district..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                const currentDistricts = filteredDistricts.length > 0 ? filteredDistricts : districts;
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder={parentRegionValue ? "Select district..." : "Select region first..."} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[250px] bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {currentDistricts.map((d: any) => (
                                <SelectItem key={d.id} value={d.name} className="font-semibold text-xs py-2">
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'subscriptionPackageName':
            case 'package': {
                if (packages.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter package name..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select subscription package..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {packages.map((p: any) => (
                                <SelectItem key={p.id} value={p.name} className="font-semibold text-xs py-2">
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'interests': {
                if (modules.length === 0) {
                    return (
                        <Input 
                            value={value} 
                            onChange={e => onValueChange(fieldKey, e.target.value)}
                            placeholder="Enter interests (comma separated)..."
                            className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                        />
                    );
                }
                const selectedList = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                const options = modules.map((m: any) => ({
                    label: m.name,
                    value: m.name,
                    color: m.color || '#3B5FFF'
                }));

                return (
                    <div className="min-w-0">
                        <MultiSelect
                            options={options}
                            value={selectedList}
                            onChange={(selectedValues) => {
                                onValueChange('interests', selectedValues.join(', '));
                            }}
                            placeholder="Select interests..."
                        />
                    </div>
                );
            }
            case 'lifecycleStatus': {
                const statuses = workspaceStatuses.length > 0 ? workspaceStatuses : [
                    { value: 'Onboarding', label: 'Onboarding' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Churned', label: 'Churned' }
                ];
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select operational state..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {statuses.map((s: any) => (
                                <SelectItem key={s.value} value={s.value} className="font-semibold text-xs py-2">
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'status': {
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            <SelectItem value="active" className="font-semibold text-xs py-2">Active</SelectItem>
                            <SelectItem value="inactive" className="font-semibold text-xs py-2">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                );
            }
            case 'currency': {
                const currencies = ['GHS', 'USD', 'EUR', 'GBP', 'NGN'];
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select currency..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {currencies.map(c => (
                                <SelectItem key={c} value={c} className="font-semibold text-xs py-2">{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            case 'leadSource': {
                const sources = ['Referral', 'Website', 'Social Media', 'Event', 'Partner', 'Cold Outreach', 'Other'];
                return (
                    <Select value={value || undefined} onValueChange={val => onValueChange(fieldKey, val)}>
                        <SelectTrigger className="h-9 text-xs bg-background rounded-xl border border-border/40 backdrop-blur-md shadow-sm hover:border-border/80 transition-all">
                            <SelectValue placeholder="Select lead source..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-background/95 backdrop-blur-md border border-border/40 shadow-lg">
                            {sources.map(s => (
                                <SelectItem key={s} value={s} className="font-semibold text-xs py-2">{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            default:
                return (
                    <Input 
                        value={value} 
                        onChange={e => onValueChange(fieldKey, e.target.value)}
                        placeholder="Enter default value..."
                        className="h-9 text-xs bg-background rounded-xl border border-border/40 focus:ring-1 focus:ring-primary/20"
                    />
                );
        }
    };

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-2 p-4 rounded-2xl border border-border/40 bg-muted/20 backdrop-blur-sm shadow-sm relative group hover:border-border hover:shadow transition-all"
        >
            <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {fieldLabel}
                </Label>
                <button 
                    onClick={() => onDelete(fieldKey)} 
                    className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg"
                    title="Remove default value"
                >
                    <X size={14} />
                </button>
            </div>
            {renderInput()}
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.value === nextProps.value &&
        prevProps.fieldLabel === nextProps.fieldLabel &&
        prevProps.parentRegionValue === nextProps.parentRegionValue &&
        prevProps.regionsList?.length === nextProps.regionsList?.length &&
        prevProps.districtsList?.length === nextProps.districtsList?.length &&
        prevProps.packagesList?.length === nextProps.packagesList?.length &&
        prevProps.modulesList?.length === nextProps.modulesList?.length &&
        prevProps.workspaceStatuses?.length === nextProps.workspaceStatuses?.length
    );
});
DefaultValueRow.displayName = 'DefaultValueRow';

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
    const { data: _registryFields } = useCollection<any>(fieldsQuery);

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

    // Fetch Regions for lookup default matching
    const regionsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'regions'), orderBy('name')) : null,
    [firestore]);
    const { data: regionsList } = useCollection<any>(regionsQuery);

    // Fetch Districts for lookup default matching
    const districtsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'districts'), orderBy('name')) : null,
    [firestore]);
    const { data: districtsList } = useCollection<any>(districtsQuery);

    // Fetch Active Subscription Packages for default matching
    const packagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'subscription_packages'), where('isActive', '==', true)) : null,
    [firestore]);
    const { data: packagesList } = useCollection<any>(packagesQuery);

    // Fetch Modules (Interests) for default matching, scoped strictly to the current workspace's organization
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
    const [enableTitleCase, setEnableTitleCase] = React.useState(false);
    const [lastImportLogId, setLastImportLogId] = React.useState<string | null>(null);
    
    // Subscribe to the real-time import log document
    const importLogRef = useMemoFirebase(() => {
        if (!firestore || !lastImportLogId) return null;
        return doc(firestore, 'import_logs', lastImportLogId);
    }, [firestore, lastImportLogId]);
    const { data: activeImportLog } = useDoc<any>(importLogRef);
    
    // ── Additional Import Settings ───────────────────────────────────────────
    const [defaultValues, setDefaultValues] = React.useState<Record<string, string>>({});

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

    const handleDefaultValueChange = React.useCallback((key: string, val: string) => {
        setDefaultValues(prev => ({ ...prev, [key]: val }));
    }, []);

    const handleDeleteDefaultValue = React.useCallback((key: string) => {
        setDefaultValues(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);
    const [selectedGlobalTags, setSelectedGlobalTags] = React.useState<string[]>([]);
    const [manualTags, setManualTags] = React.useState<string[]>([]);
    const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);

    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);
    const [executionResults, setExecutionResults] = React.useState<{ row: number; status: 'success' | 'error'; entityName?: string; error?: string }[]>([]);
    const [_currentRowIdx, _setCurrentRowIdx] = React.useState(0);
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

            const result = await ingestBatchAction(
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
                manualTags,
                enableTitleCase
            );

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
    const _progress = rawData.length > 0 ? Math.round((executionResults.length / rawData.length) * 100) : 0;
    const stepTransition = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { type: 'spring' as const, damping: 25, stiffness: 200 } };

    const flowSteps = [
        { id: 'UPLOAD',   label: 'Upload',   icon: Upload },
        { id: 'MAPPING',  label: 'Map',      icon: Map },
        { id: 'SETTINGS', label: 'Settings', icon: Settings2 },
        { id: 'PREVIEW',  label: 'Preview',  icon: Eye },
        { id: 'COMPLETE', label: 'Done',     icon: PartyPopper },
    ];
    
    // Determine stepper index (EXECUTING is still in PREVIEW, CORRECTION is COMPLETE)
    const activeIdx = currentStep === 'EXECUTING'
        ? 3
        : currentStep === 'CORRECTION'
            ? 4
            : flowSteps.findIndex(s => s.id === currentStep);

    return (
        <div className="min-h-full py-4 space-y-6 relative">
            {/* Background Ambient Glow - Standard for QR Studio modules */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none -z-10" />

            <div className="max-w-5xl mx-auto w-full px-4 pb-20 space-y-6">

                {/* ── Premium Stepper (Floating) ───────────────────────────── */}
                <div className="w-full">
                    <div className="relative mx-auto max-w-2xl px-4 py-6">
                        {/* Track line (behind bubbles) - Grid based alignment */}
                        <div className="absolute top-[48px] left-[10%] right-[10%] h-[1px] bg-primary/20 hidden sm:block" />
                        <div
                            className="absolute top-[48px] left-[10%] h-[1px] bg-primary transition-all duration-700 ease-in-out hidden sm:block"
                            style={{ width: `${(Math.max(0, activeIdx) / (flowSteps.length - 1)) * 80}%` }}
                        />
                        {/* Steps Grid */}
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

                <AnimatePresence mode="wait">
                    {currentStep === 'UPLOAD' && (
                        <motion.div key="upload" {...stepTransition} className="space-y-6">
                            {/* Header - QR Studio Style */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Bulk Account Import</h1>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Upload a spreadsheet to onboard records into your workspace instantly.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleDownloadTemplate('simple')} 
                                        className="rounded-xl h-11 px-4 font-semibold text-sm border-border bg-card"
                                    >
                                        <Download size={16} className="mr-2 text-primary" /> 
                                        Simple Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleDownloadTemplate('advanced')} 
                                        className="rounded-xl h-11 px-4 font-semibold text-sm border-border bg-card text-violet-600 dark:text-violet-400"
                                    >
                                        <Download size={16} className="mr-2" /> 
                                        Advanced Template
                                    </Button>
                                </div>
                            </div>

                            {/* Drop Zone - QR Studio batch-import aesthetic */}
                            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                                <CardContent className="p-8 sm:p-12">
                                    <label htmlFor="bulk-file" className="w-full block cursor-pointer group">
                                        <div className={cn(
                                            "border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center",
                                            "flex flex-col items-center justify-center gap-4",
                                            "transition-all duration-300",
                                            "border-border/50 bg-muted/20",
                                            "hover:border-primary/50 hover:bg-primary/[0.03]"
                                        )}>
                                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:shadow-primary/20 group-hover:shadow-lg transition-all duration-300">
                                                <Upload size={24} className="text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-lg font-bold group-hover:text-primary transition-colors duration-200">
                                                    Drop your spreadsheet here
                                                </p>
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    Supports <span className="font-bold text-foreground">.csv</span>, <span className="font-bold text-foreground">.xlsx</span>, and <span className="font-bold text-foreground">.xls</span> files
                                                </p>
                                            </div>
                                            <div className="px-5 py-1.5 rounded-full border border-border bg-background text-[10px] font-bold text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-all">
                                                Click to browse files
                                            </div>
                                            <Input id="bulk-file" type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                                        </div>
                                    </label>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {currentStep === 'MAPPING' && (
                        <motion.div key="mapping" {...stepTransition} className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Schema Correlation</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Map your spreadsheet columns to workspace fields.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" onClick={() => setCurrentStep('UPLOAD')} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5">
                                        <ArrowLeft size={16} className="mr-2" /> Change File
                                    </Button>
                                    <Badge className="bg-primary/10 text-primary border-none px-4 h-11 rounded-xl text-xs font-bold uppercase tracking-widest">
                                        {rawData.length} {rawData.length === 1 ? terms.singular : terms.plural}
                                    </Badge>
                                </div>
                            </div>

                            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                                            <TableIcon size={22} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold">Field Mapping</CardTitle>
                                            <CardDescription className="text-xs font-medium">Verify each column maps to the correct property.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
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
                                                <AnimatePresence mode="popLayout">
                                                    {Object.entries(defaultValues).map(([key, val]) => {
                                                        const field = allMappableFields.find(f => f.key === key);
                                                        return (
                                                            <DefaultValueRow
                                                                key={key}
                                                                fieldKey={key}
                                                                value={val}
                                                                fieldLabel={field?.label || key}
                                                                onValueChange={handleDefaultValueChange}
                                                                onDelete={handleDeleteDefaultValue}
                                                                regionsList={regionsList}
                                                                districtsList={districtsList}
                                                                packagesList={packagesList}
                                                                modulesList={modulesList}
                                                                workspaceStatuses={workspaceStatuses}
                                                                parentRegionValue={defaultValues['locationRegion']}
                                                            />
                                                        );
                                                    })}
                                                </AnimatePresence>
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
                                <CardFooter className="bg-primary/5 p-8 border-t flex flex-col gap-6">
                                    {/* Workspace Context Banner */}
                                    <div className="w-full p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg"><Database size={18} className="text-primary" /></div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider leading-none">Target Workspace</p>
                                            <p className="text-sm font-bold mt-1">{activeWorkspace?.name || 'Unknown'} · <span className="text-muted-foreground capitalize">{contactScope}</span></p>
                                        </div>
                                    </div>
                                    {rawData.length > 500 && (
                                        <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
                                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                                            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">Large dataset detected ({rawData.length} rows). Process may take time.</p>
                                        </div>
                                    )}
                                    <Button 
                                        onClick={() => setCurrentStep('SETTINGS')} 
                                        disabled={(!mapping['name'] && !mapping['contact_0_name']) || !activeWorkspace?.id} 
                                        className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98]"
                                    >
                                        Continue to Settings <ArrowRight size={20} />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── SETTINGS STEP ─── */}
                    {currentStep === 'SETTINGS' && (
                        <motion.div key="settings" {...stepTransition} className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Import Settings</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Configure automation and metadata for this batch.</p>
                                </div>
                                <Button variant="ghost" onClick={() => setCurrentStep('MAPPING')} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5">
                                    <ArrowLeft size={16} className="mr-2" /> Back to Mapping
                                </Button>
                            </div>
                            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                                            <Settings2 size={22} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold">Configuration</CardTitle>
                                            <CardDescription className="text-xs font-medium">Set global tags and trigger workflows.</CardDescription>
                                        </div>
                                    </div>
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
                                                    <p className="text-xs text-muted-foreground">If a tag in the CSV doesn&apos;t exist, create it automatically.</p>
                                                </div>
                                                <Switch checked={autoCreateTags} onCheckedChange={setAutoCreateTags} />
                                            </div>
                                            <div className="border-t my-2 border-border/50" />
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-sm">Convert Text Fields to Title Case</p>
                                                    <p className="text-xs text-muted-foreground">Clean formatting by converting ALL CAPS or all lowercase text values to Title Case.</p>
                                                </div>
                                                <Switch checked={enableTitleCase} onCheckedChange={setEnableTitleCase} />
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
                                            Note: The default &quot;Record Created&quot; automations may still run based on your workspace settings.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-primary/5 p-8 border-t">
                                    <Button onClick={() => setCurrentStep('PREVIEW')} className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98]">
                                        Review & Import <ArrowRight size={20} />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── PREVIEW STEP ─── */}
                    {currentStep === 'PREVIEW' && (
                        <motion.div key="preview" {...stepTransition} className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Data Preview</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Final validation before ingestion.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" onClick={() => setCurrentStep('SETTINGS')} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5">
                                        <ArrowLeft size={16} className="mr-2" /> Adjust Settings
                                    </Button>
                                    <Badge className="bg-primary/10 text-primary border-none px-4 h-11 rounded-xl text-xs font-bold uppercase tracking-widest">
                                        {rawData.length} Rows Ready
                                    </Badge>
                                </div>
                            </div>
                            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                                            <Eye size={22} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold">Verification</CardTitle>
                                            <CardDescription className="text-xs font-medium">Verify mapped values before importing.</CardDescription>
                                        </div>
                                    </div>
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
                                    <Button onClick={() => startExecution()} className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98]">
                                        <Zap size={20} /> Import {rawData.length} {terms.plural}
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
                        <motion.div key="complete" className="space-y-6">
                            <Card className="rounded-2xl border border-border/40 shadow-xl overflow-hidden bg-white dark:bg-[#0f1117] relative">
                                {/* Status Header Section - Left-Aligned Icon Layout */}
                                <CardHeader className={cn(
                                    "py-12 px-10 border-b-0 relative overflow-hidden",
                                    failedRowIndices.length === 0 ? "bg-emerald-500/[0.02]" : "bg-rose-500/[0.02]"
                                )}>
                                    {/* Ambient Glow */}
                                    <div className={cn(
                                        "absolute inset-0 blur-[100px] opacity-10",
                                        failedRowIndices.length === 0 ? "bg-emerald-500" : "bg-rose-500"
                                    )} />
                                    
                                    <div className="relative z-10 flex items-start gap-8">
                                        <div className={cn(
                                            "w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border shrink-0",
                                            failedRowIndices.length === 0 
                                                ? "bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/20" 
                                                : "bg-rose-500 text-white border-rose-400/50 shadow-rose-500/20"
                                        )}>
                                            {failedRowIndices.length === 0
                                                ? <Check size={36} strokeWidth={3} />
                                                : <AlertCircle size={36} strokeWidth={2.5} />
                                            }
                                        </div>

                                        <div className="flex-1 space-y-2 pt-1">
                                            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                                {failedRowIndices.length === 0 ? 'Import Successfully Finalized' : 'Import Partially Completed'}
                                            </CardTitle>
                                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed max-w-2xl">
                                                {failedRowIndices.length === 0 
                                                    ? 'Your data ecosystem has been successfully synchronized. All records are now active within the workspace directory and ready for automation workflows.' 
                                                    : 'The ingestion process is finished, but some records required manual intervention due to validation discrepancies or duplicate entries.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="px-10 pb-10 space-y-10">
                                    {/* High-Impact Stats Bar */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm">
                                            <p className="text-3xl font-black text-slate-800 dark:text-white mb-0.5">{rawData.length}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Submitted</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm relative overflow-hidden">
                                            {activeImportLog?.status === 'processing' || activeImportLog?.status === 'queued' ? (
                                                <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-100">
                                                    <div 
                                                        className="h-full bg-blue-500 transition-all duration-500" 
                                                        style={{ width: `${Math.max(5, ((activeImportLog?.successCount || 0) + (activeImportLog?.failedCount || 0) + (activeImportLog?.duplicateCount || 0)) / rawData.length * 100)}%` }}
                                                    />
                                                </div>
                                            ) : null}
                                            <div className="flex items-center gap-1.5 mb-0.5 relative z-10">
                                                {activeImportLog?.status === 'processing' || activeImportLog?.status === 'queued' ? (
                                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                                ) : activeImportLog?.status === 'completed' || activeImportLog?.status === 'completed_with_errors' ? (
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                ) : null}
                                                <p className="text-3xl font-black text-emerald-600">
                                                    {activeImportLog?.successCount || 0}
                                                </p>
                                            </div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">Created</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm transition-all hover:border-amber-500/30">
                                            <p className="text-3xl font-black text-amber-500 mb-0.5">{activeImportLog?.duplicateCount || 0}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Duplicates</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-border/50 shadow-sm transition-all hover:border-rose-500/30">
                                            <p className="text-3xl font-black text-rose-500 mb-0.5">{activeImportLog?.failedCount || 0}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Failed</p>
                                        </div>
                                    </div>

                                    {/* Track Import Banner */}
                                    {lastImportLogId && (
                                        <button
                                            onClick={() => router.push(`/admin/entities/imports?logId=${lastImportLogId}`)}
                                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <ClipboardList size={18} className="text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">Track Import Progress</p>
                                                <p className="text-xs text-slate-500">Live status, duplicates &amp; failure resolution</p>
                                            </div>
                                            <ExternalLink size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </button>
                                    )}

                                    {/* Integrated Validation Log (Only if errors exist) */}
                                    {failedRowIndices.length > 0 && (
                                        <div className="rounded-2xl border border-rose-200/50 overflow-hidden shadow-sm bg-rose-500/[0.01]">
                                            <div className="px-5 py-3 bg-rose-500/[0.03] border-b border-rose-200/50 flex items-center justify-between">
                                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                                                    <AlertCircle size={12} /> Validation Discrepancies ({failedRowIndices.length})
                                                </p>
                                            </div>
                                            <ScrollArea className="max-h-[220px]">
                                                {executionResults.filter(r => r.status === 'error').map(r => (
                                                    <div key={r.row} className="px-5 py-3 border-b border-rose-100/30 last:border-0 flex items-center gap-4 group">
                                                        <Badge variant="outline" className="bg-rose-500/5 text-rose-600 border-rose-200 text-[9px] shrink-0 font-bold px-2 py-0.5">ROW {r.row + 1}</Badge>
                                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 truncate group-hover:text-rose-700 transition-colors">{r.error}</p>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    )}

                                    {/* Action Footers - Horizontal Layout */}
                                    <div className="flex items-center gap-4 pt-2">
                                        <Button 
                                            onClick={() => {
                                                setRawData([]);
                                                setExecutionResults([]);
                                                setFailedRowIndices([]);
                                                setCurrentStep('UPLOAD');
                                            }} 
                                            variant="outline"
                                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider border-border hover:bg-slate-50 dark:hover:bg-slate-900"
                                        >
                                            <RefreshCw size={18} className="mr-2" /> Import Another
                                        </Button>
                                        <Button 
                                            onClick={() => router.push('/admin/entities/imports')} 
                                            variant="outline"
                                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider border-primary/20 text-primary hover:bg-primary/5"
                                        >
                                            <Eye size={18} className="mr-2" /> View Imports
                                        </Button>
                                        <Button 
                                            onClick={() => router.push('/admin/entities')} 
                                            className="flex-1 h-14 rounded-xl font-black text-sm transition-all active:scale-[0.98] uppercase tracking-wider gap-2 bg-[#4d69ff] hover:bg-[#3d59ef] text-white shadow-lg shadow-primary/20"
                                        >
                                            Go to {terms.plural} <ArrowRight size={18} />
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
