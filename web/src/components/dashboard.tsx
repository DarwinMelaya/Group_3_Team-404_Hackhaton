"use client";

import Link from "next/link";
import { municipalities } from "../lib/demo";
import { usePortalAuth } from "../lib/portal-auth";
import { HarvestTable } from "./harvest-table";
import { Icon, type IconName } from "./icon";

function FieldIllustration() {
  return (
    <svg
      className="field-illustration"
      viewBox="0 0 400 280"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="292" cy="74" r="42" fill="#C3D187" opacity="0.92" />
      <path d="M0 228Q180 42 400 198V280H0Z" fill="#2D6320" />
      <path d="M0 250Q150 112 400 212V280H0Z" fill="#5D912F" />
      <path
        d="M75 280Q230 130 400 220M135 280Q250 158 400 238M210 280Q300 195 400 255M0 235Q115 190 200 222M0 255Q90 220 135 246"
        stroke="#C3D187"
        strokeWidth="6"
        strokeOpacity="0.72"
      />
      <path
        d="M208 195V90m0 50c-35 0-48-22-43-42 29 0 43 17 43 42Zm0-16c0-30 21-44 44-39-1 24-20 40-44 39Z"
        stroke="#C3D187"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M345 170v-40m0 15c-18 0-26-12-23-23 17 0 23 10 23 23Z"
        stroke="#94B54F"
        strokeWidth="4"
      />
      <circle cx="100" cy="75" r="4" fill="#94B54F" />
      <circle cx="142" cy="42" r="3" fill="#C3D187" />
    </svg>
  );
}

