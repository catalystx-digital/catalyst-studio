'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/supabase/hooks';
import {
  LandingHeader,
  HeroSection,
  FeaturesSection,
  TemplateGallery,
  TestimonialsSection,
  FinalCtaSection,
  LandingFooter,
} from '@/components/marketing';

/**
 * Root Landing Page
 *
 * For unauthenticated users: Shows the experiential landing page
 * For authenticated users: Redirects to the dashboard
 *
 * This replaces the previous hostile "Please sign in" experience
 * with a value-first approach that builds trust before asking for commitment.
 */
export default function HomePage() {
  const user = useUser();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Show loading state briefly while checking auth
  // This prevents flash of landing page for authenticated users
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-catalyst-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TemplateGallery />
        <TestimonialsSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
