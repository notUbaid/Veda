import { addDoc, collection, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const QUEUE_KEY = 'veda_offline_queue';

interface QueueItem {
    id: string;
    type: 'add' | 'update';
    collectionStr: string;
    payload: any;
    docId?: string; // only for updates
    timestamp: number;
}

export const syncQueue = {
    pushAction(type: 'add' | 'update', collectionStr: string, payload: any, docId?: string) {
        if (navigator.onLine) {
            // Should execute immediately if online, but this acts as a fallback or wrapper
            return this.executeDirectly(type, collectionStr, payload, docId);
        }

        const queue: QueueItem[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue.push({
            id: crypto.randomUUID(),
            type,
            collectionStr,
            payload,
            docId,
            timestamp: Date.now()
        });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        
        // Notify user via toast or custom event if needed
        window.dispatchEvent(new CustomEvent('offline-action-queued'));
        return Promise.resolve({ queued: true });
    },

    async executeDirectly(type: 'add' | 'update', collectionStr: string, payload: any, docId?: string) {
        if (type === 'add') {
            return await addDoc(collection(db, collectionStr), payload);
        } else if (type === 'update' && docId) {
            return await updateDoc(doc(db, collectionStr, docId), payload);
        }
    },

    async processQueue() {
        if (!navigator.onLine) return;
        
        const queue: QueueItem[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} offline actions...`);
        const failed: QueueItem[] = [];

        for (const item of queue) {
            try {
                if (item.type === 'add') {
                    await addDoc(collection(db, item.collectionStr), item.payload);
                } else if (item.type === 'update' && item.docId) {
                    await updateDoc(doc(db, item.collectionStr, item.docId), item.payload);
                }
            } catch (e) {
                console.error("Failed to sync queued item", e);
                failed.push(item);
            }
        }

        localStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
        if (queue.length > failed.length) {
            window.dispatchEvent(new CustomEvent('offline-sync-complete', {
                detail: { processed: queue.length - failed.length }
            }));
        }
    }
};

// Start listening unconditionally
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        setTimeout(() => syncQueue.processQueue(), 2000); // 2s defer
    });
}
