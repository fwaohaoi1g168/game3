// 台本。文の直しはこのファイルだけでできる。
// n: 地の文（名前なし） / s: 話す人 / t: 台詞 / e: 表情（happy, sad, relaxed, surprised, angry, neutral）
// bgm: 曲を変える（public/bgm/<名前>.ogg。null で止める。ms はつなぐ時間）。area に書くと、その場所の曲の代わりに流す
// choice: 選択肢。set で覚えておく / if + goto: 分かれ道 / area: 場所の切り替え

export const CHARAS = {
  kaho: { name: '夏帆', model: './models/girl_e.vrm' }, // うさ耳の子。背が高いので姉
  rin: { name: '凛', model: './models/girl_d.vrm' }, // 猫耳の子
};

export const AREAS = {
  park: { name: '丘の上の広場' },
  lake: { name: '湖のほとり' },
};

export const SCRIPTS = {
  prologue: [
    { fadeOut: 0 },
    { n: '三年ぶりに、この村へ帰ってきた。' },
    { n: '春の朝。汽車を降りて、花の咲く坂をのぼると、丘の上の広場が見えてくる。' },
    { n: '「着いたら広場の奥まで来て」と、夏帆から手紙が届いていた。' },
    { set: { step: 'meet_kaho' } },
    { area: 'park', pos: [0, 10.5], yaw: 0 },
    { fadeIn: 1000 },
    { banner: true },
  ],

  // ---- 広場：夏帆 ----
  kaho_first: [
    { look: 'kaho' },
    { s: 'kaho', t: 'あ……！ ほんとに来てくれた。おかえり！', e: 'happy', v: 'kaho_first_01' },
    { s: 'kaho', t: '三年ぶりだね。……背、伸びた？ なんか、ちょっと悔しい。', e: 'relaxed', v: 'kaho_first_02' },
    { s: 'kaho', t: '今日は花まつりなんだよ。手紙、間に合ってよかった。', e: 'happy', v: 'kaho_first_03' },
    { s: 'kaho', t: 'わたし、今年は広場の係なの。朝の鐘が鳴るまで、ここを離れられないんだ。', e: 'relaxed', v: 'kaho_first_04' },
    { s: 'kaho', t: '……ほんとはね、凛も一緒に待ってるはずだったの。', e: 'neutral', v: 'kaho_first_05' },
    { n: '凛は夏帆の二つ下の妹だ。昔はよく三人で、この広場で遊んだ。' },
    { s: 'kaho', t: 'でも、ちょっと目を離したら、いなくなってて。', e: 'sad', v: 'kaho_first_06' },
    { s: 'kaho', t: 'ここ何日か、わたしのこと避けてるみたいなんだ。わけを聞いても、教えてくれなくて。', e: 'sad', v: 'kaho_first_07' },
    {
      choice: [
        { t: '探してこようか？', set: { c1: 'offer' } },
        { t: '何かあったの？', set: { c1: 'ask' } },
      ],
    },
    { if: 'c1', eq: 'ask', goto: 'kaho_first_ask' },
    { s: 'kaho', t: 'え、いいの？ 着いたばっかりなのに。', e: 'surprised', v: 'kaho_first_08' },
    { s: 'kaho', t: '……ありがとう。わたしが行くと、たぶん、また逃げられちゃうから。', e: 'relaxed', v: 'kaho_first_09' },
    { goto: 'kaho_first_end' },
  ],
  kaho_first_ask: [
    { s: 'kaho', t: 'それが、わからないの。ケンカした覚えもないし。', e: 'neutral', v: 'kaho_first_ask_01' },
    { s: 'kaho', t: '……もしかしたら、わたしが何か、言いそびれてるのかも。', e: 'sad', v: 'kaho_first_ask_02' },
    { n: '「じゃあ、探してくるよ」と言うと、夏帆は少しほっとした顔をした。' },
    { s: 'kaho', t: 'ありがとう。わたしが行くと、たぶん、また逃げられちゃうから。', e: 'relaxed', v: 'kaho_first_ask_03' },
    { goto: 'kaho_first_end' },
  ],
  kaho_first_end: [
    { s: 'kaho', t: '凛は小さいころから、落ちこむと湖を見に行くの。もしかしたら、そっちかも。', e: 'neutral', v: 'kaho_first_end_01' },
    { s: 'kaho', t: '湖へ下りる階段は、広場の右の奥。花のアーチのところだよ。', e: 'neutral', v: 'kaho_first_end_02' },
    { s: 'kaho', t: '鐘が鳴るまでに、ふたりで戻ってきてね。ここから見る花まつり、ほんとにきれいなんだから。', e: 'happy', v: 'kaho_first_end_03' },
    { set: { step: 'find_rin' } },
    { unlook: true },
  ],
  kaho_again: [
    { look: 'kaho' },
    { s: 'kaho', t: '湖へ下りる階段は、広場の右の奥。花のアーチの先だよ。', e: 'neutral', v: 'kaho_again_01' },
    { unlook: true },
  ],
  kaho_before_rin: [
    { look: 'kaho' },
    { s: 'kaho', t: '凛、いた？ ……そっか。湖のほうも、見てくれた？', e: 'sad', v: 'kaho_before_rin_01' },
    { unlook: true },
  ],

  // ---- 階段 ----
  stairs_locked: [
    { n: '夏帆を待たせている。先に、広場の奥まで行こう。' },
    { pushBack: true },
  ],
  stairs_down: [
    { bgm: null, ms: 1200 },
    { fadeOut: 800 },
    { n: '花の階段を下りると、水のにおいがした。' },
    { area: 'lake', pos: [-28.6, 1.5], yaw: -Math.PI / 2 },
    { fadeIn: 1000 },
    { banner: true },
  ],
  stairs_up: [
    { bgm: null, ms: 1200 },
    { fadeOut: 800 },
    { area: 'park', pos: [10.8, -8], yaw: Math.PI / 2 },
    { fadeIn: 1000 },
    { banner: true },
  ],

  // ---- 湖：凛 ----
  rin_talk: [
    { look: 'rin' },
    { s: 'rin', t: '……あ。帰ってきてたんだ。おかえり。', e: 'surprised', v: 'rin_talk_01' },
    { s: 'rin', t: '三年ぶりだね。こんなところで会うなんて、思わなかった。', e: 'relaxed', v: 'rin_talk_02' },
    { s: 'rin', t: '……お姉ちゃん、心配してた？ ……だよね。', e: 'neutral', v: 'rin_talk_03' },
    { s: 'rin', t: '別に、迷子じゃないよ。ちょっと湖が見たかっただけ。', e: 'neutral', v: 'rin_talk_04' },
    { s: 'rin', t: '……お姉ちゃん、来月からお城の街の学校に行くんだって。聞いた？', e: 'sad', v: 'rin_talk_05' },
    { n: '初めて聞く話だった。' },
    { s: 'rin', t: 'わたしも、お母さんから聞いたの。お姉ちゃんからじゃなくて。', e: 'angry', v: 'rin_talk_06' },
    { s: 'rin', t: 'お姉ちゃんって、大事なことほど言わないんだよね。', e: 'angry', v: 'rin_talk_07' },
    { s: 'rin', t: 'わたし、笑って「おめでとう」って言えなくて。それで、ここに来ちゃった。', e: 'sad', v: 'rin_talk_08' },
    {
      choice: [
        { t: 'さみしいって、言っていいと思う', set: { c2: 'honest' } },
        { t: '一緒に「おめでとう」を言いに行こう', set: { c2: 'together' } },
      ],
    },
    { if: 'c2', eq: 'together', goto: 'rin_together' },
    { s: 'rin', t: '……言っていいのかな。お姉ちゃん、困らない？', e: 'sad', v: 'rin_talk_09' },
    { s: 'rin', t: '……そっか。困らせても、いいのかもね。', e: 'relaxed', v: 'rin_talk_10' },
    { goto: 'rin_end' },
  ],
  rin_together: [
    { s: 'rin', t: '一緒に、か。……ひとりで言うより、ずっと言いやすいかも。', e: 'relaxed', v: 'rin_together_01' },
    { goto: 'rin_end' },
  ],
  rin_end: [
    { s: 'rin', t: '戻ろっか。お姉ちゃん、きっと広場でうろうろしてるよ。', e: 'happy', v: 'rin_end_01' },
    { set: { step: 'ending' } },
    { bgm: null, ms: 1500 },
    { fadeOut: 1000 },
    { n: '朝の鐘が鳴る前に、ふたりで花の階段をのぼった。' },
    { goto: 'ending' },
  ],

  // ---- 結末 ----
  ending: [
    { area: 'park', pos: [0.6, -10.6], yaw: 0, still: true, bgm: 'honne' },
    { place: 'kaho', pos: [1.0, -13.2], face: [0.6, -10.6] },
    { place: 'rin', pos: [-0.3, -13.1], face: [0.6, -10.6] },
    { cam: { pos: [0.35, 1.3, -10.75], look: [0.35, 1.1, -13.15], fov: 36 } },
    { fadeIn: 1000 },
    { s: 'kaho', t: '凛！ ……もう、心配したんだから。', e: 'angry', v: 'ending_01' },
    { s: 'rin', t: '……ごめん。ちょっと、湖。', e: 'sad', v: 'ending_02' },
    { if: 'c2', eq: 'together', goto: 'ending_together' },
    { s: 'rin', t: 'お姉ちゃん。……お城の街に行っちゃうの、さみしい。', e: 'sad', v: 'ending_03' },
    { s: 'kaho', t: '……うん。わたしも、さみしい。', e: 'sad', v: 'ending_04' },
    { s: 'kaho', t: '言ったら、凛が笑ってくれなくなる気がして。言えなかったんだ。', e: 'sad', v: 'ending_05' },
    { goto: 'ending_common' },
  ],
  ending_together: [
    { s: 'rin', t: 'お姉ちゃん。……お城の街の学校、おめでとう。', e: 'relaxed', v: 'ending_together_01' },
    { s: 'kaho', t: 'え……知ってたの？', e: 'surprised', v: 'ending_together_02' },
    { s: 'kaho', t: '……ありがとう、凛。いちばん言ってほしかった。', e: 'happy', v: 'ending_together_03' },
    { goto: 'ending_common' },
  ],
  ending_common: [
    { if: 'c1', eq: 'ask', goto: 'ending_ask' },
    { s: 'kaho', t: '探しに行ってくれて、ありがとう。着いたばっかりだったのにね。', e: 'happy', v: 'ending_common_01' },
    { goto: 'ending_last' },
  ],
  ending_ask: [
    { s: 'kaho', t: '心配かけてごめんね。ほんとは、わたしが先に話せばよかったんだ。', e: 'relaxed', v: 'ending_ask_01' },
    { goto: 'ending_last' },
  ],
  ending_last: [
    { s: 'rin', t: 'ねえ、お姉ちゃん。そろそろ鐘の時間じゃない？', e: 'happy', v: 'ending_last_01' },
    { s: 'kaho', t: 'ほんとだ！ 鐘が鳴ると、村じゅうの風船が上がるの。……ほら、見てて。', e: 'happy', v: 'ending_last_02' },
    { bgm: null, ms: 1500 },
    { place: 'kaho', pos: [1.0, -13.2], face: [1.0, -40] },
    { place: 'rin', pos: [-0.3, -13.1], face: [-0.3, -40] },
    { cam: { pos: [0.35, 1.5, -10.2], look: [0.3, 4.5, -40] } },
    { festival: true },
    { wait: 2500 },
    { bgm: 'matsuri', ms: 800 },
    { n: '鐘の音といっしょに、下の村から色とりどりの風船がのぼってきた。' },
    { n: '花びらが風に乗って、広場まで舞いあがる。' },
    { s: 'rin', t: 'きれい……。', e: 'happy', v: 'ending_last_03' },
    { s: 'kaho', t: '来年も、三人で見ようね。お城の街からでも、帰ってくるから。', e: 'happy', v: 'ending_last_04' },
    { wait: 2000 },
    { bgm: null, ms: 2500 },
    { fadeOut: 2000 },
    { festival: false },
    { n: '―― おわり ――' },
    { end: true },
  ],
};
