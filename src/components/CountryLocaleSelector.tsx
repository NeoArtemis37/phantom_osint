"use client";

// =============================================================================
// PHANTOM — Country & Locale Selector
// =============================================================================
// Reusable dropdown that sets the global investigation locale in the Zustand
// store. All OSINT/search/recon panels read this state and pass it to the
// backend, which localizes queries (country name, translated keywords,
// regional platform site-targets) and image search (gl= param).
//
// Usage:
//   <CountryLocaleSelector compact />   // inline in a toolbar
//   <CountryLocaleSelector />           // full version with language + toggle
// =============================================================================

import { useMemo } from "react";
import { Globe, Languages, MapPin, Search } from "lucide-react";
import {
  COUNTRIES,
  getCountriesByRegion,
  getCountry,
  I18N_KEYWORDS,
  getPrimaryLanguage,
  COUNTRY_COUNT,
  LANGUAGE_COUNT,
  type Country,
} from "@/lib/countries";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePhantomStore } from "@/store/phantom-store";
import { cn } from "@/lib/utils";

interface Props {
  /** Compact mode: just the country dropdown + flag, for tight toolbars */
  compact?: boolean;
  className?: string;
}

export function CountryLocaleSelector({ compact = false, className }: Props) {
  const country = usePhantomStore((s) => s.investigationCountry);
  const language = usePhantomStore((s) => s.investigationLanguage);
  const regionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const setCountry = usePhantomStore((s) => s.setInvestigationCountry);
  const setLanguage = usePhantomStore((s) => s.setInvestigationLanguage);
  const setRegionalOnly = usePhantomStore((s) => s.setInvestigationRegionalOnly);

  const current = getCountry(country);
  const grouped = useMemo(() => getCountriesByRegion(), []);

  // When the country changes, auto-derive the primary language
  const handleCountryChange = (code: string) => {
    setCountry(code);
    const c = getCountry(code);
    setLanguage(c.languages[0] ?? "en");
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="h-8 w-[140px] border-cyan-500/30 bg-card/60 text-xs">
            <span className="mr-1 text-sm">{current.flag}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {Object.entries(grouped).map(([region, countries]) => (
              <SelectGroup key={region}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-cyan-400">
                  {region} ({countries.length})
                </SelectLabel>
                {countries.map((c: Country) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    <span className="mr-2">{c.flag}</span>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-cyan-500/20 bg-card/40 p-3 backdrop-blur",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-cyan-500/10 pb-2">
        <Globe className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
          Investigation Locale
        </span>
        <Badge variant="outline" className="ml-auto border-cyan-500/30 text-[10px] text-cyan-300">
          {COUNTRY_COUNT} countries · {LANGUAGE_COUNT} languages
        </Badge>
      </div>

      {/* Country selector */}
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Target Country
        </Label>
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="h-9 border-cyan-500/30 bg-background/50 text-sm">
            <span className="mr-2 text-base">{current.flag}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {Object.entries(grouped).map(([region, countries]) => (
              <SelectGroup key={region}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-cyan-400">
                  {region} ({countries.length})
                </SelectLabel>
                {countries.map((c: Country) => (
                  <SelectItem key={c.code} value={c.code} className="text-sm">
                    <span className="mr-2 text-base">{c.flag}</span>
                    {c.name}
                    <span className="ml-auto pl-2 text-[10px] text-muted-foreground">
                      {c.code}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Language selector */}
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Languages className="h-3 w-3" />
          Search Language
        </Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-9 border-cyan-500/30 bg-background/50 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={getPrimaryLanguage(country)} className="text-sm">
              {current.name} (primary: {getPrimaryLanguage(country)})
            </SelectItem>
            {current.languages.map((lang) => (
              <SelectItem key={lang} value={lang} className="text-sm">
                {I18N_KEYWORDS[lang] ? `${lang} — ${I18N_KEYWORDS[lang].profile}` : lang}
              </SelectItem>
            ))}
            {Object.keys(I18N_KEYWORDS)
              .filter((l) => !current.languages.includes(l))
              .map((lang) => (
                <SelectItem key={lang} value={lang} className="text-sm">
                  {lang} — {I18N_KEYWORDS[lang].profile}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Regional-only toggle */}
      <div className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/10 bg-background/30 px-2 py-1.5">
        <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Search className="h-3 w-3" />
          Regional platforms only
        </Label>
        <Switch checked={regionalOnly} onCheckedChange={setRegionalOnly} />
      </div>

      {/* Active platforms preview */}
      {current.regionalPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {current.regionalPlatforms.slice(0, 8).map((key) => {
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <Badge
                key={key}
                variant="outline"
                className="border-cyan-500/20 bg-cyan-500/5 text-[10px] text-cyan-300"
              >
                {name}
              </Badge>
            );
          })}
          {current.regionalPlatforms.length > 8 && (
            <Badge variant="outline" className="border-cyan-500/20 text-[10px] text-cyan-300">
              +{current.regionalPlatforms.length - 8}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default CountryLocaleSelector;
