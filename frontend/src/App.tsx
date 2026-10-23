import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarRouteSync } from "@/components/SidebarRouteSync";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ScreenSpecProvider } from "@/hooks/useScreenSpec";
import AuthPage from "@/pages/AuthPage";
import ScreenerBuilder from "@/pages/ScreenerBuilder";
import ScreenerHome from "@/pages/ScreenerHome";
import SettingsPage from "@/pages/SettingsPage";

function App() {
  return (
    <ErrorBoundary
      variant="page"
      fallbackLabel="Something went wrong loading the screener. Your filters weren't lost — try reloading."
      resetLabel="Reload page"
    >
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" storageKey="sgx-screener-theme">
          <ScreenSpecProvider>
            <SidebarProvider defaultOpen>
              <SidebarRouteSync />
              <Routes>
                <Route path="/" element={<Navigate to="/screener/home" replace />} />
                <Route path="/screener/home" element={<ScreenerHome />} />
                <Route path="/screener" element={<ScreenerBuilder />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/signup" element={<AuthPage mode="signup" />} />
                <Route path="*" element={<Navigate to="/screener/home" replace />} />
              </Routes>
              <Toaster />
            </SidebarProvider>
          </ScreenSpecProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
