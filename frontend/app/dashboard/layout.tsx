"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session) {
          setReady(true);
        } else {
          window.location.replace("/login");
        }
      } else if (event === "SIGNED_OUT") {
        window.location.replace("/login");
      }
    });

    const interval = setInterval(async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) window.location.replace("/login");
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
