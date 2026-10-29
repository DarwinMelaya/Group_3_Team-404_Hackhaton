import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">SMART-ANI · 404</p>
      <h1>This path hasn’t been planted yet.</h1>
      <p>The page you requested could not be found in the SMART-ANI portal.</p>
      <Link className="button" href="/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
