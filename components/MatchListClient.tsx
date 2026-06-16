'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getFlagUrl } from '@/lib/match-utils'

interface Prediction {
  matchId: number
  homeTeam: string
  awayTeam: string
  group: string
  kickoff: string
  actualScore: string | null
  predictionA: string
  predictionB: string
  predictionC: string
  probabilityA: number
  probabilityB: number
  probabilityC: number
  directionCorrect: boolean | null
  exactHit: boolean | null
  winDrawLoss: string
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  totalGoalsA: number
  totalGoalsB: number | null
}

interface LiveScore {
  homeScore: number
  awayScore: number
  status: string
  minute: string
  completed: boolean
  inProgress: boolean
}

// ESPN key lookup：尝试双向匹配，因为ESPN里主客队顺序可能与我们predictions相反
function findLiveScore(
  p: Prediction,
  liveScores: Record<string, LiveScore>
): { score: LiveScore; reversed: boolean } | null {
  const key1 = `${p.homeTeam}|${p.awayTeam}`
  if (liveScores[key1]) return { score: liveScores[key1], reversed: false }
  const key2 = `${p.awayTeam}|${p.homeTeam}`
  if (liveScores[key2]) return { score: liveScores[key2], reversed: true }
  return null
}

// 从ESPN终场比分推算胜平负方向
function computeDirectionFromScore(
  winDrawLoss: string,
  homeScore: number,
  awayScore: number
): boolean {
  const actual = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw'
  return actual === winDrawLoss
}

// 从ESPN比分检查是否有精确命中
function computeExactHit(
  preds: string[],
  homeScore: number,
  awayScore: number
): boolean {
  const scoreStr = `${homeScore}-${awayScore}`
  return preds.some(pred => pred.includes(scoreStr))
}

function dirLabel(wdl: string, home: string, away: string) {
  if (wdl === 'home') return { icon: '🏠', text: `${home} 胜`, color: '#4ade80' }
  if (wdl === 'away') return { icon: '✈️', text: `${away} 胜`, color: '#60a5fa' }
  return { icon: '🤝', text: '平局', color: '#f5a623' }
}

function FlagImg({ team, size = 32 }: { team: string; size?: number }) {
  const url = getFlagUrl(team, '64x48')
  if (!url) return <div style={{ width: size, height: Math.round(size * 0.75), background: '#1e3a5f', borderRadius: 4, flexShrink: 0 }} />
  return <Image src={url} alt={team} width={size} height={Math.round(size * 0.75)} style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} unoptimized />
}

