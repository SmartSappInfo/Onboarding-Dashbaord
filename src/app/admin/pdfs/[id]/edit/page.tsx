
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, Eye } from 'lucide-react';
import { type PDFForm, type PDFFormField } from '@/lib/types';
import { updatePdfFormMapping } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import FieldMapper from './components/FieldMapper';
import PdfPreviewDialog from './components/PdfPreviewDialog';


export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const pdfId = params.id as string;
  const firestore = useFirestore();

  const [fields, setFields] = React.useState<PDFFormField[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);
  
  React.useEffect(() => {
    if (pdf) {
      // Deep copy to avoid direct mutation of props and ensure editor state is independent
      setFields(JSON.parse(JSON.stringify(pdf.fields || [])));
    }
  }, [pdf]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updatePdfFormMapping(pdfId, fields);
    if (result.success) {
      toast({ title: 'Field map saved successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
    }
    setIsSaving(false);
  };
  
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col">
        <div className="flex-shrink-0">
          <Skeleton className="h-8 w-1/4" />
        </div>
        <div className="flex-grow min-h-0 mt-4">
          <Skeleton className="h-[calc(100%-4rem)] w-full" />
        </div>
      </div>
    )
  }

  if (!pdf) {
      return (
        <div className="text-center py-20">
            <p>Document not found.</p>
        </div>
      );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push('/admin/pdfs')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <h1 className="text-lg font-semibold truncate">{pdf.name}</h1>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
            </Button>
        </div>
      </div>

      <div className="flex-grow min-h-0">
        <FieldMapper
            pdf={pdf}
            fields={fields}
            setFields={setFields}
        />
      </div>

      <PdfPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfForm={{ ...pdf, fields: fields }}
      />
    </div>
  );
}
