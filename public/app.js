// typetube — Ultra-Clean YouTube CC Typing Practice with Multiplayer

let player = null;
let isPlayerReady = false;
let syncTimer = null;

// App State (Starts empty until user searches and selects a video)
let currentVideoId = '';
let currentVideoTitle = '';
let currentLang = 'th';
let transcriptLines = [];
let currentLineIndex = 0;
let waitingForTypingToFinish = false;
let showKeyboard = true;

// Stats (In-memory only, never persisted)
let startTime = null;
let totalTypedChars = 0;
let totalCorrectChars = 0;

// Multiplayer WebRTC (PeerJS) State
let peer = null;
let isRoomHost = false;
let currentRoomCode = '';
let myPlayerName = 'Player';
let myPeerId = '';
let hostConn = null;
let guestConns = [];
let roomPlayers = {};

// DOM Elements
const hiddenInput = document.getElementById('hiddenTypingInput');
const typingStage = document.getElementById('typingStage');
const videoSection = document.getElementById('videoSection');
const targetTextDisplay = document.getElementById('targetTextDisplay');
const nextLinePreview = document.getElementById('nextLinePreview');

const videoTitleEl = document.getElementById('videoTitle');
const timestampPill = document.getElementById('timestampPill');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');

const langSelect = document.getElementById('langSelect');
const replayBtn = document.getElementById('replayBtn');
const prevLineBtn = document.getElementById('prevLineBtn');
const nextLineBtn = document.getElementById('nextLineBtn');
const finishBtn = document.getElementById('finishBtn');
const toggleKeyboardBtn = document.getElementById('toggleKeyboardBtn');

const statWpm = document.getElementById('statWpm');
const statAcc = document.getElementById('statAcc');
const statProgress = document.getElementById('statProgress');

const keyboardContainer = document.getElementById('keyboardContainer');
const keyboardRowsEl = document.getElementById('keyboardRows');

// Search Modal Elements
const sourceModal = document.getElementById('sourceModal');
const openSourceModalBtn = document.getElementById('openSourceModalBtn');
const closeSourceModalBtn = document.getElementById('closeSourceModalBtn');
const ytSearchInput = document.getElementById('ytSearchInput');
const searchVideoBtn = document.getElementById('searchVideoBtn');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const modalErrorMsg = document.getElementById('modalErrorMsg');

