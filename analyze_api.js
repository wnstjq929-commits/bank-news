/**
 * 클라우드용 AI 분석 (Anthropic API 직접 호출 · 의존성 없음)
 * ------------------------------------------------------------
 *  _work/pending.json 의 기사들에 대해 요약/용어/영향/해결책을 생성해
 *  analysis.json 에 병합한다. (로컬 Claude 로그인이 불가능한 클라우드용)
 *
 *  필요:  환경변수 ANTHROPIC_API_KEY
 *  실행:  node make_pending.js && node analyze_api.js
 */
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const BATCH = 6;

if (!KEY) { console.log("ANTHROPIC_API_KEY 없음 → AI 분석 건너뜀"); process.exit(0); }

const pendPath = path.join(DIR, "_work", "pending.json");
let pend = [];
try { pend = JSON.parse(fs.readFileSync(pendPath, "utf8")); } catch { }
if (!pend.length) { console.log("분석 대기 0건"); process.exit(0); }

const SYS = "너는 한국 은행권 뉴스 분석가다. 반드시 유효한 JSON만 출력하고, 코드펜스나 설명 문장을 붙이지 않는다.";

function prompt(items) {
  return "다음은 기사 배열이다. 각 기사에 대해 한국어로 아래 4가지를 만들어라.\n" +
    "1) summary: 주요 내용을 빠짐없이 담은 상세 요약 4~6문장(핵심사실·배경·수치·발언 포함, 창작 금지)\n" +
    "2) terms: 어려운 용어·약어를 쉽게 설명한 [{\"term\":\"\",\"desc\":\"\"}] 배열(없으면 [])\n" +
    "3) impact: 은행(권)에 미치는 영향 1~2문장(수익성/건전성/규제/경쟁/평판 등 측면 명시)\n" +
    "4) solutions: 구체적 대응방안 2~4개 배열\n\n" +
    "출력은 키가 각 기사 id인 JSON 객체 하나만. 형식: {\"id\":{\"summary\":\"\",\"terms\":[],\"impact\":\"\",\"solutions\":[]}}\n\n" +
    "기사 배열:\n" + JSON.stringify(items.map((a) => ({ id: a.id, title: a.title, summary: a.summary, banks: a.banks, topics: a.topics })));
}

async function analyze(items) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYS, messages: [{ role: "user", content: prompt(items) }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("API " + res.status + ": " + JSON.stringify(j).slice(0, 200));
  let txt = (j.content || []).map((c) => c.text || "").join("").trim();
  txt = txt.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(txt);
}

(async () => {
  let analysis = {};
  try { analysis = JSON.parse(fs.readFileSync(path.join(DIR, "analysis.json"), "utf8")); } catch { }
  let done = 0, fail = 0;
  for (let i = 0; i < pend.length; i += BATCH) {
    const batch = pend.slice(i, i + BATCH);
    try {
      const out = await analyze(batch);
      Object.assign(analysis, out);
      done += Object.keys(out).length;
      console.log(`  · ${i + batch.length}/${pend.length} 처리`);
    } catch (e) {
      fail++; console.warn(`  ! 배치 ${i / BATCH + 1} 실패: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(DIR, "analysis.json"), JSON.stringify(analysis, null, 2), "utf8");
  console.log(`AI 분석 완료: ${done}건 생성 (실패 배치 ${fail}) → analysis.json`);
})();
