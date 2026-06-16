import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Save, CreditCard, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProcessorFeeConfig({ salonId }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.email === 'padentrovoy@gmail.com';
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    stripe_rate_percentage: 2.9,
    stripe_fixed_fee: 0.30,
    external_terminal_rate_percentage: 0,
    ath_movil_rate_percentage: 2.25,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    base44.entities.BusinessSettings.filter({ salon_id: salonId }).then(arr => {
      if (arr[0]) {
        setSettings(arr[0]);
        setForm({
          stripe_rate_percentage: arr[0].stripe_rate_percentage ?? 2.9,
          stripe_fixed_fee: arr[0].stripe_fixed_fee ?? 0.30,
          external_terminal_rate_percentage: arr[0].external_terminal_rate_percentage ?? 0,
          ath_movil_rate_percentage: arr[0].ath_movil_rate_percentage ?? 2.25,
        });
      }
    });
  }, [salonId]);

  const handleSave = async () => {
    setSaving(true);
    if (settings) {
      await base44.entities.BusinessSettings.update(settings.id, { ...form, salon_id: salonId });
    } else {
      const created = await base44.entities.BusinessSettings.create({ ...form, salon_id: salonId });
      setSettings(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <CreditCard className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Payment Processor Fee Configuration</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-xs flex items-center gap-1">
            Stripe Rate % {!isSuperAdmin && <Lock className="w-3 h-3 text-muted-foreground" />}
          </Label>
          {isSuperAdmin ? (
            <Input
              type="number"
              step="0.01"
              value={form.stripe_rate_percentage}
              onChange={e => setForm(f => ({ ...f, stripe_rate_percentage: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary border-border text-foreground mt-1"
            />
          ) : (
            <div className="flex items-center gap-2 mt-1 h-9 px-3 rounded-md border border-border bg-secondary/50 text-muted-foreground text-sm cursor-not-allowed">
              {form.stripe_rate_percentage}%
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Default 2.9%</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs flex items-center gap-1">
            Stripe Fixed Fee ($) {!isSuperAdmin && <Lock className="w-3 h-3 text-muted-foreground" />}
          </Label>
          {isSuperAdmin ? (
            <Input
              type="number"
              step="0.01"
              value={form.stripe_fixed_fee}
              onChange={e => setForm(f => ({ ...f, stripe_fixed_fee: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary border-border text-foreground mt-1"
            />
          ) : (
            <div className="flex items-center gap-2 mt-1 h-9 px-3 rounded-md border border-border bg-secondary/50 text-muted-foreground text-sm cursor-not-allowed">
              ${form.stripe_fixed_fee}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Default $0.30/transaction</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">External Terminal Card Fee %</Label>
          <Input
            type="number"
            step="0.01"
            value={form.external_terminal_rate_percentage}
            onChange={e => setForm(f => ({ ...f, external_terminal_rate_percentage: parseFloat(e.target.value) || 0 }))}
            className="bg-secondary border-border text-foreground mt-1"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">ATH Móvil Fee %</Label>
          <Input
            type="number"
            step="0.01"
            value={form.ath_movil_rate_percentage}
            onChange={e => setForm(f => ({ ...f, ath_movil_rate_percentage: parseFloat(e.target.value) || 0 }))}
            className="bg-secondary border-border text-foreground mt-1"
          />
          <p className="text-xs text-muted-foreground mt-0.5">Default 2.25%</p>
        </div>
      </div>

      <div className="flex items-center gap-2 py-1 bg-secondary/50 border border-border rounded-lg px-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground">Cash Transactions</p>
          <p className="text-xs text-muted-foreground">Always 0% — hardcoded, no fees</p>
        </div>
        <span className="text-xs font-semibold text-green-400">0%</span>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
        {saving ? 'Saving...' : saved ? '✓ Saved!' : <><Save className="w-3.5 h-3.5 mr-1.5" />Save Fee Config</>}
      </Button>
    </div>
  );
}