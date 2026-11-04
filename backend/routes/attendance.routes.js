const express = require('express');
const { pool } = require('../db/pool');
const { isWithinRadius } = require('../utils/geo');
const { getQrWindowStatus } = require('../utils/qrWindow');
const { formatInTimeZone } = require('../utils/dateTime');
const {
  requireAuth,
  requireRole,
} = require('../middleware/auth.middleware');

const router = express.Router();

function toAttendance(row) {
  const isGuest = row.student_id == null;
  return {
    id: row.id,
    lessonId: row.lesson_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email || null,
    guestGroupName: row.guest_group_name || null,
    isGuest,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    checkedInAt: formatInTimeZone(row.checked_in_at),
    lessonDate: row.lesson_date,
    startTime: row.start_time ? String(row.start_time).slice(0, 8) : undefined,
    endTime: row.end_time ? String(row.end_time).slice(0, 8) : undefined,
    locationName: row.location_name,
    disciplineName: row.discipline_name,
    groupName: row.group_name,
  };
}

function parseOptionalCoord(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function lessonRequiresGeo(lesson) {
  return lesson.latitude != null && lesson.longitude != null;
}

function normalizePersonName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateCoordsPair(latitude, longitude) {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { error: 'Широта і довгота мають бути числами' };
  }

  if (
    (latitude === null && longitude !== null) ||
    (latitude !== null && longitude === null)
  ) {
    return { error: 'Передайте обидві координати або жодної' };
  }

  return null;
}

async function findLessonByQrToken(qrToken) {
  const [lessonRows] = await pool.query(
    `SELECT
       id, group_id, latitude, longitude, radius_meters,
       lesson_date, start_time, end_time, location_name, is_archived
     FROM lessons
     WHERE qr_token = ?
     LIMIT 1`,
    [qrToken]
  );
  return lessonRows[0] || null;
}

function assertLessonOpenForCheckIn(lesson) {
  if (Number(lesson.is_archived) === 1) {
    return {
      status: 403,
      body: { ok: false, message: 'Це заняття в архіві' },
    };
  }

  const qrWindow = getQrWindowStatus(
    lesson.lesson_date,
    lesson.start_time,
    lesson.end_time
  );

  if (!qrWindow.ok) {
    return {
      status: 403,
      body: {
        ok: false,
        message: qrWindow.message,
        reason: qrWindow.reason,
      },
    };
  }

  return null;
}

function assertGeoForLesson(lesson, latitude, longitude) {
  if (!lessonRequiresGeo(lesson)) {
    return null;
  }

  if (latitude === null || longitude === null) {
    return {
      status: 400,
      body: {
        ok: false,
        message: 'Для цього заняття потрібна геолокація',
      },
    };
  }

  const geoCheck = isWithinRadius(
    Number(lesson.latitude),
    Number(lesson.longitude),
    latitude,
    longitude,
    Number(lesson.radius_meters || 100)
  );

  if (!geoCheck.ok) {
    return {
      status: 403,
      body: {
        ok: false,
        message: 'Ви занадто далеко від місця заняття',
        distanceMeters: Math.round(geoCheck.distanceMeters),
        allowedRadiusMeters: geoCheck.allowedRadiusMeters,
      },
    };
  }

  return null;
}

const ATTENDANCE_SELECT = `
  SELECT
    a.id, a.lesson_id, a.student_id, a.guest_full_name, a.guest_group_name,
    a.latitude, a.longitude, a.checked_in_at,
    l.lesson_date, l.start_time, l.end_time, l.location_name,
    d.name AS discipline_name,
    g.name AS group_name,
    COALESCE(u.full_name, a.guest_full_name) AS student_name,
    u.email AS student_email
  FROM attendances a
  JOIN lessons l ON l.id = a.lesson_id
  JOIN disciplines d ON d.id = l.discipline_id
  LEFT JOIN study_groups g ON g.id = l.group_id
  LEFT JOIN users u ON u.id = a.student_id
`;

