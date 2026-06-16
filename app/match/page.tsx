import { getAllPredictions, parsePredGoals } from '@/lib/predictions'
import { computeModelOutput } from '@/lib/model'
import MatchListClient from '@/components/MatchListClient'

// 降低到30秒ISR，但实际时间分类由客户端JS处理
export const revalidate = 30

export default function MatchListPage() {
  const predictions = getAllPredictions()

  // 服务端预计算模型输出，传给客户端（避免客户端重复计算）
  const enriched = predictions.map(p => {
    const model = computeModelOutput(
      p.homeTeam, p.awayTeam, p.kickoff,
      { predictionA: p.predictionA, predictionB: p.predictionB }
    )
    // 总进球从predA/predB字符串解析，与首页保持一致
    const totalGoalsA = parsePredGoals(p.predictionA) ?? model.totalGoalsA
    const totalGoalsB = p.predictionB ? (parsePredGoals(p.predictionB) ?? null) : null
    return {
      matchId: p.matchId,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      group: p.group,
      kickoff: p.kickoff,
      actualScore: p.actualScore,
      predictionA: p.predictionA,
      predictionB: p.predictionB,
      predictionC: p.predictionC,
      probabilityA: p.probabilityA,
      probabilityB: p.probabilityB,
      probabilityC: p.probabilityC,
      directionCorrect: p.directionCorrect,
      exactHit: p.exactHit,
      winDrawLoss: p.winDrawLoss ?? 'home',
      homeWinPct: model.homeWinPct,
      drawPct: model.drawPct,
      awayWinPct: model.awayWinPct,
      totalGoalsA,
      totalGoalsB,
    }
  })

  return <MatchListClient predictions={enriched} />
}
