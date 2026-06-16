import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Plus, Pencil, Trash2, Scissors, Clock, DollarSign, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['haircut', 'beard', 'color', 'treatment', 'shave', 'styling', 'other'];

export default function ServicesPage() {
  const { user } = useAuth();
  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', duration_minutes: 30, price: '', category: 'haircut' });
  const [showStaffAssign, setShowStaffAssign] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState([]);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Salon.filter({ owner_email: user.email }).then(async (salons) => {
      if (salons[0]) {
        setSalon(salons[0]);
        const [svcs, staffList] = await Promise.all([
          base44.entities.Service.filter({ salon_id: salons[0].id }),
          base44.entities.Staff.filter({ salon_id: salons[0].id })
        ]);
        setServices(svcs);
        setStaff(staffList);
      }
      setLoading(false);
    });
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', duration_minutes: 30, price: '', category: 'haircut' });
    setShowForm(true);
  };

  const openEdit = (svc) => {
    setEditing(svc);
    setForm({ name: svc.name, description: svc.description || '', duration_minutes: svc.duration_minutes, price: svc.price, category: svc.category });
    setShowForm(true);
  };

  const openStaffAssign = (svc) => {
    setShowStaffAssign(svc);
    setSelectedStaff(svc.staff_ids || []);
  };

  const saveStaffAssignment = async () => {
    await base44.entities.Service.update(showStaffAssign.id, { staff_ids: selectedStaff });
    setServices(prev => prev.map(s => s.id === showStaffAssign.id ? { ...s, staff_ids: selectedStaff } : s));
    setShowStaffAssign(null);
  };

  const handleSave = async () => {
    const data = { ...form, salon_id: salon.id, price: parseFloat(form.price), duration_minutes: parseInt(form.duration_minutes) };
    if (editing) {
      const updated = await base44.entities.Service.update(editing.id, data);
      setServices(prev => prev.map(s => s.id === editing.id ? updated : s));
    } else {
      const created = await base44.entities.Service.create(data);
      setServices(prev => [...prev, created]);
    }
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Service.delete(id);
    setServices(prev => prev.filter(s => s.id !== id));
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-bebas text-4xl tracking-wider text-foreground">SERVICES</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage what you offer and at what price</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Add Service
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4">{editing ? 'Edit Service' : 'New Service'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Service Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize text-foreground">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Duration (minutes)</Label>
              <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Price ($)</Label>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-muted-foreground text-xs">Description (optional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border text-foreground">Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.price} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {editing ? 'Save Changes' : 'Add Service'}
            </Button>
          </div>
        </div>
      )}

      {services.length === 0 && !showForm ? (
        <div className="text-center py-20 text-muted-foreground">
          <Scissors className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No services yet. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map(svc => (
            <div key={svc.id} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:border-border/80 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{svc.name}</h3>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full capitalize">{svc.category}</span>
                </div>
                {svc.description && <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>}
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{svc.duration_minutes} min</span>
                  <span className="flex items-center gap-1 text-xs text-primary font-semibold"><DollarSign className="w-3 h-3" />{svc.price}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => openStaffAssign(svc)} className="text-muted-foreground hover:text-foreground h-8 w-8" title="Assign staff">
                  <Users className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(svc)} className="text-muted-foreground hover:text-foreground h-8 w-8">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(svc.id)} className="text-muted-foreground hover:text-destructive h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showStaffAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Assign Staff to {showStaffAssign.name}</h3>
              <button onClick={() => setShowStaffAssign(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff members available. Add staff first.</p>
              ) : (
                <div className="space-y-2">
                  {staff.map(member => (
                    <label key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedStaff.includes(member.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedStaff(prev => [...prev, member.id]);
                          } else {
                            setSelectedStaff(prev => prev.filter(id => id !== member.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm text-foreground">{member.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{member.role_title || 'Staff'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowStaffAssign(null)} className="border-border text-foreground">Cancel</Button>
              <Button onClick={saveStaffAssignment} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Assignment</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}