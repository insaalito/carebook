import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MapPin, Scissors, Star, Clock, Search, ChevronRight, Menu, X as XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatAmPm } from '@/utils/timeFormat';

const categoryLabels = {
  barbershop: 'Barbershop',
  salon: 'Salon',
  beauty_studio: 'Beauty Studio',
  nail_salon: 'Nail Salon',
  spa: 'Spa',
};

export default function Explore() {
  const navigate = useNavigate();
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    base44.entities.Salon.filter({ is_active: true }).then(setSalons).finally(() => setLoading(false));
    base44.auth.isAuthenticated().then(setIsAuthenticated);
  }, []);

  const filtered = salons.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.city || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || s.category === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/6a00fd2cdf7102da68e71190/2491b7148_image-removebg-preview.png" alt="CareBook" className="w-6 h-6 object-contain" />
          <span className="font-bebas text-2xl tracking-widest text-primary">CareBook</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/explore" className="text-foreground transition-colors">Explore</Link>
          <button onClick={() => isAuthenticated ? navigate('/dashboard') : (window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`)} className="hover:text-foreground transition-colors">For Business</button>
          <button onClick={() => isAuthenticated ? navigate('/profile') : (window.location.href = '/login?next=/profile')} className="hover:text-foreground transition-colors">My Profile</button>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-foreground hover:text-primary transition-colors">
            {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {!isAuthenticated && (
            <button onClick={() => window.location.href = '/login'} className="hidden sm:inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-border text-foreground hover:bg-secondary h-9 px-4 py-2">
              Sign In
            </button>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-card border-b border-border">
          <div className="flex flex-col p-4 gap-4">
            <Link to="/explore" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-primary transition-colors py-2">Explore</Link>
            <button onClick={() => { setMobileMenuOpen(false); isAuthenticated ? navigate('/dashboard') : (window.location.href = `/login?next=/dashboard`); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">For Business</button>
            <button onClick={() => { setMobileMenuOpen(false); isAuthenticated ? navigate('/profile') : (window.location.href = '/login?next=/profile'); }} className="text-foreground hover:text-primary transition-colors py-2 text-left">My Profile</button>
            {!isAuthenticated && (
              <button onClick={() => { window.location.href = '/login'; setMobileMenuOpen(false); }} className="text-foreground hover:text-primary transition-colors py-2 text-left font-medium border-t border-border pt-4">Sign In</button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-10">
        <h1 className="font-bebas text-3xl md:text-5xl tracking-wider text-foreground mb-1 md:mb-2">DISCOVER SERVICES</h1>
        <p className="text-xs md:text-base text-muted-foreground mb-4 md:mb-6">Find and book the best service providers near you</p>

        {/* Search Bar */}
        <div className="flex-1 max-w-full relative mb-6 md:mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses, cities..."
            className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-sm"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-1 md:gap-2 flex-wrap mb-6 md:mb-8 overflow-x-auto">
          {['all', 'barbershop', 'salon', 'beauty_studio', 'nail_salon', 'spa'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 md:px-4 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium border transition-all flex-shrink-0 ${
                filter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All' : categoryLabels[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Scissors className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No establishments found</p>
            <p className="text-sm mt-2">Try a different search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {filtered.map(salon => (
              <Link key={salon.id} to={`/salon/${salon.id}`} className="group">
                <div className="bg-card border border-border rounded-lg md:rounded-xl overflow-hidden hover:border-primary/40 transition-all duration-300 hover:-translate-y-1">
                  <div className="h-32 md:h-44 bg-secondary relative overflow-hidden">
                    {salon.image_url ? (
                      <img src={salon.image_url} alt={salon.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Scissors className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-primary border border-primary/30 text-xs font-medium px-2 py-0.5 rounded-full">
                      {categoryLabels[salon.category] || 'Salon'}
                    </div>
                  </div>
                  <div className="p-2 md:p-4">
                    <div className="flex items-start justify-between mb-1 md:mb-2">
                      <h3 className="font-semibold text-xs md:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">{salon.name}</h3>
                      <div className="flex items-center gap-0.5 text-primary text-xs flex-shrink-0 ml-1">
                        <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-primary" />
                        <span className="text-xs">4.8</span>
                      </div>
                    </div>
                    {salon.city && (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2 md:mb-3">
                        <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        <span className="line-clamp-1">{salon.city}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                        <span className="text-xs line-clamp-1">{formatAmPm(salon.opening_time)} – {formatAmPm(salon.closing_time)}</span>
                      </div>
                      <span className="text-primary text-xs font-medium flex items-center gap-0.5 flex-shrink-0">
                        <span className="hidden sm:inline">Book</span> <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}