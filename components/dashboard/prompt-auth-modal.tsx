'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '@/lib/supabase/hooks';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInValues = z.infer<typeof signInSchema>;

const signUpSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Re-enter your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

interface PromptAuthModalProps {
  open: boolean;
  onClose: () => void;
  initialPrompt: string | null;
  onAuthenticated: () => void;
}

type AuthMode = 'sign-in' | 'sign-up';

type SubmissionState = { mode: AuthMode; pending: boolean } | { pending: false; mode: null };

const initialSubmissionState: SubmissionState = { pending: false, mode: null };

export function PromptAuthModal({ open, onClose, onAuthenticated }: PromptAuthModalProps) {
  const supabase = useSupabaseClient();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [submission, setSubmission] = useState<SubmissionState>(initialSubmissionState);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!open) {
      setError(null);
      setConfirmation(false);
      setSubmission(initialSubmissionState);
      signInForm.reset();
      signUpForm.reset();
      setMode('sign-in');
    }
  }, [open, signInForm, signUpForm]);

  const handleModeChange = useCallback((next: AuthMode) => {
    setMode(next);
    setError(null);
    setConfirmation(false);
  }, []);

  const handleSignIn = signInForm.handleSubmit(async (values) => {
    setError(null);
    setSubmission({ mode: 'sign-in', pending: true });

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmission(initialSubmissionState);
      return;
    }

    setSubmission(initialSubmissionState);
    onAuthenticated();
    onClose();
  });

  const handleSignUp = signUpForm.handleSubmit(async (values) => {
    setError(null);
    setConfirmation(false);
    setSubmission({ mode: 'sign-up', pending: true });

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.name },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmission(initialSubmissionState);
      return;
    }

    if (data.session) {
      setSubmission(initialSubmissionState);
      onAuthenticated();
      onClose();
      return;
    }

    setConfirmation(true);
    setSubmission(initialSubmissionState);
  });

  const isSubmitting = submission.pending;
  const isSignInSubmitting = submission.pending && submission.mode === 'sign-in';
  const isSignUpSubmitting = submission.pending && submission.mode === 'sign-up';

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-2xl border border-white/15 bg-[#0E1017] text-white">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-2xl font-semibold text-white">
            Access Catalyst Studio to continue
          </DialogTitle>
          <DialogDescription className="text-sm text-white/70">
            We need an account to launch imports and save your work. Sign in or create a workspace without leaving the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === 'sign-in' ? 'default' : 'ghost'}
            className={mode === 'sign-in' ? 'bg-catalyst-orange text-white hover:bg-catalyst-orange/90' : 'text-white/70 hover:text-white'}
            onClick={() => handleModeChange('sign-in')}
            disabled={isSubmitting}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === 'sign-up' ? 'default' : 'ghost'}
            className={mode === 'sign-up' ? 'bg-catalyst-orange text-white hover:bg-catalyst-orange/90' : 'text-white/70 hover:text-white'}
            onClick={() => handleModeChange('sign-up')}
            disabled={isSubmitting}
          >
            Create account
          </Button>
        </div>

        <div className="space-y-5">
          {mode === 'sign-in' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  {...signInForm.register('email')}
                />
                {signInForm.formState.errors.email ? (
                  <p className="text-sm text-red-400">{signInForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="********"
                  disabled={isSubmitting}
                  {...signInForm.register('password')}
                />
                {signInForm.formState.errors.password ? (
                  <p className="text-sm text-red-400">{signInForm.formState.errors.password.message}</p>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90"
              >
                {isSignInSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              {confirmation ? (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <AlertTitle>Check your inbox</AlertTitle>
                  <AlertDescription>
                    We sent a verification email to <span className="font-semibold">{signUpForm.getValues('email')}</span>. Confirm your address to continue.
                  </AlertDescription>
                </Alert>
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-name">Full name</Label>
                <Input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jordan Smith"
                  disabled={isSubmitting}
                  {...signUpForm.register('name')}
                />
                {signUpForm.formState.errors.name ? (
                  <p className="text-sm text-red-400">{signUpForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-signup-email">Email</Label>
                <Input
                  id="auth-signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  {...signUpForm.register('email')}
                />
                {signUpForm.formState.errors.email ? (
                  <p className="text-sm text-red-400">{signUpForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-signup-password">Password</Label>
                <Input
                  id="auth-signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  disabled={isSubmitting}
                  {...signUpForm.register('password')}
                />
                {signUpForm.formState.errors.password ? (
                  <p className="text-sm text-red-400">{signUpForm.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="auth-signup-confirm">Confirm password</Label>
                <Input
                  id="auth-signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                  {...signUpForm.register('confirmPassword')}
                />
                {signUpForm.formState.errors.confirmPassword ? (
                  <p className="text-sm text-red-400">{signUpForm.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90"
              >
                {isSignUpSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
