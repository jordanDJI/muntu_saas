"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);

  const load = () => {
    api.getAppointments().then(setAppointments).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    await api.updateAppointment(id, { status: "cancelled" });
    load();
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("fr-BE", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Rendez-vous</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Retour au dashboard
        </button>
      </div>

      <div className="space-y-3">
        {appointments.map((appt) => (
          <div key={appt.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center gap-4">
            <div>
              <p className="font-semibold">{appt.contact?.first_name} {appt.contact?.last_name}</p>
              <p className="text-sm text-gray-500">{fmt(appt.scheduled_at)} → {fmt(appt.end_at)}</p>
              {appt.service_offer?.name && (
                <p className="text-xs text-gray-400 mt-1">{appt.service_offer.name}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${appt.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {appt.status}
              </span>
              {appt.status === "confirmed" && (
                <button
                  onClick={() => cancel(appt.id)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        ))}
        {appointments.length === 0 && <p className="text-gray-400 text-sm">Aucun rendez-vous.</p>}
      </div>
    </div>
  );
}
