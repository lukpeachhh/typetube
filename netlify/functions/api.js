const http = require('http');
const https = require('https');
const tls = require('tls');
const { URL } = require('url');

function extractVideoId(input) {
  if (!input) return null;
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('/')[0];
    }
    if (u.searchParams.get('v')) {
      return u.searchParams.get('v');
    }
    const shortsMatch = u.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch (e) {
    const match = input.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return null;
}

// Parse Webshare proxy format: supports either `http://user:pass@host:port` OR `host:port:user:pass`
// Also supports multiple proxies separated by commas or newlines (rotates randomly!)
function getProxyConfig() {
  const raw = (process.env.PROXY_URL || process.env.WEBSHARE_PROXY || '').trim();
  if (!raw) return null;

  const entries = raw.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
  if (!entries.length) return null;
  const pick = entries[Math.floor(Math.random() * entries.length)];

  if (pick.startsWith('http://') || pick.startsWith('https://')) {
    try {
      const u = new URL(pick);
      return {
        host: u.hostname,
        port: Number(u.port),
        auth: u.username ? `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}` : null
      };
    } catch (e) {}
  }

  // Format: host:port:username:password
  const parts = pick.split(':');
  if (parts.length >= 4) {
    return {
      host: parts[0],
      port: Number(parts[1]),
      auth: `${parts[2]}:${parts.slice(3).join(':')}`
    };
  } else if (parts.length === 2) {
    return {
      host: parts[0],
      port: Number(parts[1]),
      auth: null
    };
  }
  return null;
}

// Zero-dependency HTTPS fetch supporting HTTP CONNECT proxy tunneling (Webshare)
function fetchUrl(urlStr, options = {}) {
  const proxy = getProxyConfig();

  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const targetPort = Number(u.port) || 443;
    const reqHeaders = {
      'Host': u.hostname,
      'Accept-Language': 'th,en-US;q=0.9,en;q=0.8',
      ...(options.headers || {})
    };

    if (options.body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(options.body);
    }

    const executeHttpsRequest = (createConnectionFn) => {
      const reqOptions = {
        hostname: u.hostname,
        port: targetPort,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: reqHeaders,
        ...(createConnectionFn ? { createConnection: createConnectionFn, agent: false } : {})
      };

      const req = https.request(reqOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchUrl(res.headers.location, options));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
      });

      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    };

    if (!proxy) {
      return executeHttpsRequest(null);
    }

    // Tunnel HTTPS through Webshare HTTP Proxy using CONNECT
    const connectHeaders = {
      'Host': `${u.hostname}:${targetPort}`
    };
    if (proxy.auth) {
      connectHeaders['Proxy-Authorization'] = 'Basic ' + Buffer.from(proxy.auth).toString('base64');
    }

    const connectReq = http.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${u.hostname}:${targetPort}`,
      headers: connectHeaders
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new Error(`Proxy CONNECT failed with status ${res.statusCode}`));
      }
      const tlsSocket = tls.connect({
        socket,
        servername: u.hostname
      });
      tlsSocket.on('error', reject);
      executeHttpsRequest(() => tlsSocket);
    });

    connectReq.on('error', reject);
    connectReq.end();
  });
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function normalizeThaiTypingOrder(str) {
  if (!str) return '';
  let s = str.normalize('NFC');
  s = s.replace(/\u0E4D([\u0E48-\u0E4B])[\u0E32\u0E33]/g, '$1\u0E33');
  s = s.replace(/\u0E4D[\u0E32\u0E33]/g, '\u0E33');
  s = s.replace(/\u0E33([\u0E48-\u0E4B])/g, '$1\u0E33');
  s = s.replace(/\u0E40\u0E40/g, '\u0E41');

  s = s.replace(/([\u0E01-\u0E2E])([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+)/g, (_, base, marks) => {
    let vowel = '';
    let tone = '';
    for (const ch of marks) {
      const code = ch.charCodeAt(0);
      if (code === 0x0E31 || (code >= 0x0E34 && code <= 0x0E3A) || code === 0x0E47 || code === 0x0E4D) {
        if (!vowel) vowel = ch;
      } else if (code >= 0x0E48 && code <= 0x0E4C) {
        if (!tone) tone = ch;
      }
    }
    return base + vowel + tone;
  });

  s = s.replace(/\u0E4D([\u0E48-\u0E4B])?[\u0E32\u0E33]/g, (_, tone) => (tone || '') + '\u0E33');
  s = s.replace(/(^|[^\u0E01-\u0E2E\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+/g, '$1');
  return s;
}

function cleanSubtitleText(text) {
  if (!text) return '';
  let out = decodeHtmlEntities(text.replace(/<[^>]+>/g, ''))
    .replace(/\r?\n/g, ' ')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}♪♫♬]/gu, '')
    .replace(/\u200B|\u200C|\u200D|\uFEFF|\uFE0F/g, '');

  out = normalizeThaiTypingOrder(out)
    .replace(/([\u0E00-\u0E7F])\s+(ๆ)/g, '$1$2')
    .replace(/^[-–—>•]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const thaiChars = (out.match(/[\u0E00-\u0E7F]/g) || []).length;
  if (thaiChars > 5) {
    const parts = out.split(' ');
    if (parts.length >= 4) {
      const avgLen = out.replace(/\s+/g, '').length / parts.length;
      if (avgLen < 6.5) {
        const merged = [];
        let buf = '';
        for (const p of parts) {
          const isTh = /^[\u0E00-\u0E7F]+$/.test(p);
          const bufIsTh = /^[\u0E00-\u0E7F]+$/.test(buf);
          if (isTh && bufIsTh && (buf.length + p.length) <= 18) {
            buf += p;
          } else {
            if (buf) merged.push(buf);
            buf = p;
          }
        }
        if (buf) merged.push(buf);
        out = merged.join(' ');
      }
    }
  }

  return out;
}

const INNERTUBE_CLIENTS = [
  {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    deviceMake: 'Apple',
    deviceModel: 'iPhone16,2',
    osName: 'iPhone',
    osVersion: '17.5.1.21F90',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)'
  },
  {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    osName: 'Android',
    osVersion: '14',
    androidSdkVersion: 34,
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'
  }
];

async function searchYouTubeVideos(query) {
  const bodyObj = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20261119.01.00',
        hl: 'th',
        gl: 'TH'
      }
    },
    query: query,
    params: 'EgIoAQ%3D%3D'
  };

  const res = await fetchUrl('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    body: JSON.stringify(bodyObj)
  });

  const json = JSON.parse(res.data);
  const sections = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const results = [];

  for (const sec of sections) {
    const items = sec?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const v = item.videoRenderer;
      if (!v || !v.videoId) continue;

      const title = v.title?.runs?.map(r => r.text).join('') || 'YouTube Video';
      const channel = v.ownerText?.runs?.[0]?.text || '';
      const duration = v.lengthText?.simpleText || '';

      results.push({
        videoId: v.videoId,
        title,
        channel,
        duration,
        thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`
      });

      if (results.length >= 16) break;
    }
    if (results.length >= 16) break;
  }

  return results;
}

