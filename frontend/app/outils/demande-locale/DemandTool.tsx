"use client";
import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SECTORS = [
  { value: "trade",      label: "Artisanat, bâtiment" },
  { value: "beauty",     label: "Beauté, bien-être" },
  { value: "restaurant", label: "Restauration" },
  { value: "commerce",   label: "Commerce" },
  { value: "health",     label: "Santé" },
  { value: "coaching",   label: "Coaching, sport" },
  { value: "finance",    label: "Comptabilité, finance" },
  { value: "other",      label: "Autre service" },
];

const COUNTRIES = [
  { value: "FR", label: "France" },
  { value: "BE", label: "Belgique" },
  { value: "CH", label: "Suisse" },
  { value: "LU", label: "Luxembourg" },
  { value: "CA", label: "Canada" },
];

type Result = {
  activity: string;
  city: string;
  country: string;
  keywords: string[];
  aggregate_score: number;
  city_score: number | null;
  interest_over_time: { date: string; value: number }[];
  related_queries?: string[];
  related_count?: number;
  trend_pct: number | null;
};

const card: React.CSSProperties = {
  background: "rgba(7,26,38,.88)", border: "1px solid rgba(170,189,216,.12)", borderRadius: "18px", padding: "28px 24px",
};

function level(score: number) {
  if (score >= 67) return { label: "Demande forte", color: "#4ACA7A" };
  if (score >= 34) return { label: "Demande moyenne", color: "var(--l-gold)" };
  return { label: "Demande faible", color: "#F28B82" };
}

function Trend({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = 100 / (points.length - 1);
  const line = points.map((p, i) => `${(i * step).toFixed(2)},${(38 - (p.value / max) * 34).toFixed(2)}`).join(" ");
  const first = new Date(points[0].date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  const last = new Date(points[points.length - 1].date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return (
    <figure style={{ margin: "20px 0 0" }}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: "88px", display: "block" }}
        role="img" aria-label={`Évolution de la demande de ${first} à ${last}`}>
        <polygon points={`0,40 ${line} 100,40`} fill="rgba(42,143,165,.14)" />
        <polyline points={line} fill="none" stroke="var(--l-teal-xl)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--l-text-3)", marginTop: "6px" }}>
        <span>{first}</span><span>Recherches Google, 12 mois</span><span>{last}</span>
      </figcaption>
    </figure>
  );
}

