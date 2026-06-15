/**
 * 用泊松模型独立计算每场比赛的总进球预测区间，存入 predictions.json
 * 算法与 A/B/C 比分预测完全独立（参考 model.ts 的 λ 计算逻辑）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, 'data')

const predictions = JSON.parse(fs.readFileSync(path.join(DATA, 'predictions.json'), 'utf-8'))
const teamStats   = JSON.parse(fs.readFileSync(path.join(DATA, 'team-stats.json'), 'utf-8'))
const modelState  = JSON.parse(fs.readFileSync(path.join(DATA, 'model-state.json'), 'utf-8'))

const CALIBRATED_ELO = modelState.elo || {}
const TEAM_ADJ       = modelState.teamSpecificAdjustments || {}

// 与 model.ts 保持一致的基础 ELO 备用值
const TEAM_ELO_BASE = {
  '阿根廷':2148,'法国':2062,'巴西':2075,'西班牙':2030,'英格兰':1999,'葡萄牙':1986,
  '德国':2002,'荷兰':1971,'比利时':1950,'克罗地亚':1924,'摩洛哥':1910,'墨西哥':1913,
  '乌拉圭':1885,'塞内加尔':1862,'哥伦比亚':1871,'瑞典':1851,'科特迪瓦':1851,
  '美国':1858,'韩国':1845,'挪威':1845,'澳大利亚':1811,'苏格兰':1817,
  '捷克':1820,'土耳其':1822,'伊朗':1760,'日本':1898,'奥地利':1865,
  '加拿大':1793,'厄瓜多尔':1779,'新西兰':1710,'波黑':1762,'巴拉圭':1750,'突尼斯':1759,
  '沙特':1750,'埃及':1780,'阿尔及利亚':1720,'瑞士':1868,'丹麦':1871,
  '卡塔尔':1678,'刚果DR':1700,'佛得角':1680,'南非':1640,'库拉索':1602,'海地':1621,
  '加纳':1740,'伊拉克':1600,'约旦':1550,'乌兹别克斯坦':1640,'巴拿马':1580,
}

const CONF_STRENGTH = { UEFA:1.00, CONMEBOL:0.97, CONCACAF:0.92, CAF:0.90, AFC:0.88, OFC:0.82 }
const DEFENSIVE_TEAMS = new Set(['摩洛哥','突尼斯','埃及','伊朗','乌拉圭','克罗地亚','波黑','苏格兰','海地','厄瓜多尔'])
const FIRST_TIMERS    = new Set(['库拉索','佛得角','刚果DR'])

function getElo(team) {
  return CALIBRATED_ELO[team] ?? TEAM_ELO_BASE[team] ?? 1750
}

function getStats(team) {
  return teamStats[team] ?? { attackRate:1.8, defendRate:0.9, pressureIndex:0.70, confoedrStrength:'UEFA' }
}

function poissonPMF(lambda, k) {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

/** 找覆盖 targetCoverage 的最小泊松区间，从众数向两侧扩展 */
function poissonInterval(lambda, targetCoverage = 0.65) {
  const mode = Math.floor(lambda)
  let lo = mode, hi = mode
  let coverage = poissonPMF(lambda, mode)

  while (coverage < targetCoverage && (lo > 0 || hi < 14)) {
    const pLo = lo > 0 ? poissonPMF(lambda, lo - 1) : 0
    const pHi = hi < 14 ? poissonPMF(lambda, hi + 1) : 0
    if (pLo >= pHi && lo > 0) {
      lo--; coverage += poissonPMF(lambda, lo)
    } else {
      hi++; coverage += poissonPMF(lambda, hi)
    }
  }
  return { lo, hi, coverage: Math.round(coverage * 100) }
}

