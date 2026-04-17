import * as React from 'react';
import { Database, Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listNativeFields } from '@/lib/backoffice/backoffice-field-actions';
import type { PlatformFieldDefinition } from '@/lib/backoffice/backoffice-types';

export default function NativeFieldRegistry() {
  const [fields, setFields] = React.useState<PlatformFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await listNativeFields();
      if (res.success && res.data) {
        setFields(res.data);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const filtered = React.useMemo(() => {
    return fields.filter(f => 
       f.label.toLowerCase().includes(search.toLowerCase()) || 
       f.key.toLowerCase().includes(search.toLowerCase())
    );
  }, [fields, search]);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6">
       <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
               <Database className="h-4 w-4 text-emerald-400" />
               Native Platform Fields
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Built-in hardcoded fields that cannot be removed by organizations.</p>
          </div>
          <Button size="sm" className="bg-accent hover:bg-slate-700 text-foreground border border-border rounded-xl h-9">
              <Plus className="h-4 w-4 mr-2" /> Add Field
          </Button>
       </div>
       
       <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search native fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-border text-foreground text-sm rounded-lg"
            />
          </div>
       </div>
       
       <div className="rounded-xl border border-border bg-background overflow-hidden">
          <Table>
             <TableHeader>
               <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Key</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Label</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Type</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">Required</TableHead>
                  <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold w-12" />
               </TableRow>
             </TableHeader>
             <TableBody>
                {isLoading ? (
                   <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Loading fields...</TableCell>
                   </TableRow>
                ) : filtered.length === 0 ? (
                   <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-6">
                         <p className="text-sm text-muted-foreground">No defined native fields found.</p>
                      </TableCell>
                   </TableRow>
                ) : (
                   filtered.map(f => (
                      <TableRow key={f.key} className="border-border hover:bg-accent/20">
                         <TableCell className="font-mono text-xs text-foreground/80">{f.key}</TableCell>
                         <TableCell className="font-medium text-sm text-foreground">{f.label}</TableCell>
                         <TableCell>
                            <Badge variant="outline" className="bg-accent text-foreground/80 border-border text-[9px] uppercase px-1.5">{f.type}</Badge>
                         </TableCell>
                         <TableCell className="text-center">
                            {f.required ? <span className="text-emerald-400 text-xs font-bold">YES</span> : <span className="text-muted-foreground text-xs">NO</span>}
                         </TableCell>
                         <TableCell>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                               <Pencil className="h-3.5 w-3.5" />
                            </Button>
                         </TableCell>
                      </TableRow>
                   ))
                )}
             </TableBody>
          </Table>
       </div>
    </div>
  );
}
