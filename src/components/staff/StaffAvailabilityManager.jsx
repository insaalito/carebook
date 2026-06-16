import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Calendar, Clock, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateTimeOptions() {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      opts.push({ value: val, label: `${hour}:${String(m).padStart(2, '0')} ${period}` });
    }
  }
  return opts;
}
const TIME_OPTIONS = generateTimeOptions();

function toAmPm(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function StaffAvailabilityManager({ staffId }) {
  const [exclusions, setExclusions] = useState([]);
  const [closures, setClosures] = useState([]);
  const [activeTab, setActiveTab] = useState('breaks');
  const [addingBreak, setAddingBreak] = useState(false);
  const [addingClosure, setAddingClosure] = useState(false);
  const [breakForm, setBreakForm] = useState({ type: 'recurring', day_of_week: 'Monday', start_time: '12:00', end_time: '13:00', label: '' });
  const [closureForm, setClosureForm] = useState({ date: '', label: '' });

  useEffect(() => {
    if (!staffId) return;
    Promise.all([
      base44.entities.StaffExclusion.filter({ staff_id: staffId }),
      base44.entities.StaffClosureDate.filter({ staff_id: staffId })
    ]).then(([exc, clos]) => {
      setExclusions(exc);
      setClosures(clos);
    });
  }, [staffId]);

  const addBreak = async () => {
    if (!breakForm.start_time || !breakForm.end_time) return;
    const created = await base44.entities.StaffExclusion.create({
      staff_id: staffId,
      ...breakForm
    });
    setExclusions(prev => [...prev, created]);
    setBreakForm({ type: 'recurring', day_of_week: 'Monday', start_time: '12:00', end_time: '13:00', label: '' });
    setAddingBreak(false);
  };

  const addClosure = async () => {
    if (!closureForm.date) return;
    const created = await base44.entities.StaffClosureDate.create({
      staff_id: staffId,
      ...closureForm
    });
    setClosures(prev => [...prev, created]);
    setClosureForm({ date: '', label: '' });
    setAddingClosure(false);
  };

  const deleteBreak = async (id) => {
    await base44.entities.StaffExclusion.delete(id);
    setExclusions(prev => prev.filter(e => e.id !== id));
  };

  const deleteClosure = async (id) => {
    await base44.entities.StaffClosureDate.delete(id);
    setClosures(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('breaks')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'breaks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          Time Blocks
        </button>
        <button
          onClick={() => setActiveTab('closures')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'closures' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
        >
          Days Off
        </button>
      </div>

      {activeTab === 'breaks' && (
        <div className="space-y-2">
          {exclusions.map(exc => (
            <div key={exc.id} className="flex items-center justify-between gap-2 p-2 bg-secondary/50 rounded-lg text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {exc.type === 'recurring' 
                      ? `${exc.day_of_week} ${toAmPm(exc.start_time)} - ${toAmPm(exc.end_time)}`
                      : `${format(new Date(exc.specific_date + 'T00:00:00'), 'MMM d, yyyy')} ${toAmPm(exc.start_time)} - ${toAmPm(exc.end_time)}`
                    }
                  </span>
                </div>
                {exc.label && <p className="text-muted-foreground text-xs mt-0.5">{exc.label}</p>}
              </div>
              <button
                onClick={() => deleteBreak(exc.id)}
                className="text-destructive hover:text-destructive/80 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {addingBreak ? (
            <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={breakForm.type} onValueChange={v => setBreakForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="recurring" className="text-foreground text-xs">Recurring</SelectItem>
                      <SelectItem value="one_time" className="text-foreground text-xs">One-Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {breakForm.type === 'recurring' ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Day</Label>
                    <Select value={breakForm.day_of_week} onValueChange={v => setBreakForm(f => ({ ...f, day_of_week: v }))}>
                      <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border max-h-40">
                        {DAYS.map(d => <SelectItem key={d} value={d} className="text-foreground text-xs">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 w-full justify-start text-left text-xs bg-secondary border-border text-foreground hover:bg-secondary/80 px-2"
                        >
                          <CalendarIcon className="mr-1.5 h-3 w-3 opacity-60" />
                          {breakForm.specific_date ? format(new Date(breakForm.specific_date + 'T12:00:00'), 'MMM d, yyyy') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-card border-border shadow-xl" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={breakForm.specific_date ? new Date(breakForm.specific_date + 'T12:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) setBreakForm(f => ({ ...f, specific_date: format(date, 'yyyy-MM-dd') }));
                          }}
                          initialFocus
                          classNames={{
                            months: 'p-3',
                            head_cell: 'text-muted-foreground text-xs font-medium w-9',
                            cell: 'text-center text-sm p-0 relative',
                            day: 'h-9 w-9 p-0 font-normal rounded-md hover:bg-primary/20 hover:text-foreground transition-colors',
                            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                            day_today: 'border border-primary/40 text-primary',
                            day_outside: 'text-muted-foreground opacity-30',
                            day_disabled: 'text-muted-foreground opacity-20 cursor-not-allowed',
                            nav_button: 'text-muted-foreground hover:text-foreground h-7 w-7 bg-transparent p-0',
                            caption: 'flex justify-center items-center relative mb-1',
                            caption_label: 'text-sm font-semibold text-foreground',
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Start</Label>
                  <Select value={breakForm.start_time} onValueChange={v => setBreakForm(f => ({ ...f, start_time: v }))}>
                    <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-40">
                      {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground text-xs">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">End</Label>
                  <Select value={breakForm.end_time} onValueChange={v => setBreakForm(f => ({ ...f, end_time: v }))}>
                    <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-40">
                      {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground text-xs">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input type="text" value={breakForm.label} onChange={e => setBreakForm(f => ({ ...f, label: e.target.value }))} placeholder="Label (optional)" className="h-8 bg-secondary border-border text-foreground text-xs" />
              <div className="flex gap-2">
                <Button size="sm" onClick={addBreak} className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingBreak(false)} className="h-7 text-xs border-border text-foreground">Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingBreak(true)}
              className="flex items-center gap-2 w-full p-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Time Block
            </button>
          )}
        </div>
      )}

      {activeTab === 'closures' && (
        <div className="space-y-2">
          {closures.map(clos => (
            <div key={clos.id} className="flex items-center justify-between gap-2 p-2 bg-secondary/50 rounded-lg text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>{format(new Date(clos.date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                </div>
                {clos.label && <p className="text-muted-foreground text-xs mt-0.5">{clos.label}</p>}
              </div>
              <button
                onClick={() => deleteClosure(clos.id)}
                className="text-destructive hover:text-destructive/80 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {addingClosure ? (
            <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 w-full justify-start text-left text-xs bg-secondary border-border text-foreground hover:bg-secondary/80 px-2"
                    >
                      <CalendarIcon className="mr-1.5 h-3 w-3 opacity-60" />
                      {closureForm.date ? format(new Date(closureForm.date + 'T12:00:00'), 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border shadow-xl" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={closureForm.date ? new Date(closureForm.date + 'T12:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) setClosureForm(f => ({ ...f, date: format(date, 'yyyy-MM-dd') }));
                      }}
                      initialFocus
                      classNames={{
                        months: 'p-3',
                        head_cell: 'text-muted-foreground text-xs font-medium w-9',
                        cell: 'text-center text-sm p-0 relative',
                        day: 'h-9 w-9 p-0 font-normal rounded-md hover:bg-primary/20 hover:text-foreground transition-colors',
                        day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                        day_today: 'border border-primary/40 text-primary',
                        day_outside: 'text-muted-foreground opacity-30',
                        day_disabled: 'text-muted-foreground opacity-20 cursor-not-allowed',
                        nav_button: 'text-muted-foreground hover:text-foreground h-7 w-7 bg-transparent p-0',
                        caption: 'flex justify-center items-center relative mb-1',
                        caption_label: 'text-sm font-semibold text-foreground',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Input type="text" value={closureForm.label} onChange={e => setClosureForm(f => ({ ...f, label: e.target.value }))} placeholder="Reason (optional)" className="h-8 bg-secondary border-border text-foreground text-xs" />
              <div className="flex gap-2">
                <Button size="sm" onClick={addClosure} className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingClosure(false)} className="h-7 text-xs border-border text-foreground">Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingClosure(true)}
              className="flex items-center gap-2 w-full p-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Day Off
            </button>
          )}
        </div>
      )}
    </div>
  );
}