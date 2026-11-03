import { DEFAULTS, DEMO, buildSession, stateAt, extendPhaseAt, formatTime, formatDuration } from './timeline.mjs?v=5';
import { createWorkoutWav } from './workout-audio.mjs?v=5';
const $ = id => document.getElementById(id);
const audio = $('audio');
const keys = ['preparation', 'exercise', 'rest', 'rounds', 'cycles', 'cycleRest', 'recovery'];
const storageKey = 'tabata-workout-config-v1';
let preview = buildSession(DEFAULTS), validConfig = preview.config, active = null;
let objectUrl = null, finished = false, starting = false, generation = 0, frame = 0;
let wakeLock = null, requestingWake = false, lastPhaseIndex = -1;
let editing = false, draftValid = true, editingKey = null;
let audioOffset = 0, replacingAudio = false, replacementAnchor = 0, resumeReplacement = false;
function text(id, value) { if ($(id).textContent !== String(value)) $(id).textContent = value; }
function error(message = '') { text('error', message); $('error').hidden = !message; }
function setWake(message, on = false) { text('wake', message); $('wake-dot').classList.toggle('active', on); }
function readForm() {
  return Object.fromEntries([...keys.map(key => [key, $(key).value]), ['countdown', $('countdown').checked]]);
}
function fillForm(config) {
  for (const key of keys) $(key).value = config[key];
  $('countdown').checked = config.countdown;
  updateConfig();
}
function updateConfig() {
  try {
    const candidate = buildSession(readForm());
    draftValid = true;
    $('config-error').hidden = true;
    text('settings-duration', formatTime(candidate.duration));
    for (const key of keys) {
      const value = candidate.config[key];
      document.querySelector(`[data-value="${key}"]`).textContent = key === 'rounds' || key === 'cycles' ? value : formatTime(value);
    }
    if (!editing) {
      preview = candidate;
      validConfig = preview.config;
      try { localStorage.setItem(storageKey, JSON.stringify(validConfig)); } catch {}
    }
  } catch (cause) {
    draftValid = false;
    if (!editing) validConfig = null;
    text('config-error', cause.message);
    $('config-error').hidden = false;
    text('settings-duration', '—');
  }
  render();
}
async function requestWake() {
  if (wakeLock || requestingWake || audio.paused || document.visibilityState !== 'visible') return;
  if (!('wakeLock' in navigator)) { setWake('Maintien de l’écran indisponible dans ce navigateur.'); return; }
  requestingWake = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (audio.paused || document.visibilityState !== 'visible') { await lock.release(); return; }
    wakeLock = lock;
    setWake('Écran maintenu allumé', true);
    lock.addEventListener('release', () => {
      if (wakeLock === lock) { wakeLock = null; setWake(audio.paused ? 'Veille automatique autorisée' : 'Maintien de l’écran relâché par le système'); }
    });
  } catch { setWake('Maintien de l’écran refusé par le système'); }
  finally { requestingWake = false; }
}
async function releaseWake() {
  const lock = wakeLock;
  wakeLock = null;
  if (lock) { try { await lock.release(); } catch {} }
  setWake('Veille automatique autorisée');
}
function positionMedia() {
  if (active && !replacingAudio && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    const duration = active.duration + .85 - audioOffset;
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(duration, Math.max(0, audio.currentTime || 0)) }); } catch {}
  }
}
function updateMediaTitle(phase) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: phase ? `Tabata — ${phase.label}` : 'Tabata — séance terminée', artist: 'Ton chronomètre personnel', album: 'Ma séance' });
  } catch {}
}
function render() {
  const plan = active || preview;
  const state = stateAt(plan, active ? elapsedTime() : 0);
  const phase = state.phase;
  const idle = !active;
  const type = state.done ? 'done' : phase.type;
  $('app-shell').dataset.phase = type;
  $('timer-card').dataset.phase = type;
  text('phase-label', state.done ? 'Séance terminée' : phase.label);
  const clockTime = formatTime(state.phaseRemaining);
  const [clockMinutes, clockSeconds] = clockTime.split(':');
  text('clock-minutes', clockMinutes);
  text('clock-seconds', clockSeconds);
  $('clock').setAttribute('aria-label', `Temps restant dans la phase : ${clockTime}`);
  text('total-remaining', formatTime(state.totalRemaining));
  let roundsLeft = 0, cyclesLeft = 0;
  if (!state.done && phase.type !== 'recovery') {
    if (phase.type === 'preparation') { roundsLeft = plan.config.rounds; cyclesLeft = plan.config.cycles; }
    else if (phase.type === 'cycleRest') { cyclesLeft = plan.config.cycles - phase.cycle; }
    else { roundsLeft = plan.config.rounds - phase.round + (phase.type === 'exercise' ? 1 : 0); cyclesLeft = plan.config.cycles - phase.cycle + 1; }
  }
  text('round-count', roundsLeft);
  text('cycle-count', cyclesLeft);
  text('run-state', idle ? 'Prêt' : finished ? 'Terminé' : starting ? 'Chargement' : state.done ? 'Signal final' : audio.paused ? 'En pause' : 'En cours');
  const next = state.done ? null : plan.phases[state.index + 1];
  text('next-label', next ? next.label : 'Séance terminée');
  text('next-time', next ? formatTime(next.duration) : '—');
  $('next-panel').dataset.phase = next ? next.type : 'done';
  const progress = state.elapsed / plan.duration * 100;
  $('progress').style.width = `${progress}%`;
  $('session-progress').setAttribute('aria-valuenow', String(Math.round(progress)));
  text('progress-label', `${Math.round(progress)} %`);
  text('position-label', idle ? `${plan.config.cycles} cycles · ${plan.config.rounds} rounds` : state.done ? 'Entraînement terminé' : phase.type === 'recovery' ? 'Récupération finale' : phase.type === 'preparation' ? `${plan.exercises} exercices à venir` : `Cycle ${phase.cycle}/${plan.config.cycles} · Round ${phase.round}/${plan.config.rounds}`);
  const phaseProgress = phase ? (1 - state.phaseRemaining / phase.duration) * 100 : 100;
  $('phase-progress').style.width = `${phaseProgress}%`;
  $('start').disabled = starting || ((!active || finished) && !validConfig) || (!!active && state.done && !finished);
  const mode = idle ? 'start' : finished ? 'replay' : starting ? 'loading' : state.done ? 'finishing' : audio.paused ? 'resume' : 'pause';
  const controlLabels = {start:['Commencer','Commencer la séance'], replay:['Refaire','Refaire la séance'], loading:['Chargement','Préparation du son'], finishing:['Terminé','Signal final en cours'], resume:['Reprendre','Reprendre la séance'], pause:['Pause','Mettre en pause']};
  text('start-label', controlLabels[mode][0]);
  $('start').setAttribute('aria-label', controlLabels[mode][1]);
  $('play-icon').toggleAttribute('hidden', mode === 'pause' || mode === 'replay');
  $('pause-icon').toggleAttribute('hidden', mode !== 'pause');
  $('replay-icon').toggleAttribute('hidden', mode !== 'replay');
  $('reset').disabled = !active;
  $('skip').disabled = !active || finished || state.done || starting;
  $('add-five').disabled = !active || finished || state.done || phase.type === 'preparation' || (starting && !replacingAudio);
  $('settings-fields').disabled = !!active && !finished;
  $('settings-save').disabled = !draftValid || (!!active && !finished);
  text('settings-note', active && !finished ? 'Réinitialise la séance pour modifier ces réglages.' : 'Les réglages sont conservés sur cet appareil après enregistrement.');
  if (active && state.index !== lastPhaseIndex) {
    lastPhaseIndex = state.index;
    text('announcement', state.done ? 'Séance terminée' : `${phase.label}${phase.type === 'exercise' ? `, cycle ${phase.cycle}, round ${phase.round}` : ''}`);
    updateMediaTitle(phase);
  }
  positionMedia();
}
function animate() {
  if (audio.paused || document.visibilityState !== 'visible') { frame = 0; return; }
  render();
  frame = requestAnimationFrame(animate);
}
function runAnimation() { if (!frame && document.visibilityState === 'visible') frame = requestAnimationFrame(animate); }
function elapsedTime() {
  return replacingAudio ? replacementAnchor : audioOffset + (audio.currentTime || 0);
}
function completePausedReplacement() {
  if (!active || !replacingAudio || resumeReplacement || audio.currentSrc !== objectUrl || audio.readyState < 1) return;
  replacingAudio = false;
  starting = false;
  render();
}
function pausePlayback() {
  resumeReplacement = false;
  audio.pause();
  completePausedReplacement();
}
function addFive() {
  if (!active || finished || (starting && !replacingAudio)) return;
  let at = elapsedTime();
  const state = stateAt(active, at);
  at = state.elapsed;
  if (state.done || state.phase.type === 'preparation') return;
  const previousPlan = active;
  const previousReplacing = replacingAudio;
  const previousStarting = starting;
  const previousAnchor = replacementAnchor;
  const shouldPlay = replacingAudio ? resumeReplacement : !audio.paused;
  const planned = extendPhaseAt(active, at, 5);
  const ticket = ++generation;
  replacingAudio = true;
  replacementAnchor = at;
  resumeReplacement = shouldPlay;
  starting = true;
  audio.pause();
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  let nextUrl;
  try {
    nextUrl = URL.createObjectURL(createWorkoutWav(planned, 16000, at));
  } catch {
    active = previousPlan;
    replacingAudio = previousReplacing;
    replacementAnchor = previousAnchor;
    starting = previousStarting;
    resumeReplacement = shouldPlay;
    error('Impossible d’ajouter du temps. Réessaie après quelques secondes.');
    if (shouldPlay) audio.play()?.catch(() => {});
    render();
    return;
  }
  active = planned;
  audioOffset = at;
  const oldUrl = objectUrl;
  objectUrl = nextUrl;
  audio.src = nextUrl;
  audio.volume = 1;
  audio.load();
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  error();
  text('announcement', `5 secondes ajoutées. Il reste ${formatTime(stateAt(active, at).phaseRemaining)} dans cette phase.`);
  render();
  if (shouldPlay) {
    audio.play()?.catch(cause => {
      if (ticket !== generation) return;
      if (cause.name === 'AbortError' && !resumeReplacement) { completePausedReplacement(); return; }
      replacingAudio = false;
      starting = false;
      resumeReplacement = false;
      error('Le temps a été ajouté. Touche Reprendre pour relancer le son.');
      void releaseWake();
      render();
    });
  } else {
    completePausedReplacement();
  }
}
function configureAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!('mediaSession' in navigator)) return;
  for (const [name, handler] of Object.entries({ play: start, pause: pausePlayback, stop: reset, nexttrack: skip })) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
  }
}
function prepare() {
  const planned = buildSession(readForm());
  const blob = createWorkoutWav(planned);
  active = planned;
  audioOffset = 0;
  replacingAudio = false;
  replacementAnchor = 0;
  resumeReplacement = false;
  audio.volume = 1;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  audio.src = objectUrl;
  finished = false;
  lastPhaseIndex = -1;
  showScreen('training');
}
function start() {
  if (starting) return;
  error();
  const ticket = ++generation;
  try {
    configureAudio();
    if (!active || finished) prepare();
    starting = true;
    render();
    audio.play()?.catch(() => {
      if (ticket !== generation) return;
      starting = false;
      error('Le son n’a pas démarré. Touche Reprendre, ou ouvre le lecteur audio ci-dessous pour lancer la lecture directement.');
      render();
    });
  } catch (cause) {
    starting = false;
    if (!objectUrl) active = null;
    error(cause instanceof RangeError ? cause.message : 'Impossible de préparer le son. Réduis la durée de la séance et réessaie.');
    render();
  }
}
function reset() {
  ++generation;
  active = null;
  finished = false;
  starting = false;
  lastPhaseIndex = -1;
  audioOffset = 0;
  replacingAudio = false;
  replacementAnchor = 0;
  resumeReplacement = false;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  void releaseWake();
  error();
  text('announcement', '');
  updateConfig();
}
function skip() {
  if (!active || finished || starting) return;
  const state = stateAt(active, elapsedTime());
  if (state.done) return;
  audio.currentTime = Math.max(0, state.phase.end - audioOffset);
  render();
}
$('start').addEventListener('click', () => active && !finished && !audio.paused ? pausePlayback() : start());
$('add-five').addEventListener('click', addFive);
$('reset').addEventListener('click', reset);
$('skip').addEventListener('click', skip);
$('settings-form').addEventListener('input', updateConfig);
$('settings-form').addEventListener('submit', saveSettings);
$('preset-default').addEventListener('click', () => fillForm(DEFAULTS));
$('preset-demo').addEventListener('click', () => fillForm(DEMO));
audio.addEventListener('loadedmetadata', completePausedReplacement);
audio.addEventListener('playing', () => {
  if (!active || (objectUrl && audio.currentSrc !== objectUrl)) return;
  replacingAudio = false;
  resumeReplacement = false;
  starting = false;
  finished = false;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  void requestWake();
  render();
  runAnimation();
});
audio.addEventListener('pause', () => {
  if (!active || replacingAudio || !audio.paused) return;
  starting = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  void releaseWake();
  render();
});
audio.addEventListener('ended', () => {
  if (!active || replacingAudio || !audio.ended) return;
  finished = true;
  starting = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  void releaseWake();
  render();
});
audio.addEventListener('timeupdate', render);
audio.addEventListener('seeked', () => {
  if (replacingAudio) return;
  if (active && elapsedTime() < active.duration) finished = false;
  render();
});
audio.addEventListener('error', () => {
  if (!active || !audio.error) return;
  starting = false;
  replacingAudio = false;
  resumeReplacement = false;
  error('La lecture audio a été interrompue. Réinitialise la séance et relance-la dans Safari.');
  void releaseWake();
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { render(); void requestWake(); runAnimation(); }
  else if (frame) { cancelAnimationFrame(frame); frame = 0; }
});
const fieldMeta = {
  preparation: {label:'Préparation', description:'Une seule fois avant de commencer', min:0, max:600},
  exercise: {label:'Exercice', description:'Durée de chaque effort', min:1, max:1800},
  rest: {label:'Repos', description:'Entre les exercices du cycle', min:0, max:1800},
  rounds: {label:'Rounds', description:'Nombre d’exercices dans chaque cycle', min:1, max:50, count:true},
  cycles: {label:'Cycles', description:'Nombre de séries de rounds', min:1, max:20, count:true},
  cycleRest: {label:'Repos entre cycles', description:'Remplace le repos du dernier round', min:0, max:1800},
  recovery: {label:'Récupération', description:'Après le tout dernier exercice', min:0, max:1800},
};
function showScreen(view) {
  const settings = view === 'settings';
  $('app-shell').dataset.view = view;
  $('training-screen').hidden = settings;
  $('settings-screen').hidden = !settings;
  $('nav-training').classList.toggle('is-active', !settings);
  $('nav-settings').classList.toggle('is-active', settings);
  for (const [id, selected] of [['nav-training',!settings], ['nav-settings',settings]]) {
    if (selected) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
  }
  document.title = settings ? 'Réglages — Mon Tabata' : 'Mon Tabata — Chronomètre';
}
function openSettings() {
  if (!editing) { editing = true; fillForm(preview.config); $('settings-content').scrollTop = 0; }
  showScreen('settings');
}
function cancelSettings() {
  editing = false;
  fillForm(preview.config);
  showScreen('training');
}
function saveSettings(event) {
  event.preventDefault();
  if (active && !finished) return;
  updateConfig();
  if (!draftValid) return;
  editing = false;
  if (active) reset(); else updateConfig();
  showScreen('training');
}
function openEditor(key) {
  if ($('settings-fields').disabled) return;
  const meta = fieldMeta[key];
  editingKey = key;
  text('editor-title', meta.label);
  text('editor-description', meta.description);
  $('duration-editor').hidden = !!meta.count;
  $('count-editor').hidden = !meta.count;
  const value = Number($(key).value);
  $('editor-minutes').value = Math.floor(value / 60);
  $('editor-seconds').value = value % 60;
  $('editor-number').value = value;
  $('editor-number').min = meta.min;
  $('editor-number').max = meta.max;
  $('editor-minutes').max = Math.floor(meta.max / 60);
  $('editor-error').hidden = true;
  text('editor-count-label', meta.count ? `Nombre de ${meta.label.toLowerCase()}` : 'Nombre');
  $('editor-minutes').disabled = !!meta.count;
  $('editor-seconds').disabled = !!meta.count;
  $('editor-number').disabled = !meta.count;
  $('value-editor').showModal();
  const focus = meta.count ? $('editor-number') : $('editor-seconds');
  focus.focus();
  focus.select();
}
function saveEditor(event) {
  event.preventDefault();
  if (!editingKey) return;
  const meta = fieldMeta[editingKey];
  const integer = input => /^\d+$/.test(input.value) && Number.isSafeInteger(Number(input.value));
  const valid = meta.count ? integer($('editor-number')) : integer($('editor-minutes')) && integer($('editor-seconds')) && Number($('editor-seconds').value) <= 59;
  const value = meta.count ? Number($('editor-number').value) : Number($('editor-minutes').value) * 60 + Number($('editor-seconds').value);
  if (!valid || value < meta.min || value > meta.max) {
    text('editor-error', meta.count ? `Choisis un nombre entier entre ${meta.min} et ${meta.max}.` : `Choisis une durée entre ${meta.min} et ${meta.max} secondes, avec des secondes entre 0 et 59.`);
    $('editor-error').hidden = false;
    return;
  }
  $(editingKey).value = value;
  $('value-editor').close();
  editingKey = null;
  updateConfig();
}
$('editor-form').noValidate = true;
$('settings-open').addEventListener('click', openSettings);
$('nav-settings').addEventListener('click', openSettings);
$('nav-training').addEventListener('click', () => editing ? cancelSettings() : showScreen('training'));
$('settings-cancel').addEventListener('click', cancelSettings);
document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.edit)));
$('editor-form').addEventListener('submit', saveEditor);
$('editor-cancel').addEventListener('click', () => { $('value-editor').close(); editingKey = null; });
$('value-editor').addEventListener('cancel', () => { editingKey = null; });
let initial = DEFAULTS;
try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved) initial = buildSession(saved).config; } catch {}
fillForm(initial);
