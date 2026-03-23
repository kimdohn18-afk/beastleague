#!/bin/bash
set -e

echo "🐻 비스트리그 GitHub 레포 초기화"
echo ""

# 현재 디렉토리가 beastleague 루트인지 확인
if [ ! -f "package.json" ]; then
  echo "❌ beastleague 루트 디렉토리에서 실행해주세요."
  echo "   cd /path/to/beastleague && bash scripts/init-repo.sh"
  exit 1
fi

# git 초기화 (이미 되어 있으면 스킵)
if [ ! -d ".git" ]; then
  git init
  echo "✅ git init 완료"
else
  echo "ℹ️  이미 git 저장소입니다. 초기화 스킵."
fi

# git 사용자 설정 확인
GIT_USER=$(git config user.name 2>/dev/null || echo "")
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "")
if [ -z "$GIT_USER" ] || [ -z "$GIT_EMAIL" ]; then
  echo ""
  echo "⚠️  git 사용자 설정이 없습니다."
  echo "   git config --global user.name '이름'"
  echo "   git config --global user.email 'email@example.com'"
  echo "   위 명령 실행 후 스크립트를 다시 실행하세요."
  exit 1
fi

# main 브랜치로 전환 (이미 있으면 스킵)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "main" ]; then
  git checkout -b main 2>/dev/null || git checkout main
  echo "✅ main 브랜치 전환"
fi

# 스테이징
git add .

# 변경사항이 있는지 확인
if git diff --cached --quiet 2>/dev/null; then
  echo "ℹ️  커밋할 변경사항이 없습니다."
else
  git commit -m "feat: 비스트리그 초기 프로젝트 구조

- shared: 타입, 인터페이스, config (16 테스트)
- collector: ManualJsonDataSource + 입력 도구 (15 테스트)
- server: Express + MongoDB + Socket.IO + 엔진 (43 테스트)
- client: Next.js 14 + 5개 화면 + NextAuth
- docs: 아키텍처, 데이터 입력 가이드, 테스트 가이드
- ci: GitHub Actions CI 파이프라인"

  echo "✅ 초기 커밋 완료"
fi

# dev 브랜치 생성
if git rev-parse --verify dev > /dev/null 2>&1; then
  echo "ℹ️  dev 브랜치가 이미 존재합니다."
else
  git checkout -b dev
  git checkout main
  echo "✅ dev 브랜치 생성 완료"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 로컬 초기화 완료!"
echo ""
echo "다음 단계 — GitHub 연결:"
echo ""
echo "  1. GitHub에서 새 레포 생성"
echo "     → https://github.com/new (이름: beastleague, Private 권장)"
echo ""
echo "  2. 리모트 추가 및 push"
echo "     git remote add origin https://github.com/{username}/beastleague.git"
echo "     git push -u origin main"
echo "     git push -u origin dev"
echo ""
echo "  3. GitHub Branch Protection 설정"
echo "     → docs/GIT_STRATEGY.md 참고"
echo ""
echo "  4. GitHub Secrets 설정 (Settings → Secrets → Actions)"
echo "     → MONGODB_URI, JWT_SECRET, INTERNAL_API_KEY 등"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
