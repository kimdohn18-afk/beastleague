"""
KBO 경기 데이터 수집기 (Python) v3
"""
import requests
import json
import sys
import os
import logging
from logging.handlers import TimedRotatingFileHandler
import csv
from datetime import datetime, timezone, timedelta
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 로그 설정
os.makedirs("logs", exist_ok=True)
logger = logging.getLogger("KBOCollector")
logger.setLevel(logging.INFO)

formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

# 파일 핸들러 (매일 자정 로테이션, 7일 보관)
file_handler = TimedRotatingFileHandler(
    filename="logs/collector.log",
    when="midnight",
    interval=1,
    backupCount=7,
    encoding="utf-8"
)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# 콘솔 핸들러 (터미널에 출력)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)


KST = timezone(timedelta(hours=9))
BASE_URL = "https://www.koreabaseball.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.koreabaseball.com/Schedule/ScoreBoard.aspx"
}

def create_session():
    """재시도 로직이 포함된 HTTP 세션 생성"""
    session = requests.Session()
    retry_strategy = Retry(
        total=5,  # 최대 5번 재시도
        backoff_factor=1,  # 대기 시간: 1s, 2s, 4s, 8s, 16s
        status_forcelist=[429, 500, 502, 503, 504],  # 재시도할 HTTP 상태 코드
        allowed_methods=["POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(HEADERS)
    return session

http_session = create_session()


def get_schedule(date_str):
    url = f"{BASE_URL}/ws/Main.asmx/GetKboGameList"
    payload = {"leId": "1", "srId": "0,9,6", "date": date_str}
    try:
        res = http_session.post(url, data=payload, timeout=15)
        data = res.json()
        if str(data.get("code")) != "100":
            logger.warning(f"일정 API 응답 코드 이상: {data.get('code')}")
            return []
        game_list = data.get("game", [])
        if isinstance(game_list, str):
            game_list = json.loads(game_list)
        logger.info(f"경기 일정 조회 성공 (경기 수: {len(game_list)})")
        return game_list
    except requests.exceptions.RequestException as e:
        logger.error(f"일정 조회 중 네트워크 오류 발생: {e}")
        return []


def get_boxscore(game_id, season_id, sr_id="0"):
    url = f"{BASE_URL}/ws/Schedule.asmx/GetBoxScoreScroll"
    payload = {"leId": "1", "srId": sr_id, "seasonId": season_id, "gameId": game_id}
    try:
        res = http_session.post(url, data=payload, timeout=15)
        return res.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"박스스코어 조회 실패 (GameID: {game_id}): {e}")
        return None


def parse_table(table_data):
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


def parse_hitters(box_data):
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
                "innings": innings
            })

        all_teams.append({"label": team_label, "players": players})
    return all_teams


def mask_name(name):
    """데이터 정책 준수: 선수 이름 익명화"""
    if not name or len(name) < 2:
        return name
    return name[0] + "*" + (name[2:] if len(name) > 2 else "")


def parse_events(box_data):
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


def save_csv(date_str, all_records):
    os.makedirs("output", exist_ok=True)
    filepath = f"output/{date_str}.csv"
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "gameId", "team", "order", "position", "name",
                         "atBats", "hits", "rbi", "runs", "avg"])
        for record in all_records:
            writer.writerow([
                record["date"], record["gameId"], record["team"],
                record["order"], record["position"], record["name"],
                record["atBats"], record["hits"], record["rbi"],
                record["runs"], record["avg"]
            ])
    logger.info(f"CSV 백업 저장 완료: {filepath}")


def send_to_server(game_data, api_url, api_key):
    """서버로 전송 + 정산 호출"""
    try:
        res = http_session.post(
            f"{api_url}/api/internal/games",
            json=game_data,
            headers={"x-api-key": api_key},
            timeout=30
        )
        if res.status_code in [200, 201]:
            logger.info(f"서버 데이터 전송 성공 (GameID: {game_data.get('gameId')})")
        else:
            logger.warning(f"서버 전송 실패 응답: {res.status_code} - {res.text[:100]}")
            return False

        game_id = game_data.get("gameId", "")
        if game_data.get("status") == "finished" and game_id:
            try:
                settle_res = http_session.post(
                    f"{api_url}/api/internal/games/{game_id}/settle",
                    headers={"x-api-key": api_key},
                    timeout=30
                )
                if settle_res.status_code in [200, 201]:
                    result = settle_res.json()
                    logger.info(f"정산 호출 성공: {result.get('settledPlacements', 0)}건 처리 완료")
                else:
                    logger.warning(f"정산 호출 응답 이상: {settle_res.status_code}")
            except requests.exceptions.RequestException as e:
                logger.error(f"정산 API 호출 중 오류: {e}")

    except requests.exceptions.RequestException as e:
        logger.error(f"서버 API 통신 실패: {e}")


