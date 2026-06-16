import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { formatAmPm } from '@/utils/timeFormat';
import { Calendar, CheckCircle2, Clock, AlertTriangle, ShieldOff, DollarSign, TrendingUp, CreditCard, Banknote, Phone } from 'lucide-react';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import InHandTransactionModal from '@/components/dashboard/InHandTransactionModal';

const STATUS_COLORS = {
  confirmed: 'text-blue-400 bg-blue-400/10',
  completed: 'text-green-400 bg-green-400/10',
  no_show: 'text-yellow-400 bg-yellow-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
};

export default function EmployeeDashboard({ user, salon }) {
  const [appointments, setAppointments] = useState([]);
  const [staffRecord, setStaffRecord] = useState(null);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('week');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showInHand, setShowInHand] = useState(false);
  const [inHandTransactions, setInHandTransactions] = useState([]);
  const [phoneEdit, setPhoneEdit] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    base44.functions.invoke('getStaffAppointments').then(res => {
      const { appointments: appts, staffRecord: sr } = res.data || {};
      if (sr) {
        if (!sr.is_active) {
          setIsDeactivated(true);
          setLoading(false);
          return;
        }
        setStaffRecord(sr);
        setAppointments(appts || []);
      }
      setLoading(false);
    });
    base44.entities.InHandTransaction.filter({ staff_email: user.email }, '-date', 100)
      .then(list => setInHandTransactions(list));
  }, [user]);

  useEffect(() => {
    if (staffRecord) setPhoneEdit(staffRecord.phone || '');
  }, [staffRecord]);

  const savePhone = async () => {
    if (!staffRecord) return;
    setSavingPhone(true);
    await base44.entities.Staff.update(staffRecord.id, { phone: phoneEdit });
    setStaffRecord(prev => ({ ...prev, phone: phoneEdit }));
    setSavingPhone(false);
    setPhoneSaved(true);
    setTimeout(() => setPhoneSaved(false), 2000);
  };

  useEffect(() => {
    if (!staffRecord) return;
    const unsubAppts = base44.entities.Appointment.subscribe((ev) => {
      const matches = ev.data?.staff_id === staffRecord.id || ev.type === 'delete';
      if (!matches) return;
      if (ev.type === 'create') setAppointments(p => [...p, ev.data]);
      if (ev.type === 'update') setAppointments(p => p.map(a => a.id === ev.id ? ev.data : a));
      if (ev.type === 'delete') setAppointments(p => p.filter(a => a.id !== ev.id));
    });
    const unsubStaff = base44.entities.Staff.subscribe((ev) => {
      if (ev.id !== staffRecord.id) return;
      if (ev.type === 'update' && ev.data?.is_active === false) {
        setIsDeactivated(true);
        setTimeout(() => base44.auth.logout('/'), 2000);
      }
    });
    return () => { unsubAppts(); unsubStaff(); };
  }, [staffRecord]);

  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');

  const todayAppts = appointments
    .filter(a => a.date === todayKey)
    .sort((a, b) => a.time_slot.localeCompare(b.time_slot));

  const upcomingAppts = appointments
    .filter(a => a.date > todayKey && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot))
    .slice(0, 10);

  const completedToday = todayAppts.filter(a => a.status === 'completed').length;
  const confirmedToday = todayAppts.filter(a => a.status === 'confirmed').length;
  const noShowsToday = todayAppts.filter(a => a.status === 'no_show').length;

  const completedAll = appointments.filter(a => a.status === 'completed');
  const rangeStart = timeframe === 'day'
    ? new Date(todayKey + 'T00:00:00')
    : timeframe === 'week'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfMonth(now);
  const completedInRange = completedAll.filter(a => new Date(a.date + 'T00:00:00') >= rangeStart);
  const grossRevenue = completedInRange.reduce((s, a) => s + (a.gross_amount || a.price || 0), 0);
  const processorFees = completedInRange.reduce((s, a) => s + (a.processor_fee_deducted || 0), 0);
  const netEarnings = completedInRange.reduce((s, a) => s + (a.staff_payout_amount || 0), 0);
  const inHandInRange = inHandTransactions.filter(t => new Date(t.date + 'T00:00:00') >= rangeStart);
  const inHandTotal = inHandInRange.reduce((s, t) => s + (t.amount || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (isDeactivated) return (
    <div className="flex items-center justify-center h-screen p-6">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center">
        <ShieldOff className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-2">Account Deactivated</h2>
        <p className="text-muted-foreground text-sm">Your account is currently deactivated by the business owner. Please contact your manager.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground">
            {staffRecord ? `${staffRecord.name}'s Dashboard` : 'My Dashboard'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(now, 'EEEE, MMMM d, yyyy')}
            {salon && ` · ${salon.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInHand(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/40 text-primary text-sm hover:bg-primary/10 transition-colors"
          >
            💵 In-Hand Entry
          </button>
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            {['day', 'week', 'month'].map(t => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                  timeframe === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <DollarSign className="w-5 h-5 mb-2 text-primary" />
          <div className="font-bebas text-3xl text-foreground">${grossRevenue.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">My Gross Revenue · {timeframe}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <CreditCard className="w-5 h-5 mb-2 text-red-400" />
          <div className="font-bebas text-3xl text-foreground">${processorFees.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">Processor Fees · {timeframe}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <TrendingUp className="w-5 h-5 mb-2 text-green-400" />
          <div className="font-bebas text-3xl text-foreground">${netEarnings.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">My Net Earnings · {timeframe}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <Banknote className="w-5 h-5 mb-2 text-yellow-400" />
          <div className="font-bebas text-3xl text-foreground">${inHandTotal.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total In-Hand</div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 mb-2 text-green-400" />
          <div className="font-bebas text-3xl text-foreground">{completedToday}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Completed Today</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <Clock className="w-5 h-5 mb-2 text-blue-400" />
          <div className="font-bebas text-3xl text-foreground">{confirmedToday}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Remaining Today</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 mb-2 text-yellow-400" />
          <div className="font-bebas text-3xl text-foreground">{noShowsToday}</div>
          <div className="text-xs text-muted-foreground mt-0.5">No-Shows Today</div>
        </div>
      </div>

      {/* Today's Appointments */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Today's Schedule</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{format(now, 'MMMM d')}</p>
        </div>
        {todayAppts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No appointments scheduled today</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todayAppts.map(appt => (
              <div key={appt.id} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedAppointment(appt)}>
                <div className="flex items-center gap-4">
                  <span className="text-primary font-medium text-sm w-12 shrink-0">{formatAmPm(appt.time_slot)}</span>
                  <div>
                    <p className="text-foreground font-medium text-sm">{appt.customer_name}</p>
                    <p className="text-muted-foreground text-xs">{appt.service_name}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[appt.status]}`}>
                  {appt.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Services Table */}
      {completedInRange.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">My Completed Services</h3>
            <span className="text-xs text-muted-foreground capitalize">{timeframe}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {['Customer', 'Service', 'Date', 'Gross', 'My Earnings', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedInRange.slice().reverse().slice(0, 15).map(appt => (
                  <tr key={appt.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedAppointment(appt)}>
                    <td className="px-4 py-3 text-foreground font-medium">{appt.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.service_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.date}</td>
                    <td className="px-4 py-3 text-primary font-medium">${(appt.gross_amount || appt.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">${(appt.staff_payout_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[appt.status]}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* In-Hand Transactions */}
      {inHandInRange.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">My In-Hand Transactions</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground capitalize">{timeframe}</span>
              <span className="text-xs text-primary font-medium">${inHandTotal.toFixed(2)} total</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {inHandInRange.slice(0, 15).map(tx => (
              <div key={tx.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.customer_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {tx.service_name && <span className="text-xs text-muted-foreground">{tx.service_name}</span>}
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{tx.payment_method?.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground">{tx.date}</span>
                  </div>
                  {tx.notes && <p className="text-xs text-muted-foreground/70 italic mt-0.5">{tx.notes}</p>}
                </div>
                <span className="text-primary font-semibold text-sm">${(tx.amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppts.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Upcoming</h3>
          </div>
          <div className="divide-y divide-border">
            {upcomingAppts.map(appt => (
              <div key={appt.id} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedAppointment(appt)}>
                <div className="flex items-center gap-4">
                  <div className="text-center w-12 shrink-0">
                    <div className="text-xs text-muted-foreground">{format(new Date(appt.date), 'MMM')}</div>
                    <div className="font-bebas text-2xl text-primary leading-none">{format(new Date(appt.date + 'T00:00:00'), 'd')}</div>
                  </div>
                  <div>
                    <p className="text-foreground font-medium text-sm">{appt.customer_name}</p>
                    <p className="text-muted-foreground text-xs">{appt.service_name} · {formatAmPm(appt.time_slot)}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[appt.status]}`}>
                  {appt.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          user={user}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={async (id, status) => {
            await base44.entities.Appointment.update(id, { status });
            if (status === 'completed') {
              await base44.functions.invoke('processAppointmentAccounting', { appointment_id: id });
            }
            setSelectedAppointment(null);
          }}
        />
      )}

      {showInHand && (
        <InHandTransactionModal
          user={user}
          salon={salon}
          staffRecord={staffRecord}
          onClose={() => {
            setShowInHand(false);
            base44.entities.InHandTransaction.filter({ staff_email: user.email }, '-date', 100)
              .then(list => setInHandTransactions(list));
          }}
        />
      )}
    </div>
  );
}