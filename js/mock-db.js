// ============================================================
//  MINI-MULTI | Mode démo — store partagé via localStorage
//  + mises à jour cross-onglets via l'event "storage"
// ============================================================

if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE) {

  const _KEY = 'mm_mock_data';
  const _VER = 1;

  const _defaults = {
    _ver: _VER, _seq: 0,
    teams: [
      { id: 'team-1', name: 'Team Phoenix', player1: 'PhoenixX', player2: 'PhoenixZ', created_at: new Date().toISOString() },
      { id: 'team-2', name: 'Team Shadow',  player1: 'ShadowK',  player2: 'ShadowL',  created_at: new Date().toISOString() },
      { id: 'team-3', name: 'Team Vortex',  player1: 'VortexA',  player2: 'VortexB',  created_at: new Date().toISOString() },
      { id: 'team-4', name: 'Team Titan',   player1: 'TitanP',   player2: 'TitanQ',   created_at: new Date().toISOString() },
    ],
    results: [],
    halo_assignments: [],
    announcements: [],
    tournament_steps: [
      { id: 'step-1', order_index: 1, title: 'Accueil & Briefing',           description: 'Présentation du tournoi Mini-Multi et des règles',                       game: 'general',   status: 'pending' },
      { id: 'step-2', order_index: 2, title: 'Épreuve Fall Guys',            description: 'Toutes les équipes s\'affrontent dans la même partie Fall Guys',         game: 'fall_guys', status: 'pending' },
      { id: 'step-3', order_index: 3, title: 'Épreuve Minecraft',            description: 'Défi Minecraft pour toutes les équipes simultanément',                  game: 'minecraft', status: 'pending' },
      { id: 'step-4', order_index: 4, title: 'Attribution des lobbies Halo', description: 'Annonce de la répartition des joueurs dans les parties Halo Infinite', game: 'halo',      status: 'pending' },
      { id: 'step-5', order_index: 5, title: 'Épreuve Halo Infinite',        description: 'Les joueurs s\'affrontent (équipes séparées en 2 parties)',             game: 'halo',      status: 'pending' },
      { id: 'step-6', order_index: 6, title: 'Classement Final',             description: 'Calcul du classement définitif et remise des récompenses',              game: 'general',   status: 'pending' },
    ],
  };

  function _load() {
    try {
      const d = JSON.parse(localStorage.getItem(_KEY));
      if (d && d._ver === _VER) return d;
    } catch {}
    const fresh = JSON.parse(JSON.stringify(_defaults));
    localStorage.setItem(_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function _save(d) { localStorage.setItem(_KEY, JSON.stringify(d)); }

  function _uid(d) { d._seq = (d._seq || 0) + 1; return 'mock-' + d._seq; }

  // ─── AUTH ────────────────────────────────────────────────────
  window.signInAdmin = async function(email, password) {
    if (email === 'admin@test.fr' && password === 'admin1234') {
      const s = { user: { email }, mock: true };
      sessionStorage.setItem('mm_mock_session', JSON.stringify(s));
      return { data: { session: s }, error: null };
    }
    return { data: null, error: { message: 'Identifiants incorrects' } };
  };

  window.signOutAdmin = async function() { sessionStorage.removeItem('mm_mock_session'); };

  window.getSession = async function() {
    const r = sessionStorage.getItem('mm_mock_session');
    return r ? JSON.parse(r) : null;
  };

  // ─── ÉQUIPES ─────────────────────────────────────────────────
  window.getTeams = async function() {
    return [..._load().teams].sort((a, b) => a.name.localeCompare(b.name));
  };

  window.addTeam = async function(name, player1, player2) {
    const d = _load();
    if (d.teams.find(t => t.name === name))
      return { data: null, error: { message: 'Ce nom d\'équipe est déjà utilisé' } };
    const team = { id: _uid(d), name, player1, player2, created_at: new Date().toISOString() };
    d.teams.push(team);
    _save(d);
    return { data: team, error: null };
  };

  window.updateTeam = async function(id, fields) {
    const d = _load(); const t = d.teams.find(t => t.id === id);
    if (t) Object.assign(t, fields);
    _save(d); return { error: null };
  };

  window.deleteTeam = async function(id) {
    const d = _load();
    d.teams            = d.teams.filter(t => t.id !== id);
    d.results          = d.results.filter(r => r.team_id !== id);
    d.halo_assignments = d.halo_assignments.filter(h => h.team_id !== id);
    _save(d); return { error: null };
  };

  // ─── RÉSULTATS ───────────────────────────────────────────────
  window.getResults = async function() { return [..._load().results]; };

  window.upsertResult = async function(teamId, game, fields) {
    const d = _load();
    const i = d.results.findIndex(r => r.team_id === teamId && r.game === game);
    if (i >= 0) {
      Object.assign(d.results[i], fields, { updated_at: new Date().toISOString() });
    } else {
      d.results.push({ id: _uid(d), team_id: teamId, game, fg_top1_count: 0, fg_best_score: 0, ...fields, updated_at: new Date().toISOString() });
    }
    _save(d); return { error: null };
  };

  window.clearResult = async function(teamId, game) {
    return window.upsertResult(teamId, game, { position: null, fg_top1_count: 0, fg_best_score: 0 });
  };

  // ─── ASSIGNATIONS HALO ──────────────────────────────────────
  window.getHaloAssignments = async function() {
    const d = _load();
    return d.halo_assignments.map(h => ({ ...h, teams: d.teams.find(t => t.id === h.team_id) }));
  };

  window.upsertHaloAssignment = async function(teamId, p1, p2, notes = '') {
    const d = _load();
    const i = d.halo_assignments.findIndex(h => h.team_id === teamId);
    if (i >= 0) Object.assign(d.halo_assignments[i], { player1_lobby: p1, player2_lobby: p2, notes });
    else d.halo_assignments.push({ id: _uid(d), team_id: teamId, player1_lobby: p1, player2_lobby: p2, notes });
    _save(d); return { error: null };
  };

  window.deleteHaloAssignment = async function(teamId) {
    const d = _load();
    d.halo_assignments = d.halo_assignments.filter(h => h.team_id !== teamId);
    _save(d); return { error: null };
  };

  // ─── ANNONCES ────────────────────────────────────────────────
  window.getAnnouncements = async function() {
    return [..._load().announcements].sort((a, b) =>
      (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at))
    );
  };

  window.addAnnouncement = async function(title, content, type, pinned) {
    const d = _load();
    const annc = { id: _uid(d), title, content, type, pinned: !!pinned, created_at: new Date().toISOString() };
    d.announcements.push(annc);
    _save(d); return { data: annc, error: null };
  };

  window.updateAnnouncement = async function(id, fields) {
    const d = _load(); const a = d.announcements.find(a => a.id === id);
    if (a) Object.assign(a, fields);
    _save(d); return { error: null };
  };

  window.deleteAnnouncement = async function(id) {
    const d = _load();
    d.announcements = d.announcements.filter(a => a.id !== id);
    _save(d); return { error: null };
  };

  // ─── ÉTAPES DU TOURNOI ──────────────────────────────────────
  window.getTournamentSteps = async function() {
    return [..._load().tournament_steps].sort((a, b) => a.order_index - b.order_index);
  };

  window.setStepStatus = async function(id, status) {
    const d = _load();
    if (status === 'current') {
      const target = d.tournament_steps.find(s => s.id === id);
      if (target) {
        d.tournament_steps.forEach(s => {
          if (s.id === id)                              s.status = 'current';
          else if (s.order_index < target.order_index) s.status = 'completed';
          else                                          s.status = 'pending';
        });
      }
    } else {
      const s = d.tournament_steps.find(s => s.id === id);
      if (s) s.status = status;
    }
    _save(d); return { error: null };
  };

  window.markAllCompleted = async function() {
    const d = _load();
    d.tournament_steps.forEach(s => s.status = 'completed');
    _save(d); return { error: null };
  };

  window.resetAllSteps = async function() {
    const d = _load();
    d.tournament_steps.forEach(s => s.status = 'pending');
    _save(d); return { error: null };
  };

  // ─── TEMPS RÉEL cross-onglets via localStorage ───────────────
  window.subscribeToTable = function(_table, callback) {
    const handler = (e) => { if (e.key === _KEY) callback(); };
    window.addEventListener('storage', handler);
    return { unsubscribe: () => window.removeEventListener('storage', handler) };
  };

  _load(); // initialise le store si absent
  console.info('[Mini-Multi] Mode démo — admin: admin@test.fr / admin1234');
}
