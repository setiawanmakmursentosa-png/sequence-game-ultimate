import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import { 
  RotateCcw, Trophy, X, Users, Bot, 
  Volume2, VolumeX, MessageSquare, Trash2, AlertTriangle, Clock, 
  ShieldCheck, RefreshCw, Loader, 
  User, CheckCircle, WifiOff, Activity, Zap, Brain, Skull,
  Smartphone, Sparkles, Grid, Edit3, BookOpen, Crown, Ban, Lock, Copy,
  LogOut, Link as LinkIcon, Shield, Repeat, Layers, AlertOctagon, Info
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

/**
 * ============================================================================
 * KONFIGURASI DEPLOYMENT (PENTING UNTUK NETLIFY/GITHUB)
 * ============================================================================
 * Saat Anda menaruh ini di website asli (bukan preview ini), Anda perlu
 * membuat project di Firebase Console (https://console.firebase.google.com/),
 * lalu copy 'firebaseConfig' Anda dan tempel di bawah ini menggantikan 'null'.
 * * Contoh:
 * const YOUR_FIREBASE_CONFIG = {
 * apiKey: "AIzaSy...",
 * authDomain: "...",
 * projectId: "...",
 * ...
 * };
 */
const YOUR_FIREBASE_CONFIG = null; // <--- GANTI 'null' DENGAN CONFIG ANDA SAAT DEPLOY

// --- UTILITAS KEAMANAN & PARSING ---
const safeParse = (jsonString, fallbackValue) => {
    if (!jsonString) return fallbackValue;
    try {
        const result = JSON.parse(jsonString);
        return result === null ? fallbackValue : result;
    } catch (e) {
        return fallbackValue;
    }
};

// --- ERROR BOUNDARY (PENCEGAH CRASH TOTAL) ---
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Game Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center z-[9999]">
          <WifiOff size={64} className="text-amber-500 mb-4 animate-pulse"/>
          <h2 className="text-2xl font-black text-amber-400 mb-2 tracking-widest">GANGGUAN SISTEM</h2>
          <p className="text-zinc-400 mb-6 max-w-md text-sm">Terjadi kesalahan teknis. Harap muat ulang halaman.</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-500 rounded-full font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105 transition-transform text-sm tracking-widest">RESET GAME</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- KONFIGURASI GAME ---
const WINNING_SCORE = 2; 
const TURN_DURATION = 300; 
const TIMEOUT_DURATION = 5 * 60 * 1000; 
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K', 'A'];
const EMOJIS = ["😂", "😎", "😡", "😭", "🤔", "👎", "👍", "🔥", "🐌", "👻", "🤝", "gg"];
const CARD_BACK_URL = "https://deckofcardsapi.com/static/img/back.png";

// --- FIREBASE SETUP ---
let app, auth, db;
let isOnlineAvailable = false;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sequence-game-prod'; // ID unik untuk environment ini

try {
  // Prioritas 1: Config dari Environment Preview (jangan diubah)
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isOnlineAvailable = true;
  } 
  // Prioritas 2: Config Manual User (untuk Netlify/Github)
  else if (YOUR_FIREBASE_CONFIG) {
    app = initializeApp(YOUR_FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    isOnlineAvailable = true;
  }
} catch (e) { console.error("Firebase Init Error:", e); }

// --- DATA PAPAN (LAYOUT KARTU) ---
const REAL_BOARD_PATTERN = [
    ['XX', '6♦', '7♦', '8♦', '9♦', '10♦', 'Q♦', 'K♦', 'A♦', 'XX'],
    ['5♦', '3♥', '2♥', '2♠', '3♠', '4♠', '5♠', '6♠', '7♠', 'A♣'],
    ['4♦', '4♥', 'K♦', 'A♦', 'A♣', 'K♣', 'Q♣', '10♣', '8♠', 'K♣'],
    ['3♦', '5♥', 'Q♦', 'Q♥', '10♥', '9♥', '8♥', '9♣', '9♠', 'Q♣'],
    ['2♦', '6♥', '10♦', 'K♥', '3♥', '2♥', '7♥', '8♥', '10♠', '10♣'], 
    ['A♠', '7♥', '9♦', 'A♥', '4♥', '5♥', '6♥', '7♣', 'Q♠', '9♣'],
    ['Q♠', '8♣', '8♦', '2♣', '3♣', '4♣', '5♣', '6♣', 'K♠', '8♣'],
    ['K♠', '9♥', '7♦', '6♦', '5♦', '4♦', '3♦', '2♦', 'A♠', '7♣'],
    ['10♠', '10♥', 'Q♥', 'K♥', 'A♥', '2♣', '3♣', '4♣', '5♣', '6♣'],
    ['XX', '9♠', '8♠', '7♠', '6♠', '5♠', '4♠', '3♠', '2♠', 'XX']
];

// --- ASSETS & HELPERS ---
const getCardImageUrl = (rank, suit) => {
    if (rank === 'XX' || !rank || !suit) return null;
    let sCode = suit === '♠' ? 'S' : suit === '♣' ? 'C' : suit === '♥' ? 'H' : 'D';
    let rCode = rank === '10' ? '0' : rank;
    return `https://deckofcardsapi.com/static/img/${rCode}${sCode}.png`;
};

const isTwoEyedJack = (r, s) => r === 'J' && (s === '♣' || s === '♦'); 
const isOneEyedJack = (r, s) => r === 'J' && (s === '♠' || s === '♥'); 
const getTeam = (pIdx) => pIdx % 2; 

const createDeck = () => {
    let deck = [];
    for (let i = 0; i < 2; i++) { 
        SUITS.forEach(suit => {
            RANKS.forEach(rank => deck.push({ suit, rank, id: `${i}-${rank}${suit}` }));
            deck.push({ suit, rank: 'J', id: `${i}-J${suit}` });
        });
    }
    // Fisher-Yates Shuffle Modern
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    }
    return deck;
};

const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const generateNumericId = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- KOMPONEN VISUAL PREMIUM ---
const CardFallback = ({ rank, suit }) => (
    <div className="w-full h-full bg-[#f1f5f9] flex flex-col items-center justify-center border border-slate-300 rounded-md select-none relative shadow-sm">
        <span className={`text-[10px] sm:text-xs font-black ${['♥','♦'].includes(suit)?'text-red-600':'text-slate-900'}`}>{rank}</span>
        <span className={`text-xs sm:text-sm ${['♥','♦'].includes(suit)?'text-red-600':'text-slate-900'}`}>{suit}</span>
    </div>
);

const GhostChip = ({ team, type, onComplete }) => {
    useEffect(() => { const t = setTimeout(onComplete, 1200); return () => clearTimeout(t); }, [onComplete]);
    return (
        <div className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none ${type === 'roll-out' ? 'animate-roll-out' : ''}`}>
             <div className={`w-[65%] h-[65%] rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.5)] border-[3px] backdrop-blur-sm ${team === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300' : 'bg-gradient-to-br from-rose-500 to-rose-700 border-rose-300'}`}></div>
        </div>
    );
};

const DealingOverlay = ({ onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 3000); // Durasi animasi dealing
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="absolute inset-0 z-[999] bg-[#050505]/90 backdrop-blur-md flex flex-col items-center justify-center select-none pointer-events-none">
            <div className="relative w-32 h-48">
                 {[...Array(5)].map((_, i) => (
                    <img 
                        key={i}
                        src={CARD_BACK_URL} 
                        className="absolute top-0 left-0 w-full h-full rounded-xl shadow-2xl border border-white/10"
                        style={{ 
                            animation: `dealCard 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.15}s forwards`,
                            transform: `translateY(-${i * 2}px) translateX(-${i * 2}px)`
                        }}
                        alt=""
                    />
                 ))}
            </div>
            <h2 className="mt-16 text-2xl font-black text-amber-500 tracking-[0.5em] animate-pulse">MEMBAGI KARTU</h2>
        </div>
    );
};

const OpponentPlayedCard = ({ card }) => {
    if (!card) return null;
    const imgUrl = getCardImageUrl(card.rank, card.suit);
    return (
        <div className="absolute top-[18%] right-[5%] z-[80] pointer-events-none" style={{ perspective: '1000px' }}>
            <div className="w-16 sm:w-24 aspect-[2/3] bg-white rounded-xl shadow-2xl border border-slate-300 origin-top-right animate-opponent-play">
                 <img src={imgUrl} className="w-full h-full object-contain p-1" alt="" />
                 <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-3 py-0.5 rounded-full text-[9px] font-bold tracking-widest whitespace-nowrap border border-white/20 shadow-lg">
                    LAWAN
                 </div>
            </div>
        </div>
    );
};

