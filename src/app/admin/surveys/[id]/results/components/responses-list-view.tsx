'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion, ResolvedContact } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trophy, Trash2, MoreHorizontal, CheckSquare, Loader2, Lock, Eye, AlertTriangle, Building2, User as UserIcon, Filter, Search, ShieldCheck, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import { deleteSurveyResponses } from '@/lib/survey-actions';
import { resolveContact } from '@/lib/contact-adapter';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn, stripHtml } from '@/lib/utils';

/**
 * Component to display entity information for a survey response
 * Uses Contact Adapter to resolve entity data from either entityId or entityId
 * Requirements: 13.4, 23.1
 */
function EntityInfo({ response }: { response: SurveyResponse }) {
    const { activeWorkspaceId } = useWorkspace();
    const [contact, setContact] = React.useState<ResolvedContact | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadContact() {
            if (!response.entityId) {
                setIsLoading(false);
                return;
            }

            try {
                const resolved = await resolveContact(
                    response.entityId || '',
                    activeWorkspaceId
                );
                setContact(resolved);
            } catch (error) {
                console.error('Failed to resolve contact:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadContact();
    }, [response.entityId, activeWorkspaceId]);

    if (isLoading) {
 return <Skeleton className="h-5 w-24" />;
    }

    if (!contact) {
 return <span className="text-xs text-muted-foreground">-</span>;
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold truncate max-w-[150px]" title={contact.name}>
                    {contact.name}
                </span>
            </div>
            {response.entityId && (
                <Badge variant="outline" className="w-fit h-4 py-0 text-[8px] font-black uppercase tracking-tighter bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-1">
                    <ShieldCheck className="h-2 w-2" /> Live CRM
                </Badge>
            )}
        </div>
    );
}

/**
 * Component to display who shared the survey link
 */
function SharedByInfo({ userId }: { userId?: string }) {
    const firestore = useFirestore();
    const [name, setName] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userId || !firestore) {
            setIsLoading(false);
            return;
        }
        
        getDoc(doc(firestore, 'users', userId)).then((snap: any) => {
            if (snap.exists()) {
                setName(snap.data().name || snap.data().email);
            }
            setIsLoading(false);
        }).catch((err) => {
            console.error("SharedByInfo resolution failed:", err);
            setIsLoading(false);
        });
    }, [userId, firestore]);

    if (!userId) return <span className="text-[10px] text-muted-foreground/40 italic">Anonymous</span>;
    if (isLoading) return <Skeleton className="h-4 w-20" />;

    return (
        <div className="flex items-center gap-1.5">
            <div className="p-1 bg-blue-500/10 rounded text-blue-600">
                <UserIcon className="h-3 w-3" />
            </div>
            <span className="text-[10px] font-bold text-blue-700/80 truncate max-w-[100px]">{name || 'Team Member'}</span>
        </div>
    );
}

function formatAnswer(value: any): string {
    if (value === undefined || value === null) return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
        // Checkboxes with allowOther: { options: string[], other: string }
        if (Array.isArray(value.options)) {
            const parts = [...value.options];
            if (value.other && value.other.trim()) parts.push(`Other: ${value.other.trim()}`);
            return parts.length > 0 ? parts.join(', ') : '-';
        }
        // Multiple-choice with allowOther: { option: string, other: string }
        if (value.option !== undefined) {
            if (value.option === '__other__') {
                return value.other?.trim() ? `Other: ${value.other.trim()}` : 'Other (not specified)';
            }
            // Regular option selected
            const parts = [value.option];
            if (value.other?.trim()) parts.push(`Other: ${value.other.trim()}`);
            return parts.join(', ');
        }
        // Fallback for unknown object shapes
        return Object.entries(value)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') || '-';
    }
    return String(value);
}

