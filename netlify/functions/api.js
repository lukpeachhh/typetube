const https = require('https');
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
  let out = decodeHtmlEntities(text.replace(/<[^>]+>/g, ''))
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
  },
  {
    clientName: 'ANDROID_VR',
    clientVersion: '1.60.19',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    osName: 'Android',
    osVersion: '12L',
    androidSdkVersion: 32,
    userAgent: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
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

  // 1. Try clean mobile/VR Innertube clients directly WITHOUT desktop web cookies
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
    } catch (err) {}
  }

  // 2. Fallback: Fetch via Google Translate Proxy (uses Google IPs, bypassing AWS IP block on watch page!)
  try {
    const gtUrl = `https://www-youtube-com.translate.goog/watch?v=${videoId}&_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en`;
    const gtRes = await fetchUrl(gtUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });
    const prMatch = gtRes.data.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|window|<\/script>)/);
    if (prMatch) {
      const pr = JSON.parse(prMatch[1]);
      const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const title = pr?.videoDetails?.title || 'YouTube Video';
      const author = pr?.videoDetails?.author || '';
      if (tracks && tracks.length > 0) {
        return { title, author, tracks, userAgent: INNERTUBE_CLIENTS[0].userAgent, lastStatus: 'GTRANSLATE_OK' };
      }
    }
  } catch (e) {}

  return { title: 'YouTube Video', author: '', tracks: [], userAgent: INNERTUBE_CLIENTS[0].userAgent, lastStatus };
}

async function fetchTranscriptFromUrl(baseUrl, userAgent) {
  // Remove `&exp=xpe` if present so YouTube doesn't return 0-byte response
  const cleanedUrl = baseUrl.replace(/&exp=xpe/g, '');
  const res = await fetchUrl(cleanedUrl, {
    headers: { 'User-Agent': userAgent || INNERTUBE_CLIENTS[0].userAgent }
  });

  const raw = res.data || '';
  if (!raw.trim()) {
    throw new Error('YouTube บล็อกการดึงเนื้อหาซับจากเซิร์ฟเวอร์คลาวด์ (Empty timedtext)');
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

    try {
      const { title, author, tracks, userAgent, lastStatus } = await getYouTubeCaptionTracks(videoId);

      if (!tracks || tracks.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: lastStatus === 'LOGIN_REQUIRED'
              ? 'YouTube บล็อก IP ของเซิร์ฟเวอร์ Netlify (LOGIN_REQUIRED)'
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
