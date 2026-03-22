import jsPDF from 'jspdf';
import { Store, UserProfile, OrderLineItem } from '../types';

interface BillItem {
  medicineName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  batchNumbers: string;
}

// ── Dispense Bill (existing) ───────────────────────────────────────────────
export const generateDispenseBill = (
  billId: string,
  store: Store,
  pharmacist: UserProfile,
  items: BillItem[],
  patientRef: string
) => {
  try {
    const doc = new jsPDF();

    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('VEDA', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Hospital Pharmacy Dispensing System', 15, 28);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', 160, 24);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(store.hospitalName, 15, 55);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(store.name, 15, 62);
    doc.text(store.location, 15, 68);
    doc.text(`Contact: ${store.contact}`, 15, 74);

    doc.setFont('helvetica', 'bold');
    doc.text(`Bill ID:`, 130, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(billId, 155, 55);

    doc.setFont('helvetica', 'bold');
    doc.text(`Date:`, 130, 62);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('en-IN'), 155, 62);

    doc.setFont('helvetica', 'bold');
    doc.text(`Pharmacist:`, 130, 69);
    doc.setFont('helvetica', 'normal');
    doc.text(pharmacist.name, 155, 69);

    doc.setFont('helvetica', 'bold');
    doc.text(`Patient Ref:`, 130, 76);
    doc.setFont('helvetica', 'normal');
    doc.text(patientRef || 'N/A', 155, 76);

    let startY = 90;
    doc.setFillColor(240, 245, 250);
    doc.rect(15, startY, 180, 10, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    doc.text('Medicine', 20, startY + 7);
    doc.text('Batches', 75, startY + 7);
    doc.text('Qty', 125, startY + 7);
    doc.text('Price (INR)', 145, startY + 7);
    doc.text('Total', 175, startY + 7);

    startY += 15;
    doc.setFont('helvetica', 'normal');
    let totalVal = 0;

    items.forEach((item, i) => {
      const currentY = startY + i * 10;
      const medName = item.medicineName.length > 25
        ? item.medicineName.substring(0, 25) + '...'
        : item.medicineName;

      doc.text(medName, 20, currentY);
      doc.text(item.batchNumbers, 75, currentY);
      doc.text(`${item.quantity} ${item.unit}`, 125, currentY);
      doc.text(item.unitPrice.toFixed(2), 145, currentY);
      doc.text(item.lineTotal.toFixed(2), 175, currentY);

      totalVal += item.lineTotal;
      doc.setDrawColor(230, 230, 230);
      doc.line(15, currentY + 3, 195, currentY + 3);
    });

    const finalY = startY + items.length * 10 + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', 140, finalY);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${totalVal.toLocaleString('en-IN')}`, 170, finalY);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'This is a computer generated invoice valid without signature.',
      105, finalY + 20, { align: 'center' }
    );

    doc.save(`${billId}.pdf`);
  } catch (error) {
    console.error('PDF Generation failed:', error);
  }
};

// ── Purchase Order PDF (new) ───────────────────────────────────────────────
export interface PurchaseOrderParams {
  poId: string;
  store: Store;
  manager: UserProfile;
  storeName: string;
  lineItems: OrderLineItem[];
  urgency: string;
  notes?: string;
}

