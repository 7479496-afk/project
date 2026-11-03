import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import {
  getAttendanceJournal,
  getDisciplines,
  getLessons,
} from '../../api/teacherApi';
import { teacherNavItems } from './teacherNav';

// Same tones as journal on site (Tailwind emerald-200 / sky-200)
const DATE_FILL_EMERALD = 'A7F3D0';
const DATE_FILL_SKY = 'BAE6FD';
const PRESENT_FONT = '16A34A';
const HEADER_FONT = '0F172A';

function dateToneClass(date, dateIndexMap) {
  const index = dateIndexMap.get(date) ?? 0;
  return index % 2 === 0 ? 'bg-emerald-200' : 'bg-sky-200';
}

function dateFillHex(date, dateIndexMap) {
  const index = dateIndexMap.get(date) ?? 0;
  return index % 2 === 0 ? DATE_FILL_EMERALD : DATE_FILL_SKY;
}

function formatLessonHeader(lesson) {
  const date = String(lesson.lessonDate || '');
  const [year, month, day] = date.split('-');
  const dateUa =
    year && month && day ? `${day}.${month}.${year}` : date;
  return `${dateUa} ${String(lesson.startTime).slice(0, 5)}`;
}

function formatCheckInTime(checkedInAt) {
  if (!checkedInAt) return '+';
  const raw = String(checkedInAt);
  const timePart = raw.includes('T')
    ? raw.slice(11, 16)
    : raw.includes(' ')
      ? raw.split(' ')[1]?.slice(0, 5)
      : raw.slice(0, 5);
  return timePart || '+';
}

function applyFill(cell, argb) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${argb}` },
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function asCsvExcelText(value) {
  if (value === '' || value == null) return '';
  return `="${String(value).replace(/"/g, '""')}"`;
}

