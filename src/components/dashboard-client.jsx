"use client";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Banknote, CalendarClock, Camera, CheckCircle2, IndianRupee, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { PageHeading } from "@/components/page-heading";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, monthName } from "@/lib/utils";
export function DashboardClient() {
    const { notify } = useToast();
    const [employees, setEmployees] = useState([]);
    const [salaries, setSalaries] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [salaryPeriod, setSalaryPeriod] = useState("Month");
    const [salaryMonth, setSalaryMonth] = useState(String(new Date().getMonth() + 1));
    const [salaryYear, setSalaryYear] = useState(String(new Date().getFullYear()));
    const profilePhotoRef = useRef(null);
    useEffect(() => {
        async function load() {
            setLoading(true);
            const [employeeResponse, salaryResponse, userResponse] = await Promise.all([
                fetch("/api/employees", { cache: "no-store" }),
                fetch("/api/salaries", { cache: "no-store" }),
                fetch("/api/auth/me", { cache: "no-store" })
            ]);
            const [employeeData, salaryData, userData] = await Promise.all([
                employeeResponse.ok ? employeeResponse.json() : { employees: [] },
                salaryResponse.ok ? salaryResponse.json() : { salaries: [] },
                userResponse.ok ? userResponse.json() : { user: null }
            ]);
            setEmployees(employeeData.employees || []);
            setSalaries(salaryData.salaries || []);
            setCurrentUser(userData.user || null);
            setLoading(false);
        }
        load();
    }, []);
    async function changeProfilePhoto(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            const photo = await resizeProfileImage(file);
            const response = await fetch("/api/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photo })
            });
            const data = await response.json().catch(() => null);
            if (response.ok) {
                setCurrentUser((user) => ({ ...user, profilePhoto: photo }));
                notify({ tone: "success", title: "फोटो सफलतापूर्वक लग गई।" });
            }
            else {
                notify({ tone: "error", title: data?.message || "फोटो सेव नहीं हो पाई।" });
            }
        }
        catch {
            notify({ tone: "error", title: "कृपया सही फोटो चुनें।" });
        }
        event.target.value = "";
    }
    const availableYears = useMemo(() => {
        const years = new Set([new Date().getFullYear()]);
        salaries.forEach((salary) => years.add(salary.year));
        return Array.from(years).sort((a, b) => b - a);
    }, [salaries]);
    const filteredSalaries = useMemo(() => {
        return salaries.filter((salary) => {
            const matchesYear = salary.year === Number(salaryYear);
            const matchesMonth = salary.month === Number(salaryMonth);
            return salaryPeriod === "Year" ? matchesYear : matchesYear && matchesMonth;
        });
    }, [salaries, salaryMonth, salaryPeriod, salaryYear]);
    const periodLabel = salaryPeriod === "Year"
        ? salaryYear
        : `${monthName(Number(salaryMonth))} ${salaryYear}`;
    const stats = useMemo(() => {
        const activeEmployees = employees.filter((employee) => employee.status === "Active").length;
        const paid = filteredSalaries.filter((salary) => salary.status === "Paid");
        const pending = filteredSalaries.filter((salary) => salary.status === "Pending");
        const payrollTotal = filteredSalaries.reduce((sum, salary) => sum + salary.netSalary, 0);
        return [
            { label: "Active Staff", value: activeEmployees, icon: Users, tone: "text-teal-600" },
            { label: "Paid Slips", value: paid.length, icon: CheckCircle2, tone: "text-emerald-600" },
            { label: "Pending Slips", value: pending.length, icon: CalendarClock, tone: "text-amber-500" },
            { label: "Payroll Value", value: formatCurrency(payrollTotal), icon: IndianRupee, tone: "text-amber-600" }
        ];
    }, [employees, filteredSalaries]);
    const recentSalaries = salaries.slice(0, 7);
    const salaryRows = useMemo(() => {
        return filteredSalaries
            .sort((first, second) => first.netSalary - second.netSalary || String(first.employee?.name || first.employeeId).localeCompare(String(second.employee?.name || second.employeeId), "en", { sensitivity: "base" }));
    }, [filteredSalaries]);
    const highestSalary = salaryRows.at(-1);
    const maxSalary = Math.max(...salaryRows.map((salary) => salary.netSalary), 0);
    const adminName = currentUser?.name || "School Administrator";
    return (<>
      <GreetingClock />
      <PageHeading title="Dashboard" description="A controlled view of employee payroll, pending salary runs, and recent slips for Savitri Balika Inter College." action={<Link href="/salary">
            <Button>
              <Banknote className="h-4 w-4"/>
              Generate Salary
            </Button>
          </Link>}/>

      <section className="mb-6 overflow-hidden rounded-xl border border-blue-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative shrink-0">
              {currentUser?.profilePhoto ? (<img src={currentUser.profilePhoto} alt="" className="h-20 w-20 rounded-full border-4 border-white dark:border-slate-800 object-cover shadow-md ring-2 ring-blue-200 dark:ring-blue-900/50"/>) : (<div className="grid h-20 w-20 rounded-full border-4 border-white dark:border-slate-800 bg-blue-50 dark:bg-slate-800 text-xl font-bold text-blue-700 dark:text-blue-400 shadow-md ring-2 ring-blue-200 dark:ring-blue-900/50">
                  <span className="m-auto">{adminName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                </div>)}
              <button type="button" onClick={() => profilePhotoRef.current?.click()} className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-blue-600 text-white shadow-sm transition hover:scale-105 hover:bg-blue-700 dark:border-blue-800 dark:bg-blue-500" aria-label="Change admin photo">
                <Camera className="h-4 w-4"/>
              </button>
              <input ref={profilePhotoRef} className="sr-only" type="file" accept="image/*" onChange={changeProfilePhoto}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Administrative Login</p>
              <h2 className="truncate text-2xl font-extrabold text-slate-950 dark:text-slate-50">Welcome, {adminName}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">आपका डैशबोर्ड उपयोग के लिए तैयार है।</p>
            </div>
          </div>
          <div className="admin-quote-marquee rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-800/40">
            <span>{adminName} जी, आपका स्वागत है। शिक्षा, अनुशासन और ईमानदार कार्य से ही संस्थान की प्रगति होती है।</span>
          </div>
        </div>
      </section>

      <section className="glass-panel relative mb-8 flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/20 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
        
        <div className="relative z-10 flex w-full flex-col items-center gap-6 sm:flex-row sm:items-stretch">
          <TiltPhoto images={["/school-photo.jpg", "/school-back.jpg"]} alt="Savitri Balika Inter College" />
          
          <div className="flex min-w-0 flex-1 flex-col justify-center py-2 text-center sm:text-left">
            <Badge className="mx-auto mb-3 w-fit sm:mx-0" variant="secondary">Premium Dashboard</Badge>
            <h2 className="bg-gradient-to-br from-primary to-blue-600 bg-clip-text pb-1 text-3xl font-black text-transparent drop-shadow-sm sm:text-4xl md:text-5xl">
              Savitri Balika
            </h2>
            <h2 className="mb-2 text-xl font-bold text-foreground/80 sm:text-2xl">Inter College</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Modern payroll management with advanced CL tracking, dynamic filters, and beautifully branded salary workflows.
            </p>
            
            <div className="mt-6 flex w-fit flex-wrap justify-center gap-2 rounded-xl border border-white/20 bg-white/40 p-2 shadow-sm backdrop-blur-md dark:bg-white/5 sm:justify-start">
              <Select value={salaryPeriod} onChange={(event) => setSalaryPeriod(event.target.value)} className="w-28 bg-white/50 font-medium dark:bg-black/20">
                <option value="Month">Month</option>
                <option value="Year">Year</option>
              </Select>
              {salaryPeriod === "Month" ? (
                <Select value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} className="w-36 bg-white/50 font-medium dark:bg-black/20">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option key={month} value={String(month)}>{monthName(month)}</option>))}
                </Select>
              ) : null}
              <Select value={salaryYear} onChange={(event) => setSalaryYear(event.target.value)} className="w-24 bg-white/50 font-medium dark:bg-black/20">
                {availableYears.map((year) => (<option key={year} value={String(year)}>{year}</option>))}
              </Select>
            </div>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Showing payroll data for {periodLabel}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (<motion.section key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{loading ? "..." : stat.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/50 bg-white/45 backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <Icon className={`h-5 w-5 ${stat.tone}`}/>
                </div>
              </div>
            </motion.section>);
        })}
      </div>

      <Card className="mt-6">
        <CardHeader title="Salary Graph" description={`${periodLabel} ke employees low to high salary order me.`}/>
        {salaryRows.length === 0 ? (<EmptyState title={`No salary generated for ${periodLabel}`} description="Salary generate karne ke baad selected period ka employee graph yahan dikhega." action={<Link href="/salary">
                <Button variant="secondary">Generate Salary</Button>
              </Link>}/>) : (<div className="grid gap-5 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/45 bg-white/45 p-4 dark:border-white/10 dark:bg-white/10">
                <p className="text-xs uppercase text-muted-foreground">Period</p>
                <p className="mt-1 font-semibold">{periodLabel}</p>
              </div>
              <div className="rounded-lg border border-white/45 bg-white/45 p-4 dark:border-white/10 dark:bg-white/10">
                <p className="text-xs uppercase text-muted-foreground">Salary Records</p>
                <p className="mt-1 font-semibold">{salaryRows.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <p className="text-xs uppercase text-emerald-700 dark:text-emerald-300">Highest Salary</p>
                <p className="mt-1 font-semibold">{highestSalary?.employee?.name || highestSalary?.employeeId} · {formatCurrency(highestSalary?.netSalary || 0)}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {salaryRows.map((salary) => {
                    const employeeName = salary.employee?.name || salary.employeeId;
                    const percent = maxSalary > 0 ? Math.max((salary.netSalary / maxSalary) * 100, 3) : 3;
                    const isHighest = salary._id === highestSalary?._id;
                    return (<div key={salary._id} className="grid gap-2 rounded-lg border border-white/45 bg-white/35 p-3 dark:border-white/10 dark:bg-white/10">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{employeeName}</p>
                        <p className="text-xs text-muted-foreground">{salary.employeeId} · {monthName(salary.month)} {salary.year}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {isHighest ? <Badge tone="success">Highest</Badge> : null}
                        <span>{formatCurrency(salary.netSalary)}</span>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${isHighest ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${percent}%` }}/>
                    </div>
                  </div>);
                })}
            </div>
          </div>)}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Recent Salary Activity" description="Latest generated or updated salary records."/>
          {recentSalaries.length === 0 ? (<EmptyState title="No salary records yet" description="Generate the first salary slip from the Salary workspace." action={<Link href="/salary">
                  <Button variant="secondary">Open Salary</Button>
                </Link>}/>) : (<div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-white/35 text-xs uppercase text-muted-foreground dark:bg-white/10">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Month</th>
                    <th className="px-5 py-3 font-semibold">Net Salary</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentSalaries.map((salary) => (<tr key={salary._id} className="hover:bg-white/35 dark:hover:bg-white/10">
                      <td className="px-5 py-4">
                        <p className="font-medium">{salary.employee?.name || salary.employeeId}</p>
                        <p className="text-xs text-muted-foreground">{salary.employeeId}</p>
                      </td>
                      <td className="px-5 py-4">{monthName(salary.month)} {salary.year}</td>
                      <td className="px-5 py-4 font-semibold">{formatCurrency(salary.netSalary)}</td>
                      <td className="px-5 py-4">
                        <Badge tone={salary.status === "Paid" ? "success" : "danger"}>{salary.status}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Link className="text-primary hover:underline" href={`/slips/${salary._id}`}>
                          View
                        </Link>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </Card>

        <Card>
          <CardHeader title="Payment Status" description={`${periodLabel} payment status distribution.`}/>
          <div className="grid gap-4 p-5">
            <StatusBar label="Paid" value={filteredSalaries.filter((item) => item.status === "Paid").length} total={filteredSalaries.length} tone="bg-emerald-500"/>
            <StatusBar label="Pending" value={filteredSalaries.filter((item) => item.status === "Pending").length} total={filteredSalaries.length} tone="bg-amber-500"/>
            <div className="rounded-lg border border-white/45 bg-white/40 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10">
              <p className="text-sm font-semibold">School Payroll Office</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Salary slips include absence deduction, excess casual leave adjustment, advance recovery, payment status, and digital signature space.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>);
}
function StatusBar({ label, value, total, tone }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (<div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }}/>
      </div>
    </div>);
}

function resizeProfileImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Invalid image"));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Image read failed"));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("Image load failed"));
            image.onload = () => {
                const size = 360;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d");
                if (!context) {
                    reject(new Error("Canvas failed"));
                    return;
                }
                const scale = Math.max(size / image.width, size / image.height);
                const width = image.width * scale;
                const height = image.height * scale;
                context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.86));
            };
            image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

function TiltPhoto({ images, alt }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative h-48 w-full shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/30 shadow-2xl transition-shadow hover:shadow-primary/30 sm:h-64 sm:w-96"
    >
      <div 
        style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }}
        className="absolute inset-0"
      >
        <AnimatePresence mode="popLayout">
          <motion.img 
            key={currentIndex}
            src={images?.[currentIndex]} 
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            onError={(e) => { e.currentTarget.src = "/school-logo.png" }}
            alt={alt} 
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-110"
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/20" />
      </div>
    </motion.div>
  );
}

function GreetingClock() {
  const [time, setTime] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => {});

    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return <div className="h-[88px] mb-6 rounded-2xl bg-muted/20 animate-pulse" />;

  const hour = time.getHours();
  let greeting = "Good Evening";
  let icon = "🌙";
  let gradient = "from-indigo-600 to-slate-900";
  let textGradient = "from-indigo-100 to-blue-50";

  if (hour >= 5 && hour < 12) {
    greeting = "Good Morning";
    icon = "🌅";
    gradient = "from-orange-500 to-amber-300";
    textGradient = "from-orange-950 to-amber-900";
  } else if (hour >= 12 && hour < 17) {
    greeting = "Good Afternoon";
    icon = "☀️";
    gradient = "from-blue-500 to-cyan-300";
    textGradient = "from-blue-950 to-cyan-900";
  } else if (hour >= 17 && hour < 22) {
    greeting = "Good Evening";
    icon = "🌇";
    gradient = "from-purple-600 to-indigo-500";
    textGradient = "from-purple-50 to-indigo-100";
  } else {
    greeting = "Late Night";
    icon = "✨";
    gradient = "from-slate-900 to-indigo-950";
    textGradient = "from-slate-200 to-indigo-100";
  }

  const formattedTime = time.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = time.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
      style={{ transformStyle: "preserve-3d" }}
      className={`relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-0.5 shadow-2xl`}
    >
      <div className="relative flex flex-col items-center justify-between gap-4 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-xl dark:bg-black/20 sm:flex-row">
        
        {/* Left: Greeting */}
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner backdrop-blur-md"
          >
            {icon}
          </motion.div>
          <div className="text-center sm:text-left">
            <h2 className={`text-2xl font-black bg-gradient-to-r ${textGradient} bg-clip-text text-transparent drop-shadow-sm`}>
              {greeting}, {user?.name || "Admin"}
            </h2>
            <p className="text-sm font-medium text-white/90 drop-shadow-sm">{user?.role || "System Administrator"}</p>
          </div>
        </div>

        {/* Right: Clock */}
        <div className="flex flex-col items-center sm:items-end">
          <div className="flex items-center gap-2 rounded-xl bg-black/20 px-4 py-2 shadow-inner backdrop-blur-md">
            <CalendarClock className="h-5 w-5 text-white/90" />
            <span className="font-mono text-xl font-bold tracking-widest text-white drop-shadow-md">
              {formattedTime}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/80">
            {formattedDate}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
