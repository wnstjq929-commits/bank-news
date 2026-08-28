/**
 * 아직 AI 분석이 없는 '은행 명시' 기사만 골라 _work/pending.json 으로 저장.
 * 매일 자동 실행 시 새 기사만 분석하도록 하는 준비 단계.
 */
const fs = require("fs");
const path = require("path");
const dir = __dirname;

const d = JSON.parse(fs.readFileSync(path.join(dir, "data.json"), "utf8"));
let an = {};
try { an = JSON.parse(fs.readFileSync(path.join(dir, "analysis.json"), "utf8")); } catch {}

const out = [], seen = new Set();
const LIMIT = 80;
for (const date of d.dates) {                 // 최근 날짜부터 — 모든 기사 대상
  for (const a of d.byDate[date]) {
    if (!an[a.id] && !seen.has(a.id)) {
      seen.add(a.id);
      out.push({ id: a.id, title: a.title, summary: a.summary, banks: a.banks, topics: a.topics });
    }
  }
  if (out.length >= LIMIT) break;
}
fs.mkdirSync(path.join(dir, "_work"), { recursive: true });
fs.writeFileSync(path.join(dir, "_work", "pending.json"), JSON.stringify(out.slice(0, LIMIT), null, 2), "utf8");
console.log("분석 대기(pending):", Math.min(out.length, LIMIT), "건");
