'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>500</h1>
            <h2 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
              Server Error
            </h2>
            <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
              Something went wrong on our end. Please try again later.
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: '2rem',
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
