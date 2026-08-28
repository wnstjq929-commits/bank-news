/**
 * 은행 뉴스 수집기 (규칙 기반 · 무료 · 의존성 없음)
 * ------------------------------------------------------------
 *  [직접 RSS: 풍부한 요약]  +  [구글뉴스 검색 RSS: 전 언론사 / 최근 2주치]
 *   → 같은 사건끼리 클러스터링(대표 제목 + 언론사별 원문 링크 여러 개)
 *   → 은행 관련만 필터 → 은행/주제 분류
 *   → 날짜별 누적 저장(store.json) → AI 분석(analysis.json) 병합
 *   → 어디서든 더블클릭으로 열리는 index.html 생성
 *
 * 실행:  node fetch_news.js
 */

const fs = require("fs");
const path = require("path");

// ── 1. 뉴스 소스 ─────────────────────────────────────────────
// 언론사 자체 RSS: 최신 기사 + 충실한 요약(rich)
const DIRECT_FEEDS = [
  { name: "연합뉴스",   url: "https://www.yna.co.kr/rss/economy.xml", rich: true },
  { name: "연합-증시",  url: "https://www.yna.co.kr/rss/market.xml",  rich: true },
  { name: "뉴시스",     url: "https://newsis.com/RSS/economy.xml",    rich: true },
  { name: "아시아경제", url: "https://www.asiae.co.kr/rss/economy.htm", rich: true },
];
// 구글뉴스 검색 RSS: 검색이라 '과거(최근 2주)'까지, 전 언론사 폭넓게
const GNEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:14d")}&hl=ko&gl=KR&ceid=KR:ko`;

// ── 2. 은행 정의 ─────────────────────────────────────────────
const BANKS = [
  { name: "한국은행",   aliases: ["한국은행", "금통위", "이창용"], re: /한국은행|금통위|이창용|(?<!신)한은(?!실|하)/ },
  { name: "KB국민",     aliases: ["KB국민", "국민은행", "KB금융", "국민카드"] },
  { name: "신한",       aliases: ["신한은행", "신한금융", "신한지주"] },
  { name: "하나",       aliases: ["하나은행", "하나금융", "하나지주"] },
  { name: "우리",       aliases: ["우리은행", "우리금융", "우리지주"] },
  { name: "NH농협",     aliases: ["농협은행", "NH농협", "농협금융", "NH금융"] },
  { name: "IBK기업",    aliases: ["기업은행", "IBK기업", "IBK"] },
  { name: "산업은행",   aliases: ["산업은행", "KDB산업", "KDB"] },
  { name: "수출입은행", aliases: ["수출입은행", "수은"] },
  { name: "카카오뱅크", aliases: ["카카오뱅크", "카뱅"] },
  { name: "케이뱅크",   aliases: ["케이뱅크", "케뱅"] },
  { name: "토스뱅크",   aliases: ["토스뱅크"] },
  { name: "SC·씨티",    aliases: ["SC제일", "씨티은행", "한국씨티"] },
  { name: "저축은행",   aliases: ["저축은행", "SBI저축", "OK저축"] },
  { name: "금융당국",   aliases: ["금융감독원", "금감원", "금융위원회", "금융위", "예금보험공사", "예보"] },
];

// ── 3. 주제 정의 ─────────────────────────────────────────────
const TOPICS = [
  { name: "금리·통화정책",   keywords: ["기준금리", "금통위", "통화정책", "예대금리", "금리 인하", "금리 인상", "금리인하", "금리인상", "가산금리"] },
  { name: "실적·수익",       keywords: ["순이익", "당기순이익", "이자이익", "영업이익", "실적", "배당", "자사주"] },
  { name: "대출·여신",       keywords: ["대출", "여신", "주담대", "주택담보", "가계대출", "기업대출", "신용대출", "DSR", "한도"] },
  { name: "예금·수신",       keywords: ["예금", "적금", "수신", "예적금", "파킹통장", "청약"] },
  { name: "가계부채·부동산", keywords: ["가계부채", "가계빚", "부동산", "전세", "집값"] },
  { name: "규제·감독·정책",  keywords: ["금융감독원", "금감원", "금융위", "규제", "감독", "제재", "과징금", "정책", "가이드라인"] },
  { name: "연체·부실·건전성", keywords: ["연체", "부실", "건전성", "충당금", "리스크", "부도", "회수"] },
  { name: "디지털·핀테크",   keywords: ["디지털", "핀테크", "인터넷은행", "마이데이터", "간편결제", "인공지능", "플랫폼"] },
  { name: "사건·사고",       keywords: ["횡령", "배임", "금융사고", "부정", "사기", "유출", "먹통", "전산"] },
];

