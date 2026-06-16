import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Clock, Shield, ChevronRight, MapPin, X, Scissors, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const features = [
  { icon: Clock, title: 'Real-Time Booking', desc: 'Instant confirmations with live availability' },
  { icon: Star, title: 'Top-Rated Pros', desc: 'Vetted barbers and stylists only' },
  { icon: Shield, title: 'No Surprises', desc: 'Upfront pricing, transparent services' },
  { icon: MapPin, title: 'Local Discovery', desc: 'Find the best shops near you' },
];

export default function Home() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState('none'); // 'owner' | 'staff' | 'none'
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const salonDeleted = params.get('deleted') === '1';

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      setIsAuthenticated(authed);
      if (!authed) return;
      const user = await base44.auth.me();
      const [salons, staffRecords] = await Promise.all([
        base44.entities.Salon.filter({ owner_email: user.email }),
        base44.entities.Staff.filter({ user_email: user.email }),
      ]);
      if (salons.length > 0) setUserType('owner');
      else if (staffRecords.length > 0) setUserType('staff');
    });
  }, []);

  const requireAuth = (next) => {
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  };

  const handleForBusiness = () => {
    if (!isAuthenticated) {
      requireAuth(window.location.pathname);
      return;
    }
    if (userType === 'owner' || userType === 'staff') {
      navigate('/dashboard');
    } else {
      setShowBusinessModal(true);
    }
  };

  const handleMyProfile = () => {
    if (!isAuthenticated) {
      requireAuth('/profile');
      return;
    }
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <Link to="/" className="flex items-center gap-2 py-2 px-3 -my-2 -mx-3">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-6 h-6 object-contain" />
          <span className="font-bebas text-2xl tracking-widest text-primary">CareBook</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground transition-colors">Explore</Link>
          <button onClick={handleForBusiness} className="hover:text-foreground transition-colors">For Business</button>
          <button onClick={handleMyProfile} className="hover:text-foreground transition-colors">My Profile</button>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-foreground hover:text-primary transition-colors" aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {!isAuthenticated && (
            <button onClick={() => window.location.href = '/login'} className="hidden sm:inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground border-border text-foreground hover:bg-secondary h-9 px-4 py-2">
              Sign In
            </button>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-card border-b border-border">
          <div className="flex flex-col p-4 gap-4">
            <Link to="/explore" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-primary transition-colors py-2">
              Explore
            </Link>
            <button onClick={() => { handleForBusiness(); setMobileMenuOpen(false); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">
              For Business
            </button>
            <button onClick={() => { handleMyProfile(); setMobileMenuOpen(false); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">
              My Profile
            </button>
            {!isAuthenticated && (
              <button onClick={() => { window.location.href = '/login'; setMobileMenuOpen(false); }} className="text-foreground hover:text-primary transition-colors py-2 text-left font-medium border-t border-border pt-4">
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      {/* Salon deleted banner */}
      {salonDeleted && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500/10 border border-green-500/40 text-green-400 text-sm px-6 py-3 rounded-xl shadow-lg backdrop-blur-sm flex items-center gap-3">
          <span className="text-green-400">✓</span>
          Your salon has been successfully deleted.
        </div>
      )}

      {/* Hero */}
      <section className={`relative ${mobileMenuOpen ? 'pt-64' : 'pt-32'} pb-20 px-6 md:px-12 flex flex-col items-center text-center min-h-screen justify-center overflow-hidden transition-all`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            The Premium Booking Marketplace
          </div>

          <h1 className="font-bebas text-7xl md:text-9xl tracking-wider text-foreground leading-none mb-6">
            YOUR SELF-CARE
            <span className="block text-primary">HUB</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Your ultimate destination for booking personal care services, tailored to your needs.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/explore">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 h-14 text-base font-semibold">
                Find a Service
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 md:px-12 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bebas text-5xl text-center text-foreground tracking-wider mb-4">WHY CAREBOOK</h2>
          <p className="text-center text-muted-foreground mb-16">Built for modern service providers. Designed for modern clients.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-secondary/50 border border-border rounded-xl p-6 hover:border-primary/40 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-4 h-4 object-contain" />
          <span className="font-bebas text-lg tracking-widest text-primary">CareBook</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 CareBook. All rights reserved.</p>
      </footer>

      {/* Business Modal for non-owners/non-staff */}
      {showBusinessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-8 relative">
            <button
              onClick={() => setShowBusinessModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mb-6 mx-auto">
              <Scissors className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-bebas text-4xl tracking-wider text-center text-foreground mb-2">OWN A BUSINESS?</h2>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Get your own booking page, manage your staff, track revenue, and eliminate no-shows — all in one place.
            </p>
            <Link to="/onboarding" onClick={() => setShowBusinessModal(false)}>
              <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold">
                List Your Business
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}