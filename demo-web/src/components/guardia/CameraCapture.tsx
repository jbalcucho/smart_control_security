"use client";

/**
 * Componente de captura de selfie.
 *
 * - Solicita permiso de cámara (facingMode: "user" → frontal)
 * - Muestra el stream en vivo con efecto espejo (más natural para selfies)
 * - Al disparar: dibuja el frame en un <canvas>, comprime a JPEG 70%
 *   y devuelve la data URL al componente padre vía onCapture()
 * - Libera el stream al desmontar (apaga la luz/permiso de cámara)
 *
 * Resolución de captura: 640×480 — suficiente para verificar identidad
 * y mantiene el payload base64 en ~50-80 KB.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const JPEG_QUALITY = 0.7;

type CameraStatus = "idle" | "starting" | "ready" | "denied" | "error";

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ----------------------------------------------------------
  // Iniciar el stream
  // ----------------------------------------------------------
  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setStatus("error");
      setErrorMsg(
        "Este navegador no soporta acceso a la cámara. Prueba con Chrome o Safari actualizado.",
      );
      return;
    }

    setStatus("starting");
    setErrorMsg(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: CAPTURE_WIDTH },
          height: { ideal: CAPTURE_HEIGHT },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() puede rechazar en algunos browsers si no hay gesto del usuario
        try {
          await videoRef.current.play();
        } catch {
          /* ignorar — el atributo autoPlay debería bastar */
        }
      }

      setStatus("ready");
    } catch (e) {
      const err = e as DOMException;
      switch (err.name) {
        case "NotAllowedError":
        case "SecurityError":
          setStatus("denied");
          setErrorMsg(
            "Permiso de cámara denegado. Habilítalo en la configuración del navegador y reintenta.",
          );
          break;
        case "NotFoundError":
        case "OverconstrainedError":
          setStatus("error");
          setErrorMsg(
            "No se detectó cámara frontal en este dispositivo.",
          );
          break;
        case "NotReadableError":
          setStatus("error");
          setErrorMsg(
            "La cámara está siendo usada por otra aplicación.",
          );
          break;
        default:
          setStatus("error");
          setErrorMsg(`Error al iniciar la cámara: ${err.message || err.name}`);
      }
    }
  }, []);

  // ----------------------------------------------------------
  // Detener el stream
  // ----------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Auto-iniciar al montar y limpiar al desmontar
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // ----------------------------------------------------------
  // Capturar frame
  // ----------------------------------------------------------
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Espejo: lo que ve el usuario es lo que se captura
    ctx.translate(CAPTURE_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    stopCamera();
    onCapture(dataUrl);
  }, [status, stopCamera, onCapture]);

  // ----------------------------------------------------------
  // Render por estado
  // ----------------------------------------------------------
  if (status === "denied" || status === "error") {
    return (
      <div className="card bg-danger-50 ring-danger-200">
        <p className="font-semibold text-danger-700">No se pudo acceder a la cámara</p>
        <p className="mt-1 text-sm text-danger-700">{errorMsg}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={startCamera} className="btn-primary text-sm">
            Reintentar
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary text-sm">
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Marco del video */}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-gray-900/10">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover [transform:scaleX(-1)]"
        />

        {/* Overlay mientras inicia */}
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
            <svg
              className="h-8 w-8 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx={12} cy={12} r={10} className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" />
            </svg>
            <p className="text-sm">Iniciando cámara…</p>
          </div>
        )}

        {/* Guía circular para encuadre */}
        {status === "ready" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-3/5 w-3/5 rounded-full border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]" />
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-center gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="btn-secondary"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={handleCapture}
          disabled={status !== "ready"}
          aria-label="Capturar foto"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-4 ring-primary-600 transition-all enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-50"
        >
          <div className="h-12 w-12 rounded-full bg-primary-600" />
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        Encuadra tu rostro dentro del círculo y pulsa el botón
      </p>
    </div>
  );
}
