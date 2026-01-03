import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const ALIASES_KEY = 'wordle_player_aliases';

// Load aliases from localStorage
function loadAliases() {
  try {
    const stored = localStorage.getItem(ALIASES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save aliases to localStorage
function saveAliases(aliases) {
  try {
    localStorage.setItem(ALIASES_KEY, JSON.stringify(aliases));
  } catch (e) {
    console.warn('Could not save aliases:', e);
  }
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [aliases, setAliases] = useState(loadAliases);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [mergeTarget, setMergeTarget] = useState('');

  // Player details modal
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerDetails, setPlayerDetails] = useState(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  // Game details modal
  const [showGameModal, setShowGameModal] = useState(false);
  const [gameDetails, setGameDetails] = useState(null);
  const [loadingGame, setLoadingGame] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/analytics`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerDetails = async (playerName) => {
    try {
      setLoadingPlayer(true);
      setShowPlayerModal(true);
      const response = await fetch(`${API_URL}/api/player/${encodeURIComponent(playerName)}`);
      if (!response.ok) throw new Error('Player not found');
      const data = await response.json();
      setPlayerDetails(data);
    } catch (err) {
      console.error('Failed to fetch player details:', err);
      setPlayerDetails(null);
    } finally {
      setLoadingPlayer(false);
    }
  };

  const fetchGameDetails = async (gameId) => {
    try {
      setLoadingGame(true);
      setShowGameModal(true);
      const response = await fetch(`${API_URL}/api/game/${gameId}`);
      if (!response.ok) throw new Error('Game not found');
      const data = await response.json();
      setGameDetails(data);
    } catch (err) {
      console.error('Failed to fetch game details:', err);
      setGameDetails(null);
    } finally {
      setLoadingGame(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  const getMainName = (name) => {
    for (const [main, aliasList] of Object.entries(aliases)) {
      if (main === name || aliasList.includes(name)) {
        return main;
      }
    }
    return name;
  };

  const getAliases = (mainName) => {
    return aliases[mainName] || [];
  };

  const getMergedPlayers = () => {
    if (!analytics?.topPlayers) return [];

    const merged = {};

    for (const player of analytics.topPlayers) {
      const mainName = getMainName(player.player_name);

      if (!merged[mainName]) {
        merged[mainName] = {
          player_name: mainName,
          games_played: 0,
          wins: 0,
          total_score: 0,
          scores: [],
          aliases: [],
        };
      }

      merged[mainName].games_played += player.games_played;
      merged[mainName].wins += player.wins;
      merged[mainName].total_score += player.total_score;
      if (player.avg_score) {
        merged[mainName].scores.push({ avg: player.avg_score, count: player.games_played });
      }

      if (player.player_name !== mainName) {
        if (!merged[mainName].aliases.includes(player.player_name)) {
          merged[mainName].aliases.push(player.player_name);
        }
      }
    }

    for (const player of Object.values(merged)) {
      if (player.scores.length > 0) {
        const totalWeight = player.scores.reduce((sum, s) => sum + s.count, 0);
        const weightedSum = player.scores.reduce((sum, s) => sum + s.avg * s.count, 0);
        player.avg_score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      } else {
        player.avg_score = 0;
      }
    }

    return Object.values(merged).sort((a, b) => b.total_score - a.total_score);
  };

  const addAlias = (mainName, aliasName) => {
    if (!mainName || !aliasName || mainName === aliasName) return;

    const newAliases = { ...aliases };

    for (const [main, list] of Object.entries(newAliases)) {
      newAliases[main] = list.filter(a => a !== aliasName);
      if (newAliases[main].length === 0 && main !== mainName) {
        delete newAliases[main];
      }
    }

    if (newAliases[aliasName]) {
      const existingAliases = newAliases[aliasName];
      delete newAliases[aliasName];
      if (!newAliases[mainName]) newAliases[mainName] = [];
      newAliases[mainName] = [...new Set([...newAliases[mainName], aliasName, ...existingAliases])];
    } else {
      if (!newAliases[mainName]) newAliases[mainName] = [];
      if (!newAliases[mainName].includes(aliasName)) {
        newAliases[mainName].push(aliasName);
      }
    }

    setAliases(newAliases);
    saveAliases(newAliases);
  };

  const removeAlias = (mainName, aliasName) => {
    const newAliases = { ...aliases };
    if (newAliases[mainName]) {
      newAliases[mainName] = newAliases[mainName].filter(a => a !== aliasName);
      if (newAliases[mainName].length === 0) {
        delete newAliases[mainName];
      }
    }
    setAliases(newAliases);
    saveAliases(newAliases);
  };

  const getAllPlayerNames = () => {
    if (!analytics?.topPlayers) return [];
    return analytics.topPlayers.map(p => p.player_name);
  };

  const openAliasModal = (playerName) => {
    setSelectedPlayer(playerName);
    setMergeTarget('');
    setShowAliasModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4 animate-pulse">📊</div>
          <h2 className="font-display text-xl font-bold">Loading Analytics...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="font-display text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-white/60 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-wordle-green text-white rounded-lg font-bold hover:bg-wordle-green/80 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, topOpeners, topGuesses, recentGames, modeStats, targetWords } = analytics || {};
  const mergedPlayers = getMergedPlayers();

  const tabIcons = {
    overview: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-pink-400 glow-icon' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    words: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-cyan-400 glow-icon' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    players: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-emerald-400 glow-icon' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    games: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-amber-400 glow-icon' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'words', label: 'Words' },
    { id: 'players', label: 'Players' },
    { id: 'games', label: 'Games' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold rgb-text">
              Analytics
            </h1>
            <p className="text-white/50 text-sm mt-1">Game statistics and insights</p>
          </div>
          <a
            href="/"
            className="glass-card px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2 group"
          >
            <svg className="w-4 h-4 text-cyan-400 glow-icon group-hover:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="games"
            label="Total Games"
            value={formatNumber(stats?.total_games || 0)}
            cardClass="stat-card-purple"
            iconColor="text-purple-400"
          />
          <StatCard
            icon="rounds"
            label="Total Rounds"
            value={formatNumber(stats?.total_rounds || 0)}
            cardClass="stat-card-blue"
            iconColor="text-cyan-400"
          />
          <StatCard
            icon="players"
            label="Unique Players"
            value={formatNumber(stats?.unique_players || 0)}
            cardClass="stat-card-green"
            iconColor="text-emerald-400"
          />
          <StatCard
            icon="solves"
            label="Total Solves"
            value={formatNumber(stats?.total_solves || 0)}
            cardClass="stat-card-yellow"
            iconColor="text-amber-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`glass-card px-4 py-2.5 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white/15 border-white/30 shadow-lg'
                  : 'hover:bg-white/10'
              }`}
            >
              {tabIcons[tab.id](activeTab === tab.id)}
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Mode Distribution */}
              <div className="glass-card p-6">
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span>Game Modes</span>
                </h3>
                <div className="flex flex-wrap gap-4">
                  {modeStats?.map((mode) => (
                    <div key={mode.mode} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                      <span className="text-2xl">
                        {mode.mode === 'battleRoyale' ? '⚔️' : '🏆'}
                      </span>
                      <div>
                        <div className="font-bold">{mode.mode === 'battleRoyale' ? 'Elimination' : 'Classic'}</div>
                        <div className="text-white/50 text-sm">{mode.count} games</div>
                      </div>
                    </div>
                  ))}
                  {(!modeStats || modeStats.length === 0) && (
                    <div className="text-white/40 text-sm">No games played yet</div>
                  )}
                </div>
              </div>

              {/* Top Openers Preview */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Top Openers</span>
                  </h3>
                  <div className="space-y-2">
                    {topOpeners?.slice(0, 5).map((item, i) => (
                      <WordBar key={item.opener} word={item.opener} count={item.count} rank={i + 1} max={topOpeners[0]?.count} />
                    ))}
                    {(!topOpeners || topOpeners.length === 0) && (
                      <div className="text-white/40 text-sm">No data yet</div>
                    )}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Target Words</span>
                  </h3>
                  <div className="space-y-2">
                    {targetWords?.slice(0, 5).map((item, i) => (
                      <WordBar key={item.target_word} word={item.target_word} count={item.times_played} rank={i + 1} max={targetWords[0]?.times_played} color="green" />
                    ))}
                    {(!targetWords || targetWords.length === 0) && (
                      <div className="text-white/40 text-sm">No data yet</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'words' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Most Used Openers</span>
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {topOpeners?.map((item, i) => (
                    <WordBar key={item.opener} word={item.opener} count={item.count} rank={i + 1} max={topOpeners[0]?.count} />
                  ))}
                  {(!topOpeners || topOpeners.length === 0) && (
                    <div className="text-white/40 text-sm">No openers recorded yet</div>
                  )}
                </div>
              </div>

              <div className="glass-card p-6">
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Most Used Guesses</span>
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {topGuesses?.map((item, i) => (
                    <WordBar key={item.guess} word={item.guess} count={item.count} rank={i + 1} max={topGuesses[0]?.count} color="yellow" />
                  ))}
                  {(!topGuesses || topGuesses.length === 0) && (
                    <div className="text-white/40 text-sm">No guesses recorded yet</div>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 md:col-span-2">
                <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Target Words Played</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                  {targetWords?.map((item, i) => (
                    <div key={item.target_word} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="font-mono font-bold tracking-wider">{item.target_word}</span>
                      <span className="text-white/50 text-sm">{item.times_played}x</span>
                    </div>
                  ))}
                  {(!targetWords || targetWords.length === 0) && (
                    <div className="text-white/40 text-sm col-span-full">No target words recorded yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'players' && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span>Leaderboard</span>
                </h3>
                {Object.keys(aliases).length > 0 && (
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-full">
                    {Object.keys(aliases).length} merged
                  </span>
                )}
              </div>
              <p className="text-white/30 text-xs mb-3">Click a player to view stats • Long-press to merge aliases</p>
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/50 text-xs border-b border-white/10">
                      <th className="pb-2 pr-2 w-6">#</th>
                      <th className="pb-2 pr-2">Player</th>
                      <th className="pb-2 pr-2 text-right w-10">G</th>
                      <th className="pb-2 pr-2 text-right w-10">W</th>
                      <th className="pb-2 pr-2 text-right w-12">W%</th>
                      <th className="pb-2 pr-2 text-right w-14">Score</th>
                      <th className="pb-2 text-right w-12">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {mergedPlayers?.map((player, i) => {
                      const winRate = player.games_played > 0
                        ? ((player.wins / player.games_played) * 100).toFixed(0)
                        : 0;
                      const playerAliases = [...getAliases(player.player_name), ...(player.aliases || [])];
                      const uniqueAliases = [...new Set(playerAliases)];

                      return (
                        <tr key={player.player_name} className="hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => fetchPlayerDetails(player.player_name)}
                            onContextMenu={(e) => { e.preventDefault(); openAliasModal(player.player_name); }}>
                          <td className="py-2 pr-2">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-white/40">{i + 1}</span>}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="text-left hover:text-wordle-green transition-colors">
                              <span className="font-medium">{player.player_name}</span>
                              {uniqueAliases.length > 0 && (
                                <div className="text-xs text-white/30 mt-0.5 truncate max-w-[120px]">
                                  aka: {uniqueAliases.join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-2 text-right text-white/70">{player.games_played}</td>
                          <td className="py-2 pr-2 text-right text-wordle-green">{player.wins}</td>
                          <td className="py-2 pr-2 text-right">
                            <span className={`${winRate >= 50 ? 'text-wordle-green' : 'text-white/70'}`}>
                              {winRate}%
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-wordle-yellow">{formatNumber(player.total_score)}</td>
                          <td className="py-2 text-right font-mono text-white/70">{formatNumber(player.avg_score)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!mergedPlayers || mergedPlayers.length === 0) && (
                  <div className="text-white/40 text-sm text-center py-8">No players yet</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Recent Games</span>
              </h3>
              <p className="text-white/30 text-xs mb-4">Click a game to view full standings</p>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {recentGames?.map((game) => {
                  const settings = typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings;
                  return (
                    <div
                      key={game.id}
                      onClick={() => fetchGameDetails(game.id)}
                      className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{game.mode === 'battleRoyale' ? '⚔️' : '🏆'}</span>
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              <span className="font-mono text-white/50">{game.code}</span>
                              <span className="text-white/30">•</span>
                              <span>Game #{game.game_number}</span>
                            </div>
                            <div className="text-white/50 text-sm">
                              {game.num_rounds} rounds • {game.num_players} players
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {game.winner_name && (
                            <div className="text-wordle-green font-medium flex items-center gap-1">
                              <span>👑</span> {game.winner_name}
                            </div>
                          )}
                          <div className="text-white/40 text-xs">
                            Host: {game.host_name}
                          </div>
                        </div>
                      </div>
                      {/* Settings badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {settings?.mirrorMatch && (
                          <span className="text-xs px-2 py-1 bg-wordle-yellow/20 text-wordle-yellow rounded-full">Mirror</span>
                        )}
                        {settings?.hardcoreMode && (
                          <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">Hardcore</span>
                        )}
                        {settings?.freshOpenersOnly && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">Fresh</span>
                        )}
                        {settings?.powerUpsEnabled && (
                          <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">Items</span>
                        )}
                        {game.players && (
                          <span className="text-xs px-2 py-1 bg-white/10 text-white/60 rounded-full ml-auto">
                            {game.players}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!recentGames || recentGames.length === 0) && (
                  <div className="text-white/40 text-sm text-center py-8">No games recorded yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-white/30 text-sm mt-12">
          Analytics refresh automatically when you load this page
        </div>
      </div>

      {/* Player Details Modal */}
      {showPlayerModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowPlayerModal(false)}
        >
          <div
            className="glass-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto animate-bounce-in"
            onClick={e => e.stopPropagation()}
          >
            {loadingPlayer ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 animate-pulse">👤</div>
                <p className="text-white/60">Loading player stats...</p>
              </div>
            ) : playerDetails ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">👤</span>
                    <span>{playerDetails.player_name}</span>
                  </h3>
                  <button
                    onClick={() => setShowPlayerModal(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{playerDetails.games_played}</div>
                    <div className="text-xs text-white/50">Games</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-wordle-green">{playerDetails.classic_wins || 0}</div>
                    <div className="text-xs text-white/50">🏆 Classic Wins</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{playerDetails.elimination_wins || 0}</div>
                    <div className="text-xs text-white/50">⚔️ Elim Wins</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-cyan-400">{playerDetails.words_guessed || 0}</div>
                    <div className="text-xs text-white/50">Words Solved</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{playerDetails.total_rounds || 0}</div>
                    <div className="text-xs text-white/50">Rounds Played</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-400">{playerDetails.best_round_score || 0}</div>
                    <div className="text-xs text-white/50">Best Score</div>
                  </div>
                </div>

                {/* Favorite Opener */}
                {playerDetails.favoriteOpener && (
                  <div className="mb-4">
                    <div className="text-xs text-white/50 mb-1">Favorite Opener</div>
                    <div className="font-mono text-xl font-bold tracking-widest text-wordle-green">
                      {playerDetails.favoriteOpener}
                    </div>
                  </div>
                )}

                {/* Top Guesses */}
                {playerDetails.topGuesses?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/50 mb-2">Most Used Words</div>
                    <div className="flex flex-wrap gap-2">
                      {playerDetails.topGuesses.slice(0, 5).map((g, i) => (
                        <span key={g.guess} className="px-2 py-1 bg-white/10 rounded text-sm font-mono">
                          {g.guess} <span className="text-white/40">({g.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Games */}
                {playerDetails.recentGames?.length > 0 && (
                  <div>
                    <div className="text-xs text-white/50 mb-2">Recent Games</div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {playerDetails.recentGames.slice(0, 10).map(game => (
                        <div
                          key={game.id}
                          onClick={() => { setShowPlayerModal(false); fetchGameDetails(game.id); }}
                          className="bg-white/5 rounded-lg p-2 hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>{game.mode === 'battleRoyale' ? '⚔️' : '🏆'}</span>
                              <span className="font-mono text-xs text-white/50">{game.code}</span>
                              <span className="text-sm">#{game.game_number}</span>
                            </div>
                            {game.winner_name === playerDetails.player_name && (
                              <span className="text-wordle-green text-xs">👑 Won</span>
                            )}
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            {game.rounds.length} rounds • {game.rounds.reduce((sum, r) => sum + r.score, 0)} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">❌</div>
                <p className="text-white/60">Player not found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Details Modal */}
      {showGameModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowGameModal(false)}
        >
          <div
            className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-bounce-in"
            onClick={e => e.stopPropagation()}
          >
            {loadingGame ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 animate-pulse">🎮</div>
                <p className="text-white/60">Loading game details...</p>
              </div>
            ) : gameDetails ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">{gameDetails.mode === 'battleRoyale' ? '⚔️' : '🏆'}</span>
                    <span>Game #{gameDetails.game_number}</span>
                    <span className="font-mono text-sm text-white/50">({gameDetails.code})</span>
                  </h3>
                  <button
                    onClick={() => setShowGameModal(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Game Info */}
                <div className="flex flex-wrap gap-2 mb-4 text-sm text-white/60">
                  <span>{gameDetails.num_rounds} rounds</span>
                  <span>•</span>
                  <span>{gameDetails.actual_players || gameDetails.num_players} players</span>
                  <span>•</span>
                  <span>Host: {gameDetails.host_name}</span>
                </div>

                {/* Standings */}
                <div className="mb-6">
                  <div className="text-xs text-white/50 mb-2">Final Standings</div>
                  <div className="space-y-2">
                    {gameDetails.standings?.map((player, i) => (
                      <div
                        key={player.player_name}
                        onClick={() => { setShowGameModal(false); fetchPlayerDetails(player.player_name); }}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          i === 0 ? 'bg-wordle-green/20 border border-wordle-green/30' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-white/40 w-6 text-center">{i + 1}</span>}
                          </span>
                          <span className="font-medium">{player.player_name}</span>
                          {i === 0 && <span className="text-xs text-wordle-green">👑</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-white/50">{player.rounds_solved}/{player.rounds_played} solved</span>
                          <span className="font-mono text-wordle-yellow font-bold">{player.total_score} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Round by Round */}
                {gameDetails.rounds?.length > 0 && (
                  <div>
                    <div className="text-xs text-white/50 mb-2">Round Details</div>
                    <div className="space-y-3">
                      {gameDetails.rounds.map(round => (
                        <div key={round.round} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold">Round {round.round}</span>
                            <span className="font-mono text-wordle-green">{round.target_word}</span>
                          </div>
                          <div className="space-y-1">
                            {round.players.map(p => (
                              <div key={p.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={p.solved ? 'text-wordle-green' : 'text-red-400'}>
                                    {p.solved ? '✓' : '✗'}
                                  </span>
                                  <span className="text-white/70">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-white/40 font-mono">{p.guesses.length} guesses</span>
                                  <span className="font-mono text-wordle-yellow">{p.score} pts</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">❌</div>
                <p className="text-white/60">Game not found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alias Modal */}
      {showAliasModal && selectedPlayer && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowAliasModal(false)}
        >
          <div
            className="glass-card p-6 w-full max-w-md animate-bounce-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400 glow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Manage Player: {selectedPlayer}</span>
            </h3>
            <p className="text-white/50 text-sm mb-4">
              Merge different names that belong to the same person
            </p>

            {/* Current aliases */}
            {getAliases(selectedPlayer).length > 0 && (
              <div className="mb-4">
                <div className="text-white/50 text-xs mb-2">Current aliases:</div>
                <div className="flex flex-wrap gap-2">
                  {getAliases(selectedPlayer).map(alias => (
                    <span
                      key={alias}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-sm"
                    >
                      {alias}
                      <button
                        onClick={() => removeAlias(selectedPlayer, alias)}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add new alias */}
            <div className="mb-4">
              <div className="text-white/50 text-xs mb-2">Add alias (select another player name):</div>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-wordle-green/50"
              >
                <option value="">Select a player...</option>
                {getAllPlayerNames()
                  .filter(name => name !== selectedPlayer && !getAliases(selectedPlayer).includes(name))
                  .map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))
                }
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (mergeTarget) {
                    addAlias(selectedPlayer, mergeTarget);
                    setMergeTarget('');
                  }
                }}
                disabled={!mergeTarget}
                className="flex-1 py-2 bg-wordle-green text-white rounded-lg font-bold hover:bg-wordle-green/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Merge
              </button>
              <button
                onClick={() => setShowAliasModal(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .glass-card {
          background: rgba(20, 20, 35, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        select option {
          background: #1a1a2e;
          color: white;
        }

        .glow-icon {
          filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor);
        }

        .stat-card-purple {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%);
        }
        .stat-card-blue {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
        }
        .stat-card-green {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
        }
        .stat-card-yellow {
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%);
        }

        .rgb-text {
          background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #ff6b6b);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: rgb-shift 4s linear infinite;
        }

        @keyframes rgb-shift {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ icon, label, value, cardClass, iconColor }) {
  const icons = {
    games: (
      <svg className={`w-7 h-7 ${iconColor} glow-icon`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    rounds: (
      <svg className={`w-7 h-7 ${iconColor} glow-icon`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    players: (
      <svg className={`w-7 h-7 ${iconColor} glow-icon`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    solves: (
      <svg className={`w-7 h-7 ${iconColor} glow-icon`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`glass-card p-4 md:p-6 ${cardClass}`}>
      <div className="mb-2">{icons[icon]}</div>
      <div className="font-display text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-white/50 text-sm">{label}</div>
    </div>
  );
}

function WordBar({ word, count, rank, max, color = 'blue' }) {
  const percentage = max > 0 ? (count / max) * 100 : 0;
  const colorClasses = {
    blue: 'from-blue-500/30 to-cyan-500/30',
    green: 'from-green-500/30 to-emerald-500/30',
    yellow: 'from-yellow-500/30 to-orange-500/30',
  };

  return (
    <div className="relative">
      <div
        className={`absolute inset-0 bg-gradient-to-r ${colorClasses[color]} rounded-lg`}
        style={{ width: `${percentage}%` }}
      />
      <div className="relative flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm w-5">{rank}</span>
          <span className="font-mono font-bold tracking-wider">{word?.toUpperCase()}</span>
        </div>
        <span className="text-white/60 text-sm font-medium">{count}</span>
      </div>
    </div>
  );
}
