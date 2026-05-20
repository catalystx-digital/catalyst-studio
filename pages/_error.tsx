import { NextPage, NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
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
        <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
          {statusCode}
        </h1>
        <h2 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
          {statusCode === 404 ? 'Page Not Found' : 'An Error Occurred'}
        </h2>
        <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
          {statusCode === 404
            ? "The page you're looking for doesn't exist or has been moved."
            : 'Something went wrong. Please try again later.'}
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem'
          }}
        >
          Go to Homepage
        </a>
      </div>
    </div>
  );
};

Error.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? (err.statusCode ?? 500) : 404;
  return { statusCode };
};

export default Error;
