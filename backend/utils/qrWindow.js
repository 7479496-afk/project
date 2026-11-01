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

function toLessonDateTime(lessonDate, timeValue) {
  const dateStr = String(lessonDate).slice(0, 10);
  const timeStr = normalizeTime(timeValue);
  return new Date(`${dateStr}T${timeStr}`);
}

function getQrWindowStatus(lessonDate, startTime, endTime, now = new Date()) {
  const startsAt = toLessonDateTime(lessonDate, startTime);
  const endsAt = toLessonDateTime(lessonDate, endTime);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Невірний час заняття',
      startsAt: null,
      endsAt: null,
    };
  }

  if (now < startsAt) {
    return {
      ok: false,
      reason: 'before',
      message: 'QR-код ще не активний. Відмітка доступна з початку пари',
      startsAt,
      endsAt,
    };
  }

  if (now > endsAt) {
    return {
      ok: false,
      reason: 'after',
      message: 'QR-код уже неактивний. Час пари закінчився',
      startsAt,
      endsAt,
    };
  }

  return {
    ok: true,
    reason: 'active',
    message: 'QR-код активний',
    startsAt,
    endsAt,
  };
}

module.exports = {
  normalizeTime,
  toLessonDateTime,
  getQrWindowStatus,
};
