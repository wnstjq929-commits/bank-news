/**
 * 은행 뉴스 웹서버 (의존성 없음 · Node 내장 http)
 * ------------------------------------------------------------
 *  실행:  node server.js   (또는 웹서버.bat 더블클릭)
 *  접속:  http://localhost:8787
 *  같은 Wi-Fi의 폰/태블릿에서는  http://<이 PC의 IP>:8787
 *
 *  라우트:
 *   GET  /            → 대시보드(template.html, 데이터는 /api/data 로 fetch)
 *   GET  /api/data    → 현재 뉴스 데이터(data.json)
 *   POST /api/refresh → 최신 뉴스 수집(node fetch_news.js) 후 완료 응답
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

const DIR = __dirname;
const PORT = process.env.PORT || 8787;

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function localIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name in ifaces)
    for (const ni of ifaces[name])
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
  return out;
}

let refreshing = false;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/" || url === "/index.html") {
    fs.readFile(path.join(DIR, "template.html"), (e, d) =>
      e ? send(res, 500, "text/plain; charset=utf-8", "template.html 없음")
        : send(res, 200, "text/html; charset=utf-8", d));

  } else if (url === "/api/data") {
    fs.readFile(path.join(DIR, "data.json"), (e, d) =>
      e ? send(res, 500, "application/json", '{"error":"데이터 없음. 먼저 수집하세요."}')
        : send(res, 200, "application/json; charset=utf-8", d));

  } else if (url === "/api/refresh" && req.method === "POST") {
    if (refreshing) return send(res, 200, "application/json", JSON.stringify({ ok: true, busy: true }));
    refreshing = true;
    console.log("· 새로고침 요청 → 뉴스 수집 시작");
    exec("node fetch_news.js", { cwd: DIR, maxBuffer: 1024 * 1024 * 32 }, (err, so, se) => {
      refreshing = false;
      if (err) { console.warn("  ! 수집 실패:", se || err); send(res, 500, "application/json", JSON.stringify({ ok: false, error: String(se || err).slice(0, 500) })); }
      else { console.log("  ✓ 수집 완료"); send(res, 200, "application/json", JSON.stringify({ ok: true })); }
    });

  } else {
    send(res, 404, "text/plain; charset=utf-8", "페이지를 찾을 수 없습니다.");
  }
});

server.listen(PORT, () => {
  console.log("\n🏦 은행 뉴스 웹서버 실행 중");
  console.log("  이 PC:   http://localhost:" + PORT);
  localIPs().forEach((ip) => console.log("  폰/태블릿(같은 Wi-Fi): http://" + ip + ":" + PORT));
  console.log("\n  종료하려면 이 창에서 Ctrl+C\n");
});
