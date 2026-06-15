export const revalidate = 30

import Image from 'next/image'
import Link from 'next/link'
import { getAllPredictions } from '@/lib/predictions'
import { computeModelOutput } from '@/lib/model'
import { getFlagUrl } from '@/lib/match-utils'
import LiveNews from '@/components/LiveNews'
import teamStatsRaw from '@/data/team-stats.json'

interface TeamStats {
  attackRate: number
  defendRate: number
  form: number
  pressureIndex: number
  confoedrStrength: string
  coachStyle?: string
  keyThreat?: string
}
const teamStats = teamStatsRaw as unknown as Record<string, TeamStats>

function FlagImg({ team, size = 36 }: { team: string; size?: number }) {
  const url = getFlagUrl(team, '64x48')
  if (!url) return <div style={{ width: size, height: Math.round(size * 0.75), background: '#1e3a5f', borderRadius: 4, flexShrink: 0 }} />
  return <Image src={url} alt={team} width={size} height={Math.round(size * 0.75)} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} unoptimized />
}

function formLabel(form: number): string {
  if (form >= 17) return '六战全胜，状态爆棚'
  if (form >= 15) return '五胜一平，状态极佳'
  if (form >= 13) return '状态良好，胜多负少'
  if (form >= 11) return '状态起伏，偶有失利'
  if (form >= 9) return '状态一般，表现不稳'
  return '状态较差，连续失利'
}

function strengthGap(diff: number, stronger: string, weaker: string): string {
  const abs = Math.abs(diff)
  if (abs > 400) return `${stronger}是世界顶级强队，实力远超${weaker}，纸面差距极为悬殊`
  if (abs > 250) return `${stronger}整体实力明显强于${weaker}，是本场毫无争议的大热门`
  if (abs > 130) return `${stronger}实力小幅领先${weaker}，但差距不足以掉以轻心`
  if (abs > 60) return `双方实力相当接近，${stronger}略占上风，比赛走向很难预判`
  return `双方实力几乎持平，任何结果都有可能，是本轮最难预测的比赛之一`
}

function goalStyleDesc(xgHome: number, xgAway: number): string {
  const total = Math.round((xgHome + xgAway) * 10) / 10
  if (total >= 3.5) return `两队合计预计进${total}个球，进攻风格积极，不太可能踢出低分闷平`
  if (total >= 2.5) return `预计总进球约${total}个，双方攻守均衡，偶有精彩进球`
  if (total >= 1.5) return `预计进球偏少（约${total}个），至少一方偏重防守，节奏谨慎`
  return `预计是一场低进球防守型比赛（不超过2球），双方可能长时间相互试探`
}

function drawRiskDesc(drawPct: number): string | null {
  if (drawPct >= 35) return `平局概率高达${drawPct}%，是本场最不能忽视的结果`
  if (drawPct >= 28) return `平局概率${drawPct}%不低，双方都有守住平局的动机和能力`
  return null
}

function teamStrengthDesc(stats: TeamStats | undefined, team: string, elo: number): string {
  if (!stats) return `${team}数据暂缺`
  const parts: string[] = []
  parts.push(`实力 ${elo}分`)
  parts.push(formLabel(stats.form))
  if (stats.keyThreat) parts.push(`核心：${stats.keyThreat}`)
  parts.push(`进攻${stats.attackRate.toFixed(1)}/防守${stats.defendRate.toFixed(1)}`)
  return parts.join(' · ')
}