const BoardCell = React.memo(({ cell, isHighlight, isTarget, isLast, lastMoveType, isOccupiedError, onClick }) => {
    const [imgError, setImgError] = useState(false);
    const imgUrl = useMemo(() => getCardImageUrl(cell.rank, cell.suit), [cell.rank, cell.suit]);
    
    // Corner Style
    if (cell.type === 'corner') {
        return (
            <div className="relative w-full h-full border-[0.5px] border-white/5 overflow-hidden bg-[#0a0a0a] flex items-center justify-center group shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(245,158,11,0.1)_1px,transparent_1px)] bg-[length:4px_4px] opacity-30"></div>
                <Crown size={14} className="text-amber-500/60 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"/>
            </div>
        );
    }
    
    const isDropping = isLast && lastMoveType === 'wild';
    // Style when locked (sequence complete) vs Normal
    const lockedVisual = cell.locked ? "brightness-[0.5] grayscale-[0.6] contrast-125 ring-1 ring-black/80" : "hover:brightness-110";

    return (
        <div 
            onClick={() => onClick(cell.r, cell.c)}
            className={`relative flex items-center justify-center overflow-hidden cursor-pointer select-none transition-all duration-300 bg-[#e2e8f0] shadow-sm
                ${isTarget ? 'ring-[3px] ring-yellow-400 z-30 scale-[1.02] shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-pulse brightness-110' : ''}
                ${isHighlight ? 'ring-[3px] ring-emerald-400 z-30 shadow-[0_0_15px_rgba(16,185,129,0.5)] brightness-105' : ''} 
                ${lockedVisual}
                border-[0.5px] border-slate-400/20
            `}
            style={{ aspectRatio: '1/1' }}
        >
            {imgError ? <CardFallback rank={cell.rank} suit={cell.suit} /> :
            <img src={imgUrl} onError={() => setImgError(true)} className="w-full h-full object-contain p-[1px] pointer-events-none" loading="lazy" alt="" />}
            
            {/* Visual Effects Overlay */}
            {isTarget && <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center z-20"><AlertOctagon className="text-yellow-600 w-5 h-5 drop-shadow-md animate-bounce"/></div>}
            {isOccupiedError && <div className="absolute inset-0 bg-rose-600/60 flex items-center justify-center z-40 animate-ping"><Ban className="text-white w-6 h-6"/></div>}
            
            {/* CHIP RENDER */}
            {cell.chip !== null && (
                <div className={`absolute w-[68%] h-[68%] rounded-full z-20 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.7)] border-[2px] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
                    ${getTeam(cell.chip) === 0 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-800 border-blue-300/80 shadow-blue-900/50' 
                        : 'bg-gradient-to-br from-rose-500 to-rose-800 border-rose-300/80 shadow-rose-900/50'}
                    ${isLast && !isDropping ? 'scale-110 ring-2 ring-amber-300 ring-offset-1 ring-offset-black' : ''}
                    ${isDropping ? 'animate-drop-in' : ''}
                `}>
                    <div className="w-[70%] h-[70%] rounded-full border border-white/20 bg-black/10 flex items-center justify-center backdrop-blur-sm">
                        {cell.locked && <Lock size={10} className="text-white/90 drop-shadow-md" />} 
                        {cell.isWild && !cell.locked && <Crown size={10} className="text-amber-200 drop-shadow-sm" />}
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => prev.cell === next.cell && prev.isHighlight === next.isHighlight && prev.isTarget === next.isTarget && prev.isLast === next.isLast && prev.lastMoveType === next.lastMoveType && prev.isOccupiedError === next.isOccupiedError);

const HandCard = React.memo(({ card, selected, disabled, onClick }) => {
    if (!card) return <div className="w-14 sm:w-16 lg:w-20 aspect-[2/3] flex-shrink-0 opacity-0"></div>;
    const imgUrl = getCardImageUrl(card.rank, card.suit);
    let label = null, labelColor = '';
    if (card.rank === 'J') {
        if (isTwoEyedJack(card.rank, card.suit)) { label = "WILD"; labelColor = "bg-emerald-600"; } 
        else { label = "BUANG"; labelColor = "bg-rose-600"; }
    }
    return (
        <div onClick={onClick} className={`relative w-14 sm:w-16 lg:w-24 aspect-[2/3] flex-shrink-0 bg-white rounded-lg shadow-lg border border-slate-200 cursor-pointer transition-all select-none duration-200 transform will-change-transform
            ${selected ? '-translate-y-6 ring-2 ring-amber-400 z-30 shadow-[0_0_25px_rgba(251,191,36,0.5)] scale-110' : ''} 
            ${disabled ? 'opacity-50 grayscale brightness-90 cursor-not-allowed' : 'hover:-translate-y-3 hover:shadow-xl hover:brightness-105'}
        `}>
            <img src={imgUrl} onError={(e)=>e.target.src=''} className="w-full h-full object-contain p-1 rounded-lg" loading="lazy" alt="" />
            {label && <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-[2px] text-[7px] font-black text-white tracking-wider text-center rounded-full ${labelColor} shadow-md whitespace-nowrap z-10 border border-white/50`}>{label}</div>}
        </div>
    );
});

const OpponentHand = ({ count }) => {
    return (
        <div className="flex justify-center items-start -space-x-3 sm:-space-x-4 opacity-90 scale-75 sm:scale-90 origin-top">
            {[...Array(Math.min(count, 7))].map((_, i) => (
                <div key={i} className="w-10 sm:w-12 aspect-[2/3] rounded-md bg-white border border-slate-300 shadow-md relative overflow-hidden">
                    <img src={CARD_BACK_URL} className="w-full h-full object-cover" alt="Back" />
                </div>
            ))}
            {count > 7 && (
                <div className="w-10 sm:w-12 aspect-[2/3] flex items-center justify-center text-[10px] font-bold text-white bg-black/50 rounded-md z-10">
                    +{count - 7}
                </div>
            )}
        </div>
    );
};

// --- LOGIKA UTAMA GAME ---
function SequenceGameInternal() {
    const [user, setUser] = useState(null);
    const [appMode, setAppMode] = useState('menu'); 
    const [botLevel, setBotLevel] = useState('easy'); 
    const [roomId, setRoomId] = useState(null);
    const [playerIndex, setPlayerIndex] = useState(null);
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [board, setBoard] = useState([]);
    const [deck, setDeck] = useState([]);
    const [hands, setHands] = useState({0:[], 1:[], 2:[], 3:[]});
    const [turn, setTurn] = useState(0);
    const [winner, setWinner] = useState(null);
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [lastMove, setLastMove] = useState(null);
    const [chats, setChats] = useState([]);
    const [showChat, setShowChat] = useState(false);
    const [toast, setToast] = useState(null);
    const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
    const [soundOn, setSoundOn] = useState(true);
    const [vibrateOn, setVibrateOn] = useState(true);
    const [selectedCardIdx, setSelectedCardIdx] = useState(null);
    const [message, setMessage] = useState("");
    const [scores, setScores] = useState({0:0, 1:0});
    const [winningLines, setWinningLines] = useState([]); 
    const [scoredIds, setScoredIds] = new Set(); 
    const [playerName, setPlayerName] = useState("Player 1");
    const [playerNamesList, setPlayerNamesList] = {};
    const [loadingText, setLoadingText] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [ghostChips, setGhostChips] = useState([]);
    const [isGeminiThinking, setIsGeminiThinking] = useState(false);
    const [errorCell, setErrorCell] = useState(null); 
    const [confirmQuit, setConfirmQuit] = useState(false); 
    const [roomDetails, setRoomDetails] = useState(null); 
    const [joinCodeInput, setJoinCodeInput] = useState(''); 
    const [isDealing, setIsDealing] = useState(false);
    const [visualPlayedCard, setVisualPlayedCard] = useState(null); 
    const audioCtxRef = useRef(null);
    
    // --- Initializer for playerNamesList to prevent undefined issues
    useEffect(() => {
        setPlayerNamesList({
            0: playerName, 
            1: 'Lawan',
            2: 'Lawan 2',
            3: 'Lawan 3',
        });
    }, [playerName]);

    // --- SECURITY & STYLE INJECTION ---
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes rollOut { 0% { transform: scale(1) rotate(0deg); opacity: 1; } 20% { transform: scale(1.1) rotate(-10deg); opacity: 1; } 100% { transform: scale(0.4) translateX(300px) rotate(720deg); opacity: 0; } }
            .animate-roll-out { animation: rollOut 0.8s ease-in forwards; }
            @keyframes dropIn { 0% { transform: translateY(-300%) scale(1.5); opacity: 0; } 60% { transform: translateY(10%) scale(1); opacity: 1; } 80% { transform: translateY(-5%); } 100% { transform: translateY(0); } }
            .animate-drop-in { animation: dropIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
            @keyframes dealCard { 0% { transform: translate(0,0) scale(0.1); opacity: 0; } 50% { transform: translate(0,0) scale(1.2); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; } }
            @keyframes opponentSidePlay { 0% { transform: translateX(50px) scale(0.5); opacity: 0; } 20% { transform: translateX(0px) scale(1); opacity: 1; } 80% { transform: translateX(0px) scale(1); opacity: 1; } 100% { transform: translateX(0px) translateY(50px) scale(0.5); opacity: 0; } }
            .animate-opponent-play { animation: opponentSidePlay 2s ease-out forwards; }
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            .text-gradient-gold { background: linear-gradient(to bottom, #fcd34d, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .bg-felt-pattern { background-color: #0f172a; background-image: radial-gradient(#1e293b 1px, transparent 1px); background-size: 20px 20px; }
        `;
        document.head.appendChild(style);
        // SECURITY: Block common inspect/source shortcuts
        const preventContext = (e) => e.preventDefault();
        const preventInspect = (e) => { 
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') || 
                (e.ctrlKey && e.key === 'U') ||              
                (e.ctrlKey && e.key === 'S')                 
            ) e.preventDefault(); 
        };
        document.addEventListener('contextmenu', preventContext); 
        document.addEventListener('keydown', preventInspect);
        
        return () => { 
            if(document.head.contains(style)) document.head.removeChild(style); 
            document.removeEventListener('contextmenu', preventContext); 
            document.removeEventListener('keydown', preventInspect); 
        };
    }, []);

    // --- AUTH ---
    useEffect(() => {
        const init = async () => {
            if (isOnlineAvailable && auth) {
                try { 
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) { console.error("Auth:", e); }
            }
        }; 
        init();
        if (isOnlineAvailable && auth) {
            return onAuthStateChanged(auth, (u) => setUser(u || null)); 
        } else {
            setUser({uid: 'offline-user', isAnonymous: true});
        }
    }, []);

    // --- URL PARAMS & SOUND ---
    useEffect(() => { if(typeof window !== 'undefined'){ const params = new URLSearchParams(window.location.search); const roomParam = params.get('room'); if(roomParam) { setJoinCodeInput(roomParam); setAppMode('online-setup'); } } }, []);
    const playEffect = useCallback((type) => {
        if (vibrateOn && typeof navigator !== 'undefined' && navigator.vibrate) { try { if (type === 'move') navigator.vibrate(30); if (type === 'punch') navigator.vibrate(80); if (type === 'win') navigator.vibrate([100, 50, 100, 50, 200]); if (type === 'error') navigator.vibrate([50, 50, 50]); } catch (e) {} }
        if (!soundOn) return; 
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            const ctx = audioCtxRef.current; const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
            if (type === 'win') { osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, now); osc.frequency.linearRampToValueAtTime(783.99, now + 0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1); osc.start(now); osc.stop(now + 1); }
            else if (type === 'move') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2); }
            else if (type === 'punch') { osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.3); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); }
            else if (type === 'wild') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5); osc.start(now); osc.stop(now + 0.5); }
            else if (type === 'error') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2); }
        } catch (e) {}
    }, [soundOn, vibrateOn]);

    // --- DEAD CARD LOGIC (OTOMATIS) ---
    useEffect(() => {
        if (!board.length || winner !== null || isDealing) return;
        const isMyTurn = (appMode === 'offline-bot' && turn === 0) || (appMode === 'online-game' && turn === playerIndex);
        if (!isMyTurn) return;

        const myHand = hands[turn] || [];
        const deadCardIndices = [];

        myHand.forEach((card, idx) => {
            if (card.rank === 'J') return;
            let isDead = true;
            for(let r=0; r<10; r++) {
                for(let c=0; c<10; c++) {
                    const cell = board[r][c];
                    if (cell.rank === card.rank && cell.suit === card.suit && cell.chip === null) {
                        isDead = false; break;
                    }
                }
                if(!isDead) break;
            }
            if (isDead) deadCardIndices.push(idx);
        });

        if (deadCardIndices.length > 0) {
            setToast({sender: "SYSTEM", text: "Kartu Mati Dibuang & Diganti!", type: 'system'});
            playEffect('punch');
            
            const newHand = [...myHand];
            const newDeck = [...deck];
            for (let i = deadCardIndices.length - 1; i >= 0; i--) {
                const deadIdx = deadCardIndices[i];
                newHand.splice(deadIdx, 1);
                if (newDeck.length > 0) newHand.push(newDeck.shift());
            }

            setHands(prev => ({...prev, [turn]: newHand}));
            setDeck(newDeck);
            
            if (appMode === 'online-game') {
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), {
                    hands: JSON.stringify({...hands, [turn]: newHand}),
                    deck: JSON.stringify(newDeck)
                }).catch(console.error);
            }
        }
    }, [turn, board, hands, deck, winner, isDealing, appMode, playerIndex]);

    // --- TIMER ---
    useEffect(() => { if (!winner && (appMode === 'online-game' || appMode === 'offline-bot')) { const timer = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000); return () => clearInterval(timer); } }, [turn, winner, appMode]);
    useEffect(() => {
        if (!winner && timeLeft <= 0) {
            if (appMode === 'offline-bot') { setWinner(1); setMessage("Waktu Habis! Anda Kalah."); setTimeout(() => setShowGameOverModal(true), 3000); } 
            else if (appMode === 'online-game' && turn === playerIndex) { const opponentTeam = getTeam(turn) === 0 ? 1 : 0; updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), { winner: opponentTeam, chats: arrayUnion({ senderName: "WASIT", text: "Waktu habis! Giliran hangus.", senderIndex: -1 }) }).catch(console.error); }
        }
    }, [timeLeft, winner, appMode, turn, playerIndex, roomId]);

    // --- SYNC & COPY ---
    useEffect(() => {
        if (appMode !== 'online-game' && appMode !== 'online-share' || !roomId || !user) return;
        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), (snap) => {
            if (snap.exists()) {
                const data = snap.data(); setRoomDetails({ id: snap.id, ...data });
                if (appMode === 'online-share' && data.players?.length === data.maxPlayers) setAppMode('online-game');
                setBoard(safeParse(data.board, [])); setDeck(safeParse(data.deck, [])); setHands(safeParse(data.hands, {}));
                setTurn(data.turn); setWinner(data.winner); setLastMove(data.lastMove); setScores(data.scores || {0:0, 1:0}); 
                setWinningLines(safeParse(data.winningLines, [])); setScoredIds(new Set(safeParse(data.scoredIds, [])));
                if(data.playerNames) setPlayerNamesList(data.playerNames);
                const newChats = data.chats || []; if (newChats.length > chats.length && !showChat) setUnreadCount(prev => prev + 1); setChats(newChats);
                if (data.lastPlayedCard && appMode === 'online-game') {
                     if (data.turn === playerIndex && data.lastPlayedCard) { /* Visual Sync */ }
                }
                if (data.winner !== null) { setMessage("PERMAINAN SELESAI"); if (!showGameOverModal) setTimeout(() => setShowGameOverModal(true), 4000); } 
                else { const mover = data.playerNames?.[data.turn] || `P${data.turn+1}`; setMessage(data.turn === playerIndex ? "GILIRAN ANDA" : `GILIRAN ${mover.toUpperCase()}`); }
            } else { setAppMode('menu'); setToast({sender:"SYSTEM", text:"Room bubar.", type:'error'}); }
        }); return () => unsub();
    }, [appMode, roomId, user, showGameOverModal, chats.length]);

    const handleCopy = async (text, label) => {
        // Fallback robust copy mechanism
        try {
            await navigator.clipboard.writeText(text);
            setToast({sender:'SYSTEM', text: `${label} disalin!`, type:'system'});
        } catch (err) {
            const textArea = document.createElement("textarea"); textArea.value = text; textArea.style.position = "fixed"; textArea.style.left = "-9999px"; document.body.appendChild(textArea); textArea.focus(); textArea.select();
            try { document.execCommand('copy'); setToast({sender:'SYSTEM', text: `${label} disalin!`, type:'system'}); } 
            catch (e) { setToast({sender:'SYSTEM', text: 'Gagal menyalin manual', type:'error'}); }
            document.body.removeChild(textArea);
        }
        setTimeout(()=>setToast(null), 1500);
    };

    // --- CORE LOGIC ---
    const checkNeighbors = (boardState, r, c, team) => {
        const dirs = [[0,1], [1,0], [1,1], [1,-1]]; let maxSeq = 0;
        for(let d of dirs) {
            let count = 0; [1, -1].forEach(mult => { for(let k=1; k<5; k++) { const nr=r+(k*d[0]*mult), nc=c+(k*d[1]*mult); if(nr>=0 && nr<10 && nc>=0 && nc<10 && boardState[nr][nc]) { const cell = boardState[nr][nc]; if(cell.type === 'corner' || (cell.chip !== null && getTeam(cell.chip) === team)) count++; else break; } else break; } });
            if(count > maxSeq) maxSeq = count;
        } return maxSeq;
    };

    const checkNewSequences = (boardState, player, currentScoredIds) => {
        let newLines = [], newIds = [];
        const team = getTeam(player);
        const dirs = [[0,1], [1,0], [1,1], [1,-1]]; 
        const isOwner = (r, c) => { if (r<0 || r>=10 || c<0 || c>=10) return false; const cell = boardState[r][c]; return cell.type === 'corner' || (cell.chip !== null && getTeam(cell.chip) === team); };
        
        for(let r=0; r<10; r++) for(let c=0; c<10; c++) {
            if(!isOwner(r,c)) continue;
            for(let d of dirs) {
                let line = [];
                let potentialLine = [];
                for(let k=0; k<6; k++) { 
                     const nr=r+k*d[0], nc=c+k*d[1];
                     if(isOwner(nr, nc)) potentialLine.push({r:nr, c:nc}); else break;
                }

                // ATURAN KERAS: TEPAT 5 KARTU
                if(potentialLine.length === 5) {
                    const prevR = r - d[0], prevC = c - d[1];
                    const isPrevOwner = isOwner(prevR, prevC);
                    if (!isPrevOwner) {
                        line = potentialLine;
                        const id = `${line[0].r},${line[0].c}-${line[4].r},${line[4].c}`;
                        const idRev = `${line[4].r},${line[4].c}-${line[0].r},${line[0].c}`;
                        if(!currentScoredIds.has(id) && !currentScoredIds.has(idRev)) { newLines.push(line); newIds.push(id); }
                    }
                }
            }
        }
        return { newLines, newIds };
    };

    const filterOverlappingSequences = (newLines, newIds, existingWinningLines) => {
        const validIndices = new Set();
        newLines.forEach((lineA, idxA) => {
            let invalid = false;
            for (let hist of existingWinningLines) {
                const histLine = hist.line || hist; 
                let overlap = 0;
                lineA.forEach(pa => { if (histLine.some(pb => pb.r === pa.r && pb.c === pa.c)) overlap++; });
                if (overlap > 1) { invalid = true; break; }
            }
            if (!invalid) validIndices.add(idxA);
        });
        return { filteredLines: newLines.filter((_, i) => validIndices.has(i)), filteredIds: newIds.filter((_, i) => validIndices.has(i)) };
    };

    const executeMove = (r, c, remove, idx, moveType = 'normal') => {
        const newBoard = JSON.parse(JSON.stringify(board));
        if (remove) {
            const removedTeam = newBoard[r][c].chip;
            setGhostChips(prev => [...prev, { id: Date.now(), r, c, team: removedTeam, type: 'roll-out' }]);
            newBoard[r][c].chip = null; newBoard[r][c].isWild = false; playEffect('punch');
        } else {
            newBoard[r][c].chip = turn;
            newBoard[r][c].isWild = (moveType === 'wild');
            if(moveType==='wild') playEffect('wild'); else playEffect('move');
        }

        let newScores = {...scores}, newWinningLines = [...winningLines], team = getTeam(turn), hasWon = false;
        let currentScoredIds = scoredIds; 
        
        if (!remove) {
            const { newLines, newIds } = checkNewSequences(newBoard, turn, currentScoredIds);
            const { filteredLines, filteredIds } = filterOverlappingSequences(newLines, newIds, winningLines);

            if (filteredLines.length > 0) {
                newScores[team] += filteredLines.length; 
                newWinningLines = [...newWinningLines, ...filteredLines.map(line => ({ team, line }))];
                filteredIds.forEach(id => currentScoredIds.add(id));
                filteredLines.forEach(line => line.forEach(p => { 
                    if(newBoard[p.r][p.c].type !== 'corner') newBoard[p.r][p.c].locked = true; 
                }));
                playEffect('win');
                if (newScores[team] >= WINNING_SCORE) { 
                    setWinner(team); hasWon = true; setTimeout(() => setShowGameOverModal(true), 4000);
                }
            }
        }

        const newHand = [...hands[turn]]; const playedCard = newHand[idx]; newHand.splice(idx, 1);
        let newDeck = [...deck]; if (newDeck.length > 0) { const newCard = newDeck.shift(); if (newCard) newHand.push(newCard); }

        const isOpponentMove = (appMode === 'offline-bot' && turn === 1) || (appMode === 'online-game' && turn !== playerIndex);
        if (isOpponentMove) { setVisualPlayedCard(playedCard); setTimeout(() => setVisualPlayedCard(null), 2000); }

        const newHands = {...hands, [turn]: newHand};
        let nextTurn = (turn + 1) % maxPlayers;

        setBoard(newBoard); setHands(newHands); setDeck(newDeck); setTurn(nextTurn);
        setScores(newScores); setWinningLines(newWinningLines); setScoredIds(new Set(currentScoredIds)); 
        setSelectedCardIdx(null); setLastMove(remove ? null : {r,c, type: moveType}); setTimeLeft(TURN_DURATION);
        if (!hasWon) setMessage(appMode==='offline-bot' && nextTurn===1 ? "Komputer Mikir..." : `Giliran ${playerNamesList[nextTurn] || 'Lawan'}`);

        if (appMode === 'online-game') {
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), {
                board: JSON.stringify(newBoard), hands: JSON.stringify(newHands), deck: JSON.stringify(newDeck),
                turn: nextTurn, winner: hasWon ? team : null, lastMove: remove ? null : {r,c, type: moveType},
                scores: newScores, winningLines: JSON.stringify(newWinningLines), scoredIds: JSON.stringify(Array.from(currentScoredIds)), lastPlayedCard: playedCard
            }).catch(console.error);
        }
    };

    const botMove = (currBoard, currHand, currDeck) => {
        if (!currHand?.length) return; const moves = [];
        currHand.forEach((c, idx) => {
            for(let r=0; r<10; r++) for(let k=0; k<10; k++) {
                const cell = currBoard[r][k];
                if(cell.type === 'corner' || cell.locked) continue;
                if(c.rank === 'J') {
                    if(isTwoEyedJack(c.rank, c.suit) && !cell.chip) moves.push({r,c:k,idx, rm:false, type:'wild', score: 10});
                    if(isOneEyedJack(c.rank, c.suit) && cell.chip!==null && getTeam(cell.chip)===0) moves.push({r,c:k,idx, rm:true, type:'remove', score: 20});
                } else if (cell.rank===c.rank && cell.suit===c.suit && !cell.chip) {
                     const score = checkNeighbors(currBoard, r, k, 1) * 10 + Math.random();
                     moves.push({r,c:k,idx, rm:false, type:'normal', score});
                }
            }
        });
        if(moves.length > 0) { moves.sort((a,b) => b.score - a.score); executeMove(moves[0].r, moves[0].c, moves[0].rm, moves[0].idx, moves[0].type); } 
        else { const newHand = [...currHand]; newHand.shift(); if(currDeck.length) newHand.push(currDeck[0]); setHands(prev => ({...prev, 1: newHand})); setDeck(prev => prev.slice(1)); setTurn(0); setMessage("Bot Lewat Giliran"); }
    };

    useEffect(() => { if (appMode === 'offline-bot' && turn === 1 && !winner) { const t = setTimeout(() => botMove(board, hands[1], deck), 2000); return () => clearTimeout(t); } }, [turn, appMode, winner]);

    const handleBoardClick = useCallback((r, c) => {
        if (winner !== null) return;
        if (appMode === 'online-game' && turn !== playerIndex) { setToast({sender: "SYSTEM", text: "Tunggu giliran!", type: 'error'}); playEffect('error'); return; }
        if (selectedCardIdx === null) return;
        
        let currentHandIdx = appMode === 'online-game' ? playerIndex : turn;
        const myHand = hands[currentHandIdx] || [];
        const card = myHand[selectedCardIdx];
        const cell = board[r][c];
        if (!card || !cell) return;
        if (cell.type === 'corner') { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); playEffect('error'); return; }

        let valid = false, remove = false, moveType = 'normal'; const myTeam = getTeam(turn);

        if (card.rank === 'J') {
            if (isTwoEyedJack(card.rank, card.suit)) { 
                if(cell.chip === null) { valid = true; moveType = 'wild'; } else { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); playEffect('error'); return; }
            } else if (isOneEyedJack(card.rank, card.suit)) { 
                if(cell.chip !== null && getTeam(cell.chip) !== myTeam && !cell.locked) { valid=true; remove=true; moveType = 'remove'; } else { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); playEffect('error'); return; }
            }
        } else if (cell.rank === card.rank && cell.suit === card.suit) {
            if (cell.chip === null) valid = true; else { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); playEffect('error'); return; }
        }
        if (valid) executeMove(r, c, remove, selectedCardIdx, moveType); else { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); playEffect('error'); }
    }, [winner, appMode, turn, playerIndex, selectedCardIdx, hands, board]);

    const initGame = (mode, playerCount = 2) => {
        setAppMode('dealing'); setIsDealing(true);
        const d = createDeck(); 
        const b = REAL_BOARD_PATTERN.map((rowStr, r) => rowStr.map((cardStr, c) => { const coord = `${r},${c}`; if (cardStr === 'XX') return { type: 'corner', r, c, id: coord }; return { type: 'card', rank: cardStr.slice(0, -1), suit: cardStr.slice(-1), r, c, chip: null, locked: false, isWild: false, id: coord }; }));
        setTimeout(() => {
            setDeck(d); setBoard(b); 
            const h = {0: d.splice(0, 5), 1: d.splice(0, 5)}; if(playerCount === 4) { h[2] = d.splice(0, 5); h[3] = d.splice(0, 5); } else { h[2] = []; h[3] = []; }
            setHands(h); setTurn(0); setWinner(null); setChats([]); setAppMode(mode); setMaxPlayers(playerCount); setScores({0:0, 1:0}); setWinningLines([]); setScoredIds(new Set()); setTimeLeft(TURN_DURATION); setShowGameOverModal(false); setIsDealing(false);
            if(mode === 'offline-bot') { setPlayerNamesList({0: playerName, 1: `Robot (${botLevel === 'easy' ? 'Mudah' : botLevel === 'medium' ? 'Sedang' : 'Sulit'})`}); setChats([{senderName: "Bot", text: "Ayo main serius!"}]); }
        }, 3000);
    };

    const createRoom = async (pCount) => {
        if (!user || !isOnlineAvailable) return alert("Fitur Online membutuhkan konfigurasi Firebase. Pastikan Anda sudah mengatur 'YOUR_FIREBASE_CONFIG' di kode.");
        setLoadingText("Membuat Room..."); setAppMode('loading');
        try {
            const id = generateNumericId(); const d = createDeck();
            const b = REAL_BOARD_PATTERN.map((rowStr, r) => rowStr.map((cardStr, c) => { const coord = `${r},${c}`; if (cardStr === 'XX') return { type: 'corner', r, c, id: coord }; return { type: 'card', rank: cardStr.slice(0, -1), suit: cardStr.slice(-1), r, c, chip: null, locked: false, isWild: false, id: coord }; }));
            const h = {0: d.splice(0,5), 1: d.splice(0,5)}; if(pCount === 4) { h[2] = d.splice(0,5); h[3] = d.splice(0,5); }
            const roomData = { board: JSON.stringify(b), deck: JSON.stringify(d), hands: JSON.stringify(h), turn: 0, winner: null, chats: [], scores: {0:0, 1:0}, winningLines: '[]', scoredIds: '[]', players: [user.uid], maxPlayers: pCount, playerNames: {0: playerName}, createdAt: Date.now(), lastPlayedCard: null };
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id), roomData); setRoomId(id); setPlayerIndex(0); setMaxPlayers(pCount); setAppMode('online-share'); setRoomDetails({ id, maxPlayers: pCount, createdAt: roomData.createdAt, players: [user.uid] }); setShowGameOverModal(false);
        } catch(e) { console.error(e); alert("Gagal membuat room. Cek konsol."); setAppMode('menu'); }
    };
    const joinRoom = async (id) => { if (!user || !isOnlineAvailable) return alert("Fitur Online membutuhkan konfigurasi Firebase."); if (id.length !== 6 || isNaN(id)) return alert("Kode Room harus 6 digit."); try { const ref = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id); const snap = await getDoc(ref); if (snap.exists()) { const data = snap.data(); const cp = data.players || []; if (data.createdAt && (Date.now() - data.createdAt) > TIMEOUT_DURATION) { alert("Room kedaluwarsa."); return; } if (cp.length < data.maxPlayers) { let newIdx = -1; if(!cp.includes(user.uid)) { newIdx = cp.length; await updateDoc(ref, { players: arrayUnion(user.uid), [`playerNames.${newIdx}`]: playerName }); setPlayerIndex(newIdx); } else { setPlayerIndex(cp.indexOf(user.uid)); } setRoomId(id); setMaxPlayers(data.maxPlayers); setAppMode('online-game'); setShowGameOverModal(false); } else { alert("Room Penuh!"); } } else { alert("Room tidak ditemukan"); } } catch(e) { console.error(e); alert("Gagal Join."); } };
    const handleAskAI = async () => { if(isGeminiThinking) return; setIsGeminiThinking(true); setTimeout(() => { setChats(prev => [...prev, { senderName: "AI Coach", text: "Coba blokade baris lawan atau cari Jack Mata Dua!", senderIndex: -1 }]); setIsGeminiThinking(false); if(!showChat) setUnreadCount(p => p + 1); playEffect('chat'); }, 1500); };
    const sendChat = async (text) => { const cleanText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 50); const msg = { text: cleanText, senderIndex: playerIndex || 0, senderName: playerName }; if (appMode === 'online-game') { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), { chats: arrayUnion(msg) }); } else { setChats(prev => [...prev, msg]); setToast({ sender: playerName, text: cleanText, type: 'chat' }); setTimeout(() => setToast(null), 3000); } };
    const handleConfirmQuit = () => { setConfirmQuit(false); if (appMode === 'offline-bot') { setWinner(1); setMessage("Anda Mengakhiri Permainan."); setTimeout(() => setShowGameOverModal(true), 2000); } else if (appMode === 'online-game' && playerIndex !== null) { const userTeam = getTeam(playerIndex); const opponentTeam = userTeam === 0 ? 1 : 0; updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), { winner: opponentTeam, chats: arrayUnion({ senderName: "WASIT", text: `${playerName} menyerah.`, senderIndex: -1 }) }).then(() => { setAppMode('menu'); setRoomId(null); setPlayerIndex(null); }).catch(e => { console.error("Quit failed", e); setAppMode('menu'); }); } else { setAppMode('menu'); setRoomId(null); setPlayerIndex(null); } };

    const currentHand = hands[appMode === 'online-game' && playerIndex !== null ? playerIndex : 0] || [];
    let opponentHandCount = 5; if (appMode === 'online-game') { const oppIndex = playerIndex === 0 ? 1 : 0; opponentHandCount = hands[oppIndex] ? hands[oppIndex].length : 0; } else if (appMode === 'offline-bot') { opponentHandCount = hands[1] ? hands[1].length : 0; }

    if (appMode === 'tutorial') return ( <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans text-white select-none"> <div className="w-full max-w-md bg-[#111] p-8 rounded-3xl shadow-2xl border border-white/10 relative max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700"> <button onClick={()=>setAppMode('menu')} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors"><X/></button> <h2 className="text-2xl font-black text-white mb-6 tracking-tighter text-center border-b border-white/10 pb-4">PANDUAN BERMAIN</h2> <div className="space-y-6 text-sm text-zinc-300"> <div className="space-y-2"> <h3 className="font-bold text-amber-400 flex items-center gap-2"><Trophy size={16}/> TUJUAN PERMAINAN</h3> <p>Jadilah tim pertama yang membentuk <span className="text-white font-bold">2 GARIS (SEQUENCE)</span>.</p> </div> <div className="space-y-2"> <h3 className="font-bold text-blue-400 flex items-center gap-2"><Grid size={16}/> ATURAN KETAT</h3> <ul className="list-disc pl-5 space-y-1"> <li><span className="text-white font-bold">Pojok (Corner):</span> Dihitung sebagai wildcard.</li> <li><span className="text-white font-bold">Total 5:</span> Garis harus tepat 5 chip. Tidak boleh 6 atau lebih (Memanjang dilarang).</li> <li><span className="text-white font-bold">Kartu Mati:</span> Jika kartu tidak bisa dimainkan, otomatis diganti sistem.</li> </ul> </div> </div> <button onClick={()=>setAppMode('menu')} className="w-full mt-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all shadow-lg tracking-widest text-sm uppercase">Saya Mengerti</button> </div> </div> );
    if (appMode === 'menu') return ( <div className="min-h-screen bg-felt-pattern flex items-center justify-center p-4 font-sans text-white select-none relative overflow-hidden"> <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-80 pointer-events-none"></div> <div className="w-full max-w-sm bg-white/5 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-white/10 relative overflow-hidden group z-10"> <div className="absolute -top-32 -left-32 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] group-hover:bg-amber-500/20 transition-all duration-1000"></div> <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] group-hover:bg-blue-600/20 transition-all duration-1000"></div> <div className="relative z-10"> <h1 className="text-6xl font-black mb-1 text-center tracking-tighter drop-shadow-lg text-gradient-gold" style={{ fontFamily: 'Impact, sans-serif' }}>SEQUENCE</h1> <p className="text-zinc-500 text-xs mb-8 text-center font-mono tracking-[0.3em] uppercase border-b border-white/5 pb-4">Ultimate Edition</p> <div className="flex items-center justify-center gap-2 mb-8 text-emerald-400 bg-emerald-900/20 py-2 px-6 rounded-full border border-emerald-500/30 mx-auto w-fit shadow-[0_0_15px_rgba(16,185,129,0.15)]"> <ShieldCheck size={14}/> <span className="text-[10px] font-bold tracking-wider">SECURED SERVER</span> </div> <div className="flex items-center justify-between bg-[#0a0a0a]/50 p-4 rounded-2xl mb-6 border border-white/5 shadow-inner"> <div className="flex items-center gap-4"> <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-3.5 rounded-2xl shadow-lg border border-blue-400/30"><User size={20} className="text-white"/></div> <div><div className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Player ID</div><div className="font-bold text-white text-lg truncate max-w-[120px]">{playerName}</div></div> </div> <button onClick={()=>setAppMode('profile')} className="p-3.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"><Edit3 size={18}/></button> </div> <div className="space-y-4"> <div className="bg-[#0a0a0a]/50 p-4 rounded-2xl border border-white/5"> <div className="flex justify-between gap-2 mb-3"> {[{id:'easy', l:'Easy', c:'text-emerald-400'}, {id:'medium', l:'Medium', c:'text-amber-400'}, {id:'hard', l:'Hard', c:'text-rose-400'}].map(lvl => ( <button key={lvl.id} onClick={()=>setBotLevel(lvl.id)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${botLevel===lvl.id ? 'bg-white/10 border-white/30 text-white shadow-inner' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}> <span className={lvl.c}>{lvl.l}</span> </button> ))} </div> <button onClick={() => initGame('offline-bot')} className="w-full py-4 bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-900/50 hover:scale-[1.02] transition-all border border-blue-500/30 text-sm tracking-widest group-btn"> <Bot size={20} className="text-blue-200"/> <span>VS COMPUTER</span> </button> </div> <button onClick={() => setAppMode('online-setup')} className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-700 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-amber-900/50 hover:scale-[1.02] transition-all border border-amber-500/30 text-sm tracking-widest text-white"> <Users size={20} className="text-amber-200"/> <span>MULTIPLAYER</span> </button> <button onClick={() => setAppMode('tutorial')} className="w-full py-4 bg-zinc-800/80 hover:bg-zinc-700 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg border border-white/5 text-sm tracking-widest text-zinc-400 hover:text-white transition-all"> <BookOpen size={20}/> <span>CARA BERMAIN</span> </button> </div> </div> </div> </div> );
    if (appMode === 'profile') return ( <div className="min-h-screen bg-felt-pattern p-6 flex flex-col items-center justify-center text-white font-sans select-none"> <div className="bg-[#111] p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-white/10"> <h2 className="text-2xl font-black text-white mb-6 text-center tracking-tighter">UBAH PROFIL</h2> <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value.substring(0, 12))} className="w-full p-4 bg-black/50 rounded-xl border border-white/10 text-white font-bold mb-6 outline-none focus:border-amber-500 transition-colors text-center tracking-widest" placeholder="NAMA..."/> <button onClick={()=>setAppMode('menu')} className="w-full py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg border border-emerald-500/30 tracking-widest">SIMPAN</button> </div> </div> );
    if (appMode === 'online-setup') return (
        <div className="min-h-screen bg-felt-pattern flex items-center justify-center p-4 font-sans text-white select-none relative">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div className="w-full max-w-sm bg-[#111] p-8 rounded-[2rem] shadow-2xl border border-white/10 relative z-10">
                <button onClick={()=>setAppMode('menu')} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors"><X/></button>
                <h2 className="text-2xl font-black text-white mb-8 tracking-tighter text-center">MULTIPLAYER SETUP</h2>
                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 ml-1 flex items-center gap-2"><div className="w-1 h-1 bg-amber-500 rounded-full"></div> BUAT ROOM BARU</div>
                        <button onClick={() => createRoom(2)} className="w-full p-5 bg-gradient-to-br from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 rounded-2xl font-bold flex items-center gap-4 border border-white/5 shadow-lg group transition-all"> <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform"><User size={24}/></div> <div className="text-left"><div className="text-lg tracking-tight text-white">DUEL 1 VS 1</div><div className="text-[10px] text-zinc-500 font-mono">CLASSIC MODE</div></div> </button>
                        <button onClick={() => createRoom(4)} className="w-full p-5 bg-gradient-to-br from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 rounded-2xl font-bold flex items-center gap-4 border border-white/5 shadow-lg group transition-all"> <div className="bg-amber-500/20 p-3 rounded-xl text-amber-400 group-hover:scale-110 transition-transform"><Users size={24}/></div> <div className="text-left"><div className="text-lg tracking-tight text-white">TEAM 2 VS 2</div><div className="text-[10px] text-zinc-500 font-mono">CO-OP MODE</div></div> </button>
                    </div>
                    <div className="relative flex items-center justify-center py-2"> <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div> <span className="relative bg-[#111] px-4 text-xs text-zinc-500 font-mono">ATAU GABUNG</span> </div>
                    <div className="space-y-3">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={joinCodeInput || ''} onChange={(e) => setJoinCodeInput(e.target.value.replace(/[^0-9]/g, '').substring(0, 6))} placeholder="MASUKKAN KODE" maxLength={6} className="w-full p-4 bg-black rounded-xl border border-white/10 text-white font-black text-xl text-center outline-none tracking-[0.2em] placeholder:text-zinc-800 focus:border-amber-500 transition-colors"/>
                        <button onClick={() => joinRoom(joinCodeInput)} disabled={joinCodeInput.length !== 6} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 text-sm tracking-widest shadow-lg border border-white/5 transition-all ${joinCodeInput.length === 6 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}> <Activity size={18}/> GABUNG ROOM </button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (appMode === 'loading' || isDealing) return ( <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white font-bold select-none"> {isDealing && <DealingOverlay onComplete={() => setIsDealing(false)} />} {!isDealing && <Loader className="animate-spin mb-4 text-amber-500" size={48}/>} {!isDealing && <p className="text-xs tracking-[0.3em] animate-pulse text-zinc-500">{loadingText}</p>} </div> );
    if (appMode === 'online-share' && roomDetails) return ( <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans text-white select-none"> <div className="w-full max-w-sm bg-[#111] p-8 rounded-3xl shadow-2xl border border-amber-500/20 text-center relative overflow-hidden"> <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div> <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">LOBBY</h2> <p className="text-zinc-500 mb-6 text-xs font-mono uppercase">Bagikan akses ke lawan</p> <div className="bg-black p-6 rounded-2xl border border-white/10 shadow-inner mb-6 relative group"> <div className="text-5xl font-black tracking-[0.2em] text-amber-400 font-mono select-text mb-4 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">{roomDetails.id}</div> <div className="grid grid-cols-2 gap-3"> <button onClick={() => handleCopy(roomDetails.id, "Kode")} className="py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold hover:bg-zinc-700 transition-all shadow-lg border border-white/5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider"><Copy size={14} /> Copy Code</button> <button onClick={() => handleCopy(`${window.location.origin}?room=${roomDetails.id}`, "Link")} className="py-3 bg-blue-900/50 text-blue-200 rounded-xl font-bold hover:bg-blue-800/50 transition-all shadow-lg border border-blue-500/20 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider"><LinkIcon size={14} /> Copy Link</button> </div> </div> <button onClick={() => setAppMode('menu')} className="w-full py-4 bg-rose-900/20 text-rose-400 rounded-xl font-bold hover:bg-rose-900/40 transition-colors border border-rose-900/30 text-xs tracking-widest flex items-center justify-center gap-2"><LogOut size={16}/> BATALKAN</button> </div> </div> );

    const renderBoard = board.length ? board : [];
    return (
        <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col landscape:flex-row font-sans select-none overflow-hidden h-[100dvh] w-screen text-white">
            {visualPlayedCard && <OpponentPlayedCard card={visualPlayedCard} />}
            {toast && ( <div className="absolute bottom-52 right-4 landscape:bottom-20 landscape:left-4 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none"> <div className={`backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 ${toast.type==='error' ? 'bg-rose-900/80 border-rose-500/50 text-white' : toast.type==='system' ? 'bg-emerald-900/80 border-emerald-500/50 text-white' : 'bg-zinc-800/90 border-zinc-600 text-white'}`}> <div className={`p-2 rounded-full ${toast.type==='error'?'bg-rose-500':'bg-emerald-500'}`}> {toast.type==='error' ? <AlertTriangle size={16} className="text-white"/> : <CheckCircle size={16} className="text-white"/>} </div> <div> <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-0.5">{toast.sender}</div> <div className="text-sm font-bold leading-tight">{toast.text}</div> </div> </div> </div> )}
            {confirmQuit && ( <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm"> <div className="bg-[#111] p-8 rounded-3xl shadow-2xl max-w-xs w-full border border-rose-500/30 text-center animate-in zoom-in"> <div className="w-16 h-16 bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20"> <AlertTriangle size={32} className="text-rose-500"/> </div> <h3 className="text-xl font-black text-white mb-2 tracking-tight">KELUAR GAME?</h3> <p className="text-xs text-zinc-400 mb-8 leading-relaxed">Progres tidak akan disimpan dan Anda dianggap <span className="text-rose-400 font-bold">GUGUR</span>.</p> <div className="flex justify-between gap-3"> <button onClick={() => setConfirmQuit(false)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs tracking-wider border border-white/10">BATAL</button> <button onClick={handleConfirmQuit} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs tracking-wider shadow-lg shadow-rose-900/20">KELUAR</button> </div> </div> </div> )}
            {ghostChips.map(g => <div key={g.id} className="absolute z-50 pointer-events-none" style={{ left: `calc(${(g.c * 10) + 5}% - 3vmin)`, top: `calc(${(g.r * 10) + 5}% - 3vmin)`, width: '6vmin', height: '6vmin' }}><GhostChip team={g.team} type={g.type} onComplete={() => setGhostChips(prev => prev.filter(p => p.id !== g.id))} /></div>)}
            <div className="shrink-0 flex flex-col w-full landscape:w-72 landscape:h-full landscape:border-r landscape:border-b-0 border-b border-white/10 bg-[#0f0f0f] z-20 shadow-xl relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent landscape:w-[2px] landscape:h-full landscape:bg-gradient-to-b"></div>
                <header className="h-16 flex landscape:flex-col landscape:h-auto landscape:py-6 justify-between items-center px-4 bg-[#0f0f0f]">
                    <div className="flex items-center gap-3 landscape:flex-col landscape:w-full"> <button onClick={() => setConfirmQuit(true)} className="p-2.5 bg-zinc-900 rounded-xl text-rose-500 hover:bg-rose-900/20 border border-white/5 transition-colors"><LogOut size={18}/></button> <div className="flex gap-2 landscape:flex-col landscape:w-full landscape:items-center"> <div className="flex gap-2"> <button onClick={() => setSoundOn(!soundOn)} className={`p-2.5 rounded-xl transition-all border ${soundOn ? 'bg-zinc-900 text-zinc-400 border-white/5' : 'bg-rose-900/20 text-rose-500 border-rose-500/30'}`}>{soundOn ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button> <button onClick={() => setVibrateOn(!vibrateOn)} className={`p-2.5 rounded-xl transition-all border ${vibrateOn ? 'bg-zinc-900 text-zinc-400 border-white/5' : 'bg-rose-900/20 text-rose-500 border-rose-500/30'}`}>{vibrateOn ? <Smartphone size={18}/> : <Smartphone size={18} className="opacity-50"/>}</button> </div> </div> </div>
                    <div className="flex flex-col items-center my-0 landscape:my-6 w-full"> <div className="flex items-center justify-between w-full max-w-[200px] bg-[#050505] p-1 rounded-2xl border border-white/10 shadow-inner relative overflow-hidden"> <div className={`flex-1 py-2 rounded-xl text-center relative z-10 transition-all duration-500 ${turn===playerIndex && getTeam(playerIndex)===0 ? 'bg-blue-900/20' : ''}`}> <div className="text-[8px] font-black text-blue-400 tracking-widest mb-0.5">BLUE</div> <div className="text-2xl font-black text-white leading-none drop-shadow-md">{scores[0]}</div> </div> <div className="text-zinc-700 font-black text-xs px-1 italic">VS</div> <div className={`flex-1 py-2 rounded-xl text-center relative z-10 transition-all duration-500 ${turn===playerIndex && getTeam(playerIndex)===1 ? 'bg-rose-900/20' : ''}`}> <div className="text-[8px] font-black text-rose-400 tracking-widest mb-0.5">RED</div> <div className="text-2xl font-black text-white leading-none drop-shadow-md">{scores[1]}</div> </div> </div> <div className="text-[9px] text-zinc-500 mt-2 uppercase tracking-[0.2em] font-bold flex items-center gap-2"> <Trophy size={10} className="text-amber-500"/> Target: <span className="text-amber-500">{WINNING_SCORE}</span> Lines </div> </div>
                    <div className="flex items-center gap-2 landscape:flex-col landscape:w-full"> <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black text-white flex justify-center items-center gap-2 w-full border shadow-lg transition-all duration-500 ${getTeam(turn) === 0 ? 'bg-blue-600 border-blue-400/50 shadow-blue-900/20' : 'bg-rose-600 border-rose-400/50 shadow-rose-900/20'}`}> <Clock size={12}/> {formatTime(timeLeft)} </div> {appMode === 'online-game' && <button onClick={()=>alert('Syncing...')} className="p-2 bg-zinc-900 rounded-lg text-amber-500 hover:text-white border border-white/5"><RefreshCw size={16}/></button>} </div>
                </header>
                <div className="bg-[#161616] backdrop-blur-md text-center py-2 px-4 border-t landscape:border-t-0 landscape:border-b border-white/5 flex justify-between items-center shrink-0 landscape:flex-col landscape:gap-3 landscape:py-4 landscape:flex-1">
                     {/* LOGIKA ROOM ID: HANYA MUNCUL JIKA MODE ONLINE GAME */}
                     {appMode === 'online-game' ? (
                        <div className="flex flex-col items-start landscape:items-center">
                            <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">ROOM ID</div>
                            <div className="text-xs font-bold text-zinc-300">{roomId}</div>
                        </div>
                     ) : (
                        // Placeholder kosong agar layout tetap rapi saat offline
                        <div className="flex flex-col items-start landscape:items-center w-[50px]"></div>
                     )}

                     <div className="flex flex-col items-center justify-center w-full px-2"> <div className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 animate-pulse truncate max-w-[150px] tracking-wide">{message}</div> </div> 
                     <div className="flex flex-col items-end landscape:items-center"> <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">PLAYER</div> <div className="text-xs font-bold text-zinc-300 truncate max-w-[80px]">{playerName}</div> </div> 
                </div>
            </div>
            <main className="flex-1 relative overflow-auto bg-felt-pattern touch-pan-x touch-pan-y flex flex-col items-center justify-center p-4 lg:p-8 shadow-inner">
                 <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.1),rgba(0,0,0,0.8)_90%)]"></div>
                 <div className="mb-4 shrink-0 relative z-20"> <div className="text-[9px] text-center text-zinc-500 font-mono uppercase tracking-[0.2em] mb-1">LAWAN</div> <OpponentHand count={opponentHandCount} /> </div>
                 <div className="relative shrink-0 shadow-[0_20px_60px_rgba(0,0,0,0.9)] rounded-xl overflow-hidden bg-[#0a0a0a] select-none my-auto border-[12px] border-[#1e1e1e] ring-1 ring-white/10" style={{ width: 'min(75vmin, 500px)', minWidth: '300px', aspectRatio: '1/1' }}>
                    <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"> {winningLines.map((item, idx) => { const line = item.line || item; const color = (item.team === undefined) ? '#2563eb' : (item.team === 0 ? '#3b82f6' : '#f43f5e'); if (!Array.isArray(line)) return null; const x1 = line[0].c * 10 + 5, y1 = line[0].r * 10 + 5, x2 = line[4].c * 10 + 5, y2 = line[4].r * 10 + 5; return ( <React.Fragment key={idx}> <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="4" strokeLinecap="round" className="opacity-50 blur-sm" /> <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1" strokeLinecap="round" className="opacity-80" strokeDasharray="2,2" /> </React.Fragment> ); })} </svg>
                    <div className="grid grid-cols-10 w-full h-full gap-[1px] bg-[#1f1f1f] border-2 border-[#1f1f1f]">
                        {renderBoard.map((row, r) => row.map((cell, c) => {
                            let highlight = false, target = false;
                            if (selectedCardIdx !== null && !winner && ((appMode==='online-game' && turn===playerIndex) || (appMode!=='online-game' && turn===0))) {
                                const card = currentHand[selectedCardIdx]; const myTeam = getTeam(turn);
                                if (card) {
                                    if (card.rank === 'J') {
                                        if (isTwoEyedJack(card.rank, card.suit)) { if (!cell.chip && cell.type!=='corner') highlight = true; } 
                                        else if (isOneEyedJack(card.rank, card.suit)) { if (cell.chip!==null && getTeam(cell.chip)!==myTeam && !cell.locked) target = true; }
                                    } else if (cell.rank === card.rank && cell.suit === card.suit) { if (!cell.chip) highlight = true; }
                                }
                            }
                            return <BoardCell key={cell.id} cell={cell} isHighlight={highlight} isTarget={target} isLast={lastMove?.r===r && lastMove?.c===c} lastMoveType={lastMove?.type} isOccupiedError={errorCell?.r===r && errorCell?.c===c} onClick={handleBoardClick} />;
                        }))}
                    </div>
                 </div>
            </main>
            <div className="shrink-0 bg-[#0f0f0f]/95 backdrop-blur-xl border-t landscape:border-t-0 landscape:border-l border-white/10 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] landscape:w-28 landscape:h-full landscape:flex landscape:flex-col landscape:overflow-y-auto pb-safe">
                <div className="flex justify-between px-4 py-2 items-center landscape:flex-col landscape:gap-2 landscape:py-4"> <span className="text-[9px] font-black text-zinc-500 tracking-[0.2em] uppercase landscape:writing-vertical landscape:rotate-180">YOUR HAND</span> <div className="bg-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">{currentHand.length}</div> </div>
                <div className="flex landscape:flex-col gap-3 overflow-x-auto landscape:overflow-x-hidden landscape:overflow-y-auto px-4 pb-6 landscape:pb-4 min-h-[110px] landscape:min-h-0 landscape:h-full scrollbar-hide justify-start sm:justify-center items-end landscape:items-center w-full"> {currentHand.map((card, i) => <HandCard key={i} card={card} selected={selectedCardIdx === i} disabled={winner !== null || ((appMode==='online-game' && turn!==playerIndex) || (appMode!=='online-game' && turn!==0))} onClick={() => { if(winner || ((appMode==='online-game' && turn!==playerIndex) || (appMode!=='online-game' && turn!==0))) return; setSelectedCardIdx(i === selectedCardIdx ? null : i); playEffect('move'); }} />)} </div>
            </div>
            <button onPointerDown={() => setShowChat(!showChat)} className="absolute bottom-40 right-4 landscape:bottom-6 landscape:left-6 z-40 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center transition-transform active:scale-90 border border-white/20 hover:bg-indigo-500 touch-manipulation group"> <MessageSquare size={20} className="group-hover:scale-110 transition-transform"/> {unreadCount > 0 && <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0a0a0a]">{unreadCount}</div>} </button>
            {showChat && ( <div className="absolute bottom-56 right-4 landscape:bottom-24 landscape:left-6 w-72 bg-[#161616]/95 backdrop-blur-md rounded-2xl shadow-2xl z-50 p-4 animate-in slide-in-from-bottom-10 border border-white/10 flex flex-col"> <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2"> <span className="text-xs font-bold text-zinc-300 tracking-wider">LIVE CHAT</span> <button onClick={()=>setShowChat(false)} className="text-zinc-500 hover:text-white"><X size={14}/></button> </div> <div className="h-40 overflow-y-auto text-xs space-y-2 mb-3 pr-1 scrollbar-thin scrollbar-thumb-zinc-700"> {chats.map((c, i) => ( <div key={i} className={`p-2 rounded-lg max-w-[90%] mb-1 text-[11px] leading-relaxed ${c.senderIndex===(appMode==='online-game'?playerIndex:0) ? 'bg-blue-900/40 text-blue-100 ml-auto text-right border border-blue-500/20' : c.senderIndex===-1 ? 'bg-purple-900/20 text-purple-200 border border-purple-500/20 text-center text-[10px] italic' : 'bg-zinc-800 text-zinc-300 border border-white/5'}`}> {c.senderIndex !== -1 && <span className="font-bold block text-[9px] text-zinc-500 mb-0.5 uppercase">{c.senderName || 'Pemain'}</span>} {c.text} </div> ))} </div> <button onClick={handleAskAI} disabled={isGeminiThinking} className="w-full mb-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all"> {isGeminiThinking ? <Loader size={12} className="animate-spin"/> : <Sparkles size={12}/>} ASK AI STRATEGY </button> <div className="grid grid-cols-6 gap-1"> {EMOJIS.map((e, i) => <button key={i} onClick={() => sendChat(e)} className="text-sm hover:bg-white/10 rounded p-1.5 transition-colors">{e}</button>)} </div> </div> )}
            {showGameOverModal && winner !== null && ( 
                <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-xl animate-in zoom-in duration-500"> 
                    <div className="bg-black border border-amber-500/30 p-10 rounded-[2rem] text-center w-full max-w-md shadow-[0_0_60px_rgba(245,158,11,0.2)] relative overflow-hidden group"> 
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent opacity-50"></div> 
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden pointer-events-none"> 
                            <div className="absolute top-0 left-1/4 w-2 h-2 bg-amber-500 rounded-full animate-ping"></div> 
                            <div className="absolute top-10 right-1/4 w-2 h-2 bg-blue-500 rounded-full animate-ping delay-300"></div> 
                        </div> 
                        <div className="relative z-10"> 
                            <Trophy size={80} className={`mx-auto mb-6 drop-shadow-[0_0_25px_rgba(245,158,11,0.6)] ${winner===0?'text-blue-400':'text-rose-500'} animate-bounce`}/> 
                            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 mb-2 tracking-tighter">VICTORY</h2> 
                            <div className={`text-lg font-bold mb-8 uppercase tracking-[0.3em] py-2 border-y border-white/10 ${winner===0?'text-blue-400':'text-rose-500'}`}> 
                                {winner === 0 ? 'BLUE TEAM WINS' : 'RED TEAM WINS'} 
                            </div> 
                            <div className="flex justify-center items-end gap-8 mb-8"> 
                                <div className="flex flex-col items-center"> 
                                    <div className="text-4xl font-black text-blue-500 drop-shadow-lg">{scores[0]}</div> 
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase mt-2">BLUE</div> 
                                </div> 
                                <div className="text-2xl font-black text-white/20">VS</div> 
                                <div className="flex flex-col items-center"> 
                                    <div className="text-4xl font-black text-rose-500 drop-shadow-lg">{scores[1]}</div> 
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase mt-2">RED</div> 
                                </div> 
                            </div> 
                            <button onClick={() => setAppMode('menu')} className="w-full py-4 bg-white text-black rounded-xl font-black hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 active:scale-95 tracking-widest text-sm"> 
                                <RotateCcw size={18}/> PLAY AGAIN 
                            </button> 
                        </div> 
                    </div> 
                </div> 
            )} {/* PENUTUP MODAL GAGAL */}
        </div>
    );
}

export default function SequenceGame() { return <ErrorBoundary><SequenceGameInternal /></ErrorBoundary>; }
