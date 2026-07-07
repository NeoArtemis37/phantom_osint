// =============================================================================
// PHANTOM — External OSINT Lookup Engine
// =============================================================================
// A unified directory of 49 external GitHub OSINT projects + commercial
// intel APIs that PHANTOM can deep-link into and run search-augmented
// lookups against. Each entry knows:
//
//   • which input types it accepts (username, email, phone, domain, ip,
//     image, name) — drives the type-filtered tool list per query
//   • how to build a direct deep-link URL pre-filled with the target value
//     (so analysts can click straight through to the tool's pre-populated
//     results page)
//   • how to build a `web_search` query that surfaces what the tool has
//     already publicly reported about the target (cross-cuts the open web)
//
// Used by:
//   • POST /api/osint/external-lookup  → fans out one search per tool
//   • <ExternalLookupPanel />         → cyberpunk "External" tab in OSINT tools
//
// author: artemis37
// =============================================================================

import type { CatalogCategory } from '@/lib/osint-catalog';

// ---------------------------------------------------------------------------
// Input-type union — what kinds of target values a tool accepts
// ---------------------------------------------------------------------------
export type ExternalInputType =
  | 'username'
  | 'email'
  | 'phone'
  | 'domain'
  | 'ip'
  | 'image'
  | 'name';

// ---------------------------------------------------------------------------
// ExternalTool — a single external OSINT project / API
// ---------------------------------------------------------------------------
export interface ExternalTool {
  /** Stable slug identifier (e.g. 'shodan', 'haveibeenpwned') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Mirrors the osint-catalog category taxonomy */
  category: CatalogCategory;
  /** Repo "owner/name" if GitHub-hosted (omitted for SaaS-only tools) */
  githubRef?: string;
  /** Canonical site / product URL (the tool's home page) */
  url: string;
  /** One-sentence description */
  description: string;
  /** Input types this tool accepts — drives type-filtered dispatch */
  inputTypes: ExternalInputType[];
  /**
   * Build a direct deep-link URL pre-filled with the target value, or null
   * if the tool has no direct lookup endpoint (e.g. CLI-only tools).
   */
  buildDeepLink: (value: string) => string | null;
  /**
   * Build a `web_search` query that finds what this tool has reported
   * about the target across the open web.
   */
  buildSearchQuery: (value: string) => string;
}

