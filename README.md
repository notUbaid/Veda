<p align="center">
  <img src="static/assets/logo.png" width="90" />
</p>

<h1 align="center">VEDA</h1>

<p align="center">
  <strong>Smart Pharmacy Intelligence — Real-time tracking, AI-driven expiry alerts,<br/>and optimized inventory for the next generation of healthcare.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase" />
  <img src="https://img.shields.io/badge/Python-Flask-3776AB?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/AI-Gemini%201.5%20Flash-4285F4?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/ML-XGBoost-FF6600?style=flat-square" />
  <img src="https://img.shields.io/badge/Hosted-Firebase-orange?style=flat-square&logo=firebase" />
</p>

<p align="center">
  <strong>FEFO Dispensing · AI Demand Forecasting · Multi-Store · Role-Based Access</strong>
</p>

---

## 🚀 Overview

**VEDA** is a next-generation **AI-powered hospital pharmacy management system** built to eliminate drug wastage, prevent critical stockouts, and optimize inventory across government healthcare systems.

Built with real-world hospital workflows in mind, VEDA ensures:

- ✅ **Zero expired medicines** — FEFO enforced at the database query level
- ✅ **Smart inventory tracking** — batch-level, real-time, multi-store
- ✅ **Automated decision-making** — XGBoost ML demand forecasting at 95–96% accuracy
- ✅ **Role-based access control** — Admin, Manager, and Pharmacist with strict Firebase rules
- ✅ **Instant alerts** — low stock, expiry, reorder triggers, and outbreak detection

---

## 🎯 Problem Statement

Government hospital pharmacies across India manage hundreds of drug types on paper registers or basic spreadsheets, creating three simultaneous failure modes:

| Problem | Root Cause | Severity |
|--------|-----------|----------|
| ❌ Critical medicine stockouts | No automated threshold alerts or demand tracking | Life-threatening |
| ❌ Expiry waste (15–20% annually) | FEFO not enforced; newer batches used first | ₹4L+/quarter/hospital |
| ❌ Procurement guesswork | Orders placed by memory & intuition | Excess slow-movers + fast-mover shortages |

> India has **4,000+ government district hospitals** and **8 lakh+ registered pharmacies** — 70% operating on paper.
> A missed insulin dose or unavailable antibiotic can be fatal.

**VEDA solves all of these with precision, automation, and intelligence.**

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Your `.env` file should already contain Firebase credentials. If not:

```bash
cp .env.example .env
# Fill in your Firebase project values
```

### 3. Seed Demo Data *(run once)*

```bash
npm run seed
```

This will:
- Clear all existing Firestore data
- Create / verify all 9 Firebase Auth accounts
- Create 2 stores, 30 medicines, 42 batches
- Generate 60+ dispense logs (30 days history), orders, notifications, waste records, and audit logs

### 4. Start the App

```bash
npm run dev
```

> Or double-click **`START.bat`** and choose option 1 or 2.

---

## 🔐 Demo Accounts

All accounts use password: **`Veda@2026`**

| Email | Role | Access |
|-------|------|--------|
| `ubaid@admin.com` | 🛡️ Admin | All stores, all staff, full audit trail |
| `ubaid1@manager.com` | 🏪 Manager | Store A + Pharmacists 1, 2, 3 |
| `ubaid2@manager.com` | 🏪 Manager | Store B + Pharmacists 4, 5, 6 |
| `ubaid1@gmail.com` | 💊 Pharmacist | Store A (sees manager + own store) |
| `ubaid2@gmail.com` | 💊 Pharmacist | Store A |
| `ubaid3@gmail.com` | 💊 Pharmacist | Store A |
| `ubaid4@gmail.com` | 💊 Pharmacist | Store B (sees manager + own store) |
| `ubaid5@gmail.com` | 💊 Pharmacist | Store B |
| `ubaid6@gmail.com` | 💊 Pharmacist | Store B |

---

## 🏥 Core Modules & Role Capabilities

### 🛡️ Admin — `ubaid@admin.com`

> Centralized hospital-level monitoring with full oversight and compliance controls.

- View both stores and their complete inventory in real time
- See all managers and all 6 pharmacists across the system
- Approve / reject procurement orders exceeding ₹50,000
- Raise emergency drug requisitions directly
- Cross-store analytics, comparisons, and efficiency scoring
- Access immutable audit trail — export as CSV
- Activate / suspend staff accounts
- Waste pattern analysis and store efficiency scoring
- Cross-store stock imbalance detection

---

### 🏪 Manager — `ubaid1@manager.com` / `ubaid2@manager.com`

> Full store ownership — inventory, ordering, waste tracking, and AI demand insights.

