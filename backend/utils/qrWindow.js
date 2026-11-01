const DEFAULT_TIMEZONE =
  process.env.APP_TIMEZONE || process.env.TZ || 'Europe/Kyiv';

function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 8);
  }
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00`;
  }
  return raw;
}

function getDateTimePartsInZone(date, timeZone) {
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

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}:${parts.second}`,
  };
}

function resolveNowAndZone(nowOrOptions) {
  if (nowOrOptions instanceof Date) {
    return { now: nowOrOptions, timeZone: DEFAULT_TIMEZONE };
  }

  if (nowOrOptions && typeof nowOrOptions === 'object') {
    return {
      now: nowOrOptions.now instanceof Date ? nowOrOptions.now : new Date(),
      timeZone: nowOrOptions.timeZone || DEFAULT_TIMEZONE,
    };
  }

  return { now: new Date(), timeZone: DEFAULT_TIMEZONE };
}

function getQrWindowStatus(lessonDate, startTime, endTime, nowOrOptions) {
  const { now, timeZone } = resolveNowAndZone(nowOrOptions);
  const lessonDateStr = String(lessonDate).slice(0, 10);
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(lessonDateStr) ||
    !/^\d{2}:\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}:\d{2}$/.test(end)
  ) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Невірний час заняття',
      timeZone,
    };
  }

  const nowParts = getDateTimePartsInZone(now, timeZone);

  if (
    nowParts.date < lessonDateStr ||
    (nowParts.date === lessonDateStr && nowParts.time < start)
  ) {
    return {
      ok: false,
      reason: 'before',
      message: 'QR-код ще не активний. Відмітка доступна з початку пари',
      timeZone,
      nowLocal: `${nowParts.date} ${nowParts.time}`,
    };
  }

  if (
    nowParts.date > lessonDateStr ||
    (nowParts.date === lessonDateStr && nowParts.time > end)
  ) {
    return {
      ok: false,
      reason: 'after',
      message: 'QR-код уже неактивний. Час пари закінчився',
      timeZone,
      nowLocal: `${nowParts.date} ${nowParts.time}`,
    };
  }

  return {
    ok: true,
    reason: 'active',
    message: 'QR-код активний',
    timeZone,
    nowLocal: `${nowParts.date} ${nowParts.time}`,
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  normalizeTime,
  getDateTimePartsInZone,
  getQrWindowStatus,
};
