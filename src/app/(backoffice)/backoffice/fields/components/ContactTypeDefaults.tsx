import * as React from 'react';
import { Users, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getContactTypeDefaults, saveContactTypeDefaults } from '@/lib/backoffice/backoffice-field-actions';
import { getSystemContactTypes } from '@/lib/contact-type-defaults';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { ContactTypeEntry, EntityType } from '@/lib/types';

export default function ContactTypeDefaults() {
  const { profile, can } = useBackoffice();
  const [activeEntity, setActiveEntity] = React.useState<EntityType>('institution');
  const [types, setTypes] = React.useState<ContactTypeEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await getContactTypeDefaults(activeEntity);
      if (res.success && res.data && res.data.types.length > 0) {
        setTypes(res.data.types);
      } else {
        // Fallback to hardcoded defaults
        setTypes(getSystemContactTypes(activeEntity));
      }
      setIsLoading(false);
    }
    load();
  }, [activeEntity]);

  const handleUpdate = (idx: number, updates: Partial<ContactTypeEntry>) => {
    const newTypes = [...types];
    newTypes[idx] = { ...newTypes[idx], ...updates };
    setTypes(newTypes);
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    const res = await saveContactTypeDefaults(activeEntity, types, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin'
    });
    if (res.success) alert('Saved successfully via audit log.');
    setIsSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-6 flex flex-col md:flex-row gap-8">
       {/* Sidebar for Entities */}
       <div className="w-full md:w-64 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
               <Users className="h-4 w-4 text-emerald-400" />
               Entities
          </h3>
          {(['institution', 'family', 'person'] as EntityType[]).map(entity => (
             <Button
                key={entity}
                variant={activeEntity === entity ? 'secondary' : 'ghost'}
                onClick={() => setActiveEntity(entity)}
                className={`w-full justify-start capitalize h-10 ${activeEntity === entity ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'text-muted-foreground hover:text-foreground'}`}
             >
                {entity} Contacts
             </Button>
          ))}
       </div>
       
       {/* Editor Pane */}
       <div className="flex-1 bg-muted/50 border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
             <div>
                <h4 className="text-foreground font-semibold text-lg capitalize">{activeEntity} Contact Schema</h4>
                <p className="text-xs text-muted-foreground mt-1">Define the fallback roles assigned when an organization uses this entity type.</p>
             </div>
             {can('fields', 'edit') && (
                <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-foreground h-9 rounded-lg px-4">
                   {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-2" /> Save Active Schema</>}
                </Button>
             )}
          </div>
          
          {isLoading ? (
             <div className="space-y-3">
                <div className="h-14 bg-accent/50 rounded-xl rounded animate-pulse" />
                <div className="h-14 bg-accent/50 rounded-xl rounded animate-pulse" />
             </div>
          ) : (
             <div className="space-y-3">
                {types.map((type, idx) => (
                   <div key={type.key} className="flex items-center gap-4 p-3 bg-accent/30 border border-border rounded-xl">
                      <Switch 
                         checked={type.active} 
                         onCheckedChange={(val) => handleUpdate(idx, { active: val })} 
                         disabled={!can('fields', 'edit')}
                      />
                      <div className="flex-1 grid grid-cols-2 gap-4">
                         <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Key (Immutable)</span>
                            <Input value={type.key} disabled className="h-8 bg-muted border-border font-mono text-xs text-muted-foreground" />
                         </div>
                         <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Label</span>
                            <Input 
                               value={type.label} 
                               onChange={(e) => handleUpdate(idx, { label: e.target.value })} 
                               className="h-8 bg-muted border-border text-sm text-foreground" 
                               disabled={!can('fields', 'edit')}
                            />
                         </div>
                      </div>
                      <div className="w-16">
                         <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Order</span>
                         <Input 
                            type="number" 
                            value={type.order} 
                            onChange={(e) => handleUpdate(idx, { order: parseInt(e.target.value) || 0 })} 
                            className="h-8 bg-muted border-border text-center" 
                            disabled={!can('fields', 'edit')}
                         />
                      </div>
                   </div>
                ))}
             </div>
          )}
       </div>
    </div>
  );
}