function safeJournalFileName(disciplineName) {
  return (disciplineName || 'journal').replace(
    /[^\wа-яА-ЯіїєґІЇЄҐ\- ]+/g,
    '_'
  );
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TeacherJournalPage() {
  const token = useAuthStore((state) => state.token);
  const [disciplines, setDisciplines] = useState([]);
  const [disciplineId, setDisciplineId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDisciplinesForTeacher() {
      setError('');
      try {
        const [disciplinesData, activeLessons, archivedLessons] =
          await Promise.all([
            getDisciplines(token),
            getLessons(token, false),
            getLessons(token, true),
          ]);

        const usedIds = new Set(
          [...(activeLessons.lessons || []), ...(archivedLessons.lessons || [])]
            .map((lesson) => lesson.disciplineId)
        );

        const available = (disciplinesData.disciplines || []).filter((item) =>
          usedIds.has(item.id)
        );

        setDisciplines(available);
        if (available.length > 0) {
          setDisciplineId(String(available[0].id));
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    }

    loadDisciplinesForTeacher();
  }, [token]);

  useEffect(() => {
    if (!disciplineId) {
      setLessons([]);
      setPeople([]);
      setIsLoading(false);
      return;
    }

    async function loadJournal() {
      setIsLoading(true);
      setError('');
      try {
        const data = await getAttendanceJournal(token, disciplineId);
        setLessons(data.lessons || []);
        setPeople(data.people || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadJournal();
  }, [token, disciplineId]);

  const selectedDisciplineName = useMemo(() => {
    const found = disciplines.find(
      (item) => String(item.id) === String(disciplineId)
    );
    return found?.name || '';
  }, [disciplines, disciplineId]);

  const dateIndexMap = useMemo(() => {
    const map = new Map();
    let index = 0;
    for (const lesson of lessons) {
      if (!map.has(lesson.lessonDate)) {
        map.set(lesson.lessonDate, index);
        index += 1;
      }
    }
    return map;
  }, [lessons]);

  async function exportExcel() {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Журнал', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    });

    const headers = [
      'Прізвище Імʼя',
      'Група',
      'Тип',
      ...lessons.map((lesson) => formatLessonHeader(lesson)),
      'Разом',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: `FF${HEADER_FONT}` } };
    headerRow.eachCell((cell) => {
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });

    lessons.forEach((lesson, index) => {
      const cell = headerRow.getCell(4 + index);
      applyFill(cell, dateFillHex(lesson.lessonDate, dateIndexMap));
    });

    for (const person of people) {
      const marks = lessons.map((lesson) => {
        const mark = person.marks?.[lesson.id];
        if (!mark?.present) return '—';
        return formatCheckInTime(mark.checkedInAt);
      });
      const presentCount = marks.filter((value) => value !== '—').length;

      const row = sheet.addRow([
        person.name,
        person.groupName || '—',
        person.isGuest ? 'без акаунта' : 'студент',
        ...marks,
        `${presentCount} з ${lessons.length}`,
      ]);

      row.eachCell((cell) => {
        cell.font = { color: { argb: `FF${HEADER_FONT}` } };
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
        };
      });

      row.getCell(1).font = {
        bold: true,
        color: { argb: `FF${HEADER_FONT}` },
      };
      row.getCell(4 + lessons.length).font = {
        bold: true,
        color: { argb: `FF${HEADER_FONT}` },
      };

      lessons.forEach((lesson, index) => {
        const cell = row.getCell(4 + index);
        applyFill(cell, dateFillHex(lesson.lessonDate, dateIndexMap));
        const mark = person.marks?.[lesson.id];
        if (mark?.present) {
          cell.font = {
            bold: true,
            color: { argb: `FF${PRESENT_FONT}` },
          };
        }
      });
    }

    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 14;
    lessons.forEach((_, index) => {
      sheet.getColumn(4 + index).width = 16;
    });
    sheet.getColumn(4 + lessons.length).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(
      blob,
      `journal_${safeJournalFileName(selectedDisciplineName)}.xlsx`
    );
  }

  function exportCsv() {
    const header = [
      'Прізвище Імʼя',
      'Група',
      'Тип',
      ...lessons.map((lesson) => asCsvExcelText(formatLessonHeader(lesson))),
      'Разом',
    ];

    const rows = people.map((person) => {
      const marks = lessons.map((lesson) => {
        const mark = person.marks?.[lesson.id];
        if (!mark?.present) return '';
        return asCsvExcelText(formatCheckInTime(mark.checkedInAt));
      });
      const presentCount = marks.filter(Boolean).length;
      return [
        person.name,
        person.groupName || '',
        person.isGuest ? 'без акаунта' : 'студент',
        ...marks,
        asCsvExcelText(`${presentCount} з ${lessons.length}`),
      ];
    });

    const lines = [header, ...rows]
      .map((row) => row.map(csvEscape).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${lines}`], {
      type: 'text/csv;charset=utf-8;',
    });
    downloadBlob(
      blob,
      `journal_${safeJournalFileName(selectedDisciplineName)}.csv`
    );
  }

  const canExport =
    !isLoading && lessons.length > 0 && people.length > 0;

  return (
    <AppShell title="Панель викладача" navItems={teacherNavItems}>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Журнал відвідуваності
            </h1>
            <p className="mt-2 text-sm text-muted">
              Таблиця по датах: хто був і коли відмітився.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                exportExcel().catch((err) => {
                  setError(err.message || 'Не вдалося сформувати Excel');
                });
              }}
              disabled={!canExport}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface disabled:opacity-60"
            >
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  exportCsv();
                } catch (err) {
                  setError(err.message || 'Не вдалося сформувати CSV');
                }
              }}
              disabled={!canExport}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-surface disabled:opacity-60"
            >
              CSV
            </button>
          </div>
        </div>

        <label className="mt-6 block max-w-md text-sm font-medium text-ink">
          Дисципліна
          <select
            value={disciplineId}
            onChange={(event) => setDisciplineId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {disciplines.length === 0 ? (
              <option value="">Немає дисциплін із заняттями</option>
            ) : (
              disciplines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
          {selectedDisciplineName ? (
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-semibold text-ink">{selectedDisciplineName}</h2>
            </div>
          ) : null}

          {isLoading ? (
            <p className="p-4 text-sm text-muted">Завантаження...</p>
          ) : !disciplineId || lessons.length === 0 ? (
            <p className="p-4 text-sm text-muted">Немає занять для журналу</p>
          ) : people.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              Поки немає студентів або відміток
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-ink">
                      ПІБ
                    </th>
                    <th className="bg-white px-3 py-2 text-center font-semibold text-ink">
                      Група
                    </th>
                    {lessons.map((lesson) => (
                      <th
                        key={lesson.id}
                        className={`px-3 py-2 font-semibold text-ink ${dateToneClass(
                          lesson.lessonDate,
                          dateIndexMap
                        )}`}
                        title={`${lesson.lessonDate} ${String(
                          lesson.startTime
                        ).slice(0, 5)}–${String(lesson.endTime).slice(0, 5)}${
                          lesson.groupName ? ` · ${lesson.groupName}` : ''
                        }`}
                      >
                        <div>{lesson.lessonDate}</div>
                        <div className="text-xs font-normal text-muted">
                          {String(lesson.startTime).slice(0, 5)}
                        </div>
                      </th>
                    ))}
                    <th className="bg-white px-3 py-2 text-center font-semibold text-ink">
                      Разом
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const presentCount = lessons.filter(
                      (lesson) => person.marks?.[lesson.id]?.present
                    ).length;

                    return (
                      <tr key={person.key} className="border-b border-line">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-ink">
                          {person.name}
                          {person.isGuest ? (
                            <span className="ml-1 text-xs font-normal text-muted">
                              (гість)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-center text-muted">
                          {person.groupName || '—'}
                        </td>
                        {lessons.map((lesson) => {
                          const mark = person.marks?.[lesson.id];
                          return (
                            <td
                              key={`${person.key}-${lesson.id}`}
                              className={`px-3 py-2 ${dateToneClass(
                                lesson.lessonDate,
                                dateIndexMap
                              )}`}
                            >
                              {mark?.present ? (
                                <span
                                  className="font-medium text-success"
                                  title={mark.checkedInAt || ''}
                                >
                                  {mark.checkedInAt
                                    ? String(mark.checkedInAt).slice(11, 16) ||
                                      '+'
                                    : '+'}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-medium text-ink">
                          {presentCount}/{lessons.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
