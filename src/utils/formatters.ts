export { parseRemainingLeaseToYears } from './dataProcessor.ts';

export const formatCompactCurrency = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'SGD',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value).replace(/SGD\s?/, '$');
};

export const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || isNaN(value)) return 'N/A';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).replace(/SGD\s?/, '$');
};

export const formatPsf = (value: number | undefined): string => {
  if (value === undefined || isNaN(value)) return 'N/A';
  return `${formatCurrency(value)}/psf`;
};

export const formatNumber = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return 'N/A';
    return value.toLocaleString('en-US');
};

export const formatMonthYear = (monthStr: string | undefined): string => {
    if (!monthStr) return '';
    const date = new Date(`${monthStr}-01T12:00:00Z`); // Use a specific time to avoid timezone issues
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
};

export const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
};