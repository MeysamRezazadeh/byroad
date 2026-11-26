'use strict';

// Common services and the domains each one needs to load fully.
// Subdomains are matched automatically, so "googlevideo.com" also covers
// "rr3---sn-abc.googlevideo.com".
window.BYROAD_PRESETS = [
  { name: 'YouTube',   domains: ['youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com', 'ggpht.com', 'youtube-nocookie.com', 'youtubei.googleapis.com'] },
  { name: 'Google',    domains: ['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'goo.gl'] },
  { name: 'X',         domains: ['x.com', 'twitter.com', 'twimg.com', 't.co'] },
  { name: 'Instagram', domains: ['instagram.com', 'cdninstagram.com', 'fbcdn.net'] },
  { name: 'Facebook',  domains: ['facebook.com', 'facebook.net', 'fbcdn.net', 'fbsbx.com', 'fb.com', 'messenger.com'] },
  { name: 'WhatsApp',  domains: ['whatsapp.com', 'whatsapp.net', 'wa.me'] },
  { name: 'Telegram',  domains: ['telegram.org', 't.me', 'telegram.me', 'telesco.pe'] },
  { name: 'Discord',   domains: ['discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media'] },
  { name: 'Reddit',    domains: ['reddit.com', 'redd.it', 'redditmedia.com', 'redditstatic.com', 'reddituploads.com'] },
  { name: 'ChatGPT',   domains: ['chatgpt.com', 'openai.com', 'oaistatic.com', 'oaiusercontent.com'] },
  { name: 'GitHub',    domains: ['github.com', 'githubusercontent.com', 'github.io', 'githubassets.com', 'ghcr.io'] },
  { name: 'Spotify',   domains: ['spotify.com', 'scdn.co', 'spotifycdn.com', 'pscdn.co'] },
  { name: 'Netflix',   domains: ['netflix.com', 'nflxvideo.net', 'nflximg.net', 'nflxext.com', 'nflxso.net'] },
  { name: 'Steam',     domains: ['steampowered.com', 'steamcommunity.com', 'steamstatic.com', 'steamcdn-a.akamaihd.net'] },
];
