import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'gitea_metrics_settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getDateRangeStart(range: AppSettings['dateRange']): Date {
  const now = new Date();
  const days = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365 }[range];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
