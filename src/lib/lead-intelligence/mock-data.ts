import type { Prospect } from './types';

/**
 * Static industry-specific mock database for offline previews and double-fallback.
 */
export const MOCK_GHANA_PROSPECTS: Omit<Prospect, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Osei Tutu International Academy',
    domain: 'oseitutuacademy.edu.gh',
    address: '24 Mile 4, Kumasi, Ghana',
    phone: '+233 32 201 2345',
    rating: 4.6,
    reviewsCount: 38,
    claimed: true,
    industry: 'Education',
    location: { lat: 6.6906, lng: -1.6244 },
    contacts: [
      { 
        name: 'Kwame Mensah', 
        email: 'kmensah@oseitutuacademy.edu.gh', 
        role: 'Principal',
        confidence: 95,
        verificationStatus: 'verified'
      }
    ],
    scoring: {
      overallScore: 82,
      needScore: 20,
      digitalMaturity: 12,
      buyingIntent: 16,
      budgetProbability: 14,
      decisionMakerFound: 10,
      engagement: 10
    },
    syncStatus: 'unregistered'
  },
  {
    name: 'Accra Royal Grammar School',
    domain: 'accraroyalschool.edu.gh',
    address: '15 Ring Road Central, Accra, Ghana',
    phone: '+233 30 222 9876',
    rating: 4.2,
    reviewsCount: 54,
    claimed: false,
    industry: 'Education',
    location: { lat: 5.6037, lng: -0.1870 },
    contacts: [
      { 
        name: 'Ama Serwaa', 
        email: 'aserwaa@accraroyalschool.edu.gh', 
        role: 'Administrator',
        confidence: 90,
        verificationStatus: 'verified'
      }
    ],
    scoring: {
      overallScore: 74,
      needScore: 18,
      digitalMaturity: 10,
      buyingIntent: 15,
      budgetProbability: 12,
      decisionMakerFound: 9,
      engagement: 10
    },
    syncStatus: 'unregistered'
  },
  {
    name: 'Kumasi Ridge Hotel',
    domain: 'kumasiridgehotel.com',
    address: '7 Ridge Road, Kumasi, Ghana',
    phone: '+233 32 203 4455',
    rating: 3.9,
    reviewsCount: 22,
    claimed: true,
    industry: 'Hospitality',
    location: { lat: 6.6850, lng: -1.6190 },
    contacts: [
      { 
        name: 'Kofi Osei', 
        email: 'k.osei@kumasiridgehotel.com', 
        role: 'General Manager',
        confidence: 85,
        verificationStatus: 'verified'
      }
    ],
    scoring: {
      overallScore: 68,
      needScore: 15,
      digitalMaturity: 9,
      buyingIntent: 12,
      budgetProbability: 12,
      decisionMakerFound: 10,
      engagement: 10
    },
    syncStatus: 'unregistered'
  },
  {
    name: 'Accra Innovation Hub',
    domain: 'accrahub.io',
    address: 'Spintex Road, Accra, Ghana',
    phone: '+233 30 255 1122',
    rating: 4.8,
    reviewsCount: 112,
    claimed: true,
    industry: 'Technology',
    location: { lat: 5.6200, lng: -0.1500 },
    contacts: [
      { 
        name: 'Elorm Adzo', 
        email: 'elorm@accrahub.io', 
        role: 'Founder',
        confidence: 98,
        verificationStatus: 'verified'
      }
    ],
    scoring: {
      overallScore: 90,
      needScore: 24,
      digitalMaturity: 14,
      buyingIntent: 18,
      budgetProbability: 14,
      decisionMakerFound: 10,
      engagement: 10
    },
    syncStatus: 'unregistered'
  }
];
