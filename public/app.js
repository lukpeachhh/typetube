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
let isGameFinished = false;
let showKeyboard = true;

// Stats (Calculated purely from correct characters typed)
let startTime = null;
let completedLinesChars = 0; // Total characters in completed lines
let completedCorrectChars = 0; // Total correct characters in completed lines
let currentLineCorrectChars = 0; // Correct characters in current active line
let currentLineTypedChars = 0; // Typed characters in current active line

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
const changeNameBtn = document.getElementById('changeNameBtn');
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
      autoplay: 0,
      cc_load_policy: 0
    },
    events: {
      onReady: () => {
        isPlayerReady = true;
        if (currentVideoId) {
          player.cueVideoById(currentVideoId);
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
    const playerState = player.getPlayerState();

    // Never allow video to play automatically after game/race is finished!
    if (isGameFinished) {
      if (playerState === YT.PlayerState.PLAYING || playerState === YT.PlayerState.BUFFERING) {
        player.pauseVideo();
      }
      return;
    }

    if (!transcriptLines.length) return;
    const line = transcriptLines[currentLineIndex];
    if (!line) return;

    const currentTime = player.getCurrentTime();

    if (playerState === YT.PlayerState.PLAYING && currentTime >= line.end - 0.08) {
      player.pauseVideo();
      waitingForTypingToFinish = true;
    }
  }, 85);
}

// ============================================================================
// SCORE & ACCURACY CALCULATION (Calculated strictly from correct characters)
// ============================================================================
function countCorrectCharsInLine(target, typed) {
  let correct = 0;
  const len = Math.min(target.length, typed.length);
  for (let i = 0; i < len; i++) {
    if (typed[i] === target[i]) correct++;
  }
  return correct;
}

function getCurrentMetrics() {
  const totalCorrect = completedCorrectChars + currentLineCorrectChars;
  const totalEvaluated = completedLinesChars + currentLineTypedChars;
  const totalClipChars = transcriptLines.reduce((sum, l) => sum + l.text.length, 0) || 1;

  let wpm = 0;
  let elapsedSeconds = 0;
  if (startTime && totalCorrect > 0) {
    elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const elapsedMinutes = Math.max((Date.now() - startTime) / 60000, 0.02);
    wpm = Math.round((totalCorrect / 5) / elapsedMinutes);
  }

  // Accuracy is strictly based on how many characters match the target text
  const acc = totalEvaluated > 0
    ? Math.max(0, Math.min(100, Math.round((totalCorrect / totalEvaluated) * 100)))
    : 100;

  // Score & Progress are strictly based on correct characters matched against the clip!
  const score = totalCorrect * 10;
  const progressPct = Math.min(100, Math.round((totalCorrect / totalClipChars) * 100));

  let rank = 'C';
  let comment = 'เริ่มต้นได้ดี ลองฝึกพิมพ์ให้แม่นขึ้นอีกนิด';
  let rankStyle = 'bg-slate-100 text-slate-700 border-slate-200';

  if (acc >= 96 && progressPct >= 90) {
    rank = 'S';
    comment = 'แม่นยำไร้ที่ติ พิมพ์ถูกครบทุกคำ';
    rankStyle = 'bg-blue-50 text-blue-600 border-blue-200';
  } else if (acc >= 90 && progressPct >= 75) {
    rank = 'A';
    comment = 'ยอดเยี่ยมมาก พิมพ์ถูกต้องและแม่นยำ';
    rankStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  } else if (acc >= 80 && progressPct >= 50) {
    rank = 'B';
    comment = 'ทำได้ดีมาก พิมพ์ถูกเป็นส่วนใหญ่';
    rankStyle = 'bg-amber-50 text-amber-600 border-amber-200';
  }

  return { wpm, acc, elapsedSeconds, score, rank, comment, rankStyle, progressPct, totalCorrect };
}

