import Link from 'next/link'
import Image from 'next/image'
import { getAllPredictions, getAccuracyStats, parsePredGoals } from '@/lib/predictions'
import { getFlagUrl } from '@/lib/match-utils'

export const revalidate = 60

function FlagImg({ team, size = 28 }: { team: string; size?: number }) {
  const url = getFlagUrl(team, '64x48')
  if (!url) return <div style={{ width: size, height: Math.round(size * 0.75), background: '#1e3a5f', borderRadius: 4, flexShrink: 0 }} />
  return <Image src={url} alt={team} width={size} height={Math.round(size * 0.75)} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} unoptimized />
}

function makeSummary(p: ReturnType<typeof getAllPredictions>[0]): string {
  if (!p.actualScore) return ''
  if (p.exactHit) {
    return `预测「${p.actualScore}」完全命中`
  }
  if (p.directionCorrect) {
    const [hg, ag] = p.actualScore.split('-').map(Number)
    const winner = hg > ag ? p.homeTeam : ag > hg ? p.awayTeam : '平局'
    return `方向正确（${winner}${hg === ag ? '握手言和' : '胜'}），比分 ${p.actualScore}`
  }
  return `方向错误，实际 ${p.actualScore}`
}

function hitBadge(p: { directionCorrect: boolean | null; predictionA: string | null; actualScore: string | null }) {
  const predAExact = (() => {
    if (!p.predictionA || !p.actualScore) return false
    const m = p.predictionA.match(/(\d+)\s*[-–—]\s*(\d+)/)
    return m ? `${m[1]}-${m[2]}` === p.actualScore : false
  })()
  if (predAExact) {
    return <span style={{ background: '#14532d', color: '#4ade80', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999, flexShrink: 0 }}>🎯 命中</span>
  }
  if (p.directionCorrect) {
    return <span style={{ background: '#1a2d45', color: '#60a5fa', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999, flexShrink: 0 }}>✅ 方向对</span>
  }
  return <span style={{ background: '#3d1f1f', color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999, flexShrink: 0 }}>❌ 方向错</span>
}

