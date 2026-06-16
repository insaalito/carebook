import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TeamCalendarConfig({ salonId }) {
  const [settings, setSettings] = useState(null);
  const [allowView, setAllowView] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    base44.entities.BusinessSettings.filter({ salon_id: salonId }).then(arr => {
      if (arr[0]) {
        setSettings(arr[0]);
        setAllowView(arr[0].allow_staff_view_team_calendar ?? false);
      }
    });
  }, [salonId]);

  const handleSave = async () => {
    setSaving(true);
    if (settings) {
      await base44.entities.BusinessSettings.update(settings.id, { allow_staff_view_team_calendar: allowView });
    } else {
      const created = await base44.entities.BusinessSettings.create({ salon_id: salonId, allow_staff_view_team_calendar: allowView });
      setSettings(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Team Calendar Settings</h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Allow Staff to View Team Calendars</p>
          <p className="text-xs text-muted-foreground mt-0.5">If enabled, staff members can see co-workers' schedules in their portal</p>
        </div>
        <button
          type="button"
          onClick={() => setAllowView(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            allowView ? 'bg-primary' : 'bg-secondary border border-border'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            allowView ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
        {saving ? 'Saving...' : saved ? '✓ Saved!' : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>}
      </Button>
    </div>
  );
}