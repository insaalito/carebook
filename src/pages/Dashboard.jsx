import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Users, AlertTriangle, XCircle,
  Calendar, DollarSign, CheckCircle2,
  CreditCard, Landmark, Phone
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { formatAmPm } from '@/utils/timeFormat';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import InviteStaffModal from '@/components/staff/InviteStaffModal';
import InHandTransactionModal from '@/components/dashboard/InHandTransactionModal';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';

const STATUS_COLORS = {
  confirmed: 'text-blue-400 bg-blue-400/10',
  completed: 'text-green-400 bg-green-400/10',
  no_show: 'text-yellow-400 bg-yellow-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [salon, setSalon] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [inHandTransactions, setInHandTransactions] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [earningsFilter, setEarningsFilter] = useState('all');

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [staffFilter, setStaffFilter] = useState('all');
  const [recalculating, setRecalculating] = useState(false);
  const [showInHand, setShowInHand] = useState(false);
  const [staffRecord, setStaffRecord] = useState(null);
  const [bizSettings, setBizSettings] = useState(null);

  const recalculateAll = async () => {
    if (!salon) return;
    setRecalculating(true);
    await base44.functions.invoke('recalculateAllAccounting', { salon_id: salon.id });
    const appts = await base44.entities.Appointment.filter({ salon_id: salon.id });
    setAppointments(appts);
    setRecalculating(false);
  };

  const isOwner = user?.role === 'admin';

  useEffect(() => {
    if (!user?.email) return;

    if (isOwner) {
      // Owner: load salon they own
      base44.entities.Salon.filter({ owner_email: user.email }).then(async (salons) => {
        if (salons[0]) {
          setSalon(salons[0]);
          const [appts, staffList, settings, inHand] = await Promise.all([
            base44.entities.Appointment.filter({ salon_id: salons[0].id }),
            base44.entities.Staff.filter({ salon_id: salons[0].id, is_active: true }),
            base44.entities.BusinessSettings.filter({ salon_id: salons[0].id }),
            base44.entities.InHandTransaction.filter({ salon_id: salons[0].id }, '-date', 100),
          ]);
          setAppointments(appts);
          setInHandTransactions(inHand);
          setStaff(staffList);
          if (settings[0]) setBizSettings(settings[0]);
          // Silently backfill salon_owner_email on legacy records (idempotent)
          base44.functions.invoke('backfillSalonOwnerEmail').catch(() => {});
        }
        setLoading(false);
      });
    } else {
      // Employee: load their own staff record and salon
      base44.entities.Staff.filter({ user_email: user.email, is_active: true }).then(async (staffRecords) => {
        if (staffRecords[0]) setStaffRecord(staffRecords[0]);
        if (staffRecords[0]) {
          const staffRecord = staffRecords[0];
          const salons = await base44.entities.Salon.filter({ id: staffRecord.salon_id });
          if (salons[0]) setSalon(salons[0]);
        }
        setLoading(false);
      });
    }
  }, [user, isOwner]);

  useEffect(() => {
    if (!salon || !isOwner) return;
    const unsub = base44.entities.InHandTransaction.subscribe((ev) => {
      if (ev.data?.salon_id !== salon.id) return;
      if (ev.type === 'create') setInHandTransactions(prev => [ev.data, ...prev]);
      if (ev.type === 'update') setInHandTransactions(prev => prev.map(t => t.id === ev.id ? ev.data : t));
      if (ev.type === 'delete') setInHandTransactions(prev => prev.filter(t => t.id !== ev.id));
    });
    return unsub;
  }, [salon, isOwner]);

  useEffect(() => {
    if (!salon || !isOwner) return;
    const unsub = base44.entities.Appointment.subscribe(async (ev) => {
      if (ev.type !== 'delete' && ev.data?.salon_id !== salon.id) return;
      if (ev.type === 'create') setAppointments(p => [...p, ev.data]);
      if (ev.type === 'update') {
        setAppointments(p => p.map(a => a.id === ev.id ? ev.data : a));
        // processAppointmentAccounting runs via asServiceRole after the status update.
        // Service-role writes may not emit another subscription event, so we
        // re-fetch the appointment ~2 s later to capture the accounting fields.
        if (ev.data?.status === 'completed') {
          setTimeout(async () => {
            const fresh = await base44.entities.Appointment.get(ev.id);
            if (fresh) setAppointments(p => p.map(a => a.id === fresh.id ? fresh : a));
          }, 2000);
        }
      }
      if (ev.type === 'delete') setAppointments(p => p.filter(a => a.id !== ev.id));
    });
    return unsub;
  }, [salon, isOwner]);

  const now = new Date();

  const filterByPeriod = (appts) => {
    const start = period === 'today' ? startOfDay(now) :
                  period === 'week' ? startOfWeek(now) : startOfMonth(now);
    return appts.filter(a => new Date(a.date + 'T00:00:00') >= start);
  };

  const staffFilteredAppts = isOwner && staffFilter !== 'all'
    ? appointments.filter(a => a.staff_id === staffFilter)
    : appointments;

  const periodAppts = filterByPeriod(staffFilteredAppts);
  
  const digitalMethods = ['Stripe_App'];
  const inHandMethods = ['Cash', 'ATH_Movil', 'External_Card'];
  const filterApptsByEarnings = (appts) => {
    if (earningsFilter === 'digital') return appts.filter(a => digitalMethods.includes(a.payment_method));
    if (earningsFilter === 'inhand') return appts.filter(a => inHandMethods.includes(a.payment_method));
    return appts;
  };
  
  const statsAppts = filterApptsByEarnings(periodAppts);
  const completedAppts = statsAppts.filter(a => a.status === 'completed');
  const todayAppts = appointments.filter(a => a.date === format(now, 'yyyy-MM-dd') && (staffFilter === 'all' || a.staff_id === staffFilter));
  const confirmedToday = todayAppts.filter(a => a.status === 'confirmed');
  const upcomingAppts = appointments
    .filter(a => (staffFilter === 'all' || a.staff_id === staffFilter) && new Date(a.date + 'T00:00:00') > new Date(format(now, 'yyyy-MM-dd') + 'T23:59:59') && a.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot))
    .slice(0, 10);

  const earningsAppts = completedAppts;

  // In-hand transactions filtered by period, staff, and earnings filter
  const periodInHand = inHandTransactions.filter(t => {
    const start = period === 'today' ? startOfDay(now) :
                  period === 'week' ? startOfWeek(now) : startOfMonth(now);
    const matchesPeriod = new Date(t.date + 'T00:00:00') >= start;
    const matchesStaff = staffFilter === 'all' || t.staff_id === staffFilter;
    return matchesPeriod && matchesStaff;
  });
  const earningsInHand = earningsFilter === 'digital' ? [] :
    earningsFilter === 'inhand' ? periodInHand :
    periodInHand; // 'all' includes in-hand

  const noShows = statsAppts.filter(a => a.status === 'no_show').length;
  const cancellations = statsAppts.filter(a => a.status === 'cancelled').length;
  const total = statsAppts.length + earningsInHand.length;
  const completedCount = completedAppts.length + earningsInHand.length;
  const showRate = total > 0 ? Math.round((1 - noShows / total) * 100) : 100;

  const calcFee = (appt) => {
    const gross = appt.gross_amount || appt.price || 0;
    const method = appt.payment_method;
    const stripeRate = bizSettings?.stripe_rate_percentage ?? 2.9;
    const stripeFixed = bizSettings?.stripe_fixed_fee ?? 0.30;
    const athRate = bizSettings?.ath_movil_rate_percentage ?? 2.25;
    const extRate = bizSettings?.external_terminal_rate_percentage ?? 0;
    if (method === 'Stripe_App') {
      return parseFloat(((gross * stripeRate) / 100 + stripeFixed).toFixed(2));
    }
    if (method === 'ATH_Movil') {
      return parseFloat(((gross * athRate) / 100).toFixed(2));
    }
    if (method === 'External_Card') {
      return parseFloat(((gross * extRate) / 100).toFixed(2));
    }
    return 0; // Cash
  };

  const getFee = (a) => {
    if (a.processor_fee_deducted != null) return a.processor_fee_deducted;
    if (a.payment_method) return calcFee(a);
    return null;
  };

  const apptGross = earningsAppts.reduce((s, a) => s + (a.gross_amount || a.price || 0), 0);
  const inHandGross = earningsInHand.reduce((s, t) => s + (t.amount || 0), 0);
  const grossRevenue = apptGross + inHandGross;
  const processorFees = earningsAppts.reduce((s, a) => s + getFee(a), 0);
  const apptNet = earningsAppts.reduce((s, a) => {
    const gross = a.gross_amount || a.price || 0;
    return s + (gross - getFee(a));
  }, 0);
  const houseNet = apptNet + inHandGross;

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = format(d, 'yyyy-MM-dd');
    const dayAppts = filterApptsByEarnings(staffFilteredAppts.filter(a => a.date === key && a.status === 'completed'));
    return { day: format(d, 'EEE'), revenue: dayAppts.reduce((s, a) => s + (a.gross_amount || a.price || 0), 0) };
  });

  const updateStatus = async (id, status) => {
    await base44.entities.Appointment.update(id, { status });
    if (status === 'completed') {
      await base44.functions.invoke('processAppointmentAccounting', { appointment_id: id });
      // Wait for service-role write to propagate, then re-fetch fresh data
      await new Promise(r => setTimeout(r, 800));
      const updated = await base44.entities.Appointment.get(id);
      if (updated) setAppointments(p => p.map(a => a.id === id ? updated : a));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Employee view
  if (!isOwner) {
    return <EmployeeDashboard user={user} salon={salon} />;
  }

  // Owner: no salon found
  if (!salon) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
      <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="" className="w-16 h-16 object-contain opacity-30" />
      <h2 className="font-bebas text-4xl tracking-wider text-foreground">NO SALON FOUND</h2>
      <p className="text-muted-foreground">You haven't set up your salon yet.</p>
      <Link to="/onboarding" className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
        Create Your Listing
      </Link>
    </div>
  );

  // Owner dashboard
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground">{salon.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(now, 'EEEE, MMMM d, yyyy')} · {confirmedToday.length} appointments today
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Staff filter — owner only */}
          <select
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            className="bg-secondary border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Staff</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowInHand(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/40 text-primary text-sm hover:bg-primary/10 transition-colors"
          >
            💵 In-Hand Entry
          </button>
          <button
            onClick={recalculateAll}
            disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50"
          >
            {recalculating ? 'Recalculating...' : '↻ Recalculate Earnings'}
          </button>
          <div className="flex bg-secondary border border-border rounded-lg p-1 gap-1">
            {['today', 'week', 'month'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                  period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Earnings filter */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-muted-foreground mr-1">Earnings view:</span>
        {[
          { key: 'all', label: 'All Earnings' },
          { key: 'digital', label: 'Digital Only' },
          { key: 'inhand', label: 'In-Hand' },
        ].map(f => (
          <button key={f.key} onClick={() => setEarningsFilter(f.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
              earningsFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground bg-secondary'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Gross Revenue', value: `$${grossRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
          { label: 'Processor Fees', value: `$${processorFees.toFixed(2)}`, icon: CreditCard, color: 'text-red-400' },
          { label: 'House Net', value: `$${houseNet.toFixed(2)}`, icon: Landmark, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <div className="font-bebas text-3xl text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Total Bookings', value: total, icon: Calendar, color: 'text-blue-400' },
          { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-green-400' },
          { label: 'Cancellations', value: cancellations, icon: XCircle, color: 'text-red-400' },
          { label: 'No-Shows', value: noShows, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Show Rate', value: `${showRate}%`, icon: TrendingUp, color: 'text-primary' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3">
            <Icon className={`w-4 h-4 mb-1.5 ${color}`} />
            <div className="font-bebas text-2xl text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-1">Today's Appointments</h3>
          <p className="text-xs text-muted-foreground mb-4">{format(now, 'MMMM d')}</p>
          {todayAppts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No appointments today</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {todayAppts.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).map(appt => (
                <div key={appt.id} className="bg-secondary border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedAppointment(appt)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary">{formatAmPm(appt.time_slot)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[appt.status]}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{appt.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{appt.service_name} · {appt.staff_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-1">Upcoming Appointments</h3>
          <p className="text-xs text-muted-foreground mb-4">Next 10 confirmed</p>
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {upcomingAppts.map(appt => (
                <div key={appt.id} className="bg-secondary border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedAppointment(appt)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary">{format(new Date(appt.date + 'T00:00:00'), 'MMM d')} · {formatAmPm(appt.time_slot)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[appt.status]}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{appt.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{appt.service_name} · {appt.staff_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Recent Appointments
            {staffFilter !== 'all' && (
              <span className="ml-2 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {staff.find(s => s.id === staffFilter)?.name}
              </span>
            )}
          </h3>
          <Link to="/calendar" className="text-xs text-primary hover:text-primary/80 transition-colors">View Calendar →</Link>
        </div>

        {/* Mobile card list */}
        <div className="block md:hidden divide-y divide-border">
          {(() => {
            const merged = [
              ...filterApptsByEarnings(staffFilteredAppts).map(a => ({ ...a, _type: 'appointment' })),
              ...(earningsFilter === 'digital' ? [] : periodInHand).map(t => ({ ...t, _type: 'transaction' }))
            ].sort((a, b) => {
              const dateA = new Date(a.date + (a._type === 'appointment' ? 'T' + a.time_slot : 'T23:59:59'));
              const dateB = new Date(b.date + (b._type === 'appointment' ? 'T' + b.time_slot : 'T23:59:59'));
              return dateB - dateA;
            });
            return merged.slice(0, 15).map(item => (
              <div key={item.id} className="px-4 py-4 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => item._type === 'appointment' ? setSelectedAppointment(item) : setSelectedTransaction(item)}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">{item.customer_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${item._type === 'appointment' ? STATUS_COLORS[item.status] : 'text-green-400 bg-green-400/10'}`}>
                    {item._type === 'appointment' ? item.status.replace('_', ' ') : 'Completed'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{item.service_name} · {item.staff_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{format(new Date(item.date), 'MMM d')}{item._type === 'appointment' ? ` at ${formatAmPm(item.time_slot)}` : ''}</span>
                  <span className="text-primary font-medium">${(item.gross_amount || item.amount || item.price || 0).toFixed(2)}</span>
                  {item.payment_method && <span>{item.payment_method.replace('_', ' ')}</span>}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {['Customer', 'Service', 'Staff', 'Date', 'Method', 'Gross', 'Fee', 'Net', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const merged = [
                  ...filterApptsByEarnings(staffFilteredAppts).map(a => ({ ...a, _type: 'appointment' })),
                  ...(earningsFilter === 'digital' ? [] : inHandTransactions).map(t => ({ ...t, _type: 'transaction' }))
                ].sort((a, b) => {
                  const dateA = new Date(a.date + (a._type === 'appointment' ? 'T' + a.time_slot : 'T23:59:59'));
                  const dateB = new Date(b.date + (b._type === 'appointment' ? 'T' + b.time_slot : 'T23:59:59'));
                  return dateB - dateA;
                });
                return merged.slice(0, 15).map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => item._type === 'appointment' ? setSelectedAppointment(item) : setSelectedTransaction(item)}>
                    <td className="px-4 py-3 text-foreground font-medium">{item.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.service_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.staff_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(item.date + 'T00:00:00'), 'MMM d')}{item._type === 'appointment' ? ` at ${formatAmPm(item.time_slot)}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.payment_method?.replace('_', ' ') || '—'}</td>
                    <td className="px-4 py-3 text-primary font-medium">${(item.gross_amount || item.amount || item.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-red-400 text-xs">{(() => { if (item._type === 'transaction') return '—'; const fee = getFee(item); return fee === null ? '—' : fee > 0 ? `-$${fee.toFixed(2)}` : '$0.00'; })()}</td>
                    <td className="px-4 py-3 text-green-400 text-xs">{(() => { const gross = item.gross_amount || item.amount || item.price || 0; if (item._type === 'transaction') return `$${gross.toFixed(2)}`; const fee = getFee(item); return gross > 0 ? `$${(gross - (fee ?? 0)).toFixed(2)}` : '—'; })()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${item._type === 'appointment' ? STATUS_COLORS[item.status] : 'text-green-400 bg-green-400/10'}`}>
                        {item._type === 'appointment' ? item.status.replace('_', ' ') : 'Completed'}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          {staffFilteredAppts.length === 0 && inHandTransactions.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet</p>
            </div>
          )}
        </div>

        </div>

      {showInHand && (
        <InHandTransactionModal
          user={user}
          salon={salon}
          staffRecord={staffRecord}
          onClose={() => setShowInHand(false)}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          salon={salon}
          user={user}
          bizSettings={bizSettings}
          calcFee={calcFee}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={async (id, status) => {
            await updateStatus(id, status);
          }}
        />
      )}

      {selectedTransaction && (
        <AppointmentDetailModal
          appointment={selectedTransaction}
          salon={salon}
          user={user}
          bizSettings={bizSettings}
          calcFee={calcFee}
          isInHandTransaction={true}
          onClose={() => setSelectedTransaction(null)}
          onStatusChange={async () => {}}
        />
      )}
    </div>
  );
}