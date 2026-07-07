// =============================================================================
// PHANTOM — Global Country & Locale Dataset
// =============================================================================
// Comprehensive dataset for worldwide OSINT coverage:
//   • All 195 UN-recognized countries (ISO 3166-1 alpha-2)
//   • Primary language(s) per country (for Wikipedia + query localization)
//   • Google region code (gl=) for images.search
//   • Regional social/OSINT platforms per country/region
//   • Regional CERT/CTI sources for CyberWatch
//   • i18n keyword dictionary for query localization in 15+ languages
//
// Used by:
//   - src/lib/osint-query.ts (localized query builder)
//   - src/components/CountryLocaleSelector.tsx (UI)
//   - src/store/phantom-store.ts (investigation context)
//   - all /api/osint/* and /api/search/* routes (via osint-query helpers)
// =============================================================================

export interface Country {
  /** ISO 3166-1 alpha-2 code (uppercase) */
  code: string;
  /** English country name */
  name: string;
  /** Emoji flag (derived from regional indicator symbols) */
  flag: string;
  /** Continent / macro-region */
  region: "Africa" | "Americas" | "Asia" | "Europe" | "Oceania" | "Middle East";
  /** Primary ISO 639-1 language code(s) for this country */
  languages: string[];
  /** Google region code for images.search (gl= param). Usually lowercase ISO code. */
  gl: string;
  /** Wikipedia subdomain language code (e.g. "en", "zh", "ja", "fa") */
  wikiLang: string;
  /** Regional platforms (keys into REGIONAL_PLATFORMS map, or platform names) */
  regionalPlatforms: string[];
  /** Regional CERT / cyber-threat-intelligence source identifiers */
  certSources: string[];
}

