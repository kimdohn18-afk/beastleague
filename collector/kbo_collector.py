"""
KBO 경기 데이터 수집기 (Python) v5
- 역할: 경기 일정 수집 + 박스스코어 수집 + 서버 전송 + 정산 호출
- v5: 타자별 안타 종류(2루타/3루타/홈런), 도루, 볼넷 파싱 추가
"""
import requests
import json
import sys
import os
import csv
import re
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
BASE_URL = "https://www.koreabaseball.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
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
        res = requests.post(url, data=payload, headers=HEADERS, timeout=15)
        data = res.json()
        if str(data.get("code")) != "100":
            print(f"  ⚠️ 일정 API 응답 코드: {data.get('code')}")
            return []
        game_list = data.get("game", [])
        if isinstance(game_list, str):
            game_list = json.loads(game_list)
        print(f"  경기 수: {len(game_list)}")
        return game_list
    except Exception as e:
        print(f"  ❌ 일정 조회 실패: {e}")
        return []


def get_boxscore(game_id, season_id, sr_id="0"):
    """박스스코어 조회"""
    url = f"{BASE_URL}/ws/Schedule.asmx/GetBoxScoreScroll"
    payload = {"leId": "1", "srId": sr_id, "seasonId": season_id, "gameId": game_id}
    try:
        res = requests.post(url, data=payload, headers=HEADERS, timeout=15)
        return res.json()
    except Exception as e:
        print(f"  ❌ 박스스코어 조회 실패: {e}")
        return None


def parse_table(table_data):
    """테이블 데이터 파싱"""
    if isinstance(table_data, str):
        try:
            table_data = json.loads(table_data)
        except:
            return []
    if not isinstance(table_data, dict):
        return []
    rows = table_data.get("rows", [])
    result = []
    for row_obj in rows:
        row = row_obj.get("row", [])
        cells = [cell.get("Text", "").strip() for cell in row]
        result.append(cells)
    return result


def parse_events(box_data):
    """경기 이벤트 파싱"""
    table_etc = box_data.get("tableEtc", "")
    if isinstance(table_etc, str):
        try:
            table_etc = json.loads(table_etc)
        except:
            return []
    rows = table_etc.get("rows", []) if isinstance(table_etc, dict) else []
    events = []
    for row_obj in rows:
        row = row_obj.get("row", [])
        if len(row) >= 2:
            event_type = row[0].get("Text", "").strip()
            event_detail = row[1].get("Text", "").strip()
            if event_type and event_detail:
                events.append({"type": event_type, "detail": event_detail})
    return events


def extract_names_from_event(detail_text):
    """
    이벤트 상세 텍스트에서 선수명 목록 추출
    예: "김도영(15호 2점 이정후)" → ["김도영"]
    예: "김도영, 이정후" → ["김도영", "이정후"]
    예: "김도영(2회) 이정후(5회)" → ["김도영", "이정후"]
    """
    # 괄호 내용 제거
    cleaned = re.sub(r'\([^)]*\)', '', detail_text)
    # 쉼표, 공백으로 분리
    parts = re.split(r'[,\s]+', cleaned)
    # 한글 2~4글자인 것만 선수명으로 간주
    names = [p.strip() for p in parts if re.match(r'^[가-힣]{2,4}$', p.strip())]
    return names


def enrich_batters_with_events(teams_data, events):
    """
    이벤트 정보를 활용해 각 타자에게 상세 기록 추가
    - 홈런, 2루타, 3루타, 도루, 도루실패, 볼넷 등
    """
    # 모든 타자의 이름 → 참조 매핑
    all_players = {}
    for team in teams_data:
        for player in team["players"]:
            name = player["name"]
            if name:
                # 초기화
                player["homeRuns"] = 0
                player["doubles"] = 0
                player["triples"] = 0
                player["stolenBases"] = 0
                player["stolenBaseFails"] = 0
                player["walks"] = 0
                player["walkOff"] = False
                all_players[name] = player

    for event in events:
        event_type = event["type"]
        event_detail = event["detail"]
        names = extract_names_from_event(event_detail)

        for name in names:
            if name not in all_players:
                continue
            p = all_players[name]

            if event_type in ("홈런", "HR"):
                # "김도영(15호 2점 이정후)" → 홈런 횟수는 이름 등장 횟수
                hr_count = len(re.findall(re.escape(name), event_detail))
                p["homeRuns"] += max(hr_count, 1)

            elif event_type in ("2루타", "二塁打"):
                p["doubles"] += 1

            elif event_type in ("3루타", "三塁打"):
                p["triples"] += 1

            elif event_type in ("도루", "盗塁"):
                p["stolenBases"] += 1

            elif event_type in ("도루실패", "도루자"):
                p["stolenBaseFails"] += 1

            elif event_type in ("볼넷", "사구", "四球"):
                p["walks"] += 1

            elif event_type in ("끝내기", "끝내기안타", "끝내기홈런"):
                p["walkOff"] = True

    # 안타에서 장타 분리 → 단타 계산은 서버에서 처리
    # (hits - doubles - triples - homeRuns = singles)
    return teams_data


