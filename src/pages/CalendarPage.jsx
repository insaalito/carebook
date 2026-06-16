import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import { Button } from '@/components/ui/button';

const STATUS_COLORS = {
  confirmed: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  completed: 'bg-green-500/20 border-green-500/40 text-green-300',
  no_show: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  cancelled: 'bg-red-500/20 border-red-500/40 text-red-300',
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm

function formatAmPm(hour24, minutes = 0) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const h = hour24 % 12 || 12;
  return minutes === 0 ? `${h} ${period}` : `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

function formatTimeSlotAmPm(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function computeLayout(appts) {
  const sorted = [...appts].sort((a, b) => a.time_slot.localeCompare(b.time_slot));
  const layout = new Map();
  const groups = [];

  sorted.forEach(appt => {
    const start = timeToMins(appt.time_slot);
    const end = start + (appt.duration_minutes || 30);
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some(g => {
        const gs = timeToMins(g.time_slot);
        const ge = gs + (g.duration_minutes || 30);
        return start < ge && end > gs;
      });
      if (overlaps) { group.push(appt); placed = true; break; }
    }
    if (!placed) groups.push([appt]);
  });

  groups.forEach(group => {
    const colEnds = [];
    group.forEach(appt => {
      const start = timeToMins(appt.time_slot);
      const end = start + (appt.duration_minutes || 30);
      let col = 0;
      while (colEnds[col] !== undefined && colEnds[col] > start) col++;
      colEnds[col] = end;
      layout.set(appt.id, { col, totalCols: 1 });
    });
    const maxCols = colEnds.length;
    group.forEach(appt => { layout.get(appt.id).totalCols = maxCols; });
  });

  return layout;
}

function getApptStyle(appt, layout) {
  const [h, m] = appt.time_slot.split(':').map(Number);
  const top = (h - 8) * 60 + m;
  const height = Math.max(appt.duration_minutes || 30, 20);
  const { col, totalCols } = layout.get(appt.id) || { col: 0, totalCols: 1 };
  const widthPct = 100 / totalCols;
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(${col * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';
  const [salon, setSalon] = useState(null);
  const [staff, setStaff] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const touchStartX = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    if (isOwner) {
      base44.entities.Salon.filter({ owner_email: user.email }).then(async (salons) => {
        if (salons[0]) {
          setSalon(salons[0]);
          const [appts, staffList] = await Promise.all([
            base44.entities.Appointment.filter({ salon_id: salons[0].id }),
            base44.entities.Staff.filter({ salon_id: salons[0].id, is_active: true }),
          ]);
          setAppointments(appts);
          setStaff(staffList);
        }
        setLoading(false);
      });
    } else {
      base44.functions.invoke('getStaffAppointments').then(res => {
        const { salonAppointments, salonStaff, staffRecord: sr, allowTeamView } = res.data || {};
        if (allowTeamView) {
          setAppointments(salonAppointments || []);
          setStaff(salonStaff || (sr ? [sr] : []));
        } else {
          const myAppts = (salonAppointments || []).filter(a => a.assigned_staff_email === user.email || a.staff_id === sr?.id);
          setAppointments(myAppts);
          setStaff(sr ? [sr] : []);
        }
        if (sr?.salon_id) setSalon({ id: sr.salon_id });
        setLoading(false);
      });
    }
  }, [user, isOwner]);

  useEffect(() => {
    if (!salon || !isOwner) return;
    const unsubAppts = base44.entities.Appointment.subscribe((event) => {
      if (event.data?.salon_id !== salon.id) return;
      if (event.type === 'create') setAppointments(prev => [...prev, event.data]);
      if (event.type === 'update') setAppointments(prev => prev.map(a => a.id === event.id ? event.data : a));
      if (event.type === 'delete') setAppointments(prev => prev.filter(a => a.id !== event.id));
    });
    const unsubStaff = base44.entities.Staff.subscribe((event) => {
      if (event.data?.salon_id !== salon.id) return;
      if (event.type === 'create') setStaff(prev => [...prev, event.data]);
      if (event.type === 'update') setStaff(prev => prev.map(s => s.id === event.id ? event.data : s));
      if (event.type === 'delete') setStaff(prev => prev.filter(s => s.id !== event.id));
    });
    return () => { unsubAppts(); unsubStaff(); };
  }, [salon, isOwner]);

  useEffect(() => {
    if (isOwner || !staff[0]) return;
    const staffId = staff[0].id;
    const unsub = base44.entities.Appointment.subscribe((event) => {
      if (event.data?.staff_id !== staffId) return;
      if (event.type === 'create') setAppointments(prev => [...prev, event.data]);
      if (event.type === 'update') setAppointments(prev => prev.map(a => a.id === event.id ? event.data : a));
      if (event.type === 'delete') setAppointments(prev => prev.filter(a => a.id !== event.id));
    });
    return unsub;
  }, [staff, isOwner]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayAppts = (day) => appointments.filter(a => a.date === format(day, 'yyyy-MM-dd') && a.status !== 'cancelled');

  const navigate = (dir) => {
    if (view === 'week') {
      if (isMobile) setCurrentDate(prev => addDays(prev, dir === 'next' ? 3 : -3));
      else setCurrentDate(prev => dir === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, dir === 'next' ? 1 : -1));
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 'next' : 'prev');
    touchStartX.current = null;
  };

  const jumpToDay = (day) => { setCurrentDate(day); setView('day'); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const mobileWeekDays = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
  const displayDays = view === 'week' ? (isMobile ? mobileWeekDays : weekDays) : [currentDate];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <h2 className="font-bebas text-lg md:text-2xl tracking-wider text-foreground truncate">
            {view === 'week'
              ? isMobile
                ? `${format(currentDate, 'MMM d')} – ${format(addDays(currentDate, 2), 'MMM d')}`
                : `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
              : isMobile
                ? format(currentDate, 'EEE, MMM d')
                : format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-secondary border border-border rounded-lg p-1">
            {['day', 'week'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm capitalize transition-all ${
                  view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} className="border-border h-10 w-10 md:h-9 md:w-9">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="border-border text-xs px-2 md:px-3">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} className="border-border h-10 w-10 md:h-9 md:w-9">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {view === 'week' ? (
          <>
            {/* Fixed day headers */}
            <div className="flex flex-shrink-0 border-b border-border bg-card" style={{ minWidth: isMobile ? '320px' : '900px' }}>
              <div className="w-12 md:w-16 flex-shrink-0 border-r border-border" />
              {displayDays.map(day => {
                const isToday = isSameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => jumpToDay(day)}
                    className={`flex-1 h-12 flex flex-col items-center justify-center border-r border-border active:bg-primary/20 transition-colors ${isToday ? 'bg-primary/5' : ''}`}
                  >
                    <span className="text-[10px] md:text-xs text-muted-foreground">{format(day, 'EEE')}</span>
                    <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</span>
                  </button>
                );
              })}
            </div>
            {/* Scrollable time grid */}
            <div className="flex-1 overflow-auto">
              <div className="flex" style={{ minWidth: isMobile ? '320px' : '900px' }}>
                <div className="w-12 md:w-16 flex-shrink-0 border-r border-border">
                  {HOURS.map(h => (
                    <div key={h} className="h-[60px] flex items-start justify-end pr-2 md:pr-3 pt-1">
                      <span className="text-[10px] md:text-xs text-muted-foreground">{formatAmPm(h)}</span>
                    </div>
                  ))}
                </div>
                {displayDays.map(day => {
                  const appts = dayAppts(day);
                  const layout = computeLayout(appts);
                  return (
                    <div key={day.toISOString()} className="flex-1 border-r border-border min-w-0">
                      <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                        {HOURS.map(h => <div key={h} className="h-[60px] border-b border-border/30" />)}
                        {appts.map(appt => (
                          <div
                            key={appt.id}
                            className={`absolute rounded-lg border px-1 md:px-2 py-1 overflow-hidden ${STATUS_COLORS[appt.status]} cursor-pointer hover:opacity-90 transition-opacity`}
                            style={getApptStyle(appt, layout)}
                            onClick={() => setSelectedAppointment(appt)}
                          >
                            <p className="text-[10px] md:text-xs font-semibold leading-tight truncate">
                              {isMobile ? `${formatTimeSlotAmPm(appt.time_slot)} ${appt.customer_name}` : `${formatTimeSlotAmPm(appt.time_slot)} ${appt.customer_name}`}
                            </p>
                            {!isMobile && <p className="text-xs opacity-70 truncate">{appt.service_name}</p>}
                            {!isMobile && appt.staff_name && <p className="text-xs opacity-60 truncate">{appt.staff_name}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Fixed staff headers */}
            <div className="flex flex-shrink-0 border-b border-border bg-card" style={{ minWidth: `${48 + staff.length * 140}px` }}>
              <div className="w-12 md:w-16 flex-shrink-0 border-r border-border" />
              {staff.map(member => (
                <div key={member.id} className="flex-1 min-w-[120px] md:min-w-[160px] h-12 flex flex-col items-center justify-center border-r border-border px-1">
                  <span className="text-xs font-semibold text-foreground truncate w-full text-center">{member.name}</span>
                  <span className="text-[10px] text-muted-foreground">{member.role_title || 'Staff'}</span>
                </div>
              ))}
            </div>
            {/* Scrollable time grid */}
            <div className="flex-1 overflow-auto">
              <div className="flex" style={{ minWidth: `${48 + staff.length * 140}px` }}>
                <div className="w-12 md:w-16 flex-shrink-0 border-r border-border">
                  {HOURS.map(h => (
                    <div key={h} className="h-[60px] flex items-start justify-end pr-2 md:pr-3 pt-1">
                      <span className="text-[10px] md:text-xs text-muted-foreground">{formatAmPm(h)}</span>
                    </div>
                  ))}
                </div>
                {staff.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    No active staff members found.
                  </div>
                ) : staff.map(member => {
                  const memberAppts = appointments.filter(a =>
                    a.date === format(currentDate, 'yyyy-MM-dd') &&
                    a.staff_id === member.id &&
                    a.status !== 'cancelled'
                  );
                  const memberLayout = computeLayout(memberAppts);
                  return (
                    <div key={member.id} className="flex-1 border-r border-border min-w-[120px] md:min-w-[160px]">
                      <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
                        {HOURS.map(h => <div key={h} className="h-[60px] border-b border-border/30" />)}
                        {memberAppts.map(appt => (
                          <div
                            key={appt.id}
                            className={`absolute rounded-lg border px-1 md:px-2 py-1 overflow-hidden ${STATUS_COLORS[appt.status]} cursor-pointer hover:opacity-90 transition-opacity`}
                            style={getApptStyle(appt, memberLayout)}
                            onClick={() => setSelectedAppointment(appt)}
                          >
                            <p className="text-[10px] md:text-xs font-semibold leading-tight truncate">{formatTimeSlotAmPm(appt.time_slot)} {appt.customer_name}</p>
                            {!isMobile && <p className="text-[10px] md:text-xs opacity-70 truncate">{appt.service_name}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2 md:py-3 border-t border-border bg-card flex-shrink-0 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded border ${cls}`} />
            <span className="text-[10px] md:text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
        {isMobile && view === 'week' && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto">Tap day to expand · Swipe to navigate</span>
        )}
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          salon={salon}
          user={user}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={async (id, status) => {
            await base44.entities.Appointment.update(id, { status });
            if (status === 'completed') {
              await base44.functions.invoke('processAppointmentAccounting', { appointment_id: id });
              const updated = await base44.entities.Appointment.get(id);
              if (updated) setAppointments(p => p.map(a => a.id === id ? updated : a));
            }
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}