import { TESTS, createTestWav, formatTime } from './audio.mjs';
const $ = id => document.getElementById(id);
const audio = $('audio');
let selected = 'long';
let prepared = false;
let objectUrl = null;
let wakeLock = null;
let requestingWake = false;
let completed = false;
function config() { return TESTS[selected]; }
function showError(message = '') {
  $('error').textContent = message;
  $('error').hidden = !message;
}
function setState(message, active = false) {
  $('state').textContent = message;
  $('state').dataset.active = String(active);
}
function wakeMessage(message, active = false) {
  $('wake').textContent = message;
  $('wake-dot').classList.toggle('active', active);
}
async function requestWake() {
  if (wakeLock || requestingWake || audio.paused || document.visibilityState !== 'visible') return;
  if (!('wakeLock' in navigator)) {
    wakeMessage('Maintien de l’écran indisponible ici. Vérifie la version d’iOS.');
    return;
  }
  requestingWake = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (audio.paused || document.visibilityState !== 'visible') { await lock.release(); return; }
    wakeLock = lock;
    wakeMessage('Écran maintenu allumé pendant le test.', true);
    lock.addEventListener('release', () => {
      if (wakeLock === lock) {
        wakeLock = null;
        wakeMessage(audio.paused ? 'Écran : veille automatique autorisée.' : 'Maintien de l’écran relâché par le système.');
      }
    });
  } catch {
    wakeMessage('Le système refuse le maintien de l’écran. Vérifie le mode économie d’énergie.');
  } finally { requestingWake = false; }
}
async function releaseWake() {
  const lock = wakeLock;
  wakeLock = null;
  if (lock) { try { await lock.release(); } catch {} }
  wakeMessage('Écran : veille automatique autorisée.');
}
function prepareAudio() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(createTestWav(config()));
  audio.src = objectUrl;
  prepared = true;
  completed = false;
}
function updateMediaPosition() {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && prepared) {
    try { navigator.mediaSession.setPositionState({ duration: config().duration, playbackRate: 1, position: Math.min(config().duration, Math.max(0, audio.currentTime)) }); } catch {}
  }
}
function render() {
  const duration = config().duration;
  const elapsed = completed ? duration : prepared ? Math.min(duration, audio.currentTime || 0) : 0;
  $('clock').textContent = formatTime(duration - elapsed);
  $('progress').style.width = `${elapsed / duration * 100}%`;
  if (!prepared) $('next').textContent = 'Un premier bip sera émis au démarrage.';
  else if (completed) $('next').textContent = 'Test terminé. Note les deux résultats ci-dessous.';
  else {
    const future = config().cues.find(time => time > elapsed + .25);
    $('next').textContent = future === undefined
      ? 'Prochain signal : trois bips juste avant la fin.'
      : `Prochain bip à ${formatTime(future)} après le démarrage.`;
  }
  $('start').textContent = !prepared || completed ? '▶ Lancer le test' : audio.paused ? '▶ Reprendre le test' : 'Ⅱ Mettre en pause';
  $('reset').disabled = !prepared;
  $('choices').disabled = prepared && !completed;
  updateMediaPosition();
}
function configureMedia() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'Tabata — test iPhone', artist: 'Test des sons écran verrouillé', album: 'Ton chronomètre personnel' }); } catch {}
  for (const [name, handler] of Object.entries({ play: () => start(), pause: () => audio.pause(), stop: () => reset() })) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
  }
}
function start() {
  showError();
  try {
    configureMedia();
    if (!prepared || completed) prepareAudio();
    audio.play()?.catch(() => {
      setState('À relancer');
      showError('La lecture n’a pas démarré. Ouvre le lecteur audio ci-dessus et touche Lecture, ou réessaie directement dans Safari.');
      render();
    });
  } catch {
    showError('Impossible de préparer la piste audio dans ce navigateur. Réessaie directement dans Safari.');
  }
}
function reset() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  prepared = false;
  completed = false;
  showError();
  setState('Prêt');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  void releaseWake();
  render();
}
$('start').addEventListener('click', () => audio.paused ? start() : audio.pause());
$('reset').addEventListener('click', reset);
document.querySelectorAll('input[name="test"]').forEach(radio => radio.addEventListener('change', () => {
  selected = radio.value;
  reset();
}));
audio.addEventListener('playing', () => {
  completed = false;
  setState('En cours', true);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  void requestWake();
  render();
});
audio.addEventListener('pause', () => {
  if (prepared && !audio.ended) setState('En pause');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  void releaseWake();
  render();
});
audio.addEventListener('ended', () => {
  completed = true;
  setState('Terminé');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  void releaseWake();
  render();
});
audio.addEventListener('timeupdate', render);
audio.addEventListener('seeked', render);
audio.addEventListener('error', () => {
  if (!prepared) return;
  setState('Lecture interrompue');
  showError('Le navigateur ne parvient pas à lire la piste. Recommence le test directement dans Safari.');
  void releaseWake();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { render(); void requestWake(); }
});
for (const id of ['result-screen', 'result-audio']) {
  try { $(id).checked = localStorage.getItem(`tabata-test-${id}`) === 'yes'; } catch {}
  $(id).addEventListener('change', () => {
    try { localStorage.setItem(`tabata-test-${id}`, $(id).checked ? 'yes' : 'no'); } catch {}
  });
}
render();