def collect_date(date_str):
    season_id = date_str[:4]
    logger.info(f"=== {date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} 수집 작업 시작 ===")

    games = get_schedule(date_str)
    if not games:
        logger.info("해당 날짜에 예정된 경기가 없습니다.")
        return

    all_records = []
    api_url = os.environ.get("API_URL", "https://beastleague.onrender.com")
    api_key = os.environ.get("INTERNAL_API_KEY", "")

    for game in games:
        game_id = game.get("G_ID", "")
        away_team = game.get("AWAY_NM", "")
        home_team = game.get("HOME_NM", "")
        score_a = game.get("T_SCORE_CN", "")
        score_h = game.get("B_SCORE_CN", "")
        status = str(game.get("GAME_STATE_SC", ""))
        sr_id = str(game.get("SR_ID", "0"))

        logger.info(f"경기 처리 중: {away_team} vs {home_team} (ID: {game_id}, 상태: {status})")

        if status == "1":
            game_data = {
                "gameId": game_id,
                "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                "homeTeam": home_team,
                "awayTeam": away_team,
                "status": "scheduled",
                "homeScore": 0,
                "awayScore": 0,
            }
            send_to_server(game_data, api_url, api_key)
            logger.info(f"  -> 경기 예정 상태로 서버 전송")
            continue

        if status not in ("2", "3"):
            logger.info(f"  -> 알 수 없는 상태({status}), 건너뜀")
            continue

        box = get_boxscore(game_id, season_id, sr_id)
        if not box:
            continue

        teams = parse_hitters(box)
        events = parse_events(box)

        for team in teams:
            team_name = away_team if team["label"] == "원정" else home_team
            for p in team["players"]:
                masked_name = mask_name(p["name"])
                all_records.append({
                    "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                    "gameId": game_id,
                    "team": team_name,
                    "order": p["order"],
                    "position": p["position"],
                    "name": masked_name,
                    "atBats": p["atBats"],
                    "hits": p["hits"],
                    "rbi": p["rbi"],
                    "runs": p["runs"],
                    "avg": p["avg"]
                })
            logger.info(f"  -> {team_name} 타자 데이터 파싱 완료")

        if events:
            logger.info(f"  -> 주요 이벤트 {len(events)}건 추출 완료")

        if api_key:
            away_batters = []
            home_batters = []
            for team in teams:
                for p in team["players"]:
                    masked_name = mask_name(p["name"])
                    batter = {
                        "order": p["order"],
                        "position": p["position"],
                        "name": masked_name,
                        "atBats": p["atBats"],
                        "hits": p["hits"],
                        "rbi": p["rbi"],
                        "runs": p["runs"],
                        "avg": p["avg"]
                    }
                    if team["label"] == "원정":
                        away_batters.append(batter)
                    else:
                        home_batters.append(batter)
            send_to_server({
                "gameId": game_id,
                "date": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
                "homeTeam": home_team,
                "awayTeam": away_team,
                "homeScore": int(score_h) if score_h else 0,
                "awayScore": int(score_a) if score_a else 0,
                "status": "finished",
                "batterRecords": {"away": away_batters, "home": home_batters},
                "events": events
            }, api_url, api_key)
        else:
            logger.warning("INTERNAL_API_KEY가 설정되지 않아 서버로 전송하지 않습니다.")

    if all_records:
        save_csv(date_str, all_records)

    logger.info(f"=== {date_str} 수집 작업 완료 ===")


def main():
    if len(sys.argv) > 1:
        date_str = sys.argv[1].replace("-", "")
    else:
        yesterday = datetime.now(KST) - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")
    collect_date(date_str)


if __name__ == "__main__":
    main()
