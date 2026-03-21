/**
 * Veda Email Service — EmailJS-powered
 * Sends HTML emails directly from the browser via EmailJS CDN.
 *
 * EmailJS template variables required:
 *   {{to_email}}  {{to_name}}  {{subject}}  {{html_body}}
 *
 * Set To Email field in template to: {{to_email}}
 * Set body to: {{{html_body}}}  (triple braces = raw HTML in EmailJS)
 */

// ── Config ────────────────────────────────────────────────────────────────
const SERVICE_ID  = (process.env.EMAILJS_SERVICE_ID  as string) || '';
const TEMPLATE_ID = (process.env.EMAILJS_TEMPLATE_ID as string) || '';
const PUBLIC_KEY  = (process.env.EMAILJS_PUBLIC_KEY  as string) || '';

const CONFIGURED = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

// ── SDK loader ────────────────────────────────────────────────────────────
let sdkReady = false;
let sdkPromise: Promise<void> | null = null;

function loadSDK(): Promise<void> {
  if (sdkReady) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    // Already present on window (e.g. HMR reload)
    if (typeof window !== 'undefined' && (window as any).emailjs) {
      (window as any).emailjs.init({ publicKey: PUBLIC_KEY });
      sdkReady = true;
      return resolve();
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.async = true;
    s.onload = () => {
      (window as any).emailjs.init({ publicKey: PUBLIC_KEY });
      sdkReady = true;
      resolve();
    };
    s.onerror = () => reject(new Error('EmailJS SDK failed to load'));
    document.head.appendChild(s);
  });

  return sdkPromise;
}

// ── HTML builder ──────────────────────────────────────────────────────────
function buildHtml(p: {
  recipientName: string;
  title: string;
  message: string;
  urgency: 'critical' | 'warning' | 'info' | 'success';
  storeName: string;
  details?: Record<string, string>;
}): string {
  const colors: Record<string, string> = {
    critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6', success: '#10b981',
  };
  const bgs: Record<string, string> = {
    critical: '#fef2f2', warning: '#fffbeb', info: '#eff6ff', success: '#f0fdf4',
  };
  const c = colors[p.urgency] ?? '#3b82f6';
  const bg = bgs[p.urgency] ?? '#eff6ff';

  // Safe date formatting — no dateStyle/timeStyle combo issues
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

  const detailRows = p.details
    ? Object.entries(p.details).map(([k, v]) =>
        `<tr>
          <td style="padding:5px 0;color:#64748b;font-size:13px;width:150px;font-weight:600;">${k}</td>
          <td style="padding:5px 0;color:#1e293b;font-size:13px;">${v}</td>
        </tr>`
      ).join('')
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#0a0f1e;padding:20px 28px;border-radius:14px 14px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:3px;">VEDA</span>
        <span style="font-size:10px;color:#64748b;display:block;margin-top:2px;letter-spacing:1px;">HOSPITAL PHARMACY INTELLIGENCE</span>
      </td>
      <td align="right"><span style="background:${c};color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:100px;text-transform:uppercase;letter-spacing:1px;">${p.urgency}</span></td>
    </tr></table>
  </td></tr>

  <tr><td style="background:${c};height:3px;"></td></tr>

  <tr><td style="background:#fff;padding:28px 28px 20px;">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;font-weight:600;">Hello ${p.recipientName},</p>
    <h2 style="margin:8px 0 16px;font-size:18px;font-weight:700;color:#0f172a;">${p.title}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">${p.message}</p>
    ${detailRows ? `
    <div style="background:${bg};border-left:4px solid ${c};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">${detailRows}</table>
    </div>` : ''}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
      <p style="margin:0;font-size:12px;color:#64748b;">
        <strong>Store:</strong> ${p.storeName}&nbsp;&nbsp;
        <strong>Time:</strong> ${dateStr}, ${timeStr} IST
      </p>
    </div>
  </td></tr>

  <tr><td style="background:#0a0f1e;padding:16px 28px;border-radius:0 0 14px 14px;">
    <p style="margin:0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
      Automated alert from <strong style="color:#93c5fd;">Veda Pharmacy System</strong> · Do not reply.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ── Core send ─────────────────────────────────────────────────────────────
export interface EmailPayload {
  recipientName: string;
  recipientEmails: string[];
  subject: string;
  title: string;
  message: string;
  urgency: 'critical' | 'warning' | 'info' | 'success';
  storeName: string;
  details?: Record<string, string>;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!CONFIGURED) {
    console.warn('[Veda Email] EmailJS not configured — skipping.');
    return;
  }

  const recipients = [...new Set(payload.recipientEmails.filter(e => e?.includes('@')))];
  if (recipients.length === 0) return;

  try {
    await loadSDK();
  } catch (e) {
    console.warn('[Veda Email] SDK load failed:', e);
    return;
  }

  const html = buildHtml(payload);

  const results = await Promise.allSettled(
    recipients.map(email =>
      (window as any).emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        to_email:   email,
        to_name:    payload.recipientName,
        subject:    `[Veda] ${payload.subject}`,
        html_body:  html,
      })
    )
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) console.warn(`[Veda Email] ${sent} sent, ${failed} failed for "${payload.subject}"`);
  else console.log(`[Veda Email] Sent "${payload.subject}" → ${recipients.join(', ')}`);
}