export default function DemandTool() {
  const [form, setForm] = useState({ sector: "trade", activity: "", city: "", country: "FR" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [lead, setLead] = useState({ email: "", first_name: "", marketing_consent: false, website: "" });
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const analyse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true); setResult(null); setReportSent(false);
    try {
      const res = await fetch(`${API}/api/v1/growth/demand-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Analyse impossible pour le moment.");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Analyse impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const requestReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSending(true);
    try {
      const res = await fetch(`${API}/api/v1/growth/demand-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...lead }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.detail) ? "Adresse email invalide." : data.detail;
        throw new Error(detail || "Envoi impossible pour le moment.");
      }
      if (data && data.related_queries) setResult(data);
      setReportSent(true);
    } catch (err: any) {
      setError(err.message || "Envoi impossible pour le moment.");
    } finally {
      setSending(false);
    }
  };

  const lvl = result ? level(result.aggregate_score) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <form onSubmit={analyse} style={{ ...card, display: "grid", gap: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <div>
            <label className="d-label" htmlFor="dl-sector">Secteur</label>
            <select id="dl-sector" className="d-select" value={form.sector} onChange={(e) => set("sector", e.target.value)}>
              {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="d-label" htmlFor="dl-activity">Votre métier <span style={{ fontWeight: 400 }}>(conseillé)</span></label>
            <input id="dl-activity" className="d-input" placeholder="Ex : plombier, coiffeur, ostéopathe" maxLength={60}
              value={form.activity} onChange={(e) => set("activity", e.target.value)} />
          </div>
          <div>
            <label className="d-label" htmlFor="dl-city">Ville</label>
            <input id="dl-city" className="d-input" placeholder="Ex : Marseille" required minLength={2} maxLength={80}
              value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className="d-label" htmlFor="dl-country">Pays</label>
            <select id="dl-country" className="d-select" value={form.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="l-btn l-btn-primary" style={{ justifyContent: "center", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Analyse en cours… (jusqu'à 30 s)" : "Mesurer la demande"}
        </button>
        {error && !result && (
          <p role="alert" style={{ margin: 0, fontSize: "13px", color: "#FC8181" }}>{error}</p>
        )}
      </form>

      {result && lvl && (
        <div style={card} aria-live="polite">
          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
            {result.activity} · {result.city}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif", fontSize: "56px", fontWeight: 800, color: lvl.color, lineHeight: 1 }}>
              {result.aggregate_score}
            </span>
            <span style={{ fontSize: "16px", color: "var(--l-text-2)" }}>/100</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: lvl.color }}>{lvl.label}</span>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "14px", color: "var(--l-text-2)", lineHeight: 1.6 }}>
            {result.city_score !== null
              ? <>À <strong style={{ color: "var(--l-text)" }}>{result.city}</strong>, l&apos;indice local est de <strong style={{ color: "var(--l-text)" }}>{result.city_score}/100</strong>.</>
              : <>Google ne publie pas assez de données pour {result.city} seule : l&apos;indice ci-dessus est celui du pays.</>}
            {result.trend_pct !== null && result.trend_pct !== 0 && (
              <> Sur les 3 derniers mois, la demande est <strong style={{ color: "var(--l-text)" }}>
                {result.trend_pct > 0 ? "en hausse" : "en baisse"} ({result.trend_pct > 0 ? "+" : ""}{result.trend_pct} %)
              </strong> par rapport à la moyenne de l&apos;année.</>
            )}
          </p>
          <Trend points={result.interest_over_time} />
          {result.keywords.length > 0 && (
            <p style={{ margin: "14px 0 0", fontSize: "12px", color: "var(--l-text-3)" }}>
              Recherche analysée : « {result.keywords[0]} ». Indice relatif Google Trends : 100 correspond au pic de la période, ce n&apos;est pas un nombre de personnes.
            </p>
          )}
        </div>
      )}

      {result && !reportSent && (
        <form onSubmit={requestReport} style={{ ...card, display: "grid", gap: "12px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700 }}>Recevoir le rapport complet</h2>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--l-text-2)", lineHeight: 1.6 }}>
              {result.related_count ? `Les ${result.related_count} recherches que tapent vos futurs clients, ` : "Les recherches de vos futurs clients, "}
              et trois actions concrètes pour capter cette demande. Envoyé par email.
            </p>
          </div>
          <div style={{ position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={lead.website}
              onChange={(e) => setLead((l) => ({ ...l, website: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <input className="d-input" placeholder="Prénom (facultatif)" maxLength={60} aria-label="Prénom"
              value={lead.first_name} onChange={(e) => setLead((l) => ({ ...l, first_name: e.target.value }))} />
            <input className="d-input" type="email" required placeholder="Votre email" aria-label="Email"
              value={lead.email} onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))} />
          </div>
          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", color: "var(--l-text-2)", lineHeight: 1.5, cursor: "pointer" }}>
            <input type="checkbox" checked={lead.marketing_consent} style={{ marginTop: "3px" }}
              onChange={(e) => setLead((l) => ({ ...l, marketing_consent: e.target.checked }))} />
            J&apos;accepte que Klientys me recontacte par email au sujet de mon site et de ma visibilité (désinscription en un clic).
          </label>
          <button type="submit" disabled={sending} className="l-btn l-btn-primary" style={{ justifyContent: "center", opacity: sending ? 0.6 : 1 }}>
            {sending ? "Envoi…" : "Recevoir le rapport"}
          </button>
          {error && <p role="alert" style={{ margin: 0, fontSize: "13px", color: "#FC8181" }}>{error}</p>}
          <p style={{ margin: 0, fontSize: "12px", color: "var(--l-text-3)", lineHeight: 1.5 }}>
            Votre email sert à vous envoyer ce rapport. Sans la case cochée, nous ne vous écrirons pas d&apos;autre message.{" "}
            <Link href="/legal/privacy" style={{ color: "var(--l-teal-xl)" }}>Politique de confidentialité</Link>
          </p>
        </form>
      )}

      {reportSent && result && (
        <div style={card}>
          <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>✓ Rapport envoyé à {lead.email}</h2>
          {result.related_queries && result.related_queries.length > 0 && (
            <>
              <p style={{ margin: "16px 0 8px", fontSize: "12px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
                Ce que tapent vos futurs clients
              </p>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", lineHeight: 1.8 }}>
                {result.related_queries.map((q) => <li key={q}>« {q} »</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ ...card, background: "linear-gradient(135deg, rgba(13,75,88,.55), rgba(7,26,38,.9))", textAlign: "center" }}>
          <p style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700 }}>Captez cette demande avec votre propre site</p>
          <p style={{ margin: "0 0 18px", fontSize: "14px", color: "var(--l-text-2)", lineHeight: 1.6 }}>
            Site, réservation en ligne et suivi des clients, prêts en 15 minutes. 14 jours gratuits, sans carte bancaire.
          </p>
          <Link href="/onboarding" className="l-btn l-btn-primary">Créer mon site gratuitement</Link>
        </div>
      )}
    </div>
  );
}
