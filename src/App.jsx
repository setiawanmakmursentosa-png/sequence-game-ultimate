import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCw, Trophy, X, Users, Bot, Volume, VolumeX, MessageSquare, Trash2, AlertTriangle, Clock, ShieldOff, RefreshCw, Loader, User, CheckCircle, WifiOff, Activity, Zap, Brain, Skull, Smartphone, Sparkles, Grid3x3, BookOpen, Crown, AlertOctagon, Info, LogOut, Link as LinkIcon, Shield, Repeat, Layers, AlertOctagon, Info } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

// =========================================================================
// KONFIGURASI DEPLOYMENT (PENTING UNTUK NETLIFY/GITHUB)
// =========================================================================

/**
 * PENTING!
 * Saat Anda menaruh proyek di website asli (bukan preview ini), Anda perlu
 * membuat proyek di Firebase Console (https://console.firebase.google.com/).
 * * Setelah proyek dibuat, daftarkan aplikasi web, lalu salin objek
 * 'firebaseConfig' dan tempelkan di bawah ini, menggantikan 'null'.
 */
const YOUR_FIREBASE_CONFIG = null; // <<< TEMPELKAN KONFIGURASI FIREBASE DI SINI >>>

// =========================================================================
// INISIALISASI FIREBASE (JANGAN DIUBAH)
// =========================================================================

let app, db, auth;
let firebaseInitialized = false;