// Multiplayer Room Elements
const roomModal = document.getElementById('roomModal');
const openRoomModalBtn = document.getElementById('openRoomModalBtn');
const closeRoomModalBtn = document.getElementById('closeRoomModalBtn');
const playerNameInput = document.getElementById('playerNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomCodeInput = document.getElementById('joinRoomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const multiplayerBar = document.getElementById('multiplayerBar');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomLinkBtn = document.getElementById('copyRoomLinkBtn');
const startRaceBtn = document.getElementById('startRaceBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const playersProgressList = document.getElementById('playersProgressList');

// Score Summary Modal Elements
const scoreModal = document.getElementById('scoreModal');
const resultClipTitle = document.getElementById('resultClipTitle');
const resultRank = document.getElementById('resultRank');
const resultComment = document.getElementById('resultComment');
const resultScore = document.getElementById('resultScore');
const resultWpm = document.getElementById('resultWpm');
const resultAcc = document.getElementById('resultAcc');
const resultTime = document.getElementById('resultTime');
const multiplayerFinalBoard = document.getElementById('multiplayerFinalBoard');
const multiplayerFinalList = document.getElementById('multiplayerFinalList');
const playAgainBtn = document.getElementById('playAgainBtn');
const shareResultBtn = document.getElementById('shareResultBtn');

// ============================================================================
// KEYBOARD LAYOUT (EN QWERTY + TH KEDMANEE)
// ============================================================================
const KEYBOARD_LAYOUT = [
  [
    { code: 'Digit1', en: '1', enShift: '!', th: 'ๅ', thShift: '+' },
    { code: 'Digit2', en: '2', enShift: '@', th: '/', thShift: '๑' },
    { code: 'Digit3', en: '3', enShift: '#', th: '-', thShift: '๒' },
    { code: 'Digit4', en: '4', enShift: '$', th: 'ภ', thShift: '๓' },
    { code: 'Digit5', en: '5', enShift: '%', th: 'ถ', thShift: '๔' },
    { code: 'Digit6', en: '6', enShift: '^', th: 'ุ', thShift: 'ู' },
    { code: 'Digit7', en: '7', enShift: '&', th: 'ึ', thShift: '฿' },
    { code: 'Digit8', en: '8', enShift: '*', th: 'ค', thShift: '๕' },
    { code: 'Digit9', en: '9', enShift: '(', th: 'ต', thShift: '๖' },
    { code: 'Digit0', en: '0', enShift: ')', th: 'จ', thShift: '๗' },
    { code: 'Minus', en: '-', enShift: '_', th: 'ข', thShift: '๘' },
    { code: 'Equal', en: '=', enShift: '+', th: 'ช', thShift: '๙' }
  ],
  [
    { code: 'KeyQ', en: 'q', enShift: 'Q', th: 'ๆ', thShift: '๐' },
    { code: 'KeyW', en: 'w', enShift: 'W', th: 'ไ', thShift: '"' },
    { code: 'KeyE', en: 'e', enShift: 'E', th: 'ำ', thShift: 'ฎ' },
    { code: 'KeyR', en: 'r', enShift: 'R', th: 'พ', thShift: 'ฑ' },
    { code: 'KeyT', en: 't', enShift: 'T', th: 'ะ', thShift: 'ธ' },
    { code: 'KeyY', en: 'y', enShift: 'Y', th: 'ั', thShift: 'ํ' },
    { code: 'KeyU', en: 'u', enShift: 'U', th: 'ี', thShift: '๊' },
    { code: 'KeyI', en: 'i', enShift: 'I', th: 'ร', thShift: 'ณ' },
    { code: 'KeyO', en: 'o', enShift: 'O', th: 'น', thShift: 'ฯ' },
    { code: 'KeyP', en: 'p', enShift: 'P', th: 'ย', thShift: 'ญ' },
    { code: 'BracketLeft', en: '[', enShift: '{', th: 'บ', thShift: 'ฐ' },
    { code: 'BracketRight', en: ']', enShift: '}', th: 'ล', thShift: ',' }
  ],
  [
    { code: 'KeyA', en: 'a', enShift: 'A', th: 'ฟ', thShift: 'ฤ' },
    { code: 'KeyS', en: 's', enShift: 'S', th: 'ห', thShift: 'ฆ' },
    { code: 'KeyD', en: 'd', enShift: 'D', th: 'ก', thShift: 'ฏ' },
    { code: 'KeyF', en: 'f', enShift: 'F', th: 'ด', thShift: 'โ' },
    { code: 'KeyG', en: 'g', enShift: 'G', th: 'เ', thShift: 'ฌ' },
    { code: 'KeyH', en: 'h', enShift: 'H', th: '้', thShift: '็' },
    { code: 'KeyJ', en: 'j', enShift: 'J', th: '่', thShift: '๋' },
    { code: 'KeyK', en: 'k', enShift: 'K', th: 'า', thShift: 'ษ' },
    { code: 'KeyL', en: 'l', enShift: 'L', th: 'ส', thShift: 'ศ' },
    { code: 'Semicolon', en: ';', enShift: ':', th: 'ว', thShift: 'ซ' },
    { code: 'Quote', en: "'", enShift: '"', th: 'ง', thShift: '.' }
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', isShift: true },
    { code: 'KeyZ', en: 'z', enShift: 'Z', th: 'ผ', thShift: '(' },
    { code: 'KeyX', en: 'x', enShift: 'X', th: 'ป', thShift: ')' },
    { code: 'KeyC', en: 'c', enShift: 'C', th: 'แ', thShift: 'ฉ' },
    { code: 'KeyV', en: 'v', enShift: 'V', th: 'อ', thShift: 'ฮ' },
    { code: 'KeyB', en: 'b', enShift: 'B', th: 'ิ', thShift: 'ฺ' },
    { code: 'KeyN', en: 'n', enShift: 'N', th: 'ื', thShift: '์' },
    { code: 'KeyM', en: 'm', enShift: 'M', th: 'ท', thShift: '?' },
    { code: 'Comma', en: ',', enShift: '<', th: 'ม', thShift: 'ฒ' },
    { code: 'Period', en: '.', enShift: '>', th: 'ใ', thShift: 'ฬ' },
    { code: 'Slash', en: '/', enShift: '?', th: 'ฝ', thShift: 'ฦ' },
    { code: 'ShiftRight', label: 'Shift', isShift: true }
  ],
  [
    { code: 'Space', label: 'Space', en: ' ', th: ' ', isSpace: true }
  ]
];

const CHAR_TO_KEY = new Map();
KEYBOARD_LAYOUT.forEach(row => {
  row.forEach(k => {
    if (k.en) CHAR_TO_KEY.set(k.en, { ...k, needsShift: false });
    if (k.enShift) CHAR_TO_KEY.set(k.enShift, { ...k, needsShift: true });
    if (k.th) CHAR_TO_KEY.set(k.th, { ...k, needsShift: false });
    if (k.thShift) CHAR_TO_KEY.set(k.thShift, { ...k, needsShift: true });
  });
});

function isThaiText(str) {
  return /[\u0E00-\u0E7F]/.test(str);
}

function isThaiCombiningChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code === 0x0E31 || (code >= 0x0E34 && code <= 0x0E3A) || (code >= 0x0E47 && code <= 0x0E4E);
}

function groupIntoGraphemeClusters(str) {
  const clusters = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (clusters.length > 0 && isThaiCombiningChar(ch) && clusters[clusters.length - 1].text !== ' ') {
      const last = clusters[clusters.length - 1];
      last.text += ch;
      last.endIndex = i + 1;
    } else {
      clusters.push({
        text: ch,
        startIndex: i,
        endIndex: i + 1
      });
    }
  }
  return clusters;
}

