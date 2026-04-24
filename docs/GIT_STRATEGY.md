# 브랜치 전략

## 브랜치 구조

| 브랜치 | 목적 | 직접 push |
|--------|------|-----------|
| `main` | 배포 가능 상태. GitHub Branch Protection 설정 | ❌ PR만 허용 |
| `dev`  | 개발 통합 브랜치. 일상적인 작업의 기준점 | ⚠️ 최소화 |
| `feature/*` | 기능 개발 (예: `feature/training-ui`) | ✅ |
| `fix/*` | 버그 수정 (예: `fix/settlement-duplicate`) | ✅ |
| `docs/*` | 문서만 수정 (예: `docs/api-guide`) | ✅ |
| `chore/*` | 빌드·CI·의존성 (예: `chore/upgrade-next15`) | ✅ |

---

## 일반 워크플로우

```
dev  ──── feature/xxx ──── (PR) ──── dev ──── (PR) ──── main
               │                      │                   │
            작업 완료              CI 통과               배포
```

1. `dev` 에서 `feature/xxx` 분기
2. 작업 완료 → `dev` 로 PR 생성
3. CI 통과 + 자체 리뷰 → merge
4. 배포 시점에 `dev` → `main` PR 생성
5. `main` merge 시 자동 배포 (추후 Railway/Vercel 설정)

---
## 배포 체크리스트

1. **환경 변수**: Vercel/Railway 대시보드에 `INTERNAL_API_KEY`, `JWT_SECRET` 등이 설정되어 있는가?
2. **DB 연결**: 운영용 MongoDB Atlas URI가 정상적으로 입력되었는가?
3. **빌드 로그**: 배포 중 에러(Error) 없이 완료되었는가?
4. **버전 태깅**: 주요 기능 반영 후 `git tag`를 생성했는가?

---

## 핫픽스 워크플로우

`main` 에서 심각한 버그 발생 시:

```
main ──── fix/critical-bug ──── (PR) ──── main
                                          │
                                     cherry-pick or merge ──── dev
```

---

## 커밋 메시지 컨벤션

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### type

| type | 의미 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 포맷·세미콜론 등 (로직 변경 없음) |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `test` | 테스트 추가·수정 |
| `chore` | 빌드, 의존성, CI 설정 |

### scope

`shared` · `collector` · `server` · `client` · `ci` · `docs`

### 예시

```
feat(server): 정산 서비스 트랜잭션 추가
fix(client): 배치 화면 404 에러 수정
docs: 데이터 입력 가이드 업데이트
test(server): BattleEngine 엣지 케이스 추가
chore(ci): Node 22 매트릭스 추가
refactor(shared): StatRules 타입 정밀화
```

---

## GitHub Branch Protection 권장 설정

`main` 브랜치:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → `CI / Test (Node 18)`, `CI / Test (Node 20)`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

---

## 릴리스 태깅

시즌 주요 릴리스:

```bash
git tag -a v0.1.0 -m "알파 테스트 릴리스"
git push origin v0.1.0
```

버전 형식: `vMAJOR.MINOR.PATCH` (Semantic Versioning)
