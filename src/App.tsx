// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";

import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { LocationsPage } from "./pages/LocationsPage";
import { LocationDetailPage } from "./pages/LocationDetailPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { AllSessionsPage} from "./pages/AllSessionsPage";
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

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/locations"
            element={
              <ProtectedRoute>
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/locations/:id"
            element={
              <ProtectedRoute>
                <LocationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/promotions"
            element={
              <ProtectedRoute>
                <PromotionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions"
            element={
                <ProtectedRoute>
                <AllSessionsPage />
              </ProtectedRoute>
            }
          />
            <Route path="/campaigns" element={<CampaignListPage />} />
        <Route
          path="/campaigns/:brandId/:campaignId"
          element={<CampaignDetailPage />}
        />
          
          
          <Route
            path="/units"
            element={
              <ProtectedRoute>
                <UnitsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/units/:id"
            element={
              <ProtectedRoute>
                <UnitDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}