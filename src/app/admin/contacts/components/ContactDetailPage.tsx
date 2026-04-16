'use client';

import * as React from 'react';
import type { Entity, WorkspaceEntity, EntityType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Building, Users, User, Mail, Phone, MapPin, Calendar, 
  Banknote, Briefcase, Baby, UserPlus, PenSquare, MessageSquarePlus 
} from 'lucide-react';
import { format } from 'date-fns';
import NotesSection from '@/app/admin/components/NotesSection';
import ActivityTimeline from '@/app/admin/components/ActivityTimeline';

interface ContactDetailPageProps {
  entity: Entity;
  workspaceEntity: WorkspaceEntity;
  onEdit?: () => void;
  onMessage?: () => void;
  onLogActivity?: () => void;
}

/**
 * Scope-aware contact detail page component
 * Adapts display based on entity type (Requirement 14, 15, 16, 17)
 */
export function ContactDetailPage({ 
  entity, 
  workspaceEntity, 
  onEdit, 
  onMessage, 
  onLogActivity 
}: ContactDetailPageProps) {
  // Display entity type badge prominently (Requirement 25)
  const entityTypeBadge = (
    <Badge variant="secondary" className="text-xs font-bold uppercase">
      {entity.entityType === 'institution' && 'School'}
      {entity.entityType === 'family' && 'Family'}
      {entity.entityType === 'person' && 'Person'}
    </Badge>
  );

  return (
 <div className="space-y-6">
      {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <h1 className="text-3xl font-bold">{entity.name}</h1>
          {entityTypeBadge}
        </div>
 <div className="flex gap-2">
          {onLogActivity && (
            <Button variant="outline" onClick={onLogActivity}>
 <MessageSquarePlus className="mr-2 h-4 w-4" />
              Log Activity
            </Button>
          )}
          {onMessage && (
            <Button variant="outline" onClick={onMessage}>
 <Mail className="mr-2 h-4 w-4" />
              Message
            </Button>
          )}
          {onEdit && (
            <Button onClick={onEdit}>
 <PenSquare className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Scope-specific content */}
      {entity.entityType === 'institution' && (
        <InstitutionDetailView entity={entity} workspaceEntity={workspaceEntity} />
      )}
      {entity.entityType === 'family' && (
        <FamilyDetailView entity={entity} workspaceEntity={workspaceEntity} />
      )}
      {entity.entityType === 'person' && (
        <PersonDetailView entity={entity} workspaceEntity={workspaceEntity} />
      )}

      {/* Common sections */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <NotesSection entityId={entity.id} />
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline 
              entityId={entity.id} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Institution detail view
 * Shows: profile, entity contacts, pipeline stage, tags, billing, contracts
 */
function InstitutionDetailView({ entity, workspaceEntity }: { entity: Entity; workspaceEntity: WorkspaceEntity }) {
  const institutionData = entity.institutionData;

  return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Institution Profile */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <Building className="h-5 w-5 text-primary" />
            <CardTitle>Institution Profile</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          <DetailItem icon={Users} label="Nominal Roll" value={institutionData?.nominalRoll?.toLocaleString()} />
          <DetailItem icon={MapPin} label="Billing Address" value={institutionData?.billingAddress} />
          <DetailItem icon={Calendar} label="Implementation Date">
            {institutionData?.implementationDate && format(new Date(institutionData.implementationDate), 'PPP')}
          </DetailItem>
          <DetailItem icon={User} label="Referee" value={institutionData?.referee} />
        </CardContent>
      </Card>

      {/* Financial Profile */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <Banknote className="h-5 w-5 text-primary" />
            <CardTitle>Financial Profile</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          <DetailItem 
            icon={Banknote} 
            label="Subscription Rate" 
            value={`${institutionData?.currency || 'GHS'} ${institutionData?.subscriptionRate?.toFixed(2) || '0.00'}`} 
          />
          <DetailItem label="Subscription Package" value={institutionData?.subscriptionPackageId} />
          {institutionData?.modules && institutionData.modules.length > 0 && (
            <div>
 <p className="text-sm font-medium text-muted-foreground mb-2">Modules</p>
 <div className="flex flex-wrap gap-2">
                {institutionData.modules.map((module) => (
                  <Badge 
                    key={module.id} 
                    style={{ backgroundColor: module.color }} 
 className="text-primary-foreground"
                  >
                    {module.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entity Contacts */}
  <Card className="lg:col-span-2">
         <CardHeader>
  <div className="flex items-center gap-3">
  <Users className="h-5 w-5 text-primary" />
             <CardTitle>Entity Contacts</CardTitle>
           </div>
         </CardHeader>
         <CardContent>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {(entity.entityContacts || []).map((person, index) => (
  <div key={index} className="p-4 bg-muted/20 rounded-lg space-y-2">
  <div className="flex items-center justify-between">
  <p className="font-bold">{person.name}</p>
                   <Badge variant="outline" className="text-xs">{person.typeLabel || person.typeKey || (person as any).type}</Badge>
                 </div>
  <div className="space-y-1 text-sm text-muted-foreground">
  <p className="flex items-center gap-2">
  <Mail className="h-3 w-3" />
                     {person.email}
                   </p>
  <p className="flex items-center gap-2">
  <Phone className="h-3 w-3" />
                     {person.phone}
                   </p>
                   {person.isSignatory && (
                     <Badge variant="secondary" className="text-xs">Signatory</Badge>
                   )}
                 </div>
               </div>
             ))}
           </div>
         </CardContent>
       </Card>

      {/* Pipeline Stage */}
 <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
 <div className="flex items-center gap-4">
            <div>
 <p className="text-sm text-muted-foreground">Current Stage</p>
              <Badge className="mt-1">{workspaceEntity.currentStageName || 'No stage'}</Badge>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Assigned To</p>
 <p className="font-medium mt-1">{workspaceEntity.assignedTo?.name || 'Unassigned'}</p>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">{workspaceEntity.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Family detail view
 * Shows: family name, guardians, children, admissions pipeline
 */
function FamilyDetailView({ entity, workspaceEntity }: { entity: Entity; workspaceEntity: WorkspaceEntity }) {
  const familyData = entity.familyData;

  return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Guardians */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <UserPlus className="h-5 w-5 text-primary" />
            <CardTitle>Guardians</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          {familyData?.guardians.map((guardian, index) => (
 <div key={index} className="p-3 bg-muted/20 rounded-lg space-y-2">
 <div className="flex items-center justify-between">
 <p className="font-bold">{guardian.name}</p>
 <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{guardian.relationship}</Badge>
                  {guardian.isPrimary && <Badge className="text-xs">Primary</Badge>}
                </div>
              </div>
 <div className="space-y-1 text-sm text-muted-foreground">
 <p className="flex items-center gap-2">
 <Mail className="h-3 w-3" />
                  {guardian.email}
                </p>
 <p className="flex items-center gap-2">
 <Phone className="h-3 w-3" />
                  {guardian.phone}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Children */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <Baby className="h-5 w-5 text-primary" />
            <CardTitle>Children</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          {familyData?.children && familyData.children.length > 0 ? (
            familyData.children.map((child, index) => (
 <div key={index} className="p-3 bg-muted/20 rounded-lg space-y-2">
 <p className="font-bold">{child.firstName} {child.lastName}</p>
 <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {child.dateOfBirth && (
                    <div>
 <p className="text-xs">Date of Birth</p>
 <p className="font-medium">{format(new Date(child.dateOfBirth), 'PP')}</p>
                    </div>
                  )}
                  {child.gradeLevel && (
                    <div>
 <p className="text-xs">Grade Level</p>
 <p className="font-medium">{child.gradeLevel}</p>
                    </div>
                  )}
                  {child.enrollmentStatus && (
 <div className="col-span-2">
                      <Badge variant="secondary" className="text-xs">{child.enrollmentStatus}</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
 <p className="text-sm text-muted-foreground italic">No children added</p>
          )}
        </CardContent>
      </Card>

      {/* Admissions Pipeline */}
 <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Admissions Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
 <div className="flex items-center gap-4">
            <div>
 <p className="text-sm text-muted-foreground">Current Stage</p>
              <Badge className="mt-1">{workspaceEntity.currentStageName || 'No stage'}</Badge>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Assigned To</p>
 <p className="font-medium mt-1">{workspaceEntity.assignedTo?.name || 'Unassigned'}</p>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">{workspaceEntity.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Person detail view
 * Shows: full name, company info, deal notes, follow-up tasks
 */
function PersonDetailView({ entity, workspaceEntity }: { entity: Entity; workspaceEntity: WorkspaceEntity }) {
  const personData = entity.personData;
  const primaryContact = (entity.entityContacts || []).find(c => c.isPrimary) || entity.entityContacts?.[0];

  return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <User className="h-5 w-5 text-primary" />
            <CardTitle>Personal Information</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          <DetailItem label="Full Name" value={`${personData?.firstName} ${personData?.lastName}`} />
          <DetailItem icon={Mail} label="Email" value={primaryContact?.email} />
          <DetailItem icon={Phone} label="Phone" value={primaryContact?.phone} />
        </CardContent>
      </Card>

      {/* Professional Information */}
      <Card>
        <CardHeader>
 <div className="flex items-center gap-3">
 <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle>Professional Information</CardTitle>
          </div>
        </CardHeader>
 <CardContent className="space-y-4">
          <DetailItem icon={Building} label="Company" value={personData?.company} />
          <DetailItem label="Job Title" value={personData?.jobTitle} />
          <DetailItem label="Lead Source" value={personData?.leadSource} />
        </CardContent>
      </Card>

      {/* Pipeline Status */}
 <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
 <div className="flex items-center gap-4">
            <div>
 <p className="text-sm text-muted-foreground">Current Stage</p>
              <Badge className="mt-1">{workspaceEntity.currentStageName || 'No stage'}</Badge>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Assigned To</p>
 <p className="font-medium mt-1">{workspaceEntity.assignedTo?.name || 'Unassigned'}</p>
            </div>
 <Separator orientation="vertical" className="h-12" />
            <div>
 <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">{workspaceEntity.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Helper component for displaying detail items
 */
function DetailItem({ 
  icon: Icon, 
  label, 
  value, 
  children 
}: { 
  icon?: React.ElementType; 
  label: string; 
  value?: string | number | null; 
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;
  
  return (
 <div className="flex items-start gap-3">
 {Icon && <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
      <div>
 <p className="text-sm font-medium text-muted-foreground">{label}</p>
 {value && <p className="text-base text-foreground">{String(value)}</p>}
        {children}
      </div>
    </div>
  );
}
