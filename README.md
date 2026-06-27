# KeepChatGPT Auto Reload on Chat Switch

ChatGPTでトークを切り替えたあと、KeepChatGPTのUIが消える場合に、自動で1回だけ再読み込みするViolentmonkey/Tampermonkey向けUserscriptです。

[![Install Userscript](https://img.shields.io/badge/Install-UserScript-10a37f)](https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js)

---

## インストール

**ワンクリック**

- [インストール（Raw .user.js）](https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js)

**Userscriptマネージャが未導入の場合**

1. ブラウザにViolentmonkeyまたはTampermonkeyをインストール
2. 上の「インストール（Raw .user.js）」リンクを開く
3. Userscriptマネージャの画面でインストールを選択

**コピペ用URL**

```text
https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js
```

> 注意: このリポジトリがprivateの間は、GitHubのRaw URLを外部から取得できないため、上記リンクでのインストールや自動更新は動作しません。publicに変更すると利用できます。

---

## 主な機能

- ChatGPTのトーク切り替えを検知
- KeepChatGPTのUIが見つからない場合だけ再読み込み
- 同じチャットページでは1回だけ再読み込み
- 入力中、下書きあり、IME変換中は再読み込みを延期
- `pushState` / `replaceState` / `popstate` / DOM変化を監視
- `/c/`、`/g/`、`/project/`、`/projects/`配下で動作
- KeepChatGPTが正常に表示されている場合は何もしない

## 使い方

1. Userscriptをインストール
2. ChatGPTで通常どおり会話やトーク切り替えを行う
3. KeepChatGPTのUIが消えた場合、数秒待ってから自動で再読み込み

入力欄にフォーカスがあり、入力内容がある場合やIME変換中の場合は、自動再読み込みを行いません。入力カーソル位置や下書きを壊さないことを優先します。

## 自動更新

スクリプトには以下のメタデータを設定しています。

```javascript
// @updateURL    https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js
// @downloadURL  https://raw.githubusercontent.com/scarecrowx913x/keepchatgpt-auto-reload/main/keepchatgpt-auto-reload.user.js
```

今後Codexなどで修正した場合は、`@version`を上げてcommit/pushすると、Violentmonkey側の更新チェックで反映できます。

## トラブルシュート

**自動更新されない**

- リポジトリがprivateのままだとGitHub Raw URLを取得できません。publicに変更してください。
- Userscriptマネージャ側で更新チェックを実行してください。
- `@version`が前回と同じ場合、更新として扱われないことがあります。

**何度も再読み込みされる**

- 同じページでは`sessionStorage`で1回だけ再読み込みする設計です。
- ブラウザのセッションを閉じると記録はリセットされます。

**KeepChatGPTが表示されているのに再読み込みされる**

- KeepChatGPT側のDOM名や目印が変わった可能性があります。
- `hasKeepChatGPTUi()`の検出条件を調整してください。

**入力中に再読み込みされない**

- 入力内容やIME変換中の状態を保護するための仕様です。
- 入力を消すか、入力欄からフォーカスを外すと再判定されます。

## 開発

```bash
git clone https://github.com/scarecrowx913x/keepchatgpt-auto-reload.git
cd keepchatgpt-auto-reload
```

編集対象:

- `keepchatgpt-auto-reload.user.js`

リリース手順:

1. `@version`を上げる
2. 変更をcommit
3. `main`へpush
4. Violentmonkeyで更新チェック

## ライセンス

MIT
