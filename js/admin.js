// ============================================================
//  MINI-MULTI | Panneau d'administration
// ============================================================

let teams   = [];
let results = [];
let anncs   = [];
let steps   = [];
let haloAssignments = [];

let currentSection = 'overview';
let editingAnncId  = null;
let currentGame    = 'fall_guys';

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  await loadAll();
  renderNav();
  showSection('overview');
  setupRealtime();
}

async function loadAll() {
  [teams, results, anncs, steps, haloAssignments] = await Promise.all([
    getTeams(),
    getResults(),
    getAnnouncements(),
    getTournamentSteps(),
    getHaloAssignments(),
  ]);
}

// ─── NAVIGATION ───────────────────────────────────────────────
function renderNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === currentSection);
  });
}

function showSection(section) {
  currentSection = section;
  renderNav();
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.remove('hidden');

  // Render selon la section
  const renders = {
    overview:      renderOverview,
    teams:         renderTeams,
    scores:        renderScores,
    halo:          renderHalo,
    announcements: renderAnnouncements,
    schedule:      renderSchedule,
  };
  renders[section]?.();
}

// ─── OVERVIEW ─────────────────────────────────────────────────
function renderOverview() {
  document.getElementById('ov-teams-count').textContent  = teams.length;
  const gamesWithScores = ['fall_guys','minecraft','halo'].filter(g =>
    results.some(r => r.game === g && r.position !== null)
  );
  document.getElementById('ov-games-done').textContent   = `${gamesWithScores.length}/3`;
  document.getElementById('ov-anncs-count').textContent  = anncs.length;
  const curStep = steps.find(s => s.status === 'current');
  document.getElementById('ov-current-step').textContent = curStep ? curStep.title : '—';
}

