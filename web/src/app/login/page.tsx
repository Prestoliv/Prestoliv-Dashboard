'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCurrentUserRole } from "@/lib/auth/useCurrentUserRole";
import { postAuthHref } from "@/lib/auth/postAuthRedirect";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import Link from "next/link";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = signInSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { mode?: string };
}) {
  const router = useRouter();
  const { loading, userId } = useCurrentUserRole();

  const initialMode = useMemo(() => {
    const mode = searchParams?.mode;
    return mode === "signup" ? "signup" : "signin";
  }, [searchParams?.mode]);

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!loading && userId) {
      router.replace(postAuthHref(userId));
    }
  }, [loading, userId, router]);

  const switchMode = (next: "signin" | "signup") => {
    setError(null);
    setSuccessMessage(null);
    setMode(next);
  };

  return (
    <div 
      data-login-page 
      className="fixed inset-0 bg-[#f0f7f9] overflow-hidden z-50"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(14,116,144,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,116,144,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      
      {/* Main */}
      <main className="absolute inset-0 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header text */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#0c4a5e", fontFamily: "'Georgia', serif" }}
            >
              {mode === "signin" ? "Welcome back" : "Get started"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === "signin"
                ? "Sign in to access your projects and updates."
                : "Create your account. Default role is customer."}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl bg-white border border-cyan-900/8 shadow-sm overflow-hidden">

            {/* Mode toggle */}
            <div className="flex border-b border-slate-100">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                    mode === m
                      ? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Error / Success banners */}
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M7.5 4.5v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <svg className="mt-0.5 flex-shrink-0" width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M5 7.5l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {successMessage}
                </div>
              )}

              {/* Sign In Form */}
              {mode === "signin" ? (
                <form
                  className="space-y-4"
                  onSubmit={signInForm.handleSubmit(async (values) => {
                    setError(null);
                    setSuccessMessage(null);
                    setBusy(true);
                    try {
                      const { data, error: authError } = await supabase.auth.signInWithPassword(values);
                      if (authError) throw authError;
                      if (data.user) {
                        router.replace(postAuthHref(data.user.id));
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Sign in failed");
                    } finally {
                      setBusy(false);
                    }
                  })}
                >
                  <FormField
                    id="signin-email"
                    label="Email address"
                    error={signInForm.formState.errors.email?.message}
                  >
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className={inputClass}
                      {...signInForm.register("email")}
                    />
                  </FormField>

                  <FormField
                    id="signin-password"
                    label="Password"
                    error={signInForm.formState.errors.password?.message}
                  >
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      className={inputClass}
                      {...signInForm.register("password")}
                    />
                  </FormField>

                  <SubmitButton busy={busy} label="Sign in" busyLabel="Signing in…" />
                </form>
              ) : (
                /* Sign Up Form */
                <form
                  className="space-y-4"
                  onSubmit={signUpForm.handleSubmit(async (values) => {
                    setError(null);
                    setSuccessMessage(null);
                    setBusy(true);
                    try {
                      const { data, error: authError } = await supabase.auth.signUp({
                        email: values.email,
                        password: values.password,
                        options: { data: { name: values.name, role: "customer" } },
                      });
                      if (authError) throw authError;
                      setSuccessMessage(
                        data.user
                          ? "Account created. If email confirmations are enabled, check your inbox."
                          : "Check your inbox to confirm your email address."
                      );
                      const { data: u } = await supabase.auth.getUser();
                      if (u.user) {
                        router.replace(postAuthHref(u.user.id));
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Sign up failed");
                    } finally {
                      setBusy(false);
                    }
                  })}
                >
                  <FormField
                    id="signup-name"
                    label="Full name"
                    error={signUpForm.formState.errors.name?.message}
                  >
                    <Input
                      id="signup-name"
                      placeholder="Jane Doe"
                      className={inputClass}
                      {...signUpForm.register("name")}
                    />
                  </FormField>

                  <FormField
                    id="signup-email"
                    label="Email address"
                    error={signUpForm.formState.errors.email?.message}
                  >
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      className={inputClass}
                      {...signUpForm.register("email")}
                    />
                  </FormField>

                  <FormField
                    id="signup-password"
                    label="Password"
                    error={signUpForm.formState.errors.password?.message}
                  >
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className={inputClass}
                      {...signUpForm.register("password")}
                    />
                  </FormField>

                  <SubmitButton busy={busy} label="Create account" busyLabel="Creating account…" />
                </form>
              )}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-400 mt-5">
            Secured with Supabase Auth & Postgres Row-Level Security
          </p>
        </div>
      </main>
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────────────────── */

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100";

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5.5 3.5v2.5M5.5 7.5v.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-100 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{ background: "linear-gradient(135deg, #0891b2 0%, #0d9488 100%)" }}
    >
      {busy ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"/>
            <path d="M7 1.5A5.5 5.5 0 0112.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {busyLabel}
        </span>
      ) : label}
    </button>
  );
}