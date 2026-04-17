"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    api.getLeads().then(setLeads).catch(console.error);
    api.getAppointments().then(setAppointments).catch(console.error);
  }, []);

  const newLeads = leads.filter((l) => l.status === "new").length;
  const confirmedAppts = appointments.filter((a) => a.status === "confirmed").length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">Nouvelles demandes</p>
          <p className="text-4xl font-bold text-indigo-600 mt-1">{newLeads}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500">RDV confirmés</p>
          <p className="text-4xl font-bold text-green-600 mt-1">{confirmedAppts}</p>
        </div>
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Dernières demandes</h2>
          <Link href="/dashboard/leads" className="text-sm text-indigo-600 hover:underline">Voir tout</Link>
        </div>
        <ul className="divide-y">
          {leads.slice(0, 5).map((lead) => (
            <li key={lead.id} className="py-3 flex justify-between items-center">
              <span className="font-medium">
                {lead.contact?.first_name} {lead.contact?.last_name}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${lead.status === "new" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                {lead.status}
              </span>
            </li>
          ))}
          {leads.length === 0 && <li className="py-3 text-gray-400 text-sm">Aucune demande</li>}
        </ul>
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Prochains rendez-vous</h2>
          <Link href="/dashboard/appointments" className="text-sm text-indigo-600 hover:underline">Voir tout</Link>
        </div>
        <ul className="divide-y">
          {appointments.slice(0, 5).map((appt) => (
            <li key={appt.id} className="py-3 flex justify-between items-center">
              <span className="font-medium">
                {appt.contact?.first_name} {appt.contact?.last_name}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(appt.scheduled_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </li>
          ))}
          {appointments.length === 0 && <li className="py-3 text-gray-400 text-sm">Aucun rendez-vous</li>}
        </ul>
      </div>

      {/* Nav */}
      <nav className="flex gap-4">
        <Link href="/dashboard/leads" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Demandes</Link>
        <Link href="/dashboard/appointments" className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">Rendez-vous</Link>
        <Link href="/dashboard/settings" className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">Paramètres</Link>
      </nav>
    </div>
  );
}
