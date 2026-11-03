import { sessionCues } from './timeline.mjs?v=5';
// Une seule piste conserve les sons quand Safari passe en arrière-plan.
// Après une prolongation, seule la partie restant à jouer est reconstruite.
export function createWorkoutWav(session, sampleRate = 16000, fromTime = 0) {
  if (!Number.isFinite(fromTime) || fromTime < 0 || fromTime > session.duration || !Number.isSafeInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000) {
    throw new RangeError('Position audio invalide.');
  }
  const cues = sessionCues(session);
  const firstSample = Math.round(fromTime * sampleRate);
  const endSample = Math.round((session.duration + .85) * sampleRate);
  const samples = endSample - firstSample;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
  const parts = [header];
  const silence = new Uint8Array(sampleRate * 2 * 4);
  const alertNormalization = Math.tanh(1.6);
  let cursor = firstSample;
  function pad(count) {
    let bytes = count * 2;
    while (bytes > 0) {
      const take = Math.min(bytes, silence.byteLength);
      parts.push(take === silence.byteLength ? silence : silence.subarray(0, take));
      bytes -= take;
    }
  }
  for (const cue of cues) {
    const cueStart = Math.round(cue.time * sampleRate);
    const cueLength = Math.round(cue.duration * sampleRate);
    const start = Math.max(cueStart, firstSample);
    const end = Math.min(cueStart + cueLength, endSample);
    if (end <= start) continue;
    if (start < cursor) throw new Error('Deux signaux audio se chevauchent.');
    pad(start - cursor);
    const length = end - start;
    const buffer = new ArrayBuffer(length * 2);
    const data = new DataView(buffer);
    for (let i = 0; i < length; i++) {
      const position = start - cueStart + i;
      const fade = Math.min(1, position / (sampleRate * .008), (cueLength - position) / (sampleRate * .018));
      const sine = Math.sin(2 * Math.PI * cue.frequency * position / sampleRate);
      const wave = cue.timbre === 'alert' ? Math.tanh(1.6 * sine) / alertNormalization : sine;
      data.setInt16(i * 2, Math.round(wave * cue.gain * fade * 32767), true);
    }
    parts.push(buffer);
    cursor = end;
  }
  pad(endSample - cursor);
  return new Blob(parts, { type: 'audio/wav' });
}
