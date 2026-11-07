// 台本から声の付く台詞を抜き出して tools/lines.json に書く（声を作るスクリプトが読む）
import { SCRIPTS, CHARAS } from '../src/story.js';
import { writeFileSync } from 'fs';
const out = [];
for (const [label, cmds] of Object.entries(SCRIPTS)) {
  for (const c of cmds) if (c.s && c.v) out.push({ id: c.v, speaker: c.s, name: CHARAS[c.s].name, label, text: c.t, face: c.e || 'neutral' });
}
writeFileSync(new URL('./lines.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(out.length + ' lines');
