'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Survey } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, ExternalLink, Edit, Trash2, BarChart2, PlusCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function SurveysPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);

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

  const getStatusVariant = (status: Survey['status']) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  }

  if (error) {
    return <div className="text-destructive">Error loading surveys: {error.message}</div>;
  }

  return (
    <AlertDialog>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Surveys</h1>
          <Button asChild>
            <Link href="/admin/surveys/new">
              <PlusCircle />
              Create New Survey
            </Link>
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[120px]">Responses</TableHead>
                <TableHead className="w-[180px]">Created At</TableHead>
                <TableHead className="w-[50px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : surveys && surveys.length > 0 ? (
                surveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">{survey.title}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(survey.status)} className="capitalize">{survey.status}</Badge></TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>
                      {survey.createdAt ? format(new Date(survey.createdAt), "PPP") : 'Not set'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/edit`)}>
                            <Edit />
                            <span>Edit Survey</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/surveys/${survey.id}/results`)}>
                            <BarChart2 />
                            <span>View Results</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/surveys/${survey.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              <span>View Public Page</span>
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => setSurveyToDelete(survey)}
                            >
                              <Trash2 />
                              <span>Delete Survey</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No surveys found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the survey <span className="font-bold">"{surveyToDelete?.title}"</span> and all its responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSurveyToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSurvey}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