// ---------------------------------------------------------------------------
// All 195 countries
// ---------------------------------------------------------------------------
export const COUNTRIES: Country[] = [
  // ─── Africa ──────────────────────────────────────────────────────────────
  { code: "DZ", name: "Algeria", flag: "🇩🇿", region: "Africa", languages: ["ar", "fr"], gl: "dz", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "youtube"], certSources: ["ANSI", "CIRT-DZ"] },
  { code: "AO", name: "Angola", flag: "🇦🇴", region: "Africa", languages: ["pt"], gl: "ao", wikiLang: "pt", regionalPlatforms: ["facebook", "instagram", "youtube"], certSources: ["AO-CERT"] },
  { code: "BJ", name: "Benin", flag: "🇧🇯", region: "Africa", languages: ["fr"], gl: "bj", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "BW", name: "Botswana", flag: "🇧🇼", region: "Africa", languages: ["en"], gl: "bw", wikiLang: "en", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", region: "Africa", languages: ["fr"], gl: "bf", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "BI", name: "Burundi", flag: "🇧🇮", region: "Africa", languages: ["fr", "rn"], gl: "bi", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", region: "Africa", languages: ["fr", "en"], gl: "cm", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "CV", name: "Cape Verde", flag: "🇨🇻", region: "Africa", languages: ["pt"], gl: "cv", wikiLang: "pt", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫", region: "Africa", languages: ["fr"], gl: "cf", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TD", name: "Chad", flag: "🇹🇩", region: "Africa", languages: ["fr", "ar"], gl: "td", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "KM", name: "Comoros", flag: "🇰🇲", region: "Africa", languages: ["fr", "ar"], gl: "km", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "CG", name: "Congo (Brazzaville)", flag: "🇨🇬", region: "Africa", languages: ["fr"], gl: "cg", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "CD", name: "Congo (Kinshasa)", flag: "🇨🇩", region: "Africa", languages: ["fr"], gl: "cd", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", region: "Africa", languages: ["fr"], gl: "ci", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯", region: "Africa", languages: ["fr", "ar"], gl: "dj", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", region: "Africa", languages: ["ar"], gl: "eg", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "tiktok", "youtube"], certSources: ["EG-CERT"] },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶", region: "Africa", languages: ["es", "fr"], gl: "gq", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "ER", name: "Eritrea", flag: "🇪🇷", region: "Africa", languages: ["en", "ar"], gl: "er", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SZ", name: "Eswatini", flag: "🇸🇿", region: "Africa", languages: ["en", "ss"], gl: "sz", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", region: "Africa", languages: ["am", "en"], gl: "et", wikiLang: "am", regionalPlatforms: ["facebook", "telegram", "youtube"], certSources: ["Ethio-CERT"] },
  { code: "GA", name: "Gabon", flag: "🇬🇦", region: "Africa", languages: ["fr"], gl: "ga", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "GM", name: "Gambia", flag: "🇬🇲", region: "Africa", languages: ["en"], gl: "gm", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", region: "Africa", languages: ["en"], gl: "gh", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "tiktok"], certSources: ["CERT-GH"] },
  { code: "GN", name: "Guinea", flag: "🇬🇳", region: "Africa", languages: ["fr"], gl: "gn", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼", region: "Africa", languages: ["pt"], gl: "gw", wikiLang: "pt", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", region: "Africa", languages: ["en", "sw"], gl: "ke", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "tiktok", "whatsapp"], certSources: ["KE-CIRT"] },
  { code: "LS", name: "Lesotho", flag: "🇱🇸", region: "Africa", languages: ["en", "st"], gl: "ls", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "LR", name: "Liberia", flag: "🇱🇷", region: "Africa", languages: ["en"], gl: "lr", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "LY", name: "Libya", flag: "🇱🇾", region: "Africa", languages: ["ar"], gl: "ly", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", region: "Africa", languages: ["fr", "mg"], gl: "mg", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "MW", name: "Malawi", flag: "🇲🇼", region: "Africa", languages: ["en"], gl: "mw", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "ML", name: "Mali", flag: "🇲🇱", region: "Africa", languages: ["fr"], gl: "ml", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "MR", name: "Mauritania", flag: "🇲🇷", region: "Africa", languages: ["ar", "fr"], gl: "mr", wikiLang: "ar", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "MU", name: "Mauritius", flag: "🇲🇺", region: "Africa", languages: ["en", "fr"], gl: "mu", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: ["CERT-MU"] },
  { code: "MA", name: "Morocco", flag: "🇲🇦", region: "Africa", languages: ["ar", "fr"], gl: "ma", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "tiktok", "youtube"], certSources: ["CIRT-Ma"] },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", region: "Africa", languages: ["pt"], gl: "mz", wikiLang: "pt", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "NA", name: "Namibia", flag: "🇳🇦", region: "Africa", languages: ["en"], gl: "na", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "NE", name: "Niger", flag: "🇳🇪", region: "Africa", languages: ["fr"], gl: "ne", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Africa", languages: ["en"], gl: "ng", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "tiktok", "whatsapp", "telegram"], certSources: ["ngCERT"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", region: "Africa", languages: ["en", "fr", "rw"], gl: "rw", wikiLang: "en", regionalPlatforms: ["facebook", "twitter"], certSources: ["Rwanda-CERT"] },
  { code: "ST", name: "São Tomé and Príncipe", flag: "🇸🇹", region: "Africa", languages: ["pt"], gl: "st", wikiLang: "pt", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", region: "Africa", languages: ["fr"], gl: "sn", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram"], certSources: ["CIRT.sn"] },
  { code: "SC", name: "Seychelles", flag: "🇸🇨", region: "Africa", languages: ["en", "fr"], gl: "sc", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", region: "Africa", languages: ["en"], gl: "sl", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SO", name: "Somalia", flag: "🇸🇴", region: "Africa", languages: ["so", "ar"], gl: "so", wikiLang: "so", regionalPlatforms: ["facebook", "tiktok"], certSources: [] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", region: "Africa", languages: ["en", "af"], gl: "za", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok"], certSources: ["SACSRC", "ZACR"] },
  { code: "SS", name: "South Sudan", flag: "🇸🇸", region: "Africa", languages: ["en"], gl: "ss", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SD", name: "Sudan", flag: "🇸🇩", region: "Africa", languages: ["ar", "en"], gl: "sd", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: ["sudanCERT"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", region: "Africa", languages: ["sw", "en"], gl: "tz", wikiLang: "sw", regionalPlatforms: ["facebook", "instagram", "whatsapp"], certSources: ["TZ-CERT"] },
  { code: "TG", name: "Togo", flag: "🇹🇬", region: "Africa", languages: ["fr"], gl: "tg", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TN", name: "Tunisia", flag: "🇹🇳", region: "Africa", languages: ["ar", "fr"], gl: "tn", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: ["TunCERT"] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", region: "Africa", languages: ["en", "sw"], gl: "ug", wikiLang: "en", regionalPlatforms: ["facebook", "twitter", "whatsapp"], certSources: ["CERT.UG"] },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", region: "Africa", languages: ["en"], gl: "zm", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: ["ZM-CIRT"] },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", region: "Africa", languages: ["en"], gl: "zw", wikiLang: "en", regionalPlatforms: ["facebook", "whatsapp"], certSources: [] },

  // ─── Americas ────────────────────────────────────────────────────────────
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬", region: "Americas", languages: ["en"], gl: "ag", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "AR", name: "Argentina", flag: "🇦🇷", region: "Americas", languages: ["es"], gl: "ar", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "taringa"], certSources: ["CertAr"] },
  { code: "BS", name: "Bahamas", flag: "🇧🇸", region: "Americas", languages: ["en"], gl: "bs", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "BB", name: "Barbados", flag: "🇧🇧", region: "Americas", languages: ["en"], gl: "bb", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "BZ", name: "Belize", flag: "🇧🇿", region: "Americas", languages: ["en"], gl: "bz", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", region: "Americas", languages: ["es"], gl: "bo", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["AGETIC"] },
  { code: "BR", name: "Brazil", flag: "🇧🇷", region: "Americas", languages: ["pt"], gl: "br", wikiLang: "pt", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "orkut", "kwai"], certSources: ["CERT.br", "CTIR"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", region: "Americas", languages: ["en", "fr"], gl: "ca", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube"], certSources: ["CCCS", "GetCyberSafe"] },
  { code: "CL", name: "Chile", flag: "🇨🇱", region: "Americas", languages: ["es"], gl: "cl", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter", "tiktok"], certSources: ["CSIRT-CL"] },
  { code: "CO", name: "Colombia", flag: "🇨🇴", region: "Americas", languages: ["es"], gl: "co", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter", "tiktok"], certSources: ["ColCERT"] },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", region: "Americas", languages: ["es"], gl: "cr", wikiLang: "es", regionalPlatforms: ["facebook", "instagram"], certSources: ["CSIRT-CR"] },
  { code: "CU", name: "Cuba", flag: "🇨🇺", region: "Americas", languages: ["es"], gl: "cu", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "DM", name: "Dominica", flag: "🇩🇲", region: "Americas", languages: ["en"], gl: "dm", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", region: "Americas", languages: ["es"], gl: "do", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["CSIRT-RD"] },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", region: "Americas", languages: ["es"], gl: "ec", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["EC-CERT"] },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", region: "Americas", languages: ["es"], gl: "sv", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "GD", name: "Grenada", flag: "🇬🇩", region: "Americas", languages: ["en"], gl: "gd", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "GT", name: "Guatemala", flag: "🇬🇹", region: "Americas", languages: ["es"], gl: "gt", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["GT-CERT"] },
  { code: "GY", name: "Guyana", flag: "🇬🇾", region: "Americas", languages: ["en"], gl: "gy", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "HT", name: "Haiti", flag: "🇭🇹", region: "Americas", languages: ["fr", "ht"], gl: "ht", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "HN", name: "Honduras", flag: "🇭🇳", region: "Americas", languages: ["es"], gl: "hn", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "JM", name: "Jamaica", flag: "🇯🇲", region: "Americas", languages: ["en"], gl: "jm", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["IRSC"] },
  { code: "MX", name: "Mexico", flag: "🇲🇽", region: "Americas", languages: ["es"], gl: "mx", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok"], certSources: ["CERT-MX", "Guardadatos"] },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", region: "Americas", languages: ["es"], gl: "ni", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "PA", name: "Panama", flag: "🇵🇦", region: "Americas", languages: ["es"], gl: "pa", wikiLang: "es", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", region: "Americas", languages: ["es", "gn"], gl: "py", wikiLang: "es", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-PY"] },
  { code: "PE", name: "Peru", flag: "🇵🇪", region: "Americas", languages: ["es"], gl: "pe", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["CSIRT-PE"] },
  { code: "KN", name: "Saint Kitts and Nevis", flag: "🇰🇳", region: "Americas", languages: ["en"], gl: "kn", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "LC", name: "Saint Lucia", flag: "🇱🇨", region: "Americas", languages: ["en"], gl: "lc", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "VC", name: "Saint Vincent and the Grenadines", flag: "🇻🇨", region: "Americas", languages: ["en"], gl: "vc", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SR", name: "Suriname", flag: "🇸🇷", region: "Americas", languages: ["nl"], gl: "sr", wikiLang: "nl", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹", region: "Americas", languages: ["en"], gl: "tt", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: ["TT-CSIRT"] },
  { code: "US", name: "United States", flag: "🇺🇸", region: "Americas", languages: ["en"], gl: "us", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube", "reddit", "snapchat"], certSources: ["CISA", "FBI-IC3", "US-CERT"] },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", region: "Americas", languages: ["es"], gl: "uy", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter"], certSources: ["CERTuy"] },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", region: "Americas", languages: ["es"], gl: "ve", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "tiktok"], certSources: ["VEN-CERT"] },

  // ─── Asia ──────────────────────────────────────────────────────────────────
  { code: "AF", name: "Afghanistan", flag: "🇦🇫", region: "Asia", languages: ["fa", "ps"], gl: "af", wikiLang: "fa", regionalPlatforms: ["facebook", "youtube"], certSources: [] },
  { code: "AM", name: "Armenia", flag: "🇦🇲", region: "Asia", languages: ["hy", "ru"], gl: "am", wikiLang: "hy", regionalPlatforms: ["facebook", "vk", "instagram"], certSources: ["AM-CERT"] },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿", region: "Asia", languages: ["az", "ru"], gl: "az", wikiLang: "az", regionalPlatforms: ["facebook", "instagram", "youtube"], certSources: ["AZ-CERT"] },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", region: "Middle East", languages: ["ar"], gl: "bh", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "twitter"], certSources: ["BH-CERT"] },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", region: "Asia", languages: ["bn", "en"], gl: "bd", wikiLang: "bn", regionalPlatforms: ["facebook", "instagram", "youtube", "whatsapp"], certSources: ["BD-CERT"] },
  { code: "BT", name: "Bhutan", flag: "🇧🇹", region: "Asia", languages: ["dz", "en"], gl: "bt", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "BN", name: "Brunei", flag: "🇧🇳", region: "Asia", languages: ["ms", "en"], gl: "bn", wikiLang: "ms", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "KH", name: "Cambodia", flag: "🇰🇭", region: "Asia", languages: ["km"], gl: "kh", wikiLang: "km", regionalPlatforms: ["facebook", "telegram"], certSources: ["CamCERT"] },
  { code: "CN", name: "China", flag: "🇨🇳", region: "Asia", languages: ["zh"], gl: "cn", wikiLang: "zh", regionalPlatforms: ["weibo", "wechat", "qq", "douyin", "bilibili", "zhihu", "xiaohongshu", "tiktok"], certSources: ["CNNVD", "CNCERT", "QAX"] },
  { code: "CY", name: "Cyprus", flag: "🇨🇾", region: "Asia", languages: ["el", "en"], gl: "cy", wikiLang: "el", regionalPlatforms: ["facebook", "instagram"], certSources: ["CY-CSIRT"] },
  { code: "GE", name: "Georgia", flag: "🇬🇪", region: "Asia", languages: ["ka"], gl: "ge", wikiLang: "ka", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-GOV-GE"] },
  { code: "IN", name: "India", flag: "🇮🇳", region: "Asia", languages: ["hi", "en"], gl: "in", wikiLang: "hi", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "whatsapp", "sharechat", "koo"], certSources: ["CERT-In", "CDAC-Cyber"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Asia", languages: ["id"], gl: "id", wikiLang: "id", regionalPlatforms: ["facebook", "instagram", "tiktok", "whatsapp"], certSources: ["ID-SIRTCC"] },
  { code: "IR", name: "Iran", flag: "🇮🇷", region: "Middle East", languages: ["fa"], gl: "ir", wikiLang: "fa", regionalPlatforms: ["instagram", "telegram", "aparata"], certSources: ["FCSIRT", "Apadana-CERT"] },
  { code: "IQ", name: "Iraq", flag: "🇮🇶", region: "Middle East", languages: ["ar", "ku"], gl: "iq", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: ["IQ-CERT"] },
  { code: "IL", name: "Israel", flag: "🇮🇱", region: "Middle East", languages: ["he", "en"], gl: "il", wikiLang: "he", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "telegram"], certSources: ["INCD", "IL-CERT"] },
  { code: "JP", name: "Japan", flag: "🇯🇵", region: "Asia", languages: ["ja"], gl: "jp", wikiLang: "ja", regionalPlatforms: ["twitter", "line", "mixi", "ameblo", "youtube", "instagram", "tiktok"], certSources: ["JPCERT-CC", "IPA", "NISC"] },
  { code: "JO", name: "Jordan", flag: "🇯🇴", region: "Middle East", languages: ["ar"], gl: "jo", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: ["JOR-CERT"] },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿", region: "Asia", languages: ["kk", "ru"], gl: "kz", wikiLang: "kk", regionalPlatforms: ["vk", "instagram", "facebook"], certSources: ["KZ-CERT"] },
  { code: "KP", name: "North Korea", flag: "🇰🇵", region: "Asia", languages: ["ko"], gl: "kp", wikiLang: "ko", regionalPlatforms: ["youtube"], certSources: [] },
  { code: "KR", name: "South Korea", flag: "🇰🇷", region: "Asia", languages: ["ko"], gl: "kr", wikiLang: "ko", regionalPlatforms: ["kakaotalk", "naver", "band", "instagram", "youtube", "tiktok"], certSources: ["KISA", "KrCERT", "AhnLab"] },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", region: "Middle East", languages: ["ar"], gl: "kw", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "twitter", "snapchat"], certSources: ["KW-CERT"] },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬", region: "Asia", languages: ["ky", "ru"], gl: "kg", wikiLang: "ky", regionalPlatforms: ["vk", "instagram", "facebook"], certSources: ["KG-CERT"] },
  { code: "LA", name: "Laos", flag: "🇱🇦", region: "Asia", languages: ["lo"], gl: "la", wikiLang: "lo", regionalPlatforms: ["facebook"], certSources: ["LaCERT"] },
  { code: "LB", name: "Lebanon", flag: "🇱🇧", region: "Middle East", languages: ["ar", "fr"], gl: "lb", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "whatsapp"], certSources: ["LB-CERT"] },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", region: "Asia", languages: ["ms", "en"], gl: "my", wikiLang: "ms", regionalPlatforms: ["facebook", "instagram", "whatsapp", "telegram", "tiktok"], certSources: ["MyCERT", "CyberSecurityMY"] },
  { code: "MV", name: "Maldives", flag: "🇲🇻", region: "Asia", languages: ["dv"], gl: "mv", wikiLang: "dv", regionalPlatforms: ["facebook"], certSources: ["NCC-MV"] },
  { code: "MN", name: "Mongolia", flag: "🇲🇳", region: "Asia", languages: ["mn"], gl: "mn", wikiLang: "mn", regionalPlatforms: ["facebook", "instagram"], certSources: ["MN-CERT"] },
  { code: "MM", name: "Myanmar", flag: "🇲🇲", region: "Asia", languages: ["my"], gl: "mm", wikiLang: "my", regionalPlatforms: ["facebook", "tiktok"], certSources: ["mmCERT"] },
  { code: "NP", name: "Nepal", flag: "🇳🇵", region: "Asia", languages: ["ne", "en"], gl: "np", wikiLang: "ne", regionalPlatforms: ["facebook", "instagram", "youtube"], certSources: ["NEPAL-CERT"] },
  { code: "OM", name: "Oman", flag: "🇴🇲", region: "Middle East", languages: ["ar"], gl: "om", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "whatsapp"], certSources: ["OCERT"] },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", region: "Asia", languages: ["ur", "en"], gl: "pk", wikiLang: "ur", regionalPlatforms: ["facebook", "instagram", "youtube", "whatsapp"], certSources: ["PSEB-CERT", "Pakistan-CERT"] },
  { code: "PH", name: "Philippines", flag: "🇵🇭", region: "Asia", languages: ["en", "fil"], gl: "ph", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "tiktok", "youtube"], certSources: ["CERT-PH"] },
  { code: "QA", name: "Qatar", flag: "🇶🇦", region: "Middle East", languages: ["ar"], gl: "qa", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "twitter", "whatsapp"], certSources: ["QCERT"] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", region: "Middle East", languages: ["ar"], gl: "sa", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "twitter", "snapchat", "whatsapp"], certSources: ["SA-CERT", "HCA"] },
  { code: "SG", name: "Singapore", flag: "🇸🇬", region: "Asia", languages: ["en", "ms", "ta", "zh"], gl: "sg", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "linkedin", "whatsapp", "telegram"], certSources: ["SingCERT", "CSA-SG"] },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", region: "Asia", languages: ["si", "ta", "en"], gl: "lk", wikiLang: "si", regionalPlatforms: ["facebook", "instagram", "whatsapp"], certSources: ["SriLanka-CERT"] },
  { code: "SY", name: "Syria", flag: "🇸🇾", region: "Middle East", languages: ["ar"], gl: "sy", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram"], certSources: ["Sy-CERT"] },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", region: "Asia", languages: ["zh"], gl: "tw", wikiLang: "zh", regionalPlatforms: ["facebook", "instagram", "line", "youtube"], certSources: ["TWNCERT", "CHHT"] },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯", region: "Asia", languages: ["tg", "ru"], gl: "tj", wikiLang: "tg", regionalPlatforms: ["vk", "facebook"], certSources: ["TJ-CERT"] },
  { code: "TH", name: "Thailand", flag: "🇹🇭", region: "Asia", languages: ["th"], gl: "th", wikiLang: "th", regionalPlatforms: ["facebook", "instagram", "line", "tiktok"], certSources: ["ThaiCERT", "ETDA"] },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱", region: "Asia", languages: ["pt"], gl: "tl", wikiLang: "pt", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TR", name: "Turkey", flag: "🇹🇷", region: "Asia", languages: ["tr"], gl: "tr", wikiLang: "tr", regionalPlatforms: ["instagram", "twitter", "youtube", "facebook", "telegram"], certSources: ["USOM", "TR-CERT"] },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲", region: "Asia", languages: ["tk", "ru"], gl: "tm", wikiLang: "tk", regionalPlatforms: ["vk"], certSources: [] },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", region: "Middle East", languages: ["ar"], gl: "ae", wikiLang: "ar", regionalPlatforms: ["facebook", "instagram", "twitter", "whatsapp", "telegram", "tiktok"], certSources: ["aeCERT", "TDRA"] },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿", region: "Asia", languages: ["uz", "ru"], gl: "uz", wikiLang: "uz", regionalPlatforms: ["telegram", "instagram", "facebook"], certSources: ["UZ-CERT"] },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asia", languages: ["vi"], gl: "vn", wikiLang: "vi", regionalPlatforms: ["facebook", "zalo", "tiktok", "youtube"], certSources: ["VNCERT", "BKAV"] },
  { code: "YE", name: "Yemen", flag: "🇾🇪", region: "Middle East", languages: ["ar"], gl: "ye", wikiLang: "ar", regionalPlatforms: ["facebook"], certSources: ["YE-CERT"] },

  // ─── Europe ────────────────────────────────────────────────────────────────
  { code: "AL", name: "Albania", flag: "🇦🇱", region: "Europe", languages: ["sq"], gl: "al", wikiLang: "sq", regionalPlatforms: ["facebook", "instagram"], certSources: ["AKSHI"] },
  { code: "AD", name: "Andorra", flag: "🇦🇩", region: "Europe", languages: ["ca"], gl: "ad", wikiLang: "ca", regionalPlatforms: ["facebook", "instagram"], certSources: [] },
  { code: "AT", name: "Austria", flag: "🇦🇹", region: "Europe", languages: ["de"], gl: "at", wikiLang: "de", regionalPlatforms: ["facebook", "instagram", "xing"], certSources: ["CERT-AT"] },
  { code: "BY", name: "Belarus", flag: "🇧🇾", region: "Europe", languages: ["be", "ru"], gl: "by", wikiLang: "be", regionalPlatforms: ["vk", "instagram", "telegram"], certSources: ["BY-CERT"] },
  { code: "BE", name: "Belgium", flag: "🇧🇪", region: "Europe", languages: ["nl", "fr", "de"], gl: "be", wikiLang: "nl", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["CCB", "SMASH-CERT"] },
  { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦", region: "Europe", languages: ["bs", "hr", "sr"], gl: "ba", wikiLang: "bs", regionalPlatforms: ["facebook", "instagram"], certSources: ["BA-CERT"] },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", region: "Europe", languages: ["bg"], gl: "bg", wikiLang: "bg", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-BG"] },
  { code: "HR", name: "Croatia", flag: "🇭🇷", region: "Europe", languages: ["hr"], gl: "hr", wikiLang: "hr", regionalPlatforms: ["facebook", "instagram"], certSources: ["CARNet-CERT"] },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", region: "Europe", languages: ["cs"], gl: "cz", wikiLang: "cs", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["CSIRT.cz", "NUKIB"] },
  { code: "DK", name: "Denmark", flag: "🇩🇰", region: "Europe", languages: ["da"], gl: "dk", wikiLang: "da", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["CFCS", "DK-CERT"] },
  { code: "EE", name: "Estonia", flag: "🇪🇪", region: "Europe", languages: ["et"], gl: "ee", wikiLang: "et", regionalPlatforms: ["facebook", "instagram"], certSources: ["RIA", "CERT-EE"] },
  { code: "FI", name: "Finland", flag: "🇫🇮", region: "Europe", languages: ["fi", "sv"], gl: "fi", wikiLang: "fi", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["NCSC-FI", "Traficom"] },
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe", languages: ["fr"], gl: "fr", wikiLang: "fr", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube"], certSources: ["ANSSI", "Cybermalveillance"] },
  { code: "DE", name: "Germany", flag: "🇩🇪", region: "Europe", languages: ["de"], gl: "de", wikiLang: "de", regionalPlatforms: ["facebook", "instagram", "xing", "linkedin", "whatsapp"], certSources: ["BSI", "CERT-Bund"] },
  { code: "GR", name: "Greece", flag: "🇬🇷", region: "Europe", languages: ["el"], gl: "gr", wikiLang: "el", regionalPlatforms: ["facebook", "instagram"], certSources: ["GR-CSIRT"] },
  { code: "HU", name: "Hungary", flag: "🇭🇺", region: "Europe", languages: ["hu"], gl: "hu", wikiLang: "hu", regionalPlatforms: ["facebook", "instagram"], certSources: ["NISZ", "GovCERT-HU"] },
  { code: "IS", name: "Iceland", flag: "🇮🇸", region: "Europe", languages: ["is"], gl: "is", wikiLang: "is", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-IS"] },
  { code: "IE", name: "Ireland", flag: "🇮🇪", region: "Europe", languages: ["en", "ga"], gl: "ie", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin"], certSources: ["NCSC-IE"] },
  { code: "IT", name: "Italy", flag: "🇮🇹", region: "Europe", languages: ["it"], gl: "it", wikiLang: "it", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok"], certSources: ["CSIRT-Italia", "ACN"] },
  { code: "LV", name: "Latvia", flag: "🇱🇻", region: "Europe", languages: ["lv"], gl: "lv", wikiLang: "lv", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-LV"] },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮", region: "Europe", languages: ["de"], gl: "li", wikiLang: "de", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "LT", name: "Lithuania", flag: "🇱🇹", region: "Europe", languages: ["lt"], gl: "lt", wikiLang: "lt", regionalPlatforms: ["facebook", "instagram"], certSources: ["NKSC"] },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", region: "Europe", languages: ["fr", "de", "lb"], gl: "lu", wikiLang: "fr", regionalPlatforms: ["facebook", "linkedin"], certSources: ["CIRCL", "ILR"] },
  { code: "MT", name: "Malta", flag: "🇲🇹", region: "Europe", languages: ["mt", "en"], gl: "mt", wikiLang: "mt", regionalPlatforms: ["facebook", "instagram"], certSources: ["CSIRT-MT"] },
  { code: "MD", name: "Moldova", flag: "🇲🇩", region: "Europe", languages: ["ro", "ru"], gl: "md", wikiLang: "ro", regionalPlatforms: ["facebook", "instagram", "vk"], certSources: ["CERT-MD"] },
  { code: "MC", name: "Monaco", flag: "🇲🇨", region: "Europe", languages: ["fr"], gl: "mc", wikiLang: "fr", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "ME", name: "Montenegro", flag: "🇲🇪", region: "Europe", languages: ["cnr", "sr"], gl: "me", wikiLang: "sr", regionalPlatforms: ["facebook", "instagram"], certSources: ["ME-CERT"] },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", region: "Europe", languages: ["nl"], gl: "nl", wikiLang: "nl", regionalPlatforms: ["facebook", "instagram", "linkedin", "twitter", "hyves"], certSources: ["NCSC-NL"] },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰", region: "Europe", languages: ["mk"], gl: "mk", wikiLang: "mk", regionalPlatforms: ["facebook", "instagram"], certSources: ["MK-CIRT"] },
  { code: "NO", name: "Norway", flag: "🇳🇴", region: "Europe", languages: ["no"], gl: "no", wikiLang: "no", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["NSM", "NorCERT"] },
  { code: "PL", name: "Poland", flag: "🇵🇱", region: "Europe", languages: ["pl"], gl: "pl", wikiLang: "pl", regionalPlatforms: ["facebook", "instagram", "nasza-klasa"], certSources: ["CSIRT-NASK", "GOV-CERT-PL"] },
  { code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe", languages: ["pt"], gl: "pt", wikiLang: "pt", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin"], certSources: ["CNCS"] },
  { code: "RO", name: "Romania", flag: "🇷🇴", region: "Europe", languages: ["ro"], gl: "ro", wikiLang: "ro", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-RO"] },
  { code: "RU", name: "Russia", flag: "🇷🇺", region: "Europe", languages: ["ru"], gl: "ru", wikiLang: "ru", regionalPlatforms: ["vk", "odnoklassniki", "telegram", "yandex", "mailru", "dzen"], certSources: ["FSTEC", "SOC", "Kaspersky"] },
  { code: "SM", name: "San Marino", flag: "🇸🇲", region: "Europe", languages: ["it"], gl: "sm", wikiLang: "it", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "RS", name: "Serbia", flag: "🇷🇸", region: "Europe", languages: ["sr"], gl: "rs", wikiLang: "sr", regionalPlatforms: ["facebook", "instagram"], certSources: ["CERT-RS"] },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", region: "Europe", languages: ["sk"], gl: "sk", wikiLang: "sk", regionalPlatforms: ["facebook", "instagram"], certSources: ["SK-CERT"] },
  { code: "SI", name: "Slovenia", flag: "🇸🇮", region: "Europe", languages: ["sl"], gl: "si", wikiLang: "sl", regionalPlatforms: ["facebook", "instagram"], certSources: ["SI-CERT"] },
  { code: "ES", name: "Spain", flag: "🇪🇸", region: "Europe", languages: ["es"], gl: "es", wikiLang: "es", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok"], certSources: ["INCIBE", "CCN-CERT"] },
  { code: "SE", name: "Sweden", flag: "🇸🇪", region: "Europe", languages: ["sv"], gl: "se", wikiLang: "sv", regionalPlatforms: ["facebook", "instagram", "linkedin"], certSources: ["MSB", "CERT-SE"] },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", region: "Europe", languages: ["de", "fr", "it"], gl: "ch", wikiLang: "de", regionalPlatforms: ["facebook", "instagram", "xing", "linkedin"], certSources: ["NCSC-CH", "MELANI"] },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", region: "Europe", languages: ["uk"], gl: "ua", wikiLang: "uk", regionalPlatforms: ["facebook", "instagram", "telegram", "twitter"], certSources: ["CERT-UA", "SSSCIP"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "Europe", languages: ["en"], gl: "uk", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "whatsapp"], certSources: ["NCSC-UK", "ActionFraud"] },
  { code: "VA", name: "Vatican City", flag: "🇻🇦", region: "Europe", languages: ["it", "la"], gl: "va", wikiLang: "la", regionalPlatforms: ["facebook"], certSources: [] },

  // ─── Oceania ───────────────────────────────────────────────────────────────
  { code: "AU", name: "Australia", flag: "🇦🇺", region: "Oceania", languages: ["en"], gl: "au", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube"], certSources: ["ACSC", "Scamwatch"] },
  { code: "FJ", name: "Fiji", flag: "🇫🇯", region: "Oceania", languages: ["en", "fj"], gl: "fj", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "KI", name: "Kiribati", flag: "🇰🇮", region: "Oceania", languages: ["en"], gl: "ki", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "MH", name: "Marshall Islands", flag: "🇲🇭", region: "Oceania", languages: ["en", "mh"], gl: "mh", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "FM", name: "Micronesia", flag: "🇫🇲", region: "Oceania", languages: ["en"], gl: "fm", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "NR", name: "Nauru", flag: "🇳🇷", region: "Oceania", languages: ["en", "na"], gl: "nr", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", region: "Oceania", languages: ["en", "mi"], gl: "nz", wikiLang: "en", regionalPlatforms: ["facebook", "instagram", "twitter", "linkedin"], certSources: ["CERT-NZ", "NCSC-NZ"] },
  { code: "PW", name: "Palau", flag: "🇵🇼", region: "Oceania", languages: ["en"], gl: "pw", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "WS", name: "Samoa", flag: "🇼🇸", region: "Oceania", languages: ["en", "sm"], gl: "ws", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "SB", name: "Solomon Islands", flag: "🇸🇧", region: "Oceania", languages: ["en"], gl: "sb", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TO", name: "Tonga", flag: "🇹🇴", region: "Oceania", languages: ["en", "to"], gl: "to", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "TV", name: "Tuvalu", flag: "🇹🇻", region: "Oceania", languages: ["en"], gl: "tv", wikiLang: "en", regionalPlatforms: ["facebook"], certSources: [] },
  { code: "VU", name: "Vanuatu", flag: "🇻🇺", region: "Oceania", languages: ["bi", "en", "fr"], gl: "vu", wikiLang: "bi", regionalPlatforms: ["facebook"], certSources: [] },
];

// ---------------------------------------------------------------------------
// Regional platforms detail (URLs + search templates)
// ---------------------------------------------------------------------------
export interface RegionalPlatform {
  key: string;
  name: string;
  url: string;
  /** Search URL template — {username} placeholder */
  searchUrl: string;
  /** Primary countries/regions where this platform dominates */
  countries: string[];
  /** Platform category */
  category: "social" | "microblog" | "messaging" | "professional" | "video" | "forum" | "blog" | "image" | "dating" | "search";
}

export const REGIONAL_PLATFORMS: Record<string, RegionalPlatform> = {
  // ─── Russia / CIS ────────────────────────────────────────────────────────
  vk: { key: "vk", name: "VK (ВКонтакте)", url: "https://vk.com", searchUrl: "https://vk.com/{}", countries: ["RU", "BY", "KZ", "KG", "AM", "AZ", "MD", "TJ", "TM", "UA"], category: "social" },
  odnoklassniki: { key: "odnoklassniki", name: "Odnoklassniki (Одноклассники)", url: "https://ok.ru", searchUrl: "https://ok.ru/{}", countries: ["RU", "BY", "KZ", "KG"], category: "social" },
  mailru: { key: "mailru", name: "Mail.ru (Мой Мир)", url: "https://my.mail.ru", searchUrl: "https://my.mail.ru/mail/{}", countries: ["RU", "BY"], category: "social" },
  dzen: { key: "dzen", name: "Yandex Dzen (Дзен)", url: "https://dzen.ru", searchUrl: "https://dzen.ru/{}", countries: ["RU"], category: "blog" },
  yandex: { key: "yandex", name: "Yandex (Яндекс)", url: "https://yandex.ru", searchUrl: "https://yandex.ru/search?text={}", countries: ["RU", "BY", "KZ"], category: "search" },

  // ─── China ───────────────────────────────────────────────────────────────
  weibo: { key: "weibo", name: "Weibo (微博)", url: "https://weibo.com", searchUrl: "https://weibo.com/u/{}", countries: ["CN"], category: "microblog" },
  wechat: { key: "wechat", name: "WeChat (微信)", url: "https://weixin.qq.com", searchUrl: "https://weixin.qq.com/", countries: ["CN"], category: "messaging" },
  qq: { key: "qq", name: "QQ (QQ空间)", url: "https://qzone.qq.com", searchUrl: "https://user.qzone.qq.com/{}", countries: ["CN"], category: "social" },
  douyin: { key: "douyin", name: "Douyin (抖音)", url: "https://www.douyin.com", searchUrl: "https://www.douyin.com/user/{}", countries: ["CN"], category: "video" },
  bilibili: { key: "bilibili", name: "Bilibili (哔哩哔哩)", url: "https://www.bilibili.com", searchUrl: "https://space.bilibili.com/{}", countries: ["CN"], category: "video" },
  zhihu: { key: "zhihu", name: "Zhihu (知乎)", url: "https://www.zhihu.com", searchUrl: "https://www.zhihu.com/people/{}", countries: ["CN"], category: "forum" },
  xiaohongshu: { key: "xiaohongshu", name: "Xiaohongshu (小红书)", url: "https://www.xiaohongshu.com", searchUrl: "https://www.xiaohongshu.com/user/profile/{}", countries: ["CN"], category: "image" },

  // ─── Japan ───────────────────────────────────────────────────────────────
  mixi: { key: "mixi", name: "mixi", url: "https://mixi.jp", searchUrl: "https://mixi.jp/show_friend.pl?id={}", countries: ["JP"], category: "social" },
  line: { key: "line", name: "LINE", url: "https://line.me", searchUrl: "https://line.me/ti/p/{}", countries: ["JP", "TW", "TH", "ID"], category: "messaging" },
  ameblo: { key: "ameblo", name: "Ameba Blog (アメブロ)", url: "https://ameblo.jp", searchUrl: "https://ameblo.jp/{}", countries: ["JP"], category: "blog" },

  // ─── Korea ───────────────────────────────────────────────────────────────
  kakaotalk: { key: "kakaotalk", name: "KakaoTalk (카카오톡)", url: "https://www.kakaocorp.com/service/KakaoTalk", searchUrl: "https://pf.kakao.com/{}", countries: ["KR"], category: "messaging" },
  naver: { key: "naver", name: "Naver (네이버)", url: "https://www.naver.com", searchUrl: "https://search.naver.com/search.naver?query={}", countries: ["KR"], category: "search" },
  band: { key: "band", name: "Naver BAND (밴드)", url: "https://band.us", searchUrl: "https://band.us/band/{}", countries: ["KR"], category: "social" },

  // ─── Vietnam ─────────────────────────────────────────────────────────────
  zalo: { key: "zalo", name: "Zalo", url: "https://zalo.me", searchUrl: "https://zalo.me/{}", countries: ["VN"], category: "messaging" },

  // ─── Middle East / Iran ──────────────────────────────────────────────────
  aparata: { key: "aparata", name: "Aparat (آپارات)", url: "https://www.aparat.com", searchUrl: "https://www.aparat.com/{}", countries: ["IR"], category: "video" },

  // ─── India ───────────────────────────────────────────────────────────────
  sharechat: { key: "sharechat", name: "ShareChat", url: "https://sharechat.com", searchUrl: "https://sharechat.com/profile/{}", countries: ["IN"], category: "social" },
  koo: { key: "koo", name: "Koo", url: "https://www.kooapp.com", searchUrl: "https://www.kooapp.com/profile/{}", countries: ["IN"], category: "microblog" },

  // ─── Latin America ───────────────────────────────────────────────────────
  taringa: { key: "taringa", name: "Taringa!", url: "https://www.taringa.net", searchUrl: "https://www.taringa.net/{}", countries: ["AR", "UY", "PY", "VE", "CO", "MX"], category: "forum" },
  kwai: { key: "kwai", name: "Kwai", url: "https://www.kwai.com", searchUrl: "https://www.kwai.com/@{}", countries: ["BR"], category: "video" },

  // ─── Europe ──────────────────────────────────────────────────────────────
  xing: { key: "xing", name: "XING", url: "https://www.xing.com", searchUrl: "https://www.xing.com/profile/{}", countries: ["DE", "AT", "CH"], category: "professional" },
  nasza_klasa: { key: "nasza_klasa", name: "Nasza Klasa (NK.pl)", url: "https://nk.pl", searchUrl: "https://nk.pl/profile/{}", countries: ["PL"], category: "social" },
  hyves: { key: "hyves", name: "Hyves (archived)", url: "https://hyves.nl", searchUrl: "https://hyves.nl/{}", countries: ["NL"], category: "social" },

  // ─── Global / multi-region (already in osint-platforms.ts but listed here for the selector) ──
  facebook: { key: "facebook", name: "Facebook", url: "https://facebook.com", searchUrl: "https://facebook.com/{}", countries: [], category: "social" },
  instagram: { key: "instagram", name: "Instagram", url: "https://instagram.com", searchUrl: "https://instagram.com/{}", countries: [], category: "image" },
  twitter: { key: "twitter", name: "X (Twitter)", url: "https://x.com", searchUrl: "https://x.com/{}", countries: [], category: "microblog" },
  linkedin: { key: "linkedin", name: "LinkedIn", url: "https://linkedin.com", searchUrl: "https://linkedin.com/in/{}", countries: [], category: "professional" },
  tiktok: { key: "tiktok", name: "TikTok", url: "https://tiktok.com", searchUrl: "https://tiktok.com/@{}", countries: [], category: "video" },
  youtube: { key: "youtube", name: "YouTube", url: "https://youtube.com", searchUrl: "https://youtube.com/@{}", countries: [], category: "video" },
  reddit: { key: "reddit", name: "Reddit", url: "https://reddit.com", searchUrl: "https://reddit.com/user/{}", countries: [], category: "forum" },
  snapchat: { key: "snapchat", name: "Snapchat", url: "https://snapchat.com", searchUrl: "https://snapchat.com/add/{}", countries: [], category: "social" },
  whatsapp: { key: "whatsapp", name: "WhatsApp", url: "https://whatsapp.com", searchUrl: "https://wa.me/{}", countries: [], category: "messaging" },
  telegram: { key: "telegram", name: "Telegram", url: "https://t.me", searchUrl: "https://t.me/{}", countries: [], category: "messaging" },
};

// ---------------------------------------------------------------------------
// Regional CERT / CTI sources (for CyberWatch)
// ---------------------------------------------------------------------------
export interface CertSource {
  key: string;
  name: string;
  country: string;
  /** Search query templates (with {topic} placeholder) for this CERT's advisories */
  queries: string[];
  /** Official site for page_reader extraction */
  url: string;
}

export const CERT_SOURCES: CertSource[] = [
  // North America
  { key: "CISA", name: "CISA (US Cybersecurity & Infrastructure Security Agency)", country: "US", url: "https://www.cisa.gov/news-events/cybersecurity-advisories", queries: ["site:cisa.gov {topic} advisory", "CISA {topic} alert"] },
  { key: "FBI-IC3", name: "FBI IC3 (Internet Crime Complaint Center)", country: "US", url: "https://www.ic3.gov", queries: ["site:ic3.gov {topic}", "FBI IC3 {topic}"] },
  { key: "CCCS", name: "Canadian Centre for Cyber Security", country: "CA", url: "https://www.cyber.gc.ca", queries: ["site:cyber.gc.ca {topic}", "CCCS {topic} advisory"] },
  // Europe
  { key: "ANSSI", name: "ANSSI (France)", country: "FR", url: "https://www.ssi.gouv.fr", queries: ["site:ssi.gouv.fr {topic}", "ANSSI {topic}"] },
  { key: "BSI", name: "BSI (Germany)", country: "DE", url: "https://www.bsi.bund.de", queries: ["site:bsi.bund.de {topic}", "BSI {topic}"] },
  { key: "NCSC-UK", name: "NCSC UK", country: "GB", url: "https://www.ncsc.gov.uk", queries: ["site:ncsc.gov.uk {topic}", "NCSC UK {topic}"] },
  { key: "NCSC-NL", name: "NCSC Nederland", country: "NL", url: "https://www.ncsc.nl", queries: ["site:ncsc.nl {topic}", "NCSC-NL {topic}"] },
  { key: "INCIBE", name: "INCIBE (Spain)", country: "ES", url: "https://www.incibe.es", queries: ["site:incibe.es {topic}", "INCIBE {topic}"] },
  { key: "CERT-AT", name: "CERT-AT (Austria)", country: "AT", url: "https://www.cert.at", queries: ["site:cert.at {topic}"] },
  { key: "CERT-EE", name: "CERT-EE (Estonia)", country: "EE", url: "https://www.ria.ee", queries: ["site:ria.ee {topic}"] },
  { key: "CSIRT-Italia", name: "CSIRT Italia", country: "IT", url: "https://www.csirt.gov.it", queries: ["site:csirt.gov.it {topic}"] },
  { key: "CSIRT.cz", name: "CSIRT.cz", country: "CZ", url: "https://www.csirt.cz", queries: ["site:csirt.cz {topic}"] },
  { key: "CERT-UA", name: "CERT-UA (Ukraine)", country: "UA", url: "https://cert.gov.ua", queries: ["site:cert.gov.ua {topic}"] },
  { key: "CERT-Bund", name: "CERT-Bund (Germany)", country: "DE", url: "https://www.cert-bund.de", queries: ["site:cert-bund.de {topic}"] },
  { key: "CERT-SE", name: "CERT-SE (Sweden)", country: "SE", url: "https://www.cert.se", queries: ["site:cert.se {topic}"] },
  { key: "NCSC-FI", name: "NCSC-FI (Finland)", country: "FI", url: "https://www.kyberturvallisuuskeskus.fi", queries: ["site:kyberturvallisuuskeskus.fi {topic}"] },
  // Asia-Pacific
  { key: "JPCERT-CC", name: "JPCERT-CC (Japan)", country: "JP", url: "https://www.jpcert.or.jp", queries: ["site:jpcert.or.jp {topic}", "JPCERT {topic}"] },
  { key: "KISA", name: "KISA (Korea)", country: "KR", url: "https://www.kisa.or.kr", queries: ["site:kisa.or.kr {topic}", "KISA {topic}"] },
  { key: "KrCERT", name: "KrCERT (Korea)", country: "KR", url: "https://www.krcert.or.kr", queries: ["site:krcert.or.kr {topic}"] },
  { key: "MyCERT", name: "MyCERT (Malaysia)", country: "MY", url: "https://www.mycert.org.my", queries: ["site:mycert.org.my {topic}"] },
  { key: "CERT-In", name: "CERT-In (India)", country: "IN", url: "https://www.cert-in.org.in", queries: ["site:cert-in.org.in {topic}"] },
  { key: "SingCERT", name: "SingCERT (Singapore)", country: "SG", url: "https://www.csa.gov.sg", queries: ["site:csa.gov.sg {topic}"] },
  { key: "CERT-PH", name: "CERT-PH (Philippines)", country: "PH", url: "https://www.dict.gov.ph", queries: ["site:dict.gov.ph {topic}"] },
  { key: "VNCERT", name: "VNCERT (Vietnam)", country: "VN", url: "https://vncert.vn", queries: ["site:vncert.vn {topic}"] },
  { key: "ThaiCERT", name: "ThaiCERT", country: "TH", url: "https://www.thaicert.or.th", queries: ["site:thaicert.or.th {topic}"] },
  { key: "ID-SIRTCC", name: "ID-SIRTCC (Indonesia)", country: "ID", url: "https://idsirtii.or.id", queries: ["site:idsirtii.or.id {topic}"] },
  { key: "CNCERT", name: "CNCERT (China)", country: "CN", url: "https://www.cncert.org.cn", queries: ["site:cncert.org.cn {topic}"] },
  { key: "CNNVD", name: "CNNVD (China Vuln DB)", country: "CN", url: "https://www.cnnvd.org.cn", queries: ["site:cnnvd.org.cn {topic}"] },
  { key: "TWNCERT", name: "TWNCERT (Taiwan)", country: "TW", url: "https://www.nccst.nat.gov.tw", queries: ["site:nccst.nat.gov.tw {topic}"] },
  { key: "ACSC", name: "ACSC (Australia)", country: "AU", url: "https://www.cyber.gov.au", queries: ["site:cyber.gov.au {topic}", "ACSC {topic}"] },
  { key: "CERT-NZ", name: "CERT NZ", country: "NZ", url: "https://www.cert.govt.nz", queries: ["site:cert.govt.nz {topic}"] },
  // Middle East
  { key: "INCD", name: "INCD (Israel)", country: "IL", url: "https://www.gov.il/he/Departments/Units/inda", queries: ["INCD {topic} advisory", "Israel cyber {topic}"] },
  { key: "aeCERT", name: "aeCERT (UAE)", country: "AE", url: "https://www.aecert.gov.ae", queries: ["site:aecert.gov.ae {topic}"] },
  { key: "QCERT", name: "QCERT (Qatar)", country: "QA", url: "https://www.qcert.org", queries: ["site:qcert.org {topic}"] },
  { key: "SA-CERT", name: "SA-CERT (Saudi Arabia)", country: "SA", url: "https://www.cert.gov.sa", queries: ["site:cert.gov.sa {topic}"] },
  { key: "OCERT", name: "OCERT (Oman)", country: "OM", url: "https://www.cert.gov.om", queries: ["site:cert.gov.om {topic}"] },
  // Latin America
  { key: "CERT-MX", name: "CERT-MX", country: "MX", url: "https://www.gob.mx/cert-mx", queries: ["site:gob.mx/cert-mx {topic}"] },
  { key: "CERT.br", name: "CERT.br (Brazil)", country: "BR", url: "https://www.cert.br", queries: ["site:cert.br {topic}"] },
  { key: "CertAr", name: "CertAr (Argentina)", country: "AR", url: "https://www.argentina.gob.ar/jus/seguridadjusticia/cert", queries: ["CertAr {topic}"] },
  { key: "ColCERT", name: "ColCERT (Colombia)", country: "CO", url: "https://www.colcert.gov.co", queries: ["site:colcert.gov.co {topic}"] },
  { key: "CSIRT-CL", name: "CSIRT-CL (Chile)", country: "CL", url: "https://csirt.gob.cl", queries: ["site:csirt.gob.cl {topic}"] },
  // Africa
  { key: "KE-CIRT", name: "KE-CIRT (Kenya)", country: "KE", url: "https://www.cirt.go.ke", queries: ["site:cirt.go.ke {topic}"] },
  { key: "ngCERT", name: "ngCERT (Nigeria)", country: "NG", url: "https://www.cert.gov.ng", queries: ["site:cert.gov.ng {topic}"] },
  { key: "ZACR", name: "ZACR / SABRIC (South Africa)", country: "ZA", url: "https://www.sabric.co.za", queries: ["SABRIC {topic}", "South Africa cyber {topic}"] },
  { key: "TunCERT", name: "TunCERT (Tunisia)", country: "TN", url: "https://www.tunisiancert.tn", queries: ["site:tunisiancert.tn {topic}"] },
  { key: "CIRT-Ma", name: "CIRT-Ma (Morocco)", country: "MA", url: "https://www.cirt.ma", queries: ["site:cirt.ma {topic}"] },
  // Russia / CIS
  { key: "FSTEC", name: "FSTEC (Russia)", country: "RU", url: "https://fstec.ru", queries: ["site:fstec.ru {topic}"] },
  { key: "CERT-UA-2", name: "SOC (Russia)", country: "RU", url: "https://www.soc.ru", queries: ["{topic} SOC Russia"] },
];

// ---------------------------------------------------------------------------
// i18n keyword dictionary — common OSINT investigation terms in 15 languages
// ---------------------------------------------------------------------------
export interface QueryKeywords {
  /** "profile" / "compte" / "perfil" / "プロフィール" */
  profile: string;
  /** "social media" / "réseaux sociaux" */
  socialMedia: string;
  /** "account" / "compte" / "cuenta" */
  account: string;
  /** "posts" / "publications" / "publicaciones" */
  posts: string;
  /** "photos" / "photos" / "fotos" */
  photos: string;
  /** "contact" / "contact" / "contacto" */
  contact: string;
  /** "address" / "adresse" / "dirección" */
  address: string;
  /** "phone" / "téléphone" / "teléfono" */
  phone: string;
  /** "email" / "courriel" / "correo" */
  email: string;
  /** "biography" / "biographie" / "biografía" */
  biography: string;
  /** "friends" / "amis" / "amigos" */
  friends: string;
  /** "work" / "travail" / "trabajo" */
  work: string;
  /** "school" / "école" / "escuela" */
  school: string;
  /** "location" / "emplacement" / "ubicación" */
  location: string;
  /** "news" / "actualités" / "noticias" */
  news: string;
  /** "forum" / "forum" / "foro" */
  forum: string;
  /** "leak" / "fuite" / "fuga" */
  leak: string;
  /** "breach" / "violation" / "brecha" */
  breach: string;
}

/** Language code → translated keywords */
export const I18N_KEYWORDS: Record<string, QueryKeywords> = {
  en: { profile: "profile", socialMedia: "social media", account: "account", posts: "posts", photos: "photos", contact: "contact", address: "address", phone: "phone", email: "email", biography: "biography", friends: "friends", work: "work", school: "school", location: "location", news: "news", forum: "forum", leak: "leak", breach: "breach" },
  fr: { profile: "profil", socialMedia: "réseaux sociaux", account: "compte", posts: "publications", photos: "photos", contact: "contact", address: "adresse", phone: "téléphone", email: "courriel", biography: "biographie", friends: "amis", work: "travail", school: "école", location: "emplacement", news: "actualités", forum: "forum", leak: "fuite", breach: "violation" },
  es: { profile: "perfil", socialMedia: "redes sociales", account: "cuenta", posts: "publicaciones", photos: "fotos", contact: "contacto", address: "dirección", phone: "teléfono", email: "correo", biography: "biografía", friends: "amigos", work: "trabajo", school: "escuela", location: "ubicación", news: "noticias", forum: "foro", leak: "fuga", breach: "brecha" },
  de: { profile: "profil", socialMedia: "soziale Netzwerke", account: "konto", posts: "beiträge", photos: "fotos", contact: "kontakt", address: "adresse", phone: "telefon", email: "e-mail", biography: "biografie", friends: "freunde", work: "arbeit", school: "schule", location: "standort", news: "nachrichten", forum: "forum", leak: "leck", breach: "verletzung" },
  pt: { profile: "perfil", socialMedia: "redes sociais", account: "conta", posts: "publicações", photos: "fotos", contact: "contato", address: "endereço", phone: "telefone", email: "e-mail", biography: "biografia", friends: "amigos", work: "trabalho", school: "escola", location: "localização", news: "notícias", forum: "fórum", leak: "vazamento", breach: "violação" },
  it: { profile: "profilo", socialMedia: "social media", account: "account", posts: "post", photos: "foto", contact: "contatto", address: "indirizzo", phone: "telefono", email: "email", biography: "biografia", friends: "amici", work: "lavoro", school: "scuola", location: "posizione", news: "notizie", forum: "forum", leak: "fuga", breach: "violazione" },
  nl: { profile: "profiel", socialMedia: "sociale media", account: "account", posts: "berichten", photos: "foto's", contact: "contact", address: "adres", phone: "telefoon", email: "e-mail", biography: "biografie", friends: "vrienden", work: "werk", school: "school", location: "locatie", news: "nieuws", forum: "forum", leak: "lek", breach: "schending" },
  ru: { profile: "профиль", socialMedia: "социальные сети", account: "аккаунт", posts: "посты", photos: "фото", contact: "контакт", address: "адрес", phone: "телефон", email: "почта", biography: "биография", friends: "друзья", work: "работа", school: "школа", location: "местоположение", news: "новости", forum: "форум", leak: "утечка", breach: "нарушение" },
  uk: { profile: "профіль", socialMedia: "соціальні мережі", account: "акаунт", posts: "публікації", photos: "фото", contact: "контакт", address: "адреса", phone: "телефон", email: "пошта", biography: "біографія", friends: "друзі", work: "робота", school: "школа", location: "місцезнаходження", news: "новини", forum: "форум", leak: "витік", breach: "порушення" },
  ar: { profile: "ملف شخصي", socialMedia: "وسائل التواصل الاجتماعي", account: "حساب", posts: "منشورات", photos: "صور", contact: "اتصال", address: "عنوان", phone: "هاتف", email: "بريد إلكتروني", biography: "سيرة ذاتية", friends: "أصدقاء", work: "عمل", school: "مدرسة", location: "موقع", news: "أخبار", forum: "منتدى", leak: "تسريب", breach: "اختراق" },
  zh: { profile: "个人资料", socialMedia: "社交媒体", account: "账户", posts: "帖子", photos: "照片", contact: "联系", address: "地址", phone: "电话", email: "电子邮件", biography: "简介", friends: "好友", work: "工作", school: "学校", location: "位置", news: "新闻", forum: "论坛", leak: "泄露", breach: "入侵" },
  ja: { profile: "プロフィール", socialMedia: "ソーシャルメディア", account: "アカウント", posts: "投稿", photos: "写真", contact: "連絡先", address: "住所", phone: "電話", email: "メール", biography: "経歴", friends: "友達", work: "仕事", school: "学校", location: "場所", news: "ニュース", forum: "掲示板", leak: "漏洩", breach: "侵害" },
  ko: { profile: "프로필", socialMedia: "소셜 미디어", account: "계정", posts: "게시물", photos: "사진", contact: "연락처", address: "주소", phone: "전화", email: "이메일", biography: "약력", friends: "친구", work: "직장", school: "학교", location: "위치", news: "뉴스", forum: "포럼", leak: "유출", breach: "침해" },
  tr: { profile: "profil", socialMedia: "sosyal medya", account: "hesap", posts: "gönderiler", photos: "fotoğraflar", contact: "iletişim", address: "adres", phone: "telefon", email: "e-posta", biography: "biyografi", friends: "arkadaşlar", work: "iş", school: "okul", location: "konum", news: "haberler", forum: "forum", leak: "sızıntı", breach: "ihlal" },
  fa: { profile: "پروفایل", socialMedia: "شبکه های اجتماعی", account: "حساب", posts: "پست ها", photos: "عکس ها", contact: "تماس", address: "آدرس", phone: "تلفن", email: "ایمیل", biography: "بیوگرافی", friends: "دوستان", work: "کار", school: "مدرسه", location: "موقعیت", news: "اخبار", forum: "انجمن", leak: "نشت", breach: "نفوذ" },
  hi: { profile: "प्रोफ़ाइल", socialMedia: "सोशल मीडिया", account: "खाता", posts: "पोस्ट", photos: "फ़ोटो", contact: "संपर्क", address: "पता", phone: "फ़ोन", email: "ईमेल", biography: "जीवनी", friends: "दोस्त", work: "काम", school: "स्कूल", location: "स्थान", news: "समाचार", forum: "फ़ोरम", leak: "लीक", breach: "उल्लंघन" },
  vi: { profile: "hồ sơ", socialMedia: "mạng xã hội", account: "tài khoản", posts: "bài đăng", photos: "ảnh", contact: "liên hệ", address: "địa chỉ", phone: "điện thoại", email: "email", biography: "tiểu sử", friends: "bạn bè", work: "công việc", school: "trường", location: "vị trí", news: "tin tức", forum: "diễn đàn", leak: "rò rỉ", breach: "vi phạm" },
  th: { profile: "โปรไฟล์", socialMedia: "โซเชียลมีเดีย", account: "บัญชี", posts: "โพสต์", photos: "รูปภาพ", contact: "ติดต่อ", address: "ที่อยู่", phone: "โทรศัพท์", email: "อีเมล", biography: "ประวัติ", friends: "เพื่อน", work: "งาน", school: "โรงเรียน", location: "ตำแหน่ง", news: "ข่าว", forum: "ฟอรั่ม", leak: "รั่วไหล", breach: "ละเมิด" },
  id: { profile: "profil", socialMedia: "media sosial", account: "akun", posts: "postingan", photos: "foto", contact: "kontak", address: "alamat", phone: "telepon", email: "email", biography: "biografi", friends: "teman", work: "kerja", school: "sekolah", location: "lokasi", news: "berita", forum: "forum", leak: "kebocoran", breach: "pelanggaran" },
  pl: { profile: "profil", socialMedia: "media społecznościowe", account: "konto", posts: "posty", photos: "zdjęcia", contact: "kontakt", address: "adres", phone: "telefon", email: "e-mail", biography: "biografia", friends: "znajomi", work: "praca", school: "szkoła", location: "lokalizacja", news: "wiadomości", forum: "forum", leak: "wyciek", breach: "naruszenie" },
  sv: { profile: "profil", socialMedia: "sociala medier", account: "konto", posts: "inlägg", photos: "foton", contact: "kontakt", address: "adress", phone: "telefon", email: "e-post", biography: "biografi", friends: "vänner", work: "arbete", school: "skola", location: "plats", news: "nyheter", forum: "forum", leak: "läcka", breach: "intrång" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a Country by ISO code, with fallback to US */
export function getCountry(code?: string | null): Country {
  if (!code) return COUNTRIES.find((c) => c.code === "US")!;
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? COUNTRIES.find((c) => c.code === "US")!;
}

/** Get the i18n keyword set for a language code, fallback to English */
export function getKeywords(lang?: string | null): QueryKeywords {
  if (!lang) return I18N_KEYWORDS.en;
  return I18N_KEYWORDS[lang.toLowerCase()] ?? I18N_KEYWORDS.en;
}

/** Pick the best primary language for a country (first in its languages array) */
export function getPrimaryLanguage(code?: string | null): string {
  const c = getCountry(code);
  return c.languages[0] ?? "en";
}

/** Get regional platforms for a country (Country.regionalPlatforms → RegionalPlatform objects) */
export function getRegionalPlatforms(countryCode?: string | null): RegionalPlatform[] {
  const c = getCountry(countryCode);
  return c.regionalPlatforms
    .map((key) => REGIONAL_PLATFORMS[key])
    .filter(Boolean);
}

/** Get CERT sources for a country */
export function getCertSources(countryCode?: string | null): CertSource[] {
  const c = getCountry(countryCode);
  return c.certSources
    .map((key) => CERT_SOURCES.find((s) => s.key === key))
    .filter(Boolean) as CertSource[];
}

/** Group countries by region for UI dropdowns */
export function getCountriesByRegion(): Record<string, Country[]> {
  const groups: Record<string, Country[]> = {};
  for (const c of COUNTRIES) {
    if (!groups[c.region]) groups[c.region] = [];
    groups[c.region].push(c);
  }
  return groups;
}

/** Total counts for UI badges */
export const COUNTRY_COUNT = COUNTRIES.length;
export const PLATFORM_COUNT = Object.keys(REGIONAL_PLATFORMS).length;
export const CERT_COUNT = CERT_SOURCES.length;
export const LANGUAGE_COUNT = Object.keys(I18N_KEYWORDS).length;
