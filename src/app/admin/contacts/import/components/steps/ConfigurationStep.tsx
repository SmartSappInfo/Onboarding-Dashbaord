import React, { useState, useEffect } from 'react';
import { ImportState } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Tag as TagIcon, Zap, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigurationStep({ state, updateState, onNext, onBack }: Props) {
  const firestore = useFirestore();
  const [availableTags, setAvailableTags] = useState<Array<{id: string, name: string}>>([]);
  const [availableAutomations, setAvailableAutomations] = useState<Array<{id: string, name: string}>>([]);
  const [newTagName, setNewTagName] = useState('');
  
  const config = state.configuration || {
    selectedTags: [],
    selectedAutomations: [],
    globalDefaults: {}
  };

  useEffect(() => {
    async function loadResources() {
      if (!firestore || !state.workspaceId || !state.organizationId) return;

      try {
        // Load Tags
        const tagsRef = collection(firestore, 'tags');
        const qTags = query(tagsRef, where('workspaceId', '==', state.workspaceId));
        const tagsSnap = await getDocs(qTags);
        const loadedTags = tagsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setAvailableTags(loadedTags);

        // Load Automations
        const autoRef = collection(firestore, 'automations');
        const qAuto = query(autoRef, where('workspaceIds', 'array-contains', state.workspaceId), where('isActive', '==', true));
        const autoSnap = await getDocs(qAuto);
        const loadedAuto = autoSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setAvailableAutomations(loadedAuto);
      } catch (err) {
        console.error("Failed to load tags or automations:", err);
      }
    }
    
    loadResources();
  }, [firestore, state.workspaceId, state.organizationId]);

  const toggleTag = (id: string) => {
    const current = config.selectedTags || [];
    const next = current.includes(id) 
      ? current.filter(t => t !== id)
      : [...current, id];
    
    updateState({
      configuration: { ...config, selectedTags: next }
    });
  };

  const toggleAutomation = (id: string) => {
    const current = config.selectedAutomations || [];
    const next = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];

    updateState({
      configuration: { ...config, selectedAutomations: next }
    });
  };

  const handleDefaultChange = (key: string, value: string) => {
    updateState({
      configuration: {
        ...config,
        globalDefaults: {
          ...config.globalDefaults,
          [key]: value
        }
      }
    });
  };

  // We are not calling the server action directly for new tags here to keep it simple,
  // we will just store the new tag name and process it during execution if needed,
  // or we can allow the user to type it in. For now, this step just collects user intent.

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center">Enrichment & Configuration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apply tags, trigger automations, and set default values for all imported contacts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8">
        
        {/* TAGS SECTION */}
        <section className="space-y-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <TagIcon className="w-4 h-4 mr-2 text-primary" /> Apply Tags
          </h4>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const isSelected = config.selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {availableTags.length === 0 && (
                <span className="text-sm text-muted-foreground italic">No existing tags found in this workspace.</span>
              )}
            </div>
            
            <div className="pt-2 border-t flex items-center gap-3">
               <Input 
                 placeholder="Create a new tag..." 
                 value={newTagName}
                 onChange={e => setNewTagName(e.target.value)}
                 className="max-w-[200px] h-9 text-sm"
               />
               <Button 
                 variant="secondary" 
                 size="sm"
                 disabled={!newTagName.trim()}
                 onClick={() => {
                   // Optimistic local add. In a real scenario, we'd save this to DB immediately 
                   // or pass it as a special "new" tag to the backend. 
                   // For now, we simulate adding it to the list.
                   const fakeId = `new_${Date.now()}`;
                   setAvailableTags([...availableTags, { id: fakeId, name: newTagName }]);
                   toggleTag(fakeId);
                   setNewTagName('');
                 }}
               >
                 Add
               </Button>
            </div>
          </div>
        </section>

        {/* AUTOMATIONS SECTION */}
        <section className="space-y-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <Zap className="w-4 h-4 mr-2 text-amber-500" /> Enroll in Automations
          </h4>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm space-y-3">
             {availableAutomations.map(auto => {
               const isSelected = config.selectedAutomations.includes(auto.id);
               return (
                 <label key={auto.id} className="flex items-center space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                   <input 
                     type="checkbox" 
                     className="w-4 h-4 text-primary rounded border-muted-foreground focus:ring-primary"
                     checked={isSelected}
                     onChange={() => toggleAutomation(auto.id)}
                   />
                   <span className="text-sm font-medium">{auto.name}</span>
                 </label>
               )
             })}
             {availableAutomations.length === 0 && (
                <span className="text-sm text-muted-foreground italic">No active automations found for this workspace.</span>
              )}
          </div>
        </section>

        {/* DEFAULTS SECTION */}
        <section className="space-y-4 pb-4">
          <h4 className="text-md font-medium flex items-center text-foreground">
            <Settings2 className="w-4 h-4 mr-2 text-blue-500" /> Global Defaults
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            These values will be applied to EVERY entity if the corresponding field is not provided in the CSV.
          </p>
          <div className="bg-card/50 border rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-2">
              <Label className="text-xs">Default Lead Source</Label>
              <Input 
                placeholder="e.g., File Import, Event 2024..." 
                value={config.globalDefaults['leadSource'] || ''}
                onChange={e => handleDefaultChange('leadSource', e.target.value)}
              />
            </div>
            
            {state.entityType === 'person' && (
              <div className="space-y-2">
                <Label className="text-xs">Default Job Title</Label>
                <Input 
                  placeholder="e.g., Prospect" 
                  value={config.globalDefaults['jobTitle'] || ''}
                  onChange={e => handleDefaultChange('jobTitle', e.target.value)}
                />
              </div>
            )}

            {state.entityType === 'institution' && (
              <div className="space-y-2">
                <Label className="text-xs">Default Currency</Label>
                <Input 
                  placeholder="e.g., USD, GHS" 
                  value={config.globalDefaults['currency'] || ''}
                  onChange={e => handleDefaultChange('currency', e.target.value)}
                />
              </div>
            )}

          </div>
        </section>

      </div>

      <div className="flex justify-between mt-auto pt-6 border-t">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={onNext} className="shadow-md">
          Validate Data <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
