import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function writeAudit(
  userEmail: string,
  storeId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: object
) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      userEmail,
      storeId,
      action,
      entityType,
      entityId: entityId || null,
      details: JSON.stringify(details || {}),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit write failed:', e);
  }
}
