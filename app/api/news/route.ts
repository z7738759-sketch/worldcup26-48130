import { NextResponse } from 'next/server'
import liveNewsData from '@/data/live-news.json'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LiveScore {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: string
  minute: number
  completed: boolean
  inProgress: boolean
  goalScorers?: string
}

interface EspnCompetitor {
  homeAway: string
  team: { displayName: string; shortDisplayName: string }
  score?: string
}

interface EspnEvent {
  competitions: Array<{
    status: { type: { name: string; completed: boolean; description: string }; displayClock: string; period: number }
    competitors: EspnCompetitor[]
    situation?: { lastPlay?: { text: string } }
  }>
}

interface EspnResponse {
  events?: EspnEvent[]
}

// ESPN 英文队名 → 中文
const ESPN_TO_CN: Record<string, string> = {
  'Mexico': '墨西哥', 'South Africa': '南非', 'Korea Republic': '韩国', 'Czech Republic': '捷克',
  'Czechia': '捷克', 'Canada': '加拿大', 'Bosnia and Herzegovina': '波黑', 'Bosnia & Herzegovina': '波黑',
  'United States': '美国', 'Paraguay': '巴拉圭', 'Qatar': '卡塔尔', 'Switzerland': '瑞士',
  'Brazil': '巴西', 'Morocco': '摩洛哥', 'Scotland': '苏格兰', 'Haiti': '海地',
  'Germany': '德国', 'Curacao': '库拉索', 'Curaçao': '库拉索', 'Netherlands': '荷兰',
  'Japan': '日本', "Ivory Coast": '科特迪瓦', "Côte d'Ivoire": '科特迪瓦',
  'Ecuador': '厄瓜多尔', 'Sweden': '瑞典', 'Tunisia': '突尼斯',
  'Spain': '西班牙', 'Cape Verde': '佛得角', 'Belgium': '比利时', 'Egypt': '埃及',
  'Saudi Arabia': '沙特', 'Uruguay': '乌拉圭', 'Iran': '伊朗', 'New Zealand': '新西兰',
  'Australia': '澳大利亚', 'Turkey': '土耳其', 'Türkiye': '土耳其',
  'France': '法国', 'Senegal': '塞内加尔', 'England': '英格兰', 'Croatia': '克罗地亚',
  'Portugal': '葡萄牙', 'DR Congo': '刚果DR', 'Argentina': '阿根廷', 'Algeria': '阿尔及利亚',
  'Colombia': '哥伦比亚', 'Poland': '波兰', 'Denmark': '丹麦',
  'Côte D\'Ivoire': '科特迪瓦',
}

