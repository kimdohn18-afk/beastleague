# 🐻 비스트리그 (BeastLeague)

실제 KBO 경기 결과로 동물 캐릭터가 성장하는 육성형 웹앱

[![CI](https://github.com/beastleague/beastleague/actions/workflows/ci.yml/badge.svg)](https://github.com/beastleague/beastleague/actions/workflows/ci.yml)

---

## 프로젝트 구조

```
beastleague/
├── shared/      공유 타입, 인터페이스, config (TypeScript)
├── collector/   경기 데이터 수집·검증 파이프라인 (ManualJsonDataSource)
├── server/      Express API + Socket.IO + MongoDB + 게임 엔진
├── client/      Next.js 14 App Router + Tailwind CSS 프론트엔드
└── docs/        아키텍처, 운영 가이드, 테스트 가이드
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 14 (App Router), TypeScript, Tailwind CSS, framer-motion |
| 백엔드 | Node.js, Express, TypeScript, Socket.IO |
| 데이터베이스 | MongoDB (Mongoose) |
| 인증 | NextAuth.js (카카오, 구글 OAuth) |
| 테스트 | Jest (unit), MongoMemoryServer (API) |
| CI/CD | GitHub Actions |
| 배포 | Vercel (client), Railway (server), MongoDB Atlas |

---

## 시작하기

### 사전 준비

- **Node.js 18+**
- **MongoDB** — 로컬 (`mongod`) 또는 [MongoDB Atlas](https://www.mongodb.com/atlas) 연결 URI
- **npm 9+**

### 설치

```bash
git clone https://github.com/{username}/beastleague.git
cd beastleague
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 각 값 입력
```

최소 필수 항목:

```
MONGODB_URI=mongodb://localhost:27017/beastleague
JWT_SECRET=your-secret-here
INTERNAL_API_KEY=your-internal-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 실행

```bash
# 테스트 유저·캐릭터·경기 데이터 시드
npm run seed

# API 서버 시작 (포트 4000)
npm run dev --workspace=server

# 프론트엔드 시작 (포트 3000)
npm run dev --workspace=client
```

### 경기 데이터 입력

```bash
# 대화형 입력
npm run input

# CSV 일괄 입력
npm run quick-input -- --date YYYY-MM-DD --file data/input.csv

# JSON 검증
npm run validate-data -- --date YYYY-MM-DD
```

### E2E 테스트

```bash
# 시드 → 서버 실행 후
npm run e2e
```

### 단위 테스트

```bash
npm test --workspace=shared      # 타입/config 테스트 (16개)
npm test --workspace=collector   # 데이터 파이프라인 테스트 (15개)
npm test --workspace=server      # 엔진 + API + E2E 테스트 (43개)
```

---

## 문서

| 문서 | 설명 |
|------|------|
| [아키텍처](docs/ARCHITECTURE.md) | 시스템 구조, DB 스키마, API, Socket 이벤트 |
| [데이터 입력 가이드](docs/DATA_INPUT_GUIDE.md) | 경기 데이터 입력 운영 절차 |
| [테스트 가이드](docs/TESTING_GUIDE.md) | 로컬 E2E 테스트 실행 방법 |
| [브랜치 전략](docs/GIT_STRATEGY.md) | 브랜치 구조 및 커밋 컨벤션 |

---

## 법적 고지

이 프로젝트는 KBO 경기의 공개된 결과 정보를 활용합니다.  
선수 실명, 초상, 구단 로고는 일절 사용하지 않습니다.  
상업적 운영 시 KBO / Sports2i / KPBPA 라이선스 계약이 필요합니다.
