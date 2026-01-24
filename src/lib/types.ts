export interface School {
  id: string;
  name: string;
  slug: string;
  slogan?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  location?: string;
  nominalRoll?: number;
  modules?: string;
  implementationDate?: string; // ISO string
  referee?: string;
  includeDroneFootage?: boolean;
}

export interface Meeting {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  meetingTime: string; // ISO string
  meetingLink: string;
  recordingUrl?: string;
}