router.post(
  '/attendance/check-in',
  requireAuth,
  requireRole('student'),
  async (req, res) => {
    const qrToken = String(req.body.qrToken || '').trim();
    const latitude = parseOptionalCoord(req.body.latitude);
    const longitude = parseOptionalCoord(req.body.longitude);

    if (!qrToken) {
      return res.status(400).json({
        ok: false,
        message: 'Потрібен QR-код',
      });
    }

    const coordsError = validateCoordsPair(latitude, longitude);
    if (coordsError) {
      return res.status(400).json({ ok: false, message: coordsError.error });
    }

    try {
      const [studentRows] = await pool.query(
        `SELECT id, full_name, group_id
         FROM users
         WHERE id = ? AND role = 'student'
         LIMIT 1`,
        [req.user.id]
      );

      if (studentRows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Студента не знайдено',
        });
      }

      const student = studentRows[0];
      const lesson = await findLessonByQrToken(qrToken);

      if (!lesson) {
        return res.status(404).json({
          ok: false,
          message: 'Невірний QR-код заняття',
        });
      }

      const openError = assertLessonOpenForCheckIn(lesson);
      if (openError) {
        return res.status(openError.status).json(openError.body);
      }

      if (lesson.group_id !== null) {
        if (!student.group_id) {
          return res.status(400).json({
            ok: false,
            message: 'Студенту не призначено групу',
          });
        }

        if (Number(lesson.group_id) !== Number(student.group_id)) {
          return res.status(403).json({
            ok: false,
            message: 'Це заняття для іншої групи',
          });
        }
      }

      const [existingRows] = await pool.query(
        `SELECT id FROM attendances
         WHERE lesson_id = ? AND student_id = ?
         LIMIT 1`,
        [lesson.id, student.id]
      );

      if (existingRows.length > 0) {
        return res.status(409).json({
          ok: false,
          message: 'Присутність на цьому занятті вже зареєстровано',
        });
      }

      const geoError = assertGeoForLesson(lesson, latitude, longitude);
      if (geoError) {
        return res.status(geoError.status).json(geoError.body);
      }

      const [result] = await pool.query(
        `INSERT INTO attendances (
           lesson_id, student_id, guest_full_name, guest_group_name,
           latitude, longitude
         ) VALUES (?, ?, NULL, NULL, ?, ?)`,
        [lesson.id, student.id, latitude, longitude]
      );

      const [rows] = await pool.query(
        `${ATTENDANCE_SELECT} WHERE a.id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        ok: true,
        message: 'Присутність успішно зареєстровано',
        attendance: toAttendance(rows[0]),
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          ok: false,
          message: 'Присутність на цьому занятті вже зареєстровано',
        });
      }
      console.error(error);
      return res.status(500).json({
        ok: false,
        message: 'Не вдалося зареєструвати присутність',
      });
    }
  }
);

router.post('/attendance/guest-check-in', async (req, res) => {
  const qrToken = String(req.body.qrToken || '').trim();
  const guestFullName = normalizePersonName(req.body.fullName);
  const guestGroupName = normalizePersonName(req.body.groupName) || null;
  const latitude = parseOptionalCoord(req.body.latitude);
  const longitude = parseOptionalCoord(req.body.longitude);

  if (!qrToken) {
    return res.status(400).json({
      ok: false,
      message: 'Потрібен QR-код',
    });
  }

  if (!guestFullName || guestFullName.length < 2) {
    return res.status(400).json({
      ok: false,
      message: 'Вкажіть прізвище та імʼя',
    });
  }

  const coordsError = validateCoordsPair(latitude, longitude);
  if (coordsError) {
    return res.status(400).json({ ok: false, message: coordsError.error });
  }

  try {
    const lesson = await findLessonByQrToken(qrToken);

    if (!lesson) {
      return res.status(404).json({
        ok: false,
        message: 'Невірний QR-код заняття',
      });
    }

    const openError = assertLessonOpenForCheckIn(lesson);
    if (openError) {
      return res.status(openError.status).json(openError.body);
    }

    const [existingRows] = await pool.query(
      `SELECT id FROM attendances
       WHERE lesson_id = ? AND guest_full_name = ?
       LIMIT 1`,
      [lesson.id, guestFullName]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Присутність з цим ПІБ на занятті вже зареєстровано',
      });
    }

    const geoError = assertGeoForLesson(lesson, latitude, longitude);
    if (geoError) {
      return res.status(geoError.status).json(geoError.body);
    }

    const [result] = await pool.query(
      `INSERT INTO attendances (
         lesson_id, student_id, guest_full_name, guest_group_name,
         latitude, longitude
       ) VALUES (?, NULL, ?, ?, ?, ?)`,
      [lesson.id, guestFullName, guestGroupName, latitude, longitude]
    );

    const [rows] = await pool.query(`${ATTENDANCE_SELECT} WHERE a.id = ?`, [
      result.insertId,
    ]);

    return res.status(201).json({
      ok: true,
      message: 'Присутність успішно зареєстровано',
      attendance: toAttendance(rows[0]),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Присутність з цим ПІБ на занятті вже зареєстровано',
      });
    }
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: 'Не вдалося зареєструвати присутність',
    });
  }
});

router.get(
  '/attendance/me',
  requireAuth,
  requireRole('student'),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `${ATTENDANCE_SELECT}
         WHERE a.student_id = ?
         ORDER BY l.lesson_date DESC, l.start_time DESC`,
        [req.user.id]
      );

      return res.json({
        ok: true,
        attendances: rows.map(toAttendance),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        message: 'Не вдалося завантажити історію відвідувань',
      });
    }
  }
);

router.get(
  '/lessons/:id/attendances',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    const lessonId = Number(req.params.id);

    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'Невірний id заняття',
      });
    }

    try {
      const [lessonRows] = await pool.query(
        `SELECT id, teacher_id FROM lessons WHERE id = ? LIMIT 1`,
        [lessonId]
      );

      if (lessonRows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Заняття не знайдено',
        });
      }

      if (Number(lessonRows[0].teacher_id) !== Number(req.user.id)) {
        return res.status(403).json({
          ok: false,
          message: 'Немає доступу до цього заняття',
        });
      }

      const [rows] = await pool.query(
        `SELECT
           a.id, a.lesson_id, a.student_id, a.guest_full_name, a.guest_group_name,
           a.latitude, a.longitude, a.checked_in_at,
           COALESCE(u.full_name, a.guest_full_name) AS student_name,
           u.email AS student_email
         FROM attendances a
         LEFT JOIN users u ON u.id = a.student_id
         WHERE a.lesson_id = ?
         ORDER BY a.checked_in_at`,
        [lessonId]
      );

      return res.json({
        ok: true,
        lessonId,
        attendances: rows.map(toAttendance),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        message: 'Не вдалося завантажити список присутніх',
      });
    }
  }
);

router.get(
  '/attendance/journal',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    const disciplineIdRaw = req.query.disciplineId;
    const disciplineId =
      disciplineIdRaw === undefined || disciplineIdRaw === ''
        ? null
        : Number(disciplineIdRaw);

    if (
      disciplineIdRaw !== undefined &&
      disciplineIdRaw !== '' &&
      (!Number.isInteger(disciplineId) || disciplineId <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Невірний id дисципліни',
      });
    }

    try {
      const lessonParams = [req.user.id];
      let disciplineFilter = '';

      if (disciplineId !== null) {
        disciplineFilter = ' AND l.discipline_id = ?';
        lessonParams.push(disciplineId);
      }

      const [lessonRows] = await pool.query(
        `SELECT
           l.id,
           l.discipline_id,
           d.name AS discipline_name,
           l.group_id,
           g.name AS group_name,
           l.lesson_date,
           l.start_time,
           l.end_time,
           l.is_archived
         FROM lessons l
         JOIN disciplines d ON d.id = l.discipline_id
         LEFT JOIN study_groups g ON g.id = l.group_id
         WHERE l.teacher_id = ?${disciplineFilter}
         ORDER BY l.lesson_date ASC, l.start_time ASC, l.id ASC`,
        lessonParams
      );

      const lessons = lessonRows.map((row) => ({
        id: row.id,
        disciplineId: row.discipline_id,
        disciplineName: row.discipline_name,
        groupId: row.group_id,
        groupName: row.group_name,
        lessonDate: row.lesson_date,
        startTime: String(row.start_time).slice(0, 8),
        endTime: String(row.end_time).slice(0, 8),
        isArchived: Boolean(row.is_archived),
      }));

      if (lessons.length === 0) {
        return res.json({
          ok: true,
          lessons: [],
          people: [],
        });
      }

      const lessonIds = lessons.map((lesson) => lesson.id);
      const placeholders = lessonIds.map(() => '?').join(', ');

      const [attendanceRows] = await pool.query(
        `SELECT
           a.lesson_id,
           a.student_id,
           a.guest_full_name,
           a.guest_group_name,
           a.checked_in_at,
           COALESCE(u.full_name, a.guest_full_name) AS person_name,
           u.email AS student_email,
           sg.name AS student_group_name
         FROM attendances a
         LEFT JOIN users u ON u.id = a.student_id
         LEFT JOIN study_groups sg ON sg.id = u.group_id
         WHERE a.lesson_id IN (${placeholders})
         ORDER BY a.checked_in_at ASC`,
        lessonIds
      );

      const groupIds = [
        ...new Set(
          lessons
            .map((lesson) => lesson.groupId)
            .filter((id) => id != null)
        ),
      ];

      let rosterRows = [];
      if (groupIds.length > 0) {
        const groupPlaceholders = groupIds.map(() => '?').join(', ');
        const [rows] = await pool.query(
          `SELECT
             u.id AS student_id,
             u.full_name AS person_name,
             u.email AS student_email,
             u.group_id,
             g.name AS group_name
           FROM users u
           JOIN study_groups g ON g.id = u.group_id
           WHERE u.role = 'student' AND u.group_id IN (${groupPlaceholders})
           ORDER BY g.name, u.full_name`,
          groupIds
        );
        rosterRows = rows;
      }

      const peopleMap = new Map();

      function ensurePerson(key, data) {
        if (!peopleMap.has(key)) {
          peopleMap.set(key, {
            key,
            name: data.name,
            email: data.email || null,
            groupName: data.groupName || null,
            isGuest: Boolean(data.isGuest),
            marks: {},
          });
        }
        return peopleMap.get(key);
      }

      for (const row of rosterRows) {
        ensurePerson(`s:${row.student_id}`, {
          name: row.person_name,
          email: row.student_email,
          groupName: row.group_name,
          isGuest: false,
        });
      }

      for (const row of attendanceRows) {
        const key =
          row.student_id != null
            ? `s:${row.student_id}`
            : `g:${String(row.guest_full_name || '').trim().toLowerCase()}`;

        const person = ensurePerson(key, {
          name: row.person_name,
          email: row.student_email,
          groupName: row.student_group_name || row.guest_group_name,
          isGuest: row.student_id == null,
        });

        person.marks[row.lesson_id] = {
          present: true,
          checkedInAt: formatInTimeZone(row.checked_in_at),
        };
      }

      const people = [...peopleMap.values()].sort((a, b) => {
        const groupCmp = String(a.groupName || '').localeCompare(
          String(b.groupName || ''),
          'uk'
        );
        if (groupCmp !== 0) return groupCmp;
        return String(a.name || '').localeCompare(String(b.name || ''), 'uk');
      });

      return res.json({
        ok: true,
        lessons,
        people,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        message: 'Не вдалося завантажити журнал відвідуваності',
      });
    }
  }
);

router.get(
  '/attendance/stats',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    const disciplineIdRaw = req.query.disciplineId;
    const disciplineId =
      disciplineIdRaw === undefined || disciplineIdRaw === ''
        ? null
        : Number(disciplineIdRaw);

    if (
      disciplineIdRaw !== undefined &&
      disciplineIdRaw !== '' &&
      (!Number.isInteger(disciplineId) || disciplineId <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Невірний id дисципліни',
      });
    }

    try {
      const params = [req.user.id];
      let disciplineFilter = '';

      if (disciplineId !== null) {
        disciplineFilter = ' AND l.discipline_id = ?';
        params.push(disciplineId);
      }

      const [rows] = await pool.query(
        `SELECT
           d.id AS discipline_id,
           d.name AS discipline_name,
           u.id AS student_id,
           u.full_name AS student_name,
           u.email AS student_email,
           g.id AS group_id,
           g.name AS group_name,
           COUNT(DISTINCT l.id) AS total_lessons,
           COUNT(DISTINCT a.id) AS present_count
         FROM lessons l
         JOIN disciplines d ON d.id = l.discipline_id
         JOIN study_groups g ON g.id = l.group_id
         JOIN users u ON u.group_id = l.group_id AND u.role = 'student'
         LEFT JOIN attendances a
           ON a.lesson_id = l.id AND a.student_id = u.id
         WHERE l.teacher_id = ?${disciplineFilter}
         GROUP BY
           d.id, d.name,
           u.id, u.full_name, u.email,
           g.id, g.name
         ORDER BY d.name, g.name, u.full_name`,
        params
      );

      const stats = rows.map((row) => {
        const totalLessons = Number(row.total_lessons);
        const presentCount = Number(row.present_count);
        const percent =
          totalLessons === 0
            ? 0
            : Math.round((presentCount / totalLessons) * 100);

        return {
          disciplineId: row.discipline_id,
          disciplineName: row.discipline_name,
          studentId: row.student_id,
          studentName: row.student_name,
          studentEmail: row.student_email,
          groupId: row.group_id,
          groupName: row.group_name,
          totalLessons,
          presentCount,
          percent,
        };
      });

      return res.json({
        ok: true,
        stats,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        ok: false,
        message: 'Не вдалося завантажити статистику',
      });
    }
  }
);

module.exports = router;
