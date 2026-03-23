'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trophy, Trash2, MoreHorizontal, CheckSquare, Loader2, Lock, Eye, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
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
import { useAuth, useUser } from '@/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { deleteSurveyResponses } from '@/lib/survey-actions';
import { cn } from '@/lib/utils';

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
        <div className="relative">
            {/* Selection Toolbar */}
            {selectedIds.length > 0 && (
                <div className="sticky top-0 z-30 flex items-center justify-between bg-primary p-3 shadow-lg rounded-b-xl animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 text-white">
                        <CheckSquare className="h-5 w-5" />
                        <span className="font-bold text-sm">{selectedIds.length} responses selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setSelectedIds([])}>
                            Cancel
                        </Button>
                        <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 font-bold" onClick={() => handleDeleteClick()}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Selected
                        </Button>
                    </div>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 border-b border-border/50">
                        <TableHead className="w-[50px] pl-6">
                            <Checkbox 
                                checked={responses?.length ? selectedIds.length === responses.length : false} 
                                onCheckedChange={toggleSelectAll} 
                            />
                        </TableHead>
                        <TableHead className="sticky left-[50px] bg-muted z-20 w-[200px] whitespace-nowrap text-[10px] font-bold uppercase tracking-widest py-4">Submitted At</TableHead>
                        {survey.scoringEnabled && (
                            <TableHead className="w-[100px] text-center text-[10px] font-bold uppercase tracking-widest py-4">Score</TableHead>
                        )}
                        {questions.map(q => (
                            <TableHead key={q.id} className="min-w-[200px] text-[10px] font-bold uppercase tracking-widest py-4">{q.title}</TableHead>
                        ))}
                        <TableHead className="w-[80px] text-right pr-6 text-[10px] font-bold uppercase tracking-widest py-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell className="pl-6"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                        <TableCell className="sticky left-[50px] bg-card"><Skeleton className="h-5 w-3/4" /></TableCell>
                        {survey.scoringEnabled && <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>}
                        {questions.map(q => (
                            <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : responses && responses.length > 0 ? (
                    responses.map((response) => (
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
                    <TableCell colSpan={questions.length + 4} className="h-48 text-center text-muted-foreground italic">
                        No responses received for this survey yet.
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
                        <DialogTitle className="text-center text-xl font-black">Verify Identity</DialogTitle>
                        <DialogDescription className="text-center">
                            You are about to permanently delete <strong>{selectedIds.length}</strong> record{selectedIds.length !== 1 ? 's' : ''}. Please enter your admin password to proceed.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
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
                            className="font-black h-11 px-8 rounded-xl shadow-lg transition-all active:scale-95"
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
