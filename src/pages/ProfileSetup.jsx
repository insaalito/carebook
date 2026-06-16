import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfileSetup() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      await base44.auth.updateMe({ full_name: fullName.trim() });
      if (phone.trim()) {
        await base44.entities.ClientPreference.create({
          customer_email: (await base44.auth.me()).email,
          customer_name: fullName.trim(),
          phone: phone.trim(),
        });
      }
      window.location.href = next;
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-7 h-7 object-contain" />
          <span className="font-bebas text-3xl tracking-widest text-primary">CareBook</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <h1 className="font-bebas text-4xl tracking-wider text-foreground text-center mb-1">COMPLETE PROFILE</h1>
          <p className="text-muted-foreground text-sm text-center mb-8">Just a few more details to get you started</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Full Name *</Label>
              <Input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                className="bg-secondary border-border text-foreground mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Phone Number (optional)</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="bg-secondary border-border text-foreground mt-1"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}