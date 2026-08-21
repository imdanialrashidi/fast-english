import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDuration, formatDurationDays } from './date';

describe('shared/lib/date', () => {
  it('formatDateTime short style', () => {
    const v = formatDateTime('2024-01-01T00:00:00.000Z', { style: 'short', fallback: '—' });
    expect(v).not.toBe('—');
    expect(v.length).toBeGreaterThan(0);
  });

  it('formatDateTime long style', () => {
    const v = formatDateTime('2024-01-01T14:30:00.000Z', { style: 'long', fallback: '—' });
    expect(v).not.toBe('—');
    expect(v.length).toBeGreaterThan(0);
  });

  it('formatDate', () => {
    const v = formatDate('2024-01-01T00:00:00.000Z');
    expect(v).not.toBe('—');
  });

  it('formatDuration 61 -> 01:01', () => {
    expect(formatDuration(61)).toBe('01:01');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-5, { fallback: '—' })).toBe('—');
  });

  it('formatDurationDays', () => {
    expect(formatDurationDays(30)).toMatch(/۳۰ روز/);
    expect(formatDurationDays(0, { fallback: '—' })).toBe('—');
  });

  it('fallback handling', () => {
    expect(formatDateTime(null, { fallback: '—' })).toBe('—');
    expect(formatDate(null, { fallback: '—' })).toBe('—');
    expect(formatDateTime('', { fallback: '—' })).toBe('—');
  });
});