const BANK_CONTEXT = ["은행", "기준금리", "예대금리", "여신", "수신", "가계부채",
  "금융감독원", "금감원", "금융위", "주담대", "금융지주"];

const GNEWS_QUERIES = [
  "은행 금리", "은행 대출", "가계부채", "금융감독원 은행", "은행 실적",
  ...BANKS.filter((b) => b.name !== "저축은행").map((b) => b.aliases[0]),
];

const STOP = new Set(["기자", "종합", "속보", "단독", "포토", "영상", "그래픽", "인터뷰",
  "오늘", "이번", "관련", "위해", "대한", "있다", "했다", "한다", "된다", "밝혔다"]);

// ── 4. 유틸 ──────────────────────────────────────────────────
function decode(s) {
  return (s || "")
    .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}
function nid(t) { return (t || "").toLowerCase().replace(/[^가-힣a-z0-9]/g, "").slice(0, 50); }
function kstDate(d) { return new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); }
function tokens(t) {
  return [...new Set((t || "").replace(/\[[^\]]*\]/g, " ")
    .split(/[^가-힣A-Za-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)))];
}

async function fetchXml(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (news-collector)" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}
function parseItems(xml, feedName, rich) {
  const blocks = xml.match(/<item[ >][\s\S]*?<\/item>/g) || [];
  return blocks.map((b) => {
    let title = tag(b, "title");
    const srcRaw = (b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1];
    const source = srcRaw ? decode(srcRaw) : feedName;
    if (srcRaw && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    const pub = tag(b, "pubDate");
    return { title, link: tag(b, "link"), source, pubDate: pub,
      summary: rich ? tag(b, "description").slice(0, 200) : "" };
  }).filter((it) => it.title && it.link);
}
function matchList(text, defs) {
  const hits = [];
  for (const d of defs) {
    const hit = d.re ? d.re.test(text) : (d.aliases || d.keywords).some((k) => text.includes(k));
    if (hit) hits.push(d.name);
  }
  return hits;
}

// ── 5. 클러스터링: 같은 사건 묶고 언론사별 링크 모으기 ───────────
function isGoogle(u) { return /news\.google\./.test(u || ""); }
function mergeSources(list) {
  const ordered = [...list].sort((a, b) => (isGoogle(a.link) ? 1 : 0) - (isGoogle(b.link) ? 1 : 0));
  const out = [], seen = new Set();
  for (const x of ordered) {
    if (!x.source || seen.has(x.source)) continue;
    seen.add(x.source); out.push({ source: x.source, link: x.link });
    if (out.length >= 6) break;
  }
  return out;
}
function buildStory(g) {
  const rep = g.find((x) => x.summary && !isGoogle(x.link)) || g.find((x) => x.summary) || g[0];
  const sources = mergeSources(g);
  const pub = g.map((x) => x.pubDate).filter(Boolean).sort().reverse()[0] || rep.pubDate;
  return {
    title: rep.title,
    summary: rep.summary,
    text: g.map((x) => x.title).join(" ") + " " + rep.summary,
    sources, dupCount: g.length,
    pubDate: pub, dateKST: pub ? kstDate(pub) : kstDate(Date.now()),
  };
}
function clusterStories(items) {
  const toks = items.map((it) => tokens(it.title));
  const used = new Array(items.length).fill(false);
  const stories = [];
  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const g = [items[i]];
    for (let j = i + 1; j < items.length; j++) {
      if (used[j] || !toks[i].length || !toks[j].length) continue;
      const inter = toks[i].filter((x) => toks[j].includes(x)).length;
      if (inter >= 2 && inter / Math.min(toks[i].length, toks[j].length) >= 0.6) {
        g.push(items[j]); used[j] = true;
      }
    }
    stories.push(buildStory(g));
  }
  return stories;
}

// ── 6. 수집 ──────────────────────────────────────────────────
async function collect() {
  const jobs = [];
  for (const f of DIRECT_FEEDS)
    jobs.push(fetchXml(f.url).then((x) => parseItems(x, f.name, f.rich)).catch((e) => { console.warn(`  ! ${f.name}: ${e.message}`); return []; }));
  for (const q of GNEWS_QUERIES)
    jobs.push(fetchXml(GNEWS(q)).then((x) => parseItems(x, "구글뉴스", false)).catch((e) => { console.warn(`  ! 구글:${q}: ${e.message}`); return []; }));
  const flat = (await Promise.all(jobs)).flat();
  console.log(`  · 직접 RSS ${DIRECT_FEEDS.length}개 + 구글뉴스 검색 ${GNEWS_QUERIES.length}개 → 원시 ${flat.length}건`);
  const stories = clusterStories(flat);
  console.log(`  · 클러스터링 → ${stories.length}개 사건(story)`);
  return stories;
}

// ── 7. 메인 ──────────────────────────────────────────────────
async function main() {
  const buildOnly = process.argv.includes("--build-only");
  console.log(buildOnly ? "[대시보드 재빌드] 수집 없이 분석만 반영…" : "[은행 뉴스 수집기] 시작…");
  const stories = buildOnly ? [] : await collect();

  // 은행 관련 필터 + 분류
  const fresh = [];
  for (const s of stories) {
    const banks = matchList(s.text, BANKS);
    if (!(banks.length || BANK_CONTEXT.some((k) => s.text.includes(k)))) continue;
    const topics = matchList(s.text, TOPICS);
    fresh.push({
      id: nid(s.title), title: s.title, summary: s.summary,
      sources: s.sources, dupCount: s.dupCount,
      pubDate: s.pubDate, dateKST: s.dateKST,
      banks, topics: topics.length ? topics : ["기타"],
    });
  }
  console.log(`  · 은행 관련 ${fresh.length}건`);

  // 누적 저장소 병합 (최근 30일 유지)
  const storePath = path.join(__dirname, "store.json");
  let store = [];
  try { store = JSON.parse(fs.readFileSync(storePath, "utf8")); } catch {}
  const byId = new Map(store.map((a) => [a.id, a]));
  for (const a of fresh) {
    const prev = byId.get(a.id);
    const sources = prev ? mergeSources([...(prev.sources || []), ...a.sources]) : a.sources;
    byId.set(a.id, { ...prev, ...a, sources, summary: a.summary || (prev && prev.summary) || "" });
  }
  const cutoff = kstDate(Date.now() - 30 * 864e5);
  let all = [...byId.values()].filter((a) => a.dateKST >= cutoff);

  // AI 분석 병합
  let analysis = {};
  try { analysis = JSON.parse(fs.readFileSync(path.join(__dirname, "analysis.json"), "utf8")); } catch {}
  for (const a of all) { if (analysis[a.id]) a.analysis = analysis[a.id]; else delete a.analysis; }

  fs.writeFileSync(storePath, JSON.stringify(all, null, 2), "utf8");

  // 날짜별 그룹핑 + 집계
  all.sort((a, b) => (b.pubDate || "").localeCompare(a.pubDate || ""));
  const byDate = {}, dayMeta = {};
  for (const a of all) (byDate[a.dateKST] = byDate[a.dateKST] || []).push(a);
  const dates = Object.keys(byDate).sort().reverse();
  for (const d of dates) {
    const arts = byDate[d], bB = {}, bT = {};
    for (const a of arts) {
      a.banks.forEach((x) => (bB[x] = (bB[x] || 0) + 1));
      a.topics.forEach((x) => (bT[x] = (bT[x] || 0) + 1));
    }
    dayMeta[d] = { count: arts.length, analyzed: arts.filter((a) => a.analysis).length, byBank: bB, byTopic: bT };
  }

  // 형광펜 하이라이트 대상: 은행/기관 고유명칭만 (일반어 '은행'은 제외, 긴 것 우선)
  const highlightTerms = [...new Set(BANKS.flatMap((b) => b.aliases))]
    .sort((a, b) => b.length - a.length);

  const now = new Date();
  const payload = {
    lastUpdatedKST: now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    banks: BANKS.map((b) => b.name), topics: TOPICS.map((t) => t.name),
    highlightTerms,
    dates, dayMeta, byDate,
  };
  fs.writeFileSync(path.join(__dirname, "data.json"), JSON.stringify(payload), "utf8");
  const tpl = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
  fs.writeFileSync(path.join(__dirname, "index.html"),
    tpl.replace("/*__DATA__*/", "window.BANK_NEWS = " + JSON.stringify(payload) + ";"), "utf8");

  const analyzed = all.filter((a) => a.analysis).length;
  console.log(`\n완료 ✓  누적 ${all.length}건 / 날짜 ${dates.length}개 (${dates[dates.length - 1]} ~ ${dates[0]}) / AI분석 ${analyzed}건`);
  console.log(`  → index.html · store.json · data.json`);
}

main().catch((e) => { console.error("실패:", e); process.exit(1); });
