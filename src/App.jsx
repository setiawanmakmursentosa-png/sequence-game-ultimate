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
    ['2♦', '6♥', '10♦', 'K♥', '3♥', '2♥', '7♥', '8♣', '10♠', '10♣'], 
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
    const [scoredIds, setScoredIds] = useState(new Set()); 
    const [playerName, setPlayerName] = useState("Player 1");
    const [playerNamesList, setPlayerNamesList] = useState({});
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
                try { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token); else await signInAnonymously(auth); } catch (e) { console.error("Auth:", e); }
            }
        }; init();
        if (isOnlineAvailable && auth) return onAuthStateChanged(auth, (u) => setUser(u || null)); else setUser({uid: 'offline-user', isAnonymous: true});
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
        if (!user || !isOnlineAvailable) return alert("Fitur Online membutu
