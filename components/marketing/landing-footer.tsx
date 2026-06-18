'use client';

import Link from 'next/link';
import { Github, Twitter, Linkedin, Youtube } from 'lucide-react';

/**
 * Landing Page Footer - FR-009, FR-010
 *
 * Comprehensive footer with:
 * - Navigation links (Product, Resources, Company, Support)
 * - Social links
 * - Legal links
 */

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Templates', href: '#templates' },
    { label: 'Changelog', href: 'https://github.com/catalystx/catalyst-studio-oss/releases' },
    { label: 'Roadmap', href: 'https://github.com/catalystx/catalyst-studio-oss/issues' },
  ],
  Resources: [
    { label: 'Documentation', href: 'https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#quickstart-simplest-possible' },
    { label: 'API Reference', href: 'https://github.com/catalystx/catalyst-studio-oss/blob/main/README.md#headless--delivery' },
  ],
};

const socialLinks = [
  { icon: Twitter, label: 'Twitter', href: 'https://twitter.com/catalystx' },
  { icon: Github, label: 'GitHub', href: 'https://github.com/catalystx' },
  { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com/company/catalystx' },
  { icon: Youtube, label: 'YouTube', href: 'https://youtube.com/@catalystx' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#080808] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Main footer content */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                Catalyst<span className="text-catalyst-orange">Studio</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-white/60">
              AI-powered visual studio &amp; CMS. Import any site, edit visually, preview live, export anywhere — or run headless GraphQL. One-command local demo.
            </p>

            {/* Social links */}
            <div className="mt-6 flex gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={social.label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} Catalyst Studio. All rights reserved.
          </p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/40 transition-colors hover:text-white/60"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
