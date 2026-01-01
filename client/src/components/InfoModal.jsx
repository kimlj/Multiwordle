import React, { useState } from 'react';

const TABS = [
  { id: 'howto', label: 'How to Play' },
  { id: 'items', label: 'Items' },
  { id: 'modes', label: 'Game Modes' }
];

// Item data
const ITEMS_DATA = {
  powerups: [
    { id: 'letter_snipe', name: 'Letter Snipe', emoji: '🎯', rarity: 'common', desc: 'Check if a specific letter is in the word. Useful for eliminating possibilities.' },
    { id: 'shield', name: 'Shield', emoji: '🛡️', rarity: 'legendary', desc: 'Blocks ALL incoming sabotages for 35% of round time. Activate it proactively.' },
    { id: 'mirror_shield', name: 'Mirror Shield', emoji: '🪞', rarity: 'rare', desc: 'Passive. When sabotaged, prompts you to reflect it back at the attacker. One-time use.' },
    { id: 'second_chance', name: 'Second Chance', emoji: '🔁', rarity: 'rare', desc: 'Passive. If you use all 6 guesses without solving, get prompted for a 7th guess.' },
    { id: 'xray_vision', name: 'X-Ray Vision', emoji: '👁️', rarity: 'legendary', desc: 'See all other players\' boards for 10 seconds. Great for late-game intel.' }
  ],
  sabotages: [
    { id: 'flip_it', name: 'Flip It', emoji: '🙃', rarity: 'common', desc: 'Flips target\'s screen upside down for 35% of round time.' },
    { id: 'keyboard_shuffle', name: 'Keyboard Shuffle', emoji: '🔀', rarity: 'common', desc: 'Randomizes target\'s keyboard layout for 35% of round time.' },
    { id: 'sticky_keys', name: 'Sticky Keys', emoji: '🍯', rarity: 'common', desc: 'Every letter the target types appears twice (HHEELLOO) for 35% of round time.' },
    { id: 'blindfold', name: 'Blindfold', emoji: '🙈', rarity: 'rare', desc: 'Blanks target\'s keyboard letters for 35% of round time. They can still type!' },
    { id: 'invisible_ink', name: 'Invisible Ink', emoji: '👻', rarity: 'rare', desc: 'Hides target\'s guesses and color feedback for 35% of round time.' },
    { id: 'identity_theft', name: 'Identity Theft', emoji: '🔄', rarity: 'legendary', desc: 'Instantly swap ALL your progress with target. Guesses, results, everything!' }
  ]
};

const RARITY_COLORS = {
  common: 'text-white/70',
  rare: 'text-purple-400',
  legendary: 'text-yellow-400'
};

const RARITY_BG = {
  common: 'bg-white/5',
  rare: 'bg-purple-500/10 border border-purple-500/30',
  legendary: 'bg-yellow-500/10 border border-yellow-500/30'
};

export default function InfoModal({ isOpen, onClose, initialTab = 'howto' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-wordle-green text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'howto' && <HowToPlayTab />}
          {activeTab === 'items' && <ItemsTab />}
          {activeTab === 'modes' && <GameModesTab />}
        </div>
      </div>
    </div>
  );
}

