export const NOTIF_SOUNDS = [
  { id: 'none',    label: 'Silent',       hi: 'मौन',      url: null },
  { id: 'tabla',   label: 'Tabla',        hi: 'तबला',     url: '/sounds/tabla.mp3' },
  { id: 'sitar',   label: 'Sitar',        hi: 'सितार',    url: '/sounds/sitar.mp3' },
  { id: 'dhol',    label: 'Dhol',         hi: 'ढोल',      url: '/sounds/dhol.mp3' },
  { id: 'salute',  label: 'Salute',       hi: 'सलामी',    url: '/sounds/salute.mp3' },
  { id: 'jump',    label: 'Jump',         hi: 'कूद',      url: '/sounds/jump.mp3' },
  { id: 'mario',   label: 'Mario',        hi: 'मारियो',   url: '/sounds/mario.mp3' },
  { id: 'minion',  label: 'Minion',       hi: 'मिनियन',   url: '/sounds/minion.mp3' },
  { id: 'rooster', label: 'Rooster',      hi: 'मुर्गा',   url: '/sounds/rooster.mp3' },
  { id: 'train',   label: 'Train',        hi: 'रेलगाड़ी', url: '/sounds/train.mp3' },
];

const STORAGE_KEY = 'kv_notif_sound';
const DEFAULT_SOUND_ID = 'tabla';

export function getNotifSoundId() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_SOUND_ID; } catch (_) { return DEFAULT_SOUND_ID; }
}

export function setNotifSoundId(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch (_) {}
}

let cachedAudio = null;
let cachedUrl = null;

export function playNotifSound() {
  const id = getNotifSoundId();
  const sound = NOTIF_SOUNDS.find(s => s.id === id);
  if (!sound || !sound.url) return; // silent
  try {
    if (cachedUrl !== sound.url) {
      cachedAudio = new Audio(sound.url);
      cachedUrl = sound.url;
    }
    cachedAudio.currentTime = 0;
    cachedAudio.volume = 0.5;
    cachedAudio.play().catch(() => {}); // browsers may block autoplay before first user gesture
  } catch (_) {}
}
