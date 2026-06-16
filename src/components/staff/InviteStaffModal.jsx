import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Mail, Copy, Check, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InviteStaffModal({ salonId, onClose }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { email_sent, invite_link }
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    setError('');
    const res = await base44.functions.invoke('inviteStaff', { salon_id: salonId, email });
    setSending(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setResult(res.data);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.invite_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-foreground">Invite Staff Member</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="text-center py-2">
            <Mail className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Invite Created!</p>

            {result.email_sent ? (
              <p className="text-muted-foreground text-sm mb-4">
                An invitation email was sent to <span className="text-foreground">{email}</span>
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm mb-3">
                  Email couldn't be sent automatically. Share this link directly with <span className="text-foreground">{email}</span>:
                </p>
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2 mb-4">
                  <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">{result.invite_link}</span>
                  <button onClick={handleCopy} className="text-primary hover:text-primary/80 transition-colors flex-shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}

            <Button onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">Done</Button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label className="text-muted-foreground text-xs mb-1">Staff Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="barber@example.com"
                className="bg-secondary border-border text-foreground mt-1"
              />
            </div>
            {error && <p className="text-destructive text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 border-border text-foreground">Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !email} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                {sending ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}