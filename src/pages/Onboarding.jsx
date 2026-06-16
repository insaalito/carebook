import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, ChevronRight, Check, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ImageEditor from '@/components/ImageEditor';

const CATEGORIES = ['barbershop', 'salon', 'beauty_studio', 'nail_salon', 'spa'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [blockError, setBlockError] = useState(null);

  // Guard: redirect owners and block staff on mount
  useEffect(() => {
    if (!user) return;
    if (user.LinkedBusinessID) {
      setBlockError('Staff members cannot create a new business. You are currently linked to an existing salon.');
      return;
    }
    if (user.role === 'admin' || user.BusinessID) {
      navigate('/dashboard', { replace: true });
    }
  }, [user]);

  const [form, setForm] = useState({
    name: '', category: 'barbershop', description: '', city: '',
    address: '', phone: '', image_url: '', opening_time: '09:00',
    closing_time: '18:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  });
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

  const handleSubmit = async () => {
    // Double-check: block if already an owner or already has a linked business
    if (user?.role === 'admin' || user?.BusinessID) {
      alert('You already possess an active business profile.');
      navigate('/dashboard', { replace: true });
      return;
    }
    if (user?.LinkedBusinessID) {
      setBlockError('Staff members cannot create a new business.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const salon = await base44.entities.Salon.create({
      ...form,
      owner_email: user?.email || '',
      is_active: true,
    });
    // Promote user to Owner role and stamp BusinessID via service role
    try {
      await base44.functions.invoke('promoteToOwner', { salon_id: salon.id });
    } catch (error) {
      setSubmitError('Error finalizing your account. Please contact support.');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    // Hard redirect so AuthContext re-fetches the updated user record
    window.location.href = '/dashboard';
  };

  const steps = ['Business Info', 'Location', 'Hours', 'Done'];

  // Show block error for staff members
  if (blockError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card border border-destructive/40 rounded-2xl p-8 w-full max-w-md text-center">
          <p className="text-destructive font-semibold mb-2">Access Restricted</p>
          <p className="text-muted-foreground text-sm mb-6">{blockError}</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-primary text-primary-foreground">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 mb-10">
         <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-7 h-7 object-contain" />
         <span className="font-bebas text-3xl tracking-widest text-primary">CareBook</span>
       </Link>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step > i + 1 ? 'bg-primary text-primary-foreground' :
              step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}>
              {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${step === i + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${step > i + 1 ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-lg">
        {submitError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/40 rounded-lg p-4">
            <p className="text-destructive text-sm font-medium">{submitError}</p>
          </div>
        )}
        {step === 1 && (
          <div>
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-1">YOUR BUSINESS</h2>
            <p className="text-muted-foreground text-sm mb-6">Tell customers about your shop</p>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Shop Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" placeholder="e.g. Kings Barbershop" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Type *</Label>
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
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border text-foreground mt-1 h-24 resize-none" placeholder="Tell customers what makes your shop special..." />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Cover Photo (optional)</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                      id="cover-photo-input"
                    />
                    <label
                      htmlFor="cover-photo-input"
                      className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{uploadingImage ? 'Uploading...' : 'Choose Photo'}</span>
                    </label>
                  </div>
                </div>
                {form.image_url && (
                  <div className="mt-3 relative w-full h-32 bg-secondary rounded-lg overflow-hidden">
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                      className="absolute top-1 right-1 bg-destructive/90 text-white rounded p-1 hover:bg-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={() => setStep(2)} disabled={!form.name} className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
              Continue <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-1">LOCATION</h2>
            <p className="text-muted-foreground text-sm mb-6">Where can customers find you?</p>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">City *</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" placeholder="e.g. New York" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" placeholder="123 Main St" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" placeholder="+1 555 000 0000" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-foreground">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!form.city} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">Continue <ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-bebas text-3xl tracking-wider text-foreground mb-1">HOURS</h2>
            <p className="text-muted-foreground text-sm mb-6">When are you open for business?</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Opening Time</Label>
                  <Input type="time" value={form.opening_time} onChange={e => setForm(f => ({ ...f, opening_time: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Closing Time</Label>
                  <Input type="time" value={form.closing_time} onChange={e => setForm(f => ({ ...f, closing_time: e.target.value }))} className="bg-secondary border-border text-foreground mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
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
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep(2)} className="border-border text-foreground">Back</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                {submitting ? 'Creating...' : 'Create My Listing'} <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}