"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const notify = useCallback((toast) => {
        const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
        setToasts((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => {
            setToasts((current) => current.filter((item) => item.id !== id));
        }, toast.durationMs ?? 4000);
    }, []);
    const value = useMemo(() => ({ notify }), [notify]);
    return (<ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[70] grid gap-2">
        {toasts.map((toast) => {
            const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? XCircle : Info;
            const toneClass = toast.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-emerald-200/70 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50"
                : toast.tone === "error"
                    ? "border-rose-300 bg-rose-50 text-rose-950 shadow-rose-200/70 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-50"
                    : "border-sky-300 bg-sky-50 text-sky-950 shadow-sky-200/70 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-50";
            const iconClass = toast.tone === "success"
                ? "text-emerald-600 dark:text-emerald-300"
                : toast.tone === "error"
                    ? "text-rose-600 dark:text-rose-300"
                    : "text-sky-600 dark:text-sky-300";
            return (<div key={toast.id} className={`flex min-w-72 max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${toneClass}`}>
              <Icon className={`h-5 w-5 shrink-0 ${iconClass}`}/>
              <span className="font-semibold">{toast.title}</span>
            </div>);
        })}
      </div>
    </ToastContext.Provider>);
}
export function useToast() {
    const context = useContext(ToastContext);
    if (!context)
        throw new Error("useToast must be used within ToastProvider.");
    return context;
}
