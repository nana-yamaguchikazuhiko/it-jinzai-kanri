-- ════════════════════════════════════════════════
-- date運営管理システム — Supabase テーブル作成SQL
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id                 TEXT PRIMARY KEY,
  name               TEXT,
  big_cat            TEXT,
  mid_cat            TEXT,
  small_cat          TEXT,
  event_start_date   TEXT,
  event_date         TEXT,
  venue              TEXT,
  student_goal       TEXT,
  company_goal       TEXT,
  status             TEXT,
  student_form_url   TEXT,
  company_form_url   TEXT,
  portal_company_url TEXT,
  portal_student_url TEXT,
  parent_id          TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  event_id    TEXT,
  name        TEXT,
  category    TEXT,
  days_before TEXT,
  start_date  TEXT,
  due_date    TEXT,
  assignee    TEXT,
  status      TEXT,
  memo        TEXT,
  priority    TEXT,
  is_contact  TEXT,
  contact_ids TEXT
);

CREATE TABLE IF NOT EXISTS stakeholders (
  id               TEXT PRIMARY KEY,
  name             TEXT,
  type             TEXT,
  institution_type TEXT,
  contact_name     TEXT,
  department       TEXT,
  position         TEXT,
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  contact_status   TEXT,
  next_action      TEXT,
  next_action_date TEXT,
  memo             TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id              TEXT PRIMARY KEY,
  fiscal_year     TEXT,
  small_cat       TEXT,
  hold_count_goal TEXT,
  student_goal    TEXT,
  company_goal    TEXT
);

CREATE TABLE IF NOT EXISTS results (
  id              TEXT PRIMARY KEY,
  event_id        TEXT,
  student_applied TEXT,
  company_applied TEXT,
  student_actual  TEXT,
  company_actual  TEXT,
  recorded_at     TEXT
);

CREATE TABLE IF NOT EXISTS mails (
  id          TEXT PRIMARY KEY,
  received_at TEXT,
  sender      TEXT,
  subject     TEXT,
  body        TEXT,
  status      TEXT,
  memo        TEXT
);

CREATE TABLE IF NOT EXISTS snippets (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT,
  category    TEXT,
  code        TEXT,
  created_at  TEXT
);

CREATE TABLE IF NOT EXISTS field_notes (
  id             TEXT PRIMARY KEY,
  date           TEXT,
  category       TEXT,
  stakeholder_id TEXT,
  source         TEXT,
  title          TEXT,
  content        TEXT,
  tags           TEXT
);

CREATE TABLE IF NOT EXISTS task_templates (
  id          TEXT PRIMARY KEY,
  small_cat   TEXT,
  task_name   TEXT,
  category    TEXT,
  days_before TEXT
);

CREATE TABLE IF NOT EXISTS event_budgets (
  id         TEXT PRIMARY KEY,
  event_id   TEXT,
  item       TEXT,
  type       TEXT,
  amount     TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS category_budgets (
  id          TEXT PRIMARY KEY,
  small_cat   TEXT,
  fiscal_year TEXT,
  amount      TEXT
);

CREATE TABLE IF NOT EXISTS event_documents (
  id         TEXT PRIMARY KEY,
  event_id   TEXT,
  name       TEXT,
  url        TEXT,
  memo       TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS event_reports (
  id          TEXT PRIMARY KEY,
  event_id    TEXT,
  overview    TEXT,
  impression  TEXT,
  speakers    TEXT,
  ai_analysis TEXT,
  created_at  TEXT,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS event_stakeholders (
  id             TEXT PRIMARY KEY,
  event_id       TEXT,
  stakeholder_id TEXT,
  group_id       TEXT
);

CREATE TABLE IF NOT EXISTS sh_groups (
  id   TEXT PRIMARY KEY,
  name TEXT
);

CREATE TABLE IF NOT EXISTS sh_group_members (
  id             TEXT PRIMARY KEY,
  group_id       TEXT NOT NULL REFERENCES sh_groups(id) ON DELETE CASCADE,
  stakeholder_id TEXT NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  UNIQUE(group_id, stakeholder_id)
);

CREATE TABLE IF NOT EXISTS survey_columns (
  id              TEXT PRIMARY KEY,
  event_id        TEXT,
  spreadsheet_url TEXT,
  col_index       TEXT,
  question_label  TEXT,
  question_type   TEXT,
  col_order       TEXT
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id             TEXT PRIMARY KEY,
  event_id       TEXT,
  response_id    TEXT,
  question_label TEXT,
  value          TEXT
);

CREATE TABLE IF NOT EXISTS form_sync (
  id           TEXT PRIMARY KEY,
  event_id     TEXT,
  type         TEXT,
  school_name  TEXT,
  company_name TEXT
);

CREATE TABLE IF NOT EXISTS content_templates (
  id            TEXT PRIMARY KEY,
  small_cat     TEXT,
  template_type TEXT,
  name          TEXT,
  content       TEXT,
  updated_at    TEXT
);
