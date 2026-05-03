"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
      .then((data) => {
        setInvite(data);
        setStatus("ready");
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e.message || "Invitation invalide ou expirée.");
      });
  }, [token]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login with redirect_back
        const redirectUrl = encodeURIComponent(`/join?token=${token}`);
        router.push(`/auth/login?redirect=${redirectUrl}`);
        return;
      }
      await api.acceptInvite(token);
      // Refresh the session so the new tenant_id is in the JWT
      await supabase.auth.refreshSession();
      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Impossible d'accepter l'invitation.");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Vérification de l'invitation…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-2xl">✕</div>
          <h1 className="text-xl font-bold text-gray-800">Invitation invalide</h1>
          <p className="text-sm text-gray-500">{message}</p>
          <button
            onClick={() => router.push("/")}
            className="text-indigo-600 text-sm hover:underline"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-2xl">✓</div>
          <h1 className="text-xl font-bold text-gray-800">Invitation acceptée !</h1>
          <p className="text-sm text-gray-500">Vous rejoignez <strong>{invite?.tenant_name}</strong>. Redirection vers le tableau de bord…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-2xl">✉</div>
          <h1 className="text-xl font-bold text-gray-800">Invitation à rejoindre une équipe</h1>
          <p className="text-sm text-gray-500">
            Vous avez été invité(e) à rejoindre{" "}
            <strong>{invite?.tenant_name}</strong> en tant que{" "}
            <strong>{ROLE_LABEL[invite?.role ?? ""] ?? invite?.role}</strong>.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
          Email de l'invitation : <span className="font-medium text-gray-800">{invite?.email}</span>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={status === "accepting"}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {status === "accepting" ? "Acceptation en cours…" : "Accepter l'invitation"}
          </button>
          <p className="text-xs text-center text-gray-400">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Chargement…</p>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
