
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { format } from 'date-fns';

import type { PDFForm } from '@/lib/types';
import { deletePdfForm } from '@/lib/pdf-actions';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Edit, Trash2, Loader2, FileText, Share2, Copy } from 'lucide-react';
import UploadPDFButton from './components/UploadPDFButton';

export default function PdfFormsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const [formToDelete, setFormToDelete] = useState<PDFForm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pdfs'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: pdfs, isLoading } = useCollection<PDFForm>(pdfsQuery);
  
  const handleDelete = async () => {
    if (!formToDelete || !user) return;
    
    setIsDeleting(true);
    const result = await deletePdfForm(formToDelete.id, formToDelete.storagePath, user.uid);
    
    if (result.success) {
      toast({ title: 'PDF Form Deleted' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    
    setFormToDelete(null);
    setIsDeleting(false);
  }

  const getStatusVariant = (status: PDFForm['status']) => {
    switch(status) {
      case 'published': return 'default';
      case 'archived': return 'outline';
      case 'draft':
      default:
        return 'secondary';
    }
  }

  return (
    <>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">PDF Forms</h1>
                <p className="text-muted-foreground">Manage your dynamic PDF forms for public filling.</p>
            </div>
            <UploadPDFButton />
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[180px] hidden md:table-cell">Created At</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : pdfs && pdfs.length > 0 ? (
                pdfs.map((pdf) => (
                  <TableRow key={pdf.id}>
                    <TableCell className="font-medium">{pdf.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(pdf.status)} className="capitalize">{pdf.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(pdf.createdAt), "PPP")}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdf.id}/edit`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Map Fields</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { /* Implement share logic */ }}>
                              <Share2 className="mr-2 h-4 w-4" />
                              <span>Share</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/forms/${pdf.id}`)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Public Link</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10"
                              onClick={() => setFormToDelete(pdf)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No PDF Forms Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Upload your first PDF to get started.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
       <AlertDialog open={!!formToDelete} onOpenChange={(open) => !open && setFormToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the PDF form <span className="font-bold">"{formToDelete?.name}"</span> and its associated file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
