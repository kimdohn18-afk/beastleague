import requests
import json
import csv
import os
import sys
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

# ============ KBO API 호출 ============

def get_schedule(date_str):
    """날짜별 경기 일정 조회 (YYYYMMDD)"""
    url = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"
    payload = {"leId": "1", "srId": "0", "date": date_str}
    try:
        res = requests.post(url, data=payload, timeout=15)
        data = res.json()
        if int(data.get("code", 0)) != 100:
            return []
        return data.get("game", [])
    except Exception as e:
        print(f"  일정 조회 실패: {e}")
        return []


def get_boxscore(game_id, season_id, sr_id="0"):
    """경기별 박스스코어 조회"""
    url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetBoxScoreScroll"
    payload = {"leId": "1", "srId": sr_id, "seasonId": season_id, "gameId": game_id}
    try:
        res = requests.post(url, data=payload, timeout=15)
        return res.json()
    except Exception as e:
        print(f"  박스스코어 조회 실패 ({game_id}): {e}")
        return None


def get_scoreboard(game_id, season_id, sr_id="0"):
    """경기별 스코어보드 조회"""
    url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScoreBoardScroll"
    payload = {"leId": "1", "srId": sr_id, "seasonId": season_id, "gameId": game_id}
    try:
        res = requests.post(url, data=payload, timeout=15)
        return res.json()
    except Exception as e:
        print(f"  스코어보드 조회 실패 ({game_id}): {e}")
        return None


# ============ 데이터 파싱 ============

def parse_hitters(boxscore, game_id, date_str, team_label, team_index):
    """박스스코어에서 타자 기록 파싱"""
    records = []
    arr = boxscore.get("arrHitter", [])
    if team_index >= len(arr):
        return records

    team_data = arr[team_index]
    tables = {}
    for tname in ["table1", "table2", "table3"]:
        raw = team_data.get(tname, "{}")
        if isinstance(raw, str):
            tables[tname] = json.loads(raw)
        else:
            tables[tname] = raw

    rows1 = tables["table1"].get("rows", [])
    rows2 = tables["table2"].get("rows", [])
    rows3 = tables["table3"].get("rows", [])
    count = min(len(rows1), len(rows2), len(rows3))

    for i in range(count):
        cells1 = rows1[i].get("row", [])
        cells2 = rows2[i].get("row", [])
        cells3 = rows3[i].get("row", [])

        order = cells1[0].get("Text", "").strip() if len(cells1) > 0 else ""
        pos = cells1[1].get("Text", "").strip() if len(cells1) > 1 else ""
        name = cells1[2].get("Text", "").strip() if len(cells1) > 2 else ""

        # TOTAL 행 스킵
        if order == "" and name == "":
            continue

        ab = cells3[0].get("Text", "0").strip() if len(cells3) > 0 else "0"
        h = cells3[1].get("Text", "0").strip() if len(cells3) > 1 else "0"
        rbi = cells3[2].get("Text", "0").strip() if len(cells3) > 2 else "0"
        r = cells3[3].get("Text", "0").strip() if len(cells3) > 3 else "0"
        avg = cells3[4].get("Text", "0").strip() if len(cells3) > 4 else "0"

        # 이닝별 기록
        innings = []
        for cell in cells2:
            text = cell.get("Text", "").replace("&nbsp;", "").strip()
            if text:
                innings.append(text)
        innings_str = " ".join(innings)

        # 이벤트 카운트
        hr = sum(1 for cell in cells2 if "홈" in cell.get("Text", ""))
        doubles = sum(1 for cell in cells2 if "2" in cell.get("Text", "") and ("안" in cell.get("Text", "") or cell.get("Text", "").strip() in ["좌2", "중2", "우2"]))
        sb = sum(1 for cell in cells2 if "도루" in cell.get("Text", ""))
        bb = sum(1 for cell in cells2 if cell.get("Text", "").strip() in ["4구", "사구"])
        so = sum(1 for cell in cells2 if "삼진" in cell.get("Text", ""))

        records.append({
            "date": date_str,
            "gameId": game_id,
            "team": team_label,
            "order": order,
            "position": pos,
            "name": name,
            "atBats": int(ab) if ab.isdigit() else 0,
            "hits": int(h) if h.isdigit() else 0,
            "rbi": int(rbi) if rbi.isdigit() else 0,
            "runs": int(r) if r.isdigit() else 0,
            "avg": avg,
            "homeRuns": hr,
            "doubles": doubles,
            "stolenBases": sb,
            "walks": bb,
            "strikeouts": so,
            "innings": innings_str,
        })

    return records


