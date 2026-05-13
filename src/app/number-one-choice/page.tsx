
import Link from 'next/link';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import VideoEmbed from '@/components/video-embed';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Why parents choose other schools over yours — SmartSapp',
  description: 'Want to make your school the preferred choice for parents in one term? Book a FREE 30-minutes consultation.',
};

export default function NumberOneChoicePage() {
  return (
    <div className="light min-h-screen bg-white font-body selection:bg-primary/10 text-slate-900">
      {/* Background elements - kept subtle */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-400/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 py-6 px-6 sm:px-10 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="transition-transform hover:scale-105 duration-300">
            <Logo className="h-10" />
          </Link>
          <div className="hidden sm:block">
            <Button variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5" asChild>
                <Link href="https://smartsapp.com/request-trial">Request Demo</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center">
        {/* Hero Section */}
        <div className="space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
            Why do parents choose <span className="text-primary italic">other schools</span> over yours?
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 font-medium">
            Watch this short video to find out.
          </p>
        </div>

        {/* Video Section */}
        <div className="relative group rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-8 border-white animate-in fade-in zoom-in-95 duration-1000 delay-300 fill-mode-both">
           <VideoEmbed url="https://youtu.be/X2xkQxxo-DI" className="aspect-video" />
        </div>

        {/* CTA Section - Simplified on plain background */}
        <div className="mt-16 sm:mt-24 space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500 fill-mode-both">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-slate-900">
              Want to make your school the <span className="text-primary">preferred choice</span> for parents in one term?
          </h2>
          
          <p className="text-lg sm:text-xl text-slate-600 font-medium">
            Book a FREE 30-minutes consultation to see your personalized roadmap to complete the shift.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-primary text-white text-lg font-bold shadow-[0_12px_24px_-8px_rgba(59,95,255,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(59,95,255,0.5)] hover:translate-y--1 transition-all duration-300 group"
              asChild
            >
              <Link href="https://smartsapp.com/request-trial" className="flex items-center justify-center gap-2">
                Request Free Consultation Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Personalized Roadmap</span>
              </div>
              <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Complete the shift</span>
              </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-12 px-6 text-center border-t border-gray-100 mt-20">
        <p className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} SmartSapp. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
