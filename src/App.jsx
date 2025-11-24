import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import { 
  RotateCcw, Trophy, X, Users, Bot, 
  Volume2, VolumeX, Clock, Vibrator, Smartphone,
  ShieldCheck, Loader, MessageCircle, Send, Smile,
  User, CheckCircle, WifiOff, Edit3, BookOpen, Crown, Ban, Lock, Copy,
  LogOut, Play, AlertOctagon, HelpCircle, Flame, Sword, Diamond,
  Brain, Zap, Shield, Heart, Aperture, MessageSquareText
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

/**
 * ============================================================================
 * KONFIGURASI DEPLOYMENT
 * ============================================================================
 * * CATATAN PENTING: Untuk deployment ke Netlify/GitHub, Anda HARUS 
 * MENGISI YOUR_FIREBASE_CONFIG di file OneFile.jsx (jika ada) 
 * atau di sini jika Anda hanya menggunakan file ini.
 * Saya mengosongkannya di sini untuk mencegah kebocoran kunci default.
 */
const YOUR_FIREBASE_CONFIG = null; // Diisi di file OneFile.jsx/Environment Variables

// --- UTILITAS ---
const safeParse = (jsonString, fallbackValue) => {
    if (!jsonString) return fallbackValue;
    try {
        const result = JSON.parse(jsonString);
        return result === null ? fallbackValue : result;
    } catch (e) { return fallbackValue; }
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Game Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center z-[9999]">
          <WifiOff size={64} className="text-amber-500 mb-4 animate-pulse"/>
          <h2 className="2xl font-black text-amber-400 mb-2 tracking-widest">GANGGUAN SISTEM</h2>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-6 px-8 py-3 bg-amber-600 rounded-full font-bold">RESET GAME</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- KONFIGURASI GAME ---
const WINNING_SCORE = 3; 
const TURN_DURATION = 300; // 5 Menit
const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K', 'A'];
const CARD_BACK_URL = "https://deckofcardsapi.com/static/img/back.png";
const EMOJIS = ["🔥", "😂", "😎", "😡", "😭", "🤔", "👎", "👍", "🐌", "👻", "🤝", "GG", "👑"];

// Avatar Emoji Baru (20 Karakter)
const ALL_AVATARS = [
    { icon: "🤠", label: "Koboi Lucu" },
    { icon: "🐻‍❄️", label: "Beruang Kutub Santai" },
    { icon: "🐸", label: "Kodok Senyum" },
    { icon: "🤖", label: "Robot Mengedip" },
    { icon: "🧑‍🚀", label: "Astronot Bingung" },
    { icon: "👴", label: "Kakek Tertawa" },
    { icon: "👨‍🦰", label: "Ayah Keren" },
    { icon: "🦹‍♂️", label: "Penjahat Konyol" },
    { icon: "🐉", label: "Naga Mini" },
    { icon: "🐒", label: "Monyet Nakal" },
    { icon: "👸", label: "Putri Gembira" },
    { icon: "👩‍🔬", label: "Ilmuwan Bersemangat" },
    { icon: "👵", label: "Nenek Bijak" },
    { icon: "👩‍🍳", label: "Ibu Koki" },
    { icon: "🦄", label: "Unicorn Fantasi" },
    { icon: "🧜‍♀️", label: "Putri Duyung Ceria" },
    { icon: "👩‍🎤", label: "Penyanyi Pop" },
    { icon: "🐰", label: "Kelinci Manis" },
    { icon: "👽", label: "Alien Cantik" },
    { icon: "🦉", label: "Burung Hantu Pintar" },
];

// --- FIREBASE SETUP ---
let app, auth, db;
let isOnlineAvailable = false;
let isCustomConfig = false;

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'sequence-game-prod';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_'); 

try {
  // Cek jika menggunakan konfigurasi Canvas/Environment
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isOnlineAvailable = true;
    isCustomConfig = false;
  }
  // Cek jika menggunakan konfigurasi statis (seperti di Netlify/GitHub)
  else if (YOUR_FIREBASE_CONFIG && YOUR_FIREBASE_CONFIG.projectId) {
    const firebaseConfig = YOUR_FIREBASE_CONFIG;
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isOnlineAvailable = true;
    isCustomConfig = true;
  } 
} catch (e) { console.error("Firebase Init Error:", e); }

// --- DATA PAPAN ---
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
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    }
    return deck;
};

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    // Format selalu M:SS
    return `${minutes.toString().padStart(1, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const generateNumericId = () => Math.floor(100000 + Math.random() * 900000).toString();

const getRoomRef = (roomIdStr) => {
    // Gunakan koleksi 'rooms' jika menggunakan konfigurasi statis/kustom (Netlify/GitHub)
    if (isCustomConfig || typeof __firebase_config === 'undefined') return doc(db, 'rooms', roomIdStr);
    // Gunakan jalur Canvas jika menggunakan variabel __app_id
    return doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomIdStr);
};

// --- UTILITY UNTUK LOGIKA GAME (DIPINDAHKAN KELUAR KOMPONEN AGAR DAPAT DIAKSES OLEH BOT) ---
const checkNeighbors = (boardState, r, c, team) => {
    const dirs = [[0,1], [1,0], [1,1], [1,-1]]; let maxSeq = 0;
    for(let d of dirs) {
        let count = 0; 
        [1, -1].forEach(mult => { 
            for(let k=1; k<5; k++) { 
                const nr=r+(k*d[0]*mult), nc=c+(k*d[1]*mult); 
                if(nr>=0 && nr<10 && nc>=0 && nc<10 && boardState[nr][nc]) { 
                    const cell = boardState[nr][nc]; 
                    if(cell.type === 'corner' || (cell.chip !== null && getTeam(cell.chip) === team)) count++; 
                    else break; 
                } else break; 
            } 
        });
        if(count > maxSeq) maxSeq = count;
    } 
    return maxSeq;
};
// --- END UTILITY ---


// --- KOMPONEN VISUAL ---
const CardFallback = ({ rank, suit }) => (
    <div className="w-full h-full bg-[#f1f5f9] flex flex-col items-center justify-center border border-slate-300 rounded-md select-none relative shadow-sm">
        <span className={`text-[10px] sm:text-xs font-black ${['♥','♦'].includes(suit)?'text-red-600':'text-slate-900'}`}>{rank}</span>
        <span className="text-xs sm:text-sm">{suit}</span>
    </div>
);

const DealingOverlay = ({ onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 3000);
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
        // Diposisikan ulang agar tidak menutupi papan besar
        <div className="absolute top-[20%] right-[30%] z-[100] pointer-events-none" style={{ perspective: '1000px' }}>
            <div className="w-24 sm:w-32 aspect-[2/3] bg-white rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border-2 border-amber-400 origin-center animate-opponent-play">
                 <img src={imgUrl} className="w-full h-full object-contain p-1" alt="" />
                 <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-4 py-1 rounded-full text-[10px] font-black tracking-widest whitespace-nowrap border border-white/20 shadow-lg">
                    LAWAN
                 </div>
            </div>
        </div>
    );
};

const ChipContent = React.memo(({ rank, suit, isWild, locked }) => {
    if (isWild) {
        return <Crown size={14} className="text-amber-200 drop-shadow-sm" />;
    }
    if (!rank || !suit) return null;
    const isRed = ['♥', '♦'].includes(suit);
    return (
        <div className={`flex flex-col items-center justify-center leading-none ${isRed ? 'text-red-100' : 'text-blue-100'}`}>
            <span className="text-[10px] font-black">{rank}</span>
            <span className="text-[10px]">{suit}</span>
            {locked && <Lock size={8} className="text-white/90 drop-shadow-md absolute -top-1 -right-1" />}
        </div>
    );
});

// --- KOMPONEN CHAT ---
const EmojiPicker = ({ onSelect }) => (
    <div className="absolute bottom-12 right-0 w-48 bg-zinc-800/95 backdrop-blur-sm border border-white/10 p-2 rounded-xl shadow-xl z-50 animate-drop-in">
        <div className="grid grid-cols-5 gap-1">
            {EMOJIS.map((emoji, i) => (
                <button 
                    key={i} 
                    onClick={() => onSelect(emoji)} 
                    className="text-lg p-1 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                    {emoji}
                </button>
            ))}
        </div>
    </div>
);

const ChatOverlay = ({ isOpen, onClose, chats, onSend, myName }) => {
    const [text, setText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef(null);
    
    useEffect(() => {
        if(isOpen && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [chats, isOpen]);

    if (!isOpen) return null;

    const handleSelectEmoji = (emoji) => {
        setText(prev => prev + emoji);
        setShowEmojiPicker(false);
    };
    
    const handleSend = () => {
        if(text.trim()) { 
            onSend(text); 
            setText("");
            setShowEmojiPicker(false);
        }
    }

    return (
        // Posisikan di sudut kanan atas area permainan, menjauh dari hand card
        <div className="fixed top-1/2 right-4 -translate-y-1/2 z-[90] w-72 h-80 bg-[#1e293b]/95 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col shadow-2xl animate-drop-in origin-right">
            <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20 rounded-t-2xl">
                <span className="text-xs font-bold text-amber-500 flex items-center gap-2"><MessageCircle size={14}/> LIVE CHAT</span>
                <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white"/></button>
            </div>
            <div className="flex-grow overflow-y-auto p-3 space-y-2 scrollbar-hide">
                {chats.length === 0 && <p className="text-[10px] text-zinc-500 text-center italic mt-10">Belum ada pesan. Mulai ejekan!</p>}
                {chats.map((c, i) => (
                    <div key={i} className={`flex flex-col ${c.senderName === myName ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[10px] font-bold ${c.senderName === 'SYSTEM' ? 'bg-zinc-700 text-zinc-300 w-full text-center' : (c.senderName === myName ? 'bg-amber-600 text-white rounded-br-none' : 'bg-slate-700 text-white rounded-bl-none')}`}>
                            {c.senderName !== myName && c.senderName !== 'SYSTEM' && <span className="block text-[8px] text-zinc-400 mb-[1px]">{c.senderName}</span>}
                            {c.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-white/5 flex gap-2 relative">
                <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded-lg"
                >
                    <Smile size={14} />
                </button>
                {showEmojiPicker && <EmojiPicker onSelect={handleSelectEmoji} />}

                <input 
                    value={text} 
                    onChange={e=>setText(e.target.value)}
                    onKeyDown={e => {if(e.key === 'Enter' && text.trim()) { handleSend(); }}}
                    className="flex-grow bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ketik pesan..."
                />
                <button onClick={handleSend} className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg"><Send size={14}/></button>
            </div>
        </div>
    );
};

const BoardCell = React.memo(({ cell, isHighlight, isTarget, isLast, lastMoveType, isOccupiedError, animatingOut, onClick, isWinningChip }) => {
    const [imgError, setImgError] = useState(false);
    const imgUrl = useMemo(() => getCardImageUrl(cell.rank, cell.suit), [cell.rank, cell.suit]);
    
    if (cell.type === 'corner') {
        return (
            <div className="relative w-full h-full border-[0.5px] border-white/5 overflow-hidden bg-[#0a0a0a] flex items-center justify-center group shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(245,158,11,0.1)_1px,transparent_1px)] bg-[length:4px_4px] opacity-30"></div>
                <Crown size={14} className="text-amber-500/60 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"/>
            </div>
        );
    }
    
    const isDropping = isLast && lastMoveType === 'wild' && !animatingOut;
    // Locked chips visualnya ada ring kecil
    const lockedVisual = cell.locked ? "ring-2 ring-black/80" : "hover:brightness-110"; 

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
            
            {isTarget && <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center z-20"><AlertOctagon className="text-yellow-600 w-5 h-5 drop-shadow-md animate-bounce"/></div>}
            
            {isOccupiedError && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 animate-pulse">
                    <Ban className="text-rose-500 w-8 h-8 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]"/>
                </div>
            )}
            
            {cell.chip !== null && (
                <div className={`absolute w-[80%] h-[80%] rounded-full z-20 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.7)] border-[2px] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
                    ${getTeam(cell.chip) === 0 
                        ? 'bg-gradient-to-br from-blue-600 to-blue-900 border-blue-400/80 shadow-blue-900/50' 
                        : 'bg-gradient-to-br from-rose-600 to-rose-900 border-rose-400/80 shadow-rose-900/50'}
                    ${isLast && !isDropping && !animatingOut ? 'scale-110 ring-2 ring-amber-300 ring-offset-1 ring-offset-black' : ''}
                    ${isDropping ? 'animate-drop-in' : ''}
                    ${animatingOut ? 'animate-chip-out opacity-0' : ''}
                `}>
                    <div className="w-[85%] h-[85%] rounded-full border border-white/20 bg-black/20 flex items-center justify-center backdrop-blur-sm relative">
                        <ChipContent rank={cell.chipRank} suit={cell.chipSuit} isWild={cell.isWild} locked={cell.locked} />
                    </div>
                </div>
            )}
        </div>
    );
}, (prev, next) => prev.cell === next.cell && prev.isHighlight === next.isHighlight && prev.isTarget === next.isTarget && prev.isLast === next.isLast && prev.lastMoveType === next.lastMoveType && prev.isOccupiedError === next.isOccupiedError && prev.animatingOut === next.animatingOut && prev.isWinningChip === next.isWinningChip);

const HandCard = React.memo(({ card, selected, disabled, onClick }) => {
    if (!card) return <div className="w-14 sm:w-16 lg:w-20 aspect-[2/3] flex-shrink-0 opacity-0"></div>;
    const imgUrl = getCardImageUrl(card.rank, card.suit);
    let label = null, labelColor = '';
    if (card.rank === 'J') {
        if (isTwoEyedJack(card.rank, card.suit)) { label = "WILD"; labelColor = "bg-emerald-600"; } 
        else { label = "BUANG"; labelColor = "bg-rose-600"; }
    }
    // Ukuran kartu di HP: Lebih kecil, tetapi cukup besar untuk disentuh.
    const cardSizeClass = "w-14 sm:w-16 lg:w-20"; 
    
    return (
        <div onClick={onClick} className={`relative ${cardSizeClass} aspect-[2/3] flex-shrink-0 bg-white rounded-lg shadow-lg border border-slate-200 cursor-pointer transition-all select-none duration-200 transform will-change-transform
            ${selected ? '-translate-y-2 sm:-translate-y-6 ring-2 ring-amber-400 z-30 shadow-[0_0_25px_rgba(251,191,36,0.5)] scale-110' : ''} 
            ${disabled ? 'opacity-50 grayscale brightness-90 cursor-not-allowed' : 'hover:-translate-y-1 sm:hover:-translate-y-3 hover:shadow-xl hover:brightness-105'}
        `}>
            <img src={imgUrl} onError={(e)=>e.target.src=''} className="w-full h-full object-contain p-1 rounded-lg" loading="lazy" alt="" />
            {label && <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-[2px] text-[7px] font-black text-white tracking-wider text-center rounded-full ${labelColor} shadow-md whitespace-nowrap z-10 border border-white/50`}>{label}</div>}
        </div>
    );
});

