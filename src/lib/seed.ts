'use client';

import { collection, writeBatch, getDocs, doc, query, where, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { School, Meeting, MediaAsset, Survey, UserProfile, OnboardingStage, Module, Activity, PDFForm, PDFFormField, SenderProfile, MessageStyle, MessageTemplate, MessageLog } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { ONBOARDING_STAGE_COLORS } from './colors';
import { addDays, format, isAfter, startOfToday, subDays, subHours } from 'date-fns';

// --- SEED DATA ---

const mediaData: Omit<MediaAsset, 'id'>[] = [
  {
    name: 'smartsapp-logo.png',
    url: 'https://smartsapp.com/wp-content/uploads/2023/08/logo-blue.png',
    originalName: 'smartsapp-logo.png',
    fullPath: 'seed/smartsapp-logo.png',
    type: 'image', mimeType: 'image/png', size: 15000, width: 256, height: 256,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  },
  {
    name: 'school-campus-hero.jpg',
    url: 'https://picsum.photos/seed/school-hero/1200/800',
    originalName: 'school-campus-hero.jpg',
    fullPath: 'seed/school-campus-hero.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 250000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-01T10:01:00Z').toISOString(),
  },
  {
    name: 'school-prospectus.pdf',
    url: 'https://smartsapp.com/downloads/brochure.pdf',
    originalName: 'school-prospectus.pdf',
    fullPath: 'seed/school-prospectus.pdf',
    type: 'document', mimeType: 'application/pdf', size: 1200000,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T11:00:00Z').toISOString(),
  },
  {
    name: 'promotional-video.mp4',
    url: 'https://youtu.be/M6MUlDkfZOg',
    originalName: 'promotional-video.mp4',
    type: 'link', size: 0,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-02T12:00:00Z').toISOString(),
  },
  {
    name: 'students-in-classroom.jpg',
    url: 'https://picsum.photos/seed/classroom/1200/800',
    originalName: 'students-in-classroom.jpg',
    fullPath: 'seed/students-in-classroom.jpg',
    type: 'image', mimeType: 'image/jpeg', size: 310000, width: 1200, height: 800,
    uploadedBy: 'system-seed', createdAt: new Date('2024-01-03T09:00:00Z').toISOString(),
  },
];

const baseSchoolData: Omit<School, 'id' | 'slug' | 'stage' | 'assignedTo' | 'createdAt' | 'logoUrl' | 'heroImageUrl' | 'modules'>[] = [
  { name: 'Ghana International School', initials: 'GIS', slogan: 'Understanding of each other.', location: 'Accra, Ghana', nominalRoll: 1500, includeDroneFootage: true, referee: 'SmartSapp Team', contactPerson: 'Dr. Mary Ashun', email: 'principal@gis.edu.gh', phone: '+233 30 277 7163' },
  { name: 'Lincoln Community School', initials: 'LCS', slogan: 'Learning and community, hand in hand.', location: 'Accra, Ghana', nominalRoll: 800, includeDroneFootage: false, referee: 'Ama Serwaa', contactPerson: 'John Smith', email: 'admissions@lincoln.edu.gh', phone: '+233 30 221 8100' },
  { name: 'Adisadel College', initials: 'ADISCO', slogan: 'Vel Primus Vel Cum Primis.', location: 'Cape Coast, Ghana', nominalRoll: 2000, includeDroneFootage: true, referee: 'Old Boys Association', contactPerson: 'The Headmaster', email: 'info@adisadelcollege.net', phone: '+233 33 213 2543' },
  { name: 'SOS-Hermann Gmeiner International College', initials: 'SOS-HGIC', slogan: 'Knowledge and Service.', location: 'Tema, Ghana', nominalRoll: 400, includeDroneFootage: false, referee: 'SOS-CV Ghana', contactPerson: 'The Principal', email: 'hgic.info@sos-ghana.org', phone: '+233 30 330 5231' },
  { name: 'Wesley Girls\' High School', initials: 'WGHS', slogan: 'Live Pure, Speak True, Right Wrong, Follow the King.', location: 'Cape Coast, Ghana', nominalRoll: 1800, includeDroneFootage: false, referee: 'GES', contactPerson: 'The Headmistress', email: 'info@wesleygirls.edu.gh', phone: '+233 33 213 2218' },
  { name: 'Presbyterian Boys\' Secondary School (PRESEC)', initials: 'PRESEC', slogan: 'In Lumine Tuo Videbimus Lumen.', location: 'Legon, Accra', nominalRoll: 2500, includeDroneFootage: true, referee: 'Old Boys Association', contactPerson: 'The Headmaster', email: 'info@preseclegon.edu.gh', phone: '+233 30 250 0907' },
  { name: 'Galaxy International School', initials: 'Galaxy', slogan: 'Gateway to the Future.', location: 'Accra, Ghana', nominalRoll: 600, includeDroneFootage: true, referee: 'Corporate Referral', contactPerson: 'Admissions Office', email: 'info@galaxy.edu.gh', phone: '+233 30 254 5472' },
  { name: 'Tema International School', initials: 'TIS', slogan: 'Service, Strength and Stability.', location: 'Tema, Ghana', nominalRoll: 500, includeDroneFootage: false, referee: 'IB Network', contactPerson: 'Admissions Dean', email: 'admissions@tis.edu.gh', phone: '+233 30 330 5134' },
  { name: 'Ridge School', initials: 'Ridge', slogan: 'Loyalty and Service.', location: 'Accra, Ghana', nominalRoll: 1200, includeDroneFootage: false, referee: 'Parent Alumni', contactPerson: 'Mrs. S. Nelson', email: 'info@ridgeschool.edu.gh', phone: '+233 30 222 2962' },
  { name: 'Faith Montessori School', initials: 'Faith', slogan: 'Godliness and Academic Excellence.', location: 'Gbawe, Accra', nominalRoll: 1000, includeDroneFootage: true, referee: 'SmartSapp Support', contactPerson: 'Mr. Oswald Amoo', email: 'admin@faithmontessori.edu.gh', phone: '+233 30 231 2345' },
];

