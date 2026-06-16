import Image from 'next/image'
import { getAllPredictions, parsePredGoals } from '@/lib/predictions'
import { getAnalysis } from '@/lib/kv'
import { computeModelOutput } from '@/lib/model'
import { getFlagUrl } from '@/lib/match-utils'
import LiveScore from '@/components/LiveScore'
import OddsTable from '@/components/OddsTable'
import MRulesCheck from '@/components/MRulesCheck'
import ReasoningChain from '@/components/ReasoningChain'
import PredictionBox from '@/components/PredictionBox'
import BettingCards from '@/components/BettingCards'
import ModelScoreBar from '@/components/ModelScoreBar'
import LiveNews from '@/components/LiveNews'
import teamStatsRaw from '@/data/team-stats.json'

interface TeamStats {
  attackRate: number; defendRate: number; form: number
  pressureIndex: number; confoedrStrength: string; keyThreat?: string; coachStyle?: string
}
const teamStats = teamStatsRaw as unknown as Record<string, TeamStats>

function FlagImg({ team, size = 64 }: { team: string; size?: number }) {
  const url = getFlagUrl(team, '64x48')
  if (!url) return <div style={{ width: size, height: Math.round(size * 0.75), background: '#1e3a5f', borderRadius: 8, flexShrink: 0 }} />
  return <Image src={url} alt={team} width={size} height={Math.round(size * 0.75)} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} unoptimized />
}

function formLabel(form: number): string {
  if (form >= 17) return '六战全胜'
  if (form >= 15) return '五胜一平'
  if (form >= 13) return '胜多负少'
  if (form >= 11) return '状态起伏'
  return '状态一般'
}

