/**
 * VEDA — Firebase Seed Script
 * Run: npm run seed
 *
 * Creates:
 *  - 9 Firebase Auth accounts
 *  - 6 stores: 3 under Manager 1, 3 under Manager 2
 *  - Each pharmacist assigned to ONE store (3 pharmacists per manager)
 *  - Full medicines, batches, dispense logs, orders, notifications, waste, audit per store
 */

import { initializeApp, cert }  from 'firebase-admin/app';
import { getAuth }               from 'firebase-admin/auth';
import { getFirestore }          from 'firebase-admin/firestore';
import { createRequire }         from 'module';
import * as fs                   from 'fs';
import * as path                 from 'path';
import * as dotenv               from 'dotenv';
dotenv.config();

const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID!;
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID!;
const PASSWORD    = 'Veda@2026';

if (!PROJECT_ID || !DATABASE_ID) {
  console.error('Missing FIREBASE_PROJECT_ID or FIREBASE_DATABASE_ID in .env');
  process.exit(1);
}

const KEY_PATHS = [
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(process.cwd(), 'service-account.json'),
  path.resolve(process.cwd(), 'firebase-service-account.json'),
];
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || KEY_PATHS.find(p => fs.existsSync(p)) || null;
if (!keyPath) {
  console.error('\nserviceAccountKey.json not found. Get it from Firebase Console -> Service Accounts.\n');
  process.exit(1);
}
console.log(`Using credentials: ${path.basename(keyPath)}`);
const _require      = createRequire(import.meta.url);
const serviceAccount = _require(keyPath);
if (serviceAccount.private_key)
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

const app       = initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
const adminAuth = getAuth(app);
const adminDb   = getFirestore(app);
adminDb.settings({ databaseId: DATABASE_ID });

// ── Helpers ───────────────────────────────────────────────────────────────
const now         = new Date();
const dF  = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
const dA  = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const rnd = (n: number) => Math.floor(Math.random() * n);

async function ensureUser(email: string): Promise<string> {
  try {
    const u = await adminAuth.createUser({ email, password: PASSWORD, emailVerified: true });
    return u.uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      const u = await adminAuth.getUserByEmail(email);
      await adminAuth.updateUser(u.uid, { password: PASSWORD, emailVerified: true });
      return u.uid;
    }
    throw e;
  }
}

async function clearAll() {
  const cols = ['users','stores','medicines','batches','dispense_logs','orders','notifications','waste_records','audit_logs'];
  for (const c of cols) {
    let n = 0;
    while (true) {
      const snap = await adminDb.collection(c).limit(400).get();
      if (snap.empty) break;
      const b = adminDb.batch();
      snap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      n += snap.docs.length;
    }
    if (n) console.log(`   cleared ${n} docs from ${c}`);
  }
}

