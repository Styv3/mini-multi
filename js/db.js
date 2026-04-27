// ============================================================
//  MINI-MULTI | Couche d'accès aux données (Supabase)
// ============================================================

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── AUTH ────────────────────────────────────────────────────

async function signInAdmin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOutAdmin() {
  await db.auth.signOut();
}

async function getSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

// ─── ÉQUIPES ─────────────────────────────────────────────────

async function getTeams() {
  const { data, error } = await db.from('teams').select('*').order('name');
  if (error) console.error('getTeams:', error);
  return data ?? [];
}

async function addTeam(name, player1, player2) {
  const { data, error } = await db.from('teams').insert({ name, player1, player2 }).select().single();
  return { data, error };
}

async function updateTeam(id, fields) {
  const { error } = await db.from('teams').update(fields).eq('id', id);
  return { error };
}

async function deleteTeam(id) {
  const { error } = await db.from('teams').delete().eq('id', id);
  return { error };
}

// ─── RÉSULTATS ───────────────────────────────────────────────

async function getResults() {
  const { data, error } = await db.from('results').select('*');
  if (error) console.error('getResults:', error);
  return data ?? [];
}

async function upsertResult(teamId, game, fields) {
  const { error } = await db.from('results').upsert(
    { team_id: teamId, game, ...fields, updated_at: new Date().toISOString() },
    { onConflict: 'team_id,game' }
  );
  return { error };
}

async function clearResult(teamId, game) {
  const { error } = await db.from('results')
    .update({ position: null, fg_top1_count: 0, fg_best_score: 0, updated_at: new Date().toISOString() })
    .eq('team_id', teamId).eq('game', game);
  return { error };
}

// ─── ASSIGNATIONS HALO ──────────────────────────────────────

async function getHaloAssignments() {
  const { data, error } = await db.from('halo_assignments').select('*, teams(name, player1, player2)');
  if (error) console.error('getHaloAssignments:', error);
  return data ?? [];
}

async function upsertHaloAssignment(teamId, player1Lobby, player2Lobby, notes = '') {
  const { error } = await db.from('halo_assignments').upsert(
    { team_id: teamId, player1_lobby: player1Lobby, player2_lobby: player2Lobby, notes },
    { onConflict: 'team_id' }
  );
  return { error };
}

async function deleteHaloAssignment(teamId) {
  const { error } = await db.from('halo_assignments').delete().eq('team_id', teamId);
  return { error };
}

// ─── ANNONCES ────────────────────────────────────────────────

async function getAnnouncements() {
  const { data, error } = await db.from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) console.error('getAnnouncements:', error);
  return data ?? [];
}

async function addAnnouncement(title, content, type, pinned) {
  const { data, error } = await db.from('announcements')
    .insert({ title, content, type, pinned })
    .select().single();
  return { data, error };
}

async function updateAnnouncement(id, fields) {
  const { error } = await db.from('announcements').update(fields).eq('id', id);
  return { error };
}

async function deleteAnnouncement(id) {
  const { error } = await db.from('announcements').delete().eq('id', id);
  return { error };
}

// ─── ÉTAPES DU PROGRAMME ────────────────────────────────────

async function getTournamentSteps() {
  const { data, error } = await db.from('tournament_steps').select('*').order('order_index');
  if (error) console.error('getTournamentSteps:', error);
  return data ?? [];
}

async function setStepStatus(id, status) {
  // Si on marque "current", on remet les autres à "pending" ou "completed" selon leur ordre
  if (status === 'current') {
    const steps = await getTournamentSteps();
    const target = steps.find(s => s.id === id);
    if (target) {
      for (const s of steps) {
        let newStatus;
        if (s.id === id) {
          newStatus = 'current';
        } else if (s.order_index < target.order_index) {
          newStatus = 'completed';
        } else {
          newStatus = 'pending';
        }
        await db.from('tournament_steps').update({ status: newStatus }).eq('id', s.id);
      }
      return { error: null };
    }
  }
  const { error } = await db.from('tournament_steps').update({ status }).eq('id', id);
  return { error };
}

async function markAllCompleted() {
  const { error } = await db.from('tournament_steps').update({ status: 'completed' });
  return { error };
}

async function resetAllSteps() {
  const { error } = await db.from('tournament_steps').update({ status: 'pending' });
  return { error };
}

// ─── TEMPS RÉEL ──────────────────────────────────────────────

function subscribeToTable(table, callback) {
  return db.channel(`changes-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
}

// ─── HELPERS ─────────────────────────────────────────────────

/**
 * Calcule le classement à partir des équipes et résultats.
 * @param {Array} teams
 * @param {Array} results
 * @returns {Array} équipes classées
 */
function computeLeaderboard(teams, results) {
  const ranked = teams.map(team => {
    const fg = results.find(r => r.team_id === team.id && r.game === 'fall_guys');
    const mc = results.find(r => r.team_id === team.id && r.game === 'minecraft');
    const hi = results.find(r => r.team_id === team.id && r.game === 'halo');

    const fgPos = fg?.position ?? null;
    const mcPos = mc?.position ?? null;
    const hiPos = hi?.position ?? null;

    const positions = [fgPos, mcPos, hiPos].filter(p => p !== null);
    const total = positions.reduce((s, p) => s + p, 0);

    return {
      ...team,
      fgPos, mcPos, hiPos,
      fgTop1: fg?.fg_top1_count ?? 0,
      fgBest: fg?.fg_best_score ?? 0,
      total,
      gamesPlayed: positions.length,
    };
  });

  return ranked.sort((a, b) => {
    // 1. Total (croissant — moins c'est mieux)
    if (a.total !== b.total) return a.total - b.total;

    // 2. Nombre de 1ères places (décroissant)
    // 3. Nombre de 2ièmes places, etc.
    const allPos = [a.fgPos, a.mcPos, a.hiPos];
    const blPos  = [b.fgPos, b.mcPos, b.hiPos];
    const maxPos = Math.max(teams.length, 10);
    for (let p = 1; p <= maxPos; p++) {
      const aCount = allPos.filter(x => x === p).length;
      const bCount = blPos.filter(x => x === p).length;
      if (aCount !== bCount) return bCount - aCount;
    }
    return 0;
  });
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function gameLabel(game) {
  return { fall_guys: 'Fall Guys', minecraft: 'Minecraft', halo: 'Halo Infinite', general: 'Général' }[game] ?? game;
}
