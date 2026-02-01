'use client';

import VideoEmbed from '@/components/video-embed';
import { Card, CardContent } from '@/components/ui/card';

export default function TestimonialsSection() {
    const testimonials = [
        {
          videoUrl: 'https://youtu.be/sL2S_RzI2nc',
          quote:
            'Knowing only trusted, authorized people can pick up my child brings true peace of mind. SmartSapp ended the chaos and fear I once had at school pick-up.',
        },
        {
          videoUrl: 'https://youtu.be/VrHNh6G1U3k',
          quote:
            'With just a one-tap alert, you can quickly and securely pick up your child. SmartSapp simplifies school routines and ensures only trusted people can access your child—easy and worry-free.',
        },
        {
          videoUrl: 'https://youtu.be/p38wu6iQJ-c',
          quote:
            'SmartSapp gives me peace of mind by notifying me whenever my children are dropped off or picked up, ensuring their security and a smooth pick-up process.',
        },
        {
          videoUrl: 'https://youtu.be/ySSuTA-Bj1Y',
          quote:
            "I know my child is safe, and I can easily update the school if my child is sick or when I'm on my way to pick them up - peace of mind for busy parents",
        },
      ];

    return (
        <section
            id="testimonials"
            className="bg-background py-20 text-center md:py-28"
        >
            <div className="container">
                <h2 className="mb-4 font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Why Parents and Schools are going
                <br />
                Wild over SmartSapp
                </h2>
                <p className="mb-6 text-lg text-muted-foreground">
                Watch these testimonials to see how parents are ensuring their
                child's security with SmartSapp
                </p>
                <p className="mb-12 text-lg font-semibold text-foreground">
                👇 Click To Watch These Videos. It's Super Important👇
                </p>

                <div className="grid grid-cols-1 gap-x-8 gap-y-12 text-left md:grid-cols-2">
                {testimonials.map((testimonial, index) => (
                    <Card
                    key={index}
                    className="overflow-hidden shadow-lg"
                    >
                    <VideoEmbed url={testimonial.videoUrl} />
                    <CardContent className="p-6">
                        <p className="font-quote italic text-muted-foreground">
                        &quot;{testimonial.quote}&quot;
                        </p>
                    </CardContent>
                    </Card>
                ))}
                </div>
            </div>
        </section>
    );
}
