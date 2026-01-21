import Image from 'next/image';
import { School, User, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FindSchoolForm from '@/components/find-school-form';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const heroImage = PlaceHolderImages.find((p) => p.id === 'home-hero');

  const features = [
    {
      icon: <School className="h-8 w-8 text-primary" />,
      title: 'Customized for Your School',
      description: "Each onboarding page is tailored with your school's name, logo, and slogan for a personalized experience.",
    },
    {
      icon: <User className="h-8 w-8 text-primary" />,
      title: 'Seamless Parent Engagement',
      description: 'Provide parents with a central hub for meeting details, important links, and easy-to-follow instructions.',
    },
    {
      icon: <Video className="h-8 w-8 text-primary" />,
      title: 'Guided Video Tutorials',
      description: 'Embedded videos guide parents through app installation and usage, reducing support requests.',
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
            The simplest way to get your school community connected. Find your school below to get started with a
            personalized onboarding experience.
          </p>
          <FindSchoolForm />
        </div>
        {heroImage && (
          <div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-lg shadow-2xl md:mt-16">
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

      {/* Features Section */}
      <section className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything Parents Need in One Place</h2>
          <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground">
            Our onboarding pages are designed to be clear, helpful, and engaging.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card/70 text-center backdrop-blur-sm">
              <CardHeader>
                <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-3">{feature.icon}</div>
                <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/40">
        <div className="container mx-auto py-16 text-center md:py-24">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Ready to Connect Your School?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Join hundreds of schools using SmartsApp to improve communication and parent engagement.
          </p>
          <Button size="lg" asChild>
            <a href="https://smartsapp.com/" target="_blank" rel="noopener noreferrer">
              Learn More About SmartsApp
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
