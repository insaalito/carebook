import { DollarSign } from 'lucide-react';

export default function PayoutsPanel({ appointments, staff }) {
  const staffWithCommission = staff.filter(s => s.owner_fee_enabled && s.owner_fee_percentage > 0);

  if (staffWithCommission.length === 0) return null;

  const payouts = staffWithCommission.map(s => {
    const staffAppts = appointments.filter(a => a.staff_id === s.id);
    const totalPayout = staffAppts.reduce((sum, a) => sum + (a.staff_payout_amount || 0), 0);
    const cuts = staffAppts.length;
    return { ...s, totalPayout, cuts };
  }).filter(s => s.cuts > 0);

  if (payouts.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Payouts Owed</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Owner fee collected from staff for completed appointments</p>
      </div>
      <div className="divide-y divide-border">
        {payouts.map(s => (
          <div key={s.id} className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{s.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.owner_fee_percentage}% owner fee · {s.cuts} completed {s.cuts === 1 ? 'cut' : 'cuts'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-primary font-semibold">
              <DollarSign className="w-4 h-4" />
              {s.totalPayout.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}