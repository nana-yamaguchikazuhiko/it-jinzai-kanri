# セットアップ手順

## 1. Googleスプレッドシート作成

### シート構成
新しいスプレッドシートを作成し、以下の8シートを作成する（シート名は完全一致が必要）:

| シート名 | 1行目（ヘッダー） |
|---------|-----------------|
| `events` | id, name, big_cat, mid_cat, small_cat, event_date, venue, student_goal, company_goal, status, sheets_url, created_at |
| `tasks` | id, event_id, name, category, due_date, assignee, status, priority, memo |
| `stakeholders` | id, name, type, contact_name, email, phone, address, contact_status, next_action, next_action_date, memo |
| `event_stakeholders` | id, event_id, stakeholder_id |
| `goals` | id, fiscal_year, small_cat, hold_count_goal, student_goal, company_goal |
| `results` | id, event_id, student_applied, company_applied, student_actual, company_actual, recorded_at |
| `task_templates` | id, small_cat, task_name, category, days_before |
| `mails` | id, gmail_thread_id, gmail_message_id, sender, subject, received_at, preview, status, event_id, stakeholder_id, memo, alerted, created_at |

> `task_templates` シートには要件定義書9章のテンプレートを追加するか空のままでもOK（空の場合はアプリ内定数のフォールバックを使用）

スプレッドシートIDをURLから控えておく:
```
https://docs.google.com/spreadsheets/d/【この部分がID】/edit
```

## 2. GCPプロジェクト・サービスアカウント作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクト作成（例: `it-jinzai-kanri`）
3. 「APIとサービス」→「ライブラリ」→ **Google Sheets API** を有効化
4. 「IAMと管理」→「サービスアカウント」→ 新規作成
   - 名前: `sheets-accessor`
   - ロール: 「閲覧者」でOK（Sheets自体の権限はスプレッドシート側で設定）
5. サービスアカウント → 「キー」→「キーを追加」→ JSON形式でダウンロード
6. **ダウンロードしたJSONファイルは厳重に管理し、Gitにコミットしない**

## 3. スプレッドシートの共有設定

1. スプレッドシートを開く
2. 右上「共有」→ サービスアカウントのメールアドレスを「編集者」として追加
   - メールアドレスは `sheets-accessor@プロジェクトID.iam.gserviceaccount.com` の形式
3. 「リンクを知っている全員」への共有は**行わない**

## 4. Netlify セットアップ

### GitHubリポジトリ作成
```bash
cd date運営管理システム
git init
git add .
git commit -m "初回コミット"
git remote add origin https://github.com/your-username/it-jinzai-kanri.git
git push -u origin main
```

### Netlifyでサイト作成
1. [netlify.com](https://www.netlify.com/) にログイン
2. 「Add new site」→「Import an existing project」→ GitHubリポジトリを選択
3. ビルド設定:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

### 環境変数の設定
Netlify管理画面 →「Site configuration」→「Environment variables」に以下を追加:

| 変数名 | 値 |
|-------|---|
| `GOOGLE_SPREADSHEET_ID` | スプレッドシートのID（手順1で控えたもの） |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ダウンロードしたJSONの内容を**1行に圧縮**したもの |

JSONを1行に圧縮するコマンド（ターミナルで実行）:
```bash
python3 -c "import json,sys; print(json.dumps(json.load(open('ダウンロードしたキーファイル.json'))))"
```

## 5. ローカル開発環境

```bash
# .envファイルを作成
cp .env.example .env
# .envに環境変数を設定（.gitignoreで除外済み）

# Netlify CLIをインストール（初回のみ）
npm install -g netlify-cli

# ローカルで起動（Netlify Functionsも含む）
npm run dev
```
→ http://localhost:5173 でアクセス可能

## 6. デプロイ

```bash
git add .
git commit -m "機能追加・修正内容"
git push
```
git pushするとNetlifyが自動でビルド・デプロイを実行する。

---

## トラブルシューティング

**「環境変数が設定されていません」エラー**
→ Netlifyの環境変数を確認。ローカルでは `.env` ファイルに設定。

**「シートが見つかりません」エラー**
→ スプレッドシートのシート名が上記の表と完全一致しているか確認（日本語・スペース不可）。

**「トークン取得失敗」エラー**
→ サービスアカウントのJSONが正しく設定されているか、スプレッドシートに「編集者」として追加されているか確認。
