import React, { useEffect, useState } from 'react';
import { ImportState, ColumnMapping } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Wand2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PERSON_FIELDS = [
  { value: 'firstName', label: 'First Name', required: true },
  { value: 'lastName', label: 'Last Name', required: true },
  { value: 'email', label: 'Email Address' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'company', label: 'Company Name' },
  { value: 'jobTitle', label: 'Job Title' },
];

const FAMILY_FIELDS = [
  { value: 'familyName', label: 'Family Name', required: true },
  { value: 'guardian1_name', label: 'Guardian 1 Name' },
  { value: 'guardian1_phone', label: 'Guardian 1 Phone' },
  { value: 'guardian1_email', label: 'Guardian 1 Email' },
  { value: 'child1_firstName', label: 'Child 1 First Name' },
  { value: 'child1_lastName', label: 'Child 1 Last Name' },
];

const INSTITUTION_FIELDS = [
  { value: 'name', label: 'Institution Name', required: true },
  { value: 'nominalRoll', label: 'Nominal Roll' },
  { value: 'focalPerson_name', label: 'Focal Person Name' },
  { value: 'focalPerson_email', label: 'Focal Person Email' },
  { value: 'focalPerson_phone', label: 'Focal Person Phone' },
];

export function MappingStep({ state, updateState, onNext, onBack }: Props) {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>([]);

  const targetFields = state.entityType === 'person' 
    ? PERSON_FIELDS 
    : state.entityType === 'family' 
      ? FAMILY_FIELDS 
      : INSTITUTION_FIELDS;

  useEffect(() => {
    if (state.mappings.length > 0) {
      setLocalMappings(state.mappings);
      return;
    }

    // Auto mapping logic
    const defaults: ColumnMapping[] = state.headers.map(header => {
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let matchedField = null;

      for (const field of targetFields) {
        const lowerField = field.value.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          lowerHeader === lowerField || 
          lowerHeader.includes(lowerField) || 
          lowerField.includes(lowerHeader)
        ) {
          matchedField = field.value;
          break;
        }
      }

      return {
        csvColumn: header,
        targetField: matchedField
      };
    });

    setLocalMappings(defaults);
  }, [state.headers, state.mappings, targetFields]);

  const handleMappingChange = (header: string, selection: string) => {
    setLocalMappings(prev => prev.map(m => 
      m.csvColumn === header 
        ? { ...m, targetField: selection === 'none' ? null : selection }
        : m
    ));
  };

  const handleContinue = () => {
    updateState({ mappings: localMappings });
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
         <div>
            <h3 className="text-lg font-semibold flex items-center">
              Field Mapping
              <span className="ml-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs flex items-center">
                <Wand2 className="w-3 h-3 mr-1" /> Auto-matched
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Match your CSV columns to the appropriate {state.entityType} fields.</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-4 space-y-3">
        {localMappings.map((mapping, idx) => {
          const sampleData = state.csvData.slice(0, 3).map(row => row[mapping.csvColumn]).filter(Boolean).slice(0, 2).join(', ');
          
          return (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-xl border bg-card/50 shadow-sm transition-colors hover:bg-card/80">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{mapping.csvColumn}</div>
                <div className="text-xs text-muted-foreground truncate mt-1">
                  Sample: <span className="font-mono bg-muted/50 px-1 rounded">{sampleData || 'No data'}</span>
                </div>
              </div>
              
              <div className="text-muted-foreground">
                <ArrowRight className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <Select 
                  value={mapping.targetField || 'none'} 
                  onValueChange={(val) => handleMappingChange(mapping.csvColumn, val)}
                >
                  <SelectTrigger className={`w-full ${mapping.targetField ? 'border-primary/50 bg-primary/5' : ''}`}>
                    <SelectValue placeholder="Do not import" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="italic text-muted-foreground">Skip this column</SelectItem>
                    {targetFields.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label} {f.required && <span className="text-red-500 ml-1">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-auto pt-6 border-t">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue} className="shadow-md">
          Validate Data <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