def parse_hitters(box_data):
    """타자 기록 파싱"""
    arr_hitter = box_data.get("arrHitter", [])
    all_teams = []

    for team_idx, team_data in enumerate(arr_hitter):
        team_label = "원정" if team_idx == 0 else "홈"
        table1 = parse_table(team_data.get("table1", ""))
        table2 = parse_table(team_data.get("table2", ""))
        table3 = parse_table(team_data.get("table3", ""))

        players = []
        for i in range(len(table1)):
            if i >= len(table3):
                break
            row1 = table1[i]
            row3 = table3[i]

            order = ""
            position = ""
            name = ""
            if len(row1) >= 3:
                order = row1[0]
                position = row1[1]
                name = row1[2]
            elif len(row1) >= 2:
                position = row1[0]
                name = row1[1]

            at_bats = row3[0] if len(row3) > 0 else "0"
            hits = row3[1] if len(row3) > 1 else "0"
            rbi = row3[2] if len(row3) > 2 else "0"
            runs = row3[3] if len(row3) > 3 else "0"
            avg = row3[4] if len(row3) > 4 else ".000"

            innings = []
            if i < len(table2):
                innings = table2[i]

            players.append({
                "order": order,
                "position": position,
                "name": name,
                "atBats": at_bats,
                "hits": hits,
                "rbi": rbi,
                "runs": runs,
                "avg": avg,
                "innings": innings,
                # 이벤트에서 채워질 필드 (기본값)
                "homeRuns": 0,
                "doubles": 0,
                "triples": 0,
                "stolenBases": 0,
                "stolenBaseFails": 0,
                "walks": 0,
                "walkOff": False,
            })

        all_teams.append({"label": team_label, "players": players})
    return all_teams


def save_csv(date_str, all_records):
    """CSV 저장"""
    os.makedirs("output", exist_ok=True)
    filepath = f"output/{date_str}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "date", "gameId", "team", "order", "position", "name",
            "atBats", "hits", "rbi", "runs", "avg",
            "homeRuns", "doubles", "triples", "stolenBases", "stolenBaseFails",
            "walks", "walkOff"
        ])
        for record in all_records:
            writer.writerow([
                record["date"], record["gameId"], record["team"],
                record["order"], record["position"], record["name"],
                record["atBats"], record["hits"], record["rbi"],
                record["runs"], record["avg"],
                record.get("homeRuns", 0), record.get("doubles", 0),
                record.get("triples", 0), record.get("stolenBases", 0),
                record.get("stolenBaseFails", 0), record.get("walks", 0),
                record.get("walkOff", False),
            ])
    print(f"  ✅ CSV 저장: {filepath}")


