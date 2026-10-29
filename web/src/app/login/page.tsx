import type { Metadata } from "next";
import { LoginClient } from "../../components/login-client";
import { Brand } from "../../components/shell";

export const metadata: Metadata = { title: "Login" };

export default function Login() {
  return (
    <main id="main-content" className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <p className="eyebrow">MARINDUQUE · AGRICULTURE & FOOD INNOVATION</p>
          <h1>
            Connecting smallholder harvests
            <br />
            to value-added production.
          </h1>
          <p>
            SMART-ANI: An AI-Powered B2B Post-Harvest Exchange and
            Value-Addition Platform in Marinduque. Coordinating farmers,
            barangay coordinators, and processors across all six municipalities.
          </p>
        </div>
        <span>SMART-ANI · Team 404: Sleep Not Found</span>
      </section>
      <section className="login-form">
        <LoginClient />
      </section>
    </main>
  );
}
