/**
 * VEDA — AI Service (Ollama, 100% local)
 *
 * Proxy path: /ollama/* → Vite proxy → localhost:11434
 * No CORS issues. No API key. Runs offline.
 *
 * Quick start:
 *   ollama serve          (already running if port was busy)
 *   ollama pull llama3.2  (2GB, fast)
 */

const OLLAMA_BASE = '/ollama';
const DEFAULT_MODEL =
  (import.meta as any).env?.VITE_OLLAMA_MODEL ?? 'llama3.2';

// ── Runtime model selector (persisted to localStorage) ───────────────────
export function getActiveModel(): string {
  return localStorage.getItem('veda_ollama_model') || DEFAULT_MODEL;
}
export function setActiveModel(m: string) {
  localStorage.setItem('veda_ollama_model', m.trim());
}

// ── Health check ─────────────────────────────────────────────────────────
export async function checkOllamaHealth(): Promise<{
  ok: boolean; models: string[]; error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models: string[] = (data.models ?? []).map((m: any) => m.name as string);
    return { ok: true, models };
  } catch {
    return { ok: false, models: [], error: 'Ollama not reachable — run: ollama serve' };
  }
}

// ── Core chat ─────────────────────────────────────────────────────────────
async function ollamaChat(
  system: string,
  user: string,
  model?: string,
  json = false,
): Promise<string> {
  const m = model ?? getActiveModel();
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      stream: false,
      options: { temperature: json ? 0.1 : 0.7, num_predict: json ? 1024 : 2048 },
      ...(json ? { format: 'json' } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  const data = await res.json();
  return (data.message?.content ?? '').trim();
}

// ── System prompt ─────────────────────────────────────────────────────────
const SYS = `You are Veda, an expert pharmacy management AI for Indian government hospitals.
You specialise in FEFO dispensing, expiry tracking, demand forecasting, and procurement.
Indian seasonal demand (apply always):
  Monsoon Jun-Sep: ORS, Paracetamol, Antidiarrheals, Zinc surge
  Winter Nov-Feb: Antibiotics, Cough syrups, Bronchodilators, Vitamins surge
  Summer Mar-May: Antidiarrheals, ORS, IV fluids, Antipyretics surge
Be precise. Use specific medicine names, quantities, rupee values, shelf locations.
Never use markdown (* # **). Plain text only.`;

// ── JSON helpers ──────────────────────────────────────────────────────────
function parseArr<T>(text: string): T[] {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return Array.isArray(result) ? result : [];
  } catch { return []; }
}

// ── 1. FEFO Recommendations (pharmacist dashboard banner) ─────────────────
export async function getAIRecommendation(
  medicines: any[], batches: any[],
): Promise<any[]> {
  const meds = medicines.slice(0, 12).map(m => ({
    id: m.id, name: m.name, category: m.category,
    threshold: m.reorderThreshold, unit: m.unit,
  }));
  const bats = batches.slice(0, 20).map(b => ({
    medId: b.medicineId, batch: b.batchNumber,
    qty: b.quantity, expires: b.expiryDate,
    loc: b.location
      ? `${b.location.aisle}/${b.location.row}/${b.location.shelf}/${b.location.compartment}`
      : 'N/A',
  }));
  const text = await ollamaChat(SYS,
    `Date: ${new Date().toDateString()}
Medicines: ${JSON.stringify(meds)}
Batches (earliest-expiry first): ${JSON.stringify(bats)}

Return a JSON array of 3 to 5 FEFO dispensing recommendations.
Each item: medicineName(str) batchNumber(str) location(str) daysUntilExpiry(int) currentStock(int) action(str) urgency(str: critical|warning|info)
JSON array only.`,
    undefined, true);
  return parseArr(text);
}

// ── 2. Demand Forecast (manager dashboard order book) ────────────────────
export async function getInventoryForecast(
  medicines: any[], dispenseLogs: any[],
): Promise<any[]> {
  const meds = medicines.slice(0, 12).map(m => ({
    id: m.id, name: m.name, price: m.unitPrice,
    threshold: m.reorderThreshold, leadDays: m.leadTimeDays ?? 7,
  }));
  const logs = dispenseLogs.slice(0, 30).map(l => ({
    medId: l.medicineId, qty: l.quantity, date: l.timestamp?.slice(0, 10),
  }));
  const text = await ollamaChat(SYS,
    `Date: ${new Date().toDateString()}
Medicines: ${JSON.stringify(meds)}
Dispense logs: ${JSON.stringify(logs)}

Forecast inventory for next 30 days with Indian seasonal demand.
JSON array. Each item: medicineId(str) medicineName(str) avgDailyConsumption(num) daysOfStockRemaining(num) recommendedOrderQty(int) orderDeadlineDays(int) seasonalFactor(num) estimatedCostInr(num) narrative(str)
JSON array only.`,
    undefined, true);
  return parseArr(text);
}