/** 按 model.ts 相同逻辑计算 λH 和 λA */
function computeLambdas(homeTeam, awayTeam) {
  const eloH  = getElo(homeTeam)
  const eloA  = getElo(awayTeam)
  const diff  = eloH - eloA

  const hs = getStats(homeTeam)
  const as_ = getStats(awayTeam)

  const confH = CONF_STRENGTH[hs.confoedrStrength]  ?? 0.90
  const confA = CONF_STRENGTH[as_.confoedrStrength] ?? 0.90

  let lH = hs.attackRate * (as_.defendRate / 1.0) * (confH * hs.pressureIndex)
  let lA = as_.attackRate * (hs.defendRate / 1.0) * (confA * as_.pressureIndex)

  // ELO 差距调整（与 model.ts 完全一致）
  if      (diff > 350)  { lH *= 1.15; lA *= 0.85 }
  else if (diff > 250)  { lH *= 1.12; lA *= 0.88 }
  else if (diff > 150)  { lH *= 1.08; lA *= 0.93 }
  else if (diff > 80)   { lH *= 1.04; lA *= 0.96 }
  else if (diff < -350) { lA *= 1.15; lH *= 0.85 }
  else if (diff < -250) { lA *= 1.12; lH *= 0.88 }
  else if (diff < -150) { lA *= 1.08; lH *= 0.93 }
  else if (diff < -80)  { lA *= 1.04; lH *= 0.96 }

  // M9 / 防守体系
  if (DEFENSIVE_TEAMS.has(homeTeam)) lA *= (diff <= -80 ? 0.92 : 0.85)
  if (DEFENSIVE_TEAMS.has(awayTeam)) lH *= (diff >= 80  ? 0.92 : 0.85)

  // 团队专项调整
  const hAdj = TEAM_ADJ[homeTeam] || {}
  const aAdj = TEAM_ADJ[awayTeam] || {}
  if (hAdj.attackBoost)  lH *= (1 + hAdj.attackBoost)
  if (aAdj.attackBoost)  lA *= (1 + aAdj.attackBoost)
  if (hAdj.defenseBoost) lA /= (1 + hAdj.defenseBoost)
  if (aAdj.defenseBoost) lH /= (1 + aAdj.defenseBoost)
  if (hAdj.formBonus)    lH *= (1 + hAdj.formBonus)
  if (aAdj.formBonus)    lA *= (1 + aAdj.formBonus)
  if (hAdj.tacticalBonus) lH *= (1 + hAdj.tacticalBonus * 0.5)
  if (aAdj.tacticalBonus) lA *= (1 + aAdj.tacticalBonus * 0.5)

  // Floor（进球下限）
  const total = lH + lA
  if (total < 1.2) { const s = 1.2 / total; lH *= s; lA *= s }

  // Cap（进球上限）
  const cap = Math.abs(diff) > 350 ? 7.0 : 5.0
  const afterCap = lH + lA
  if (afterCap > cap) { const s = cap / afterCap; lH *= s; lA *= s }

  // 首届参赛队底线
  if (FIRST_TIMERS.has(awayTeam)) lA = Math.max(lA, 1.0)
  if (FIRST_TIMERS.has(homeTeam)) lH = Math.max(lH, 1.0)

  return [+lH.toFixed(3), +lA.toFixed(3)]
}

// ── 计算并更新每场比赛 ──
let updated = 0
for (const p of predictions) {
  const [lH, lA] = computeLambdas(p.homeTeam, p.awayTeam)
  const lambdaTotal = lH + lA
  const { lo, hi, coverage } = poissonInterval(lambdaTotal, 0.65)

  p.lambdaHome = lH
  p.lambdaAway = lA
  p.totalGoalsPrediction = `${lo}-${hi}球`   // 独立泊松区间，与 A/B/C 无关

  // 总是按新泊松区间重算，与 A/B/C 比分预测完全独立
  if (p.actualScore) {
    const [hg, ag] = p.actualScore.split('-').map(Number)
    const actual = hg + ag
    p.totalGoalsDirectionCorrect = actual >= lo && actual <= hi
  }

  updated++
  console.log(`${p.homeTeam} vs ${p.awayTeam}: λ=(${lH}+${lA}=${lambdaTotal.toFixed(2)}), 区间${lo}-${hi}球(覆盖${coverage}%)` +
    (p.actualScore ? `, 实际${p.actualScore.split('-').map(Number).reduce((a,b)=>a+b,0)}球 ${p.totalGoalsDirectionCorrect ? '✅' : '❌'}` : ''))
}

fs.writeFileSync(path.join(DATA, 'predictions.json'), JSON.stringify(predictions, null, 2))
console.log(`\n✅ 已更新 ${updated} 场比赛的 totalGoalsPrediction`)
