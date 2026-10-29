import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "../components/shell";
import { PortalAuthProvider } from "../lib/portal-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default:
      "SMART-ANI | B2B Post-Harvest Exchange & Value-Addition Platform",
    template: "%s | SMART-ANI",
  },
  description:
    "SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and Value-Addition Platform in Marinduque. Built by Team 404: Sleep Not Found.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PortalAuthProvider>
          <Shell>{children}</Shell>
        </PortalAuthProvider>
      </body>
    </html>
  );
}
