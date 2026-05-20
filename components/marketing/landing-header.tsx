'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Landing Page Header for Unauthenticated Users
 *
 * Features:
 * - Responsive navigation (desktop/mobile)
 * - Prominent CTAs (Sign In, Start Free)
 * - Navigation links to key sections
 */
export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#templates', label: 'Templates' },
    { href: '/docs', label: 'Docs' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080808]/95 backdrop-blur supports-[backdrop-filter]:bg-[#080808]/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo - Clean wordmark */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">
            Catalyst<span className="text-catalyst-orange">Studio</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild className="text-white/70 hover:text-white hover:bg-white/10">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild className="bg-catalyst-orange text-white hover:bg-catalyst-orange/90">
            <Link href="/sign-up">Start Free</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'overflow-hidden border-t border-white/10 bg-[#080808] transition-all duration-300 md:hidden',
          mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 border-t border-white/10" />
          <Link
            href="/sign-in"
            className="rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Sign In
          </Link>
          <Button asChild className="mt-2 w-full bg-catalyst-orange text-white hover:bg-catalyst-orange/90">
            <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
              Start Free
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
