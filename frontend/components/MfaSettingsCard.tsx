"use client";
import { useEffect, useState } from "react";
import { supabase, api } from "../lib/api";
import { MFA_T } from "../lib/mfa";
import { useLanguage } from "../contexts/LanguageContext";

type Enrollment = { factorId: string; qr: string; secret: string };

/** Paramètres → Sécurité : activer / désactiver la double authentification (TOTP). */
export default function MfaSettingsCard() {
  const { lang } = useLanguage();
  const s = MFA_T[lang as keyof typeof MFA_T] ?? MFA_T.fr;
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.totp ?? []).find((f) => f.status === "verified");
    setFactorId(verified?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setMsg(""); setBusy(true);
    try {
      // Un enrôlement abandonné laisse un facteur « unverified » qui bloquerait le suivant.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Klientys" });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolling) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.trim() });
    setBusy(false);
    if (error) { setMsg(s.invalidCode); return; }
    setEnrolling(null);
    setMsg(s.done);
    api.logActivity({ action: "Double authentification activée", detail: "TOTP" }).catch(() => {});
    refresh();
  };

  const disable = async () => {
    if (!factorId || !window.confirm(s.confirmDisable)) return;
    setBusy(true); setMsg("");
    // Supabase exige une session aal2 pour retirer un facteur vérifié.
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    api.logActivity({ action: "Double authentification désactivée", detail: "TOTP" }).catch(() => {});
    refresh();
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-700 text-sm">{s.title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${factorId ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {factorId ? s.enabled : s.disabled}
        </span>
      </div>
      <p className="text-sm text-gray-500">{s.intro}</p>

      {enrolling ? (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-gray-600">{s.scan}</p>
          {/* qr_code est une image SVG en data URI fournie par Supabase */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code" width={180} height={180} className="border rounded-lg" />
          <p className="text-xs text-gray-500">{s.secret} <code className="font-mono break-all">{enrolling.secret}</code></p>
          <label className="block text-sm font-medium">{s.code}</label>
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6}
            className="border rounded-lg px-3 py-2 w-40 text-sm tracking-widest font-mono"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-50">{s.verify}</button>
            <button type="button" onClick={() => setEnrolling(null)} className="px-4 py-2 rounded-lg border text-sm">{s.cancel}</button>
          </div>
        </form>
      ) : factorId ? (
        <button onClick={disable} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">{s.disable}</button>
      ) : (
        <button onClick={startEnroll} disabled={busy} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-50">{s.enable}</button>
      )}
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
