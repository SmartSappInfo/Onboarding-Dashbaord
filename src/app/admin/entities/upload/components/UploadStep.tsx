'use client';

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileText, ArrowLeft, ClipboardList, Download, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    DropdownMenu, 
    DropdownMenuTrigger, 
    DropdownMenuContent, 
    DropdownMenuItem 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Helper registries for templates
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
        { key: 'currentNeeds',      label: 'Current Needs',           required: false },
        { key: 'currentChallenges', label: 'Current Challenges',      required: false },
        { key: 'interests',         label: 'Interests',               required: false },
    ],
};

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

interface UploadStepProps {
    terms: { singular: string; plural: string };
    contactScope: string;
    activeWorkspace: any;
    onFileProcessed: (fileName: string, headers: string[], data: any[]) => void;
    stepperMarkup?: React.ReactNode;
}

export function UploadStep({
    terms,
    contactScope,
    activeWorkspace,
    onFileProcessed,
    stepperMarkup,
}: UploadStepProps) {
    const [dragActive, setDragActive] = React.useState(false);

    const handleDrag = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const processDroppedFile = (file: File) => {
        const extension = file.name.split('.').pop()?.toLowerCase();

        const processResults = (data: any[]) => {
            if (data.length > 0) {
                const h = Object.keys(data[0] as object).filter(k => k && k.trim() !== "");
                onFileProcessed(file.name, h, data);
            }
        };

        if (extension === 'csv') {
            Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => processResults(res.data) });
        } else if (extension === 'xlsx' || extension === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const wb = XLSX.read(evt.target?.result as string, { type: 'binary' });
                processResults(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false }));
            };
            reader.readAsBinaryString(file);
        }
    };

    const handleDrop = React.useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processDroppedFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processDroppedFile(file);
    };

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

    return (
        <div className="space-y-6">
            <div>
                <Link 
                    href="/admin/entities" 
                    className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-primary transition-colors gap-1.5"
                >
                    <ArrowLeft size={14} />
                    Back to {terms.plural || 'Entities'}
                </Link>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Bulk Account Import</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload a spreadsheet to onboard records into your workspace instantly.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        asChild
                        variant="outline"
                        className="rounded-xl h-11 px-4 font-semibold text-sm border-border bg-card text-muted-foreground hover:text-foreground animate-none"
                    >
                        <Link href="/admin/entities/imports">
                            <ClipboardList size={16} className="mr-2 text-primary" />
                            View Imports Log
                        </Link>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline" 
                                className="rounded-xl h-11 px-4 font-semibold text-sm border-border bg-card gap-2 animate-none"
                            >
                                <Download size={16} className="text-primary" /> 
                                Download Template
                                <ChevronDown size={14} className="opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-border bg-card/95 backdrop-blur-md">
                            <DropdownMenuItem 
                                onClick={() => handleDownloadTemplate('simple')}
                                className="cursor-pointer font-medium text-sm rounded-lg"
                            >
                                <Download size={14} className="mr-2 text-primary" />
                                Simple Template
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => handleDownloadTemplate('advanced')}
                                className="cursor-pointer font-medium text-sm rounded-lg text-violet-600 dark:text-violet-400 focus:text-violet-600 dark:focus:text-violet-400"
                            >
                                <Download size={14} className="mr-2" />
                                Advanced Template
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {stepperMarkup}

            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                <CardContent className="p-8 sm:p-12">
                    <label 
                        htmlFor="bulk-file" 
                        className="w-full block cursor-pointer group"
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className={cn(
                            "border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center",
                            "flex flex-col items-center justify-center gap-4",
                            "transition-all duration-300",
                            dragActive ? "border-primary bg-primary/[0.05]" : "border-border/50 bg-muted/20",
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
        </div>
    );
}
