# ☁️ 클라우드 자동화 설정 (PC 꺼져도 매일 자동 갱신)

GitHub Actions가 **매일 클라우드에서** 뉴스를 수집·빌드하고 **GitHub Pages**로 서빙합니다.
로컬 git 커밋은 이미 되어 있어요. 아래 **5단계**만 하면 됩니다.

---

## 1. GitHub 계정 (없으면)
https://github.com 에서 무료 가입.

## 2. 빈 저장소 만들기
- 우측 상단 **+ → New repository**
- 이름: 예) `bank-news`  · **Public** 선택 (무료 Pages는 공개 저장소)
- README/gitignore 추가 **체크 안 함** (이미 로컬에 있음)
- **Create repository**

## 3. 푸시 (이 폴더에서 실행)
아래를 이 폴더(`은행뉴스`)에서 실행하세요. `<사용자명>`만 본인 것으로 바꾸면 됩니다.
(터미널: 폴더에서 마우스 우클릭 → "Git Bash Here" 또는 VS Code 터미널)

```bash
git remote add origin https://github.com/<사용자명>/bank-news.git
git push -u origin main
```
- 처음 푸시 때 로그인 창이 뜨면 브라우저로 GitHub 로그인하면 됩니다(토큰 발급 불필요).

## 4. Pages 켜기
저장소 페이지에서 **Settings → Pages →** "Build and deployment" 의 **Source** 를
**GitHub Actions** 로 선택.

## 5. 첫 실행
저장소 **Actions 탭 → 'bank-news-daily' → Run workflow** 클릭 (또는 매일 07:00 자동).
- 끝나면 **Settings → Pages** 상단에 사이트 주소가 뜹니다:
  `https://<사용자명>.github.io/bank-news/`
- 이 주소가 **PC 꺼져도 열리는 최종 링크**입니다. 폰 홈화면에 추가해두면 앱처럼 써요.

---

## (선택) 매일 AI 분석까지 자동으로
클라우드에는 로컬 Claude 로그인을 못 쓰므로, AI 분석은 **Anthropic API 키**로 합니다.
- https://console.anthropic.com 에서 API 키 발급 (소액 종량제)
- 저장소 **Settings → Secrets and variables → Actions → New repository secret**
  - Name: `ANTHROPIC_API_KEY`
  - Secret: 발급받은 키
- 이 시크릿이 있으면 워크플로우가 매일 새 기사에 **요약·용어·영향·해결책**을 자동 생성합니다.
- 없으면? 수집·분류·요약(원문)·원문링크·날짜 기능은 **무료로 그대로** 동작하고, AI 상세분석만 비어 있습니다.

## 참고
- **공개 저장소 = 공개 사이트**입니다(뉴스 요약이라 보통 무방). 비공개로 하려면 GitHub Pro 필요.
- 클라우드가 매일 갱신하므로, **로컬 자동 작업(BankNewsDaily)은 꺼두는 걸 권장**(중복 방지):
  ```powershell
  Unregister-ScheduledTask -TaskName "BankNewsDaily" -Confirm:$false
  ```
- 로컬에서 최신을 보려면 가끔 `git pull` 하면 클라우드가 갱신한 상태가 내려옵니다.