export default function MatchListClient({ predictions }: { predictions: Prediction[] }) {
  const [now, setNow] = useState(() => new Date())
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({})
  const [lastPoll, setLastPoll] = useState<Date | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/espn-scores', { cache: 'no-store' })
      const data = await res.json()
      if (data.scores) {
        setLiveScores(data.scores)
        setLastPoll(new Date())
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchScores()
    const interval = setInterval(fetchScores, 30000)
    return () => clearInterval(interval)
  }, [fetchScores])

  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // 判断比赛是否已结束：actualScore已录入 OR ESPN显示completed=true
  function isMatchFinished(p: Prediction): boolean {
    if (p.actualScore !== null) return true
    const found = findLiveScore(p, liveScores)
    return found?.score.completed === true
  }

  // 获取显示用比分（优先actualScore，fallback ESPN实时）和是否主客队翻转
  function getDisplayScore(p: Prediction): {
    score: string | null
    fromEspn: boolean
    homeScore: number
    awayScore: number
    espnReversed: boolean
  } {
    if (p.actualScore !== null) {
      const [h, a] = p.actualScore.split('-').map(Number)
      return { score: p.actualScore, fromEspn: false, homeScore: h, awayScore: a, espnReversed: false }
    }
    const found = findLiveScore(p, liveScores)
    if (found) {
      const { score, reversed } = found
      // 若ESPN主客队顺序翻转，则交换分数
      const homeScore = reversed ? score.awayScore : score.homeScore
      const awayScore = reversed ? score.homeScore : score.awayScore
      const scoreStr = `${homeScore}-${awayScore}`
      return { score: scoreStr, fromEspn: true, homeScore, awayScore, espnReversed: reversed }
    }
    return { score: null, fromEspn: false, homeScore: 0, awayScore: 0, espnReversed: false }
  }

  const inProgress = predictions.filter(p => {
    if (isMatchFinished(p)) return false
    const kickoff = new Date(p.kickoff)
    return kickoff <= now
  }).sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())

  const upcoming24h = predictions.filter(p => {
    if (isMatchFinished(p)) return false
    const kickoff = new Date(p.kickoff)
    return kickoff > now && kickoff <= next24h
  }).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  const finished = predictions
    .filter(p => isMatchFinished(p))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())

  const totalUpcoming = predictions.filter(p => !isMatchFinished(p)).length

  function fmtKickoff(kickoff: string) {
    return new Date(kickoff).toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">⚽</span>
          <span style={{ color: '#f5a623', fontSize: 13, letterSpacing: '3px' }} className="font-bold uppercase">Match Analysis</span>
        </div>
        <h1 className="text-3xl font-black mb-2 text-white">比赛分析</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p style={{ color: '#8899aa' }} className="text-base">
            共 {totalUpcoming} 场待开赛 · 点击查看完整推理链
          </p>
          {lastPoll && (
            <span style={{ fontSize: 11, color: '#3d5470', background: '#070f1a', padding: '2px 8px', borderRadius: 6 }}>
              比分更新 {lastPoll.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ── 🔴 已开赛 · 实时追踪 ── */}
      {inProgress.length > 0 && (
        <section className="mb-12">
          <h2 style={{ fontSize: 14, color: '#ef4444', letterSpacing: '2px' }} className="font-bold uppercase mb-5 flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            🔴 已开赛 · 实时追踪
            <button onClick={fetchScores} style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7f96', background: '#0d1b2a', border: '1px solid #1e3a5f', padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}>
              ↻ 刷新
            </button>
          </h2>
          <div className="space-y-4">
            {inProgress.map(p => {
              const found = findLiveScore(p, liveScores)
              const live = found?.score ?? null
              const reversed = found?.reversed ?? false
              const homeScore = live ? (reversed ? live.awayScore : live.homeScore) : null
              const awayScore = live ? (reversed ? live.homeScore : live.awayScore) : null
              const hasScore = homeScore !== null && awayScore !== null

              return (
                <Link key={p.matchId} href={`/match/${p.matchId}`}
                  style={{ background: 'linear-gradient(135deg, #0d1b2a, #1a0f0f)', border: '1px solid #ef444440', display: 'block', textDecoration: 'none' }}
                  className="rounded-2xl hover:border-red-500/50 transition-all overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, letterSpacing: '2px', background: '#3d1f1f', padding: '3px 10px', borderRadius: 6 }}>{p.group}</span>
                        {live?.inProgress && (
                          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                            {live.minute}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7f96' }}>🕐 {fmtKickoff(p.kickoff)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <FlagImg team={p.homeTeam} size={36} />
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{p.homeTeam}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {hasScore ? (
                          <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', letterSpacing: 2 }}>
                            {homeScore} <span style={{ color: '#3d5470' }}>-</span> {awayScore}
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 700 }}>VS</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{p.awayTeam}</span>
                        <FlagImg team={p.awayTeam} size={36} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                      {[
                        { label: `A ${p.probabilityA}%`, value: p.predictionA, color: '#f5a623' },
                        { label: `B ${p.probabilityB}%`, value: p.predictionB, color: '#60a5fa' },
                        { label: `C ${p.probabilityC}%`, value: p.predictionC, color: '#a78bfa' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: '#070f1a', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color, marginBottom: 2, fontWeight: 700 }}>{label}</div>
                          <div style={{ color, fontWeight: 900, fontSize: 12 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const dl = dirLabel(p.winDrawLoss, p.homeTeam, p.awayTeam)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '6px 12px', background: '#070f1a', borderRadius: 8, border: '1px solid #1e3a5f' }}>
                          <span style={{ fontSize: 10, color: '#3d5470', flexShrink: 0 }}>胜平负预测</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: dl.color }}>{dl.icon} {dl.text}</span>
                          <span style={{ fontSize: 10, color: '#3d5470', marginLeft: 'auto' }}>↗ 首页准确率追踪</span>
                        </div>
                      )
                    })()}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── ⏳ 24小时内即将开赛 ── */}
      {upcoming24h.length > 0 && (
        <section className="mb-12">
          <h2 style={{ fontSize: 14, color: '#f5a623', letterSpacing: '2px' }} className="font-bold uppercase mb-5 flex items-center gap-2">
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#f5a623', display: 'inline-block' }} />
            ⏳ 即将开赛 · 24小时内
          </h2>
          <div className="space-y-4">
            {upcoming24h.map(p => (
              <Link key={p.matchId} href={`/match/${p.matchId}`}
                style={{ background: 'linear-gradient(135deg, #0d1b2a, #0f1d30)', border: '1px solid #1e3a5f', display: 'block', textDecoration: 'none' }}
                className="rounded-2xl hover:border-yellow-600/50 transition-all overflow-hidden">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 12, color: '#f5a623', fontWeight: 700, letterSpacing: '2px', background: '#1a2d45', padding: '3px 10px', borderRadius: 6 }}>{p.group}</span>
                      <span style={{ fontSize: 13, color: '#6b7f96' }}>🕐 北京时间 {fmtKickoff(p.kickoff)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <FlagImg team={p.homeTeam} size={36} />
                      <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{p.homeTeam}</span>
                    </div>
                    <span style={{ color: '#3d5470', fontSize: 13, fontWeight: 700 }}>VS</span>
                    <div className="flex items-center gap-3">
                      <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{p.awayTeam}</span>
                      <FlagImg team={p.awayTeam} size={36} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: `A · ${p.probabilityA}%`, value: p.predictionA, color: '#f5a623', border: '#f5a62330' },
                      { label: `B · ${p.probabilityB}%`, value: p.predictionB, color: '#60a5fa', border: '#60a5fa30' },
                      { label: `C · ${p.probabilityC}%`, value: p.predictionC, color: '#a78bfa', border: '#a78bfa30' },
                    ].map(({ label, value, color, border }) => (
                      <div key={label} style={{ background: '#070f1a', border: `1px solid ${border}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color, marginBottom: 4, fontWeight: 700 }}>{label}</div>
                        <div style={{ color, fontWeight: 900, fontSize: 14 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#3d5470', marginBottom: 10 }}>
                    ⚽ 预测进球：
                    <span style={{ color: '#f5a623', fontWeight: 700 }}>A:{p.totalGoalsA}球</span>
                    {p.totalGoalsB !== null && p.totalGoalsB !== p.totalGoalsA && (
                      <span style={{ color: '#60a5fa', fontWeight: 700 }}> / B:{p.totalGoalsB}球</span>
                    )}
                  </div>
                  {(() => {
                    const dl = dirLabel(p.winDrawLoss, p.homeTeam, p.awayTeam)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', background: '#070f1a', borderRadius: 10, border: `1px solid ${dl.color}30` }}>
                        <span style={{ fontSize: 11, color: '#6b7f96', flexShrink: 0 }}>📊 胜平负预测</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: dl.color }}>{dl.icon} {dl.text}</span>
                        <span style={{ fontSize: 10, color: '#3d5470', marginLeft: 'auto' }}>↗ 首页准确率追踪</span>
                      </div>
                    )
                  })()}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                      <span style={{ color: '#4ade80' }}>{p.homeTeam} {p.homeWinPct}%</span>
                      <span style={{ color: '#f5a623' }}>平 {p.drawPct}%</span>
                      <span style={{ color: '#60a5fa' }}>{p.awayTeam} {p.awayWinPct}%</span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 9999, overflow: 'hidden', background: '#070f1a' }}>
                      <div style={{ width: `${p.homeWinPct}%`, background: 'linear-gradient(90deg,#15803d,#22c55e)' }} />
                      <div style={{ width: `${p.drawPct}%`, background: 'linear-gradient(90deg,#b45309,#f59e0b)' }} />
                      <div style={{ width: `${p.awayWinPct}%`, background: 'linear-gradient(90deg,#1d4ed8,#60a5fa)' }} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcoming24h.length === 0 && inProgress.length === 0 && (
        <section className="mb-12">
          <div style={{ background: '#0d1b2a', border: '1px solid #1e3a5f' }} className="rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">⏰</div>
            <div style={{ color: '#8899aa', fontSize: 16 }}>未来24小时内暂无待开赛比赛</div>
            <Link href="/preview" style={{ color: '#f5a623', fontSize: 14, textDecoration: 'none', marginTop: 10, display: 'inline-block' }}>
              查看所有待分析场次 →
            </Link>
          </div>
        </section>
      )}

      {/* ── ✅ 已完成 · 赛后复盘 ── */}
      {finished.length > 0 && (
        <section>
          <h2 style={{ fontSize: 14, color: '#22c55e', letterSpacing: '2px' }} className="font-bold uppercase mb-5 flex items-center gap-2">
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} />
            ✅ 已完成 · 赛后复盘
          </h2>
          <div className="space-y-2.5">
            {finished.slice(0, 16).map(p => {
              const ds = getDisplayScore(p)
              // 方向结果：优先用predictions.json里的，没有则用ESPN实时计算
              const dirResult: boolean | null = p.directionCorrect !== null
                ? p.directionCorrect
                : ds.score !== null
                  ? computeDirectionFromScore(p.winDrawLoss, ds.homeScore, ds.awayScore)
                  : null
              const hitResult: boolean | null = p.exactHit !== null
                ? p.exactHit
                : ds.score !== null
                  ? computeExactHit([p.predictionA, p.predictionB, p.predictionC], ds.homeScore, ds.awayScore)
                  : null

              return (
                <Link key={p.matchId} href={`/match/${p.matchId}`}
                  style={{ background: '#0d1b2a', border: '1px solid #1e3a5f', display: 'block', textDecoration: 'none' }}
                  className="rounded-xl p-4 hover:border-yellow-600/40 transition-all">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span style={{ fontSize: 12, color: '#6b7f96', minWidth: 64, flexShrink: 0 }}>{fmtKickoff(p.kickoff)}</span>
                    <span style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, minWidth: 40, flexShrink: 0 }}>{p.group}</span>
                    <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{p.homeTeam}</span>
                    <span style={{ color: '#f5a623', fontWeight: 900, fontSize: 16 }}>
                      {ds.score ?? '?-?'}
                    </span>
                    <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{p.awayTeam}</span>
                    {ds.fromEspn && (
                      <span style={{ fontSize: 10, color: '#3d5470', background: '#070f1a', padding: '1px 5px', borderRadius: 4 }}>⚡ESPN</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* 总进球：A球/B球 → 实际X球 命中标记 */}
                      {ds.score !== null && (() => {
                        const actualTotal = ds.homeScore + ds.awayScore
                        const hitA = actualTotal === p.totalGoalsA
                        const hitB = p.totalGoalsB !== null && actualTotal === p.totalGoalsB
                        const showB = p.totalGoalsB !== null && p.totalGoalsB !== p.totalGoalsA
                        return (
                          <span style={{ color: '#3d5470', fontSize: 11 }}>
                            ⚽<span style={{ color: '#f5a623' }}>{p.totalGoalsA}</span>
                            {showB && <span style={{ color: '#60a5fa' }}>/{p.totalGoalsB}</span>}
                            球→{actualTotal}球
                            {(hitA || hitB) ? <span style={{ color: '#4ade80' }}>✅</span> : <span style={{ color: '#ef4444' }}>❌</span>}
                          </span>
                        )
                      })()}
                      {(() => {
                        const dl = dirLabel(p.winDrawLoss, p.homeTeam, p.awayTeam)
                        return (
                          <span style={{ color: dirResult ? dl.color : dirResult === false ? '#6b7f96' : '#3d5470', fontWeight: 700 }}>
                            {dl.icon} {dl.text}
                          </span>
                        )
                      })()}
                      {hitResult
                        ? <span style={{ color: '#4ade80' }}>🎯</span>
                        : dirResult
                          ? <span style={{ color: '#4ade80' }}>✅</span>
                          : dirResult === false
                            ? <span style={{ color: '#ef4444' }}>❌</span>
                            : <span style={{ color: '#3d5470' }}>—</span>
                      }
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
