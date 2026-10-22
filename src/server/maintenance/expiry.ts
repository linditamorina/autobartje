/** Days before an expiry when the office gets a reminder (0 = the day it expires). */
export const REMINDER_DAYS = [30, 7, 1, 0] as const;

export interface ExpiryItem {
  who: string;
  kind: string;
  date: Date;
}

/** Items whose reminder falls on `todayStart` (start of the business day). */
export function remindersDue(items: ExpiryItem[], todayStart: Date): (ExpiryItem & { daysLeft: number })[] {
  return items
    .map((i) => ({ ...i, daysLeft: Math.floor((i.date.getTime() - todayStart.getTime()) / 86_400_000) }))
    .filter((i) => (REMINDER_DAYS as readonly number[]).includes(i.daysLeft))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