def parse_events(boxscore):
    """경기 이벤트 (홈런, 2루타, 도루 등) 파싱"""
    events = {}
    raw = boxscore.get("tableEtc", "{}")
    if isinstance(raw, str):
        table = json.loads(raw)
    else:
        table = raw

    for row in table.get("rows", []):
        cells = row.get("row", [])
        if len(cells) >= 2:
            key = cells[0].get("Text", "").strip()
            val = cells[1].get("Text", "").strip()
            if key:
                events[key] = val
    return events


# ============ CSV 저장 ============

def save_csv(records, filename):
    """타자 기록을 CSV로 저장"""
    if not records:
        print("  저장할 데이터 없음")
        return

    os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else ".", exist_ok=True)
    fields = ["date", "gameId", "team", "order", "position", "name",
              "atBats", "hits", "rbi", "runs", "avg",
              "homeRuns", "doubles", "stolenBases", "walks", "strikeouts", "innings"]

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)

    print(f"  CSV 저장: {filename} ({len(records)}행)")


# ============ 서버 전송 ============

def send_to_server(game_data, api_url, api_key):
    """서버 API로 경기 데이터 전송"""
    try:
        res = requests.post(
            f"{api_url}/api/internal/games",
            json=game_data,
            headers={"Content-Type": "application/json", "x-api-key": api_key},
            timeout=30,
        )
        if res.status_code == 200 or res.status_code == 201:
            print(f"  서버 전송 완료")
        else:
            print(f"  서버 전송 실패: {res.status_code} {res.text[:200]}")
    except Exception as e:
        print(f"  서버 전송 에러: {e}")


# ============ 메인 ============

def collect_date(date_str):
    """특정 날짜의 전체 경기 수집"""
    print(f"\n{'='*60}")
    print(f"  {date_str} 경기 수집")
    print(f"{'='*60}")

    # 1. 일정 조회
    games = get_schedule(date_str)
    if not games:
        print("  경기 없음")
        return []

    finished = [g for g in games if g.get("CANCEL_SC_NM", "") == "" and g.get("G_ID", "")]
    print(f"  {len(games)}경기 발견, {len(finished)}경기 처리")

    all_records = []
    api_url = os.environ.get("API_URL", "https://beastleague.onrender.com")
    api_key = os.environ.get("INTERNAL_API_KEY", "")

    for game in finished:
        game_id = game.get("G_ID", "")
        away = game.get("AWAY_NM", "")
        home = game.get("HOME_NM", "")
        season = game.get("SEASON_ID", date_str[:4])
        sr_id = game.get("SR_ID", "0")

        print(f"\n  ⚾ {away} vs {home} ({game_id})")

        # 2. 스코어보드
        sb = get_scoreboard(game_id, season, sr_id)
        away_score = 0
        home_score = 0
        if sb:
            try:
                t3 = json.loads(sb.get("table3", "{}"))
                rows = t3.get("rows", [])
                if len(rows) >= 2:
                    away_score = int(rows[0]["row"][0]["Text"])
                    home_score = int(rows[1]["row"][0]["Text"])
            except:
                pass
        print(f"    스코어: {away} {away_score} - {home_score} {home}")

        # 3. 박스스코어
        bs = get_boxscore(game_id, season, sr_id)
        if not bs:
            continue

        date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        away_batters = parse_hitters(bs, game_id, date_formatted, away, 0)
        home_batters = parse_hitters(bs, game_id, date_formatted, home, 1)
        events = parse_events(bs)

        # 출력
        print(f"\n    [{away} 타자]")
        for b in away_batters:
            print(f"    {b['order']}번 {b['position']} {b['name']}: {b['atBats']}타수 {b['hits']}안타 {b['rbi']}타점 {b['runs']}득점 [{b['innings']}]")
        print(f"\n    [{home} 타자]")
        for b in home_batters:
            print(f"    {b['order']}번 {b['position']} {b['name']}: {b['atBats']}타수 {b['hits']}안타 {b['rbi']}타점 {b['runs']}득점 [{b['innings']}]")

        if events:
            print(f"\n    [이벤트]")
            for k, v in events.items():
                if v:
                    print(f"    {k}: {v}")

        all_records.extend(away_batters)
        all_records.extend(home_batters)

        # 4. 서버 전송
        if api_key:
            game_data = {
                "gameId": game_id,
                "date": date_formatted,
                "homeTeam": home,
                "awayTeam": away,
                "homeScore": home_score,
                "awayScore": away_score,
                "status": "finished",
                "events": events,
                "batterRecords": {
                    "away": away_batters,
                    "home": home_batters,
                },
            }
            send_to_server(game_data, api_url, api_key)

    return all_records


def main():
    if len(sys.argv) > 1:
        date_str = sys.argv[1].replace("-", "")
    else:
        date_str = datetime.now(KST).strftime("%Y%m%d")

    records = collect_date(date_str)

    if records:
        date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        save_csv(records, f"output/{date_formatted}.csv")

    print(f"\n수집 완료: {len(records)}명 기록")


if __name__ == "__main__":
    main()
