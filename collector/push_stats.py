"""
비스트리그 푸시 구독 통계 확인
"""
import os
import time
import requests

API_URL = os.environ.get("API_URL", "https://beastleague.onrender.com")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")


def wake_up_server():
    print("🔔 서버 웨이크업 요청...")
    try:
        res = requests.get(f"{API_URL}/api/games?date=2000-01-01", timeout=120)
        print(f"  서버 응답: {res.status_code}")
    except Exception as e:
        print(f"  ⚠️ 웨이크업 실패, 재시도: {e}")
        try:
            time.sleep(10)
            requests.get(f"{API_URL}/api/games?date=2000-01-01", timeout=120)
        except:
            pass


def check_stats():
    if not INTERNAL_API_KEY:
        print("❌ INTERNAL_API_KEY가 설정되지 않았습니다.")
        return

    try:
        url = f"{API_URL}/api/internal/push-stats"
        headers = {"x-api-key": INTERNAL_API_KEY}
        res = requests.get(url, headers=headers, timeout=120)
        if res.status_code == 200:
            data = res.json()
            print(f"📊 알림 구독 통계")
            print(f"  - 구독 유저 수: {data.get('uniqueUsers', '?')}명")
            print(f"  - 등록된 토큰 수: {data.get('totalTokens', '?')}개")
        else:
            print(f"❌ 조회 실패: {res.status_code} {res.text[:200]}")
    except Exception as e:
        print(f"❌ 조회 실패: {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("📊 비스트리그 푸시 구독 통계")
    print("=" * 50)
    wake_up_server()
    time.sleep(5)
    check_stats()
    print("=" * 50)