const LogoFourCards = () => (
    <div className="flex justify-center -space-x-4 mb-4 scale-110">
        <div className="w-10 h-14 bg-white rounded border border-slate-300 shadow-lg rotate-[-15deg] flex items-center justify-center text-xl text-black">♠</div>
        <div className="w-10 h-14 bg-white rounded border border-slate-300 shadow-lg rotate-[-5deg] flex items-center justify-center text-xl text-red-600">♥</div>
        <div className="w-10 h-14 bg-white rounded border border-slate-300 shadow-lg rotate-[5deg] flex items-center justify-center text-xl text-black">♣</div>
        <div className="w-10 h-14 bg-white rounded border border-slate-300 shadow-lg rotate-[15deg] flex items-center justify-center text-xl text-red-600">♦</div>
    </div>
);

// --- KOMPONEN LATAR BELAKANG MENU ---
const MenuBackgroundEffect = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large Translucent Card Shadow */}
        <div className="absolute -top-10 -left-10 opacity-[0.05] rotate-[-25deg] scale-150">
            <div className="w-52 h-80 bg-white/20 rounded-2xl shadow-2xl flex items-center justify-center">
                 <span className="text-9xl text-amber-500 opacity-70">A♠</span>
            </div>
        </div>
        {/* Large Translucent Chip Shadow (Blue Team) */}
        <div className="absolute -bottom-20 -right-20 opacity-[0.08] rotate-[15deg] scale-[2.0]">
             <div className="w-40 h-40 rounded-full bg-blue-500/50 flex items-center justify-center">
                 <Trophy size={80} className="text-blue-200/50"/>
             </div>
        </div>
         {/* Large Translucent Chip Shadow (Red Team) */}
        <div className="absolute bottom-10 -left-16 opacity-[0.08] rotate-[-5deg] scale-[1.5]">
             <div className="w-32 h-32 rounded-full bg-rose-500/50 flex items-center justify-center">
                 <Diamond size={60} className="text-rose-200/50"/>
             </div>
        </div>
    </div>
);

