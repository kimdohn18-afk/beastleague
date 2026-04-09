"""
KBO 경기 데이터 수집기 (Python) v3
KBO 경기 데이터 수집기 (Python) v4
- 역할: 경기 일정 수집 + 박스스코어 수집 + 서버 전송 + 정산 호출
- 알림은 push_reminder.py가 별도 담당
"""
import requests
import json
@@ -17,8 +19,22 @@
"Referer": "https://www.koreabaseball.com/Schedule/ScoreBoard.aspx"
}

API_URL = os.environ.get("API_URL", "https://beastleague.onrender.com")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")


def wake_up_server():
    """Render Free 서버 깨우기"""
    print("🔔 서버 웨이크업 요청...")
    try:
        res = requests.get(f"{API_URL}/api/games?date=2000-01-01", timeout=120)
        print(f"  서버 응답: {res.status_code} (깨어남)")
    except Exception as e:
        print(f"  ⚠️ 서버 웨이크업 실패: {e}")


def get_schedule(date_str):
    """KBO 일정 조회"""
url = f"{BASE_URL}/ws/Main.asmx/GetKboGameList"
payload = {"leId": "1", "srId": "0,9,6", "date": date_str}
try:
@@ -38,6 +54,7 @@ def get_schedule(date_str):


def get_boxscore(game_id, season_id, sr_id="0"):
    """박스스코어 조회"""
url = f"{BASE_URL}/ws/Schedule.asmx/GetBoxScoreScroll"
payload = {"leId": "1", "srId": sr_id, "seasonId": season_id, "gameId": game_id}
try:
@@ -49,6 +66,7 @@ def get_boxscore(game_id, season_id, sr_id="0"):


def parse_table(table_data):
    """테이블 데이터 파싱"""
if isinstance(table_data, str):
try:
table_data = json.loads(table_data)
@@ -66,6 +84,7 @@ def parse_table(table_data):


def parse_hitters(box_data):
    """타자 기록 파싱"""
arr_hitter = box_data.get("arrHitter", [])
all_teams = []

@@ -120,6 +139,7 @@ def parse_hitters(box_data):


def parse_events(box_data):
    """경기 이벤트 파싱"""
table_etc = box_data.get("tableEtc", "")
if isinstance(table_etc, str):
try:
@@ -139,6 +159,7 @@ def parse_events(box_data):


def save_csv(date_str, all_records):
    """CSV 저장"""
os.makedirs("output", exist_ok=True)
filepath = f"output/{date_str}.csv"
with open(filepath, "w", newline="", encoding="utf-8") as f:
@@ -155,12 +176,13 @@ def save_csv(date_str, all_records):
print(f"  ✅ CSV 저장: {filepath}")


def send_to_server(game_data, api_url, api_key):
def send_to_server(game_data):
    """서버에 경기 데이터 전송 + finished면 정산 호출"""
try:
res = requests.post(
            f"{api_url}/api/internal/games",
            f"{API_URL}/api/internal/games",
json=game_data,
            headers={"Content-Type": "application/json", "x-api-key": api_key},
            headers={"Content-Type": "application/json", "x-api-key": INTERNAL_API_KEY},
timeout=60
)
if res.status_code in [200, 201]:
@@ -169,12 +191,13 @@ def send_to_server(game_data, api_url, api_key):
print(f"  ⚠️ 서버 응답: {res.status_code} {res.text[:200]}")
return

        # 경기 종료 시 정산 호출 (정산 알림은 SettlementService가 자동 발송)
game_id = game_data.get("gameId", "")
if game_data.get("status") == "finished" and game_id:
try:
settle_res = requests.post(
                    f"{api_url}/api/internal/games/{game_id}/settle",
                    headers={"Content-Type": "application/json", "x-api-key": api_key},
                    f"{API_URL}/api/internal/games/{game_id}/settle",
                    headers={"Content-Type": "application/json", "x-api-key": INTERNAL_API_KEY},
timeout=60
)
if settle_res.status_code in [200, 201]:
@@ -189,46 +212,17 @@ def send_to_server(game_data, api_url, api_key):
print(f"  ❌ 서버 전송 실패: {e}")


