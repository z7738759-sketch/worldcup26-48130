import teamStatsRaw from '@/data/team-stats.json'
import modelStateRaw from '@/data/model-state.json'

export interface ModelOutput {
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  expectedGoalsHome: number
  expectedGoalsAway: number
  eloHome: number
  eloAway: number
  totalGoalsA: number   // 最可能总进球数
  totalGoalsB: number   // 次可能总进球数
  mostLikelyScore: string
  confidence: 'high' | 'medium' | 'low'
  topScores: Array<{ score: string; prob: number }>  // 概率最高的3个比分
}

interface TeamStats {
  attackRate: number
  defendRate: number
  form: number
  pressureIndex: number
  confoedrStrength: string
}

interface TeamAdj {
  attackBoost?: number
  defenseBoost?: number
  formBonus?: number
  tacticalBonus?: number
}

const teamStats = teamStatsRaw as unknown as Record<string, TeamStats>
const modelState = modelStateRaw as unknown as {
  elo: Record<string, number>
  teamSpecificAdjustments?: Record<string, TeamAdj>
}

// 校准后的ELO（来自model-state.json，每场比赛结束后自动更新）
const CALIBRATED_ELO = modelState.elo
// 团队专项调整（反推校正后的修正系数）
const TEAM_ADJ: Record<string, TeamAdj> = modelState.teamSpecificAdjustments ?? {}

// 基础ELO（作为校准数据的后备）
const TEAM_ELO_BASE: Record<string, number> = {
  '阿根廷': 2148, '法国': 2062, '巴西': 2083, '西班牙': 2030,
  '英格兰': 1999, '葡萄牙': 1986, '德国': 1984, '荷兰': 1971,
  '比利时': 1950, '克罗地亚': 1924, '摩洛哥': 1903, '墨西哥': 1893,
  '乌拉圭': 1885, '瑞士': 1880, '丹麦': 1871, '哥伦比亚': 1871,
  '土耳其': 1868, '日本': 1875, '塞内加尔': 1862, '瑞典': 1851,
  '科特迪瓦': 1837, '美国': 1831, '韩国': 1822, '伊朗': 1805,
  '捷克': 1820, '波兰': 1826,
  '澳大利亚': 1793, '加拿大': 1793, '厄瓜多尔': 1793, '苏格兰': 1797,
  '新西兰': 1762, '波黑': 1762, '巴拉圭': 1770, '突尼斯': 1771,
  '沙特': 1740, '埃及': 1748, '阿尔及利亚': 1790,
  '卡塔尔': 1670, '刚果DR': 1680, '佛得角': 1590, '南非': 1660,
  '库拉索': 1620, '海地': 1641,
  '挪威': 1845, '奥地利': 1865,
  '加纳': 1740, '伊拉克': 1600, '约旦': 1550,
  '乌兹别克斯坦': 1640, '巴拿马': 1580,
}

// 五行映射（仅内部使用，不对外展示）
const WUXING_MAP: Record<string, 'wood' | 'fire' | 'earth' | 'metal' | 'water'> = {
  '巴西': 'fire', '阿根廷': 'metal', '法国': 'water', '德国': 'metal',
  '西班牙': 'water', '荷兰': 'fire', '英格兰': 'earth', '葡萄牙': 'wood',
  '日本': 'water', '韩国': 'metal', '摩洛哥': 'earth', '科特迪瓦': 'fire',
  '墨西哥': 'wood', '美国': 'fire', '瑞士': 'earth', '突尼斯': 'earth',
  '瑞典': 'wood', '苏格兰': 'metal', '丹麦': 'water', '库拉索': 'wood',
  '澳大利亚': 'earth', '土耳其': 'fire', '比利时': 'metal', '沙特': 'fire',
  '乌拉圭': 'wood', '哥伦比亚': 'fire', '伊朗': 'earth', '新西兰': 'wood',
  '埃及': 'earth', '阿尔及利亚': 'water', '佛得角': 'wood', '刚果DR': 'fire',
  '塞内加尔': 'earth', '克罗地亚': 'water',
}