if (YOUR_FIREBASE_CONFIG) {
  try {
    app = initializeApp(YOUR_FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
    firebaseInitialized = true;
  } catch (error) {
    console.error("Kesalahan inisialisasi Firebase. Pastikan konfigurasi sudah benar.", error);
    firebaseInitialized = false;
  }
} else {
  console.warn("Konfigurasi Firebase belum disiapkan. Fitur online dinonaktifkan.");
}

// =========================================================================
// ERROR BOUNDARY (PENCEGAH CRASH TOTAL) - Tambahan
// =========================================================================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
  componentDidCatch(error, errorInfo) { console.error("Game Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center z-[9999]">
          <h2 className="text-2xl font-black text-red-400 mb-2 tracking-widest">KESALAHAN APLIKASI</h2>
          <p className="text-zinc-400 mb-6 max-w-md text-sm">Terjadi kesalahan saat memuat komponen utama. Silakan muat ulang.</p>
          <p className="text-xs text-red-300 font-mono mt-4">Error: {this.state.error ? this.state.error.toString() : 'Unknown Error'}</p>
          <button onClick={() => { window.location.reload(); }} className="mt-6 px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 rounded-full font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105 transition-transform text-sm tracking-widest">MUAT ULANG</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// =========================================================================
// DATA PAPAN (LAYOUT KARTU)
// =========================================================================

const REAL_BOARD_PATTERN = {
  // Papan permainan standar (10x10) dengan sudut "J" (Jack).
  // 'XX' = Kartu Jack
  // 'JS' = Jack Sekop (1 Mata, bisa diletakkan di mana saja)
  // 'JC' = Jack Keriting (2 Mata, bisa diletakkan di mana saja)
  '0,0': 'XX', '0,1': 'A♠', '0,2': 'K♠', '0,3': 'Q♠', '0,4': '10♠', '0,5': '9♠', '0,6': '8♠', '0,7': '7♠', '0,8': '6♠', '0,9': 'XX',
  '1,0': 'A♦', '1,1': '5♦', '1,2': '4♦', '1,3': '3♦', '1,4': '2♦', '1,5': 'A♣', '1,6': 'K♣', '1,7': 'Q♣', '1,8': '10♣', '1,9': '5♠',
  '2,0': 'K♦', '2,1': '6♦', '2,2': '7♦', '2,3': '8♦', '2,4': '9♦', '2,5': '10♦', '2,6': '9♣', '2,7': '8♣', '2,8': '9♣', '2,9': '4♠',
  '3,0': 'Q♦', '3,1': '7♦', '3,2': '6♣', '3,3': '5♣', '3,4': '4♣', '3,5': '3♣', '3,6': '2♣', '3,7': '7♣', '3,8': '10♣', '3,9': '3♠',
  '4,0': '10♦', '4,1': '8♦', '4,2': '2♠', '4,3': '3♠', '4,4': '4♠', '4,5': '5♠', '4,6': '6♠', '4,7': '6♣', '4,8': 'Q♣', '4,9': '2♠',
  '5,0': '9♦', '5,1': '9♦', '5,2': 'A♥', '5,3': 'K♥', '5,4': 'Q♥', '5,5': '10♥', '5,6': '9♥', '5,7': '5♣', '5,8': 'K♣', '5,9': 'A♥',
  '6,0': '8♦', '6,1': '10♦', '6,2': '2♥', '6,3': '3♥', '6,4': '4♥', '6,5': '5♥', '6,6': '8♥', '6,7': '4♣', '6,8': 'A♣', '6,9': 'K♥',
  '7,0': '7♦', '7,1': 'Q♦', '7,2': '6♥', '7,3': 'A♦', '7,4': 'K♦', '7,5': 'Q♦', '7,6': '7♥', '7,7': '3♣', '7,8': '2♣', '7,9': 'Q♥',
  '8,0': '6♦', '8,1': 'K♦', '8,2': '10♥', '8,3': '9♥', '8,4': '8♥', '8,5': '7♥', '8,6': '6♥', '8,7': '2♥', '8,8': '3♥', '8,9': '10♥',
  '9,0': 'XX', '9,1': '2♦', '9,2': '3♦', '9,3': '4♦', '9,4': '5♦', '9,5': '6♦', '9,6': '7♦', '9,7': '8♦', '9,8': '9♦', '9,9': 'XX',
};

// =========================================================================
// ASSETS & HELPERS
// =========================================================================

// Mendapatkan URL gambar kartu berdasarkan rank dan suit
const getCardImageUrl = (rank, suit) => {
  // Gunakan placeholder untuk kartu yang tidak ditemukan atau Jack (JS/JC sudah ditangani secara khusus)
  if (rank === 'XX') return 'https://placehold.co/100x150/000/FFF?text=FREE'; 
  return `https://deckofcardsapi.com/static/img/${rank}${suit[0].toLowerCase()}.png`;
};

// Fungsi untuk mendapatkan warna berdasarkan jenis (suit) kartu
const getSuitColor = (suit) => {
  if (suit === '♥' || suit === '♦') return 'text-red-600';
  return 'text-gray-900';
};

// Fungsi untuk mendapatkan nama kartu yang lebih mudah dibaca
const getCardName = (cardCode) => {
  const rank = cardCode.slice(0, -1);
  const suit = cardCode.slice(-1);
  let rankName;
  switch (rank) {
    case 'A': rankName = 'As'; break;
    case 'K': rankName = 'King'; break;
    case 'Q': rankName = 'Queen'; break;
    case 'J': rankName = 'Jack'; break;
    case '10': rankName = '10'; break;
    case '9': rankName = '9'; break;
    case '8': rankName = '8'; break;
    case '7': rankName = '7'; break;
    case '6': rankName = '6'; break;
    case '5': rankName = '5'; break;
    case '4': rankName = '4'; break;
    case '3': rankName = '3'; break;
    case '2': rankName = '2'; break;
    default: return 'Sudut GRATIS';
  }
  let suitName;
  switch (suit) {
    case '♠': suitName = 'Sekop'; break;
    case '♥': suitName = 'Hati'; break;
    case '♦': suitName = 'Wajik'; break;
    case '♣': suitName = 'Keriting'; break;
    default: suitName = '';
  }
  return `${rankName} ${suitName}`;
};

// =========================================================================
// KOMPONEN UTAMA
// =========================================================================

const SequenceGameInternal = () => {
  // State Otentikasi & Koneksi
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  // State Game
  const [screen, setScreen] = useState('menu'); // 'menu', 'lobby', 'game'
  const [roomId, setRoomId] = useState('');
  const [nickname, setNickname] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [hand, setHand] = useState([]); // Kartu di tangan pemain
  const [currentTurn, setCurrentTurn] = useState(null);
  const [gameStatus, setGameStatus] = useState('pending'); // 'pending', 'started', 'finished'
  const [boardState, setBoardState] = useState({}); // { 'row,col': 'playerId' }

  // State Interaksi
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // Constants
  const APP_ID = 'sequence-game-ultimate';
  const COLLECTION_NAME = 'rooms';

  // --- 1. OTENTIKASI DAN INISIALISASI FIREBASE ---
  useEffect(() => {
    if (!firebaseInitialized) {
      setIsLoading(false);
      return;
    }

    const initializeUser = async () => {
      try {
        // Coba masuk dengan token khusus jika tersedia (lingkungan Canvas)
        const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        let user;

        if (initialToken) {
          const userCredential = await signInWithCustomToken(auth, initialToken);
          user = userCredential.user;
        } else {
          // Jika tidak, masuk secara anonim
          const userCredential = await signInAnonymously(auth);
          user = userCredential.user;
        }

        if (user) {
          setUserId(user.uid);
          // Coba muat nickname dari penyimpanan lokal jika ada
          const savedNickname = localStorage.getItem('sequenceNickname');
          setNickname(savedNickname || `Pemain-${user.uid.substring(0, 4)}`);
        }
        setIsAuthReady(true);
        setIsLoading(false);

      } catch (error) {
        console.error("Gagal melakukan otentikasi Firebase:", error);
        setAuthError("Gagal terhubung ke server. Coba muat ulang.");
        setIsLoading(false);
        setIsAuthReady(true); // Tetapkan siap meskipun gagal agar UI muncul
      }
    };

    initializeUser();

    // Listener untuk perubahan status otentikasi
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.uid !== userId) {
        setUserId(user.uid);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // Simpan nickname ke penyimpanan lokal saat berubah
  useEffect(() => {
    if (nickname && userId) {
      localStorage.setItem('sequenceNickname', nickname);
    }
  }, [nickname, userId]);

  // --- 2. LISTENER DATA RUANGAN ---
  useEffect(() => {
    if (!db || !userId || screen !== 'lobby' || !roomId) return;

    // Path ke dokumen ruangan
    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        setBoardState(data.boardState || {});
        setHand(data.playerHands?.[userId] || []);
        setCurrentTurn(data.currentTurn);
        setGameStatus(data.status);
      } else {
        // Jika dokumen dihapus (ruangan ditutup)
        setRoomData(null);
        setRoomId('');
        setScreen('menu');
        showMessage('Ruangan ditutup oleh host.', false);
      }
    }, (error) => {
      console.error("Kesalahan mendengarkan data ruangan:", error);
      showMessage("Kesalahan koneksi data. Silakan coba lagi.", true);
    });

    return () => unsubscribe();
  }, [db, userId, screen, roomId]);


  // --- 3. FUNGSI UTAMA GAME ---

  // Deck kartu yang unik (52 kartu x 2, tanpa Jack)
  const allCards = useMemo(() => {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits = ['♠', '♥', '♦', '♣'];
    let deck = [];
    for (let i = 0; i < 2; i++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          if (rank !== 'J') { // Tidak memasukkan Jack di deck normal
            deck.push(`${rank}${suit}`);
          }
        }
      }
    }
    // Tambahkan 4 Jack (2 mata 1 dan 2 mata 2)
    deck.push('JS', 'JS', 'JC', 'JC');
    return deck;
  }, []);


  // Shuffle deck
  const shuffleDeck = useCallback((deck) => {
    let shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Menangani pesan dan notifikasi
  const showMessage = (msg, isErr = false) => {
    setMessage(msg);
    setIsError(isErr);
    setTimeout(() => setMessage(''), 5000);
  };

  // Membuat ruangan baru
  const createRoom = async () => {
    if (!db || !userId) return showMessage("Otentikasi belum siap.", true);
    setIsLoading(true);

    try {
      // Hasilkan ID ruangan 6 karakter acak
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      const initialRoomData = {
        id: newRoomId,
        hostId: userId,
        status: 'pending', // 'pending', 'started', 'finished'
        players: [{ id: userId, nickname: nickname, team: 1, isReady: false }],
        playerHands: {}, // Akan diisi saat game dimulai
        boardState: {}, // { 'row,col': { playerId: 'uid', team: 1, card: 'A♠' } }
        currentTurn: userId,
        sequenceGoal: 5, // Target 5 kartu berurutan
        deck: [], // Deck kartu akan diisi saat start
        teams: { 1: { color: 'blue', score: 0 }, 2: { color: 'red', score: 0 } },
        createdAt: new Date().toISOString(),
      };

      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, newRoomId);
      await setDoc(roomRef, initialRoomData);

      setRoomId(newRoomId);
      setScreen('lobby');
      showMessage(`Ruangan ${newRoomId} berhasil dibuat! Bagikan kode ini.`, false);

    } catch (error) {
      console.error("Gagal membuat ruangan:", error);
      showMessage("Gagal membuat ruangan. Silakan coba lagi.", true);
    } finally {
      setIsLoading(false);
    }
  };

  // Gabung ke ruangan
  const joinRoom = async () => {
    if (!db || !userId || !roomId) return showMessage("Masukkan kode ruangan.", true);
    setIsLoading(true);

    try {
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId.toUpperCase());
      const docSnap = await getDoc(roomRef);

      if (docSnap.exists() && docSnap.data().status === 'pending') {
        const data = docSnap.data();

        if (data.players.find(p => p.id === userId)) {
          // Sudah ada di ruangan, langsung masuk
          setRoomData(data);
          setScreen('lobby');
          showMessage(`Selamat datang kembali di ruangan ${roomId.toUpperCase()}.`);
          return;
        }
        
        // Cek batasan 4 pemain
        if (data.players.length >= 4) {
             showMessage("Ruangan penuh (max 4 pemain).", true);
             return;
        }

        // Tentukan tim (tim dengan pemain paling sedikit)
        const teamCounts = data.players.reduce((acc, player) => {
            acc[player.team] = (acc[player.team] || 0) + 1;
            return acc;
        }, {});

        const newTeam = (teamCounts[1] || 0) <= (teamCounts[2] || 0) ? 1 : 2;

        const newPlayer = { id: userId, nickname: nickname, team: newTeam, isReady: false };
        await updateDoc(roomRef, {
          players: arrayUnion(newPlayer)
        });

        setScreen('lobby');
        showMessage(`Berhasil bergabung ke ruangan ${roomId.toUpperCase()}.`);
      } else if (docSnap.exists() && docSnap.data().status !== 'pending') {
        showMessage("Game sudah dimulai. Tidak bisa bergabung.", true);
      } else {
        showMessage("Kode ruangan tidak valid atau ruangan tidak ditemukan.", true);
      }

    } catch (error) {
      console.error("Gagal bergabung ke ruangan:", error);
      showMessage("Gagal bergabung ke ruangan. Silakan coba lagi.", true);
    } finally {
      setIsLoading(false);
    }
  };

  // Memulai game
  const startGame = async () => {
    if (!roomData || !db || roomData.hostId !== userId) return showMessage("Anda bukan host ruangan.", true);
    if (roomData.players.length < 2) return showMessage("Minimal 2 pemain untuk memulai.", true);
    if (roomData.players.length > 4) return showMessage("Maksimal 4 pemain untuk saat ini.", true);
    if (roomData.players.some(p => !p.isReady)) return showMessage("Semua pemain harus siap ('Ready') terlebih dahulu.", true);

    setIsLoading(true);
    try {
      const shuffledDeck = shuffleDeck(allCards);
      const hands = {};
      const numPlayers = roomData.players.length;
      let handSize;
      if (numPlayers === 2) handSize = 7;
      else if (numPlayers === 3) handSize = 6;
      else if (numPlayers === 4) handSize = 5;

      let deckIndex = 0;
      for (const player of roomData.players) {
        hands[player.id] = shuffledDeck.slice(deckIndex, deckIndex + handSize);
        deckIndex += handSize;
      }

      const remainingDeck = shuffledDeck.slice(deckIndex);
      
      // Urutkan pemain berdasarkan urutan ID untuk menentukan giliran pertama
      const turnOrder = roomData.players.map(p => p.id).sort();

      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId);
      await updateDoc(roomRef, {
        status: 'started',
        deck: remainingDeck,
        playerHands: hands,
        currentTurn: turnOrder[0],
        turnOrder: turnOrder,
        boardState: {}, // Bersihkan papan
        teams: { 1: { color: 'blue', score: 0 }, 2: { color: 'red', score: 0 } },
        log: arrayUnion({ type: 'START', timestamp: new Date().toISOString() })
      });

      setScreen('game');
      showMessage("Game dimulai!", false);
    } catch (error) {
      console.error("Gagal memulai game:", error);
      showMessage("Gagal memulai game.", true);
    } finally {
      setIsLoading(false);
    }
  };

  // Mengirim aksi Ready/Unready
  const toggleReady = async () => {
    if (!roomData || !db || !userId) return;
    try {
        const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId);
        const currentPlayer = roomData.players.find(p => p.id === userId);
        if (!currentPlayer) return;

        const updatedPlayers = roomData.players.map(p =>
            p.id === userId ? { ...p, isReady: !p.isReady } : p
        );

        await updateDoc(roomRef, { players: updatedPlayers });

    } catch (error) {
        console.error("Gagal mengubah status Ready:", error);
        showMessage("Gagal mengubah status Ready.", true);
    }
  };
  
  // Menghapus ruangan (hanya host)
  const deleteRoom = async () => {
    if (!roomData || roomData.hostId !== userId) return showMessage("Hanya host yang bisa menghapus ruangan.", true);
    if (!window.confirm("Apakah Anda yakin ingin menghapus ruangan ini?")) return;

    try {
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId);
      await setDoc(roomRef, { status: 'closed' }, { merge: true }); // Tandai sebagai ditutup

      // Sebagai ganti deleteDoc, kita set status closed (untuk listener)
      // await deleteDoc(roomRef);

      setRoomId('');
      setRoomData(null);
      setScreen('menu');
      showMessage("Ruangan berhasil dihapus.", false);
    } catch (error) {
      console.error("Gagal menghapus ruangan:", error);
      showMessage("Gagal menghapus ruangan.", true);
    }
  };

  // Mengambil giliran berikutnya
  const getNextTurnId = useCallback((turnOrder, currentTurnId) => {
    if (!turnOrder || turnOrder.length === 0) return null;
    const currentIndex = turnOrder.findIndex(id => id === currentTurnId);
    if (currentIndex === -1) return turnOrder[0]; // Mulai dari awal jika tidak ditemukan
    
    const nextIndex = (currentIndex + 1) % turnOrder.length;
    return turnOrder[nextIndex];
  }, []);

  // Memeriksa Sequence (5 kartu berurutan)
  const checkSequence = useCallback((newBoardState, team, lastPosition) => {
    if (!lastPosition) return false;
    const [r, c] = lastPosition.split(',').map(Number);
    const boardSize = 10;
    const sequenceGoal = 5;

    // Arah pergerakan (Horizontal, Vertikal, Diagonal)
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    const getPlayerTeam = (row, col) => {
      const key = `${row},${col}`;
      const cell = newBoardState[key];
      // Sudut GRATIS (XX) dianggap dimiliki oleh team mana pun
      if (REAL_BOARD_PATTERN[key] === 'XX') return team; 
      return cell && cell.team === team ? team : null;
    };

    for (const [dr, dc] of directions) {
      let maxLen = 1;
      let currentLen = 1;
      
      // Cek satu arah (misalnya ke kanan/bawah)
      for (let i = 1; i < sequenceGoal; i++) {
        const nr = r + i * dr;
        const nc = c + i * dc;
        if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && getPlayerTeam(nr, nc) === team) {
          currentLen++;
        } else {
          break;
        }
      }

      // Cek arah sebaliknya (misalnya ke kiri/atas)
      for (let i = 1; i < sequenceGoal; i++) {
        const nr = r - i * dr;
        const nc = c - i * dc;
        if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && getPlayerTeam(nr, nc) === team) {
          currentLen++;
        } else {
          break;
        }
      }
      
      maxLen = Math.max(maxLen, currentLen);
      if (maxLen >= sequenceGoal) return true;
    }

    return false;
  }, []);

  // Menangani klik pada kartu di papan
  const handleBoardClick = async (row, col) => {
    if (!db || !roomData || gameStatus !== 'started' || currentTurn !== userId) {
      return showMessage("Bukan giliran Anda atau game belum dimulai.", true);
    }

    if (selectedCardIndex === null) {
      return showMessage("Pilih kartu dari tangan Anda terlebih dahulu.", true);
    }

    const cardToPlay = hand[selectedCardIndex];
    const cardCodeOnBoard = REAL_BOARD_PATTERN[`${row},${col}`];
    const isOccupied = boardState[`${row},${col}`] !== undefined;
    const isCorner = cardCodeOnBoard === 'XX';

    const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, roomId);
    const currentPlayer = roomData.players.find(p => p.id === userId);
    const playerTeam = currentPlayer.team;
    
    let isPlaceable = false;
    let cardAction = 'place'; // 'place' atau 'remove'

    if (isCorner) {
      // Sudut GRATIS (XX) selalu bisa ditempati.
      if (isOccupied) {
        return showMessage("Kotak sudut sudah ditempati.", true);
      }
      isPlaceable = true;

    } else if (cardToPlay.includes('J')) { // Jack dimainkan
      
      if (cardToPlay === 'JS' || cardToPlay === 'JC') { // Jack Sekop/Keriting (Wildcard)
        if (isOccupied) {
            return showMessage("Tidak bisa menempatkan Jack di kotak yang sudah ada chip.", true);
        }
        isPlaceable = true; // Bisa ditempatkan di mana saja yang kosong
      
      } else if (cardToPlay === 'J♠') { // Jack Sekop (1 Mata - Menghapus)
        cardAction = 'remove';
        if (isOccupied) {
          const occupiedTeam = boardState[`${row},${col}`].team;
          // Jack Sekop tidak bisa menghapus chip dari tim sendiri
          if (occupiedTeam !== playerTeam) {
            isPlaceable = true;
          } else {
            return showMessage("Tidak bisa menghapus chip tim Anda sendiri.", true);
          }
        } else {
          return showMessage("Jack Sekop hanya bisa digunakan untuk menghapus chip lawan.", true);
        }
      }

    } else { // Kartu normal dimainkan
      
      // Kartu normal harus sesuai dengan kartu di papan DAN kotak harus kosong
      const matchingBoardCard = REAL_BOARD_PATTERN[`${row},${col}`];
      if (cardToPlay === matchingBoardCard && !isOccupied) {
        isPlaceable = true;
      } else if (cardToPlay !== matchingBoardCard) {
        return showMessage(`Kartu ${getCardName(cardToPlay)} tidak cocok dengan kartu papan.`, true);
      } else if (isOccupied) {
         return showMessage("Kotak sudah ditempati.", true);
      }
    }
    
    if (isPlaceable) {
      try {
        let newBoardState = { ...boardState };
        let chipPlaced = false;
        let logMessage = '';

        if (cardAction === 'place') {
          newBoardState[`${row},${col}`] = {
            playerId: userId,
            team: playerTeam,
            card: cardCodeOnBoard,
          };
          chipPlaced = true;
          logMessage = `${nickname} menempatkan chip di ${cardCodeOnBoard} menggunakan ${getCardName(cardToPlay)}.`;
        } else if (cardAction === 'remove') {
          // Aksi hapus (hanya dengan Jack Sekop)
          delete newBoardState[`${row},${col}`];
          chipPlaced = true;
          logMessage = `${nickname} menghapus chip lawan di ${cardCodeOnBoard} menggunakan Jack Sekop.`;
        } else {
          return showMessage("Aksi kartu tidak valid.", true);
        }
        
        // Cek Sequence setelah aksi
        const sequenceAchieved = checkSequence(newBoardState, playerTeam, `${row},${col}`);
        let gameFinished = false;

        const nextTurnId = getNextTurnId(roomData.turnOrder, userId);
        
        const updatePayload = {
          currentTurn: nextTurnId,
          playerHands: { [userId]: arrayRemove(cardToPlay) },
          boardState: newBoardState,
          log: arrayUnion({ type: 'MOVE', player: nickname, card: getCardName(cardToPlay), position: `${row},${col}`, action: cardAction, timestamp: new Date().toISOString() })
        };
        
        if (sequenceAchieved) {
            const newScore = (roomData.teams[playerTeam]?.score || 0) + 1;
            updatePayload.teams = { 
                ...roomData.teams, 
                [playerTeam]: { ...roomData.teams[playerTeam], score: newScore } 
            };
            logMessage += ` (SEQUENCE PERTAMA DARI TEAM ${playerTeam}!)`;
            
            // Periksa kemenangan (target 2 Sequence)
            if (newScore >= 2) {
                updatePayload.status = 'finished';
                gameFinished = true;
                logMessage += ` (GAME SELESAI! TEAM ${playerTeam} MENANG!)`;
            }
        }
        
        // Ambil kartu baru dari deck
        const newDeck = [...roomData.deck];
        const newCard = newDeck.shift();
        if (newCard) {
            updatePayload.deck = newDeck;
            updatePayload.playerHands = { 
                ...updatePayload.playerHands, 
                [userId]: arrayUnion(newCard) 
            };
        } else {
            // Deck habis, game berakhir imbang?
        }
        
        await updateDoc(roomRef, updatePayload);
        
        setSelectedCardIndex(null);
        showMessage(logMessage, false);
        if (gameFinished) {
            showMessage(`Game Selesai! TEAM ${playerTeam} MENANG!`, false);
        }

      } catch (error) {
        console.error("Gagal melakukan aksi:", error);
        showMessage("Terjadi kesalahan data. Silakan coba lagi.", true);
      }
    }
  };

  // --- 4. RENDER UI ---

  // Component: Tampilan Kotak Papan
  const BoardCell = ({ row, col, content, chipData, onClick }) => {
    const key = `${row},${col}`;
    const cardCode = REAL_BOARD_PATTERN[key];
    const isCorner = cardCode === 'XX';
    const isOccupied = chipData !== undefined;
    const isMyTeam = isOccupied && roomData.players.find(p => p.id === userId)?.team === chipData.team;
    
    // Tentukan warna chip
    let chipColor = 'bg-gray-700';
    let ringColor = 'ring-gray-300';
    let teamText = '';
    
    if (isOccupied) {
        const teamColor = roomData.teams[chipData.team]?.color;
        chipColor = teamColor === 'blue' ? 'bg-blue-600' : 'bg-red-600';
        ringColor = teamColor === 'blue' ? 'ring-blue-300' : 'ring-red-300';
        teamText = `T${chipData.team}`;
    }

    return (
      <div 
        className={`relative w-full aspect-square flex items-center justify-center p-0.5 border border-gray-300 cursor-pointer transition-all duration-100 ${isCorner ? 'bg-green-700' : 'bg-white hover:bg-gray-100'}`}
        onClick={() => onClick(row, col)}
        title={isCorner ? 'Sudut GRATIS' : getCardName(cardCode)}
      >
        {isCorner ? (
          <span className="text-white font-bold text-xs sm:text-lg">GRATIS</span>
        ) : (
          <div className={`text-xs sm:text-lg font-bold ${getSuitColor(cardCode.slice(-1))}`}>
            {cardCode}
          </div>
        )}
        
        {isOccupied && (
          <div className={`absolute inset-0 m-auto w-4/5 h-4/5 flex items-center justify-center rounded-full shadow-lg ${chipColor} ring-2 ${ringColor} transition-transform duration-100 ease-out scale-100`}>
             <span className="text-white text-xs font-semibold">{teamText}</span>
          </div>
        )}
      </div>
    );
  };

  // Component: Tampilan Tangan Pemain
  const HandCard = ({ card, index, isSelected, onClick }) => {
    const cardRank = card.slice(0, -1);
    const cardSuit = card.slice(-1);
    
    // Tangani Jack khusus
    let cardDisplayName = card;
    let cardColor = 'text-gray-800';
    let cardDescription = getCardName(card);
    let cardIcon = null;

    if (card === 'JS') { // Jack Sekop (1 Mata - Hapus)
        cardDisplayName = 'J♠'; 
        cardColor = 'text-red-700';
        cardDescription = 'Hapus Chip Lawan';
        cardIcon = <Trash2 size={16} className="mt-1" />;
    } else if (card === 'JC') { // Jack Keriting (2 Mata - Wildcard)
        cardDisplayName = 'J♣';
        cardColor = 'text-green-700';
        cardDescription = 'Chip Wildcard';
        cardIcon = <Sparkles size={16} className="mt-1" />;
    } else {
        cardColor = getSuitColor(cardSuit);
        cardIcon = <span className="mt-1">{cardSuit}</span>;
    }

    return (
      <div 
        className={`relative w-20 sm:w-24 h-32 sm:h-36 flex flex-col items-center justify-between p-2 rounded-lg shadow-xl border-4 ${isSelected ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:bg-gray-50'} cursor-pointer transition-all duration-200`}
        onClick={() => onClick(index)}
      >
        <div className={`text-xl font-extrabold ${cardColor}`}>
          {cardDisplayName}
        </div>
        <div className="flex-grow flex items-center justify-center">
            {cardIcon}
        </div>
        <div className="text-xs text-center text-gray-500 mt-1">
          {cardDescription}
        </div>
        {isSelected && (
            <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-2 py-0.5 text-xs font-bold text-white bg-yellow-500 rounded-full shadow-md">
                DIPILIH
            </span>
        )}
      </div>
    );
  };

  // Main App Renderer
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-2 sm:p-4">
      {/* HEADER & GLOBAL NOTIFICATIONS */}
      <header className="flex justify-between items-center mb-4 p-2 bg-white rounded-lg shadow-md">
        <div className="flex items-center">
          <Grid3x3 className="text-blue-600 mr-2" size={28} />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-600">
            SEQUENCE ONLINE
          </h1>
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={() => setIsSoundMuted(!isSoundMuted)} 
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                title={isSoundMuted ? "Nyalakan Suara" : "Matikan Suara"}
            >
                {isSoundMuted ? <VolumeX size={20} /> : <Volume size={20} />}
            </button>
            <div className="text-sm font-medium text-gray-500 hidden sm:block">
                ID: {userId ? userId.substring(0, 8) : 'Memuat...'}
            </div>
        </div>
      </header>

      {/* GLOBAL MESSAGE BOX */}
      {message && (
        <div className={`p-3 mb-4 rounded-lg shadow-md flex items-center transition-all duration-300 ${isError ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'}`}>
          {isError ? <AlertTriangle className="mr-2" size={20} /> : <CheckCircle className="mr-2" size={20} />}
          <p className="font-medium">{message}</p>
        </div>
      )}
      
      {/* LOADING STATE */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader className="animate-spin text-blue-500" size={32} />
          <p className="mt-4 text-lg font-medium">Memuat...</p>
        </div>
      )}

      {/* AUTH ERROR STATE */}
      {!isLoading && !firebaseInitialized && (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-xl shadow-lg text-center">
            <WifiOff className="text-red-500 mx-auto mb-3" size={32} />
            <h2 className="text-xl font-bold text-red-700">Fitur Online Tidak Aktif</h2>
            <p className="mt-2 text-gray-600">
                Fitur Multiplayer memerlukan kunci konfigurasi Firebase yang valid. Silakan kunjungi 
                <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mx-1 font-semibold">
                    Firebase Console
                </a> 
                untuk membuat proyek dan menempelkan `firebaseConfig` ke dalam file `src/App.jsx`.
            </p>
        </div>
      )}


      {/* SCREEN RENDERER */}
      {!isLoading && firebaseInitialized && isAuthReady && (
        <main className="bg-white p-4 sm:p-6 rounded-xl shadow-2xl">
          
          {/* SCREEN: MENU UTAMA */}
          {screen === 'menu' && (
            <div className="flex flex-col items-center justify-center space-y-6">
              <h2 className="text-3xl font-bold text-gray-700 mb-6">Mulai Game</h2>
              
              <div className="w-full max-w-sm space-y-4">
                <label className="block text-lg font-medium text-gray-700">Nama Panggilan Anda</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.substring(0, 15))}
                  placeholder="Masukkan Nickname"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-lg shadow-inner"
                  maxLength={15}
                />
              </div>

              <div className="w-full max-w-sm space-y-4">
                <button
                  onClick={createRoom}
                  className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-xl font-bold rounded-xl shadow-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out transform hover:scale-[1.02]"
                >
                  <Crown className="mr-3" size={24} /> Buat Ruangan Baru
                </button>

                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="Kode Ruangan (6 digit)"
                    className="flex-grow px-4 py-3 border border-gray-300 rounded-xl focus:ring-green-500 focus:border-green-500 text-lg shadow-inner uppercase"
                    maxLength={6}
                  />
                  <button
                    onClick={joinRoom}
                    className="w-1/3 px-6 py-3 border border-transparent text-lg font-bold rounded-xl shadow-lg text-white bg-green-600 hover:bg-green-700 transition duration-150 ease-in-out transform hover:scale-[1.02]"
                  >
                    <LinkIcon size={20} className="mx-auto" /> Gabung
                  </button>
                </div>
              </div>
              
              <div className="mt-8 text-center text-sm text-gray-500 p-4 border-t pt-4">
                <ShieldOff size={18} className="inline mr-1 text-red-500"/> Aplikasi ini menggunakan otentikasi anonim untuk kemudahan. Jangan gunakan nickname atau informasi pribadi yang sensitif.
              </div>
            </div>
          )}

          {/* SCREEN: LOBBY */}
          {screen === 'lobby' && roomData && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center border-b pb-4 mb-4">
                <h2 className="text-3xl font-bold text-blue-600 flex items-center">
                  <Users className="mr-2" size={30} /> LOBBY: {roomData.id}
                </h2>
                <div className="mt-2 sm:mt-0 text-sm font-medium text-gray-500">
                    Host: {roomData.players.find(p => p.id === roomData.hostId)?.nickname || 'Tidak Dikenal'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Panel Pemain */}
                <div className="bg-gray-50 p-4 rounded-xl shadow-inner border">
                  <h3 className="text-xl font-semibold mb-3 border-b pb-2 flex items-center text-gray-700">
                    <User size={20} className="mr-2"/> Daftar Pemain ({roomData.players.length}/4)
                  </h3>
                  <ul className="space-y-2">
                    {roomData.players.map((player) => (
                      <li key={player.id} className={`p-2 rounded-lg flex justify-between items-center ${player.id === userId ? 'bg-yellow-100 font-bold' : 'bg-white'}`}>
                        <div className="flex items-center">
                            {player.id === roomData.hostId && <Crown size={18} className="text-yellow-500 mr-2" title="Host"/>}
                            {player.id === userId && <span className="text-blue-500 mr-2">(Anda)</span>}
                            <span>{player.nickname}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className={`text-sm font-bold p-1 rounded ${player.team === 1 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                                TEAM {player.team}
                            </span>
                            {player.isReady ? (
                                <span className="text-green-500 font-bold flex items-center"><CheckCircle size={16} className="mr-1"/> Siap</span>
                            ) : (
                                <span className="text-red-500 font-bold flex items-center"><Clock size={16} className="mr-1"/> Belum Siap</span>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Panel Aksi & Status */}
                <div className="space-y-4">
                  {/* Tombol Ready/Unready */}
                  <button
                    onClick={toggleReady}
                    className={`w-full py-3 text-lg font-bold rounded-xl shadow-md transition duration-150 ${
                        roomData.players.find(p => p.id === userId)?.isReady 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center' 
                        : 'bg-green-600 hover:bg-green-700 text-white flex items-center justify-center'
                    }`}
                    disabled={roomData.status !== 'pending'}
                  >
                    {roomData.players.find(p => p.id === userId)?.isReady ? (
                        <span className="flex items-center"><RefreshCw size={20} className="mr-2"/> Batalkan Siap</span>
                    ) : (
                        <span className="flex items-center"><CheckCircle size={20} className="mr-2"/> Saya Siap Bermain</span>
                    )}
                  </button>
                  
                  {/* Tombol Start Game (Hanya Host) */}
                  {roomData.hostId === userId && (
                    <button
                      onClick={startGame}
                      className="w-full py-3 text-lg font-bold rounded-xl shadow-md text-white bg-purple-600 hover:bg-purple-700 transition duration-150 flex items-center justify-center"
                      disabled={roomData.players.length < 2 || roomData.players.some(p => !p.isReady)}
                    >
                      <Zap size={20} className="mr-2"/> Mulai Game Sekarang
                    </button>
                  )}
                  
                  {/* Tombol Hapus Ruangan (Hanya Host) */}
                  {roomData.hostId === userId && (
                    <button
                      onClick={deleteRoom}
                      className="w-full py-3 text-sm font-bold rounded-xl shadow-md text-red-700 bg-red-100 hover:bg-red-200 transition duration-150 flex items-center justify-center mt-4"
                    >
                      <Trash2 size={16} className="mr-2"/> Hapus Ruangan
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <Info size={18} className="inline mr-1 text-blue-500"/>
                **Kode Ruangan Anda:** <span className="font-extrabold text-blue-800 text-xl">{roomData.id}</span>
                <p className="text-sm text-gray-600 mt-1">Bagikan kode ini ke teman Anda agar bisa bergabung. Minimal 2 pemain untuk memulai.</p>
              </div>
              
            </div>
          )}

          {/* SCREEN: GAME BERLANGSUNG */}
          {screen === 'game' && roomData && (
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Panel Kiri: Papan Game */}
                <div className="w-full lg:w-3/4">
                    <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-700">
                        <Grid3x3 className="mr-2" size={24}/> Papan Sequence
                    </h2>
                    
                    {/* Status Score Board */}
                    <div className="flex justify-around mb-4 p-3 rounded-xl shadow-md font-extrabold text-white">
                        <div className="p-2 w-1/2 text-center bg-blue-600 rounded-l-lg flex flex-col items-center justify-center">
                           <span className="text-lg sm:text-2xl"><Layers size={20} className="inline mr-2"/> Tim 1</span>
                           <span className="text-3xl sm:text-4xl">{roomData.teams[1]?.score || 0}</span>
                        </div>
                        <div className="p-2 w-1/2 text-center bg-red-600 rounded-r-lg flex flex-col items-center justify-center">
                           <span className="text-lg sm:text-2xl"><Layers size={20} className="inline mr-2"/> Tim 2</span>
                           <span className="text-3xl sm:text-4xl">{roomData.teams[2]?.score || 0}</span>
                        </div>
                    </div>
                    
                    {/* Status Giliran */}
                    <div className={`p-3 mb-4 rounded-xl shadow-lg font-bold text-center border-4 ${currentTurn === userId ? 'bg-yellow-100 border-yellow-500' : 'bg-gray-100 border-gray-300'}`}>
                        {currentTurn === userId ? (
                            <span className="text-xl text-yellow-700 flex items-center justify-center"><Brain size={24} className="mr-2"/> GILIRAN ANDA!</span>
                        ) : (
                            <span className="text-lg text-gray-700 flex items-center justify-center"><Clock size={24} className="mr-2"/> Giliran {roomData.players.find(p => p.id === currentTurn)?.nickname || 'Pemain Lain'}</span>
                        )}
                    </div>
                    
                    {/* Papan Game */}
                    <div className="grid grid-cols-10 gap-0.5 max-w-full mx-auto" style={{ aspectRatio: '1 / 1' }}>
                        {Array.from({ length: 10 }).map((_, r) =>
                            Array.from({ length: 10 }).map((_, c) => (
                                <BoardCell
                                    key={`${r},${c}`}
                                    row={r}
                                    col={c}
                                    content={REAL_BOARD_PATTERN[`${r},${c}`]}
                                    chipData={boardState[`${r},${c}`]}
                                    onClick={handleBoardClick}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Panel Kanan: Tangan & Log */}
                <div className="w-full lg:w-1/4 space-y-6">
                    {/* Tangan Pemain */}
                    <div className="bg-gray-50 p-4 rounded-xl shadow-inner border">
                        <h3 className="text-xl font-semibold mb-3 border-b pb-2 flex items-center text-gray-700">
                            <Smartphone size={20} className="mr-2"/> Tangan Anda
                        </h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {hand.map((card, index) => (
                                <HandCard
                                    key={index}
                                    card={card}
                                    index={index}
                                    isSelected={selectedCardIndex === index}
                                    onClick={setSelectedCardIndex}
                                />
                            ))}
                        </div>
                    </div>
                    
                    {/* Log Game */}
                    <div className="bg-gray-50 p-4 rounded-xl shadow-inner border max-h-96 overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-3 border-b pb-2 flex items-center text-gray-700">
                            <BookOpen size={20} className="mr-2"/> Log Aktivitas
                        </h3>
                        <ul className="space-y-1 text-sm">
                            {roomData.log && [...roomData.log].reverse().slice(0, 10).map((entry, index) => (
                                <li key={index} className={`p-1 rounded ${entry.type === 'START' ? 'bg-purple-100 font-bold' : ''}`}>
                                    {entry.type === 'START' && <span className="text-purple-700">[GAME] Game dimulai.</span>}
                                    {entry.type === 'MOVE' && (
                                        <span className="text-gray-700">
                                            **{entry.player}** {entry.action === 'place' ? 'menempatkan chip' : 'menghapus chip'} dengan **{entry.card}**
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Tombol Keluar */}
                    <button
                        onClick={() => { if (window.confirm("Apakah Anda yakin ingin keluar? Game ini akan berlanjut tanpa Anda.")) setScreen('menu'); }}
                        className="w-full py-2 text-sm font-bold rounded-xl text-gray-500 bg-gray-100 hover:bg-gray-200 transition duration-150 flex items-center justify-center"
                    >
                        <LogOut size={16} className="mr-2"/> Keluar dari Game
                    </button>
                </div>
            </div>
          )}
        </main>
      )}

      {/* FOOTER */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Dibuat dengan React, Tailwind CSS, dan Firebase Firestore (Spark Plan Gratis).</p>
        <p>Aplikasi ini hanya untuk tujuan edukasi dan hiburan. Kode Game: {APP_ID}</p>
      </footer>
    </div>
  );
};

// Final Export Wrapper
export default function SequenceGame() { 
  return (
    <ErrorBoundary>
      <SequenceGameInternal />
    </ErrorBoundary>
  );
}
