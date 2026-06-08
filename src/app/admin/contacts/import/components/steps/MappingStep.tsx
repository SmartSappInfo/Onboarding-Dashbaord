import React, { useEffect, useState, useMemo } from 'react';
import { ImportState, ColumnMapping } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Wand2, Shield, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getContactPolicyLabel } from '@/lib/contact-policy';
import type { ContactIdentifierPolicy, IndustryVertical } from '@/lib/types';

interface Props {
  state: ImportState;
  updateState: (s: Partial<ImportState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface FieldDef {
  value: string;
  label: string;
  required?: boolean;
  policyRequired?: boolean;
  industries?: IndustryVertical[]; // If set, only show for these industries
}

// ─── Industry-aware field definitions ────────────────────────────────────────

const PERSON_FIELDS: FieldDef[] = [
  { value: 'firstName', label: 'First Name', required: true },
  { value: 'lastName', label: 'Last Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'contactName', label: 'Contact Name' },
  { value: 'company', label: 'Company Name' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'leadSource', label: 'Lead Source' },
];

const FAMILY_FIELDS: FieldDef[] = [
  { value: 'familyName', label: 'Family Name', required: true },
  { value: 'guardian1_name', label: 'Guardian Name', required: true },
  { value: 'guardian1_phone', label: 'Guardian Phone' },
  { value: 'guardian1_email', label: 'Guardian Email' },
  { value: 'guardian1_relationship', label: 'Guardian Relationship' },
  { value: 'child1_firstName', label: 'Child First Name', industries: ['SchoolEnrollment'] },
  { value: 'child1_lastName', label: 'Child Last Name', industries: ['SchoolEnrollment'] },
  { value: 'child1_gradeLevel', label: 'Child Grade Level', industries: ['SchoolEnrollment'] },
  { value: 'leadSource', label: 'Lead Source' },
];

const INSTITUTION_FIELDS: FieldDef[] = [
  { value: 'name', label: 'Institution Name', required: true },
  { value: 'contact_name', label: 'Primary Contact Name', required: true },
  { value: 'contact_phone', label: 'Primary Contact Phone' },
  { value: 'contact_email', label: 'Primary Contact Email' },
  { value: 'contact_role', label: 'Primary Contact Role' },
  { value: 'nominalRoll', label: 'Nominal Roll', industries: ['SchoolEnrollment'] },
  { value: 'billingAddress', label: 'Billing Address' },
  { value: 'currency', label: 'Currency' },
  { value: 'subscriptionPackageId', label: 'Package ID', industries: ['SaaS', 'SchoolEnrollment'] },
  { value: 'locationString', label: 'Location' },
  { value: 'leadSource', label: 'Lead Source' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Determine which phone/email field keys are policy-required */
function getPolicyRequiredFields(entityType: string, policy: ContactIdentifierPolicy): string[] {
  const phoneField = entityType === 'institution' ? 'contact_phone'
    : entityType === 'family' ? 'guardian1_phone' : 'phone';
  const emailField = entityType === 'institution' ? 'contact_email'
    : entityType === 'family' ? 'guardian1_email' : 'email';

  if (policy === 'phone_only') return [phoneField];
  if (policy === 'email_only') return [emailField];
  return []; // phone_or_email — either works
}

/** Filter fields by industry (if industry-gated) */
function filterByIndustry(fields: FieldDef[], industry: IndustryVertical): FieldDef[] {
  return fields.filter(f => !f.industries || f.industries.includes(industry));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MappingStep({ state, updateState, onNext, onBack }: Props) {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>([]);
  const { activeWorkspace } = useWorkspace();

  const contactPolicy: ContactIdentifierPolicy = activeWorkspace?.contactPolicy || 'phone_or_email';
  const industry: IndustryVertical = activeWorkspace?.industry || 'SaaS';

  // Build policy-aware, industry-filtered target fields
  const targetFields = useMemo(() => {
    const baseFields = state.entityType === 'person'
      ? PERSON_FIELDS
      : state.entityType === 'family'
        ? FAMILY_FIELDS
        : INSTITUTION_FIELDS;

    const policyRequired = getPolicyRequiredFields(state.entityType || 'institution', contactPolicy);

    // Filter by industry and apply policy-required markers
    return filterByIndustry(baseFields, industry).map(f => ({
      ...f,
      policyRequired: policyRequired.includes(f.value),
    }));
  }, [state.entityType, contactPolicy, industry]);

  useEffect(() => {
    if (state.mappings.length > 0) {
      setLocalMappings(state.mappings);
      return;
    }

    // Auto mapping logic
    const defaults: ColumnMapping[] = state.headers.map(header => {
      // Strip * and whitespace for matching
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

  // Count mapped required/policy fields
  const mappedFieldValues = new Set(localMappings.filter(m => m.targetField).map(m => m.targetField));
  const unmappedRequired = targetFields.filter(f => f.required && !mappedFieldValues.has(f.value));
  const unmappedPolicy = targetFields.filter(f => f.policyRequired && !mappedFieldValues.has(f.value));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 border-b pb-4">
         <div>
            <h3 className="text-lg font-semibold flex items-center">
              Field Mapping
              <span className="ml-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs flex items-center">
                <Wand2 className="w-3 h-3 mr-1" /> Auto-matched
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Match your CSV columns to {state.entityType} fields.</p>
         </div>
      </div>

      {/* Policy & Industry context banner */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/30 border">
        <Shield className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 flex items-center gap-2 flex-wrap text-[10px] font-medium text-muted-foreground">
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">{industry}</Badge>
          <span>•</span>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">{getContactPolicyLabel(contactPolicy)}</Badge>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <span className="text-red-500 font-bold">*</span> required &nbsp;
            <span className="text-amber-500 font-bold">†</span> policy-required
          </span>
        </div>
        {(unmappedRequired.length > 0 || unmappedPolicy.length > 0) && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600">
            <Info className="w-3 h-3" />
            {unmappedRequired.length > 0 && <span>{unmappedRequired.length} required unmapped</span>}
            {unmappedPolicy.length > 0 && <span>{unmappedPolicy.length} policy unmapped</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-4 space-y-3">
        {localMappings.map((mapping, idx) => {
          const sampleData = state.csvData.slice(0, 3).map(row => row[mapping.csvColumn]).filter(Boolean).slice(0, 2).join(', ');
          const matchedDef = targetFields.find(f => f.value === mapping.targetField);
          
          return (
            <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-card/80 ${
              matchedDef?.required ? 'bg-red-500/3 border-red-500/20' 
              : matchedDef?.policyRequired ? 'bg-amber-500/3 border-amber-500/20'
              : 'bg-card/50 shadow-sm'
            }`}>
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
                        {f.label}
                        {f.required && <span className="text-red-500 ml-1">*</span>}
                        {f.policyRequired && !f.required && <span className="text-amber-500 ml-1">†</span>}
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
          Continue to Configuration <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
