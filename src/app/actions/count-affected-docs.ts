import { firestore } from '../../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { 
  NEW_DOCUMENT_CTA_PRETEXT, 
  NEW_DOCUMENT_CTA_TEXT, 
  OLD_DOCUMENT_CTA_TEXT, 
  OLD_DOCUMENT_CTA_PRETEXT_KEYWORD 
} from '../../lib/media/document-cta-backfill-service';

async function countDocs() {
  console.log('Inspecting Firestore media_shares collection...');
  const sharesRef = collection(firestore, 'media_shares');
  const sharesSnap = await getDocs(sharesRef);
  
  let totalShares = sharesSnap.docs.length;
  let documentShares = 0;
  let matchingCtaText = 0;
  let matchingCtaPretext = 0;
  let totalAffected = 0;

  const oct18Timestamp = new Date('2025-10-18T00:00:00Z').getTime();

  sharesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const assetUrl = (data.assetUrl || data.url || '') as string;
    const assetType = (data.assetType || data.type || '') as string;
    const ctaText = (data.ctaText || '') as string;
    const ctaPretext = (data.ctaPretext || '') as string;
    const createdAt = data.createdAt 
      ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).getTime() 
      : 0;

    const isDocumentAsset = assetType === 'document' ||
      assetUrl.toLowerCase().includes('.pdf') ||
      assetUrl.toLowerCase().includes('.doc') ||
      assetUrl.toLowerCase().includes('.ppt');

    const matchesOldPretext = ctaPretext.includes(OLD_DOCUMENT_CTA_PRETEXT_KEYWORD) || ctaPretext.includes('SmartSapp Online Visibility Program');
    const matchesOldCtaText = ctaText === OLD_DOCUMENT_CTA_TEXT || ctaText.toLowerCase().includes('make my school visible');
    const uploadedAfterOct18 = createdAt >= oct18Timestamp || createdAt === 0;

    if (isDocumentAsset) {
      documentShares++;
    }
    if (ctaText === NEW_DOCUMENT_CTA_TEXT || matchesOldCtaText) {
      matchingCtaText++;
    }
    if (ctaPretext === NEW_DOCUMENT_CTA_PRETEXT || matchesOldPretext) {
      matchingCtaPretext++;
    }

    if ((isDocumentAsset || matchesOldPretext || matchesOldCtaText) && (uploadedAfterOct18 || matchesOldPretext || matchesOldCtaText)) {
      totalAffected++;
    }
  });

  console.log('==================================================');
  console.log(`TOTAL MEDIA SHARES IN FIRESTORE: ${totalShares}`);
  console.log(`DOCUMENT MEDIA SHARES: ${documentShares}`);
  console.log(`TOTAL AFFECTED DOCUMENT RECORDS (Oct 18th to date): ${totalAffected}`);
  console.log(`DOCUMENT SHARES WITH "Book Meeting Now" CTA: ${matchingCtaText}`);
  console.log(`DOCUMENT SHARES WITH UPDATED PRETEXT: ${matchingCtaPretext}`);
  console.log('==================================================');
}

countDocs().catch((err) => {
  console.error('Error counting documents:', err);
  process.exit(1);
});
