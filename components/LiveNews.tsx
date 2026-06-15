'use client'
import { useState, useEffect } from 'react'

interface NewsItem {
  id: number
  type?: string  // 'pre-match' | 'result' | 'info' | undefined
  team: string
  timestamp: string
  source: string
  title: string
  content: string
  impactLevel: 'high' | 'medium' | 'low'
  impactNote: string
  relatedMatches: number[]
}

const IMPACT_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f5a623',
  low: '#60a5fa',
}

const IMPACT_LABELS: Record<string, string> = {
  high: '重大影响',
  medium: '中等影响',
  low: '轻微影响',
}

export default function LiveNews({ teamFilter, matchId, preMatchOnly }: { teamFilter?: string; matchId?: number; preMatchOnly?: boolean }) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/news', { cache: 'no-store' })
        const data = await res.json()
        let news: NewsItem[] = data.news ?? []

        // preMatchOnly：仅显示赛前分析，排除终场结果类信息
        if (preMatchOnly) {
          news = news.filter(n => n.type === 'pre-match')
        }

        if (teamFilter) {
          news = news.filter(n => n.team === teamFilter)
        } else if (matchId) {
          news = news.filter(n => n.relatedMatches.includes(matchId))
        }

        news = [...news].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setItems(news)
        setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
      } catch {}
    }

    load()
    const interval = setInterval(load, 30000)  // 30s轮询（原60s）
    return () => clearInterval(interval)
  }, [teamFilter, matchId, preMatchOnly])

  if (items.length === 0) return null

  return (
    <div style={{ background: 'linear-gradient(135deg, #0d1b2a, #0f1d30)', border: '1px solid #1e3a5f', borderRadius: 16, padding: 'clamp(14px, 2vw, 20px)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>📡</span>
        <h3 style={{ fontSize: 14, color: '#f5a623', fontWeight: 700, letterSpacing: '1px', margin: 0 }}>
          实时消息追踪
        </h3>
        <span style={{ fontSize: 10, color: '#6b7f96', background: '#1a2d45', padding: '2px 8px', borderRadius: 9999 }}>
          {items.length} 条
        </span>
        {lastUpdate && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#3d5470' }}>
            更新 {lastUpdate}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: '#070f1a',
            border: `1px solid ${IMPACT_COLORS[item.impactLevel] ?? '#f5a623'}20`,
            borderLeft: `3px solid ${IMPACT_COLORS[item.impactLevel] ?? '#f5a623'}`,
            borderRadius: 12,
            padding: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#cdd9e5', fontWeight: 700 }}>{item.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999,
                  background: `${IMPACT_COLORS[item.impactLevel] ?? '#f5a623'}20`,
                  color: IMPACT_COLORS[item.impactLevel] ?? '#f5a623',
                }}>
                  {IMPACT_LABELS[item.impactLevel] ?? item.impactLevel}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#6b7f96', flexShrink: 0 }}>
                🕐 {new Date(item.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })} 北京
              </span>
            </div>

            <div style={{ fontSize: 13, color: '#8899aa', lineHeight: 1.7, marginBottom: 10 }}>
              {item.content}
            </div>

            <div style={{ fontSize: 10, color: '#3d5470', marginBottom: 8 }}>
              📋 来源：{item.source}
            </div>

            <div style={{
              background: '#0a1525',
              border: '1px solid #1a2d45',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              <span style={{ fontWeight: 700, color: IMPACT_COLORS[item.impactLevel] ?? '#f5a623' }}>⚠️ 影响评估：</span>
              <span style={{ color: '#cdd9e5' }}>{item.impactNote}</span>
              <div style={{ fontSize: 10, color: '#6b7f96', marginTop: 4 }}>
                ℹ️ 预测结果未修改 · 以下为基于当前信息的额外判断
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
