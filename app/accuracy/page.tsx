import { getAllPredictions, getAccuracyStats } from '@/lib/predictions'
import { computeModelOutput } from '@/lib/model'

function StatCard({ value, label, color, sub }: { value: string; label: string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #111f30)', border: `1px solid ${color}40`, borderRadius: 16, padding: 'clamp(14px, 2.5vw, 22px)', textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8899aa', fontWeight: 600, letterSpacing: '1px' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function AccuracyPage() {
  const predictions = getAllPredictions()
  const stats = getAccuracyStats()
  const finished = predictions.filter(p => p.actualScore !== null).reverse()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black mb-2 text-white">预测命中率</h1>
      <p style={{ color: '#8899aa' }} className="text-base mb-8">比分与总进球双模块独立核算 · 每场结果公开验证</p>

      {/* 比分模块 */}
      <div className="mb-6">
        <h2 style={{ fontSize: 13, color: '#4ade80', letterSpacing: '2px', fontWeight: 700, marginBottom: 12 }}>
          📊 比分模块
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard value={`${stats.scoreDirectionRate}%`} label="方向准确率" color="#2ecc71" sub={`${stats.scoreDirectionHits}/${stats.total} 场正确`} />
          <StatCard value={`${stats.scoreExactRate}%`} label="精确命中率" color="#4ade80" sub={`${stats.scoreExactHits}/${stats.total} 场精确`} />
        </div>
      </div>

      {/* 总进球模块 */}
      <div className="mb-8">
        <h2 style={{ fontSize: 13, color: '#f5a623', letterSpacing: '2px', fontWeight: 700, marginBottom: 12 }}>
          ⚽ 总进球模块（独立运算）
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard value={`${stats.totalGoalsRate}%`} label="总进球命中率" color="#f5a623" sub={`${stats.totalGoalsHits}/${stats.total} 场命中`} />
          <StatCard value={`${stats.total}`} label="已核实场次" color="#60a5fa" sub="持续更新中" />
        </div>
      </div>

      {/* 逐场对比 */}
      <div>
        <h2 style={{ fontSize: 13, color: '#8899aa', letterSpacing: '2px', fontWeight: 700, marginBottom: 12 }}>
          📋 逐场对比
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {finished.map(p => (
            <div key={p.matchId} style={{ background: '#0d1b2a', border: '1px solid #1e3a5f' }}
              className="rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: '#6b7f96', marginBottom: 4 }}>{p.group}</div>
                <div className="font-semibold text-sm text-white">{p.homeTeam} vs {p.awayTeam}</div>
                <div style={{ fontSize: 13, color: '#8899aa', marginTop: 4 }}>
                  预测：{p.predictionA} → 实际：<span className="font-bold" style={{ color: '#f5a623' }}>{p.actualScore}</span>
                </div>
                <div style={{ fontSize: 11, color: '#6b7f96', marginTop: 4 }}>{p.notes}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(() => {
                  const predAExact = (() => {
                    if (!p.predictionA || !p.actualScore) return false
                    const m = p.predictionA.match(/(\d+)\s*[-–—]\s*(\d+)/)
                    return m ? `${m[1]}-${m[2]}` === p.actualScore : false
                  })()
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, flexShrink: 0,
                      background: predAExact ? '#14532d' : p.directionCorrect ? '#1a2d45' : '#7f1d1d',
                      color: predAExact ? '#4ade80' : p.directionCorrect ? '#60a5fa' : '#ef4444',
                    }}>
                      比分{predAExact ? '🎯' : p.directionCorrect ? '✅' : '❌'}
                    </span>
                  )
                })()}
                {(() => {
                  if (!p.actualScore) return null
                  const model = computeModelOutput(p.homeTeam, p.awayTeam, p.kickoff, {
                    predictionA: p.predictionA, predictionB: p.predictionB
                  })
                  const [hg, ag] = p.actualScore.split('-').map(Number)
                  const actualTotal = hg + ag
                  const hitA = actualTotal === model.totalGoalsA
                  const hitB = actualTotal === model.totalGoalsB
                  const showB = model.totalGoalsB !== model.totalGoalsA
                  const hit = hitA || hitB
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, flexShrink: 0,
                      background: hit ? '#1a2d45' : '#3d1f1f',
                      color: hit ? '#f5a623' : '#6b7f96',
                    }}>
                      ⚽ {model.totalGoalsA}球{showB ? `/${model.totalGoalsB}球` : ''} {hit ? '✅' : '❌'}
                    </span>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