function renderKeyboard(activeChar = '') {
  if (!showKeyboard) {
    keyboardContainer.classList.add('hidden');
    return;
  }
  keyboardContainer.classList.remove('hidden');

  const currentLine = transcriptLines[currentLineIndex];
  const lineIsThai = isThaiText(activeChar) || (currentLine && isThaiText(currentLine.text));
  const keyInfo = CHAR_TO_KEY.get(activeChar);
  const needsShift = keyInfo ? keyInfo.needsShift : false;

  keyboardRowsEl.innerHTML = '';

  KEYBOARD_LAYOUT.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';

    row.forEach(k => {
      const keyEl = document.createElement('div');
      let cls = 'kb-key';
      if (k.isSpace) cls += ' kb-space';
      if (k.isShift) cls += ' kb-shift';

      const isTargetKey = keyInfo && keyInfo.code === k.code;
      const isShiftHighlight = k.isShift && needsShift;

      if (isTargetKey || isShiftHighlight) {
        cls += ' active-target';
      }

      keyEl.className = cls;

      if (k.isSpace || k.isShift) {
        keyEl.innerHTML = `<span class="my-auto">${k.label}</span>`;
      } else if (lineIsThai) {
        keyEl.innerHTML = `
          <span class="sub-char">${k.thShift || ''}</span>
          <span class="main-char">${k.th || ''}</span>
        `;
      } else {
        keyEl.innerHTML = `
          <span class="sub-char">${k.th || ''}</span>
          <span class="main-char">${k.en.toUpperCase()}</span>
        `;
      }

      rowEl.appendChild(keyEl);
    });

    keyboardRowsEl.appendChild(rowEl);
  });
}

// ============================================================================
// HELPERS & YOUTUBE PLAYER SYNC
// ============================================================================
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function normalizeTextForTyping(str) {
  if (!str) return '';
  return str
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}♪♫♬]/gu, '')
    .replace(/\u200B|\u200C|\u200D|\uFEFF|\uFE0F/g, '')
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/เเ/g, 'แ')
    .replace(/(^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+/g, '$1')
    .replace(/[.,?!"';:()[\]{}—–\-…/\\|@#$%^&*_+=<>~`«»“”‘’]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initYouTubePlayer() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('ytPlayer', {
    height: '100%',
    width: '100%',
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      controls: 1,
      cc_load_policy: 0
    },
    events: {
      onReady: () => {
        isPlayerReady = true;
        if (currentVideoId) {
          player.loadVideoById(currentVideoId);
        }
        startSyncLoop();
      }
    }
  });
};

function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (!isPlayerReady || !player || typeof player.getCurrentTime !== 'function') return;
    if (!transcriptLines.length) return;

    const line = transcriptLines[currentLineIndex];
    if (!line) return;

    const currentTime = player.getCurrentTime();
    const playerState = player.getPlayerState();

    if (playerState === YT.PlayerState.PLAYING && currentTime >= line.end - 0.08) {
      player.pauseVideo();
      waitingForTypingToFinish = true;
    }
  }, 85);
}

// ============================================================================
// SCORE & GRADE CALCULATION (STATELESS)
// ============================================================================
function getCurrentMetrics() {
  let wpm = 0;
  let elapsedSeconds = 0;
  if (startTime && totalCorrectChars > 0) {
    elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const elapsedMinutes = Math.max((Date.now() - startTime) / 60000, 0.02);
    wpm = Math.round((totalCorrectChars / 5) / elapsedMinutes);
  }
  const acc = totalTypedChars > 0
    ? Math.max(0, Math.min(100, Math.round((totalCorrectChars / totalTypedChars) * 100)))
    : 100;

  const score = Math.round(wpm * (acc / 100) * 15 + totalCorrectChars * 2);
  const progressPct = transcriptLines.length > 0
    ? Math.min(100, Math.round(((currentLineIndex + (hiddenInput.value.length / Math.max(1, (transcriptLines[currentLineIndex]?.text.length || 1)))) / transcriptLines.length) * 100))
    : 0;

  let rank = 'C';
  let comment = 'เริ่มต้นได้ดี ลองฝึกเพิ่มความเร็วอีกนิด';
  let rankStyle = 'bg-slate-100 text-slate-700 border-slate-200';

  if (wpm >= 65 && acc >= 96) {
    rank = 'S';
    comment = 'ระดับเทพ เร็วและแม่นยำไร้ที่ติ';
    rankStyle = 'bg-blue-50 text-blue-600 border-blue-200';
  } else if (wpm >= 45 && acc >= 92) {
    rank = 'A';
    comment = 'ยอดเยี่ยมมาก พิมพ์คล่องและแม่นยำ';
    rankStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  } else if (wpm >= 28 && acc >= 85) {
    rank = 'B';
    comment = 'ทำได้ดีมาก จังหวะการพิมพ์กำลังดี';
    rankStyle = 'bg-amber-50 text-amber-600 border-amber-200';
  }

  return { wpm, acc, elapsedSeconds, score, rank, comment, rankStyle, progressPct };
}

