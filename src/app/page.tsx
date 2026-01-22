import Image from 'next/image';
import { Search, Calendar, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FindSchoolForm from '@/components/find-school-form';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const heroImage = PlaceHolderImages.find((p) => p.id === 'home-hero');

  const howItWorks = [
    {
      icon: <Search className="h-8 w-8 text-primary" />,
      title: 'Find your school',
      description: "Enter your school's name to find its dedicated onboarding page.",
    },
    {
      icon: <Calendar className="h-8 w-8 text-primary" />,
      title: 'Join the meeting',
      description: 'Get details for the live onboarding meeting, including date, time, and a link to join.',
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: 'Download the app',
      description: 'Access links to download the SmartsApp from the App Store and Google Play.',
    },
  ];

  return (
    <div className="space-y-24 md:space-y-32">
      {/* Hero Section */}
      <section className="container mx-auto pt-16 text-center md:pt-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 font-headline text-4xl font-black tracking-tight text-primary md:text-6xl">
            Welcome to SmartsApp Onboarding
          </h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            The simplest way for your school community to get connected. Enter your school's name below to get started.
          </p>
          <FindSchoolForm />
        </div>
        {heroImage && (
          <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-lg shadow-2xl md:mt-16">
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              width={1200}
              height={800}
              data-ai-hint={heroImage.imageHint}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        )}
      </section>

      {/* How it works Section */}
      <section className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {howItWorks.map((step) => (
            <Card key={step.title} className="bg-card/70 text-center backdrop-blur-sm">
              <CardHeader>
                <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">{step.icon}</div>
                <CardTitle className="text-xl font-bold">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Onboarding for Schools CTA Section */}
      <section className="bg-muted/40">
        <div className="container mx-auto py-16 text-center md:py-24">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Onboarding for Schools</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Want to create a page for your school? It's easy and free.
          </p>
          <Button size="lg" asChild>
            <a href="https://smartsapp.com/contact-us" target="_blank" rel="noopener noreferrer">
              Get started
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