async function getYouTubeCaptionTracks(videoId) {
  let lastStatus = '';

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const body = JSON.stringify({
        context: {
          client: {
            clientName: client.clientName,
            clientVersion: client.clientVersion,
            deviceMake: client.deviceMake,
            deviceModel: client.deviceModel,
            osName: client.osName,
            osVersion: client.osVersion,
            androidSdkVersion: client.androidSdkVersion,
            hl: 'th',
            gl: 'TH'
          }
        },
        videoId: videoId
      });

      const res = await fetchUrl('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent
        },
        body
      });

      const json = JSON.parse(res.data);
      lastStatus = json?.playabilityStatus?.status || '';
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const title = json?.videoDetails?.title || 'YouTube Video';
      const author = json?.videoDetails?.author || '';

      if (tracks && tracks.length > 0) {
        return { title, author, tracks, userAgent: client.userAgent, lastStatus };
      }
    } catch (err) {
      lastStatus = err.message;
    }
  }

  return { title: 'YouTube Video', author: '', tracks: [], userAgent: INNERTUBE_CLIENTS[0].userAgent, lastStatus };
}

async function fetchTranscriptFromUrl(baseUrl, userAgent) {
  const cleanedUrl = baseUrl.replace(/&exp=xpe/g, '');
  const res = await fetchUrl(cleanedUrl, {
    headers: { 'User-Agent': userAgent || INNERTUBE_CLIENTS[0].userAgent }
  });

  const raw = res.data || '';
  if (!raw.trim()) {
    throw new Error('Empty timedtext response');
  }

  const rawLines = [];
  const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = textRegex.exec(raw)) !== null) {
    const start = parseFloat(m[1]);
    const duration = m[2] ? parseFloat(m[2]) : 3.0;
    const text = cleanSubtitleText(m[3]);
    if (text) {
      rawLines.push({
        start: Number(start.toFixed(2)),
        end: Number((start + duration).toFixed(2)),
        duration: Number(duration.toFixed(2)),
        text
      });
    }
  }

  if (rawLines.length === 0) {
    const pRegex = /<p\s+[^>]*?t="(\d+)"[^>]*?(?:d="(\d+)"[^>]*?)?>([\s\S]*?)<\/p>/g;
    while ((m = pRegex.exec(raw)) !== null) {
      const start = parseInt(m[1], 10) / 1000;
      const duration = m[2] ? parseInt(m[2], 10) / 1000 : 3.0;
      const text = cleanSubtitleText(m[3]);
      if (text) {
        rawLines.push({
          start: Number(start.toFixed(2)),
          end: Number((start + duration).toFixed(2)),
          duration: Number(duration.toFixed(2)),
          text
        });
      }
    }
  }

  return mergeShortSegments(rawLines);
}

