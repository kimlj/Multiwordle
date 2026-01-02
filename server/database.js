import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database in the server directory
const db = new Database(path.join(__dirname, 'analytics.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

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

export default db;
