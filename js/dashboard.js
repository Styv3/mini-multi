// ============================================================
//  MINI-MULTI | Dashboard — Vue joueur / spectateur
// ============================================================

let teams   = [];
let results = [];
let steps   = [];
let anncs   = [];
let haloAssignments = [];

const myTeamId   = localStorage.getItem('mm_team_id');
const myTeamName = localStorage.getItem('mm_team_name');
const userType   = localStorage.getItem('mm_user_type');

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  if (!userType) {
    window.location.href = 'index.html';
    return;
  }

  updateHeaderUser();
  setLoading(true);

  await Promise.all([
    loadLeaderboard(),
    loadSchedule(),
    loadAnnouncements(),
    loadHaloAssignments(),
  ]);

  setLoading(false);
  setupPopup();
  setupRealtime();
}

function updateHeaderUser() {
  const el = document.getElementById('header-user-info');
  if (userType === 'player' && myTeamName) {
    el.innerHTML = `<span class="user-dot"></span> ${myTeamName}`;
  } else {
    el.innerHTML = `<span style="color:var(--text-muted)">Spectateur</span>`;
  }
}

function setLoading(on) {
  document.getElementById('lb-loading').classList.toggle('hidden', !on);
  document.getElementById('lb-content').classList.toggle('hidden',  on);
}

// ─── CLASSEMENT ───────────────────────────────────────────────
async function loadLeaderboard() {
  [teams, results] = await Promise.all([getTeams(), getResults()]);
  renderLeaderboard();
  renderHaloPanel();
}

function renderLeaderboard() {
  const ranked = computeLeaderboard(teams, results);
  const tbody  = document.getElementById('lb-tbody');

  if (ranked.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="empty-state">
        <div class="icon">🎮</div>
        Le tournoi n'a pas encore commencé.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = ranked.map((team, i) => {
    const rank = i + 1;
    const isMe = team.id === myTeamId;
    const rankPip = rankPipHTML(rank);

    const fgCell = scoreCell(team.fgPos, 'fg');
    const mcCell = scoreCell(team.mcPos, 'mc');
    const hiCell = scoreCell(team.hiPos, 'hi');

    const totalStr = team.gamesPlayed > 0
      ? `<span class="total-val">${team.total}</span>`
      : `<span class="score-pill empty">—</span>`;

    return `
      <tr class="${isMe ? 'my-team' : ''}">
        <td class="col-rank">${rankPip}</td>
        <td class="team-cell">
          <div class="team-name">${esc(team.name)}</div>
          <div class="team-players">${esc(team.player1)} &amp; ${esc(team.player2)}</div>
        </td>
        <td class="score-cell">${fgCell}</td>
        <td class="score-cell">${mcCell}</td>
        <td class="score-cell">${hiCell}</td>
        <td class="total-cell">${totalStr}</td>
      </tr>`;
  }).join('');
}

function scoreCell(pos, cls) {
  if (pos === null || pos === undefined) {
    return `<span class="score-pill empty">—</span>`;
  }
  return `<span class="score-pill ${cls}">${pos}</span>`;
}

function rankPipHTML(rank) {
  if (rank === 1) return `<span class="rank-pip r1">1</span>`;
  if (rank === 2) return `<span class="rank-pip r2">2</span>`;
  if (rank === 3) return `<span class="rank-pip r3">3</span>`;
  return `<span class="rank-pip rn">${rank}</span>`;
}

// ─── PANEL HALO ───────────────────────────────────────────────
async function loadHaloAssignments() {
  haloAssignments = await getHaloAssignments();
  renderHaloPanel();
}

