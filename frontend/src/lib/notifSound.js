export const NOTIF_SOUND_GROUPS = [
  {
    group: 'Silent',
    hi: '',
    sounds: [
      { id: 'none', label: 'Silent', hi: 'मौन', url: null },
    ],
  },
  {
    group: 'Indian Classical',
    hi: 'शास्त्रीय',
    sounds: [
      { id: 'tabla',   label: 'Tabla',        hi: 'तबला',     url: '/sounds/tabla.mp3' },
      { id: 'sitar',   label: 'Sitar',        hi: 'सितार',    url: '/sounds/sitar.mp3' },
      { id: 'dhol',    label: 'Dhol',         hi: 'ढोल',      url: '/sounds/dhol.mp3' },
      { id: 'salute',  label: 'Salute horn',  hi: 'सलामी',    url: '/sounds/salute.mp3' },
    ],
  },
  {
    group: 'Indian Funny',
    hi: 'देसी हास्य',
    sounds: [
      { id: 'rickshaw_horn',      label: 'Rickshaw horn',      hi: 'रिक्शा',   url: '/sounds/rickshaw_horn.mp3' },
      { id: 'shehnai_gone_wrong', label: 'Shehnai gone wrong', hi: 'शहनाई',    url: '/sounds/shehnai_gone_wrong.mp3' },
      { id: 'bollywood_suspense', label: 'Bollywood suspense', hi: 'बॉलीवुड',  url: '/sounds/bollywood_suspense.mp3' },
      { id: 'indian_train_horn',  label: 'Train horn',         hi: 'रेलगाड़ी', url: '/sounds/indian_train_horn.mp3' },
    ],
  },
  {
    group: 'Funny',
    hi: 'हास्य',
    sounds: [
      { id: 'jump',          label: 'Jump',           hi: 'कूद',        url: '/sounds/jump.mp3' },
      { id: 'mario',         label: 'Mario',          hi: 'मारियो',     url: '/sounds/mario.mp3' },
      { id: 'minion',        label: 'Minion',         hi: 'मिनियन',     url: '/sounds/minion.mp3' },
      { id: 'rooster',       label: 'Rooster',        hi: 'मुर्गा',     url: '/sounds/rooster.mp3' },
      { id: 'sad_trombone',  label: 'Sad trombone',   hi: 'उदास',       url: '/sounds/sad_trombone.mp3' },
      { id: 'windows_xp',   label: 'Windows XP',     hi: 'एरर',        url: '/sounds/windows_xp.mp3' },
      { id: 'vine_boom',     label: 'Vine boom',      hi: 'धमाका',      url: '/sounds/vine_boom.mp3' },
      { id: 'bruh',          label: 'Bruh',           hi: 'ब्रुह',      url: '/sounds/bruh.mp3' },
      { id: 'mlg_airhorn',   label: 'MLG airhorn',    hi: 'हॉर्न',      url: '/sounds/mlg_airhorn.mp3' },
      { id: 'crickets',      label: 'Crickets',       hi: 'झींगुर',     url: '/sounds/crickets.mp3' },
      { id: 'price_is_right',label: 'Price is Right', hi: 'हारे',       url: '/sounds/price_is_right.mp3' },
      { id: 'nyan_cat',      label: 'Nyan Cat',       hi: 'न्यान',      url: '/sounds/nyan_cat.mp3' },
      { id: 'among_us',      label: 'Among Us',       hi: 'इम्पोस्टर',  url: '/sounds/among_us.mp3' },
      { id: 'discord',       label: 'Discord',        hi: 'डिस्कॉर्ड',  url: '/sounds/discord.mp3' },
    ],
  },
  {
    group: 'Scary',
    hi: 'डरावना',
    sounds: [
      { id: 'horror_sting',    label: 'Horror sting',    hi: 'भयावह',    url: '/sounds/horror_sting.mp3' },
      { id: 'halloween_organ', label: 'Halloween organ', hi: 'हैलोवीन',  url: '/sounds/halloween_organ.mp3' },
      { id: 'creaking_door',   label: 'Creaking door',   hi: 'चरमराहट', url: '/sounds/creaking_door.mp3' },
      { id: 'jumpscare',       label: 'Jump scare',      hi: 'डर',       url: '/sounds/jumpscare.mp3' },
      { id: 'heartbeat',       label: 'Heartbeat',       hi: 'दिल',      url: '/sounds/heartbeat.mp3' },
      { id: 'thunder',         label: 'Thunder',         hi: 'गरज',      url: '/sounds/thunder.mp3' },
      { id: 'clock_alarm',     label: 'Clock alarm',     hi: 'अलार्म',   url: '/sounds/clock_alarm.mp3' },
      { id: 'demon_whisper',   label: 'Demon whisper',   hi: 'राक्षस',   url: '/sounds/demon_whisper.mp3' },
    ],
  },
];

// Flat list for lookups (playNotifSound, etc.)
export const NOTIF_SOUNDS = NOTIF_SOUND_GROUPS.flatMap(g => g.sounds);

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
