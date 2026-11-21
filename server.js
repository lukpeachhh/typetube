const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

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

function fetchUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const reqOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8',
        ...(options.headers || {})
      }
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

function cleanSubtitleText(text) {
  if (!text) return '';
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ''))
    .replace(/\r?\n/g, ' ')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}♪♫♬]/gu, '')
    .replace(/\u200B|\u200C|\u200D|\uFEFF|\uFE0F/g, '')
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/เเ/g, 'แ')
    .replace(/(^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+/g, '$1')
    .replace(/([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1+/g, '$1')
    .replace(/([\u0E00-\u0E7F])\s+(ๆ)/g, '$1$2')
    .replace(/^[-–—>•]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const INNERTUBE_CLIENTS = [
  {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)'
  },
  {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip'
  }
];

// Search YouTube Videos (Strictly filter for videos with official Manual CC subtitles)
async function searchYouTubeVideos(query) {
  const bodyObj = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250312.04.00',
        hl: 'th',
        gl: 'TH'
      }
    },
    query: query,
    params: 'EgIoAQ%3D%3D' // Official YouTube filter for Subtitles/CC
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
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const body = JSON.stringify({
        context: {
          client: {
            clientName: client.clientName,
            clientVersion: client.clientVersion,
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
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const title = json?.videoDetails?.title || 'YouTube Video';
      const author = json?.videoDetails?.author || '';

      if (tracks && tracks.length > 0) {
        return { title, author, tracks, userAgent: client.userAgent };
      }
    } catch (err) {}
  }

  return { title: 'YouTube Video', author: '', tracks: [], userAgent: INNERTUBE_CLIENTS[0].userAgent };
}

async function fetchTranscriptFromUrl(baseUrl, userAgent) {
  const res = await fetchUrl(baseUrl, {
    headers: { 'User-Agent': userAgent || INNERTUBE_CLIENTS[0].userAgent }
  });

  const raw = res.data || '';
  if (!raw.trim()) {
    throw new Error('ไม่พบเนื้อหาซับไตเติ้ล');
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

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (reqUrl.pathname === '/api/search') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'กรุณาพิมพ์คำค้นหา' }));
    }

    try {
      const results = await searchYouTubeVideos(q);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ results }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'ค้นหาคลิปไม่สำเร็จ: ' + err.message }));
    }
  }

  if (reqUrl.pathname === '/api/transcript') {
    const videoInput = reqUrl.searchParams.get('v');
    const preferredLang = reqUrl.searchParams.get('lang') || '';
    const videoId = extractVideoId(videoInput);

    if (!videoId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'ลิงก์หรือรหัสวิดีโอ YouTube ไม่ถูกต้อง' }));
    }

    try {
      const { title, author, tracks, userAgent } = await getYouTubeCaptionTracks(videoId);

      // Keep ONLY authentic Manual CC tracks (exclude auto-generated ASR tracks)
      const manualTracks = (tracks || []).filter(t => t.kind !== 'asr');

      if (manualTracks.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          error: 'คลิปนี้ไม่มีซับแท้ (Manual CC) บน YouTube กรุณาค้นหาหรือเลือกคลิปที่มีซับแท้',
          videoId,
          title,
          author,
          availableTracks: []
        }));
      }

      const availableTracks = manualTracks.map(t => ({
        languageCode: t.languageCode,
        vssId: t.vssId,
        name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode
      }));

      availableTracks.sort((a, b) => {
        const score = (code) => code.startsWith('th') ? 0 : code.startsWith('en') ? 1 : 2;
        return score(a.languageCode) - score(b.languageCode);
      });

      let selectedTrack = null;
      if (preferredLang) {
        selectedTrack = manualTracks.find(t => t.vssId === preferredLang) ||
                        manualTracks.find(t => t.languageCode === preferredLang) ||
                        manualTracks.find(t => t.languageCode.startsWith(preferredLang));
      }
      if (!selectedTrack) {
        selectedTrack = manualTracks.find(t => t.languageCode.startsWith('th')) ||
                        manualTracks.find(t => t.languageCode.startsWith('en')) ||
                        manualTracks[0];
      }

      const lines = await fetchTranscriptFromUrl(selectedTrack.baseUrl, userAgent);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        videoId,
        title,
        author,
        selectedLanguage: selectedTrack.languageCode,
        selectedVssId: selectedTrack.vssId,
        availableTracks,
        lines
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        error: 'เกิดข้อผิดพลาดในการดึงซับไตเติ้ล: ' + err.message
      }));
    }
  }

  let filePath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const fullPath = path.join(__dirname, 'public', path.normalize(filePath));

  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`VocaTube server running at http://localhost:${PORT}`);
});
