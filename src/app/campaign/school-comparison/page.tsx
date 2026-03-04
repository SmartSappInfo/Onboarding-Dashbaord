
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { SmartSappLogo } from '@/components/icons';
import { ArrowRight, Users, Building2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import LightRays from '@/components/LightRays';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Persona Selection Campaign Page.
 * A high-fidelity "Selection Gate" that routes users to specific surveys
 * based on whether they are a Parent or a School Administrator.
 */

export default function SchoolComparisonPage() {
  const parentImg = PlaceHolderImages.find(img => img.id === 'campaign-parent')?.imageUrl;
  const schoolImg = PlaceHolderImages.find(img => img.id === 'campaign-school')?.imageUrl;

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden selection:bg-primary/20">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <LightRays
          raysOrigin="top-center"
          raysColor="#3B5FFF"
          raysSpeed={0.5}
          lightSpread={0.8}
          rayLength={3}
          pulsating
          fadeDistance={1}
          saturation={1}
          className="!absolute inset-0"
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-8 duration-1000">
          <Link href="/" className="inline-block hover:scale-105 transition-transform">
            <SmartSappLogo className="h-10 mx-auto" />
          </Link>
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary">Pre-Onboarding Experience</h2>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground leading-tight">
              Hey there! Quick question...
            </h1>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed px-4">
            We&apos;ve got <span className="text-primary font-bold">cool stuff for both</span>, but different experiences. 
            Help us show you the good stuff made just for you.
          </p>
        </div>

        {/* Choice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 px-2">
          {/* Parent Option */}
          <SelectionCard
            title="I'm a Parent / Student"
            description="Access your child's records, pay fees, and stay connected with school activities. Join the digital family today."
            href="/surveys/parents-survey"
            image={parentImg!}
            icon={Users}
            delay={0.2}
            color="from-orange-500 to-rose-500"
          />

          {/* School Option */}
          <SelectionCard
            title="I'm a School Owner / Staff"
            description="Manage your institution, automate billing, and enhance security for your students with our complete management suite."
            href="/surveys/schools-survey"
            image={schoolImg!}
            icon={Building2}
            delay={0.4}
            color="from-blue-600 to-indigo-600"
          />
        </div>
      </div>

      <footer className="relative z-10 mt-20 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
          &copy; {new Date().getFullYear()} SmartSapp Onboarding Hub
        </p>
      </footer>
    </div>
  );
}

function SelectionCard({ title, description, href, image, icon: Icon, delay, color }: {
  title: string;
  description: string;
  href: string;
  image: string;
  icon: any;
  delay: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      className="group relative h-full"
    >
      <Link href={href} className="block h-full">
        <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-card/80 backdrop-blur-xl h-full flex flex-col ring-1 ring-white/10 group-hover:ring-primary/30 transition-all duration-500">
          {/* Image Container */}
          <div className="relative h-64 sm:h-80 overflow-hidden shrink-0">
            <Image
              src={image}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              data-ai-hint="selection profile"
            />
            <div className={cn("absolute inset-0 bg-gradient-to-t opacity-60 group-hover:opacity-80 transition-opacity", color)} />
            
            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl w-fit mb-4 border border-white/20">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tighter">{title}</h3>
            </div>
          </div>

          {/* Content Container */}
          <CardContent className="p-8 space-y-6 flex-grow flex flex-col justify-between bg-white dark:bg-card">
            <p className="text-muted-foreground font-medium text-base leading-relaxed">
              {description}
            </p>
            
            <div className="flex items-center gap-3 text-primary font-black uppercase text-[10px] tracking-[0.2em] pt-4">
              Enter My Experience
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 group-hover:translate-x-2 transition-transform duration-300">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
