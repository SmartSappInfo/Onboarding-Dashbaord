'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import { cloneSurvey } from '@/lib/survey-actions';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, ExternalLink, Edit, Trash2, BarChart2, PlusCircle, Sparkles, Copy, Eye, EyeOff, Trophy, CopyPlus, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { cn } from '@/lib/utils';

function SurveyResponseCount({ surveyId }: { surveyId: string }) {
    const firestore = useFirestore();
    const responsesCol = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, `surveys/${surveyId}/responses`);
    }, [firestore, surveyId]);
    
    const { data: responses, isLoading } = useCollection<{id: string}>(responsesCol);

    if (isLoading) return <Skeleton className="h-5 w-8" />;

    return <>{responses?.length ?? 0}</>;
}


export default function SurveysPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const surveysCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'surveys');
  }, [firestore]);
  
  const surveysQuery = useMemoFirebase(() => {
    if (!surveysCol) return null;
    return query(surveysCol, orderBy('createdAt', 'desc'));
  }, [surveysCol]);

  const { data: surveys, isLoading, error } = useCollection<Survey>(surveysQuery);

  const handleDeleteSurvey = () => {
    if (!firestore || !surveyToDelete) return;

    const docRef = doc(firestore, 'surveys', surveyToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        toast({
          title: 'Survey Deleted',
          description: `The survey "${surveyToDelete.title}" has been deleted.`,
        });
        setSurveyToDelete(null);
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Error deleting survey',
          description: 'You may not have the required permissions.',
        });
        setSurveyToDelete(null);
      });
  };

  const handleClone = async (survey: Survey) => {
    if (!user) return;
    setCloningId(survey.id);
    toast({ 
      title: 'Cloning Survey...', 
      description: `Creating a replica of "${survey.title}".` 
    });
    
    try {
      const result = await cloneSurvey(survey.id, user.uid);
      if (result.success) {
        toast({ 
          title: 'Survey Cloned', 
          description: `"${survey.title}" has been successfully duplicated. Check your list for the copy.` 
        });
      } else {
        toast({ variant: 'destructive', title: 'Clone Failed', description: result.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete cloning operation.' });
    } finally {
      setCloningId(null);
    }
  };

  const handleStatusChange = (survey: Survey, newStatus: 'published' | 'draft' | 'archived') => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore not available.',
      });
      return;
    }

    const docRef = doc(firestore, 'surveys', survey.id);
    updateDoc(docRef, { status: newStatus })
      .then(() => {
        toast({
          title: 'Survey Updated',
          description: `"${survey.title}" has been set to ${newStatus}.`,
        });
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { status: newStatus },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: 'You may not have the required permissions to change the survey status.',
        });
      });
  };

  const getStatusVariant = (status: Survey['status']) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  }

  const renderActions = (survey: Survey) => (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const url = `${window.location.origin}/surveys/${survey.slug}`;
                navigator.clipboard.writeText(url);
                toast({
                  title: "Link Copied",
                  description: "Public survey URL copied to clipboard.",
                });
              }
            }}
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy link</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy Public Link</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" asChild>
            <a href={`/surveys/${survey.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View public page</span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View Public Page</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => router.push(`/admin/surveys/${survey.id}/edit`)}
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit survey</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Edit Survey</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Content</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/results`)}>
            <BarChart2 className="mr-2 h-4 w-4" />
            <span>View Results</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleClone(survey)}
            disabled={cloningId !== null}
          >
            {cloningId === survey.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CopyPlus className="mr-2 h-4 w-4" />
            )}
            <span>Clone Survey</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleStatusChange(survey, survey.status === 'published' ? 'draft' : 'published')}>
              {survey.status === 'published' ? (
                  <><EyeOff className="mr-2 h-4 w-4" /><span>Unpublish</span></>
              ) : (
                  <><Eye className="mr-2 h-4 w-4" /><span>Publish</span></>
              )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10"
            onClick={() => setSurveyToDelete(survey)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (error) {
    return <div className="text-destructive">Error loading surveys: {error.message}</div>;
  }

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-8 gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Surveys</h1>
                <p className="text-muted-foreground">Manage your school engagement surveys and feedback forms.</p>
            </div>
            <div className="flex items-center gap-2">
                <RainbowButton asChild>
                    <Link href="/admin/surveys/new/ai">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create With AI
                    </Link>
                </RainbowButton>
                <Button asChild>
                    <Link href="/admin/surveys/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Survey
                    </Link>
                </Button>
            </div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4 pl-6">Title</TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest py-4">Status</TableHead>
                <TableHead className="w-[120px] text-center text-[10px] font-bold uppercase tracking-widest py-4">Responses</TableHead>
                <TableHead className="w-[180px] hidden md:table-cell text-[10px] font-bold uppercase tracking-widest py-4">Created At</TableHead>
                <TableHead className="w-[160px] text-right text-[10px] font-bold uppercase tracking-widest py-4 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : surveys && surveys.length > 0 ? (
                surveys.map((survey) => (
                  <TableRow key={survey.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium pl-6">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/surveys/${survey.id}/edit`} className="hover:underline hover:text-primary transition-colors">
                          {survey.title}
                        </Link>
                        {survey.scoringEnabled && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 uppercase px-1.5 font-black gap-1">
                                        <Trophy className="h-2.5 w-2.5" />
                                        Scored
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>This survey uses the intelligent scoring engine.</TooltipContent>
                            </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={getStatusVariant(survey.status)} className="capitalize text-[10px] font-bold rounded-full px-2.5">{survey.status}</Badge></TableCell>
                    <TableCell className="text-center">
                        <Button variant="link" asChild className="font-black text-sm h-auto p-0">
                            <Link href={`/admin/surveys/${survey.id}/results?view=responses`}>
                                <SurveyResponseCount surveyId={survey.id} />
                            </Link>
                        </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {survey.createdAt ? format(new Date(survey.createdAt), "PPP") : 'Not set'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                       {renderActions(survey)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <PlusCircle className="mx-auto h-12 w-12 text-muted-foreground/30" />
                    <h3 className="mt-4 text-lg font-bold">No Surveys Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground italic">Create your first intelligent survey manually or with AI.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialog open={!!surveyToDelete} onOpenChange={(open) => !open && setSurveyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the survey <span className="font-bold">"{surveyToDelete?.title}"</span> and all its responses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSurvey}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
