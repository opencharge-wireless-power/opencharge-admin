// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";

import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { LocationsPage } from "./pages/LocationsPage";
import { LocationDetailPage } from "./pages/LocationDetailPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { AllSessionsPage } from "./pages/AllSessionsPage";
import { CampaignListPage } from "./pages/CampaignListPage";
import { CampaignDetailPage } from "./pages/CampaignDetailPage";
import { UnitsListPage } from "./pages/UnitsListPage";
import { UnitDetailPage } from "./pages/UnitDetailPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected & wrapped in MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Outlet />
                </MainLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="locations/:id" element={<LocationDetailPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="sessions" element={<AllSessionsPage />} />
            <Route path="campaigns" element={<CampaignListPage />} />
            <Route
              path="campaigns/:brandId/:campaignId"
              element={<CampaignDetailPage />}
            />
            <Route path="units" element={<UnitsListPage />} />
            <Route path="units/:id" element={<UnitDetailPage />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
