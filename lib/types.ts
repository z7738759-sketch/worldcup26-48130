export interface OddsLine {
  bookmaker: string
  isSharpFriendly: boolean
  homeWin: string
  draw: string
  awayWin: string
}

export interface MRule {
  id: string
  triggered: boolean
  reason: string
}

export interface ReasoningStep {
  title: string
  detail: string
  conclusion: string
}

export interface BettingValue {
  stars: 1 | 2 | 3
  name: string
  odds: string
  evCalc: string
  logic: string
  status: 'pending' | 'hit' | 'miss'
}

export interface Analysis {
  matchId: number
  generatedAt: string
  odds: OddsLine[]
  mRules: MRule[]
  reasoning: ReasoningStep[]
  predictionA: string
  predictionB: string
  confidence: string
  bettingValue: BettingValue[]
  aiInsight: string
  modelScore?: {
    homeWinPct: number
    drawPct: number
    awayWinPct: number
    expectedGoalsHome: number
    expectedGoalsAway: number
    eloHome: number
    eloAway: number
  }
}

export interface PredictionUpdate {
  originalA: string
  updatedA: string
  reason: string
  updatedAt: string
}

export interface Prediction {
  matchId: number
  homeTeam: string
  awayTeam: string
  group: string
  kickoff: string
  predictionA: string
  predictionB: string
  predictionC: string
  probabilityA: number
  probabilityB: number
  probabilityC: number
  actualScore: string | null
  winDrawLoss: 'home' | 'away' | 'draw' | null  // 显式胜平负预测，不依赖比分解析
  directionCorrect: boolean | null
  exactHit: boolean | null
  totalGoalsDirectionCorrect: boolean | null  // 总进球方向：实际总进球是否在预测范围内
  totalGoalsPrediction?: string   // 独立泊松区间，格式 "X-Y球"
  lambdaHome?: number
  lambdaAway?: number
  bettingValues: Array<{ stars: number; name: string; odds: string; hit?: boolean | null }>
  mRulesTriggered: string[]
  notes: string
  updatedPrediction?: PredictionUpdate
  teamNews?: string[]
}
