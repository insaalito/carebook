import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Plus, Pencil, Trash2, Users, Clock, Power, UserPlus, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InviteStaffModal from '@/components/staff/InviteStaffModal';
import StaffAvailabilityManager from '@/components/staff/StaffAvailabilityManager';

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
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toAmPm(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function StaffPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'admin';

  const [salon, setSalon] = useState(null);
  const [staff, setStaff] = useState([]);
  const [myStaffRecord, setMyStaffRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', role_title: 'Barber', bio: '',
    start_time: '09:00', end_time: '18:00', working_days: [], chair_designation: '', phone: ''
  });
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    if (isOwner) {
      // Owner: find their salon, then load all staff
      base44.entities.Salon.filter({ owner_email: user.email }).then(async (salons) => {
        if (salons[0]) {
          setSalon(salons[0]);
          const s = await base44.entities.Staff.filter({ salon_id: salons[0].id });
          setStaff(s);
        }
        setLoading(false);
      });
    } else {
      // Staff role: find their own record to get salon_id, then load all salon staff
      base44.entities.Staff.filter({ user_email: user.email }).then(async (records) => {
        if (records[0]) {
          setMyStaffRecord(records[0]);
          const salonData = await base44.entities.Salon.filter({ id: records[0].salon_id });
          setSalon(salonData[0] || null);
          const allStaff = await base44.entities.Staff.filter({ salon_id: records[0].salon_id });
          setStaff(allStaff);
        }
        setLoading(false);
      });
    }
  }, [user, isOwner]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', role_title: 'Barber', bio: '', start_time: '09:00', end_time: '18:00', working_days: [], chair_designation: '', phone: '' });
    setShowForm(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    const isMe = myStaffRecord?.id === member.id;
    setForm({
      name: isMe ? (user.full_name || member.name) : member.name,
      role_title: member.role_title || '', bio: member.bio || '',
      start_time: member.start_time || '09:00',
      end_time: member.end_time || '18:00', working_days: member.working_days || [],
      chair_designation: member.chair_designation || '', phone: member.phone || ''
    });
    setShowForm(true);
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter(d => d !== day)
        : [...f.working_days, day]
    }));
  };

  const handleSave = async () => {
    const data = { ...form, salon_id: salon.id };
    if (editing) {
      const updated = await base44.entities.Staff.update(editing.id, data);
      setStaff(prev => prev.map(s => s.id === editing.id ? updated : s));
      if (myStaffRecord?.id === editing.id) {
        setMyStaffRecord(updated);
        // Keep user profile name in sync
        if (form.name !== user.full_name) {
          await base44.auth.updateMe({ full_name: form.name });
        }
      }
    } else {
      const created = await base44.entities.Staff.create({ ...data, is_active: false });
      setStaff(prev => [...prev, created]);
    }
    setShowForm(false);
  };

  const toggleActive = async (member) => {
    const updated = await base44.entities.Staff.update(member.id, { is_active: !member.is_active });
    setStaff(prev => prev.map(s => s.id === member.id ? updated : s));
  };

  const handleDelete = async (id) => {
    await base44.entities.Staff.delete(id);
    setStaff(prev => prev.filter(s => s.id !== id));
  };

  // Can this user edit this particular staff card?
  const canEdit = (member) => isOwner || (myStaffRecord?.id === member.id);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground">TEAM</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isOwner ? 'Manage your team and their schedules' : `${salon?.name || ''} — Your co-workers`}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm hover:bg-primary/10 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite Staff
          </button>
        )}
      </div>

      {/* Edit/Add form — only visible to owner or staff editing their own record */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4">{editing ? 'Edit Staff Member' : 'New Staff Member'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Full Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Title (e.g. Barber, Stylist)</Label>
              <Input value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Start Time</Label>
              <Select value={form.start_time} onValueChange={v => setForm(f => ({ ...f, start_time: v }))}>
                <SelectTrigger className="bg-secondary border-border text-foreground mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-52">
                  {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">End Time</Label>
              <Select value={form.end_time} onValueChange={v => setForm(f => ({ ...f, end_time: v }))}>
                <SelectTrigger className="bg-secondary border-border text-foreground mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-52">
                  {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editing && editing.id && (
              <div className="md:col-span-2">
                <Label className="text-muted-foreground text-xs mb-2 block">Personal Time Blocks & Days Off</Label>
                <StaffAvailabilityManager staffId={editing.id} />
              </div>
            )}

            <div>
              <Label className="text-muted-foreground text-xs">Bio (optional)</Label>
              <Input value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Phone Number (optional)</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(787) 000-0000" className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Chair / Station (optional)</Label>
              <Input value={form.chair_designation} onChange={e => setForm(f => ({ ...f, chair_designation: e.target.value }))} placeholder="e.g. Chair 1, Station A" className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-muted-foreground text-xs mb-2 block">Working Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.working_days.includes(day)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border text-foreground">Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {editing ? 'Save Changes' : 'Add Staff Member'}
            </Button>
          </div>
        </div>
      )}

      {staff.length === 0 && !showForm ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No staff yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staff.map(member => {
            const editable = canEdit(member);
            const isMe = myStaffRecord?.id === member.id;
            return (
              <div key={member.id} className={`bg-card border rounded-xl p-5 transition-colors ${isMe ? 'border-primary/40' : 'border-border'}`}>
                <div className="flex items-start gap-4">
                   <div className="w-14 h-14 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center">
                     <span className="font-bebas text-2xl text-primary">{member.name.charAt(0)}</span>
                   </div>
                   <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{isMe ? (user.full_name || member.name) : member.name}</h3>
                      {member.user_email === salon?.owner_email ? (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium">Owner</span>
                      ) : member.is_owner_linked ? (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Member</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-primary">{member.role_title}</p>
                    {member.user_email && (isOwner || isMe) && (
                      <p className="text-xs text-muted-foreground opacity-50 mt-0.5 select-none cursor-default tracking-wide">
                        {member.user_email}
                      </p>
                    )}
                    {member.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{member.bio}</p>}
                    {member.phone && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <a href={`tel:${member.phone}`} className="hover:text-foreground transition-colors">{member.phone}</a>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {toAmPm(member.start_time)} – {toAmPm(member.end_time)}
                    </div>
                    {member.working_days?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.working_days.map(d => (
                          <span key={d} className="text-xs bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">{d.slice(0, 3)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Edit/Delete — only if this user can edit this card */}
                  {editable && (
                    <div className="flex flex-col gap-1 items-center">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(member)} className="text-muted-foreground hover:text-foreground h-8 w-8">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {isOwner && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(member.id)} className="text-muted-foreground hover:text-destructive h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Active toggle — owner only */}
                {isOwner && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Power className={`w-3.5 h-3.5 ${member.is_active ? 'text-green-400' : 'text-muted-foreground'}`} />
                      <span className="text-xs text-muted-foreground">Active on Calendar</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(member)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${member.is_active ? 'bg-green-500' : 'bg-secondary border border-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${member.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}

                {/* Status badge — read-only for staff viewing co-workers */}
                {!isOwner && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Power className={`w-3.5 h-3.5 ${member.is_active ? 'text-green-400' : 'text-muted-foreground'}`} />
                    <span className={`text-xs ${member.is_active ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showInvite && salon && (
        <InviteStaffModal salonId={salon.id} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}