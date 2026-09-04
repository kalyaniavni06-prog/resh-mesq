import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";
export type TextScale = "base" | "lg" | "xl";

type Prefs = {
  theme: ThemeMode;
  highContrast: boolean;
  textScale: TextScale;
  voice: boolean;
};

const DEFAULTS: Prefs = { theme: "light", highContrast: false, textScale: "base", voice: false };
const STORAGE_KEY = "reshmesq.prefs";

type PrefsContextValue = Prefs & {
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setHighContrast: (v: boolean) => void;
  setTextScale: (v: TextScale) => void;
  setVoice: (v: boolean) => void;
  /** Announce a message to screen readers, and speak it when voice guidance is on. */
  announce: (message: string, options?: { assertive?: boolean; speak?: boolean }) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [politeMsg, setPoliteMsg] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");
  const voiceRef = useRef(false);

  // Read stored preferences after hydration to avoid SSR mismatches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        setPrefs((p) => ({ ...p, theme: "dark" }));
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  useEffect(() => {
    voiceRef.current = prefs.voice;
    const root = document.documentElement;
    root.classList.toggle("dark", prefs.theme === "dark");
    root.classList.toggle("hc", prefs.highContrast);
    root.classList.remove("text-scale-lg", "text-scale-xl");
    if (prefs.textScale !== "base") root.classList.add(`text-scale-${prefs.textScale}`);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const announce = useCallback(
    (message: string, options?: { assertive?: boolean; speak?: boolean }) => {
      if (options?.assertive) setAssertiveMsg(message);
      else setPoliteMsg(message);
      if (voiceRef.current && options?.speak !== false && typeof window !== "undefined") {
        const synth = window.speechSynthesis;
        if (synth) {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.rate = 1.02;
          if (options?.assertive) synth.cancel();
          synth.speak(utterance);
        }
      }
    },
    [],
  );

  const value = useMemo<PrefsContextValue>(
    () => ({
      ...prefs,
      setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
      toggleTheme: () => setPrefs((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" })),
      setHighContrast: (highContrast) => setPrefs((p) => ({ ...p, highContrast })),
      setTextScale: (textScale) => setPrefs((p) => ({ ...p, textScale })),
      setVoice: (voice) => {
        setPrefs((p) => ({ ...p, voice }));
        if (!voice && typeof window !== "undefined") window.speechSynthesis?.cancel();
      },
      announce,
    }),
    [prefs, announce],
  );

  return (
    <PrefsContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {politeMsg}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertiveMsg}
      </div>
    </PrefsContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
