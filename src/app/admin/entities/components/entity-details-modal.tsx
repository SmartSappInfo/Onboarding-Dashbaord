'use client';

import type { School } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Globe, Calendar, Mail, Phone, Users, MapPin, PenSquare, Workflow, User, ChevronLeft, ChevronRight, History, MessageSquarePlus, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import LogActivityModal from './LogActivityModal';
import NotesSection from '../../components/NotesSection';
import Link from 'next/link';
import { getSchoolEmail, getSchoolPhone, getContactPerson, getPrimaryContact } from '@/lib/school-helpers';

interface SchoolDetailsModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}


export default function SchoolDetailsModal({ school, open, onOpenChange, onNavigate, canNavigatePrev, canNavigateNext }: SchoolDetailsModalProps) {
  const router = useRouter();
  const [isLogActivityModalOpen, setIsLogActivityModalOpen] = React.useState(false);
  
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-4xl w-[70vw] p-0 flex flex-col">
          <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 disabled:opacity-50"
              onClick={() => onNavigate('prev')}
              disabled={!canNavigatePrev}
              aria-label="Previous school"
          >
              <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 disabled:opacity-50"
              onClick={() => onNavigate('next')}
              disabled={!canNavigateNext}
              aria-label="Next school"
          >
              <ChevronRight className="h-5 w-5" />
          </Button>
          
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-3">
              {school.logoUrl && (
                <Image src={school.logoUrl} alt="logo" width={40} height={40} className="rounded-full object-contain" />
              )}
              {school.name}
               {school.initials && <Badge variant="secondary">{school.initials}</Badge>}
            </SheetTitle>
            <SheetDescription>{school.slogan || 'School Details'}</SheetDescription>
          </SheetHeader>
          
          <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
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
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                        <DetailItem icon={Users} label="Primary Contact" value={getContactPerson(school)} />
                        <DetailItem icon={Mail} label="Primary Email">
                            {getSchoolEmail(school) ? (
                            <a href={`mailto:${getSchoolEmail(school)}`} className="text-base text-foreground hover:underline">
                                {getSchoolEmail(school)}
                            </a>
                            ) : <p className="text-base text-foreground">N/A</p>}
                        </DetailItem>
                        <DetailItem icon={Phone} label="Primary Phone">
                            {getSchoolPhone(school) ? (
                            <a href={`tel:${getSchoolPhone(school)?.replace(/[\s-()]/g, '')}`} className="text-base text-foreground hover:underline">
                                {getSchoolPhone(school)}
                            </a>
                            ) : <p className="text-base text-foreground">N/A</p>}
                        </DetailItem>
                        <DetailItem icon={Globe} label="Referee" value={school.referee} />
                        <DetailItem icon={PenSquare} label="Modules">
                            <div className="flex flex-wrap gap-2 pt-1">
                                {school.modules && school.modules.length > 0 ? (
                                    school.modules.map((module) => (
                                        <Badge key={module.id} style={{ backgroundColor: module.color, color: 'hsl(var(--primary-foreground))' }} className="border-transparent">
                                            {module.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No modules.</p>
                                )}
                            </div>
                          </DetailItem>
                        </div>
                    </div>
                    
                    <div className="mt-12">
                        <NotesSection entityId={school.id} />
                    </div>
                </div>
            </ScrollArea>
          </div>

          <SheetFooter className="p-6 mt-auto border-t justify-between flex-row gap-2">
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsLogActivityModalOpen(true)}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Log
                </Button>
                <Button variant="outline" asChild>
                    <Link href={`/admin/messaging/composer?recipient=${getPrimaryContact(school)?.email || ''}&var_school_name=${encodeURIComponent(school.name)}&var_contact_name=${encodeURIComponent(getContactPerson(school) || '')}`}>
                        <Send className="mr-2 h-4 w-4" />
                        Message
                    </Link>
                </Button>
            </div>
            <Button onClick={() => router.push(`/admin/entities/${school.id}/edit`)}>
              <PenSquare className="mr-2 h-4 w-4" />
              Edit Details
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <LogActivityModal school={school} open={isLogActivityModalOpen} onOpenChange={setIsLogActivityModalOpen} />
    </>
  );
}