export default function HomePage() {
  const predictions = getAllPredictions()
  const stats = getAccuracyStats()

  const finished = predictions
    .filter(p => p.actualScore !== null)
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🏆</span>
          <span style={{ color: '#f5a623', fontSize: 12, letterSpacing: '3px', fontWeight: 700 }}>
            2026 FIFA WORLD CUP
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 8, color: 'white' }}>
          AI 深度预测 <span style={{ color: '#f5a623' }}>赛后复盘</span>
        </h1>
        <p style={{ color: '#8899aa', fontSize: 'clamp(13px, 2vw, 15px)' }}>
          胜平负 · 比分 · 总进球三项独立追踪
        </p>
      </div>

      {/* 准确率双模块 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
        {/* 比分类 */}
        <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: '1px solid #2ecc71', borderRadius: 16, padding: 'clamp(12px, 2vw, 20px)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>📊 胜平负</div>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#2ecc71' }}>{stats.scoreDirectionRate}%</div>
          <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>{stats.scoreDirectionHits}/{stats.total} 场</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: '1px solid #4ade80', borderRadius: 16, padding: 'clamp(12px, 2vw, 20px)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>🎯 比分正确率</div>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#4ade80' }}>{stats.scoreExactRate}%</div>
          <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>{stats.scoreExactHits}/{stats.total} 场</div>
        </div>
        {/* 总进球A */}
        <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: '1px solid #f5a623', borderRadius: 16, padding: 'clamp(12px, 2vw, 20px)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>⚽ 总进球A命中率</div>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#f5a623' }}>{stats.totalGoalsRate}%</div>
          <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>{stats.totalGoalsHits}/{stats.total} 场</div>
        </div>
        {/* 总进球B（仅统计B与A不同的场次） */}
        <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: '1px solid #a78bfa', borderRadius: 16, padding: 'clamp(12px, 2vw, 20px)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>⚽ 总进球B命中率</div>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#a78bfa' }}>{stats.totalGoalsBRate}%</div>
          <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>{stats.totalGoalsBHits}/{stats.totalGoalsBTotal} 场(A≠B)</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: '1px solid #60a5fa', borderRadius: 16, padding: 'clamp(12px, 2vw, 20px)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>🧠 已分析</div>
          <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#60a5fa' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>场已完成</div>
        </div>
      </div>

      {/* 已完成比赛 */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
            <h2 style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', color: '#cdd9e5', letterSpacing: '1px', fontWeight: 700 }}>
              ✅ 已完成比赛 · 赛后复盘
            </h2>
            <span style={{ fontSize: 12, color: '#f5a623', background: '#1a2d45', padding: '2px 10px', borderRadius: 9999 }}>
              {finished.length} 场
            </span>
          </div>
        </div>

        {finished.length === 0 ? (
          <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5f', borderRadius: 20, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚽</div>
            <div style={{ color: '#8899aa', fontSize: 15 }}>暂无已完成的比赛</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {finished.map(p => {
              const summary = makeSummary(p)
              const kickoffBeijing = new Date(p.kickoff).toLocaleString('zh-CN', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
              })

              return (
                <Link key={p.matchId} href={`/match/${p.matchId}`}
                  style={{
                    background: 'linear-gradient(135deg, #0d1b2a, #0f1d30)',
                    border: '1px solid #1e3a5f',
                    display: 'block',
                    textDecoration: 'none',
                  }}
                  className="rounded-2xl hover:border-yellow-600/50 transition-all overflow-hidden">

                  <div style={{ padding: 'clamp(12px, 2vw, 20px)' }}>
                    {/* 顶行 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, letterSpacing: '1px', background: '#1a2d45', padding: '2px 8px', borderRadius: 6 }}>
                          {p.group}
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7f96' }}>
                          🕐 {kickoffBeijing}
                        </span>
                      </div>
                      {hitBadge({ directionCorrect: p.directionCorrect, predictionA: p.predictionA, actualScore: p.actualScore })}
                    </div>

                    {/* 两队 + 比分 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 20px)', marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FlagImg team={p.homeTeam} size={32} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>{p.homeTeam}</span>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #0a1525, #111f30)',
                        border: '2px solid #f5a623',
                        borderRadius: 12,
                        padding: '6px 14px',
                        flexShrink: 0,
                      }}>
                        <span style={{ color: '#f5a623', fontWeight: 900, fontSize: 'clamp(18px, 3vw, 24px)', letterSpacing: '1px' }}>{p.actualScore}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(14px, 2.5vw, 18px)' }}>{p.awayTeam}</span>
                        <FlagImg team={p.awayTeam} size={32} />
                      </div>
                    </div>

                    {/* 3预测对比 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(6px, 1.5vw, 12px)', flexWrap: 'wrap', fontSize: 'clamp(10px, 1.3vw, 12px)' }}>
                      <span style={{ color: '#f5a623', fontWeight: 600 }}>A {p.probabilityA}%</span>
                      <span style={{ fontWeight: 700, color: p.predictionA === p.actualScore ? '#4ade80' : '#8899aa', textDecoration: p.predictionA === p.actualScore ? 'none' : 'line-through' }}>{p.predictionA}</span>
                      <span style={{ color: '#3d5470' }}>|</span>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>B {p.probabilityB}%</span>
                      <span style={{ fontWeight: 700, color: p.predictionB === p.actualScore ? '#4ade80' : '#8899aa', textDecoration: p.predictionB === p.actualScore ? 'none' : 'line-through' }}>{p.predictionB}</span>
                      <span style={{ color: '#3d5470' }}>|</span>
                      <span style={{ color: '#a78bfa', fontWeight: 600 }}>C {p.probabilityC}%</span>
                      <span style={{ fontWeight: 700, color: p.predictionC === p.actualScore ? '#4ade80' : '#8899aa', textDecoration: p.predictionC === p.actualScore ? 'none' : 'line-through' }}>{p.predictionC}</span>
                    </div>

                    {/* 总进球对比：predictionA 和 predictionB 各自显示 */}
                    {(() => {
                      if (!p.actualScore || !p.predictionA) return null
                      const predTotalA = parsePredGoals(p.predictionA)
                      const predTotalB = p.predictionB ? parsePredGoals(p.predictionB) : null
                      if (predTotalA === null) return null
                      const [hg, ag] = p.actualScore.split('-').map(Number)
                      const actualTotal = hg + ag
                      const hitA = actualTotal === predTotalA
                      const hitB = predTotalB !== null && actualTotal === predTotalB
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'clamp(10px, 1.3vw, 12px)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #1e3a5f' }}>
                          <span style={{ color: '#6b7f96' }}>⚽ 总进球</span>
                          <span style={{ color: '#f5a623', fontWeight: 700 }}>A:{predTotalA}球</span>
                          <span style={{ color: hitA ? '#4ade80' : '#6b7f96' }}>{hitA ? '✅' : '❌'}</span>
                          {predTotalB !== null && predTotalB !== predTotalA && (
                            <>
                              <span style={{ color: '#3d5470' }}>/</span>
                              <span style={{ color: '#60a5fa', fontWeight: 700 }}>B:{predTotalB}球</span>
                              <span style={{ color: hitB ? '#4ade80' : '#6b7f96' }}>{hitB ? '✅' : '❌'}</span>
                            </>
                          )}
                          <span style={{ color: '#3d5470' }}>→ 实际</span>
                          <strong style={{ color: (hitA || hitB) ? '#4ade80' : '#ef4444' }}>{actualTotal}球</strong>
                        </div>
                      )
                    })()}

                    {/* 总结 */}
                    {summary && (
                      <div style={{
                        fontSize: 'clamp(12px, 1.5vw, 14px)',
                        color: '#8899aa',
                        lineHeight: 1.7,
                        borderTop: '1px solid #1e3a5f',
                        paddingTop: 12,
                        marginTop: 12,
                      }}>
                        💡 {summary}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 快速入口 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 32 }}>
        {[
          { href: '/preview', icon: '🔮', label: '赛前分析', desc: '24h内待开赛' },
          { href: '/standings', icon: '📊', label: '积分榜', desc: '实时排名' },
          { href: '/accuracy', icon: '📈', label: '准确率', desc: '双模块追踪' },
          { href: '/methodology', icon: '🧠', label: '方法论', desc: '七维分析' },
        ].map(link => (
          <Link key={link.href} href={link.href}
            style={{ background: '#0d1b2a', border: '1px solid #1e3a5f', textDecoration: 'none', display: 'block' }}
            className="rounded-xl p-4 hover:border-yellow-600/40 transition-all text-center">
            <div style={{ fontSize: 24, marginBottom: 6 }}>{link.icon}</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{link.label}</div>
            <div style={{ fontSize: 11, color: '#6b7f96' }}>{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