export const generatePurchaseOrderPDF = ({
  poId, store, manager, storeName, lineItems, urgency, notes,
}: PurchaseOrderParams) => {
  try {
    const doc = new jsPDF();
    const totalValue = lineItems.reduce((s, i) => s + i.lineTotal, 0);
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    // ── Header bar ──────────────────────────────────────────
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('VEDA', 15, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 170, 200);
    doc.text('Hospital Pharmacy Intelligence System', 15, 31);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE ORDER', 140, 18);

    const urgColor = urgency === 'critical' ? [239, 68, 68] :
                     urgency === 'urgent'   ? [245, 158, 11] :
                                             [59, 130, 246];
    doc.setFillColor(...(urgColor as [number, number, number]));
    doc.roundedRect(139, 22, 56, 10, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(urgency.toUpperCase(), 167, 28.5, { align: 'center' });

    // ── PO details block ─────────────────────────────────────
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(store.hospitalName || 'Hospital', 15, 56);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Pharmacy: ${storeName}`, 15, 63);
    doc.text(store.location || '', 15, 69);
    doc.text(`Contact: ${store.contact || ''}`, 15, 75);

    // Right: PO meta
    const rightX = 130;
    doc.setFontSize(9);
    const metaRows = [
      ['PO Number:', poId],
      ['Date:', today],
      ['Raised by:', manager.name],
      ['Approval:', totalValue > 50000 ? 'Admin required' : 'Auto-approved'],
    ];
    metaRows.forEach(([label, val], i) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label, rightX, 56 + i * 7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(val, rightX + 32, 56 + i * 7);
    });

    // ── Divider ───────────────────────────────────────────────
    doc.setDrawColor(200, 210, 220);
    doc.line(15, 83, 195, 83);

    // ── Line items table ──────────────────────────────────────
    const tableTop = 88;
    doc.setFillColor(235, 242, 252);
    doc.rect(15, tableTop, 180, 9, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 80, 140);
    doc.text('#',   18, tableTop + 6);
    doc.text('Medicine / Generic Name', 25, tableTop + 6);
    doc.text('Supplier', 108, tableTop + 6);
    doc.text('Qty', 143, tableTop + 6);
    doc.text('Unit Price', 155, tableTop + 6);
    doc.text('Line Total', 178, tableTop + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(8.5);

    let rowY = tableTop + 14;
    lineItems.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 253);
        doc.rect(15, rowY - 5, 180, 9, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(String(idx + 1), 18, rowY);

      const nameDisplay = item.medicineName.length > 30
        ? item.medicineName.substring(0, 29) + '…'
        : item.medicineName;
      doc.text(nameDisplay, 25, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const genDisplay = (item.genericName || '').length > 20
        ? item.genericName.substring(0, 19) + '…'
        : item.genericName || '';
      doc.setFontSize(7.5);
      doc.text(genDisplay, 25, rowY + 4);
      doc.setFontSize(8.5);

      doc.setTextColor(30, 30, 30);
      const supDisplay = (item.supplier || '').length > 14
        ? item.supplier.substring(0, 13) + '…'
        : item.supplier || '';
      doc.text(supDisplay, 108, rowY);
      doc.text(`${item.quantity} ${item.unit}`, 143, rowY);
      doc.text(`₹${item.unitPrice.toFixed(2)}`, 155, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 120, 80);
      doc.text(`₹${item.lineTotal.toLocaleString('en-IN')}`, 178, rowY);

      doc.setDrawColor(220, 228, 238);
      doc.line(15, rowY + 6, 195, rowY + 6);

      rowY += 12;
    });

    // ── Totals block ───────────────────────────────────────────
    const totY = rowY + 6;
    doc.setDrawColor(180, 195, 215);
    doc.line(120, totY - 2, 195, totY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Subtotal:', 130, totY + 6);
    doc.setTextColor(30, 30, 30);
    doc.text(`₹${totalValue.toLocaleString('en-IN')}`, 178, totY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(10, 15, 30);
    doc.text('Grand Total:', 130, totY + 15);
    doc.setTextColor(16, 120, 80);
    doc.text(`₹${totalValue.toLocaleString('en-IN')}`, 178, totY + 15);

    // ── Notes ─────────────────────────────────────────────────
    if (notes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Notes: ${notes}`, 15, totY + 28);
    }

    // ── Footer ─────────────────────────────────────────────────
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 275, 210, 22, 'F');
    doc.setTextColor(150, 170, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'This is a system-generated Purchase Order. Authorized by Veda Pharmacy Intelligence.',
      105, 284, { align: 'center' }
    );
    doc.text(
      `${storeName} · ${today} · ${poId}`,
      105, 290, { align: 'center' }
    );

    doc.save(`${poId}.pdf`);
  } catch (err) {
    console.error('PO PDF generation failed:', err);
  }
};