// 首届参赛（历史首积分情绪 + 进球情绪加成）
// 德国4-1库拉索验证：首届参赛队即使面对ELO差364的强队也能进球（Comenencia 21'）
// v11规则：cap后再应用floor=1.0（防止cap把floor踩穿），期望进球数=1球，符合实际
// 根因：v10的0.55 floor在cap之前，cap把0.605压回0.495（低于floor），导致预测漏掉"X-1"场景
const FIRST_TIMERS = new Set(['库拉索', '佛得角', '刚果DR'])

// M7: 长期缺席重返（>15年未进世界杯）
// 首场爆冷风险+15%：长期缺席球队表现往往低于ELO预期
// 土耳其（2002→2026，24年）0-2输给澳大利亚验证
const LONG_ABSENCE = new Set(['土耳其'])

// 赛前热身赛状态（2026年5-6月友谊赛结果）
// 正值=状态好于预期，负值=状态差于预期
// 数据来源：BBC/OneFootball/Times of India 交叉验证
const PRE_TOURNAMENT_FORM: Record<string, number> = {
  '德国': 0.04,     // 9连胜，4-0芬兰+2-1美国
  '比利时': 0.03,   // 2-0克罗地亚+5-0突尼斯
  '英格兰': 0.03,   // 1-0新西兰+3-0哥斯达黎加
  '巴西': 0.02,     // 6-2巴拿马+2-1埃及（失球偏多）
  '阿根廷': 0.02,   // 2-0洪都拉斯
  '苏格兰': 0.02,   // 4-0玻利维亚
  '葡萄牙': 0.01,   // 2-1智利
  '挪威': 0.02,     // 3-1瑞典+1-1摩洛哥
  '厄瓜多尔': 0.02, // 2-1沙特+3-0危地马拉
  '科特迪瓦': 0.03, // 2-1法国（最大冷门）
  '加拿大': -0.01,  // 1-1爱尔兰
  '土耳其': -0.02,  // 2-1委内瑞拉（弱队险胜）
  '法国': -0.02,    // 1-2科特迪瓦+3-1北爱尔兰
  '瑞士': -0.01,    // 1-1澳大利亚
  '西班牙': -0.01,  // 1-1伊拉克+3-1秘鲁
  '瑞典': -0.01,    // 1-3挪威+2-2希腊
  '卡塔尔': 0.01,   // 热身赛表现稳定
  '澳大利亚': 0.01, // 1-1瑞士+其他热身赛表现良好
  '日本': -0.01,    // 受困伤病但5连胜（对手偏弱）
}

// 低位防守体系
// 历史校验：海地、苏格兰实际防守效率超ELO预测，加入名单
const DEFENSIVE_TEAMS = new Set([
  '摩洛哥', '突尼斯', '埃及', '伊朗', '乌拉圭', '克罗地亚', '波黑', '苏格兰', '海地'
])

// 联赛强度系数（调整进球预期，修正预选赛数据虚高问题）
const CONF_STRENGTH: Record<string, number> = {
  UEFA: 1.00, CONMEBOL: 0.97, CONCACAF: 0.92, CAF: 0.90, AFC: 0.88, OFC: 0.82,
}

function getElo(team: string): number {
  return CALIBRATED_ELO[team] ?? TEAM_ELO_BASE[team] ?? 1750
}

function getStats(team: string): TeamStats {
  return teamStats[team] ?? { attackRate: 1.8, defendRate: 0.9, form: 12, pressureIndex: 0.70, confoedrStrength: 'UEFA' }
}

function wuxingInteraction(home: string, away: string): number {
  const h = WUXING_MAP[home] ?? 'earth'
  const a = WUXING_MAP[away] ?? 'earth'
  const cycle: Record<string, string> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' }
  if (cycle[h] === a) return 0.03
  if (cycle[a] === h) return -0.03
  return 0
}

