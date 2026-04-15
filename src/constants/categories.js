// 大分類・中分類・小分類のマスタデータ
// スプレッドシートの設定シートで管理（フェーズ3）するまではここで管理

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
          { id: 'small_1_1_2', name: 'IT企業見学ツアー' },
          { id: 'small_1_1_3', name: 'インターンシップ説明会' },
        ],
      },
      {
        id: 'mid_1_2',
        name: '高校生対象',
        small: [
          { id: 'small_1_2_1', name: 'IT出前授業' },
          { id: 'small_1_2_2', name: '高校生IT体験セミナー' },
        ],
      },
      {
        id: 'mid_1_3',
        name: '専門学校等対象',
        small: [
          { id: 'small_1_3_1', name: '専門学校等連携会議' },
          { id: 'small_1_3_2', name: '就職支援セミナー' },
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
          { id: 'small_2_1_2', name: '中途採用支援セミナー' },
        ],
      },
      {
        id: 'mid_2_2',
        name: '人材育成支援',
        small: [
          { id: 'small_2_2_1', name: '人材育成研修' },
          { id: 'small_2_2_2', name: 'DX推進セミナー' },
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
        name: '産学連携',
        small: [
          { id: 'small_3_1_1', name: '産学連携懇話会' },
          { id: 'small_3_1_2', name: '共同研究・PBL' },
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
        name: 'UIJターン',
        small: [
          { id: 'small_4_1_1', name: 'UIJターン就職フェア' },
          { id: 'small_4_1_2', name: 'Uターン相談会' },
        ],
      },
      {
        id: 'mid_4_2',
        name: '転職・再就職支援',
        small: [
          { id: 'small_4_2_1', name: '転職フェア' },
          { id: 'small_4_2_2', name: '再就職支援セミナー' },
        ],
      },
    ],
  },
]

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
