"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, supabase } from "../../lib/api";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{ email: string; role: string; tenant_name: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", admin: "Admin", member: "Membre" };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien d'invitation invalide.");
      return;
    }
    api.getInvite(token)
      .then((data) => { setInvite(data); setStatus("ready"); })
      .catch((e: any) => { setStatus("error"); setMessage(e.message || "Invitation invalide ou expirée."); });
  }, [token]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`);
        return;
      }
      await api.acceptInvite(token);
      await supabase.auth.refreshSession();
      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Impossible d'accepter l'invitation.");
    }
  };

  const Logo = () => (
    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "20px" }}>
      <img src="/logo.png" alt="Klientys" style={{ height: "34px", width: "auto" }} />
      <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "19px", color: "var(--l-text)" }}>Klientys</span>
    </Link>
  );

  if (status === "loading") {
    return (
      <div className="d-page" style={{ alignItems: "center" }}>
        <p style={{ color: "var(--l-text-3)" }}>Vérification de l'invitation…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="d-page" style={{ alignItems: "center" }}>
        <div className="d-card" style={{ maxWidth: "420px", textAlign: "center" }}>
          <Logo />
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(191,51,51,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "20px", color: "#FC8181" }}>✕</div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px" }}>Invitation invalide</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", marginBottom: "24px" }}>{message}</p>
          <Link href="/" className="l-btn l-btn-ghost" style={{ justifyContent: "center", width: "100%" }}>Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="d-page" style={{ alignItems: "center" }}>
        <div className="d-card" style={{ maxWidth: "420px", textAlign: "center" }}>
          <Logo />
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(29,122,74,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "20px", color: "#6DD9A0" }}>✓</div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px" }}>Invitation acceptée !</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>
            Vous rejoignez <strong style={{ color: "var(--l-text)" }}>{invite?.tenant_name}</strong>. Redirection vers le tableau de bord…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-page" style={{ alignItems: "center" }}>
      <div className="d-card" style={{ maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Logo />
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(13,75,88,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "22px" }}>✉</div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px" }}>Invitation à rejoindre une équipe</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>
            Vous avez été invité(e) à rejoindre{" "}
            <strong style={{ color: "var(--l-text)" }}>{invite?.tenant_name}</strong> en tant que{" "}
            <strong style={{ color: "var(--l-text)" }}>{ROLE_LABEL[invite?.role ?? ""] ?? invite?.role}</strong>.
          </p>
        </div>

        <div style={{ background: "rgba(4,14,21,.5)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "var(--l-text-2)", marginBottom: "24px", border: "1px solid rgba(170,189,216,.1)" }}>
          Email de l'invitation : <span style={{ color: "var(--l-text)", fontWeight: 600 }}>{invite?.email}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={handleAccept}
            disabled={status === "accepting"}
            className="l-btn l-btn-primary"
            style={{ width: "100%", justifyContent: "center", opacity: status === "accepting" ? 0.6 : 1 }}
          >
            {status === "accepting" ? "Acceptation en cours…" : "Accepter l'invitation →"}
          </button>
          <p style={{ fontSize: "12px", textAlign: "center", color: "var(--l-text-3)", margin: 0 }}>
            En acceptant, vous vous connecterez avec le compte associé à <strong>{invite?.email}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="d-page" style={{ alignItems: "center" }}>
        <p style={{ color: "var(--l-text-3)" }}>Chargement…</p>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