function HowToPlayTab() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold text-lg text-wordle-green mb-3">Basic Rules</h3>
        <div className="space-y-2 text-white/70 text-sm">
          <p>🎯 Guess the secret 5-letter word in 6 tries</p>
          <p>⚡ Race against other players and the clock</p>
          <p>🏆 Score points based on speed and fewer guesses</p>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-wordle-yellow mb-3">Color Feedback</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wordle-green rounded flex items-center justify-center font-bold">A</div>
            <span className="text-white/70 text-sm">Green = Correct letter in the correct spot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wordle-yellow rounded flex items-center justify-center font-bold text-black">B</div>
            <span className="text-white/70 text-sm">Yellow = Correct letter but wrong spot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center font-bold">C</div>
            <span className="text-white/70 text-sm">Gray = Letter not in the word</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-wordle-yellow mb-3">Scoring System</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
            <span className="text-white/60">Base Score (solving the word)</span>
            <span className="font-bold text-wordle-green">+1000</span>
          </div>

          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/60 mb-2">Guess Bonus (fewer = more points)</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span>1 guess</span><span className="text-wordle-green">+900</span></div>
              <div className="flex justify-between"><span>2 guesses</span><span className="text-wordle-green">+750</span></div>
              <div className="flex justify-between"><span>3 guesses</span><span className="text-wordle-green">+600</span></div>
              <div className="flex justify-between"><span>4 guesses</span><span className="text-wordle-green">+450</span></div>
              <div className="flex justify-between"><span>5 guesses</span><span className="text-wordle-green">+300</span></div>
              <div className="flex justify-between"><span>6 guesses</span><span className="text-wordle-green">+150</span></div>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-white/60 mb-2">Time Bonus (up to +500)</div>
            <div className="text-xs text-white/50">
              <p>Faster solves = more points. The bonus scales based on round length.</p>
              <p className="mt-1">Formula: seconds_left × (500 ÷ round_time)</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ItemsTab() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold text-lg text-wordle-green mb-3">Power-ups</h3>
        <p className="text-white/50 text-xs mb-3">Help yourself gain an advantage</p>
        <div className="space-y-2">
          {ITEMS_DATA.powerups.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-red-400 mb-3">Sabotages</h3>
        <p className="text-white/50 text-xs mb-3">Disrupt your opponents (duration: 35% of round time)</p>
        <div className="space-y-2">
          {ITEMS_DATA.sabotages.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-purple-400 mb-3">How to Get Items</h3>
        <div className="space-y-2 text-sm text-white/70">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="font-medium text-white mb-1">Random Drops (after each round)</div>
            <p className="text-xs text-white/50">
              Based on your position: Underdogs get 50% drop chance, middle players 30%, leaders 15%.
              Lower positions get better rarity odds.
            </p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <div className="font-medium text-purple-300 mb-1">Item Rounds</div>
            <p className="text-xs text-white/50">
              Special rounds with challenges. Complete them to earn guaranteed items!
              Legendary challenges (Speed Solve, First Blood, Efficiency) give legendary items.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-white/60 mb-3">Rarity Tiers</h3>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-white/30"></span>
            <span className="text-white/60">Common</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-purple-400">Rare</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-yellow-400">Legendary</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ItemCard({ item }) {
  return (
    <div className={`rounded-lg p-3 ${RARITY_BG[item.rarity]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${RARITY_COLORS[item.rarity]}`}>{item.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/30">{item.rarity}</span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">{item.desc}</p>
        </div>
      </div>
    </div>
  );
}

function GameModesTab() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold text-lg text-wordle-green mb-3">Game Modes</h3>
        <div className="space-y-3">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="font-medium text-white mb-1">Classic Mode</div>
            <p className="text-xs text-white/50">
              Play a set number of rounds. Highest total score wins.
              Everyone plays every round regardless of performance.
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="font-medium text-red-400 mb-1">Battle Royale</div>
            <p className="text-xs text-white/50">
              Last player standing wins! The lowest scorer each round is eliminated.
              Rounds continue until only one player remains.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-wordle-yellow mb-3">Game Settings</h3>
        <div className="space-y-2 text-sm">
          <SettingRow
            name="Rounds"
            desc="Number of rounds to play (Classic mode only)"
          />
          <SettingRow
            name="Round Time"
            desc="Time limit per round (10s to 60min)"
          />
          <SettingRow
            name="Power-ups"
            desc="Enable items system with sabotages and power-ups"
          />
          <SettingRow
            name="Hardcore Mode"
            desc="Keyboard doesn't show color hints from previous guesses"
          />
          <SettingRow
            name="Mirror Match"
            desc="Everyone starts with the same random first guess"
          />
          <SettingRow
            name="Fresh Openers"
            desc="Can't reuse your opening word from previous rounds"
          />
          <SettingRow
            name="Custom Words"
            desc="Host can set specific words for each round"
          />
        </div>
      </section>

      <section>
        <h3 className="font-bold text-lg text-purple-400 mb-3">Item Round Challenges</h3>
        <div className="space-y-2 text-sm">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>⚡</span>
              <span className="font-medium text-yellow-400">Speed Solve</span>
              <span className="text-[10px] text-yellow-400/60">LEGENDARY REWARD</span>
            </div>
            <p className="text-xs text-white/50">Solve in under 30 seconds</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🩸</span>
              <span className="font-medium text-yellow-400">First Blood</span>
              <span className="text-[10px] text-yellow-400/60">LEGENDARY REWARD</span>
            </div>
            <p className="text-xs text-white/50">Be the first player to solve the word</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🎯</span>
              <span className="font-medium text-yellow-400">Efficiency</span>
              <span className="text-[10px] text-yellow-400/60">LEGENDARY REWARD</span>
            </div>
            <p className="text-xs text-white/50">Solve in 3 guesses or less</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>💎</span>
              <span className="font-medium text-white/80">Rare Letters</span>
              <span className="text-[10px] text-white/40">COMMON/RARE REWARD</span>
            </div>
            <p className="text-xs text-white/50">Use Z, X, Q, or J in any guess</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingRow({ name, desc }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="font-medium text-white/80">{name}</div>
      <p className="text-xs text-white/40">{desc}</p>
    </div>
  );
}
