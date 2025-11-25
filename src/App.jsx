import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Bot, 
  X,
  Volume2,
  VolumeX,
  Vibrate,
  MessageCircle,
  Smile,
  Settings,
  Lightbulb,
  Crown,
  Home,
  Trophy,
  Play,
  RotateCcw,
  LogOut,
  Info,
  Wifi,
  WifiOff,
  Swords, 
  ShieldCheck,
  User,
  Brain,
  Zap,
  Skull,
  Edit,
  FileText, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyA1O5kryQhDgperTijvs9Xy1NBpuaZLS4Q",
  authDomain: "sequence-online-multiplayer-25.firebaseapp.com",
  projectId: "sequence-online-multiplayer-25",
  storageBucket: "sequence-online-multiplayer-25.firebasestorage.app",
  messagingSenderId: "1009641872290",
  appId: "1:1009641872290:web:1c7de27d90c561a2f3b0fb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = "sequence-game-v1";

// --- CONSTANTS ---
const SUITS = ['♠', '♥', '♣', '♦'];
const ALL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const REAL_BOARD_PATTERN = [
	['XX', '6♦', '7♦', '8♦', '9♦', '10♦', 'Q♦', 'K♦', 'A♦', 'XX'],
	['5♦', '3♥', '2♥', '2♠', '3♠', '4♠', '5♠', '6♠', '7♠', 'A♣'],
	['4♦', '4♥', 'K♦', 'A♦', 'A♣', 'K♣', 'Q♣', '10♣', '8♠', 'K♣'],
	['3♦', '5♥', 'Q♦', 'Q♥', '10♥', '9♥', '8♥', '9♣', '9♠', 'Q♣'],
	['2♦', '6♥', '10♦', 'K♥', '3♥', '2♥', '7♥', '8♣', '10♠', '10♣'],	
	['A♠', '7♥', '9♦', 'A♥', '4♥', '5♥', '6♥', '7♣', 'Q♠', '9♣'],
	['Q♠', '8♥', '8♦', '2♣', '3♣', '4♣', '5♣', '6♣', 'K♠', '8♣'],
	['K♠', '9♥', '7♦', '6♦', '5♦', '4♦', '3♦', '2♦', 'A♠', '7♣'],
	['10♠', '10♥', 'Q♥', 'K♥', 'A♥', '2♣', '3♣', '4♣', '5♣', '6♣'],
	['XX', '9♠', '8♠', '7♠', '6♠', '5♠', '4♠', '3♠', '2♠', 'XX']
];

const TEAM_COLORS = {
  red: { 
      bg: 'bg-red-600', 
      text: 'text-red-900', 
      mainColor: '#dc2626', // Red 600
      line: '#ff5e5e', // Bright Red/Orange for visibility on black
  },
  blue: { 
      bg: 'bg-blue-600', 
      text: 'text-blue-900', 
      mainColor: '#2563eb', // Blue 600
      line: '#00eaff', // Cyan for visibility on black
  }
};

const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😭', '😡', '👍', '👎', '👋', '🙏', '🔥', '💯', '💩', '🤡'];
const FAMILY_AVATARS = [
    { emoji: '🚫', label: 'Kosong' },
    { emoji: '👴', label: 'Kakek' }, { emoji: '👴🏻', label: 'Kakek Pth' }, { emoji: '👴🏾', label: 'Kakek Htm' }, { emoji: '👳‍♂️', label: 'Kakek Srban' }, { emoji: '🤵‍♂️', label: 'Kakek Jas' },
    { emoji: '👵', label: 'Nenek' }, { emoji: '👵🏼', label: 'Nenek Pth' }, { emoji: '👵🏿', label: 'Nenek Htm' }, { emoji: '🧕', label: 'Nenek Hjb' }, { emoji: '👰‍♀️', label: 'Nenek Gaun' },
    { emoji: '👨', label: 'Ayah' }, { emoji: '👨🏻', label: 'Ayah Pth' }, { emoji: '👨🏾', label: 'Ayah Htm' }, { emoji: '🧔‍♂️', label: 'Ayah Brwok' }, { emoji: '👮‍♂️', label: 'Ayah Polisi' },
    { emoji: '👩', label: 'Ibu' }, { emoji: '👩🏼', label: 'Ibu Pth' }, { emoji: '👩🏾', label: 'Ibu Htm' }, { emoji: '👩‍🦱', label: 'Ibu Krtng' }, { emoji: '👩‍⚕️', label: 'Ibu Dokter' },
    { emoji: '👦', label: 'Anak Laki' }, { emoji: '👦🏻', label: 'Anak Pth' }, { emoji: '👦🏾', label: 'Anak Htm' }, { emoji: '🧢', label: 'Anak Topi' }, { emoji: '🕶️', label: 'Anak Keren' },
    { emoji: '👧', label: 'Anak Pr' }, { emoji: '👧🏼', label: 'Pr Pth' }, { emoji: '👧🏾', label: 'Pr Htm' }, { emoji: '🎀', label: 'Pr Pita' }, { emoji: '🧚‍♀️', label: 'Pr Peri' }
];

// --- AUDIO SYNTHESIZER ---
const playSynthSound = (type) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        if (type === 'place') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'recycle') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'remove') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5); 
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5); 
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'wild') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            osc.frequency.linearRampToValueAtTime(600, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'message') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'win') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.1);
            osc.frequency.setValueAtTime(783.99, now + 0.2);
            osc.frequency.setValueAtTime(1046.50, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'join') {
            // New Sound for Player Joining
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.error("Audio error", e);
    }
};

// --- HELPER FUNCTIONS ---
const generateDeck = () => {
  let deck = [];
  for (let i = 0; i < 2; i++) {
    SUITS.forEach(suit => {
      ALL_RANKS.forEach(rank => {
        let type = 'standard';
        if (rank === 'J') {
          type = (suit === '♥' || suit === '♦') ? 'wild' : 'remove';
        }
        deck.push({ suit, rank, type, id: `${rank}${suit}-${i}-${Math.random().toString(36).substr(2, 5)}` });
      });
    });
  }
  return deck.sort(() => Math.random() - 0.5);
};

const generateBoard = () => {
  const board = [];
  for (let r = 0; r < 10; r++) {
    const row = [];
    for (let c = 0; c < 10; c++) {
      const code = REAL_BOARD_PATTERN[r][c];
      if (code === 'XX') {
        row.push({ isCorner: true, chip: 'corner', locked: true }); 
      } else {
        const suit = code.slice(-1);
        const rank = code.slice(0, -1);
        row.push({ suit, rank, chip: null, locked: false, isCorner: false, isRemoving: false, playedWithWild: false });
      }
    }
    board.push(row);
  }
  return board;
};

// --- LOGIC ---
const getValidMoves = (card, board, myTeam) => {
  const moves = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      let isValid = false;
      if (card.type === 'wild') {
        if (!cell.chip && !cell.isCorner) isValid = true;
      } else if (card.type === 'remove') {
        if (cell.chip && cell.chip !== myTeam && !cell.locked && !cell.isCorner) isValid = true;
      } else {
        if (cell.rank === card.rank && cell.suit === card.suit && !cell.chip) isValid = true;
      }
      if (isValid) moves.push({r, c});
    }
  }
  return moves;
};

const isCardDead = (card, board, myTeam) => {
  if (card.type === 'wild' || card.type === 'remove') return false;
  const validMoves = getValidMoves(card, board, myTeam);
  return validMoves.length === 0;
};

const checkForSequences = (board, team) => {
  let newSequencesFound = 0;
  const newLines = [];
  const tempBoard = JSON.parse(JSON.stringify(board));
  
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const isValidPos = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 10;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      directions.forEach(([dr, dc]) => {
        let line = [];
        let coords = [];
        for (let i = 0; i < 5; i++) {
           let nr = r + i * dr;
           let nc = c + i * dc;
           if (isValidPos(nr, nc)) {
             line.push(tempBoard[nr][nc]);
             coords.push({r: nr, c: nc});
           }
        }

        if (line.length === 5) {
          const allMatch = line.every(cell => (cell.chip === team) || cell.isCorner);
          if (allMatch) {
            const nonCornerLocked = line.filter(cell => !cell.isCorner && cell.locked).length;
            const allLocked = line.every(cell => cell.locked);
            if (!allLocked && nonCornerLocked <= 1) {
                 newSequencesFound++;
                 newLines.push({ start: coords[0], end: coords[4], team: team });
                 coords.forEach(({r, c}) => {
                    board[r][c].locked = true; 
                    tempBoard[r][c].locked = true;
                 });
            }
          }
        }
      });
    }
  }
  return { count: newSequencesFound, lines: newLines };
};

