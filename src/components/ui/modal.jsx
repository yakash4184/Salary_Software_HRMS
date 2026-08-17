"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function Modal({ open, title, children, onClose, className }) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-md">
      <div className={cn("glass-card max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl", className)}>
        <div className="flex items-center justify-between border-b border-white/45 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4"/>
          </Button>
        </div>
        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>);
}
