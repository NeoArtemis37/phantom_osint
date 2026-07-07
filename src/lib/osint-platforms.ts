// =============================================================================
// OSINT Platform Directory — used by Maigret enumeration & username scanner
// =============================================================================
// Comprehensive list of platforms with URL templates. Maigret-style: we
// generate the candidate profile URL for each site; the frontend can then
// open / verify each one. Categories mirror usersearch.ai for grid display.
// =============================================================================

export interface OsintPlatform {
  name: string;
  category: string;
  url: (username: string) => string;
  // Optional: known URL pattern for verifying a profile exists
  checkType?: 'url' | 'profile';
}

export const OSINT_PLATFORMS: OsintPlatform[] = [
  // ===== SOCIAL =====
  { name: 'Twitter/X', category: 'Social', url: (u) => `https://x.com/${u}` },
  { name: 'Instagram', category: 'Social', url: (u) => `https://instagram.com/${u}` },
  { name: 'Facebook', category: 'Social', url: (u) => `https://facebook.com/${u}` },
  { name: 'TikTok', category: 'Social', url: (u) => `https://tiktok.com/@${u}` },
  { name: 'Pinterest', category: 'Social', url: (u) => `https://pinterest.com/${u}` },
  { name: 'VK', category: 'Social', url: (u) => `https://vk.com/${u}` },
  { name: 'Mastodon', category: 'Social', url: (u) => `https://mastodon.social/@${u}` },
  { name: 'Tumblr', category: 'Social', url: (u) => `https://${u}.tumblr.com` },
  { name: 'Weibo', category: 'Social', url: (u) => `https://weibo.com/${u}` },
  { name: 'Badoo', category: 'Social', url: (u) => `https://badoo.com/${u}` },
  { name: 'Flickr', category: 'Social', url: (u) => `https://flickr.com/people/${u}` },
  { name: 'VSCO', category: 'Social', url: (u) => `https://vsco.co/${u}` },
  { name: 'Snapchat', category: 'Social', url: (u) => `https://snapchat.com/add/${u}` },
  { name: 'Threads', category: 'Social', url: (u) => `https://threads.net/@${u}` },

  // ===== REGIONAL SOCIAL — Russia / CIS =====
  // VK already exists above (line 24).
  { name: 'Odnoklassniki (Одноклассники)', category: 'Social', url: (u) => `https://ok.ru/${u}` },
  { name: 'Mail.ru (Мой Мир)', category: 'Social', url: (u) => `https://my.mail.ru/mail/${u}` },

  // ===== REGIONAL SOCIAL — China =====
  // Weibo already exists above (line 27).
  { name: 'QQ (QQ空间 / Qzone)', category: 'Social', url: (u) => `https://user.qzone.qq.com/${u}` },

  // ===== REGIONAL SOCIAL — Japan =====
  { name: 'mixi', category: 'Social', url: (u) => `https://mixi.jp/show_friend.pl?id=${u}` },

  // ===== REGIONAL SOCIAL — Korea =====
  { name: 'Naver BAND (밴드)', category: 'Social', url: (u) => `https://band.us/band/${u}` },

  // ===== REGIONAL SOCIAL — Vietnam =====
  { name: 'Zalo', category: 'Social', url: (u) => `https://zalo.me/${u}` },

  // ===== REGIONAL SOCIAL — India =====
  { name: 'ShareChat', category: 'Social', url: (u) => `https://sharechat.com/profile/${u}` },
  { name: 'Koo', category: 'Social', url: (u) => `https://www.kooapp.com/profile/${u}` },

  // ===== REGIONAL SOCIAL — Europe =====
  { name: 'Nasza Klasa (NK.pl)', category: 'Social', url: (u) => `https://nk.pl/profile/${u}` },
  { name: 'Hyves (archived)', category: 'Social', url: (u) => `https://hyves.nl/${u}` },

  // ===== PROFESSIONAL =====
  { name: 'LinkedIn', category: 'Professional', url: (u) => `https://linkedin.com/in/${u}` },
  { name: 'GitHub', category: 'Professional', url: (u) => `https://github.com/${u}` },
  { name: 'GitLab', category: 'Professional', url: (u) => `https://gitlab.com/${u}` },
  { name: 'Behance', category: 'Professional', url: (u) => `https://behance.net/${u}` },
  { name: 'Dribbble', category: 'Professional', url: (u) => `https://dribbble.com/${u}` },
  { name: 'Stack Overflow', category: 'Professional', url: (u) => `https://stackoverflow.com/users/${u}` },
  { name: 'HackerEarth', category: 'Professional', url: (u) => `https://hackerearth.com/@${u}` },
  { name: 'AngelList', category: 'Professional', url: (u) => `https://angel.co/u/${u}` },
  { name: 'Product Hunt', category: 'Professional', url: (u) => `https://producthunt.com/@${u}` },
  { name: 'Fiverr', category: 'Professional', url: (u) => `https://fiverr.com/${u}` },
  { name: 'Freelancer', category: 'Professional', url: (u) => `https://freelancer.com/u/${u}` },
  { name: 'Upwork', category: 'Professional', url: (u) => `https://upwork.com/freelancers/${u}` },
  { name: 'Trello', category: 'Professional', url: (u) => `https://trello.com/${u}` },
  { name: 'Keybase', category: 'Professional', url: (u) => `https://keybase.io/${u}` },
  { name: 'Patreon', category: 'Professional', url: (u) => `https://patreon.com/${u}` },

  // ===== REGIONAL PROFESSIONAL — Europe (DACH) =====
  { name: 'XING', category: 'Professional', url: (u) => `https://www.xing.com/profile/${u}` },

  // ===== GAMING =====
  { name: 'Steam', category: 'Gaming', url: (u) => `https://steamcommunity.com/id/${u}` },
  { name: 'Twitch', category: 'Gaming', url: (u) => `https://twitch.tv/${u}` },
  { name: 'Chess.com', category: 'Gaming', url: (u) => `https://chess.com/member/${u}` },
  { name: 'Lichess', category: 'Gaming', url: (u) => `https://lichess.org/@/${u}` },
  { name: 'Minecraft', category: 'Gaming', url: (u) => `https://namemc.com/profile/${u}` },
  { name: 'osu!', category: 'Gaming', url: (u) => `https://osu.ppy.sh/users/${u}` },
  { name: 'Roblox', category: 'Gaming', url: (u) => `https://roblox.com/user.aspx?username=${u}` },
  { name: 'Xbox', category: 'Gaming', url: (u) => `https://xboxgamertag.com/search/${u}` },
  { name: 'PSN', category: 'Gaming', url: (u) => `https://psnprofiles.com/${u}` },
  { name: 'Fortnite Tracker', category: 'Gaming', url: (u) => `https://fortnitetracker.com/profile/all/${u}` },
  { name: 'RuneScape', category: 'Gaming', url: (u) => `https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=${u}` },
  { name: 'Epic Games', category: 'Gaming', url: (u) => `https://fortnitetracker.com/profile/all/${u}` },

  // ===== MEDIA =====
  { name: 'YouTube', category: 'Media', url: (u) => `https://youtube.com/@${u}` },
  { name: 'Vimeo', category: 'Media', url: (u) => `https://vimeo.com/${u}` },
  { name: 'Rumble', category: 'Media', url: (u) => `https://rumble.com/user/${u}` },
  { name: 'Dailymotion', category: 'Media', url: (u) => `https://dailymotion.com/${u}` },
  { name: 'Spotify', category: 'Media', url: (u) => `https://open.spotify.com/user/${u}` },
  { name: 'SoundCloud', category: 'Media', url: (u) => `https://soundcloud.com/${u}` },
  { name: 'Mixcloud', category: 'Media', url: (u) => `https://mixcloud.com/${u}` },
  { name: 'Bandcamp', category: 'Media', url: (u) => `https://${u}.bandcamp.com` },
  { name: 'Apple Music', category: 'Media', url: (u) => `https://music.apple.com/profile/${u}` },
  { name: 'Deezer', category: 'Media', url: (u) => `https://deezer.com/profile/${u}` },
  { name: 'Last.fm', category: 'Media', url: (u) => `https://last.fm/user/${u}` },

  // ===== REGIONAL MEDIA — China =====
  { name: 'Douyin (抖音)', category: 'Media', url: (u) => `https://www.douyin.com/user/${u}` },
  { name: 'Bilibili (哔哩哔哩)', category: 'Media', url: (u) => `https://space.bilibili.com/${u}` },

  // ===== REGIONAL MEDIA — Iran =====
  { name: 'Aparat (آپارات)', category: 'Media', url: (u) => `https://www.aparat.com/${u}` },

  // ===== REGIONAL MEDIA — Latin America =====
  { name: 'Kwai', category: 'Media', url: (u) => `https://www.kwai.com/@${u}` },

  // ===== BLOGGING =====
  { name: 'Medium', category: 'Blogging', url: (u) => `https://medium.com/@${u}` },
  { name: 'Hashnode', category: 'Blogging', url: (u) => `https://hashnode.com/@${u}` },
  { name: 'Blogger', category: 'Blogging', url: (u) => `https://${u}.blogspot.com` },
  { name: 'Substack', category: 'Blogging', url: (u) => `https://${u}.substack.com` },
  { name: 'WordPress', category: 'Blogging', url: (u) => `https://${u}.wordpress.com` },
  { name: 'Dev.to', category: 'Blogging', url: (u) => `https://dev.to/${u}` },
  { name: 'Hacker News', category: 'Blogging', url: (u) => `https://news.ycombinator.com/user?id=${u}` },

  // ===== REGIONAL BLOGGING — Russia =====
  { name: 'Yandex Dzen (Дзен)', category: 'Blogging', url: (u) => `https://dzen.ru/${u}` },

  // ===== REGIONAL BLOGGING — Japan =====
  { name: 'Ameba Blog (アメブロ)', category: 'Blogging', url: (u) => `https://ameblo.jp/${u}` },

  // ===== FORUMS / COMMUNITIES =====
  { name: 'Reddit', category: 'Forums', url: (u) => `https://reddit.com/u/${u}` },
  { name: 'Quora', category: 'Forums', url: (u) => `https://quora.com/profile/${u}` },
  { name: '4chan archive', category: 'Forums', url: (u) => `https://archive.4plebs.org/_/search/username/${u}/` },
  { name: 'Product Hunt', category: 'Forums', url: (u) => `https://producthunt.com/@${u}` },
  { name: 'Slashdot', category: 'Forums', url: (u) => `https://slashdot.org/~${u}` },
  { name: '9GAG', category: 'Forums', url: (u) => `https://9gag.com/u/${u}` },
  { name: 'Imgur', category: 'Forums', url: (u) => `https://imgur.com/user/${u}` },

  // ===== REGIONAL FORUMS — China =====
  { name: 'Zhihu (知乎)', category: 'Forums', url: (u) => `https://www.zhihu.com/people/${u}` },

  // ===== REGIONAL FORUMS — Latin America =====
  { name: 'Taringa!', category: 'Forums', url: (u) => `https://www.taringa.net/${u}` },

  // ===== DEVELOPER / TECH =====
  { name: 'Bitbucket', category: 'Developer', url: (u) => `https://bitbucket.org/${u}` },
  { name: 'Replit', category: 'Developer', url: (u) => `https://replit.com/@${u}` },
  { name: 'CodePen', category: 'Developer', url: (u) => `https://codepen.io/${u}` },
  { name: 'Codeforces', category: 'Developer', url: (u) => `https://codeforces.com/profile/${u}` },
  { name: 'LeetCode', category: 'Developer', url: (u) => `https://leetcode.com/${u}` },
  { name: 'HackerRank', category: 'Developer', url: (u) => `https://hackerrank.com/${u}` },
  { name: 'Codewars', category: 'Developer', url: (u) => `https://codewars.com/users/${u}` },
  { name: 'Kaggle', category: 'Developer', url: (u) => `https://kaggle.com/${u}` },
  { name: 'Docker Hub', category: 'Developer', url: (u) => `https://hub.docker.com/u/${u}` },
  { name: 'NPM', category: 'Developer', url: (u) => `https://npmjs.com/~${u}` },
  { name: 'PyPI', category: 'Developer', url: (u) => `https://pypi.org/user/${u}` },
  { name: 'Crates.io', category: 'Developer', url: (u) => `https://crates.io/users/${u}` },
  { name: 'Gitea', category: 'Developer', url: (u) => `https://gitea.com/${u}` },
  { name: 'Sourcehut', category: 'Developer', url: (u) => `https://sr.ht/~${u}` },

  // ===== ART / CREATIVE =====
  { name: 'DeviantArt', category: 'Creative', url: (u) => `https://${u}.deviantart.com` },
  { name: 'ArtStation', category: 'Creative', url: (u) => `https://artstation.com/${u}` },
  { name: 'Pixiv', category: 'Creative', url: (u) => `https://pixiv.net/users/${u}` },
  { name: 'Unsplash', category: 'Creative', url: (u) => `https://unsplash.com/@${u}` },
  { name: '500px', category: 'Creative', url: (u) => `https://500px.com/${u}` },
  { name: 'EyeEm', category: 'Creative', url: (u) => `https://eyeem.com/u/${u}` },

  // ===== REGIONAL CREATIVE — China =====
  { name: 'Xiaohongshu (小红书)', category: 'Creative', url: (u) => `https://www.xiaohongshu.com/user/profile/${u}` },

  // ===== DATING =====
  { name: 'OkCupid', category: 'Dating', url: (u) => `https://okcupid.com/profile/${u}` },
  { name: 'MeetMe', category: 'Dating', url: (u) => `https://meetme.com/${u}` },
  { name: 'Tagged', category: 'Dating', url: (u) => `https://tagged.com/${u}` },

  // ===== REGIONAL REFERENCE — Korea / Russia =====
  { name: 'Naver (네이버)', category: 'Reference', url: (u) => `https://search.naver.com/search.naver?query=${u}` },
  { name: 'Yandex (Яндекс)', category: 'Reference', url: (u) => `https://yandex.ru/search?text=${u}` },

  // ===== MISC / NICHE =====
  // NOTE: Wikipedia is hardcoded to en.wikipedia.org here as the static default.
  // Backend routes that have a locale context (country/language) should call
  // buildWikipediaUrl(`User:${u}`, locale) from src/lib/osint-query.ts instead —
  // it switches to the user's Wikipedia language edition (fr/de/ru/zh/ja/es/...).
  { name: 'Wikipedia', category: 'Reference', url: (u) => `https://en.wikipedia.org/wiki/User:${u}` },
  { name: 'Goodreads', category: 'Reference', url: (u) => `https://goodreads.com/${u}` },
  { name: 'Letterboxd', category: 'Reference', url: (u) => `https://letterboxd.com/${u}` },
  { name: 'Trakt', category: 'Reference', url: (u) => `https://trakt.tv/users/${u}` },
  { name: 'MyAnimeList', category: 'Reference', url: (u) => `https://myanimelist.net/profile/${u}` },
  { name: 'Last.fm', category: 'Reference', url: (u) => `https://last.fm/user/${u}` },
  { name: 'Strava', category: 'Reference', url: (u) => `https://strava.com/athletes/${u}` },
  { name: 'Duolingo', category: 'Reference', url: (u) => `https://duolingo.com/profile/${u}` },
  { name: 'Gravatar', category: 'Reference', url: (u) => `https://gravatar.com/${u}` },
  { name: 'About.me', category: 'Reference', url: (u) => `https://about.me/${u}` },
  { name: 'Linktree', category: 'Reference', url: (u) => `https://linktr.ee/${u}` },
  { name: 'Tap.bio', category: 'Reference', url: (u) => `https://tap.bio/${u}` },
  { name: 'PayPal', category: 'Reference', url: (u) => `https://paypal.me/${u}` },
  { name: 'Ko-fi', category: 'Reference', url: (u) => `https://ko-fi.com/${u}` },
  { name: 'Buy Me a Coffee', category: 'Reference', url: (u) => `https://buymeacoffee.com/${u}` },
  { name: 'Venmo', category: 'Reference', url: (u) => `https://venmo.com/${u}` },
  { name: 'Cash App', category: 'Reference', url: (u) => `https://cash.app/${u}` },
];

// Group platforms by category for grid display
export function groupPlatformsByCategory(platforms = OSINT_PLATFORMS) {
  const groups: Record<string, OsintPlatform[]> = {};
  for (const p of platforms) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  }
  return groups;
}

// Detect target type from a raw string
export function detectTargetType(target: string): 'username' | 'email' | 'phone' | 'domain' | 'unknown' {
  const t = target.trim();
  if (!t) return 'unknown';
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(t)) return 'email';
  if (/^\+?[\d\s\-()]{7,}$/.test(t)) return 'phone';
  if (/^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(t)) return 'domain';
  if (/^@?[\w.\-]{2,}$/.test(t)) return 'username';
  return 'unknown';
}