const surveyData: Omit<Survey, 'id' | 'createdAt' | 'updatedAt' | 'slug'>[] = [
  {
    title: 'Comprehensive Feedback Survey',
    description: 'Please provide your valuable feedback to help us improve our services. This survey includes examples of all available question and layout types.',
    status: 'published',
    thankYouTitle: 'Thank You for Your Feedback!',
    thankYouDescription: 'We have received your submission and will use it to improve our services.',
    bannerImageUrl: 'https://picsum.photos/seed/survey1-banner/1200/400',
    elements: [
      { id: 'sec_1', type: 'section', title: 'Personal Information', description: 'Let\'s start with some basic details.', renderAsPage: true, },
      { id: 'q_name', type: 'text', title: 'What is your full name?', isRequired: true, placeholder: 'e.g., Jane Doe', },
      { id: 'q_email', type: 'text', title: 'What is your email address?', isRequired: true, placeholder: 'e.g., jane.doe@example.com', },
      { id: 'layout_divider_1', type: 'divider', },
      { id: 'q_rating', type: 'rating', title: 'How would you rate your overall experience (1-5 stars)?', isRequired: true, defaultValue: 0, },
      { id: 'sec_2', type: 'section', title: 'Your Experience', description: 'Tell us more about your recent interaction.', renderAsPage: true, },
      { id: 'layout_heading_1', type: 'heading', title: 'Our Website', },
      { id: 'q_found_what_you_need', type: 'yes-no', title: 'Did you find what you were looking for on our website?', isRequired: true, },
      { id: 'logic_1', type: 'logic', rules: [{ sourceQuestionId: 'q_found_what_you_need', operator: 'isEqualTo', targetValue: 'No', action: { type: 'jump', targetElementId: 'sec_4_follow_up', }, },], },
      { id: 'sec_3_details', type: 'section', title: 'Further Details', description: 'This section will be skipped if you answered "No" above.', renderAsPage: false, },
      { id: 'q_which_products', type: 'checkboxes', title: 'Which of our products/services have you used? (Select all that apply)', isRequired: false, options: ['Product A', 'Service B', 'Consulting C'], allowOther: true, },
      { id: 'layout_video_1', type: 'video', url: 'https://youtu.be/M6MUlDkfZOg', },
      { id: 'sec_4_follow_up', type: 'section', title: 'Follow-Up', description: 'Thank you for your feedback. We appreciate your time.', renderAsPage: true, },
      { id: 'q_contact_permission', type: 'dropdown', title: 'May we contact you for a follow-up interview?', isRequired: false, options: ['Yes, by email', 'Yes, by phone', 'No, thank you'], },
    ],
  },
  {
    title: 'Staff Onboarding Feedback',
    description: 'We want to know how your first week went. Your feedback helps us improve the process for future team members.',
    status: 'published',
    thankYouTitle: 'Welcome to the Team!',
    thankYouDescription: 'Your feedback has been recorded. We are excited to have you with us!',
    bannerImageUrl: 'https://picsum.photos/seed/staff-banner/1200/400',
    elements: [
      { id: 'q_role', type: 'dropdown', title: 'What is your department?', isRequired: true, options: ['Administration', 'Teaching', 'Finance', 'Support Staff', 'IT'] },
      { id: 'q_clarity', type: 'rating', title: 'How clear were your responsibilities explained?', isRequired: true },
      { id: 'q_mentor', type: 'yes-no', title: 'Have you been assigned a mentor?', isRequired: true },
      { id: 'q_comments', type: 'long-text', title: 'Any additional comments about the onboarding process?', isRequired: false }
    ]
  }
];

