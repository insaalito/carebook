import { useState, useEffect } from 'react';
import RescheduleModal from '@/components/RescheduleModal';
import { base44 } from '@/api/base44Client';
import { X, User, Phone, Mail, Scissors, Clock, DollarSign, FileText, CalendarClock } from 'lucide-react';
import { formatAmPm } from '@/utils/timeFormat';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

export default function AppointmentDetailModal({ appointment, salon, user, bizSettings, calcFee, onClose, onStatusChange, isInHandTransaction }) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [currentAppt, setCurrentAppt] = useState(appointment);
  const [wasRescheduled, setWasRescheduled] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notes, setNotes] = useState([]);
  const [clientPref, setClientPref] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(null); // 'success' | { refund_type, refunded_amount, gross_amount } | 'error'

  const handleRescheduleSuccess = ({ date, time_slot }) => {
    setCurrentAppt(prev => ({ ...prev, date, time_slot }));
    setWasRescheduled(true);
    setShowReschedule(false);
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'cancelled') {
      setShowCancelConfirm(true);
      return;
    }
    setUpdatingStatus(true);
    await onStatusChange(appointment.id, newStatus);
    setUpdatingStatus(false);
    onClose();
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await base44.functions.invoke('refundAppointment', { appointment_id: appointment.id });
      if (res.data?.ok) {
        setCancelResult(res.data.refunded ? { refund_type: res.data.refund_type, refunded_amount: res.data.refunded_amount, gross_amount: res.data.gross_amount } : 'no_payment');
        setTimeout(() => onClose(), 2200);
      } else {
        setCancelResult('error');
      }
    } catch {
      setCancelResult('error');
    }
    setCancelling(false);
  };

  // Calculate expected refund for the dialog preview
  const getRefundPreview = () => {
    if (!appointment.stripe_payment_intent_id || appointment.payment_method !== 'Stripe_App') return null;
    const gross = appointment.gross_amount || appointment.price || 0;
    const apptDateTime = new Date(`${appointment.date}T${appointment.time_slot || '09:00'}:00`);
    const hoursUntil = (apptDateTime - new Date()) / (1000 * 60 * 60);
    const isOwnerCancelling = user?.role === 'admin' || user?.email === appointment.salon_owner_email;
    const isFullRefund = isOwnerCancelling || hoursUntil > 24;
    if (isFullRefund) return { type: 'full', amount: gross, ownerCancelling: isOwnerCancelling };
    const stripeRate = bizSettings?.stripe_rate_percentage ?? 2.9;
    const stripeFixed = bizSettings?.stripe_fixed_fee ?? 0.30;
    const fee = parseFloat(((gross * stripeRate / 100) + stripeFixed).toFixed(2));
    return { type: 'partial', amount: parseFloat((gross - fee).toFixed(2)), fee, gross, hoursUntil };
  };

  useEffect(() => {
    if (!appointment?.customer_email || !appointment?.salon_id) return;
    base44.entities.ClientPreference.filter({ customer_email: appointment.customer_email })
      .then(prefs => setClientPref(prefs[0] || null));
    base44.entities.ClientNote.filter({
      salon_id: appointment.salon_id,
      customer_email: appointment.customer_email,
    }).then(list =>
      setNotes([...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)))
    );
  }, [appointment]);



  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    const newNote = await base44.entities.ClientNote.create({
      salon_id: appointment.salon_id,
      customer_email: appointment.customer_email,
      appointment_id: appointment.id,
      note_text: noteText.trim(),
      author_name: user.full_name || user.email,
      author_email: user.email,
      salon_owner_email: appointment.salon_owner_email || '',
    });
    setNotes(prev => [newNote, ...prev]);
    setNoteText('');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">{isInHandTransaction ? 'Transaction' : 'Appointment &amp; Client'} Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{appointment.date}{!isInHandTransaction && appointment.time_slot ? ` · ${formatAmPm(appointment.time_slot)}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Current date/time (updates after reschedule) */}
          <div className="flex items-center justify-between bg-secondary rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">{wasRescheduled ? 'Rescheduled' : 'Scheduled'}</p>
              <p className="text-sm font-medium text-foreground">{currentAppt.date} · {formatAmPm(currentAppt.time_slot)}</p>
            </div>
            {(user?.role === 'admin' || currentAppt.assigned_staff_email === user?.email) && currentAppt.status === 'confirmed' && (
              <button
                onClick={() => setShowReschedule(true)}
                className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                Reschedule
              </button>
            )}
          </div>

          {/* Client Preference Alert */}
          {clientPref?.global_client_notes && (
            <div className="flex items-start gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-yellow-400 mb-0.5">Client Notes (Allergies / Cut Specs / Sensitivities)</p>
                <p className="text-sm text-yellow-200/90">{clientPref.global_client_notes}</p>
              </div>
            </div>
          )}

          {/* Client Info */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Client</h4>
            <div className="bg-secondary rounded-xl border border-border px-4 py-3 space-y-1">
              <DetailRow icon={User} label="Name" value={appointment.customer_name} />
              {!isInHandTransaction && appointment.customer_phone && (
                <DetailRow icon={Phone} label="Phone" value={appointment.customer_phone} />
              )}
              {!isInHandTransaction && (
                <DetailRow icon={Mail} label="Email" value={appointment.customer_email} />
              )}
            </div>
          </section>

          {/* Status Action Buttons — only for confirmed appointments (hide for in-hand) */}
          {!isInHandTransaction && appointment.status === 'confirmed' && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Update Status</h4>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStatusChange('completed')}
                  disabled={updatingStatus}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500/70 active:scale-95 transition-all disabled:opacity-50 font-semibold text-sm"
                >
                  <span className="text-2xl">✓</span>
                  Done
                </button>
                <button
                  onClick={() => handleStatusChange('no_show')}
                  disabled={updatingStatus}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/70 active:scale-95 transition-all disabled:opacity-50 font-semibold text-sm"
                >
                  <span className="text-2xl">✗</span>
                  No Show
                </button>
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updatingStatus}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/70 active:scale-95 transition-all disabled:opacity-50 font-semibold text-sm"
                >
                  <span className="text-2xl">⊘</span>
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* Appointment Info */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Service</h4>
            <div className="bg-secondary rounded-xl border border-border px-4 py-3 space-y-1">
              <DetailRow icon={Scissors} label="Service" value={appointment.service_name} />
              {!isInHandTransaction && (
                <DetailRow icon={Clock} label="Duration" value={`${appointment.duration_minutes || 30} min`} />
              )}
              {appointment.staff_name && (
                <DetailRow icon={User} label="Staff" value={appointment.staff_name} />
              )}
            </div>
          </section>

          {/* Earnings Breakdown */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Earnings Breakdown</h4>
            <div className="bg-secondary rounded-xl border border-border px-4 py-3 space-y-2">
              {(() => {
                const gross = appointment.gross_amount || appointment.price || 0;
                const fee = (appointment.processor_fee_deducted != null)
                  ? appointment.processor_fee_deducted
                  : (calcFee && appointment.payment_method) ? calcFee(appointment) : null;
                const net = parseFloat((gross - fee).toFixed(2));
                const method = appointment.payment_method;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Gross Price</span>
                      <span className="text-sm font-semibold text-primary">${gross.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Processor Fee{method && method !== 'Cash' ? ` (${method.replace('_', ' ')})` : ''}
                      </span>
                      <span className="text-sm text-red-400">
                        {fee === null ? '—' : fee > 0 ? `-$${fee.toFixed(2)}` : '$0.00'}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Take Home (Net)</span>
                      <span className="text-base font-bebas text-green-400">${fee === null ? gross.toFixed(2) : (gross - fee).toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </section>

          {/* Notes — booking notes for appointments, transaction notes for in-hand */}
          {appointment.notes && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {isInHandTransaction ? 'Notes' : 'Client Notes (from booking)'}
              </h4>
              <div className="bg-secondary rounded-xl border border-border px-4 py-3">
                <p className="text-sm text-foreground">{appointment.notes}</p>
              </div>
            </section>
          )}

          {/* Internal Salon Notes — staff & owner only, hide for in-hand transactions */}
          {!isInHandTransaction && (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Internal Salon Notes (Staff &amp; Owner Only)
            </h4>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a private note about this client..."
              rows={3}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              onClick={saveNote}
              disabled={saving || !noteText.trim()}
              size="sm"
              className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Saving...' : 'Save Note'}
            </Button>

            {/* Notes history */}
            {notes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="bg-secondary border border-border rounded-lg px-4 py-3">
                    <p className="text-sm text-foreground">{n.note_text}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      <span className="text-primary">{n.author_name}</span>
                      {' · '}
                      {n.created_date ? format(new Date(n.created_date), 'MMM d, yyyy · h:mm a') : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">No internal notes yet for this client.</p>
            )}
          </section>
          )}
        </div>
      </div>

      {showReschedule && (
        <RescheduleModal
          appointment={currentAppt}
          salon={salon}
          onClose={() => setShowReschedule(false)}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
            {cancelResult === null ? (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg">Cancel Appointment?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{appointment.customer_name}</span> · {appointment.service_name} · {appointment.date}
                  </p>
                </div>
                {(() => {
                  const preview = getRefundPreview();
                  if (!preview) return (
                    <p className="text-sm text-muted-foreground text-center mb-5">No payment to refund.</p>
                  );
                  if (preview.type === 'full') return (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-5 text-center">
                      <p className="text-xs text-muted-foreground">Refund to client</p>
                      <p className="text-xl font-bebas text-green-400 mt-0.5">${preview.amount.toFixed(2)} <span className="text-xs font-sans text-green-400/70">(full refund)</span></p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preview.ownerCancelling ? 'Owner cancellation — client always receives a full refund.' : 'Appointment is more than 24 hours away.'}
                      </p>
                    </div>
                  );
                  return (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-5">
                      <p className="text-xs text-muted-foreground text-center mb-2">Late cancellation — within 24 hours</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Gross paid</span><span className="text-foreground">${preview.gross.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Stripe fee (non-refundable)</span><span className="text-red-400">-${preview.fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-yellow-500/30">
                        <span className="text-foreground">Client receives</span><span className="text-yellow-400">${preview.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Go Back
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
                    {cancelResult.refund_type === 'full' ? 'Full refund' : `Partial refund of $${cancelResult.refunded_amount?.toFixed(2)}`} issued to client.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">⚠️</div>
                <p className="font-semibold text-red-400">Something went wrong</p>
                <p className="text-sm text-muted-foreground mt-1">Please try again or contact support.</p>
                <button onClick={() => setCancelResult(null)} className="mt-3 text-xs text-primary underline">Retry</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}