// ─── ÉQUIPES ──────────────────────────────────────────────────
function renderTeams() {
  const tbody = document.getElementById('teams-tbody');
  if (teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="padding:2rem">
      <div class="icon">👥</div> Aucune équipe. Ajoutes-en une ci-dessous.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = teams.map(t => `
    <tr>
      <td><strong>${esc(t.name)}</strong></td>
      <td>${esc(t.player1)}</td>
      <td>${esc(t.player2)}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="editTeam('${t.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteTeam('${t.id}','${esc(t.name)}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

async function submitAddTeam() {
  const name    = document.getElementById('new-team-name').value.trim();
  const player1 = document.getElementById('new-player1').value.trim();
  const player2 = document.getElementById('new-player2').value.trim();
  if (!name || !player1 || !player2) { showToast('Remplis tous les champs.', 'error'); return; }

  const { error } = await addTeam(name, player1, player2);
  if (error) { showToast('Erreur : ' + (error.message ?? error), 'error'); return; }

  showToast('Équipe ajoutée !');
  document.getElementById('new-team-name').value  = '';
  document.getElementById('new-player1').value    = '';
  document.getElementById('new-player2').value    = '';
  teams = await getTeams();
  renderTeams();
  renderScores();
  renderHalo();
}

function editTeam(id) {
  const t = teams.find(t => t.id === id);
  if (!t) return;
  const name    = prompt('Nom de l\'équipe :', t.name);
  if (name === null) return;
  const p1 = prompt('Joueur 1 :', t.player1);
  if (p1 === null) return;
  const p2 = prompt('Joueur 2 :', t.player2);
  if (p2 === null) return;
  updateTeam(id, { name: name.trim(), player1: p1.trim(), player2: p2.trim() }).then(async ({ error }) => {
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Équipe mise à jour.');
    teams = await getTeams();
    renderTeams();
    renderScores();
    renderHalo();
  });
}

function confirmDeleteTeam(id, name) {
  if (!confirm(`Supprimer l'équipe "${name}" ? Tous ses scores seront supprimés.`)) return;
  deleteTeam(id).then(async ({ error }) => {
    if (error) { showToast('Erreur.', 'error'); return; }
    showToast('Équipe supprimée.');
    teams   = await getTeams();
    results = await getResults();
    renderTeams();
  });
}

// ─── SCORES ───────────────────────────────────────────────────
function renderScores() {
  // Sélection du jeu
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.game === currentGame);
  });

  const wrap = document.getElementById('score-entries');
  if (teams.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="padding:2rem">
      <div class="icon">👥</div>
      Ajoute des équipes d'abord.
    </div>`;
    return;
  }

  const isFG = currentGame === 'fall_guys';
  wrap.innerHTML = teams.map(team => {
    const r = results.find(r => r.team_id === team.id && r.game === currentGame);
    const pos   = r?.position ?? '';
    const top1  = r?.fg_top1_count ?? '';
    const best  = r?.fg_best_score ?? '';

    return `
      <div class="score-entry-row">
        <div>
          <div class="ser-team-name">${esc(team.name)}</div>
          <div class="ser-players">${esc(team.player1)} &amp; ${esc(team.player2)}</div>
          ${isFG ? `
          <div class="fg-extra">
            <span class="input-label">Top 1 :</span>
            <input type="number" min="0" class="pos-input" id="fg-top1-${team.id}" value="${top1}" placeholder="0">
            <span class="input-label" style="margin-left:.25rem">Meilleur score :</span>
            <input type="number" min="0" class="pos-input" id="fg-best-${team.id}" value="${best}" placeholder="0">
          </div>` : ''}
        </div>
        <div class="ser-inputs">
          <span class="input-label">Position :</span>
          <input type="number" min="1" max="${teams.length}" class="pos-input"
            id="pos-${team.id}" value="${pos}" placeholder="—">
        </div>
      </div>`;
  }).join('');
}

async function saveScore(teamId) {
  const posEl  = document.getElementById(`pos-${teamId}`);
  const pos    = posEl.value === '' ? null : parseInt(posEl.value);

  const fields = { position: pos };

  if (currentGame === 'fall_guys') {
    const top1El = document.getElementById(`fg-top1-${teamId}`);
    const bestEl = document.getElementById(`fg-best-${teamId}`);
    fields.fg_top1_count = top1El?.value ? parseInt(top1El.value) : 0;
    fields.fg_best_score = bestEl?.value ? parseInt(bestEl.value) : 0;
  }

  const { error } = await upsertResult(teamId, currentGame, fields);
  if (error) {
    showToast('Erreur lors de la sauvegarde.', 'error');
    return;
  }
  showToast('Score sauvegardé.', 'success');
  results = await getResults();
}

function selectGame(game) {
  currentGame = game;
  renderScores();
}

async function saveAllScores() {
  for (const team of teams) {
    const posEl = document.getElementById(`pos-${team.id}`);
    if (!posEl) continue;
    await saveScore(team.id);
  }
  showToast('Tous les scores sauvegardés !');
}

// ─── HALO — LOBBIES ───────────────────────────────────────────
function renderHalo() {
  const wrap = document.getElementById('halo-assign-rows');
  if (teams.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="padding:2rem">Ajoute des équipes d'abord.</div>`;
    return;
  }

  wrap.innerHTML = teams.map(team => {
    const a = haloAssignments.find(a => a.team_id === team.id);
    const p1 = a?.player1_lobby ?? '';
    const p2 = a?.player2_lobby ?? '';

    return `
      <div class="halo-assign-row">
        <div>
          <div class="ser-team-name">${esc(team.name)}</div>
        </div>
        <div>
          <span class="input-label">${esc(team.player1)}</span>
          <select class="lobby-select" id="hl-p1-${team.id}">
            <option value="">—</option>
            <option value="1" ${p1 === 1 ? 'selected' : ''}>Partie 1</option>
            <option value="2" ${p1 === 2 ? 'selected' : ''}>Partie 2</option>
          </select>
        </div>
        <div>
          <span class="input-label">${esc(team.player2)}</span>
          <select class="lobby-select" id="hl-p2-${team.id}">
            <option value="">—</option>
            <option value="1" ${p2 === 1 ? 'selected' : ''}>Partie 1</option>
            <option value="2" ${p2 === 2 ? 'selected' : ''}>Partie 2</option>
          </select>
        </div>
      </div>`;
  }).join('');
}

async function saveAllHaloAssignments() {
  for (const team of teams) {
    const p1El = document.getElementById(`hl-p1-${team.id}`);
    const p2El = document.getElementById(`hl-p2-${team.id}`);
    if (!p1El || !p2El) continue;

    const p1 = p1El.value ? parseInt(p1El.value) : null;
    const p2 = p2El.value ? parseInt(p2El.value) : null;

    if (p1 && p2) {
      if (p1 === p2) {
        showToast(`${team.name} : les 2 joueurs ne peuvent pas être dans la même partie.`, 'error');
        continue;
      }
      const { error } = await upsertHaloAssignment(team.id, p1, p2);
      if (error) showToast('Erreur : ' + team.name, 'error');
    }
  }
  showToast('Assignations Halo sauvegardées !');
  haloAssignments = await getHaloAssignments();
  renderHalo();
}

async function randomizeHaloAssignments() {
  if (teams.length === 0) { showToast('Aucune équipe à assigner.', 'error'); return; }

  for (const team of teams) {
    // Pile ou face : player1 va en lobby 1 ou 2, player2 prend l'autre
    const p1Lobby = Math.random() < 0.5 ? 1 : 2;
    const p2Lobby = p1Lobby === 1 ? 2 : 1;

    const p1El = document.getElementById(`hl-p1-${team.id}`);
    const p2El = document.getElementById(`hl-p2-${team.id}`);
    if (p1El) p1El.value = p1Lobby;
    if (p2El) p2El.value = p2Lobby;
  }

  await saveAllHaloAssignments();
}

