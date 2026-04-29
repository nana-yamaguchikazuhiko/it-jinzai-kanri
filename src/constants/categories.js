// 大分類・中分類・小分類のマスタデータ（人財確保事業の分類.xlsx より）

export const CATEGORIES = [
  {
    id: 'big_1',
    name: '学生向け啓蒙活動',
    mid: [
      {
        id: 'mid_1_1',
        name: '大学生対象',
        small: [
          { id: 'small_1_1_1', name: '業界研究会' },
          { id: 'small_1_1_2', name: '交流イベント' },
          { id: 'small_1_1_3', name: '業界・職業研究インターンシップ' },
        ],
      },
    ],
  },
  {
    id: 'big_2',
    name: '企業向け支援活動',
    mid: [
      {
        id: 'mid_2_1',
        name: '採用支援',
        small: [
          { id: 'small_2_1_1', name: '新卒者対象企業説明会' },
          { id: 'small_2_1_2', name: '企業情報の提供' },
          { id: 'small_2_1_3', name: '学生支援窓口の運営' },
          { id: 'small_2_1_4', name: '採用促進型インターンシップ・イベント' },
        ],
      },
    ],
  },
  {
    id: 'big_3',
    name: '教育機関との連携活動',
    mid: [
      {
        id: 'mid_3_1',
        name: '産学連携懇話会',
        small: [
          { id: 'small_3_1_1', name: '大学等産学実践教育 連携会議' },
          { id: 'small_3_1_2', name: '専門学校等 連携会議' },
          { id: 'small_3_1_3', name: '産学連携 情報交換会' },
          { id: 'small_3_1_4', name: '教育機関との日常的な連携・コーディネーション活動' },
        ],
      },
    ],
  },
  {
    id: 'big_4',
    name: 'マッチング活動',
    mid: [
      {
        id: 'mid_4_1',
        name: '人材紹介',
        small: [
          { id: 'small_4_1_1', name: '人材紹介会社との連携（マッチング事業）' },
        ],
      },
      {
        id: 'mid_4_2',
        name: 'UIJターン',
        small: [
          { id: 'small_4_2_1', name: 'UIJターンの促進' },
        ],
      },
    ],
  },
]

// 大・中分類に属さない独立小分類
export const STANDALONE_SMALL_CATS = ['確保G事業外活動・外部団体活動']

// 小分類名の一覧（フラット）
export const ALL_SMALL_CATS = CATEGORIES.flatMap(big =>
  big.mid.flatMap(mid =>
    mid.small.map(s => ({ ...s, bigName: big.name, midName: mid.name }))
  )
)

// 小分類名 → {bigName, midName} のマップ
export const SMALL_CAT_MAP = Object.fromEntries(
  ALL_SMALL_CATS.map(s => [s.name, { bigName: s.bigName, midName: s.midName }])
)
