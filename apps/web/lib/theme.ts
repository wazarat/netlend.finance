export const THEME_KEY = "nl-theme";
export type Theme = "light" | "dark";

/** Runs before paint from layout.tsx so the stored theme never flashes. Light is the default. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
