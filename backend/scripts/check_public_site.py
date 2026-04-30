import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

    slug = os.getenv("E2E_SLUG", "").strip()
    if not slug:
        raise SystemExit("E2E_SLUG manquant (ex: set E2E_SLUG=muntu-cura-xxxxx)")

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])

    ten_res = sb.table("tenant").select("id,slug").eq("slug", slug).execute()
    tenant = (ten_res.data or [None])[0]
    print("tenant:", tenant)
    if not tenant:
        print("Aucun tenant trouvé pour ce slug (anon).")
        return

    site_res = (
        sb.table("site")
        .select("id,status,tenant_id")
        .eq("tenant_id", tenant["id"])
        .eq("status", "published")
        .execute()
    )
    site = (site_res.data or [None])[0]
    print("site:", site)

    if site:
        offers = sb.table("service_offer").select("id").eq("site_id", site["id"]).execute().data or []
        areas = sb.table("service_area").select("id").eq("site_id", site["id"]).execute().data or []
        tests = sb.table("testimonial").select("id").eq("site_id", site["id"]).execute().data or []
        print("offers_count:", len(offers))
        print("areas_count:", len(areas))
        print("testimonials_count:", len(tests))


if __name__ == "__main__":
    main()