export async function generateStaticParams() {
  const { getAllPredictions } = await import('@/lib/predictions')
  return getAllPredictions().map(p => ({ id: String(p.matchId) }))
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)
  const predictions = getAllPredictions()
  const p = predictions.find(pred => pred.matchId === matchId)
  if (!p) return <div className="max-w-4xl mx-auto px-4 py-8 text-base" style={{ color: '#8899aa' }}>未找到该比赛数据</div>

  const analysis = await getAnalysis(matchId)
  const model = computeModelOutput(p.homeTeam, p.awayTeam, p.kickoff, { predictionA: p.predictionA, predictionB: p.predictionB })
  const eloDiff = model.eloHome - model.eloAway
  const hs = teamStats[p.homeTeam]
  const as = teamStats[p.awayTeam]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Match Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#1a2d45)', border: '1px solid #1e3a5f' }}
        className="rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg,transparent,#f5a623,transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#f5a623', fontWeight: 700, letterSpacing: '2px' }}>{p.group}</div>
          <div style={{ fontSize: 13, color: '#6b7f96' }}>
            🕐 {new Date(p.kickoff).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })} 北京时间
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <FlagImg team={p.homeTeam} size={64} />
            <div style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(16px, 3vw, 22px)' }}>{p.homeTeam}</div>
          </div>
          <LiveScore matchId={matchId} initialStatus={p.actualScore ? 'FINISHED' : 'SCHEDULED'} />
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <FlagImg team={p.awayTeam} size={64} />
            <div style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(16px, 3vw, 22px)' }}>{p.awayTeam}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <PredChip label={`A · ${p.probabilityA}%`} value={p.predictionA} color="#f5a623" border />
          <PredChip label={`B · ${p.probabilityB}%`} value={p.predictionB} color="#60a5fa" />
          <PredChip label={`C · ${p.probabilityC}%`} value={p.predictionC} color="#a78bfa" />
          <PredChip
            label="总进球预测"
            value={(() => {
              const a = parsePredGoals(p.predictionA) ?? model.totalGoalsA
              const b = p.predictionB ? parsePredGoals(p.predictionB) : null
              return b !== null && b !== a ? `A:${a}球 / B:${b}球` : `${a}球`
            })()}
            color="#cdd9e5"
          />
          {p.actualScore && <PredChip label="实际结果" value={p.actualScore} color="#4ade80" />}
        </div>
      </div>

      {/* 爆冷预警（仅未开赛且有风险时显示） */}
      {!p.actualScore && p.upsetAlert?.possible && (
        <div style={{
          background: 'linear-gradient(135deg, #1a0a00, #2d1500)',
          border: '1px solid #f97316',
          borderRadius: 16,
          padding: 'clamp(14px, 2vw, 20px)',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ fontSize: 13, color: '#f97316', fontWeight: 800, letterSpacing: '1px' }}>爆冷预警</span>
            <span style={{ fontSize: 11, color: '#6b7f96', marginLeft: 4 }}>参考场景，不列入正式预测</span>
          </div>
          <div style={{ fontSize: 13, color: '#fed7aa', lineHeight: 1.8, marginBottom: 10 }}>
            <span style={{ color: '#f97316', fontWeight: 700 }}>{p.upsetAlert.underdog}</span> 存在爆冷可能
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {p.upsetAlert.factors.map(f => (
              <span key={f} style={{ fontSize: 11, color: '#f97316', background: '#2d1500', border: '1px solid #f9731640', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>{f}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.7, marginBottom: 10 }}>
            {p.upsetAlert.logic}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#6b7f96' }}>爆冷参考比分：</span>
            <span style={{ fontSize: 15, color: '#f97316', fontWeight: 900, letterSpacing: '1px' }}>{p.upsetAlert.referenceScore}</span>
          </div>
        </div>
      )}

      {/* 实时消息（该场比赛相关） */}
      <LiveNews matchId={matchId} />

      {/* 模型评估 */}
      <div style={{ marginBottom: 20 }}>
        <ModelScoreBar
          homeWinPct={model.homeWinPct} drawPct={model.drawPct} awayWinPct={model.awayWinPct}
          expectedGoalsHome={model.expectedGoalsHome} expectedGoalsAway={model.expectedGoalsAway}
          eloHome={model.eloHome} eloAway={model.eloAway}
          totalGoalsA={p.actualScore ? (parsePredGoals(p.predictionA) ?? model.totalGoalsA) : model.totalGoalsA}
          totalGoalsB={p.actualScore ? undefined : model.totalGoalsB}
          mostLikelyScore={model.mostLikelyScore}
          homeTeam={p.homeTeam} awayTeam={p.awayTeam}
        />
      </div>

      {/* 双方详细分析 */}
      <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #0f1d30)', border: '1px solid #1e3a5f', borderRadius: 16, padding: 'clamp(14px, 2vw, 24px)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: '#f5a623', fontWeight: 700, letterSpacing: '1px', marginBottom: 16 }}>
          📊 双方球队深度分析
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {/* 主队 */}
          <div style={{ background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FlagImg team={p.homeTeam} size={28} />
              <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{p.homeTeam}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>实力评分</span>
                <span style={{ color: '#cdd9e5', fontWeight: 700 }}>{model.eloHome}分</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>近期状态</span>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>{hs ? formLabel(hs.form) : '数据暂缺'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>进攻效率</span>
                <span style={{ color: '#cdd9e5' }}>{hs ? hs.attackRate.toFixed(1) : '-'} 球/场</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>防守效率</span>
                <span style={{ color: '#cdd9e5' }}>{hs ? hs.defendRate.toFixed(1) : '-'} 球/场</span>
              </div>
              {hs?.keyThreat && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7f96' }}>核心球员</span>
                  <span style={{ color: '#f5a623', fontWeight: 600 }}>{hs.keyThreat}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>预期进球</span>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>{model.expectedGoalsHome}球</span>
              </div>
            </div>
          </div>
          {/* 客队 */}
          <div style={{ background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FlagImg team={p.awayTeam} size={28} />
              <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{p.awayTeam}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>实力评分</span>
                <span style={{ color: '#cdd9e5', fontWeight: 700 }}>{model.eloAway}分</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>近期状态</span>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>{as ? formLabel(as.form) : '数据暂缺'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>进攻效率</span>
                <span style={{ color: '#cdd9e5' }}>{as ? as.attackRate.toFixed(1) : '-'} 球/场</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>防守效率</span>
                <span style={{ color: '#cdd9e5' }}>{as ? as.defendRate.toFixed(1) : '-'} 球/场</span>
              </div>
              {as?.keyThreat && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7f96' }}>核心球员</span>
                  <span style={{ color: '#f5a623', fontWeight: 600 }}>{as.keyThreat}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7f96' }}>预期进球</span>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>{model.expectedGoalsAway}球</span>
              </div>
            </div>
          </div>
        </div>

        {/* 实力对比总结 */}
        <div style={{ marginTop: 16, padding: 14, background: '#0a1525', border: '1px solid #1a2d45', borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#8899aa', lineHeight: 1.7 }}>
            <span style={{ color: '#f5a623', fontWeight: 700 }}>📐 对比总结：</span>
            {Math.abs(eloDiff) < 60
              ? `双方实力极为接近（差${Math.abs(eloDiff)}分），胜负难料。任何结果都不算意外。`
              : eloDiff > 0
                ? `${p.homeTeam}实力占优（+${eloDiff}分），但优势${Math.abs(eloDiff) > 200 ? '显著' : '有限'}。`
                : `${p.awayTeam}实力占优（+${Math.abs(eloDiff)}分），但优势${Math.abs(eloDiff) > 200 ? '显著' : '有限'}。`
            }
            {model.drawPct >= 33 && ' 平局概率偏高，值得特别关注。'}
            {(() => {
              const a = parsePredGoals(p.predictionA) ?? model.totalGoalsA
              const b = p.predictionB ? parsePredGoals(p.predictionB) : null
              const goalsText = b !== null && b !== a
                ? `总进球预测A:${a}球/B:${b}球。`
                : `总进球预测${a}球。`
              return ` ${goalsText}`
            })()}
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PredictionBox analysis={analysis} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <OddsTable odds={analysis.odds} />
            <MRulesCheck rules={analysis.mRules} />
          </div>
          <ReasoningChain steps={analysis.reasoning} />
          <BettingCards values={analysis.bettingValue} />
        </div>
      ) : (
        <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 16, padding: 'clamp(20px, 3vw, 40px)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🧠</div>
          <div style={{ fontSize: 15, color: '#8899aa', marginBottom: 8 }}>AI 深度分析将在赛前3小时自动生成</div>
          <div style={{ fontSize: 13, color: '#6b7f96' }}>
            当前可查看上方双方数据对比和实时消息追踪
          </div>
        </div>
      )}
    </div>
  )
}

function PredChip({ label, value, color, border }: { label: string; value: string; color: string; border?: boolean }) {
  return (
    <div style={{ background: '#070f1a', border: border ? `1px solid ${color}40` : '1px solid #1a2d45' }} className="rounded-xl px-4 sm:px-6 py-2.5 sm:py-3.5 text-center">
      <div style={{ fontSize: 10, color, letterSpacing: '1px', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 'clamp(14px, 2vw, 17px)', color, fontWeight: 900 }}>{value}</div>
    </div>
  )
}
