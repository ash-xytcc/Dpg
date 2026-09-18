import React from "react";

const ThemeCtx = React.createContext({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = "bf_theme";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}

  return "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  const body = document.body;

  root.setAttribute("data-theme", theme);
  body.setAttribute("data-theme", theme);

  root.classList.remove("theme-light", "theme-dark");
  body.classList.remove("theme-light", "theme-dark");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");

  const vars = theme === "dark"
    ? {
        "--bg": "#121715",
        "--bg-elev": "#1a211e",
        "--text": "#f3efe8",
        "--muted": "#b8c1cc",
        "--border": "rgba(255,255,255,0.14)",
        "--accent": "#c7e6d2",
        "--input-bg": "#202825",
        "--input-text": "#f3efe8",
      }
    : {
        "--bg": "#f3efe8",
        "--bg-elev": "#faf7f2",
        "--text": "#111111",
        "--muted": "#4e647d",
        "--border": "rgba(0,0,0,0.12)",
        "--accent": "#173f35",
        "--input-bg": "#fffdf9",
        "--input-text": "#111111",
      };

  Object.entries(vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  root.style.backgroundColor = vars["--bg"];
  root.style.color = vars["--text"];
  body.style.backgroundColor = vars["--bg"];
  body.style.color = vars["--text"];
  body.style.transition = "background-color 160ms ease, color 160ms ease";
  root.style.transition = "background-color 160ms ease, color 160ms ease";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = React.useState(getInitialTheme);

  React.useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = React.useCallback((next) => {
    setThemeState(next === "dark" ? "dark" : "light");
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeCtx);
}
