'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion, ResolvedContact } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trophy, Trash2, MoreHorizontal, CheckSquare, Loader2, Lock, Eye, AlertTriangle, Building2, User as UserIcon, Filter, Search, ShieldCheck } from 'lucide-react';
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
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { deleteSurveyResponses } from '@/lib/survey-actions';
import { resolveContact } from '@/lib/contact-adapter';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';

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
        
        const { getDoc, doc } = require('firebase/firestore');
        getDoc(doc(firestore, 'users', userId)).then((snap: any) => {
            if (snap.exists()) {
                setName(snap.data().name || snap.data().email);
            }
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
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

function ResponsesListView({ survey, responses, isLoading }: { survey: Survey, responses: SurveyResponse[], isLoading: boolean }) {
    const router = useRouter();
    const { toast } = useToast();
    const auth = useAuth();
    const { user } = useUser();

    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [attributionFilter, setAttributionFilter] = React.useState<string>('all');

    const filteredResponses = React.useMemo(() => {
        if (!responses) return [];
        if (attributionFilter === 'all') return responses;
        if (attributionFilter === 'anonymous') return responses.filter(r => !r.assignedUserId);
        return responses.filter(r => r.assignedUserId === attributionFilter);
    }, [responses, attributionFilter]);

    // Get unique assigned users for filtering
    const attributedUsers = React.useMemo(() => {
        if (!responses) return [];
        const ids = Array.from(new Set(responses.map(r => r.assignedUserId).filter(Boolean))) as string[];
        return ids;
    }, [responses]);

    const questions = React.useMemo(() => survey ? survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el) : [], [survey]);

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

    const formatAnswer = (value: any): string => {
        if (value === undefined || value === null) return '-';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') {
            if (value.options) {
                let text = value.options.join(', ');
                if (value.other) text += `, Other: ${value.other}`;
                return text;
            }
            return JSON.stringify(value);
        }
        return String(value);
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
            <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50">
                <div className="flex items-center gap-4">
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
                </div>
                <div className="text-[10px] font-bold text-muted-foreground italic">
                    Showing {filteredResponses.length} of {responses?.length || 0} responses
                </div>
            </div>

            <Table>
                <TableHeader>
 <TableRow className="bg-background0 border-b border-border/50">
 <TableHead className="w-[50px] pl-6">
                            <Checkbox 
                                checked={responses?.length ? selectedIds.length === responses.length : false} 
                                onCheckedChange={toggleSelectAll} 
                            />
                        </TableHead>
 <TableHead className="sticky left-[50px] bg-muted z-20 w-[180px] whitespace-nowrap text-[10px] font-bold py-4">Submitted At</TableHead>
 <TableHead className="w-[180px] text-[10px] font-bold py-4">Contact / Organization</TableHead>
 <TableHead className="w-[150px] text-[10px] font-bold py-4">Shared By</TableHead>
                        {survey.scoringEnabled && (
 <TableHead className="w-[100px] text-center text-[10px] font-bold py-4 text-primary">Score</TableHead>
                        )}
                        {questions.map(q => (
 <TableHead key={q.id} className="min-w-[200px] text-[10px] font-bold py-4">{q.title}</TableHead>
                        ))}
 <TableHead className="w-[80px] text-right pr-6 text-[10px] font-bold py-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-4 w-4 rounded" /></TableCell>
 <TableCell className="sticky left-[50px] bg-card"><Skeleton className="h-5 w-3/4" /></TableCell>
 <TableCell><Skeleton className="h-5 w-24" /></TableCell>
 <TableCell><Skeleton className="h-5 w-24" /></TableCell>
 {survey.scoringEnabled && <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>}
                        {questions.map(q => (
 <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
 <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredResponses && filteredResponses.length > 0 ? (
                    filteredResponses.map((response) => (
 <TableRow key={response.id} className={cn("group hover:bg-muted/30 transition-colors", selectedIds.includes(response.id) && "bg-primary/5")}>
 <TableCell className="pl-6">
                            <Checkbox 
                                checked={selectedIds.includes(response.id)} 
                                onCheckedChange={() => toggleSelect(response.id)} 
                            />
                        </TableCell>
 <TableCell className="sticky left-[50px] bg-background group-hover:bg-muted/30 font-medium whitespace-nowrap border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
 <span className="text-xs">{format(new Date(response.submittedAt), "MMM d, yyyy · p")}</span>
                        </TableCell>
                        <TableCell>
                            <EntityInfo response={response} />
                        </TableCell>
                        <TableCell>
                            <SharedByInfo userId={response.assignedUserId} />
                        </TableCell>
                        {survey.scoringEnabled && (
 <TableCell className="text-center font-bold">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 w-fit mx-auto">
 <Trophy className="h-3 w-3" />
                                    {response.score || 0}
                                </Badge>
                            </TableCell>
                        )}
                        {questions.map(q => {
                            const answer = getAnswerForQuestion(response, q.id);
                            const formattedAnswer = formatAnswer(answer);
                            return (
 <TableCell key={q.id} title={formattedAnswer} className="max-w-[250px] truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">
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
 <TableCell colSpan={questions.length + 6} className="h-48 text-center text-muted-foreground italic">
                        {attributionFilter !== 'all' ? "No responses match this filter." : "No responses received for this survey yet."}
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
