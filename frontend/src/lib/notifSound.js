/**
 * notifSound.js — Indian-classical-instrument notification chimes.
 * Procedurally synthesized cues (see scripts/gen_notif_sounds.py), not
 * licensed recordings. Selection persists per-browser in localStorage.
 */
export const NOTIF_SOUNDS = [
  { id: 'none',    label: 'Silent',  hi: 'मौन',      url: null },
  { id: 'tabla',   label: 'Tabla',   hi: 'तबला',     url: '/sounds/tabla.wav' },
  { id: 'bansuri', label: 'Bansuri', hi: 'बांसुरी', url: '/sounds/bansuri.wav' },
  { id: 'sitar',   label: 'Sitar',   hi: 'सितार',    url: '/sounds/sitar.wav' },
  { id: 'tanpura', label: 'Tanpura', hi: 'तानपुरा',  url: '/sounds/tanpura.wav' },
  { id: 'ghanta',  label: 'Temple bell', hi: 'घंटा', url: '/sounds/ghanta.wav' },
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
