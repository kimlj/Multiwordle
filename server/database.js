import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use persistent data directory in production, server directory in development
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = isProduction ? path.join(__dirname, 'data') : __dirname;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'analytics.db');
console.log(`Database path: ${dbPath}`);

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Checkpoint WAL on startup to ensure data is persisted to main db file
try {
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log('Database WAL checkpoint completed');
} catch (e) {
  console.warn('WAL checkpoint warning:', e.message);
}

// Handle graceful shutdown - checkpoint WAL before exit
function closeDatabase() {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('Database closed gracefully');
  } catch (e) {
    console.warn('Database close warning:', e.message);
  }
}

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

process.on('exit', () => {
  closeDatabase();
});

// Initialize tables
db.exec(`
  -- Games table: tracks each game session
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_number INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    code TEXT NOT NULL,
    num_players INTEGER NOT NULL,
    mode TEXT NOT NULL,
    settings TEXT NOT NULL,
    host_name TEXT NOT NULL,
    winner_name TEXT,
    num_rounds INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Player guesses table: tracks all guesses made by players
  CREATE TABLE IF NOT EXISTS player_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    round_in_game INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    opener TEXT,
    guesses TEXT NOT NULL,
    target_word TEXT NOT NULL,
    solved INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  -- Counter table to track global round number
  CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );

  -- Initialize counters if not exists
  INSERT OR IGNORE INTO counters (name, value) VALUES ('round_number', 0);
  INSERT OR IGNORE INTO counters (name, value) VALUES ('game_number', 0);
`);

// Prepared statements for better performance
const incrementCounter = db.prepare('UPDATE counters SET value = value + 1 WHERE name = ?');
const getCounter = db.prepare('SELECT value FROM counters WHERE name = ?');

