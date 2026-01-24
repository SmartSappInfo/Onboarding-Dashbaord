export interface School {
  id: string;
  slug: string;
  name: string;
  slogan: string;
  logoUrlId: string;
  heroImageUrlId: string;
  meetingTime: string; // ISO string
  meetingLink: string;
  usefulLinks: { title: string; url: string; description: string }[];
  testimonials: { name: string; role: string; videoUrl: string; imageId: string }[];
}

const schoolData: School[] = [
  {
    id: '1',
    slug: 'ghana-international-school',
    name: 'Ghana International School',
    slogan: 'Understanding of each other',
    logoUrlId: 'school-logo',
    heroImageUrlId: 'meeting-hero', // Use the new hero image
    meetingTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    meetingLink: 'https://meet.google.com/abc-xyz-pqr',
    usefulLinks: [
      {
        title: 'How to check results',
        url: 'https://youtu.be/example1',
        description: "A quick guide on accessing student results through the SmartsApp portal.",
      },
      {
        title: 'Setting up parent notifications',
        url: 'https://youtu.be/example2',
        description: 'Customize your notification settings to stay informed about important updates.',
      },
      {
        title: 'Communicating with teachers',
        url: 'https://youtu.be/example3',
        description: "Learn how to use the messaging feature to connect with your child's teachers.",
      },
    ],
    testimonials: [
      {
        name: 'Ama Serwaa',
        role: 'Parent',
        videoUrl: 'https://youtu.be/testimonial1',
        imageId: 'testimonial-1',
      },
      {
        name: 'Kofi Annan Jr.',
        role: 'Parent',
        videoUrl: 'https://youtu.be/testimonial2',
        imageId: 'testimonial-2',
      },
      {
        name: 'Dr. Mensah',
        role: 'Teacher',
        videoUrl: 'https://youtu.be/testimonial3',
        imageId: 'testimonial-3',
      },
    ],
  },
];

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  // In a real app, you would fetch this from a database
  // For this example, we'll find it in our mock data
  const school = schoolData.find((s) => s.slug === slug);
  return school || null;
}
