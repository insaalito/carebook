import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Generate time options every 30 min in 24h format for internal storage
function generateTimeOptions() {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      const label = `${hour}:${String(m).padStart(2, '0')} ${period}`;
      opts.push({ value: val, label });
    }
  }
  return opts;
}
const TIME_OPTIONS = generateTimeOptions();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toAmPm(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

const EMPTY_FORM = {
  type: 'recurring',
  day_of_week: 'Monday',
  specific_date: '',
  start_time: '12:00',
  end_time: '13:00',
  label: '',
};

export default function ExclusionsManager({ salonId }) {
  const [exclusions, setExclusions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    base44.entities.BusinessExclusion.filter({ salon_id: salonId }).then(setExclusions);
  }, [salonId]);

  const handleAdd = async () => {
    if (!form.start_time || !form.end_time) return;
    if (form.type === 'one_time' && !form.specific_date) return;
    setSaving(true);
    const payload = {
      salon_id: salonId,
      type: form.type,
      start_time: form.start_time,
      end_time: form.end_time,
      label: form.label,
      ...(form.type === 'recurring'
        ? { day_of_week: form.day_of_week }
        : { specific_date: form.specific_date }),
    };
    const created = await base44.entities.BusinessExclusion.create(payload);
    setExclusions(prev => [...prev, created]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.BusinessExclusion.delete(id);
    setExclusions(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">Time Blocks / Breaks</Label>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Time Block
        </button>
      </div>

      {/* Existing exclusions */}
      {exclusions.length > 0 && (
        <div className="space-y-2">
          {exclusions.map(ex => (
            <div key={ex.id} className="flex items-center justify-between bg-secondary border border-border rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-medium text-foreground">
                  {ex.label ? `${ex.label} — ` : ''}
                  {toAmPm(ex.start_time)} – {toAmPm(ex.end_time)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ex.type === 'recurring'
                    ? `Every ${ex.day_of_week}`
                    : `One-time: ${ex.specific_date}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(ex.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-3"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 space-y-3">
          {/* Frequency toggle */}
          <div>
            <Label className="text-muted-foreground text-xs mb-2 block">Frequency</Label>
            <div className="flex gap-2">
              {[
                { value: 'recurring', label: 'Every Week' },
                { value: 'one_time', label: 'One-Time Only' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.type === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day of week or specific date */}
          {form.type === 'recurring' ? (
            <div>
              <Label className="text-muted-foreground text-xs">Day of Week</Label>
              <Select value={form.day_of_week} onValueChange={v => setForm(f => ({ ...f, day_of_week: v }))}>
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {DAYS.map(d => <SelectItem key={d} value={d} className="text-foreground">{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-muted-foreground text-xs">Specific Date</Label>
              <Input
                type="date"
                value={form.specific_date}
                onChange={e => setForm(f => ({ ...f, specific_date: e.target.value }))}
                className="bg-card border-border text-foreground mt-1"
              />
            </div>
          )}

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Start Time</Label>
              <Select value={form.start_time} onValueChange={v => setForm(f => ({ ...f, start_time: v }))}>
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-52">
                  {TIME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">End Time</Label>
              <Select value={form.end_time} onValueChange={v => setForm(f => ({ ...f, end_time: v }))}>
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-52">
                  {TIME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional label */}
          <div>
            <Label className="text-muted-foreground text-xs">Label (optional)</Label>
            <Input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Lunch Break"
              className="bg-card border-border text-foreground mt-1"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Adding...' : 'Add Block'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}