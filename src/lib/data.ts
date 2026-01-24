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

// Mock data has been removed and is now fetched from Firestore.
// This file is kept to prevent breaking other un-migrated parts of the app.
// In a real-world scenario, this would be cleaned up.
const schoolData: School[] = [];

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const school = schoolData.find((s) => s.slug === slug);
  return school || null;
}
