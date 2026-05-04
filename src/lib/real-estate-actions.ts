/**
 * Real Estate Industry Server Actions
 * 
 * Implements server actions for Real Estate-specific collections:
 * - Property Management (Requirements 7.7)
 * - Property Preference Management (Requirements 7.8)
 * - Viewing Management (Requirements 7.9)
 * - Offer Management (Requirements 7.10)
 * - Negotiation Management (Requirements 7.11)
 * - Deal Management (Requirements 7.12)
 * - Property Document Management (Requirements 7.13)
 * 
 * All actions validate workspace.industry === 'RealEstate' before writing.
 */

'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
} from 'firebase/firestore';
import { firestore as db } from '@/firebase/config';
import type {
  Property,
  PropertyPreference,
  Viewing,
  Offer,
  Negotiation,
  Deal,
  PropertyDeal,
  PropertyDocument,
  Workspace,
  Entity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a workspace is scoped to the RealEstate industry.
 * Throws an error if the workspace is not RealEstate.
 */
async function validateRealEstateWorkspace(workspaceId: string): Promise<Workspace> {
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);

  if (!workspaceSnap.exists()) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

  if (workspace.industry !== 'RealEstate') {
    throw new Error(
      `This action is only available for RealEstate workspaces. Current workspace industry: ${workspace.industry}`
    );
  }

  return workspace;
}

/**
 * Updates an entity's industry data to include a new collection reference ID.
 */
