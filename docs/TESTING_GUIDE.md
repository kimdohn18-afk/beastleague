# 로컬 테스트 가이드 — BeastLeague

## 사전 준비

### 1. MongoDB 설정
로컬 MongoDB 또는 Atlas URI 중 하나를 선택.

**로컬 MongoDB (Docker):**
```bash
docker run -d --name beastleague-mongo -p 27017:27017 mongo:7
```

**MongoDB Atlas:**
- Atlas 클러스터 생성 후 URI 복사

### 2. 환경 변수 설정
```bash
cp .env.example .env
```

`.env` 파일에 최소한 아래 값은 필수:
```
MONGODB_URI=mongodb://localhost:27017/beastleague
JWT_SECRET=local-dev-secret-change-in-production
INTERNAL_API_KEY=local-internal-key
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. 패키지 설치
```bash
npm install
```

---

## 테스트 순서

### 1단계: 시드 데이터 삽입

```bash
npm run seed
```

**기대 결과:**
```
🌱 비스트리그 시드 스크립트 시작

  ✅ MongoDB 연결

🗑️  기존 데이터 삭제...
  ✅ 전체 컬렉션 초기화 완료

👤 유저 생성...
  ✅ 테스터1 (test1@beast.league)
  ✅ 테스터2 (test2@beast.league)
  ✅ 테스터3 (test3@beast.league)

🐾 캐릭터 생성...
  ✅ 번개곰 (bear)
  ✅ 질풍호 (tiger)
  ✅ 하늘매 (eagle)

⚾ 경기 데이터 로드...
  ✅ 20260401SSHT0 (광주 vs 대구 — finished)
  ✅ 20260401OBLT0 (부산 vs 서울D — finished)
  ✅ 20260401KTLG0 (서울L vs 수원 — scheduled)

📍 배치 생성...
  ✅ 테스터1 → 20260401SSHT0 / 광주 cleanup
  ✅ 테스터2 → 20260401SSHT0 / 대구 cleanup
  ✅ 테스터3 → 20260401OBLT0 / 부산 leadoff

🔑 테스트 JWT 토큰 (24h 유효):
  테스터1: eyJhb...
  ...

✨ 시드 완료!
```

---

### 2단계: 서버 시작

```bash
npm run dev --workspace=server
```

**기대 로그:**
```
[DB] MongoDB connected
[Server] Running on port 4000
```

---

### 3단계: E2E 플로우 검증

**새 터미널에서:**
```bash
npm run e2e
```

**기대 결과:**
```
🧪 비스트리그 E2E 플로우 테스트

  ✅ [2]  JWT 토큰 생성
  ✅ [3]  경기 목록 조회: 3경기 반환
  ✅ [4]  캐릭터 조회: name=번개곰, level=1
  ✅ [5]  배치 조회: gameId=20260401SSHT0, team=광주, group=cleanup
  ✅ [6]  훈련 1회차 (batting): XP+10, Lv.1
  ✅ [7]  훈련 2회차 (running): XP+10, Lv.1
  ✅ [8]  훈련 3회차 (mental): XP+10, Lv.2
  ✅ [9]  훈련 4회차 제한: 400 정상
  ✅ [10] 경기 정산: settled=2, battles=1
  ✅ [11] 정산 후 스탯 변화: power:+6.00, skill:+3.50, ...
  ✅ [12] 대결 결과: result=win, XP+25
  ✅ [13] 랭킹 조회: 3명 반환

📊 결과: 12단계 중 12개 ✅  0개 ❌
🎉 전체 플로우 정상!
```

---

### 4단계: 프론트엔드 확인

**새 터미널에서:**
```bash
npm run dev --workspace=client
```

브라우저에서 `http://localhost:3000` 접속.

**확인 체크리스트:**
- [ ] `/login` 페이지 — 카카오/구글 버튼 표시
- [ ] 로그인 후 홈 화면 — 캐릭터 없으면 "캐릭터 만들기" 버튼
- [ ] 캐릭터 생성 → 홈 화면에 캐릭터 카드 표시
- [ ] 배치 화면 → 3경기 표시 (scheduled 1개 포함)
- [ ] 훈련 탭 → 5종 훈련 버튼, 클릭 시 결과 토스트
- [ ] 캐릭터 화면 → 레이더 차트 표시
- [ ] 랭킹 화면 → 레벨 랭킹 표시

---

## 데이터 검증

특정 날짜의 JSON 데이터 검증:
```bash
npm run validate-data -- --date 2026-04-01
```

---

## 트러블슈팅

### MongoDB 연결 실패
```
Error: ECONNREFUSED 127.0.0.1:27017
```
→ MongoDB가 실행 중인지 확인: `docker ps` 또는 `mongod --version`

### 포트 충돌
```
Error: EADDRINUSE :::4000
```
→ 기존 서버 프로세스 종료: `lsof -ti:4000 | xargs kill`

### JWT 에러 (401)
→ `.env`의 `JWT_SECRET`이 서버와 클라이언트에서 동일한지 확인  
→ 시드 스크립트가 출력한 토큰으로 직접 테스트: `curl -H "Authorization: Bearer <token>" http://localhost:4000/api/characters/me`

### E2E에서 "시드 데이터 없음"
→ `npm run seed` 먼저 실행 필요

### 정산 후 스탯 변화 없음
→ `Placement.status`가 `active`인지 확인 (settled면 재정산 불가)  
→ 해결: `npm run seed`로 데이터 초기화 후 재시도

### `ts-node` 모듈 못 찾음
```
Cannot find module '@beastleague/shared'
```
→ `npm install` 재실행 후 `npm run seed`

---

## 수동 API 테스트

시드 스크립트가 출력하는 JWT 토큰으로 직접 curl 테스트:

```bash
TOKEN="eyJhb..."  # seed 출력 토큰

# 경기 목록
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/games?date=2026-04-01

# 훈련 실행
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"batting"}' \
  http://localhost:4000/api/trainings

# 정산 트리거
curl -X POST -H "x-api-key: local-internal-key" \
  http://localhost:4000/internal/games/20260401SSHT0/settle
```
