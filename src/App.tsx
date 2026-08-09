import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Route-level code splitting: heavy screens (PDF, spreadsheet, charts, flow
// diagrams, markdown/AI) are only downloaded when the route is visited.
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetupWorkspace = lazy(() => import("./pages/SetupWorkspace"));
const Demo = lazy(() => import("./pages/Demo"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Entities = lazy(() => import("./pages/Entities"));
const EntityForm = lazy(() => import("./pages/EntityForm"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const Documents = lazy(() => import("./pages/Documents"));
const Ownership = lazy(() => import("./pages/Ownership"));
const OrgChart = lazy(() => import("./pages/OrgChart"));
const Ledger = lazy(() => import("./pages/Ledger"));
const MovementDetail = lazy(() => import("./pages/MovementDetail"));
const UBORegistry = lazy(() => import("./pages/UBORegistry"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UserManual = lazy(() => import("./pages/UserManual"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Notifications = lazy(() => import("./pages/Notifications"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const BankAccountDetail = lazy(() => import("./pages/BankAccountDetail"));
const SignatoryRegister = lazy(() => import("./pages/SignatoryRegister"));
const DemoAdmin = lazy(() => import("./pages/DemoAdmin"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">Loading…</div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, workspaceId } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (!workspaceId) return <Navigate to="/setup-workspace" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userRole } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (userRole !== "admin") {
    toast("You don't have permission to perform this action. Contact your workspace admin.", { duration: 4000 });
    return <Navigate to="/entities" replace />;
  }
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/setup-workspace" element={<SetupWorkspace />} />
                <Route path="/demo" element={<Demo />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/entities" element={<Entities />} />
                  <Route path="/entities/new" element={<AdminRoute><EntityForm /></AdminRoute>} />
                  <Route path="/entities/:id" element={<EntityDetail />} />
                  <Route path="/entities/:id/edit" element={<AdminRoute><EntityForm /></AdminRoute>} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/ownership" element={<Ownership />} />
                  <Route path="/org-chart" element={<OrgChart />} />
                  <Route path="/ledger" element={<Ledger />} />
                  <Route path="/ledger/:id" element={<MovementDetail />} />
                  <Route path="/ubo" element={<UBORegistry />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/manual" element={<UserManual />} />
                  <Route path="/assistant" element={<Assistant />} />
                  <Route path="/assistant/:threadId" element={<Assistant />} />
                  <Route path="/bank-accounts" element={<BankAccounts />} />
                  <Route path="/bank-accounts/:id" element={<BankAccountDetail />} />
                  <Route path="/signatory-register" element={<SignatoryRegister />} />
                  <Route path="/demo-admin" element={<AdminRoute><DemoAdmin /></AdminRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
