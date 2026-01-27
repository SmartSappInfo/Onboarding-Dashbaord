'use client';

import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset } from '@/lib/types';

// --- SEED DATA ---

const mediaData: Omit<MediaAsset, 'id'>[] = [
  {
    name: 'smartsapp-logo.png',
    url: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    fullPath: 'seed/smartsapp-logo.png',
    type: 'image',
    mimeType: 'image/png',
    size: 15000,
    uploadedBy: 'system-seed',
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
  {
    name: 'school-campus-hero.jpg',
    url: 'https://picsum.photos/seed/school-hero/1200/800',
    fullPath: 'seed/school-campus-hero.jpg',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 250000,
    uploadedBy: 'system-seed',
    createdAt: new Date('2024-01-01T10:01:00Z').toISOString(),
  },
];

const schoolData: Omit<School, 'id'>[] = [
  {
    name: 'Ghana International School',
    slug: 'ghana-international-school',
    slogan: 'Understanding of each other.',
    logoUrl: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    heroImageUrl: 'https://picsum.photos/seed/school-hero/1200/800',
    contactPerson: 'Dr. Mary Ashun',
    email: 'principal@gis.edu.gh',
    phone: '+233 30 277 7163',
    location: 'Accra, Ghana',
    nominalRoll: 1500,
    modules: 'Billing, SIS, Attendance',
    implementationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
    referee: 'SmartSapp Team',
    includeDroneFootage: true,
  },
];

const meetingData: Omit<Meeting, 'id'>[] = [
  {
    schoolId: 'ghana-international-school',
    schoolName: 'Ghana International School',
    schoolSlug: 'ghana-international-school',
    meetingTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    meetingLink: 'https://meet.google.com/foo-bar-baz',
    recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
  },
];


// --- SEEDING FUNCTIONS ---

async function clearCollection(firestore: Firestore, collectionPath: string) {
  const collectionRef = collection(firestore, collectionPath);
  const querySnapshot = await getDocs(collectionRef);
  const batch = writeBatch(firestore);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function seedMedia(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'media');
  const batch = writeBatch(firestore);
  const mediaCollection = collection(firestore, 'media');
  mediaData.forEach((asset) => {
    const docRef = doc(mediaCollection);
    batch.set(docRef, asset);
  });
  await batch.commit();
  return mediaData.length;
}

export async function seedSchools(firestore: Firestore): Promise<number> {
    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);
    const schoolsCollection = collection(firestore, 'schools');

    schoolData.forEach((school) => {
        const docRef = doc(schoolsCollection);
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return schoolData.length;
}


export async function seedMeetings(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);
  const meetingsCollection = collection(firestore, 'meetings');
  
  const updatedMeetingData = meetingData.map(m => ({ ...m, schoolId: m.schoolSlug }));

  updatedMeetingData.forEach((meeting) => {
    const docRef = doc(meetingsCollection);
    batch.set(docRef, meeting);
  });
  await batch.commit();
  return updatedMeetingData.length;
}