async function fetchEspnForDate(date: string): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`,
      { cache: 'no-store' }
    )
    const data = await res.json() as EspnResponse
    const scores: LiveScore[] = []

    for (const event of (data.events ?? [])) {
      for (const comp of (event.competitions ?? [])) {
        const home = comp.competitors.find(c => c.homeAway === 'home')
        const away = comp.competitors.find(c => c.homeAway === 'away')
        if (!home || !away) continue
        const homeCN = ESPN_TO_CN[home.team.displayName] ?? home.team.displayName
        const awayCN = ESPN_TO_CN[away.team.displayName] ?? away.team.displayName
        const st = comp.status.type
        scores.push({
          homeTeam: homeCN,
          awayTeam: awayCN,
          homeScore: parseInt(home.score ?? '0') || 0,
          awayScore: parseInt(away.score ?? '0') || 0,
          status: st.name,
          minute: parseInt(comp.status.displayClock) || 0,
          completed: st.completed,
          inProgress: st.name === 'STATUS_IN_PROGRESS',
        })
      }
    }
    return scores
  } catch {
    return []
  }
}

function buildMatchKey(home: string, away: string) {
  return `${home}|${away}`
}

function formatDate(ts: string) {
  return ts.replace('T', ' ').substring(0, 10)
}

export async function GET() {
  // 静态新闻库
  const staticNews = liveNewsData as Array<{
    id: number; team: string; timestamp: string; source: string;
    title: string; content: string; impactLevel: string; impactNote: string;
    relatedMatches: number[]
  }>

  // 已覆盖的比赛组合（title 包含终场关键词）
  const coveredMatchKeys = new Set<string>()
  for (const item of staticNews) {
    if (item.title.includes('终场') || item.title.includes('FT') || item.title.includes('Final')) {
      // 从 title 中提取队名（粗略匹配）
      const teams = item.title.match(/^([^\d]+?)[\d\s]*[-–—]/)
      if (teams) coveredMatchKeys.add(teams[1].trim())
    }
  }

  // 拉 ESPN 数据（昨天+今天）
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  const fmt = (d: Date) => d.toISOString().replace(/-/g, '').substring(0, 8)

  const [todayScores, yesterdayScores] = await Promise.all([
    fetchEspnForDate(fmt(today)),
    fetchEspnForDate(fmt(yesterday)),
  ])
  const allScores = [...todayScores, ...yesterdayScores]

  // 从静态新闻中提取已覆盖的比赛
  const coveredTitles = staticNews.map(n => n.title.toLowerCase())

  const autoNews: Array<typeof staticNews[0] & { type: string }> = []
  let autoId = 1000

  // 进行中比赛实时比分（type:'live'，仅显示在比赛页，不显示在赛前分析页）
  for (const s of allScores) {
    if (!s.inProgress) continue

    const leader = s.homeScore > s.awayScore ? `${s.homeTeam}领先` :
                   s.awayScore > s.homeScore ? `${s.awayTeam}领先` : '平局'
    const score = `${s.homeScore}-${s.awayScore}`
    const halfStr = s.minute > 45 ? '下半场' : '上半场'

    autoNews.push({
      id: autoId++,
      type: 'live',
      team: s.homeTeam,
      timestamp: new Date().toISOString(),
      source: 'ESPN · 实时直播',
      title: `🔴 直播 ${s.homeTeam} ${score} ${s.awayTeam}（${halfStr} ${s.minute}'）`,
      content: `${s.homeTeam} vs ${s.awayTeam} 正在进行中。当前比分 ${score}，${leader}，第 ${s.minute} 分钟。数据每30秒自动刷新。`,
      impactLevel: 'high',
      impactNote: `实时数据来自ESPN，30秒轮询更新。终场后将自动生成赛后分析与模型校准。`,
      relatedMatches: [],
    })
  }

  // 已结束比赛终场摘要（type:'result'）
  for (const s of allScores) {
    if (!s.completed) continue

    // 检查是否已有终场新闻（静态库里有该组合）
    const alreadyCovered = coveredTitles.some(t =>
      (t.includes(s.homeTeam.toLowerCase()) && t.includes('终场')) ||
      (t.includes(s.awayTeam.toLowerCase()) && t.includes('终场'))
    )
    if (alreadyCovered) continue

    const winner = s.homeScore > s.awayScore ? s.homeTeam :
                   s.awayScore > s.homeScore ? s.awayTeam : null
    const resultStr = winner ? `${winner}胜` : '平局'
    const score = `${s.homeScore}-${s.awayScore}`

    autoNews.push({
      id: autoId++,
      type: 'result',
      team: s.homeTeam,
      timestamp: new Date().toISOString(),
      source: 'ESPN · 自动同步',
      title: `${s.homeTeam} ${score} ${s.awayTeam} 终场 · ${resultStr}`,
      content: `${s.homeTeam} ${score} ${s.awayTeam} 终场。${resultStr === '平局' ? `双方战平 ${score}` : `${winner}以 ${score} 取胜`}。数据来源：ESPN实时比分，每30秒自动同步。`,
      impactLevel: 'high',
      impactNote: `比赛已结束，赛后分析与模型ELO校准将在30分钟内自动生成。`,
      relatedMatches: [],
    })
  }

  const allNews = [...staticNews, ...autoNews]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ news: allNews, updatedAt: new Date().toISOString() })
}