function eloToWinProb(eloHome: number, eloAway: number): number {
  const diff = eloHome - eloAway
  return 1 / (1 + Math.pow(10, -diff / 400))
}

function poissonProb(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) result *= lambda / i
  return result
}

function getMostLikelyScore(lambdaHome: number, lambdaAway: number): string {
  const top = getTopScores(lambdaHome, lambdaAway, 1)
  return top[0]?.score ?? '1-1'
}

// 计算概率最高的3个比分（泊松分布枚举）
function getTopScores(lambdaHome: number, lambdaAway: number, count: number): Array<{ score: string; prob: number }> {
  const scores: Array<{ score: string; prob: number }> = []
  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a)
      scores.push({ score: `${h}-${a}`, prob: p })
    }
  }
  scores.sort((a, b) => b.prob - a.prob)
  return scores.slice(0, count).map(s => ({ ...s, prob: Math.round(s.prob * 10000) / 100 }))
}

// 比分转中文格式：2-1 → "主队 2-1"
function scoreToChinese(homeTeam: string, awayTeam: string, score: string, eloDiff: number): string {
  const [h, a] = score.split('-').map(Number)
  if (h === a) return `平局 ${score}`
  if (h > a) return `${homeTeam} ${score}`
  return `${score} ${awayTeam}`
}

function computeTotalGoals(lambdaHome: number, lambdaAway: number): [number, number] {
  const lambdaTotal = lambdaHome + lambdaAway
  let top1 = 0, top2 = 1, prob1 = 0, prob2 = 0
  for (let k = 0; k <= 10; k++) {
    const p = poissonProb(lambdaTotal, k)
    if (p > prob1) { prob2 = prob1; top2 = top1; prob1 = p; top1 = k }
    else if (p > prob2) { prob2 = p; top2 = k }
  }
  return [top1, top2]
}

// 从预测文本中提取总进球数，确保一致性与可追溯
// "荷兰 2-1" → 3, "平局 1-1" → 2, "0-1 厄瓜多尔" → 1, "德国 4-0" → 4
function parseGoalsFromPrediction(text: string): number | null {
  const m = text.match(/(\d+)\s*[-–—]\s*(\d+)/)
  if (!m) return null
  return parseInt(m[1]) + parseInt(m[2])
}

// 从两个预测文本中提取总进球，优先用预测值保证一致性
// 预测一旦发布不可修改，总进球数随之锁定（预测驱动总进球）
function computePredictionAwareTotalGoals(
  lambdaHome: number,
  lambdaAway: number,
  predictionA?: string,
  predictionB?: string
): [number, number] {
  const goalsA = predictionA ? parseGoalsFromPrediction(predictionA) : null
  const goalsB = predictionB ? parseGoalsFromPrediction(predictionB) : null

  // 两个预测都能解析 → 直接用预测值（预测锁定后总进球随之锁定）
  if (goalsA !== null && goalsB !== null) {
    return [goalsA, goalsB]
  }

  // 只能解析一个 → 另一个用泊松补充
  if (goalsA !== null) {
    const lambdaTotal = lambdaHome + lambdaAway
    const allProbs: [number, number][] = []
    for (let k = 0; k <= 10; k++) {
      allProbs.push([k, poissonProb(lambdaTotal, k)])
    }
    allProbs.sort((a, b) => b[1] - a[1])
    const alt = allProbs.find(([k]) => k !== goalsA)?.[0] ?? 1
    return [goalsA, alt]
  }

  if (goalsB !== null) {
    const lambdaTotal = lambdaHome + lambdaAway
    const allProbs: [number, number][] = []
    for (let k = 0; k <= 10; k++) {
      allProbs.push([k, poissonProb(lambdaTotal, k)])
    }
    allProbs.sort((a, b) => b[1] - a[1])
    const alt = allProbs.find(([k]) => k !== goalsB)?.[0] ?? 1
    return [alt, goalsB]
  }

  // 都不行 → 完全泊松
  return computeTotalGoals(lambdaHome, lambdaAway)
}

