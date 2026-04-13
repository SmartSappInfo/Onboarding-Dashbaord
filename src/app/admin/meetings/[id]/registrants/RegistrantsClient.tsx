'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Meeting, MeetingRegistrant } from '@/lib/types';
import { format } from 'date-fns';
import { 
    Users, 
    ArrowLeft, 
    CheckCircle2, 
    Clock, 
    Download,
    Mail,
    Search,
    UserCheck,
    ClipboardCheck,
    Calendar,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function RegistrantsClient({ meetingId }: { meetingId: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Meeting
  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);
  
  const { data: meeting, isLoading: isLoadingMeeting, error: meetingError } = useDoc<Meeting>(meetingDocRef);

  useSetBreadcrumb(meeting?.entityName, `/admin/meetings/${meetingId}/registrants`);

  // Fetch Registrants
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(collection(firestore, `meetings/${meetingId}/registrants`), orderBy('registeredAt', 'desc'));
  }, [firestore, meetingId]);

  const { data: registrants, isLoading: isLoadingRegistrants, error: registrantsError } = useCollection<MeetingRegistrant>(registrantsColRef);

  // Derived Stats
  const stats = useMemo(() => {
    if (!registrants) return { total: 0, attended: 0, pending: 0, attendanceRate: 0 };
    
    const total = registrants.length;
    const attended = registrants.filter(r => r.status === 'attended').length;
    const pending = total - attended;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, attended, pending, attendanceRate };
  }, [registrants]);

  // Filtered List
  const filteredRegistrants = useMemo(() => {
    if (!registrants) return [];
    if (!searchQuery.trim()) return registrants;
    
    const lowerQuery = searchQuery.toLowerCase();
    return registrants.filter(r => {
        const nameMatch = r.name?.toLowerCase().includes(lowerQuery) || false;
        const emailMatch = r.email?.toLowerCase().includes(lowerQuery) || false;
        return nameMatch || emailMatch;
    });
  }, [registrants, searchQuery]);

  const toggleAttendance = async (registrant: MeetingRegistrant) => {
    if (!firestore) return;
    try {
        const ref = doc(firestore, `meetings/${meetingId}/registrants`, registrant.id);
        const newStatus = registrant.status === 'attended' ? 'registered' : 'attended';
        await updateDoc(ref, {
            status: newStatus,
            attendedAt: newStatus === 'attended' ? new Date().toISOString() : null
        });
        toast({ title: 'Status Updated', description: `${registrant.name}'s attendance status updated.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: e.message });
    }
  };

  const handleExportCSV = () => {
    if (!filteredRegistrants?.length) return;

    // Build headers from the first registrant's dynamic field data, plus standards
    const dynamicHeaders = new Set<string>();
    filteredRegistrants.forEach(r => Object.keys(r.registrationData || {}).forEach(k => dynamicHeaders.add(k)));
    const dynamicHeadersArray = Array.from(dynamicHeaders);

    const headers = [
      'Name', 'Email', 'Status', 'Registered At', 'Attended At',
      ...dynamicHeadersArray
    ];

    const csvContent = [
      headers.join(','),
      ...filteredRegistrants.map(r => {
        const row = [
          `"${r.name}"`,
          `"${r.email || ''}"`,
          r.status,
          r.registeredAt ? `"${format(new Date(r.registeredAt), 'yyyy-MM-dd HH:mm:ss')}"` : '""',
          r.status === 'attended' && r.attendedAt ? `"${format(new Date(r.attendedAt), 'yyyy-MM-dd HH:mm:ss')}"` : '""',
          ...dynamicHeadersArray.map(h => `"${r.registrationData?.[h] || ''}"`)
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registrants-${meeting?.entitySlug || 'meeting'}-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  if (isLoadingMeeting || isLoadingRegistrants) {
 return <div className="p-8"><Skeleton className="h-[500px] w-full rounded-2xl" /></div>;
  }

  if (meetingError || registrantsError) {
      const error = meetingError || registrantsError;
      return (
 <div className="p-8 max-w-7xl mx-auto">
 <Alert variant="destructive" className="rounded-2xl border-none ring-1 ring-destructive/20 bg-destructive/5">
 <AlertCircle className="h-4 w-4" />
 <AlertTitle className="font-semibold text-[10px]">Database Error</AlertTitle>
 <AlertDescription className="text-sm font-medium mt-1">
                      {error?.message || 'An error occurred while fetching data. Check your connection or permissions.'}
                  </AlertDescription>
 <Button variant="outline" size="sm" className="mt-4 font-bold rounded-xl" onClick={() => window.location.reload()}>
                      Retry Connection
                  </Button>
              </Alert>
          </div>
      );
  }

  return (
 <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
 <div className="max-w-7xl mx-auto space-y-8 text-left">
          
        {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
 <div className="flex items-center gap-3 mb-2">
 <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground">
 <Link href="/admin/meetings"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <Badge variant="outline" className="font-semibold uppercase  text-[10px] bg-background">
                        {meeting?.type?.name || 'Meeting'}
                    </Badge>
                </div>
 <h1 className="text-3xl font-semibold tracking-tight leading-none">{meeting?.entityName} Registrants</h1>
 <p className="text-sm font-medium text-muted-foreground mt-2 flex items-center gap-2">
 <Calendar className="h-4 w-4" /> {meeting?.meetingTime ? format(new Date(meeting.meetingTime), 'PPPP') : 'Date TBD'}
                </p>
            </div>
            
 <div className="flex items-center gap-3">
 <Button variant="outline" className="font-bold gap-2 rounded-xl h-10" onClick={handleExportCSV} disabled={!filteredRegistrants.length}>
 <Download className="h-4 w-4" /> Export CSV
                </Button>
            </div>
        </div>

        {/* Stats Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
                        <div>
 <p className="text-[10px] font-semibold text-muted-foreground mb-1">Total Registrants</p>
 <p className="text-3xl font-semibold">{stats.total}</p>
                        </div>
 <div className="p-3 bg-primary/10 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                    </div>
                </CardContent>
            </Card>
 <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
                        <div>
 <p className="text-[10px] font-semibold text-muted-foreground mb-1">Attended</p>
 <p className="text-3xl font-semibold text-emerald-600 dark:text-emerald-500">{stats.attended}</p>
                        </div>
 <div className="p-3 bg-emerald-500/10 rounded-xl"><UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500" /></div>
                    </div>
                </CardContent>
            </Card>
 <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
                        <div>
 <p className="text-[10px] font-semibold text-muted-foreground mb-1">Pending/No Show</p>
 <p className="text-3xl font-semibold text-amber-600 dark:text-amber-500">{stats.pending}</p>
                        </div>
 <div className="p-3 bg-amber-500/10 rounded-xl"><Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" /></div>
                    </div>
                </CardContent>
            </Card>
 <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
                        <div>
 <p className="text-[10px] font-semibold text-muted-foreground mb-1">Attendance Rate</p>
 <p className="text-3xl font-semibold">{stats.attendanceRate}%</p>
                        </div>
 <div className="p-3 bg-violet-500/10 rounded-xl"><ClipboardCheck className="h-5 w-5 text-violet-600 dark:text-violet-500" /></div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Main Content */}
 <Card className="rounded-2xl border-none overflow-hidden ring-1 ring-border shadow-sm">
 <CardHeader className="bg-muted/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
                <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Registration Roster</CardTitle>
 <CardDescription className="text-xs font-medium">Manage and review all signups for this session.</CardDescription>
                </div>
 <div className="relative w-full sm:w-72">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 h-10 rounded-xl bg-background border-none ring-1 ring-border shadow-sm focus-visible:ring-primary"
                    />
                </div>
            </CardHeader>
 <CardContent className="p-0 bg-background">
                {!filteredRegistrants || filteredRegistrants.length === 0 ? (
 <div className="flex flex-col items-center justify-center p-12 text-center">
 <div className="p-4 bg-muted/20 rounded-full mb-4">
 <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
 <h3 className="text-sm font-semibold text-foreground">No Registrants Found</h3>
 <p className="text-xs font-medium text-muted-foreground mt-1 max-w-sm">
                            {searchQuery ? 'No registrants match your search criteria.' : 'There are currently no registrants for this session.'}
                        </p>
                    </div>
                ) : (
 <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
 <TableRow className="bg-muted/10 hover:bg-muted/10">
 <TableHead className="text-[10px] font-semibold h-12">Name</TableHead>
 <TableHead className="text-[10px] font-semibold ">Registered</TableHead>
 <TableHead className="text-[10px] font-semibold ">Status</TableHead>
 <TableHead className="w-[100px] text-right text-[10px] font-semibold ">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRegistrants.map((registrant) => (
 <TableRow key={registrant.id} className="group">
                                        <TableCell>
 <div className="flex flex-col">
 <span className="font-bold text-sm">{registrant.name}</span>
 <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
 <Mail className="h-3 w-3" /> {registrant.email || 'N/A'}
                                                </span>
                                            </div>
                                        </TableCell>
 <TableCell className="text-xs font-medium text-muted-foreground">
                                            {registrant.registeredAt ? format(new Date(registrant.registeredAt), 'MMM d, h:mm a') : 'Unknown'}
                                        </TableCell>
                                        <TableCell>
                                            {registrant.status === 'attended' ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 font-bold uppercase tracking-wider text-[9px]">
 <CheckCircle2 className="h-3 w-3 mr-1" /> Attended
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground font-bold uppercase tracking-wider text-[9px]">
 <Clock className="h-3 w-3 mr-1" /> {registrant.status}
                                                </Badge>
                                            )}
                                        </TableCell>
 <TableCell className="text-right">
                                             <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => toggleAttendance(registrant)}
 className={`h-8 text-xs font-bold w-full max-w-[120px] ${
                                                    registrant.status === 'attended'
                                                        ? "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20" 
                                                        : "bg-primary/5 hover:bg-primary hover:text-white border-primary/20"
                                                }`}
                                            >
                                                {registrant.status === 'attended' ? 'Revoke' : 'Mark Attended'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
