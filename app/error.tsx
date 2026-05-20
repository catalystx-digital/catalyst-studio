'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900">Error</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-700">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600">
            We apologize for the inconvenience. Please try again.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
