'use client';

import type { WorkspaceEntity } from '@/lib/types';
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
import { Globe, Calendar, Mail, Phone, Users, MapPin, PenSquare, Workflow, User, ChevronLeft, ChevronRight, History, MessageSquarePlus, Send, Layout } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import LogActivityModal from './LogActivityModal';
import NotesSection from '../../components/NotesSection';
import Link from 'next/link';
import { getEntityEmail, getEntityPhone, getContactPerson, getPrimaryContact } from '@/lib/entity-helpers';
import { useTerminology } from '@/hooks/use-terminology';

interface EntityDetailsModalProps {
  entity: WorkspaceEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}


export default function EntityDetailsModal({ entity, open, onOpenChange, onNavigate, canNavigatePrev, canNavigateNext }: EntityDetailsModalProps) {
  const router = useRouter();
  const { singular } = useTerminology();
  const [isLogActivityModalOpen, setIsLogActivityModalOpen] = React.useState(false);
  
  if (!entity) return null;

  const DetailItem = ({ icon: Icon, label, value, children }: { icon: React.ElementType, label: string, value?: string | number | null, children?: React.ReactNode }) => {
    if (!value && !children) return null;
    return (
 <div className="flex items-start gap-3 text-left">
 <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5 text-left" />
 <div className="text-left">
 <p className="text-sm font-medium text-muted-foreground text-left">{label}</p>
 {value && <p className="text-base text-foreground font-bold text-left">{String(value)}</p>}
          {children}
        </div>
      </div>
    );
  };
  
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent className="max-w-4xl w-[70vw] p-0 flex flex-col text-left">
          <Button
              variant="outline"
              size="icon"
 className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 disabled:opacity-50 text-left"
              onClick={() => onNavigate('prev')}
              disabled={!canNavigatePrev}
              aria-label="Previous record"
          >
 <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
              variant="outline"
              size="icon"
 className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 disabled:opacity-50 text-left"
              onClick={() => onNavigate('next')}
              disabled={!canNavigateNext}
              aria-label="Next record"
          >
 <ChevronRight className="h-5 w-5" />
          </Button>
          
 <SheetHeader className="px-6 pt-6 pb-4 border-b text-left">
 <SheetTitle className="flex items-center gap-3 text-left">
              {entity.logoUrl ? (
 <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-muted/20 border shadow-sm shrink-0">
 <Image src={entity.logoUrl} alt="logo" fill className="object-contain p-1.5" />
                </div>
              ) : (
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold shadow-sm shrink-0">
                      {entity.initials || entity.displayName.substring(0, 2)}
                  </div>
              )}
 <div className="text-left">
 <p className="font-semibold text-xl text-left">{entity.displayName}</p>
                {entity.initials && <Badge variant="secondary" className="text-[10px] font-semibold uppercase ">{entity.initials}</Badge>}
              </div>
            </SheetTitle>
 <SheetDescription className="text-left italic font-medium opacity-60">{entity.slogan || `${singular} Context Console`}</SheetDescription>
          </SheetHeader>
          
 <div className="flex-grow overflow-hidden text-left">
 <ScrollArea className="h-full">
 <div className="p-6 text-left">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 text-left">
                        {/* Left Column */}
 <div className="space-y-6 text-left">
                        <DetailItem icon={User} label="Primary Owner" value={entity.assignedTo?.name || 'Unassigned'} />
                        <DetailItem icon={Workflow} label="Lifecycle Status">
                            {entity.lifecycleStatus ? (
                                <Badge variant="outline" className="text-[10px] font-semibold uppercase  bg-primary/5 text-primary border-primary/20 mt-1">
                                    {entity.lifecycleStatus}
                                </Badge>
                            ) : (
 <p className="text-base text-foreground font-bold">N/A</p>
                            )}
                        </DetailItem>
 <Separator className="opacity-50" />
                        <DetailItem icon={MapPin} label="Physical Location">
                            {entity.location?.locationString || entity.locationString ? (
 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entity.displayName + ' ' + (entity.location?.locationString || entity.locationString))}`} target="_blank" rel="noopener noreferrer" className="text-base text-foreground hover:underline font-bold text-left">
                                {entity.location?.locationString || entity.locationString}
                            </a>
 ) : <p className="text-base text-foreground font-bold text-left">No Address Recorded</p>}
                        </DetailItem>
                        <DetailItem icon={Users} label="Nominal Strength" value={entity.nominalRoll?.toLocaleString()} />
                        {entity.implementationDate && <DetailItem icon={Calendar} label="Commencement" value={format(new Date(entity.implementationDate), 'PPP')} />}
                        </div>

                        {/* Right Column */}
 <div className="space-y-6 text-left">
                        <DetailItem icon={User} label="Primary Contact" value={entity.primaryContactName || getContactPerson(entity)} />
                        <DetailItem icon={Mail} label="Primary Email">
                            {entity.primaryEmail || getEntityEmail(entity) ? (
 <a href={`mailto:${entity.primaryEmail || getEntityEmail(entity)}`} className="text-base text-foreground hover:underline font-bold text-left">
                                {entity.primaryEmail || getEntityEmail(entity)}
                            </a>
 ) : <p className="text-base text-foreground font-bold text-left">N/A</p>}
                        </DetailItem>
                        <DetailItem icon={Phone} label="Primary Phone">
                            {entity.primaryPhone || getEntityPhone(entity) ? (
 <a href={`tel:${(entity.primaryPhone || getEntityPhone(entity))?.replace(/[\s-()]/g, '')}`} className="text-base text-foreground hover:underline font-bold text-left">
                                {entity.primaryPhone || getEntityPhone(entity)}
                            </a>
 ) : <p className="text-base text-foreground font-bold text-left">N/A</p>}
                        </DetailItem>
                        <DetailItem icon={Layout} label="Territory" value={entity.zone?.name || 'Global'} />
                        <DetailItem icon={PenSquare} label="Provisioned Modules">
 <div className="flex flex-wrap gap-2 pt-1">
                                {entity.modules && entity.modules.length > 0 ? (
                                    entity.modules.map((module) => (
                                        <Badge key={module.id} style={{ backgroundColor: module.color, color: 'white' }} className="border-transparent text-[8px] font-semibold uppercase">
                                            {module.name}
                                        </Badge>
                                    ))
                                ) : (
 <p className="text-sm text-muted-foreground italic font-medium">No provisioned modules.</p>
                                )}
                            </div>
                          </DetailItem>
                        </div>
                    </div>
                    
 <div className="mt-12 text-left">
                        <NotesSection entityId={entity.entityId} />
                    </div>
                </div>
            </ScrollArea>
          </div>

 <SheetFooter className="p-6 mt-auto border-t justify-between flex-row gap-2 text-left bg-background">
 <div className="flex gap-2">
 <Button variant="outline" onClick={() => setIsLogActivityModalOpen(true)} className="rounded-xl font-bold h-11 text-left">
 <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Archive Activity
                </Button>
 <Button variant="outline" asChild className="rounded-xl font-bold h-11 text-left">
                    <Link href={`/admin/messaging/composer?entityId=${entity.entityId}&recipient=${entity.primaryEmail || ''}&var_entity_name=${encodeURIComponent(entity.displayName)}`}>
 <Send className="mr-2 h-4 w-4" />
                        Message
                    </Link>
                </Button>
            </div>
 <Button onClick={() => router.push(`/admin/entities/${entity.entityId}/edit`)} className="rounded-xl font-semibold h-11 px-6 shadow-lg shadow-primary/20 text-left">
 <PenSquare className="mr-2 h-4 w-4" />
              Edit {singular}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <LogActivityModal entity={entity} open={isLogActivityModalOpen} onOpenChange={setIsLogActivityModalOpen} />
    </>
  );
}
