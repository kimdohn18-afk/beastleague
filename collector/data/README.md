# 경기 데이터 디렉토리

이 디렉토리는 실제 경기 데이터 JSON 파일이 저장되는 위치입니다.

## 디렉토리 구조

```
data/
└── YYYY-MM-DD/          # 경기 날짜별 폴더
    └── {gameId}.json    # 경기별 JSON 파일
```

## 주의사항

- **`.gitignore` 정책**: `data/*/` 디렉토리는 버전 관리에서 제외됩니다.
  실제 경기 데이터는 각 환경(로컬, 서버)에서 직접 입력하세요.
- 데이터 입력 방법: [DATA_INPUT_GUIDE.md](../../docs/DATA_INPUT_GUIDE.md) 참고
- 샘플 데이터 테스트: `npm run seed` 실행 후 `npm run e2e`

## 빠른 시작

```bash
# 대화형 입력
npm run input

# CSV 일괄 입력
npm run quick-input -- --date 2026-04-01 --file ./input.csv

# 검증
npm run validate-data -- --date 2026-04-01
```