export function Dashboard() {
  const {
    activeDemoRole,
    demoHarvests,
    demoDemands,
    demoAllocations,
    demoAccounts,
  } = usePortalAuth();

  const totalSupplyKg = demoHarvests.reduce((sum, h) => sum + h.quantity, 0);
  const remainingSupplyKg = demoHarvests.reduce(
    (sum, h) => sum + h.remainingKg,
    0,
  );
  const totalAllocatedKg = demoHarvests.reduce(
    (sum, h) => sum + h.allocatedKg,
    0,
  );
  const totalDeliveredKg = demoHarvests.reduce(
    (sum, h) => sum + h.deliveredKg,
    0,
  );
  const totalDemandKg = demoDemands.reduce(
    (sum, d) => sum + d.requiredQuantityKg,
    0,
  );
  const remainingDemandKg = demoDemands.reduce(
    (sum, d) => sum + d.remainingDemandKg,
    0,
  );
  const verifiedMarketsCount = demoAccounts.filter(
    (a) => a.role === "market" && a.marketVerificationStatus === "verified",
  ).length;
  const totalMarketsCount = demoAccounts.filter(
    (a) => a.role === "market",
  ).length;

  const metrics: {
    label: string;
    value: string;
    foot: string;
    icon: IconName;
  }[] = [
    {
      label: "Remaining farmer supply",
      value: `${remainingSupplyKg.toLocaleString()} / ${totalSupplyKg.toLocaleString()} kg`,
      foot: `Across ${demoHarvests.length} harvest listings in 6 municipalities`,
      icon: "leaf",
    },
    {
      label: "Remaining market demand",
      value: `${remainingDemandKg.toLocaleString()} / ${totalDemandKg.toLocaleString()} kg`,
      foot: `Across ${demoDemands.length} active market crop requirements`,
      icon: "requests",
    },
    {
      label: "Offered & reserved",
      value: `${totalAllocatedKg.toLocaleString()} kg`,
      foot: `${demoAllocations.length} active supply allocations tracked`,
      icon: "layers",
    },
    {
      label: "Confirmed delivered",
      value: `${totalDeliveredKg.toLocaleString()} kg`,
      foot: `${verifiedMarketsCount} / ${totalMarketsCount} Markets verified by Admin`,
      icon: "pin",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            SMART-ANI · DEMAND-DRIVEN EXCHANGE ({activeDemoRole.toUpperCase()}{" "}
            VIEW)
          </p>
          <h1>Good things are growing.</h1>
          <p>
            Preventing post-harvest crop spoilage by connecting Farmers,
            verified Markets (Public Markets, Cooperatives, Food Processors,
            Retailers), and Admins across Marinduque.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button secondary" href="/supply-pooling">
            Allocate & Match <Icon name="layers" size={16} />
          </Link>
          <Link className="button" href="/harvest-exchange">
            Explore the exchange <Icon name="arrow" size={17} />
          </Link>
        </div>
      </div>

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="status-dot" /> SMART-ANI · FARMER · MARKET · ADMIN
          </span>
          <h2>
            Reduce post-harvest spoilage.
            <br />
            Match every harvest to real market demand.
          </h2>
          <p>
            A farmer with <strong>100 kg of Banana</strong> can split-allocate{" "}
            <strong>40 kg to Market 1</strong>,{" "}
            <strong>35 kg to Market 2</strong>, and{" "}
            <strong>25 kg to Market 3</strong> — while a Market needing{" "}
            <strong>100 kg</strong> can receive from multiple farmers with
            zero over-allocation or double-counting.
          </p>
          <div className="hero-actions">
            <Link href="/supply-pooling" className="button light">
              Split-allocate harvests <Icon name="arrow" size={18} />
            </Link>
            <Link href="/processor-requests" className="button ghost-light">
              Post / View Market Demands <Icon name="requests" size={17} />
            </Link>
          </div>
        </div>
        <FieldIllustration />
        <span className="hero-tag">
          MARINDUQUE · TEAM 404: SLEEP NOT FOUND
        </span>
      </section>

      <section aria-label="Demo overview" className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <div className="metric-label">
              {metric.label}
              <span className="metric-icon">
                <Icon name={metric.icon} size={18} />
              </span>
            </div>
            <strong>{metric.value}</strong>
            <span>{metric.foot}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">FARMER, MARKET & ADMIN VIEW</p>
              <h2>Harvest exchange preview</h2>
              <p className="muted">
                Real-time inventory tracking (Remaining vs. Total kg), Admin
                verification status, and advisory spoilage urgency.
              </p>
            </div>
            <Link href="/harvest-exchange" className="text-link">
              View all <Icon name="arrow" size={16} />
            </Link>
          </div>
          <HarvestTable compact />
        </section>

        <section className="panel regional-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MUNICIPAL SUPPLY & DEMAND ANALYTICS</p>
              <h2>Supply vs. Demand by municipality</h2>
              <p className="muted">
                Remaining harvest supply and open market demand across
                Marinduque’s 6 municipalities.
              </p>
            </div>
          </div>
          <div className="region-bars">
            {municipalities.map((place) => {
              const listingItems = demoHarvests.filter(
                (harvest) => harvest.municipality === place,
              );
              const supplyKg = listingItems.reduce(
                (sum, harvest) => sum + harvest.remainingKg,
                0,
              );
              const demandKg = demoDemands
                .filter((d) => d.municipality === place)
                .reduce((sum, d) => sum + d.remainingDemandKg, 0);
              const cropsLabel = listingItems.map((h) => h.crop).join(", ");
              return (
                <div key={place} className="region-bar-item">
                  <div className="bar-label">
                    <span>
                      <strong>{place}</strong>{" "}
                      <small>({cropsLabel || "No sample"})</small>
                    </span>
                    <strong>
                      {supplyKg} <small>kg supply</small> · {demandKg}{" "}
                      <small>kg demand</small>
                    </strong>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${Math.min((supplyKg / 460) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="panel-note">
            Remaining harvest = Total harvest − Allocated (Offered + Reserved) −
            Confirmed Delivered.
          </p>
        </section>
      </div>

      <section className="value-banner">
        <span className="value-icon">
          <Icon name="spark" size={26} />
        </span>
        <div>
          <p className="eyebrow">AI VALUE-ADD PROFIT SIMULATOR · ADVISORY</p>
          <h2>Compare raw farmgate selling vs. value-added processing.</h2>
          <p>
            Inspect transparent conversion formulas for Banana Chips, Uraro
            Flour, and Cassava Starch before committing raw surplus.
          </p>
        </div>
        <Link href="/ai-value-add" className="button secondary">
          Open simulator preview <Icon name="arrow" size={17} />
        </Link>
      </section>
    </>
  );
}
