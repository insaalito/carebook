import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const salonId = searchParams.get('salon_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session found');
      setLoading(false);
      return;
    }

    const confirmPayment = async () => {
      try {
        const response = await base44.functions.invoke('confirmPaymentAndBooking', {
          sessionId,
          salonId,
        });

        if (response.data.success) {
          if (!response.data.duplicate) {
            toast.success('Payment completed, appointment secured!');
          }
          // Replace history so the user can't navigate back to this page
          setTimeout(() => {
            navigate('/profile', { replace: true });
          }, 1500);
        }
      } catch (err) {
        console.error('Payment confirmation failed:', err);
        setError(err.message || 'Failed to confirm payment');
        setLoading(false);
      }
    };

    confirmPayment();
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {loading && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
            <p className="text-foreground">Processing your payment...</p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}