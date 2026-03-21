# 🏥 VEDA — Pharmacy Intelligence System

> Precision inventory management for government hospital pharmacies.  
> FEFO dispensing · AI demand forecasting · Multi-store · Role-based access

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Your `.env` file should already have the Firebase credentials. If not, copy `.env.example` to `.env` and fill in your Firebase project values.

### 3. Seed demo data (run once)
```bash
npm run seed
```
This will:
- Clear all existing Firestore data
- Create / verify all 9 Firebase Auth accounts
- Create 2 stores, 30 medicines, 42 batches
- Generate 60+ dispense logs (30 days history), orders, notifications, waste records, audit logs

### 4. Start the app
```bash
npm run dev
```
Or just double-click **START.bat** and choose option 1 or 2.

---

## Demo Accounts

All accounts use password: **`Veda@2026`**

| Email | Role | Access |
|-------|------|--------|
| `ubaid@admin.com` | Admin | All stores, all staff, full audit trail |
| `ubaid1@manager.com` | Manager | Store A + Pharmacists 1, 2, 3 |
| `ubaid2@manager.com` | Manager | Store B + Pharmacists 4, 5, 6 |
| `ubaid1@gmail.com` | Pharmacist | Store A (sees manager + own store) |
| `ubaid2@gmail.com` | Pharmacist | Store A |
| `ubaid3@gmail.com` | Pharmacist | Store A |
| `ubaid4@gmail.com` | Pharmacist | Store B (sees manager + own store) |
| `ubaid5@gmail.com` | Pharmacist | Store B |
| `ubaid6@gmail.com` | Pharmacist | Store B |

---

## Role Capabilities

### 🛡️ Admin (`ubaid@admin.com`)
- View both stores and their full inventory
- See all managers and all 6 pharmacists
- Approve / reject procurement orders > ₹50,000
- Raise emergency requisitions
- Access immutable audit trail (export CSV)
- Activate / suspend staff accounts

### 🏪 Manager (`ubaid1@manager.com` / `ubaid2@manager.com`)
- Manage their own store's inventory
- Add medicines, receive stock (new batches)
- Place and track procurement orders
- Record waste/disposal
- View AI demand forecasting & smart order book
- See alerts for their store's expiries and low stock
- Export inventory, batch, and waste reports (PDF/CSV)

### 💊 Pharmacist (`ubaid1–6@gmail.com`)
- View stock with FEFO batch selection
- Dispense medicines (auto FEFO batch, generates PDF bill)
- Send reorder reminders to manager
- AI query assistant ("Which medicines expire this week?")
- View recent dispense history

---

## Architecture

```
src/
├── App.tsx                    # Auth, routing, layout
├── firebase.ts                # Firebase init
├── seed.ts                    # Demo data seed script
├── types/index.ts             # TypeScript interfaces
├── components/
│   ├── AdminDashboard.tsx
│   ├── ManagerDashboard.tsx
│   └── PharmacistDashboard.tsx
├── services/
│   ├── aiService.ts           # Gemini AI (recommendations, forecasting, chat)
│   ├── auditService.ts        # Immutable audit log writer
│   ├── exportService.ts       # CSV export
│   └── pdfService.ts          # PDF bills & inventory reports
└── hooks/
    └── useOnlineStatus.ts     # Offline detection
```

**Firestore Collections:** `users` · `stores` · `medicines` · `batches` · `dispense_logs` · `orders` · `notifications` · `waste_records` · `audit_logs`

---

## Re-seeding

If you want to reset all data and start fresh:
```bash
npm run seed
```
This wipes all Firestore collections and recreates everything. Auth accounts are reused (not deleted).

> ⚠️ Any data created through the UI will be deleted on re-seed.
