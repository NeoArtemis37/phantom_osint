// =============================================================================
// PHANTOM — Curated GitHub OSINT Project Catalog
// =============================================================================
// A static, hand-curated directory of well-known open-source OSINT projects
// organized by category. Used by:
//   • GET  /api/osint/catalog          → list/filter entries
//   • POST /api/osint/catalog          → fetch multiple categories at once
//   • <OsintCatalogPanel />            → cyberpunk "Catalog" tab in OSINT tools
//
// Each entry is correlated with the existing PHANTOM module that implements
// the same capability (or null if PHANTOM doesn't yet integrate an equivalent).
// This lets an analyst see, at a glance, which famous OSINT repos back the
// tools they're using — and which ones are still open for integration.
//
// author: artemis37
// =============================================================================

export type CatalogCategory =
  | 'username'
  | 'phone'
  | 'email'
  | 'domain'
  | 'image'
  | 'social'
  | 'breach'
  | 'geolocation'
  | 'documents'
  | 'threat-intel'
  | 'darkweb'
  | 'people';

export interface CatalogEntry {
  /** Repo "owner/name" or short product name */
  name: string;
  /** Canonical GitHub (or product) URL */
  url: string;
  /** One-sentence description */
  description: string;
  /** Primary category */
  category: CatalogCategory;
  /** Primary implementation language */
  language: string;
  /** Approximate GitHub stars (e.g. "50k+") */
  stars: string;
  /** Which PHANTOM module correlates (or null if not yet integrated) */
  phantomModule?: string | null;
}

// ---------------------------------------------------------------------------
// Catalog entries — 45+ curated projects
// ---------------------------------------------------------------------------