// --- ICON PLAYSTATION (Custom SVG) ---
const PlayStationIcon = ({ size = 20, className = "text-white" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        className={className} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        {/* Circle (O) */}
        <circle cx="75" cy="25" r="18" fill="none" stroke="currentColor" /> 
        {/* Cross (X) */}
        <path d="M 57 50 L 43 50 M 50 57 L 50 43" strokeWidth="10" stroke="currentColor" /> 
        {/* Triangle (Steak) */}
        <path d="M 25 75 L 40 45 L 55 75 Z" fill="none" strokeWidth="10" stroke="currentColor" /> 
        {/* Square (Kotak) */}
        <rect x="65" y="65" width="20" height="20" rx="4" fill="none" strokeWidth="10" stroke="currentColor" /> 
        
        {/* Lingkaran pusat yang disamarkan (Steak) */}
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" opacity="0.1" /> 
        
        {/* Memposisikan ulang ikon agar lebih terlihat seperti bentuk PlayStation */}
        <g transform="translate(-20, 0)">
            {/* Cross (X) */}
            <path d="M 60 70 L 80 90 M 60 90 L 80 70" strokeWidth="6" stroke="currentColor" /> 
            {/* Circle (O) */}
            <circle cx="70" cy="80" r="8" fill="none" stroke="currentColor" strokeWidth="6" /> 
        </g>
        <g transform="translate(-40, -15)">
            {/* Triangle (Steak) */}
            <path d="M 30 20 L 55 45 L 30 70 Z" fill="none" strokeWidth="6" stroke="currentColor" /> 
        </g>
        <g transform="translate(10, 10)">
            {/* Square (Kotak) */}
            <rect x="25" y="25" width="20" height="20" rx="4" fill="none" strokeWidth="6" stroke="currentColor" /> 
        </g>
        
    </svg>
);


// --- KOMPONEN MODAL INFORMASI GAME (Baru) ---
const GameInfoModal = ({ onClose }) => (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-white/20 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-drop-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                    <MessageSquareText size={20}/> INFORMASI GAME
                </h3>
                <button onClick={onClose}><X size={20} className="text-zinc-400"/></button>
            </div>
            
            <div className="bg-zinc-800/50 p-4 rounded-xl mb-6 border border-amber-500/30">
                <h4 className="text-lg font-extrabold text-amber-300 mb-2">Makna Bermain Sequence:</h4>
                <p className="text-sm text-zinc-300 italic leading-relaxed">
                    Bermain Sequence adalah tentang **strategi, antisipasi, dan komunikasi tim**. Ini bukan hanya soal kartu yang Anda miliki, tetapi bagaimana Anda **membaca papan** (board reading) untuk menghambat lawan dan membuka jalan kemenangan bagi tim Anda. Setiap penempatan chip adalah keputusan yang menantang akal dan persahabatan!
                </p>
            </div>

            <h4 className="text-lg font-bold text-white mb-3">Panduan Aturan Singkat:</h4>
            <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
                <p><strong>Tujuan:</strong> Buat **3 baris** (sequence) yang terdiri dari 5 chip warna Anda.</p>
                <p><strong>Kartu Jack:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                    <li><span className="text-rose-400 font-bold">Jack Dua Mata:</span> Wild Card (Taruh di mana saja). **Tidak bisa menimpa chip (sudah terisi)**.</li>
                    <li><span className="text-rose-400 font-bold">Jack Satu Mata:</span> Remove (Buang chip lawan yang **BELUM terkunci**).</li>
                </ul>
                <p><strong>Kunci (Lock) & Simpang:</strong> Baris yang sudah jadi terkunci **permanen**. Anda hanya boleh menggunakan **satu chip non-corner** yang terkunci (locked) dari tim Anda sebagai simpang untuk membuat baris baru. Chip sudut selalu dapat digunakan.</p>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-700 text-center">
                <p className="text-[10px] text-zinc-500 mb-1">Dibuat dengan 🔥 oleh:</p>
                <p className="text-sm font-black text-amber-400">KARYA SETIAWAN</p>
                <p className="text-xs text-rose-300 mt-2">
                    Jangan lupa mampir di tempat makan <span className="font-bold">Ayam Bakar Spesial Bibir By WKA</span>!
                </p>
            </div>
        </div>
    </div>
);

// --- KOMPONEN MODAL PILIH BOT ---
const BotSelectModal = ({ botMessages, onSelect, onClose }) => (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-amber-500/50 p-1 rounded-2xl w-full max-w-sm animate-drop-in shadow-[0_0_50px_rgba(245,158,11,0.3)]">
            <div className="bg-[#111] rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20"><Brain size={100} className="text-amber-500"/></div>
                <h3 className="text-xl font-black text-white mb-1 uppercase tracking-wider relative z-10">Tingkat Kesulitan</h3>
                <p className="text-zinc-400 text-xs mb-6 relative z-10">Pilih level otak robot Anda.</p>
                <div className="space-y-3 relative z-10">
                    {Object.entries(botMessages).map(([key, value]) => (
                        <button 
                            key={key} 
                            onClick={() => onSelect(key)} 
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 rounded-lg font-black uppercase tracking-widest text-sm transition-all border border-indigo-400/30 flex items-center justify-between px-4 group"
                        >
                           <span>{key === 'easy' ? 'MUDAH' : key === 'medium' ? 'SEDANG' : 'SULIT'}</span> 
                           <span className="text-indigo-200 flex items-center gap-1">
                               <value.icon size={18} className="text-indigo-300 group-hover:scale-110 transition-transform"/>
                               <span className="text-xs font-normal italic opacity-80">{value.quote.split('!')[0]}</span>
                           </span>
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-6 w-full py-2 text-zinc-500 text-xs font-bold hover:text-white transition-colors">KEMBALI</button>
            </div>
        </div>
    </div>
);

// --- KOMPONEN MODAL SELEKSI PROFIL ---
const ProfileSelectorModal = ({ currentName, currentAvatar, onSave, onClose }) => {
    const [name, setName] = useState(currentName);
    const [avatar, setAvatar] = useState(currentAvatar || ALL_AVATARS[0].icon); // Menggunakan icon sebagai nilai default
    
    const handleSave = () => {
        if (name.trim()) onSave(name, avatar);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-drop-in">
                <h3 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><Edit3 size={20}/> Edit Profil Pemain</h3>
                
                <div className="flex items-center gap-4 mb-6">
                    {/* Main Avatar Display (Emoji) */}
                    <div className="flex items-center justify-center w-16 h-16 rounded-full ring-4 ring-amber-500/50 bg-white/10">
                        <span className="text-3xl" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{avatar}</span>
                    </div>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="flex-grow bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-bold tracking-wide" 
                        placeholder="Nama Pemain"
                    />
                </div>
                
                <h4 className="text-sm font-bold text-zinc-300 mb-3">Pilih Karakter Favoritmu (Total 20):</h4>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-3 h-48 overflow-y-auto p-2 bg-black/30 rounded-xl">
                    {ALL_AVATARS.map((a, i) => (
                        <button 
                            key={i} 
                            onClick={() => setAvatar(a.icon)} // Simpan ikon emoji sebagai state
                            className={`p-1 rounded-lg transition-all ${avatar === a.icon ? 'ring-2 ring-emerald-500 scale-105 shadow-lg' : 'hover:bg-zinc-700/50'}`}
                        >
                            {/* Grid Item Avatar Display (Emoji) */}
                            <div className="flex items-center justify-center w-full aspect-square rounded-full object-cover border border-white/10 bg-black/20">
                                <span className="text-xl">{a.icon}</span>
                            </div>
                            <p className="text-[8px] mt-1 text-zinc-400">{a.label}</p>
                        </button>
                    ))}
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold text-white transition-colors">BATAL</button>
                    <button onClick={handleSave} disabled={!name.trim()} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold text-white transition-colors disabled:opacity-50">SIMPAN</button>
                </div>
            </div>
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
    const [showForfeitModal, setShowForfeitModal] = useState(false); 
    const [lastMove, setLastMove] = useState(null);
    const [chats, setChats] = useState([]);
    const [showChat, setShowChat] = useState(false);
    const [toast, setToast] = useState(null);
    const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
    const [soundMode, setSoundMode] = useState('sound'); 
    const [selectedCardIdx, setSelectedCardIdx] = useState(null);
    const [message, setMessage] = useState("");
    const [scores, setScores] = useState({0:0, 1:0});
    const [winningLines, setWinningLines] = useState([]); 
    const [scoredIds, setScoredIds] = new useState(new Set()); 
    const [playerName, setPlayerName] = useState("Player 1");
    const [playerAvatar, setPlayerAvatar] = useState(ALL_AVATARS[0].icon); // State Avatar: Ganti ke ikon emoji
    const [playerNamesList, setPlayerNamesList] = useState({});
    const [playerAvatarsList, setPlayerAvatarsList] = useState({}); // State Avatars List
    const [loadingText, setLoadingText] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [errorCell, setErrorCell] = useState(null); 
    const [roomDetails, setRoomDetails] = useState(null); 
    const [joinCodeInput, setJoinCodeInput] = useState(''); 
    const [isDealing, setIsDealing] = useState(false);
    const [visualPlayedCard, setVisualPlayedCard] = useState(null);
    const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0); // Tracking skip berturut-turut
    
    const [showInfoModal, setShowInfoModal] = useState(false); 
    const [showBotSelectModal, setShowBotSelectModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false); 
    const [animatingOutCells, setAnimatingOutCells] = new useState(new Set()); 

    const audioCtxRef = useRef(null);
    
    const botMessages = useMemo(() => ({
        easy: { icon: Heart, quote: "Jangan remehkan! Latihlah ketelitian Anda." },
        medium: { icon: Shield, quote: "Tantangan baru menanti. Fokus pada strategi dasar!" },
        hard: { icon: Zap, quote: "Siap-siap, otak robot ini tidak akan memberi ampun. Buktikan yang terbaik!" },
    }), []);

    // --- STYLE INJECTION ---
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes chipOut { 
                0% { transform: scale(1) rotate(0deg); opacity: 1; } 
                30% { transform: scale(1.2) rotate(10deg); opacity: 0.8; }
                100% { transform: scale(0.5) translateY(-50px) rotate(-90deg); opacity: 0; } 
            }
            .animate-chip-out { animation: chipOut 1.5s ease-out forwards; }
            @keyframes dropIn { 0% { transform: translateY(-300%) scale(1.5); opacity: 0; } 60% { transform: translateY(10%) scale(1); opacity: 1; } 80% { transform: translateY(-5%); } 100% { transform: translateY(0); } }
            .animate-drop-in { animation: dropIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
            @keyframes dealCard { 0% { transform: translate(0,0) scale(0.1); opacity: 0; } 50% { transform: translate(0,0) scale(1.2); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; } }
            @keyframes opponentSidePlay { 0% { transform: scale(0.5) translateY(50px); opacity: 0; } 20% { transform: scale(1.2) translateY(0); opacity: 1; } 80% { transform: scale(1) translateY(0); opacity: 1; } 100% { transform: scale(0.8) translateY(-50px); opacity: 0; } }
            .animate-opponent-play { animation: opponentSidePlay 2.5s ease-in-out forwards; }
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            .text-gradient-gold { background: linear-gradient(to bottom, #fcd34d, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            
            /* Perubahan warna untuk tampilan lebih terang/enak dipandang: Azure Blue Theme */
            .bg-felt-pattern { 
                background-color: #154360; /* Vibrant Azure Blue Base (Darker side of bright blue) */
                background-image: radial-gradient(#275F90 1px, transparent 1px); 
                background-size: 20px 20px; 
            }
            .bg-board-base { background-color: #275F90; } /* Medium Azure Blue, latar belakang papan */

            /* Animasi Piala Game Over */
            @keyframes trophySpin {
                0% { transform: translateY(-50px) rotate(0deg) scale(0.5); opacity: 0; } 
                50% { transform: translateY(0) rotate(360deg) scale(1.1); opacity: 1; }
                100% { transform: translateY(0) rotate(360deg) scale(1); opacity: 1; }
            }
            .animate-trophy-spin { animation: trophySpin 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

            /* SVG Lines Style */
            .winning-line { 
                stroke-dasharray: 200; 
                stroke-dashoffset: 200; 
                animation: drawLine 1s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
                filter: drop-shadow(0 0 8px rgba(0,0,0,0.8)); 
                z-index: 50;
            }
            @keyframes drawLine { to { stroke-dashoffset: 0; } }
            
            /* Confetti style for Game Over */
            .confetti {
                position: absolute;
                width: 10px;
                height: 10px;
                background-color: #fff;
                opacity: 0;
                animation: fall 3s ease-in infinite;
            }

            @keyframes fall {
                0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        return () => { if(document.head.contains(style)) document.head.removeChild(style); };
    }, []);

    // --- AUTH ---
    useEffect(() => {
        const init = async () => {
            if (isOnlineAvailable && auth) {
                try { 
                    if (isCustomConfig || typeof __firebase_config === 'undefined') {
                        // Jika menggunakan konfigurasi statis (Netlify), sign-in anonymous.
                        await signInAnonymously(auth);
                    }
                    else if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        // Jika di Canvas, gunakan token kustom
                        await signInWithCustomToken(auth, __initial_auth_token); 
                    }
                    else {
                        // Fallback aman untuk Canvas
                        await signInAnonymously(auth); 
                    }
                } catch (e) { console.error("Auth Sign-In Error (Initial):", e); }
            } else {
                 // Fallback untuk mode offline/dev tanpa Firebase
                 setUser({uid: 'offline-user', isAnonymous: true});
            }
        }; 
        init();
        if (isOnlineAvailable && auth) {
             const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
             return () => unsub();
        } 
    }, []);

    const playEffect = useCallback((type) => {
        if (soundMode === 'silent') return;
        if (soundMode === 'vibrate') { if (navigator.vibrate) navigator.vibrate(50); return; }
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            const ctx = audioCtxRef.current; const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
            if (type === 'win') { osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, now); osc.frequency.linearRampToValueAtTime(783.99, now + 0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1); osc.start(now); osc.stop(now + 1); }
            else if (type === 'move') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2); }
            else if (type === 'punch') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(50, now + 0.8); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8); osc.start(now); osc.stop(now + 0.8); }
            else if (type === 'wild') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5); osc.start(now); osc.stop(now + 0.5); }
            else if (type === 'error') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2); }
        } catch (e) {}
    }, [soundMode]);

    // --- DEAD CARD Logic ---
    useEffect(() => {
        if (!board.length || winner !== null || isDealing) return;
        const isMyTurn = (appMode === 'offline-bot' && turn === 0) || (appMode === 'online-game' && turn === playerIndex);
        if (!isMyTurn) return;

        const myHand = hands[turn] || [];
        const deadCardIndices = [];

        myHand.forEach((card, idx) => {
            if (card.rank === 'J') return;
            let isDead = true;
            for(let r=0; r<10; r++) for(let c=0; c<10; c++) {
                const cell = board[r][c];
                // KARTU MATI: Hanya jika SEMUA posisi kartu di papan sudah terisi chip (chip !== null)
                if (cell.rank === card.rank && cell.suit === card.suit && cell.chip === null) { isDead = false; break; }
            }
            if (isDead) deadCardIndices.push(idx);
        });

        if (deadCardIndices.length > 0) {
            playEffect('punch');
            const newHand = [...myHand]; const newDeck = [...deck];
            for (let i = deadCardIndices.length - 1; i >= 0; i--) {
                newHand.splice(deadCardIndices[i], 1);
                // Tambahkan kartu baru hanya jika dek tidak kosong
                if (newDeck.length > 0) newHand.push(newDeck.shift());
            }
            
            // Perbarui state lokal dan Firestore
            const updatedHands = {...hands, [turn]: newHand};
            setHands(updatedHands); 
            setDeck(newDeck);
            
            if (appMode === 'online-game') {
                updateDoc(getRoomRef(roomId), { 
                    hands: JSON.stringify(updatedHands), 
                    deck: JSON.stringify(newDeck),
                    // Tidak mengubah giliran/waktu karena ini adalah aksi Dead Card, bukan move
                }).catch(console.error);
            }
        }
    }, [turn, board, hands, deck, winner, isDealing, appMode, playerIndex, roomId, playEffect]);

    // --- GAME OVER DELAY EFFECT ---
    useEffect(() => {
        if (winner !== null && !showGameOverModal) {
            // Jeda 3 detik agar pemain bisa melihat papan dan garis kemenangan
            const timer = setTimeout(() => {
                setShowGameOverModal(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [winner, showGameOverModal]);

    // --- TIMER DAN GUGUR LOGIC (2x Timeout = Forfeit) ---
    useEffect(() => { 
        // Timer hanya berjalan jika bukan mode menu, tidak ada pemenang, dan bukan giliran lawan (jika bot)
        const isTimerRunning = !winner && (appMode === 'online-game' || (appMode === 'offline-bot' && turn === 0));

        if (isTimerRunning) { 
            const timer = setInterval(() => {
                setTimeLeft(p => {
                    if (p > 0) return p - 1;
                    
                    // Waktu Habis - Pindahkan Giliran
                    clearInterval(timer); // Hentikan timer
                    
                    if (appMode === 'offline-bot' || (appMode === 'online-game' && turn === playerIndex)) {
                        // Jika sudah 2 kali timeout berturut-turut, GUGUR
                        if (consecutiveTimeouts >= 1) {
                            const opponentTeam = getTeam(turn) === 0 ? 1 : 0;
                            const forfeitMessage = `Waktu habis 2x! Pemain ${playerNamesList[turn] || 'Anda'} GUGUR.`;
                            
                            if (appMode === 'online-game') {
                                // PENTING: Update skor dan pemenang ke Firestore (Security Rules harus mengizinkan Host/Admin)
                                updateDoc(getRoomRef(roomId), { 
                                    winner: opponentTeam, 
                                    chats: arrayUnion({ senderName: "WASIT", text: forfeitMessage, senderIndex: -1 }) 
                                }).catch(console.error);
                            }
                            setWinner(opponentTeam); // Menetapkan pemenang
                            setConsecutiveTimeouts(0);
                            setMessage(forfeitMessage);
                            return 0;
                        }

                        // Timeout pertama/kedua - Lompati giliran
                        const nextTurn = (turn + 1) % maxPlayers;
                        const skipMessage = `Waktu habis! Giliran ${playerNamesList[turn] || 'Anda'} hangus.`;
                        
                        if (appMode === 'online-game') {
                             updateDoc(getRoomRef(roomId), { 
                                turn: nextTurn, 
                                consecutiveTimeouts: consecutiveTimeouts + 1,
                                timeLeft: TURN_DURATION,
                                chats: arrayUnion({ senderName: "WASIT", text: skipMessage, senderIndex: -1 }) 
                             }).catch(console.error);
                        } else {
                            setTurn(nextTurn);
                            setConsecutiveTimeouts(consecutiveTimeouts + 1);
                            setTimeLeft(TURN_DURATION);
                            setMessage(skipMessage);
                        }
                    }
                    return 0;
                });
            }, 1000); 
            return () => clearInterval(timer); 
        } else {
            // Jika bukan giliran Anda (Bot atau lawan Online), pastikan timer tidak jalan
            const isOpponentTurn = appMode === 'offline-bot' && turn === 1;
            if (isOpponentTurn) setTimeLeft(TURN_DURATION); // Freeze timer 5:00
        }
    }, [turn, winner, appMode, playerIndex, consecutiveTimeouts, maxPlayers, roomId, playerNamesList]);


    // --- SYNC ---
    useEffect(() => {
        if (!isOnlineAvailable || (appMode !== 'online-game' && appMode !== 'online-share') || !roomId || !user) return;
        
        const unsub = onSnapshot(getRoomRef(roomId), (snap) => {
            if (snap.exists()) {
                const data = snap.data(); 
                setRoomDetails({ id: snap.id, ...data });
                if (appMode === 'online-share' && data.players?.length === data.maxPlayers) setAppMode('online-game');
                
                // DATA GAME
                setBoard(safeParse(data.board, [])); setDeck(safeParse(data.deck, [])); setHands(safeParse(data.hands, {}));
                setTurn(data.turn); setWinner(data.winner); setLastMove(data.lastMove); setScores(data.scores || {0:0, 1:0}); 
                setWinningLines(safeParse(data.winningLines, [])); setScoredIds(new Set(safeParse(data.scoredIds, [])));
                
                // DATA PEMAIN & TIMER
                if(data.playerNames) setPlayerNamesList(data.playerNames);
                if(data.playerAvatars) setPlayerAvatarsList(data.playerAvatars); // Ambil Avatars
                if(data.consecutiveTimeouts !== undefined) setConsecutiveTimeouts(data.consecutiveTimeouts); // Ambil Timeout Count
                
                // JANGAN UPDATE timeLeft DARI FIRESTORE, biarkan timer berjalan lokal.
                // setTimeLeft(data.timeLeft || TURN_DURATION); 

                const newChats = data.chats || []; if (newChats.length > chats.length && !showChat) setUnreadCount(prev => prev + 1); setChats(newChats);
                
                if (data.lastPlayedCard && appMode === 'online-game') {
                     if (data.turn === playerIndex) { }
                     else { setVisualPlayedCard(data.lastPlayedCard); setTimeout(()=>setVisualPlayedCard(null), 2500); }
                }
                
                if (data.winner !== null) { 
                    setMessage("PERMAINAN SELESAI"); 
                } 
                else { const mover = data.playerNames?.[data.turn] || `P${data.turn+1}`; setMessage(data.turn === playerIndex ? "GILIRAN ANDA" : `GILIRAN ${mover.toUpperCase()}`); }
            } else { setAppMode('menu'); setToast({sender:"SYSTEM", text:"Room bubar.", type:'error'}); }
        }); return () => unsub();
    }, [appMode, roomId, user, showGameOverModal, chats.length, showChat, playerIndex, roomDetails?.players?.length]);

    // --- LOGIKA CEK SEQUENCE MUTLAK (STRICT INTERSECTION & EXTENSION) ---
    const checkNewSequences = (boardState, player, currentScoredIds, existingWinningLines) => {
        let newLines = [], newIds = []; 
        const team = getTeam(player); 
        const dirs = [[0,1], [1,0], [1,1], [1,-1]]; 
        
        // Cek apakah cell milik tim (atau sudut)
        const isOwner = (r, c) => { 
            if (r<0 || r>=10 || c<0 || c>=10) return false; 
            const cell = boardState[r][c]; 
            return cell.type === 'corner' || (cell.chip !== null && getTeam(cell.chip) === team); 
        };

        // Kumpulkan semua titik chip yang SUDAH TERKUNCI (locked) milik tim ini.
        const lockedPoints = new Set();
        existingWinningLines.filter(l => getTeam(l.team) === team).forEach(l => {
            l.line.forEach(p => {
                const cell = boardState[p.r][p.c];
                // HANYA chip non-corner yang terkunci (locked chip) yang diperhitungkan sebagai simpang/perpanjangan.
                if (cell.type !== 'corner' && cell.locked) {
                    lockedPoints.add(`${p.r},${p.c}`);
                }
            });
        });

        for(let r=0; r<10; r++) {
            for(let c=0; c<10; c++) {
                if(!isOwner(r,c)) continue;
                
                for(let d of dirs) {
                    let potentialLine = [];
                    for(let k=0; k<5; k++) { 
                        const nr=r+k*d[0], nc=c+k*d[1]; 
                        if(isOwner(nr, nc)) potentialLine.push({r:nr, c:nc}); else break; 
                    }

                    if(potentialLine.length === 5) {
                        const safeId = `${potentialLine[0].r},${potentialLine[0].c}-${potentialLine[4].r},${potentialLine[4].c}`;
                        const safeIdRev = `${potentialLine[4].r},${potentialLine[4].c}-${potentialLine[0].r},${potentialLine[0].c}`;
                        
                        if(!currentScoredIds.has(safeId) && !currentScoredIds.has(safeIdRev)) {
                            
                            let sharedLockedChipCount = 0;
                            potentialLine.forEach(p => {
                                const coord = `${p.r},${p.c}`;
                                if (lockedPoints.has(coord)) {
                                    sharedLockedChipCount++;
                                }
                            });

                            if (sharedLockedChipCount <= 1) {
                                newLines.push(potentialLine);
                                newIds.push(safeId);
                            } 
                        }
                    }
                }
            }
        } 
        return { newLines, newIds };
    };

    const executeMove = (r, c, remove, idx, moveType = 'normal', cardUsed = null) => {
        if (remove) {
            setAnimatingOutCells(prev => new Set(prev).add(`${r},${c}`));
            playEffect('punch');

            setTimeout(() => {
                const newBoard = JSON.parse(JSON.stringify(board));
                // Pastikan chip yang dihapus memang chip lawan
                if (newBoard[r][c].chip !== null && getTeam(newBoard[r][c].chip) !== getTeam(turn) && !newBoard[r][c].locked) {
                    newBoard[r][c].chip = null; 
                    newBoard[r][c].isWild = false;
                    newBoard[r][c].chipRank = null;
                    newBoard[r][c].chipSuit = null;
                    finalizeMove(newBoard, r, c, remove, idx, moveType);
                } else {
                    console.error("DEBUG: Coba hapus chip tidak valid.");
                    setToast({sender:'SYS', text:'Gagal menghapus! (Chip terkunci/bukan lawan)', type:'error'});
                }
                setAnimatingOutCells(prev => {
                    const next = new Set(prev);
                    next.delete(`${r},${c}`);
                    return next;
                });
            }, 600); 
        } else {
             const newBoard = JSON.parse(JSON.stringify(board));
             // Pastikan kotak kosong sebelum menempatkan
             if (newBoard[r][c].chip === null) {
                 newBoard[r][c].chip = turn; newBoard[r][c].isWild = (moveType === 'wild');
                 if (cardUsed) {
                     newBoard[r][c].chipRank = cardUsed.rank;
                     newBoard[r][c].chipSuit = cardUsed.suit;
                 }
                 if(moveType==='wild') playEffect('wild'); else playEffect('move');
                 finalizeMove(newBoard, r, c, remove, idx, moveType);
             } else {
                 console.error("DEBUG: Coba menempatkan di kotak terisi.");
                 setToast({sender:'SYS', text:'Kotak sudah terisi!', type:'error'});
                 // Jangan lanjutkan move jika validasi gagal di sini.
             }
        }
    };

    const resetGameState = () => {
        setRoomId(null);
        setPlayerIndex(null);
        setMaxPlayers(2);
        setBoard([]);
        setDeck([]);
        setHands({0:[], 1:[], 2:[], 3:[]});
        setTurn(0);
        setWinner(null);
        setShowGameOverModal(false);
        setLastMove(null);
        setChats([]);
        setShowChat(false);
        setScores({0:0, 1:0});
        setWinningLines([]);
        setScoredIds(new Set());
        setLoadingText("");
        setUnreadCount(0);
        setErrorCell(null);
        setRoomDetails(null);
        setJoinCodeInput('');
        setIsDealing(false);
        setVisualPlayedCard(null);
        setAnimatingOutCells(new Set());
        setConsecutiveTimeouts(0); // Reset timeouts
        setTimeLeft(TURN_DURATION); // Reset timer
    };


    const finalizeMove = (newBoard, r, c, remove, idx, moveType) => {
        let newScores = {...scores}, newWinningLines = [...winningLines], team = getTeam(turn), hasWon = false;
        let currentScoredIds = scoredIds; 
        
        // Reset consecutive timeouts on a successful move
        setConsecutiveTimeouts(0); 

        if (!remove) {
            const { newLines, newIds } = checkNewSequences(newBoard, turn, currentScoredIds, newWinningLines);
            
            if (newLines.length > 0) {
                // Perhitungan skor yang aman (tidak bisa dimanipulasi klien)
                const scoreIncrease = newLines.length;
                newScores[team] += scoreIncrease; 
                newWinningLines = [...newWinningLines, ...newLines.map(line => ({ team, line }))];
                newIds.forEach(id => currentScoredIds.add(id));
                
                // KUNCI CHIP (LOCK) PERMANEN
                newLines.forEach(line => line.forEach(p => { 
                    if(newBoard[p.r][p.c].type !== 'corner') {
                        newBoard[p.r][c].locked = true; 
                    }
                }));
                
                playEffect('win');
                if (newScores[team] >= WINNING_SCORE) { 
                    setWinner(team); 
                    hasWon = true; 
                }
            }
        }

        const newHand = [...hands[turn]]; const playedCard = newHand[idx]; newHand.splice(idx, 1);
        let newDeck = [...deck]; if (newDeck.length > 0) { const newCard = newDeck.shift(); if (newCard) newHand.push(newCard); }
        const newHands = {...hands, [turn]: newHand};
        let nextTurn = (turn + 1) % maxPlayers;

        setBoard(newBoard); setHands(newHands); setDeck(newDeck); setTurn(nextTurn);
        setScores(newScores); setWinningLines(newWinningLines); setScoredIds(new Set(currentScoredIds)); 
        setSelectedCardIdx(null); setLastMove(remove ? null : {r,c, type: moveType}); setTimeLeft(TURN_DURATION);
        if (!hasWon) setMessage(appMode==='offline-bot' && nextTurn===1 ? "Komputer Mikir..." : `Giliran ${playerNamesList[nextTurn] || 'Lawan'}`);

        if (appMode === 'online-game') {
            // Update ke Firestore - Security Rules harus memverifikasi bahwa perubahan board/turn/hands sah
            updateDoc(getRoomRef(roomId), {
                board: JSON.stringify(newBoard), 
                hands: JSON.stringify(newHands), 
                deck: JSON.stringify(newDeck),
                turn: nextTurn, 
                // PENTING: Skor/Pemenang harus diverifikasi/dihitung ulang di sisi server (jika menggunakan Cloud Functions)
                // Namun, karena hanya menggunakan Firestore Rules, kita mengandalkan Aturan untuk memblokir perubahan yang tidak sah.
                winner: hasWon ? team : null, 
                scores: newScores, 
                lastMove: remove ? null : {r,c, type: moveType},
                winningLines: JSON.stringify(newWinningLines), 
                scoredIds: JSON.stringify(Array.from(currentScoredIds)), 
                lastPlayedCard: playedCard,
                consecutiveTimeouts: 0, // Reset di Firestore juga
            }).catch(e => {
                 console.error("FIREBASE UPDATE ERROR:", e);
                 setToast({sender:'SYS', text:'Gagal sinkronisasi ke server! Cek koneksi/Rules.', type:'error'});
            });
        }
    }

    const botMove = (currBoard, currHand, currDeck) => {
        if (!currHand?.length) return; const moves = [];
        currHand.forEach((c, idx) => {
            for(let r=0; r<10; r++) for(let k=0; k<10; k++) {
                const cell = currBoard[r][k];
                if(cell.type === 'corner' || cell.locked) continue;
                if(c.rank === 'J') {
                    if(isTwoEyedJack(c.rank, c.suit) && !cell.chip) moves.push({r,c:k,idx, rm:false, type:'wild', score: 10, card: c});
                    if(isOneEyedJack(c.rank, c.suit) && cell.chip!==null && getTeam(cell.chip)===0 && !cell.locked) moves.push({r,c:k,idx, rm:true, type:'remove', score: 20, card: c});
                } else if (cell.rank===c.rank && cell.suit===c.suit && !cell.chip) {
                     const score = checkNeighbors(currBoard, r, k, 1) * 10 + Math.random();
                     moves.push({r,c:k,idx, rm:false, type:'normal', score, card: c});
                }
            }
        });
        if(moves.length > 0) { moves.sort((a,b) => b.score - a.score); executeMove(moves[0].r, moves[0].c, moves[0].rm, moves[0].idx, moves[0].type, moves[0].card); } 
        else { 
            // Bot Timeout Logic (simulasi skip)
            const newTurn = (turn + 1) % maxPlayers;
            setTurn(newTurn); 
            setTimeLeft(TURN_DURATION);
            setMessage("Robot Lewat Giliran"); 
            // Bot tidak perlu update Firestore.
        }
    };

    useEffect(() => { if (appMode === 'offline-bot' && turn === 1 && !winner) { const t = setTimeout(() => botMove(board, hands[1], deck), 2000); return () => clearTimeout(t); } }, [turn, appMode, winner, board, hands, deck]);

    const handleBoardClick = useCallback((r, c) => {
        if (winner !== null) return;
        if (appMode === 'online-game' && turn !== playerIndex) { setToast({sender: "SYSTEM", text: "Tunggu giliran!", type: 'error'}); return; }
        if (selectedCardIdx === null) return;
        
        let currentHandIdx = appMode === 'online-game' ? playerIndex : turn;
        const myHand = hands[currentHandIdx] || []; const card = myHand[selectedCardIdx]; const cell = board[r][c];
        if (!card || !cell) return;
        if (cell.type === 'corner') { setErrorCell({r,c}); setTimeout(() => setErrorCell(null), 500); return; }

        let valid = false, remove = false, moveType = 'normal'; const myTeam = getTeam(turn);
        
        if (card.rank === 'J') {
            if (isTwoEyedJack(card.rank, card.suit)) { 
                // ATURAN MUTLAK: Jack Dua Mata TIDAK BISA MENIMPA chip apapun (locked atau tidak).
                if(cell.chip === null) { 
                    valid = true; 
                    moveType = 'wild'; 
                } else {
                    setErrorCell({r,c}); 
                    playEffect('error');
                    setToast({sender:'SYS', text:'TIDAK BISA MENIMPA! Kotak sudah terisi.', type:'error'});
                    return;
                }
            } 
            else if (isOneEyedJack(card.rank, card.suit)) { 
                // Remove card: Hanya bisa lawan, dan TIDAK BISA jika locked (TERKUNCI).
                if(cell.chip !== null && getTeam(cell.chip) !== myTeam) {
                    if (cell.locked) {
                        setErrorCell({r,c}); 
                        playEffect('error');
                        setToast({sender:'SYS', text:'Chip TERKUNCI! Tidak bisa dihapus.', type:'error'});
                        return; 
                    }
                    valid=true; remove=true; moveType = 'remove'; 
                } else if (cell.chip !== null && getTeam(cell.chip) === myTeam) {
                     setErrorCell({r,c});
                     playEffect('error');
                     setToast({sender:'SYS', text:'Jack Satu Mata hanya untuk hapus chip tim sendiri!', type:'error'});
                     return;
                } else if (cell.chip === null) {
                    setErrorCell({r,c});
                    playEffect('error');
                    setToast({sender:'SYS', text:'Jack Satu Mata hanya untuk hapus chip lawan!', type:'error'});
                    return;
                }
            }
        } else if (cell.rank === card.rank && cell.suit === card.suit) { 
            // Kartu Biasa: TIDAK BISA MENIMPA chip apapun
            if (cell.chip === null) {
                valid = true;
            }
            else if (cell.chip !== null) {
                setErrorCell({r,c}); 
                playEffect('error');
                setToast({sender:'SYS', text:'Kotak ini sudah terisi.', type:'error'});
                return; 
            }
        }
        
        if (valid) executeMove(r, c, remove, selectedCardIdx, moveType, card); 
        else { 
            setErrorCell({r,c}); 
            setTimeout(() => setErrorCell(null), 500); 
            playEffect('error'); 
        }
    }, [winner, appMode, turn, playerIndex, selectedCardIdx, hands, board, playEffect, executeMove]);

    const handleSendChat = (text) => {
        const msg = { senderName: playerName, text, senderIndex: appMode==='online-game' ? playerIndex : 0 };
        if (appMode === 'online-game') {
            updateDoc(getRoomRef(roomId), { chats: arrayUnion(msg) }).catch(console.error);
        } else {
            setChats(prev => [...prev, msg]);
        }
        setUnreadCount(0);
    };

    const cycleSoundMode = () => {
        setSoundMode(prev => prev === 'sound' ? 'vibrate' : prev === 'vibrate' ? 'silent' : 'sound');
    };
    
    const handleQuit = () => {
        if (showForfeitModal) return; 
        if (winner !== null) { resetGameState(); setAppMode('menu'); } 
        else if (appMode === 'offline-bot' || appMode === 'online-game') { setShowForfeitModal(true); } 
        else { resetGameState(); setAppMode('menu'); }
    };
    
    const confirmForfeitAndQuit = () => {
        if(appMode === 'menu') return;
        setShowForfeitModal(false); 
        const opponentTeam = getTeam(playerIndex) === 0 ? 1 : 0;
        
        if (appMode === 'online-game') {
            // Update Firestore untuk menetapkan pemenang (Security Rules harus mengizinkan)
            updateDoc(getRoomRef(roomId), { winner: opponentTeam }).catch(e => {
                 console.error("FORFEIT ERROR:", e);
                 setToast({sender:'SYS', text:'Gagal gugur! Cek koneksi/Rules.', type:'error'});
            });
        }
        
        setWinner(opponentTeam); 
        setShowGameOverModal(true); 
        
        setTimeout(() => {
            resetGameState(); 
            setAppMode('menu'); 
        }, 1500); 
    };

    const handleReturnToMenu = () => {
        resetGameState(); 
        setAppMode('menu'); 
    };

    const initGame = (mode, playerCount = 2) => {
        setAppMode('dealing'); setIsDealing(true);
        const d = createDeck(); 
        const b = REAL_BOARD_PATTERN.map((rowStr, r) => rowStr.map((cardStr, c) => { const coord = `${r},${c}`; if (cardStr === 'XX') return { type: 'corner', r, c, id: coord }; return { type: 'card', rank: cardStr.slice(0, -1), suit: cardStr.slice(-1), r, c, chip: null, chipRank: null, chipSuit: null, locked: false, isWild: false, id: coord }; }));
        setTimeout(() => {
            setDeck(d); setBoard(b); 
            const h = {0: d.splice(0, 5), 1: d.splice(0, 5)}; if(playerCount === 4) { h[2] = d.splice(0, 5); h[3] = d.splice(0, 5); } else { h[2] = []; h[3] = []; }
            setHands(h); setTurn(0); setWinner(null); setChats([]); setAppMode(mode); setMaxPlayers(playerCount); setScores({0:0, 1:0}); setWinningLines([]); setScoredIds(new Set()); setTimeLeft(TURN_DURATION); setShowGameOverModal(false); setIsDealing(false);
            setConsecutiveTimeouts(0);

            if(mode === 'offline-bot') { 
                const botName = `Robot (${botLevel === 'easy' ? 'Mudah' : botLevel === 'medium' ? 'Sedang' : 'Sulit'})`;
                setPlayerNamesList({0: playerName, 1: botName}); 
                setPlayerAvatarsList({0: playerAvatar, 1: ALL_AVATARS.find(a => a.label === 'Robot Mengedip').icon}); // Ganti dengan ikon Bot
                setChats([{senderName: "Bot", text: botMessages[botLevel].quote}]); 
            }
        }, 3000);
    };

    const createRoom = async (pCount) => {
        if (!isOnlineAvailable || !db) { 
            setLoadingText("Gagal: Konfigurasi Firebase tidak valid.");
            setTimeout(() => { setLoadingText(""); setAppMode('online-setup'); }, 5000);
            return;
        }
        if (!user) {
             setLoadingText("Gagal: Autentikasi belum siap. Coba lagi.");
             setTimeout(() => { setLoadingText(""); setAppMode('online-setup'); }, 3000);
             return;
        }
        setLoadingText("Membuat Room...");
        const newRoomId = generateNumericId();
        try {
            const initialBoard = REAL_BOARD_PATTERN.map((rowStr, r) => rowStr.map((cardStr, c) => { 
                const coord = `${r},${c}`; 
                if (cardStr === 'XX') return { type: 'corner', r, c, id: coord }; 
                return { type: 'card', rank: cardStr.slice(0, -1), suit: cardStr.slice(-1), r, c, chip: null, chipRank: null, chipSuit: null, locked: false, isWild: false, id: coord }; 
            }));
            const roomRef = getRoomRef(newRoomId);
            await setDoc(roomRef, {
                hostId: user.uid, players: [user.uid], maxPlayers: pCount, 
                playerNames: {[0]: playerName}, playerAvatars: {[0]: playerAvatar}, // Simpan Avatar Emoji
                status: 'waiting', turn: 0, winner: null, board: JSON.stringify(initialBoard), hands: JSON.stringify({}), deck: JSON.stringify([]),
                chats: [{senderName: "SYSTEM", text: "Room dibuat", senderIndex: -1}], createdAt: Date.now(),
                lastPlayedCard: null, lastMove: null, scores: {0:0, 1:0}, winningLines: JSON.stringify([]), scoredIds: JSON.stringify([]),
                consecutiveTimeouts: 0,
            });
            setRoomId(newRoomId); setPlayerIndex(0); setMaxPlayers(pCount); setAppMode('online-share'); setLoadingText("");
        } catch (e) { 
            console.error("Error creating room:", e);
            const errorMsg = e.message && e.message.includes("permission") 
                ? "Kesalahan Izin: Pastikan Anda sudah mengklik tombol 'PUBLISH' di tab Rules Firebase Anda."
                : `Gagal membuat room: ${e.message || "Unknown Error"}`;
            setLoadingText(errorMsg);
            setTimeout(() => { setLoadingText(""); setAppMode('online-setup'); }, 8000);
        }
    };

    const joinRoom = async () => {
        if (!isOnlineAvailable || !db) {
            setLoadingText("Gagal: Konfigurasi Firebase tidak valid.");
            setTimeout(() => { setLoadingText(""); setAppMode('online-setup'); }, 5000);
            return;
        }
        if (!user) {
             setLoadingText("Gagal: Autentikasi belum siap. Coba lagi.");
             setTimeout(() => { setLoadingText(""); setAppMode('online-setup'); }, 3000);
             return;
        }

        if (!joinCodeInput) { setToast({sender:'SYS', text:'Masukkan kode room!', type:'error'}); return; }
        setLoadingText("Bergabung...");
        try {
            const roomRef = getRoomRef(joinCodeInput);
            const snap = await getDoc(roomRef);
            if (snap.exists()) {
                const data = snap.data();
                
                if (data.players.length >= data.maxPlayers && !data.players.includes(user.uid)) {
                    setToast({sender:'SYS', text:'Room Penuh!', type:'error'});
                    setLoadingText("");
                    return;
                }
                
                let myIdx = data.players.indexOf(user.uid);
                if (myIdx === -1) { 
                    myIdx = data.players.length; 
                    await updateDoc(roomRef, { 
                        players: arrayUnion(user.uid), 
                        [`playerNames.${myIdx}`]: playerName,
                        [`playerAvatars.${myIdx}`]: playerAvatar, // Simpan Avatar Emoji
                    }); 
                    await updateDoc(roomRef, { chats: arrayUnion({ senderName: "WASIT", text: `${playerName} bergabung.`, senderIndex: -1 }) });
                }
                setRoomId(joinCodeInput); setPlayerIndex(myIdx); setMaxPlayers(data.maxPlayers);
                const currentPlayers = data.players.length + (myIdx === data.players.length ? 1 : 0);

                if (currentPlayers === data.maxPlayers && data.status === 'waiting') { 
                    if(myIdx === 0) { 
                        const d = createDeck();
                        const h = {0: d.splice(0, 5), 1: d.splice(0, 5)}; 
                        if(data.maxPlayers === 4) { h[2] = d.splice(0, 5); h[3] = d.splice(0, 5); }
                        await updateDoc(roomRef, { status: 'started', hands: JSON.stringify(h), deck: JSON.stringify(d), chats: arrayUnion({ senderName: "WASIT", text: "Game dimulai!", senderIndex: -1 }) });
                        setAppMode('online-game');
                    } else { setAppMode('online-game'); }
                }
                else if (data.status === 'started') { setAppMode('online-game'); } else { setAppMode('online-share'); }
            } else {
                setToast({sender:'SYS', text:'Room tidak ditemukan!', type:'error'});
            }
        } catch (e) { 
            console.error("Error joining room:", e); 
            setToast({sender:'SYS', text:`Gagal bergabung: ${e.message}`, type:'error'});
        }
        setLoadingText("");
    };

    const copyCode = () => {
        navigator.clipboard.writeText(roomId).then(() => setToast({sender:'SYS', text:'Kode disalin!', type:'ok'}));
        setTimeout(()=>setToast(null), 1500);
    };

    // --- RENDER HELPERS ---
    const winningChipSet = useMemo(() => {
        const set = new Set();
        winningLines.forEach(lineObj => {
            lineObj.line.forEach(p => set.add(`${p.r},${p.c}`));
        });
        return set;
    }, [winningLines]);
    
    const ForfeitConfirmationModal = ({ onConfirm, onCancel }) => (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"> 
             <div className="bg-zinc-900 border border-rose-500/50 p-6 rounded-2xl text-center max-w-xs shadow-[0_0_30px_rgba(244,63,94,0.3)]"> 
                 <AlertOctagon size={40} className="text-rose-500 mx-auto mb-4"/>
                 <h3 className="text-lg font-black text-white mb-2">GUGUR SEKARANG?</h3>
                 <p className="text-sm text-zinc-400 mb-6">Anda akan dianggap **KALAH** dan lawan akan dinyatakan sebagai pemenang.</p>
                 <div className="flex gap-4 justify-center">
                     <button onClick={onCancel} className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold text-white transition-colors">BATAL</button>
                     <button onClick={onConfirm} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-1"><LogOut size={16}/> YA, GUGUR</button>
                 </div>
             </div>
        </div>
    );

    if (appMode === 'dealing') return <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden"><DealingOverlay onComplete={()=>{resetGameState(); setAppMode('menu'); setIsDealing(false);}}/></div>;

    const myAvatar = playerAvatar || ALL_AVATARS[0].icon;

    if (appMode === 'menu') {
        return (
            <div className="min-h-screen bg-felt-pattern flex items-center justify-center p-4 font-sans relative overflow-hidden">
                 
                 {/* Modals - Rendered on top of everything at z-[1000] */}
                 {showProfileModal && <ProfileSelectorModal currentName={playerName} currentAvatar={playerAvatar} onSave={(name, avatar) => { setPlayerName(name); setPlayerAvatar(avatar); setShowProfileModal(false); }} onClose={() => setShowProfileModal(false)}/>}
                 {showInfoModal && <GameInfoModal onClose={() => setShowInfoModal(false)} />}
                 {showBotSelectModal && <BotSelectModal botMessages={botMessages} onSelect={(key) => { setBotLevel(key); setShowBotSelectModal(false); initGame('offline-bot'); }} onClose={() => setShowBotSelectModal(false)} />}

                 {/* Decorative background effect */}
                 <MenuBackgroundEffect />

                 {/* The main menu box - Kotak Menu Utama */}
                 <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl text-center 
                             /* Colorful border/ring */
                             ring-4 ring-offset-4 ring-offset-[#154360] ring-amber-500/50
                 ">
                      
                      {/* Keterangan Game */}
                      <div className="p-4 bg-black/30 rounded-xl mb-4 border border-amber-500/30">
                           <h3 className="text-xs font-bold uppercase text-amber-300 flex items-center justify-center gap-1 mb-2">
                               <Aperture size={14}/> INFO GAME
                           </h3>
                           <p className="text-[10px] text-zinc-300 italic">Susun 3 baris berisi 5 chip tim Anda untuk menang! Gunakan Jack dengan bijak.</p>
                      </div>
                      
                      <LogoFourCards />
                      <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 mb-6 tracking-tight">SEQUENCE</h1>
                      
                      {/* Player Profile */}
                      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2 mb-4 relative z-20">
                           <div className="flex items-center gap-3">
                                {/* Avatar Menu Utama (Emoji) */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full ring-2 ring-amber-500/50 bg-white/10">
                                    <span className="text-xl" style={{ lineHeight: 1 }}>{myAvatar}</span>
                                </div>
                                <span className="text-white font-bold tracking-wide">{playerName}</span>
                           </div>
                           <button onClick={() => setShowProfileModal(true)} className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded-full transition-colors">
                               <Edit3 size={16}/>
                           </button>
                      </div>

                      <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={()=>setShowBotSelectModal(true)} className="relative z-20 bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-900/30 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] border border-white/10"><Bot size={24} /> VS Robot</button>
                                <button onClick={()=>setAppMode('online-setup')} className="relative z-20 bg-gradient-to-br from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-900/30 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] border border-white/10"><Users size={24} /> Online</button>
                           </div>
                           {/* Tombol INFORMASI GAME baru */}
                           <button onClick={()=>setShowInfoModal(true)} className="relative z-20 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold text-zinc-300 text-sm flex items-center justify-center gap-2 border border-white/5 transition-all">
                                <PlayStationIcon size={16} className="text-white"/> INFORMASI GAME
                           </button>
                      </div>

                       <div className="mt-6 pt-4 border-t border-white/10">
                            <p className="text-[10px] text-zinc-500">Karya Setiawan | Jangan lupa mampir di Ayam Bakar Spesial Bibir By WKA</p>
                       </div>
                 </div>
            </div>
        );
    }

    if (appMode === 'online-setup') {
        return (
            <div className="min-h-screen bg-felt-pattern flex items-center justify-center p-4 font-sans relative">
                 <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
                      <button onClick={()=>setAppMode('menu')} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/10 rounded-full p-1"><X size={20}/></button>
                      <h2 className="text-2xl font-bold text-white text-center mb-6 tracking-wide">LOBBY ONLINE</h2>
                      {loadingText ? (
                          <div className="flex flex-col items-center py-10"><Loader className="animate-spin text-amber-500 mb-4" size={32}/><p className="text-zinc-400 animate-pulse">{loadingText}</p></div>
                      ) : (
                          <div className="space-y-6">
                              <div className="space-y-3">
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-center block">Buat Room Baru</label>
                                  <div className="grid grid-cols-2 gap-4">
                                      <button onClick={()=>createRoom(2)} className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white py-6 rounded-2xl font-black text-xl transition-all shadow-lg border border-amber-300/30 group"><span className="relative z-10 flex flex-col items-center"><Sword size={24} className="mb-1 opacity-80"/>1 vs 1</span><div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div></button>
                                      <button onClick={()=>createRoom(4)} className="relative overflow-hidden bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-white py-6 rounded-2xl font-black text-xl transition-all shadow-lg border border-rose-300/30 group"><span className="relative z-10 flex flex-col items-center"><Users size={24} className="mb-1 opacity-80"/>2 vs 2</span><div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div></button>
                                  </div>
                              </div>
                              <div className="relative flex items-center py-2"><div className="flex-grow border-t border-white/10"></div><span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold uppercase">ATAU GABUNG</span><div className="flex-grow border-t border-white/10"></div></div>
                              <div className="flex gap-2"><input type="text" value={joinCodeInput} onChange={e=>setJoinCodeInput(e.target.value)} placeholder="Masukkan Kode Room" className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 text-white focus:outline-none focus:border-amber-500 font-mono text-center tracking-widest text-lg font-bold" /><button onClick={joinRoom} className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 rounded-xl font-bold transition-colors"><Play size={24}/></button></div>
                          </div>
                      )}
                 </div>
            </div>
        );
    }

    if (appMode === 'online-share') {
        return (
            <div className="min-h-screen bg-felt-pattern flex items-center justify-center p-4">
                 <div className="w-full max-w-md bg-zinc-900 border border-amber-500/20 p-8 rounded-3xl text-center animate-drop-in">
                      <h2 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4">Ruangan Dibuat</h2>
                      <div className="bg-black/50 p-6 rounded-2xl border border-white/10 mb-6">
                          <p className="text-xs text-zinc-500 mb-2">BAGIKAN KODE INI KE TEMAN</p>
                          <div className="text-5xl font-mono font-black text-amber-500 tracking-widest mb-4 select-all">{roomId || 'LOADING...'}</div>
                          <button onClick={copyCode} className="mx-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold text-white transition-colors"><Copy size={14}/> SALIN KODE</button>
                      </div>
                      <div className="flex items-center justify-center gap-3 text-zinc-400 text-sm animate-pulse"><Loader className="animate-spin" size={16}/> Menunggu Lawan... ({roomDetails?.players?.length || 1}/{maxPlayers})</div>
                      <button onClick={handleQuit} className="mt-8 text-rose-500 text-xs font-bold hover:underline">BATALKAN</button>
                 </div>
            </div>
        );
    }

    const myTeam = appMode === 'online-game' ? getTeam(playerIndex) : 0;
    const isBlueTeam = myTeam === 0;
    const opponentTeam = myTeam === 0 ? 1 : 0;
    const isMyTurn = (appMode === 'offline-bot' && turn === 0) || (appMode === 'online-game' && turn === playerIndex);
    const timeDisplay = formatTime(timeLeft);
    const [minutes, seconds] = timeDisplay.split(':').map(n => n.includes(':') ? n.split(':')[1] : n);

    const currentTimerColor = timeLeft < 30 ? 'text-rose-500' : 'text-amber-300';
    
    // --- KOMPONEN BARU: Utility Button ---
    const UtilityButton = ({ icon: Icon, onClick, title, colorClass, size = 18, isSelected = false }) => (
        <button 
            onClick={onClick} 
            title={title}
            className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all 
                ${isSelected 
                    ? `bg-amber-600 ${colorClass.replace('text', 'border')} border-2 text-white scale-110` 
                    : `bg-zinc-800/80 ${colorClass} hover:bg-zinc-700/80`}
            `}
        >
            <Icon size={size} className={isSelected ? 'text-white' : ''}/>
        </button>
    );

    // --- KOMPONEN BARU: Score/Timer HUD Panel (Diubah menjadi komponen Header Bar) ---
    const ScoreHeaderBar = ({ scores, isMyTurn, timeLeft, maxScore, turn, myIndex, opponentTeam }) => {
        const timeDisplayFormatted = formatTime(timeLeft);
        const [mins, secs] = timeDisplayFormatted.split(':');
        const currentTimerColor = timeLeft < 30 ? 'text-rose-500' : 'text-amber-300';
        
        const isBlue = myIndex % 2 === 0;

        return (
            <div className="flex items-center justify-between px-3 py-1 bg-[#0E3355]/80 border-b border-white/5 shadow-inner">
                {/* Score Saya (Tim Biru/Merah) */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${isBlue ? 'bg-blue-900/40 text-blue-400' : 'bg-rose-900/40 text-rose-400'}`}>
                    <Trophy size={14} />
                    <span className="hidden sm:inline">SKOR SAYA:</span> {scores[isBlue ? 0 : 1]} / {maxScore}
                </div>

                {/* Timer (Tengah) */}
                <div className="flex items-center gap-1">
                    <Clock size={16} className={currentTimerColor}/>
                    <div className="text-sm font-mono font-black tracking-wider">
                       {isMyTurn ? mins : '5'}
                       <span className="text-xs font-normal">:</span>
                       {isMyTurn ? secs : '00'}
                    </div>
                    <span className="text-xs text-zinc-400 hidden sm:inline-block">({turn + 1})</span>
                </div>
                
                {/* Score Lawan & Tombol Chat */}
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isBlue ? 'bg-rose-900/40 text-rose-400' : 'bg-blue-900/40 text-blue-400'}`}>
                        <Users size={14} />
                        <span className="hidden sm:inline">LAWAN:</span> {scores[isBlue ? 1 : 0]}
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-felt-pattern text-slate-200 flex flex-col overflow-hidden relative select-none">
             {showForfeitModal && <ForfeitConfirmationModal onConfirm={confirmForfeitAndQuit} onCancel={() => setShowForfeitModal(false)} />}
             
             {/* --- HEADER (CLEANED) --- */}
             <header className="h-14 bg-[#0E3355]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-50">
                  <div className="flex items-center gap-3">
                      <button 
                          onClick={handleQuit} 
                          disabled={showForfeitModal} 
                          className={`w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 transition-all border border-rose-500/20 z-[60]
                              ${showForfeitModal ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-500/30'}
                          `}
                      > 
                          <X size={14}/>
                      </button>
                      <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 tracking-wider">SEQUENCE ULTIMATE</h1>
                  </div>

                  <div className="flex items-center gap-4">
                        <button onClick={cycleSoundMode} className="text-zinc-500 hover:text-amber-400 transition-colors">
                            {soundMode === 'sound' ? <Volume2 size={18}/> : soundMode === 'vibrate' ? <Smartphone size={18} className="animate-pulse"/> : <VolumeX size={18}/>}
                        </button>
                        <button onClick={()=>{setShowChat(!showChat); setUnreadCount(0);}} className="w-8 h-8 rounded-full bg-amber-600 border border-white/20 shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform">
                            <MessageCircle size={16} />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center">{unreadCount}</span>}
                        </button>
                  </div>
             </header>

             {/* --- SCORE BAR DI BAWAH HEADER (KHUSUS HP/MOBILE) --- */}
             <div className="md:hidden sticky top-14 z-40">
                 <ScoreHeaderBar 
                      scores={scores} 
                      isMyTurn={isMyTurn} 
                      timeLeft={timeLeft} 
                      maxScore={WINNING_SCORE}
                      turn={turn}
                      myIndex={playerIndex === null ? 0 : playerIndex}
                      opponentTeam={opponentTeam}
                 />
             </div>

             {/* --- MAIN BOARD AREA - Layout Flex untuk Mobile/Desktop --- */}
             <main className="flex-grow relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
                  <OpponentPlayedCard card={visualPlayedCard} />
                  
                  {/* Container Utama: Flex column di mobile, flex row di desktop */}
                  <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center w-full max-w-screen-xl gap-4">
                      
                      {/* --- KIRI: UTILITY BUTTONS (Hanya untuk Desktop/Tablet) --- */}
                      <div className="hidden md:flex flex-col items-center justify-center gap-4 w-52 p-2">
                           {/* Panel Score/Timer untuk Desktop */}
                           <div className="bg-[#0e3355]/90 border border-white/10 p-4 rounded-xl shadow-xl w-full max-w-sm">
                                <div className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 ${isMyTurn ? 'border-amber-500 bg-amber-900/30' : 'border-zinc-700 bg-[#1A538A]/50'} mb-4`}>
                                     <span className="text-[10px] font-bold uppercase text-zinc-400 block leading-none">DURASI GILIRAN {isMyTurn ? '' : 'LAWN'}</span>
                                     <div className={`text-3xl font-mono font-black ${currentTimerColor} drop-shadow-md`}>
                                         {isMyTurn ? minutes : '5'}
                                         <span className="text-xl font-normal">:</span>
                                         {isMyTurn ? seconds : '00'}
                                     </div>
                                </div>
                                <div className="flex justify-between items-center mb-4">
                                     <p className="text-lg font-bold text-white flex items-center gap-2">
                                         <RotateCcw size={16} className="text-zinc-400"/>
                                         GILIRAN: <span className="text-amber-300">{turn + 1}</span>
                                     </p>
                                     {consecutiveTimeouts > 0 && (
                                        <div className="flex items-center gap-1 bg-rose-900/30 rounded-full px-2 py-0.5 border border-rose-500/20">
                                             <AlertOctagon size={10} className="text-rose-400"/>
                                             <span className="text-[10px] font-bold text-rose-300">SKIP: {consecutiveTimeouts}/2</span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                                    <h3 className="text-xs font-bold uppercase text-amber-300 mb-3 tracking-widest flex items-center justify-between">
                                        <Trophy size={14}/> SKOR (TARGET: {WINNING_SCORE})
                                    </h3>
                                    
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl" style={{ lineHeight: 1 }}>{playerAvatarsList[playerIndex % 2] || ALL_AVATARS[0].icon}</span>
                                            <span className={`text-sm font-bold ${playerIndex % 2 === 0 ? 'text-blue-400' : 'text-rose-400'}`}>{playerNamesList[playerIndex % 2] || 'SAYA'}</span>
                                        </div>
                                        <span className="text-3xl font-black text-white">{scores[playerIndex % 2]}</span>
                                    </div>

                                    <div className="flex justify-between items-center border-t border-zinc-700 pt-2">
                                         <div className="flex items-center gap-2">
                                            <span className="text-xl" style={{ lineHeight: 1 }}>{playerAvatarsList[opponentTeam] || ALL_AVATARS[0].icon}</span>
                                            <span className={`text-sm font-bold ${opponentTeam % 2 === 0 ? 'text-blue-400' : 'text-rose-400'}`}>{playerNamesList[opponentTeam] || 'LAWAN'}</span>
                                        </div>
                                        <span className="text-3xl font-black text-white">{scores[opponentTeam]}</span>
                                    </div>
                                </div>
                           </div>
                           
                           {/* Utility buttons diletakkan di bawah skor di desktop */}
                           <div className="flex justify-center gap-3 p-2 bg-[#0e3355]/50 rounded-xl border border-white/10 w-full">
                                <UtilityButton 
                                    icon={HelpCircle} 
                                    onClick={() => setShowInfoModal(true)} 
                                    title="Informasi Game" 
                                    colorClass="text-emerald-400"
                                />
                          </div>
                      </div>
                      
                      {/* --- TENGAH: PAPAN UTAMA (Maksimalkan Ruang) --- */}
                      <div className="relative flex items-center justify-center w-full max-w-[95vmin] md:max-w-[70vmin] xl:max-w-none xl:w-[600px] xl:h-[600px] aspect-square">
                          <div className="relative z-10 w-full h-full bg-board-base p-[2px] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
                              <div className="w-full h-full grid grid-cols-10 gap-[1px] bg-board-base border border-white/5 relative">
                                  {/* SVG Garis Kemenangan */}
                                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
                                      {winningLines.map((lineObj, idx) => {
                                          const start = lineObj.line[0];
                                          const end = lineObj.line[4];
                                          const x1 = start.c * 10 + 5;
                                          const y1 = start.r * 10 + 5;
                                          const x2 = end.c * 10 + 5;
                                          const y2 = end.r * 10 + 5;
                                          const color = lineObj.team === 0 ? '#3b82f6' : '#f43f5e'; 
                                          
                                          return (
                                              <line 
                                                  key={idx}
                                                  x1={`${x1}%`} y1={`${y1}%`}
                                                  x2={`${x2}%`} y2={`${y2}%`}
                                                  stroke={color}
                                                  strokeWidth="3.5%"
                                                  strokeLinecap="round"
                                                  strokeOpacity="1"
                                                  className="winning-line"
                                              />
                                          );
                                      })}
                                  </svg>

                                  {board.map((row, r) => row.map((cell, c) => {
                                      const isLast = lastMove && lastMove.r === r && lastMove.c === c;
                                      let isHighlight = false;
                                      if (selectedCardIdx !== null) {
                                          const card = hands[appMode==='online-game'?playerIndex:turn]?.[selectedCardIdx];
                                          if (card) {
                                              if (cell.chip === null) {
                                                  if (isTwoEyedJack(card.rank, card.suit)) {
                                                      isHighlight = cell.type !== 'corner'; 
                                                  } else if (cell.rank === card.rank && cell.suit === card.suit) {
                                                      isHighlight = true; 
                                                  }
                                              } else if (isOneEyedJack(card.rank, card.suit) && getTeam(cell.chip) !== myTeam && !cell.locked) {
                                                  isHighlight = true; 
                                              }
                                          }
                                      }
                                      const isWinningChipForCell = winningChipSet.has(cell.id);
                                      const isError = errorCell && errorCell.r === r && errorCell.c === c;
                                      const isAnimatingOut = animatingOutCells.has(`${r},${c}`);

                                      return (
                                          <BoardCell 
                                              key={cell.id} 
                                              cell={cell} 
                                              isLast={isLast}
                                              lastMoveType={lastMove?.type}
                                              isHighlight={isHighlight}
                                              isOccupiedError={isError}
                                              animatingOut={isAnimatingOut}
                                              onClick={handleBoardClick}
                                              isWinningChip={isWinningChipForCell} 
                                          />
                                      );
                                  }))}
                              </div>
                          </div>
                      </div>

                      {/* --- KANAN: HAND CARDS (Hanya untuk Desktop/Tablet) --- */}
                      <div className="hidden xl:flex flex-col items-center justify-center gap-3 w-40 p-2 bg-[#0e3355]/50 rounded-xl border border-white/10">
                          <p className="text-xs font-bold uppercase text-amber-300 w-full text-center">KARTU TANGAN SAYA ({hands[appMode === 'online-game' ? playerIndex : 0]?.length || 0})</p>
                          <div className="flex flex-col gap-2 p-1">
                            {(hands[appMode === 'online-game' ? playerIndex : 0] || []).map((card, i) => (
                                <HandCard 
                                    key={i} 
                                    card={card} 
                                    selected={selectedCardIdx === i} 
                                    disabled={winner !== null || (appMode==='online-game' && turn !== playerIndex)}
                                    onClick={() => { 
                                        if (appMode === 'offline-bot' && turn !== 0) return;
                                        if(winner===null && (appMode!=='online-game' || turn===playerIndex)) { 
                                            playEffect('move'); setSelectedCardIdx(selectedCardIdx === i ? null : i); 
                                        } 
                                    }}
                                />
                            ))}
                          </div>
                      </div>
                  </div>
             </main>

             {/* --- BOTTOM HUD (KARTU TANGAN KHUSUS MOBILE) --- */}
             <footer className="relative z-50 pb-safe md:pb-0">
                  <div className="h-6 bg-gradient-to-r from-transparent via-black/80 to-transparent flex items-center justify-center pointer-events-none">
                      <p className="text-[10px] font-bold text-amber-100 drop-shadow-md tracking-wide animate-pulse">{message}</p>
                  </div>
                  
                  {/* Container Kartu (Hanya Mobile/Tablet) */}
                  <div className="xl:hidden bg-[#1A538A]/95 backdrop-blur-xl border-t border-white/10 pt-3 pb-4 px-2 flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                       <p className="text-xs font-bold uppercase text-amber-300 mb-2">KARTU TANGAN SAYA ({hands[appMode === 'online-game' ? playerIndex : 0]?.length || 0})</p>
                       <div className="flex gap-2 overflow-x-auto max-w-full scrollbar-hide px-2 py-1 snap-x">
                            {(hands[appMode === 'online-game' ? playerIndex : 0] || []).map((card, i) => (
                                <HandCard 
                                    key={i} 
                                    card={card} 
                                    selected={selectedCardIdx === i} 
                                    disabled={winner !== null || (appMode==='online-game' && turn !== playerIndex)}
                                    onClick={() => { 
                                        if (appMode === 'offline-bot' && turn !== 0) return;
                                        if(winner===null && (appMode!=='online-game' || turn===playerIndex)) { 
                                            playEffect('move'); setSelectedCardIdx(selectedCardIdx === i ? null : i); 
                                        } 
                                    }}
                                />
                            ))}
                       </div>
                  </div>
             </footer>

             {/* Modals/Overlays */}
             <ChatOverlay 
                isOpen={showChat} 
                onClose={()=>setShowChat(false)} 
                chats={chats} 
                onSend={handleSendChat}
                myName={playerName}
             />
             {showInfoModal && <GameInfoModal onClose={() => setShowInfoModal(false)} />}
             {showProfileModal && <ProfileSelectorModal currentName={playerName} currentAvatar={playerAvatar} onSave={(name, avatar) => { setPlayerName(name); setPlayerAvatar(avatar); setShowProfileModal(false); }} onClose={() => setShowProfileModal(false)}/>}
             {showBotSelectModal && <BotSelectModal botMessages={botMessages} onSelect={(key) => { setBotLevel(key); setShowBotSelectModal(false); initGame('offline-bot'); }} onClose={() => setShowBotSelectModal(false)} />}

             {toast && (
                 <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-drop-in">
                     <div className={`px-6 py-3 rounded-full shadow-2xl border flex items-center gap-3 backdrop-blur-md ${toast.type==='error' ? 'bg-rose-900/80 border-rose-500/50 text-white' : 'bg-emerald-900/80 border-emerald-500/50 text-white'}`}>
                         {toast.type==='error' ? <AlertOctagon size={18}/> : <CheckCircle size={18}/>}
                         <span className="text-xs font-bold tracking-wide">{toast.text}</span>
                     </div>
                 </div>
             )}

             {/* Tampilan Game Over - Muncul setelah jeda */}
             {showGameOverModal && (
                 <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-hidden">
                      {[...Array(20)].map((_, i) => (
                          <div key={i} className="confetti" style={{ left: `${Math.random()*100}%`, animationDelay: `${Math.random()*2}s`, backgroundColor: Math.random()>0.5 ? '#3b82f6' : '#f43f5e' }}></div>
                      ))}
                      
                      <div className="bg-[#0a0a0a] border border-white/10 p-1 rounded-3xl shadow-[0_0_100px_rgba(251,191,36,0.2)] max-w-sm w-full transform scale-110 relative z-10">
                           <div className="bg-gradient-to-b from-zinc-900 to-black rounded-[20px] p-8 flex flex-col items-center text-center relative overflow-hidden">
                                <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${winner === 0 ? 'from-blue-500 via-transparent to-transparent' : 'from-rose-500 via-transparent to-transparent'}`}></div>

                                {/* Mengganti Crown dengan Trophy dan animasi spin */}
                                <Trophy size={80} className={`mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] ${winner===0 ? 'text-blue-400' : 'text-rose-400'} animate-trophy-spin`} />
                                
                                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 mb-2 tracking-tighter">VICTORY!</h2>
                                <p className={`text-xl font-bold tracking-[0.2em] mb-4 ${winner===0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                    {winner === 0 ? "TIM BIRU MENANG" : "TIM MERAH MENANG"}
                                </p>
                                <p className="text-xs italic text-zinc-400 mb-8">Terima kasih telah menjadi lawan yang baik.</p>
                                
                                <div className="flex gap-8 mb-10 w-full justify-center">
                                    <div className="text-center">
                                        <div className="text-xs text-zinc-500 font-bold mb-1">TIM BIRU</div>
                                        <div className="text-4xl font-black text-blue-500">{scores[0]}</div>
                                    </div>
                                    <div className="h-12 w-[1px] bg-zinc-800"></div>
                                    <div className="text-center">
                                        <div className="text-xs text-zinc-500 font-bold mb-1">TIM MERAH</div>
                                        <div className="text-4xl font-black text-rose-500">{scores[1]}</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleReturnToMenu} 
                                    className="w-full py-4 bg-white text-black rounded-xl font-black tracking-widest hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl relative z-20"
                                >
                                    KEMBALI KE MENU UTAMA
                                </button>
                           </div>
                      </div>
                 </div>
             )}
        </div>
    );
}

export default function SequenceGame() {
  return (
    <ErrorBoundary>
      <SequenceGameInternal />
    </ErrorBoundary>
  );
}
