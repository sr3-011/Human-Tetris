import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioEvent =
  | { type: 'BEAT_DROP'; atMs: number; strength: number }
  | { type: 'HIGH_ENERGY'; atMs: number; energy: number };

type UseAudioEngineOptions = {
  /** If false, hook is inert (mobile-friendly default: caller decides). */
  enabled?: boolean;
  /** Beat sensitivity (0-1). Higher = fewer beats. */
  beatThreshold?: number;
};

/**
 * Minimal audio engine hook (Phase 3 scaffold).
 * - Uses Web Audio when available.
 * - Emits coarse events (BEAT_DROP / HIGH_ENERGY) from amplitude/energy.
 * - Designed so the rest of the game consumes events, not audio APIs directly.
 */
export function useAudioEngine(options: UseAudioEngineOptions = {}) {
  const { enabled = false, beatThreshold = 0.6 } = options;

  const [events, setEvents] = useState<AudioEvent[]>([]);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setEvents([]);
    analyserRef.current = null;
    dataRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }, []);

  const startFromStream = useCallback(async (stream: MediaStream) => {
    stop();
    if (typeof window === 'undefined') return;
    if (!('AudioContext' in window)) return;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    let lastBeatAt = 0;
    const loop = () => {
      const analyserNode = analyserRef.current;
      const data = dataRef.current;
      if (!analyserNode || !data) return;

      analyserNode.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const energy = sum / (data.length * 255); // 0..1
      const atMs = Date.now();

      const nextEvents: AudioEvent[] = [];
      if (energy >= Math.max(0, Math.min(1, beatThreshold)) && atMs - lastBeatAt > 220) {
        lastBeatAt = atMs;
        nextEvents.push({ type: 'BEAT_DROP', atMs, strength: energy });
      }
      if (energy >= 0.82) {
        nextEvents.push({ type: 'HIGH_ENERGY', atMs, energy });
      }

      if (nextEvents.length) {
        setEvents(prev => (prev.length > 50 ? [...prev.slice(-25), ...nextEvents] : [...prev, ...nextEvents]));
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [beatThreshold, stop]);

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
  }, [enabled, stop]);

  return { events, startFromStream, stop };
}

