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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SchoolComparisonClient() {
  const parentImg = PlaceHolderImages.find(img => img.id === 'campaign-parent')?.imageUrl || 'https://picsum.photos/seed/parent/600/800';
  const schoolImg = PlaceHolderImages.find(img => img.id === 'campaign-school')?.imageUrl || 'https://picsum.photos/seed/admin/600/800';

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden selection:bg-primary/20">
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

      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-12 py-12 px-4 sm:px-8">
        {/* Header Section */}
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-8 duration-1000">
          <Link href="/" className="inline-block hover:scale-105 transition-transform">
            <SmartSappLogo className="h-10 mx-auto" />
          </Link>
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary">WELCOME</h2>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-foreground leading-tight px-4">
              Which of the following <br className="hidden md:block" /> best describes you?
            </h1>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed px-4">
            Choose your path to get the <span className="text-primary font-bold">best experience</span>
          </p>
        </div>

        {/* Choice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 px-2">
          {/* School Option */}
          <SelectionCard
            title="I'm a School Owner / Staff"
            description="How do I know if my school is the preferred choice for parents?"
            href="/surveys/schools-survey"
            image={schoolImg}
            icon={Building2}
            delay={0.2}
            color="from-blue-600 to-indigo-600"
            label="FOR INSTITUTIONS"
          />

          {/* Parent Option */}
          <SelectionCard
            title="I'm A Parent"
            description="How do I know if my child’s school is doing the right things?"
            href="/surveys/parents-survey"
            image={parentImg}
            icon={Users}
            delay={0.4}
            color="from-orange-500 to-rose-500"
            label="FOR FAMILIES"
          />
        </div>
      </div>

      <footer className="relative z-10 mt-12 py-12 text-center text-xs sm:text-sm text-muted-foreground bg-white/50 border-t w-full border-border/50">
        <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
        <p>&copy; {new Date().getFullYear()} SmartSapp</p>
      </footer>
    </div>
  );
}

function SelectionCard({ title, description, href, image, icon: Icon, delay, color, label }: {
  title: string;
  description: string;
  href: string;
  image: string;
  icon: any;
  delay: number;
  color: string;
  label: string;
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
            {image && (
              <Image
                src={image}
                alt={title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                data-ai-hint="selection profile"
              />
            )}
            <div className={cn("absolute inset-0 bg-gradient-to-t opacity-60 group-hover:opacity-80 transition-opacity", color)} />

            <div className="absolute top-6 left-6">
              <Badge variant="outline" className="bg-white/20 backdrop-blur-md text-white border-white/20 text-[8px] font-black tracking-widest uppercase py-1 px-3">
                {label}
              </Badge>
            </div>

            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl w-fit mb-4 border border-white/20 shadow-xl">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tighter">{title}</h3>
            </div>
          </div>

          {/* Content Container */}
          <CardContent className="p-8 space-y-6 flex-grow flex flex-col justify-between bg-white dark:bg-card">
            <p className="text-muted-foreground font-semibold text-lg leading-relaxed">
              {description}
            </p>

            <div className="flex items-center gap-3 text-primary font-black uppercase text-[14px] tracking-[0.2em] pt-4">
              Find Out Now
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 group-hover:translate-x-2 transition-transform duration-300 relative">
                <ArrowRight className="h-5 w-5" />
                <div className="absolute inset-0 rounded-2xl bg-primary animate-ping opacity-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