- Manage their own store's complete inventory
- Add medicines and receive stock (new batches with batch-level metadata)
- Place and track full procurement order lifecycle (Ordered → Confirmed → Delivered)
- Record waste and disposal with ₹ financial impact tracking
- View **AI-powered demand forecasting** with seasonal adjustments
- Smart reorder system — AI suggests quantities based on consumption trends
- See alerts for their store's expiring stock and low-stock items
- Export inventory, batch, and waste reports as PDF / CSV
- Financial insights — procurement cost, wastage, and stock turnover

---

### 💊 Pharmacist — `ubaid1–6@gmail.com`

> Fast, accurate dispensing with FEFO automation and AI assistance.

- View full stock with automatic FEFO batch selection
- Dispense medicines — auto-selects the nearest-expiry batch and generates a PDF bill
- Send reorder reminders directly to the store manager
- **AI query assistant** — chat-style queries like *"Which medicines expire this week?"*
- Daily AI suggestions for dispensing priority and expiry risk detection
- View recent dispense history and low-stock notifications
- Location-aware stock navigation — Row / Shelf / Compartment mapping

---

## 🤖 Intelligence Layer

### 🔬 Smart Recommendations *(Pharmacist)*
- Daily AI suggestions for dispensing priority
- Batch-level expiry risk detection using Gemini 1.5 Flash

### 📦 Demand Forecasting *(Manager)*
- **XGBoost-based consumption prediction** — trained on ~700 daily observations (2014–2019)
- Feature engineering: lag features (`lag_1`, `lag_2`, `lag_7`), rolling averages (`rolling_mean_3`, `rolling_mean_7`), multi-scale usage ratios
- Seasonal adjustments — monsoon antifungal spikes, winter respiratory surges
- Stockout prediction with 3-day advance lead time
- **95–96% accuracy, MAPE ≈ 3–5%**

### 🧠 System Intelligence *(Admin)*
- Waste pattern analysis with ₹ financial impact
- Store efficiency scoring across all branches
- Cross-store stock imbalance and redistribution suggestions

---

## 🔔 Notification & Alert System

| Alert Type | Trigger | Recipient |
|-----------|---------|-----------|
| 🟠 Expiry Warning | Stock expiring within 60 days | Pharmacist + Manager |
| 🔴 Critical Expiry | Stock expiring within 7 days | Manager + Admin |
| 🟡 Low Stock | Quantity ≤ configured threshold | Pharmacist |
| 📦 Reorder Reminder | Pharmacist-triggered or ML-triggered | Manager |
| 🚨 Recall Alert | Batch-level recall flag | All roles |
| 🦠 Outbreak Alert | Epidemic demand spike detected | Admin + Manager |

All alerts auto-clear when restocked or resolved. In-app notification center with color-coded urgency levels.

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite + Tailwind + Framer Motion | Component-based UI; fast HMR; animations |
| Backend | Flask (Python) | ML API server, FEFO logic, PDF generation |
| Database | Firebase Firestore (NoSQL, real-time) | 9 collections; onSnapshot listeners |
| Auth | Firebase Authentication | JWT-enforced roles; 3 role types |
| AI / ML | Gemini 1.5 Flash + XGBoost + scikit-learn | Recommendations, demand forecasting, chat |
| Charts | Recharts | Inventory trends, expiry timelines, analytics |
| PDF | jsPDF | Billing receipts, inventory reports |
| Hosting | Firebase Hosting | Global CDN; zero infra; instant deploy |

---

## 🧩 Architecture

```
User Action
   ↓
Frontend (React Dashboard — Admin / Manager / Pharmacist)
   ↓
Firebase Auth  →  Role-Based Access Control (JWT enforced)
   ↓
Firebase Firestore  →  Real-time onSnapshot listeners
   ↓
Flask Backend  →  ML Forecasting + FEFO Logic + PDF Export
   ↓
AI Layer  →  Gemini 1.5 Flash (recommendations) + XGBoost (forecasting)
   ↓
Notifications & UI Updates  →  Auto-clear on resolution
```

<p align="center">
  <img src="static/assets/Architecture.png" />
</p>

---

## 📁 Project Structure

```
src/
├── App.tsx                       # Auth, routing, layout
├── firebase.ts                   # Firebase init & config
├── seed.ts                       # Demo data seed script
├── types/index.ts                # TypeScript interfaces
│
├── components/
│   ├── AdminDashboard.tsx        # Cross-store monitoring, audit, approvals
│   ├── ManagerDashboard.tsx      # Inventory, orders, AI forecasting, waste
│   └── PharmacistDashboard.tsx   # FEFO dispensing, billing, AI assistant
│
├── services/
│   ├── aiService.ts              # Gemini AI — recommendations, forecasting, chat
│   ├── auditService.ts           # Immutable audit log writer
│   ├── exportService.ts          # CSV export
│   └── pdfService.ts             # PDF bills & inventory reports
│
└── hooks/
    └── useOnlineStatus.ts        # Offline detection & sync indicator
```

---

## 🗂️ Database Structure — Firestore Collections

