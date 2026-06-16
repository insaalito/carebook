/**
 * Converts a 24-hour time string "HH:MM" to AM/PM format.
 * Used site-wide — all time displays must use this function.
 */
export function formatAmPm(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}