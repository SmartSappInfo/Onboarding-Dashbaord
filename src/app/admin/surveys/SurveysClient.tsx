
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import { cloneSurvey, deleteSurveyAction, updateSurveyStatusAction } from '@/lib/survey-actions';
import { usePermissions } from '@/hooks/use-permissions';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, ExternalLink, Edit, Trash2, BarChart2, PlusCircle, Sparkles, Copy, Eye, EyeOff, Trophy, CopyPlus, Loader2, Search, ClipboardList } from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
import { AsyncEntityAvatar } from '../components/AsyncEntityAvatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/context/WorkspaceContext';

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


export default function SurveysClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  
  const { can } = usePermissions();
  const canCreate = can('studios', 'surveys', 'create');
  const canDelete = can('studios', 'surveys', 'delete');
  const canEdit = can('studios', 'surveys', 'edit');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const surveysCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'surveys');
  }, [firestore]);
  
  const surveysQuery = useMemoFirebase(() => {
    if (!surveysCol || !activeWorkspaceId) return null;
    return query(
        surveysCol, 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('createdAt', 'desc')
    );
  }, [surveysCol, activeWorkspaceId]);

  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: surveys, isLoading: isLoadingSurveys, error } = useCollection<Survey>(surveysQuery);
  const { data: entities } = useCollection<any>(entitiesQuery);

  const entityLogoMap = useMemo(() => {
    if (!entities) return new Map<string, string>();
    return new Map(entities.map((e: any) => [e.entityId, e.logoUrl]));
  }, [entities]);

  const isLoading = isLoadingSurveys;

  const handleDeleteSurvey = async () => {
    if (!user || !surveyToDelete) return;

    try {
        const result = await deleteSurveyAction(surveyToDelete.id, user.uid);
        if (result.success) {
            toast({ title: 'Survey Deleted', description: `"${surveyToDelete.internalName || surveyToDelete.title}" removed.` });
            setSurveyToDelete(null);
        } else {
            toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message || "Failed to delete survey." });
    }
  };

  const handleClone = async (survey: Survey) => {
    if (!user) return;
    setCloningId(survey.id);
    toast({ 
      title: 'Cloning Survey...', 
      description: `Creating a replica of "${survey.internalName || survey.title}".` 
    });
    
    try {
      const result = await cloneSurvey(survey.id, user.uid);
      if (result.success) {
        toast({ 
          title: 'Survey Cloned', 
          description: `"${survey.internalName || survey.title}" has been successfully duplicated. Check your list for the copy.` 
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

  const handleStatusChange = async (survey: Survey, newStatus: 'published' | 'draft' | 'archived') => {
    if (!user) return;

    try {
        const result = await updateSurveyStatusAction(survey.id, newStatus, user.uid);
        if (result.success) {
            toast({ title: 'Survey Updated', description: `"${survey.internalName || survey.title}" set to ${newStatus}.` });
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message || "Failed to update status." });
    }
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
      <TooltipProvider>
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
        {canEdit && (
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
        )}
      </TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
 <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors">
 <span className="sr-only">Open menu</span>
 <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {canEdit && (
            <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Edit Content</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/results`)}>
            <BarChart2 className="mr-2 h-4 w-4" />
            <span>View Results</span>
          </DropdownMenuItem>
          {canCreate && (
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
          )}
          {canEdit && <DropdownMenuSeparator />}
          {canEdit && (
            <DropdownMenuItem onClick={() => handleStatusChange(survey, survey.status === 'published' ? 'draft' : 'published')}>
                {survey.status === 'published' ? (
                  <><EyeOff className="mr-2 h-4 w-4" /><span>Unpublish</span></>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" /><span>Publish</span></>
                )}
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10"
              onClick={() => setSurveyToDelete(survey)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (error) {
 return <div className="text-destructive">Error loading surveys: {error.message}</div>;
  }

  const filteredTemplates = surveys?.filter(t => 
    (categoryFilter === 'all' || t.status === categoryFilter) &&
    (t.internalName?.toLowerCase().includes(searchTerm.toLowerCase()) || t.title.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

    return (
        <TooltipProvider>
            <div className="h-full overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-8 pb-32">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <div className="flex flex-col">
                            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground">
                                <Sparkles className="h-10 w-10 text-primary" />
                                Survey Intelligence
                            </h1>
                            <p className="text-muted-foreground font-medium text-lg mt-1">Manage public survey templates and response data.</p>
                        </div>
                <div className="flex justify-end items-center gap-3 shrink-0">
                    {canCreate && (
                        <RainbowButton asChild className="h-11 rounded-xl font-semibold">
                            <Link href="/admin/surveys/new/ai">
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI Architect
                            </Link>
                        </RainbowButton>
                    )}
                    {canCreate && (
                        <Button asChild className="h-11 rounded-xl font-bold shadow-lg">
                            <Link href="/admin/surveys/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Survey
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-center bg-transparent p-4 rounded-3xl border shadow-sm ring-1 ring-border">
                 <div className="relative flex-1 w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Search survey titles..." 
                         className="pl-10 h-10 bg-background/50 backdrop-blur-sm border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:ring-1 focus:ring-primary/20 font-medium shadow-sm transition-all" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                     <SelectTrigger className="w-[180px] h-10 bg-background/50 backdrop-blur-sm border-border text-foreground rounded-xl shadow-sm transition-all focus:ring-1 focus:ring-primary/20">
                        <SelectValue />
                    </SelectTrigger>
 <SelectContent className="rounded-xl">
                        <SelectItem value="all">Global Hub</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Drafts</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="rounded-2xl border border-border bg-transparent text-card-foreground shadow-sm overflow-hidden">
             <Table>
                 <TableHeader className="bg-muted/10">
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold py-4 pl-6">Blueprint Title</TableHead>
                        <TableHead className="w-[120px] text-muted-foreground text-[10px] uppercase tracking-widest font-semibold py-4 text-center">Status</TableHead>
                        <TableHead className="w-[120px] text-center text-muted-foreground text-[10px] uppercase tracking-widest font-semibold py-4">Responses</TableHead>
                        <TableHead className="w-[180px] hidden md:table-cell text-muted-foreground text-[10px] uppercase tracking-widest font-semibold py-4">Created At</TableHead>
                        <TableHead className="w-[160px] text-right text-muted-foreground text-[10px] uppercase tracking-widest font-semibold py-4 pr-6">Management</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-5 w-3/4" /></TableCell>
 <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
 <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
 <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
 <TableCell className="text-right pr-6"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredTemplates.length > 0 ? (
                    filteredTemplates.map((survey) => (
 <TableRow key={survey.id} className="group hover:bg-accent/5 transition-colors border-border/30">
 <TableCell className="font-bold pl-6">
 <div className="flex items-center gap-3">
                                <AsyncEntityAvatar 
                                    entityId={survey.entityId}
                                    src={survey.logoUrl || (survey.entityId ? entityLogoMap.get(survey.entityId) : undefined)} 
                                    name={survey.internalName || survey.title} 
                                    className="h-8 w-8 ring-1 ring-border shadow-none"
                                    fallbackClassName="text-[8px] bg-primary/5 text-primary"
                                />
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <Link href={`/admin/surveys/${survey.id}/edit`} className="hover:underline hover:text-primary transition-colors text-sm font-bold truncate block">
                                        {survey.internalName || survey.title}
                                    </Link>
                                    {survey.scoringEnabled && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[8px] h-5 uppercase px-1.5 font-semibold gap-1">
 <Trophy className="h-2.5 w-2.5" />
                                            Scored
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>This survey uses the intelligent scoring engine.</TooltipContent>
                                </Tooltip>
                                )}
                            </div>
                        </div>
                    </TableCell>
                        <TableCell className="text-center"><Badge variant={getStatusVariant(survey.status)} className="capitalize text-[9px] font-semibold uppercase rounded-full px-2.5">{survey.status}</Badge></TableCell>
 <TableCell className="text-center">
 <Button variant="link" asChild className="font-semibold text-sm h-auto p-0 hover:text-primary">
                                <Link href={`/admin/surveys/${survey.id}/results?view=responses`}>
                                    <SurveyResponseCount surveyId={survey.id} />
                                </Link>
                            </Button>
                        </TableCell>
 <TableCell className="hidden md:table-cell text-[10px] font-bold text-muted-foreground ">
                        {survey.createdAt ? format(new Date(survey.createdAt), "MMM d, yyyy") : '—'}
                        </TableCell>
 <TableCell className="text-right pr-6">
                        {renderActions(survey)}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
 <TableCell colSpan={5} className="h-64 text-center">
 <div className="flex flex-col items-center justify-center gap-3 opacity-30">
 <ClipboardList className="h-12 w-12" />
 <p className="font-semibold text-xs">No active blueprints found in this workspace hub</p>
                        </div>
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
            </div>
        </div>
      <AlertDialog open={!!surveyToDelete} onOpenChange={(open) => !open && setSurveyToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-border shadow-lg">
          <AlertDialogHeader>
 <AlertDialogTitle className="font-semibold">Delete Survey?</AlertDialogTitle>
 <AlertDialogDescription className="text-sm font-medium">
 This will permanently remove the survey <span className="font-bold text-foreground">"{surveyToDelete?.internalName || surveyToDelete?.title}"</span> and all gathered response data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
 <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={handleDeleteSurvey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