// --- VISUAL COMPONENTS ---

// POKER CHIP COMPONENT (Responsive Text)
const PokerChip = ({ team, rank, suit, isWild }) => {
    const mainColor = TEAM_COLORS[team].mainColor;
    const isRedSuit = ['♥', '♦'].includes(suit);
    
    return (
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
             {/* 1. Outer Edge (Base) */}
             <circle cx="50" cy="50" r="48" fill="white" stroke="#222" strokeWidth="0.5" />
             
             {/* 2. Checkerboard Rim */}
             <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke={mainColor} 
                strokeWidth="16"
                strokeDasharray="15.7 15.7"
                transform="rotate(0 50 50)"
             />
             
             {/* 3. Inner White Circle */}
             <circle cx="50" cy="50" r="32" fill="white" stroke={mainColor} strokeWidth="1" />

             {/* 4. Text Content: Rank & Suit */}
             <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fill={isRedSuit ? '#dc2626' : '#000'} style={{ fontSize: '32px', fontWeight: '900', fontFamily: 'serif' }}>
                {rank}{suit}
             </text>
             
             {/* 5. Decorative "j2" text (ONLY IF PLAYED WITH WILD CARD) */}
             {isWild && (
                 <text x="50" y="72" textAnchor="middle" fill={mainColor} style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'sans-serif', opacity: 0.8 }}>
                    J2
                 </text>
             )}
        </svg>
    );
};

const RealCardFace = ({ rank, suit, type, isHand = false }) => {
    // Elegant Board: Black background, Gold Border, White/Red Text
    const isRed = ['♥','♦'].includes(suit);
    const textColor = isHand ? (isRed ? '#ef4444' : '#1f2937') : (isRed ? '#ff5555' : '#ffffff'); 
    
    const isFace = ['J', 'Q', 'K'].includes(rank);
    const isJack = rank === 'J';
    
    let jackLabel = "";
    if (isJack) jackLabel = type === 'wild' ? "j2" : "j1";

    // RESPONSIVE TEXT SIZING
    const rankSize = isHand ? 'text-sm md:text-lg' : 'text-[6px] md:text-[8px]'; // Slightly smaller for board to prevent clash
    const suitSize = isHand ? 'text-xs md:text-sm' : 'text-[6px] md:text-[8px]';
    // Center size increased for board cards
    const centerSize = isHand ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'; 

    return (
        <div className={`
            relative w-full h-full rounded-[4px] md:rounded-[6px] flex flex-col justify-between overflow-hidden select-none font-serif
            ${isHand ? 'bg-white border border-gray-300 shadow-md p-1.5' : 'bg-slate-950 p-[1px] shadow-sm'}
        `} style={{ color: textColor }}>
            
            {/* Corner Rank/Suit - Top Left (Keep Small) */}
            <div className="flex flex-col items-center leading-none absolute top-0.5 left-0.5 z-10">
                <div className={`${rankSize} font-bold`}>{rank}</div>
                <div className={`${suitSize}`}>{suit}</div>
            </div>
            
            {isJack && <div className={`absolute top-0.5 right-1 font-sans font-bold ${isHand ? 'text-[10px] md:text-xs' : 'text-[5px] text-yellow-500'}`}>{jackLabel}</div>}
            
            {/* Center Content - Enlarged on Board, No "Box" Border for Face Cards on Board */}
            <div className="flex-1 flex items-center justify-center w-full h-full p-1">
                {isFace ? (
                    isHand ? (
                        // HAND CARD STYLE: Boxed Crown
                        <div className={`w-full h-[75%] border border-opacity-20 flex flex-col items-center justify-center relative rounded 
                            ${isRed ? 'border-red-500 bg-red-50' : 'border-gray-800 bg-gray-50'}
                        `}>
                            <Crown size={20} strokeWidth={1.5} className="mb-1 opacity-70 md:w-7 md:h-7" />
                            <div className="text-2xl md:text-3xl leading-none font-bold">{suit}</div>
                        </div>
                    ) : (
                        // BOARD CARD STYLE: Clean, No Box, Just Big Icon
                        <div className="flex flex-col items-center justify-center pt-2">
                             {/* Special Crown/Icon for Face Cards on Board */}
                             {rank === 'K' && <div className="text-[10px] md:text-[12px] font-black text-yellow-500 tracking-tighter opacity-70">KING</div>}
                             {rank === 'Q' && <div className="text-[10px] md:text-[12px] font-black text-pink-500 tracking-tighter opacity-70">QUEEN</div>}
                             {rank === 'J' && <div className="text-[10px] md:text-[12px] font-black text-cyan-500 tracking-tighter opacity-70">JACK</div>}
                             
                             <div className={`${isRed ? 'text-red-500' : 'text-slate-200'} text-3xl md:text-5xl leading-none font-bold drop-shadow-lg`}>{suit}</div>
                        </div>
                    )
                ) : (
                    <div className={`${centerSize} transform scale-y-90 drop-shadow-sm`}>{suit}</div>
                )}
            </div>
            
            {/* Bottom Corner (Rotated) - HIDDEN ON BOARD (isHand=false) */}
            {isHand && (
                <div className="flex flex-col items-center leading-none absolute bottom-0.5 right-0.5 transform rotate-180">
                    <div className={`${rankSize} font-bold`}>{rank}</div>
                    <div className={`${suitSize}`}>{suit}</div>
                </div>
            )}
        </div>
    );
};

const CardFan3D = ({ large = false }) => (
    <div className={`relative mx-auto perspective-500 transform-style-3d ${large ? 'w-48 h-32 md:w-64 md:h-40 animate-float-slow opacity-20 scale-125 md:scale-150' : 'w-32 h-20 md:w-48 md:h-28 animate-float'}`}>
        {[
            {color: 'bg-white text-red-500', suit:'♥', rank:'A', rot: -20, y: 0, z: 0},
            {color: 'bg-white text-black', suit:'♣', rank:'K', rot: -7, y: -8, z: 10},
            {color: 'bg-white text-red-500', suit:'♦', rank:'Q', rot: 7, y: -8, z: 20},
            {color: 'bg-white text-black', suit:'♠', rank:'J', rot: 20, y: 0, z: 30},
        ].map((c, i) => (
            <div key={i} className={`absolute rounded-xl border-2 border-gray-100 shadow-xl flex flex-col items-center justify-center font-bold ${c.color} transform transition-transform duration-500
                 ${large ? 'w-16 h-24 md:w-24 md:h-36 border-4' : 'w-10 h-16 md:w-16 md:h-24'}
            `} 
                 style={{
                     transform: `rotate(${c.rot}deg) translateY(${c.y}px) translateZ(${c.z}px)`,
                     left: '35%', 
                     top: 0,
                     transformOrigin: 'bottom center',
                 }}>
                <div className={`${large ? 'text-sm md:text-lg' : 'text-[10px] md:text-xs'} absolute top-1 left-1`}>{c.rank}</div>
                <div className={`${large ? 'text-4xl md:text-6xl' : 'text-2xl md:text-4xl'}`}>{c.suit}</div>
                <div className={`${large ? 'text-sm md:text-lg' : 'text-[10px] md:text-xs'} absolute bottom-1 right-1 rotate-180`}>{c.rank}</div>
            </div>
        ))}
    </div>
);

const CardFan = () => (
    <div className="relative w-16 h-12 shrink-0 transform scale-75 origin-left">
        {[
            {color: 'bg-white text-red-500', suit:'♥', rot: -20, x: 0},
            {color: 'bg-white text-black', suit:'♣', rot: -5, x: 10},
            {color: 'bg-white text-red-500', suit:'♦', rot: 10, x: 20},
            {color: 'bg-white text-black', suit:'♠', rot: 25, x: 30},
        ].map((c, i) => (
            <div key={i} className={`absolute w-8 h-12 rounded border border-gray-300 shadow-sm flex items-center justify-center text-sm font-bold ${c.color}`} 
                 style={{transform: `rotate(${c.rot}deg) translateX(${c.x}px)`, zIndex: i, left:0, top:0}}>
                {c.suit}
            </div>
        ))}
    </div>
);

