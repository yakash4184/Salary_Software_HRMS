"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenText, Building2, ChevronLeft, ChevronRight, FileText, Linkedin, LayoutDashboard, LogOut, Mail, Menu, Moon, ReceiptText, Settings, Sun, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
    { href: "/employees", label: "Employees", icon: Users, permission: "employees.view" },
    { href: "/salary", label: "Salary", icon: ReceiptText, permission: "salary.view" },
    { href: "/ledger", label: "Expense Entry", icon: BookOpenText, permission: "ledger.view" },
    { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
    { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
    { href: "/settings", label: "Settings", icon: Settings, adminOnly: true }
];

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 380;
const SIDEBAR_DEFAULT = 280;
const SIDEBAR_STEP = 20;

export function AppShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setUser(data?.user || null))
            .catch(() => setUser(null));
    }, []);

    useEffect(() => {
        if (!user)
            return;
        const currentItem = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
        if (!currentItem)
            return;
        const allowed = currentItem.adminOnly ? user.role === "Admin" : can(currentItem.permission);
        if (allowed)
            return;
        const fallback = navItems.find((item) => !item.adminOnly && can(item.permission));
        router.replace(fallback?.href || "/login");
    }, [pathname, router, user]);

    async function logout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
    }

    function shrinkSidebar() {
        setSidebarWidth((w) => Math.max(w - SIDEBAR_STEP, SIDEBAR_MIN));
    }
    function expandSidebar() {
        setSidebarWidth((w) => Math.min(w + SIDEBAR_STEP, SIDEBAR_MAX));
    }
    function can(permission) {
        return user?.role === "Admin" || user?.permissions?.includes(permission);
    }

    const sidebar = (<aside className="glass-sidebar flex h-full flex-col border-r border-white/55 dark:border-white/10">
      <div className="flex h-20 items-center gap-3 border-b border-white/45 px-5 dark:border-white/10">
        <img src="/school-logo.png" alt="School logo" className="brand-logo h-12 w-12"/>
        <div className="min-w-0">
          <p className="school-name-gradient truncate text-sm">Savitri Balika</p>
          <p className="truncate text-xs text-muted-foreground">Salary Management</p>
        </div>
      </div>

      <nav className="grid gap-1 p-3">
        {navItems.filter((item) => {
            if (item.adminOnly)
                return user?.role === "Admin";
            return can(item.permission);
        }).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (<Link href={item.href} key={item.href} onClick={() => setMobileOpen(false)} className={cn("flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition", active
                    ? "bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10")}>
              <Icon className="h-4 w-4"/>
              {item.label}
            </Link>);
        })}
      </nav>

      {/* ── Sidebar Resize Controls ──────────────────── */}
      <div className="flex items-center justify-center gap-1 border-t border-white/30 px-3 py-2 dark:border-white/10">
        <button
          type="button"
          onClick={shrinkSidebar}
          disabled={sidebarWidth <= SIDEBAR_MIN}
          className="sidebar-resize-btn"
          aria-label="Shrink sidebar"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground select-none">{sidebarWidth}px</span>
        <button
          type="button"
          onClick={expandSidebar}
          disabled={sidebarWidth >= SIDEBAR_MAX}
          className="sidebar-resize-btn"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-auto border-t border-white/45 p-4 dark:border-white/10">
        <div className="mb-3 rounded-lg border border-white/45 bg-white/45 p-3 backdrop-blur dark:border-white/10 dark:bg-white/10">
          <p className="truncate text-sm font-semibold">{user?.name || "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.role || "Account"}</p>
        </div>
        <Button variant="secondary" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4"/>
          Sign out
        </Button>
      </div>
    </aside>);
    return (<ToastProvider>
      <div className="min-h-screen lg:grid" style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}>
        <div className="fixed inset-y-0 left-0 z-40 hidden lg:block" style={{ width: `${sidebarWidth}px`, transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)" }}>{sidebar}</div>

        {mobileOpen ? (<div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-slate-950/45" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>
            <div className="relative h-full w-[280px]">{sidebar}</div>
          </div>) : null}

        <main className="lg:col-start-2 min-w-0 overflow-hidden">
          <header className="glass-topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/55 px-4 sm:px-6 dark:border-white/10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5"/>
              </Button>
              <div className="flex items-center gap-3">
                <img src="/school-logo.png" alt="School logo" className="brand-logo h-10 w-10"/>
                <div className="min-w-0">
                  <p className="school-name-gradient truncate text-sm sm:text-base">Savitri Balika Inter College</p>
                  <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                    <Building2 className="h-3.5 w-3.5"/>
                    Khutaha Road, Jamunahiya, Mirzapur
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
              </Button>
              {can("reports.view") ? (<Link href="/reports" className="hidden sm:inline-flex">
                <Button variant="secondary">
                  <FileText className="h-4 w-4"/>
                  Reports
                </Button>
              </Link>) : null}
            </div>
          </header>
          <div className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          <AppFooter />
        </main>
      </div>
    </ToastProvider>);
}

