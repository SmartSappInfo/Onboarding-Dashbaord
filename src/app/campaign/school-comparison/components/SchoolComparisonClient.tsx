'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Users, Building2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import LightRays from '@/components/LightRays';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SurveyLoader from '@/app/surveys/components/survey-loader';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

/**
 * @fileOverview Minimalist Persona Selection Dashboard.
 */

export default function SchoolComparisonClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState('');

  const parentImg = PlaceHolderImages.find(img => img.id === 'campaign-parent')?.imageUrl || 'https://picsum.photos/seed/parent/600/800';
  const schoolImg = PlaceHolderImages.find(img => img.id === 'campaign-school')?.imageUrl || 'https://picsum.photos/seed/admin/600/800';

  const [sessionId] = React.useState(() => {
    if (typeof window === 'undefined') return null;
    const key = `campaign_sess_school_comparison`;
    let id = sessionStorage.getItem(key);
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(key, id);
    }
    return id;
  });

  React.useEffect(() => {
    if (!sessionId || !firestore) return;
    const sessionRef = doc(firestore, 'campaign_sessions', sessionId);
    setDoc(sessionRef, {
        campaignId: 'school-comparison',
        selectedOption: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }, { merge: true }).catch(console.error);
    const interval = setInterval(() => {
        updateDoc(sessionRef, { updatedAt: new Date().toISOString() }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId, firestore]);

  const handlePersonaSelect = (href: string, label: string, option: 'school' | 'parent') => {
    setIsTransitioning(true);
    setSelectedLabel(label);
    if (sessionId && firestore) {
        const sessionRef = doc(firestore, 'campaign_sessions', sessionId);
        updateDoc(sessionRef, { selectedOption: option, updatedAt: new Date().toISOString() }).catch(console.error);
    }
    router.push(href);
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden selection:bg-primary/20">
      {isTransitioning && <SurveyLoader label={`Initializing ${selectedLabel === 'FOR FAMILIES' ? 'Family' : 'Institutional'} Experience...`} className="z-[100]" />}

      <div className="absolute inset-0 z-0 opacity-40">
        <LightRays raysOrigin="top-center" raysColor="#3B5FFF" raysSpeed={0.5} lightSpread={0.8} rayLength={3} pulsating fadeDistance={1} saturation={1} className="!absolute inset-0" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-8 py-6 md:py-12 px-4 sm:px-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-foreground leading-tight px-4 uppercase">
            Who are you?
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 px-2">
          <SelectionCard
            title="School Owner / Staff"
            href="/surveys/schools-survey"
            option="school"
            image={schoolImg}
            icon={Building2}
            delay={0.2}
            color="from-blue-600 to-indigo-600"
            label="FOR INSTITUTIONS"
            onSelect={handlePersonaSelect}
          />

          <SelectionCard
            title="A Parent"
            href="/surveys/parents-survey"
            option="parent"
            image={parentImg}
            icon={Users}
            delay={0.4}
            color="from-orange-500 to-rose-500"
            label="FOR FAMILIES"
            onSelect={handlePersonaSelect}
          />
        </div>
      </div>

      <footer className="relative z-10 mt-auto py-8 md:py-12 text-center text-xs sm:text-sm text-muted-foreground w-full border-t border-border/20">
        <p>&copy; {new Date().getFullYear()} SmartSapp · Institutional Intelligence</p>
      </footer>
    </div>
  );
}

function SelectionCard({ title, href, option, image, icon: Icon, delay, color, label, onSelect }: {
  title: string;
  href: string;
  option: 'school' | 'parent';
  image: string;
  icon: any;
  delay: number;
  color: string;
  label: string;
  onSelect: (href: string, label: string, option: 'school' | 'parent') => void;
}) {
  return (
    <div
      className="group relative h-full cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{ animationDelay: `${delay * 1000}ms`, animationFillMode: 'backwards' }}
      onClick={() => onSelect(href, label, option)}
    >
      <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-card/80 backdrop-blur-xl h-full flex flex-col ring-1 ring-white/10 group-hover:ring-primary/30 transition-all duration-500">
        <div className="relative h-64 md:h-96 overflow-hidden shrink-0">
          {image && <Image src={image} alt={title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />}
          <div className={cn("absolute inset-0 bg-gradient-to-t opacity-60 group-hover:opacity-80 transition-opacity", color)} />
          <div className="absolute top-4 left-4 md:top-6 md:left-6">
            <Badge variant="outline" className="bg-white/20 backdrop-blur-md text-white border-white/20 text-[8px] font-black tracking-widest uppercase py-1 px-3">
              {label}
            </Badge>
          </div>
          <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-8">
            <div className="p-2 md:p-3 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl w-fit mb-2 md:mb-4 border border-white/20 shadow-xl">
              <Icon className="h-4 w-4 md:h-6 md:w-6 text-white" />
            </div>
            <h3 className="text-xl md:text-3xl font-black text-white leading-tight uppercase tracking-tighter">{title}</h3>
          </div>
        </div>
        <CardContent className="p-6 md:p-8 flex-grow flex flex-col justify-center bg-white dark:bg-card">
          <div className="flex items-center justify-center gap-3 text-primary font-black uppercase text-[16px] tracking-[0.2em] leading-tight">
            Select
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-xl shadow-primary/20 group-hover:translate-x-2 transition-transform duration-300 relative">
              <ArrowRight className="h-4 w-4" />
              <div className="absolute inset-0 rounded-xl bg-primary animate-ping opacity-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