function showScoreSummary() {
  if (!transcriptLines.length) return;
  if (isPlayerReady && player && player.pauseVideo) {
    player.pauseVideo();
  }

  const m = getCurrentMetrics();
  resultClipTitle.textContent = currentVideoTitle;
  resultRank.textContent = m.rank;
  resultRank.className = `w-20 h-20 rounded-2xl border flex items-center justify-center text-4xl font-bold font-mono shadow-2xs ${m.rankStyle}`;
  resultComment.textContent = m.comment;
  resultScore.textContent = m.score.toLocaleString();
  resultWpm.textContent = m.wpm;
  resultAcc.textContent = `${m.acc}%`;
  resultTime.textContent = formatTime(m.elapsedSeconds);

  if (currentRoomCode) {
    syncMyProgressToRoom(true);
    renderMultiplayerFinalStandings();
  } else {
    multiplayerFinalBoard.classList.add('hidden');
  }

  scoreModal.classList.remove('hidden');
}

// ============================================================================
// SERVERLESS P2P MULTIPLAYER ROOMS (PeerJS WebRTC)
// ============================================================================
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createMultiplayerRoom() {
  myPlayerName = (playerNameInput.value || '').trim() || 'Host';
  const code = generateRoomCode();
  const hostPeerId = `typetube-room-${code}`;

  if (peer) peer.destroy();
  peer = new Peer(hostPeerId);

  peer.on('open', (id) => {
    isRoomHost = true;
    currentRoomCode = code;
    myPeerId = id;
    guestConns = [];
    roomPlayers = {
      [myPeerId]: { name: myPlayerName, wpm: 0, acc: 100, progress: 0, score: 0, rank: 'C', isHost: true }
    };

    roomModal.classList.add('hidden');
    multiplayerBar.classList.remove('hidden');
    startRaceBtn.classList.remove('hidden');
    roomCodeDisplay.textContent = code;

    const u = new URL(window.location.href);
    u.searchParams.set('room', code);
    window.history.replaceState({}, '', u);

    renderMultiplayerProgressUI();
    showToast(`สร้างห้อง ${code} แล้ว ส่งลิงก์ให้เพื่อนได้เลย`);
  });

  peer.on('connection', (conn) => {
    guestConns.push(conn);
    conn.on('data', (msg) => handlePeerMessage(conn, msg));
    conn.on('close', () => {
      guestConns = guestConns.filter(c => c !== conn);
      delete roomPlayers[conn.peer];
      broadcastRoomState();
      renderMultiplayerProgressUI();
    });
  });

  peer.on('error', (err) => {
    showToast('เชื่อมต่อห้องไม่สำเร็จ: ' + err.type);
  });
}

function joinMultiplayerRoom(codeInput) {
  const code = (codeInput || '').trim().toUpperCase();
  if (!code) return;
  myPlayerName = (playerNameInput.value || '').trim() || 'Friend';

  if (peer) peer.destroy();
  peer = new Peer();

  peer.on('open', (id) => {
    isRoomHost = false;
    currentRoomCode = code;
    myPeerId = id;

    hostConn = peer.connect(`typetube-room-${code}`);
    hostConn.on('open', () => {
      roomModal.classList.add('hidden');
      multiplayerBar.classList.remove('hidden');
      startRaceBtn.classList.add('hidden');
      roomCodeDisplay.textContent = code;

      hostConn.send({
        type: 'JOIN',
        peerId: myPeerId,
        name: myPlayerName
      });
      showToast(`เข้าร่วมห้อง ${code} สำเร็จ`);
    });

    hostConn.on('data', (msg) => handlePeerMessage(hostConn, msg));
    hostConn.on('close', () => {
      showToast('หัวหน้าห้องปิดห้องแล้ว');
      leaveMultiplayerRoom();
    });
  });

  peer.on('error', () => {
    showToast('ไม่พบห้องนี้ หรือรหัสห้องไม่ถูกต้อง');
  });
}

function handlePeerMessage(conn, msg) {
  if (!msg || !msg.type) return;

  if (isRoomHost) {
    if (msg.type === 'JOIN') {
      roomPlayers[msg.peerId] = {
        name: msg.name || 'Friend',
        wpm: 0,
        acc: 100,
        progress: 0,
        score: 0,
        rank: 'C'
      };
      if (currentVideoId && transcriptLines.length > 0) {
        conn.send({
          type: 'SYNC_CLIP',
          videoId: currentVideoId,
          title: currentVideoTitle,
          lang: currentLang,
          lines: transcriptLines
        });
      }
      broadcastRoomState();
      renderMultiplayerProgressUI();
    } else if (msg.type === 'PROGRESS') {
      if (roomPlayers[msg.peerId]) {
        roomPlayers[msg.peerId] = {
          ...roomPlayers[msg.peerId],
          wpm: msg.wpm,
          acc: msg.acc,
          progress: msg.progress,
          score: msg.score,
          rank: msg.rank
        };
        broadcastRoomState();
        renderMultiplayerProgressUI();
        if (!scoreModal.classList.contains('hidden')) {
          renderMultiplayerFinalStandings();
        }
      }
    }
  } else {
    if (msg.type === 'SYNC_CLIP') {
      currentVideoId = msg.videoId;
      currentVideoTitle = msg.title;
      currentLang = msg.lang || 'th';
      videoTitleEl.textContent = currentVideoTitle;
      transcriptLines = msg.lines || [];
      videoSection.classList.remove('hidden');
      targetTextDisplay.classList.remove('text-slate-400');

      if (isPlayerReady && player && player.loadVideoById) {
        player.loadVideoById(currentVideoId);
        player.pauseVideo();
      }
      resetStats();
      goToLine(0, true);
    } else if (msg.type === 'ROOM_STATE') {
      roomPlayers = msg.players || {};
      renderMultiplayerProgressUI();
      if (!scoreModal.classList.contains('hidden')) {
        renderMultiplayerFinalStandings();
      }
    } else if (msg.type === 'START_COUNTDOWN') {
      runRaceCountdown();
    }
  }
}

