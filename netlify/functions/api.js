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
        'Cookie': 'CONSENT=YES+cb; SOCS=CAI',
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

  // Merge overly fragmented Thai spacing if needed
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
    clientName: 'WEB',
    clientVersion: '2.20250312.04.00',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }
];

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

// Fetch visitorData & session cookies from YouTube watch page so cloud IPs (Netlify/AWS) work reliably
async function getYouTubeCaptionTracks(videoId) {
  let visitorData = undefined;
  let cookieHeader = 'CONSENT=YES+cb; SOCS=CAI';
  let pageTracks = null;
  let pageTitle = 'YouTube Video';
  let pageAuthor = '';

  try {
    const pageRes = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cookie': cookieHeader
      }
    });
    const setCookies = (pageRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    if (setCookies) {
      cookieHeader = `${cookieHeader}; ${setCookies}`;
    }
    const vMatch = pageRes.data.match(/"VISITOR_DATA":"([^"]+)"/);
    if (vMatch) visitorData = vMatch[1];

    const prMatch = pageRes.data.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|window|<\/script>)/);
    if (prMatch) {
      const pr = JSON.parse(prMatch[1]);
      pageTracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      pageTitle = pr?.videoDetails?.title || pageTitle;
      pageAuthor = pr?.videoDetails?.author || pageAuthor;
    }
  } catch (e) {}

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
            gl: 'TH',
            visitorData
          }
        },
        videoId: videoId
      });

      const res = await fetchUrl('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'Cookie': cookieHeader,
          ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {})
        },
        body
      });

      const json = JSON.parse(res.data);
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const title = json?.videoDetails?.title || pageTitle;
      const author = json?.videoDetails?.author || pageAuthor;

      if (tracks && tracks.length > 0) {
        return { title, author, tracks, userAgent: client.userAgent, cookieHeader };
      }
    } catch (err) {}
  }

  if (pageTracks && pageTracks.length > 0) {
    return {
      title: pageTitle,
      author: pageAuthor,
      tracks: pageTracks,
      userAgent: INNERTUBE_CLIENTS[0].userAgent,
      cookieHeader
    };
  }

  return { title: pageTitle, author: pageAuthor, tracks: [], userAgent: INNERTUBE_CLIENTS[0].userAgent, cookieHeader };
}

async function fetchTranscriptFromUrl(baseUrl, userAgent, cookieHeader) {
  const res = await fetchUrl(baseUrl, {
    headers: {
      'User-Agent': userAgent || INNERTUBE_CLIENTS[0].userAgent,
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
    }
  });

  const raw = res.data || '';
  if (!raw.trim()) {
    throw new Error('YouTube ส่งข้อมูลซับว่างเปล่ากลับมา');
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
      const { title, author, tracks, userAgent, cookieHeader } = await getYouTubeCaptionTracks(videoId);

      if (!tracks || tracks.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'คลิปนี้ไม่มีซับไตเติ้ลบน YouTube กรุณาเลือกคลิปอื่น',
            videoId,
            title,
            author,
            availableTracks: []
          })
        };
      }

      // Prioritize manual CC tracks first, but keep all available tracks so videos never fail to load
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

      const lines = await fetchTranscriptFromUrl(selectedTrack.baseUrl, userAgent, cookieHeader);

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
