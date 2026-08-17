"use client";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        window.localStorage.setItem("sbi-theme", theme);
    }, [theme]);
    const value = useMemo(() => ({
        theme,
        toggleTheme: () => setStoredTheme(theme === "dark" ? "light" : "dark")
    }), [theme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context)
        throw new Error("useTheme must be used within ThemeProvider.");
    return context;
}
function subscribeToTheme(onStoreChange) {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener("sbi-theme-change", onStoreChange);
    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("sbi-theme-change", onStoreChange);
    };
}
function getThemeSnapshot() {
    const stored = window.localStorage.getItem("sbi-theme");
    if (stored === "light" || stored === "dark")
        return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function getServerThemeSnapshot() {
    return "light";
}
function setStoredTheme(theme) {
    window.localStorage.setItem("sbi-theme", theme);
    window.dispatchEvent(new Event("sbi-theme-change"));
}
