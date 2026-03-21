import { format } from 'date-fns';

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInventoryCSV(medicines: any[], batches: any[], storeName: string) {
  const headers = ['Medicine', 'Generic Name', 'Category', 'Unit', 'Total Stock', 'Unit Price (₹)', 'Total Value (₹)', 'Reorder Threshold', 'Status'];
  const rows = medicines.map(med => {
    const totalStock = batches.filter((b: any) => b.medicineId === med.id).reduce((acc: number, b: any) => acc + b.quantity, 0);
    const totalValue = totalStock * med.unitPrice;
    const status = totalStock < med.reorderThreshold ? 'Low Stock' : 'Healthy';
    return [med.name, med.genericName, med.category, med.unit, totalStock, med.unitPrice.toFixed(2), totalValue.toFixed(2), med.reorderThreshold, status];
  });
  exportToCSV(`inventory-${storeName}`, headers, rows);
}

export function exportBatchesCSV(batches: any[], medicines: any[], storeName: string) {
  const headers = ['Batch Number', 'Medicine', 'Quantity', 'Expiry Date', 'Days Left', 'Location', 'Purchase Price (₹)', 'Status'];
  const rows = batches.map(b => {
    const med = medicines.find((m: any) => m.id === b.medicineId);
    const daysLeft = Math.round((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const location = b.location ? `${b.location.aisle}/${b.location.row}/${b.location.shelf}/${b.location.compartment}` : 'N/A';
    const status = daysLeft <= 7 ? 'Critical' : daysLeft <= 30 ? 'Warning' : 'Safe';
    return [b.batchNumber, med?.name || 'Unknown', b.quantity, format(new Date(b.expiryDate), 'dd MMM yyyy'), daysLeft, location, b.purchasePrice?.toFixed(2) || '0', status];
  });
  exportToCSV(`batches-${storeName}`, headers, rows);
}

export function exportDispenseLogsCSV(logs: any[], storeName: string) {
  const headers = ['Timestamp', 'Medicine', 'Quantity', 'Total Value (₹)', 'Patient Ref', 'Pharmacist', 'FEFO Compliant'];
  const rows = logs.map(log => [
    format(new Date(log.timestamp), 'dd MMM yyyy HH:mm'),
    log.medicineName || '',
    log.quantity,
    log.totalValue?.toFixed(2) || '0',
    log.patientRef || 'N/A',
    log.pharmacistName || '',
    log.fefoCompliant !== false ? 'Yes' : 'No'
  ]);
  exportToCSV(`dispense-logs-${storeName}`, headers, rows);
}

export function exportWasteCSV(wasteRecords: any[], medicines: any[], storeName: string) {
  const headers = ['Date', 'Medicine', 'Batch', 'Quantity Wasted', 'Waste Value (₹)', 'Reason'];
  const rows = wasteRecords.map(w => {
    const med = medicines.find((m: any) => m.id === w.medicineId);
    return [
      format(new Date(w.recordedAt), 'dd MMM yyyy'),
      med?.name || 'Unknown',
      w.batchId?.slice(0, 8) || 'N/A',
      w.quantity,
      w.wasteValue?.toFixed(2) || '0',
      w.reason
    ];
  });
  exportToCSV(`waste-records-${storeName}`, headers, rows);
}
