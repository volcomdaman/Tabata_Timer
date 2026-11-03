export const TESTS = Object.freeze({
  short: { duration: 30, cues: [0, 5, 10, 20], ending: 29.1 },
  long: { duration: 180, cues: [0, 10, 30, 90, 150], ending: 179.1 },
});

// Une seule piste contient tous les bips, indépendamment des callbacks
// JavaScript lorsque le navigateur passe en arrière-plan.
export function createTestWav(config, sampleRate = 16000) {
  if (!Number.isInteger(config.duration) || config.duration < 1 || config.duration > 600) {
    throw new RangeError('Durée du test invalide.');
  }
  const sampleCount = config.duration * sampleRate;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const putText = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  putText(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); putText(8, 'WAVE');
  putText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); putText(36, 'data'); view.setUint32(40, sampleCount * 2, true);
  const tone = (start, length, frequency) => {
    const first = Math.round(start * sampleRate);
    const count = Math.round(length * sampleRate);
    for (let i = 0; i < count && first + i < sampleCount; i++) {
      const fade = Math.min(1, i / (sampleRate * .012), (count - i) / (sampleRate * .025));
      const value = Math.round(Math.sin(2 * Math.PI * frequency * i / sampleRate) * .28 * fade * 32767);
      view.setInt16(44 + (first + i) * 2, value, true);
    }
  };
  config.cues.forEach((time, index) => tone(time, .22, index === 0 ? 660 : 880));
  [0, .3, .6].forEach(delay => tone(config.ending + delay, .2, 1175));
  return new Blob([buffer], { type: 'audio/wav' });
}

export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
