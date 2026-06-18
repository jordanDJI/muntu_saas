"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/api";

export default function AuthInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const ran = useRef(false);
  const [msg, setMsg] = useState("Vérification en cours…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const handle = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg("Lien invalide ou expiré. Redirection…");
          setTimeout(() => router.replace(`/join?token=${token}&expired=1`), 2000);
          return;
        }
      }

      // Token dans le path → toujours préservé, même si Supabase a strippé les query params
      router.replace(`/join?token=${token}`);
    };

    handle();
  }, []);

  return (
    <div className="d-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32, height: 32,
          border: "3px solid var(--l-teal-xl)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "var(--l-text-2)", fontSize: "15px" }}>{msg}</p>
      </div>
    </div>
  );
}
