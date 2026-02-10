'use client';

import type { School } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Globe, Calendar, Mail, Phone, Users, MapPin, Film, PenSquare, Workflow, User } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface SchoolDetailsModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export default function SchoolDetailsModal({ school, open, onOpenChange }: SchoolDetailsModalProps) {
  const router = useRouter();
  
  if (!school) return null;

  const DetailItem = ({ icon: Icon, label, value, children }: { icon: React.ElementType, label: string, value?: string | number | null, children?: React.ReactNode }) => {
    if (!value && !children) return null;
    return (
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {value && <p className="text-base text-foreground">{String(value)}</p>}
          {children}
        </div>
      </div>
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            {school.logoUrl && (
              <Image src={school.logoUrl} alt="logo" width={40} height={40} className="rounded-full object-contain" />
            )}
            {school.name}
          </DialogTitle>
          <DialogDescription>{school.slogan || 'School Details'}</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              <DetailItem icon={User} label="Assigned To" value={school.assignedTo?.name || 'Unassigned'} />
              <DetailItem icon={Workflow} label="Onboarding Stage">
                  {school.stage?.name ? (
                    <Badge style={{ backgroundColor: school.stage.color }} className="text-primary-foreground mt-1">
                      {school.stage.name}
                    </Badge>
                  ) : (
                    <p className="text-base text-foreground">N/A</p>
                  )}
              </DetailItem>
              <Separator />
              <DetailItem icon={MapPin} label="Location">
                {school.location ? (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name + ' ' + school.location)}`} target="_blank" rel="noopener noreferrer" className="text-base text-foreground hover:underline">
                    {school.location}
                  </a>
                ) : <p className="text-base text-foreground">N/A</p>}
              </DetailItem>
              <DetailItem icon={Users} label="Nominal Roll" value={school.nominalRoll?.toLocaleString()} />
              {school.implementationDate && <DetailItem icon={Calendar} label="Implementation Date" value={format(new Date(school.implementationDate), 'PPP')} />}
              <DetailItem icon={PenSquare} label="Modules">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 pt-1">
                        {school.modules && school.modules.length > 0 ? (
                            school.modules.map((module) => (
                                <Badge key={module.id} style={{ backgroundColor: module.color, color: 'hsl(var(--primary-foreground))' }} className="border-transparent">
                                    {module.name}
                                </Badge>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No modules assigned yet.</p>
                        )}
                    </div>
                    {school.moduleRequestNotes && (
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mt-2">Initial Request:</p>
                            <p className="text-base text-foreground">{school.moduleRequestNotes}</p>
                        </div>
                    )}
                </div>
              </DetailItem>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <DetailItem icon={Users} label="Primary Contact" value={school.contactPerson} />
              <DetailItem icon={Mail} label="Primary Email">
                {school.email ? (
                  <a href={`mailto:${school.email}`} className="text-base text-foreground hover:underline">
                    {school.email}
                  </a>
                ) : <p className="text-base text-foreground">N/A</p>}
              </DetailItem>
              <DetailItem icon={Phone} label="Primary Phone">
                {school.phone ? (
                  <a href={`tel:${school.phone.replace(/[\s-()]/g, '')}`} className="text-base text-foreground hover:underline">
                    {school.phone}
                  </a>
                ) : <p className="text-base text-foreground">N/A</p>}
              </DetailItem>
              <DetailItem icon={Globe} label="Referee" value={school.referee} />
              <DetailItem icon={Film} label="Include Drone Footage">
                  <Badge variant={school.includeDroneFootage ? 'default' : 'secondary'} className="mt-1">
                      {school.includeDroneFootage ? 'Yes' : 'No'}
                  </Badge>
              </DetailItem>
              <Separator />
               <DetailItem icon={Users} label="Additional Contacts">
                {(!school.additionalEmails || school.additionalEmails.length === 0) && (!school.additionalPhones || school.additionalPhones.length === 0) ? (
                  <p className="text-base text-muted-foreground italic">Not provided</p>
                ) : (
                  <div className="space-y-3">
                    {school.additionalEmails && school.additionalEmails.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Emails</p>
                        <div className="flex flex-col items-start gap-1">
                          {school.additionalEmails.map((email, index) => (
                            <a key={index} href={`mailto:${email}`} className="text-base text-foreground hover:underline">
                              {email}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {school.additionalPhones && school.additionalPhones.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone Numbers</p>
                        <div className="flex flex-col items-start gap-1">
                          {school.additionalPhones.map((phone, index) => (
                            <a key={index} href={`tel:${phone.replace(/[\s-()]/g, '')}`} className="text-base text-foreground hover:underline">
                              {phone}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DetailItem>
            </div>

          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-0">
          <Button onClick={() => router.push(`/admin/schools/${school.id}/edit`)}>
            <PenSquare className="mr-2 h-4 w-4" />
            Edit Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
