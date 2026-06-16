import { format, startOfWeek, addDays } from 'date-fns';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm
const STATUS_BG = {
  confirmed: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  completed: 'bg-green-500/20 border-green-500/50 text-green-300',
  no_show: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  cancelled: 'bg-red-500/20 border-red-500/50 text-red-300',
};

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Returns the columns (dates as 'yyyy-MM-dd') to display based on timeframe
function getColumns(timeframe, now) {
  if (timeframe === 'day') {
    return [format(now, 'yyyy-MM-dd')];
  }
  if (timeframe === 'week') {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  }
  // Month: show current week as fallback (full month grid is too dense for a time-column view)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
}

const GRID_START = 8 * 60;  // 8:00 in minutes
const GRID_END = 20 * 60;   // 20:00 in minutes
const GRID_HEIGHT = 520;     // px for the grid body

export default function StaffCalendarView({ appointments, timeframe }) {
  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');
  const columns = getColumns(timeframe, now);
  const minuteHeight = GRID_HEIGHT / (GRID_END - GRID_START); // px per minute

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">My Calendar</h3>
        <span className="text-xs text-muted-foreground capitalize">{timeframe} view</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: columns.length === 1 ? 400 : columns.length * 120 }}>
          {/* Time axis */}
          <div className="w-14 shrink-0 border-r border-border">
            <div className="h-10 border-b border-border" /> {/* header spacer */}
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-t border-border/40"
                  style={{ top: (h * 60 - GRID_START) * minuteHeight }}
                >
                  <span className="text-[10px] text-muted-foreground px-1 -translate-y-2.5 block">
                    {h > 12 ? `${h - 12}pm` : h === 12 ? '12pm' : `${h}am`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {columns.map(dateKey => {
            const dayAppts = appointments.filter(a => a.date === dateKey && a.status !== 'cancelled');
            const isToday = dateKey === todayKey;
            const dateObj = new Date(dateKey + 'T00:00:00');

            return (
              <div key={dateKey} className="flex-1 border-r border-border last:border-r-0">
                {/* Column header */}
                <div className={`h-10 border-b border-border flex flex-col items-center justify-center ${isToday ? 'bg-primary/10' : ''}`}>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(dateObj, 'EEE')}
                  </span>
                  <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(dateObj, 'd')}
                  </span>
                </div>

                {/* Time grid */}
                <div className="relative" style={{ height: GRID_HEIGHT }}>
                  {/* Hour lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-border/30"
                      style={{ top: (h * 60 - GRID_START) * minuteHeight }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const nowMins = now.getHours() * 60 + now.getMinutes();
                    if (nowMins < GRID_START || nowMins > GRID_END) return null;
                    return (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-primary z-10"
                        style={{ top: (nowMins - GRID_START) * minuteHeight }}
                      >
                        <div className="w-2 h-2 bg-primary rounded-full -translate-y-1 -translate-x-1" />
                      </div>
                    );
                  })()}

                  {/* Appointment blocks */}
                  {dayAppts.map(appt => {
                    const startMins = timeToMinutes(appt.time_slot);
                    const duration = appt.duration_minutes || 30;
                    const top = (startMins - GRID_START) * minuteHeight;
                    const height = Math.max(duration * minuteHeight - 2, 18);

                    if (startMins < GRID_START || startMins > GRID_END) return null;

                    return (
                      <div
                        key={appt.id}
                        className={`absolute left-0.5 right-0.5 rounded border text-[10px] px-1 py-0.5 overflow-hidden ${STATUS_BG[appt.status] || STATUS_BG.confirmed}`}
                        style={{ top, height }}
                        title={`${appt.customer_name} · ${appt.service_name} · ${appt.time_slot}`}
                      >
                        <div className="font-semibold truncate leading-tight">{appt.customer_name}</div>
                        {height > 30 && (
                          <div className="truncate opacity-80 leading-tight">{appt.service_name}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}