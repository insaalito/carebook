import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Home from './pages/Home';
import Explore from './pages/Explore';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SalonPage from './pages/SalonPage';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import StaffJoin from './pages/StaffJoin';
import ServicesPage from './pages/ServicesPage';
import StaffPage from './pages/StaffPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import ClientProfile from './pages/ClientProfile';
import PaymentSuccess from './pages/PaymentSuccess';
import StripeConnectCallback from './pages/StripeConnectCallback';
import ProfileSetup from './pages/ProfileSetup';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/salon/:id" element={<SalonPage />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/staff-join" element={<StaffJoin />} />
      <Route path="/profile" element={<ClientProfile />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/stripe-connect-callback" element={<StripeConnectCallback />} />
      <Route path="/profile-setup" element={<ProfileSetup />} />

      {/* Owner dashboard (with Layout) */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;