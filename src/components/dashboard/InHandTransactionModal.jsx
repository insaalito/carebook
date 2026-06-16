import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, DollarSign, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const defaultForm = {
  customer_name: '',
  service_name: '',
  amount: '',
  payment_method: 'Cash',
  date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  selected_staff_id: '',
};

export default function InHandTransactionModal({ user, salon, staffRecord, onClose }) {
  const [form, setForm] = useState(defaultForm);
  const [transactions, setTransactions] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('add'); // 'add' | 'history'

  useEffect(() => {
    if (!salon?.id) return;
    const query = user?.role === 'admin'
      ? { salon_id: salon.id }
      : { staff_email: user.email, salon_id: salon.id };
    Promise.all([
      base44.entities.InHandTransaction.filter(query, '-date', 50),
      base44.entities.Service.filter({ salon_id: salon.id, is_active: true }),
      user?.role === 'admin' ? base44.entities.Staff.filter({ salon_id: salon.id, is_active: true }) : Promise.resolve([]),
    ]).then(([list, svcs, staff]) => {
      setTransactions(list);
      setServices(svcs);
      setStaffList(staff);
    }).finally(() => setLoading(false));
  }, [salon, user]);

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.amount || !form.date) return;
    setSaving(true);
    const selectedStaff = staffList.find(s => s.id === form.selected_staff_id);
    const newTx = await base44.entities.InHandTransaction.create({
      salon_id: salon.id,
      salon_owner_email: salon.owner_email,
      staff_id: selectedStaff?.id || staffRecord?.id || user.id,
      staff_name: selectedStaff?.name || staffRecord?.name || user.full_name || user.email,
      staff_email: selectedStaff?.user_email || user.email,
      customer_name: form.customer_name.trim(),
      service_name: form.service_name.trim(),
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      date: form.date,
      notes: form.notes.trim(),
    });
    setTransactions(prev => [newTx, ...prev]);
    setForm(defaultForm);
    setSaving(false);
    setTab('history');
  };

  const totalAmount = transactions.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">In-Hand Transactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cash · ATH Móvil · External Card</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {[{ key: 'add', label: '+ Add Transaction' }, { key: 'history', label: `History (${transactions.length})` }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'add' ? (
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customer Name *</label>
                <input
                  value={form.customer_name}
                  onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Service</label>
                <select
                  value={form.service_name}
                  onChange={e => {
                    const svc = services.find(s => s.name === e.target.value);
                    setForm(p => ({
                      ...p,
                      service_name: e.target.value,
                      amount: svc ? String(svc.price) : p.amount,
                    }));
                  }}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer hover:border-primary/40 transition-colors"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                >
                  <option value="" className="bg-card text-muted-foreground">— Select a service —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.name} className="bg-card text-foreground">{s.name} · ${s.price}</option>
                  ))}
                </select>
              </div>
              {user?.role === 'admin' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Staff Member</label>
                  <select
                    value={form.selected_staff_id}
                    onChange={e => setForm(p => ({ ...p, selected_staff_id: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer hover:border-primary/40 transition-colors"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="" className="bg-card text-muted-foreground">— Select staff member —</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Payment Method *</label>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer hover:border-primary/40 transition-colors"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="Cash" className="bg-card text-foreground">Cash</option>
                    <option value="ATH_Movil" className="bg-card text-foreground">ATH Móvil</option>
                    <option value="External_Card" className="bg-card text-foreground">External Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes <span className="text-muted-foreground/50">(optional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional details about this transaction..."
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !form.customer_name.trim() || !form.amount || !form.date}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1" />
                {saving ? 'Saving...' : 'Save Transaction'}
              </Button>
            </div>
          ) : (
            <div className="p-6">
              {/* Summary */}
              <div className="bg-secondary border border-border rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total In-Hand</span>
                </div>
                <span className="font-bebas text-2xl text-primary">${totalAmount.toFixed(2)}</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={tx.id} className="bg-secondary border border-border rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.customer_name}</p>
                          {tx.service_name && <p className="text-xs text-muted-foreground">{tx.service_name}</p>}
                        </div>
                        <span className="font-semibold text-primary text-sm">${(tx.amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {tx.payment_method?.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                        {tx.staff_name && user?.role === 'admin' && (
                          <span className="text-xs text-muted-foreground">· {tx.staff_name}</span>
                        )}
                      </div>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground/80 mt-2 italic border-t border-border/50 pt-2">
                          {tx.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}