function showScoreSummary() {
  if (!transcriptLines.length) return;

  // Lock video playback so it NEVER plays on its own when the race finishes
  isGameFinished = true;
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
    syncMyProgressToRoom();
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

// Allow any player (Host or Friend) to change their nickname at any time
function promptChangePlayerName() {
  const newName = prompt('ตั้งชื่อเล่นใหม่ของคุณ:', myPlayerName);
  if (!newName || !newName.trim()) return;
  myPlayerName = newName.trim().slice(0, 16);
  playerNameInput.value = myPlayerName;

  if (!currentRoomCode) return;

  if (isRoomHost) {
    if (roomPlayers[myPeerId]) {
      roomPlayers[myPeerId].name = myPlayerName;
    }
    broadcastRoomState();
    renderMultiplayerProgressUI();
    if (!scoreModal.classList.contains('hidden')) {
      renderMultiplayerFinalStandings();
    }
  } else if (hostConn && hostConn.open) {
    hostConn.send({
      type: 'RENAME',
      peerId: myPeerId,
      name: myPlayerName
    });
  }
  showToast(`เปลี่ยนชื่อเป็น "${myPlayerName}" แล้ว`);
  focusTyping();
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
    } else if (msg.type === 'RENAME') {
      if (roomPlayers[msg.peerId] && msg.name) {
        roomPlayers[msg.peerId].name = String(msg.name).trim().slice(0, 16);
        broadcastRoomState();
        renderMultiplayerProgressUI();
        if (!scoreModal.classList.contains('hidden')) {
          renderMultiplayerFinalStandings();
        }
      }
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

      // Cue video paused so it does NOT auto-play before the race starts
      if (isPlayerReady && player && player.cueVideoById) {
        player.cueVideoById(currentVideoId);
      }
      resetStats();
      goToLine(0, false);
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

function syncMyProgressToRoom() {
  if (!currentRoomCode) return;
  const m = getCurrentMetrics();

  if (isRoomHost) {
    if (roomPlayers[myPeerId]) {
      roomPlayers[myPeerId].wpm = m.wpm;
      roomPlayers[myPeerId].acc = m.acc;
      roomPlayers[myPeerId].progress = m.progressPct;
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
      progress: m.progressPct,
      score: m.score,
      rank: m.rank
    });
  }
}

// Rank players in multiplayer strictly by Accuracy / Correctness (score = correctChars * 10)
function sortPlayersByCorrectness(entries) {
  return entries.sort((a, b) => {
    const scoreDiff = (b[1].score || 0) - (a[1].score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b[1].acc || 0) - (a[1].acc || 0);
  });
}

function renderMultiplayerProgressUI() {
  playersProgressList.innerHTML = '';
  const list = sortPlayersByCorrectness(Object.entries(roomPlayers));

  list.forEach(([pid, p]) => {
    const isMe = pid === myPeerId;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';
    row.innerHTML = `
      <div class="w-28 truncate font-medium ${isMe ? 'text-blue-600 cursor-pointer hover:underline' : 'text-slate-700'}" title="${isMe ? 'คลิกเพื่อเปลี่ยนชื่อ' : ''}">
        ${p.name}${isMe ? ' (คุณ)' : ''}
      </div>
      <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-blue-600 transition-all duration-150" style="width: ${p.progress || 0}%"></div>
      </div>
      <div class="w-28 text-right font-mono text-[11px] text-slate-500">
        ถูก <strong class="text-slate-800">${p.progress || 0}%</strong> • ${p.acc || 100}%
      </div>
    `;
    if (isMe) {
      row.querySelector('div').addEventListener('click', promptChangePlayerName);
    }
    playersProgressList.appendChild(row);
  });
}

function renderMultiplayerFinalStandings() {
  if (!currentRoomCode) return;
  multiplayerFinalBoard.classList.remove('hidden');
  multiplayerFinalList.innerHTML = '';

  const list = sortPlayersByCorrectness(Object.entries(roomPlayers));
  list.forEach(([pid, p], idx) => {
    const isMe = pid === myPeerId;
    const item = document.createElement('div');
    item.className = `flex items-center justify-between px-2.5 py-1.5 rounded-xl ${isMe ? 'bg-blue-50/80 text-blue-700 font-semibold' : 'text-slate-700'}`;
    item.innerHTML = `
      <span>#${idx + 1} ${p.name}</span>
      <span class="font-mono text-[11px]">แม่นยำ ${p.acc || 100}% • ถูก ${p.progress || 0}% (${(p.score || 0).toLocaleString()} pts)</span>
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
      isGameFinished = false;
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

const transcriptCache = new Map();

async function fetchApi(apiPath) {
  if (transcriptCache.has(apiPath)) {
    return transcriptCache.get(apiPath);
  }
  const res = await fetch(apiPath);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
  }
  if (apiPath.startsWith('/api/transcript') && data.lines && data.lines.length > 0) {
    transcriptCache.set(apiPath, data);
  }
  return data;
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
    const data = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);

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
    const data = await fetchApi(`/api/transcript?v=${encodeURIComponent(videoInput)}&lang=${encodeURIComponent(preferredLang)}`);

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

  // Cue the video paused first so it doesn't auto-play unexpectedly; only play when user starts or race starts
  if (isPlayerReady && player && player.cueVideoById) {
    player.cueVideoById(currentVideoId);
  }
  goToLine(0, !currentRoomCode);
  focusTyping();

  if (isRoomHost && currentRoomCode) {
    broadcastClipToGuests();
  }
}

function resetStats() {
  startTime = null;
  isGameFinished = false;
  completedLinesChars = 0;
  completedCorrectChars = 0;
  currentLineCorrectChars = 0;
  currentLineTypedChars = 0;
  updateStatsUI();
  if (currentRoomCode) {
    syncMyProgressToRoom();
  }
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

function commitCurrentLineStats() {
  const line = transcriptLines[currentLineIndex];
  if (!line) return;
  completedLinesChars += line.text.length;
  completedCorrectChars += countCorrectCharsInLine(line.text, hiddenInput.value);
  currentLineCorrectChars = 0;
  currentLineTypedChars = 0;
}

function goToLine(index, seekVideo = true) {
  if (!transcriptLines.length) return;
  currentLineIndex = Math.max(0, Math.min(index, transcriptLines.length - 1));
  const line = transcriptLines[currentLineIndex];

  hiddenInput.value = '';
  currentLineCorrectChars = 0;
  currentLineTypedChars = 0;
  waitingForTypingToFinish = false;

  timestampPill.textContent = formatTime(line.start);
  nextLinePreview.textContent = currentLineIndex < transcriptLines.length - 1
    ? transcriptLines[currentLineIndex + 1].text
    : '';

  renderTargetSentence(line.text, '');
  updateStatsUI();

  if (seekVideo && !isGameFinished && isPlayerReady && player && typeof player.seekTo === 'function') {
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
    commitCurrentLineStats();
    if (currentLineIndex < transcriptLines.length - 1) {
      const shouldSeek = !waitingForTypingToFinish;
      goToLine(currentLineIndex + 1, shouldSeek);
      if (!isGameFinished && isPlayerReady && player) {
        player.playVideo();
      }
      syncMyProgressToRoom();
    } else {
      showScoreSummary();
    }
  }
}

hiddenInput.addEventListener('input', () => {
  if (!transcriptLines.length || isGameFinished) return;
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

  currentLineTypedChars = Math.max(typed.length, currentLineTypedChars);
  currentLineCorrectChars = countCorrectCharsInLine(target, typed);

  renderTargetSentence(target, typed);
  updateStatsUI();
  syncMyProgressToRoom();
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
    if (!transcriptLines.length || isGameFinished) return;
    commitCurrentLineStats();
    if (currentLineIndex < transcriptLines.length - 1) {
      goToLine(currentLineIndex + 1, true);
      syncMyProgressToRoom();
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
  if (!transcriptLines.length || isGameFinished) return;
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
  if (currentLineIndex > 0 && !isGameFinished) goToLine(currentLineIndex - 1, true);
  focusTyping();
});
nextLineBtn.addEventListener('click', () => {
  if (!transcriptLines.length || isGameFinished) return;
  commitCurrentLineStats();
  if (currentLineIndex < transcriptLines.length - 1) {
    goToLine(currentLineIndex + 1, true);
    syncMyProgressToRoom();
    focusTyping();
  } else {
    showScoreSummary();
  }
});
finishBtn.addEventListener('click', () => {
  commitCurrentLineStats();
  showScoreSummary();
});

// When clicking "หาเพลงใหม่ / เลือกคลิปใหม่" after finishing, pause video and open Search Modal!
playAgainBtn.addEventListener('click', () => {
  isGameFinished = true;
  if (isPlayerReady && player && player.pauseVideo) {
    player.pauseVideo();
  }
  scoreModal.classList.add('hidden');
  sourceModal.classList.remove('hidden');
  ytSearchInput.value = '';
  ytSearchInput.focus();
});

shareResultBtn.addEventListener('click', async () => {
  const m = getCurrentMetrics();
  const msg = `typetube — ${currentVideoTitle}\nRank: ${m.rank} (${m.score.toLocaleString()} pts) | แม่นยำ ${m.acc}% | ${m.wpm} WPM\n${window.location.href}`;
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

// Room Modal & Nickname change
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

if (changeNameBtn) {
  changeNameBtn.addEventListener('click', promptChangePlayerName);
}

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
