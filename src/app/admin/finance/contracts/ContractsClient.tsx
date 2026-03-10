'use client';

import * as React from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { School, Contract, UserProfile } from '@/lib/types';
import { 
    FileCheck, 
    Search, 
    Plus, 
    Filter, 
    Building, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    FileText, 
    Download, 
    Send,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    Target,
    Zap,
    MoreHorizontal,
    Eye,
    Trash2,
    Loader2,
    Copy,
    Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ContractWizard from './components/ContractWizard';
import { useToast } from '@/hooks/use-toast';

export default function AgreementsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [activeWizardSchool, setActiveWizardSchool] = React.useState<School | null>(null);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

    // Data Subscriptions
    const schoolsCol = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, 
    [firestore]);

    const contractsCol = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'contracts'), orderBy('updatedAt', 'desc')) : null, 
    [firestore]);

    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
    const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsCol);

    const isLoading = isLoadingSchools || isLoadingContracts;

    // Logic to merge Schools with their specific Contract records
    const schoolsWithContracts = React.useMemo(() => {
        if (!schools) return [];
        const contractMap = new Map(contracts?.map(c => [c.schoolId, c]) || []);

        return schools.map(school => ({
            ...school,
            contract: contractMap.get(school.id) || null
        }));
    }, [schools, contracts]);

    const filteredList = React.useMemo(() => {
        let list = schoolsWithContracts;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            list = list.filter(item => item.name.toLowerCase().includes(s));
        }
        if (statusFilter !== 'all') {
            list = list.filter(item => {
                const status = item.contract?.status || 'no_contract';
                return status === statusFilter;
            });
        }
        return list;
    }, [schoolsWithContracts, searchTerm, statusFilter]);

    const stats = React.useMemo(() => {
        const total = schools?.length || 0;
        const signed = contracts?.filter(c => c.status === 'signed').length || 0;
        const pending = contracts?.filter(c => c.status === 'sent').length || 0;
        const actionRequired = total - signed;
        const coverage = total > 0 ? Math.round((signed / total) * 100) : 0;

        return { total, signed, pending, actionRequired, coverage };
    }, [schools, contracts]);

    const handleCopyLink = (item: any) => {
        if (!item.contract?.pdfId) return;
        if (typeof window === 'undefined') return;
        
        const url = `${window.location.origin}/forms/${item.contract.pdfId}?schoolId=${item.id}`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Link Copied', description: 'Unique signing URL is ready to share.' });
    };

    const handleDownload = async (contract: Contract) => {
        if (!contract.pdfId || !contract.submissionId) return;
        setDownloadingId(contract.id);
        
        try {
            const response = await fetch(`/api/pdfs/${contract.pdfId}/generate/${contract.submissionId}`);
            if (!response.ok) throw new Error("Failed to generate PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${contract.schoolName}_Signed_Agreement.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast({ title: 'Download Successful' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'signed': return <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black gap-1"><ShieldCheck className="h-2.5 w-2.5" /> Signed</Badge>;
            case 'sent': return <Badge className="bg-blue-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black gap-1"><Clock className="h-2.5 w-2.5" /> Sent</Badge>;
            case 'draft': return <Badge variant="secondary" className="text-[8px] h-5 uppercase px-2 font-black gap-1">Draft</Badge>;
            case 'no_contract': return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-black border-dashed opacity-40">No Contract</Badge>;
            default: return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-black">{status}</Badge>;
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-10 pb-32">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <FileCheck className="h-8 w-8 text-primary" />
                            Agreements Command
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Audit institutional compliance and manage legal execution.</p>
                    </div>
                </div>

                {/* Dashboard Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Network Coverage" value={`${stats.coverage}%`} sub="Compliance Velocity" icon={Target} color="text-primary" bg="bg-primary/10" />
                    <StatCard label="Legally Executed" value={stats.signed} sub="Completed Contracts" icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Awaiting Signature" value={stats.pending} sub="Pending in Inbox" icon={Clock} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Action Required" value={stats.actionRequired} sub="Missing or Drafts" icon={AlertCircle} color="text-rose-600" bg="bg-rose-50" />
                </div>

                {/* Search & Filters */}
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex-grow min-w-[240px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Search by school name..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Global Compliance</SelectItem>
                                <SelectItem value="signed">Signed Only</SelectItem>
                                <SelectItem value="sent">Awaiting Sign</SelectItem>
                                <SelectItem value="draft">Draft Protocol</SelectItem>
                                <SelectItem value="no_contract">Uninitiated</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="rounded-xl font-bold h-11 gap-2 border-primary/20 text-primary">
                            <Filter className="h-4 w-4" /> Filters
                        </Button>
                    </CardContent>
                </Card>

                {/* Institutional Registry */}
                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Institution</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Active Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Last Update</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Assigned Representative</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-8"><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell className="text-right pr-8"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredList.length > 0 ? (
                                filteredList.map((item) => {
                                    const contract = item.contract;
                                    const status = contract?.status || 'no_contract';
                                    const isSigningInProcess = downloadingId === contract?.id;
                                    
                                    return (
                                        <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="pl-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/5 rounded-xl border border-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                        <Building className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm uppercase tracking-tight text-foreground">{item.name}</span>
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 italic">{item.zone?.name || 'Unassigned Zone'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(status)}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                                                {contract?.updatedAt ? format(new Date(contract.updatedAt), 'MMM d, yyyy') : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium text-foreground/80">
                                                {item.focalPersons?.find(p => p.isSignatory)?.name || 'No Primary Contact'}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {status === 'signed' ? (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            disabled={isSigningInProcess}
                                                            className="h-8 rounded-lg font-black text-[9px] uppercase tracking-widest border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                            onClick={() => contract && handleDownload(contract)}
                                                        >
                                                            {isSigningInProcess ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Download className="h-3 w-3 mr-1.5" />}
                                                            Download
                                                        </Button>
                                                    ) : (
                                                        <Button className="h-8 rounded-lg font-black text-[9px] uppercase tracking-widest gap-1.5 shadow-lg" onClick={() => setActiveWizardSchool(item)}>
                                                            <Plus className="h-3 w-3" /> Initialize
                                                        </Button>
                                                    )}
                                                    <DropdownMenu modal={false}>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl">
                                                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Workflow Options</DropdownMenuLabel>
                                                            
                                                            {status !== 'no_contract' && (
                                                                <DropdownMenuItem className="gap-3 rounded-lg p-2.5" onClick={() => handleCopyLink(item)}>
                                                                    <Copy className="h-4 w-4 text-primary" />
                                                                    <span className="font-bold text-sm">Copy Signing Link</span>
                                                                </DropdownMenuItem>
                                                            )}

                                                            {status === 'signed' && contract?.submissionId && (
                                                                <DropdownMenuItem className="gap-3 rounded-lg p-2.5" asChild>
                                                                    <Link href={`/admin/pdfs/${contract.pdfId}/submissions/${contract.submissionId}`}>
                                                                        <Eye className="h-4 w-4 text-primary" />
                                                                        <span className="font-bold text-sm">View Legal Record</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            )}

                                                            {status !== 'signed' && status !== 'no_contract' && contract?.pdfId && (
                                                                <DropdownMenuItem className="gap-3 rounded-lg p-2.5" asChild>
                                                                    <a href={`/forms/${contract.pdfId}?schoolId=${item.id}`} target="_blank" rel="noopener noreferrer">
                                                                        <Globe className="h-4 w-4 text-primary" />
                                                                        <span className="font-bold text-sm">View Signing Portal</span>
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            )}

                                                            <DropdownMenuItem className="gap-3 rounded-lg p-2.5" onClick={() => setActiveWizardSchool(item)}>
                                                                <FileText className="h-4 w-4 text-primary" /> Preview Logic
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="gap-3 rounded-lg p-2.5" onClick={() => setActiveWizardSchool(item)}>
                                                                <Send className="h-4 w-4 text-primary" /> Send Agreement
                                                            </DropdownMenuItem>
                                                            
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive gap-3 rounded-lg p-2.5 focus:bg-destructive/10">
                                                                <Trash2 className="h-4 w-4" /> Purge Protocol
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                            <FileCheck className="h-12 w-12" />
                                            <p className="text-xs font-black uppercase tracking-widest">No matching schools</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {activeWizardSchool && (
                <ContractWizard 
                    school={activeWizardSchool} 
                    open={!!activeWizardSchool} 
                    onOpenChange={(o) => !o && setActiveWizardSchool(null)} 
                />
            )}
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all text-left">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-3xl font-black tabular-nums tracking-tighter truncate">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1 truncate">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}
