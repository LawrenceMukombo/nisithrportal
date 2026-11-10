/**
 * Timezone utilities for Papua New Guinea (Pacific/Port_Moresby, UTC+10).
 * NISIT operations and statutory General Orders evaluate working hours,
 * daily punch calendars, and overtime in PNG Standard Time.
 */

export const PNG_TIMEZONE = "Pacific/Port_Moresby";

/**
 * Returns the calendar date formatted as YYYY-MM-DD in Papua New Guinea time.
 */
export function getPngTodayDateStr(dateInput: Date | string | number | null = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return new Intl.DateTimeFormat("en-CA", { timeZone: PNG_TIMEZONE }).format(new Date());
  return new Intl.DateTimeFormat("en-CA", { timeZone: PNG_TIMEZONE }).format(d);
}

/**
 * Extracts hour (0-23), minute (0-59), and second (0-59) in PNG time.
 */
export function getPngTimeParts(dateInput: Date | string | number | null = new Date()): {
  hour: number;
  minute: number;
  second: number;
} {
  const d = dateInput instanceof Date ? dateInput : dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PNG_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(validDate);

  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === "hour") {
      hour = parseInt(part.value, 10);
      if (hour === 24) hour = 0; // standard 24h normalization
    } else if (part.type === "minute") {
      minute = parseInt(part.value, 10);
    } else if (part.type === "second") {
      second = parseInt(part.value, 10);
    }
  }

  return { hour, minute, second };
}

/**
 * Calculates late minutes against PNG Public Service standard morning start (default 08:00 AM).
 */
export function getPngLateMinutes(
  dateInput: Date | string | number | null = new Date(),
  expectedHour: number = 8,
  expectedMinute: number = 0
): number {
  const { hour, minute } = getPngTimeParts(dateInput);
  if (hour > expectedHour || (hour === expectedHour && minute > expectedMinute)) {
    return (hour - expectedHour) * 60 + (minute - expectedMinute);
  }
  return 0;
}

/**
 * Calculates overtime minutes in PNG time (default kicks in after 16:30 PM).
 */
export function getPngOvertimeMinutes(
  dateInput: Date | string | number | null = new Date(),
  departHour: number = 16,
  departMin: number = 30
): number {
  const { hour, minute } = getPngTimeParts(dateInput);
  if (hour > departHour || (hour === departHour && minute > departMin)) {
    return (hour - departHour) * 60 + (minute - departMin);
  }
  return 0;
}

/**
 * Calculates early departure minutes against PNG Public Service finish (16:06 PM).
 */
export function getPngEarlyDepartureMinutes(
  dateInput: Date | string | number | null = new Date(),
  standardDepartHour: number = 16,
  standardDepartMin: number = 6
): number {
  const { hour, minute } = getPngTimeParts(dateInput);
  if (hour < standardDepartHour || (hour === standardDepartHour && minute < standardDepartMin)) {
    return (standardDepartHour - hour) * 60 + (standardDepartMin - minute);
  }
  return 0;
}

