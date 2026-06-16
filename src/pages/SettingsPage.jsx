import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Save, ExternalLink, Upload } from 'lucide-react';
import ExclusionsManager from '@/components/settings/ExclusionsManager';
import HolidayManager from '@/components/settings/HolidayManager';
import ProcessorFeeConfig from '@/components/settings/ProcessorFeeConfig';
import TeamCalendarConfig from '@/components/settings/TeamCalendarConfig';
import StripeConnectButton from '@/components/settings/StripeConnectButton';
import ImageEditor from '@/components/ImageEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORIES = ['barbershop', 'salon', 'beauty_studio', 'nail_salon', 'spa'];

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

export default function SettingsPage() {
  const { user } = useAuth();
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0=none, 1=first confirm, 2=type confirm
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', address: '', city: '', phone: '',
    image_url: '', google_maps_url: '', category: 'barbershop', opening_time: '09:00',
    closing_time: '18:00', shift2_start: '', shift2_end: '',
    working_days: [],
    slot_interval_minutes: 30, buffer_minutes: 0,
  });

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Salon.filter({ owner_email: user.email }).then(salons => {
      if (salons[0]) {
        setSalon(salons[0]);
        const s = salons[0];
        setForm({
          name: s.name || '', description: s.description || '', address: s.address || '',
          city: s.city || '', phone: s.phone || '', image_url: s.image_url || '', google_maps_url: s.google_maps_url || '',
          category: s.category || 'barbershop', opening_time: s.opening_time || '09:00',
          closing_time: s.closing_time || '18:00',
          shift2_start: s.shift2_start || '', shift2_end: s.shift2_end || '',
          working_days: s.working_days || [],
          slot_interval_minutes: s.slot_interval_minutes || 30,
          buffer_minutes: s.buffer_minutes || 0,
        });
      }
      setLoading(false);
    });
  }, [user]);

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter(d => d !== day)
        : [...f.working_days, day]
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTempImageUrl(event.target?.result);
      setShowImageEditor(true);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageSave = async (croppedFile) => {
    setUploadingImage(true);
    const uploadedFile = await base44.integrations.Core.UploadFile({ file: croppedFile });
    setForm(f => ({ ...f, image_url: uploadedFile.file_url }));
    setShowImageEditor(false);
    setTempImageUrl(null);
    setUploadingImage(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (salon) {
      await base44.entities.Salon.update(salon.id, form);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <>
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-bebas text-4xl tracking-wider text-foreground">SETTINGS</h1>
            <p className="text-muted-foreground text-sm mt-1">Update your salon listing</p>
          </div>
          {salon && (
            <Link to={`/salon/${salon.id}`} target="_blank" className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
              <ExternalLink className="w-3 h-3" /> View Public Page
            </Link>
          )}
        </div>

        {!salon ? (
          <div></div>
        ) : (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground border-b border-border pb-3">Basic Info</h3>
              <div>
                <Label className="text-muted-foreground text-xs">Salon / Shop Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize text-foreground">{c.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border text-foreground mt-1 h-24 resize-none" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Cover Photo <span className="text-destructive">*</span></Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                  id="cover-photo-input"
                />
                <label htmlFor="cover-photo-input" className="block mt-1 cursor-pointer group">
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border bg-secondary">
                    {form.image_url ? (
                      <>
                        <img src={form.image_url} alt="Cover preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Upload className="w-5 h-5 text-white" />
                          <span className="text-white text-sm font-medium">{uploadingImage ? 'Uploading...' : 'Change Photo'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{uploadingImage ? 'Uploading...' : 'Upload Cover Photo'}</span>
                        <span className="text-xs text-muted-foreground/60">Required — click to choose</span>
                      </div>
                    )}
                  </div>
                </label>
                {form.image_url && (
                  <p className="text-xs text-muted-foreground mt-1">This is exactly how your cover photo will appear on your salon page. Click to change.</p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground border-b border-border pb-3">Location & Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">City</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">Google Maps URL</Label>
                  <Input value={form.google_maps_url} onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" placeholder="https://maps.google.com/..." />
                  <p className="text-xs text-muted-foreground mt-1">Paste your Google Maps share link so clients can find you easily.</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground border-b border-border pb-3">Hours & Availability</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Opening Time</Label>
                  <Select value={form.opening_time} onValueChange={v => setForm(f => ({ ...f, opening_time: v }))}>
                    <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-52">
                      {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Closing Time</Label>
                  <Select value={form.closing_time} onValueChange={v => setForm(f => ({ ...f, closing_time: v }))}>
                    <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-52">
                      {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Booking Interval Per Turn</Label>
                  <Select
                    value={String(form.slot_interval_minutes)}
                    onValueChange={v => setForm(f => ({ ...f, slot_interval_minutes: Number(v) }))}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="15" className="text-foreground">15 mins</SelectItem>
                      <SelectItem value="30" className="text-foreground">30 mins</SelectItem>
                      <SelectItem value="45" className="text-foreground">45 mins</SelectItem>
                      <SelectItem value="60" className="text-foreground">60 mins</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Length of each bookable slot</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Buffer Time Between Turns</Label>
                  <Select
                    value={String(form.buffer_minutes)}
                    onValueChange={v => setForm(f => ({ ...f, buffer_minutes: Number(v) }))}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="0" className="text-foreground">None</SelectItem>
                      <SelectItem value="5" className="text-foreground">5 mins</SelectItem>
                      <SelectItem value="10" className="text-foreground">10 mins</SelectItem>
                      <SelectItem value="15" className="text-foreground">15 mins</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Clean-up time after each turn</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs block">Split Shift (optional second window)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Shift 2 Start</Label>
                    <Select value={form.shift2_start || '__none__'} onValueChange={v => setForm(f => ({ ...f, shift2_start: v === '__none__' ? '' : v }))}>
                      <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border max-h-52">
                        <SelectItem value="__none__" className="text-muted-foreground">None (single shift)</SelectItem>
                        {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Shift 2 End</Label>
                    <Select value={form.shift2_end || '__none__'} onValueChange={v => setForm(f => ({ ...f, shift2_end: v === '__none__' ? '' : v }))} disabled={!form.shift2_start}>
                      <SelectTrigger className="bg-secondary border-border text-foreground mt-1">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border max-h-52">
                        <SelectItem value="__none__" className="text-muted-foreground">None</SelectItem>
                        {TIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.shift2_start && form.shift2_end && (
                  <p className="text-xs text-muted-foreground">Slots will be generated for Shift 1 ({form.opening_time}–{form.closing_time}) and Shift 2 ({form.shift2_start}–{form.shift2_end}). The gap between is unbookable.</p>
                )}
              </div>

              <ExclusionsManager salonId={salon?.id} />
              <HolidayManager salonId={salon?.id} />

              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.working_days.includes(day)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <TeamCalendarConfig salonId={salon?.id} />
            <StripeConnectButton salonId={salon?.id} stripeAccountId={salon?.stripe_connect_account_id} />
            <ProcessorFeeConfig salonId={salon?.id} />

            {/* Danger Zone */}
            <div className="bg-card border border-destructive/30 rounded-xl p-6">
              <h3 className="font-semibold text-destructive border-b border-destructive/20 pb-3 mb-4">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete Salon Completely</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently erase all salon data, staff, and settings.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDeleteStep(1)}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  Delete Salon
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
              {saving ? 'Saving...' : saved ? '✓ Saved!' : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal — Step 1 */}
      {deleteStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-foreground text-lg mb-2">Delete Your Salon?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete your salon? This will permanently erase all your settings, employees, and data.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteStep(0)} className="flex-1 border-border">
                Cancel
              </Button>
              <Button
                onClick={() => setDeleteStep(2)}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImageEditor && tempImageUrl && (
        <ImageEditor
          imageUrl={tempImageUrl}
          onSave={handleImageSave}
          onClose={() => {
            setShowImageEditor(false);
            setTempImageUrl(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal — Step 2: type DELETE */}
      {deleteStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-destructive text-lg mb-2">Final Confirmation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Type <span className="font-mono font-bold text-foreground">DELETE</span> to permanently remove your salon and all associated data.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE here"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive mb-4"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setDeleteStep(0); setDeleteInput(''); }}
                className="flex-1 border-border"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                disabled={deleteInput !== 'DELETE' || deleting}
                onClick={async () => {
                  if (!salon) return;
                  setDeleting(true);
                  try {
                    await base44.functions.invoke('deleteSalon', { salon_id: salon.id });
                    window.location.href = '/?deleted=1';
                  } catch (err) {
                    setDeleting(false);
                    alert('Error deleting salon: ' + err.message);
                  }
                }}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}