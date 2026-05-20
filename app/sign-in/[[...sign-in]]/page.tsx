"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSupabaseClient, useUser } from "@/lib/supabase/hooks";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get("redirect_url");
  const redirect = rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      router.replace(redirect);
    }
  }, [redirect, router, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setPending(true);
    const {
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    setPending(false);
    router.replace(redirect);
  });

  return (
    <AuthShell>
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_minmax(0,_1fr)]">
        <div className="space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.35em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Secure workspace access
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
            Welcome back to Catalyst Studio
          </h1>
          <p className="mx-auto max-w-lg text-base text-white/70 lg:mx-0">
            Sign in with the credentials you created during setup to continue editing sites, managing content, and collaborating with your team.
          </p>
          <div className="grid gap-3 text-sm text-white/60 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <p className="font-medium text-white">AI-first editing</p>
              <p className="mt-1 text-xs text-white/60">
                Bring pages to life faster with intelligent suggestions, reusable blocks, and live previews.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <p className="font-medium text-white">Team ready</p>
              <p className="mt-1 text-xs text-white/60">
                Switch across projects effortlessly while we keep environments and permissions aligned.
              </p>
            </div>
          </div>
        </div>
        <Card className="border-white/15 bg-white text-neutral-900 shadow-2xl shadow-black/25">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-neutral-900">Sign in</CardTitle>
            <CardDescription className="text-sm text-neutral-500">
              Use your email and password to access Catalyst Studio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2 text-left">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={pending}
                  {...form.register("email")}
                  className="h-11 border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-catalyst-orange"
                />
                {form.formState.errors.email ? (
                  <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password" className="text-sm font-medium text-neutral-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={pending}
                  {...form.register("password")}
                  className="h-11 border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-catalyst-orange"
                />
                {form.formState.errors.password ? (
                  <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={pending}
                className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-center border-t border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
            <div className="py-4">
              Need an account?{" "}
              <Link
                href={`/sign-up?redirect_url=${encodeURIComponent(redirect)}`}
                className="font-medium text-catalyst-orange hover:text-catalyst-orange/80"
              >
                Create one now
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </AuthShell>
  );
}