// ── Typed helpers ─────────────────────────────────────────────────────────

export async function emailLowStock(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; currentStock: number; threshold: number;
  unit: string; storeName: string;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Low Stock Alert — ${opts.medicineName}`,
    title:    `⚠ Low Stock: ${opts.medicineName}`,
    message:  `Stock for ${opts.medicineName} at ${opts.storeName} has dropped below the reorder threshold. Immediate reorder is recommended.`,
    urgency:  opts.currentStock <= 0 ? 'critical' : 'warning',
    storeName: opts.storeName,
    details: {
      'Medicine':          opts.medicineName,
      'Current Stock':     `${opts.currentStock} ${opts.unit}`,
      'Reorder Threshold': `${opts.threshold} ${opts.unit}`,
      'Action':            opts.currentStock <= 0 ? 'STOCKOUT — reorder immediately' : 'Place reorder request',
    },
  });
}

export async function emailExpiryAlert(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; batchNumber: string;
  daysLeft: number; quantity: number; storeName: string;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Expiry Alert — ${opts.medicineName} (${opts.daysLeft}d)`,
    title:    `🔴 Expiry Warning: ${opts.medicineName}`,
    message:  `Batch ${opts.batchNumber} expires in ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''}. Dispense this batch first (FEFO) to minimise waste.`,
    urgency:  opts.daysLeft <= 7 ? 'critical' : 'warning',
    storeName: opts.storeName,
    details: {
      'Medicine':    opts.medicineName,
      'Batch':       opts.batchNumber,
      'Days Left':   `${opts.daysLeft} days`,
      'Quantity':    String(opts.quantity),
      'FEFO Action': 'Dispense this batch FIRST',
    },
  });
}

export async function emailOrderPlaced(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; quantity: number; unitPrice: number;
  totalValue: number; urgency: string; supplier: string;
  storeName: string; needsApproval: boolean;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Order Placed — ${opts.medicineName}`,
    title:    `📦 Procurement Request: ${opts.medicineName}`,
    message:  opts.needsApproval
      ? `Your requisition for ${opts.medicineName} exceeds ₹50,000 and is awaiting administrator approval before dispatch.`
      : `Your requisition for ${opts.medicineName} has been submitted to ${opts.supplier} and is pending confirmation.`,
    urgency:  opts.needsApproval ? 'warning' : 'info',
    storeName: opts.storeName,
    details: {
      'Medicine':          opts.medicineName,
      'Quantity':          String(opts.quantity),
      'Unit Price':        `₹${opts.unitPrice.toFixed(2)}`,
      'Total Value':       `₹${opts.totalValue.toLocaleString('en-IN')}`,
      'Supplier':          opts.supplier,
      'Urgency':           opts.urgency.toUpperCase(),
      'Admin Approval':    opts.needsApproval ? 'YES — required' : 'Not required',
    },
  });
}

export async function emailOrderUpdate(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; newStatus: string;
  quantity: number; storeName: string;
}) {
  const meta: Record<string, { emoji: string; urgency: EmailPayload['urgency'] }> = {
    confirmed:  { emoji: '✅', urgency: 'info'     },
    dispatched: { emoji: '🚚', urgency: 'info'     },
    delivered:  { emoji: '📬', urgency: 'success'  },
    cancelled:  { emoji: '❌', urgency: 'critical' },
  };
  const m = meta[opts.newStatus] ?? { emoji: '🔔', urgency: 'info' as const };
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Order ${opts.newStatus.charAt(0).toUpperCase() + opts.newStatus.slice(1)} — ${opts.medicineName}`,
    title:    `${m.emoji} Order ${opts.newStatus.toUpperCase()}: ${opts.medicineName}`,
    message:  `Your order for ${opts.medicineName} (qty: ${opts.quantity}) at ${opts.storeName} is now ${opts.newStatus.toUpperCase()}.`,
    urgency:  m.urgency,
    storeName: opts.storeName,
    details: {
      'Medicine':   opts.medicineName,
      'Quantity':   String(opts.quantity),
      'New Status': opts.newStatus.toUpperCase(),
    },
  });
}

