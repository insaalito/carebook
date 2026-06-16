import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Reset failed, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="flex items-center justify-center gap-2 mb-8 mx-auto hover:opacity-80 transition-opacity cursor-pointer">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-7 h-7 object-contain" />
          <span className="font-bebas text-3xl tracking-widest text-primary">CareBook</span>
        </button>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <h1 className="font-bebas text-4xl tracking-wider text-foreground text-center mb-1">NEW PASSWORD</h1>
          <p className="text-muted-foreground text-sm text-center mb-8">Enter your new password below</p>
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-foreground">Password updated! You can now sign in.</p>
              <Link to="/login" className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">Go to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">New Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="bg-secondary border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Confirm Password</Label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required className="bg-secondary border-border text-foreground mt-1" />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}