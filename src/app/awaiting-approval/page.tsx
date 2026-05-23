'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, LogOut, Clock, CheckCircle2, ShieldAlert,
  Building2, Phone, Briefcase, Mail
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

export default function AwaitingApprovalPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();

  const [onboardingData, setOnboardingData] = React.useState<any>(null);
  const [orgName, setOrgName] = React.useState('Your School');
  const [isApproved, setIsApproved] = React.useState(false);
  const [isRejected, setIsRejected] = React.useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);

  React.useEffect(() => {
    document.title = 'Awaiting Approval - Onboarding Workspace';
  }, []);

  // Real-time Firestore sync of user profile
  React.useEffect(() => {
    if (!user || !firestore) return;

    setIsLoadingProfile(true);
    const userDocRef = doc(firestore, 'users', user.uid);

    const unsubscribe = onSnapshot(userDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOnboardingData(data);
        setIsApproved(data.isAuthorized === true);
        setIsRejected(data.approvalStatus === 'rejected');

        // Fetch organization name
        if (data.organizationId) {
          try {
            const orgSnap = await getDoc(doc(firestore, 'organizations', data.organizationId));
            if (orgSnap.exists()) {
              setOrgName(orgSnap.data()?.name || 'SmartSapp Organization');
            }
          } catch (e) {
            console.error('Failed to fetch org details:', e);
          }
        }
      }
      setIsLoadingProfile(false);
    }, (error) => {
      console.error('Snapshot subscription error:', error);
      setIsLoadingProfile(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Auth & Redirection Guards
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Automatically redirect if approved
  React.useEffect(() => {
    if (isApproved) {
      router.push('/admin');
    }
  }, [isApproved, router]);

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Checking approval status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-[#09090b] text-white p-4">
      {/* Background Ambient Glow */}
      <LightRays
        raysOrigin="top-center"
        raysColor={isRejected ? "#ef4444" : "#10b981"}
        raysSpeed={isRejected ? 0.8 : 1.2}
        lightSpread={0.5}
        rayLength={2.5}
        followMouse={false}
        pulsating
        fadeDistance={1}
        className="!absolute inset-0 opacity-40 pointer-events-none"
      />

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="rounded-xl text-muted-foreground hover:text-white hover:bg-white/5">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-lg z-10 space-y-8 text-center">
        {/* Pulsing Radar Animation */}
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center w-24 h-24">
            {isRejected ? (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ping" />
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20">
                  <ShieldAlert className="h-8 w-8 text-red-500" />
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Clock className="h-8 w-8 text-emerald-500" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Badge variant="outline" className={`font-bold uppercase tracking-widest text-[9px] px-2.5 py-0.5 border ${
            isRejected 
              ? 'bg-red-500/5 text-red-400 border-red-500/20' 
              : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
          }`}>
            {isRejected ? 'Access Denied' : 'Pending Verification'}
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isRejected ? 'Access Request Rejected' : 'Waiting for Approval'}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isRejected 
              ? 'Your membership request has been rejected. Please contact your administrator to verify your credentials.'
              : `Your profile has been submitted successfully to the administrators of ${orgName}. You will gain access as soon as they authorize your account.`}
          </p>
        </div>

        <Card className="rounded-2xl border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative overflow-hidden text-left">
          <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${
            isRejected 
              ? 'from-red-500/20 via-red-500 to-red-500/20' 
              : 'from-emerald-500/20 via-emerald-500 to-emerald-500/20'
          }`} />

          <CardHeader className="pt-6 pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Submitted Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Organization
                </span>
                <p className="text-sm font-semibold truncate">{orgName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Department
                </span>
                <p className="text-sm font-semibold capitalize truncate">{onboardingData?.department || 'Operations'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Contact Email
                </span>
                <p className="text-sm font-semibold truncate">{user?.email || ''}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Contact Phone
                </span>
                <p className="text-sm font-semibold truncate">{onboardingData?.phone || 'No phone provided'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2">
              <span className="text-[10px] uppercase font-bold text-white/40">Active Alerts</span>
              <div className="flex flex-wrap gap-2">
                {onboardingData?.notificationPreferences?.email && (
                  <Badge variant="secondary" className="bg-white/5 text-white/80 border-white/10 rounded-lg">Email</Badge>
                )}
                {onboardingData?.notificationPreferences?.sms && (
                  <Badge variant="secondary" className="bg-white/5 text-white/80 border-white/10 rounded-lg">SMS</Badge>
                )}
                {onboardingData?.notificationPreferences?.inApp && (
                  <Badge variant="secondary" className="bg-white/5 text-white/80 border-white/10 rounded-lg">In-App</Badge>
                )}
                {onboardingData?.notificationPreferences?.push && (
                  <Badge variant="secondary" className="bg-white/5 text-white/80 border-white/10 rounded-lg">Browser Push</Badge>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="pb-6 pt-2 border-t border-white/5 flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              className="rounded-xl border-white/10 bg-transparent text-white hover:bg-white/5 gap-1.5 h-11 w-full"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
