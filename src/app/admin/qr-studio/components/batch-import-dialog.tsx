'use client';

import * as React from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { batchCreateQRCodes, type BatchQRItem } from '@/lib/qr-actions';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function BatchImportDialog({ open, onOpenChange, onSuccess }: BatchImportDialogProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();
  const [file, setFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [items, setItems] = React.useState<BatchQRItem[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setItems([]);
      setErrors([]);
    }
  }, [open]);

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
        
        // Skip header row if it exists
        const dataRows = rows[0].toLowerCase().includes('name') ? rows.slice(1) : rows;
        
        const parsedItems: BatchQRItem[] = [];
        const currentErrors: string[] = [];

        dataRows.forEach((row, index) => {
          // Simple split by comma
          const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          
          if (cols.length >= 2) {
            const name = cols[0];
            const url = cols[1];
            
            if (!name || !url) {
              currentErrors.push(`Row ${index + 1}: Name and URL are required.`);
              return;
            }

            parsedItems.push({
              name,
              destinationUrl: url,
              utmSource: cols[2] || undefined,
              utmMedium: cols[3] || undefined,
              utmCampaign: cols[4] || undefined,
            });
          } else {
            currentErrors.push(`Row ${index + 1}: Invalid format. Expected Name, URL, [Source, Medium, Campaign].`);
          }
        });

        setItems(parsedItems);
        setErrors(currentErrors);
      } catch (err) {
        setErrors(['Failed to parse CSV file. Please check the format.']);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parseCSV(selected);
    }
  };

  const downloadSampleCSV = () => {
    const headers = 'Name,Destination URL,UTM Source,UTM Medium,UTM Campaign\n';
    const sample = 'Summer Sale,https://example.com/promo,summer-2024,email,seasonal-sale\n';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartsapp-qr-import-sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!activeOrganizationId || !activeWorkspaceId || !user || items.length === 0) return;
    setIsProcessing(true);
    try {
      const result = await batchCreateQRCodes(
        activeOrganizationId,
        activeWorkspaceId,
        DEFAULT_QR_DESIGN,
        items,
        { userId: user.uid, name: user.displayName || '', email: user.email || '' }
      );
      toast({ title: 'Batch import successful', description: `Created ${result.count} QR codes.` });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import failed', description: err.message || 'Failed to import QR codes.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl bg-white dark:bg-[#0f1117] border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Batch Create QR Codes</DialogTitle>
          <DialogDescription>
            Upload a CSV file to generate multiple QR codes at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!file ? (
            <div 
              className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Click to upload CSV</h3>
              <p className="text-xs text-muted-foreground max-w-[250px] mb-4">
                Format: Name, Destination URL, UTM Source, UTM Medium, UTM Campaign
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-xs font-bold h-auto p-0 text-primary"
                onClick={(e) => { e.stopPropagation(); downloadSampleCSV(); }}
              >
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                Download Sample CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/10">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{items.length} valid rows found</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2 max-h-32 overflow-y-auto">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-xs font-semibold">Found {errors.length} errors</p>
                  </div>
                  <ul className="list-disc list-inside text-xs text-destructive/80 space-y-1">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || items.length === 0 || isProcessing || errors.length > 0} 
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Import {items.length} Codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
