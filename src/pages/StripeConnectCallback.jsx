import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function StripeConnectCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting your Stripe account...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Connection failed: ${error}`);
          setTimeout(() => navigate('/settings'), 3000);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received');
          setTimeout(() => navigate('/settings'), 3000);
          return;
        }

        // Call the callback handler function with code and state
        const res = await base44.functions.invoke('handleStripeConnectCallback', {
          code,
          state: searchParams.get('state'),
        });

        setStatus('success');
        setMessage('✓ Stripe account connected successfully!');
        setTimeout(() => navigate('/settings'), 2000);
      } catch (err) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage(`Connection error: ${err.message}`);
        setTimeout(() => navigate('/settings'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="bg-card border border-border rounded-lg p-8 max-w-sm text-center">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <p className="text-foreground font-medium">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">✕</div>
            <p className="text-destructive font-medium">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}