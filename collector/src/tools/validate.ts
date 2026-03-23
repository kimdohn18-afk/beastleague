#!/usr/bin/env ts-node
/**
 * 날짜별 JSON 파일 검증 도구
 * 실행: npx ts-node collector/src/tools/validate.ts --date 2026-04-01
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateGameData } from '../validator/GameDataValidator';

const DATA_DIR = path.resolve(process.cwd(), 'data');

async function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');

  if (dateIdx === -1) {
    console.error('사용법: npx ts-node validate.ts --date YYYY-MM-DD');
    process.exit(1);
  }

  const date = args[dateIdx + 1];
  const dir = path.join(DATA_DIR, date);

  if (!fs.existsSync(dir)) {
    console.error(`디렉토리 없음: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('JSON 파일 없음.');
    return;
  }

  let ok = 0, fail = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as unknown;
      const { valid, errors } = validateGameData(data);
      if (valid) {
        console.log(`[✓] ${file} — 정상`);
        ok++;
      } else {
        console.log(`[✗] ${file} — 에러:`);
        errors.forEach((e) => console.log(`    - ${e}`));
        fail++;
      }
    } catch {
      console.log(`[✗] ${file} — JSON 파싱 실패`);
      fail++;
    }
  }

  console.log(`\n요약: ${files.length}개 중 ${ok}개 정상, ${fail}개 오류`);
}

main().catch((e) => { console.error(e); process.exit(1); });
