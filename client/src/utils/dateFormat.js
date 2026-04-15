import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? format(d, fmt) : '—';
  } catch {
    return '—';
  }
};

export const formatDateTime = (date) => formatDate(date, 'dd MMM yyyy, hh:mm a');

export const formatTimeAgo = (date) => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '';
  } catch {
    return '';
  }
};

export const formatCurrency = (amount) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (n) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
};

export const toInputDate = (date) => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
  } catch {
    return '';
  }
};

export const daysAgo = (date) => {
  if (!date) return 0;
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

export const getMonthName = (month) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[(month ?? 1) - 1] ?? '';
};