def send_to_server(game_data):
    """서버에 경기 데이터 전송 + finished면 정산 호출"""
    try:
        res = requests.post(
            f"{API_URL}/api/internal/games",
            json=game_data,
            headers={"Content-Type": "application/json", "x-api-key": INTERNAL_API_KEY},
            timeout=60
        )
        if res.status_code in [200, 201]:
            print(f"  ✅ 서버 전송 완료")
        else:
            print(f"  ⚠️ 서버 응답: {res.status_code} {res.text[:200]}")
            return

        game_id = game_data.get("gameId", "")
        if game_data.get("status") == "finished" and game_id:
            try:
                settle_res = requests.post(
                    f"{API_URL}/api/internal/games/{game_id}/settle",
                    headers={"Content-Type": "application/json", "x-api-key": INTERNAL_API_KEY},
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


def collect_date(date_str):
    """특정 날짜 경기 수집"""
    season_id = date_str[:4]
    formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    print(f"\n📅 {formatted} 경기 수집 시작\n")

    wake_up_server()

    games = get_schedule(date_str)
    if not games:
        print("  경기가 없습니다.")
        return

    all_records = []

    for game in games:
        game_id = game.get("G_ID", "")
        away_team = game.get("AWAY_NM", "")
        home_team = game.get("HOME_NM", "")
        score_a = game.get("T_SCORE_CN", "")
        score_h = game.get("B_SCORE_CN", "")
        status = str(game.get("GAME_STATE_SC", ""))
        sr_id = str(game.get("SR_ID", "0"))

        print(f"⚾ {away_team} {score_a} vs {score_h} {home_team} (ID: {game_id}, 상태: {status})")

        # 경기 예정
        if status == "1":
            start_time = game.get("G_TM", "")
            send_to_server({
                "gameId": game_id,
                "date": formatted,
                "homeTeam": home_team,
                "awayTeam": away_team,
                "status": "scheduled",
                "startTime": start_time,
                "homeScore": 0,
                "awayScore": 0,
            })
            print(f"  📋 경기 예정 ({start_time}) → scheduled로 저장")
            continue

        # 우천취소 / 경기취소
        if status in ("4", "5"):
            send_to_server({
                "gameId": game_id,
                "date": formatted,
                "homeTeam": home_team,
                "awayTeam": away_team,
                "status": "cancelled",
                "homeScore": 0,
                "awayScore": 0,
            })
            print(f"  🌧️ 경기 취소 → cancelled로 저장")
            continue

        # 알 수 없는 상태
        if status not in ("2", "3"):
            print(f"  ⏭️ 알 수 없는 상태 (상태: {status}), 건너뜀")
            continue

        # 진행 중 또는 종료 → 박스스코어 수집
        box = get_boxscore(game_id, season_id, sr_id)
        if not box:
            continue

        # 타자 파싱 + 이벤트 파싱
        teams = parse_hitters(box)
        events = parse_events(box)

        # 이벤트로 타자 상세 기록 보강
        teams = enrich_batters_with_events(teams, events)

        for team in teams:
            team_name = away_team if team["label"] == "원정" else home_team
            print(f"\n  [{team_name} 타자]")
            for p in team["players"]:
                if p["order"]:
                    extras = []
                    if p["homeRuns"] > 0:
                        extras.append(f"{p['homeRuns']}홈런")
                    if p["doubles"] > 0:
                        extras.append(f"{p['doubles']}2루타")
                    if p["triples"] > 0:
                        extras.append(f"{p['triples']}3루타")
                    if p["stolenBases"] > 0:
                        extras.append(f"{p['stolenBases']}도루")
                    extra_str = f" [{', '.join(extras)}]" if extras else ""

                    print(f"    {p['order']} {p['name']}: {p['atBats']}타수 {p['hits']}안타 {p['rbi']}타점 {p['runs']}득점{extra_str}")

                all_records.append({
                    "date": formatted,
                    "gameId": game_id,
                    "team": team_name,
                    "order": p["order"],
                    "position": p["position"],
                    "name": p["name"],
                    "atBats": p["atBats"],
                    "hits": p["hits"],
                    "rbi": p["rbi"],
                    "runs": p["runs"],
                    "avg": p["avg"],
                    "homeRuns": p["homeRuns"],
                    "doubles": p["doubles"],
                    "triples": p["triples"],
                    "stolenBases": p["stolenBases"],
                    "stolenBaseFails": p["stolenBaseFails"],
                    "walks": p["walks"],
                    "walkOff": p["walkOff"],
                })

        # 서버 전송
        if INTERNAL_API_KEY:
            away_batters = []
            home_batters = []
            for team in teams:
                for p in team["players"]:
                    batter = {
                        "order": p["order"],
                        "position": p["position"],
                        "name": p["name"],
                        "atBats": p["atBats"],
                        "hits": p["hits"],
                        "rbi": p["rbi"],
                        "runs": p["runs"],
                        "avg": p["avg"],
                        "homeRuns": p["homeRuns"],
                        "doubles": p["doubles"],
                        "triples": p["triples"],
                        "stolenBases": p["stolenBases"],
                        "stolenBaseFails": p["stolenBaseFails"],
                        "walks": p["walks"],
                        "walkOff": p["walkOff"],
                    }
                    if team["label"] == "원정":
                        away_batters.append(batter)
                    else:
                        home_batters.append(batter)

            game_status = "finished" if status == "3" else "in_progress"
            send_to_server({
                "gameId": game_id,
                "date": formatted,
                "homeTeam": home_team,
                "awayTeam": away_team,
                "homeScore": int(score_h) if score_h else 0,
                "awayScore": int(score_a) if score_a else 0,
                "status": game_status,
                "batterRecords": {"away": away_batters, "home": home_batters},
                "events": events,
            })
        else:
            print(f"\n  ⚠️ INTERNAL_API_KEY 없음, 서버 전송 건너뜀")

        print("")

    if all_records:
        save_csv(date_str, all_records)

    print(f"\n=== 수집 완료 ===")


def main():
    if len(sys.argv) > 1:
        date_str = sys.argv[1].replace("-", "")
    else:
        yesterday = datetime.now(KST) - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")
    collect_date(date_str)


if __name__ == "__main__":
    main()