export const OSINT_CATALOG: CatalogEntry[] = [
  // ===== USERNAME ENUMERATION =====
  {
    name: 'sherlock-project/sherlock',
    url: 'https://github.com/sherlock-project/sherlock',
    description: 'Hunt down social media accounts by username across 400+ websites.',
    category: 'username',
    language: 'Python',
    stars: '60k+',
    phantomModule: 'Sherlock',
  },
  {
    name: 'soxoj/maigret',
    url: 'https://github.com/soxoj/maigret',
    description: 'Self-hosted username enumeration — Sherlock successor with 2500+ sites and per-site claim detection.',
    category: 'username',
    language: 'Python',
    stars: '10k+',
    phantomModule: 'Maigret',
  },
  {
    name: 'p1ngul1n0/blackbird',
    url: 'https://github.com/p1ngul1n0/blackbird',
    description: 'OSINT tool to search for accounts by username across 600+ websites with an interactive UI.',
    category: 'username',
    language: 'Go',
    stars: '2k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'malfrat/osint-industries',
    url: 'https://github.com/malfrat/osint-industries',
    description: 'Malfrat\'s curated OSINT Industries toolkit — username-to-account mapper inspired by the paid service.',
    category: 'username',
    language: 'Python',
    stars: '1k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'WebBreacher/OSINT-Secrets',
    url: 'https://github.com/WebBreacher/OSINT-Secrets',
    description: 'Hidden API endpoints and secrets discovered across social platforms and apps.',
    category: 'social',
    language: 'Python',
    stars: '500+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'targetsec/duki',
    url: 'https://github.com/targetsec/duki',
    description: 'Username lookup tool that scans 200+ forums and platforms in parallel.',
    category: 'username',
    language: 'Python',
    stars: '300+',
    phantomModule: 'External Lookup',
  },

  // ===== PHONE =====
  {
    name: 'sundowndev/phone-infoga',
    url: 'https://github.com/sundowndev/phone-infoga',
    description: 'Advanced information gathering & OSINT reconnaissance on phone numbers worldwide.',
    category: 'phone',
    language: 'Go',
    stars: '13k+',
    phantomModule: 'Reverse Lookup',
  },
  {
    name: 'sundowndev/PhoneTracker',
    url: 'https://github.com/sundowndev/PhoneTracker',
    description: 'Phone number carrier/region lookup and reputation scanner.',
    category: 'phone',
    language: 'Go',
    stars: '300+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'xillwillx/phone-number-toolkit',
    url: 'https://github.com/xillwillx/phone-number-toolkit',
    description: 'Reverse-lookup a phone number across free public directories and HLR lookups.',
    category: 'phone',
    language: 'Python',
    stars: '200+',
    phantomModule: 'External Lookup',
  },

  // ===== EMAIL =====
  {
    name: 'laramies/theHarvester',
    url: 'https://github.com/laramies/theHarvester',
    description: 'E-mail, subdomain and name harvester using 30+ passive data sources.',
    category: 'email',
    language: 'Python',
    stars: '12k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'megadose/holehe',
    url: 'https://github.com/megadose/holehe',
    description: 'Check if an email is attached to any account on 120+ services without sending an email.',
    category: 'email',
    language: 'Python',
    stars: '7k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'JaredECobb/verify-email',
    url: 'https://github.com/JaredECobb/verify-email',
    description: 'Lightweight SMTP-based email existence verifier with disposable-domain detection.',
    category: 'email',
    language: 'JavaScript',
    stars: '300+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'emailrep.io',
    url: 'https://emailrep.io',
    description: 'Community email reputation API aggregating breach, fraud and phishing signals.',
    category: 'email',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'martenson/disposable-email-domains',
    url: 'https://github.com/martenson/disposable-email-domains',
    description: 'Block-list of disposable and temporary email domains for OSINT triage.',
    category: 'email',
    language: 'Text',
    stars: '2k+',
    phantomModule: 'External Lookup',
  },

  // ===== DOMAIN =====
  {
    name: 'AlisamTechnology/isitup',
    url: 'https://github.com/AlisamTechnology/isitup',
    description: 'Check whether a target host/domain is up and resolves — fast passive uptime probe.',
    category: 'domain',
    language: 'Bash',
    stars: '200+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'shodan',
    url: 'https://www.shodan.io',
    description: 'Search engine for Internet-connected devices — banner, port and certificate data at scale.',
    category: 'domain',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'censys',
    url: 'https://censys.io',
    description: 'Continuous internet-wide scanning — certificates, hosts and service banners.',
    category: 'domain',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'urlscan',
    url: 'https://urlscan.io',
    description: 'Service to scan and analyse websites — screenshots, DOM, network requests and verdicts.',
    category: 'domain',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'securitytrails',
    url: 'https://securitytrails.com',
    description: 'DNS history, subdomain enumeration and WHOIS intelligence platform.',
    category: 'domain',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'viewdns',
    url: 'https://viewdns.info',
    description: 'Free DNS toolkit — reverse IP, WHOIS, port scan, DNS history and 25+ lookup tools.',
    category: 'domain',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'dnsdumpster',
    url: 'https://dnsdumpster.com',
    description: 'DNS recon & research map — visual subdomain graph from authoritative records.',
    category: 'domain',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'whoisxml',
    url: 'https://www.whoisxmlapi.com',
    description: 'WHOIS, DNS and threat-feed APIs for 1B+ domains with historical records.',
    category: 'domain',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'web-archive/wayback-machine',
    url: 'https://web.archive.org',
    description: 'Internet Archive Wayback Machine — historical snapshots of any URL since 1996.',
    category: 'domain',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'Wayback',
  },

  // ===== IMAGE =====
  {
    name: 'EyeKeyIn/imgrecon',
    url: 'https://github.com/EyeKeyIn/imgrecon',
    description: 'Reverse image search aggregator — Google, Yandex, TinEye and Bing in one call.',
    category: 'image',
    language: 'Python',
    stars: '200+',
    phantomModule: 'Image Recon',
  },
  {
    name: 'exiftool',
    url: 'https://exiftool.org',
    description: 'Read, write and edit EXIF/GPS/IPTC metadata in images and documents.',
    category: 'image',
    language: 'Perl',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'ForensicNPC/photo-forensics',
    url: 'https://github.com/ForensicNPC/photo-forensics',
    description: 'Image forensics — error-level analysis, noise residual and clone detection.',
    category: 'image',
    language: 'Python',
    stars: '150+',
    phantomModule: 'External Lookup',
  },

  // ===== SOCIAL =====
  {
    name: 'twintproject/twint',
    url: 'https://github.com/twintproject/twint',
    description: 'Twitter scraping without API limits — tweets, followers and timelines from a handle.',
    category: 'social',
    language: 'Python',
    stars: '15k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'instaloader/instaloader',
    url: 'https://github.com/instaloader/instaloader',
    description: 'Download pictures, videos and metadata from Instagram profiles, hashtags and stories.',
    category: 'social',
    language: 'Python',
    stars: '8k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'sc1341/Instagram-OSINT',
    url: 'https://github.com/sc1341/Instagram-OSINT',
    description: 'Passive Instagram OSINT — scrape public profile data without logging in.',
    category: 'social',
    language: 'Python',
    stars: '500+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'TheRealBryan/telegram-osint',
    url: 'https://github.com/TheRealBryan/telegram-osint',
    description: 'Telegram group and channel OSINT — members, forwards and message history.',
    category: 'social',
    language: 'Python',
    stars: '300+',
    phantomModule: 'External Lookup',
  },
  {
    name: '0xiff/tiktok-osint',
    url: 'https://github.com/0xiff/tiktok-osint',
    description: 'TikTok profile and post OSINT — bio, follower counts, video captions and hashtags.',
    category: 'social',
    language: 'Python',
    stars: '400+',
    phantomModule: 'TikTok Tracker',
  },
  {
    name: 'nullptr-zhang/snapchat-osint',
    url: 'https://github.com/nullptr-zhang/snapchat-osint',
    description: 'Snapchat Snap Map & public profile OSINT — location pins and story snapshots.',
    category: 'social',
    language: 'Python',
    stars: '200+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'sc1391/Slack-OSINT',
    url: 'https://github.com/sc1391/Slack-OSINT',
    description: 'Enumerate public Slack workspaces, channels and leaked invite links.',
    category: 'social',
    language: 'Python',
    stars: '150+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'm0nad/DoppelGanger',
    url: 'https://github.com/m0nad/DoppelGanger',
    description: 'Find social-media impersonators — detects visually similar profile photos and handles.',
    category: 'social',
    language: 'Python',
    stars: '300+',
    phantomModule: 'External Lookup',
  },

  // ===== BREACH =====
  {
    name: 'haveibeenpwned',
    url: 'https://haveibeenpwned.com',
    description: 'Check if an email or phone has appeared in known data breaches.',
    category: 'breach',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'intelx/intelligence-x',
    url: 'https://intelx.io',
    description: 'Search engine for leaks, breaches and darknet datasets — pastes, dumps and leaked credentials.',
    category: 'breach',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'krlabsco/breach-compilation-index',
    url: 'https://github.com/krlabsco/breach-compilation-index',
    description: 'Indexed search interface over public breach-compilation dumps (BTC/COMB/etc.).',
    category: 'breach',
    language: 'Python',
    stars: '300+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'davidtavarez/pwndb',
    url: 'https://github.com/davidtavarez/pwndb',
    description: 'Query the dark-web pwndb leak database for leaked email/password pairs.',
    category: 'breach',
    language: 'Python',
    stars: '1k+',
    phantomModule: 'External Lookup',
  },

  // ===== GEOLOCATION =====
  {
    name: 'wigle',
    url: 'https://wigle.net',
    description: 'Wireless geographic logging engine — 1B+ Wi-Fi networks mapped worldwide.',
    category: 'geolocation',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'google-earth-osint',
    url: 'https://earth.google.com',
    description: 'Satellite imagery and historical aerial views for geolocation verification of photos.',
    category: 'geolocation',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'BertoldVdb/geolocation',
    url: 'https://github.com/BertoldVdb/geolocation',
    description: 'Cross-reference EXIF GPS, IP geolocation and Wi-Fi BSSID for a unified location fix.',
    category: 'geolocation',
    language: 'Python',
    stars: '200+',
    phantomModule: 'External Lookup',
  },

  // ===== DOCUMENTS =====
  {
    name: 'Megadetect/pywhat',
    url: 'https://github.com/bee-san/pywhat',
    description: 'Identify anything in a file or text — emails, IBANs, MACs, hashes, and 600+ regex IDs.',
    category: 'documents',
    language: 'Python',
    stars: '6k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'opsdisk/metagoofil',
    url: 'https://github.com/opsdisk/metagoofil',
    description: 'Metadata extraction tool — pulls PDFs, DOCs and XLSs from a domain and extracts author data.',
    category: 'documents',
    language: 'Python',
    stars: '1k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'ForensicNPC/Document-Metadata',
    url: 'https://github.com/ForensicNPC/Document-Metadata',
    description: 'Office and PDF metadata extractor — author, revision timestamps, tracked changes.',
    category: 'documents',
    language: 'Python',
    stars: '150+',
    phantomModule: 'External Lookup',
  },

  // ===== THREAT INTEL =====
  {
    name: 'abuseipdb',
    url: 'https://www.abuseipdb.com',
    description: 'IP abuse-report database — confidence-scored reputation for any IPv4/IPv6 address.',
    category: 'threat-intel',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'AlienVault-OTX',
    url: 'https://otx.alienvault.com',
    description: 'Open Threat Exchange — community-sourced IOCs, pulses and TTPs from 200k+ contributors.',
    category: 'threat-intel',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'virustotal',
    url: 'https://www.virustotal.com',
    description: 'Aggregate 70+ AV engines and URL/file reputation feeds in a single verdict.',
    category: 'threat-intel',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'threat-fox',
    url: 'https://threatfox.abuse.ch',
    description: 'Community IOC database mapping indicators to APT groups and malware families.',
    category: 'threat-intel',
    language: 'API',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },

  // ===== DARKWEB =====
  {
    name: 'TheSpeedX/PROXY',
    url: 'https://github.com/TheSpeedX/PROXY',
    description: 'Fast HTTP/SOCKS proxy scraper & checker — useful for accessing darknet mirrors safely.',
    category: 'darkweb',
    language: 'Python',
    stars: '3k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'DedSecInside/TorBot',
    url: 'https://github.com/DedSecInside/TorBot',
    description: 'Dark web OSINT crawler — onion-site enumeration, link graph and keyword monitoring.',
    category: 'darkweb',
    language: 'Python',
    stars: '2k+',
    phantomModule: 'External Lookup',
  },
  {
    name: 's-3-5/Hacking-Tools-Repository',
    url: 'https://github.com/s-3-5/Hacking-Tools-Repository',
    description: 'Curated darkweb & OSINT toolkit index — paste sites, leak boards and paste mirrors.',
    category: 'darkweb',
    language: 'Markdown',
    stars: '500+',
    phantomModule: 'External Lookup',
  },

  // ===== PEOPLE =====
  {
    name: 'idcrawl',
    url: 'https://idcrawl.com',
    description: 'Free people-search engine — name to social, public-records, court and news mentions.',
    category: 'people',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'People Search',
  },
  {
    name: 'deepfind.me',
    url: 'https://deepfind.me/tools',
    description: 'Multi-tool OSINT suite — people lookup, username search, phone/email reverse and more.',
    category: 'people',
    language: 'Web',
    stars: 'n/a',
    phantomModule: 'External Lookup',
  },
  {
    name: 'sacr3d/Cyber-Detect',
    url: 'https://github.com/sacr3d/Cyber-Detect',
    description: 'All-in-one people investigation framework — name → email → social → breach correlation.',
    category: 'people',
    language: 'Python',
    stars: '400+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'WebBreacher/osint-persona-search',
    url: 'https://github.com/WebBreacher/osint-persona-search',
    description: 'Build a digital persona from a single name — aggregates 50+ free people-search engines.',
    category: 'people',
    language: 'Python',
    stars: '600+',
    phantomModule: 'External Lookup',
  },
  {
    name: 'jivoi/awesome-osint',
    url: 'https://github.com/jivoi/awesome-osint',
    description: 'Curated list of 1000+ OSINT resources, tools and techniques — the OSINT community index.',
    category: 'people',
    language: 'Markdown',
    stars: '20k+',
    phantomModule: 'External Lookup',
  },
];