def wake_up_server(api_url):
    print("🔔 서버 웨이크업 요청...")
    try:
        res = requests.get(f"{api_url}/api/games?date=2000-01-01", timeout=120)
        print(f"  서버 응답: {res.status_code} (깨어남)")
    except Exception as e:
        print(f"  ⚠️ 서버 웨이크업 실패: {e}")


def send_push_reminder(api_url, api_key):
    print("🔔 미배치 유저 알림 발송...")
    try:
        res = requests.post(
            f"{api_url}/api/internal/test-push-reminder",
            headers={"Content-Type": "application/json", "x-api-key": api_key},
            timeout=60
        )
        if res.status_code == 200:
            result = res.json()
            print(f"  ✅ 알림 발송: {result.get('sent', 0)}명")
        else:
            print(f"  ⚠️ 알림 응답: {res.status_code} {res.text[:200]}")
    except Exception as e:
        print(f"  ❌ 알림 발송 실패: {e}")


def collect_date(date_str):
    """특정 날짜 경기 수집"""
season_id = date_str[:4]
    print(f"\n📅 {date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} 경기 수집 시작\n")

    api_url = os.environ.get("API_URL", "https://beastleague.onrender.com")
    api_key = os.environ.get("INTERNAL_API_KEY", "")
    formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    print(f"\n📅 {formatted} 경기 수집 시작\n")

    wake_up_server(api_url)
    wake_up_server()

games = get_schedule(date_str)
if not games:
print("  경기가 없습니다.")
        if api_key:
            send_push_reminder(api_url, api_key)
return

all_records = []
@@ -244,26 +238,28 @@ def collect_date(date_str):

print(f"⚾ {away_team} {score_a} vs {score_h} {home_team} (ID: {game_id}, 상태: {status})")

        # 경기 예정
if status == "1":
start_time = game.get("G_TM", "")
            game_data = {
            send_to_server({
"gameId": game_id,
                "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                "date": formatted,
"homeTeam": home_team,
"awayTeam": away_team,
"status": "scheduled",
"startTime": start_time,
"homeScore": 0,
"awayScore": 0,
            }
            send_to_server(game_data, api_url, api_key)
            })
print(f"  📋 경기 예정 ({start_time}) → scheduled로 저장")
continue

        # 알 수 없는 상태
if status not in ("2", "3"):
print(f"  ⏭️ 알 수 없는 상태 (상태: {status}), 건너뜀")
continue

        # 진행 중 또는 종료 → 박스스코어 수집
box = get_boxscore(game_id, season_id, sr_id)
if not box:
continue
@@ -278,7 +274,7 @@ def collect_date(date_str):
if p["order"]:
print(f"    {p['order']} {p['name']}: {p['atBats']}타수 {p['hits']}안타 {p['rbi']}타점 {p['runs']}득점 ({p['avg']})")
all_records.append({
                    "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                    "date": formatted,
"gameId": game_id,
"team": team_name,
"order": p["order"],
@@ -291,7 +287,8 @@ def collect_date(date_str):
"avg": p["avg"]
})

        if api_key:
        # 서버 전송
        if INTERNAL_API_KEY:
away_batters = []
home_batters = []
for team in teams:
@@ -310,17 +307,19 @@ def collect_date(date_str):
away_batters.append(batter)
else:
home_batters.append(batter)

            game_status = "finished" if status == "3" else "in_progress"
send_to_server({
"gameId": game_id,
                "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                "date": formatted,
"homeTeam": home_team,
"awayTeam": away_team,
"homeScore": int(score_h) if score_h else 0,
"awayScore": int(score_a) if score_a else 0,
                "status": "finished",
                "status": game_status,
"batterRecords": {"away": away_batters, "home": home_batters},
"events": events
            }, api_url, api_key)
            })
else:
print(f"\n  ⚠️ INTERNAL_API_KEY 없음, 서버 전송 건너뜀")

@@ -329,9 +328,6 @@ def collect_date(date_str):
if all_records:
save_csv(date_str, all_records)

    if api_key:
        send_push_reminder(api_url, api_key)

print(f"\n=== 수집 완료 ===")

