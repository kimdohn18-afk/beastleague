def send_to_server(game_data, api_url, api_key):
    """서버로 전송 + 정산 호출"""
    try:
        # 1. 게임 데이터 저장
        res = requests.post(
            f"{api_url}/api/internal/games",
            json=game_data,
            headers={"Content-Type": "application/json", "x-api-key": api_key},
            timeout=60
        )
        if res.status_code in [200, 201]:
            print(f"  ✅ 서버 전송 완료")
        else:
            print(f"  ⚠️ 서버 응답: {res.status_code} {res.text[:200]}")
            return

        # 2. 정산 호출
        game_id = game_data.get("gameId", "")
        if game_data.get("status") == "finished" and game_id:
            try:
                settle_res = requests.post(
                    f"{api_url}/api/internal/games/{game_id}/settle",
                    headers={"Content-Type": "application/json", "x-api-key": api_key},
                    timeout=60
                )
                if settle_res.status_code in [200, 201]:
                    result = settle_res.json()
                    print(f"  ✅ 정산 완료: {result.get('settledPlacements', 0)}건 처리")
                else:
                    print(f"  ⚠️ 정산 응답: {settle_res.status_code} {settle_res.text[:200]}")
            except Exception as e:
                print(f"  ⚠️ 정산 호출 실패: {e}")

    except Exception as e:
        print(f"  ❌ 서버 전송 실패: {e}")
