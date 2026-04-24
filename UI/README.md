# Handoff: 運営管理システム UI Redesign

## Overview

IT人材確保事業の運営管理システムのUIリデザインです。イベント管理画面（詳細ページ）を中心に、モダン＆プロフェッショナルなビジネス向けデザインへ刷新しました。ティール/シアン系のカラーパレットを維持しつつ、爽やかで洗練された印象にしています。

## About the Design Files

このパッケージに含まれるHTMLファイルは、**デザインリファレンス（プロトタイプ）**です。直接本番コードとして使用するものではありません。既存のコードベース（React、Vue、Next.js 等）のパターンやライブラリを使って、このデザインを忠実に再実装してください。既存のコードベースがない場合は、プロジェクトに最適なフレームワークを選択してください。

## Fidelity

**High-fidelity（高精度）**: ピクセル精度のモックアップです。最終的な色・タイポグラフィ・スペーシング・インタラクションが含まれています。**バリエーションBを採用版**として実装してください。

---

## 採用バリエーション: B — ダークサイドバー Pro

3つのバリエーションのうち、**バリエーションB**を実装対象として選定しました。

---

## Screens / Views

### 1. イベント詳細画面（メイン実装対象）

**目的**: イベントの詳細情報・タスク進捗・参加実績を確認・管理する画面

---

### Layout

```
[Sidebar 228px] | [Main Content flex:1]
```

- 全体: `display: flex; height: 100vh; background: #f0f4f8;`
- フォント: `'Noto Sans JP', sans-serif`

---

### Sidebar

| プロパティ | 値 |
|---|---|
| 幅 | `228px` |
| 背景色 | `#0f1c2e` |
| 上部ブランド領域 | padding `28px 22px 22px` |
| セパレーター | `rgba(255,255,255,0.06)` 1px |

**ブランドエリア:**
- ラベル（小）: `IT人材確保事業` — fontSize `9px`, color `rgba(6,182,212,0.7)`, fontWeight `700`, letterSpacing `0.12em`, uppercase
- タイトル: `運営管理システム` — fontSize `15px`, fontWeight `700`, color `#fff`, 1行表示（`whiteSpace: nowrap`）

**ナビゲーションアイテム:**
- padding: `11px 22px`
- アクティブ: `background: rgba(6,182,212,0.15)`, color `#06b6d4`, fontWeight `600`, `borderLeft: 3px solid #06b6d4`
- 非アクティブ: color `rgba(255,255,255,0.5)`, borderLeft `3px solid transparent`
- fontSize: `13px`

**ナビ項目:**
1. ⊞ ダッシュボード
2. ◈ イベント管理 ← **アクティブ**
3. ☑ タスク一覧
4. ◎ ステークホルダー
5. ◉ 目標・実績管理
6. ▤ タスクテンプレート

**フッター:** `v1.0.0 Phase 1` — fontSize `11px`, color `rgba(255,255,255,0.2)`

---

### Top Bar

- 高さ: `58px`
- 背景: `#fff`
- borderBottom: `1px solid #e2e8f0`
- padding: `0 36px`

**左側:** `← イベント一覧へ戻る` — fontSize `13px`, color `#06b6d4`, fontWeight `500`

**右側ボタン群:**
| ボタン | スタイル |
|---|---|
| 詳細 | border `1px solid #e2e8f0`, background `#fff`, color `#374151` |
| 編集 | background `#06b6d4`, color `#fff`, border `none` |
| 削除 | border `1px solid #fecaca`, background `#fff5f5`, color `#ef4444` |

- 共通: padding `7px 18px`, borderRadius `6px`, fontSize `12px`, fontWeight `500`

---

### Main Content

padding: `32px 36px`

#### イベントヘッダー

**タグ群** (marginBottom `10px`):
- タグスタイル: fontSize `11px`, padding `3px 10px`, borderRadius `4px`, background `#e0f7fa`, color `#0891b2`, fontWeight `500`, border `1px solid #b2ebf2`
- タグ例: `支援対象活動`, `採用支援`, `新卒者対象企業説明会`

**タイトル:**
- fontSize: `22px`, fontWeight `700`, color `#1e2d3d`, letterSpacing `-0.02em`

---

#### 統計カード（4列グリッド）

- `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;`
- カードスタイル: background `#fff`, borderRadius `14px`, padding `20px 22px`, border `1px solid #e8edf2`, boxShadow `0 2px 8px rgba(0,0,0,0.05)`

| カード | ラベル | 値 |
|---|---|---|
| 開始日 | `開始日` | `2026/04/15` |
| 合場 | `合場` | `—` |
| 学生目標 | `学生目標` | `30名` |
| 企業目標 | `企業目標` | `15社` |

- ラベル: fontSize `11px`, color `#94a3b8`, fontWeight `600`, uppercase, letterSpacing `0.06em`
- 値: fontSize `26px`, fontWeight `800`, color `#1e2d3d`, letterSpacing `-0.02em`

---

#### 2列レイアウト（申込実績 + 進捗）

`display: grid; grid-template-columns: 1fr 320px; gap: 20px;`

**申込・参加実績カード:**
- 4列グリッド内に各実績値
- ヘッダー: `申込・参加実績` fontSize `13px`, fontWeight `700`
- 編集ボタン: color `#06b6d4`
- 内部セル: background `#f8fafc`, borderRadius `10px`, padding `12px 0`, textAlign `center`

