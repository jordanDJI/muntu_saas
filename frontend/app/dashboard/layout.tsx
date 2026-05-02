"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Vérifier l'auth au montage
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
    });

    // Rafraîchir la session toutes les 10 min pour éviter l'expiration par inactivité
    const interval = setInterval(async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) router.replace("/login");
    }, 10 * 60 * 1000);

    // Écouter les changements d'état auth (déconnexion, expiration)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
