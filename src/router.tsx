import { createHashRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/vendiq/app-shell"
import PortfolioPage from "@/pages/portfolio"
import ContractExpirationPage from "@/pages/contract-expiration"
import VendorLookupPage from "@/pages/vendor-lookup"
import Vendor360Page from "@/pages/vendor-360"
import RiskDashboardPage from "@/pages/risk-dashboard"
import ReportsPage from "@/pages/reports"
import SettingsPage from "@/pages/settings"
import NotFoundPage from "@/pages/not-found"

// Hash routing keeps all app state in the URL fragment (e.g. #/vendors/123),
// which is robust against the Power Apps host that doesn't serve SPA fallback
// for non-root paths on refresh.
export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <PortfolioPage /> },
      { path: "portfolio", element: <Navigate to="/" replace /> },
      { path: "vendors", element: <VendorLookupPage /> },
      { path: "vendors/:vendorId", element: <Vendor360Page /> },
      { path: "contracts", element: <ContractExpirationPage /> },
      { path: "risk", element: <RiskDashboardPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])