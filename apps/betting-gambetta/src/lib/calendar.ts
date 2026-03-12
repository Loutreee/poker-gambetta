/**
 * Génère un fichier .ics (iCalendar) pour un match, et retourne une URL de téléchargement.
 */
export function getMatchCalendarUrl(match: {
  title?: string | null;
  opponent: string;
  format?: string;
  scheduledAt: string;
}): string {
  const start = new Date(match.scheduledAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2h par défaut
  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const summary = match.title
    ? `${match.title} — ArcMonkey vs ${match.opponent}`
    : `ArcMonkey vs ${match.opponent} (${match.format ?? "BO3"})`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Betting Gambetta//Match//FR",
    "BEGIN:VEVENT",
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${summary.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}