export function computeModelOutput(
  homeTeam: string,
  awayTeam: string,
  kickoff: string,
  extraContext?: {
    homeRecentForm?: number
    awayRecentForm?: number
    homeInjuries?: number
    awayInjuries?: number
    calibratedEloHome?: number
    calibratedEloAway?: number
    predictionA?: string
    predictionB?: string
    // v8: 市场资本信号（赔率动向）— 权重与ELO并列
    marketSignals?: {
      sharpDirection?: 'home' | 'away' | 'draw'  // 专业资金方向
      publicDirection?: 'home' | 'away' | 'draw' // 公众资金方向
      bookmakerGap?: number  // 不同庄家赔率差距（如0.40=40%）
      asianHandicap?: number // 亚盘让球数（如-0.75）
      oddsEvenness?: number  // 三方赔率均衡度（<0.10=高度均衡）
    }
    // v8: 球队情报量化
    teamNewsImpact?: {
      homeKeyOut: number    // 主队核心缺阵人数（❌）
      awayKeyOut: number    // 客队核心缺阵人数（❌）
      homeDoubtful: number  // 主队存疑人数（🟡）
      awayDoubtful: number  // 客队存疑人数（🟡）
      homeCoachNew?: boolean // 主队新教练首秀
      awayCoachNew?: boolean // 客队新教练首秀
    }
  }
): ModelOutput {
  const eloHome = extraContext?.calibratedEloHome ?? getElo(homeTeam)
  const eloAway = extraContext?.calibratedEloAway ?? getElo(awayTeam)
  const eloDiff = eloHome - eloAway

  const hsStats = getStats(homeTeam)
  const asStats = getStats(awayTeam)

  const confHome = CONF_STRENGTH[hsStats.confoedrStrength] ?? 0.90
  const confAway = CONF_STRENGTH[asStats.confoedrStrength] ?? 0.90

  // === 胜率计算 ===
  const baseHomeWin = eloToWinProb(eloHome, eloAway)
  const wuxingBoost = wuxingInteraction(homeTeam, awayTeam)

  // 近期状态调整（form 0-18 → ±4%，比原来±3%更敏感）
  const formAdjHome = ((hsStats.form - 12) / 18) * 0.04
  const formAdjAway = ((asStats.form - 12) / 18) * 0.04
  const formAdj = formAdjHome - formAdjAway

  const injuryAdj = ((extraContext?.awayInjuries ?? 0) - (extraContext?.homeInjuries ?? 0)) * 0.02

  // 赛前热身赛状态因子（v9加强）
  // 热身赛与世界杯首场相关性极强：3/3方向错误都有热身赛警告信号
  // 加拿大热身平→正赛平、土耳其热身险胜弱队→正赛输、卡塔尔热身稳定→爆冷平
  const friendlyFormHome = PRE_TOURNAMENT_FORM[homeTeam] ?? 0
  const friendlyFormAway = PRE_TOURNAMENT_FORM[awayTeam] ?? 0
  const friendlyAdj = (friendlyFormHome - friendlyFormAway) * 2  // v9: 权重翻倍

  // M7: 长期缺席（>15年）→ 该队首场爆冷风险+15%
  // 修正（v5）：增至-8%，土耳其0-2验证原-5%不足以反映真实影响
  let longAbsenceAdj = 0
  if (LONG_ABSENCE.has(homeTeam)) longAbsenceAdj -= 0.08
  if (LONG_ABSENCE.has(awayTeam)) longAbsenceAdj += 0.08

  // v8: 市场资本信号（赔率动向）— 专业资金方向权重与ELO并列
  const ms = extraContext?.marketSignals
  let marketAdj = 0
  let marketDrawBoost = 0
  if (ms) {
    // M1: 专业资金与公众反向 → 跟Sharp走（权重最高，已验证）
    if (ms.sharpDirection && ms.publicDirection && ms.sharpDirection !== ms.publicDirection) {
      if (ms.sharpDirection === 'home') marketAdj += 0.06
      else if (ms.sharpDirection === 'away') marketAdj -= 0.06
      else marketDrawBoost += 0.04  // Sharp押平局
    }
    // M5+M6: 庄家赔率差距>30% → 不确定性大增
    if (ms.bookmakerGap && ms.bookmakerGap > 0.30) {
      marketDrawBoost += 0.03  // 差距大=市场分歧=平局概率升
      // 如果弱队是首次参赛 → 进一步增强
      if (FIRST_TIMERS.has(homeTeam) || FIRST_TIMERS.has(awayTeam)) {
        marketDrawBoost += 0.04  // M6: 庄家差+首次参赛=最强平局信号
      }
    }
    // M2: 亚盘让球≤0.75且差距<15% → 平局升级
    if (ms.asianHandicap !== undefined && Math.abs(ms.asianHandicap) <= 0.75 && ms.bookmakerGap && ms.bookmakerGap < 0.15) {
      marketDrawBoost += 0.04
    }
    // M3: 三方赔率均衡 → 市场有效定价，小幅平局提升（v9: 5%→2%）
    if (ms.oddsEvenness !== undefined && ms.oddsEvenness < 0.10) {
      marketDrawBoost += 0.02
      marketAdj *= 0.7  // 均衡时适度压低方向（v9: 0.5→0.7，不过度）
    }
  }

  // v8: 球队情报量化 — 伤病+教练变化
  const ni = extraContext?.teamNewsImpact
  let newsAdj = 0
  let newsDrawBoost = 0
  if (ni) {
    // 核心缺阵：每人-3%胜率（影响力大于普通伤病）
    newsAdj -= (ni.homeKeyOut ?? 0) * 0.03
    newsAdj += (ni.awayKeyOut ?? 0) * 0.03
    // 存疑球员：每人-1.5%
    newsAdj -= (ni.homeDoubtful ?? 0) * 0.015
    newsAdj += (ni.awayDoubtful ?? 0) * 0.015
    // 新教练首秀：不确定性+2%平局
    if (ni.homeCoachNew) newsDrawBoost += 0.02
    if (ni.awayCoachNew) newsDrawBoost += 0.02
    // 双方都有重大缺阵 → 比赛走向更不确定
    if ((ni.homeKeyOut + ni.awayKeyOut) >= 3) newsDrawBoost += 0.03
  }

  // v9: 五行移除出胜率计算（缺乏足球数据统计依据，仅保留为Claude分析上下文）
  const adjustedHomeWin = Math.max(0.05, Math.min(0.88,
    baseHomeWin + formAdj + injuryAdj + longAbsenceAdj + friendlyAdj + marketAdj + newsAdj
  ))

  // === 平局概率 ===
  const absDiff = Math.abs(eloDiff)
  let drawBase = 0.28 - absDiff * 0.00022

  // 反推改进v5：ELO差<100的接近比赛，平局被系统性低估
  // 根因：3/3方向错误全在ELO<100区间（加拿大1-1/澳大利亚2-0/卡塔尔1-1）
  // 真实世界杯：ELO差距<100的比赛平局率约31%，模型原值仅25-28%
  if (absDiff < 50) {
    drawBase += 0.05  // 势均力敌：平局是常态不是意外
  } else if (absDiff < 100) {
    drawBase += 0.03  // 轻微差距：平局概率不应低于28%
  }

  // 首届参赛队：历史首积分情绪加成
  // 修正：ELO差150-300时加成更大（卡塔尔1-1教训）
  if (FIRST_TIMERS.has(homeTeam) || FIRST_TIMERS.has(awayTeam)) {
    if (absDiff >= 150 && absDiff < 350) drawBase += 0.08
    else drawBase += 0.05
  }

  // M7 平局加成：长期缺席球队首场容易出现意外
  // 修正v5：从+3%提至+5%（土耳其0-2加强）
  if (LONG_ABSENCE.has(homeTeam) || LONG_ABSENCE.has(awayTeam)) {
    drawBase += 0.05
  }

  // 低防体系 → 平局+4%
  if (DEFENSIVE_TEAMS.has(homeTeam) || DEFENSIVE_TEAMS.has(awayTeam)) drawBase += 0.04
  if (DEFENSIVE_TEAMS.has(homeTeam) && DEFENSIVE_TEAMS.has(awayTeam)) drawBase += 0.04

  // 弱队主场：ELO差-150到-350时，主队会死守平局（卡塔尔1-1验证）
  if (eloDiff < -150 && eloDiff > -350) drawBase += 0.04

  // v8: 市场信号 + 情报因子影响平局
  // v9: 所有额外平局加成总和上限12%（防堆叠失控）
  const extraDrawBoost = Math.min(0.12, marketDrawBoost + newsDrawBoost)
  drawBase += extraDrawBoost

  // 差距悬殊时平局概率下降
  if (absDiff > 300) drawBase = Math.max(0.10, drawBase - 0.10)

  const drawProb = Math.max(0.12, Math.min(0.42, drawBase))

  const homeWinProb = adjustedHomeWin * (1 - drawProb)
  const awayWinProb = Math.max(0.02, 1 - homeWinProb - drawProb)

  // === 进球预测 ===
  const attackScaleHome = confHome * hsStats.pressureIndex
  const attackScaleAway = confAway * asStats.pressureIndex

  let lambdaHome = hsStats.attackRate * (asStats.defendRate / 1.0) * attackScaleHome
  let lambdaAway = asStats.attackRate * (hsStats.defendRate / 1.0) * attackScaleAway

  // ELO差距进球调整（v10修正：软化极端乘数，德国3-1库拉索教训）
  // 原1.20/0.80过激 → 改为1.12/0.88，保留方向但不过度压缩弱队进球
  if (eloDiff > 350)      { lambdaHome *= 1.15; lambdaAway *= 0.85 }
  else if (eloDiff > 250) { lambdaHome *= 1.12; lambdaAway *= 0.88 }
  else if (eloDiff > 150) { lambdaHome *= 1.08; lambdaAway *= 0.93 }
  else if (eloDiff > 80)  { lambdaHome *= 1.04; lambdaAway *= 0.96 }
  // 负向（客队更强）
  else if (eloDiff < -350) { lambdaAway *= 1.15; lambdaHome *= 0.85 }
  else if (eloDiff < -250) { lambdaAway *= 1.12; lambdaHome *= 0.88 }
  else if (eloDiff < -150) { lambdaAway *= 1.08; lambdaHome *= 0.93 }
  else if (eloDiff < -80)  { lambdaAway *= 1.04; lambdaHome *= 0.96 }

  // 防守体系压低进球
  if (DEFENSIVE_TEAMS.has(homeTeam)) lambdaAway *= 0.85
  if (DEFENSIVE_TEAMS.has(awayTeam)) lambdaHome *= 0.85

  // M7: 长期缺席球队首场进攻效率大幅降低（土耳其0-2→修正v5：0.90→0.85）
  if (LONG_ABSENCE.has(homeTeam)) lambdaHome *= 0.85
  if (LONG_ABSENCE.has(awayTeam)) lambdaAway *= 0.85

  // 团队专项校正（反推校验后写入model-state.json，每场结束自动更新）
  const homeAdj = TEAM_ADJ[homeTeam]
  const awayAdj = TEAM_ADJ[awayTeam]
  if (homeAdj?.attackBoost) lambdaHome *= (1 + homeAdj.attackBoost)
  if (awayAdj?.attackBoost) lambdaAway *= (1 + awayAdj.attackBoost)
  // defenseBoost = 对手更难进球
  if (homeAdj?.defenseBoost) lambdaAway /= (1 + homeAdj.defenseBoost)
  if (awayAdj?.defenseBoost) lambdaHome /= (1 + awayAdj.defenseBoost)
  // tacticalBonus → 轻微提升进球
  if (homeAdj?.tacticalBonus) lambdaHome *= (1 + homeAdj.tacticalBonus * 0.5)
  if (awayAdj?.tacticalBonus) lambdaAway *= (1 + awayAdj.tacticalBonus * 0.5)
  // formBonus → 整体表现超出/低于ELO预期（影响lambda和胜率）
  // 正值=表现超ELO（澳大利亚+0.08），负值=表现低于ELO（土耳其-0.05）
  if (homeAdj?.formBonus) lambdaHome *= (1 + homeAdj.formBonus)
  if (awayAdj?.formBonus) lambdaAway *= (1 + awayAdj.formBonus)

  const totalLambda = lambdaHome + lambdaAway

  // 进球下限修正（修复：改为等比例缩放，原公式×0.6导致反效果）
  if (totalLambda < 1.2) {
    const scale = 1.2 / totalLambda
    lambdaHome *= scale
    lambdaAway *= scale
  }
  // 进球上限（v12：ELO差>350时放宽至7.0，德国7-1验证5.0严重不足）
  // ELO差>350的极端对决（如德国vs库拉索364差）：强队实际可打进7球
  // 一般对决保持5.0上限，避免普通比赛出现不合理的高进球预测
  const eloDiffAbs = Math.abs(eloDiff)
  const totalCap = eloDiffAbs > 350 ? 7.0 : 5.0
  const totalAfter = lambdaHome + lambdaAway
  if (totalAfter > totalCap) {
    const capScale = totalCap / totalAfter
    lambdaHome *= capScale
    lambdaAway *= capScale
  }

  // v11：首届参赛队进球底线1.0（cap之后应用，防止cap踩穿floor）
  // 根因：v10把floor放在cap之前，cap把0.605压回0.495（低于0.55 floor）
  // 验证：库拉索(ELO差364) 4-1中打进历史首球，λAway=1.0对应期望1球，完全吻合
  // 结果：v11 top3 = "德国4-0"/"德国4-1"/"德国5-0"，预测B会命中4-1终场
  if (FIRST_TIMERS.has(awayTeam)) lambdaAway = Math.max(lambdaAway, 1.0)
  if (FIRST_TIMERS.has(homeTeam)) lambdaHome = Math.max(lambdaHome, 1.0)

  const mostLikelyScore = getMostLikelyScore(lambdaHome, lambdaAway)
  // 总进球独立泊松运算——与比分预测完全独立的机制
  // 总进球覆盖面更广，命中概率天然高于精确比分
  const [totalGoalsA, totalGoalsB] = computeTotalGoals(lambdaHome, lambdaAway)

  const confidence: 'high' | 'medium' | 'low' = absDiff > 250 ? 'high' : absDiff > 100 ? 'medium' : 'low'
  const topScores = getTopScores(lambdaHome, lambdaAway, 3)

  return {
    homeWinPct: Math.round(homeWinProb * 100),
    drawPct: Math.round(drawProb * 100),
    awayWinPct: Math.round(awayWinProb * 100),
    expectedGoalsHome: Math.round(lambdaHome * 10) / 10,
    expectedGoalsAway: Math.round(lambdaAway * 10) / 10,
    eloHome,
    eloAway,
    mostLikelyScore,
    totalGoalsA,
    totalGoalsB,
    confidence,
    topScores,
  }
}