function broadcastRoomState() {
  if (!isRoomHost) return;
  const payload = { type: 'ROOM_STATE', players: roomPlayers };
  guestConns.forEach(c => {
    if (c.open) c.send(payload);
  });
}

function broadcastClipToGuests() {
  if (!isRoomHost) return;
  const payload = {
    type: 'SYNC_CLIP',
    videoId: currentVideoId,
    title: currentVideoTitle,
    lang: currentLang,
    lines: transcriptLines
  };
  guestConns.forEach(c => {
    if (c.open) c.send(payload);
  });
}

function syncMyProgressToRoom(forceComplete = false) {
  if (!currentRoomCode) return;
  const m = getCurrentMetrics();
  const prog = forceComplete ? 100 : m.progressPct;

  if (isRoomHost) {
    if (roomPlayers[myPeerId]) {
      roomPlayers[myPeerId].wpm = m.wpm;
      roomPlayers[myPeerId].acc = m.acc;
      roomPlayers[myPeerId].progress = prog;
      roomPlayers[myPeerId].score = m.score;
      roomPlayers[myPeerId].rank = m.rank;
    }
    broadcastRoomState();
    renderMultiplayerProgressUI();
  } else if (hostConn && hostConn.open) {
    hostConn.send({
      type: 'PROGRESS',
      peerId: myPeerId,
      wpm: m.wpm,
      acc: m.acc,
      progress: prog,
      score: m.score,
      rank: m.rank
    });
  }
}

function renderMultiplayerProgressUI() {
  playersProgressList.innerHTML = '';
  const list = Object.entries(roomPlayers).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  list.forEach(([pid, p]) => {
    const isMe = pid === myPeerId;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';
    row.innerHTML = `
      <div class="w-24 truncate font-medium ${isMe ? 'text-blue-600' : 'text-slate-700'}">
        ${p.name}${isMe ? ' (คุณ)' : ''}
      </div>
      <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-blue-600 transition-all duration-150" style="width: ${p.progress || 0}%"></div>
      </div>
      <div class="w-28 text-right font-mono text-[11px] text-slate-500">
        <strong class="text-slate-800">${p.wpm || 0}</strong> wpm • ${p.acc || 100}%
      </div>
    `;
    playersProgressList.appendChild(row);
  });
}

function renderMultiplayerFinalStandings() {
  if (!currentRoomCode) return;
  multiplayerFinalBoard.classList.remove('hidden');
  multiplayerFinalList.innerHTML = '';

  const list = Object.entries(roomPlayers).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  list.forEach(([pid, p], idx) => {
    const isMe = pid === myPeerId;
    const item = document.createElement('div');
    item.className = `flex items-center justify-between px-2.5 py-1.5 rounded-xl ${isMe ? 'bg-blue-50/80 text-blue-700 font-semibold' : 'text-slate-700'}`;
    item.innerHTML = `
      <span>#${idx + 1} ${p.name}</span>
      <span class="font-mono text-[11px]">Rank ${p.rank || 'C'} • ${p.wpm || 0} WPM • ${(p.score || 0).toLocaleString()} pts</span>
    `;
    multiplayerFinalList.appendChild(item);
  });
}

function runRaceCountdown() {
  if (!transcriptLines.length) {
    showToast('กรุณาค้นหาและเลือกคลิปก่อนเริ่มแข่ง');
    return;
  }
  scoreModal.classList.add('hidden');
  resetStats();
  goToLine(0, false);
  if (isPlayerReady && player && player.pauseVideo) player.pauseVideo();

  countdownOverlay.classList.remove('hidden');
  let count = 3;
  countdownText.textContent = count;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownText.textContent = count;
    } else {
      clearInterval(timer);
      countdownOverlay.classList.add('hidden');
      startTime = Date.now();
      goToLine(0, true);
      focusTyping();
    }
  }, 1000);
}

function leaveMultiplayerRoom() {
  if (peer) peer.destroy();
  peer = null;
  currentRoomCode = '';
  isRoomHost = false;
  roomPlayers = {};
  multiplayerBar.classList.add('hidden');
  const u = new URL(window.location.href);
  u.searchParams.delete('room');
  window.history.replaceState({}, '', u);
}

// ============================================================================
// YOUTUBE SEARCH & TRANSCRIPT LOADING
// ============================================================================
function looksLikeYouTubeUrlOrId(input) {
  if (!input) return false;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return true;
  return input.includes('youtube.com/') || input.includes('youtu.be/');
}

