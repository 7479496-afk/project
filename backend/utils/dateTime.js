const DEFAULT_TIMEZONE =
  process.env.APP_TIMEZONE || process.env.TZ || 'Europe/Kyiv';

function parseDbDateTimeAsUtc(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(`${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInTimeZone(value, timeZone = DEFAULT_TIMEZONE) {
  const date = parseDbDateTimeAsUtc(value);
  if (!date) return value == null ? null : String(value);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

module.exports = {
  DEFAULT_TIMEZONE,
  parseDbDateTimeAsUtc,
  formatInTimeZone,
};
