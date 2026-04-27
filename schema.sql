-- ============================================================
--  MINI-MULTI | Schéma de base de données Supabase
--  Colle ce fichier dans l'éditeur SQL de Supabase et exécute
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ÉQUIPES ────────────────────────────────────────────────
CREATE TABLE teams (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,
  player1    TEXT        NOT NULL,
  player2    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÉTAPES DU TOURNOI ──────────────────────────────────────
CREATE TABLE tournament_steps (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_index INTEGER NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  description TEXT,
  game        TEXT    CHECK (game IN ('fall_guys', 'minecraft', 'halo', 'general')),
  status      TEXT    DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed'))
);

-- ─── RÉSULTATS (1 ligne par équipe par jeu) ──────────────────
CREATE TABLE results (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID    REFERENCES teams(id) ON DELETE CASCADE,
  game            TEXT    NOT NULL CHECK (game IN ('fall_guys', 'minecraft', 'halo')),
  position        INTEGER,                  -- classement final de l'équipe dans ce jeu
  fg_top1_count   INTEGER DEFAULT 0,        -- [Fall Guys] nb de top 1 (départage)
  fg_best_score   INTEGER DEFAULT 0,        -- [Fall Guys] meilleur score en une partie (départage)
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, game)
);

-- ─── ASSIGNATIONS LOBBIES HALO ──────────────────────────────
CREATE TABLE halo_assignments (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id      UUID    REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  player1_lobby INTEGER CHECK (player1_lobby IN (1, 2)),
  player2_lobby INTEGER CHECK (player2_lobby IN (1, 2)),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ANNONCES ───────────────────────────────────────────────
CREATE TABLE announcements (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT    NOT NULL,
  content    TEXT,
  type       TEXT    DEFAULT 'general' CHECK (type IN ('general', 'halo', 'important')),
  pinned     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE results            ENABLE ROW LEVEL SECURITY;
ALTER TABLE halo_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout le monde peut voir)
CREATE POLICY "read_teams"         ON teams            FOR SELECT USING (true);
CREATE POLICY "read_steps"         ON tournament_steps FOR SELECT USING (true);
CREATE POLICY "read_results"       ON results           FOR SELECT USING (true);
CREATE POLICY "read_halo"          ON halo_assignments  FOR SELECT USING (true);
CREATE POLICY "read_announcements" ON announcements     FOR SELECT USING (true);

-- Écriture réservée aux admins authentifiés
CREATE POLICY "admin_teams"         ON teams            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_steps"         ON tournament_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_results"       ON results           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_halo"          ON halo_assignments  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_announcements" ON announcements     FOR ALL USING (auth.role() = 'authenticated');

-- ─── ÉTAPES PAR DÉFAUT ──────────────────────────────────────
INSERT INTO tournament_steps (order_index, title, description, game, status) VALUES
(1, 'Accueil & Briefing',           'Présentation du tournoi Mini-Multi et des règles',                         'general',   'pending'),
(2, 'Épreuve Fall Guys',            'Toutes les équipes s''affrontent dans la même partie Fall Guys',           'fall_guys', 'pending'),
(3, 'Épreuve Minecraft',            'Défi Minecraft pour toutes les équipes simultanément',                    'minecraft', 'pending'),
(4, 'Attribution des lobbies Halo', 'Annonce de la répartition des joueurs dans les parties Halo Infinite',   'halo',      'pending'),
(5, 'Épreuve Halo Infinite',        'Les joueurs s''affrontent (équipes séparées en 2 parties)',               'halo',      'pending'),
(6, 'Classement Final',             'Calcul du classement définitif et remise des récompenses',                'general',   'pending');
