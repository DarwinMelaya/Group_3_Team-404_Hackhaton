import type { Metadata } from "next";
import { AdminLoginClient } from "../../../components/admin-login-client";
import { Brand } from "../../../components/shell";

export const metadata: Metadata = {
  title: "Admin Login · SMART-ANI Municipal Management",
  description:
    "Provincial Administrator portal for harvest verification, market buyer approval, and fraud prevention in Marinduque.",
};

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <p className="eyebrow">MARINDUQUE · MUNICIPAL AGRICULTURAL AUTHORITY</p>
          <h1>
            Administrative Oversight,
            <br />
            Verification &amp; Fraud Prevention.
          </h1>
          <p>
            SMART-ANI Municipal Portal for designated provincial agricultural officers.
            Inspect and verify incoming farmer harvests, approve commercial Market accounts,
            and audit multi-market allocations with zero double-counting.
          </p>
        </div>
        <span>SMART-ANI · Team 404: Sleep Not Found · Authorized Admins Only</span>
      </section>
      <section className="login-form">
        <AdminLoginClient />
      </section>
    </main>
  );
}