const pdfFormData: Omit<PDFForm, 'id' | 'createdAt' | 'updatedAt' | 'fields' | 'status' | 'createdBy'>[] = [
  {
    name: 'Sample Enrollment Form',
    originalFileName: 'enrollment.pdf',
    storagePath: 'seed/enrollment.pdf',
    downloadUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    publicTitle: 'Sample Enrollment Form',
    slug: 'sample-enrollment',
  },
  {
    name: 'Medical Release Waiver',
    originalFileName: 'medical.pdf',
    storagePath: 'seed/medical.pdf',
    downloadUrl: 'https://www.antennahouse.com/hubfs/xsl-fo-sample/pdf/basic-link-1.pdf',
    publicTitle: 'Medical Release Waiver',
    slug: 'medical-release',
  },
];

const defaultStages: Omit<OnboardingStage, 'id'>[] = [
    { name: 'Welcome', order: 1, color: ONBOARDING_STAGE_COLORS[0] },
    { name: 'Data Collection', order: 2, color: ONBOARDING_STAGE_COLORS[1] },
    { name: 'Setup', order: 3, color: ONBOARDING_STAGE_COLORS[2] },
    { name: 'Training', order: 4, color: ONBOARDING_STAGE_COLORS[3] },
    { name: 'Pre-Onboarding', order: 5, color: ONBOARDING_STAGE_COLORS[4] },
    { name: 'Parent Engagement', order: 6, color: ONBOARDING_STAGE_COLORS[5] },
    { name: 'Pre-Go-Live', order: 7, color: ONBOARDING_STAGE_COLORS[6] },
    { name: 'Go-Live', order: 8, color: ONBOARDING_STAGE_COLORS[7] },
    { name: 'Support', order: 9, color: ONBOARDING_STAGE_COLORS[8] },
];

const defaultModules: Omit<Module, 'id'>[] = [
    { name: 'Child Security', abbreviation: 'SEC', color: '#f72585', description: 'Ensures safe drop-off and pick-up of students.', order: 1 },
    { name: 'Connected Community', abbreviation: 'COM', color: '#b5179e', description: 'Enhances communication between school, teachers, and parents.', order: 2 },
    { name: 'Fee Collection', abbreviation: 'FEE', color: '#7209b7', description: 'Streamlines school fee payments and tracking.', order: 3 },
    { name: 'Traffic Management', abbreviation: 'TRF', color: '#560bad', description: 'Manages school traffic flow during peak hours.', order: 4 },
    { name: 'Academic Reports', abbreviation: 'REP', color: '#480ca8', description: 'Digital report cards and academic performance tracking.', order: 5 },
    { name: 'Homework Management', abbreviation: 'HW', color: '#3f37c9', description: 'Assign, submit, and track homework digitally.', order: 6 },
    { name: 'Canteen Management', abbreviation: 'CAN', color: '#4361ee', description: 'Cashless system for school canteen purchases.', order: 7 },
];


// --- UTILITY ---

