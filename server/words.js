import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load valid guesses from file (14,855 words from official Wordle)
const wordsFile = join(__dirname, 'wordle-words.txt');
const allWords = readFileSync(wordsFile, 'utf-8')
  .split('\n')
  .map(w => w.trim().toLowerCase())
  .filter(w => w.length === 5);

// All valid guesses (14,855 words)
export const VALID_GUESSES = new Set(allWords);

// Common words for answers (~2300 curated words - more recognizable)
// These are the words that can be chosen as the target word
export const WORD_LIST = [
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again",
  "agent", "agree", "ahead", "alarm", "album", "alert", "alien", "align", "alike", "alive",
  "allow", "alone", "along", "alter", "among", "angel", "anger", "angle", "angry", "ankle",
  "apart", "apple", "apply", "arena", "argue", "arise", "armor", "aroma", "array",
  "arrow", "aside", "asset", "atlas", "audio", "audit", "avoid", "award", "aware", "awful", "areas",
  "bacon", "badge", "badly", "basic", "basin", "basis", "batch", "beach", "beast", "began",
  "begin", "being", "belly", "below", "bench", "berry", "birth", "black", "blade", "blame",
  "blank", "blast", "blaze", "bleed", "blend", "bless", "blind", "blink", "block", "blond",
  "blood", "bloom", "blown", "board", "boast", "bonus", "boost", "booth", "bound", "boxer",
  "brain", "brake", "brand", "brass", "brave", "bread", "break", "breed", "brick", "bride",
  "brief", "bring", "broad", "broke", "brook", "brown", "brush", "buddy", "build", "built",
  "bunch", "burst", "buyer", "cabin", "cable", "cache", "camel", "candy", "cargo", "carry",
  "catch", "cause", "cease", "chain", "chair", "champ", "chaos", "charm", "chart", "chase",
  "cheap", "cheat", "check", "cheek", "cheer", "chess", "chest", "chief", "child", "chill",
  "china", "choir", "chord", "chose", "chunk", "civic", "claim", "clash", "class", "clean",
  "clear", "clerk", "click", "cliff", "climb", "cling", "clock", "clone", "close", "cloth",
  "cloud", "clown", "coach", "coast", "colon", "color", "comet", "comic", "coral", "couch",
  "cough", "could", "count", "court", "cover", "crack", "craft", "crane", "crash", "crawl",
  "craze", "crazy", "cream", "creed", "creek", "creep", "crest", "crime", "crisp", "cross",
  "crowd", "crown", "crude", "cruel", "crush", "curve", "cycle", "daily", "dairy", "dance",
  "dated", "dealt", "death", "debut", "decay", "decor", "decoy", "delay", "delta", "demon",
  "dense", "depot", "depth", "derby", "deter", "devil", "diary", "digit", "diner", "dirty",
  "disco", "ditch", "diver", "dizzy", "donor", "donut", "doubt", "dough", "dozen", "draft",
  "drain", "drake", "drama", "drank", "drawn", "dread", "dream", "dress", "dried", "drift",
  "drill", "drink", "drive", "droit", "drone", "drown", "drunk", "dwell", "dying", "eager",
  "early", "earth", "easel", "eaten", "eater", "eight", "elbow", "elder", "elect", "elite",
  "email", "ember", "empty", "enemy", "enjoy", "enter", "entry", "equal", "equip", "erase",
  "error", "erupt", "essay", "ethos", "event", "every", "exact", "exert", "exile", "exist",
  "extra", "fable", "facet", "faith", "false", "fancy", "fatal", "fatty", "fault", "favor",
  "feast", "fence", "ferry", "fetal", "fetch", "fever", "fiber", "field", "fiery", "fifth",
  "fifty", "fight", "final", "first", "fixed", "flame", "flash", "flask", "fleet", "flesh",
  "flick", "fling", "float", "flock", "flood", "floor", "flora", "flour", "fluid", "flung",
  "flush", "focal", "focus", "foggy", "force", "forge", "forth", "forty", "forum",
  "found", "frame", "frank", "fraud", "freak", "freed", "fresh", "fried", "front", "frost",
  "froze", "fruit", "fully", "funny", "fuzzy", "gauge", "genre", "ghost", "giant", "given",
  "gland", "glare", "glass", "gleam", "glide", "globe", "gloom", "glory", "gloss", "glove",
  "going", "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass",
  "grave", "greed", "greek", "green", "greet", "grief", "grill", "grind", "groan", "groom",
  "gross", "group", "grove", "grown", "guard", "guess", "guest", "guide", "guild", "guilt",
  "habit", "hairy", "happy", "harsh", "haste", "hasty", "hatch", "haven", "heart",
  "heavy", "hedge", "hello", "hence", "herbs", "hinge", "hippo", "hobby", "honey", "honor",
  "hoped", "horse", "hotel", "hound", "house", "hover", "human", "humid", "humor", "hurry",
  "ideal", "image", "imply", "index", "indie", "infer", "inner", "input", "intro", "irony",
  "issue", "ivory", "jeans", "jelly", "jewel", "joint", "joker", "jolly", "judge", "juice",
  "juicy", "jumbo", "jumpy", "karma", "kayak", "kebab", "knife", "knock", "known", "label",
  "labor", "lager", "lance", "large", "laser", "latch", "later", "laugh", "layer", "learn",
  "lease", "least", "leave", "ledge", "legal", "lemon", "level", "lever", "light", "limit",
  "linen", "liner", "liter", "liver", "llama", "local", "lodge", "lofty", "logic", "login",
  "looks", "loose", "lorry", "loser", "lotus", "lover", "lower", "loyal", "lucky", "lunar",
  "lunch", "lying", "lyric", "macro", "madam", "magic", "major", "maker", "mambo", "manga",
  "manor", "maple", "march", "marry", "marsh", "mason", "match", "maybe", "mayor", "meant",
  "medal", "media", "melee", "melon", "mercy", "merge", "merit", "merry", "messy", "metal",
  "meter", "might", "mimic", "minor", "minus", "mirth", "misty", "mixed", "mixer", "model",
  "modem", "moist", "money", "month", "moose", "moral", "motel", "motor", "motto", "mould",
  "mount", "mouse", "mouth", "movie", "muddy", "mural", "music", "naive", "naked", "nasty",
  "naval", "needs", "nerve", "never", "newer", "newly", "night", "ninja", "noble", "noise",
  "noisy", "north", "notch", "noted", "novel", "nudge", "nurse", "nylon", "occur", "ocean",
  "olive", "onion", "onset", "opera", "optic", "orbit", "order", "organ", "other", "ought",
  "outer", "outgo", "owner", "oxide", "ozone", "paint", "panel", "panic", "pants", "paper",
  "party", "pasta", "paste", "patch", "patio", "pause", "peace", "peach", "pearl", "pedal",
  "penny", "perch", "peril", "perky", "petal", "petty", "phase", "phone", "photo", "piano",
  "piece", "pilot", "pinch", "pitch", "pixel", "pizza", "place", "plaid", "plain",
  "plane", "plank", "plant", "plate", "plaza", "plead", "pleat", "pluck", "plumb",
  "plump", "point", "polar", "poise", "poker", "polio", "polka", "polls",
  "porch", "poser", "posse", "pouch", "pound", "power", "prank", "prawn", "press",
  "price", "pride", "prime", "print", "prior", "prism", "prize", "probe", "prone", "proof",
  "prose", "proud", "prove", "proxy", "prune", "psalm", "pulse", "punch", "pupil", "puppy",
  "purse", "quack", "quake", "qualm", "queen", "query", "quest", "queue", "quick", "quiet",
  "quilt", "quirk", "quite", "quota", "quote", "rabbi", "radar", "radio", "rainy", "raise",
  "rally", "ranch", "range", "rapid", "ratio", "raven", "reach", "react", "ready", "realm",
  "rebel", "recap", "refer", "reign", "relax", "relay", "relic", "renew", "repay", "reply",
  "rerun", "reset", "resin", "retro", "rhino", "rider", "ridge", "rifle", "right", "rigid",
  "risky", "rival", "river", "roast", "robin", "robot", "rocky", "rodeo", "rogue", "roman",
  "roomy", "roots", "rough", "round", "route", "rowdy", "royal", "rugby", "ruler", "rumor",
  "rural", "rusty", "sadly", "saint", "salad", "salon", "salsa", "salty", "sandy", "satin",
  "sauce", "sauna", "saved", "scale", "scalp", "scare", "scarf", "scary", "scene", "scent",
  "scope", "score", "scout", "scrap", "screw", "scrub", "seize", "sense", "serve", "setup",
  "seven", "sewer", "shade", "shady", "shaft", "shake", "shaky", "shall", "shame", "shape",
  "share", "shark", "sharp", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine",
  "shiny", "shirt", "shock", "shook", "shoot", "shore", "short", "shout", "shown", "shrug",
  "siege", "sight", "sigma", "silly", "since", "siren", "sixth", "sixty", "sized", "skate",
  "skill", "skull", "slain", "slang", "slash", "slate", "slave", "sleek", "sleep", "slice",
  "slide", "slime", "slimy", "slope", "small", "smart", "smash", "smell", "smile", "smoke",
  "smoky", "snack", "snake", "snare", "sneak", "sniff", "snore", "solar", "solid",
  "solve", "sonic", "sorry", "sound", "south", "space", "spare", "spark", "spawn", "speak",
  "spear", "speed", "spell", "spend", "spent", "spice", "spicy", "spill", "spine", "spite",
  "split", "spoil", "spoke", "spoon", "sport", "spray", "squad", "stack", "staff", "stage",
  "stain", "stair", "stake", "stall", "stamp", "stand", "stare", "stark", "start", "state",
  "stave", "stays", "steak", "steal", "steam", "steel", "steep", "steer", "stern", "stick",
  "stiff", "still", "sting", "stock", "stomp", "stone", "stool", "stoop", "store", "storm",
  "story", "stout", "stove", "strap", "straw", "stray", "strip", "stuck", "study", "stuff",
  "stump", "stung", "stunt", "style", "sugar", "suite", "sunny", "super", "surge", "swamp",
  "swarm", "swear", "sweat", "sweep", "sweet", "swell", "swept", "swift", "swing", "swipe",
  "swiss", "sword", "swore", "sworn", "swung", "table", "tacit", "taken", "tally", "talon",
  "tango", "tangy", "taper", "taste", "tasty", "taunt", "taxes", "teach", "teddy", "teeth",
  "tempo", "tense", "tenth", "tepid", "terms", "terra", "thank", "theft", "their", "theme",
  "there", "these", "thick", "thief", "thigh", "thing", "think", "third", "those", "three",
  "threw", "throw", "thumb", "thump", "tiger", "tight", "timer", "timid", "tired", "titan",
  "title", "toast", "today", "token", "tonal", "topic", "torch", "total", "touch", "tough",
  "towel", "tower", "toxic", "trace", "track", "trade", "trail", "train", "trait", "tramp",
  "trash", "trawl", "treat", "trend", "trial", "tribe", "trick", "tried", "trite", "troll",
  "troop", "trout", "truly", "trump", "trunk", "trust", "truth", "tulip", "tumor", "tuned",
  "tuner", "tuple", "turbo", "tutor", "tweak", "tweet", "twice", "twirl", "twist", "tying",
  "ultra", "uncle", "under", "undue", "unfit", "union", "unite", "unity", "until", "upper",
  "upset", "urban", "usage", "usher", "usual", "utter", "vague", "valid", "valor", "value",
  "valve", "vapor", "vault", "vegan", "venue", "verge", "verse", "vicar", "video", "vigor",
  "villa", "vinyl", "viola", "viper", "viral", "virus", "visit", "visor", "vista", "vital",
  "vivid", "vocal", "vodka", "vogue", "voice", "voila", "vomit", "voter", "vouch", "vowel",
  "wacky", "wagon", "waist", "waken", "walls", "waltz", "wanna", "waste", "watch", "water",
  "waver", "waves", "weary", "weave", "wedge", "weeds", "weigh", "weird", "whale", "wheat",
  "wheel", "where", "which", "while", "whine", "whirl", "white", "whole", "whose", "widen",
  "wider", "widow", "width", "wield", "willy", "windy", "witty", "woken", "woman",
  "woods", "woozy", "world", "worry", "worse", "worst", "worth", "would", "wound", "woven",
  "wreck", "wrist", "write", "wrong", "wrote", "yacht", "yearn", "yeast", "yield", "young",
  "yours", "youth", "zebra", "zesty", "zones"
];

export function getRandomWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)].toUpperCase();
}

export function isValidWord(word) {
  return VALID_GUESSES.has(word.toLowerCase());
}
