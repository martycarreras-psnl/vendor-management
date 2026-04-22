import { createHashRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/vendiq/app-shell"
import PortfolioPage from "@/pages/portfolio"
import ContractExpirationPage from "@/pages/contract-expiration"
import ContractDetailsPage from "@/pages/contract-details"
import VendorLookupPage from "@/pages/vendor-lookup"
import Vendor360Page from "@/pages/vendor-360"
import SupplierLookupPage from "@/pages/supplier-lookup"
import Supplier360Page from "@/pages/supplier-360"
import RiskDashboardPage from "@/pages/risk-dashboard"
import ReviewsPage from "@/pages/reviews"
import VendorScoreWizardPage from "@/pages/vendor-score-wizard"
import ChatPage from "@/pages/chat"
import PromptSuggestionsPage from "@/pages/prompt-suggestions"
import SettingsPage from "@/pages/settings"
import NotFoundPage from "@/pages/not-found"
import ErrorBoundaryPage from "@/pages/error-boundary"

// Hash routing keeps all app state in the URL fragment (e.g. #/vendors/123),
// which is robust against the Power Apps host that doesn't serve SPA fallback
// for non-root paths on refresh.
export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorBoundaryPage />,
    children: [
      { index: true, element: <PortfolioPage /> },
      { path: "portfolio", element: <Navigate to="/" replace /> },
      { path: "vendors", element: <VendorLookupPage /> },
      { path: "vendors/:vendorId", element: <Vendor360Page /> },
      { path: "suppliers", element: <SupplierLookupPage /> },
      { path: "suppliers/:supplierId", element: <Supplier360Page /> },
      { path: "contracts", element: <ContractExpirationPage /> },
      { path: "contracts/:contractId", element: <ContractDetailsPage /> },
      { path: "risk", element: <RiskDashboardPage /> },
      { path: "reviews", element: <ReviewsPage /> },
      { path: "reviews/:assignmentId/score", element: <VendorScoreWizardPage /> },
      { path: "chat", element: <ChatPage /> },
      { path: "prompt-suggestions", element: <PromptSuggestionsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])