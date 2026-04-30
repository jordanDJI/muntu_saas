import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    tenants = (
        sb.table("tenant")
        .select("id,slug,name,created_at")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )
    print("recent_tenants:")
    for t in tenants:
        site = (
            sb.table("site")
            .select("id,status,created_at")
            .eq("tenant_id", t["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        site = (site or [None])[0]
        print("-", t.get("slug"), "|", t.get("name"), "| site_status:", (site or {}).get("status"))


if __name__ == "__main__":
    main()