async function clearHaloAssignments() {
  if (!confirm('Effacer toutes les assignations Halo ?')) return;
  for (const a of haloAssignments) {
    await deleteHaloAssignment(a.team_id);
  }
  haloAssignments = [];
  renderHalo();
  showToast('Assignations effacées.');
}

// ─── ANNONCES ─────────────────────────────────────────────────
function renderAnnouncements() {
  const list = document.getElementById('annc-admin-list');
  if (anncs.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:1.5rem;text-align:center;color:var(--text-muted)">
      Aucune annonce.
    </div>`;
    return;
  }
  list.innerHTML = anncs.map(a => {
    const typeLabel = { halo: '🔵 Halo Infinite', important: '⭐ Important', general: '📣 Annonce' }[a.type] ?? a.type;
    return `
      <tr>
        <td>
          <strong>${esc(a.title)}</strong>
          ${a.pinned ? ' <span class="badge badge-gold" style="font-size:.65rem">📌 Épinglé</span>' : ''}
          ${a.content ? `<div class="text-sm text-muted" style="margin-top:.2rem">${esc(a.content.substring(0,80))}${a.content.length>80?'…':''}</div>` : ''}
        </td>
        <td><span class="badge badge-${gameBadge2(a.type)}">${typeLabel}</span></td>
        <td class="text-sm text-muted">${timeAgo(a.created_at)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="editAnnc('${a.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAnncConfirm('${a.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function gameBadge2(type) {
  return { halo: 'hi', important: 'gold', general: 'accent' }[type] ?? 'accent';
}

function resetAnncForm() {
  editingAnncId = null;
  document.getElementById('annc-title').value   = '';
  document.getElementById('annc-content').value = '';
  document.getElementById('annc-type').value    = 'general';
  document.getElementById('annc-pinned').checked = false;
  document.getElementById('annc-form-title').textContent = 'Nouvelle annonce';
  document.getElementById('btn-annc-cancel').classList.add('hidden');
}

function editAnnc(id) {
  const a = anncs.find(a => a.id === id);
  if (!a) return;
  editingAnncId = id;
  document.getElementById('annc-title').value    = a.title;
  document.getElementById('annc-content').value  = a.content ?? '';
  document.getElementById('annc-type').value     = a.type;
  document.getElementById('annc-pinned').checked = a.pinned;
  document.getElementById('annc-form-title').textContent = 'Modifier l\'annonce';
  document.getElementById('btn-annc-cancel').classList.remove('hidden');
  document.getElementById('annc-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function submitAnnc() {
  const title   = document.getElementById('annc-title').value.trim();
  const content = document.getElementById('annc-content').value.trim();
  const type    = document.getElementById('annc-type').value;
  const pinned  = document.getElementById('annc-pinned').checked;

  if (!title) { showToast('Le titre est requis.', 'error'); return; }

  let error;
  if (editingAnncId) {
    ({ error } = await updateAnnouncement(editingAnncId, { title, content, type, pinned }));
  } else {
    ({ error } = await addAnnouncement(title, content, type, pinned));
  }

  if (error) { showToast('Erreur.', 'error'); return; }
  showToast(editingAnncId ? 'Annonce mise à jour.' : 'Annonce publiée !');
  resetAnncForm();
  anncs = await getAnnouncements();
  renderAnnouncements();
}

async function deleteAnncConfirm(id) {
  if (!confirm('Supprimer cette annonce ?')) return;
  const { error } = await deleteAnnouncement(id);
  if (error) { showToast('Erreur.', 'error'); return; }
  showToast('Annonce supprimée.');
  if (editingAnncId === id) resetAnncForm();
  anncs = await getAnnouncements();
  renderAnnouncements();
}

// ─── PROGRAMME ────────────────────────────────────────────────
function renderSchedule() {
  const list = document.getElementById('step-manage-list');
  list.innerHTML = steps.map(s => {
    const isPending   = s.status === 'pending';
    const isCurrent   = s.status === 'current';
    const isCompleted = s.status === 'completed';
    return `
      <div class="step-manage-row">
        <div class="step-status-dot ${s.status}"></div>
        <div class="step-manage-info">
          <div class="step-manage-title">${esc(s.title)}</div>
          ${s.description ? `<div class="step-manage-desc">${esc(s.description)}</div>` : ''}
          ${s.game && s.game !== 'general' ? `<span class="badge badge-${gameBadge(s.game)}" style="margin-top:.25rem">${gameLabel(s.game)}</span>` : ''}
        </div>
        <div class="step-manage-actions">
          ${!isCurrent ? `<button class="btn btn-secondary btn-sm" onclick="activateStep('${s.id}')">▶ Activer</button>` : ''}
          ${isCurrent ? `<button class="btn btn-sm" style="background:rgba(16,185,129,.15);color:#10b981" onclick="completeStep('${s.id}')">✓ Terminer</button>` : ''}
          ${isCompleted ? `<button class="btn btn-ghost btn-sm" onclick="resetStep('${s.id}')">↩</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function gameBadge(game) {
  return { fall_guys: 'fg', minecraft: 'mc', halo: 'hi' }[game] ?? 'general';
}

async function activateStep(id) {
  const { error } = await setStepStatus(id, 'current');
  if (error) { showToast('Erreur.', 'error'); return; }
  steps = await getTournamentSteps();
  renderSchedule();
  showToast('Étape activée !');
}

async function completeStep(id) {
  const { error } = await setStepStatus(id, 'completed');
  if (error) { showToast('Erreur.', 'error'); return; }
  // Activer automatiquement la suivante
  const cur = steps.find(s => s.id === id);
  const next = steps.find(s => s.order_index === (cur?.order_index ?? 0) + 1);
  if (next) await setStepStatus(next.id, 'current');
  steps = await getTournamentSteps();
  renderSchedule();
  showToast('Étape terminée !');
}

async function resetStep(id) {
  const { error } = await setStepStatus(id, 'pending');
  if (error) { showToast('Erreur.', 'error'); return; }
  steps = await getTournamentSteps();
  renderSchedule();
}

async function resetAllSchedule() {
  if (!confirm('Remettre toutes les étapes à "en attente" ?')) return;
  await resetAllSteps();
  steps = await getTournamentSteps();
  renderSchedule();
  showToast('Programme réinitialisé.');
}

// ─── TEMPS RÉEL ───────────────────────────────────────────────
function setupRealtime() {
  subscribeToTable('teams', async () => {
    teams   = await getTeams();
    results = await getResults();
    if (currentSection === 'teams')  renderTeams();
    if (currentSection === 'scores') renderScores();
    if (currentSection === 'overview') renderOverview();
  });
  subscribeToTable('results', async () => {
    results = await getResults();
    if (currentSection === 'overview') renderOverview();
  });
  subscribeToTable('announcements', async () => {
    anncs = await getAnnouncements();
    if (currentSection === 'announcements') renderAnnouncements();
    if (currentSection === 'overview') renderOverview();
  });
  subscribeToTable('tournament_steps', async () => {
    steps = await getTournamentSteps();
    if (currentSection === 'schedule') renderSchedule();
  });
  subscribeToTable('halo_assignments', async () => {
    haloAssignments = await getHaloAssignments();
    if (currentSection === 'halo') renderHalo();
  });
}

// ─── MODAL DE CONFIRMATION ────────────────────────────────────
let _modalCallback = null;

function openConfirmModal(title, message, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = message;
  _modalCallback = onConfirm;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  _modalCallback = null;
}

function executeConfirmModal() {
  if (_modalCallback) _modalCallback();
  closeConfirmModal();
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('confirm-modal')) closeConfirmModal();
}

// ─── RESET SCORES ─────────────────────────────────────────────
function resetCurrentGameScores() {
  const labels = { fall_guys: 'Fall Guys', minecraft: 'Minecraft', halo: 'Halo Infinite' };
  const label  = labels[currentGame];
  openConfirmModal(
    `Réinitialiser ${label}`,
    `Es-tu sûr de vouloir effacer tous les scores de ${label} ? Cette action est irréversible.`,
    async () => {
      for (const team of teams) await clearResult(team.id, currentGame);
      results = await getResults();
      renderScores();
      showToast(`Scores ${label} réinitialisés.`);
    }
  );
}

function resetAllGameScores() {
  openConfirmModal(
    'Réinitialiser tous les scores',
    'Es-tu sûr de vouloir effacer les scores des 3 jeux (Fall Guys, Minecraft, Halo Infinite) ? Cette action est irréversible.',
    async () => {
      for (const team of teams)
        for (const game of ['fall_guys', 'minecraft', 'halo'])
          await clearResult(team.id, game);
      results = await getResults();
      renderScores();
      showToast('Tous les scores réinitialisés.');
    }
  );
}

// ─── DÉCONNEXION ──────────────────────────────────────────────
async function adminLogout() {
  await signOutAdmin();
  window.location.href = 'index.html';
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${type === 'success' ? '✓' : '✕'} ${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── UTILS ────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
