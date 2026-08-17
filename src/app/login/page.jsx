import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
export default function LoginPage() {
    return (<main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="glass-card w-full max-w-md rounded-xl p-6">
        <div className="mb-7 flex items-center gap-3">
          <img src="/school-logo.png" alt="School logo" className="brand-logo h-14 w-14"/>
          <div>
            <h1 className="school-name-gradient text-lg">Savitri Balika Inter College</h1>
            <p className="text-sm text-muted-foreground">Khutaha Road, Jamunahiya, Mirzapur</p>
          </div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Use configured admin or accountant credentials.
        </p>
      </section>
    </main>);
}
