# Launchpad Editor

Novation Launchpad Mini MK3 用のウェブベース設定エディタです。ブラウザから MIDI コントローラーの各ボタンにアクション・LED カラーを割り当て、自分だけのランチパッドを構築できます。

## 主な機能

- **MIDI デバイス接続** - Web MIDI API を使い、Launchpad Mini MK3 を自動検出・接続
- **9x9 グリッドエディタ** - 81 個のボタンを視覚的に設定。ドラッグ＆ドロップで配置の入れ替えも可能
- **アクション設定** - ボタンごとに以下のアクションを割り当て可能：
  - キーボードショートカット（修飾キー + 任意のキー）
  - アプリ起動（macOS のアプリ一覧から選択）
  - URL を開く
  - シェルコマンド実行
- **LED カラー設定** - 18 種類のプリセットカラーまたはカスタム RGB で各ボタンの色を設定
- **設定の保存・読み込み** - ローカルストレージに自動保存。JSON 形式でのインポート/エクスポートにも対応
- **テスト実行** - 保存前にアクションの動作を確認可能

## 技術スタック

- **Next.js 16** / **React 19** / **TypeScript 5**
- **Tailwind CSS 4**
- **Web MIDI API**

## セットアップ

```bash
npm install
npm run dev
```

[http://localhost:3456](http://localhost:3456) をブラウザで開いてください。

## 使い方

1. Launchpad Mini MK3 を USB で接続
2. ブラウザで「接続」ボタンをクリック
3. グリッド上のボタンを選択し、右パネルでアクション・カラーを設定
4. 設定は自動的にローカルストレージに保存されます

## API エンドポイント

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/config` | GET / POST | 設定の読み込み・保存 |
| `/api/apps` | GET | インストール済み macOS アプリ一覧の取得 |
| `/api/execute` | POST | アクションの実行（ショートカット・アプリ起動・URL・コマンド） |

## プロジェクト構成

```
src/
├── app/
│   ├── page.tsx              # メインエディタ UI
│   ├── layout.tsx            # ルートレイアウト
│   ├── globals.css           # グローバルスタイル
│   └── api/                  # API ルート
├── components/
│   ├── LaunchpadGrid.tsx     # 9x9 ボタングリッド
│   └── ActionEditor.tsx      # アクション・カラー設定パネル
├── hooks/
│   └── useLaunchpad.ts       # MIDI 接続・制御フック
└── lib/
    ├── types.ts              # 型定義
    └── colors.ts             # カラーパレット・変換
```
