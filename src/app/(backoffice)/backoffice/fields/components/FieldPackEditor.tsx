import * as React from 'react';
import { FolderKanban, Plus, Layers, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listFieldPacks } from '@/lib/backoffice/backoffice-field-actions';
import type { PlatformFieldPack } from '@/lib/backoffice/backoffice-types';
import { useBackoffice } from '../../context/BackofficeProvider';

export default function FieldPackEditor() {
  const { can } = useBackoffice();
  const [packs, setPacks] = React.useState<PlatformFieldPack[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await listFieldPacks();
      if (res.success && res.data) {
        setPacks(res.data);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6">
       <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
               <FolderKanban className="h-4 w-4 text-emerald-400" />
               Custom Field Packs
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Pre-configured bundles of custom fields mapped to specific entity types.</p>
          </div>
          {can('fields', 'create') && (
             <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-9">
                 <Plus className="h-4 w-4 mr-2" /> Create Pack
             </Button>
          )}
       </div>
       
       {isLoading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                 <div key={i} className="h-40 bg-accent/40 rounded-xl animate-pulse border border-border" />
              ))}
           </div>
       ) : packs.length === 0 ? (
           <div className="text-center py-12 bg-accent/20 rounded-xl border border-border/30 border-dashed">
              <FolderKanban className="h-8 w-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No field packs configured.</p>
              <p className="text-xs text-slate-600">Create a field pack to template out custom fields for new tenants.</p>
           </div>
       ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.map(pack => (
                 <div key={pack.id} className="p-5 rounded-xl border border-border bg-accent/30 relative group hover:border-slate-600 transition-colors">
                    {pack.isDefaultForNewWorkspaces && (
                       <Badge variant="outline" className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase px-1.5 h-4">
                          Default
                       </Badge>
                    )}
                    <h4 className="text-sm font-semibold text-foreground pr-16">{pack.name}</h4>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[32px]">{pack.description}</p>
                    
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">{pack.fields?.length || 0} Fields</span>
                          <div className="flex items-center gap-1">
                            {pack.entityCompatibility?.map(ec => (
                               <Badge key={ec} variant="outline" className="bg-muted border-border text-foreground/80 text-[8px] uppercase px-1 py-0 h-auto">
                                  {ec.substring(0, 3)}
                               </Badge>
                            ))}
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-700/50 rounded-lg">
                          <Eye className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
              ))}
           </div>
       )}
    </div>
  );
}