const insertGame = db.prepare(`
  INSERT INTO games (game_number, round_number, code, num_players, mode, settings, host_name, winner_name, num_rounds, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const insertPlayerGuess = db.prepare(`
  INSERT INTO player_guesses (game_id, round_in_game, player_name, opener, guesses, target_word, solved, score)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Analytics queries
const getStats = db.prepare(`
  SELECT
    (SELECT value FROM counters WHERE name = 'game_number') as total_games,
    (SELECT value FROM counters WHERE name = 'round_number') as total_rounds,
    (SELECT COUNT(DISTINCT player_name) FROM player_guesses) as unique_players,
    (SELECT COUNT(*) FROM player_guesses WHERE solved = 1) as total_solves
`);

const getTopOpeners = db.prepare(`
  SELECT opener, COUNT(*) as count
  FROM player_guesses
  WHERE opener IS NOT NULL AND opener != ''
  GROUP BY UPPER(opener)
  ORDER BY count DESC
  LIMIT 20
`);

// Note: This query extracts words from JSON arrays using SQLite's json_each
// The guesses column contains arrays like ["CRANE","SLATE","MOUNT"]
const getTopGuesses = db.prepare(`
  SELECT UPPER(je.value) as guess, COUNT(*) as count
  FROM player_guesses pg, json_each(pg.guesses) je
  WHERE je.value IS NOT NULL AND je.value != ''
  GROUP BY UPPER(je.value)
  ORDER BY count DESC
  LIMIT 20
`);

const getTopPlayers = db.prepare(`
  SELECT player_name,
         COUNT(*) as games_played,
         SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as wins,
         SUM(score) as total_score,
         ROUND(AVG(CASE WHEN solved = 1 THEN score ELSE NULL END), 0) as avg_score
  FROM player_guesses
  GROUP BY player_name
  ORDER BY total_score DESC
  LIMIT 20
`);

const getRecentGames = db.prepare(`
  SELECT g.*,
         (SELECT GROUP_CONCAT(DISTINCT player_name) FROM player_guesses WHERE game_id = g.id) as players
  FROM games g
  ORDER BY g.id DESC
  LIMIT 20
`);

const getModeStats = db.prepare(`
  SELECT mode, COUNT(*) as count
  FROM games
  GROUP BY mode
`);

const getTargetWords = db.prepare(`
  SELECT target_word, COUNT(*) as times_played
  FROM player_guesses
  GROUP BY UPPER(target_word)
  ORDER BY times_played DESC
  LIMIT 20
`);

// Get detailed stats for a specific player
const getPlayerDetails = db.prepare(`
  SELECT
    player_name,
    COUNT(*) as total_rounds,
    SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as words_guessed,
    SUM(score) as total_score,
    ROUND(AVG(CASE WHEN solved = 1 THEN score ELSE NULL END), 0) as avg_score,
    MAX(score) as best_round_score,
    COUNT(DISTINCT game_id) as games_played
  FROM player_guesses
  WHERE LOWER(player_name) = LOWER(?)
  GROUP BY LOWER(player_name)
`);

// Get games won by player (separated by mode)
const getPlayerWins = db.prepare(`
  SELECT
    SUM(CASE WHEN mode = 'classic' THEN 1 ELSE 0 END) as classic_wins,
    SUM(CASE WHEN mode = 'battleRoyale' THEN 1 ELSE 0 END) as elimination_wins
  FROM games
  WHERE LOWER(winner_name) = LOWER(?)
`);

const getPlayerFavoriteOpener = db.prepare(`
  SELECT opener, COUNT(*) as count
  FROM player_guesses
  WHERE LOWER(player_name) = LOWER(?) AND opener IS NOT NULL AND opener != ''
  GROUP BY UPPER(opener)
  ORDER BY count DESC
  LIMIT 1
`);

const getPlayerTopGuesses = db.prepare(`
  SELECT UPPER(je.value) as guess, COUNT(*) as count
  FROM player_guesses pg, json_each(pg.guesses) je
  WHERE LOWER(pg.player_name) = LOWER(?) AND je.value IS NOT NULL AND je.value != ''
  GROUP BY UPPER(je.value)
  ORDER BY count DESC
  LIMIT 10
`);

const getPlayerRecentGames = db.prepare(`
  SELECT
    g.id, g.game_number, g.code, g.mode, g.winner_name, g.created_at,
    pg.round_in_game, pg.target_word, pg.guesses, pg.solved, pg.score
  FROM player_guesses pg
  JOIN games g ON pg.game_id = g.id
  WHERE LOWER(pg.player_name) = LOWER(?)
  ORDER BY g.id DESC, pg.round_in_game ASC
  LIMIT 50
`);

// Get full standings for a specific game
const getGameStandings = db.prepare(`
  SELECT
    pg.player_name,
    SUM(pg.score) as total_score,
    SUM(CASE WHEN pg.solved = 1 THEN 1 ELSE 0 END) as rounds_solved,
    COUNT(*) as rounds_played,
    GROUP_CONCAT(pg.score, ',') as round_scores
  FROM player_guesses pg
  WHERE pg.game_id = ?
  GROUP BY pg.player_name
  ORDER BY total_score DESC
`);

const getGameDetails = db.prepare(`
  SELECT g.*,
    (SELECT COUNT(DISTINCT player_name) FROM player_guesses WHERE game_id = g.id) as actual_players
  FROM games g
  WHERE g.id = ?
`);

const getGameRounds = db.prepare(`
  SELECT
    round_in_game,
    target_word,
    player_name,
    opener,
    guesses,
    solved,
    score
  FROM player_guesses
  WHERE game_id = ?
  ORDER BY round_in_game, score DESC
`);

// Export functions
export function logGame(gameData) {
  const {
    code,
    numPlayers,
    mode,
    settings,
    hostName,
    winnerName,
    numRounds,
    roundsData // Array of { roundNumber, targetWord, playerData: [{ name, opener, guesses, solved, score }] }
  } = gameData;

  // Increment game counter
  incrementCounter.run('game_number');
  const gameNumber = getCounter.get('game_number').value;

  // Calculate how many rounds to log (increment global round counter)
  let startingRoundNumber = getCounter.get('round_number').value;

  // Insert game record
  const result = insertGame.run(
    gameNumber,
    startingRoundNumber + numRounds, // End round number
    code,
    numPlayers,
    mode,
    JSON.stringify(settings),
    hostName,
    winnerName,
    numRounds
  );

  const gameId = result.lastInsertRowid;

  // Insert player guesses for each round
  for (const round of roundsData) {
    // Increment global round counter
    incrementCounter.run('round_number');

    for (const player of round.playerData) {
      insertPlayerGuess.run(
        gameId,
        round.roundInGame,
        player.name,
        player.opener || null,
        JSON.stringify(player.guesses),
        round.targetWord,
        player.solved ? 1 : 0,
        player.score || 0
      );
    }
  }

  return { gameId, gameNumber };
}

export function getAnalytics() {
  const stats = getStats.get();
  const topOpeners = getTopOpeners.all();
  const topGuesses = getTopGuesses.all();
  const topPlayers = getTopPlayers.all();
  const recentGames = getRecentGames.all();
  const modeStats = getModeStats.all();
  const targetWords = getTargetWords.all();

  return {
    stats,
    topOpeners,
    topGuesses,
    topPlayers,
    recentGames,
    modeStats,
    targetWords
  };
}

export function getPlayerStats(playerName) {
  const details = getPlayerDetails.get(playerName);
  if (!details) return null;

  const winsResult = getPlayerWins.get(playerName);
  const favoriteOpener = getPlayerFavoriteOpener.get(playerName);
  const topGuesses = getPlayerTopGuesses.all(playerName);
  const recentGames = getPlayerRecentGames.all(playerName);

  // Add games won to details (separated by mode)
  details.classic_wins = winsResult?.classic_wins || 0;
  details.elimination_wins = winsResult?.elimination_wins || 0;

  // Group recent games by game_id
  const gamesMap = new Map();
  for (const row of recentGames) {
    if (!gamesMap.has(row.id)) {
      gamesMap.set(row.id, {
        id: row.id,
        game_number: row.game_number,
        code: row.code,
        mode: row.mode,
        winner_name: row.winner_name,
        created_at: row.created_at,
        rounds: []
      });
    }
    gamesMap.get(row.id).rounds.push({
      round: row.round_in_game,
      target_word: row.target_word,
      guesses: JSON.parse(row.guesses),
      solved: row.solved === 1,
      score: row.score
    });
  }

  return {
    ...details,
    favoriteOpener: favoriteOpener?.opener || null,
    topGuesses,
    recentGames: Array.from(gamesMap.values())
  };
}

export function getGameFullDetails(gameId) {
  const game = getGameDetails.get(gameId);
  if (!game) return null;

  const standings = getGameStandings.all(gameId);
  const roundsRaw = getGameRounds.all(gameId);

  // Group rounds by round number
  const roundsMap = new Map();
  for (const row of roundsRaw) {
    if (!roundsMap.has(row.round_in_game)) {
      roundsMap.set(row.round_in_game, {
        round: row.round_in_game,
        target_word: row.target_word,
        players: []
      });
    }
    roundsMap.get(row.round_in_game).players.push({
      name: row.player_name,
      opener: row.opener,
      guesses: JSON.parse(row.guesses),
      solved: row.solved === 1,
      score: row.score
    });
  }

  return {
    ...game,
    settings: typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings,
    standings: standings.map(s => ({
      ...s,
      round_scores: s.round_scores ? s.round_scores.split(',').map(Number) : []
    })),
    rounds: Array.from(roundsMap.values())
  };
}

export default db;
