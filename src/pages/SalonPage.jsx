import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MapPin, Clock, Scissors, ChevronLeft, Star, Phone } from 'lucide-react';
import { formatAmPm } from '@/utils/timeFormat';
import { Button } from '@/components/ui/button';
import BookingModal from '@/components/booking/BookingModal';

export default function SalonPage() {
  const { id } = useParams();
  const [salon, setSalon] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthenticated);
  }, []);

  useEffect(() => {
    Promise.all([
      base44.entities.Salon.filter({ id }),
      base44.entities.Staff.filter({ salon_id: id, is_active: true }),
      base44.entities.Service.filter({ salon_id: id, is_active: true }),
    ]).then(([salons, staffList, serviceList]) => {
      setSalon(salons[0]);
      setStaff(staffList);
      setServices(serviceList);
    }).finally(() => setLoading(false));

    // Real-time: staff activated/deactivated instantly updates the booking page
    const unsub = base44.entities.Staff.subscribe((ev) => {
      if (ev.data?.salon_id !== id) return;
      if (ev.type === 'update') {
        if (ev.data.is_active) {
          setStaff(prev => prev.find(s => s.id === ev.id) ? prev.map(s => s.id === ev.id ? ev.data : s) : [...prev, ev.data]);
        } else {
          setStaff(prev => prev.filter(s => s.id !== ev.id));
        }
      }
      if (ev.type === 'delete') setStaff(prev => prev.filter(s => s.id !== ev.id));
    });
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Salon not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center gap-4">
        <Link to="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <Link to="/" className="flex items-center gap-2">
           <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-5 h-5 object-contain" />
           <span className="font-bebas text-xl tracking-widest text-primary">CareBook</span>
         </Link>
      </header>

      {/* Hero */}
      <div className="relative h-72 md:h-96 bg-secondary overflow-hidden">
        {salon.image_url ? (
          <img src={salon.image_url} alt={salon.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Scissors className="w-20 h-20 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary/10 border border-primary/30 text-primary text-xs px-2 py-0.5 rounded-full capitalize">{salon.category}</span>
            <span className="flex items-center gap-1 text-primary text-sm">
              <Star className="w-3 h-3 fill-primary" /> 4.8
            </span>
          </div>
          <h1 className="font-bebas text-5xl text-foreground tracking-wider">{salon.name}</h1>
          {salon.city && (
            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
              <MapPin className="w-4 h-4" /> {salon.address || salon.city}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* About */}
            {salon.description && (
              <section>
                <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-3">ABOUT</h2>
                <p className="text-muted-foreground leading-relaxed">{salon.description}</p>
              </section>
            )}

            {/* Services */}
            <section>
              <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-4">SERVICES</h2>
              <div className="space-y-3">
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-4">
                    <div>
                      <p className="font-medium text-foreground">{svc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{svc.duration_minutes} min</p>
                    </div>
                    <span className="font-semibold text-primary">${svc.price}</span>
                  </div>
                ))}
                {services.length === 0 && (
                  <p className="text-muted-foreground text-sm">No services listed yet.</p>
                )}
              </div>
            </section>

            {/* Staff */}
            <section>
              <h2 className="font-bebas text-2xl tracking-wider text-foreground mb-4">MEET THE TEAM</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {staff.map(member => (
                  <div
                    key={member.id}
                    onClick={() => {
                      if (!isAuthenticated) {
                        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
                        return;
                      }
                      setSelectedStaff(member);
                      setBookingOpen(true);
                    }}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-bebas text-2xl text-primary">{member.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role_title}</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground text-xs flex-shrink-0">
                      Book
                    </Button>
                  </div>
                ))}
                {staff.length === 0 && (
                  <p className="text-muted-foreground text-sm">No staff listed yet.</p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Hours</h3>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                {formatAmPm(salon.opening_time)} – {formatAmPm(salon.closing_time)}
              </div>
              {salon.working_days?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {salon.working_days.map(d => (
                    <span key={d} className="text-xs bg-secondary border border-border px-2 py-0.5 rounded text-muted-foreground">{d}</span>
                  ))}
                </div>
              )}
            </div>
            {(salon.phone || staff.some(m => m.phone)) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-3">Contact</h3>
                {salon.phone && (
                  <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Business</p>
                      <a href={`tel:${salon.phone}`} className="text-sm text-foreground hover:text-primary transition-colors">{salon.phone}</a>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {staff.filter(m => m.phone).map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{m.name}</p>
                        <a href={`tel:${m.phone}`} className="text-sm text-foreground hover:text-primary transition-colors">{m.phone}</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(salon.google_maps_url || salon.address) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-3">Location</h3>
                {salon.address && (
                  <p className="text-muted-foreground text-sm mb-3">{salon.address}{salon.city ? `, ${salon.city}` : ''}</p>
                )}
                <a
                  href={salon.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((salon.address || '') + ' ' + (salon.city || '') + ' Puerto Rico')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary border border-primary/30 rounded-lg px-4 py-2.5 hover:bg-primary/10 transition-colors w-full justify-center font-medium"
                >
                  <MapPin className="w-4 h-4" />
                  View on Google Maps
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {bookingOpen && selectedStaff && (
        <BookingModal
          salon={salon}
          staffMember={selectedStaff}
          services={services}
          availableStaff={staff}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </div>
  );
}