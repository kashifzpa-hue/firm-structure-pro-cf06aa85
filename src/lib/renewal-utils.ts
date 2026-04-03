import { addMonths, format, parseISO } from "date-fns";

export type RenewalFrequency = 'none' | 'annual' | 'biennial' | 'triennial' | 'quinquennial' | 'decennial' | 'custom';

export const RENEWAL_OPTIONS: { value: RenewalFrequency; label: string; months?: number }[] = [
  { value: 'none', label: 'No renewal', months: 0 },
  { value: 'annual', label: 'Annual (every 12 months)', months: 12 },
  { value: 'biennial', label: 'Every 2 years', months: 24 },
  { value: 'triennial', label: 'Every 3 years', months: 36 },
  { value: 'quinquennial', label: 'Every 5 years', months: 60 },
  { value: 'decennial', label: 'Every 10 years', months: 120 },
  { value: 'custom', label: 'Custom interval' },
];

export const RENEWAL_LABEL_MAP: Record<RenewalFrequency, string> = {
  none: '—',
  annual: 'Annual',
  biennial: 'Every 2 years',
  triennial: 'Every 3 years',
  quinquennial: 'Every 5 years',
  decennial: 'Every 10 years',
  custom: 'Custom',
};

export const DOC_TYPE_PRESETS: Record<string, { frequency: RenewalFrequency; months?: number }> = {
  'Trade License': { frequency: 'annual' },
  'Passport': { frequency: 'custom', months: 60 },
  'Emirates ID': { frequency: 'custom', months: 36 },
  'Residency Visa': { frequency: 'custom', months: 24 },
  'VAT Registration': { frequency: 'none' },
  'Certificate of Incorporation': { frequency: 'none' },
  'Memorandum of Association': { frequency: 'none' },
  'Articles of Association': { frequency: 'none' },
  'Audit Report': { frequency: 'annual' },
  'Tenancy Contract': { frequency: 'annual' },
  'Power of Attorney': { frequency: 'custom', months: 12 },
  'Tax Registration Certificate': { frequency: 'none' },
  'Other': { frequency: 'none' },
  'National ID': { frequency: 'custom', months: 36 },
  'Driving License': { frequency: 'custom', months: 60 },
};

export function getFrequencyMonths(frequency: RenewalFrequency, customMonths?: number | null): number | null {
  if (frequency === 'none') return null;
  if (frequency === 'custom') return customMonths || null;
  const option = RENEWAL_OPTIONS.find(o => o.value === frequency);
  return option?.months || null;
}

export function calculateNextExpiry(expiryDate: string, frequency: RenewalFrequency, customMonths?: number | null): string | null {
  const months = getFrequencyMonths(frequency, customMonths);
  if (!months || !expiryDate) return null;
  try {
    const date = parseISO(expiryDate);
    return format(addMonths(date, months), 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

export function getFrequencyLabel(frequency: RenewalFrequency | null | undefined, customMonths?: number | null): string {
  if (!frequency || frequency === 'none') return '—';
  if (frequency === 'custom' && customMonths) return `Every ${customMonths} months`;
  return RENEWAL_LABEL_MAP[frequency] || '—';
}
