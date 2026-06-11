"use client";

/**
 * MarcaWizard — orquesta el flujo completo de registro de una marca.
 *
 *  Pasos:
 *    1. GPS       → captura ubicación + valida precisión
 *    2. Foto      → cámara frontal + captura selfie
 *    3. Confirmar → preview + envío
 *    4. Resultado → éxito (válida) o alerta (fraude/fuera de geofence)
 *
 *  El servidor (POST /api/marcas) es la fuente de verdad:
 *    - Aquí calculamos la distancia solo para mostrarla al usuario
 *    - El esFraude final lo decide el backend con los datos del puesto en BD
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { AutoRedirect } from "@/components/shared/AutoRedirect";
import { CameraCapture } from "./CameraCapture";
import { distanceInMeters } from "@/lib/geofence";
import { cn, formatDistance } from "@/lib/utils";

// ============================================================
// Tipos
// ============================================================

interface PuestoInfo {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radioGeofenceM: number;
}

interface GpsFix {
  latitud: number;
  longitud: number;
  precisionM: number;
  source: "real" | "demo-valido" | "demo-fraude";
}

type WizardStep =
  | { kind: "gps" }
  | { kind: "photo"; gps: GpsFix }
  | { kind: "preview"; gps: GpsFix; photo: string }
  | { kind: "submitting"; gps: GpsFix; photo: string }
  | { kind: "result"; gps: GpsFix; data: MarcaCreated; photo: string }
  | { kind: "error"; gps: GpsFix; photo: string; message: string };

interface MarcaCreated {
  id: string;
  tipo: "ENTRADA" | "SALIDA";
  dentroDelGeofence: boolean;
  distanciaPuestoM: number;
  esFraude: boolean;
  motivoFraude: string | null;
  timestampServidor: string;
  storage: "s3" | "inline";
  puesto: { id: string; nombre: string; radioGeofenceM: number };
}

interface MarcaWizardProps {
  puesto: PuestoInfo;
  demoMode: boolean;
  /** Precisión mínima aceptable en metros para considerar el GPS "bueno". */
  maxGpsPrecisionM: number;
}

// ============================================================
// Componente
// ============================================================

