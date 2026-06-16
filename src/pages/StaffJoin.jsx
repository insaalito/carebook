import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function StaffJoin() {
  const [status, setStatus] = useState('loading'); // loading | needs_auth | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing invite token.');
      return;
    }

    base44.auth.isAuthenticated().then(isAuthed => {
      if (!isAuthed) {
        setStatus('needs_auth');
        return;
      }

      // Logged in — accept the invite
      base44.functions.invoke('acceptStaffInvite', { token }).then(res => {
        if (res.data?.error) {
          setStatus('error');
          setMessage(res.data.error);
        } else {
          setStatus('success');
        }
      }).catch(err => {
        setStatus('error');
        setMessage(err.message || 'Something went wrong. Please try again.');
      });
    });
  }, []);

  // Encode current URL so auth pages can redirect back here after login/register
  const returnUrl = encodeURIComponent(window.location.href);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">

        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-2">JOINING SALON</h2>
            <p className="text-muted-foreground text-sm">Validating your invite...</p>
          </>
        )}

        {status === 'needs_auth' && (
          <>
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-2">YOU'RE INVITED!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Create an account or sign in with the invited email to accept this invitation and join the salon.
            </p>
            <div className="flex flex-col gap-3">
              <Link to={`/register?next=${returnUrl}`}>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  Create Account
                </Button>
              </Link>
              <Link to={`/login?next=${returnUrl}`}>
                <Button variant="outline" className="border-border text-foreground w-full">
                  I Already Have an Account
                </Button>
              </Link>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-2">WELCOME ABOARD!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              You've successfully joined the salon. Your account is pending activation by the owner.
            </p>
            <Button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
            >
              Go to Employee Dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-2">INVITE FAILED</h2>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link to="/">
              <Button variant="outline" className="border-border text-foreground w-full">Go Home</Button>
            </Link>
          </>
        )}

      </div>
    </div>
  );
}