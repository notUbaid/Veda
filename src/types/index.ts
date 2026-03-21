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

export interface Order {
  id: string;
  storeId: string;
  medicineId: string;
  medicineName?: string;           // written at creation for offline display
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
  batchId: string;
  quantity: number;
  wasteValue: number;
  reason: string;
  recordedAt: string;
  recordedBy?: string;
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