function renderHaloPanel() {
  const panel = document.getElementById('halo-panel');
  if (haloAssignments.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');

  const lobby1 = haloAssignments.filter(a => a.player1_lobby === 1 || a.player2_lobby === 1);
  const lobby2 = haloAssignments.filter(a => a.player1_lobby === 2 || a.player2_lobby === 2);

  document.getElementById('lobby1-players').innerHTML = renderLobbyPlayers(1);
  document.getElementById('lobby2-players').innerHTML = renderLobbyPlayers(2);
}

function renderLobbyPlayers(lobbyNum) {
  const rows = [];
  for (const a of haloAssignments) {
    const t = a.teams;
    if (!t) continue;
    if (a.player1_lobby === lobbyNum) {
      rows.push(`<div class="lobby-player-row">
        <span class="lp-team">${esc(t.name)}</span>
        <span class="lp-player">${esc(t.player1)}</span>
      </div>`);
    }
    if (a.player2_lobby === lobbyNum) {
      rows.push(`<div class="lobby-player-row">
        <span class="lp-team">${esc(t.name)}</span>
        <span class="lp-player">${esc(t.player2)}</span>
      </div>`);
    }
  }
  return rows.length > 0
    ? rows.join('')
    : `<div class="lobby-empty">Aucun joueur assigné</div>`;
}

// ─── PROGRAMME ────────────────────────────────────────────────
async function loadSchedule() {
  steps = await getTournamentSteps();
  renderSchedule();
}

function renderSchedule() {
  const list = document.getElementById('schedule-list');
  if (steps.length === 0) { list.innerHTML = ''; return; }

  list.innerHTML = steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    return `
      <div class="sched-item ${s.status}">
        <div class="sched-indicator">
          <div class="sched-dot"></div>
          ${!isLast ? '<div class="sched-line"></div>' : ''}
        </div>
        <div class="sched-content">
          <div class="sched-step-title">
            ${esc(s.title)}
            ${s.status === 'current' ? '<span class="sched-en-cours">En cours</span>' : ''}
          </div>
          ${s.description ? `<div class="sched-step-desc">${esc(s.description)}</div>` : ''}
          ${s.game && s.game !== 'general' ? `<span class="badge badge-${gameBadge(s.game)}" style="margin-top:.3rem">${gameLabel(s.game)}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function gameBadge(game) {
  return { fall_guys: 'fg', minecraft: 'mc', halo: 'hi' }[game] ?? 'general';
}

// ─── ANNONCES ─────────────────────────────────────────────────
async function loadAnnouncements() {
  anncs = await getAnnouncements();
  renderAnnouncements();
}

function renderAnnouncements() {
  checkNewImportantAnnouncements(anncs);
  const list = document.getElementById('annc-list');
  if (anncs.length === 0) {
    list.innerHTML = `<div class="annc-empty">Aucune annonce pour le moment.</div>`;
    return;
  }

  list.innerHTML = anncs.slice(0, 8).map(a => {
    const typeClass = { halo: 'type-halo', important: 'type-important', general: '' }[a.type] ?? '';
    const typeColor = { halo: 'var(--hi)', important: 'var(--gold)', general: 'var(--accent)' }[a.type];
    const typeLabel = { halo: 'Halo Infinite', important: 'Important', general: 'Annonce' }[a.type] ?? a.type;
    return `
      <div class="annc-item ${a.pinned ? 'pinned' : ''} ${typeClass}">
        <div class="annc-type" style="color:${typeColor}">${a.pinned ? '📌 ' : ''}${typeLabel}</div>
        <div class="annc-title">${esc(a.title)}</div>
        ${a.content ? `<div class="annc-content">${esc(a.content)}</div>` : ''}
        <div class="annc-time">${timeAgo(a.created_at)}</div>
      </div>`;
  }).join('');
}

// ─── POPUP PROCHAINE ÉTAPE ────────────────────────────────────
function setupPopup() {
  const currentStep = steps.find(s => s.status === 'current');
  const popup = document.getElementById('step-popup');

  if (!currentStep) {
    popup.classList.add('hidden');
    return;
  }

  // Ne pas montrer si déjà fermé cette session
  if (sessionStorage.getItem('mm_popup_closed') === currentStep.id) {
    popup.classList.add('hidden');
    return;
  }

  document.getElementById('popup-step-title').textContent = currentStep.title;
  document.getElementById('popup-step-desc').textContent  = currentStep.description ?? '';
  const badgeEl = document.getElementById('popup-badge');
  if (currentStep.game && currentStep.game !== 'general') {
    badgeEl.className = `badge badge-${gameBadge(currentStep.game)}`;
    badgeEl.textContent = gameLabel(currentStep.game);
    badgeEl.classList.remove('hidden');
  } else {
    badgeEl.classList.add('hidden');
  }
  popup.classList.remove('hidden');
}

function closePopup() {
  const currentStep = steps.find(s => s.status === 'current');
  if (currentStep) sessionStorage.setItem('mm_popup_closed', currentStep.id);
  document.getElementById('step-popup').classList.add('hidden');
}

// ─── TEMPS RÉEL ───────────────────────────────────────────────
function setupRealtime() {
  subscribeToTable('results', async () => {
    results = await getResults();
    renderLeaderboard();
  });
  subscribeToTable('announcements', async () => {
    anncs = await getAnnouncements();
    renderAnnouncements();
  });
  subscribeToTable('tournament_steps', async () => {
    steps = await getTournamentSteps();
    renderSchedule();
    setupPopup();
  });
  subscribeToTable('teams', async () => {
    teams = await getTeams();
    renderLeaderboard();
  });
  subscribeToTable('halo_assignments', async () => {
    haloAssignments = await getHaloAssignments();
    renderHaloPanel();
  });
}

// ─── RÈGLES (accordion) ───────────────────────────────────────
function toggleRules(game) {
  const content = document.getElementById(`rules-content-${game}`);
  const chevron = document.getElementById(`rules-chevron-${game}`);
  const isOpen  = !content.classList.contains('hidden');
  content.classList.toggle('hidden', isOpen);
  chevron.classList.toggle('open', !isOpen);
}

// ─── NOTIFICATION SONORE ──────────────────────────────────────
let _seenImportantIds = null; // null = pas encore initialisé (premier chargement)

function playNotificationSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    // Deux notes courtes (ding-ding)
    [[880, 0, 0.15], [1100, 0.18, 0.15]].forEach(([freq, start, dur]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
  } catch (e) { /* autoplay bloqué ou navigateur non supporté */ }
}

function checkNewImportantAnnouncements(currentAnncs) {
  const importantIds = new Set(currentAnncs.filter(a => a.type === 'important').map(a => a.id));

  if (_seenImportantIds === null) {
    // Premier appel : on mémorise l'existant sans jouer de son
    _seenImportantIds = importantIds;
    return;
  }

  let hasNew = false;
  for (const id of importantIds) {
    if (!_seenImportantIds.has(id)) { _seenImportantIds.add(id); hasNew = true; }
  }
  if (hasNew) playNotificationSound();
}

// ─── DÉCONNEXION ──────────────────────────────────────────────
function logout() {
  localStorage.removeItem('mm_user_type');
  localStorage.removeItem('mm_team_id');
  localStorage.removeItem('mm_team_name');
  window.location.href = 'index.html';
}

// ─── UTILS ────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