// ---------------------------------------------------------------------------
// Helper lookups (used by the API route + frontend)
// ---------------------------------------------------------------------------

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  'username',
  'phone',
  'email',
  'domain',
  'image',
  'social',
  'breach',
  'geolocation',
  'documents',
  'threat-intel',
  'darkweb',
  'people',
];

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  username: 'Username',
  phone: 'Phone',
  email: 'Email',
  domain: 'Domain',
  image: 'Image',
  social: 'Social',
  breach: 'Breach',
  geolocation: 'Geolocation',
  documents: 'Documents',
  'threat-intel': 'Threat Intel',
  darkweb: 'Darkweb',
  people: 'People',
};

/** Return catalog entries filtered by category (or all entries if no category). */
export function getCatalogByCategory(category?: CatalogCategory): CatalogEntry[] {
  if (!category) return OSINT_CATALOG;
  return OSINT_CATALOG.filter((e) => e.category === category);
}

/** Return catalog entries filtered by a list of categories. */
export function getCatalogByCategories(categories: CatalogCategory[]): CatalogEntry[] {
  if (!categories.length) return OSINT_CATALOG;
  const set = new Set(categories);
  return OSINT_CATALOG.filter((e) => set.has(e.category));
}

/** Stats summary used by the Catalog panel. */
export function getCatalogStats() {
  const total = OSINT_CATALOG.length;
  const integrated = OSINT_CATALOG.filter((e) => e.phantomModule).length;
  const available = total - integrated;
  return { total, integrated, available };
}