function AppFooter() {
    return (<footer className="mx-4 mb-6 mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 text-slate-900 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950 dark:text-slate-100 dark:shadow-slate-950/20 sm:mx-6 lg:mx-8">
      <div className="h-px bg-gradient-to-r from-transparent via-sky-500 to-transparent"/>
      <div className="grid gap-8 px-5 py-7 sm:px-7 xl:grid-cols-[minmax(260px,1fr)_minmax(300px,1.15fr)_minmax(210px,0.8fr)] lg:px-8">
        <div className="flex min-w-0 items-start gap-4">
          <img src="/bizedify-logo.png" alt="BizEdify logo" className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-white p-1.5 object-contain shadow-lg dark:border-white/10"/>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-wide text-slate-950 dark:text-white">BizEdify</p>
            <p className="mt-2 max-w-[220px] text-sm leading-6 text-slate-600 dark:text-slate-400">Smart Salary Management Solution</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 text-sm">
          <p className="font-semibold text-slate-950 dark:text-white">Developed By: AKASH YADAV</p>
          <p className="text-slate-600 dark:text-slate-400">Software Engineer</p>
          <a href="https://www.linkedin.com/in/akash288" target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">
            <Linkedin className="h-4 w-4 shrink-0"/>
            <span className="truncate">linkedin.com/in/akash288</span>
          </a>
          <a href="mailto:yakash4184@gmail.com" className="inline-flex min-w-0 items-center gap-2 text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">
            <Mail className="h-4 w-4 shrink-0"/>
            <span className="truncate">yakash4184@gmail.com</span>
          </a>
        </div>

        <div className="grid gap-4 text-sm xl:justify-items-end xl:text-right">
          <p className="text-slate-600 dark:text-slate-400">© 2026 BizEdify. All rights reserved.</p>
          <nav className="flex flex-wrap gap-3 xl:justify-end">
            <Link href="/dashboard" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Dashboard</Link>
            <Link href="/employees" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Employees</Link>
            <Link href="/reports" className="text-slate-700 transition hover:text-sky-600 hover:underline dark:text-slate-300 dark:hover:text-sky-300">Reports</Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 sm:px-7 lg:px-8">
        <div className="flex max-w-full flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-lg shadow-slate-200/40 transition duration-300 hover:-translate-y-1 hover:border-sky-300/70 hover:shadow-sky-200/70 dark:border-white/10 dark:bg-white/10 dark:shadow-sky-950/20 dark:hover:border-sky-300/60 dark:hover:shadow-sky-500/20 sm:mx-auto sm:w-fit sm:min-w-[420px] sm:flex-row sm:justify-start sm:text-left">
          <img src="/akash-yadav-profile.png" alt="Akash Yadav" className="h-20 w-20 shrink-0 rounded-full border-4 border-white object-cover object-[58%_25%] shadow-lg ring-2 ring-sky-300/70 transition duration-300 hover:scale-105 dark:border-slate-900 dark:shadow-sky-500/20"/>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-2xl font-semibold leading-tight text-slate-950 dark:text-white">Akash Yadav</p>
            <p className="mt-1 whitespace-nowrap text-base text-slate-600 dark:text-slate-400">Software Engineer</p>
          </div>
        </div>
      </div>
    </footer>);
}
