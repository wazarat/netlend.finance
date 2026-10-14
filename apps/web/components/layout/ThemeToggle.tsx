"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY, type Theme } from "@/lib/theme";

/** Light is the default. The choice is stored per browser and applied before paint by the boot script in layout.tsx. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    setTheme(next);
  };
  const dark = theme === "dark";
  return (
    <button type="button" className="nl-switch" onClick={toggle} aria-pressed={dark} aria-label="Dark theme">
      {dark ? <Sun aria-hidden="true" strokeWidth={1.5} /> : <Moon aria-hidden="true" strokeWidth={1.5} />}
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}
