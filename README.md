# game3

一人称で歩いて人と話す、短い 3D のアドベンチャー。朝の、おとぎ話のような村が舞台。three.js と @pixiv/three-vrm で作り、Electron で Windows 用にまとめた。

## 遊び方（Windows）

1. 書き出した zip（下の「開発」の `npm run pack` でできるフォルダをまとめたもの）を展開する
2. `game3.exe` を起動する

## 操作

| キー | すること |
| --- | --- |
| ↑ / W | 前へ歩く |
| ↓ / S | うしろへ下がる |
| ← → / A D | 向きを変える |
| Shift | 押しながらで走る |
| Enter / Space / Z | 話す・文を進める・決める |
| Ctrl | 押している間、文を早送りする |
| Esc / X | メニュー（セーブ、ロード、操作の説明、タイトルへもどる） |
| F11 | 全画面の切り替え |

マウスでも、文を進める、選択肢やメニューを選ぶことができる。ゲームパッドの左スティックでも歩ける。

## 開発

Node.js 22 で動かした。

```bash
npm install
npm run dev
```

ブラウザで http://127.0.0.1:5190/ を開く。

Windows 用の書き出し：

```bash
npm run pack
```

`release/game3-win32-x64/` ができる。

## フォルダ

- `src/story.js`：台本（台詞、選択肢、分かれ道）
- `src/world.js`：景色（丘の上の広場、湖のほとり、花まつり）。基本の形だけで組んでいる
- `src/chara.js`：VRM の人物（立ち姿、まばたき、口の動き、表情、視線）
- `src/sound.js`：効果音と環境の音。Web Audio でその場で作る
- `src/bgm.js`：BGM の切り替えと、ループのつなぎ
- `src/main.js`：歩く、話す、メニュー、セーブとロード
- `electron/main.cjs`：Windows 用の起動部分
- `public/models/`：VRM の人物 2 人
- `public/voice/`：台詞の声（ファイル名は台本の `v:`）
- `public/bgm/`：BGM（4曲。`src/bgm.js` が場所と場面で切り替える）
- `tools/dump_lines.mjs`：台本から声の付く台詞を `tools/lines.json` に抜き出す

## 作った時期

Built with Claude: Japan 2026 の期間中（2026-11-02 12:30 のキックオフのあと）に、新しく作った。キックオフより前に作った台本・絵・音・コードは入っていない。

- 11/6：コード、台本、景色、声、BGM を作り、Windows 用に書き出した
- 11/7：このリポジトリを作った。それまではこのPCの中だけで作っていたので、GitHub の記録は 11/7 から始まる

## 作ったもの、借りたもの

- コード、台本、景色、音：Claude Code（Claude Opus 5.5）が 2026-11-06 に書いた
- 人物の 3D モデル：VRoid Studio（pixiv）のサンプル AvatarSample_D、AvatarSample_E（VRM 1.0。再配布可、クレジット不要）。2026-11-06 に VRoid Studio から書き出して、そのまま使った（形は変えていない）
- 声：2026-11-06 に Gemini TTS（Google）で作った。作る手順は Claude Code が書いた。声は既製の Laomedeia（夏帆）と Sulafat（凛）。`public/voice/` に台詞ごとの ogg がある。音声には SynthID の透かしが入る
- BGM：2026-11-06 に作者（みお）が Gemini（Google）で作った。全部インスト（歌なし）
- ライブラリ：three.js（MIT）、@pixiv/three-vrm（MIT）、Electron（MIT）
- フォントは同梱していない（Windows の游ゴシック・メイリオを使う）
