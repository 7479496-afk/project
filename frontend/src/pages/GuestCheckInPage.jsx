import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { guestCheckIn } from '../api/guestApi';
import {
  insecureContextMessage,
  isSecureContext,
} from '../utils/secureContext';
import { extractQrToken } from '../utils/qrToken';

export default function GuestCheckInPage() {
  const [searchParams] = useSearchParams();
  const scannerRef = useRef(null);

  const [fullName, setFullName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [coords, setCoords] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);

  const [scannerError, setScannerError] = useState('');
  const [scannerStatus, setScannerStatus] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get('token');
    if (fromQuery) {
      setQrToken(extractQrToken(fromQuery));
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  function requestGeolocation() {
    if (!isSecureContext()) {
      setGeoError(insecureContextMessage());
      setGeoStatus('');
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Геолокація не підтримується цим браузером');
      setGeoStatus('');
      return;
    }

    setIsLoadingGeo(true);
    setGeoError('');
    setGeoStatus('Запитуємо доступ до геолокації...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGeoError('');
        setGeoStatus('Геолокацію отримано');
        setIsLoadingGeo(false);
      },
      (error) => {
        setCoords(null);
        const reason =
          error?.code === 1
            ? 'Доступ до геолокації заборонено в налаштуваннях браузера/телефона.'
            : 'Не вдалося отримати геолокацію. Спробуйте ще раз і дозвольте доступ.';
        setGeoError(reason);
        setGeoStatus('');
        setIsLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function startCamera() {
    if (scannerActive || isStartingCamera) return;

    if (!isSecureContext()) {
      setScannerError(insecureContextMessage());
      setScannerStatus('');
      return;
    }

    setIsStartingCamera(true);
    setScannerError('');
    setScannerStatus('Запитуємо доступ до камери...');

    try {
      const html5QrCode = new Html5Qrcode('guest-qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          setQrToken(extractQrToken(decodedText));
        },
        () => {}
      );

      setScannerActive(true);
      setScannerStatus('Камера увімкнена');
      setScannerError('');
    } catch {
      scannerRef.current = null;
      setScannerActive(false);
      setScannerStatus('');
      setScannerError('Камера недоступна або доступ заборонено');
    } finally {
      setIsStartingCamera(false);
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {}

    scannerRef.current = null;
    setScannerActive(false);
    setScannerStatus('Камеру вимкнено');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const finalToken = extractQrToken(qrToken);
    const name = fullName.trim();

    if (!name) {
      setIsError(true);
      setMessage('Вкажіть імʼя та прізвище');
      return;
    }

    if (!finalToken) {
      setIsError(true);
      setMessage('Вкажіть або відскануйте QR-код');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setIsError(false);

    try {
      const payload = {
        qrToken: finalToken,
        fullName: name,
        groupName: groupName.trim() || undefined,
      };
      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }

      const data = await guestCheckIn(payload);
      const checkedAt = data.attendance?.checkedInAt
        ? ` · час відмітки: ${data.attendance.checkedInAt}`
        : '';
      setIsError(false);
      setMessage(
        `${data.message || 'Присутність підтверджено'}${checkedAt}`
      );
    } catch (err) {
      setIsError(true);
      const distance = err.data?.distanceMeters;
      const allowed = err.data?.allowedRadiusMeters;
      const extra =
        distance != null && allowed != null
          ? ` (відстань ≈ ${distance} м, дозволено ${allowed} м)`
          : '';
      setMessage(
        `${err.message || 'Не вдалося підтвердити присутність'}${extra}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-ink">EduAttend</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">
            Відмітка без реєстрації
          </h1>
          <p className="mt-1 text-sm text-muted">
            Відскануйте QR, введіть ПІБ — акаунт не потрібен
          </p>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium text-accent hover:text-accent-dark"
        >
          Увійти в кабінет
        </Link>
      </div>

      {!isSecureContext() ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {insecureContextMessage()}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-line bg-white p-5"
      >
        <label className="block text-sm font-medium text-ink">
          Імʼя та прізвище
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            placeholder="Наприклад, Андрій Петренко"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Група (необовʼязково)
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Наприклад, КН-21"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          QR-код / токен
          <input
            value={qrToken}
            onChange={(event) => setQrToken(extractQrToken(event.target.value))}
            placeholder="Зʼявиться після сканування або з посилання"
            className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        <div className="rounded-xl border border-line bg-surface/70 p-4">
          <p className="text-sm font-medium text-ink">Камера</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!scannerActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={isStartingCamera}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-white disabled:opacity-60"
              >
                {isStartingCamera ? 'Очікуємо дозвіл...' : 'Сканувати QR'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-white"
              >
                Вимкнути камеру
              </button>
            )}
          </div>
          <div id="guest-qr-reader" className="mt-3 overflow-hidden rounded-xl" />
          {scannerStatus ? (
            <p className="mt-2 text-sm text-success">{scannerStatus}</p>
          ) : null}
          {scannerError ? (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {scannerError}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-line bg-surface/70 p-4">
          <p className="text-sm font-medium text-ink">Геолокація (за потреби)</p>
          <p className="mt-1 text-xs text-muted">
            Потрібна лише якщо викладач увімкнув перевірку місця
          </p>
          <button
            type="button"
            onClick={requestGeolocation}
            disabled={isLoadingGeo}
            className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-white disabled:opacity-60"
          >
            {isLoadingGeo
              ? 'Очікуємо дозвіл...'
              : coords
                ? 'Оновити геолокацію'
                : 'Надати геолокацію'}
          </button>
          {geoError ? (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {geoError}
            </p>
          ) : null}
          {geoStatus && !geoError ? (
            <p className="mt-2 text-sm text-success">{geoStatus}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {isSaving ? 'Перевірка...' : 'Підтвердити присутність'}
        </button>
      </form>

      {message ? (
        <p
          className={[
            'mt-4 rounded-lg px-3 py-2 text-sm',
            isError ? 'bg-red-50 text-danger' : 'bg-green-50 text-success',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