// ---------------------------------------------------------------------------
// The catalog — 49 external tools (one per phantomModule:'External Lookup')
// ---------------------------------------------------------------------------
export const EXTERNAL_TOOLS: ExternalTool[] = [
  // ===== USERNAME ENUMERATION =====
  {
    id: 'blackbird',
    name: 'Blackbird',
    category: 'username',
    githubRef: 'p1ngul1n0/blackbird',
    url: 'https://github.com/p1ngul1n0/blackbird',
    description: 'OSINT tool to search for accounts by username across 600+ websites with an interactive UI.',
    inputTypes: ['username', 'name'],
    buildDeepLink: () => 'https://github.com/p1ngul1n0/blackbird',
    buildSearchQuery: (v) => `blackbird "${v}" username`,
  },
  {
    id: 'osint-industries',
    name: "Malfrat's OSINT Industries",
    category: 'username',
    githubRef: 'malfrat/osint-industries',
    url: 'https://github.com/malfrat/osint-industries',
    description: "Malfrat's curated OSINT Industries toolkit — username-to-account mapper inspired by the paid service.",
    inputTypes: ['username', 'email', 'name'],
    buildDeepLink: () => 'https://github.com/malfrat/osint-industries',
    buildSearchQuery: (v) => `osint industries "${v}"`,
  },
  {
    id: 'duki',
    name: 'Duki',
    category: 'username',
    githubRef: 'targetsec/duki',
    url: 'https://github.com/targetsec/duki',
    description: 'Username lookup tool that scans 200+ forums and platforms in parallel.',
    inputTypes: ['username', 'name'],
    buildDeepLink: () => 'https://github.com/targetsec/duki',
    buildSearchQuery: (v) => `duki "${v}" username`,
  },

  // ===== SOCIAL =====
  {
    id: 'osint-secrets',
    name: 'OSINT-Secrets',
    category: 'social',
    githubRef: 'WebBreacher/OSINT-Secrets',
    url: 'https://github.com/WebBreacher/OSINT-Secrets',
    description: 'Hidden API endpoints and secrets discovered across social platforms and apps.',
    inputTypes: ['username', 'email', 'domain'],
    buildDeepLink: () => 'https://github.com/WebBreacher/OSINT-Secrets',
    buildSearchQuery: (v) => `osint secrets "${v}"`,
  },
  {
    id: 'twint',
    name: 'Twint',
    category: 'social',
    githubRef: 'twintproject/twint',
    url: 'https://github.com/twintproject/twint',
    description: 'Twitter scraping without API limits — tweets, followers and timelines from a handle.',
    inputTypes: ['username', 'name'],
    buildDeepLink: () => 'https://github.com/twintproject/twint',
    buildSearchQuery: (v) => `twint "${v}" twitter`,
  },
  {
    id: 'instaloader',
    name: 'Instaloader',
    category: 'social',
    githubRef: 'instaloader/instaloader',
    url: 'https://github.com/instaloader/instaloader',
    description: 'Download pictures, videos and metadata from Instagram profiles, hashtags and stories.',
    inputTypes: ['username'],
    buildDeepLink: () => 'https://github.com/instaloader/instaloader',
    buildSearchQuery: (v) => `instaloader "${v}" instagram`,
  },
  {
    id: 'instagram-osint',
    name: 'Instagram-OSINT',
    category: 'social',
    githubRef: 'sc1341/Instagram-OSINT',
    url: 'https://github.com/sc1341/Instagram-OSINT',
    description: 'Passive Instagram OSINT — scrape public profile data without logging in.',
    inputTypes: ['username'],
    buildDeepLink: () => 'https://github.com/sc1341/Instagram-OSINT',
    buildSearchQuery: (v) => `instagram osint "${v}"`,
  },
  {
    id: 'telegram-osint',
    name: 'Telegram OSINT',
    category: 'social',
    githubRef: 'TheRealBryan/telegram-osint',
    url: 'https://github.com/TheRealBryan/telegram-osint',
    description: 'Telegram group and channel OSINT — members, forwards and message history.',
    inputTypes: ['username', 'phone', 'name'],
    buildDeepLink: (v) => `https://t.me/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `telegram "${v}" t.me`,
  },
  {
    id: 'snapchat-osint',
    name: 'Snapchat OSINT',
    category: 'social',
    githubRef: 'nullptr-zhang/snapchat-osint',
    url: 'https://github.com/nullptr-zhang/snapchat-osint',
    description: 'Snapchat Snap Map & public profile OSINT — location pins and story snapshots.',
    inputTypes: ['username', 'name'],
    buildDeepLink: (v) => `https://snapchat.com/add/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `snapchat "${v}"`,
  },
  {
    id: 'slack-osint',
    name: 'Slack OSINT',
    category: 'social',
    githubRef: 'sc1391/Slack-OSINT',
    url: 'https://github.com/sc1391/Slack-OSINT',
    description: 'Enumerate public Slack workspaces, channels and leaked invite links.',
    inputTypes: ['username', 'domain', 'email'],
    buildDeepLink: () => 'https://github.com/sc1391/Slack-OSINT',
    buildSearchQuery: (v) => `slack "${v}" workspace`,
  },
  {
    id: 'doppelganger',
    name: 'DoppelGanger',
    category: 'social',
    githubRef: 'm0nad/DoppelGanger',
    url: 'https://github.com/m0nad/DoppelGanger',
    description: 'Find social-media impersonators — detects visually similar profile photos and handles.',
    inputTypes: ['username', 'name', 'image'],
    buildDeepLink: () => 'https://github.com/m0nad/DoppelGanger',
    buildSearchQuery: (v) => `doppelganger "${v}" impersonator`,
  },

  // ===== PHONE =====
  {
    id: 'phonetracker',
    name: 'PhoneTracker',
    category: 'phone',
    githubRef: 'sundowndev/PhoneTracker',
    url: 'https://github.com/sundowndev/PhoneTracker',
    description: 'Phone number carrier/region lookup and reputation scanner.',
    inputTypes: ['phone'],
    buildDeepLink: () => 'https://github.com/sundowndev/PhoneTracker',
    buildSearchQuery: (v) => `phone tracker "${v}"`,
  },
  {
    id: 'phone-number-toolkit',
    name: 'Phone Number Toolkit',
    category: 'phone',
    githubRef: 'xillwillx/phone-number-toolkit',
    url: 'https://github.com/xillwillx/phone-number-toolkit',
    description: 'Reverse-lookup a phone number across free public directories and HLR lookups.',
    inputTypes: ['phone'],
    buildDeepLink: () => 'https://github.com/xillwillx/phone-number-toolkit',
    buildSearchQuery: (v) => `phone number toolkit "${v}"`,
  },

  // ===== EMAIL =====
  {
    id: 'theharvester',
    name: 'theHarvester',
    category: 'email',
    githubRef: 'laramies/theHarvester',
    url: 'https://github.com/laramies/theHarvester',
    description: 'E-mail, subdomain and name harvester using 30+ passive data sources.',
    inputTypes: ['email', 'domain', 'name'],
    buildDeepLink: () => 'https://github.com/laramies/theHarvester',
    buildSearchQuery: (v) => `theHarvester "${v}"`,
  },
  {
    id: 'holehe',
    name: 'Holehe',
    category: 'email',
    githubRef: 'megadose/holehe',
    url: 'https://github.com/megadose/holehe',
    description: 'Check if an email is attached to any account on 120+ services without sending an email.',
    inputTypes: ['email'],
    buildDeepLink: () => 'https://github.com/megadose/holehe',
    buildSearchQuery: (v) => `holehe "${v}"`,
  },
  {
    id: 'verify-email',
    name: 'verify-email',
    category: 'email',
    githubRef: 'JaredECobb/verify-email',
    url: 'https://github.com/JaredECobb/verify-email',
    description: 'Lightweight SMTP-based email existence verifier with disposable-domain detection.',
    inputTypes: ['email'],
    buildDeepLink: () => null,
    buildSearchQuery: (v) => `"${v}" email verify SMTP`,
  },
  {
    id: 'emailrep',
    name: 'emailrep.io',
    category: 'email',
    url: 'https://emailrep.io',
    description: 'Community email reputation API aggregating breach, fraud and phishing signals.',
    inputTypes: ['email'],
    buildDeepLink: (v) => `https://emailrep.io/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:emailrep.io "${v}"`,
  },
  {
    id: 'disposable-email-domains',
    name: 'Disposable Email Domains',
    category: 'email',
    githubRef: 'martenson/disposable-email-domains',
    url: 'https://github.com/martenson/disposable-email-domains',
    description: 'Block-list of disposable and temporary email domains for OSINT triage.',
    inputTypes: ['email', 'domain'],
    buildDeepLink: () => null,
    buildSearchQuery: (v) => `"${v}" disposable email domain`,
  },

  // ===== DOMAIN =====
  {
    id: 'isitup',
    name: 'isitup',
    category: 'domain',
    githubRef: 'AlisamTechnology/isitup',
    url: 'https://github.com/AlisamTechnology/isitup',
    description: 'Check whether a target host/domain is up and resolves — fast passive uptime probe.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://isitup.org/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `isitup "${v}"`,
  },
  {
    id: 'shodan',
    name: 'Shodan',
    category: 'domain',
    url: 'https://www.shodan.io',
    description: 'Search engine for Internet-connected devices — banner, port and certificate data at scale.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://www.shodan.io/search?query=${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:shodan.io "${v}"`,
  },
  {
    id: 'censys',
    name: 'Censys',
    category: 'domain',
    url: 'https://censys.io',
    description: 'Continuous internet-wide scanning — certificates, hosts and service banners.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:censys.io "${v}"`,
  },
  {
    id: 'urlscan',
    name: 'urlscan.io',
    category: 'domain',
    url: 'https://urlscan.io',
    description: 'Service to scan and analyse websites — screenshots, DOM, network requests and verdicts.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://urlscan.io/search/#${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:urlscan.io "${v}"`,
  },
  {
    id: 'securitytrails',
    name: 'SecurityTrails',
    category: 'domain',
    url: 'https://securitytrails.com',
    description: 'DNS history, subdomain enumeration and WHOIS intelligence platform.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://securitytrails.com/list/apex_domain/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:securitytrails.com "${v}"`,
  },
  {
    id: 'viewdns',
    name: 'ViewDNS',
    category: 'domain',
    url: 'https://viewdns.info',
    description: 'Free DNS toolkit — reverse IP, WHOIS, port scan, DNS history and 25+ lookup tools.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://viewdns.info/reverseip/?host=${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `viewdns.info "${v}"`,
  },
  {
    id: 'dnsdumpster',
    name: 'DNSDumpster',
    category: 'domain',
    url: 'https://dnsdumpster.com',
    description: 'DNS recon & research map — visual subdomain graph from authoritative records.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: () => 'https://dnsdumpster.com/',
    buildSearchQuery: (v) => `dnsdumpster "${v}"`,
  },
  {
    id: 'whoisxml',
    name: 'WhoisXML',
    category: 'domain',
    url: 'https://www.whoisxmlapi.com',
    description: 'WHOIS, DNS and threat-feed APIs for 1B+ domains with historical records.',
    inputTypes: ['domain', 'ip'],
    buildDeepLink: (v) => `https://www.whoisxmlapi.com/whoisserver/WhoisService?domainName=${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `whois "${v}"`,
  },

  // ===== IMAGE =====
  {
    id: 'exiftool',
    name: 'ExifTool',
    category: 'image',
    url: 'https://exiftool.org',
    description: 'Read, write and edit EXIF/GPS/IPTC metadata in images and documents.',
    inputTypes: ['image'],
    buildDeepLink: () => 'https://exiftool.org/',
    buildSearchQuery: (v) => `exiftool "${v}" metadata EXIF`,
  },
  {
    id: 'photo-forensics',
    name: 'Photo Forensics',
    category: 'image',
    githubRef: 'ForensicNPC/photo-forensics',
    url: 'https://github.com/ForensicNPC/photo-forensics',
    description: 'Image forensics — error-level analysis, noise residual and clone detection.',
    inputTypes: ['image'],
    buildDeepLink: () => 'https://github.com/ForensicNPC/photo-forensics',
    buildSearchQuery: (v) => `photo forensics "${v}" error level analysis`,
  },

  // ===== BREACH =====
  {
    id: 'haveibeenpwned',
    name: 'Have I Been Pwned',
    category: 'breach',
    url: 'https://haveibeenpwned.com',
    description: 'Check if an email or phone has appeared in known data breaches.',
    inputTypes: ['email', 'phone', 'username'],
    buildDeepLink: (v) => `https://haveibeenpwned.com/account/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:haveibeenpwned.com "${v}"`,
  },
  {
    id: 'intelx',
    name: 'Intelligence-X',
    category: 'breach',
    url: 'https://intelx.io',
    description: 'Search engine for leaks, breaches and darknet datasets — pastes, dumps and leaked credentials.',
    inputTypes: ['email', 'username', 'domain', 'phone', 'name'],
    buildDeepLink: (v) => `https://intelx.io/?s=${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:intelx.io "${v}"`,
  },
  {
    id: 'breach-compilation-index',
    name: 'Breach Compilation Index',
    category: 'breach',
    githubRef: 'krlabsco/breach-compilation-index',
    url: 'https://github.com/krlabsco/breach-compilation-index',
    description: 'Indexed search interface over public breach-compilation dumps (BTC/COMB/etc.).',
    inputTypes: ['email', 'username'],
    buildDeepLink: () => 'https://github.com/krlabsco/breach-compilation-index',
    buildSearchQuery: (v) => `breach compilation "${v}"`,
  },
  {
    id: 'pwndb',
    name: 'pwndb',
    category: 'breach',
    githubRef: 'davidtavarez/pwndb',
    url: 'https://github.com/davidtavarez/pwndb',
    description: 'Query the dark-web pwndb leak database for leaked email/password pairs.',
    inputTypes: ['email', 'username'],
    buildDeepLink: () => 'https://github.com/davidtavarez/pwndb',
    buildSearchQuery: (v) => `pwndb "${v}" leak`,
  },

  // ===== GEOLOCATION =====
  {
    id: 'wigle',
    name: 'WiGLE',
    category: 'geolocation',
    url: 'https://wigle.net',
    description: 'Wireless geographic logging engine — 1B+ Wi-Fi networks mapped worldwide.',
    inputTypes: ['domain', 'ip', 'name'],
    buildDeepLink: () => 'https://wigle.net/search',
    buildSearchQuery: (v) => `wigle "${v}"`,
  },
  {
    id: 'google-earth-osint',
    name: 'Google Earth OSINT',
    category: 'geolocation',
    url: 'https://earth.google.com',
    description: 'Satellite imagery and historical aerial views for geolocation verification of photos.',
    inputTypes: ['domain', 'name', 'image'],
    buildDeepLink: (v) => `https://earth.google.com/web/search/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `google earth "${v}"`,
  },
  {
    id: 'bertoldvdb-geolocation',
    name: 'BertoldVdb/geolocation',
    category: 'geolocation',
    githubRef: 'BertoldVdb/geolocation',
    url: 'https://github.com/BertoldVdb/geolocation',
    description: 'Cross-reference EXIF GPS, IP geolocation and Wi-Fi BSSID for a unified location fix.',
    inputTypes: ['image', 'ip', 'domain'],
    buildDeepLink: () => 'https://github.com/BertoldVdb/geolocation',
    buildSearchQuery: (v) => `geolocation "${v}" EXIF GPS`,
  },

  // ===== DOCUMENTS =====
  {
    id: 'pywhat',
    name: 'PyWhat',
    category: 'documents',
    githubRef: 'bee-san/pywhat',
    url: 'https://github.com/bee-san/pywhat',
    description: 'Identify anything in a file or text — emails, IBANs, MACs, hashes, and 600+ regex IDs.',
    inputTypes: ['email', 'phone', 'domain', 'ip', 'username', 'name'],
    buildDeepLink: () => 'https://github.com/bee-san/pywhat',
    buildSearchQuery: (v) => `pywhat "${v}" identify`,
  },
  {
    id: 'metagoofil',
    name: 'Metagoofil',
    category: 'documents',
    githubRef: 'opsdisk/metagoofil',
    url: 'https://github.com/opsdisk/metagoofil',
    description: 'Metadata extraction tool — pulls PDFs, DOCs and XLSs from a domain and extracts author data.',
    inputTypes: ['domain', 'email', 'name'],
    buildDeepLink: () => 'https://github.com/opsdisk/metagoofil',
    buildSearchQuery: (v) => `metagoofil "${v}" metadata`,
  },
  {
    id: 'document-metadata',
    name: 'Document-Metadata',
    category: 'documents',
    githubRef: 'ForensicNPC/Document-Metadata',
    url: 'https://github.com/ForensicNPC/Document-Metadata',
    description: 'Office and PDF metadata extractor — author, revision timestamps, tracked changes.',
    inputTypes: ['domain', 'email', 'image'],
    buildDeepLink: () => 'https://github.com/ForensicNPC/Document-Metadata',
    buildSearchQuery: (v) => `document metadata "${v}"`,
  },

  // ===== THREAT INTEL =====
  {
    id: 'abuseipdb',
    name: 'AbuseIPDB',
    category: 'threat-intel',
    url: 'https://www.abuseipdb.com',
    description: 'IP abuse-report database — confidence-scored reputation for any IPv4/IPv6 address.',
    inputTypes: ['ip', 'domain'],
    buildDeepLink: (v) => `https://www.abuseipdb.com/check/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:abuseipdb.com "${v}"`,
  },
  {
    id: 'alienvault-otx',
    name: 'AlienVault OTX',
    category: 'threat-intel',
    url: 'https://otx.alienvault.com',
    description: 'Open Threat Exchange — community-sourced IOCs, pulses and TTPs from 200k+ contributors.',
    inputTypes: ['ip', 'domain', 'email'],
    buildDeepLink: (v) => `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:otx.alienvault.com "${v}"`,
  },
  {
    id: 'virustotal',
    name: 'VirusTotal',
    category: 'threat-intel',
    url: 'https://www.virustotal.com',
    description: 'Aggregate 70+ AV engines and URL/file reputation feeds in a single verdict.',
    inputTypes: ['domain', 'ip', 'email', 'username'],
    buildDeepLink: (v) => `https://www.virustotal.com/gui/search/${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `site:virustotal.com "${v}"`,
  },
  {
    id: 'threat-fox',
    name: 'ThreatFox',
    category: 'threat-intel',
    url: 'https://threatfox.abuse.ch',
    description: 'Community IOC database mapping indicators to APT groups and malware families.',
    inputTypes: ['ip', 'domain', 'email'],
    buildDeepLink: (v) => `https://threatfox.abuse.ch/browse.php?search=ioc%3A${encodeURIComponent(v)}`,
    buildSearchQuery: (v) => `threatfox "${v}"`,
  },

  // ===== DARKWEB =====
  {
    id: 'proxy',
    name: 'PROXY',
    category: 'darkweb',
    githubRef: 'TheSpeedX/PROXY',
    url: 'https://github.com/TheSpeedX/PROXY',
    description: 'Fast HTTP/SOCKS proxy scraper & checker — useful for accessing darknet mirrors safely.',
    inputTypes: ['ip', 'domain'],
    buildDeepLink: () => 'https://github.com/TheSpeedX/PROXY',
    buildSearchQuery: (v) => `proxy list "${v}"`,
  },
  {
    id: 'torbot',
    name: 'TorBot',
    category: 'darkweb',
    githubRef: 'DedSecInside/TorBot',
    url: 'https://github.com/DedSecInside/TorBot',
    description: 'Dark web OSINT crawler — onion-site enumeration, link graph and keyword monitoring.',
    inputTypes: ['domain', 'username', 'name'],
    buildDeepLink: () => 'https://github.com/DedSecInside/TorBot',
    buildSearchQuery: (v) => `torbot "${v}" darkweb`,
  },
  {
    id: 'hacking-tools-repository',
    name: 'Hacking-Tools-Repository',
    category: 'darkweb',
    githubRef: 's-3-5/Hacking-Tools-Repository',
    url: 'https://github.com/s-3-5/Hacking-Tools-Repository',
    description: 'Curated darkweb & OSINT toolkit index — paste sites, leak boards and paste mirrors.',
    inputTypes: ['domain', 'username', 'email', 'ip', 'name'],
    buildDeepLink: () => 'https://github.com/s-3-5/Hacking-Tools-Repository',
    buildSearchQuery: (v) => `darkweb tools "${v}"`,
  },

  // ===== PEOPLE =====
  {
    id: 'deepfind',
    name: 'deepfind.me',
    category: 'people',
    url: 'https://deepfind.me/tools',
    description: 'Multi-tool OSINT suite — people lookup, username search, phone/email reverse and more.',
    inputTypes: ['name', 'username', 'email', 'phone'],
    buildDeepLink: () => 'https://deepfind.me/tools',
    buildSearchQuery: (v) => `site:deepfind.me "${v}"`,
  },
  {
    id: 'cyber-detect',
    name: 'Cyber-Detect',
    category: 'people',
    githubRef: 'sacr3d/Cyber-Detect',
    url: 'https://github.com/sacr3d/Cyber-Detect',
    description: 'All-in-one people investigation framework — name → email → social → breach correlation.',
    inputTypes: ['name', 'username', 'email'],
    buildDeepLink: () => 'https://github.com/sacr3d/Cyber-Detect',
    buildSearchQuery: (v) => `cyber detect "${v}"`,
  },
  {
    id: 'osint-persona-search',
    name: 'osint-persona-search',
    category: 'people',
    githubRef: 'WebBreacher/osint-persona-search',
    url: 'https://github.com/WebBreacher/osint-persona-search',
    description: 'Build a digital persona from a single name — aggregates 50+ free people-search engines.',
    inputTypes: ['name', 'username', 'email'],
    buildDeepLink: () => 'https://github.com/WebBreacher/osint-persona-search',
    buildSearchQuery: (v) => `persona search "${v}"`,
  },
  {
    id: 'awesome-osint',
    name: 'awesome-osint',
    category: 'people',
    githubRef: 'jivoi/awesome-osint',
    url: 'https://github.com/jivoi/awesome-osint',
    description: 'Curated list of 1000+ OSINT resources, tools and techniques — the OSINT community index.',
    inputTypes: ['name', 'username', 'email', 'phone', 'domain', 'ip', 'image'],
    buildDeepLink: () => 'https://github.com/jivoi/awesome-osint',
    buildSearchQuery: (v) => `awesome osint "${v}"`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return only the tools that accept the given input type. Used by the
 * external-lookup route to fan out one parallel search per matching tool.
 */
export function getToolsForInputType(type: string): ExternalTool[] {
  return EXTERNAL_TOOLS.filter((t) => t.inputTypes.includes(type as ExternalInputType));
}

/**
 * Total count of external tools (used by the panel's empty state).
 */
export function getExternalToolCount(): number {
  return EXTERNAL_TOOLS.length;
}

/**
 * Return the static descriptor (id, name, category, url, description,
 * githubRef) for a tool — the fields that are safe to send to the client
 * even without invoking the SDK.
 */
export function getToolDescriptor(tool: ExternalTool) {
  return {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    url: tool.url,
    description: tool.description,
    githubRef: tool.githubRef,
  };
}
