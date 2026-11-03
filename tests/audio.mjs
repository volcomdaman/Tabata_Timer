import assert from 'node:assert/strict';
import { TESTS, createTestWav, formatTime } from '../audio.mjs';
for (const [name, config] of Object.entries(TESTS)) {
  const blob = createTestWav(config);
  const bytes = await blob.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal((bytes.byteLength - 44) / 32000, config.duration);
  const energy = (start, duration = .12) => {
    let sum = 0;
    const from = Math.floor(start * 16000);
    const count = Math.floor(duration * 16000);
    for (let i = from; i < from + count; i++) sum += Math.abs(view.getInt16(44 + i * 2, true));
    return sum / count;
  };
  for (const cue of config.cues) assert.ok(energy(cue + .02) > 2000, `${name}: missing cue ${cue}`);
  for (const delay of [0, .3, .6]) assert.ok(energy(config.ending + delay + .02) > 2000, `${name}: missing final cue`);
  assert.equal(energy(1), 0);
  assert.equal(energy(config.ending - 1), 0);
  console.log(`${name}: WAV duration, header, silence and all beeps verified`);
}
assert.equal(formatTime(180), '03:00');
assert.equal(formatTime(29.2), '00:30');
assert.equal(formatTime(-1), '00:00');
assert.throws(() => createTestWav({ duration: 0 }), RangeError);
console.log('All audio checks passed');

