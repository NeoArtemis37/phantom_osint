// =============================================================================
// SHERLOCK Platform Directory — Sherlock-style username enumeration
// =============================================================================
// Mirrors the structure of the real Sherlock Project (sherlock-project/sherlock)
// data.json: each entry has a URL template with a `{}` placeholder, an error
// detection strategy, and rank. This is intentionally a DIFFERENT shape from
// the Maigret OSINT_PLATFORMS list so the two tools complement each other.
// =============================================================================

export interface SherlockPlatform {
  name: string;
  category: string;
  /** URL template — `{}` is replaced with the username */
  url: string;
  urlMain: string;
  /**
   * How Sherlock detects a missing profile:
   *  - status_code: HTTP 404 → not found
   *  - message:     page body contains `errorMsg` → not found
   *  - response_url: redirected away from profile URL → not found
   */
  errorType: 'status_code' | 'message' | 'msg' | 'response_url';
  errorMsg?: string;
  /** Alexa/Tranco-style rank — lower = more popular (used for sorting) */
  rank: number;
}

const U = '{}';

export const SHERLOCK_PLATFORMS: SherlockPlatform[] = [
  // ===== SOCIAL =====
  { name: 'Instagram', category: 'Social', url: `https://instagram.com/${U}`, urlMain: 'https://instagram.com', errorType: 'msg', errorMsg: 'Sorry, this page', rank: 18 },
  { name: 'Twitter/X', category: 'Social', url: `https://x.com/${U}`, urlMain: 'https://x.com', errorType: 'status_code', rank: 12 },
  { name: 'Facebook', category: 'Social', url: `https://facebook.com/${U}`, urlMain: 'https://facebook.com', errorType: 'status_code', rank: 10 },
  { name: 'TikTok', category: 'Social', url: `https://tiktok.com/@${U}`, urlMain: 'https://tiktok.com', errorType: 'status_code', rank: 25 },
  { name: 'Pinterest', category: 'Social', url: `https://pinterest.com/${U}`, urlMain: 'https://pinterest.com', errorType: 'status_code', rank: 70 },
  { name: 'Snapchat', category: 'Social', url: `https://snapchat.com/add/${U}`, urlMain: 'https://snapchat.com', errorType: 'status_code', rank: 95 },
  { name: 'Threads', category: 'Social', url: `https://threads.net/@${U}`, urlMain: 'https://threads.net', errorType: 'status_code', rank: 60 },
  { name: 'Tumblr', category: 'Social', url: `https://${U}.tumblr.com`, urlMain: 'https://tumblr.com', errorType: 'status_code', rank: 120 },
  { name: 'VK', category: 'Social', url: `https://vk.com/${U}`, urlMain: 'https://vk.com', errorType: 'status_code', rank: 30 },
  { name: 'Flickr', category: 'Social', url: `https://flickr.com/people/${U}`, urlMain: 'https://flickr.com', errorType: 'status_code', rank: 180 },
  { name: 'VSCO', category: 'Social', url: `https://vsco.co/${U}`, urlMain: 'https://vsco.co', errorType: 'status_code', rank: 350 },
  { name: 'Weibo', category: 'Social', url: `https://weibo.com/${U}`, urlMain: 'https://weibo.com', errorType: 'status_code', rank: 50 },
  { name: 'Badoo', category: 'Social', url: `https://badoo.com/${U}`, urlMain: 'https://badoo.com', errorType: 'status_code', rank: 400 },
  { name: 'Mastodon', category: 'Social', url: `https://mastodon.social/@${U}`, urlMain: 'https://mastodon.social', errorType: 'status_code', rank: 500 },
  { name: 'Bluesky', category: 'Social', url: `https://bsky.app/profile/${U}.bsky.social`, urlMain: 'https://bsky.app', errorType: 'status_code', rank: 220 },

  // ===== REGIONAL SOCIAL — Russia / CIS =====
  // VK already exists above (rank 30).
  { name: 'Odnoklassniki', category: 'Social', url: `https://ok.ru/${U}`, urlMain: 'https://ok.ru', errorType: 'status_code', rank: 540 },
  { name: 'Mail.ru (Мой Мир)', category: 'Social', url: `https://my.mail.ru/mail/${U}`, urlMain: 'https://my.mail.ru', errorType: 'status_code', rank: 720 },
  { name: 'Yandex Dzen', category: 'Social', url: `https://dzen.ru/${U}`, urlMain: 'https://dzen.ru', errorType: 'status_code', rank: 760 },

  // ===== REGIONAL SOCIAL — China =====
  // Weibo already exists above (rank 50).
  { name: 'QQ (Qzone)', category: 'Social', url: `https://user.qzone.qq.com/${U}`, urlMain: 'https://qzone.qq.com', errorType: 'status_code', rank: 470 },
  { name: 'Xiaohongshu', category: 'Social', url: `https://www.xiaohongshu.com/user/profile/${U}`, urlMain: 'https://www.xiaohongshu.com', errorType: 'status_code', rank: 820 },

  // ===== REGIONAL SOCIAL — Japan =====
  { name: 'mixi', category: 'Social', url: `https://mixi.jp/show_friend.pl?id=${U}`, urlMain: 'https://mixi.jp', errorType: 'status_code', rank: 840 },
  { name: 'Ameba Blog', category: 'Social', url: `https://ameblo.jp/${U}`, urlMain: 'https://ameblo.jp', errorType: 'status_code', rank: 810 },

  // ===== REGIONAL SOCIAL — Korea =====
  { name: 'Naver BAND', category: 'Social', url: `https://band.us/band/${U}`, urlMain: 'https://band.us', errorType: 'status_code', rank: 870 },

  // ===== REGIONAL SOCIAL — Vietnam =====
  { name: 'Zalo', category: 'Social', url: `https://zalo.me/${U}`, urlMain: 'https://zalo.me', errorType: 'status_code', rank: 880 },

  // ===== REGIONAL SOCIAL — India =====
  { name: 'ShareChat', category: 'Social', url: `https://sharechat.com/profile/${U}`, urlMain: 'https://sharechat.com', errorType: 'status_code', rank: 850 },
  { name: 'Koo', category: 'Social', url: `https://www.kooapp.com/profile/${U}`, urlMain: 'https://www.kooapp.com', errorType: 'status_code', rank: 890 },

  // ===== REGIONAL SOCIAL — Europe =====
  { name: 'Nasza Klasa (NK.pl)', category: 'Social', url: `https://nk.pl/profile/${U}`, urlMain: 'https://nk.pl', errorType: 'status_code', rank: 910 },
  { name: 'Hyves (archived)', category: 'Social', url: `https://hyves.nl/${U}`, urlMain: 'https://hyves.nl', errorType: 'status_code', rank: 999 },

  // ===== DEVELOPER / PROFESSIONAL =====
  { name: 'GitHub', category: 'Developer', url: `https://github.com/${U}`, urlMain: 'https://github.com', errorType: 'status_code', rank: 35 },
  { name: 'GitLab', category: 'Developer', url: `https://gitlab.com/${U}`, urlMain: 'https://gitlab.com', errorType: 'status_code', rank: 150 },
  { name: 'Bitbucket', category: 'Developer', url: `https://bitbucket.org/${U}`, urlMain: 'https://bitbucket.org', errorType: 'status_code', rank: 280 },
  { name: 'Stack Overflow', category: 'Developer', url: `https://stackoverflow.com/users/${U}`, urlMain: 'https://stackoverflow.com', errorType: 'status_code', rank: 45 },
  { name: 'HackerNews', category: 'Developer', url: `https://news.ycombinator.com/user?id=${U}`, urlMain: 'https://news.ycombinator.com', errorType: 'msg', errorMsg: 'No such user', rank: 200 },
  { name: 'Replit', category: 'Developer', url: `https://replit.com/@${U}`, urlMain: 'https://replit.com', errorType: 'status_code', rank: 320 },
  { name: 'Dev.to', category: 'Developer', url: `https://dev.to/${U}`, urlMain: 'https://dev.to', errorType: 'status_code', rank: 260 },
  { name: 'Hashnode', category: 'Developer', url: `https://hashnode.com/@${U}`, urlMain: 'https://hashnode.com', errorType: 'status_code', rank: 380 },
  { name: 'CodePen', category: 'Developer', url: `https://codepen.io/${U}`, urlMain: 'https://codepen.io', errorType: 'status_code', rank: 290 },
  { name: 'Codewars', category: 'Developer', url: `https://codewars.com/users/${U}`, urlMain: 'https://codewars.com', errorType: 'status_code', rank: 340 },
  { name: 'Kaggle', category: 'Developer', url: `https://kaggle.com/${U}`, urlMain: 'https://kaggle.com', errorType: 'status_code', rank: 110 },

  // ===== PROFESSIONAL =====
  { name: 'LinkedIn', category: 'Professional', url: `https://linkedin.com/in/${U}`, urlMain: 'https://linkedin.com', errorType: 'msg', errorMsg: 'Profile not found', rank: 20 },
  { name: 'AngelList', category: 'Professional', url: `https://angel.co/u/${U}`, urlMain: 'https://angel.co', errorType: 'status_code', rank: 240 },
  { name: 'Behance', category: 'Professional', url: `https://behance.net/${U}`, urlMain: 'https://behance.net', errorType: 'status_code', rank: 270 },
  { name: 'Dribbble', category: 'Professional', url: `https://dribbble.com/${U}`, urlMain: 'https://dribbble.com', errorType: 'status_code', rank: 310 },
  { name: 'Patreon', category: 'Professional', url: `https://patreon.com/${U}`, urlMain: 'https://patreon.com', errorType: 'status_code', rank: 160 },
  { name: 'Product Hunt', category: 'Professional', url: `https://producthunt.com/@${U}`, urlMain: 'https://producthunt.com', errorType: 'status_code', rank: 230 },
  { name: 'Fiverr', category: 'Professional', url: `https://fiverr.com/${U}`, urlMain: 'https://fiverr.com', errorType: 'status_code', rank: 170 },
  { name: 'Freelancer', category: 'Professional', url: `https://freelancer.com/u/${U}`, urlMain: 'https://freelancer.com', errorType: 'status_code', rank: 190 },
  { name: 'Keybase', category: 'Professional', url: `https://keybase.io/${U}`, urlMain: 'https://keybase.io', errorType: 'status_code', rank: 360 },

  // ===== REGIONAL PROFESSIONAL — Europe (DACH) =====
  { name: 'XING', category: 'Professional', url: `https://www.xing.com/profile/${U}`, urlMain: 'https://www.xing.com', errorType: 'status_code', rank: 560 },

  // ===== GAMING =====
  { name: 'Steam', category: 'Gaming', url: `https://steamcommunity.com/id/${U}`, urlMain: 'https://steamcommunity.com', errorType: 'msg', errorMsg: 'The specified profile could not be found', rank: 90 },
  { name: 'Twitch', category: 'Gaming', url: `https://twitch.tv/${U}`, urlMain: 'https://twitch.tv', errorType: 'status_code', rank: 40 },
  { name: 'Chess.com', category: 'Gaming', url: `https://chess.com/member/${U}`, urlMain: 'https://chess.com', errorType: 'status_code', rank: 130 },
  { name: 'Lichess', category: 'Gaming', url: `https://lichess.org/@/${U}`, urlMain: 'https://lichess.org', errorType: 'status_code', rank: 250 },
  { name: 'NameMC (Minecraft)', category: 'Gaming', url: `https://namemc.com/profile/${U}`, urlMain: 'https://namemc.com', errorType: 'status_code', rank: 330 },
  { name: 'osu!', category: 'Gaming', url: `https://osu.ppy.sh/users/${U}`, urlMain: 'https://osu.ppy.sh', errorType: 'status_code', rank: 420 },
  { name: 'Roblox', category: 'Gaming', url: `https://roblox.com/user.aspx?username=${U}`, urlMain: 'https://roblox.com', errorType: 'status_code', rank: 100 },
  { name: 'Xbox Gamertag', category: 'Gaming', url: `https://xboxgamertag.com/search/${U}`, urlMain: 'https://xboxgamertag.com', errorType: 'status_code', rank: 410 },
  { name: 'PSN Profiles', category: 'Gaming', url: `https://psnprofiles.com/${U}`, urlMain: 'https://psnprofiles.com', errorType: 'status_code', rank: 390 },
  { name: 'Fortnite Tracker', category: 'Gaming', url: `https://fortnitetracker.com/profile/all/${U}`, urlMain: 'https://fortnitetracker.com', errorType: 'status_code', rank: 450 },
  { name: 'Rocket League', category: 'Gaming', url: `https://rocketleague.tracker.network/rocket-league/profile/${U}/overview`, urlMain: 'https://rocketleague.tracker.network', errorType: 'status_code', rank: 460 },

  // ===== MEDIA / CONTENT =====
  { name: 'YouTube', category: 'Media', url: `https://youtube.com/@${U}`, urlMain: 'https://youtube.com', errorType: 'status_code', rank: 15 },
  { name: 'SoundCloud', category: 'Media', url: `https://soundcloud.com/${U}`, urlMain: 'https://soundcloud.com', errorType: 'status_code', rank: 140 },
  { name: 'Spotify', category: 'Media', url: `https://open.spotify.com/user/${U}`, urlMain: 'https://open.spotify.com', errorType: 'status_code', rank: 65 },
  { name: 'Vimeo', category: 'Media', url: `https://vimeo.com/${U}`, urlMain: 'https://vimeo.com', errorType: 'status_code', rank: 210 },
  { name: 'Twitch Videos', category: 'Media', url: `https://twitch.tv/${U}/videos`, urlMain: 'https://twitch.tv', errorType: 'status_code', rank: 41 },
  { name: 'Mixcloud', category: 'Media', url: `https://mixcloud.com/${U}`, urlMain: 'https://mixcloud.com', errorType: 'status_code', rank: 370 },
  { name: 'Bandcamp', category: 'Media', url: `https://${U}.bandcamp.com`, urlMain: 'https://bandcamp.com', errorType: 'status_code', rank: 430 },
  { name: 'Vimeo OTT', category: 'Media', url: `https://vimeo.com/ondemand/${U}`, urlMain: 'https://vimeo.com', errorType: 'status_code', rank: 211 },

  // ===== REGIONAL MEDIA — China =====
  { name: 'Douyin', category: 'Media', url: `https://www.douyin.com/user/${U}`, urlMain: 'https://www.douyin.com', errorType: 'status_code', rank: 470 },
  { name: 'Bilibili', category: 'Media', url: `https://space.bilibili.com/${U}`, urlMain: 'https://www.bilibili.com', errorType: 'status_code', rank: 530 },

  // ===== REGIONAL MEDIA — Iran =====
  { name: 'Aparat', category: 'Media', url: `https://www.aparat.com/${U}`, urlMain: 'https://www.aparat.com', errorType: 'status_code', rank: 860 },

  // ===== REGIONAL MEDIA — Latin America =====
  { name: 'Kwai', category: 'Media', url: `https://www.kwai.com/@${U}`, urlMain: 'https://www.kwai.com', errorType: 'status_code', rank: 900 },

  // ===== FORUMS / COMMUNITIES =====
  { name: 'Reddit', category: 'Forums', url: `https://reddit.com/user/${U}`, urlMain: 'https://reddit.com', errorType: 'status_code', rank: 22 },
  { name: 'Quora', category: 'Forums', url: `https://quora.com/profile/${U}`, urlMain: 'https://quora.com', errorType: 'status_code', rank: 80 },
  { name: 'Hacker News', category: 'Forums', url: `https://news.ycombinator.com/user?id=${U}`, urlMain: 'https://news.ycombinator.com', errorType: 'msg', errorMsg: 'No such user', rank: 201 },
  { name: 'Product Hunt (hunter)', category: 'Forums', url: `https://producthunt.com/@${U}`, urlMain: 'https://producthunt.com', errorType: 'status_code', rank: 231 },
  { name: '4archive', category: 'Forums', url: `https://4archive.org/user/${U}`, urlMain: 'https://4archive.org', errorType: 'status_code', rank: 700 },
  { name: 'Slashdot', category: 'Forums', url: `https://slashdot.org/~${U}`, urlMain: 'https://slashdot.org', errorType: 'status_code', rank: 480 },

  // ===== REGIONAL FORUMS — China =====
  { name: 'Zhihu', category: 'Forums', url: `https://www.zhihu.com/people/${U}`, urlMain: 'https://www.zhihu.com', errorType: 'status_code', rank: 620 },

  // ===== REGIONAL FORUMS — Latin America =====
  { name: 'Taringa!', category: 'Forums', url: `https://www.taringa.net/${U}`, urlMain: 'https://www.taringa.net', errorType: 'status_code', rank: 880 },

  // ===== CREATIVE / ART =====
  { name: 'DeviantArt', category: 'Creative', url: `https://${U}.deviantart.com`, urlMain: 'https://deviantart.com', errorType: 'status_code', rank: 200 },
  { name: 'ArtStation', category: 'Creative', url: `https://artstation.com/${U}`, urlMain: 'https://artstation.com', errorType: 'status_code', rank: 300 },
  { name: 'Pixiv', category: 'Creative', url: `https://pixiv.net/users/${U}`, urlMain: 'https://pixiv.net', errorType: 'status_code', rank: 130 },
  { name: 'Etsy', category: 'Creative', url: `https://etsy.com/shop/${U}`, urlMain: 'https://etsy.com', errorType: 'status_code', rank: 55 },
  { name: 'Redbubble', category: 'Creative', url: `https://redbubble.com/people/${U}`, urlMain: 'https://redbubble.com', errorType: 'status_code', rank: 230 },
  { name: 'Inkblot', category: 'Creative', url: `https://inkblot.art/${U}`, urlMain: 'https://inkblot.art', errorType: 'status_code', rank: 800 },

  // ===== REGIONAL CREATIVE — China =====
  // (Xiaohongshu is listed under Social above for category-grouping parity with osint-platforms.ts.)

  // ===== BLOGGING / WRITING =====
  { name: 'Medium', category: 'Blogging', url: `https://medium.com/@${U}`, urlMain: 'https://medium.com', errorType: 'status_code', rank: 75 },
  { name: 'WordPress', category: 'Blogging', url: `https://${U}.wordpress.com`, urlMain: 'https://wordpress.com', errorType: 'status_code', rank: 85 },
  { name: 'Substack', category: 'Blogging', url: `https://${U}.substack.com`, urlMain: 'https://substack.com', errorType: 'status_code', rank: 290 },
  { name: 'Ghost', category: 'Blogging', url: `https://${U}.ghost.io`, urlMain: 'https://ghost.io', errorType: 'status_code', rank: 500 },
  { name: 'Wattpad', category: 'Blogging', url: `https://wattpad.com/user/${U}`, urlMain: 'https://wattpad.com', errorType: 'status_code', rank: 240 },
  { name: 'Goodreads', category: 'Blogging', url: `https://goodreads.com/${U}`, urlMain: 'https://goodreads.com', errorType: 'status_code', rank: 110 },
  { name: 'Archive of Our Own', category: 'Blogging', url: `https://archiveofourown.org/users/${U}`, urlMain: 'https://archiveofourown.org', errorType: 'status_code', rank: 260 },

  // ===== DATING =====
  { name: 'OkCupid', category: 'Dating', url: `https://okcupid.com/profile/${U}`, urlMain: 'https://okcupid.com', errorType: 'status_code', rank: 350 },
  { name: 'MeetMe', category: 'Dating', url: `https://meetme.com/${U}`, urlMain: 'https://meetme.com', errorType: 'status_code', rank: 550 },
  { name: 'Badoo (dating)', category: 'Dating', url: `https://badoo.com/en/${U}`, urlMain: 'https://badoo.com', errorType: 'status_code', rank: 401 },

  // ===== REFERENCE / MISC =====
  // NOTE: Wikipedia below is hardcoded to en.wikipedia.org as the static default.
  // Backend routes that have a locale context (country/language) should call
  // buildWikipediaUrl(`User:${u}`, locale) from src/lib/osint-query.ts instead —
  // it switches to the user's Wikipedia language edition (fr/de/ru/zh/ja/es/...)
  // at query time, so the localization happens there, not here.
  { name: 'Wikipedia', category: 'Reference', url: `https://en.wikipedia.org/wiki/User:${U}`, urlMain: 'https://en.wikipedia.org', errorType: 'msg', errorMsg: 'does not have a user page', rank: 13 },
  { name: 'Wikidata', category: 'Reference', url: `https://wikidata.org/wiki/User:${U}`, urlMain: 'https://wikidata.org', errorType: 'msg', errorMsg: 'does not have a user page', rank: 13 },
  { name: 'Gravatar', category: 'Reference', url: `https://gravatar.com/${U}`, urlMain: 'https://gravatar.com', errorType: 'status_code', rank: 215 },
  { name: 'SlideShare', category: 'Reference', url: `https://slideshare.net/${U}`, urlMain: 'https://slideshare.net', errorType: 'status_code', rank: 220 },
  { name: 'Scribd', category: 'Reference', url: `https://scribd.com/${U}`, urlMain: 'https://scribd.com', errorType: 'status_code', rank: 305 },
  { name: 'About.me', category: 'Reference', url: `https://about.me/${U}`, urlMain: 'https://about.me', errorType: 'status_code', rank: 360 },

  // ===== REGIONAL REFERENCE — Korea / Russia =====
  { name: 'Naver', category: 'Reference', url: `https://search.naver.com/search.naver?query=${U}`, urlMain: 'https://www.naver.com', errorType: 'status_code', rank: 740 },
  { name: 'Yandex', category: 'Reference', url: `https://yandex.ru/search?text=${U}`, urlMain: 'https://yandex.ru', errorType: 'status_code', rank: 750 },
];

/** Build the candidate URL for a given username by replacing `{}` with the username. */
export function buildSherlockUrl(platform: SherlockPlatform, username: string): string {
  return platform.url.replace('{}', encodeURIComponent(username));
}

/** Get the list grouped + sorted by rank (most popular first). */
export function sherlockByCategory(): Record<string, SherlockPlatform[]> {
  const grouped: Record<string, SherlockPlatform[]> = {};
  for (const p of SHERLOCK_PLATFORMS) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.rank - b.rank);
  }
  return grouped;
}
