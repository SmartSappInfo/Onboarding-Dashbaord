'use client';

import * as React from 'react';
import type { Entity, WorkspaceEntity, ContactScope } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Building, Users, User, Mail, Phone, MapPin, Briefcase, Baby } from 'lucide-react';

interface ContactListItem extends WorkspaceEntity {
  entity?: Entity;
}

interface ContactListColumnsProps {
  contactScope: ContactScope;
  contacts: ContactListItem[];
}

/**
 * Scope-aware contact list columns component
 * Adapts table columns based on workspace contactScope (Requirement 14)
 */
export function ContactListColumns({ contactScope, contacts }: ContactListColumnsProps) {
  if (contactScope === 'institution') {
    return <InstitutionColumns contacts={contacts} />;
  }
  
  if (contactScope === 'family') {
    return <FamilyColumns contacts={contacts} />;
  }
  
  if (contactScope === 'person') {
    return <PersonColumns contacts={contacts} />;
  }
  
  return null;
}

/**
 * Institution-specific columns
 * Shows: name, nominal roll, subscription rate, stage, assignedTo, tags
 */
function InstitutionColumns({ contacts }: { contacts: ContactListItem[] }) {
  return (
 <div className="space-y-2">
      {contacts.map((contact) => (
        <div 
          key={contact.id} 
 className="grid grid-cols-6 gap-4 p-4 bg-card rounded-lg border hover:shadow-md transition-shadow"
        >
          {/* Name & Logo */}
 <div className="col-span-2 flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Building className="h-5 w-5 text-primary" />
            </div>
            <div>
 <p className="font-bold text-sm">{contact.displayName}</p>
 <p className="text-xs text-muted-foreground">{contact.entity?.institutionData?.billingAddress}</p>
            </div>
          </div>

          {/* Nominal Roll */}
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm font-medium">
              {contact.entity?.institutionData?.nominalRoll?.toLocaleString() || 'N/A'}
            </span>
          </div>

          {/* Subscription Rate */}
 <div className="flex items-center">
 <span className="text-sm font-bold text-primary">
              {contact.entity?.institutionData?.currency || 'GHS'} {contact.entity?.institutionData?.subscriptionRate?.toFixed(2) || '0.00'}
            </span>
          </div>

          {/* Stage */}
 <div className="flex items-center">
            {contact.currentStageName ? (
              <Badge variant="secondary" className="text-xs">
                {contact.currentStageName}
              </Badge>
            ) : (
 <span className="text-xs text-muted-foreground">No stage</span>
            )}
          </div>

          {/* Assigned To */}
 <div className="flex items-center">
 <span className="text-xs text-muted-foreground">
              {contact.assignedTo?.name || 'Unassigned'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Family-specific columns
 * Shows: family name, guardians count, children count, admissions stage, assignedTo, tags
 */
function FamilyColumns({ contacts }: { contacts: ContactListItem[] }) {
  return (
 <div className="space-y-2">
      {contacts.map((contact) => (
        <div 
          key={contact.id} 
 className="grid grid-cols-6 gap-4 p-4 bg-card rounded-lg border hover:shadow-md transition-shadow"
        >
          {/* Family Name */}
 <div className="col-span-2 flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
 <p className="font-bold text-sm">{contact.displayName}</p>
 <p className="text-xs text-muted-foreground">
                {contact.primaryEmail || 'No email'}
              </p>
            </div>
          </div>

          {/* Guardians Count */}
 <div className="flex items-center gap-2">
 <User className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm font-medium">
              {contact.entity?.familyData?.guardians?.length || 0} Guardian{contact.entity?.familyData?.guardians?.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Children Count */}
 <div className="flex items-center gap-2">
 <Baby className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm font-medium">
              {contact.entity?.familyData?.children?.length || 0} Child{contact.entity?.familyData?.children?.length !== 1 ? 'ren' : ''}
            </span>
          </div>

          {/* Admissions Stage */}
 <div className="flex items-center">
            {contact.currentStageName ? (
              <Badge variant="secondary" className="text-xs">
                {contact.currentStageName}
              </Badge>
            ) : (
 <span className="text-xs text-muted-foreground">No stage</span>
            )}
          </div>

          {/* Assigned To */}
 <div className="flex items-center">
 <span className="text-xs text-muted-foreground">
              {contact.assignedTo?.name || 'Unassigned'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Person-specific columns
 * Shows: full name, company, job title, lead source, stage, assignedTo, tags
 */
function PersonColumns({ contacts }: { contacts: ContactListItem[] }) {
  return (
 <div className="space-y-2">
      {contacts.map((contact) => (
        <div 
          key={contact.id} 
 className="grid grid-cols-6 gap-4 p-4 bg-card rounded-lg border hover:shadow-md transition-shadow"
        >
          {/* Full Name */}
 <div className="col-span-2 flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <User className="h-5 w-5 text-primary" />
            </div>
            <div>
 <p className="font-bold text-sm">{contact.displayName}</p>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {contact.primaryEmail && (
 <span className="flex items-center gap-1">
 <Mail className="h-3 w-3" />
                    {contact.primaryEmail}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Company */}
 <div className="flex items-center gap-2">
 <Briefcase className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm font-medium">
              {contact.entity?.personData?.company || 'N/A'}
            </span>
          </div>

          {/* Job Title */}
 <div className="flex items-center">
 <span className="text-sm text-muted-foreground">
              {contact.entity?.personData?.jobTitle || 'N/A'}
            </span>
          </div>

          {/* Lead Source */}
 <div className="flex items-center">
            <Badge variant="outline" className="text-xs">
              {contact.entity?.personData?.leadSource || 'Unknown'}
            </Badge>
          </div>

          {/* Stage */}
 <div className="flex items-center">
            {contact.currentStageName ? (
              <Badge variant="secondary" className="text-xs">
                {contact.currentStageName}
              </Badge>
            ) : (
 <span className="text-xs text-muted-foreground">No stage</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Column headers component - adapts based on scope
 */
export function ContactListHeaders({ contactScope }: { contactScope: ContactScope }) {
  if (contactScope === 'institution') {
    return (
 <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-background0 rounded-lg text-xs font-bold tracking-wider text-muted-foreground">
 <div className="col-span-2">Institution</div>
        <div>Nominal Roll</div>
        <div>Rate</div>
        <div>Stage</div>
        <div>Assigned To</div>
      </div>
    );
  }

  if (contactScope === 'family') {
    return (
 <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-background0 rounded-lg text-xs font-bold tracking-wider text-muted-foreground">
 <div className="col-span-2">Family</div>
        <div>Guardians</div>
        <div>Children</div>
        <div>Stage</div>
        <div>Assigned To</div>
      </div>
    );
  }

  if (contactScope === 'person') {
    return (
 <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-background0 rounded-lg text-xs font-bold tracking-wider text-muted-foreground">
 <div className="col-span-2">Name</div>
        <div>Company</div>
        <div>Job Title</div>
        <div>Lead Source</div>
        <div>Stage</div>
      </div>
    );
  }

  return null;
}
