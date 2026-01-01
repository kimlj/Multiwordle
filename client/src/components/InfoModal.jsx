import React, { useState, useEffect } from 'react';

const TABS = [
  { id: 'howto', label: 'How to Play' },
  { id: 'items', label: 'Items' },
  { id: 'modes', label: 'Game Modes' }
];

// Item data
const ITEMS_DATA = {
  powerups: [
    { id: 'letter_snipe', name: 'Letter Snipe', emoji: '🎯', rarity: 'common', desc: 'Check if a letter is in the word' },
    { id: 'shield', name: 'Shield', emoji: '🛡️', rarity: 'legendary', desc: 'Blocks ALL sabotages for 35% of round time' },
    { id: 'mirror_shield', name: 'Mirror Shield', emoji: '🪞', rarity: 'rare', desc: 'Reflects next sabotage back at attacker' },
    { id: 'second_chance', name: 'Second Chance', emoji: '🔁', rarity: 'rare', desc: 'Get a 7th guess if you fail' },
    { id: 'xray_vision', name: 'X-Ray Vision', emoji: '👁️', rarity: 'legendary', desc: 'See all boards for 10 seconds' }
  ],
  sabotages: [
    { id: 'flip_it', name: 'Flip It', emoji: '🙃', rarity: 'common', desc: 'Flips screen upside down' },
    { id: 'keyboard_shuffle', name: 'Keyboard Shuffle', emoji: '🔀', rarity: 'common', desc: 'Randomizes keyboard layout' },
    { id: 'sticky_keys', name: 'Sticky Keys', emoji: '🍯', rarity: 'common', desc: 'Every letter types twice' },
    { id: 'blindfold', name: 'Blindfold', emoji: '🙈', rarity: 'rare', desc: 'Blanks keyboard letters' },
    { id: 'invisible_ink', name: 'Invisible Ink', emoji: '👻', rarity: 'rare', desc: 'Hides guesses & colors' },
    { id: 'identity_theft', name: 'Identity Theft', emoji: '🔄', rarity: 'legendary', desc: 'Swap ALL progress with target' }
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
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Sync activeTab with initialTab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      // Lock body scroll on iOS Safari
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 200);
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-3 transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        className={`glass rounded-xl w-full max-w-lg h-[85vh] flex flex-col transition-all duration-200 ${
          isClosing ? 'opacity-0 translate-y-4' : 'animate-slide-up'
        }`}
        onClick={e => e.stopPropagation()}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
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
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content - fixed height with fade transition */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className={`transition-opacity duration-150 ${activeTab === 'howto' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <HowToPlayTab />
          </div>
          <div className={`transition-opacity duration-150 ${activeTab === 'items' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <ItemsTab />
          </div>
          <div className={`transition-opacity duration-150 ${activeTab === 'modes' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <GameModesTab />
          </div>
        </div>
      </div>
    </div>
  );
}

function HowToPlayTab() {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-bold text-sm text-wordle-green mb-2">Basic Rules</h3>
        <div className="space-y-1 text-white/70 text-xs">
          <p>🎯 Guess the 5-letter word in 6 tries</p>
          <p>⚡ Race against other players and the clock</p>
          <p>🏆 Score points based on speed and fewer guesses</p>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-wordle-yellow mb-2">Color Feedback</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-wordle-green rounded flex items-center justify-center font-bold text-sm">A</div>
            <span className="text-white/70 text-xs">Green = Correct spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-wordle-yellow rounded flex items-center justify-center font-bold text-sm text-black">B</div>
            <span className="text-white/70 text-xs">Yellow = Wrong spot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center font-bold text-sm">C</div>
            <span className="text-white/70 text-xs">Gray = Not in word</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-wordle-yellow mb-2">Scoring</h3>
        <div className="space-y-2 text-xs">
          {/* Formula */}
          <div className="bg-wordle-green/10 border border-wordle-green/30 rounded p-2">
            <div className="text-[10px] text-white/50 mb-1">Formula</div>
            <div className="font-mono text-white text-[11px] text-center">
              Base + Guess Bonus + Time Bonus
            </div>
            <div className="text-[10px] text-white/40 text-center mt-1">
              Max: 2400 pts (1 guess, instant solve)
            </div>
          </div>

          <div className="bg-white/5 rounded p-2">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Base Score</span>
              <span className="font-bold text-wordle-green">+1000</span>
            </div>
          </div>

          <div className="bg-white/5 rounded p-2">
            <div className="text-white/60 mb-1">Guess Bonus <span className="text-white/40 font-normal">fewer = better</span></div>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div className="flex justify-between"><span>1</span><span className="text-wordle-green">+900</span></div>
              <div className="flex justify-between"><span>2</span><span className="text-wordle-green">+750</span></div>
              <div className="flex justify-between"><span>3</span><span className="text-wordle-green">+600</span></div>
              <div className="flex justify-between"><span>4</span><span className="text-wordle-green">+450</span></div>
              <div className="flex justify-between"><span>5</span><span className="text-wordle-green">+300</span></div>
              <div className="flex justify-between"><span>6</span><span className="text-wordle-green">+150</span></div>
            </div>
          </div>

          <div className="bg-white/5 rounded p-2">
            <div className="text-white/60 mb-1">Time Bonus <span className="text-white/40 font-normal">(timeLeft ÷ totalTime) × 500</span></div>
            <div className="text-[10px] text-white/50 space-y-0.5">
              <p>• Solve instantly → <span className="text-wordle-green">+500</span></p>
              <p>• Solve at 50% time → <span className="text-wordle-green">+250</span></p>
              <p>• Solve at last second → <span className="text-wordle-green">+0</span></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ItemsTab() {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-bold text-sm text-wordle-green mb-1.5">Power-ups</h3>
        <div className="space-y-1.5">
          {ITEMS_DATA.powerups.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-red-400 mb-1.5">Sabotages <span className="text-white/40 font-normal text-[10px]">(35% duration)</span></h3>
        <div className="space-y-1.5">
          {ITEMS_DATA.sabotages.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-purple-400 mb-1.5">How to Get Items</h3>
        <div className="space-y-1.5 text-xs">
          <div className="bg-white/5 rounded p-2">
            <span className="text-white/70">Random Drops</span>
            <span className="text-white/40"> - Underdogs 50%, middle 30%, leaders 15%</span>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2">
            <span className="text-purple-300">Item Rounds</span>
            <span className="text-white/40"> - Complete challenges for guaranteed items</span>
          </div>
        </div>
      </section>

      <div className="flex gap-3 text-[10px] pt-1">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white/30"></span>
          <span className="text-white/50">Common</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          <span className="text-purple-400">Rare</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-yellow-400">Legendary</span>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item }) {
  return (
    <div className={`rounded p-2 ${RARITY_BG[item.rarity]}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{item.emoji}</span>
        <span className={`text-xs font-medium ${RARITY_COLORS[item.rarity]}`}>{item.name}</span>
        <span className="text-[10px] text-white/40 flex-1 text-right">{item.desc}</span>
      </div>
    </div>
  );
}

function GameModesTab() {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-bold text-sm text-wordle-green mb-2">Game Modes</h3>
        <div className="space-y-2">
          <div className="bg-white/5 rounded p-2">
            <div className="text-xs font-medium text-white">Classic</div>
            <p className="text-[10px] text-white/50">Set rounds, highest total score wins</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
            <div className="text-xs font-medium text-red-400">Battle Royale</div>
            <p className="text-[10px] text-white/50">Lowest scorer eliminated each round</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-wordle-yellow mb-2">Settings</h3>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <SettingRow name="🕐 Round Time" desc="10s - 60min" />
          <SettingRow name="🔢 Rounds" desc="1-99 rounds" />
          <SettingRow name="⚡ Items" desc="Power-ups & sabotages" />
          <SettingRow name="💀 Hardcore" desc="No keyboard colors" />
          <SettingRow name="🪞 Mirror" desc="Same opener for all" />
          <SettingRow name="🆕 Fresh" desc="New opener/round" />
        </div>
      </section>

      <section>
        <h3 className="font-bold text-sm text-purple-400 mb-2">Item Challenges</h3>
        <div className="space-y-1.5 text-xs">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex justify-between">
            <span><span className="mr-1">⚡</span>Speed Solve</span>
            <span className="text-white/50">Under 30s → Legendary</span>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex justify-between">
            <span><span className="mr-1">🩸</span>First Blood</span>
            <span className="text-white/50">Solve first → Legendary</span>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex justify-between">
            <span><span className="mr-1">🎯</span>Efficiency</span>
            <span className="text-white/50">≤3 guesses → Legendary</span>
          </div>
          <div className="bg-white/5 rounded p-2 flex justify-between">
            <span><span className="mr-1">💎</span>Rare Letters</span>
            <span className="text-white/50">Use Z/X/Q/J → Common/Rare</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingRow({ name, desc }) {
  return (
    <div className="bg-white/5 rounded p-1.5">
      <div className="text-white/70">{name}</div>
      <p className="text-[10px] text-white/40">{desc}</p>
    </div>
  );
}
