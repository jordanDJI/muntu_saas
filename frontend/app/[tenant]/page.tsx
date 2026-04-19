import { createClient } from "@supabase/supabase-js";
import ContactForm from "./contact-form";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getSiteData(slug: string) {
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) return null;

  const { data: site } = await supabase
    .from("site")
    .select("*, service_offer(*), service_area(*)")
    .eq("tenant_id", tenant.id)
    .eq("status", "published")
    .single();

  return site ? { ...site, tenant } : null;
}

export default async function TenantSitePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const site = await getSiteData(tenantSlug);

  if (!site) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Site introuvable ou non publié.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Absence banner */}
      {site.absence_mode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-3 px-4 text-sm">
          {site.absence_message ?? "Actuellement indisponible — merci de revenir ultérieurement."}
        </div>
      )}

      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-6 text-center">
        <h1 className="text-4xl font-bold">{site.title}</h1>
        {site.service_area?.length > 0 && (
          <p className="mt-3 text-indigo-200 text-lg">
            {site.service_area.map((a: any) => a.city).filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      {/* Services */}
      {site.service_offer?.length > 0 && (
        <section className="max-w-4xl mx-auto py-16 px-6">
          <h2 className="text-2xl font-bold mb-8 text-center">Nos prestations</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {site.service_offer.map((offer: any) => (
              <div key={offer.id} className="border rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-lg">{offer.name}</h3>
                {offer.description && <p className="text-gray-600 mt-2 text-sm">{offer.description}</p>}
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  {offer.duration_min && <span>{offer.duration_min} min</span>}
                  {offer.price_eur && <span>{offer.price_eur} €</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact form */}
      <section className="max-w-xl mx-auto py-16 px-6">
        <h2 className="text-2xl font-bold mb-6 text-center">Prendre contact</h2>
        <ContactForm tenantSlug={tenantSlug} />
      </section>
    </main>
  );
}

