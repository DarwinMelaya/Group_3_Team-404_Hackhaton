import Link from "next/link";
import {
  harvests,
  money,
  requirements,
  valueAddScenarios,
} from "../lib/demo";
import { HarvestExchangePanel } from "./harvest-table";
import { Icon } from "./icon";

export const sections = {
  dashboard: { title: "Dashboard", description: "" },
  "harvest-exchange": {
    title: "Harvest Exchange",
    description:
      "Search and filter surplus crop listings across Marinduque, with illustrative coordinator verification and outreach priority indicators.",
  },
  "supply-pooling": {
    title: "Supply Pooling",
    description:
      "Aggregate smallholder harvests from the same municipality, crop, and storage condition to meet bulk processor requirements.",
  },
  "processor-requests": {
    title: "Processor Requests",
    description:
      "Review bulk raw-material demand from local food processors and cooperatives across Marinduque.",
  },
  "ai-value-add": {
    title: "AI Value-Add Analysis",
    description:
      "Compare illustrative raw selling revenue against value-added processing pathways using transparent conversion assumptions.",
  },
  transactions: {
    title: "Transactions",
    description:
      "Track batch reservations, coordinator sign-offs, and processor handoffs.",
  },
};

export type Section = keyof typeof sections;

export function SectionContent({
  section,
}: {
  section: Exclude<Section, "dashboard">;
}) {
  const info = sections[section];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMART-ANI · MARINDUQUE, PHILIPPINES</p>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
        </div>
        <span className="pill green">Phase 1 Demo Preview</span>
      </div>

      {section === "harvest-exchange" && (
        <>
          <div className="info-banner">
            <Icon name="leaf" />
            <p>
              <strong>Verification & Priority Guide:</strong>{" "}
              <em>Coordinator verified (demo)</em> indicates listings reviewed
              for municipal pooling in the proposed workflow, while{" "}
              <em>Priority outreach</em> is a farmer-selected preference for
              quicker buyer matching (not a food-safety or shelf-life guarantee).
            </p>
          </div>
          <HarvestExchangePanel />
        </>
      )}

      {section === "supply-pooling" && (
        <>
          <div className="info-banner">
            <Icon name="layers" />
            <p>
              <strong>Same-Municipality Supply Pooling (Illustrative):</strong>{" "}
              In SMART-ANI’s database rules, batches only pool listings that
              match in <strong>crop</strong>, <strong>municipality</strong>, and{" "}
              <strong>storage condition</strong>. No live stock is allocated or
              locked in this preview.
            </p>
          </div>
          <div className="cards-grid">
            {requirements.map((request) => {
              const matchingListings = harvests.filter(
                (harvest) =>
                  harvest.crop === request.crop &&
                  harvest.municipality === request.municipality,
              );
              const available = matchingListings.reduce(
                (sum, harvest) => sum + harvest.quantity,
                0,
              );
              const pct = Math.round(
                Math.min(available / request.quantity, 1) * 100,
              );
              return (
                <article className="panel opportunity-card" key={request.id}>
                  <div className="card-top-row">
                    <span className="pill green">SAME-MUNICIPALITY POOL</span>
                    <span className="eyebrow">{request.id}</span>
                  </div>
                  <h2>{request.crop}</h2>
                  <p>
                    <Icon name="pin" size={16} />{" "}
                    <strong>{request.municipality}</strong> · {request.storage}
                  </p>
                  <div className="coverage">
                    <strong>
                      {available.toLocaleString()}{" "}
                      <small>kg sample supply</small>
                    </strong>
                    <span>
                      of {request.quantity.toLocaleString()} kg target (
                      {pct}% coverage)
                    </span>
                  </div>
                  <div className="bar-track large">
                    <div
                      style={{
                        width: `${Math.min(available / request.quantity, 1) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="muted">
                    {Math.max(request.quantity - available, 0).toLocaleString()}{" "}
                    kg additional municipal supply needed to fill batch
                  </p>

                  <div className="card-divider" />

                  <div className="contributors-box">
                    <span className="contributors-title">
                      Matching sample listings ({matchingListings.length}):
                    </span>
                    {matchingListings.map((item) => (
                      <div className="contributor-row" key={item.id}>
                        <span>
                          {item.farmer} ({item.barangay})
                        </span>
                        <strong>{item.quantity} kg</strong>
                      </div>
                    ))}
                  </div>

                  <div className="card-divider" />
                  <p>
                    <strong>Target Buyer:</strong> {request.processor}
                  </p>
                  <span className="pill subtle">
                    Batch creation & farmer consent lock: Planned Phase 2
                  </span>
                </article>
              );
            })}
          </div>
        </>
      )}

      {section === "processor-requests" && (
        <>
          <div className="info-banner">
            <Icon name="requests" />
            <p>
              <strong>Illustrative Processor Demand:</strong> All processors
              shown below are sample demo identities for Marinduque. Live
              processor requirement posting and reservation locking are prepared
              in the Phase 2 Supabase schema.
            </p>
          </div>
          <div className="cards-grid">
            {requirements.map((request) => (
              <article className="panel opportunity-card" key={request.id}>
                <div className="card-top-row">
                  <span className="eyebrow">{request.id}</span>
                  <span className="pill amber">SAMPLE REQUIREMENT</span>
                </div>
                <h2>{request.crop}</h2>
                <p>
                  <strong>{request.processor}</strong>
                </p>
                <div className="coverage">
                  <strong>
                    {request.quantity.toLocaleString()}{" "}
                    <small>kg requested</small>
                  </strong>
                  <span>{request.window}</span>
                </div>
                <p>
                  <Icon name="pin" size={16} />
                  <strong>{request.municipality}</strong> · Preferred storage:{" "}
                  {request.storage}
                </p>
                <div className="card-divider" />
                <p className="muted">{request.note}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {section === "ai-value-add" && (
        <>
          <div className="info-banner">
            <Icon name="spark" />
            <p>
              <strong>Advisory Decision-Support Preview:</strong> All figures
              below are <strong>illustrative mathematical examples</strong>{" "}
              comparing raw farmgate selling against value-added processing. Live
              server-side AI analysis is not connected yet, and these estimates
              are <strong>not guaranteed profit</strong>.
            </p>
          </div>

          <section className="analysis-intro panel">
            <span className="value-icon">
              <Icon name="spark" size={30} />
            </span>
            <p className="eyebrow">
              TRANSPARENT VALUE-ADD PROFIT SIMULATOR · PLANNED AI ENGINE
            </p>
            <h2>
              Compare raw farmgate sales against
              <br />
              value-added processing pathways.
            </h2>
            <p>
              Before invoking an AI assistant in a later phase, SMART-ANI
              computes deterministic revenue and cost scenarios from explicit
              yield and cost assumptions.
            </p>
            <div className="formula-grid">
              <div>
                <span>01 / RAW FARMGATE SCENARIO</span>
                <h3>Estimated Raw Revenue</h3>
                <code>raw_revenue = quantity_kg × raw_price_per_kg</code>
              </div>
              <div>
                <span>02 / VALUE-ADDED PROCESSING SCENARIO</span>
                <h3>Estimated Net Value-Add Contribution</h3>
                <code>
                  net_value = (quantity_kg × yield_ratio × processed_price) −
                  raw_revenue − processing_cost
                </code>
              </div>
            </div>
            <p className="analysis-note">
              Actual outcomes depend on crop quality, conversion recovery, fuel
              and labor costs, packaging, and verified buyer demand.
            </p>
          </section>

          <div className="cards-grid product-ideas">
            {valueAddScenarios.map((scenario) => {
              const rawRevenue =
                scenario.sampleInputKg * scenario.rawPricePerKg;
              const outputKg = Math.round(
                scenario.sampleInputKg * scenario.illustrativeYieldRatio,
              );
              const grossProcessed =
                outputKg * scenario.illustrativeProductPricePerKg;
              const netAfterProcessingCost =
                grossProcessed - scenario.illustrativeProcessingCost;
              const illustrativeDiff = netAfterProcessingCost - rawRevenue;

              return (
                <article className="panel opportunity-card" key={scenario.id}>
                  <div className="card-top-row">
                    <span className="pill amber">ILLUSTRATIVE SIMULATION</span>
                    <span className="eyebrow">{scenario.crop}</span>
                  </div>
                  <h2>{scenario.product}</h2>
                  <p className="muted">
                    Sample input: <strong>{scenario.sampleInputKg} kg</strong>{" "}
                    raw {scenario.crop.toLowerCase()}
                  </p>

                  <div className="sim-breakdown">
                    <div className="sim-row">
                      <span>Raw selling ({money(scenario.rawPricePerKg)}/kg)</span>
                      <strong>{money(rawRevenue)}</strong>
                    </div>
                    <div className="sim-row">
                      <span>
                        Est. processed output (
                        {Math.round(scenario.illustrativeYieldRatio * 100)}%
                        yield)
                      </span>
                      <strong>{outputKg} kg</strong>
                    </div>
                    <div className="sim-row">
                      <span>
                        Gross processed value (
                        {money(scenario.illustrativeProductPricePerKg)}/kg)
                      </span>
                      <strong>{money(grossProcessed)}</strong>
                    </div>
                    <div className="sim-row">
                      <span>Illustrative processing cost</span>
                      <strong>− {money(scenario.illustrativeProcessingCost)}</strong>
                    </div>
                    <div className="sim-row highlight">
                      <span>Illustrative net vs. raw sale</span>
                      <strong>
                        {illustrativeDiff >= 0 ? "+" : ""}
                        {money(illustrativeDiff)}
                      </strong>
                    </div>
                  </div>

                  <p className="muted">
                    <strong>Required setup:</strong> {scenario.equipmentNote}
                  </p>
                  <span className="pill subtle">
                    Unverified sample assumptions · Not financial advice
                  </span>
                </article>
              );
            })}
          </div>
        </>
      )}

      {section === "transactions" && (
        <section className="panel empty-state transaction-empty">
          <span className="value-icon">
            <Icon name="swap" size={32} />
          </span>
          <span className="pill green">PLANNED · PHASE 2 VERIFIED HANDOFFS</span>
          <h2>Traceable B2B commitments from pool to processor.</h2>
          <p>
            Idempotent processor reservations, quantity-locked batch
            allocations, and coordinator handoff confirmations are prepared in
            the SMART-ANI database migration and will activate once live
            Supabase Agri integration is approved.
          </p>
          <Link href="/harvest-exchange" className="button">
            Explore harvest exchange <Icon name="arrow" size={18} />
          </Link>
        </section>
      )}
    </>
  );
}
