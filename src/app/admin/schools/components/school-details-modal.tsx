'use client';

import type { School, Meeting } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Globe, Calendar, Mail, Phone, Users, MapPin, Film, PenSquare, Workflow, User } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface SchoolDetailsModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MeetingList({ schoolId }: { schoolId: string }) {
  const firestore = useFirestore();
  const meetingsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meetings');
  }, [firestore]);

  const meetingsQuery = useMemoFirebase(() => {
    if (!meetingsCol) return null;
    return query(meetingsCol, where('schoolId', '==', schoolId), orderBy('meetingTime', 'desc'));
  }, [meetingsCol, schoolId]);

  const { data: meetings, isLoading } = useCollection<Meeting>(meetingsQuery);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!meetings || meetings.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No meetings scheduled for this school.</p>;
  }

  return (
    <ul className="space-y-3">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="flex items-start gap-4 rounded-md border p-3">
          <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
          <div className="flex-grow">
            <div className="flex justify-between items-center">
              <p className="font-semibold">{meeting.type.name}</p>
              <Badge variant="outline">{format(new Date(meeting.meetingTime), 'PPP p')}</Badge>
            </div>
            <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
              {meeting.meetingLink}
            </a>
            {meeting.recordingUrl && (
              <a href={meeting.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline block break-all">
                View Recording
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function SchoolDetailsModal({ school, open, onOpenChange }: SchoolDetailsModalProps) {
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
        
        <ScrollArea className="flex-grow">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
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
              <DetailItem icon={Globe} label="Website Slug" value={school.slug} />
              <DetailItem icon={MapPin} label="Location" value={school.location} />
              <DetailItem icon={Users} label="Nominal Roll" value={school.nominalRoll?.toLocaleString()} />
              {school.implementationDate && <DetailItem icon={Calendar} label="Go-live Date" value={format(new Date(school.implementationDate), 'PPP')} />}
              <DetailItem icon={PenSquare} label="Modules">
                    <div className="flex flex-wrap gap-2 pt-1">
                        {school.modules && school.modules.length > 0 ? (
                            school.modules.map((module) => (
                                <Badge key={module.id} style={{ backgroundColor: module.color, color: 'hsl(var(--primary-foreground))' }} className="border-transparent">
                                    {module.name}
                                </Badge>
                            ))
                        ) : (
                            <p className="text-sm text-foreground">Not specified</p>
                        )}
                    </div>
              </DetailItem>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <DetailItem icon={Users} label="Contact Person" value={school.contactPerson} />
              <DetailItem icon={Mail} label="Contact Email" value={school.email} />
              <DetailItem icon={Phone} label="Contact Phone" value={school.phone} />
              <DetailItem icon={Users} label="Referee" value={school.referee} />
              <DetailItem icon={Film} label="Include Drone Footage">
                  <Badge variant={school.includeDroneFootage ? 'default' : 'secondary'} className="mt-1">
                      {school.includeDroneFootage ? 'Yes' : 'No'}
                  </Badge>
              </DetailItem>
            </div>

          </div>

          <Separator className="my-4" />

          <div className="px-6 pb-6">
              <h3 className="text-lg font-semibold mb-4">Scheduled Meetings</h3>
              <MeetingList schoolId={school.id} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
