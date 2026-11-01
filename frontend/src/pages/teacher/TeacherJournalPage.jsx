import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import {
  getAttendanceJournal,
  getDisciplines,
  getLessons,
} from '../../api/teacherApi';
import { teacherNavItems } from './teacherNav';

function dateToneClass(date, dateIndexMap) {
  const index = dateIndexMap.get(date) ?? 0;
  return index % 2 === 0 ? 'bg-emerald-200' : 'bg-sky-200';
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

  return (
    <AppShell title="Панель викладача" navItems={teacherNavItems}>
      <section>
        <h1 className="text-2xl font-semibold text-ink">
          Журнал відвідуваності
        </h1>
        <p className="mt-2 text-sm text-muted">
          Таблиця по датах: хто був і коли відмітився.
        </p>

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
                    <th className="bg-white px-3 py-2 font-semibold text-ink">
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
                    <th className="bg-white px-3 py-2 font-semibold text-ink">
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
                        <td className="px-3 py-2 text-muted">
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
                        <td className="px-3 py-2 font-medium text-ink">
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
