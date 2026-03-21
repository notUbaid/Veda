import jsPDF from 'jspdf';
import { Store, UserProfile } from '../types';

interface BillItem {
    medicineName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    batchNumbers: string;
}

export const generateDispenseBill = (
    billId: string, 
    store: Store, 
    pharmacist: UserProfile, 
    items: BillItem[], 
    patientRef: string
) => {
    try {
        const doc = new jsPDF();
        
        // --- Header ---
        doc.setFillColor(10, 15, 30); // Very dark navy
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

        // --- Store Info ---
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(store.hospitalName, 15, 55);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(store.name, 15, 62);
        doc.text(store.location, 15, 68);
        doc.text(`Contact: ${store.contact}`, 15, 74);

        // --- Bill Info ---
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

        // --- Items Table Header ---
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

        // --- Items Rows ---
        startY += 15;
        doc.setFont('helvetica', 'normal');
        let totalVal = 0;
        
        items.forEach((item, i) => {
            const currentY = startY + (i * 10);
            
            // Truncate medicine name if too long
            const medName = item.medicineName.length > 25 ? item.medicineName.substring(0, 25) + '...' : item.medicineName;
            
            doc.text(medName, 20, currentY);
            doc.text(item.batchNumbers, 75, currentY);
            doc.text(`${item.quantity} ${item.unit}`, 125, currentY);
            doc.text((item.unitPrice).toFixed(2), 145, currentY);
            doc.text((item.lineTotal).toFixed(2), 175, currentY);
            
            totalVal += item.lineTotal;
            
            // Subtle horizontal line
            doc.setDrawColor(230, 230, 230);
            doc.line(15, currentY + 3, 195, currentY + 3);
        });

        // --- Totals ---
        const finalY = startY + (items.length * 10) + 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Grand Total:', 140, finalY);
        doc.setTextColor(16, 185, 129); // Emerald Green
        doc.text(`Rs. ${totalVal.toLocaleString('en-IN')}`, 170, finalY);

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('This is a computer generated invoice valid without signature.', 105, finalY + 20, { align: 'center' });

        doc.save(`${billId}.pdf`);
    } catch (error) {
        console.error("PDF Generation failed:", error);
    }
};
