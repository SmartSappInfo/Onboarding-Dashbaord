
'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
    Globe,
    CheckSquare,
    X,
    ListChecks,
    RotateCcw,
    ExternalLink,
    ShieldAlert,
    History
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
import WithdrawContractModal from './components/WithdrawContractModal';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { deleteContractAction } from '@/lib/contract-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from '@/context/WorkspaceContext';

export default function AgreementsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId } = useWorkspace();
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [selectedSchools, setSelectedSchools] = React.useState<School[]>([]);
    const [isWizardOpen, setIsWizardOpen] = React.useState(false);
    const [withdrawingSchool, setWithdrawingSchool] = React.useState<School | null>(null);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

    // Single Contract Deletion State
    const [contractToPurge, setContractToPurge] = React.useState<{ contract: Contract, school: School } | null>(null);
    const [isPurging, setIsPurging] = React.useState(false);

    // Permission Check
    const [userPermissions, setUserPermissions] = React.useState<string[]>([]);
    const { user } = useUser();
    
    React.useEffect(() => {
        if (user && firestore) {
            const fetchPerms = async () => {
                const userDocRef = doc(firestore, 'users', user.uid);
                const snap = await getDoc(userDocRef);
                if (snap.exists()) setUserPermissions(snap.data().permissions || []);
            };
            fetchPerms();
        }
    }, [user, firestore]);

    const canPurge = userPermissions.includes('contracts_delete') || userPermissions.includes('system_admin');

    // Data Subscriptions
    const schoolsCol = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'schools'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const contractsCol = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'contracts'), orderBy('updatedAt', 'desc')) : null, 
    [firestore]);

    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
    const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsCol);

    const isLoading = isLoadingSchools || isLoadingContracts || isLoadingFilter;

    // Logic to merge Schools with their specific Contract records
    const schoolsWithContracts = React.useMemo(() => {
        if (!schools) return [];
        
        // 1. GLOBAL USER FILTER
        let baseSchools = schools;
        if (assignedUserId) {
            if (assignedUserId === 'unassigned') {
                baseSchools = baseSchools.filter(s => !s.assignedTo?.userId);
            } else {
                baseSchools = baseSchools.filter(s => s.assignedTo?.userId === assignedUserId);
            }
        }

        const contractMap = new Map(contracts?.map(c => [c.schoolId, c]) || []);

        return baseSchools.map(school => ({
            ...school,
            contract: contractMap.get(school.id) || null
        }));
    }, [schools, contracts, assignedUserId]);

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
        const total = schoolsWithContracts.length;
        const signed = filteredList.filter(item => item.contract?.status === 'signed').length;
        const pending = filteredList.filter(item => item.contract?.status === 'sent').length;
        const actionRequired = total - signed;
        const coverage = total > 0 ? Math.round((signed / total) * 100) : 0;

        return { total, signed, pending, actionRequired, coverage };
    }, [schoolsWithContracts, filteredList]);

    const toggleSelect = (school: School) => {
        setSelectedSchools(prev => {
            const exists = prev.find(s => s.id === school.id);
            if (exists) return prev.filter(s => s.id !== school.id);
            return [...prev, school];
        });
    };

    const handleSelectAllUnprepared = () => {
        const unprepared = filteredList.filter(item => !item.contract || item.contract.status === 'no_contract' || item.contract.status === 'draft');
        setSelectedSchools(unprepared);
        toast({ title: 'Batch Selected', description: `${unprepared.length} unprepared schools identified.` });
    };

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

    const handlePurgeConfirmed = async () => {
        if (!contractToPurge || !user) return;
        setIsPurging(true);
        const { contract, school } = contractToPurge;
        
        try {
            const result = await deleteContractAction(
                contract.id, 
                contract.pdfId, 
                contract.submissionId || null, 
                school.id, 
                user.uid
            );
            
            if (result.success) {
                toast({ title: 'Agreement Purged', description: 'Record and associated signed document removed.' });
                setContractToPurge(null);
            } else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Purge Failed', description: e.message });
        } finally {
            setIsPurging(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setSelectedSchools([]);
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

    const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all';

    return (
        <TooltipProvider>
            <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left relative">
                <div className="max-w-7xl mx-auto space-y-10 pb-32">
                    
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                                <FileCheck className="h-8 w-8 text-primary" />
                                Agreements & Contracts
                            </h1>
                            <p className="text-muted-foreground font-medium mt-1">Manage all agreements and legal contracts executions.</p>
                        </div>
                    </div>

                    {/* Dashboard Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            label="% Signed" 
                            value={`${stats.coverage}%`} 
                            sub="Compliance Velocity" 
                            icon={Target} 
                            color="text-primary" 
                            bg="bg-primary/10" 
                            onClick={() => setStatusFilter('all')}
                        />
                        <StatCard 
                            label="Doc Signed" 
                            value={stats.signed} 
                            sub="Completed Contracts" 
                            icon={ShieldCheck} 
                            color="text-emerald-600" 
                            bg="bg-emerald-50" 
                            onClick={() => setStatusFilter('signed')}
                        />
                        <StatCard 
                            label="Awaiting Signature" 
                            value={stats.pending} 
                            sub="Pending in Inbox" 
                            icon={Clock} 
                            color="text-blue-600" 
                            bg="bg-blue-50" 
                            onClick={() => setStatusFilter('sent')}
                        />
                        <StatCard 
                            label="Unassigned" 
                            value={stats.actionRequired} 
                            sub="Missing or Drafts" 
                            icon={AlertCircle} 
                            color="text-rose-600" 
                            bg="bg-rose-50" 
                            onClick={() => setStatusFilter('no_contract')}
                        />
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
                                    <SelectItem value="signed">Doc Signed</SelectItem>
                                    <SelectItem value="sent">Awaiting Sign</SelectItem>
                                    <SelectItem value="draft">Draft Protocol</SelectItem>
                                    <SelectItem value="no_contract">Unassigned</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {hasActiveFilters && (
                                <Button 
                                    variant="ghost" 
                                    onClick={clearFilters} 
                                    className="rounded-xl font-bold h-11 gap-2 text-muted-foreground hover:text-primary transition-all"
                                >
                                    <RotateCcw className="h-4 w-4" /> Show All
                                </Button>
                            )}

                            <Button 
                                variant="outline" 
                                onClick={handleSelectAllUnprepared} 
                                className="rounded-xl font-bold h-11 gap-2 border-primary/20 text-primary transition-all active:scale-95"
                            >
                                <ListChecks className="h-4 w-4" /> Select All Unprepared
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Institutional Registry */}
                    <div className="rounded-[2.5rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-12 pl-6 py-5">
                                        <Checkbox 
                                            checked={selectedSchools.length === filteredList.length && filteredList.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedSchools(filteredList);
                                                else setSelectedSchools([]);
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Institution</TableHead>
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
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
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
                                        const isSelected = !!selectedSchools.find(s => s.id === item.id);
                                        
                                        return (
                                            <TableRow key={item.id} className={cn("group transition-colors", isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30")}>
                                                <TableCell className="pl-6">
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelect(item)}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "p-2 rounded-xl border transition-all",
                                                            isSelected ? "bg-primary text-white border-primary" : "bg-primary/5 border-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                                                        )}>
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
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Always Visible Quick Actions */}
                                                        {contract?.pdfId && (
                                                            <div className="flex items-center gap-1 mr-1 border-r border-border/50 pr-1 animate-in fade-in duration-500">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg shrink-0"
                                                                            onClick={() => handleCopyLink(item)}
                                                                        >
                                                                            <Copy className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Copy Signing Link</TooltipContent>
                                                                </Tooltip>
                                                                
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg shrink-0"
                                                                            asChild
                                                                        >
                                                                            <a href={`/forms/${item.contract.pdfId}?schoolId=${item.id}`} target="_blank" rel="noopener noreferrer">
                                                                                <Globe className="h-4 w-4" />
                                                                            </a>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>View Signing Page</TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        )}

                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted transition-colors"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-60 rounded-2xl border-none shadow-2xl p-2 animate-in zoom-in-95 duration-200">
                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Agreement Protocols</DropdownMenuLabel>
                                                                
                                                                {status === 'signed' ? (
                                                                    <>
                                                                        <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => contract && handleDownload(contract)} disabled={isSigningInProcess}>
                                                                            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                                                                                {isSigningInProcess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                                            </div>
                                                                            <span className="font-bold text-sm">Download Signed PDF</span>
                                                                        </DropdownMenuItem>
                                                                        {contract?.submissionId && (
                                                                            <DropdownMenuItem className="gap-3 rounded-xl p-2.5" asChild>
                                                                                <Link href={`/admin/pdfs/${contract.pdfId}/submissions/${contract.submissionId}`}>
                                                                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-4 w-4" /></div>
                                                                                    <span className="font-bold text-sm">View Legal Record</span>
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => { setSelectedSchools([item]); setIsWizardOpen(true); }}>
                                                                            <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Plus className="h-4 w-4" /></div>
                                                                            <span className="font-bold text-sm">Prep Contract</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => { setSelectedSchools([item]); setIsWizardOpen(true); }}>
                                                                            <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Send className="h-4 w-4" /></div>
                                                                            <span className="font-bold text-sm">Send Agreement</span>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {contract?.pdfId && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="my-1 mx-2" />
                                                                        <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => handleCopyLink(item)}>
                                                                            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Copy className="h-4 w-4" /></div>
                                                                            <span className="font-bold text-sm">Copy Link</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem className="gap-3 rounded-xl p-2.5" asChild>
                                                                            <a href={`/forms/${contract.pdfId}?schoolId=${item.id}`} target="_blank" rel="noopener noreferrer">
                                                                                <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Globe className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Open Portal</span>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {canPurge && contract && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="my-2 mx-2" />
                                                                        <DropdownMenuItem 
                                                                            className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive"
                                                                            onClick={() => setContractToPurge({ contract, school: item })}
                                                                        >
                                                                            <div className="p-1.5 bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4" /></div>
                                                                            <span className="font-bold text-sm">Purge Record</span>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {canPurge && !contract && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="my-2 mx-2" />
                                                                        <DropdownMenuItem 
                                                                            className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive"
                                                                            onClick={() => setWithdrawingSchool(item)}
                                                                        >
                                                                            <div className="p-1.5 bg-destructive/10 rounded-lg"><History className="h-4 w-4" /></div>
                                                                            <span className="font-bold text-sm">Audit & Purge History</span>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
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

                {/* Bulk Actions Floating Bar */}
                <AnimatePresence>
                    {selectedSchools.length > 0 && (
                        <motion.div 
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-fit min-w-[320px]"
                        >
                            <Card className="bg-slate-900/95 backdrop-blur-md text-white border-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl overflow-hidden ring-1 ring-white/10">
                                <CardContent className="p-2 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-3 pl-4 pr-2">
                                        <div className="flex items-center justify-center h-8 w-8 bg-primary/20 rounded-lg">
                                            <ShieldCheck className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-tight whitespace-nowrap">
                                            {selectedSchools.length} Selection{selectedSchools.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl">
                                        <Button 
                                            onClick={() => setIsWizardOpen(true)}
                                            size="sm"
                                            className="rounded-lg font-black uppercase text-[10px] tracking-widest h-9 px-6 bg-primary hover:bg-primary/90 transition-all"
                                        >
                                            <Zap className="h-3 w-3 mr-2" />
                                            Prep Bulk
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setSelectedSchools([])}
                                            className="h-9 w-9 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isWizardOpen && selectedSchools.length > 0 && (
                    <ContractWizard 
                        schools={selectedSchools} 
                        open={isWizardOpen} 
                        onOpenChange={(o) => {
                            setIsWizardOpen(o);
                            if (!o) setSelectedSchools([]);
                        }} 
                    />
                )}

                {withdrawingSchool && (
                    <WithdrawContractModal 
                        school={withdrawingSchool} 
                        open={!!withdrawingSchool} 
                        onOpenChange={(o) => !o && setWithdrawingSchool(null)} 
                    />
                )}

                {/* Single Purge Confirmation */}
                <AlertDialog open={!!contractToPurge} onOpenChange={(o) => !o && setContractToPurge(null)}>
                    <AlertDialogContent className="rounded-[2rem]">
                        <AlertDialogHeader>
                            <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <ShieldAlert className="h-6 w-6 text-destructive" />
                            </div>
                            <AlertDialogTitle className="text-center font-black uppercase tracking-tight">Purge Agreement Record?</AlertDialogTitle>
                            <AlertDialogDescription className="text-center text-sm font-medium">
                                You are about to permanently remove the agreement record for <span className="font-bold text-foreground">"{contractToPurge?.school.name}"</span>. 
                                <br/><br/>
                                <strong className="text-destructive uppercase text-[10px] tracking-widest">Impact Alert:</strong> This will also delete the corresponding signed PDF from the Doc Signing module, ensuring no orphan data remains. This action is irreversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
                            <AlertDialogCancel disabled={isPurging} className="rounded-xl font-bold px-8">Retain Record</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handlePurgeConfirmed} 
                                disabled={isPurging}
                                className="rounded-xl font-black px-10 shadow-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95"
                            >
                                {isPurging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Confirm Purge
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </TooltipProvider>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg, onClick }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string, onClick?: () => void }) {
    return (
        <Card 
            className={cn(
                "rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all text-left",
                onClick && "cursor-pointer active:scale-95"
            )}
            onClick={onClick}
        >
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
