import predictionsData from '@/data/predictions.json'
import type { Prediction } from './types'
import { computeModelOutput } from './model'

export function getAllPredictions(): Prediction[] {
  return predictionsData as Prediction[]
}

export function getStandingsFromPredictions() {
  const all = predictionsData as Prediction[]

  // 先收集全部队伍（含尚未出赛的）
  const groups: Record<string, Record<string, {
    team: string; played: number; won: number; drawn: number
    lost: number; gf: number; ga: number; pts: number
  }>> = {}

  const ensureTeam = (g: string, team: string) => {
    if (!groups[g]) groups[g] = {}
    if (!groups[g][team]) groups[g][team] = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }
  }

  // 先登记所有预测中出现的队（无论是否有结果）
  for (const match of all) {
    ensureTeam(match.group, match.homeTeam)
    ensureTeam(match.group, match.awayTeam)
  }

  // 再处理已完成比赛的积分
  for (const match of all.filter(p => p.actualScore !== null)) {
    const [hg, ag] = (match.actualScore as string).split('-').map(Number)
    const g = match.group
    for (const [team, isHome] of [[match.homeTeam, true], [match.awayTeam, false]] as [string, boolean][]) {
      const r = groups[g][team]
      r.played++
      r.gf += isHome ? hg : ag
      r.ga += isHome ? ag : hg
      const scored = isHome ? hg : ag
      const conceded = isHome ? ag : hg
      if (scored > conceded) { r.won++; r.pts += 3 }
      else if (scored < conceded) r.lost++
      else { r.drawn++; r.pts++ }
    }
  }

  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, teams]) => ({
    group,
    table: Object.values(teams).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts
      if ((b.gf - b.ga) !== (a.gf - a.ga)) return (b.gf - b.ga) - (a.gf - a.ga)
      return b.gf - a.gf
    }).map((t, i) => ({ ...t, position: i + 1, gd: t.gf - t.ga }))
  }))
}

// 从预测文本解析总进球数（predictionA 的主场+客场进球之和）
export function parsePredGoals(pred: string): number | null {
  const m = pred.match(/(\d+)\s*[-–—]\s*(\d+)/)
  if (!m) return null
  return parseInt(m[1]) + parseInt(m[2])
}

export function getAccuracyStats() {
  const finished = predictionsData.filter(p => p.actualScore !== null)
  const total = finished.length

  // 胜平负方向命中：基于显式 winDrawLoss
  const scoreDirectionHits = finished.filter(p => {
    if (!p.actualScore || !p.winDrawLoss) return false
    const [hg, ag] = p.actualScore.split('-').map(Number)
    const actual = hg > ag ? 'home' : ag > hg ? 'away' : 'draw'
    return p.winDrawLoss === actual
  }).length

  // 比分类：仅判断 predictionA 是否精确命中（A是正式主预测）
  const scoreExactHits = finished.filter(p => {
    if (!p.actualScore || !p.predictionA) return false
    const m = p.predictionA.match(/(\d+)\s*[-–—]\s*(\d+)/)
    if (!m) return false
    return `${m[1]}-${m[2]}` === p.actualScore
  }).length

  // 总进球：用泊松模型计算的A/B任一命中即算中（与分数字符串解析独立）
  const totalGoalsHits = finished.filter(p => {
    if (!p.actualScore) return false
    const [hg, ag] = p.actualScore.split('-').map(Number)
    const actualTotal = hg + ag
    const model = computeModelOutput(p.homeTeam, p.awayTeam, p.kickoff, {
      predictionA: p.predictionA, predictionB: p.predictionB
    })
    return actualTotal === model.totalGoalsA || actualTotal === model.totalGoalsB
  }).length

  return {
    total,
    scoreDirectionHits,
    scoreExactHits,
    scoreDirectionRate: total ? Math.round((scoreDirectionHits / total) * 100) : 0,
    scoreExactRate: total ? Math.round((scoreExactHits / total) * 100) : 0,
    totalGoalsHits,
    totalGoalsRate: total ? Math.round((totalGoalsHits / total) * 100) : 0,
  }
}

// 从预测文本解析方向和比分
function parseScoreAndDirection(pred: string, homeTeam: string, awayTeam: string): { direction: 'home' | 'away' | 'draw'; score: string } | null {
  const m = pred.match(/(\d+)\s*[-–—]\s*(\d+)/)
  if (!m) return null
  const h = parseInt(m[1]), a = parseInt(m[2])
  // 比分总是主队在前（H-A格式）
  return {
    direction: h > a ? 'home' : a > h ? 'away' : 'draw',
    score: `${h}-${a}`
  }
}

// 从预测文本解析总进球数
function parseGoalsFromPredictionText(text: string): number | null {
  const m = text.match(/(\d+)\s*[-–—]\s*(\d+)/)
  if (!m) return null
  return parseInt(m[1]) + parseInt(m[2])
}
