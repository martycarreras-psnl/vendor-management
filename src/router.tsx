import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/vendiq/app-shell"
import PortfolioPage from "@/pages/portfolio"
import ContractExpirationPage from "@/pages/contract-expiration"
import VendorLookupPage from "@/pages/vendor-lookup"
import Vendor360Page from "@/pages/vendor-360"
import RiskDashboardPage from "@/pages/risk-dashboard"
import ReportsPage from "@/pages/reports"
import SettingsPage from "@/pages/settings"
import NotFoundPage from "@/pages/not-found"

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
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
], {
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})