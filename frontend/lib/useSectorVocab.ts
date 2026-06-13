"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import { getSectorVocab, SectorVocab } from "./sectorVocabulary";
import { getSectorLeadTypes, LeadTypeOption } from "./sectorLeadTypes";

let _cachedSector: string | null = null;

export function useSectorVocab(): { vocab: SectorVocab; leadTypes: LeadTypeOption[]; sector: string; loading: boolean } {
  const [sector, setSector] = useState<string>(_cachedSector ?? "other");
  const [loading, setLoading] = useState(!_cachedSector);

  useEffect(() => {
    if (_cachedSector) {
      setSector(_cachedSector);
      setLoading(false);
      return;
    }
    api.getMyTenant()
      .then((t: any) => {
        const s = t?.sector ?? "other";
        _cachedSector = s;
        setSector(s);
      })
      .catch(() => { /* garde "other" comme fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return {
    vocab: getSectorVocab(sector),
    leadTypes: getSectorLeadTypes(sector),
    sector,
    loading,
  };
}
