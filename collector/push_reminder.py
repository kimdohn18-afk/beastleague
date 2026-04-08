"""
비스트리그 푸시 리마인더
- 역할: 미배치 유저에게 "배치하세요" 알림 발송
- 정산 알림(⚾ 정산 완료!)은 서버 SettlementService가 자동 처리하므로 여기서 건드리지 않음
"""
import os
import time
import requests

API_URL = os.environ.get("API_URL", "https://beastleague.onrender.com")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")


def wake_up_server():
    """Render Free 서버 깨우기"""
    print("🔔 서버 웨이크업 요청...")
    try:
        res = requests.get(f"{API_URL}/api/games?date=2000-01-01", timeout=120)
        print(f"  서버 응답: {res.status_code} (깨어남)")
    except Exception as e:
        print(f"  ⚠️ 서버 웨이크업 실패 (재시도 합니다): {e}")
        # 한 번 더 시도
        try:
            time.sleep(10)
            res = requests.get(f"{API_URL}/api/games?date=2000-01-01", timeout=120)
            print(f"  서버 응답 (재시도): {res.status_code}")
        except Exception as e2:
            print(f"  ❌ 서버 웨이크업 최종 실패: {e2}")


def send_push_reminder():
    """미배치 유저에게 알림 발송"""
    if not INTERNAL_API_KEY:
        print("❌ INTERNAL_API_KEY가 설정되지 않았습니다.")
        return

    try:
        url = f"{API_URL}/api/internal/test-push-reminder"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": INTERNAL_API_KEY
        }
        res = requests.post(url, headers=headers, timeout=120)
        if res.status_code == 200:
            data = res.json()
            print(f"✅ 알림 발송 완료: {data.get('sent', 0)}명에게 전송")
        else:
            print(f"❌ 알림 발송 실패: {res.status_code} {res.text[:200]}")
    except Exception as e:
        print(f"❌ 알림 발송 실패: {e}")


def main():
    print("=" * 50)
    print("🔔 비스트리그 푸시 리마인더")
    print("=" * 50)

    # 1단계: 서버 깨우기
    wake_up_server()

    # 2단계: 서버가 완전히 준비될 때까지 대기
    print("  ⏳ 서버 준비 대기 (5초)...")
    time.sleep(5)

    # 3단계: 알림 발송
    send_push_reminder()

    print("\n=== 리마인더 완료 ===")


if __name__ == "__main__":
    main()
