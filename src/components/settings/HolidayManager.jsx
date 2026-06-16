import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import DatePickerInput from '@/components/ui/DatePickerInput';

export default function HolidayManager({ salonId }) {
  const [dates, setDates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', label: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    base44.entities.ClosureDate.filter({ salon_id: salonId }).then(setDates);
  }, [salonId]);

  const handleAdd = async () => {
    if (!form.date) return;
    setSaving(true);
    const created = await base44.entities.ClosureDate.create({
      salon_id: salonId,
      date: form.date,
      label: form.label,
    });
    setDates(prev => [...prev, created]);
    setForm({ date: '', label: '' });
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.ClosureDate.delete(id);
    setDates(prev => prev.filter(d => d.id !== id));
  };

  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">Holiday & Closure Dates</Label>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Closure Date
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-secondary border border-border rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-medium text-foreground">
                  {d.label ? `${d.label} — ` : ''}
                  {format(new Date(d.date + 'T12:00:00'), 'MMMM d, yyyy')}
                </p>
                <p className="text-xs text-destructive/70 font-medium">Fully Closed</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(d.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-3"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
          <div>
            <Label className="text-muted-foreground text-xs">Date</Label>
            <div className="mt-1">
              <DatePickerInput
                value={form.date}
                onChange={date => setForm(f => ({ ...f, date }))}
                placeholder="Pick a closure date"
              />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Label (optional)</Label>
            <Input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Christmas Day"
              className="bg-card border-border text-foreground mt-1"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setForm({ date: '', label: '' }); }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !form.date}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Adding...' : 'Add Closure'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}