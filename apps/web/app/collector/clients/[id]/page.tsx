'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const tokenKey = 'collectorAccessToken';
const tasksCacheKey = 'collectorTasksCache';

type ClientData = {
  id: string;
  name: string;
  phone: string;
  whatsappPhone: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function CollectorClientEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<ClientData | null>(null);
  const [form, setForm] = useState({
    phone: '',
    whatsappPhone: '',
    address: '',
    neighborhood: '',
    city: '',
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) { window.location.assign('/collector/login'); return; }
    loadClient();
  }, [params.id]);

  function loadClient() {
    // Load from cached tasks
    const cached = window.localStorage.getItem(tasksCacheKey);
    if (!cached) return;

    try {
      const tasks = JSON.parse(cached) as Array<{
        clientId: string;
        client: ClientData | null;
      }>;
      const task = tasks.find((t) => t.clientId === params.id || t.client?.id === params.id);
      const clientData = task?.client ?? null;
      if (clientData) {
        setClient(clientData);
        setForm({
          phone: clientData.phone ?? '',
          whatsappPhone: clientData.whatsappPhone ?? '',
          address: clientData.address ?? '',
          neighborhood: clientData.neighborhood ?? '',
          city: clientData.city ?? '',
        });
        if (clientData.latitude != null && clientData.longitude != null) {
          setCapturedLocation({ latitude: clientData.latitude, longitude: clientData.longitude });
        }
      }
    } catch {
      /* ignore cache errors */
    }
  }

  async function captureLocation() {
    if (!navigator.geolocation) {
      setLocationMsg('Este dispositivo não suporta GPS.');
      return;
    }

    setLocating(true);
    setLocationMsg(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );
      setCapturedLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLocationMsg(`Localização capturada com precisão de ±${Math.round(pos.coords.accuracy)}m.`);
    } catch {
      setLocationMsg('Não foi possível obter a localização. Verifique as permissões do GPS.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    const token = window.localStorage.getItem(tokenKey);
    if (!token || !client) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const body: Record<string, string | number> = {};
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.whatsappPhone.trim()) body.whatsappPhone = form.whatsappPhone.trim();
      if (form.address.trim()) body.address = form.address.trim();
      if (form.neighborhood.trim()) body.neighborhood = form.neighborhood.trim();
      if (form.city.trim()) body.city = form.city.trim();
      if (capturedLocation) {
        body.latitude = capturedLocation.latitude;
        body.longitude = capturedLocation.longitude;
      }

      const res = await fetch(`${apiUrl}/mobile/clients/${client.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.localStorage.removeItem(tokenKey);
        window.location.assign('/collector/login');
        return;
      }

      if (!res.ok) throw new Error();

      const updated = (await res.json()) as ClientData;
      setClient(updated);
      setSuccessMsg('Dados do cliente atualizados com sucesso.');
    } catch {
      setErrorMsg('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const mapsUrl = capturedLocation
    ? `https://maps.google.com/?q=${capturedLocation.latitude},${capturedLocation.longitude}`
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white shadow-sm active:bg-panel"
            aria-label="Voltar"
          >
            <IconChevronLeft />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Editar cliente</p>
            <h1 className="truncate text-sm font-bold text-ink">
              {client?.name ?? '—'}
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4 pb-8">
        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {successMsg}
          </div>
        ) : null}
        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {!client ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Cliente não encontrado no cache. Volte à lista e acesse novamente.
          </div>
        ) : (
          <>
            {/* Contato */}
            <section className="rounded-xl border border-line bg-white shadow-sm">
              <div className="border-b border-line px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Contato</p>
              </div>
              <div className="space-y-4 px-4 py-4">
                <Field
                  label="Telefone"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="(00) 00000-0000"
                />
                <Field
                  label="WhatsApp"
                  type="tel"
                  value={form.whatsappPhone}
                  onChange={(v) => setForm((f) => ({ ...f, whatsappPhone: v }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </section>

            {/* Endereço */}
            <section className="rounded-xl border border-line bg-white shadow-sm">
              <div className="border-b border-line px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Endereço</p>
              </div>
              <div className="space-y-4 px-4 py-4">
                <Field
                  label="Rua / Logradouro"
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  placeholder="Ex: Rua das Flores, 123"
                />
                <Field
                  label="Bairro"
                  value={form.neighborhood}
                  onChange={(v) => setForm((f) => ({ ...f, neighborhood: v }))}
                  placeholder="Ex: Centro"
                />
                <Field
                  label="Cidade"
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  placeholder="Ex: São Paulo"
                />
              </div>
            </section>

            {/* Localização GPS */}
            <section className="rounded-xl border border-line bg-white shadow-sm">
              <div className="border-b border-line px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Localização GPS</p>
                <p className="mt-0.5 text-xs text-muted">
                  Capture a localização exata do cliente para facilitar futuras visitas.
                </p>
              </div>
              <div className="px-4 py-4">
                {capturedLocation ? (
                  <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-green-800">Localização salva</p>
                        <p className="mt-0.5 font-mono text-xs text-green-700">
                          {capturedLocation.latitude.toFixed(6)}, {capturedLocation.longitude.toFixed(6)}
                        </p>
                      </div>
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200 text-green-800 active:bg-green-300"
                        >
                          <IconMap />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {locationMsg ? (
                  <p className="mb-3 text-xs text-muted">{locationMsg}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void captureLocation()}
                  disabled={locating}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-ink shadow-sm active:bg-panel disabled:opacity-50"
                >
                  <IconLocation />
                  {locating
                    ? 'Obtendo localização...'
                    : capturedLocation
                    ? 'Recapturar localização'
                    : 'Capturar localização atual'}
                </button>
              </div>
            </section>

            {/* Save */}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-bold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-xl border border-line px-4 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function IconChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
