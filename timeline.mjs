export const DEFAULTS = Object.freeze({ preparation: 10, exercise: 20, rest: 10, rounds: 8, cycles: 3, cycleRest: 60, recovery: 120, countdown: true });
export const DEMO = Object.freeze({ preparation: 3, exercise: 6, rest: 3, rounds: 2, cycles: 2, cycleRest: 6, recovery: 6, countdown: true });
export const PHASES = Object.freeze({
  preparation: { label: 'Préparation', instruction: 'Installe-toi. La séance va commencer.', frequency: 660 },
  exercise: { label: 'Exercice', instruction: 'À toi de jouer.', frequency: 1175 },
  rest: { label: 'Repos', instruction: 'Souffle avant le prochain round.', frequency: 880 },
  cycleRest: { label: 'Repos entre cycles', instruction: 'Un cycle terminé. Prends le temps de souffler.', frequency: 784 },
  recovery: { label: 'Récupération finale', instruction: 'Les exercices sont terminés. Récupère tranquillement.', frequency: 880 },
});
const FIELDS = {
  preparation: ['La préparation', 0, 600], exercise: ['La durée d’exercice', 1, 1800],
  rest: ['Le repos entre rounds', 0, 1800], rounds: ['Le nombre de rounds', 1, 50],
  cycles: ['Le nombre de cycles', 1, 20], cycleRest: ['Le repos entre cycles', 0, 1800],
  recovery: ['La récupération finale', 0, 1800],
};
export function validateConfig(input) {
  const value = {};
  for (const [key, [label, min, max]] of Object.entries(FIELDS)) {
    const raw = input[key];
    if ((typeof raw !== 'number' && typeof raw !== 'string') || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) {
      throw new RangeError(`${label} doit être un nombre entier entre ${min} et ${max}.`);
    }
    value[key] = Number(raw);
  }
  value.countdown = input.countdown !== false;
  if (value.rounds * value.cycles > 400) throw new RangeError('Choisis au maximum 400 rounds au total.');
  const total = value.preparation + value.cycles * (value.rounds * value.exercise + (value.rounds - 1) * value.rest) + (value.cycles - 1) * value.cycleRest + value.recovery;
  if (total > 3600) throw new RangeError('Cette première version accepte des séances de 60 minutes maximum. Réduis les durées ou le nombre de rounds.');
  return Object.freeze(value);
}
export function buildSession(input) {
  const config = validateConfig(input);
  const phases = [];
  let cursor = 0;
  function add(type, duration, cycle = 0, round = 0) {
    if (duration === 0) return;
    phases.push(Object.freeze({ type, duration, start: cursor, end: cursor + duration, cycle, round, ...PHASES[type] }));
    cursor += duration;
  }
  add('preparation', config.preparation);
  for (let cycle = 1; cycle <= config.cycles; cycle++) {
    for (let round = 1; round <= config.rounds; round++) {
      add('exercise', config.exercise, cycle, round);
      if (round < config.rounds) add('rest', config.rest, cycle, round);
    }
    if (cycle < config.cycles) add('cycleRest', config.cycleRest, cycle, config.rounds);
  }
  add('recovery', config.recovery, config.cycles, config.rounds);
  return Object.freeze({ config, phases: Object.freeze(phases), duration: cursor, exercises: config.cycles * config.rounds });
}
export function stateAt(session, seconds) {
  let elapsed = Math.max(0, Math.min(session.duration, Number.isFinite(seconds) ? seconds : 0));
  const tolerance = 1e-6;
  if (elapsed >= session.duration - tolerance) elapsed = session.duration;
  if (elapsed >= session.duration) return { phase: null, index: session.phases.length, phaseRemaining: 0, totalRemaining: 0, elapsed, done: true };
  let low = 0, high = session.phases.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (session.phases[middle].end <= elapsed + tolerance) low = middle + 1;
    else high = middle;
  }
  const phase = session.phases[low];
  if (Math.abs(elapsed - phase.start) < tolerance) elapsed = phase.start;
  return { phase, index: low, phaseRemaining: phase.end - elapsed, totalRemaining: session.duration - elapsed, elapsed, done: false };
}
export function extendPhaseAt(session, seconds, extraSeconds = 5) {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(extraSeconds) || extraSeconds <= 0) {
    throw new RangeError('Prolongation invalide.');
  }
  const state = stateAt(session, seconds);
  if (state.done || state.phase.type === 'preparation') {
    throw new RangeError('La prolongation est disponible pendant un exercice ou un repos.');
  }
  const phases = session.phases.map((phase, index) => {
    if (index < state.index) return phase;
    if (index === state.index) return Object.freeze({ ...phase, duration: phase.duration + extraSeconds, end: phase.end + extraSeconds, extraSeconds: (phase.extraSeconds || 0) + extraSeconds });
    return Object.freeze({ ...phase, start: phase.start + extraSeconds, end: phase.end + extraSeconds });
  });
  return Object.freeze({ ...session, phases: Object.freeze(phases), duration: session.duration + extraSeconds });
}
export function sessionCues(session) {
  const cues = [];
  for (const phase of session.phases) {
    const paired = phase.type === 'cycleRest' || phase.type === 'recovery';
    const duration = paired ? .2 : phase.type === 'exercise' ? .52 : phase.type === 'rest' ? .46 : .28;
    cues.push({ time: phase.start, duration, frequency: phase.frequency, gain: phase.type === 'preparation' ? .55 : .92, kind: 'transition', timbre: 'alert' });
    if (paired) cues.push({ time: phase.start + .3, duration: .2, frequency: phase.frequency, gain: .92, kind: 'transition', timbre: 'alert' });
    if (session.config.countdown && phase.duration >= 4) {
      for (const remaining of [3, 2, 1]) cues.push({ time: phase.end - remaining, duration: .09, frequency: 880, gain: .32, kind: 'countdown', timbre: 'sine' });
    }
  }
  for (const offset of [0, .26, .52]) cues.push({ time: session.duration + offset, duration: .18, frequency: 1175, gain: .92, kind: 'finish', timbre: 'alert' });
  return cues.sort((a, b) => a.time - b.time);
}
export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function formatDuration(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)} min${value % 60 ? ` ${value % 60} s` : ''}`;
}