// ── 3. Smart Reorder Analysis (inventory page / manager) ─────────────────
export async function getReorderAnalysis(
  medicines: any[], batches: any[], recentLogs: any[],
): Promise<any[]> {
  const meds = medicines.map(m => {
    const medBatches = batches.filter((b: any) => b.medicineId === m.id);
    const totalQty = medBatches.reduce((s: number, b: any) => s + b.quantity, 0);
    const earliest = medBatches.sort((a: any, b: any) =>
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
    return {
      id: m.id, name: m.name, category: m.category,
      unitPrice: m.unitPrice, threshold: m.reorderThreshold,
      leadDays: m.leadTimeDays ?? 7, supplier: m.supplier,
      totalQty, daysToExpiry: earliest
        ? Math.round((new Date(earliest.expiryDate).getTime() - Date.now()) / 86400000)
        : null,
    };
  });
  const logs = recentLogs.slice(0, 30).map((l: any) => ({
    name: l.medicineName, qty: l.quantity, date: l.timestamp?.slice(0, 10),
  }));

  const text = await ollamaChat(SYS,
    `Date: ${new Date().toDateString()}. Month: ${new Date().toLocaleString('default', { month: 'long' })}.
Inventory snapshot: ${JSON.stringify(meds)}
Recent dispenses: ${JSON.stringify(logs)}

Identify medicines that need ordering NOW or SOON. Apply seasonal demand multipliers.
JSON array. Each item:
  medicineId(str) medicineName(str) priority(str: critical|high|medium)
  currentQty(int) recommendedQty(int) daysUntilStockout(int)
  reason(str, 1 sentence) estimatedCostInr(num) supplier(str)
Only include medicines that actually need action. JSON array only.`,
    undefined, true);
  return parseArr(text);
}

// ── 4. Low-Stock AI Triage (alerts page) ─────────────────────────────────
export async function getAlertTriage(
  alerts: any[], medicines: any[], batches: any[],
): Promise<any[]> {
  const alertSummary = alerts.slice(0, 20).map(a => ({
    id: a.id, type: a.type, title: a.title,
    urgency: a.urgency, message: a.message,
    medicineId: a.medicineId,
  }));
  const medSummary = medicines.slice(0, 15).map(m => {
    const totalQty = batches
      .filter((b: any) => b.medicineId === m.id)
      .reduce((s: number, b: any) => s + b.quantity, 0);
    return { id: m.id, name: m.name, threshold: m.reorderThreshold, totalQty };
  });

  const text = await ollamaChat(SYS,
    `Date: ${new Date().toDateString()}.
Alerts: ${JSON.stringify(alertSummary)}
Medicine stock: ${JSON.stringify(medSummary)}

Prioritise these alerts for a pharmacist. For each alert suggest the best action.
JSON array. Each item:
  alertId(str) medicineName(str) suggestedAction(str, 1-2 sentences)
  priority(str: immediate|today|this_week) canDismiss(bool)
JSON array only.`,
    undefined, true);
  return parseArr(text);
}

// ── 5. Expiry Risk Report (manager / inventory) ───────────────────────────
export async function getExpiryRiskReport(
  medicines: any[], batches: any[],
): Promise<any[]> {
  const expiringBatches = batches
    .filter((b: any) => {
      const days = Math.round((new Date(b.expiryDate).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 90;
    })
    .map((b: any) => {
      const med = medicines.find((m: any) => m.id === b.medicineId);
      return {
        batchId: b.id, batchNumber: b.batchNumber,
        medicineName: med?.name ?? 'Unknown',
        medicineId: b.medicineId,
        quantity: b.quantity, unitPrice: med?.unitPrice ?? 0,
        daysLeft: Math.round((new Date(b.expiryDate).getTime() - Date.now()) / 86400000),
        wasteValueIfExpired: b.quantity * (med?.unitPrice ?? 0),
        location: b.location
          ? `${b.location.aisle}/${b.location.row}/${b.location.shelf}`
          : 'Unknown',
      };
    })
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft);

  if (expiringBatches.length === 0) return [];

  const text = await ollamaChat(SYS,
    `Date: ${new Date().toDateString()}.
Batches expiring within 90 days: ${JSON.stringify(expiringBatches)}

For each batch, suggest how to prevent waste.
JSON array. Each item:
  batchNumber(str) medicineName(str) daysLeft(int) quantity(int)
  wasteRisk(str: critical|high|medium) action(str, 1 sentence)
  potentialWasteInr(num)
JSON array only. Sort by daysLeft ascending.`,
    undefined, true);
  return parseArr(text);
}

// ── 6. Free-text pharmacist query (QueryPage) ─────────────────────────────
export async function answerPharmacistQuery(
  question: string,
  medicines: any[],
  batches: any[],
  logs: any[],
): Promise<string> {
  const meds = medicines.slice(0, 15).map(m => ({
    id: m.id, name: m.name, category: m.category,
    unit: m.unit, threshold: m.reorderThreshold,
  }));
  const bats = batches.slice(0, 20).map(b => {
    const med = medicines.find(m => m.id === b.medicineId);
    return {
      medicine: med?.name ?? b.medicineId,
      batch: b.batchNumber, qty: b.quantity, expires: b.expiryDate,
      loc: b.location
        ? `Aisle ${b.location.aisle} Row ${b.location.row} Shelf ${b.location.shelf} Comp ${b.location.compartment}`
        : 'Unknown',
    };
  });
  const recent = logs.slice(0, 10).map(l => ({
    med: l.medicineName, qty: l.quantity, at: l.timestamp?.slice(0, 16),
  }));

  return ollamaChat(SYS,
    `Date: ${new Date().toDateString()}.
Live inventory — Medicines: ${JSON.stringify(meds)}
Batches (FEFO): ${JSON.stringify(bats)}
Today's dispenses: ${JSON.stringify(recent)}

Question: "${question}"
Answer directly and precisely. Include shelf locations when relevant.`);
}
