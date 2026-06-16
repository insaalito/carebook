import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link as LinkIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StripeConnectButton({ salonId, stripeAccountId }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke('getStripeConnectUrl', { salonId });
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Stripe Connect error:', error);
      setConnecting(false);
    }
  };

  const isConnected = !!stripeAccountId;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Connect Stripe Account</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isConnected
              ? `Connected · ${stripeAccountId}`
              : 'Link your Stripe account to receive direct deposits for bookings.'}
          </p>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Connected
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            {connecting ? 'Connecting...' : 'Connect Stripe'}
          </Button>
        )}
      </div>
    </div>
  );
}