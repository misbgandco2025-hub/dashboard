import * as XLSX from 'xlsx';
import { formatDate } from './dateFormat';

export const exportToExcel = (title, sheets, filename = 'report') => {
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, columns, data }) => {
    const header = columns.map((c) => c.header);
    const rows = data.map((row) => columns.map((c) => c.accessor(row) ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Column widths
    ws['!cols'] = columns.map(() => ({ wch: 20 }));

    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });

  XLSX.writeFile(wb, `${filename}-${formatDate(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportSingleSheet = (title, columns, data, filename = 'export') => {
  exportToExcel(title, [{ name: title, columns, data }], filename);
};
