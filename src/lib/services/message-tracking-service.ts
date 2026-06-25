import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  MessageTrackingRecord,
  MessageNodeStatistics,
  MessageStatus,
  MESSAGE_STATUS_WEIGHT,
  DeliveryState,
  MessageProvider
} from '../types/tracking';

export class MessageTrackingService {
  async createTrackingRecord(
    record: Omit<MessageTrackingRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MessageTrackingRecord> {
    const docRef = adminDb.collection('message_tracking').doc();
    const now = new Date().toISOString();
    const trackingRecord: MessageTrackingRecord = {
      ...record,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(trackingRecord);
    return trackingRecord;
  }

  async getTrackingRecord(id: string): Promise<MessageTrackingRecord | null> {
    const doc = await adminDb.collection('message_tracking').doc(id).get();
    return doc.exists ? (doc.data() as MessageTrackingRecord) : null;
  }

  async findByProviderMessageId(
    providerMessageId: string,
    provider: MessageProvider
  ): Promise<MessageTrackingRecord | null> {
    const snap = await adminDb
      .collection('message_tracking')
      .where('providerMessageId', '==', providerMessageId)
      .where('provider', '==', provider)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as MessageTrackingRecord;
  }

  async updateStateWithSequenceGuard(
    trackingId: string,
    newState: DeliveryState
  ): Promise<void> {
    const docRef = adminDb.collection('message_tracking').doc(trackingId);

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        throw new Error(`Tracking record not found: ${trackingId}`);
      }

      const current = doc.data() as MessageTrackingRecord;
      const currentWeight = MESSAGE_STATUS_WEIGHT[current.deliveryState.status] || 0;
      const newWeight = MESSAGE_STATUS_WEIGHT[newState.status] || 0;

      // Reject updates that downgrade delivery state progression
      if (newWeight <= currentWeight) {
        console.log(`[SEQUENCE_GUARD] Ignored state update for ${trackingId}. Current: ${current.deliveryState.status}, Proposed: ${newState.status}`);
        return;
      }

      transaction.update(docRef, {
        deliveryState: newState,
        updatedAt: new Date().toISOString(),
      });

      // Perform statistics aggregation updates atomically
      await this.adjustNodeStatisticsInTransaction(transaction, current, newState);
    });
  }

  private async adjustNodeStatisticsInTransaction(
    transaction: FirebaseFirestore.Transaction,
    current: MessageTrackingRecord,
    newState: DeliveryState
  ): Promise<void> {
    const statsId = `${current.automationId}_${current.nodeId}`;
    const statsRef = adminDb.collection('message_node_stats').doc(statsId);
    const statsSnap = await transaction.get(statsRef);

    const increments: Record<string, FirebaseFirestore.FieldValue> = {};
    
    // Define increment helpers
    const getIncrementField = (status: MessageStatus): string | null => {
      switch (status) {
        case MessageStatus.Delivered: return 'totalDelivered';
        case MessageStatus.Opened: return 'totalOpened';
        case MessageStatus.Clicked: return 'totalClicked';
        case MessageStatus.Bounced: return 'totalBounced';
        case MessageStatus.Suppressed: return 'totalSuppressed';
        default: return null;
      }
    };

    const oldField = getIncrementField(current.deliveryState.status);
    const newField = getIncrementField(newState.status);

    if (oldField) {
      increments[oldField] = FieldValue.increment(-1);
    }
    if (newField) {
      increments[newField] = FieldValue.increment(1);
    }

    if (Object.keys(increments).length === 0) return;

    if (!statsSnap.exists) {
      const initialStats: MessageNodeStatistics = {
        id: statsId,
        automationId: current.automationId,
        nodeId: current.nodeId,
        workspaceId: current.workspaceId,
        organizationId: current.organizationId,
        totalSent: 1,
        totalDelivered: newState.status === MessageStatus.Delivered ? 1 : 0,
        totalOpened: newState.status === MessageStatus.Opened ? 1 : 0,
        totalClicked: newState.status === MessageStatus.Clicked ? 1 : 0,
        totalBounced: newState.status === MessageStatus.Bounced ? 1 : 0,
        totalComplaints: 0,
        totalSuppressed: newState.status === MessageStatus.Suppressed ? 1 : 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        lastUpdatedAt: new Date().toISOString(),
      };
      transaction.set(statsRef, initialStats);
    } else {
      transaction.update(statsRef, {
        ...increments,
        lastUpdatedAt: new Date().toISOString(),
      });
    }
  }
}

export const messageTrackingService = new MessageTrackingService();
