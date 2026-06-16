import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, Link } from 'react-router-dom';
import { format, differenceInHours, parseISO } from 'date-fns';
import {
  User, Phone, Mail, Calendar, Clock, AlertTriangle,
  Save, Scissors, ChevronRight, Trash2, RefreshCw, X, LogOut, Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import RescheduleModal from '@/components/RescheduleModal';

function formatAmPm(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function hoursDiff(dateStr, timeStr) {
  const dt = parseISO(`${dateStr}T${timeStr}:00`);
  return differenceInHours(dt, new Date());
}

export default function ClientProfile() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [pref, setPref] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' });
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState(null);
  const [reschedulingSalon, setReschedulingSalon] = useState(null);
  const [cancellingAppt, setCancellingAppt] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { navigate('/'); return; }
      setUser(u);
      const [appts, prefs] = await Promise.all([
        base44.entities.Appointment.filter({ customer_email: u.email }),
        base44.entities.ClientPreference.filter({ customer_email: u.email }),
      ]);
      setAppointments(appts);
      const p = prefs[0] || null;
      setPref(p);
      setNotes(p?.global_client_notes || '');
      setEditForm({ full_name: p?.customer_name || u.full_name || '', phone: p?.phone || '' });
      setLoading(false);
    });
  }, []);

  const saveNotes = async (value) => {
    setSavingNotes(true);
    if (pref) {
      const updated = await base44.entities.ClientPreference.update(pref.id, { global_client_notes: value });
      setPref(updated);
    } else {
      const created = await base44.entities.ClientPreference.create({
        customer_email: user.email,
        customer_name: user.full_name || '',
        global_client_notes: value,
      });
      setPref(created);
    }
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleNotesChange = (val) => {
    setNotes(val);
    setNotesSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNotes(val), 1500);
  };

  const handleCancelAppt = (appt) => {
    setCancellingAppt(appt);
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await base44.functions.invoke('refundAppointment', { appointment_id: cancellingAppt.id });
      if (res.data?.ok) {
        setCancelResult(res.data.refunded ? { refund_type: res.data.refund_type, refunded_amount: res.data.refunded_amount } : 'no_payment');
        setAppointments(prev => prev.map(a => a.id === cancellingAppt.id ? { ...a, status: 'cancelled' } : a));
        setTimeout(() => { setCancellingAppt(null); setCancelResult(null); }, 2200);
      } else {
        setCancelResult('error');
      }
    } catch {
      setCancelResult('error');
    }
    setCancelling(false);
  };

  const getRefundPreview = (appt) => {
    if (!appt?.stripe_payment_intent_id || appt.payment_method !== 'Stripe_App') return null;
    const gross = appt.gross_amount || appt.price || 0;
    const apptDateTime = new Date(`${appt.date}T${appt.time_slot || '09:00'}:00`);
    const hoursUntil = (apptDateTime - new Date()) / (1000 * 60 * 60);
    if (hoursUntil > 24) return { type: 'full', amount: gross };
    const fee = parseFloat(((gross * 2.9 / 100) + 0.30).toFixed(2));
    return { type: 'partial', amount: parseFloat((gross - fee).toFixed(2)), fee, gross };
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE MY ACCOUNT') return;
    setDeleting(true);
    await base44.functions.invoke('deleteClientAccount', {});
    base44.auth.logout('/');
  };

  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');

  const activeAppts = appointments
    .filter(a => a.status === 'confirmed' && a.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));

  const pastAppts = appointments
    .filter(a => a.status !== 'confirmed' || a.date < todayKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time_slot.localeCompare(a.time_slot));

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-6 h-6 object-contain" />
          <span className="font-bebas text-2xl tracking-widest text-primary">CareBook</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground transition-colors">Explore</Link>
          <button onClick={() => navigate('/dashboard')} className="hover:text-foreground transition-colors">For Business</button>
          <button onClick={() => navigate('/profile')} className="text-foreground transition-colors">My Profile</button>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-foreground hover:text-primary transition-colors">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-card border-b border-border">
          <div className="flex flex-col p-4 gap-4">
            <Link to="/explore" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-primary transition-colors py-2">Explore</Link>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/dashboard'); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">For Business</button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/profile'); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">My Profile</button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-24 pb-10 space-y-6">

        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bebas text-2xl">
              {(pref?.customer_name || user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="font-bebas text-2xl tracking-wider text-foreground">{pref?.customer_name || user?.full_name || 'Client'}</h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="w-3 h-3" />
                <span>{user?.email}</span>
              </div>
              {pref?.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3" />
                  <span>{pref.phone}</span>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditProfile(true)}>Edit Profile</Button>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-primary" />
            My Preferences
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Visible to your barber/stylist for every booking.</p>
          <label className="text-xs text-muted-foreground mb-1 block">Important Notes for Staff (Allergies, Cut Specs, or Sensitivities)</label>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="e.g. Allergic to lavender oil. Always fade at a 1.5. No razor near neck."
            rows={4}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2 mt-2 h-5">
            {savingNotes && <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Saving...</span>}
            {notesSaved && <span className="text-xs text-green-400 flex items-center gap-1"><Save className="w-3 h-3" /> Saved</span>}
          </div>
        </div>

        {/* Appointments Hub */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {[
              { key: 'active', label: `Upcoming (${activeAppts.length})` },
              { key: 'past', label: `Past (${pastAppts.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'active' && (
            <div>
              {activeAppts.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20 text-foreground" />
                  <p className="text-muted-foreground mb-4">You have no upcoming appointments. Ready for a self-care day?</p>
                  <Link to="/explore">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Find a Barber <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activeAppts.map(appt => {
                    const hrs = hoursDiff(appt.date, appt.time_slot || '09:00');
                    const canChange = hrs > 2;
                    const alreadyRescheduled = !!appt.client_rescheduled;
                    return (
                      <div key={appt.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-medium text-foreground text-sm">{appt.salon_name || 'Salon'}</p>
                            <p className="text-xs text-muted-foreground">{appt.service_name} · {appt.staff_name}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                              <Clock className="w-3 h-3" />
                              <span>{format(parseISO(appt.date), 'MMM d, yyyy')} at {formatAmPm(appt.time_slot)}</span>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full shrink-0">Confirmed</span>
                        </div>

                        {canChange ? (
                          <div className="flex gap-2 mt-2">
                            {alreadyRescheduled ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-2">
                                ⟳ Already rescheduled once — contact the salon for further changes.
                              </p>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={async () => {
                                  const salons = await base44.entities.Salon.filter({ id: appt.salon_id });
                                  setReschedulingSalon(salons[0] || null);
                                  setReschedulingAppt(appt);
                                }}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Reschedule
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleCancelAppt(appt)}
                            >
                              <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1.5 bg-yellow-400/10 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Changes within 2 hours must be made by calling the salon directly.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'past' && (
            <div>
              {pastAppts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No past appointments yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pastAppts.map(appt => (
                    <div key={appt.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground text-sm">{appt.salon_name || 'Salon'}</p>
                        <p className="text-xs text-muted-foreground">{appt.service_name} · {appt.staff_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">{appt.date} at {formatAmPm(appt.time_slot)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            appt.status === 'completed' ? 'text-green-400 bg-green-400/10' :
                            appt.status === 'cancelled' ? 'text-red-400 bg-red-400/10' :
                            'text-yellow-400 bg-yellow-400/10'
                          }`}>{appt.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
                        onClick={() => navigate(`/salon/${appt.salon_id}`, { state: { preselect_service: appt.service_id } })}
                      >
                        Book Again
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full border-border text-foreground hover:text-foreground"
          onClick={() => base44.auth.logout('/')}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>

        {/* Danger Zone */}
        <div className="border border-red-500/40 bg-red-500/5 rounded-2xl p-6">
          <h2 className="font-semibold text-red-400 mb-1 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            This will cancel all upcoming appointments and permanently delete your account. This action cannot be undone.
          </p>
          <label className="text-xs text-muted-foreground mb-1 block">
            Type <span className="font-mono text-red-400">DELETE MY ACCOUNT</span> to confirm
          </label>
          <input
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            placeholder="DELETE MY ACCOUNT"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-3 font-mono"
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={deleteInput !== 'DELETE MY ACCOUNT' || deleting}
            onClick={handleDeleteAccount}
          >
            {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
          </Button>
        </div>
      </div>

      {reschedulingAppt && reschedulingSalon && (
        <RescheduleModal
          appointment={reschedulingAppt}
          salon={reschedulingSalon}
          onClose={() => { setReschedulingAppt(null); setReschedulingSalon(null); }}
          onSuccess={async ({ date, time_slot }) => {
            await base44.entities.Appointment.update(reschedulingAppt.id, { client_rescheduled: true });
            setAppointments(prev => prev.map(a =>
              a.id === reschedulingAppt.id ? { ...a, date, time_slot, client_rescheduled: true } : a
            ));
            setReschedulingAppt(null);
            setReschedulingSalon(null);
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
            {cancelResult === null ? (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg">Cancel Appointment?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{cancellingAppt.service_name}</span> · {cancellingAppt.date}
                  </p>
                </div>
                {(() => {
                  const preview = getRefundPreview(cancellingAppt);
                  if (!preview) return (
                    <p className="text-sm text-muted-foreground text-center mb-5">No payment to refund.</p>
                  );
                  if (preview.type === 'full') return (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-5 text-center">
                      <p className="text-xs text-muted-foreground">You will receive</p>
                      <p className="text-xl font-semibold text-green-400 mt-0.5">${preview.amount.toFixed(2)} <span className="text-xs font-normal text-green-400/70">(full refund)</span></p>
                      <p className="text-xs text-muted-foreground mt-1">Appointment is more than 24 hours away.</p>
                    </div>
                  );
                  return (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-5">
                      <p className="text-xs text-muted-foreground text-center mb-2">Late cancellation — within 24 hours</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Amount paid</span><span className="text-foreground">${preview.gross.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Processing fee (non-refundable)</span><span className="text-red-400">-${preview.fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-yellow-500/30">
                        <span className="text-foreground">You will receive</span><span className="text-yellow-400">${preview.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancellingAppt(null)}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Keep It
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                </div>
              </>
            ) : cancelResult && cancelResult !== 'error' ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">✓</div>
                <p className="font-semibold text-green-400">Appointment Cancelled</p>
                {cancelResult === 'no_payment' ? (
                  <p className="text-sm text-muted-foreground mt-1">No payment to refund.</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {cancelResult.refund_type === 'full' ? 'Full refund' : `Partial refund of $${cancelResult.refunded_amount?.toFixed(2)}`} sent to your card.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="font-semibold text-red-400">Something went wrong</p>
                <p className="text-sm text-muted-foreground mt-1">Please try again.</p>
                <button onClick={() => setCancelResult(null)} className="mt-3 text-xs text-primary underline">Retry</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Edit Profile</h3>
              <button onClick={() => setEditProfile(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                <input
                  value={editForm.full_name}
                  onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(787) 000-0000"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditProfile(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={async () => {
                if (pref) {
                  const updated = await base44.entities.ClientPreference.update(pref.id, { phone: editForm.phone, customer_name: editForm.full_name });
                  setPref(updated);
                } else {
                  const created = await base44.entities.ClientPreference.create({
                    customer_email: user.email,
                    customer_name: editForm.full_name,
                    phone: editForm.phone,
                    global_client_notes: notes,
                  });
                  setPref(created);
                }
                await base44.auth.updateMe({ full_name: editForm.full_name });
                setUser(prev => ({ ...prev, full_name: editForm.full_name }));
                setEditProfile(false);
              }}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}