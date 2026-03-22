export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'pharmacist' | 'manager' | 'admin';
  storeId?: string;
  createdAt: string;
  isActive: boolean;
  phone?: string;
  designation?: string;
  alternateEmails?: string[];
  bio?: string;
  updatedAt?: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  hospitalName: string;
  contact: string;
  managerId: string;
  createdAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  unit: string;
  unitPrice: number;
  reorderThreshold: number;
  leadTimeDays: number;
  supplier: string;
  storeId: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  storeId: string;
  batchNumber: string;
  quantity: number;
  originalQuantity: number;
  expiryDate: string;
  purchasePrice: number;
  location: {
    aisle: string;
    row: string;
    shelf: string;
    compartment: string;
  };
  receivedAt: string;
  isDepleted: boolean;
  isDisposed: boolean;
  // Traceability — set when batch is created from a delivered purchase order
  sourcePurchaseOrderId?: string;
  sourceOrderId?: string;
}

export interface DispenseLog {
  id: string;
  storeId: string;
  medicineId: string;
  medicineName?: string;
  batchId?: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  patientRef: string;
  pharmacistId: string;
  pharmacistName: string;
  timestamp: string;
  billId?: string;
  fefoCompliant?: boolean;
  batchesUsed?: { batchId: string; batchNumber: string; quantity: number; location?: string }[];
}

/** One medicine line inside a cart-based purchase order */
export interface OrderLineItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  supplier: string;
  lineTotal: number;
}

export interface Order {
  id: string;
  storeId: string;
  storeName?: string;

  // Purchase Order grouping key — all cart lines share one PO id
  purchaseOrderId?: string;

  // Per-medicine fields (one Order doc = one medicine)
  medicineId?: string;
  medicineName?: string;

  quantity: number;
  unitPrice: number;
  totalValue: number;
  supplier: string;
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
  urgency: 'critical' | 'urgent' | 'routine';
  aiSuggested: boolean;
  orderedAt: string;
  deliveredAt?: string;
  expectedDelivery?: string;
  approvalStatus: 'auto' | 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  type?: 'requisition' | 'procurement';
  notes?: string | null;

  // Set true when batch was created in Firestore on delivery
  inventoryAdded?: boolean;
}

export interface Notification {
  id: string;
  userId?: string;
  storeId: string;
  type: string;
  title: string;
  message: string;
  urgency?: 'critical' | 'warning' | 'info';
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
  medicineId?: string;
  requestedBy?: string;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  storeId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details: string;
  timestamp: string;
}

export interface WasteRecord {
  id: string;
  storeId: string;
  medicineId: string;
  medicineName?: string;  // denormalised at write time
  batchId: string;
  batchNumber?: string;   // denormalised at write time
  quantity: number;
  wasteValue: number;
  reason: string;
  recordedAt: string;
  recordedBy?: string;
  recordedByName?: string;
}

export interface MLForecast {
  medicineId: string;
  avgDailyConsumption: number;
  daysOfStockRemaining: number;
  recommendedOrderQty: number;
  orderDeadlineDays: number;
  seasonalFactor: number;
  narrative: string;
}