export async function emailDispenseConfirm(opts: {
  recipientName: string; recipientEmails: string[];
  billId: string; items: { name: string; qty: number; unit: string; value: number }[];
  totalValue: number; patientRef: string; storeName: string;
}) {
  const itemLines = opts.items.map(i =>
    `• ${i.name}: ${i.qty} ${i.unit} — ₹${i.value.toLocaleString('en-IN')}`
  ).join('<br>');
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Dispense Confirmed — ${opts.billId}`,
    title:    `✅ Dispense Complete — ${opts.billId}`,
    message:  `The following medicines were dispensed per FEFO protocol. Invoice PDF has been generated.<br><br>${itemLines}`,
    urgency:  'success',
    storeName: opts.storeName,
    details: {
      'Bill ID':     opts.billId,
      'Patient Ref': opts.patientRef || 'N/A',
      'Total Value': `₹${opts.totalValue.toLocaleString('en-IN')}`,
      'FEFO':        'Compliant ✓',
    },
  });
}

export async function emailApprovalResult(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; status: 'approved' | 'rejected';
  totalValue: number; storeName: string; adminName: string;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Requisition ${opts.status === 'approved' ? 'Approved' : 'Rejected'} — ${opts.medicineName}`,
    title:    opts.status === 'approved'
      ? `✅ Requisition Approved: ${opts.medicineName}`
      : `❌ Requisition Rejected: ${opts.medicineName}`,
    message:  opts.status === 'approved'
      ? `Your requisition for ${opts.medicineName} (₹${opts.totalValue.toLocaleString('en-IN')}) was approved by ${opts.adminName} and will proceed to dispatch.`
      : `Your requisition for ${opts.medicineName} (₹${opts.totalValue.toLocaleString('en-IN')}) was rejected by ${opts.adminName}. Please raise a revised request if needed.`,
    urgency:   opts.status === 'approved' ? 'success' : 'critical',
    storeName: opts.storeName,
    details: {
      'Medicine':    opts.medicineName,
      'Total Value': `₹${opts.totalValue.toLocaleString('en-IN')}`,
      'Decision':    opts.status.toUpperCase(),
      'Reviewed by': opts.adminName,
    },
  });
}

export async function emailWasteRecorded(opts: {
  recipientName: string; recipientEmails: string[];
  medicineName: string; quantity: number; reason: string;
  wasteValue: number; storeName: string;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:  `Waste Recorded — ${opts.medicineName}`,
    title:    `🗑 Stock Waste Logged: ${opts.medicineName}`,
    message:  `A waste record has been created for ${opts.medicineName} at ${opts.storeName}. This action is permanently audited.`,
    urgency:  'warning',
    storeName: opts.storeName,
    details: {
      'Medicine':   opts.medicineName,
      'Quantity':   String(opts.quantity),
      'Reason':     opts.reason,
      'Loss Value': `₹${opts.wasteValue.toLocaleString('en-IN')}`,
    },
  });
}

export async function emailNotification(opts: {
  recipientName: string; recipientEmails: string[];
  title: string; message: string;
  urgency: 'critical' | 'warning' | 'info';
  storeName: string; details?: Record<string, string>;
}) {
  return sendEmail({
    recipientName:   opts.recipientName,
    recipientEmails: opts.recipientEmails,
    subject:   opts.title,
    title:     opts.title,
    message:   opts.message,
    urgency:   opts.urgency,
    storeName: opts.storeName,
    details:   opts.details,
  });
}