function mergeShortSegments(lines) {
  if (!lines.length) return [];
  const cleaned = [];

  for (let i = 0; i < lines.length; i++) {
    const curr = { ...lines[i] };

    if (curr.start < 5 && /(?:Translator|Reviewer|ผู้แปล|ผู้ตรวจทาน)\s*:/i.test(curr.text)) {
      continue;
    }

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].text === curr.text) {
      cleaned[cleaned.length - 1].end = Math.max(cleaned[cleaned.length - 1].end, curr.end);
      cleaned[cleaned.length - 1].duration = Number((cleaned[cleaned.length - 1].end - cleaned[cleaned.length - 1].start).toFixed(2));
      continue;
    }

    if (i < lines.length - 1 && curr.end > lines[i + 1].start) {
      curr.end = Number(lines[i + 1].start.toFixed(2));
      curr.duration = Number(Math.max(0.5, curr.end - curr.start).toFixed(2));
    }

    cleaned.push(curr);
  }

  return cleaned;
}

// In-memory cache inside warm serverless container to save API quota
const SERVER_TRANSCRIPT_CACHE = new Map();

// Fetch transcript via Supadata API (https://supadata.ai) — works 100% on Netlify without IP blocks
async function fetchViaSupadata(videoId, preferredLang, apiKey) {
  const langParam = preferredLang ? `&lang=${encodeURIComponent(preferredLang.replace(/^[a.]*\./, ''))}` : '';
  const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}${langParam}`;
  const res = await fetchUrl(url, {
    headers: { 'x-api-key': apiKey }
  });
  if (res.status !== 200) {
    throw new Error(`Supadata status ${res.status}: ${res.data.slice(0, 120)}`);
  }
  const data = JSON.parse(res.data);
  const content = data.content || [];
  const rawLines = content.map(item => {
    const start = Number(((item.offset || 0) / 1000).toFixed(2));
    const duration = Number(((item.duration || 3000) / 1000).toFixed(2));
    return {
      start,
      end: Number((start + duration).toFixed(2)),
      duration,
      text: cleanSubtitleText(item.text || '')
    };
  }).filter(l => l.text.length > 0);

  const availableLangs = (data.availableLangs || [data.lang || 'th']).map(code => ({
    languageCode: code,
    vssId: code,
    name: code.toUpperCase(),
    isAuto: false
  }));

  return {
    selectedLanguage: data.lang || preferredLang || 'th',
    selectedVssId: data.lang || preferredLang || 'th',
    availableTracks: availableLangs,
    lines: mergeShortSegments(rawLines)
  };
}

// Fetch transcript via SearchAPI.io (https://www.searchapi.io) — works 100% on Netlify without IP blocks
async function fetchViaSearchApi(videoId, preferredLang, apiKey) {
  const langCode = (preferredLang || 'th').replace(/^[a.]*\./, '');
  const url = `https://www.searchapi.io/api/v1/search?engine=youtube_transcripts&video_id=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(langCode)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchUrl(url);
  const data = JSON.parse(res.data);

  // If preferredLang wasn't available, SearchAPI returns `available_languages`; retry with first available
  if ((!data.transcripts || !data.transcripts.length) && Array.isArray(data.available_languages) && data.available_languages.length > 0) {
    const fallbackLang = data.available_languages.find(l => l.lang.startsWith('th'))?.lang ||
                         data.available_languages.find(l => l.lang.startsWith('en'))?.lang ||
                         data.available_languages[0].lang;
    if (fallbackLang && fallbackLang !== langCode) {
      return fetchViaSearchApi(videoId, fallbackLang, apiKey);
    }
  }

  const rawLines = (data.transcripts || []).map(item => {
    const start = Number(parseFloat(item.start || 0).toFixed(2));
    const duration = Number(parseFloat(item.duration || 3).toFixed(2));
    return {
      start,
      end: Number((start + duration).toFixed(2)),
      duration,
      text: cleanSubtitleText(item.text || '')
    };
  }).filter(l => l.text.length > 0);

  const availableTracks = (data.available_languages || [{ lang: langCode, name: langCode.toUpperCase() }]).map(l => ({
    languageCode: l.lang,
    vssId: l.lang,
    name: l.name || l.lang.toUpperCase(),
    isAuto: false
  }));

  return {
    selectedLanguage: langCode,
    selectedVssId: langCode,
    availableTracks,
    lines: mergeShortSegments(rawLines)
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  };

  const pathStr = event.path || '';
  const params = event.queryStringParameters || {};

  if (pathStr.endsWith('/search')) {
    const q = (params.q || '').trim();
    if (!q) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'กรุณาพิมพ์คำค้นหา' }) };
    }
    try {
      const results = await searchYouTubeVideos(q);
      return { statusCode: 200, headers, body: JSON.stringify({ results }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'ค้นหาคลิปไม่สำเร็จ: ' + err.message }) };
    }
  }

  if (pathStr.endsWith('/transcript')) {
    const videoInput = params.v || '';
    const preferredLang = params.lang || '';
    const videoId = extractVideoId(videoInput);

    if (!videoId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ลิงก์หรือรหัสวิดีโอ YouTube ไม่ถูกต้อง' }) };
    }

    const cacheKey = `${videoId}_${preferredLang || 'default'}`;
    if (SERVER_TRANSCRIPT_CACHE.has(cacheKey)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(SERVER_TRANSCRIPT_CACHE.get(cacheKey))
      };
    }

    try {
      const supadataKey = (process.env.SUPADATA_API_KEY || '').trim();
      const searchApiKey = (process.env.SEARCHAPI_KEY || '').trim();

      // 1. Try Supadata API if configured
      if (supadataKey) {
        try {
          const sd = await fetchViaSupadata(videoId, preferredLang, supadataKey);
          if (sd.lines && sd.lines.length > 0) {
            const payload = {
              videoId,
              title: `YouTube (${videoId})`,
              author: '',
              ...sd
            };
            SERVER_TRANSCRIPT_CACHE.set(cacheKey, payload);
            return { statusCode: 200, headers, body: JSON.stringify(payload) };
          }
        } catch (sdErr) {}
      }

      // 2. Try SearchAPI.io if configured
      if (searchApiKey) {
        try {
          const sa = await fetchViaSearchApi(videoId, preferredLang, searchApiKey);
          if (sa.lines && sa.lines.length > 0) {
            const payload = {
              videoId,
              title: `YouTube (${videoId})`,
              author: '',
              ...sa
            };
            SERVER_TRANSCRIPT_CACHE.set(cacheKey, payload);
            return { statusCode: 200, headers, body: JSON.stringify(payload) };
          }
        } catch (saErr) {}
      }

      const { title, author, tracks, userAgent, lastStatus } = await getYouTubeCaptionTracks(videoId);

      if (!tracks || tracks.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: lastStatus === 'LOGIN_REQUIRED'
              ? 'YouTube บล็อก Datacenter IP (กรุณาใส่ SUPADATA_API_KEY หรือ SEARCHAPI_KEY ฟรีใน Netlify Environment Variables)'
              : `คลิปนี้ไม่มีซับไตเติ้ลบน YouTube (${lastStatus || 'NO_TRACKS'})`,
            videoId,
            title,
            author,
            availableTracks: []
          })
        };
      }

      const availableTracks = tracks.map(t => ({
        languageCode: t.languageCode,
        vssId: t.vssId,
        name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
        isAuto: t.kind === 'asr'
      }));

      availableTracks.sort((a, b) => {
        const score = (tr) => {
          let s = tr.languageCode.startsWith('th') ? 0 : tr.languageCode.startsWith('en') ? 2 : 4;
          if (tr.isAuto) s += 1;
          return s;
        };
        return score(a) - score(b);
      });

      let selectedTrack = null;
      if (preferredLang) {
        selectedTrack = tracks.find(t => t.vssId === preferredLang) ||
                        tracks.find(t => t.languageCode === preferredLang && t.kind !== 'asr') ||
                        tracks.find(t => t.languageCode.startsWith(preferredLang) && t.kind !== 'asr') ||
                        tracks.find(t => t.languageCode === preferredLang) ||
                        tracks.find(t => t.languageCode.startsWith(preferredLang));
      }
      if (!selectedTrack) {
        selectedTrack = tracks.find(t => t.languageCode.startsWith('th') && t.kind !== 'asr') ||
                        tracks.find(t => t.languageCode.startsWith('en') && t.kind !== 'asr') ||
                        tracks.find(t => t.languageCode.startsWith('th')) ||
                        tracks.find(t => t.languageCode.startsWith('en')) ||
                        tracks[0];
      }

      const lines = await fetchTranscriptFromUrl(selectedTrack.baseUrl, userAgent);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          videoId,
          title,
          author,
          selectedLanguage: selectedTrack.languageCode,
          selectedVssId: selectedTrack.vssId,
          availableTracks,
          lines
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'เกิดข้อผิดพลาดในการดึงซับไตเติ้ล: ' + err.message })
      };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
};
