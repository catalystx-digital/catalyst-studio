import Link from 'next/link';
import { Home, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-9xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-3xl font-semibold text-gray-300">
            Page Not Found
          </h2>
          <p className="mt-2 text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <Button asChild className="w-full bg-catalyst-orange text-gray-950 hover:bg-catalyst-orange/90">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Need help?</h3>
          <ul className="space-y-2">
            <li>
              <a
                href="https://docs.catalyststudio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-catalyst-blue hover:text-catalyst-blue/80 hover:underline"
              >
                View Documentation
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href="mailto:support@catalyststudio.com"
                className="text-catalyst-blue hover:text-catalyst-blue/80 hover:underline"
              >
                Contact Support
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