// ── Master data ───────────────────────────────────────────────────────────
const MEDICINES = [
  { name: 'Paracetamol 500mg',  genericName: 'Acetaminophen',          category: 'Analgesic',        unit: 'Tablets',  unitPrice: 2.5,   reorderThreshold: 500, leadTimeDays: 3, supplier: 'Sun Pharma'  },
  { name: 'Amoxicillin 500mg',  genericName: 'Amoxicillin',            category: 'Antibiotic',       unit: 'Capsules', unitPrice: 12.0,  reorderThreshold: 200, leadTimeDays: 5, supplier: 'Cipla'        },
  { name: 'Insulin Glargine',   genericName: 'Insulin',                category: 'Antidiabetic',     unit: 'Vials',    unitPrice: 450.0, reorderThreshold: 30,  leadTimeDays: 7, supplier: 'Sanofi'       },
  { name: 'Metformin 500mg',    genericName: 'Metformin HCl',          category: 'Antidiabetic',     unit: 'Tablets',  unitPrice: 5.0,   reorderThreshold: 300, leadTimeDays: 4, supplier: 'USV'          },
  { name: 'Azithromycin 500mg', genericName: 'Azithromycin',           category: 'Antibiotic',       unit: 'Tablets',  unitPrice: 25.0,  reorderThreshold: 150, leadTimeDays: 5, supplier: 'Cipla'        },
  { name: 'ORS Sachets',        genericName: 'Oral Rehydration Salts', category: 'Antidiarrheal',    unit: 'Sachets',  unitPrice: 8.0,   reorderThreshold: 400, leadTimeDays: 3, supplier: 'Electral'     },
  { name: 'Atorvastatin 10mg',  genericName: 'Atorvastatin',           category: 'Cardiac',          unit: 'Tablets',  unitPrice: 18.0,  reorderThreshold: 200, leadTimeDays: 5, supplier: 'Ranbaxy'      },
  { name: 'Omeprazole 20mg',    genericName: 'Omeprazole',             category: 'Antacid',          unit: 'Capsules', unitPrice: 6.5,   reorderThreshold: 250, leadTimeDays: 4, supplier: "Dr. Reddy's"  },
  { name: 'Salbutamol Inhaler', genericName: 'Salbutamol',             category: 'Bronchodilator',   unit: 'Inhalers', unitPrice: 120.0, reorderThreshold: 50,  leadTimeDays: 6, supplier: 'GSK'          },
  { name: 'Fluconazole 150mg',  genericName: 'Fluconazole',            category: 'Antifungal',       unit: 'Tablets',  unitPrice: 22.0,  reorderThreshold: 100, leadTimeDays: 5, supplier: 'Pfizer'       },
  { name: 'Amlodipine 5mg',     genericName: 'Amlodipine Besylate',    category: 'Antihypertensive', unit: 'Tablets',  unitPrice: 7.0,   reorderThreshold: 300, leadTimeDays: 4, supplier: 'Sun Pharma'   },
  { name: 'Cetirizine 10mg',    genericName: 'Cetirizine HCl',         category: 'Antihistamine',    unit: 'Tablets',  unitPrice: 4.0,   reorderThreshold: 200, leadTimeDays: 3, supplier: 'Alkem'        },
  { name: 'Pantoprazole 40mg',  genericName: 'Pantoprazole',           category: 'Antacid',          unit: 'Tablets',  unitPrice: 9.0,   reorderThreshold: 200, leadTimeDays: 4, supplier: 'Zydus'        },
  { name: 'Vitamin C 500mg',    genericName: 'Ascorbic Acid',          category: 'Supplement',       unit: 'Tablets',  unitPrice: 3.0,   reorderThreshold: 300, leadTimeDays: 3, supplier: 'Himalaya'     },
  { name: 'Cough Syrup 100ml',  genericName: 'Dextromethorphan',       category: 'Respiratory',      unit: 'Bottles',  unitPrice: 65.0,  reorderThreshold: 80,  leadTimeDays: 5, supplier: 'Benadryl'     },
];

