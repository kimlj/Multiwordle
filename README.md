# 🎮 Wordle Royale - Multiplayer Wordle

A real-time multiplayer Wordle game where players compete to guess the word fastest!

![Wordle Royale](https://img.shields.io/badge/Wordle-Royale-6aaa64?style=for-the-badge)

## ✨ Features

### Multiplayer Gameplay
- **Unlimited Players** - Play with as many friends as you want
- **Private Lobbies** - Create rooms with shareable 6-letter codes
- **Real-time Updates** - See other players' progress live (green/yellow counts)
- **WebSocket Powered** - Instant synchronization across all players

### Fair Scoring System
The scoring system rewards both speed AND efficiency:

| Component | Points | Description |
|-----------|--------|-------------|
| Base Score | 1000 | For solving the puzzle |
| Guess Bonus | +150 per guess saved | (7 - guesses) × 150 |
| Time Bonus | Up to +500 | Based on % of time remaining |

**Example**: Solve in 3 guesses with 60% time remaining = 1000 + (4×150) + 300 = **1900 points**

### Game Mechanics
- ⏱️ **Round Timer** - Configurable (1, 3, or 5 minutes)
- ⚡ **Guess Timer** - Optional pressure timer per guess (30s, 60s, 90s)
- 🎯 **Multiple Rounds** - Play 1, 3, 5, or 7 rounds
- 📝 **Custom Words** - Host can set secret words manually
- 👁️ **Observer Mode** - External player can set words for everyone

### UI Features
- 📱 Responsive design for all screen sizes
- 🎨 Beautiful dark theme with glow effects
- ⌨️ On-screen keyboard with color feedback
- 📊 Live leaderboard during gameplay
- 🏆 Final results with rankings and stats

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Clone or download the project
cd wordle-multiplayer

# Install all dependencies
npm run install:all
```

### Running in Development

```bash
# Start both server and client
npm run dev

# Or run separately:
npm run dev:server  # Server on http://localhost:3001
npm run dev:client  # Client on http://localhost:5173
```

### Production Build

```bash
# Build the client
npm run build:client

# Start the server (serves built client)
npm start
```

The game will be available at `http://localhost:3001`

## 🎮 How to Play

### Creating a Game
1. Click "Create Game"
2. Enter your name
3. Configure settings:
   - Number of rounds
   - Time per round
   - Optional guess timer
4. Share the room code with friends

### Joining a Game
1. Click "Join Game"
2. Enter your name
3. Enter the 6-letter room code
4. Click "I'm Ready!" when ready to start

### Playing
- Type your 5-letter guess
- Press Enter to submit
- Green = correct letter, correct position
- Yellow = correct letter, wrong position
- Gray = letter not in word
- Score points based on speed and number of guesses

## 🏗️ Project Structure

```
wordle-multiplayer/
├── server/
│   ├── server.js      # Express + Socket.io server
│   ├── game.js        # Game logic and room management
│   ├── words.js       # Word list and validation
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomeScreen.jsx
│   │   │   ├── LobbyScreen.jsx
│   │   │   ├── GameScreen.jsx
│   │   │   ├── ResultsScreen.jsx
│   │   │   ├── WordleGrid.jsx
│   │   │   └── Keyboard.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── lib/
│   │   │   └── store.js
│   │   └── styles/
│   │       └── index.css
│   └── package.json
└── package.json
```

## 🔧 Configuration

### Game Settings
- **Rounds**: 1, 3, 5, or 7
- **Round Time**: 60s, 180s, or 300s
- **Guess Time**: 30s, 60s, 90s, or disabled

### Environment Variables
- `PORT` - Server port (default: 3001)

## 📡 WebSocket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `createRoom` | Create a new game room |
| `joinRoom` | Join an existing room |
| `toggleReady` | Toggle ready status |
| `submitGuess` | Submit a word guess |
| `startGame` | Host starts the game |
| `nextRound` | Host starts next round |

### Server → Client
| Event | Description |
|-------|-------------|
| `gameStateUpdate` | Room state changed |
| `playerState` | Your personal game state |
| `countdown` | Pre-game countdown |
| `roundStart` | New round begins |
| `timerUpdate` | Timer tick (every second) |
| `guessSubmitted` | A player made a guess |
| `roundEnd` | Round completed |
| `gameEnd` | All rounds finished |

## 🎨 Tech Stack

- **Frontend**: React 18, Zustand, Tailwind CSS
- **Backend**: Node.js, Express, Socket.io
- **Build**: Vite

## 📄 License

MIT License - feel free to use and modify!

---

Made with ❤️ for word game enthusiasts