export function MarcaWizard({ puesto, demoMode, maxGpsPrecisionM }: MarcaWizardProps) {
  const [step, setStep] = useState<WizardStep>({ kind: "gps" });
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");

  // ----------------------------------------------------------
  // Acciones de navegación entre pasos
  // ----------------------------------------------------------
  const goToPhoto = useCallback((gps: GpsFix) => {
    setStep({ kind: "photo", gps });
  }, []);

  const goToPreview = useCallback(
    (gps: GpsFix, photo: string) => setStep({ kind: "preview", gps, photo }),
    [],
  );

  const retakePhoto = useCallback(() => {
    setStep((curr) => (curr.kind === "preview" ? { kind: "photo", gps: curr.gps } : curr));
  }, []);

  const reset = useCallback(() => setStep({ kind: "gps" }), []);

  // ----------------------------------------------------------
  // Submit → POST /api/marcas
  // ----------------------------------------------------------
  const submitMarca = useCallback(
    async (gps: GpsFix, photo: string) => {
      setStep({ kind: "submitting", gps, photo });

      try {
        const res = await fetch("/api/marcas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo,
            latitud: gps.latitud,
            longitud: gps.longitud,
            precisionM: gps.precisionM,
            timestampCliente: new Date().toISOString(),
            fotoBase64: photo,
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Error ${res.status}`);
        }

        const data = (await res.json()) as { ok: true; marca: MarcaCreated };
        setStep({ kind: "result", gps, photo, data: data.marca });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error desconocido";
        setStep({ kind: "error", gps, photo, message });
      }
    },
    [tipo],
  );

  // ----------------------------------------------------------
  // Render: barra superior con tipo + indicador de progreso
  // ----------------------------------------------------------
  const showTipoToggle = step.kind === "gps" || step.kind === "photo";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Indicador de progreso */}
      <StepIndicator step={step.kind} />

      {/* Selector ENTRADA / SALIDA (solo en pasos iniciales) */}
      {showTipoToggle && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTipo("ENTRADA")}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              tipo === "ENTRADA"
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setTipo("SALIDA")}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              tipo === "SALIDA"
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            Salida
          </button>
        </div>
      )}

      {/* Contenido del paso actual */}
      {step.kind === "gps" && (
        <GpsStep
          puesto={puesto}
          maxGpsPrecisionM={maxGpsPrecisionM}
          demoMode={demoMode}
          onReady={goToPhoto}
        />
      )}

      {step.kind === "photo" && (
        <CameraCapture
          onCapture={(dataUrl) => goToPreview(step.gps, dataUrl)}
          onCancel={reset}
        />
      )}

      {step.kind === "preview" && (
        <PreviewStep
          puesto={puesto}
          gps={step.gps}
          photo={step.photo}
          tipo={tipo}
          onRetake={retakePhoto}
          onConfirm={() => submitMarca(step.gps, step.photo)}
        />
      )}

      {step.kind === "submitting" && <SubmittingStep />}

      {step.kind === "result" && (
        <ResultStep marca={step.data} photo={step.photo} onNewMarca={reset} />
      )}

      {step.kind === "error" && (
        <ErrorStep
          message={step.message}
          onRetry={() => submitMarca(step.gps, step.photo)}
          onReset={reset}
        />
      )}
    </div>
  );
}

// ============================================================
// StepIndicator
// ============================================================

function StepIndicator({ step }: { step: WizardStep["kind"] }) {
  const steps: { key: WizardStep["kind"]; label: string }[] = [
    { key: "gps", label: "Ubicación" },
    { key: "photo", label: "Foto" },
    { key: "preview", label: "Confirmar" },
  ];
  const order: WizardStep["kind"][] = ["gps", "photo", "preview", "submitting", "result", "error"];
  const currentIdx = order.indexOf(step);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const stepIdx = order.indexOf(s.key);
        const isCurrent = stepIdx === currentIdx;
        const isDone = currentIdx > stepIdx;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                isDone
                  ? "bg-success-600 text-white"
                  : isCurrent
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 text-gray-500",
              )}
            >
              {isDone ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                isCurrent ? "text-gray-900" : "text-gray-500",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  isDone ? "bg-success-600" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Paso 1: GPS
// ============================================================

interface GpsStepProps {
  puesto: PuestoInfo;
  maxGpsPrecisionM: number;
  demoMode: boolean;
  onReady: (gps: GpsFix) => void;
}

function GpsStep({ puesto, maxGpsPrecisionM, demoMode, onReady }: GpsStepProps) {
  const [status, setStatus] = useState<"waiting" | "improving" | "ready" | "denied" | "error">(
    "waiting",
  );
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Iniciar watchPosition al montar
  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Este navegador no soporta geolocalización.");
      return;
    }

    setStatus("waiting");
    setErrorMsg(null);
    setFix(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: GpsFix = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precisionM: pos.coords.accuracy,
          source: "real",
        };
        setFix(next);
        setStatus(pos.coords.accuracy <= maxGpsPrecisionM ? "ready" : "improving");
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            setErrorMsg(
              "Permiso de ubicación denegado. Habilítalo en la configuración del navegador.",
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus("error");
            setErrorMsg(
              "Posición no disponible. Verifica que el GPS esté activo o reintenta cerca de una ventana.",
            );
            break;
          case err.TIMEOUT:
            setStatus("error");
            setErrorMsg("Tiempo agotado obteniendo la ubicación.");
            break;
          default:
            setStatus("error");
            setErrorMsg(err.message || "Error desconocido obteniendo la ubicación.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }, [maxGpsPrecisionM]);

  useEffect(() => {
    startWatch();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatch]);

  // Si el usuario continúa, paramos el watcher
  const continueWith = useCallback(
    (gps: GpsFix) => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      onReady(gps);
    },
    [onReady],
  );

  // ----- Distancia preview (solo display) -----
  const distance = useMemo(() => {
    if (!fix) return null;
    return distanceInMeters(fix.latitud, fix.longitud, puesto.latitud, puesto.longitud);
  }, [fix, puesto]);

  // ----- Modo demo: helpers para simular fix sin GPS real -----
  const simulateValido = useCallback(() => {
    continueWith({
      latitud: puesto.latitud,
      longitud: puesto.longitud,
      precisionM: 10,
      source: "demo-valido",
    });
  }, [continueWith, puesto.latitud, puesto.longitud]);

  const simulateFraude = useCallback(() => {
    // ~3.3 km de offset
    continueWith({
      latitud: puesto.latitud + 0.03,
      longitud: puesto.longitud + 0.03,
      precisionM: 10,
      source: "demo-fraude",
    });
  }, [continueWith, puesto.latitud, puesto.longitud]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <div className="space-y-3">
      {/* Estado del GPS */}
      <div
        className={cn(
          "card",
          status === "ready" && "bg-success-50 ring-success-500/30",
          status === "improving" && "bg-warning-50 ring-warning-500/30",
          (status === "denied" || status === "error") && "bg-danger-50 ring-danger-200",
        )}
      >
        <div className="flex items-start gap-3">
          <GpsIcon status={status} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {labelForGpsStatus(status)}
            </p>
            {fix && (status === "ready" || status === "improving") && (
              <p className="mt-1 text-xs text-gray-600">
                Precisión: <span className="tabular-nums">±{Math.round(fix.precisionM)}m</span>
                {distance !== null && (
                  <>
                    {" · "}
                    Distancia al puesto: <span className="tabular-nums">{formatDistance(distance)}</span>
                  </>
                )}
              </p>
            )}
            {errorMsg && <p className="mt-1 text-xs text-danger-700">{errorMsg}</p>}
            {status === "improving" && (
              <p className="mt-1 text-xs text-warning-700">
                Esperando a precisión ≤ {maxGpsPrecisionM}m…
              </p>
            )}
          </div>
        </div>

        {(status === "denied" || status === "error") && (
          <button
            type="button"
            onClick={startWatch}
            className="mt-3 btn-primary w-full text-sm"
          >
            Reintentar
          </button>
        )}
      </div>

      {/* Puesto asignado */}
      <div className="card">
        <p className="text-xs uppercase tracking-wide text-gray-500">Puesto asignado</p>
        <p className="mt-1 font-semibold text-gray-900">{puesto.nombre}</p>
        <p className="text-xs text-gray-600">{puesto.direccion}</p>
        <p className="mt-2 text-xs text-gray-500">
          Radio del geofence: <span className="font-medium">{puesto.radioGeofenceM}m</span>
        </p>
      </div>

      {/* Botón continuar */}
      {status === "ready" && fix && (
        <button
          type="button"
          onClick={() => continueWith(fix)}
          className="btn-primary w-full"
        >
          Continuar a la foto
        </button>
      )}

      {status === "improving" && fix && (
        <button
          type="button"
          onClick={() => continueWith(fix)}
          className="btn-secondary w-full"
          title="Continuar aceptando la precisión actual"
        >
          Continuar de todas formas (±{Math.round(fix.precisionM)}m)
        </button>
      )}

      {/* Helpers de modo demo */}
      {demoMode && (
        <div className="card border-2 border-dashed border-primary-300 bg-primary-50/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Modo demo
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Si estás presentando el demo lejos del puesto, usa estos atajos para simular el GPS:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={simulateValido}
              className="rounded-lg bg-success-600 px-3 py-2 text-sm font-semibold text-white hover:bg-success-700"
            >
              Simular ubicación válida
            </button>
            <button
              type="button"
              onClick={simulateFraude}
              className="rounded-lg bg-danger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-danger-700"
            >
              Simular fuera del geofence
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GpsIcon({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === "denied" || status === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-600 text-white">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // waiting / improving
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx={12} cy={12} r={10} className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" />
      </svg>
    </div>
  );
}

function labelForGpsStatus(status: string): string {
  switch (status) {
    case "waiting":
      return "Obteniendo ubicación…";
    case "improving":
      return "Mejorando precisión del GPS…";
    case "ready":
      return "Ubicación lista";
    case "denied":
      return "Permiso de ubicación denegado";
    case "error":
      return "Error de GPS";
    default:
      return status;
  }
}

// ============================================================
// Paso 3: Preview + confirmar
// ============================================================

interface PreviewStepProps {
  puesto: PuestoInfo;
  gps: GpsFix;
  photo: string;
  tipo: "ENTRADA" | "SALIDA";
  onRetake: () => void;
  onConfirm: () => void;
}

function PreviewStep({ puesto, gps, photo, tipo, onRetake, onConfirm }: PreviewStepProps) {
  const distance = useMemo(
    () => distanceInMeters(gps.latitud, gps.longitud, puesto.latitud, puesto.longitud),
    [gps, puesto],
  );
  const wouldBeFraud = distance > puesto.radioGeofenceM;

  return (
    <div className="space-y-3">
      {/* Foto */}
      <div className="card overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Selfie de la marca" className="block w-full" />
      </div>

      {/* Resumen */}
      <div className="card space-y-2 text-sm">
        <Row label="Tipo">
          <span className="font-semibold">{tipo}</span>
        </Row>
        <Row label="Puesto">{puesto.nombre}</Row>
        <Row label="Distancia al puesto">
          <span className="tabular-nums">{formatDistance(distance)}</span>
        </Row>
        <Row label="Precisión GPS">
          <span className="tabular-nums">±{Math.round(gps.precisionM)}m</span>
        </Row>
        {gps.source !== "real" && (
          <Row label="GPS">
            <span className="text-xs italic text-primary-700">
              Simulado ({gps.source === "demo-valido" ? "válido" : "fraude"})
            </span>
          </Row>
        )}
      </div>

      {/* Aviso si va a ser fraude */}
      {wouldBeFraud && (
        <div className="card bg-danger-50 ring-danger-200">
          <p className="text-sm font-semibold text-danger-700">
            Atención: estás fuera del geofence
          </p>
          <p className="mt-1 text-xs text-danger-700">
            Esta marca se registrará pero quedará marcada como{" "}
            <strong>alerta</strong> para tu supervisor (estás a {formatDistance(distance)} del
            puesto; el radio permitido es de {puesto.radioGeofenceM}m).
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onRetake} className="btn-secondary">
          Repetir foto
        </button>
        <button type="button" onClick={onConfirm} className="btn-primary">
          Confirmar marca
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  );
}

// ============================================================
// Paso 4: Enviando
// ============================================================

function SubmittingStep() {
  return (
    <div className="card flex flex-col items-center gap-3 py-10">
      <svg
        className="h-10 w-10 animate-spin text-primary-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx={12} cy={12} r={10} className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" />
      </svg>
      <p className="text-sm font-semibold text-gray-900">Registrando marca…</p>
      <p className="text-xs text-gray-500">Subiendo foto y validando ubicación</p>
    </div>
  );
}

// ============================================================
// Paso 5a: Resultado
// ============================================================

interface ResultStepProps {
  marca: MarcaCreated;
  photo: string;
  onNewMarca: () => void;
}

function ResultStep({ marca, photo, onNewMarca }: ResultStepProps) {
  const fueValida = !marca.esFraude;

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Banner principal */}
      <div
        className={cn(
          "card text-center",
          fueValida ? "bg-success-50 ring-success-500/30" : "bg-danger-50 ring-danger-200",
        )}
      >
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white",
            fueValida ? "bg-success-600" : "bg-danger-600",
          )}
        >
          {fueValida ? (
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
          )}
        </div>
        <h2 className={cn("mt-3 text-lg font-bold", fueValida ? "text-success-700" : "text-danger-700")}>
          {fueValida ? "Marca registrada" : "Marca registrada con alerta"}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {marca.tipo} · {marca.puesto.nombre}
        </p>
      </div>

      {/* Detalle */}
      <div className="card space-y-2 text-sm">
        <Row label="Distancia">
          <span className="tabular-nums">{formatDistance(marca.distanciaPuestoM)}</span>
        </Row>
        <Row label="Geofence">
          {marca.dentroDelGeofence ? (
            <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700">
              Dentro
            </span>
          ) : (
            <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700">
              Fuera
            </span>
          )}
        </Row>
        <Row label="Hora servidor">
          {new Date(marca.timestampServidor).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Row>
        <Row label="Almacenamiento">
          <span className="text-xs uppercase tracking-wide text-gray-500">
            {marca.storage === "s3" ? "AWS S3" : "Inline (BD)"}
          </span>
        </Row>
        {marca.motivoFraude && (
          <div className="rounded-lg bg-danger-50 p-2 text-xs text-danger-700">
            {marca.motivoFraude}
          </div>
        )}
      </div>

      {/* Thumbnail de la foto */}
      <details className="card">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Ver foto registrada
        </summary>
        <div className="mt-3 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Foto de la marca" className="block w-full" />
        </div>
      </details>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/historial" className="btn-secondary text-center">
          Ver historial
        </Link>
        <button type="button" onClick={onNewMarca} className="btn-primary">
          Nueva marca
        </button>
      </div>

      {/*
        Auto-redirect al /home si la marca fue válida (sin fraude).
        Si hubo fraude, NO auto-redirigimos: el guardia debe ver y leer la
        alerta antes de salir.
      */}
      {fueValida ? (
        <AutoRedirect to="/home" delayMs={3500} />
      ) : (
        <Link
          href="/home"
          className="block text-center text-sm text-gray-500 underline"
        >
          Volver al inicio
        </Link>
      )}
    </div>
  );
}

// ============================================================
// Paso 5b: Error
// ============================================================

interface ErrorStepProps {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}

function ErrorStep({ message, onRetry, onReset }: ErrorStepProps) {
  return (
    <div className="space-y-3">
      <div className="card bg-danger-50 ring-danger-200">
        <p className="text-sm font-semibold text-danger-700">No se pudo registrar la marca</p>
        <p className="mt-1 text-sm text-danger-700">{message}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onReset} className="btn-secondary">
          Empezar de nuevo
        </button>
        <button type="button" onClick={onRetry} className="btn-primary">
          Reintentar envío
        </button>
      </div>
    </div>
  );
}
