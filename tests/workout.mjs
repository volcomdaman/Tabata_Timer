import assert from 'node:assert/strict';
import { DEFAULTS, DEMO, buildSession, validateConfig, stateAt, sessionCues, formatTime } from '../timeline.mjs';
import { createWorkoutWav } from '../workout-audio.mjs';
const demo = buildSession(DEMO);
assert.equal(demo.duration, 45);
assert.equal(buildSession(DEFAULTS).duration, 940);
assert.deepEqual(demo.phases.map(p => [p.type, p.start, p.end]), [
 ['preparation',0,3],['exercise',3,9],['rest',9,12],['exercise',12,18],['cycleRest',18,24],
 ['exercise',24,30],['rest',30,33],['exercise',33,39],['recovery',39,45],
]);
assert.equal(demo.phases.filter(p => p.type === 'preparation').length, 1);
assert.equal(demo.phases.filter(p => p.type === 'exercise').length, 4);
for (const p of demo.phases) {
  assert.equal(stateAt(demo, p.start).phase, p);
  assert.equal(stateAt(demo, p.end - .001).phase, p);
}
assert.equal(stateAt(demo, 18).phase.type, 'cycleRest');
assert.equal(stateAt(demo, 39).phase.type, 'recovery');
assert.equal(stateAt(demo, 45).done, true);
assert.equal(stateAt(demo, 500).totalRemaining, 0);
assert.equal(stateAt(demo, -2).elapsed, 0);
const single = buildSession({...DEMO,preparation:0,rounds:1,cycles:1,recovery:0});
assert.deepEqual(single.phases.map(p => p.type), ['exercise']);
assert.equal(single.duration, 6);
assert.equal(buildSession({...DEMO,preparation:0,rest:0,cycleRest:0,recovery:0}).phases.every(p => p.type === 'exercise'), true);
for (const value of ['', '1.5', -1, NaN, Infinity, '20 s', null]) assert.throws(() => validateConfig({...DEMO,exercise:value}), RangeError);
assert.throws(() => validateConfig({...DEMO,exercise:0}), RangeError);
assert.throws(() => validateConfig({...DEMO,rounds:50,cycles:20}), RangeError);
assert.throws(() => validateConfig({...DEFAULTS,exercise:1800}), RangeError);
assert.equal(formatTime(29.1), '00:30');
assert.equal(formatTime(0), '00:00');
assert.equal(formatTime(-1), '00:00');
let combinations = 0;
for (const preparation of [0,3]) for (const exercise of [1,6]) for (const rest of [0,3]) for (const rounds of [1,2,4]) for (const cycles of [1,2,3]) for (const cycleRest of [0,6]) for (const recovery of [0,6]) {
  const s = buildSession({preparation,exercise,rest,rounds,cycles,cycleRest,recovery,countdown:true});
  assert.equal(s.phases.filter(p => p.type === 'exercise').length, rounds * cycles);
  assert.equal(s.phases.filter(p => p.type === 'rest').length, rest ? (rounds - 1) * cycles : 0);
  assert.equal(s.phases.filter(p => p.type === 'cycleRest').length, cycleRest ? cycles - 1 : 0);
  assert.equal(s.phases.filter(p => p.type === 'preparation').length, preparation ? 1 : 0);
  assert.equal(s.phases[0].start, 0);
  assert.equal(s.phases.at(-1).end, s.duration);
  s.phases.forEach((p,i) => { if(i) assert.equal(p.start, s.phases[i-1].end); assert.ok(p.duration > 0); });
  const cues = sessionCues(s);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].time >= cues[i-1].time + cues[i-1].duration - .00001, 'Audio cues must not overlap');
  const wav = createWorkoutWav(s, 8000);
  assert.equal(wav.size, 44 + Math.round((s.duration + .85) * 8000) * 2);
  combinations++;
}
const blob = createWorkoutWav(demo);
const buffer = await blob.arrayBuffer();
const wav = new DataView(buffer);
assert.equal(wav.getUint32(24,true), 16000);
assert.equal(wav.getUint16(22,true), 1);
assert.equal(wav.getUint16(34,true), 16);
assert.equal(wav.getUint32(40,true), buffer.byteLength - 44);
function energy(start, duration = .025) {
  let sum = 0;
  const first = Math.round(start * 16000), count = Math.round(duration * 16000);
  for(let i = 0; i < count; i++) sum += Math.abs(wav.getInt16(44 + (first + i) * 2, true));
  return sum / count;
}
for(const cue of sessionCues(demo)) assert.ok(energy(cue.time + .015) > 500, `Missing audio cue at ${cue.time}`);
for(const time of [1,4,10,13,19,25,31,34,40]) assert.equal(energy(time),0,`Expected silence at ${time}`);
assert.ok(sessionCues(demo).some(c => c.kind === 'countdown'));
assert.equal(sessionCues(buildSession({...DEMO,countdown:false})).filter(c => c.kind === 'countdown').length, 0);
const hour = buildSession({...DEMO,preparation:0,exercise:1800,rest:0,rounds:2,cycles:1,recovery:0});
assert.equal(hour.duration,3600);
assert.equal(createWorkoutWav(hour).size,44 + Math.round(3600.85 * 16000) * 2);
console.log(`Passed: exact phase sequence, boundary rules, zero durations, validation, ${combinations} configurations, audio timing and 60-minute track.`);