**タスク進捗カード:**
- タイトル: `タスク進捗` fontSize `13px`, fontWeight `700`
- 大数字: `89` fontSize `36px`, fontWeight `800`, color `#06b6d4`, letterSpacing `-0.03em`
- サブテキスト: `16 / 18 タスク完了` — fontSize `12px`, color `#94a3b8`
- プログレスバー: 高さ `10px`, background `#f1f5f9`, borderRadius `99px`
  - Fill: width `89%`, `linear-gradient(90deg, #0891b2, #06b6d4)`

---

#### タスクテーブルカード

- background `#fff`, borderRadius `14px`, border `1px solid #e8edf2`, boxShadow `0 2px 8px rgba(0,0,0,0.05)`

**タブバー** (padding `0 24px`, borderBottom `1px solid #f1f5f9`):
- タブ: `タスク (16)`, `ガントチャート`, `ステークホルダー (0)`
- アクティブ: color `#06b6d4`, fontWeight `700`, borderBottom `2px solid #06b6d4`
- 非アクティブ: color `#94a3b8`
- `+ タスク追加`ボタン: background `#06b6d4`, color `#fff`, borderRadius `8px`, padding `8px 18px`

**テーブルヘッダー:**
- background `#fafbfc`, fontSize `11px`, fontWeight `700`, color `#94a3b8`, uppercase, letterSpacing `0.08em`
- 列: `タスク名`, `カテゴリ`, `開始日`, `期日`, `ステータス`, (アクション)

**テーブル行:**
- padding: `13px 20px`, borderTop `1px solid #f8fafc`
- タスク名: fontSize `13px`, fontWeight `500`, color `#1e2d3d`
- 日付: fontSize `12px`, color `#64748b`

**カテゴリバッジ:**
| カテゴリ | background | color |
|---|---|---|
| 告知・集客 | `#fef3c7` | `#d97706` |
| その他 | `#f1f5f9` | `#64748b` |

- fontSize `11px`, padding `3px 8px`, borderRadius `4px`, fontWeight `500`

**ステータスバッジ:**
| ステータス | background | color |
|---|---|---|
| 完了 | `#dcfce7` | `#16a34a` |
| 対応中 | `#fef9c3` | `#ca8a04` |

- fontSize `11px`, padding `3px 10px`, borderRadius `20px`, fontWeight `600`

**アクションリンク:**
- 編集: color `#06b6d4`, fontWeight `500`
- 削除: color `#ef4444`

---

## Design Tokens

### Colors

| トークン名 | 値 | 用途 |
|---|---|---|
| `color-primary` | `#06b6d4` | プライマリアクション、アクティブ状態 |
| `color-primary-dark` | `#0891b2` | グラデーション起点 |
| `color-primary-bg` | `#e0f7fa` | タグ背景 |
| `color-sidebar-bg` | `#0f1c2e` | サイドバー背景 |
| `color-page-bg` | `#f0f4f8` | ページ背景 |
| `color-surface` | `#fff` | カード・パネル背景 |
| `color-text-primary` | `#1e2d3d` | 主要テキスト |
| `color-text-secondary` | `#64748b` | 補助テキスト |
| `color-text-muted` | `#94a3b8` | ラベル・キャプション |
| `color-border` | `#e8edf2` | カードボーダー |
| `color-success-bg` | `#dcfce7` | 完了バッジ背景 |
| `color-success-text` | `#16a34a` | 完了バッジテキスト |
| `color-warning-bg` | `#fef9c3` | 対応中バッジ背景 |
| `color-warning-text` | `#ca8a04` | 対応中バッジテキスト |
| `color-danger-bg` | `#fff5f5` | 削除ボタン背景 |
| `color-danger-text` | `#ef4444` | 削除ボタンテキスト |

### Typography

| スタイル | fontSize | fontWeight | 用途 |
|---|---|---|---|
| ページタイトル | `22px` | `800` | イベントタイトル |
| セクションタイトル | `13px` | `700` | カードヘッダー |
| 統計値 | `26–36px` | `800` | 数値表示 |
| ボディ | `13px` | `400–500` | テーブル本文 |
| ラベル | `11px` | `600` | uppercase ラベル |
| キャプション | `12px` | `400` | 日付・補足 |

- Font family: `'Noto Sans JP', sans-serif`

### Spacing

- カードpadding: `20–22px`
- グリッドgap: `16–20px`
- ページpadding: `32px 36px`

### Border Radius

| 用途 | 値 |
|---|---|
| カード | `14px` |
| ボタン | `6–8px` |
| バッジ（角丸） | `20px` |
| バッジ（角） | `4px` |
| プログレスバー | `99px` |

### Shadows

- カード: `0 2px 8px rgba(0,0,0,0.05)`

---

## Interactions & Behavior

- タブ切り替え: `タスク`, `ガントチャート`, `ステークホルダー` — アクティブタブのみ下線 + テキスト色変化
- `← イベント一覧へ戻る`: 一覧画面へ戻るナビゲーション
- `+ タスク追加`: タスク追加モーダル or インラインフォームを開く
- 行の `編集` / `削除`: 各タスクの編集・削除処理

---

## Files

| ファイル | 説明 |
|---|---|
| `UI Redesign.html` | 3バリエーション全てを含むデザインリファレンス（VariantBが採用版） |

HTMLファイル内の `VariantB` コンポーネント（`/* ─── Variation B: Dark Sidebar Pro ─── */` セクション）が実装対象です。