export default function PreviewPage() {
  const all = getAllPredictions()
  const allUpcoming = all.filter(p => p.actualScore === null)

  const now = new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const upcoming = allUpcoming
    .filter(p => {
      const kickoff = new Date(p.kickoff)
      return kickoff > now && kickoff <= next24h
    })
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🔮</span>
          <span style={{ color: '#f5a623', fontSize: 13, letterSpacing: '3px' }} className="font-bold uppercase">
            Pre-Match Analysis
          </span>
        </div>
        <h1 className="text-3xl font-black mb-2 text-white">赛前深度分析</h1>
        <p style={{ color: '#8899aa' }} className="text-base">
          仅展示未来24小时内比赛（北京时间）· 超出范围因实时因素误差大不展示 · 共 {allUpcoming.length} 场待开赛
        </p>
      </div>

      {/* 赛前深度情报（仅展示赛前分析，过滤终场结果） */}
      <LiveNews preMatchOnly={true} />

      {upcoming.length === 0 ? (
        <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5f' }} className="rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">⏰</div>
          <div style={{ color: '#8899aa', fontSize: 16 }}>未来24小时内暂无待开赛比赛</div>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.map(p => {
            const model = computeModelOutput(p.homeTeam, p.awayTeam, p.kickoff, { predictionA: p.predictionA, predictionB: p.predictionB })
            const kickoffLocal = new Date(p.kickoff).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
            })
            const eloDiff = model.eloHome - model.eloAway
            const hs = teamStats[p.homeTeam]
            const as = teamStats[p.awayTeam]
            const stronger = eloDiff >= 0 ? p.homeTeam : p.awayTeam
            const weaker = eloDiff >= 0 ? p.awayTeam : p.homeTeam
            const drawRisk = drawRiskDesc(model.drawPct)

            return (
              <div key={p.matchId}
                style={{ background: 'linear-gradient(135deg, #0d1b2a, #0f1d30)', border: '1px solid #1e3a5f' }}
                className="rounded-2xl overflow-hidden">

                {/* 头部 */}
                <div style={{ background: 'linear-gradient(90deg, #0a1525, #111f30)', borderBottom: '1px solid #1e3a5f', padding: '16px 24px' }}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2.5">
                        <FlagImg team={p.homeTeam} size={36} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 17 }}>{p.homeTeam}</span>
                      </div>
                      <span style={{ color: '#3d5470', fontSize: 14, fontWeight: 700 }}>VS</span>
                      <div className="flex items-center gap-2.5">
                        <FlagImg team={p.awayTeam} size={36} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 17 }}>{p.awayTeam}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#8899aa' }}>🕐 北京时间 {kickoffLocal}</div>
                      <div style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, marginTop: 2 }}>{p.group}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                  {/* 胜平负概率条 */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, fontWeight: 700 }}>
                      <span style={{ color: '#4ade80' }}>{p.homeTeam} 胜 {model.homeWinPct}%</span>
                      <span style={{ color: '#f5a623' }}>平局 {model.drawPct}%</span>
                      <span style={{ color: '#60a5fa' }}>{p.awayTeam} 胜 {model.awayWinPct}%</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 9999, overflow: 'hidden', background: '#070f1a' }}>
                      <div style={{ width: `${model.homeWinPct}%`, background: 'linear-gradient(90deg,#15803d,#22c55e)', transition: 'width 0.5s' }} />
                      <div style={{ width: `${model.drawPct}%`, background: 'linear-gradient(90deg,#b45309,#f59e0b)', transition: 'width 0.5s' }} />
                      <div style={{ width: `${model.awayWinPct}%`, background: 'linear-gradient(90deg,#1d4ed8,#60a5fa)', transition: 'width 0.5s' }} />
                    </div>
                  </div>

                  {/* 3预测 + 概率 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 22 }}>
                    <div style={{ background: '#070f1a', border: '1px solid #f5a62340', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#f5a623', marginBottom: 6, letterSpacing: '1px', fontWeight: 700 }}>预测 A {p.probabilityA}%</div>
                      <div style={{ color: '#f5a623', fontWeight: 900, fontSize: 'clamp(13px, 1.5vw, 15px)' }}>{p.predictionA}</div>
                    </div>
                    <div style={{ background: '#070f1a', border: '1px solid #60a5fa40', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#60a5fa', marginBottom: 6, letterSpacing: '1px', fontWeight: 700 }}>预测 B {p.probabilityB}%</div>
                      <div style={{ color: '#60a5fa', fontWeight: 900, fontSize: 'clamp(13px, 1.5vw, 15px)' }}>{p.predictionB}</div>
                    </div>
                    <div style={{ background: '#070f1a', border: '1px solid #a78bfa40', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 6, letterSpacing: '1px', fontWeight: 700 }}>预测 C {p.probabilityC}%</div>
                      <div style={{ color: '#a78bfa', fontWeight: 900, fontSize: 'clamp(13px, 1.5vw, 15px)' }}>{p.predictionC}</div>
                    </div>
                    <div style={{ background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#6b7f96', marginBottom: 6, letterSpacing: '1px' }}>总进球</div>
                      <div style={{ color: '#cdd9e5', fontWeight: 900, fontSize: 'clamp(13px, 1.5vw, 15px)' }}>{model.totalGoalsA}~{model.totalGoalsB}球</div>
                    </div>
                  </div>

                  {/* ===== 双方队伍分析 ===== */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 22 }}>
                    {/* 主队 */}
                    <div style={{ background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 14, padding: 16 }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FlagImg team={p.homeTeam} size={22} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{p.homeTeam}</span>
                        <span style={{ fontSize: 10, color: '#f5a623', background: '#1a2d45', padding: '1px 8px', borderRadius: 9999, marginLeft: 'auto' }}>
                          {eloDiff >= 0 ? '📈 实力占优' : '📉 实力劣势'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8899aa', lineHeight: 1.7 }}>
                        {teamStrengthDesc(hs, p.homeTeam, model.eloHome)}
                      </div>
                    </div>
                    {/* 客队 */}
                    <div style={{ background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 14, padding: 16 }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FlagImg team={p.awayTeam} size={22} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{p.awayTeam}</span>
                        <span style={{ fontSize: 10, color: '#f5a623', background: '#1a2d45', padding: '1px 8px', borderRadius: 9999, marginLeft: 'auto' }}>
                          {eloDiff <= 0 ? '📈 实力占优' : '📉 实力劣势'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8899aa', lineHeight: 1.7 }}>
                        {teamStrengthDesc(as, p.awayTeam, model.eloAway)}
                      </div>
                    </div>
                  </div>

                  {/* 实力对比 + 进球预期 */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, color: '#f5a623', fontWeight: 700, letterSpacing: '2px', marginBottom: 10 }}>
                      📋 综合判断依据
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        strengthGap(eloDiff, stronger, weaker),
                        goalStyleDesc(model.expectedGoalsHome, model.expectedGoalsAway),
                        drawRisk,
                        p.mRulesTriggered?.length ? `触发规则：${p.mRulesTriggered.join('、')}` : null,
                      ].filter(Boolean).map((text, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, lineHeight: 1.7 }}>
                          <span style={{
                            color: '#f5a623', fontSize: 13, fontWeight: 700, flexShrink: 0, width: 22, textAlign: 'center'
                          }}>
                            {['①','②','③','④'][i]}
                          </span>
                          <span style={{ color: '#9db0c8', fontSize: 14 }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 球队情报 */}
                  {p.teamNews && p.teamNews.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, letterSpacing: '2px', marginBottom: 10 }}>
                        🔍 赛前情报
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.teamNews.map((item, i) => {
                          const icon = item.startsWith('✅') ? '#4ade80'
                            : item.startsWith('❌') ? '#ef4444'
                            : item.startsWith('🟡') ? '#f5a623'
                            : item.startsWith('💡') ? '#a78bfa'
                            : '#6b7f96'
                          return (
                            <div key={i} style={{
                              fontSize: 12, color: '#8899aa', lineHeight: 1.6,
                              padding: '6px 10px',
                              background: '#070f1a',
                              borderLeft: `3px solid ${icon}`,
                              borderRadius: '0 8px 8px 0',
                            }}>
                              {item}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
