import { useEffect } from "react";
import { useSettings } from "@/lib/settings";
import { setAurumBase } from "@/lib/aurum";

const ACCENT_HSL: Record<string, { primary: string; glow: string; ring: string }> = {
  gold:    { primary: "43 53% 54%",  glow: "44 78% 74%",  ring: "43 53% 54%" },
  indigo:  { primary: "243 75% 59%", glow: "243 80% 78%", ring: "243 75% 59%" },
  emerald: { primary: "158 64% 42%", glow: "158 60% 65%", ring: "158 64% 42%" },
  crimson: { primary: "350 75% 50%", glow: "350 80% 70%", ring: "350 75% 50%" },
};

/**
 * Applique les paramètres "Apparence" et "Réseau" globalement
 * (variables CSS, classes thème, taille de police, base URL Aurum…).
 */
export function SettingsApplier() {
  const { settings } = useSettings();

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: "dark" | "light") => {
      root.classList.toggle("dark", mode === "dark");
      root.classList.toggle("light", mode === "light");
    };
    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const onChange = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    apply(settings.theme);
  }, [settings.theme]);

  // Accent
  useEffect(() => {
    const root = document.documentElement;
    const a = ACCENT_HSL[settings.accentColor] ?? ACCENT_HSL.gold;
    root.style.setProperty("--primary", a.primary);
    root.style.setProperty("--accent", a.primary);
    root.style.setProperty("--ring", a.ring);
    root.style.setProperty("--primary-glow", a.glow);
    root.style.setProperty(
      "--gradient-gold",
      `linear-gradient(135deg, hsl(${a.primary}) 0%, hsl(${a.glow}) 100%)`,
    );
  }, [settings.accentColor]);

  // Density
  useEffect(() => {
    document.documentElement.dataset.density = settings.density;
  }, [settings.density]);

  // Cover shape
  useEffect(() => {
    document.documentElement.dataset.coverShape = settings.coverShape;
  }, [settings.coverShape]);

  // Font scale
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(16 * settings.fontScale)}px`;
  }, [settings.fontScale]);

  // Reduced motion
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? "true" : "false";
  }, [settings.reducedMotion]);

  // Language (HTML lang)
  useEffect(() => {
    const lang =
      settings.language === "system"
        ? navigator.language?.slice(0, 2) || "fr"
        : settings.language;
    document.documentElement.lang = lang;
  }, [settings.language]);

  // Aurum base URL → sync
  useEffect(() => {
    if (settings.aurumBaseUrl) setAurumBase(settings.aurumBaseUrl);
  }, [settings.aurumBaseUrl]);

  return null;
}