function batches(pfx: string) {
  return [
    { mi:0,  bn:`B-PAR-${pfx}01`, qty:250,  exp:dF(6),   pp:2.0,   loc:{aisle:'A',row:'1',shelf:'1',compartment:'1'} },
    { mi:0,  bn:`B-PAR-${pfx}02`, qty:800,  exp:dF(45),  pp:2.0,   loc:{aisle:'A',row:'1',shelf:'1',compartment:'2'} },
    { mi:0,  bn:`B-PAR-${pfx}03`, qty:1200, exp:dF(180), pp:1.9,   loc:{aisle:'A',row:'1',shelf:'1',compartment:'3'} },
    { mi:1,  bn:`B-AMX-${pfx}01`, qty:80,   exp:dF(12),  pp:10.0,  loc:{aisle:'A',row:'2',shelf:'1',compartment:'1'} },
    { mi:1,  bn:`B-AMX-${pfx}02`, qty:120,  exp:dF(90),  pp:10.0,  loc:{aisle:'A',row:'2',shelf:'1',compartment:'2'} },
    { mi:2,  bn:`B-INS-${pfx}01`, qty:15,   exp:dF(25),  pp:380.0, loc:{aisle:'B',row:'1',shelf:'1',compartment:'1'} },
    { mi:2,  bn:`B-INS-${pfx}02`, qty:40,   exp:dF(120), pp:370.0, loc:{aisle:'B',row:'1',shelf:'1',compartment:'2'} },
    { mi:3,  bn:`B-MET-${pfx}01`, qty:600,  exp:dF(200), pp:4.0,   loc:{aisle:'A',row:'2',shelf:'2',compartment:'1'} },
    { mi:4,  bn:`B-AZI-${pfx}01`, qty:300,  exp:dF(150), pp:20.0,  loc:{aisle:'A',row:'3',shelf:'1',compartment:'1'} },
    { mi:5,  bn:`B-ORS-${pfx}01`, qty:180,  exp:dF(30),  pp:6.5,   loc:{aisle:'C',row:'1',shelf:'1',compartment:'1'} },
    { mi:5,  bn:`B-ORS-${pfx}02`, qty:350,  exp:dF(150), pp:6.0,   loc:{aisle:'C',row:'1',shelf:'1',compartment:'2'} },
    { mi:6,  bn:`B-ATV-${pfx}01`, qty:400,  exp:dF(300), pp:15.0,  loc:{aisle:'A',row:'3',shelf:'2',compartment:'1'} },
    { mi:7,  bn:`B-OMP-${pfx}01`, qty:300,  exp:dF(180), pp:5.0,   loc:{aisle:'A',row:'3',shelf:'3',compartment:'1'} },
    { mi:8,  bn:`B-SAL-${pfx}01`, qty:20,   exp:dF(365), pp:100.0, loc:{aisle:'B',row:'2',shelf:'1',compartment:'1'} },
    { mi:9,  bn:`B-FLU-${pfx}01`, qty:150,  exp:dF(240), pp:18.0,  loc:{aisle:'A',row:'4',shelf:'1',compartment:'1'} },
    { mi:10, bn:`B-AML-${pfx}01`, qty:500,  exp:dF(365), pp:5.5,   loc:{aisle:'A',row:'4',shelf:'2',compartment:'1'} },
    { mi:11, bn:`B-CET-${pfx}01`, qty:250,  exp:dF(270), pp:3.0,   loc:{aisle:'A',row:'5',shelf:'1',compartment:'1'} },
    { mi:12, bn:`B-PAN-${pfx}01`, qty:320,  exp:dF(210), pp:7.0,   loc:{aisle:'A',row:'5',shelf:'2',compartment:'1'} },
    { mi:13, bn:`B-VTC-${pfx}01`, qty:100,  exp:dF(5),   pp:2.5,   loc:{aisle:'C',row:'2',shelf:'1',compartment:'1'} },
    { mi:13, bn:`B-VTC-${pfx}02`, qty:400,  exp:dF(180), pp:2.2,   loc:{aisle:'C',row:'2',shelf:'1',compartment:'2'} },
    { mi:14, bn:`B-CGH-${pfx}01`, qty:90,   exp:dF(120), pp:55.0,  loc:{aisle:'B',row:'3',shelf:'1',compartment:'1'} },
  ];
}

