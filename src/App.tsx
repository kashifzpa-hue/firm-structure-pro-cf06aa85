import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Entities from "./pages/Entities";
import EntityForm from "./pages/EntityForm";
import EntityDetail from "./pages/EntityDetail";
import Documents from "./pages/Documents";
import Ownership from "./pages/Ownership";
import OrgChart from "./pages/OrgChart";
import Ledger from "./pages/Ledger";
import MovementDetail from "./pages/MovementDetail";
import UBORegistry from "./pages/UBORegistry";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import Notifications from "./pages/Notifications";
import SetupWorkspace from "./pages/SetupWorkspace";
import BankAccounts from "./pages/BankAccounts";
import BankAccountDetail from "./pages/BankAccountDetail";
import SignatoryRegister from "./pages/SignatoryRegister";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, workspaceId } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!workspaceId) return <Navigate to="/setup-workspace" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/setup-workspace" element={<SetupWorkspace />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/entities" element={<Entities />} />
              <Route path="/entities/new" element={<EntityForm />} />
              <Route path="/entities/:id" element={<EntityDetail />} />
              <Route path="/entities/:id/edit" element={<EntityForm />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/ownership" element={<Ownership />} />
              <Route path="/org-chart" element={<OrgChart />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/ledger/:id" element={<MovementDetail />} />
              <Route path="/ubo" element={<UBORegistry />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/bank-accounts" element={<BankAccounts />} />
              <Route path="/bank-accounts/:id" element={<BankAccountDetail />} />
              <Route path="/signatory-register" element={<SignatoryRegister />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