async function clearCollection(firestore: Firestore, collectionPath: string) {
  const collectionRef = collection(firestore, collectionPath);
  const querySnapshot = await getDocs(collectionRef);
  if (querySnapshot.empty) return;
  const batch = writeBatch(firestore);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

// --- SEEDING FUNCTIONS ---

export async function seedMessaging(firestore: Firestore): Promise<number> {
  const batch = writeBatch(firestore);
  
  // 1. Clear existing
  await clearCollection(firestore, 'sender_profiles');
  await clearCollection(firestore, 'message_styles');
  await clearCollection(firestore, 'message_templates');
  await clearCollection(firestore, 'message_logs');

  // 2. Sender Profiles
  const profiles: Omit<SenderProfile, 'id'>[] = [
    { name: 'SmartSapp Primary SMS', channel: 'sms', identifier: 'SMARTSAPP', isDefault: true, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { name: 'Onboarding Email', channel: 'email', identifier: 'onboarding@smartsapp.com', isDefault: true, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { name: 'School Support', channel: 'email', identifier: 'support@smartsapp.com', isDefault: false, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  
  const profileMap: Record<string, string> = {};
  profiles.forEach(p => {
    const ref = doc(collection(firestore, 'sender_profiles'));
    batch.set(ref, p);
    profileMap[p.name] = ref.id;
  });

  // 3. Message Style
  const styleRef = doc(collection(firestore, 'message_styles'));
  batch.set(styleRef, {
    name: 'SmartSapp Standard Wrapper',
    htmlWrapper: `
      <html>
        <body style="font-family: sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
            <div style="background: #3B5FFF; padding: 20px; text-align: center; color: #fff;">
              <h1 style="margin: 0; font-size: 20px;">SmartSapp Onboarding</h1>
            </div>
            <div style="padding: 30px; line-height: 1.6; color: #333;">
              {{content}}
            </div>
            <div style="padding: 20px; background: #fafafa; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999;">
              &copy; 2024 SmartSapp. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 4. Templates
  const templates: Omit<MessageTemplate, 'id'>[] = [
    {
      name: 'Welcome School (SMS)',
      category: 'general',
      channel: 'sms',
      body: 'Welcome {{school_name}} to SmartSapp! Your onboarding specialist is {{agent_name}}. Let\'s get started!',
      variables: ['school_name', 'agent_name'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      name: 'Meeting Reminder (Email)',
      category: 'meetings',
      channel: 'email',
      subject: 'Reminder: {{meeting_type}} for {{school_name}}',
      body: '<p>Hi {{contact_name}},</p><p>This is a reminder for your <strong>{{meeting_type}}</strong> scheduled for {{date}} at {{time}}.</p><p>Join link: {{link}}</p>',
      styleId: styleRef.id,
      variables: ['meeting_type', 'school_name', 'contact_name', 'date', 'time', 'link'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      name: 'Survey Completion (Email)',
      category: 'surveys',
      channel: 'email',
      subject: 'New Response: {{survey_title}}',
      body: '<p>A new response has been received for <strong>{{survey_title}}</strong>.</p><p>Respondent Score: {{score}} / {{max_score}}</p><p>Date: {{submission_date}}</p>',
      styleId: styleRef.id,
      variables: ['survey_title', 'score', 'max_score', 'submission_date'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      name: 'Document Signed Confirmation (SMS)',
      category: 'forms',
      channel: 'sms',
      body: 'Hi, your document "{{form_name}}" has been successfully signed and processed on {{submission_date}}. Thank you!',
      variables: ['form_name', 'submission_date'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const templateMap: Record<string, string> = {};
  templates.forEach(t => {
    const ref = doc(collection(firestore, 'message_templates'));
    batch.set(ref, t);
    templateMap[t.name] = ref.id;
  });

  // 5. Seed some logs for demo visibility
  const sampleLogs: Omit<MessageLog, 'id'>[] = [
    {
        templateId: templateMap['Welcome School (SMS)'],
        templateName: 'Welcome School (SMS)',
        senderProfileId: profileMap['SmartSapp Primary SMS'],
        senderName: 'SmartSapp Primary SMS',
        channel: 'sms',
        recipient: '+233 24 000 0001',
        body: 'Welcome Ghana International School to SmartSapp! Your onboarding specialist is Sitso. Let\'s get started!',
        status: 'sent',
        sentAt: subHours(new Date(), 2).toISOString(),
        variables: { school_name: 'Ghana International School', agent_name: 'Sitso' }
    },
    {
        templateId: templateMap['Meeting Reminder (Email)'],
        templateName: 'Meeting Reminder (Email)',
        senderProfileId: profileMap['Onboarding Email'],
        senderName: 'Onboarding Email',
        channel: 'email',
        recipient: 'principal@gis.edu.gh',
        subject: 'Reminder: Parent Engagement for Ghana International School',
        body: '<p>Hi Dr. Mary Ashun,</p><p>This is a reminder for your <strong>Parent Engagement</strong> scheduled for tomorrow at 10:00 AM.</p>',
        status: 'sent',
        sentAt: subHours(new Date(), 5).toISOString(),
        variables: { meeting_type: 'Parent Engagement', school_name: 'Ghana International School', contact_name: 'Dr. Mary Ashun' }
    },
    {
        templateId: templateMap['Document Signed Confirmation (SMS)'],
        templateName: 'Document Signed Confirmation (SMS)',
        senderProfileId: profileMap['SmartSapp Primary SMS'],
        senderName: 'SmartSapp Primary SMS',
        channel: 'sms',
        recipient: '+233 24 999 8888',
        body: 'Hi, your document "Enrollment Form" has been successfully signed and processed. Thank you!',
        status: 'failed',
        error: 'Carrier Rejected: Invalid Handset Number',
        sentAt: subHours(new Date(), 1).toISOString(),
        variables: { form_name: 'Enrollment Form' }
    }
  ];

  sampleLogs.forEach(l => batch.set(doc(collection(firestore, 'message_logs')), l));

  await batch.commit();
  return profiles.length + 1 + templates.length + sampleLogs.length;
}

export async function seedActivities(firestore: Firestore): Promise<number> {
  const activitiesCollection = collection(firestore, 'activities');
  
  // 1. Fetch Existing Data to Preserve
  const existingActivitiesSnapshot = await getDocs(activitiesCollection);
  const existingActivities = existingActivitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  const usersSnapshot = await getDocs(collection(firestore, 'users'));
  const stagesSnapshot = await getDocs(query(collection(firestore, 'onboardingStages'), orderBy('order')));

  const schools = schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
  const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
  const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingStage));

  const schoolsMap = new Map(schools.map(s => [s.id, s]));

  // 2. Enrich existing activities with denormalized school data
  const enrichedExisting = existingActivities.map(activity => {
    if (activity.schoolId && schoolsMap.has(activity.schoolId)) {
      const school = schoolsMap.get(activity.schoolId)!;
      return {
        ...activity,
        schoolName: school.name,
        schoolSlug: school.slug
      };
    }
    return activity;
  });

  // 3. Clear existing collection
  await clearCollection(firestore, 'activities');

  const allActivities: Omit<Activity, 'id'>[] = [];

  // Add enriched existing data
  enrichedExisting.forEach(a => {
      const { id, ...data } = a;
      allActivities.push(data);
  });

  // 4. Generate Additional Dummy Data (If needed)
  if (schools.length > 0 && users.length > 0 && enrichedExisting.length < 10) {
    schools.forEach((school, schoolIndex) => {
        const creationUser = users[schoolIndex % users.length];
        const creationDate = new Date(school.createdAt);

        // School Created
        allActivities.push({
            schoolId: school.id,
            schoolName: school.name,
            schoolSlug: school.slug,
            userId: creationUser.id,
            type: 'school_created',
            source: 'user_action',
            timestamp: creationDate.toISOString(),
            description: `${creationUser.name} created school "${school.name}".`,
        });

        // Interactions
        if (schoolIndex % 2 === 0) {
            allActivities.push({
                schoolId: school.id,
                schoolName: school.name,
                schoolSlug: school.slug,
                userId: creationUser.id,
                type: 'call',
                source: 'manual',
                timestamp: addDays(creationDate, 1).toISOString(),
                description: `${creationUser.name} called the school.`,
                metadata: { content: `Spoke with ${school.contactPerson}. They are ready to begin data collection.`}
            });
        }
    });
  }

  // 5. Atomic Batch Restoration (Handling 500 ops limit)
  let count = 0;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < allActivities.length; i += CHUNK_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = allActivities.slice(i, i + CHUNK_SIZE);
      chunk.forEach(activity => {
          batch.set(doc(activitiesCollection), activity);
          count++;
      });
      await batch.commit();
  }

  return count;
}

export async function seedPdfForms(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'pdfs');
  const batch = writeBatch(firestore);
  const pdfsCollection = collection(firestore, 'pdfs');

  const sampleFields: PDFFormField[] = [
    {
      id: 'fld_fullname',
      type: 'text',
      label: 'Full Name',
      pageNumber: 1,
      position: { x: 15, y: 25 },
      dimensions: { width: 70, height: 4 },
      required: true,
    },
    {
      id: 'fld_date',
      type: 'date',
      label: 'Date of Birth',
      pageNumber: 1,
      position: { x: 15, y: 35 },
      dimensions: { width: 30, height: 4 },
      required: true,
    },
    {
      id: 'fld_signature',
      type: 'signature',
      label: 'Applicant Signature',
      pageNumber: 1,
      position: { x: 15, y: 75 },
      dimensions: { width: 40, height: 8 },
      required: true,
    },
  ];

  pdfFormData.forEach((pdf, index) => {
    const docRef = doc(pdfsCollection);
    const completePdfData: Omit<PDFForm, 'id'> = {
      ...pdf,
      status: index === 0 ? 'published' : 'draft',
      fields: pdf.name.includes('Enrollment') ? sampleFields : [],
      createdBy: 'system-seed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      passwordProtected: index === 1,
      password: index === 1 ? 'password' : '',
    };
    batch.set(docRef, completePdfData);
  });
  await batch.commit();
  return pdfFormData.length;
}


export async function seedModules(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'modules');
  const batch = writeBatch(firestore);
  const modulesCollection = collection(firestore, 'modules');
  defaultModules.forEach((moduleData) => {
    const docRef = doc(modulesCollection);
    batch.set(docRef, moduleData);
  });
  await batch.commit();
  return defaultModules.length;
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
    const schoolsCollection = collection(firestore, 'schools');
    const usersCollection = collection(firestore, 'users');
    
    await clearCollection(firestore, 'schools');
    const batch = writeBatch(firestore);

    const usersQuery = query(usersCollection, where('isAuthorized', '==', true));
    const usersSnapshot = await getDocs(usersQuery);
    const authorizedUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    
    const stagesQuery = query(collection(firestore, 'onboardingStages'), orderBy('order'));
    const stagesSnapshot = await getDocs(stagesQuery);
    const stages = stagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as OnboardingStage));
    
    const modulesSnapshot = await getDocs(query(collection(firestore, 'modules'), orderBy('order')));
    const allModules = modulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));

    baseSchoolData.forEach((schoolBase, index) => {
        const docRef = doc(schoolsCollection);
        const slug = schoolBase.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const schoolModulesForSchool: Module[] = [];
        if (allModules.length > 0) {
            const moduleCount = (index % 3) + 1;
            for (let i = 0; i < moduleCount; i++) {
                const moduleIndex = (index + i * 2) % allModules.length;
                if (!schoolModulesForSchool.find(m => m.id === allModules[moduleIndex].id)) {
                    schoolModulesForSchool.push(allModules[moduleIndex]);
                }
            }
        }
        
        const school: Omit<School, 'id'> = {
            ...schoolBase,
            slug,
            logoUrl: `https://logo.clearbit.com/${slug}.com`,
            heroImageUrl: `https://picsum.photos/seed/${slug}/1200/800`,
            stage: stages.length > 0 ? stages[index % stages.length] : undefined,
            assignedTo: authorizedUsers.length > 0 
                ? {
                    userId: authorizedUsers[index % authorizedUsers.length].id,
                    name: authorizedUsers[index % authorizedUsers.length].name,
                    email: authorizedUsers[index % authorizedUsers.length].email,
                  }
                : { userId: null, name: null, email: null },
            createdAt: subDays(new Date(), index * 3).toISOString(),
            implementationDate: addDays(new Date(), (index + 1) * 7).toISOString(),
            modules: schoolModulesForSchool.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, color: m.color })),
        };
        batch.set(docRef, school);
    });
    
    await batch.commit();
    return baseSchoolData.length;
}

export async function seedMeetings(firestore: Firestore): Promise<number> {
  const meetingsCollection = collection(firestore, 'meetings');
  await clearCollection(firestore, 'meetings');
  const batch = writeBatch(firestore);

  const schoolsSnapshot = await getDocs(collection(firestore, 'schools'));
  if (schoolsSnapshot.empty) return 0;
  
  let meetingsCount = 0;
  schoolsSnapshot.forEach((schoolDoc, index) => {
    const school = { id: schoolDoc.id, ...schoolDoc.data() } as School;
    
    MEETING_TYPES.forEach((type, typeIndex) => {
        const docRef = doc(meetingsCollection);
        const meetingDate = addDays(new Date(), (index * 2) + typeIndex);
        
        const meeting: Omit<Meeting, 'id'> = {
            schoolId: school.id,
            schoolName: school.name,
            schoolSlug: school.slug,
            type: type,
            meetingTime: meetingDate.toISOString(),
            meetingLink: `https://meet.google.com/${school.slug.substring(0,3)}-${type.slug.substring(0,3)}`,
            recordingUrl: type.id === 'parent' ? 'https://youtu.be/M6MUlDkfZOg' : '',
            brochureUrl: type.id === 'parent' ? 'https://smartsapp.com/downloads/brochure.pdf' : '',
        };
        batch.set(docRef, meeting);
        meetingsCount++;
    });
  });

  await batch.commit();
  return meetingsCount;
}

export async function seedSurveys(firestore: Firestore): Promise<number> {
  await clearCollection(firestore, 'surveys');
  const batch = writeBatch(firestore);
  const surveysCollection = collection(firestore, 'surveys');

  surveyData.forEach((survey) => {
    const docRef = doc(surveysCollection);
    const slug = survey.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    batch.set(docRef, {
      ...survey,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  
  await batch.commit();
  return surveyData.length;
}

export async function seedUserAvatars(firestore: Firestore): Promise<number> {
  const usersCollection = collection(firestore, 'users');
  const querySnapshot = await getDocs(usersCollection);
  const batch = writeBatch(firestore);
  let updatedCount = 0;

  querySnapshot.forEach((docSnap) => {
    const user = docSnap.data() as UserProfile;
    if (!user.photoURL) {
      const seed = user.name ? user.name.replace(/\s+/g, '-').toLowerCase() : docSnap.id;
      batch.update(docSnap.ref, { photoURL: `https://i.pravatar.cc/150?u=${seed}` });
      updatedCount++;
    }
  });

  if (updatedCount > 0) await batch.commit();
  return updatedCount;
}

export async function seedOnboardingStages(firestore: Firestore): Promise<{ stagesCreated: number, schoolsUpdated: number }> {
    const stagesCollection = collection(firestore, 'onboardingStages');
    const schoolsCollection = collection(firestore, 'schools');
    const batch = writeBatch(firestore);

    const oldStagesSnapshot = await getDocs(stagesCollection);
    oldStagesSnapshot.forEach((doc) => batch.delete(doc.ref));

    const newStagesMap = new Map<string, OnboardingStage>();
    defaultStages.forEach((stageData) => {
        const id = stageData.name.toLowerCase().replace(/\s+/g, '-');
        const docRef = doc(stagesCollection, id);
        batch.set(docRef, stageData);
        newStagesMap.set(id, { id, ...stageData });
    });
    
    const schoolsSnapshot = await getDocs(schoolsCollection);
    let schoolsUpdated = 0;
    const welcomeStage = newStagesMap.get('welcome');

    schoolsSnapshot.forEach(schoolDoc => {
        const school = schoolDoc.data() as School;
        const currentStageId = school.stage?.id;
        let newStageData = (currentStageId && newStagesMap.has(currentStageId)) ? newStagesMap.get(currentStageId) : welcomeStage;

        if (newStageData) {
            batch.update(schoolDoc.ref, { stage: { id: newStageData.id, name: newStageData.name, order: newStageData.order, color: newStageData.color } });
            schoolsUpdated++;
        }
    });
    
    await batch.commit();
    return { stagesCreated: defaultStages.length, schoolsUpdated };
}
