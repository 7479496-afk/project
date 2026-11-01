import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import {
  createDiscipline,
  createGroup,
  getDisciplines,
  getGroups,
} from '../../api/teacherApi';
import { teacherNavItems } from './teacherNav';

export default function TeacherCatalogPage() {
  const token = useAuthStore((state) => state.token);

  const [groups, setGroups] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [disciplineName, setDisciplineName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingDiscipline, setIsSavingDiscipline] = useState(false);

  async function loadCatalog() {
    setIsLoading(true);
    setError('');
    try {
      const [groupsData, disciplinesData] = await Promise.all([
        getGroups(token),
        getDisciplines(token),
      ]);
      setGroups(groupsData.groups || []);
      setDisciplines(disciplinesData.disciplines || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, [token]);

  async function handleCreateGroup(event) {
    event.preventDefault();
    setIsSavingGroup(true);
    setError('');
    setSuccess('');

    try {
      await createGroup(token, groupName.trim());
      setGroupName('');
      setSuccess('Групу створено');
      await loadCatalog();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleCreateDiscipline(event) {
    event.preventDefault();
    setIsSavingDiscipline(true);
    setError('');
    setSuccess('');

    try {
      await createDiscipline(token, disciplineName.trim());
      setDisciplineName('');
      setSuccess('Дисципліну створено');
      await loadCatalog();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingDiscipline(false);
    }
  }

  return (
    <AppShell title="Панель викладача" navItems={teacherNavItems}>
      <section>
        <h1 className="text-2xl font-semibold text-ink">Групи і дисципліни</h1>
        <p className="mt-2 text-sm text-muted">
          Створюйте самі — без адміністратора. Редагування та видалення лишаються
          в кабінеті адміністратора.
        </p>

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

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">Групи</h2>
            <form onSubmit={handleCreateGroup} className="mt-4">
              <label className="block text-sm font-medium text-ink">
                Нова група
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  required
                  placeholder="Наприклад, КН-21"
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <button
                type="submit"
                disabled={isSavingGroup}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {isSavingGroup ? 'Створення...' : 'Додати групу'}
              </button>
            </form>

            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              {isLoading ? (
                <p className="p-3 text-sm text-muted">Завантаження...</p>
              ) : groups.length === 0 ? (
                <p className="p-3 text-sm text-muted">Груп ще немає</p>
              ) : (
                <ul className="divide-y divide-line">
                  {groups.map((group) => (
                    <li key={group.id} className="px-3 py-2 text-sm text-ink">
                      {group.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">Дисципліни</h2>
            <form onSubmit={handleCreateDiscipline} className="mt-4">
              <label className="block text-sm font-medium text-ink">
                Нова дисципліна
                <input
                  value={disciplineName}
                  onChange={(event) => setDisciplineName(event.target.value)}
                  required
                  placeholder="Наприклад, Програмування"
                  className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <button
                type="submit"
                disabled={isSavingDiscipline}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {isSavingDiscipline ? 'Створення...' : 'Додати дисципліну'}
              </button>
            </form>

            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              {isLoading ? (
                <p className="p-3 text-sm text-muted">Завантаження...</p>
              ) : disciplines.length === 0 ? (
                <p className="p-3 text-sm text-muted">Дисциплін ще немає</p>
              ) : (
                <ul className="divide-y divide-line">
                  {disciplines.map((item) => (
                    <li key={item.id} className="px-3 py-2 text-sm text-ink">
                      {item.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