interface ResponsesListViewProps {
    survey: Survey;
    responses: SurveyResponse[];
    filteredResponses: SurveyResponse[];
    isLoading: boolean;
    columnFilters: Record<string, string[]>;
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    hideEmptyColumns: boolean;
    setHideEmptyColumns: (val: boolean) => void;
    attributionFilter: string;
    setAttributionFilter: (val: string) => void;
    deepLinkFilterType: string | null;
    setDeepLinkFilterType: (val: string | null) => void;
}

function ResponsesListView({ 
    survey, 
    responses, 
    filteredResponses, 
    isLoading,
    columnFilters,
    setColumnFilters,
    hideEmptyColumns,
    setHideEmptyColumns,
    attributionFilter,
    setAttributionFilter,
    deepLinkFilterType,
    setDeepLinkFilterType
}: ResponsesListViewProps) {
    const router = useRouter();
    const { toast } = useToast();
    const auth = useAuth();
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [columnWidth, setColumnWidth] = React.useState<number>(250);
    const [hiddenColumnIds, setHiddenColumnIds] = React.useState<string[]>([]);

    const isSubmittedAtVisible = !hiddenColumnIds.includes('submittedAt');
    const isContactVisible = !hiddenColumnIds.includes('contact');
    const isSharedByVisible = !hiddenColumnIds.includes('sharedBy');

    const submittedAtLeft = 50;
    const contactLeft = 50 + (isSubmittedAtVisible ? 180 : 0);
    const sharedByLeft = contactLeft + (isContactVisible ? 180 : 0);

    const rightmostStickyColumn = React.useMemo(() => {
        if (isSharedByVisible) return 'sharedBy';
        if (isContactVisible) return 'contact';
        if (isSubmittedAtVisible) return 'submittedAt';
        return 'checkbox';
    }, [isSharedByVisible, isContactVisible, isSubmittedAtVisible]);

    // Get unique assigned users for filtering
    const attributedUsers = React.useMemo(() => {
        if (!responses) return [];
        const ids = Array.from(new Set(responses.map(r => r.assignedUserId).filter(Boolean))) as string[];
        return ids;
    }, [responses]);

    const questions = React.useMemo(() => survey ? survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el) : [], [survey]);

    const handleToggleFilterField = async (questionId: string, enabled: boolean) => {
        if (!firestore || !survey) return;
        const updatedElements = survey.elements.map(el => {
            if (el.id === questionId) {
                return { ...el, isFilterField: enabled };
            }
            return el;
        });

        try {
            const docRef = doc(firestore, 'surveys', survey.id);
            await updateDoc(docRef, { elements: updatedElements });
            toast({
                title: enabled ? "Filter Enabled" : "Filter Disabled",
                description: `Column filtering ${enabled ? 'enabled' : 'disabled'}.`,
            });
        } catch (error: any) {
            console.error("Failed to toggle filter field:", error);
            toast({
                variant: 'destructive',
                title: "Failed to update configuration",
                description: error.message
            });
        }
    };

    const getUniqueAnswers = React.useCallback((questionId: string) => {
        const unique = new Set<string>();
        responses.forEach(res => {
            const ans = res.answers.find(a => a.questionId === questionId)?.value;
            if (ans !== undefined && ans !== null) {
                if (Array.isArray(ans)) {
                    ans.forEach(val => {
                        const formatted = formatAnswer(val);
                        if (formatted && formatted !== '-') unique.add(formatted);
                    });
                } else if (typeof ans === 'object') {
                    if (Array.isArray(ans.options)) {
                        ans.options.forEach((val: string) => {
                            if (val) unique.add(val);
                        });
                        if (ans.other && ans.other.trim()) {
                            unique.add(ans.other.trim());
                        }
                    } else if (ans.option !== undefined) {
                        if (ans.option === '__other__') {
                            if (ans.other?.trim()) unique.add(ans.other.trim());
                        } else {
                            unique.add(ans.option);
                            if (ans.other?.trim()) unique.add(ans.other.trim());
                        }
                    } else {
                        const formatted = formatAnswer(ans);
                        if (formatted && formatted !== '-') unique.add(formatted);
                    }
                } else {
                    const formatted = formatAnswer(ans);
                    if (formatted && formatted !== '-') unique.add(formatted);
                }
            }
        });
        return Array.from(unique).sort();
    }, [responses]);

    const getFilterOptions = React.useCallback((question: SurveyQuestion) => {
        const unique = new Set<string>();
        if (question.type === 'yes-no') {
            unique.add('Yes');
            unique.add('No');
        } else if (question.options) {
            question.options.forEach(opt => {
                if (opt) unique.add(opt);
            });
        }
        
        const responsesUnique = getUniqueAnswers(question.id);
        responsesUnique.forEach(val => unique.add(val));
        
        return Array.from(unique).sort();
    }, [getUniqueAnswers]);

    // Hiding empty columns dynamically
    const nonActiveQuestionIds = React.useMemo(() => {
        if (!hideEmptyColumns) return new Set<string>();

        const activeQuestionIds = new Set<string>();
        filteredResponses.forEach(res => {
            res.answers.forEach(ans => {
                const formatted = formatAnswer(ans.value);
                if (formatted !== undefined && formatted !== null && formatted !== '' && formatted !== '-') {
                    activeQuestionIds.add(ans.questionId);
                }
            });
        });

        const emptyIds = new Set<string>();
        questions.forEach(q => {
            if (!activeQuestionIds.has(q.id)) {
                emptyIds.add(q.id);
            }
        });
        return emptyIds;
    }, [filteredResponses, questions, hideEmptyColumns]);

    const visibleQuestions = React.useMemo(() => {
        return questions.filter(q => !nonActiveQuestionIds.has(q.id) && !hiddenColumnIds.includes(q.id));
    }, [questions, nonActiveQuestionIds, hiddenColumnIds]);

    const toggleSelectAll = () => {
        if (!responses) return;
        if (selectedIds.length === responses.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(responses.map(r => r.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const getAnswerForQuestion = (response: SurveyResponse, questionId: string) => {
        return response.answers.find(a => a.questionId === questionId)?.value;
    }

    const handleDeleteClick = (ids?: string[]) => {
        if (ids) setSelectedIds(ids);
        setIsDeleteDialogOpen(true);
        setAuthError(null);
        setPassword('');
    };

    const handleConfirmDelete = async () => {
        if (!user || !user.email) return;
        setAuthError(null);
        setIsDeleting(true);

        try {
            // 1. Re-authenticate
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // 2. Perform deletion
            const result = await deleteSurveyResponses(survey.id, selectedIds, user.uid);
            
            if (result.success) {
                toast({ title: 'Deletions Successful', description: `${selectedIds.length} responses have been removed.` });
                setSelectedIds([]);
                setIsDeleteDialogOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (error: any) {
            console.error("Auth verification failed", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setAuthError('Incorrect password. Access denied.');
            } else {
                setAuthError('Verification failed. Please try again.');
            }
        } finally {
            setIsDeleting(false);
        }
    };
    
    if (!survey) {
        return (
 <div className="p-4">
 <Skeleton className="h-12 w-full mb-2" />
 <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="space-y-0 relative">

            {/* Phase 4: Attribution Filter Toolbar */}
            <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50 flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Filter Source</span>
                    </div>
                    <Select value={attributionFilter} onValueChange={setAttributionFilter}>
                        <SelectTrigger className="h-8 w-[180px] bg-background border-none shadow-sm text-[10px] font-bold rounded-lg">
                            <SelectValue placeholder="All Sources" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all" className="text-[11px] font-medium">All Sources</SelectItem>
                            <SelectItem value="anonymous" className="text-[11px] font-medium italic">General Link (Anonymous)</SelectItem>
                            {attributedUsers.map(uid => (
                                <SelectItem key={uid} value={uid} className="text-[11px] font-bold">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        <SharedByInfo userId={uid} />
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Central Filter Fields Configuration Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 gap-1.5 text-[10px] font-bold rounded-lg border-border/50">
                                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                Filter Config
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4 rounded-2xl" align="start">
                            <div className="space-y-3">
                                <div className="border-b pb-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Configure Filter Columns</h4>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Choose which columns can be filtered directly in the table headers.</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                                    {questions.map(q => {
                                        const isFilter = q.isFilterField || false;
                                        return (
                                            <div key={q.id} className="flex items-center justify-between gap-4 p-2 hover:bg-muted/50 rounded-xl transition-colors">
                                                <span className="text-[11px] font-bold truncate max-w-[160px]" title={stripHtml(q.title || '')}>
                                                    {stripHtml(q.title || '')}
                                                </span>
                                                <Switch 
                                                    checked={isFilter}
                                                    onCheckedChange={(checked) => handleToggleFilterField(q.id, checked)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Columns Visibility Selector */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 gap-1.5 text-[10px] font-bold rounded-lg border-border/50">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-4 rounded-2xl" align="start">
                            <div className="space-y-3">
                                <div className="border-b pb-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Toggle Columns</h4>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Show or hide columns in the responses table.</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar flex flex-col gap-0.5">
                                    {/* Metadata Columns */}
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('submittedAt')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'submittedAt') : [...prev, 'submittedAt']);
                                            }}
                                        />
                                        <span className="font-bold">Submitted At</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('contact')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'contact') : [...prev, 'contact']);
                                            }}
                                        />
                                        <span className="font-bold">Contact / Org</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('sharedBy')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'sharedBy') : [...prev, 'sharedBy']);
                                            }}
                                        />
                                        <span className="font-bold">Shared By</span>
                                    </label>
                                    {survey.scoringEnabled && (
                                        <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                            <Checkbox 
                                                checked={!hiddenColumnIds.includes('score')}
                                                onCheckedChange={(checked) => {
                                                    setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'score') : [...prev, 'score']);
                                                }}
                                            />
                                            <span className="font-bold text-primary">Score</span>
                                        </label>
                                    )}
                                    <div className="border-t my-2 pt-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Question Fields</div>
                                    {/* Question Columns */}
                                    {questions.map(q => {
                                        const isHidden = hiddenColumnIds.includes(q.id);
                                        return (
                                            <label key={q.id} className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                                <Checkbox 
                                                    checked={!isHidden}
                                                    onCheckedChange={(checked) => {
                                                        setHiddenColumnIds(prev => checked ? prev.filter(c => c !== q.id) : [...prev, q.id]);
                                                    }}
                                                />
                                                <span className="font-medium truncate" title={stripHtml(q.title || '')}>
                                                    {stripHtml(q.title || '')}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Hide Empty Columns Toggle */}
                    <div className="flex items-center gap-2 border-l pl-4 border-border/50">
                        <Switch 
                            id="hide-empty-columns" 
                            checked={hideEmptyColumns} 
                            onCheckedChange={setHideEmptyColumns} 
                        />
                        <Label htmlFor="hide-empty-columns" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground cursor-pointer">
                            Hide Empty
                        </Label>
                    </div>

                    {/* Column Width Slider */}
                    <div className="flex items-center gap-2.5 border-l pl-4 border-border/50">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Width</span>
                        <div className="flex items-center gap-2 w-32">
                            <input 
                                type="range" 
                                min="150" 
                                max="500" 
                                value={columnWidth} 
                                onChange={(e) => setColumnWidth(Number(e.target.value))}
                                className="w-full h-1 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none transition-all hover:bg-muted-foreground/30"
                            />
                            <span className="text-[9px] font-bold text-muted-foreground/80 w-8 shrink-0">{columnWidth}px</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {(attributionFilter !== 'all' || deepLinkFilterType || Object.keys(columnFilters).length > 0) && (
                        <button
                            type="button"
                            onClick={() => {
                                setAttributionFilter('all');
                                setDeepLinkFilterType(null);
                                setColumnFilters({});
                                // Clear URL params
                                router.replace(`/admin/surveys/${survey.id}/results?view=responses`, { scroll: false });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black hover:bg-primary/20 transition-colors"
                        >
                            <X className="h-3 w-3" />
                            Clear Filters
                            {deepLinkFilterType && (
                                <Badge variant="outline" className="ml-1 text-[8px] px-1.5 py-0 border-primary/30">
                                    {deepLinkFilterType}
                                </Badge>
                            )}
                        </button>
                    )}
                    <div className="text-[10px] font-bold text-muted-foreground italic">
                        Showing {filteredResponses.length} of {responses?.length || 0} responses
                    </div>
                </div>
            </div>

            {/* Filter Chips Bar */}
            {Object.keys(columnFilters).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/10 border-b border-border/50">
                    <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Active Filters:</span>
                    {Object.entries(columnFilters).map(([questionId, values]) => {
                        const q = questions.find(question => question.id === questionId);
                        if (!q) return null;
                        const label = stripHtml(q.title || '');
                        return (
                            <div key={questionId} className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-black">
                                <span>{label}: {values.join(', ')}</span>
                                <button
                                    onClick={() => {
                                        setColumnFilters(prev => {
                                            const next = { ...prev };
                                            delete next[questionId];
                                            return next;
                                        });
                                    }}
                                    className="hover:text-destructive transition-colors shrink-0 ml-1"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] font-black text-destructive hover:bg-destructive/10 rounded-lg ml-auto"
                        onClick={() => setColumnFilters({})}
                    >
                        Clear All Filters
                    </Button>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/70 hover:bg-muted/70 border-b-2 border-border font-bold shadow-sm">
                        <TableHead 
                            className={cn(
                                "sticky left-0 bg-muted z-30 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Checkbox 
                                checked={responses?.length ? selectedIds.length === responses.length : false} 
                                onCheckedChange={toggleSelectAll} 
                            />
                        </TableHead>
                        {isSubmittedAtVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 whitespace-nowrap text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                Submitted At
                            </TableHead>
                        )}
                        {isContactVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                Contact / Organization
                            </TableHead>
                        )}
                        {isSharedByVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                Shared By
                            </TableHead>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableHead className="w-[100px] text-center text-[10px] font-bold py-4 text-primary">Score</TableHead>
                        )}
                        {visibleQuestions.map(q => {
                            const isFilterActive = columnFilters[q.id] && columnFilters[q.id].length > 0;
                            const options = getFilterOptions(q);
                            const isTextQuestion = ['text', 'long-text', 'email', 'phone', 'link', 'number'].includes(q.type);

                            return (
                                <TableHead 
                                    key={q.id} 
                                    className="text-[10px] font-bold py-4 break-words whitespace-normal align-top"
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="break-words whitespace-normal leading-normal" title={stripHtml(q.title || '')}>{stripHtml(q.title || '')}</span>
                                        {q.isFilterField && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={cn(
                                                            "h-6 w-6 rounded-md hover:bg-muted shrink-0",
                                                            isFilterActive && "text-primary bg-primary/10"
                                                        )}
                                                    >
                                                        <Filter className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-4 rounded-2xl" align="start">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between border-b pb-2">
                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">Filter Field</span>
                                                            {isFilterActive && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-6 px-2 text-[10px] font-black text-destructive"
                                                                    onClick={() => {
                                                                        setColumnFilters(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[q.id];
                                                                            return next;
                                                                        });
                                                                    }}
                                                                >
                                                                    Clear
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {isTextQuestion ? (
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Search term</Label>
                                                                <Input 
                                                                    placeholder="Type search query..."
                                                                    value={columnFilters[q.id]?.[0] || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setColumnFilters(prev => {
                                                                            const next = { ...prev };
                                                                            if (val.trim() === '') {
                                                                                delete next[q.id];
                                                                            } else {
                                                                                next[q.id] = [val];
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="h-9 rounded-xl text-xs"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Select values</Label>
                                                                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                                                                    {options.map(opt => {
                                                                        const isChecked = columnFilters[q.id]?.includes(opt) || false;
                                                                        return (
                                                                            <label key={opt} className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                                                                <Checkbox 
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={(checked) => {
                                                                                        setColumnFilters(prev => {
                                                                                            const next = { ...prev };
                                                                                            const current = next[q.id] || [];
                                                                                            if (checked) {
                                                                                                next[q.id] = [...current, opt];
                                                                                            } else {
                                                                                                next[q.id] = current.filter(c => c !== opt);
                                                                                                if (next[q.id].length === 0) delete next[q.id];
                                                                                            }
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                />
                                                                                <span className="font-medium truncate">{opt}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>
                                </TableHead>
                            );
                        })}
                        <TableHead className="w-[80px] text-right pr-6 text-[10px] font-bold py-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell 
                            className={cn(
                                "sticky left-0 bg-background z-20 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Skeleton className="h-4 w-4 rounded" />
                        </TableCell>
                        {isSubmittedAtVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <Skeleton className="h-5 w-3/4" />
                            </TableCell>
                        )}
                        {isContactVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <Skeleton className="h-5 w-24" />
                            </TableCell>
                        )}
                        {isSharedByVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                <Skeleton className="h-5 w-24" />
                            </TableCell>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                        )}
                        {visibleQuestions.map(q => (
                            <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredResponses && filteredResponses.length > 0 ? (
                    filteredResponses.map((response) => (
                    <TableRow key={response.id} className={cn("group hover:bg-muted/30 transition-colors", selectedIds.includes(response.id) && "bg-primary/5")}>
                        <TableCell 
                            className={cn(
                                "sticky left-0 sticky-cell-hover z-20 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Checkbox 
                                checked={selectedIds.includes(response.id)} 
                                onCheckedChange={() => toggleSelect(response.id)} 
                            />
                        </TableCell>
                        {isSubmittedAtVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20 font-medium whitespace-nowrap",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <span className="text-xs">{format(new Date(response.submittedAt), "MMM d, yyyy · p")}</span>
                            </TableCell>
                        )}
                        {isContactVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <EntityInfo response={response} />
                            </TableCell>
                        )}
                        {isSharedByVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                <SharedByInfo userId={response.assignedUserId} />
                            </TableCell>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableCell className="text-center font-bold">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 w-fit mx-auto">
                                    <Trophy className="h-3 w-3" />
                                    {response.score || 0}
                                </Badge>
                            </TableCell>
                        )}
                        {visibleQuestions.map(q => {
                            const answer = getAnswerForQuestion(response, q.id);
                            const formattedAnswer = formatAnswer(answer);
                            return (
                                <TableCell 
                                    key={q.id} 
                                    title={formattedAnswer} 
                                    className="text-xs text-muted-foreground group-hover:text-foreground transition-colors break-words whitespace-normal py-3 align-top"
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                >
                                    {formattedAnswer}
                                </TableCell>
                            )
                        })}
                        <TableCell className="text-right pr-6">
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Response Options</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/results/${response.id}`)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Detail
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => handleDeleteClick([response.id])}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Response
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={visibleQuestions.length + 6} className="h-48 text-center text-muted-foreground italic">
                            {attributionFilter !== 'all' || Object.keys(columnFilters).length > 0 ? "No responses match this filter." : "No responses received for this survey yet."}
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>

            {/* Password Protected Delete Confirmation */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-center text-xl font-semibold">Verify Identity</DialogTitle>
                        <DialogDescription className="text-center">
                            You are about to permanently delete <strong>{selectedIds.length}</strong> record{selectedIds.length !== 1 ? 's' : ''}. Please enter your admin password to proceed.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Lock className="h-3 w-3" /> Confirm Password
                            </Label>
                            <Input 
                                type="password" 
                                placeholder="Your account password..." 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11 rounded-xl"
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                            />
                            {authError && <p className="text-xs font-bold text-destructive animate-pulse px-1">{authError}</p>}
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between gap-2">
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleConfirmDelete} 
                            disabled={isDeleting || !password}
                            className="font-semibold h-11 px-8 rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default ResponsesListView;