// Helper: Fetch from Netlify API first; if YouTube blocks Netlify's cloud IP, automatically fall back to local residential server (http://localhost:3000)
async function fetchApiWithLocalFallback(apiPath) {
  try {
    const res = await fetch(apiPath);
    if (res.ok) {
      return await res.json();
    }
    // If running on Netlify and YouTube blocked the datacenter IP, try localhost:3000 bridge
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      try {
        const localRes = await fetch(`http://localhost:3000${apiPath}`);
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch (localErr) {
        // localhost:3000 not running on this machine
      }
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'โหลดข้อมูลไม่สำเร็จ');
  } catch (err) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      try {
        const localRes = await fetch(`http://localhost:3000${apiPath}`);
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch (e) {}
    }
    throw err;
  }
}

async function handleSearchOrLoad() {
  const query = ytSearchInput.value.trim();
  if (!query) return;

  if (looksLikeYouTubeUrlOrId(query)) {
    return loadClip(query, currentLang);
  }

  searchVideoBtn.disabled = true;
  searchVideoBtn.textContent = 'กำลังค้นหา...';
  modalErrorMsg.classList.add('hidden');

  try {
    const data = await fetchApiWithLocalFallback(`/api/search?q=${encodeURIComponent(query)}`);

    if (!data || !data.results) {
      modalErrorMsg.textContent = 'ไม่พบผลการค้นหา';
      modalErrorMsg.classList.remove('hidden');
      return;
    }

    renderSearchResults(data.results);
  } catch (err) {
    modalErrorMsg.textContent = 'ค้นหาไม่สำเร็จ: ' + err.message;
    modalErrorMsg.classList.remove('hidden');
  } finally {
    searchVideoBtn.disabled = false;
    searchVideoBtn.textContent = 'ค้นหา';
  }
}

function renderSearchResults(results) {
  searchResultsContainer.innerHTML = '';

  if (results.length === 0) {
    searchResultsContainer.innerHTML = `<div class="text-xs text-slate-400 py-8 text-center">ไม่พบคลิปที่มีซับแท้สำหรับคำค้นหานี้</div>`;
    return;
  }

  results.forEach(item => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer';
    row.innerHTML = `
      <div class="w-24 aspect-video rounded-lg overflow-hidden bg-slate-200 shrink-0 relative">
        <img src="${item.thumbnail}" alt="" class="w-full h-full object-cover" loading="lazy" />
        ${item.duration ? `<span class="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">${item.duration}</span>` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-slate-800 line-clamp-2">${item.title}</div>
        <div class="text-[11px] text-slate-400 mt-0.5 truncate">${item.channel}</div>
      </div>
    `;
    row.addEventListener('click', () => loadClip(item.videoId, currentLang));
    searchResultsContainer.appendChild(row);
  });
}

async function loadClip(videoInput, preferredLang = '') {
  if (!videoInput) return;
  searchVideoBtn.disabled = true;
  searchVideoBtn.textContent = 'กำลังโหลด...';
  modalErrorMsg.classList.add('hidden');

  try {
    const data = await fetchApiWithLocalFallback(`/api/transcript?v=${encodeURIComponent(videoInput)}&lang=${encodeURIComponent(preferredLang)}`);

    if (!data || !data.lines || data.lines.length === 0) {
      modalErrorMsg.textContent = (data && data.error) || 'คลิปนี้ไม่มีซับไตเติ้ล';
      modalErrorMsg.classList.remove('hidden');
      return;
    }

    applyLoadedClip(data.videoId, data.title, data.selectedLanguage || preferredLang, data.lines, data.availableTracks);
  } catch (err) {
    modalErrorMsg.textContent = err.message;
    modalErrorMsg.classList.remove('hidden');
  } finally {
    searchVideoBtn.disabled = false;
    searchVideoBtn.textContent = 'ค้นหา';
  }
}

function applyLoadedClip(videoId, title, selectedLang, lines, availableTracks) {
  currentVideoId = videoId;
  currentVideoTitle = title;
  currentLang = selectedLang;
  videoTitleEl.textContent = title;

  videoSection.classList.remove('hidden');
  targetTextDisplay.classList.remove('text-slate-400');

  if (isPlayerReady && player && player.loadVideoById) {
    player.loadVideoById(currentVideoId);
    player.pauseVideo();
  }

  if (availableTracks && availableTracks.length) {
    langSelect.innerHTML = '';
    availableTracks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.vssId || t.languageCode;
      opt.textContent = `${t.languageCode.toUpperCase()} — ${t.name}`;
      if ((t.vssId === selectedLang) || t.languageCode.startsWith(selectedLang)) {
        opt.selected = true;
      }
      langSelect.appendChild(opt);
    });
  }

  transcriptLines = lines
    .map(l => ({ ...l, text: normalizeTextForTyping(l.text) }))
    .filter(l => l.text.length > 0);

  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('v', currentVideoId);
  if (selectedLang) newUrl.searchParams.set('lang', selectedLang);
  window.history.replaceState({}, '', newUrl);

  sourceModal.classList.add('hidden');
  scoreModal.classList.add('hidden');
  resetStats();
  goToLine(0, true);
  focusTyping();

  if (isRoomHost && currentRoomCode) {
    broadcastClipToGuests();
  }
}

