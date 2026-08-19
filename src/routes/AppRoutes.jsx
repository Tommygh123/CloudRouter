import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

import UserManagement from '../pages/admin/UserManagement';

import AcceptInvite from '../pages/auth/AcceptInvite';
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
import WifiOnboarding from '../pages/network/WifiOnboarding';
import Sessions from '../pages/network/Sessions';
import Monitoring from '../pages/network/Monitoring';

import Reports from '../pages/reports/Reports';
import Analytics from '../pages/analytics/Analytics';

import Settings from '../pages/settings/Settings';
import BusinessBranding from '../pages/settings/BusinessBranding';
import CaptivePortalSettings from '../pages/settings/CaptivePortalSettings';
import PaymentSettings from '../pages/settings/PaymentSettings';
import VoucherSettings from '../pages/settings/VoucherSettings';
import AccountSettings from '../pages/settings/AccountSettings';

import BusinessSetup from '../pages/onboarding/BusinessSetup';
import GetStarted from '../pages/onboarding/GetStarted';

import BuyPlan from '../pages/portal/BuyPlan';
import PaymentCallback from '../pages/portal/PaymentCallback';
import MyInternet from '../pages/portal/MyInternet';

import LandingPage from '../pages/public/LandingPage';

import OnboardingGate from './OnboardingGate';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';
import RoleRoute from './RoleRoute';

function AppRoutes() {
  return (
    <Routes>
      {/* =====================================================
          PUBLIC PAGES
      ====================================================== */}

      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/buy-plan"
        element={<BuyPlan />}
      />

      <Route
        path="/payment/callback"
        element={<PaymentCallback />}
      />

      <Route
        path="/my-internet"
        element={<MyInternet />}
      />

      {/* Invitation acceptance must remain public */}
      <Route
        path="/accept-invite"
        element={<AcceptInvite />}
      />

      {/* =====================================================
          AUTHENTICATION PAGES
      ====================================================== */}

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

      {/* Auth callback/reset pages should remain public */}
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />

      {/* =====================================================
          PROTECTED APPLICATION
      ====================================================== */}

      <Route element={<ProtectedRoute />}>
        {/* Onboarding root */}
        <Route
          path="/onboarding"
          element={
            <Navigate
              to="/onboarding/business"
              replace
            />
          }
        />

        {/* Business onboarding */}
        <Route
          path="/onboarding/business"
          element={<BusinessSetup />}
        />

        {/* Tenant must be fully onboarded from here */}
        <Route element={<OnboardingGate />}>
          <Route
            path="/dashboard"
            element={<DashboardLayout />}
          >
            {/* Dashboard home */}
            <Route
              index
              element={<Dashboard />}
            />

            {/* Getting started */}
            <Route
              path="get-started"
              element={<RoleRoute permission="get_started"><GetStarted /></RoleRoute>}
            />

            {/* Hotspot management */}
            <Route
              path="hotspot/plans"
              element={<RoleRoute permission="plans"><InternetPlans /></RoleRoute>}
            />

            <Route
              path="hotspot/vouchers"
              element={<RoleRoute permission="vouchers"><Vouchers /></RoleRoute>}
            />

            <Route
              path="hotspot/customers"
              element={<RoleRoute permission="customers"><Customers /></RoleRoute>}
            />

            <Route
              path="hotspot/orders"
              element={<RoleRoute permission="orders"><Orders /></RoleRoute>}
            />

            {/* Network management */}
            <Route
              path="network/sites"
              element={<RoleRoute permission="sites"><NetworkSites /></RoleRoute>}
            />

            <Route
              path="network/devices"
              element={<RoleRoute permission="devices"><Devices /></RoleRoute>}
            />

            <Route
              path="network/wifi-onboarding"
              element={<RoleRoute permission="sites"><WifiOnboarding /></RoleRoute>}
            />

            <Route
              path="network/sessions"
              element={<RoleRoute permission="sessions"><Sessions /></RoleRoute>}
            />

            <Route
              path="network/monitoring"
              element={<RoleRoute permission="monitoring"><Monitoring /></RoleRoute>}
            />

            {/* Analytics / reports */}
            <Route
              path="analytics"
              element={<RoleRoute permission="analytics"><Analytics /></RoleRoute>}
            />

            <Route
              path="reports"
              element={<RoleRoute permission="reports"><Reports /></RoleRoute>}
            />

            {/* User management */}
            <Route
              path="users"
              element={<RoleRoute permission="users"><UserManagement /></RoleRoute>}
            />

            {/* Settings */}
            <Route
              path="settings"
              element={<RoleRoute permission="settings"><Settings /></RoleRoute>}
            />

            <Route
              path="settings/profile"
              element={<RoleRoute permission="settings"><BusinessBranding /></RoleRoute>}
            />

            <Route
              path="settings/captive-portal"
              element={<RoleRoute permission="settings"><CaptivePortalSettings /></RoleRoute>}
            />

            <Route
              path="settings/payments"
              element={<RoleRoute permission="settings"><PaymentSettings /></RoleRoute>}
            />

            <Route
              path="settings/vouchers"
              element={<RoleRoute permission="settings"><VoucherSettings /></RoleRoute>}
            />

            <Route
              path="settings/account"
              element={<RoleRoute permission="settings"><AccountSettings /></RoleRoute>}
            />

            {/* Unknown dashboard route */}
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

      {/* =====================================================
          FALLBACK
      ====================================================== */}

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