#!/bin/bash

# 이미지 폴더 생성
mkdir -p client/public/characters/{dragon,cat,dog,bear,rabbit}
mkdir -p client/public/icons

# 이미지 다운로드 (예시 - 실제로는 생성된 이미지 URL 사용)
echo "이미지 다운로드 중..."
# wget -O client/public/characters/dragon/stage1.png [이미지URL]
# ... (나머지 이미지들)

# Git에 추가
git add client/public/characters/
git add client/public/icons/
git add shared/src/config/characters.ts
git add client/src/components/CharacterDisplay.tsx

# 커밋
git commit -m "feat: Add character growth system with stage images

- Add 4-stage character images for dragon, cat, dog, bear, rabbit
- Create CharacterDisplay component with animation
- Add character config system with level-based stage selection
- Implement smooth scaling based on character level"

# 푸시
git push origin main