async function addCollectionReferenceToEntity(
  entityId: string,
  collectionField: 'propertyIds',
  referenceId: string
): Promise<void> {
  const entityRef = doc(db, 'entities', entityId);
  const entitySnap = await getDoc(entityRef);

  if (!entitySnap.exists()) {
    throw new Error(`Entity ${entityId} not found`);
  }

  const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

  // Initialize industryData if it doesn't exist
  const industryData = entity.industryData || {
    industry: 'RealEstate',
    entityType: 'institution',
    developerType: 'residential',
  };

  // Add the reference ID to the appropriate array
  const updatedIndustryData = {
    ...industryData,
    [collectionField]: arrayUnion(referenceId),
  };

  await updateDoc(entityRef, {
    industryData: updatedIndustryData,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Management (Requirement 7.7)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePropertyParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  propertyType: Property['propertyType'];
  address: string;
  price: number;
  status?: Property['status'];
  listedDate?: string; // ISO date string
}

/**
 * Creates a new property listing record for a Real Estate entity.
 * Updates the entity's propertyIds array.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createProperty(params: CreatePropertyParams): Promise<Property> {
  const {
    organizationId,
    workspaceId,
    entityId,
    propertyType,
    address,
    price,
    status = 'available',
    listedDate,
  } = params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const propertyData: Omit<Property, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    propertyType,
    address,
    price,
    status,
    listedDate: listedDate || now,
    createdAt: now,
    updatedAt: now,
  };

  const propertiesRef = collection(db, 'properties');
  const docRef = await addDoc(propertiesRef, propertyData);

  // Update entity's propertyIds array
  await addCollectionReferenceToEntity(entityId, 'propertyIds', docRef.id);

  return {
    id: docRef.id,
    ...propertyData,
  };
}

/**
 * Updates an existing property listing record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updateProperty(
  propertyId: string,
  updates: Partial<Omit<Property, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const propertyRef = doc(db, 'properties', propertyId);
  const propertySnap = await getDoc(propertyRef);

  if (!propertySnap.exists()) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const property = { id: propertySnap.id, ...propertySnap.data() } as Property;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(property.workspaceId);

  await updateDoc(propertyRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all properties for a specific entity.
 */
export async function getPropertiesForEntity(entityId: string, workspaceId: string): Promise<Property[]> {
  const propertiesRef = collection(db, 'properties');
  const q = query(
    propertiesRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('listedDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Property[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Preference Management (Requirement 7.8)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePropertyPreferenceParams {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  propertyType?: PropertyPreference['propertyType'];
  budgetRange?: { min: number; max: number };
  preferredLocations?: string[];
  bedrooms?: number;
  notes?: string;
}

/**
 * Creates a new property preference record for a buyer/tenant entity.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createPropertyPreference(params: CreatePropertyPreferenceParams): Promise<PropertyPreference> {
  const {
    organizationId,
    workspaceId,
    entityId,
    propertyType,
    budgetRange,
    preferredLocations,
    bedrooms,
    notes,
  } = params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const preferenceData: Omit<PropertyPreference, 'id'> = {
    organizationId,
    workspaceId,
    entityId,
    propertyType,
    budgetRange,
    preferredLocations,
    bedrooms,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const preferencesRef = collection(db, 'propertyPreferences');
  const docRef = await addDoc(preferencesRef, preferenceData);

  return {
    id: docRef.id,
    ...preferenceData,
  };
}

/**
 * Updates an existing property preference record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updatePropertyPreference(
  preferenceId: string,
  updates: Partial<Omit<PropertyPreference, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'entityId'>>
): Promise<void> {
  const preferenceRef = doc(db, 'propertyPreferences', preferenceId);
  const preferenceSnap = await getDoc(preferenceRef);

  if (!preferenceSnap.exists()) {
    throw new Error(`Property preference ${preferenceId} not found`);
  }

  const preference = { id: preferenceSnap.id, ...preferenceSnap.data() } as PropertyPreference;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(preference.workspaceId);

  await updateDoc(preferenceRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all property preferences for a specific entity.
 */
export async function getPropertyPreferencesForEntity(
  entityId: string,
  workspaceId: string
): Promise<PropertyPreference[]> {
  const preferencesRef = collection(db, 'propertyPreferences');
  const q = query(
    preferencesRef,
    where('workspaceId', '==', workspaceId),
    where('entityId', '==', entityId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PropertyPreference[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Viewing Management (Requirement 7.9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateViewingParams {
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  clientEntityId: string;
  viewingDate: string; // ISO date string
  status?: Viewing['status'];
  feedback?: string;
}

/**
 * Creates a new property viewing/site visit record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createViewing(params: CreateViewingParams): Promise<Viewing> {
  const { organizationId, workspaceId, propertyId, clientEntityId, viewingDate, status = 'scheduled', feedback } =
    params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const viewingData: Omit<Viewing, 'id'> = {
    organizationId,
    workspaceId,
    propertyId,
    clientEntityId,
    viewingDate,
    status,
    feedback,
    createdAt: now,
    updatedAt: now,
  };

  const viewingsRef = collection(db, 'viewings');
  const docRef = await addDoc(viewingsRef, viewingData);

  return {
    id: docRef.id,
    ...viewingData,
  };
}

/**
 * Updates the status of a viewing.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updateViewingStatus(viewingId: string, status: Viewing['status'], feedback?: string): Promise<void> {
  const viewingRef = doc(db, 'viewings', viewingId);
  const viewingSnap = await getDoc(viewingRef);

  if (!viewingSnap.exists()) {
    throw new Error(`Viewing ${viewingId} not found`);
  }

  const viewing = { id: viewingSnap.id, ...viewingSnap.data() } as Viewing;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(viewing.workspaceId);

  const updates: Partial<Viewing> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (feedback !== undefined) {
    updates.feedback = feedback;
  }

  await updateDoc(viewingRef, updates);
}

/**
 * Retrieves all viewings for a specific property.
 */
export async function getViewingsForProperty(propertyId: string, workspaceId: string): Promise<Viewing[]> {
  const viewingsRef = collection(db, 'viewings');
  const q = query(
    viewingsRef,
    where('workspaceId', '==', workspaceId),
    where('propertyId', '==', propertyId),
    orderBy('viewingDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Viewing[];
}

/**
 * Retrieves all viewings for a specific client entity.
 */
export async function getViewingsForClient(clientEntityId: string, workspaceId: string): Promise<Viewing[]> {
  const viewingsRef = collection(db, 'viewings');
  const q = query(
    viewingsRef,
    where('workspaceId', '==', workspaceId),
    where('clientEntityId', '==', clientEntityId),
    orderBy('viewingDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Viewing[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer Management (Requirement 7.10)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOfferParams {
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  buyerEntityId: string;
  offerAmount: number;
  status?: Offer['status'];
  submittedAt?: string; // ISO date string
}

/**
 * Creates a new offer record for a property.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createOffer(params: CreateOfferParams): Promise<Offer> {
  const { organizationId, workspaceId, propertyId, buyerEntityId, offerAmount, status = 'submitted', submittedAt } =
    params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const offerData: Omit<Offer, 'id'> = {
    organizationId,
    workspaceId,
    propertyId,
    buyerEntityId,
    offerAmount,
    status,
    submittedAt: submittedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const offersRef = collection(db, 'offers');
  const docRef = await addDoc(offersRef, offerData);

  return {
    id: docRef.id,
    ...offerData,
  };
}

/**
 * Updates the status of an offer.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updateOfferStatus(offerId: string, status: Offer['status']): Promise<void> {
  const offerRef = doc(db, 'offers', offerId);
  const offerSnap = await getDoc(offerRef);

  if (!offerSnap.exists()) {
    throw new Error(`Offer ${offerId} not found`);
  }

  const offer = { id: offerSnap.id, ...offerSnap.data() } as Offer;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(offer.workspaceId);

  await updateDoc(offerRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all offers for a specific property.
 */
export async function getOffersForProperty(propertyId: string, workspaceId: string): Promise<Offer[]> {
  const offersRef = collection(db, 'offers');
  const q = query(
    offersRef,
    where('workspaceId', '==', workspaceId),
    where('propertyId', '==', propertyId),
    orderBy('submittedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}

/**
 * Retrieves all offers made by a specific buyer entity.
 */
export async function getOffersForBuyer(buyerEntityId: string, workspaceId: string): Promise<Offer[]> {
  const offersRef = collection(db, 'offers');
  const q = query(
    offersRef,
    where('workspaceId', '==', workspaceId),
    where('buyerEntityId', '==', buyerEntityId),
    orderBy('submittedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Negotiation Management (Requirement 7.11)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateNegotiationParams {
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  offerId: string;
  buyerEntityId: string;
  sellerEntityId?: string;
  status?: Negotiation['status'];
  agreedPrice?: number;
  notes?: string;
}

/**
 * Creates a new negotiation record between buyer and seller.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createNegotiation(params: CreateNegotiationParams): Promise<Negotiation> {
  const {
    organizationId,
    workspaceId,
    propertyId,
    offerId,
    buyerEntityId,
    sellerEntityId,
    status = 'in_progress',
    agreedPrice,
    notes,
  } = params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const negotiationData: Omit<Negotiation, 'id'> = {
    organizationId,
    workspaceId,
    propertyId,
    offerId,
    buyerEntityId,
    sellerEntityId,
    status,
    agreedPrice,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const negotiationsRef = collection(db, 'negotiations');
  const docRef = await addDoc(negotiationsRef, negotiationData);

  return {
    id: docRef.id,
    ...negotiationData,
  };
}

/**
 * Updates an existing negotiation record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updateNegotiation(
  negotiationId: string,
  updates: Partial<Omit<Negotiation, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'propertyId' | 'offerId'>>
): Promise<void> {
  const negotiationRef = doc(db, 'negotiations', negotiationId);
  const negotiationSnap = await getDoc(negotiationRef);

  if (!negotiationSnap.exists()) {
    throw new Error(`Negotiation ${negotiationId} not found`);
  }

  const negotiation = { id: negotiationSnap.id, ...negotiationSnap.data() } as Negotiation;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(negotiation.workspaceId);

  await updateDoc(negotiationRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all negotiations for a specific property.
 */
export async function getNegotiationsForProperty(propertyId: string, workspaceId: string): Promise<Negotiation[]> {
  const negotiationsRef = collection(db, 'negotiations');
  const q = query(
    negotiationsRef,
    where('workspaceId', '==', workspaceId),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Negotiation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal Management (Requirement 7.12)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDealParams {
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  buyerEntityId: string;
  sellerEntityId?: string;
  dealValue: number;
  closingDate: string; // ISO date string
  status?: PropertyDeal['status'];
}

/**
 * Creates a new deal/transaction record for a property.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createDeal(params: CreateDealParams): Promise<PropertyDeal> {
  const {
    organizationId,
    workspaceId,
    propertyId,
    buyerEntityId,
    sellerEntityId,
    dealValue,
    closingDate,
    status = 'pending',
  } = params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const dealData: Omit<PropertyDeal, 'id'> = {
    organizationId,
    workspaceId,
    propertyId,
    buyerEntityId,
    sellerEntityId,
    dealValue,
    closingDate,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const dealsRef = collection(db, 'deals');
  const docRef = await addDoc(dealsRef, dealData);

  return {
    id: docRef.id,
    ...dealData,
  };
}

/**
 * Updates an existing deal record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updateDeal(
  dealId: string,
  updates: Partial<Omit<PropertyDeal, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'propertyId'>>
): Promise<void> {
  const dealRef = doc(db, 'deals', dealId);
  const dealSnap = await getDoc(dealRef);

  if (!dealSnap.exists()) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const deal = { id: dealSnap.id, ...dealSnap.data() } as Deal;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(deal.workspaceId);

  await updateDoc(dealRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all deals for a specific property.
 */
export async function getDealsForProperty(propertyId: string, workspaceId: string): Promise<Deal[]> {
  const dealsRef = collection(db, 'deals');
  const q = query(
    dealsRef,
    where('workspaceId', '==', workspaceId),
    where('propertyId', '==', propertyId),
    orderBy('closingDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Deal[];
}

/**
 * Retrieves all deals for a specific buyer entity.
 */
export async function getDealsForBuyer(buyerEntityId: string, workspaceId: string): Promise<Deal[]> {
  const dealsRef = collection(db, 'deals');
  const q = query(
    dealsRef,
    where('workspaceId', '==', workspaceId),
    where('buyerEntityId', '==', buyerEntityId),
    orderBy('closingDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Deal[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Document Management (Requirement 7.13)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePropertyDocumentParams {
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  entityId?: string;
  documentName: string;
  documentType: string;
  storageUrl: string;
  uploadedAt?: string; // ISO date string
}

/**
 * Creates a new property document record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function createPropertyDocument(params: CreatePropertyDocumentParams): Promise<PropertyDocument> {
  const {
    organizationId,
    workspaceId,
    propertyId,
    entityId,
    documentName,
    documentType,
    storageUrl,
    uploadedAt,
  } = params;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(workspaceId);

  const now = new Date().toISOString();

  const documentData: Omit<PropertyDocument, 'id'> = {
    organizationId,
    workspaceId,
    propertyId,
    entityId,
    documentName,
    documentType,
    storageUrl,
    uploadedAt: uploadedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  const documentsRef = collection(db, 'propertyDocuments');
  const docRef = await addDoc(documentsRef, documentData);

  return {
    id: docRef.id,
    ...documentData,
  };
}

/**
 * Updates an existing property document record.
 * 
 * @throws Error if workspace is not RealEstate industry
 */
export async function updatePropertyDocument(
  documentId: string,
  updates: Partial<Omit<PropertyDocument, 'id' | 'createdAt' | 'organizationId' | 'workspaceId' | 'propertyId'>>
): Promise<void> {
  const documentRef = doc(db, 'propertyDocuments', documentId);
  const documentSnap = await getDoc(documentRef);

  if (!documentSnap.exists()) {
    throw new Error(`Property document ${documentId} not found`);
  }

  const document = { id: documentSnap.id, ...documentSnap.data() } as PropertyDocument;

  // Validate workspace is RealEstate
  await validateRealEstateWorkspace(document.workspaceId);

  await updateDoc(documentRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves all documents for a specific property.
 */
export async function getPropertyDocuments(propertyId: string, workspaceId: string): Promise<PropertyDocument[]> {
  const documentsRef = collection(db, 'propertyDocuments');
  const q = query(
    documentsRef,
    where('workspaceId', '==', workspaceId),
    where('propertyId', '==', propertyId),
    orderBy('uploadedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PropertyDocument[];
}
