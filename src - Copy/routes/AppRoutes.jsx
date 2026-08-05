import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

import UserManagement from '../pages/admin/UserManagement';

import AuthCallback from '../pages/auth/AuthCallback';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ResetPassword from '../pages/auth/ResetPassword';
import VerifyEmail from '../pages/auth/VerifyEmail';

import Dashboard from '../pages/dashboard/Dashboard';

import InternetPlans from '../pages/hotspot/InternetPlans';
import Vouchers from '../pages/hotspot/Vouchers';
import Customers from '../pages/hotspot/Customers';
import Orders from '../pages/hotspot/Orders';
import NetworkSites from '../pages/network/NetworkSites';
import Devices from '../pages/network/Devices';
import Sessions from '../pages/network/Sessions';
import Monitoring from '../pages/network/Monitoring';
import Reports from '../pages/reports/Reports';
import Analytics from '../pages/analytics/Analytics';
import Settings from '../pages/settings/Settings';

import BusinessSetup from '../pages/onboarding/BusinessSetup';

import BuyPlan from '../pages/portal/BuyPlan';
import PaymentCallback from '../pages/portal/PaymentCallback';

import LandingPage from '../pages/public/LandingPage';

import OnboardingGate from './OnboardingGate';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing and hotspot payment pages */}
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/buy-plan"
        element={<BuyPlan />}
      />

      <Route
        path="/payment/callback"
        element={<PaymentCallback />}
      />

      {/* Authentication pages for signed-out users */}
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/verify-email"
            element={<VerifyEmail />}
          />
        </Route>
      </Route>

      {/* Authentication callback pages */}
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />

      {/* Signed-in application */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/onboarding"
          element={
            <Navigate
              to="/onboarding/business"
              replace
            />
          }
        />

        <Route
          path="/onboarding/business"
          element={<BusinessSetup />}
        />

        <Route element={<OnboardingGate />}>
          <Route
            path="/dashboard"
            element={<DashboardLayout />}
          >
            <Route index element={<Dashboard />} />
            <Route
              path="hotspot/plans"
              element={<InternetPlans />}
            />

            <Route path="hotspot/vouchers" element={<Vouchers />} />

            <Route path="hotspot/customers" element={<Customers />} />

            <Route path="hotspot/orders" element={<Orders />} />

            <Route path="network/sites" element={<NetworkSites />} />

            <Route path="network/devices" element={<Devices />} />

            <Route path="network/sessions" element={<Sessions />} />

            <Route path="network/monitoring" element={<Monitoring />} />

            <Route path="analytics" element={<Analytics />} />

            <Route path="reports" element={<Reports />} />

            <Route
              path="users"
              element={<UserManagement />}
            />

            <Route path="settings" element={<Settings />} />

            <Route path="settings/profile" element={<BusinessSetup />} />

            <Route
              path="*"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />
          </Route>
        </Route>
      </Route>

      {/* Unknown application routes */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}

export default AppRoutes;