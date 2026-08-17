"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
export function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState("Ashish");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mode, setMode] = useState("login");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    async function submit(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        setLoading(false);
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            setError(data?.message || "Unable to sign in.");
            return;
        }
        const nextParam = params.get("next");
        const targetUrl = (nextParam && nextParam !== "/" && nextParam !== "/login") ? nextParam : "/dashboard";
        window.location.href = targetUrl;
    }
    async function requestOtp(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "Unable to send OTP.");
            return;
        }
        setMode("verify");
    }
    async function verifyOtp(event) {
        event.preventDefault();
        setError("");
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "OTP verification failed.");
            return;
        }
        setResetToken(data.resetToken);
        setMode("reset");
    }
    async function resetPassword(event) {
        event.preventDefault();
        setError("");
        if (newPassword !== confirmPassword) {
            setError("New password does not match.");
            return;
        }
        setLoading(true);
        const response = await fetch("/api/auth/forgot-password/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, resetToken, password: newPassword })
        });
        setLoading(false);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            setError(data?.message || "Unable to reset password.");
            return;
        }
        setPassword("");
        setOtp("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setMode("login");
    }
    if (mode === "forgot") {
        return (<form onSubmit={requestOtp} className="grid gap-4">
          <Field label="Username">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input className="pl-10" type="text" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required/>
            </div>
          </Field>
          {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            <Mail className="h-4 w-4"/>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setMode("login")}>Back to login</button>
        </form>);
    }
    if (mode === "verify") {
        return (<form onSubmit={verifyOtp} className="grid gap-4">
          <Field label="OTP">
            <Input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required/>
          </Field>
          {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            <ShieldCheck className="h-4 w-4"/>
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setMode("forgot")}>Resend OTP</button>
        </form>);
    }
    if (mode === "reset") {
        return (<form onSubmit={resetPassword} className="grid gap-4">
          <Field label="New Password">
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required/>
          </Field>
          <Field label="Confirm New Password">
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required/>
          </Field>
          {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            <LockKeyhole className="h-4 w-4"/>
            {loading ? "Saving..." : "Create New Password"}
          </Button>
        </form>);
    }
    return (<form onSubmit={submit} className="grid gap-4">
      <Field label="Username">
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input className="pl-10" type="text" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required/>
        </div>
      </Field>
      <Field label="Password">
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input className="pl-10 pr-10" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required/>
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
      </Field>
      {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        <ShieldCheck className="h-4 w-4"/>
        {loading ? "Signing in..." : "Secure Login"}
      </Button>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => {
            setError("");
            setMode("forgot");
        }}>Forgot Password</button>
    </form>);
}