// ── Seed function ─────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Veda Seed — 6 stores (3 per manager)\n');

  console.log('🧹  Clearing existing data...');
  await clearAll();

  // 1. Auth
  console.log('\n1. Firebase Auth accounts...');
  const EMAILS = [
    'ubaid@admin.com','ubaid1@manager.com','ubaid2@manager.com',
    'ubaid1@gmail.com','ubaid2@gmail.com','ubaid3@gmail.com',
    'ubaid4@gmail.com','ubaid5@gmail.com','ubaid6@gmail.com',
  ];
  const uids: Record<string,string> = {};
  for (const email of EMAILS) {
    uids[email] = await ensureUser(email);
    console.log(`   ${email} → ${uids[email].slice(0,8)}...`);
  }
  const adminUid = uids['ubaid@admin.com'];
  const mgr1Uid  = uids['ubaid1@manager.com'];
  const mgr2Uid  = uids['ubaid2@manager.com'];
  const ph = [
    { uid: uids['ubaid1@gmail.com'], name: 'Ubaid Pharmacist 1', email: 'ubaid1@gmail.com' },
    { uid: uids['ubaid2@gmail.com'], name: 'Ubaid Pharmacist 2', email: 'ubaid2@gmail.com' },
    { uid: uids['ubaid3@gmail.com'], name: 'Ubaid Pharmacist 3', email: 'ubaid3@gmail.com' },
    { uid: uids['ubaid4@gmail.com'], name: 'Ubaid Pharmacist 4', email: 'ubaid4@gmail.com' },
    { uid: uids['ubaid5@gmail.com'], name: 'Ubaid Pharmacist 5', email: 'ubaid5@gmail.com' },
    { uid: uids['ubaid6@gmail.com'], name: 'Ubaid Pharmacist 6', email: 'ubaid6@gmail.com' },
  ];

  // 2. Stores — 3 under Manager 1, 3 under Manager 2
  console.log('\n2. Stores (6 total)...');
  const STORE_DEFS = [
    // Manager 1
    { name: 'Central Pharmacy — Block A',  location: 'Block A, Ground Floor, East Wing',  hospital: 'GGH Gandhinagar', contact: '079-23456789', mgrUid: mgr1Uid, pfx: 'A1', pharmaIdx: 0 },
    { name: 'IPD Pharmacy — Block A',      location: 'Block A, Second Floor, North Wing', hospital: 'GGH Gandhinagar', contact: '079-23456791', mgrUid: mgr1Uid, pfx: 'A2', pharmaIdx: 1 },
    { name: 'Emergency Pharmacy — A-Wing', location: 'Block A, Ground Floor, ICU Wing',   hospital: 'GGH Gandhinagar', contact: '079-23456792', mgrUid: mgr1Uid, pfx: 'A3', pharmaIdx: 2 },
    // Manager 2
    { name: 'OPD Pharmacy — Block B',      location: 'Block B, First Floor, West Wing',   hospital: 'GGH Gandhinagar', contact: '079-23456790', mgrUid: mgr2Uid, pfx: 'B1', pharmaIdx: 3 },
    { name: 'Paediatric Pharmacy — B-Wing',location: 'Block B, Ground Floor, Paed Wing',  hospital: 'GGH Gandhinagar', contact: '079-23456793', mgrUid: mgr2Uid, pfx: 'B2', pharmaIdx: 4 },
    { name: 'Surgery Pharmacy — Block C',  location: 'Block C, Third Floor, OT Complex',  hospital: 'GGH Gandhinagar', contact: '079-23456794', mgrUid: mgr2Uid, pfx: 'B3', pharmaIdx: 5 },
  ];

  const stores: Array<{ id: string; name: string; mgrUid: string; pfx: string; pharmaIdx: number }> = [];
  for (const sd of STORE_DEFS) {
    const ref = adminDb.collection('stores').doc();
    await ref.set({
      name: sd.name, location: sd.location, hospitalName: sd.hospital,
      contact: sd.contact, managerId: sd.mgrUid,
      createdAt: dA(rnd(30) + 60),
    });
    stores.push({ id: ref.id, name: sd.name, mgrUid: sd.mgrUid, pfx: sd.pfx, pharmaIdx: sd.pharmaIdx });
    console.log(`   [${sd.pfx}] ${sd.name}`);
  }

  // 3. User profiles
  console.log('\n3. User profiles...');
  const pb = adminDb.batch();

  // Admin
  pb.set(adminDb.collection('users').doc(adminUid), {
    uid: adminUid, email: 'ubaid@admin.com', name: 'Ubaid Khan (Admin)',
    role: 'admin', isActive: true, createdAt: dA(120),
  });

  // Managers — storeId = their FIRST store (primary)
  const mgr1Stores = stores.filter(s => s.mgrUid === mgr1Uid);
  const mgr2Stores = stores.filter(s => s.mgrUid === mgr2Uid);

  pb.set(adminDb.collection('users').doc(mgr1Uid), {
    uid: mgr1Uid, email: 'ubaid1@manager.com', name: 'Ubaid Manager One',
    role: 'manager', storeId: mgr1Stores[0].id, isActive: true, createdAt: dA(90),
  });
  pb.set(adminDb.collection('users').doc(mgr2Uid), {
    uid: mgr2Uid, email: 'ubaid2@manager.com', name: 'Ubaid Manager Two',
    role: 'manager', storeId: mgr2Stores[0].id, isActive: true, createdAt: dA(60),
  });

  // Each pharmacist assigned to ONE specific store
  for (let i = 0; i < 6; i++) {
    const p = ph[i];
    const assignedStore = stores[i]; // stores[0..2] = mgr1 stores, stores[3..5] = mgr2 stores
    pb.set(adminDb.collection('users').doc(p.uid), {
      uid: p.uid, email: p.email, name: p.name,
      role: 'pharmacist', storeId: assignedStore.id, isActive: true, createdAt: dA(rnd(40) + 30),
    });
  }
  await pb.commit();
  console.log(`   9 profiles written`);

  // 4. Medicines + Batches per store
  console.log('\n4. Medicines & batches per store...');
  const storeMedIds: Record<string, string[]> = {};
  const storeBatIds: Record<string, Record<number, string[]>> = {};

  for (const store of stores) {
    const medIds: string[] = [];
    const batchMap: Record<number, string[]> = {};

    // Batch-write medicines
    const mb = adminDb.batch();
    for (const med of MEDICINES) {
      const ref = adminDb.collection('medicines').doc();
      mb.set(ref, { ...med, storeId: store.id, isActive: true, createdAt: dA(rnd(20) + 40) });
      medIds.push(ref.id);
    }
    await mb.commit();

    // Batch-write batches
    const bb = adminDb.batch();
    for (const b of batches(store.pfx)) {
      const ref = adminDb.collection('batches').doc();
      bb.set(ref, {
        medicineId: medIds[b.mi], storeId: store.id,
        batchNumber: b.bn, quantity: b.qty, originalQuantity: b.qty,
        expiryDate: b.exp, purchasePrice: b.pp, location: b.loc,
        receivedAt: dA(rnd(20) + 3), isDepleted: false, isDisposed: false,
      });
      (batchMap[b.mi] ??= []).push(ref.id);
    }
    await bb.commit();

    storeMedIds[store.id] = medIds;
    storeBatIds[store.id] = batchMap;
    console.log(`   [${store.pfx}] ${MEDICINES.length} meds, ${batches(store.pfx).length} batches`);
  }

  // 5. Dispense logs — ~25 per store over 30 days
  console.log('\n5. Dispense logs...');
  const patientRefs = ['OPD-10012','OPD-10013','OPD-10014','IPD-2201','IPD-2202','IPD-2203','WALK-001'];
  const dispMedIndexes = [0,1,3,5,6,7,10,11,12,14];
  let totalLogs = 0;

  for (const store of stores) {
    const assignedPharma = ph[store.pharmaIdx];
    const medIds = storeMedIds[store.id];
    const batMap = storeBatIds[store.id];
    let lb = adminDb.batch(), lc = 0;

    for (let day = 29; day >= 0; day--) {
      const dispenses = rnd(3) + 1;
      for (let j = 0; j < dispenses; j++) {
        const mi = dispMedIndexes[rnd(dispMedIndexes.length)];
        const qty = rnd(20) + 3;
        const med = MEDICINES[mi];
        lb.set(adminDb.collection('dispense_logs').doc(), {
          medicineId: medIds[mi], medicineName: med.name,
          storeId: store.id,
          pharmacistId: assignedPharma.uid, pharmacistName: assignedPharma.name,
          quantity: qty, unitPrice: med.unitPrice, totalValue: qty * med.unitPrice,
          patientRef: patientRefs[rnd(patientRefs.length)],
          batchesUsed: [{ batchId: batMap[mi]?.[0] ?? '', batchNumber: `B-${store.pfx}`, quantity: qty }],
          fefoCompliant: true,
          billId: `BILL-${store.pfx}-${day}-${j}`,
          timestamp: dA(day),
        });
        if (++lc >= 400) { await lb.commit(); lb = adminDb.batch(); lc = 0; }
        totalLogs++;
      }
    }
    if (lc > 0) await lb.commit();
  }
  console.log(`   ${totalLogs} total dispense logs`);

  // 6. Orders — 2–3 per store
  console.log('\n6. Orders...');
  const orderTemplates = [
    { mi:1,  qty:500,  status:'delivered',  urgency:'urgent',   ai:true,  dA_:20, dD:5,  ap:'auto'    },
    { mi:2,  qty:100,  status:'dispatched', urgency:'critical', ai:true,  dA_:3,  dD:7,  ap:'auto'    },
    { mi:5,  qty:800,  status:'confirmed',  urgency:'routine',  ai:false, dA_:5,  dD:4,  ap:'auto'    },
    { mi:8,  qty:60,   status:'pending',    urgency:'urgent',   ai:true,  dA_:1,  dD:6,  ap:'pending' },
    { mi:0,  qty:2000, status:'delivered',  urgency:'routine',  ai:false, dA_:15, dD:3,  ap:'auto'    },
    { mi:4,  qty:300,  status:'confirmed',  urgency:'urgent',   ai:true,  dA_:4,  dD:5,  ap:'auto'    },
  ];
  let ob = adminDb.batch(), oc = 0;
  for (const store of stores) {
    const medIds = storeMedIds[store.id];
    // Pick 2–3 order templates per store
    const picks = orderTemplates.slice(rnd(2), rnd(2) + 3);
    for (const o of picks) {
      const med = MEDICINES[o.mi];
      const tv = o.qty * med.unitPrice;
      ob.set(adminDb.collection('orders').doc(), {
        storeId: store.id, medicineId: medIds[o.mi], medicineName: med.name,
        quantity: o.qty, unitPrice: med.unitPrice, totalValue: tv,
        supplier: med.supplier, urgency: o.urgency, status: o.status,
        aiSuggested: o.ai, orderedAt: dA(o.dA_),
        expectedDelivery: dF(o.dD - o.dA_),
        approvalStatus: tv > 50000 ? 'pending' : o.ap,
        notes: o.ai ? 'AI-recommended' : '',
        ...(o.status === 'delivered' ? { deliveredAt: dA(1) } : {}),
      });
      if (++oc >= 400) { await ob.commit(); ob = adminDb.batch(); oc = 0; }
    }
  }
  if (oc > 0) await ob.commit();
  console.log(`   ~${oc} orders across 6 stores`);

  // 7. Notifications — critical alerts per store
  console.log('\n7. Notifications...');
  let notifBatch = adminDb.batch(), nc = 0;
  for (const store of stores) {
    const notifs = [
      { type:'expiry',           title:`Critical Expiry: Paracetamol B-PAR-${store.pfx}01`, message:`Batch B-PAR-${store.pfx}01 expires in 6 days. Loc: A/1/1/1. Qty: 250. Dispense first (FEFO).`, urgency:'critical', isRead:false },
      { type:'expiry',           title:`Expiry Warning: Vitamin C B-VTC-${store.pfx}01`,    message:`Batch B-VTC-${store.pfx}01 expires in 5 days. Loc: C/2/1/1. Qty: 100.`,                         urgency:'critical', isRead:false },
      { type:'low_stock',        title:'Low Stock: Insulin Glargine',                        message:'Only 55 vials remaining. Reorder threshold: 30.',                                               urgency:'warning',  isRead:false },
      { type:'low_stock',        title:'Stockout Risk: Salbutamol Inhaler',                  message:'Only 20 inhalers remaining. Below threshold of 50.',                                            urgency:'warning',  isRead:true  },
      { type:'reorder_reminder', title:'Reorder Reminder: Amoxicillin 500mg',                message:`Pharmacist requests reorder for ${store.name}. Stock below threshold.`,                        urgency:'warning',  isRead:false },
      { type:'order_update',     title:'Order Delivered',                                    message:'Latest order has been delivered. Please receive stock and update batch records.',               urgency:'info',     isRead:true  },
    ];
    for (const n of notifs) {
      notifBatch.set(adminDb.collection('notifications').doc(), {
        storeId: store.id, type: n.type, title: n.title, message: n.message,
        urgency: n.urgency, isRead: n.isRead, createdAt: dA(rnd(3)),
      });
      if (++nc >= 400) { await notifBatch.commit(); notifBatch = adminDb.batch(); nc = 0; }
    }
  }
  if (nc > 0) await notifBatch.commit();
  console.log(`   ${nc} notifications across 6 stores`);

  // 8. Waste records
  console.log('\n8. Waste records...');
  let wb = adminDb.batch(), wc = 0;
  for (const store of stores) {
    const mgrUid = store.mgrUid;
    const medIds = storeMedIds[store.id];
    const batMap = storeBatIds[store.id];
    for (const [mi, qty, reason] of [[13,50,'expired'],[0,100,'damaged']] as [number,number,string][]) {
      wb.set(adminDb.collection('waste_records').doc(), {
        storeId: store.id, medicineId: medIds[mi],
        batchId: batMap[mi]?.[0] ?? 'unknown',
        quantity: qty, wasteValue: qty * MEDICINES[mi].unitPrice,
        reason, recordedAt: dA(rnd(15) + 5), recordedBy: mgrUid,
      });
      if (++wc >= 400) { await wb.commit(); wb = adminDb.batch(); wc = 0; }
    }
  }
  if (wc > 0) await wb.commit();
  console.log(`   ${wc} waste records`);

  // 9. Audit logs
  console.log('\n9. Audit logs...');
  const auditEntries = [
    { email:'ubaid@admin.com',    sId:'', action:'CREATE_STORE',  et:'store',    d:'{"count":6}',                              dA_:60 },
    { email:'ubaid@admin.com',    sId:'', action:'CREATE_USER',   et:'user',     d:'{"email":"ubaid1@manager.com"}',            dA_:90 },
    { email:'ubaid@admin.com',    sId:'', action:'CREATE_USER',   et:'user',     d:'{"email":"ubaid2@manager.com"}',            dA_:60 },
    { email:'ubaid1@manager.com', sId:mgr1Stores[0].id, action:'ADD_BATCH',    et:'batch',    d:'{"batch":"B-PAR-A102","qty":800}',        dA_:2  },
    { email:'ubaid1@manager.com', sId:mgr1Stores[1].id, action:'CREATE_ORDER', et:'order',    d:'{"medicine":"Insulin","qty":100}',         dA_:3  },
    { email:'ubaid1@manager.com', sId:mgr1Stores[2].id, action:'RECORD_WASTE', et:'batch',    d:'{"medicine":"Vitamin C","qty":50}',        dA_:10 },
    { email:'ubaid2@manager.com', sId:mgr2Stores[0].id, action:'ADD_BATCH',    et:'batch',    d:'{"batch":"B-ORS-B102","qty":350}',        dA_:4  },
    { email:'ubaid2@manager.com', sId:mgr2Stores[1].id, action:'CREATE_ORDER', et:'order',    d:'{"medicine":"Azithromycin","qty":300}',    dA_:4  },
    { email:'ubaid2@manager.com', sId:mgr2Stores[2].id, action:'RECORD_WASTE', et:'batch',    d:'{"medicine":"ORS Sachets","qty":80}',      dA_:8  },
    { email:'ubaid1@gmail.com',   sId:mgr1Stores[0].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"Paracetamol","qty":20}',      dA_:0  },
    { email:'ubaid2@gmail.com',   sId:mgr1Stores[1].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"Amoxicillin","qty":10}',      dA_:0  },
    { email:'ubaid3@gmail.com',   sId:mgr1Stores[2].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"ORS Sachets","qty":25}',      dA_:1  },
    { email:'ubaid4@gmail.com',   sId:mgr2Stores[0].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"ORS Sachets","qty":30}',      dA_:0  },
    { email:'ubaid5@gmail.com',   sId:mgr2Stores[1].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"Azithromycin","qty":6}',      dA_:1  },
    { email:'ubaid6@gmail.com',   sId:mgr2Stores[2].id, action:'DISPENSE',     et:'medicine', d:'{"medicine":"Cough Syrup","qty":12}',      dA_:1  },
  ];
  const ab = adminDb.batch();
  for (const a of auditEntries)
    ab.set(adminDb.collection('audit_logs').doc(), { userEmail: a.email, storeId: a.sId, action: a.action, entityType: a.et, details: a.d, timestamp: dA(a.dA_) });
  await ab.commit();
  console.log(`   ${auditEntries.length} audit entries`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n✅  Seed complete!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VEDA Demo Accounts  (password: Veda@2026)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Admin:          ubaid@admin.com          → sees all 6 stores');
  console.log('');
  console.log('  Manager 1:      ubaid1@manager.com       → sees 3 stores:');
  console.log(`    • ${mgr1Stores[0].name}`);
  console.log(`    • ${mgr1Stores[1].name}`);
  console.log(`    • ${mgr1Stores[2].name}`);
  console.log('');
  console.log('  Manager 2:      ubaid2@manager.com       → sees 3 stores:');
  console.log(`    • ${mgr2Stores[0].name}`);
  console.log(`    • ${mgr2Stores[1].name}`);
  console.log(`    • ${mgr2Stores[2].name}`);
  console.log('');
  console.log('  Pharmacist 1:   ubaid1@gmail.com         → ' + mgr1Stores[0].name);
  console.log('  Pharmacist 2:   ubaid2@gmail.com         → ' + mgr1Stores[1].name);
  console.log('  Pharmacist 3:   ubaid3@gmail.com         → ' + mgr1Stores[2].name);
  console.log('  Pharmacist 4:   ubaid4@gmail.com         → ' + mgr2Stores[0].name);
  console.log('  Pharmacist 5:   ubaid5@gmail.com         → ' + mgr2Stores[1].name);
  console.log('  Pharmacist 6:   ubaid6@gmail.com         → ' + mgr2Stores[2].name);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message ?? err);
  process.exit(1);
});