```
hospitals/
  └── stores/
        ├── medicines/          # Drug catalog (170+ items, 20 clinical categories)
        ├── batches/            # Batch-level stock — batchId, expiryDate, qty
        ├── dispense_logs/      # Every dispensing event with batch reference
        ├── orders/             # Full order lifecycle: Ordered → Confirmed → Delivered
        ├── alerts/             # Low-stock & expiry alerts; auto-clear on restock
        ├── waste_records/      # Disposal logs with ₹ financial impact
        └── staff/              # Store-scoped staff assignments

users/                          # Auth UID → role + linkedStoreId mapping
requisitions/                   # Emergency drug requisitions (Admin-raised)
notifications/                  # In-app notification center entries
ml_forecasts/                   # XGBoost predictions per drug per store
audit_logs/                     # Immutable audit trail (export CSV)
```

> **FEFO is enforced at the Firestore query level** — `orderBy('expiryDate', 'asc')` on every stock fetch. It cannot be bypassed by any role.

---

## 📦 Key Features

| Feature | Description |
|---------|-------------|
| 🔁 FEFO Engine | First Expiry First Out — enforced at DB query level, not UI |
| 📊 Real-time Analytics | Stock health, expiry timelines, ₹ waste tracking |
| 🧾 Smart Billing | Auto batch selection + PDF bill with unique receipt ID |
| 📉 Waste Reduction | Financial waste tracking with disposal logs |
| 📍 Physical Storage Mapping | Row / Shelf / Compartment location per batch |
| 🤖 AI Assistant | Gemini-powered chat for pharmacists ("what expires this week?") |
| 📄 Exportable Reports | PDF + CSV for inventory, billing, and waste |
| 🌐 Multi-language Support | English + Gujarati |
| 📡 Offline Mode | Offline detection with automatic sync on reconnect |
| 🔐 Role-based Security | Firestore rules enforce data isolation at DB layer |

---

## 🔁 Re-seeding

To reset all data and start fresh:

```bash
npm run seed
```

This wipes all Firestore collections and recreates everything from scratch. Firebase Auth accounts are reused (not deleted).

> ⚠️ Any data created through the UI will be permanently deleted on re-seed.

---

## 📌 Future Enhancements

- 🛰️ Integration with government drug warehouses and state procurement portals
- 📱 Mobile app for pharmacists (React Native)
- 🧬 Advanced ML models — LSTM for long-sequence demand forecasting
- 🔗 IoT-based smart shelf tracking with weight sensors
- 🔎 Barcode scanner support — auto-fill stock entry by scanning medicine barcodes
- 🦠 Outbreak ML response — epidemic demand spike detection with radius-based alerts
- 🔄 P2P pharmacy transfers — direct surplus stock sharing between stores
- ❄️ Cold chain routing — insulin/vaccine delivery via refrigerated warehouses only

---

## 👨‍💻 Contributors

<p align="center">
  <table>
    <tr>
      <td align="center" width="25%">
        <img src="https://avatars.githubusercontent.com/Sam-bot-dev?s=120" width="100px;" height="100px;" style="border-radius:50%" alt="Bhavesh"/><br/>
        <strong>🧩 Data & Integrations</strong><br/>
        <strong>Bhavesh Landa</strong><br/>
        <a href="https://github.com/Sam-bot-dev">🌐 GitHub</a>
      </td>
      <td align="center" width="25%">
        <img src="https://avatars.githubusercontent.com/notUbaid?s=120" width="100px;" height="100px;" style="border-radius:50%" alt="Ubaid"/><br/>
        <strong>⭐ ML & Backend Lead</strong><br/>
        <strong>Ubaid Khan</strong><br/>
        <a href="https://github.com/notUbaid">🌐 GitHub</a>
      </td>
      <td align="center" width="25%">
        <img src="https://avatars.githubusercontent.com/rhn9999?s=120" width="100px;" height="100px;" style="border-radius:50%" alt="Kush"/><br/>
        <strong>🎨 Frontend & UI</strong><br/>
        <strong>Kush Maurya</strong><br/>
        <a href="https://github.com/rhn9999">🌐 GitHub</a>
      </td>
      <td align="center" width="25%">
        <img src="https://avatars.githubusercontent.com/yuggandhii?s=120" width="100px;" height="100px;" style="border-radius:50%" alt="Yug"/><br/>
        <strong>🗄️ Full Stack & Firebase</strong><br/>
        <strong>Yug Gandhi</strong><br/>
        <a href="https://github.com/yuggandhii">🌐 GitHub</a>
      </td>
    </tr>
  </table>
</p>

---

## ⭐ Support

If you find this project impactful, give it a ⭐ and share it with healthcare tech communities.
Contributions and feedback are welcome — open an issue or a pull request.

---

<p align="center">
  <em>"In healthcare, timing is everything — VEDA ensures nothing is left to chance."</em>
</p>
