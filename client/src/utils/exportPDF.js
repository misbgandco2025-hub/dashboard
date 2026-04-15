import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatDateTime } from './dateFormat';

const addHeader = (doc, title) => {
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('Task Management System', 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81);
  doc.text(title, 14, 28);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 36);
  doc.setDrawColor(219, 234, 254);
  doc.line(14, 40, 196, 40);
};

export const exportTableToPDF = (title, columns, rows, filename = 'report') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addHeader(doc, title);

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => c.accessor(row) ?? '—')),
    startY: 45,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportTimelineToPDF = (applicationId, timeline) => {
  const doc = new jsPDF();
  addHeader(doc, `Timeline — ${applicationId}`);

  let y = 50;
  doc.setFontSize(9);

  timeline.forEach((entry, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(37, 99, 235);
    doc.text(`${idx + 1}. ${entry.activityType?.toUpperCase() ?? 'NOTE'}`, 14, y);
    doc.setTextColor(55, 65, 81);
    doc.text(entry.activity, 20, y + 5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${formatDateTime(entry.activityDate)} — ${entry.performedBy?.fullName ?? 'System'}`, 20, y + 10);
    if (entry.remarks) {
      doc.text(`Remarks: ${entry.remarks}`, 20, y + 15);
      y += 20;
    } else {
      y += 16;
    }
  });

  doc.save(`timeline-${applicationId}.pdf`);
};
