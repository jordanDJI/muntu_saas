"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, supabase } from "../../lib/api";

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
  secretary: "Secrétaire",
};

type Status = "loading" | "auth" | "verify_email" | "ready" | "mismatch" | "accepting" | "done" | "error";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{ email: string; role: string; tenant_name: string } | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Formulaire auth inline
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("Lien d'invitation invalide."); return; }
    Promise.all([api.getInvite(token), supabase.auth.getUser()])
      .then(([data, { data: { user } }]) => {
        setInvite(data);
        if (!user) { setStatus("auth"); return; }
        setCurrentUserEmail(user.email ?? null);
        if ((user.email ?? "").toLowerCase() !== data.email.toLowerCase()) {
          setStatus("mismatch");
        } else {
          setStatus("ready");
        }
      })
      .catch((e: any) => { setStatus("error"); setErrorMsg(e.message || "Invitation invalide ou expirée."); });
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: invite!.email, password });
      if (error) { setAuthError(error.message); return; }
      // Connexion réussie → accepter directement
      await api.acceptInvite(token);
      await supabase.auth.refreshSession();
      setStatus("done");
      const dest = invite?.role === "secretary" ? "/dashboard/secretary" : "/dashboard";
      setTimeout(() => router.push(dest), 2000);
    } catch (e: any) {
      setAuthError(e.message || "Erreur de connexion.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password !== passwordConfirm) { setAuthError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setAuthError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setAuthLoading(true);
    try {
      // Persisté en localStorage car Supabase peut stripper les query params de emailRedirectTo.
      // Le timestamp permet d'expirer l'entrée après 24h (= durée de validité du lien Supabase).
      localStorage.setItem("klientys_pending_invite", JSON.stringify({ token, ts: Date.now() }));
      const { data, error } = await supabase.auth.signUp({
        email: invite!.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?invite=${token}`,
        },
      });
      if (error) {
        localStorage.removeItem("klientys_pending_invite");
        setAuthError(error.message);
        return;
      }

      // Email déjà enregistré → Supabase retourne un succès silencieux sans envoyer d'email
      // Signe distinctif : user.identities est vide
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        localStorage.removeItem("klientys_pending_invite");
        setAuthError("Un compte existe déjà avec cet email. Utilisez l'onglet \"J'ai déjà un compte\".");
        return;
      }

      // Confirmation email désactivée dans Supabase → session immédiate sans email
      if (data.session) {
        localStorage.removeItem("klientys_pending_invite");
        await api.acceptInvite(token);
        await supabase.auth.refreshSession();
        setStatus("done");
        const dest = invite?.role === "secretary" ? "/dashboard/secretary" : "/dashboard";
        setTimeout(() => router.push(dest), 2000);
        return;
      }

      setStatus("verify_email");
    } catch (e: any) {
      setAuthError(e.message || "Erreur lors de la création du compte.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      await api.acceptInvite(token);
      await supabase.auth.refreshSession();
      setStatus("done");
      const dest = invite?.role === "secretary" ? "/dashboard/secretary" : "/dashboard";
      setTimeout(() => router.push(dest), 2000);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message || "Impossible d'accepter l'invitation.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setCurrentUserEmail(null);
    setStatus("auth");
  };

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(170,189,216,.18)", borderRadius: "10px",
    padding: "11px 14px", fontSize: "14px", color: "var(--l-text)",
    outline: "none", transition: "border-color .2s, box-shadow .2s",
    boxSizing: "border-box",
  };

  const cardContent = () => {
    if (status === "loading") {
      return (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(42,143,165,.3)", borderTopColor: "var(--l-teal-xl)", margin: "0 auto 16px", animation: "spin .8s linear infinite" }} />
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0 }}>Vérification de l'invitation…</p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(191,51,51,.15)", border: "1px solid rgba(191,51,51,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "20px", color: "#FC8181" }}>✕</div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px", color: "var(--l-text)", letterSpacing: "-.02em", textAlign: "center" }}>Invitation invalide</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", marginBottom: "28px", textAlign: "center" }}>{errorMsg}</p>
          <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px 16px", borderRadius: "10px", border: "1px solid rgba(170,189,216,.18)", background: "rgba(255,255,255,.05)", color: "var(--l-text)", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}>
            Retour à l'accueil
          </Link>
        </>
      );
    }

    if (status === "done") {
      return (
        <>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(29,122,74,.15)", border: "1px solid rgba(74,202,122,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px", color: "#6DD9A0" }}>✓</div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px", color: "var(--l-text)", letterSpacing: "-.02em", textAlign: "center" }}>Invitation acceptée !</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
            Vous rejoignez <strong style={{ color: "var(--l-text)" }}>{invite?.tenant_name}</strong>.<br />
            Redirection vers le tableau de bord…
          </p>
        </>
      );
    }

    if (status === "verify_email") {
      return (
        <>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(13,75,88,.4)", border: "1px solid rgba(42,143,165,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>✉</div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px", color: "var(--l-text)", letterSpacing: "-.02em", textAlign: "center" }}>Confirmez votre email</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
            Un email de confirmation a été envoyé à{" "}
            <strong style={{ color: "var(--l-text)" }}>{invite?.email}</strong>.<br />
            Cliquez sur le lien pour activer votre compte et rejoindre l'équipe.
          </p>
          <div style={{ background: "rgba(13,75,88,.15)", border: "1px solid rgba(42,143,165,.2)", borderRadius: "10px", padding: "14px 16px", fontSize: "13px", color: "var(--l-text-2)", lineHeight: 1.6 }}>
            Après confirmation, vous serez redirigé(e) automatiquement.
          </div>
        </>
      );
    }

    if (status === "mismatch") {
      return (
        <>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(221,170,64,.1)", border: "1px solid rgba(221,170,64,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>⚠</div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "8px", color: "var(--l-text)", letterSpacing: "-.02em", textAlign: "center" }}>Mauvais compte connecté</h1>
          <p style={{ color: "var(--l-text-2)", fontSize: "14px", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
            Vous êtes connecté(e) avec <strong style={{ color: "var(--l-text)" }}>{currentUserEmail}</strong>,<br />
            mais cette invitation est pour <strong style={{ color: "#DDAA40" }}>{invite?.email}</strong>.
          </p>
          <button
            onClick={handleLogout}
            className="l-btn l-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Se déconnecter et changer de compte →
          </button>
        </>
      );
    }

    if (status === "auth") {
      return (
        <>
          {/* En-tête invite */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(13,75,88,.4)", border: "1px solid rgba(42,143,165,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "20px" }}>✉</div>
            <p style={{ color: "var(--l-text-2)", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
              Invitation à rejoindre <strong style={{ color: "var(--l-text)" }}>{invite?.tenant_name}</strong>{" "}
              en tant que <strong style={{ color: "var(--l-teal-xl)" }}>{ROLE_LABEL[invite?.role ?? ""] ?? invite?.role}</strong>
            </p>
          </div>

          {/* Email de l'invitation (en lecture seule) */}
          <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(170,189,216,.12)", borderRadius: "10px", padding: "10px 14px", marginBottom: "20px", fontSize: "13px", color: "var(--l-text-2)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✉</span>
            <span style={{ color: "var(--l-text)", fontWeight: 600 }}>{invite?.email}</span>
          </div>

          {/* Onglets login / signup */}
          <div style={{ display: "flex", background: "rgba(255,255,255,.04)", borderRadius: "10px", padding: "3px", marginBottom: "20px", gap: "3px" }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setAuthMode(m); setAuthError(""); setPassword(""); setPasswordConfirm(""); }}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px", border: "none", cursor: "pointer",
                  fontSize: "13px", fontWeight: 600, transition: "all .2s",
                  background: authMode === m ? "rgba(13,75,88,.6)" : "transparent",
                  color: authMode === m ? "var(--l-teal-xl)" : "var(--l-text-2)",
                }}
              >
                {m === "login" ? "J'ai un compte" : "Créer un compte"}
              </button>
            ))}
          </div>

          {/* Formulaire */}
          {authMode === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--l-teal-xl)"; e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(170,189,216,.18)"; e.target.style.boxShadow = "none"; }}
              />
              {authError && (
                <p style={{ color: "#FC8181", fontSize: "13px", margin: 0, background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)", borderRadius: "8px", padding: "8px 12px" }}>{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="l-btn l-btn-primary"
                style={{ width: "100%", justifyContent: "center", opacity: authLoading ? 0.7 : 1, marginTop: "4px" }}
              >
                {authLoading ? "Connexion…" : "Se connecter et rejoindre →"}
              </button>
              <p style={{ textAlign: "center", fontSize: "12px", color: "var(--l-text-3)", margin: 0 }}>
                <Link href={`/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`} style={{ color: "var(--l-teal-xl)", textDecoration: "none", fontWeight: 500 }}>
                  Mot de passe oublié ?
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="password"
                placeholder="Choisissez un mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--l-teal-xl)"; e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(170,189,216,.18)"; e.target.style.boxShadow = "none"; }}
              />
              <input
                type="password"
                placeholder="Confirmez le mot de passe"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "var(--l-teal-xl)"; e.target.style.boxShadow = "0 0 0 3px rgba(42,143,165,.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(170,189,216,.18)"; e.target.style.boxShadow = "none"; }}
              />
              {authError && (
                <p style={{ color: "#FC8181", fontSize: "13px", margin: 0, background: "rgba(191,51,51,.1)", border: "1px solid rgba(191,51,51,.25)", borderRadius: "8px", padding: "8px 12px" }}>{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="l-btn l-btn-primary"
                style={{ width: "100%", justifyContent: "center", opacity: authLoading ? 0.7 : 1, marginTop: "4px" }}
              >
                {authLoading ? "Création…" : "Créer mon compte et rejoindre →"}
              </button>
              <p style={{ textAlign: "center", fontSize: "12px", color: "var(--l-text-3)", margin: 0 }}>
                Un email de confirmation sera envoyé à <strong>{invite?.email}</strong>.
              </p>
            </form>
          )}
        </>
      );
    }

    // status === "ready" | "accepting"
    return (
      <>
        <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(13,75,88,.4)", border: "1px solid rgba(42,143,165,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>✉</div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", marginBottom: "6px", color: "var(--l-text)", letterSpacing: "-.02em", textAlign: "center" }}>
          Invitation à rejoindre une équipe
        </h1>
        <p style={{ color: "var(--l-text-2)", fontSize: "14px", textAlign: "center", margin: "0 0 28px", lineHeight: 1.6 }}>
          Vous avez été invité(e) à rejoindre{" "}
          <strong style={{ color: "var(--l-text)" }}>{invite?.tenant_name}</strong>{" "}
          en tant que <strong style={{ color: "var(--l-teal-xl)" }}>{ROLE_LABEL[invite?.role ?? ""] ?? invite?.role}</strong>.
        </p>

        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(170,189,216,.12)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "var(--l-text-2)", marginBottom: "24px" }}>
          Connecté(e) en tant que : <span style={{ color: "var(--l-text)", fontWeight: 600 }}>{currentUserEmail}</span>
        </div>

        <button
          onClick={handleAccept}
          disabled={status === "accepting"}
          className="l-btn l-btn-primary"
          style={{ width: "100%", justifyContent: "center", opacity: status === "accepting" ? 0.6 : 1 }}
        >
          {status === "accepting" ? "Acceptation en cours…" : "Accepter l'invitation →"}
        </button>
        <p style={{ fontSize: "12px", textAlign: "center", color: "var(--l-text-3)", margin: "12px 0 0" }}>
          Vous rejoindrez l'équipe avec ce compte.
        </p>
      </>
    );
  };

  return (
    <>
      <style>{`
        @keyframes join-orb1 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          33%      { transform: translate(40px,-30px) scale(1.08); opacity:.7; }
          66%      { transform: translate(-20px,20px) scale(.95); opacity:.5; }
        }
        @keyframes join-orb2 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.35; }
          40%      { transform: translate(-50px,30px) scale(1.12); opacity:.5; }
          75%      { transform: translate(30px,-40px) scale(.9); opacity:.3; }
        }
        @keyframes join-orb3 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.25; }
          50%      { transform: translate(25px,35px) scale(1.15); opacity:.4; }
        }
        @keyframes join-float1 {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-14px) rotate(1deg); }
        }
        @keyframes join-float2 {
          0%,100% { transform: translateY(0) rotate(1deg); }
          50%      { transform: translateY(-10px) rotate(-2deg); }
        }
        @keyframes join-float3 {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes join-card-in {
          from { opacity:0; transform: translateY(24px) scale(.98); }
          to   { opacity:1; transform: none; }
        }
        @keyframes join-particle {
          0%   { transform: translateY(0) translateX(0); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:.6; }
          100% { transform: translateY(-120px) translateX(20px); opacity:0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .join-particle {
          position:absolute; width:2px; height:2px;
          border-radius:50%; animation: join-particle linear infinite;
        }
        @media (max-width: 900px) { .join-hm { display: none !important; } }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "var(--l-bg)", display: "flex",
        alignItems: "center", justifyContent: "center", position: "relative",
        overflow: "hidden", fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif",
        padding: "80px 16px 40px",
      }}>

        {/* Orbes de fond */}
        <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", top: "-150px", left: "-200px", background: "radial-gradient(circle, rgba(13,75,88,.7) 0%, transparent 70%)", animation: "join-orb1 12s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", bottom: "-100px", right: "-150px", background: "radial-gradient(circle, rgba(170,189,216,.18) 0%, transparent 70%)", animation: "join-orb2 16s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: "350px", height: "350px", borderRadius: "50%", top: "50%", left: "60%", background: "radial-gradient(circle, rgba(221,170,64,.12) 0%, transparent 70%)", animation: "join-orb3 10s ease-in-out infinite", pointerEvents: "none" }} />

        {/* Grille */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(170,189,216,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(170,189,216,.07) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)" }} />

        {/* Particules */}
        {[
          { left: "18%", bottom: "20%", delay: "0s",  dur: "7s",  color: "var(--l-teal-xl)" },
          { left: "72%", bottom: "15%", delay: "2s",  dur: "9s",  color: "var(--l-blue)" },
          { left: "45%", bottom: "10%", delay: "4s",  dur: "8s",  color: "var(--l-gold)" },
          { left: "28%", bottom: "35%", delay: "1s",  dur: "11s", color: "var(--l-teal-xl)" },
          { left: "82%", bottom: "40%", delay: "3s",  dur: "6s",  color: "var(--l-blue)" },
          { left: "60%", bottom: "25%", delay: "5s",  dur: "10s", color: "var(--l-gold)" },
        ].map((p, i) => (
          <div key={i} className="join-particle" style={{ left: p.left, bottom: p.bottom, width: i % 2 === 0 ? "3px" : "2px", height: i % 2 === 0 ? "3px" : "2px", background: p.color, animationDelay: p.delay, animationDuration: p.dur }} />
        ))}

        {/* Float cards déco */}
        <div className="join-hm" style={{ position: "absolute", top: "18%", left: "max(24px, calc(50% - 480px))", background: "rgba(7,26,38,.85)", border: "1px solid rgba(221,170,64,.3)", borderRadius: "12px", padding: "12px 18px", backdropFilter: "blur(12px)", animation: "join-float1 6s ease-in-out infinite", boxShadow: "0 20px 60px rgba(0,0,0,.35)", pointerEvents: "none" }}>
          <div style={{ fontSize: "10px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>Membres actifs</div>
          <div style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-gold)" }}>↑ +3</div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "2px" }}>cette semaine</div>
        </div>
        <div className="join-hm" style={{ position: "absolute", bottom: "22%", right: "max(24px, calc(50% - 480px))", background: "rgba(7,26,38,.85)", border: "1px solid rgba(170,189,216,.2)", borderRadius: "12px", padding: "12px 18px", backdropFilter: "blur(12px)", animation: "join-float2 7s 1s ease-in-out infinite", boxShadow: "0 20px 60px rgba(0,0,0,.35)", pointerEvents: "none" }}>
          <div style={{ fontSize: "10px", color: "var(--l-text-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "4px" }}>Collaboration</div>
          <div style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--l-teal-xl)" }}>100%</div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "2px" }}>synchronisé</div>
        </div>
        <div className="join-hm" style={{ position: "absolute", top: "55%", right: "max(24px, calc(50% - 520px))", background: "rgba(7,26,38,.85)", border: "1px solid rgba(13,75,88,.4)", borderRadius: "12px", padding: "10px 16px", backdropFilter: "blur(12px)", animation: "join-float3 8s 2s ease-in-out infinite", boxShadow: "0 20px 60px rgba(0,0,0,.35)", pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ACA7A", flexShrink: 0 }} />
            <div style={{ fontSize: "13px", color: "var(--l-text)", fontWeight: 500 }}>Invitation envoyée</div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "4px" }}>✉ En attente d'acceptation</div>
        </div>

        {/* Bouton retour */}
        <Link href="/" style={{ position: "absolute", top: "20px", left: "20px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500, color: "var(--l-text-2)", textDecoration: "none", padding: "8px 14px", border: "1px solid var(--l-border)", borderRadius: "100px", background: "rgba(255,255,255,.04)", backdropFilter: "blur(8px)", transition: "all .2s", zIndex: 10 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--l-text)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--l-border-g)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--l-text-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--l-border)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Accueil
        </Link>

        {/* Card principale */}
        <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 5, animation: "join-card-in .6s cubic-bezier(.16,1,.3,1) both" }}>
          <div style={{ background: "rgba(7,26,38,.88)", backdropFilter: "blur(24px)", border: "1px solid rgba(170,189,216,.12)", borderRadius: "20px", padding: "40px 36px", boxShadow: "0 40px 120px rgba(0,0,0,.5), 0 0 0 1px rgba(170,189,216,.06)" }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                <img src="/logo.png" alt="Klientys" style={{ height: "36px", width: "auto" }} />
                <span style={{ fontFamily: "var(--font-bricolage),'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "20px", color: "var(--l-text)" }}>Klientys</span>
              </Link>
            </div>

            {cardContent()}
          </div>

          {/* Trust line */}
          <p style={{ textAlign: "center", fontSize: "12px", color: "var(--l-text-3)", marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span>🔒 Connexion sécurisée</span>
            <span style={{ color: "var(--l-border)" }}>·</span>
            <span>Données chiffrées</span>
          </p>
        </div>
      </div>
    </>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--l-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--l-text-3)", fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif" }}>Chargement…</p>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
