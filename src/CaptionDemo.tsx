// CaptionDemo.tsx
// ONE-WORD live captions with subtle fly-in. Each word lasts ~1s and is replaced immediately by the next.

import React, { useCallback, useEffect, useRef, useState } from "react";

// Helpers
const rid = () => Math.random().toString(36).slice(2, 9)
const getLastWord = (t: string) => {
  const trimmed = t.trim()
  if (!trimmed) return ""
  const parts = trimmed.split(/\s+/)
  const last = parts[parts.length - 1] || ""
  return last.replace(/[.,!?;:，。！？；：]+$/g, "")
}

type WordToken = { id: string; text: string }

// Word with subtle fly-in
const Word: React.FC<{ token: WordToken }> = ({ token }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(r)
  }, [])
  return (
    <span
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 140ms ease, transform 140ms ease',
        color: '#ffeb3b',
        fontWeight: 700,
        marginRight: '0.4ch',
      }}
    >
      {token.text}
    </span>
  )
}

function useSpeechRecognition(
  enabled: boolean,
  lang: string,
  onText: (t: string) => void,
) {
  const recognizerRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => { enabledRef.current = enabled }, [enabled])

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    setSupported(true);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    const safeStart = () => { try { rec.start(); } catch {} };

    rec.onresult = (ev: any) => {
      const r = ev.results[ev.results.length - 1];
      const tx = r[0]?.transcript ?? "";
      onText(tx);
    };

    rec.onend = () => { if (enabledRef.current) setTimeout(safeStart, 120); };
    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setPermissionError("Microphone permission denied. Please allow mic access in browser.");
        return;
      }
      if (enabledRef.current && (code === "no-speech" || code === "network" || code === "aborted" || code === "audio-capture")) {
        setTimeout(safeStart, 150);
      }
    };

    recognizerRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, [lang, onText]);

  useEffect(() => {
    const rec = recognizerRef.current;
    if (!supported || !rec) return;
    if (enabled) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => { try { rec.start(); } catch {} })
        .catch(() => setPermissionError("Microphone permission denied. Please enable mic access."))
    } else {
      try { rec.stop(); } catch {}
    }
  }, [enabled, supported])

  return { supported, permissionError };
}

const CaptionDemo: React.FC = () => {
  const [micOn, setMicOn] = useState<boolean>(false);
  const [current, setCurrent] = useState<WordToken | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const clearTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lang = "en-US";

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (videoRef.current) {
          (videoRef.current as any).srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setCamError(e?.message || "Could not access camera");
      }
    })();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const handleText = useCallback((text: string) => {
    const last = getLastWord(text)
    if (!last) return
    if (current?.text !== last) {
      setCurrent({ id: rid(), text: last })
    }
    if (clearTimer.current) window.clearTimeout(clearTimer.current)
    clearTimer.current = window.setTimeout(() => { setCurrent(null) }, 1000) as unknown as number
  }, [current])

  const { supported, permissionError } = useSpeechRecognition(micOn, lang, handleText);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 grid place-items-center">
      <h1 className="text-3xl font-extrabold mb-4">🎤 Live Caption Demo</h1>

      <div
        style={{
          position: 'relative', width: '720px', maxWidth: '100%',
          aspectRatio: '16 / 9', borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)', background: '#000'
        }}
      >
        <video
          ref={videoRef}
          muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />

        <div
          style={{ position: 'absolute', left: 0, right: 0, bottom: '5%',
            display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}
        >
          {current && (
            <div
              style={{ maxWidth: '92%', background: 'rgba(0,0,0,0.65)',
                color: '#fff', fontSize: '1.8rem', lineHeight: 1.35,
                padding: '10px 14px', borderRadius: '14px', textAlign: 'center',
                textShadow: '0 0 2px #000, 0 2px 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.6)',
                display: 'inline-flex' }}
            >
              <Word token={current} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2">
        {camError && <div className="text-red-600 text-sm">Camera error: {camError}</div>}
        {!supported && <div className="text-red-600 text-sm">Speech Recognition is not supported in this browser.</div>}
        {permissionError && <div className="text-red-600 text-sm">{permissionError}</div>}

        <button
          onClick={() => setMicOn(m => !m)}
          className={`px-4 py-2 rounded border ${micOn ? "bg-emerald-600 text-white border-transparent" : "bg-white text-slate-900 border-slate-300"}`}
          disabled={!supported}
        >
          {micOn ? "Mic On (listening)" : "Mic Off"}
        </button>
      </div>
    </div>
  );
};

export default CaptionDemo;