// --- MAIN APP ---
export default function SequenceGame() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('menu'); 
  const [gameMode, setGameMode] = useState('offline'); 
  const [playerName, setPlayerName] = useState('Player 1');
  const [playerAvatar, setPlayerAvatar] = useState('👴'); 
  const [playerAvatarType, setPlayerAvatarType] = useState('emoji'); 
  
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState(null);
  const [myTeam, setMyTeam] = useState('blue'); 
  const [notification, setNotification] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [highlightedCells, setHighlightedCells] = useState([]); 
  const timerRef = useRef(null);

  // States
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBotLevels, setShowBotLevels] = useState(false);
  
  // Game Over Delay State
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);

  // Interstitial States
  const [interstitialStep, setInterstitialStep] = useState(0); 

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [disconnectTime, setDisconnectTime] = useState(null);
  const [gameOverReason, setGameOverReason] = useState(null); 
  
  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [hintsEnabled, setHintsEnabled] = useState(true); 
  
  const [chatMessage, setChatMessage] = useState('');
  const [unreadMsg, setUnreadMsg] = useState(false);
  const [consecutiveMissedTurns, setConsecutiveMissedTurns] = useState(0);

  // --- NETWORK MONITORING ---
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setDisconnectTime(null); };
    const handleOffline = () => { setIsOnline(false); setDisconnectTime(Date.now()); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Long Disconnect Check
  useEffect(() => {
      let interval;
      if (!isOnline && disconnectTime) {
          interval = setInterval(() => {
              if (Date.now() - disconnectTime > 45000) { 
                  setGameOverReason('disconnect');
                  setGameState(null); 
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isOnline, disconnectTime]);

  // --- AUTH ---
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- GAME OVER DELAY EFFECT ---
  useEffect(() => {
      if (gameState?.winner || gameOverReason) {
          // Wait 3 seconds before showing the game over screen
          const timer = setTimeout(() => {
              setShowGameOverScreen(true);
          }, 3000);
          return () => clearTimeout(timer);
      } else {
          setShowGameOverScreen(false);
      }
  }, [gameState?.winner, gameOverReason]);

  // --- FIRESTORE SYNC & INTERSTITIAL TRIGGER ---
  useEffect(() => {
    if (gameMode === 'online' && roomCode && user) {
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
      const unsub = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data.board === 'string') data.board = JSON.parse(data.board);
          
          if (data.chat && gameState && data.chat.length > (gameState.chat?.length || 0)) {
             if (!showChat) {
               setUnreadMsg(true);
               playSound('message');
             }
          }
          
          // DETECT NEW PLAYER JOIN (SIGNAL TIMBUL)
          if (gameState && data.players.length > gameState.players.length) {
              playSound('join');
              setNotification("Pemain Baru Bergabung!");
              setTimeout(() => setNotification(''), 2000);
          }

          if (data.status === 'playing' && gameState?.status !== 'playing') {
               triggerInterstitial(() => {
                   setView('game');
               });
          }

          setGameState(data);
          const me = data.players.find(p => p.uid === user.uid);
          if (me) setMyTeam(me.team);
          
          if (data.currentTurnIndex !== gameState?.currentTurnIndex) {
            setTimeLeft(300); 
            setHighlightedCells([]); 
            setConsecutiveMissedTurns(0); 
          }
        }
      });
      return () => unsub();
    }
  }, [gameMode, roomCode, user, gameState?.currentTurnIndex, showChat, gameState?.status, gameState?.players?.length]);

  // --- TIMER ---
  useEffect(() => {
    if (gameState && !gameState.winner && !gameOverReason && interstitialStep === 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 0) {
            clearInterval(timerRef.current);
            handleTurnTimeout();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [gameState, gameOverReason, interstitialStep]);

  const handleTurnTimeout = async () => {
      const newMissed = consecutiveMissedTurns + 1;
      setConsecutiveMissedTurns(newMissed);

      if (newMissed >= 2) {
         if (gameMode === 'offline') {
             setGameState(prev => ({ ...prev, winner: 'red' })); 
         } else {
            const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
            const opponentTeam = myTeam === 'blue' ? 'red' : 'blue';
            await updateDoc(roomRef, { winner: opponentTeam });
         }
         return;
      }

      const nextTurn = (gameState.currentTurnIndex + 1) % gameState.players.length;
      if (gameMode === 'offline') {
          setGameState(prev => ({ ...prev, currentTurnIndex: nextTurn }));
          setTimeLeft(300);
          if (nextTurn === 1) setTimeout(runBotMove, 1000);
      } else {
          const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
          await updateDoc(roomRef, { currentTurnIndex: nextTurn });
      }
      setNotification("Waktu Habis! Giliran Dilewati.");
      setTimeout(()=>setNotification(''), 3000);
  };

  const triggerInterstitial = (callback) => {
      setInterstitialStep(1);
      setTimeout(() => {
          setInterstitialStep(2);
          setTimeout(() => {
              setInterstitialStep(0);
              if (callback) callback();
          }, 2000); // 2 Seconds
      }, 2000); // 2 Seconds
  };

  // --- LOGIC: RECYCLE DEAD CARD ---
  const recycleDeadCard = async (cardIndex) => {
    if (!gameState || gameState.winner) return;
    const player = gameState.players[gameState.currentTurnIndex];
    const isMyTurn = (gameMode === 'offline' && player.uid === 'me') || (gameMode === 'online' && player.uid === user.uid);
    if (!isMyTurn) return; 

    playSound('recycle');
    // No Notification as requested
    // setNotification("Mengganti Kartu Mati..."); 

    const newDeck = [...gameState.deck];
    const newHand = [...player.hand];
    
    newHand.splice(cardIndex, 1);
    if (newDeck.length > 0) newHand.push(newDeck.shift());

    if (gameMode === 'offline') {
        setGameState(prev => ({
            ...prev,
            deck: newDeck,
            players: prev.players.map((p, i) => i === prev.currentTurnIndex ? { ...p, hand: newHand } : p)
        }));
    } else {
        const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
        const updatedPlayers = [...gameState.players];
        updatedPlayers[gameState.currentTurnIndex].hand = newHand;
        await updateDoc(roomRef, { deck: newDeck, players: updatedPlayers });
    }
  };

  const handleCreateRoom = async (playersCount) => {
    if (!user) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newBoard = generateBoard();
    const newDeck = generateDeck();
    const players = [{ 
        uid: user.uid, 
        name: playerName, 
        avatar: playerAvatar,
        avatarType: playerAvatarType,
        team: 'blue', 
        hand: newDeck.splice(0, 5), 
        isHost: true 
    }];
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', code), {
      roomId: code, hostId: user.uid, status: 'waiting', maxPlayers: playersCount,
      board: JSON.stringify(newBoard), deck: newDeck, discardPile: [], players,
      currentTurnIndex: 0, scores: { blue: 0, red: 0 }, winner: null, chat: [], winningLines: []
    });
    setRoomCode(code); setGameMode('online'); setMyTeam('blue'); setView('lobby');
  };

  const handleJoinRoom = async () => {
    if (!user || roomCode.length !== 6) return;
    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return setNotification("Room tidak ada");
    const data = snap.data();
    if (data.players.length >= data.maxPlayers) return setNotification("Penuh");
    const team = data.maxPlayers === 2 ? 'red' : (data.players.length % 2 === 0 ? 'blue' : 'red');
    const deck = [...data.deck];
    const hand = deck.splice(0, 5);
    const newPlayer = { 
        uid: user.uid, 
        name: playerName, 
        avatar: playerAvatar,
        avatarType: playerAvatarType,
        team, 
        hand, 
        isHost: false 
    };
    await updateDoc(roomRef, { players: arrayUnion(newPlayer), deck, status: data.players.length + 1 === data.maxPlayers ? 'playing' : 'waiting' });
    setGameMode('online'); setMyTeam(team); setView('lobby');
  };

  const handleLeaveLobby = async () => {
    if (gameMode === 'online' && roomCode && user) {
        try {
            const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
            const snap = await getDoc(roomRef);
            if (snap.exists()) {
                const data = snap.data();
                const updatedPlayers = data.players.filter(p => p.uid !== user.uid);
                await updateDoc(roomRef, { players: updatedPlayers });
            }
        } catch (error) {
            console.error("Error leaving room:", error);
        }
    }
    setGameState(null);
    setRoomCode('');
    setView('menu');
    setNotification('');
  };

  const handleOfflineStart = (difficulty = 'easy') => {
    const newBoard = generateBoard();
    const newDeck = generateDeck();
    
    setGameState({
      board: newBoard, deck: newDeck, discardPile: [],
      players: [
        { 
            uid: 'me', 
            name: playerName, 
            avatar: playerAvatar,
            avatarType: playerAvatarType,
            team: 'blue', 
            hand: newDeck.splice(0, 5), 
            isBot: false 
        },
        { 
            uid: 'bot', 
            name: `Robot (${difficulty})`, 
            avatar: '🤖',
            avatarType: 'emoji',
            team: 'red', 
            hand: newDeck.splice(0, 5), 
            isBot: true,
            difficulty 
        }
      ],
      currentTurnIndex: 0, scores: { blue: 0, red: 0 }, winner: null, chat: [], winningLines: []
    });
    setMyTeam('blue'); 
    setGameMode('offline'); 
    setTimeLeft(300);
    setShowBotLevels(false);

    triggerInterstitial(() => {
        setView('game');
    });
  };

  const handleForfeit = async () => {
      if (gameMode === 'offline') {
          setGameState(prev => ({ ...prev, winner: 'red' }));
          playSound('win');
      } else {
          const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
          const opponentTeam = myTeam === 'blue' ? 'red' : 'blue';
          await updateDoc(roomRef, { winner: opponentTeam });
          playSound('win');
      }
      setShowExitConfirm(false);
  };

  const playCard = async (cardIndex, r, c) => {
    if (!gameState || gameState.winner || gameOverReason) return;
    const player = gameState.players[gameState.currentTurnIndex];
    const isMyTurn = (gameMode === 'offline' && player.uid === 'me') || (gameMode === 'online' && player.uid === user.uid);
    if (!isMyTurn) return;

    const validMoves = getValidMoves(player.hand[cardIndex], gameState.board, player.team);
    const isMoveValid = validMoves.some(m => m.r === r && m.c === c);

    if (!isMoveValid) { 
        if (hintsEnabled) {
            setNotification("Langkah Tidak Valid!"); 
            vibrate(); 
            playSound('error');
            setTimeout(() => setNotification(''), 1000); 
        }
        return; 
    }

    const newBoard = JSON.parse(JSON.stringify(gameState.board));
    const card = player.hand[cardIndex];
    
    // LOGIC: Set 'playedWithWild' if the card used is a WILD card (Jack 2 eyes)
    if (card.type === 'remove') {
        playSound('remove');
        newBoard[r][c].isRemoving = true;
    } else if (card.type === 'wild') {
        playSound('wild');
        newBoard[r][c].chip = player.team;
        newBoard[r][c].playedWithWild = true; // MARKER FOR J2 CHIP
    } else {
        playSound('place');
        newBoard[r][c].chip = player.team;
    }

    if (card.type === 'remove') {
        newBoard[r][c].chip = null;
        newBoard[r][c].isRemoving = false; 
        newBoard[r][c].playedWithWild = false; // Reset wild status if removed
    }

    const { count: sequencesFound, lines: newLines } = checkForSequences(newBoard, player.team);
    const newScore = (gameState.scores[player.team] || 0) + sequencesFound;
    let winner = null;
    if (newScore >= 2) winner = player.team;

    if (winner) playSound('win');

    const updatedWinningLines = [...(gameState.winningLines || []), ...newLines];
    const newDeck = [...gameState.deck];
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);
    if (newDeck.length > 0) newHand.push(newDeck.shift());

    const nextTurn = (gameState.currentTurnIndex + 1) % gameState.players.length;
    const scores = { ...gameState.scores, [player.team]: newScore };

    vibrate(); 
    setHighlightedCells([]);
    setConsecutiveMissedTurns(0); 

    if (gameMode === 'offline') {
      setGameState(prev => ({
        ...prev, board: newBoard, deck: newDeck, players: prev.players.map((p, i) => i === prev.currentTurnIndex ? { ...p, hand: newHand } : p),
        scores, winner, currentTurnIndex: nextTurn, winningLines: updatedWinningLines
      }));
      if (!winner) setTimeout(runBotMove, 1500);
    } else {
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
      const updatedPlayers = [...gameState.players];
      updatedPlayers[gameState.currentTurnIndex].hand = newHand;
      await updateDoc(roomRef, { board: JSON.stringify(newBoard), deck: newDeck, players: updatedPlayers, scores, winner, currentTurnIndex: nextTurn, winningLines: updatedWinningLines });
    }
  };

  const runBotMove = () => {
    setGameState(prev => {
      if (!prev || prev.winner) return prev;
      const bot = prev.players[1];
      const newBoard = JSON.parse(JSON.stringify(prev.board));
      let move = null; let cardIdx = -1;
      
      const validMovesList = [];
      for (let i = 0; i < bot.hand.length; i++) {
         const valid = getValidMoves(bot.hand[i], newBoard, 'red');
         valid.forEach(v => validMovesList.push({move: v, cardIdx: i}));
      }

      if (validMovesList.length > 0) {
          const randomIndex = Math.floor(Math.random() * validMovesList.length);
          const selected = validMovesList[randomIndex];
          move = selected.move;
          cardIdx = selected.cardIdx;
      }
      
      let newScore = prev.scores.red; let winner = null; let newWinningLines = prev.winningLines || [];
      if (move) {
         if (bot.hand[cardIdx].type === 'remove') {
             playSound('remove');
             newBoard[move.r][move.c].chip = null;
             newBoard[move.r][move.c].playedWithWild = false;
         } else {
             if(bot.hand[cardIdx].type === 'wild') {
                 playSound('wild');
                 newBoard[move.r][move.c].playedWithWild = true;
             } else {
                 playSound('place');
             }
             newBoard[move.r][move.c].chip = 'red';
         }
         const { count, lines } = checkForSequences(newBoard, 'red');
         newScore += count; newWinningLines = [...newWinningLines, ...lines];
         if (newScore >= 2) winner = 'red';
      }
      
      const newDeck = [...prev.deck]; const newHand = [...bot.hand];
      if (cardIdx !== -1) newHand.splice(cardIdx, 1); if (newDeck.length > 0) newHand.push(newDeck.shift());
      return { ...prev, board: newBoard, deck: newDeck, players: prev.players.map(p => p.uid === 'bot' ? {...p, hand: newHand} : p), scores: {...prev.scores, red: newScore}, winner, currentTurnIndex: 0, winningLines: newWinningLines };
    });
    setTimeLeft(300);
  };

  const sendChat = async () => {
    if (!chatMessage.trim()) return;
    const msg = { sender: playerName, team: myTeam, text: chatMessage, timestamp: Date.now() };
    if (gameMode === 'offline') setGameState(p => ({...p, chat: [...p.chat, msg]}));
    else await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { chat: arrayUnion(msg) });
    setChatMessage('');
  };

  const playSound = (type) => { if (soundEnabled) playSynthSound(type); };
  const vibrate = () => { if (vibrationEnabled && navigator.vibrate) navigator.vibrate(200); };
  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  
  // --- VIEWS ---

  if (interstitialStep > 0) return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6 flex-col text-center">
            {/* DEFINISI STYLE ANIMASI DIPINDAH KESINI AGAR AKTIF DI KEDUA STEP */}
           <style>{`
               @keyframes loading-bar {
                   0% { transform: translateX(-100%); }
                   50% { transform: translateX(0%); }
                   100% { transform: translateX(100%); }
               }
               .animate-loading-bar {
                   animation: loading-bar 1.5s infinite linear;
               }
           `}</style>
          
          {interstitialStep === 1 && (
              <div className="animate-fade-in-down">
                   <div className="text-6xl mb-6">🍗</div>
                   <h1 className="text-3xl md:text-5xl font-black text-yellow-400 tracking-tight leading-tight">
                       Sudah Coba <br/><span className="text-white">Ayam Bakar Bibir ?</span>
                   </h1>
                   
                   {/* LOADING BAR (Model Panjang Horizontal) */}
                   <div className="w-64 h-4 bg-slate-800 rounded-full mt-8 overflow-hidden mx-auto border border-slate-700 relative shadow-inner">
                       <div className="absolute top-0 left-0 h-full bg-green-500 animate-loading-bar w-full"></div>
                   </div>
              </div>
          )}
          {interstitialStep === 2 && (
              <div className="animate-scale-in">
                   <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">
                       AYO MULAI<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">PERMAINAN !</span>
                   </h1>
                   
                   {/* LOADING BAR (Model Panjang Horizontal) */}
                   <div className="w-64 h-4 bg-slate-800 rounded-full mt-8 overflow-hidden mx-auto border border-slate-700 relative shadow-inner">
                       <div className="absolute top-0 left-0 h-full bg-green-500 animate-loading-bar w-full"></div>
                   </div>
              </div>
          )}
      </div>
  );

  if (view === 'menu') return (
    // PREMIUM MENU STYLE: Black/Gold Gradient
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900 flex flex-col items-center justify-center p-4 font-sans overflow-y-auto relative">
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
          @keyframes float-slow {
             0%, 100% { transform: translateY(0) rotate(-5deg) scale(1.5); }
             50% { transform: translateY(-20px) rotate(5deg) scale(1.6); }
          }
          .animate-float { animation: float 3s ease-in-out infinite; }
          .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        `}</style>

        {/* BACKGROUND DECORATION (Transparent Cards) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-20">
             <CardFan3D large={true} />
        </div>

        {/* AVATAR & NAME EDIT MODAL */}
        {showAvatarModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in border border-slate-700 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2"><User size={20}/> Edit Profil</h3>
                        <button onClick={()=>setShowAvatarModal(false)} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 text-white"><X size={20}/></button>
                    </div>

                    <div className="mb-6 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Nama Pemain</label>
                        <div className="flex gap-2">
                            <input 
                                value={playerName} 
                                onChange={e=>{
                                    if(e.target.value.length <= 20) setPlayerName(e.target.value);
                                }}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 font-bold text-white outline-none focus:border-yellow-500 transition-colors"
                                placeholder="Maks 20 Huruf"
                            />
                            {/* TOMBOL SIMPAN BARU: File Icon Kuning + Teks Kecil */}
                            <button onClick={()=>setShowAvatarModal(false)} className="bg-slate-700 border border-slate-600 text-yellow-500 px-4 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 hover:bg-slate-600 transition-colors group">
                                <FileText size={18} className="group-hover:scale-110 transition-transform"/> 
                                <span className="text-[8px] font-black uppercase tracking-wider leading-none">save</span>
                            </button>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 mt-1">{playerName.length}/20</div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 max-h-60 overflow-y-auto p-1">
                        {FAMILY_AVATARS.map((avatar, idx) => (
                            <button 
                                key={idx}
                                onClick={() => {
                                    setPlayerAvatar(avatar.emoji);
                                    setPlayerAvatarType('emoji');
                                }}
                                className={`aspect-square flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-xl transition-all border-2 ${playerAvatar === avatar.emoji ? 'border-yellow-500 bg-slate-600 shadow-sm' : 'border-transparent'}`}
                            >
                                <span className="text-2xl mb-1">{avatar.emoji}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="relative w-full max-w-md bg-slate-800/60 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-slate-700/50 flex flex-col items-center gap-6 mt-10 z-10">
            {/* AMAN FIREBASE BADGE (UPDATED) */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-900/40 px-3 py-1.5 rounded-full border border-green-500/50 shadow-sm">
                <ShieldCheck size={16} className="text-green-400"/>
                <span className="text-[10px] font-black text-green-400 tracking-wide">AMAN FIREBASE</span>
            </div>

            {/* 3D MOVING CARDS */}
            <div className="mb-2 w-full flex justify-center pt-6 pb-2">
                <CardFan3D />
            </div>

            {/* TITLE */}
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm tracking-tight -mt-4 mb-2">SEQUENCE</h1>

            {/* PLAYER PROFILE */}
            <div className="w-full bg-slate-900/50 p-2 rounded-2xl flex items-center gap-3 border border-slate-700 shadow-sm relative group cursor-pointer hover:bg-slate-900/80 transition-colors" onClick={() => setShowAvatarModal(true)}>
                 <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-yellow-500/50 shadow-md shrink-0">
                     <span className="text-3xl">{playerAvatar}</span>
                 </div>
                 <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 ml-1">Nama Pemain</label>
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-white text-lg truncate max-w-[150px]">{playerName}</span>
                         <Edit size={14} className="text-slate-500"/>
                     </div>
                 </div>
            </div>

            {/* GAME MODES */}
            <div className="w-full space-y-3">
                {/* VS ROBOT TOGGLE (UPDATED LIGHT THEME BUTTON) */}
                {!showBotLevels ? (
                    <button onClick={()=>setShowBotLevels(true)} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-slate-900 p-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-95 group border-2 border-yellow-300">
                        <Bot className="group-hover:rotate-12 transition-transform text-slate-900"/> VS ROBOT
                    </button>
                ) : (
                    <div className="bg-slate-900 p-2 rounded-2xl border border-slate-700 animate-fade-in-down">
                         <div className="flex justify-between items-center px-2 mb-2">
                             <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Brain size={12}/> PILIH LEVEL</span>
                             <button onClick={()=>setShowBotLevels(false)}><X size={14} className="text-slate-400"/></button>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                             <button onClick={()=>handleOfflineStart('easy')} className="bg-slate-800 hover:bg-green-900/30 text-green-400 py-3 rounded-xl font-bold text-xs shadow-sm border border-slate-700 hover:border-green-500/50 flex flex-col items-center gap-1 transition-all">
                                 <Smile size={18}/> MUDAH
                             </button>
                             <button onClick={()=>handleOfflineStart('medium')} className="bg-slate-800 hover:bg-yellow-900/30 text-yellow-400 py-3 rounded-xl font-bold text-xs shadow-sm border border-slate-700 hover:border-yellow-500/50 flex flex-col items-center gap-1 transition-all">
                                 <Zap size={18}/> SEDANG
                             </button>
                             <button onClick={()=>handleOfflineStart('hard')} className="bg-slate-800 hover:bg-red-900/30 text-red-400 py-3 rounded-xl font-bold text-xs shadow-sm border border-slate-700 hover:border-red-500/50 flex flex-col items-center gap-1 transition-all">
                                 <Skull size={18}/> SUSAH
                             </button>
                         </div>
                    </div>
                )}

                <div className="flex gap-3">
                    {/* ELEGANT LIGHT THEME BUTTONS */}
                    <button onClick={()=>handleCreateRoom(2)} className="flex-1 bg-gradient-to-br from-slate-100 to-slate-300 hover:from-white hover:to-slate-200 text-slate-900 p-4 rounded-2xl font-bold text-sm shadow-lg border border-white/50 flex items-center justify-center gap-2 group transition-all transform hover:-translate-y-0.5">
                        <Swords size={18} className="text-black group-hover:scale-110 transition-transform"/> 1 VS 1
                    </button>
                    <button onClick={()=>handleCreateRoom(4)} className="flex-1 bg-gradient-to-br from-slate-100 to-slate-300 hover:from-white hover:to-slate-200 text-slate-900 p-4 rounded-2xl font-bold text-sm shadow-lg border border-white/50 flex items-center justify-center gap-2 group transition-all transform hover:-translate-y-0.5">
                        <Swords size={18} className="text-black group-hover:scale-110 transition-transform"/> 2 VS 2
                    </button>
                </div>
            </div>

            {/* JOIN CODE (ELEGANT LIGHT STYLE) */}
            <div className="w-full relative">
                <input 
                    value={roomCode} 
                    onChange={e=>setRoomCode(e.target.value)} 
                    className="w-full bg-white p-4 rounded-2xl text-center text-slate-900 font-mono tracking-[0.2em] outline-none shadow-inner border-2 border-yellow-500/30 text-lg placeholder-slate-400 focus:border-yellow-500 transition-colors" 
                    placeholder="KODE ROOM"
                />
                <button onClick={handleJoinRoom} className="absolute right-2 top-2 bottom-2 aspect-square bg-green-600 hover:bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"><Play fill="white" size={24}/></button>
            </div>

            {/* PEMISAH GARIS WARNA BAGUS */}
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mt-4 mb-2 opacity-50"></div>

            {/* FOOTER TEXT */}
            <div className="text-center opacity-50">
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
                    powered by SETIAWAN <br/>
                    <span className="text-yellow-500 font-bold">Jangan Lupa Mampir dan Makan di Ayam Bakar Spesial Bibir by WKA</span>
                </p>
            </div>
        </div>
    </div>
  );
  
  // !!! PERBAIKAN URUTAN RENDER DI SINI !!!
  // Pengecekan data kosong HARUS dilakukan SEBELUM mencoba merender Lobby atau Game
  if (!gameState && !gameOverReason) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500 font-bold animate-pulse">Memuat Permainan...</div>;

  if (view === 'lobby') {
      // LOGIC: Check if room is full
      // Safe check: pastikan gameState ada sebelum akses players
      const isRoomFull = gameState && gameState.players && gameState.players.length === gameState.maxPlayers;

      return (
         <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center p-4">
             <div className="bg-slate-800/90 backdrop-blur p-8 rounded-[40px] text-center w-full max-w-sm border border-slate-700 shadow-2xl relative">
                 <button 
                    onClick={handleLeaveLobby} 
                    className="absolute top-6 left-6 w-10 h-10 bg-slate-700 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center shadow-sm active:scale-95 group"
                 >
                    <X size={24} strokeWidth={2.5} />
                 </button>

                 <h2 className="text-2xl font-black text-white mb-6 mt-8 tracking-tight">RUANG TUNGGU</h2>
                 <div className="bg-slate-900 p-6 rounded-3xl mb-6 cursor-pointer relative group border-2 border-slate-800 hover:border-indigo-500 transition-colors" onClick={()=>{navigator.clipboard.writeText(roomCode);setNotification("Disalin")}}>
                    <div className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider flex items-center justify-center gap-2"><Wifi size={12}/> KODE ROOM</div>
                    <div className="text-4xl font-mono text-yellow-400 tracking-widest font-black drop-shadow-md">{roomCode}</div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold">KLIK SALIN</div>
                 </div>
                 
                 {/* PLAYER LIST */}
                 <div className="space-y-3 mb-8 text-left max-h-60 overflow-y-auto pr-1">
                     {gameState?.players?.map((p,i)=>(
                        <div key={i} className={`p-3 rounded-2xl flex items-center gap-3 shadow-sm border transition-all duration-300 ${i === (gameState.players.length-1) ? 'animate-fade-in-up bg-slate-700 border-green-500/50' : 'bg-slate-700 border-slate-600'}`}>
                            <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center text-xl border border-slate-500 relative">
                                {p.avatarType === 'image' ? <img src={p.avatar} className="w-full h-full object-cover rounded-xl"/> : p.avatar}
                                {i === (gameState.players.length-1) && gameState.players.length > 1 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>}
                            </div>
                            <div className="flex-1">
                                 <div className="font-bold text-white text-sm">{p.name}</div>
                                 <div className={`text-[10px] font-black uppercase tracking-wider ${p.team==='blue'?'text-indigo-400':'text-rose-400'}`}>{p.team === 'blue' ? 'Tim Biru' : 'Tim Merah'}</div>
                            </div>
                            {p.isHost && <Crown size={16} className="text-yellow-500 drop-shadow-sm"/>}
                        </div>
                     ))}
                 </div>

                 {/* WAITING SIGNAL LOGIC */}
                 {gameState?.status==='playing' ? (
                     <div className="animate-pulse text-indigo-400 font-bold flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={16}/> Game Sedang Berlangsung...</div>
                 ) : (
                     isRoomFull ? (
                         // SIGNAL: ROOM FULL -> SHOW START BUTTON
                        <div className="space-y-3 animate-fade-in">
                             <div className="text-green-400 font-black text-lg tracking-widest animate-pulse">SIAP DIMULAI!</div>
                             {user?.uid === gameState.players[0].uid ? (
                                 <button onClick={async()=>{
                                     if (gameMode==='online') {
                                         const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
                                         await updateDoc(roomRef, { status: 'playing' });
                                     }
                                 }} className="w-full bg-green-600 hover:bg-green-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                     <Play fill="white" size={18}/> MULAI GAME
                                 </button>
                             ) : (
                                 <div className="text-slate-400 text-xs italic">Menunggu Host Memulai...</div>
                             )}
                        </div>
                     ) : (
                         // SIGNAL: WAITING FOR OPPONENT
                         <div className="flex flex-col items-center justify-center gap-2 opacity-80 py-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 border-dashed">
                             <div className="flex gap-1">
                                 <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay:'0s'}}></div>
                                 <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                                 <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div>
                             </div>
                             <span className="text-yellow-500 font-bold text-xs tracking-widest uppercase">Menunggu Lawan ({gameState?.players?.length}/{gameState?.maxPlayers})</span>
                             <span className="text-[10px] text-slate-500 max-w-[200px] leading-tight">Bagikan kode room ke teman untuk bermain</span>
                         </div>
                     )
                 )}
             </div>
         </div>
      );
  }

  // Jika kita sampai di sini, view bukan menu dan bukan lobby, tapi gameState harus ada.
  // Pengecekan di atas sudah menangani null gameState.
  
  const currentPlayer = gameState ? gameState.players[gameState.currentTurnIndex] : null;
  const isMyTurn = gameState && ((gameMode === 'offline' && currentPlayer.uid === 'me') || (gameMode === 'online' && currentPlayer.uid === user.uid));
  const myPlayer = gameState ? gameState.players.find(p => p.uid === (gameMode === 'offline' ? 'me' : user.uid)) : null;
  const myHand = myPlayer ? myPlayer.hand : [];

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-50 to-white flex flex-col font-sans overflow-hidden">
        {/* CONNECTION STATUS */}
        {!isOnline && (
            <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-xs font-bold text-center p-1 z-[100] flex items-center justify-center gap-2 shadow-md">
                <WifiOff size={12}/> Koneksi Terputus. Mencoba menghubungkan...
            </div>
        )}

        {/* TOP BAR */}
        <div className="h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-indigo-100 flex items-center justify-between px-2 md:px-4 z-30 shrink-0 shadow-sm">
             <div className="flex items-center gap-2">
                 <button onClick={()=>setShowExitConfirm(true)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm active:scale-95">
                     <LogOut size={16} className="transform rotate-180 md:w-5 md:h-5"/>
                 </button>
                 <button onClick={()=>setShowSettings(true)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm active:scale-95">
                     <Settings size={16} className="md:w-5 md:h-5"/>
                 </button>
                 <button onClick={()=>setShowHelp(true)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors shadow-sm active:scale-95">
                     <Info size={16} strokeWidth={2.5} className="md:w-5 md:h-5"/>
                 </button>
             </div>
             
             <div className="flex items-center gap-2 md:gap-6">
                 <div className="bg-slate-900 rounded-lg px-2 py-0.5 md:px-3 md:py-1 text-yellow-400 font-mono text-sm md:text-xl font-bold tracking-widest shadow-inner border border-slate-700">
                     {formatTime(timeLeft)}
                 </div>

                 <div className="flex items-center bg-white px-3 py-1 md:px-4 md:py-1.5 rounded-full border border-slate-200 shadow-sm gap-2 md:gap-4">
                     <div className="text-center"><div className="text-[7px] md:text-[9px] text-indigo-500 font-black tracking-wider">BIRU</div><div className="text-lg md:text-xl font-black text-indigo-600 leading-none">{gameState?.scores.blue}</div></div>
                     <div className="w-px h-6 md:h-8 bg-slate-200"></div>
                     <div className="text-center"><div className="text-[7px] md:text-[9px] text-rose-500 font-black tracking-wider">MERAH</div><div className="text-lg md:text-xl font-black text-rose-600 leading-none">{gameState?.scores.red}</div></div>
                 </div>
                 
                 {currentPlayer && (
                    <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-xl border min-w-[180px] max-w-[220px] transition-all duration-300 ${currentPlayer.team==='blue'?'bg-indigo-50 border-indigo-100 ring-2 ring-indigo-200':'bg-rose-50 border-rose-100 ring-2 ring-rose-200'} ${isMyTurn ? 'scale-105 shadow-md' : 'opacity-80'}`}>
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center overflow-hidden border border-black/10 shrink-0">
                            {currentPlayer.avatarType === 'image' ? <img src={currentPlayer.avatar} className="w-full h-full object-cover"/> : currentPlayer.avatar}
                        </div>
                        <div className={`font-bold text-sm truncate flex-1 ${currentPlayer.team==='blue'?'text-indigo-600':'text-rose-600'}`}>
                            {currentPlayer.name}
                        </div>
                        {/* Active Player Indicator */}
                        <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'animate-ping bg-green-500' : 'bg-slate-300'}`}></div>
                    </div>
                 )}
             </div>
        </div>

        {/* BOARD AREA */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-1 md:p-4 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
             {gameState ? (
             <div className="relative transform-style-3d rotate-x-12 max-w-[800px] w-full aspect-square transition-transform duration-500">
                 <div className="absolute inset-[-10px] md:inset-[-15px] bg-slate-800 rounded-2xl transform translate-z-[-20px] shadow-2xl opacity-90"></div>
                 
                 <div className="w-full h-full bg-slate-900 p-1 md:p-2 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 md:border-4 border-slate-700 relative">
                     {/* WINNING LINES LAYER (UPDATED FOR VISIBILITY) */}
                     <svg className="absolute inset-0 w-full h-full z-30 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {(gameState.winningLines || []).map((line, idx) => {
                            const x1 = (line.start.c * 10) + 5; const y1 = (line.start.r * 10) + 5;
                            const x2 = (line.end.c * 10) + 5; const y2 = (line.end.r * 10) + 5;
                            return (
                                <g key={idx}>
                                    {/* Outer Glow */}
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TEAM_COLORS[line.team].mainColor} strokeWidth="4" strokeLinecap="round" className="opacity-40 blur-sm"/>
                                    {/* Main Line */}
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TEAM_COLORS[line.team].line} strokeWidth="1.5" strokeLinecap="round" className="drop-shadow-md"/>
                                </g>
                            );
                        })}
                     </svg>
                     
                     {/* GRID BACKGROUND COLOR CHANGED TO WHITE FOR ELEGANT LINES */}
                     <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[1px] md:gap-[2px] bg-white">
                         {gameState.board.map((row, r) => row.map((cell, c) => {
                             const isHighlighted = highlightedCells.some(h => h.r === r && h.c === c);
                             return (
                               <div key={`${r}-${c}`} 
                                    onClick={() => {
                                        if(!isMyTurn) return;
                                        const cardIndex = myHand.findIndex(h => {
                                            if (h.type === 'wild' && !cell.chip && !cell.isCorner) return true;
                                            if (h.type === 'remove' && cell.chip && cell.chip !== myTeam && !cell.locked && !cell.isCorner) return true;
                                            if (h.type === 'standard' && h.rank === cell.rank && h.suit === cell.suit && !cell.chip) return true;
                                            return false;
                                        });
                                        if (cardIndex !== -1) playCard(cardIndex, r, c);
                                        else { 
                                            if (hintsEnabled) {
                                                setNotification("Kartu tidak cocok!"); setTimeout(()=>setNotification(''),1000); vibrate(); 
                                            }
                                        }
                                    }}
                                    className={`relative bg-slate-900 flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden
                                      ${isHighlighted ? 'ring-2 md:ring-4 ring-yellow-400 z-10 brightness-110 shadow-[0_0_15px_yellow]' : 'hover:brightness-110'}
                                      ${cell.locked ? 'brightness-90' : ''}
                                    `}
                               >
                                   {!cell.isCorner ? (
                                      <RealCardFace rank={cell.rank} suit={cell.suit} type={null} isHand={false} />
                                   ) : (
                                      // ELEGANT CORNER STYLE (WHITE TEXT)
                                      <div className="w-full h-full bg-white/10 flex flex-col items-center justify-between p-0.5 border border-white/20 relative overflow-hidden">
                                          <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t border-l border-white/40"></div>
                                          <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b border-r border-white/40"></div>
                                          <div className="text-[4px] md:text-[6px] font-serif text-white font-bold tracking-tight transform scale-75 origin-top opacity-90 drop-shadow-sm">WILD</div>
                                          <Crown size={10} className="text-white drop-shadow-md md:w-3 md:h-3"/>
                                          <div className="text-[4px] md:text-[6px] font-serif text-white font-bold tracking-tight transform scale-75 origin-bottom rotate-180 opacity-90 drop-shadow-sm">WILD</div>
                                      </div>
                                   )}
                                   {cell.chip && TEAM_COLORS[cell.chip] && (
                                      // POKER CHIP STYLE (Passed 'isWild' prop)
                                      <div className={`absolute inset-[2px] md:inset-[5px] z-20 transition-all duration-500 ${cell.isRemoving ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                           <PokerChip team={cell.chip} rank={cell.rank} suit={cell.suit} isWild={cell.playedWithWild} />
                                          {cell.locked && <div className="absolute inset-0 flex items-center justify-center text-black/50 opacity-80"><RotateCcw size={10} className="md:w-3 md:h-3"/></div>} 
                                      </div>
                                   )}
                               </div>
                             );
                         }))}
                     </div>
                 </div>
             </div>
             ) : null}
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="h-40 md:h-44 bg-gradient-to-t from-white via-white/90 to-transparent relative z-40 flex flex-col justify-end pb-2 md:pb-4 shrink-0">
             {isMyTurn && <div className="absolute top-0 w-full flex justify-center pointer-events-none"><div className="bg-yellow-400 text-yellow-900 font-black px-4 py-1 md:px-6 md:py-2 rounded-full animate-bounce shadow-lg text-xs md:text-sm tracking-wider border border-yellow-500">GILIRANMU</div></div>}
             
             <div className="absolute left-2 md:left-6 bottom-20 md:bottom-24 flex flex-col gap-3">
                 <div className="relative">
                   <button onClick={()=>{setShowChat(!showChat); setUnreadMsg(false);}} className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-2xl text-white hover:bg-indigo-500 shadow-lg shadow-indigo-200 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"><MessageCircle size={20} className="md:w-6 md:h-6"/></button>
                   {unreadMsg && !showChat && (
                      <div className="absolute -top-2 -right-2 w-3 h-3 md:w-4 md:h-4 bg-rose-500 rounded-full border-2 border-white animate-pulse"></div>
                   )}
                 </div>
             </div>

             {/* Chat Window */}
             {showChat && (
                 <div className="absolute left-4 bottom-32 w-64 md:w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col h-60 md:h-72 z-50 overflow-hidden animate-fade-in-up">
                     <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex justify-between items-center"><span className="text-xs font-bold text-indigo-800">OBROLAN</span><button onClick={()=>setShowChat(false)}><X size={16} className="text-indigo-400"/></button></div>
                     <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50">
                         {gameState?.chat?.map((m,i)=>(
                             <div key={i} className={`flex flex-col ${m.sender===playerName?'items-end':'items-start'}`}>
                                 <div className={`px-3 py-2 rounded-xl text-xs max-w-[80%] ${m.sender===playerName?'bg-indigo-600 text-white rounded-br-none':'bg-white text-slate-700 border border-slate-200 rounded-bl-none shadow-sm'}`}>{m.text}</div>
                             </div>
                         ))}
                     </div>
                     <div className="p-2 bg-white border-t border-slate-100 flex gap-2">
                         <div className="relative group">
                            <button className="p-2 text-slate-400 hover:text-indigo-500 bg-slate-50 rounded-lg"><Smile size={20}/></button>
                            <div className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 p-2 rounded-xl grid grid-cols-5 gap-1 hidden group-hover:grid w-48 shadow-xl">
                                {EMOJIS.map(e=><button key={e} onClick={()=>setChatMessage(p=>p+e)} className="hover:bg-slate-50 rounded p-1.5 text-lg">{e}</button>)}
                            </div>
                         </div>
                         <input value={chatMessage} onChange={e=>setChatMessage(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendChat()} className="flex-1 bg-slate-50 text-xs text-slate-800 outline-none px-3 rounded-lg border border-transparent focus:border-indigo-200 focus:bg-white transition-all" placeholder="Ketik pesan..."/>
                     </div>
                 </div>
             )}

             {/* Hand Cards - RESPONSIVE SIZING */}
             <div className="flex justify-center items-end -space-x-2 md:-space-x-3 h-28 md:h-36 px-2 md:px-4 pb-2 md:pb-4">
                 {myHand.map((card, idx) => {
                     const isDead = isCardDead(card, gameState.board, myTeam);
                     return (
                         <div key={idx} 
                              onClick={() => {
                                  if (isDead) return; // Prevent playing dead card normally
                                  vibrate();
                                  if (isMyTurn) {
                                      const valid = getValidMoves(card, gameState.board, myTeam);
                                      if (hintsEnabled) {
                                         setHighlightedCells(valid);
                                      } else {
                                         setHighlightedCells([]);
                                      }
                                  }
                              }}
                              className={`relative w-14 h-24 md:w-20 md:h-32 cursor-pointer transform hover:-translate-y-4 md:hover:-translate-y-8 hover:scale-110 transition-all duration-300 hover:z-50 shadow-xl rounded-lg ${isMyTurn && !isDead ?'brightness-100':'brightness-90 opacity-90'} ${isDead ? 'grayscale-[0.5]' : ''}`}
                              style={{ transform: `rotate(${(idx-2)*6}deg) translateY(${Math.abs(idx-2)*4}px)` }}
                         >
                             <RealCardFace rank={card.rank} suit={card.suit} type={card.type} isHand={true} />
                             
                             {/* DEAD CARD INDICATOR / RECYCLE BUTTON */}
                             {isDead && isMyTurn && (
                                 <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        recycleDeadCard(idx);
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 md:p-1.5 rounded-full shadow-md z-50 animate-bounce hover:bg-red-600 transition-colors"
                                    title="Ganti Kartu Mati"
                                 >
                                     <RefreshCw size={10} className="md:w-3.5 md:h-3.5" />
                                 </button>
                             )}
                         </div>
                     );
                 })}
             </div>
        </div>

        {notification && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in font-bold text-sm tracking-wide border border-white/10">{notification}</div>}
        
        {/* MODALS: SETTINGS, HELP, GAME OVER, EXIT - (Same Logic as Previous) */}
        {showSettings && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl w-full max-w-xs text-center shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Settings className="text-indigo-500"/> PENGATURAN</h2>
                        <button onClick={()=>setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={16}/></button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-slate-600 font-bold text-sm flex items-center gap-3">{soundEnabled ? <Volume2 size={18} className="text-indigo-500"/> : <VolumeX size={18} className="text-slate-400"/>} Suara</span>
                            <button onClick={()=>setSoundEnabled(!soundEnabled)} className={`w-11 h-6 rounded-full transition-all relative ${soundEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 bottom-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${soundEnabled ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-slate-600 font-bold text-sm flex items-center gap-3">{hintsEnabled ? <Lightbulb size={18} className="text-yellow-500"/> : <Lightbulb size={18} className="text-slate-400"/>} Sinyal Kartu</span>
                            <button onClick={()=>setHintsEnabled(!hintsEnabled)} className={`w-11 h-6 rounded-full transition-all relative ${hintsEnabled ? 'bg-yellow-400' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 bottom-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${hintsEnabled ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-slate-600 font-bold text-sm flex items-center gap-3"><Vibrate size={18} className="text-rose-500"/> Getar</span>
                            <button onClick={()=>setVibrationEnabled(!vibrationEnabled)} className={`w-11 h-6 rounded-full transition-all relative ${vibrationEnabled ? 'bg-rose-500' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 bottom-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${vibrationEnabled ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {showHelp && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-scale-in max-h-[85vh] overflow-y-auto">
                    <div className="bg-indigo-50 p-4 flex justify-between items-center border-b border-indigo-100 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                                <Info className="text-indigo-500"/> CARA BERMAIN
                            </h2>
                            <CardFan /> 
                        </div>
                        <button onClick={()=>setShowHelp(false)} className="w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center hover:text-indigo-500 shadow-sm"><X size={16}/></button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="flex gap-4 items-start">
                            <div className="bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 font-bold shrink-0 text-sm">1</div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm mb-1">Target Menang</h3>
                                <p className="text-slate-500 text-xs leading-relaxed">Bentuk <span className="text-indigo-600 font-bold">2 Garis</span> (5 chip per garis) secara Horizontal, Vertikal, atau Diagonal.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-amber-100 w-8 h-8 rounded-full flex items-center justify-center text-amber-600 font-bold shrink-0 text-sm">2</div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm mb-1">Kartu Spesial (Jack)</h3>
                                <p className="text-slate-500 text-xs mb-1"><span className="text-rose-500 font-bold">j2 (2 Mata):</span> Wild Card. Bisa taruh chip di mana saja.</p>
                                <p className="text-slate-500 text-xs"><span className="text-slate-700 font-bold">j1 (1 Mata):</span> Remove. Bisa hapus chip lawan yang belum terkunci.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                             <div className="bg-red-100 w-8 h-8 rounded-full flex items-center justify-center text-red-600 font-bold shrink-0 text-sm">!</div>
                             <div>
                                 <h3 className="font-bold text-slate-800 text-sm mb-1">Kartu Mati</h3>
                                 <p className="text-slate-500 text-xs leading-relaxed">Jika kartu di tangan tidak bisa ditaruh (papan penuh), klik tombol <span className="text-red-500 font-bold">Recycle</span> di kartu untuk ganti kartu baru.</p>
                             </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-green-100 w-8 h-8 rounded-full flex items-center justify-center text-green-600 font-bold shrink-0 text-sm">3</div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm mb-1">Sudut (Corner)</h3>
                                <p className="text-slate-500 text-xs leading-relaxed">4 Sudut adalah area bebas. Anda hanya butuh 4 chip lagi jika terhubung ke sudut.</p>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium italic border-t border-slate-100 pt-1">powered by SETIAWAN | Jangan Lupa mampir Makan di Tempat Ayam Bakar Spesial Bibir By WKA</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL GAME OVER DENGAN PERBAIKAN TOMBOL KEMBALI */}
        {showGameOverScreen && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-[80] flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
                {gameOverReason === 'disconnect' ? (
                     <div className="text-center">
                         <WifiOff size={80} className="text-slate-400 mb-6 mx-auto animate-pulse" />
                         <h1 className="text-4xl font-black text-white mb-4 tracking-tight">KONEKSI TERPUTUS</h1>
                         <p className="text-slate-300 font-medium italic mb-8 px-4 opacity-80 max-w-sm">"Permainan seimbang karna tidak mencapai score target 2 point"</p>
                     </div>
                ) : (
                    <div className="w-full max-w-sm bg-gradient-to-b from-slate-800 to-slate-900 p-1 rounded-[40px] shadow-2xl border-4 border-slate-700/50 my-auto">
                        <div className="bg-slate-900 rounded-[36px] p-6 md:p-8 flex flex-col items-center relative overflow-hidden">
                            
                            {/* 3D GAME OVER TEXT */}
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 md:mb-6 relative z-10" style={{ textShadow: "0px 4px 0px #334155, 0px 8px 10px rgba(0,0,0,0.5)" }}>
                                GAME OVER
                            </h1>

                            {/* ANIMATED TROPHY */}
                            <div className="relative mb-6 md:mb-8 z-10">
                                <Trophy size={80} className="text-yellow-400 drop-shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-bounce md:w-24 md:h-24" />
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-yellow-500/20 blur-xl rounded-full"></div>
                            </div>
                            
                            {/* SCORE BOX */}
                            <div className="bg-slate-800/80 w-full rounded-2xl p-4 border border-slate-700 mb-6 relative z-10">
                                <p className="text-slate-400 text-[10px] font-bold tracking-widest text-center mb-3 uppercase">PEMENANG</p>
                                <div className={`text-2xl font-black text-center mb-4 ${gameState?.winner === 'blue' ? 'text-indigo-400' : 'text-rose-400'}`}>
                                    {gameState?.winner === 'blue' ? 'TIM BIRU' : 'TIM MERAH'}
                                </div>
                                <div className="flex flex-col items-center gap-2 mb-4">
                                     {/* LIST WINNING PLAYERS */}
                                     {gameState?.players?.filter(p => p.team === gameState.winner).map((p, i) => (
                                         <span key={i} className="text-xs text-slate-300 font-bold">{p.name}</span>
                                     ))}
                                </div>
                                <div className="flex justify-center items-center gap-6 border-t border-slate-700 pt-4">
                                    <div className="text-center">
                                        <div className="text-[10px] text-indigo-400 font-bold mb-1">BIRU</div>
                                        <div className="text-3xl font-black text-white">{gameState?.scores.blue}</div>
                                    </div>
                                    <div className="h-8 w-px bg-slate-600"></div>
                                    <div className="text-center">
                                        <div className="text-[10px] text-rose-400 font-bold mb-1">MERAH</div>
                                        <div className="text-3xl font-black text-white">{gameState?.scores.red}</div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-slate-400 text-xs font-medium italic mb-6 text-center opacity-80 z-10">
                                "Terima kasih telah menjadi lawan yang baik"
                            </p>
                            
                            {/* BOLD PROMO TEXT */}
                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl mb-8 z-10">
                                <p className="text-yellow-400 font-black text-xs text-center leading-relaxed tracking-wide">
                                    JANGAN LUPA MAMPIR & MAKAN DI TEMPAT AYAM BAKAR BIBIR SPESIAL BIBIR BY WKA
                                </p>
                            </div>

                            {/* PERBAIKAN TOMBOL KEMBALI */}
                            <button 
                                onClick={() => {
                                    setView('menu');
                                    setGameState(null);
                                    setGameOverReason(null);
                                    setShowGameOverScreen(false); // Reset
                                    setRoomCode(''); // CRITICAL FIX: HAPUS ROOM CODE AGAR TIDAK NYANGKUT
                                    setGameMode('offline'); // CRITICAL FIX: RESET MODE
                                }}
                                className="w-full bg-white hover:bg-slate-200 text-slate-900 font-black py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 z-10"
                            >
                                <Home size={18} strokeWidth={3}/> KEMBALI KE MENU
                            </button>

                             {/* Background Effects */}
                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_70%)] pointer-events-none"></div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {showExitConfirm && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-3xl text-center max-w-xs w-full shadow-2xl animate-scale-in">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-rose-500"/>
                    </div>
                    <h3 className="text-slate-800 font-black text-xl mb-2">MENYERAH?</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">Jika keluar sekarang, kamu otomatis dinyatakan <span className="font-bold text-rose-500">KALAH</span>.</p>
                    <div className="flex gap-3">
                        <button onClick={()=>setShowExitConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors">BATAL</button>
                        <button onClick={handleForfeit} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200 transition-colors">YA, KELUAR</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
