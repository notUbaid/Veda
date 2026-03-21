import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// gemini-1.5-flash: higher free-tier quota than 2.0-flash-lite
const MODEL = "gemini-1.5-flash";

// Simple in-memory rate limit — one call per function per 60 seconds
const _lastCalled: Record<string, number> = {};
function isRateLimited(key: string, minGapMs = 60_000): boolean {
  const now = Date.now();
  if (_lastCalled[key] && now - _lastCalled[key] < minGapMs) return true;
  _lastCalled[key] = now;
  return false;
}

const PHARMACY_SYSTEM = `You are Veda, an intelligent pharmacy management AI for Indian government hospitals.
You specialize in FEFO drug dispensing, expiry management, demand forecasting, and procurement.
You understand Indian seasonal disease patterns (monsoon: ORS/Paracetamol spike, winter: antibiotics/cough syrup, summer: antidiarrheals).
Always give precise, actionable responses. Reference specific medicines, quantities, and rupee values.`;

// ── AI Recommendation Banner (pharmacist) ─────────────────────────────────

export async function getAIRecommendation(medicines: any[], batches: any[]): Promise<any[]> {
  if (isRateLimited('recommendation')) {
    console.warn("AI recommendation rate-limited — skipping call");
    return [];
  }
  try {
    // Only send what's needed — keep payload small to save tokens
    const medSummary = medicines.slice(0, 10).map(m => ({
      id: m.id, name: m.name, category: m.category,
      reorderThreshold: m.reorderThreshold, unit: m.unit,
    }));
    const batchSummary = batches.slice(0, 15).map(b => ({
      medicineId: b.medicineId, batchNumber: b.batchNumber,
      quantity: b.quantity, expiryDate: b.expiryDate,
      location: b.location
        ? `${b.location.aisle}/${b.location.row}/${b.location.shelf}/${b.location.compartment}`
        : 'N/A',
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `${PHARMACY_SYSTEM}

Analyze this pharmacy data. Provide 3–5 FEFO recommendations for TODAY.
Month: ${new Date().toLocaleString('default', { month: 'long' })}.
Medicines: ${JSON.stringify(medSummary)}
Batches (FEFO sorted): ${JSON.stringify(batchSummary)}

Return ONLY a JSON array — no markdown, no extra text.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medicineName:    { type: Type.STRING },
              batchNumber:     { type: Type.STRING },
              location:        { type: Type.STRING },
              daysUntilExpiry: { type: Type.INTEGER },
              currentStock:    { type: Type.INTEGER },
              action:          { type: Type.STRING },
              urgency:         { type: Type.STRING },
            },
            required: ["medicineName", "action", "urgency"],
          },
        },
      },
    });
    const text = response.text?.trim() || "[]";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      console.warn("AI Recommendation: quota exceeded — will retry later");
      return [];
    }
    console.error("AI Recommendation Error:", error);
    return [];
  }
}

// ── Inventory Forecast (manager order book) ───────────────────────────────

export async function getInventoryForecast(medicines: any[], dispenseLogs: any[]): Promise<any[]> {
  if (isRateLimited('forecast')) {
    console.warn("AI forecast rate-limited — skipping call");
    return [];
  }
  try {
    // Keep payload minimal
    const medSummary = medicines.slice(0, 10).map(m => ({
      id: m.id, name: m.name, unitPrice: m.unitPrice,
      reorderThreshold: m.reorderThreshold, leadTimeDays: m.leadTimeDays ?? 7,
    }));
    const logSummary = dispenseLogs.slice(0, 20).map(l => ({
      medicineId: l.medicineId, quantity: l.quantity, timestamp: l.timestamp,
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `${PHARMACY_SYSTEM}

Forecast inventory for the next 30 days.
Month: ${new Date().toLocaleString('default', { month: 'long' })}.
Apply Indian seasonal demand patterns.

Medicines: ${JSON.stringify(medSummary)}
Recent dispenses: ${JSON.stringify(logSummary)}

Return ONLY a JSON array — no markdown, no extra text.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medicineId:           { type: Type.STRING },
              medicineName:         { type: Type.STRING },
              avgDailyConsumption:  { type: Type.NUMBER },
              daysOfStockRemaining: { type: Type.NUMBER },
              recommendedOrderQty:  { type: Type.NUMBER },
              orderDeadlineDays:    { type: Type.NUMBER },
              seasonalFactor:       { type: Type.NUMBER },
              estimatedCostInr:     { type: Type.NUMBER },
              narrative:            { type: Type.STRING },
            },
            required: ["medicineId", "medicineName", "recommendedOrderQty", "orderDeadlineDays", "narrative"],
          },
        },
      },
    });
    const text = response.text?.trim() || "[]";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      console.warn("AI Forecast: quota exceeded — will retry later");
      return [];
    }
    console.error("AI Forecast Error:", error);
    return [];
  }
}

// ── Pharmacist AI Query ───────────────────────────────────────────────────

export async function answerPharmacistQuery(
  question: string,
  medicines: any[],
  batches: any[],
  logs: any[],
): Promise<string> {
  // No rate limit here — user explicitly triggered, we want it to feel responsive
  try {
    const medSummary = medicines.slice(0, 12).map(m => ({
      id: m.id, name: m.name, category: m.category,
      unit: m.unit, reorderThreshold: m.reorderThreshold,
    }));
    const batchSummary = batches.slice(0, 15).map(b => {
      const med = medicines.find(m => m.id === b.medicineId);
      return {
        medicine: med?.name ?? b.medicineId,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        location: b.location
          ? `Aisle ${b.location.aisle}, Row ${b.location.row}, Shelf ${b.location.shelf}, Comp ${b.location.compartment}`
          : 'Unknown',
      };
    });
    const logSummary = logs.slice(0, 8).map(l => ({
      medicine: l.medicineName, qty: l.quantity, time: l.timestamp,
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `${PHARMACY_SYSTEM}

Pharmacist question: "${question}"

Live data:
Medicines: ${JSON.stringify(medSummary)}
Batches (FEFO): ${JSON.stringify(batchSummary)}
Today's dispenses: ${JSON.stringify(logSummary)}

Answer directly and precisely. Include shelf locations when relevant.`,
    });
    return response.text?.trim() || "Unable to answer right now.";
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      return "⚠ AI quota temporarily exhausted. Free tier resets every minute — please try again shortly.";
    }
    console.error("Pharmacist Query Error:", error);
    return "AI is temporarily unavailable.";
  }
}