function resetStats() {
  startTime = null;
  totalTypedChars = 0;
  totalCorrectChars = 0;
  updateStatsUI();
}

function updateStatsUI() {
  const m = getCurrentMetrics();
  statWpm.textContent = m.wpm;
  statAcc.textContent = `${m.acc}%`;
  statProgress.textContent = `${transcriptLines.length ? currentLineIndex + 1 : 0}/${transcriptLines.length}`;
}

function renderTargetSentence(targetText, typedText) {
  targetTextDisplay.innerHTML = '';

  const clusters = groupIntoGraphemeClusters(targetText);
  const cursorIdx = typedText.length;

  clusters.forEach(cluster => {
    const span = document.createElement('span');
    span.textContent = cluster.text;

    const isSpace = cluster.text === ' ';
    let cls = isSpace ? 't-cluster t-space ' : 't-cluster ';

    if (cursorIdx >= cluster.endIndex) {
      const typedSlice = typedText.slice(cluster.startIndex, cluster.endIndex);
      cls += (typedSlice === cluster.text) ? 't-correct' : 't-wrong';
    } else if (cursorIdx <= cluster.startIndex) {
      cls += (cursorIdx === cluster.startIndex) ? 't-active' : 't-pending';
    } else {
      const typedPart = typedText.slice(cluster.startIndex, cursorIdx);
      const expectedPart = cluster.text.slice(0, cursorIdx - cluster.startIndex);
      cls += (typedPart === expectedPart) ? 't-partial' : 't-wrong';
    }

    span.className = cls;
    targetTextDisplay.appendChild(span);
  });

  const nextExpectedChar = targetText[typedText.length] || '';
  renderKeyboard(nextExpectedChar);
}

function goToLine(index, seekVideo = true) {
  if (!transcriptLines.length) return;
  currentLineIndex = Math.max(0, Math.min(index, transcriptLines.length - 1));
  const line = transcriptLines[currentLineIndex];

  hiddenInput.value = '';
  waitingForTypingToFinish = false;

  timestampPill.textContent = formatTime(line.start);
  nextLinePreview.textContent = currentLineIndex < transcriptLines.length - 1
    ? transcriptLines[currentLineIndex + 1].text
    : '';

  renderTargetSentence(line.text, '');
  updateStatsUI();

  if (seekVideo && isPlayerReady && player && typeof player.seekTo === 'function') {
    player.seekTo(Math.max(0, line.start), true);
    player.playVideo();
  }
}

function focusTyping() {
  if (!sourceModal.classList.contains('hidden')) return;
  if (!scoreModal.classList.contains('hidden')) return;
  if (!roomModal.classList.contains('hidden')) return;
  hiddenInput.focus();
}

function checkAndAdvanceIfLineComplete() {
  const line = transcriptLines[currentLineIndex];
  if (!line) return;
  if (hiddenInput.value === line.text) {
    if (currentLineIndex < transcriptLines.length - 1) {
      const shouldSeek = !waitingForTypingToFinish;
      goToLine(currentLineIndex + 1, shouldSeek);
      if (isPlayerReady && player) {
        player.playVideo();
      }
      syncMyProgressToRoom(false);
    } else {
      showScoreSummary();
    }
  }
}

hiddenInput.addEventListener('input', () => {
  if (!transcriptLines.length) return;
  const line = transcriptLines[currentLineIndex];
  if (!line) return;

  if (!startTime && hiddenInput.value.length > 0) {
    startTime = Date.now();
  }

  let typed = hiddenInput.value
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/เเ/g, 'แ');
  const target = line.text;

  if (typed.length <= target.length) {
    const lastIdx = typed.length - 1;
    if (lastIdx >= 0 && target[lastIdx] === ' ' && typed[lastIdx] !== ' ' && target[lastIdx + 1] === typed[lastIdx]) {
      typed = typed.slice(0, lastIdx) + ' ' + typed[lastIdx];
      hiddenInput.value = typed;
    }
  }

  totalTypedChars++;
  const latestIdx = typed.length - 1;
  if (latestIdx >= 0 && typed[latestIdx] === target[latestIdx]) {
    totalCorrectChars++;
  }

  renderTargetSentence(target, typed);
  updateStatsUI();
  syncMyProgressToRoom(false);
  checkAndAdvanceIfLineComplete();
});

window.addEventListener('keydown', (e) => {
  if (!sourceModal.classList.contains('hidden')) {
    if (e.key === 'Escape') sourceModal.classList.add('hidden');
    return;
  }
  if (!scoreModal.classList.contains('hidden')) {
    if (e.key === 'Escape') scoreModal.classList.add('hidden');
    return;
  }
  if (!roomModal.classList.contains('hidden')) {
    if (e.key === 'Escape') roomModal.classList.add('hidden');
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    replayCurrentLine();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    if (!transcriptLines.length) return;
    if (currentLineIndex < transcriptLines.length - 1) {
      goToLine(currentLineIndex + 1, true);
      syncMyProgressToRoom(false);
    } else {
      showScoreSummary();
    }
    return;
  }

  if (document.activeElement !== hiddenInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
    hiddenInput.focus();
  }
});

