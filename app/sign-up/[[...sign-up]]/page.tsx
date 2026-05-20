"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions, useUser } from "@/lib/auth/hooks";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const signUpSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Re-enter your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const { signUp } = useAuthActions();
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get("redirect_url");
  const redirect = rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
  const prefilledEmail = searchParams?.get("email") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: prefilledEmail,
      password: "",
      confirmPassword: "",
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
    try {
      await signUp({ name: values.name, email: values.email, password: values.password });
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "Unable to create account");
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
            <Sparkles className="h-4 w-4" />
            Built for creators
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
            Create your Catalyst Studio account
          </h1>
          <p className="mx-auto max-w-lg text-base text-white/70 lg:mx-0">
            A single account gives you access to the AI builder, component library, deployment tooling, and analytics—without switching contexts.
          </p>
          <div className="grid gap-3 text-sm text-white/60 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <p className="font-medium text-white">All-in-one workspace</p>
              <p className="mt-1 text-xs text-white/60">
                Manage sites, content types, shared blocks, and AI conversations in one place.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <p className="font-medium text-white">Self-host ready</p>
              <p className="mt-1 text-xs text-white/60">
                App-owned authentication and Prisma migrations keep setup portable.
              </p>
            </div>
          </div>
        </div>
        <Card className="border-white/15 bg-white text-neutral-900 shadow-2xl shadow-black/25">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-neutral-900">Get started in minutes</CardTitle>
            <CardDescription className="text-sm text-neutral-500">
              Tell us a few details to spin up your Catalyst workspace.
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
                <Label htmlFor="name" className="text-sm font-medium text-neutral-700">
                  Full name
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jordan Smith"
                  disabled={pending}
                  {...form.register("name")}
                  className="h-11 border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-catalyst-orange"
                />
                {form.formState.errors.name ? (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
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
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  disabled={pending}
                  {...form.register("password")}
                  className="h-11 border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-catalyst-orange"
                />
                {form.formState.errors.password ? (
                  <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-neutral-700">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  disabled={pending}
                  {...form.register("confirmPassword")}
                  className="h-11 border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-catalyst-orange"
                />
                {form.formState.errors.confirmPassword ? (
                  <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
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
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-center border-t border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
            <div className="py-4">
              Already have an account?{" "}
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent(redirect)}`}
                className="font-medium text-catalyst-orange hover:text-catalyst-orange/80"
              >
                Sign in instead
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </AuthShell>
  );
}

