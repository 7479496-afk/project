import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import AppShell from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import {
  archiveLesson,
  deleteLesson,
  getDisciplines,
  getGroups,
  getLesson,
  getLessonAttendances,
  unarchiveLesson,
  updateLesson,
} from '../../api/teacherApi';
import { teacherNavItems } from './teacherNav';

function getQrStatusLabel(lesson) {
  if (!lesson) return '';
  if (lesson.isArchived) return 'В архіві — відмітка недоступна';

  const start = new Date(
    `${lesson.lessonDate}T${String(lesson.startTime).slice(0, 8)}`
  );
  const end = new Date(
    `${lesson.lessonDate}T${String(lesson.endTime).slice(0, 8)}`
  );
  const now = new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Невірний час заняття';
  }

  if (now < start) {
    return `Ще неактивний · діє з ${String(lesson.startTime).slice(0, 5)} до ${String(lesson.endTime).slice(0, 5)}`;
  }

  if (now > end) {
    return 'Неактивний · час пари закінчився';
  }

  return `Активний · до ${String(lesson.endTime).slice(0, 5)}`;
}

export default function TeacherLessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [lesson, setLesson] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [groups, setGroups] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [lessonData, attendanceData, groupsData, disciplinesData] =
        await Promise.all([
          getLesson(token, id),
          getLessonAttendances(token, id),
          getGroups(token),
          getDisciplines(token),
        ]);

      const current = lessonData.lesson;
      setLesson(current);
      setAttendances(attendanceData.attendances || []);
      setGroups(groupsData.groups || []);
      setDisciplines(disciplinesData.disciplines || []);
      setForm({
        disciplineId: String(current.disciplineId),
        groupId: current.groupId ? String(current.groupId) : '',
        lessonDate: current.lessonDate,
        startTime: current.startTime.slice(0, 5),
        endTime: current.endTime.slice(0, 5),
        locationName: current.locationName || '',
        latitude: current.latitude == null ? '' : String(current.latitude),
        longitude: current.longitude == null ? '' : String(current.longitude),
        radiusMeters:
          current.radiusMeters == null ? '' : String(current.radiusMeters),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, id]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const data = await updateLesson(token, id, {
        disciplineId: Number(form.disciplineId),
        groupId: form.groupId ? Number(form.groupId) : null,
        lessonDate: form.lessonDate,
        startTime: form.startTime,
        endTime: form.endTime,
        locationName: form.locationName.trim(),
        latitude: form.latitude.trim() === '' ? null : Number(form.latitude),
        longitude: form.longitude.trim() === '' ? null : Number(form.longitude),
        radiusMeters:
          form.radiusMeters.trim() === '' ? null : Number(form.radiusMeters),
      });
      setLesson(data.lesson);
      setSuccess('Заняття оновлено');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    setError('');
    setSuccess('');
    try {
      const data = await archiveLesson(token, id);
      setLesson(data.lesson);
      setSuccess('Заняття в архіві');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnarchive() {
    setError('');
    setSuccess('');
    try {
      const data = await unarchiveLesson(token, id);
      setLesson(data.lesson);
      setSuccess('Заняття повернуто з архіву');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Видалити заняття назавжди разом із усіма відмітками?'
    );
    if (!confirmed) return;

    setError('');
    try {
      await deleteLesson(token, id);
      navigate('/teacher/lessons', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Панель викладача" navItems={teacherNavItems}>
      <section>
        <Link
          to="/teacher/lessons"
          className="text-sm font-medium text-accent hover:text-accent-dark"
        >
          ← До списку занять
        </Link>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted">Завантаження...</p>
        ) : error && !lesson ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : lesson && form ? (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-ink">
                  {lesson.disciplineName}
                </h1>
                <p className="mt-2 text-muted">
                  {lesson.groupName || 'Без групи'} · {lesson.lessonDate} ·{' '}
                  {lesson.startTime.slice(0, 5)}–{lesson.endTime.slice(0, 5)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {lesson.locationName ? `${lesson.locationName} · ` : ''}
                  {lesson.latitude != null && lesson.longitude != null
                    ? `геоперевірка · радіус ${lesson.radiusMeters || 100} м`
                    : 'без геоперевірки'}
                  {lesson.isArchived ? ' · в архіві' : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {lesson.isArchived ? (
                  <button
                    type="button"
                    onClick={handleUnarchive}
                    className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface"
                  >
                    З архіву
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface"
                  >
                    В архів
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-danger hover:bg-red-50"
                >
                  Видалити назавжди
                </button>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                {success}
              </p>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="rounded-2xl border border-line bg-white p-5 text-center">
                <h2 className="text-lg font-semibold text-ink">QR-код заняття</h2>
                <p className="mt-1 text-sm text-muted">
                  {getQrStatusLabel(lesson)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Відмітка лише під час пари (
                  {String(lesson.startTime).slice(0, 5)}–
                  {String(lesson.endTime).slice(0, 5)})
                </p>
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={lesson.qrToken} size={200} />
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white">
                <div className="border-b border-line px-4 py-3">
                  <h2 className="text-lg font-semibold text-ink">Присутні</h2>
                  <p className="text-sm text-muted">
                    Зареєстровано: {attendances.length}
                  </p>
                </div>

                {attendances.length === 0 ? (
                  <p className="p-4 text-sm text-muted">
                    Поки ніхто не відмітився
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {attendances.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <p className="font-medium text-ink">{item.studentName}</p>
                        <p className="text-sm text-muted">{item.studentEmail}</p>
                        <p className="mt-1 text-sm text-ink">
                          Час відмітки: {item.checkedInAt}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSave}
              className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
            >
              <h2 className="text-lg font-semibold text-ink sm:col-span-2">
                Редагувати заняття
              </h2>

              <label className="block text-sm font-medium text-ink">
                Дисципліна
                <select
                  value={form.disciplineId}
                  onChange={(event) =>
                    updateField('disciplineId', event.target.value)
                  }
                  required
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  {disciplines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-ink">
                Група (необовʼязково)
                <select
                  value={form.groupId}
                  onChange={(event) => updateField('groupId', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">Без групи (збірна)</option>
                  {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-ink">
                Дата
                <input
                  type="date"
                  value={form.lessonDate}
                  onChange={(event) =>
                    updateField('lessonDate', event.target.value)
                  }
                  required
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Місце (необовʼязково)
                <input
                  value={form.locationName}
                  onChange={(event) =>
                    updateField('locationName', event.target.value)
                  }
                  placeholder="Наприклад, аудиторія 301"
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Початок
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    updateField('startTime', event.target.value)
                  }
                  required
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Кінець
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => updateField('endTime', event.target.value)}
                  required
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Широта (необовʼязково)
                <input
                  value={form.latitude}
                  onChange={(event) =>
                    updateField('latitude', event.target.value)
                  }
                  placeholder="Порожньо = без гео"
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Довгота (необовʼязково)
                <input
                  value={form.longitude}
                  onChange={(event) =>
                    updateField('longitude', event.target.value)
                  }
                  placeholder="Порожньо = без гео"
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <label className="block text-sm font-medium text-ink sm:col-span-2">
                Радіус (метри)
                <input
                  type="number"
                  min="1"
                  value={form.radiusMeters}
                  onChange={(event) =>
                    updateField('radiusMeters', event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
                >
                  {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
