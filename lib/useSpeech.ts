"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
type Ctor = new () => Recognition;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribeSupport = () => () => {};
const speechSupported = () => getCtor() !== null;
const noSupport = () => false;

/** Live dictation with the browser's Web Speech API. Keeps listening until stop() is called. */
export function useSpeech(lang = "es-MX") {
  const supported = useSyncExternalStore(subscribeSupport, speechSupported, noSupport);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);


  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setFinalText("");
    setInterim("");
    setError(null);
    wanted.current = true;

    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      let done = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) done += res[0].transcript;
        else live += res[0].transcript;
      }
      if (done) setFinalText((t) => `${t}${t ? " " : ""}${done.trim()}`);
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted.current = false;
      setError(e.error === "not-allowed" ? "Permite el micrófono para dictar." : "No pude escuchar. Intenta de nuevo.");
    };
    // Chrome ends the session after a pause; restart while the user still wants to record.
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          /* already started */
        }
      }
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    rec.current?.stop();
  }, []);

  return { supported, listening, finalText, interim, error, start, stop };
}
