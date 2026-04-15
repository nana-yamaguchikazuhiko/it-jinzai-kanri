// タスクテンプレート（初期設定）
// 本番はスプレッドシートの task_templates シートで管理するが
// スプレッドシートに未登録の場合はこちらをフォールバックとして使用する

export const TASK_TEMPLATES = [
  // 業界研究会
  { small_cat: '業界研究会', task_name: '企画・プログラム立案',     category: '企画',         days_before: 90 },
  { small_cat: '業界研究会', task_name: 'Webページ作成・公開',       category: 'HP・集客',     days_before: 60 },
  { small_cat: '業界研究会', task_name: '申込フォーム作成',           category: 'HP・集客',     days_before: 55 },
  { small_cat: '業界研究会', task_name: '教育機関への周知・案内送付', category: '連絡・調整',   days_before: 45 },
  { small_cat: '業界研究会', task_name: '講師・会場手配',             category: '会場・講師手配', days_before: 40 },
  { small_cat: '業界研究会', task_name: '参加者へのリマインド送付',   category: '連絡・調整',   days_before: 7  },
  { small_cat: '業界研究会', task_name: '当日運営・進行',             category: '当日運営',     days_before: 0  },
  { small_cat: '業界研究会', task_name: '報告書作成',                 category: '報告・振り返り', days_before: -14 },

  // 新卒者対象企業説明会
  { small_cat: '新卒者対象企業説明会', task_name: '企画・出展企業選定',       category: '企画',           days_before: 90 },
  { small_cat: '新卒者対象企業説明会', task_name: 'Webページ・申込ページ作成', category: 'HP・集客',       days_before: 70 },
  { small_cat: '新卒者対象企業説明会', task_name: '企業への参加依頼',           category: '連絡・調整',     days_before: 60 },
  { small_cat: '新卒者対象企業説明会', task_name: '学生向け周知・集客',         category: 'HP・集客',       days_before: 45 },
  { small_cat: '新卒者対象企業説明会', task_name: '会場手配・レイアウト設計',   category: '会場・講師手配', days_before: 40 },
  { small_cat: '新卒者対象企業説明会', task_name: '参加企業へのリマインド',     category: '連絡・調整',     days_before: 14 },
  { small_cat: '新卒者対象企業説明会', task_name: '参加学生へのリマインド',     category: '連絡・調整',     days_before: 7  },
  { small_cat: '新卒者対象企業説明会', task_name: '当日運営・進行',             category: '当日運営',       days_before: 0  },
  { small_cat: '新卒者対象企業説明会', task_name: 'マッチング結果集計・報告',   category: '報告・振り返り', days_before: -14 },

  // 専門学校等連携会議
  { small_cat: '専門学校等連携会議', task_name: '開催案内・日程調整',         category: '連絡・調整',     days_before: 60 },
  { small_cat: '専門学校等連携会議', task_name: '議題・資料準備',               category: '企画',           days_before: 30 },
  { small_cat: '専門学校等連携会議', task_name: '会場手配',                     category: '会場・講師手配', days_before: 21 },
  { small_cat: '専門学校等連携会議', task_name: '出席確認・リマインド',         category: '連絡・調整',     days_before: 7  },
  { small_cat: '専門学校等連携会議', task_name: '当日運営・議事録作成',         category: '当日運営',       days_before: 0  },
  { small_cat: '専門学校等連携会議', task_name: '議事録送付・フォローアップ', category: '報告・振り返り', days_before: -7  },

  // UIJターン就職フェア
  { small_cat: 'UIJターン就職フェア', task_name: '企画・出展企業募集',         category: '企画',           days_before: 90 },
  { small_cat: 'UIJターン就職フェア', task_name: '告知ページ・申込フォーム作成', category: 'HP・集客',     days_before: 60 },
  { small_cat: 'UIJターン就職フェア', task_name: '県外向け集客活動',           category: 'HP・集客',       days_before: 45 },
  { small_cat: 'UIJターン就職フェア', task_name: '会場・備品手配',             category: '会場・講師手配', days_before: 30 },
  { small_cat: 'UIJターン就職フェア', task_name: '参加者・企業へのリマインド', category: '連絡・調整',     days_before: 7  },
  { small_cat: 'UIJターン就職フェア', task_name: '当日運営・進行',             category: '当日運営',       days_before: 0  },
  { small_cat: 'UIJターン就職フェア', task_name: 'アンケート集計・報告書作成', category: '報告・振り返り', days_before: -14 },
]

// 小分類名からテンプレートを取得
export function getTemplateBySmallCat(smallCat) {
  return TASK_TEMPLATES.filter(t => t.small_cat === smallCat)
}

// 開催日とdays_beforeからdue_dateを計算
export function calcDueDate(eventDate, daysBefore) {
  if (!eventDate) return ''
  const d = new Date(eventDate)
  d.setDate(d.getDate() - daysBefore)
  return d.toISOString().split('T')[0]
}