function replayCurrentLine() {
  if (!transcriptLines.length) return;
  const line = transcriptLines[currentLineIndex];
  if (isPlayerReady && player) {
    player.seekTo(Math.max(0, line.start), true);
    player.playVideo();
  }
  focusTyping();
}

typingStage.addEventListener('click', (e) => {
  if (!['SELECT', 'BUTTON', 'INPUT'].includes(e.target.tagName)) {
    focusTyping();
  }
});

replayBtn.addEventListener('click', replayCurrentLine);
prevLineBtn.addEventListener('click', () => {
  if (currentLineIndex > 0) goToLine(currentLineIndex - 1, true);
  focusTyping();
});
nextLineBtn.addEventListener('click', () => {
  if (currentLineIndex < transcriptLines.length - 1) {
    goToLine(currentLineIndex + 1, true);
    focusTyping();
  } else {
    showScoreSummary();
  }
});
finishBtn.addEventListener('click', showScoreSummary);

playAgainBtn.addEventListener('click', () => {
  scoreModal.classList.add('hidden');
  resetStats();
  goToLine(0, true);
  focusTyping();
});

shareResultBtn.addEventListener('click', async () => {
  const m = getCurrentMetrics();
  const msg = `typetube — ${currentVideoTitle}\nRank: ${m.rank} (${m.score.toLocaleString()} pts) | ${m.wpm} WPM | ${m.acc}%\n${window.location.href}`;
  try {
    await navigator.clipboard.writeText(msg);
    showToast('คัดลอกผลคะแนนแล้ว');
  } catch (e) {
    prompt('คัดลอกผลคะแนน:', msg);
  }
});

langSelect.addEventListener('change', () => {
  if (currentVideoId && langSelect.value) {
    loadClip(currentVideoId, langSelect.value);
  }
});

toggleKeyboardBtn.addEventListener('click', () => {
  showKeyboard = !showKeyboard;
  toggleKeyboardBtn.classList.toggle('opacity-50', !showKeyboard);
  const line = transcriptLines[currentLineIndex];
  const nextChar = line ? line.text[hiddenInput.value.length] || '' : '';
  renderKeyboard(nextChar);
  focusTyping();
});

// Search Modal
openSourceModalBtn.addEventListener('click', () => {
  sourceModal.classList.remove('hidden');
  ytSearchInput.focus();
});
closeSourceModalBtn.addEventListener('click', () => {
  sourceModal.classList.add('hidden');
  focusTyping();
});
searchVideoBtn.addEventListener('click', handleSearchOrLoad);
ytSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearchOrLoad();
});

// Room Modal
openRoomModalBtn.addEventListener('click', () => {
  roomModal.classList.remove('hidden');
  playerNameInput.focus();
});
closeRoomModalBtn.addEventListener('click', () => {
  roomModal.classList.add('hidden');
  focusTyping();
});
createRoomBtn.addEventListener('click', createMultiplayerRoom);
joinRoomBtn.addEventListener('click', () => {
  joinMultiplayerRoom(joinRoomCodeInput.value);
});
joinRoomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinMultiplayerRoom(joinRoomCodeInput.value);
});

copyRoomLinkBtn.addEventListener('click', async () => {
  const u = new URL(window.location.href);
  u.searchParams.set('room', currentRoomCode);
  try {
    await navigator.clipboard.writeText(u.toString());
    showToast('คัดลอกลิงก์ห้องแข่งแล้ว ส่งให้เพื่อนได้เลย');
  } catch (e) {
    prompt('คัดลอกลิงก์ห้องแข่ง:', u.toString());
  }
});

startRaceBtn.addEventListener('click', () => {
  if (!isRoomHost) return;
  if (!transcriptLines.length) {
    showToast('กรุณาค้นหาและเลือกคลิปก่อนเริ่มแข่ง');
    return;
  }
  guestConns.forEach(c => {
    if (c.open) c.send({ type: 'START_COUNTDOWN' });
  });
  runRaceCountdown();
});

leaveRoomBtn.addEventListener('click', leaveMultiplayerRoom);

window.addEventListener('DOMContentLoaded', () => {
  initYouTubePlayer();
  renderKeyboard('');

  const params = new URLSearchParams(window.location.search);
  const urlVid = params.get('v');
  const urlLang = params.get('lang') || 'th';
  const roomParam = params.get('room');

  // Only load a video if explicitly passed in URL (`?v=...`); otherwise wait for user to search/select
  if (urlVid) {
    loadClip(urlVid, urlLang);
  } else {
    searchResultsContainer.innerHTML = `<div class="text-xs text-slate-400 py-10 text-center">พิมพ์ชื่อคลิปด้านบนเพื่อค้นหา</div>`;
  }

  if (roomParam) {
    joinRoomCodeInput.value = roomParam;
    roomModal.classList.remove('hidden');
    playerNameInput.focus();
  }
});
