import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch (_) {}
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
          <button onClick={() => navigate('/')} className="flex items-center justify-center gap-2 mb-8 mx-auto hover:opacity-80 transition-opacity cursor-pointer">
            <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-7 h-7 object-contain" />
            <span className="font-bebas text-3xl tracking-widest text-primary">CareBook</span>
          </button>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <h1 className="font-bebas text-4xl tracking-wider text-foreground text-center mb-1">RESET PASSWORD</h1>
          <p className="text-muted-foreground text-sm text-center mb-8">We'll send you a reset link</p>
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-foreground">If that email exists, a reset link is on its way. Check your inbox.</p>
              <Link to="/login" className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">Back to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="bg-secondary border-border text-foreground mt-1" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:text-primary/80 transition-colors font-medium">Back to Sign In</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}