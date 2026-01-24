export interface School {
  id: string;
  name: string;
  slug: string;
  slogan?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  meetingTime?: string; // ISO string
  meetingLink?: string;
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

    