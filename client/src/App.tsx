import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { ReactNode, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CustomerDashboard from "./pages/CustomerDashboard";
import ProfessionalDashboard from "./pages/ProfessionalDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Login from "@/pages/Login";

const APP_TITLE = "ChamaPro — serviços perto de você";

function DocumentTitle({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title;
    return () => { document.title = APP_TITLE; };
  }, [title]);
  return <>{children}</>;
}

function ProtectedRoute({ title, role, children }: { title: string; role?: "admin" | "user"; children: ReactNode }) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && role === "admin" && user.role !== "admin") setLocation("/cliente");
  }, [loading, role, setLocation, user]);

  return <DocumentTitle title={title}>
    {loading || !user || (role === "admin" && user.role !== "admin")
      ? <div className="grid min-h-screen place-items-center bg-[#f6f7fb]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
      : children}
  </DocumentTitle>;
}

function HomeRoute() { return <DocumentTitle title={APP_TITLE}><Home /></DocumentTitle>; }
function LoginRoute() { return <DocumentTitle title="Entrar | ChamaPro"><Login /></DocumentTitle>; }
function CustomerRoute() { return <ProtectedRoute title="Área do cliente | ChamaPro"><CustomerDashboard /></ProtectedRoute>; }
function ProfessionalRoute() { return <ProtectedRoute title="Painel profissional | ChamaPro"><ProfessionalDashboard /></ProtectedRoute>; }
function AdminRoute() { return <ProtectedRoute title="Painel administrativo | ChamaPro" role="admin"><AdminDashboard /></ProtectedRoute>; }

function Router() {
  return <Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/login" component={LoginRoute} />
    <Route path="/cliente" component={CustomerRoute} />
    <Route path="/profissional" component={ProfessionalRoute} />
    <Route path="/admin" component={AdminRoute} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
