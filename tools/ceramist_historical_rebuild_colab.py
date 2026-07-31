# Ceramist historical seed builder for Google Colab
# Builder version: ceramist-colab-builder-v1.0.1
# Seed contract: ceramist-colab-seed-v1.0.0
# Last confirmed: 2026-07-31
#
# Purpose:
#   Build the complete historical Ceramist attribution sidecar once, outside
#   Apps Script execution limits. Normal maintenance is then performed by the
#   open-month incremental Apps Script updater.
#
# Safety:
#   - Credentials are requested with getpass and are never written to Drive.
#   - The existing Ceramist cache is copied to a timestamped backup before write.
#   - No Drive file is changed unless the final confirmation is exactly WRITE.
#   - The verified regression 389666 -> 385918 -> Jhan/Hoseung Han must pass.

# In Colab, paste this entire file into one cell or upload it and run:
#   %run /content/ceramist_historical_rebuild_colab_v1.0.1.py

from __future__ import annotations

import getpass
import io
import json
import re
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests
from google.api_core.exceptions import GoogleAPIError
from google.cloud import bigquery
from google.colab import auth
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

SEED_VERSION = "ceramist-colab-seed-v1.0.0"
BUILDER_VERSION = "ceramist-colab-builder-v1.0.1"
CACHE_VERSION = "CeramistRemakeCache v0.6.0"
RESPONSIBILITY_VERSION = "case-level-v7.8.0"
MAINTENANCE_MODEL = "historical-seed-plus-open-month-upsert-v7.8.0"
CHAIN_INDEX_VERSION = "crm-remakeCaseID-seed-plus-incremental-v7.8.0"
MAX_CHAIN_DEPTH = 8
TASK_CODE = "CERAMICS"

PROJECT_ID = "customerprofiles"
DATASET_ID = "retention_data"
TASK_TABLE = "tasks_all"
TASK_BADGE_SPREADSHEET_ID = "1XrJctG1-0RGhKCV6w2jK4esoaahmc7Ji7MjQhZo-nBY"
TASK_BADGE_RANGE = "'Task User Badges'!A2:D"
LEGACY_TECH_RANGE = "'Tech Numbers'!A2:C"
CRM_BASE_URL = "https://crm.caldentalarts.com"

# Paste the non-secret IDs returned by getCeramistSeedConfigurationV780().
# Leaving them blank will prompt you.
REMAKE_CACHE_INDEX_FILE_ID = ""
CERAMIST_CACHE_FILE_ID = ""

REQUEST_TIMEOUT_SECONDS = 60
REQUEST_DELAY_SECONDS = 0.08
MAX_HTTP_RETRIES = 7
MAX_CHAIN_ERRORS_BEFORE_ABORT = 5
BQ_CASE_BATCH_SIZE = 5000


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def unique_strings(values: Iterable[Any]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values:
        item = clean(value)
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def case_number(row: Dict[str, Any]) -> str:
    for key in ("currentCaseNumber", "remakeCaseNumber", "caseNumber", "caseNo", "Cases_CaseNumber"):
        try:
            value = int(float(row.get(key) or 0))
        except (TypeError, ValueError):
            value = 0
        if value > 0:
            return str(value)
    return ""


def case_id(row: Dict[str, Any]) -> str:
    for key in ("caseId", "caseID", "currentCaseId", "currentCaseID", "id"):
        value = clean(row.get(key))
        if value:
            return value
    return ""


def remake_case_id(row: Dict[str, Any]) -> str:
    for key in ("remakeCaseId", "remakeCaseID", "RemakeCaseID"):
        value = clean(row.get(key))
        if value:
            return value
    return ""


def row_month(row: Dict[str, Any]) -> str:
    value = clean(row.get("month") or row.get("invoiceDate") or row.get("Cases_InvoiceDate"))
    match = re.match(r"^(\d{4})-(\d{2})", value)
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def is_remake(row: Dict[str, Any]) -> bool:
    if row.get("isRemake") is True:
        return True
    value = clean(row.get("remakeFlag") or row.get("remake") or row.get("remakeValue")).lower()
    return value in {"y", "yes", "true", "1", "r", "remake"}


def product_id(row: Dict[str, Any]) -> str:
    for key in (
        "currentProductId", "currentProductID", "remakeProductId", "remakeProductID",
        "productId", "productID", "CaseProducts_ProductID", "productKey", "productName",
    ):
        value = clean(row.get(key))
        if value:
            return value
    return ""


def line_id(row: Dict[str, Any]) -> str:
    for key in (
        "caseProductLineId", "currentCaseProductLineId", "currentCaseProductLineID",
        "caseProductId", "currentCaseProductId", "currentCaseProductID",
        "productLineId", "lineId", "lineID",
    ):
        value = clean(row.get(key))
        if value:
            return value
    return ""


def download_drive_bytes(drive: Any, file_id: str) -> bytes:
    request = drive.files().get_media(fileId=file_id)
    stream = io.BytesIO()
    downloader = MediaIoBaseDownload(stream, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return stream.getvalue()


def download_drive_json(drive: Any, file_id: str) -> Dict[str, Any]:
    raw = download_drive_bytes(drive, file_id)
    return json.loads(raw.decode("utf-8"))


def search_drive_file(drive: Any, name: str) -> List[Dict[str, Any]]:
    escaped = name.replace("'", "\\'")
    response = drive.files().list(
        q=f"name = '{escaped}' and trashed = false",
        fields="files(id,name,modifiedTime,size,webViewLink)",
        orderBy="modifiedTime desc",
        pageSize=100,
    ).execute()
    return response.get("files", [])


def choose_file_id(drive: Any, supplied: str, exact_name: str, label: str, allow_create: bool = False) -> str:
    supplied = clean(supplied)
    if supplied:
        return supplied
    matches = search_drive_file(drive, exact_name)
    if len(matches) == 1:
        print(f"Using {label}: {matches[0]['id']} ({matches[0].get('modifiedTime', '')})")
        return matches[0]["id"]
    if matches:
        print(f"Multiple {label} candidates were found:")
        for index, item in enumerate(matches, start=1):
            print(index, item["id"], item.get("modifiedTime", ""), item.get("size", ""))
    prompt = f"Paste the {label} Drive file ID"
    if allow_create:
        prompt += " (blank creates a new file)"
    value = input(prompt + ": ").strip()
    if not value and not allow_create:
        raise RuntimeError(f"{label} file ID is required.")
    return value


def authenticate_crm(base_url: str, user_id: str, password: str) -> Tuple[requests.Session, str]:
    session = requests.Session()
    response = session.post(
        base_url.rstrip("/") + "/api/Authentication/authenticate",
        json={"userID": user_id, "password": password},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    body = response.json()
    candidates = [
        body.get("token") if isinstance(body, dict) else None,
        body.get("accessToken") if isinstance(body, dict) else None,
        body.get("access_token") if isinstance(body, dict) else None,
        body.get("bearerToken") if isinstance(body, dict) else None,
        body.get("data", {}).get("token") if isinstance(body, dict) and isinstance(body.get("data"), dict) else None,
    ]
    token = next((clean(item) for item in candidates if clean(item)), "")
    if not token and isinstance(body, str):
        token = body.strip().strip('"')
    if not token:
        raise RuntimeError("MagicTouch authentication returned no bearer token.")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session, token


def crm_get_json(session: requests.Session, url: str) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in range(MAX_HTTP_RETRIES):
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            if response.status_code in {429, 500, 502, 503, 504}:
                delay = min(30.0, 1.5 ** attempt)
                time.sleep(delay)
                continue
            response.raise_for_status()
            time.sleep(REQUEST_DELAY_SECONDS)
            body = response.json()
            return body if isinstance(body, dict) else {}
        except (requests.RequestException, ValueError) as error:
            last_error = error
            time.sleep(min(30.0, 1.5 ** attempt))
    raise RuntimeError(f"CRM request failed after retries: {url}: {last_error}")


def has_remake_case_field(detail: Dict[str, Any]) -> bool:
    return any(re.fullmatch(r"remakeCaseID", key, flags=re.IGNORECASE) for key in detail.keys())


def extract_note_text_and_tech_numbers(detail: Dict[str, Any]) -> Tuple[str, List[str]]:
    notes = detail.get("notes") if isinstance(detail.get("notes"), list) else []
    accepted: List[str] = []
    tech_numbers: List[str] = []
    patterns = [
        re.compile(r"\btech(?:nician)?(?:\s*(?:number|no\.?|#))?\s*[:\-]?\s*(\d{1,6})\b", re.IGNORECASE),
        re.compile(r"\bcompleted\s+by\s+(?:tech(?:nician)?\s*)?#?\s*(\d{1,6})\b", re.IGNORECASE),
    ]
    for note in notes:
        value = note if isinstance(note, dict) else {"text": note}
        label = " | ".join(clean(value.get(key)) for key in ("type", "noteType", "subject", "title", "category") if clean(value.get(key)))
        text = " ".join(clean(value.get(key)) for key in ("note", "notes", "text", "body", "description", "message", "comments") if clean(value.get(key)))
        combined = (label + " | " if label else "") + text
        if not combined or not re.search(r"invoice|complete|completed|tech", combined, flags=re.IGNORECASE):
            continue
        found: List[str] = []
        for pattern in patterns:
            found.extend(pattern.findall(combined))
        if found:
            accepted.append(combined)
            tech_numbers.extend(found)
    return "\n".join(accepted)[:4000], unique_strings(tech_numbers)


@dataclass
class ChainRecord:
    case_id: str
    case_number: str = ""
    remake_case_id: str = ""
    terminal_confirmed: bool = False
    checked_at: str = ""
    invoice_note: str = ""
    invoice_note_tech_numbers: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "caseId": self.case_id,
            "caseNumber": self.case_number,
            "remakeCaseId": self.remake_case_id,
            "terminalConfirmed": self.terminal_confirmed,
            "checkedAt": self.checked_at,
            "invoiceNote": self.invoice_note,
            "invoiceNoteTechNumbers": self.invoice_note_tech_numbers or [],
        }


def merge_chain_record(index: Dict[str, Dict[str, Any]], record: ChainRecord) -> Dict[str, Any]:
    key = record.case_id.lower()
    current = dict(index.get(key) or {})
    incoming = record.to_dict()
    next_id = clean(incoming.get("remakeCaseId")) or clean(current.get("remakeCaseId"))
    terminal = not next_id and (bool(incoming.get("terminalConfirmed")) or bool(current.get("terminalConfirmed")))
    merged = {
        **current,
        **incoming,
        "caseId": record.case_id,
        "caseNumber": clean(incoming.get("caseNumber")) or clean(current.get("caseNumber")),
        "remakeCaseId": next_id,
        "terminalConfirmed": terminal,
        "checkedAt": clean(incoming.get("checkedAt")) or clean(current.get("checkedAt")),
        "invoiceNote": clean(incoming.get("invoiceNote")) or clean(current.get("invoiceNote")),
        "invoiceNoteTechNumbers": unique_strings((incoming.get("invoiceNoteTechNumbers") or []) + (current.get("invoiceNoteTechNumbers") or [])),
    }
    index[key] = merged
    return merged


def record_from_detail(
    detail: Dict[str, Any],
    requested_id: str,
    allow_missing_remake_field_as_terminal: bool = False,
) -> ChainRecord:
    note, numbers = extract_note_text_and_tech_numbers(detail)
    next_id = clean(detail.get("remakeCaseID") or detail.get("remakeCaseId") or detail.get("RemakeCaseID"))
    field_present = has_remake_case_field(detail)
    terminal_confirmed = not next_id and (
        field_present or allow_missing_remake_field_as_terminal
    )
    return ChainRecord(
        case_id=requested_id,
        case_number=clean(detail.get("caseNumber") or detail.get("caseNo")),
        remake_case_id=next_id,
        terminal_confirmed=terminal_confirmed,
        checked_at=utc_now(),
        invoice_note=note,
        invoice_note_tech_numbers=numbers,
    )


def fetch_chain_record(
    session: requests.Session,
    base_url: str,
    requested_id: str,
    chain_index: Dict[str, Dict[str, Any]],
    force: bool = False,
    allow_missing_remake_field_as_terminal: bool = False,
) -> Dict[str, Any]:
    key = requested_id.lower()
    existing = chain_index.get(key) or {}
    if not force and existing.get("caseNumber") and (
        existing.get("remakeCaseId") or existing.get("terminalConfirmed") is True
    ):
        return existing

    detail = crm_get_json(
        session,
        base_url.rstrip("/") + "/api/Cases/" + requests.utils.quote(requested_id, safe=""),
    )
    record = record_from_detail(
        detail,
        requested_id,
        allow_missing_remake_field_as_terminal=allow_missing_remake_field_as_terminal,
    )
    if not record.case_number:
        raise RuntimeError(f"CRM detail {requested_id} did not contain caseNumber.")
    if not has_remake_case_field(detail) and not allow_missing_remake_field_as_terminal:
        raise RuntimeError(f"CRM detail {requested_id} did not expose remakeCaseID.")
    return merge_chain_record(chain_index, record)


def resolve_chain(current_row: Dict[str, Any], session: requests.Session, base_url: str, chain_index: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    current_id = case_id(current_row)
    if not current_id:
        return empty_chain("error", "The current remake row has no CRM caseID.", False)
    next_id = remake_case_id(current_row)
    if not next_id:
        current = fetch_chain_record(session, base_url, current_id, chain_index)
        next_id = clean(current.get("remakeCaseId"))
        if not next_id and current.get("terminalConfirmed") is True:
            return empty_chain("unlinked", "CRM case detail explicitly confirmed a blank remakeCaseID.", True)

    ids: List[str] = []
    numbers: List[int] = []
    seen: set[str] = set()
    while next_id and len(ids) < MAX_CHAIN_DEPTH:
        key = next_id.lower()
        if key in seen:
            return chain_result("error", False, ids, numbers, "A remakeCaseID cycle was detected.")
        seen.add(key)
        record = fetch_chain_record(
            session,
            base_url,
            next_id,
            chain_index,
            allow_missing_remake_field_as_terminal=True,
        )
        try:
            number_value = int(float(record.get("caseNumber") or 0))
        except (TypeError, ValueError):
            number_value = 0
        if number_value <= 0:
            return chain_result("error", False, ids, numbers, "A linked CRM case did not contain a numeric case number.")
        ids.append(next_id)
        numbers.append(number_value)
        next_id = clean(record.get("remakeCaseId"))
        if not next_id:
            if record.get("terminalConfirmed") is not True:
                return chain_result("error", False, ids, numbers, "The terminal CRM case was not explicitly confirmed.")
            break
    if next_id:
        return chain_result("error", False, ids, numbers, "The remake chain exceeded the safe depth limit.")
    return chain_result("resolved", True, ids, numbers, "CRM remakeCaseID chain resolved and terminal case confirmed.")


def chain_result(status: str, confirmed: bool, ids: Sequence[str], numbers: Sequence[int], reason: str) -> Dict[str, Any]:
    return {
        "status": status,
        "confirmed": confirmed,
        "chainDepth": len(ids),
        "previousCaseNumber": numbers[0] if numbers else "",
        "rootCaseNumber": numbers[-1] if numbers else "",
        "previousCaseId": ids[0] if ids else "",
        "rootCaseId": ids[-1] if ids else "",
        "chainCaseNumbers": list(numbers),
        "chainCaseIds": list(ids),
        "reason": reason,
        "checkedAt": utc_now(),
        "lookupVersion": CHAIN_INDEX_VERSION,
    }


def empty_chain(status: str, reason: str, confirmed: bool) -> Dict[str, Any]:
    return chain_result(status, confirmed, [], [], reason)


def load_remake_rows(drive: Any, index_file_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    index = download_drive_json(drive, index_file_id)
    if index.get("ok") is not True or not isinstance(index.get("shards"), dict):
        raise RuntimeError(index.get("message") or "Remake cache index is not ready.")
    rows: List[Dict[str, Any]] = []
    months = sorted(index.get("months") or index.get("shards", {}).keys())
    for position, month in enumerate(months, start=1):
        shard = index["shards"].get(month) or {}
        file_id = clean(shard.get("fileId"))
        if not file_id:
            raise RuntimeError(f"Remake shard {month} has no fileId.")
        parsed = download_drive_json(drive, file_id)
        shard_rows = parsed.get("rows") if isinstance(parsed.get("rows"), list) else parsed.get("detailRows")
        if not isinstance(shard_rows, list):
            raise RuntimeError(f"Remake shard {month} has no rows array.")
        rows.extend(row for row in shard_rows if isinstance(row, dict))
        print(f"Loaded {position}/{len(months)} {month}: {len(shard_rows):,} rows")
    return index, rows


def load_badge_lookup(sheets: Any) -> Dict[str, Dict[str, Dict[str, str]]]:
    result: Dict[str, Dict[str, Dict[str, str]]] = {
        "byId": {}, "byTech": {}, "legacyByTech": {}, "legacyByName": {}
    }
    primary = sheets.spreadsheets().values().get(
        spreadsheetId=TASK_BADGE_SPREADSHEET_ID, range=TASK_BADGE_RANGE
    ).execute().get("values", [])
    for values in primary:
        values = list(values) + [""] * (4 - len(values))
        tech, name, technician_type, task_user_id = map(clean, values[:4])
        record = {"name": name, "techNumber": tech, "technicianType": technician_type, "taskUserId": task_user_id}
        if task_user_id:
            result["byId"][task_user_id.lower()] = record
        if tech:
            result["byTech"][tech] = record
    legacy = sheets.spreadsheets().values().get(
        spreadsheetId=TASK_BADGE_SPREADSHEET_ID, range=LEGACY_TECH_RANGE
    ).execute().get("values", [])
    for values in legacy:
        values = list(values) + [""] * (3 - len(values))
        tech, name, technician_type = map(clean, values[:3])
        record = {"name": name, "techNumber": tech, "technicianType": technician_type, "taskUserId": ""}
        if tech:
            result["legacyByTech"][tech] = record
        if name:
            result["legacyByName"][name.lower()] = record
    return result


def chunks(values: Sequence[int], size: int) -> Iterable[Sequence[int]]:
    for start in range(0, len(values), size):
        yield values[start:start + size]


def load_case_workers(client: bigquery.Client, case_numbers: Iterable[Any]) -> Dict[int, Dict[str, Any]]:
    unique = sorted({int(float(value)) for value in case_numbers if clean(value) and int(float(value)) > 0})
    result: Dict[int, Dict[str, Any]] = {}
    sql = f"""
WITH completed AS (
  SELECT
    SAFE_CAST(Cases_CaseNumber AS INT64) AS case_number,
    NULLIF(TRIM(CAST(CaseTasks_CompletedBy AS STRING)), '') AS worker,
    SAFE_CAST(CaseTasks_Sequence AS INT64) AS task_sequence,
    NULLIF(TRIM(CAST(CaseProducts_ProductID AS STRING)), '') AS product_id
  FROM `{PROJECT_ID}.{DATASET_ID}.{TASK_TABLE}`
  WHERE SAFE_CAST(Cases_CaseNumber AS INT64) IN UNNEST(@case_numbers)
    AND CaseTasks_CompleteDate IS NOT NULL
    AND UPPER(TRIM(COALESCE(CAST(CaseTasks_Task AS STRING), ''))) = @task_code
)
SELECT
  case_number,
  COUNT(*) AS completed_rows,
  COUNT(DISTINCT worker) AS distinct_workers,
  COUNTIF(worker IS NULL) AS missing_worker_rows,
  ARRAY_AGG(DISTINCT worker IGNORE NULLS ORDER BY worker) AS workers,
  ARRAY_AGG(DISTINCT task_sequence IGNORE NULLS ORDER BY task_sequence) AS sequences,
  ARRAY_AGG(DISTINCT product_id IGNORE NULLS ORDER BY product_id) AS product_ids
FROM completed
GROUP BY case_number
"""
    for batch in chunks(unique, BQ_CASE_BATCH_SIZE):
        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ArrayQueryParameter("case_numbers", "INT64", list(batch)),
            bigquery.ScalarQueryParameter("task_code", "STRING", TASK_CODE),
        ])
        for row in client.query(sql, job_config=job_config).result():
            workers = [clean(value) for value in row.workers or [] if clean(value)]
            status = "resolved" if len(workers) == 1 else ("multiple_workers" if len(workers) > 1 else "missing_completed_by")
            result[int(row.case_number)] = {
                "caseNumber": int(row.case_number),
                "status": status,
                "worker": workers[0] if len(workers) == 1 else "",
                "workers": workers,
                "completedRows": int(row.completed_rows or 0),
                "missingWorkerRows": int(row.missing_worker_rows or 0),
                "sequences": list(row.sequences or []),
                "productIds": list(row.product_ids or []),
            }
    return result


def case_resolution(case_map: Dict[int, Dict[str, Any]], value: Any) -> Dict[str, Any]:
    try:
        number_value = int(float(value or 0))
    except (TypeError, ValueError):
        number_value = 0
    if number_value <= 0:
        return {"caseNumber": "", "status": "unlinked", "worker": "", "workers": [], "sequences": [], "productIds": [], "completedRows": 0}
    return case_map.get(number_value) or {"caseNumber": number_value, "status": "missing_ceramics", "worker": "", "workers": [], "sequences": [], "productIds": [], "completedRows": 0}


def write_resolution(row: Dict[str, Any], prefix: str, resolution: Dict[str, Any]) -> None:
    status = clean(resolution.get("status")) or "missing_ceramics"
    worker = clean(resolution.get("worker"))
    row[prefix + "Ceramist"] = worker
    row[prefix + "CeramistDisplay"] = worker
    row[prefix + "CeramistCandidates"] = list(resolution.get("workers") or [])
    row[prefix + "CeramistStatus"] = status
    row[prefix + "CeramicsMissing"] = status in {"missing_ceramics", "missing_completed_by"}
    row[prefix + "MultipleCeramists"] = status == "multiple_workers"
    row[prefix + "ProductUnmatched"] = False
    row[prefix + "MatchMethod"] = "case_level_ceramics" if status == "resolved" else ""
    row[prefix + "MatchedProductId"] = ""
    row[prefix + "Sequences"] = list(resolution.get("sequences") or [])
    row[prefix + "CaseCeramicsProductIds"] = list(resolution.get("productIds") or [])
    row[prefix + "CaseCompletedCeramicsRows"] = int(resolution.get("completedRows") or 0)


def lookup_worker(raw_worker: str, badges: Dict[str, Dict[str, Dict[str, str]]]) -> Dict[str, str]:
    raw = clean(raw_worker)
    if not raw:
        return {"raw": "", "name": "", "techNumber": "", "technicianType": "", "taskUserId": ""}
    record = badges["byId"].get(raw.lower()) or badges["legacyByName"].get(raw.lower()) or {}
    return {
        "raw": raw,
        "name": clean(record.get("name")) or raw,
        "techNumber": clean(record.get("techNumber")),
        "technicianType": clean(record.get("technicianType")),
        "taskUserId": clean(record.get("taskUserId")) or raw,
    }


def note_worker(record: Dict[str, Any], badges: Dict[str, Dict[str, Dict[str, str]]]) -> Optional[Dict[str, str]]:
    numbers = unique_strings(record.get("invoiceNoteTechNumbers") or [])
    if len(numbers) != 1:
        return None
    tech = numbers[0]
    badge = badges["byTech"].get(tech) or badges["legacyByTech"].get(tech)
    if not badge or not clean(badge.get("name")):
        return None
    return {
        "techNumber": tech,
        "name": clean(badge.get("name")),
        "technicianType": clean(badge.get("technicianType")),
        "taskUserId": clean(badge.get("taskUserId")) or f"TECH#{tech}",
    }


def build_output_row(main: Dict[str, Any], chain: Dict[str, Any], chain_index: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    number = case_number(main)
    cid = case_id(main)
    quantity = float(main.get("quantity") if main.get("quantity") is not None else main.get("units") or 0)
    discount = abs(float(main.get("remakeDiscount") or 0))
    result = {
        "month": row_month(main),
        "year": int(main.get("year") or (row_month(main)[:4] if row_month(main) else 0)) or "",
        "invoiceDate": clean(main.get("invoiceDate")),
        "caseId": cid,
        "caseNumber": number,
        "currentCaseNumber": number,
        "remakeCaseNumber": number,
        "remakeCaseId": remake_case_id(main),
        "remakeCaseID": remake_case_id(main),
        "caseProductLineId": line_id(main),
        "customerId": clean(main.get("customerId") or main.get("customerKey")),
        "customerKey": clean(main.get("customerId") or main.get("customerKey")),
        "customerName": clean(main.get("customerName") or main.get("customerDisplayName") or main.get("customerId") or "Unknown customer"),
        "customerDisplayName": clean(main.get("customerDisplayName") or main.get("customerDisplayLabel") or main.get("customerName") or "Unknown customer"),
        "practiceName": clean(main.get("practiceName")),
        "customerActive": main.get("customerActive") is not False,
        "department": clean(main.get("department")) or "Unassigned",
        "productId": product_id(main),
        "currentProductId": product_id(main),
        "productKey": clean(main.get("productKey")) or product_id(main),
        "productName": clean(main.get("productName")) or product_id(main) or "Unknown product",
        "productGroup": clean(main.get("productGroup")) or "Unassigned",
        "remakeReason": clean(main.get("remakeReason")) or "Not specified",
        "quantity": quantity,
        "units": quantity,
        "isRemake": True,
        "remakeUnits": float(main.get("remakeUnits") if main.get("remakeUnits") is not None else quantity),
        "remakeDiscount": discount,
        "currentProductCeramicsEligible": True,
        "currentProductCeramicsEligibilityReason": "Included from the complete Remake Factor population",
        "populationVersion": SEED_VERSION,
        "historicalSeedVersion": SEED_VERSION,
        "populationSource": "colab_complete_remake_population",
        "populationSynthesized": True,
        "maintenanceModel": MAINTENANCE_MODEL,
        "chainDepth": chain["chainDepth"],
        "multiChain": chain["chainDepth"] > 1,
        "previousCaseNumber": chain["previousCaseNumber"],
        "rootCaseNumber": chain["rootCaseNumber"],
        "previousCaseId": chain["previousCaseId"],
        "rootCaseId": chain["rootCaseId"],
        "chainCaseNumbers": list(chain["chainCaseNumbers"]),
        "chainCaseIds": list(chain["chainCaseIds"]),
        "populationChainStatus": chain["status"],
        "populationChainConfirmed": chain["confirmed"],
        "populationChainLookupVersion": CHAIN_INDEX_VERSION,
        "populationChainCheckedAt": chain["checkedAt"],
        "populationChainReason": chain["reason"],
    }
    prefix_ids = {
        "current": cid,
        "previous": clean(chain.get("previousCaseId")),
        "root": clean(chain.get("rootCaseId")),
    }
    for prefix, record_id in prefix_ids.items():
        record = chain_index.get(record_id.lower()) if record_id else None
        result[prefix + "InvoiceNote"] = clean(record.get("invoiceNote")) if record else ""
        result[prefix + "InvoiceNoteTechNumbers"] = list(record.get("invoiceNoteTechNumbers") or []) if record else []
    return result


def apply_responsibility(row: Dict[str, Any], case_map: Dict[int, Dict[str, Any]], badges: Dict[str, Dict[str, Dict[str, str]]], chain_index: Dict[str, Dict[str, Any]]) -> None:
    current = case_resolution(case_map, row.get("currentCaseNumber"))
    root = case_resolution(case_map, row.get("rootCaseNumber"))
    previous = case_resolution(case_map, row.get("previousCaseNumber"))
    write_resolution(row, "current", current)
    write_resolution(row, "root", root)
    write_resolution(row, "previous", previous)

    chosen: Optional[Dict[str, Any]] = None
    basis = ""
    depth = int(row.get("chainDepth") or 0)
    if depth > 0 and root["status"] == "resolved":
        if depth > 1 and previous["status"] == "resolved" and previous["worker"] != root["worker"]:
            chosen, basis = previous, "previous_case_level_differs_from_root"
        else:
            chosen, basis = root, "root_case_level"
    elif depth > 0 and previous["status"] == "resolved" and root["status"] in {"missing_ceramics", "missing_completed_by"}:
        chosen, basis = previous, "previous_case_level_root_missing"

    if chosen:
        mapped = lookup_worker(chosen["worker"], badges)
        row["responsibleCeramist"] = mapped["taskUserId"]
        row["responsibleCeramistDisplay"] = mapped["name"]
        row["responsibleCeramistTechnicianNumber"] = mapped["techNumber"]
        row["responsibleCeramistTechnicianType"] = mapped["technicianType"]
        row["responsibleTechnicianNumber"] = mapped["techNumber"]
        row["responsibleTechnicianType"] = mapped["technicianType"]
        row["attributionStatus"] = "attributed"
        row["attributionBasis"] = basis
        row["invoiceNoteUsedForAttribution"] = False
    else:
        note_candidates: Dict[str, Optional[Dict[str, str]]] = {}
        for prefix, record_id in (
            ("root", clean(row.get("rootCaseId"))),
            ("previous", clean(row.get("previousCaseId"))),
            ("current", clean(row.get("caseId"))),
        ):
            record = chain_index.get(record_id.lower()) if record_id else None
            note_candidates[prefix] = note_worker(record or {}, badges)
        root_note = note_candidates["root"]
        previous_note = note_candidates["previous"]
        selected: Optional[Tuple[str, Dict[str, str]]] = None
        if root_note and previous_note:
            differs = (root_note["taskUserId"] or root_note["techNumber"] or root_note["name"]).lower() != (previous_note["taskUserId"] or previous_note["techNumber"] or previous_note["name"]).lower()
            selected = ("previous", previous_note) if depth > 1 and differs else ("root", root_note)
        elif previous_note:
            selected = ("previous", previous_note)
        elif root_note:
            selected = ("root", root_note)

        if selected:
            source, mapped = selected
            row["responsibleCeramist"] = mapped["taskUserId"]
            row["responsibleCeramistDisplay"] = mapped["name"]
            row["responsibleCeramistTechnicianNumber"] = mapped["techNumber"]
            row["responsibleCeramistTechnicianType"] = mapped["technicianType"]
            row["responsibleTechnicianNumber"] = mapped["techNumber"]
            row["responsibleTechnicianType"] = mapped["technicianType"]
            row["attributionStatus"] = "attributed"
            row["attributionBasis"] = source + "_invoice_note_tech_completed"
            row["invoiceNoteCompletionAccepted"] = True
            row["invoiceNoteTechEvidence"] = True
            row["invoiceNoteUsedForAttribution"] = True
        else:
            row["responsibleCeramist"] = "[Unattributed]"
            row["responsibleCeramistDisplay"] = "[Unattributed]"
            row["responsibleTechnicianNumber"] = ""
            row["responsibleTechnicianType"] = ""
            row["attributionStatus"] = "unattributed"
            chain_status = clean(row.get("populationChainStatus"))
            if chain_status == "unlinked" and row.get("populationChainConfirmed") is True:
                row["attributionBasis"] = "unlinked"
                row["attributionReason"] = clean(row.get("populationChainReason")) or "CRM explicitly confirmed no remakeCaseID."
            elif chain_status == "error":
                row["attributionBasis"] = "population_chain_error"
                row["attributionReason"] = clean(row.get("populationChainReason")) or "The remake chain could not be resolved."
            elif root["status"] == "multiple_workers" or previous["status"] == "multiple_workers":
                row["attributionBasis"] = "multiple_case_level_workers"
            else:
                row["attributionBasis"] = "no_case_level_ceramics_worker"

    for prefix in ("current", "root", "previous"):
        raw = clean(row.get(prefix + "Ceramist"))
        if raw:
            mapped = lookup_worker(raw, badges)
            row[prefix + "CeramistDisplay"] = mapped["name"]
            row[prefix + "CeramistTechnicianNumber"] = mapped["techNumber"]
            row[prefix + "CeramistTechnicianType"] = mapped["technicianType"]
    row["previousDiffersFromRoot"] = root["status"] == "resolved" and previous["status"] == "resolved" and root["worker"] != previous["worker"]
    row["caseLevelResponsibilityApplied"] = True


def build_stats(rows: Sequence[Dict[str, Any]], chain_index: Dict[str, Dict[str, Any]], remake_rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    case_keys = {case_number(row) for row in rows if case_number(row)}
    attributed_rows = sum(1 for row in rows if row.get("attributionStatus") == "attributed")
    attributed_cases = {case_number(row) for row in rows if row.get("attributionStatus") == "attributed" and case_number(row)}
    remake_units = sum(float(row.get("remakeUnits") or 0) for row in rows)
    attributed_units = sum(float(row.get("remakeUnits") or 0) for row in rows if row.get("attributionStatus") == "attributed")
    discount = sum(abs(float(row.get("remakeDiscount") or 0)) for row in rows)
    return {
        "historicalSeedVersion": SEED_VERSION,
        "maintenanceModel": MAINTENANCE_MODEL,
        "remakeProductRows": len(remake_rows),
        "remakeCases": len(case_keys),
        "caseLevelRows": len(rows),
        "caseLevelAttributedRows": attributed_rows,
        "caseLevelUnattributedRows": len(rows) - attributed_rows,
        "attributedCases": len(attributed_cases),
        "attributionCoveragePct": round(100 * len(attributed_cases) / len(case_keys), 2) if case_keys else 0,
        "remakeUnits": round(remake_units, 4),
        "attributedRemakeUnits": round(attributed_units, 4),
        "remakeDiscount": round(discount, 2),
        "chainIndexRecords": len(chain_index),
        "confirmedTerminalChainRecords": sum(1 for record in chain_index.values() if record.get("terminalConfirmed") is True),
        "invoiceNoteEvidenceProductRows": sum(1 for row in rows if row.get("invoiceNoteTechEvidence") is True),
        "invoiceNoteAttributedProductRows": sum(1 for row in rows if row.get("invoiceNoteUsedForAttribution") is True),
    }


def upload_json_to_existing_file(drive: Any, file_id: str, payload: Dict[str, Any]) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    media = MediaIoBaseUpload(io.BytesIO(raw), mimetype="application/json", resumable=True)
    request = drive.files().update(fileId=file_id, media_body=media, fields="id,name,modifiedTime,size,webViewLink")
    response = None
    while response is None:
        _, response = request.next_chunk()
    print("Updated:", response)


def create_json_file(drive: Any, name: str, payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    media = MediaIoBaseUpload(io.BytesIO(raw), mimetype="application/json", resumable=True)
    response = drive.files().create(body={"name": name}, media_body=media, fields="id,name,webViewLink").execute()
    print("Created:", response)
    return response["id"]


def main() -> None:
    print("Authenticating Google account...")
    auth.authenticate_user()
    drive = build("drive", "v3")
    sheets = build("sheets", "v4")
    bq = bigquery.Client(project=PROJECT_ID)

    remake_index_id = choose_file_id(drive, REMAKE_CACHE_INDEX_FILE_ID, "remake_factor_cache_index.json", "Remake cache index")
    ceramist_cache_id = choose_file_id(drive, CERAMIST_CACHE_FILE_ID, "ceramist_remake_cache.json", "Ceramist cache", allow_create=True)

    crm_user = getpass.getpass("MagicTouch API user ID: ")
    crm_password = getpass.getpass("MagicTouch API password: ")
    session, _ = authenticate_crm(CRM_BASE_URL, crm_user, crm_password)

    print("Loading complete Remake monthly cache...")
    remake_index, all_rows = load_remake_rows(drive, remake_index_id)
    remake_rows = [row for row in all_rows if is_remake(row)]
    print(f"All Remake cache rows: {len(all_rows):,}")
    print(f"Remake product rows: {len(remake_rows):,}")

    chain_index: Dict[str, Dict[str, Any]] = {}
    for row in all_rows:
        cid = case_id(row)
        if not cid:
            continue
        merge_chain_record(chain_index, ChainRecord(
            case_id=cid,
            case_number=case_number(row),
            remake_case_id=remake_case_id(row),
            terminal_confirmed=False,
        ))

    rows_by_case: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in remake_rows:
        number = case_number(row)
        if number:
            rows_by_case[number].append(row)

    preflight_case = "389666"
    if preflight_case not in rows_by_case:
        raise RuntimeError(
            "Preflight case 389666 is missing from the Remake cache. No Drive file was changed."
        )

    print("Running CRM chain preflight for 389666 -> 385918...")
    preflight_chain = resolve_chain(
        rows_by_case[preflight_case][0],
        session,
        CRM_BASE_URL,
        chain_index,
    )
    print("Preflight result:", json.dumps(preflight_chain, indent=2))
    if (
        preflight_chain.get("status") != "resolved"
        or int(float(preflight_chain.get("previousCaseNumber") or 0)) != 385918
        or int(float(preflight_chain.get("rootCaseNumber") or 0)) != 385918
    ):
        raise RuntimeError(
            "CRM chain preflight failed for 389666 -> 385918. No Drive file was changed."
        )
    print("CRM chain preflight passed.")

    chains_by_case: Dict[str, Dict[str, Any]] = {}
    errors: List[Dict[str, str]] = []
    case_numbers_sorted = sorted(rows_by_case, key=lambda value: int(value), reverse=True)
    for position, number in enumerate(case_numbers_sorted, start=1):
        try:
            chain = resolve_chain(rows_by_case[number][0], session, CRM_BASE_URL, chain_index)
            chains_by_case[number] = chain
        except Exception as error:
            error_item = {"caseNumber": number, "error": str(error)}
            errors.append(error_item)
            chains_by_case[number] = empty_chain("error", str(error), False)
            print("Chain error:", json.dumps(error_item))
            if len(errors) >= MAX_CHAIN_ERRORS_BEFORE_ABORT:
                print(
                    f"Stopping after {len(errors)} chain errors; "
                    "the historical seed has not changed Drive."
                )
                break
        if position % 100 == 0 or position == len(case_numbers_sorted):
            print(f"Resolved chains {position:,}/{len(case_numbers_sorted):,}; errors={len(errors):,}")

    if errors:
        print("Chain errors (first 20):", json.dumps(errors[:20], indent=2))
        raise RuntimeError("Historical seed stopped because one or more CRM chains failed. No Drive file was changed.")

    required_numbers: set[int] = set()
    for number, chain in chains_by_case.items():
        required_numbers.add(int(number))
        required_numbers.update(int(value) for value in chain.get("chainCaseNumbers") or [] if int(value) > 0)

    print(f"Querying BigQuery CERAMICS workers for {len(required_numbers):,} cases...")
    case_map = load_case_workers(bq, required_numbers)
    badges = load_badge_lookup(sheets)

    # Invoice-note evidence is a backup only. Fetch note details only for
    # root/previous cases where completed CERAMICS did not already resolve one
    # responsible worker. This keeps the seed accurate without unnecessary API
    # calls for cases that BigQuery already attributed.
    note_detail_ids: set[str] = set()
    for chain in chains_by_case.values():
        depth = int(chain.get("chainDepth") or 0)
        if depth <= 0:
            continue
        root = case_resolution(case_map, chain.get("rootCaseNumber"))
        previous = case_resolution(case_map, chain.get("previousCaseNumber"))
        chosen_by_task = root.get("status") == "resolved" or (
            previous.get("status") == "resolved"
            and root.get("status") in {"missing_ceramics", "missing_completed_by"}
        )
        if chosen_by_task:
            continue
        for linked_id in (clean(chain.get("previousCaseId")), clean(chain.get("rootCaseId"))):
            if not linked_id:
                continue
            record = chain_index.get(linked_id.lower()) or {}
            if not clean(record.get("invoiceNote")) and not record.get("invoiceNoteTechNumbers"):
                note_detail_ids.add(linked_id)

    for position, linked_id in enumerate(sorted(note_detail_ids), start=1):
        fetch_chain_record(
            session,
            CRM_BASE_URL,
            linked_id,
            chain_index,
            force=True,
            allow_missing_remake_field_as_terminal=True,
        )
        if position % 100 == 0 or position == len(note_detail_ids):
            print(f"Loaded invoice-note backup evidence {position:,}/{len(note_detail_ids):,}")

    output_rows: List[Dict[str, Any]] = []
    for main_row in remake_rows:
        number = case_number(main_row)
        chain = chains_by_case.get(number) or empty_chain("error", "Missing chain result.", False)
        output = build_output_row(main_row, chain, chain_index)
        apply_responsibility(output, case_map, badges, chain_index)
        output_rows.append(output)

    stats = build_stats(output_rows, chain_index, remake_rows)
    generated_at = utc_now()
    payload = {
        "ok": True,
        "version": CACHE_VERSION,
        "responsibilityVersion": RESPONSIBILITY_VERSION,
        "populationVersion": SEED_VERSION,
        "historicalSeedVersion": SEED_VERSION,
        "maintenanceVersion": SEED_VERSION,
        "maintenanceModel": MAINTENANCE_MODEL,
        "generatedAt": generated_at,
        "caseLevelRefreshedAt": generated_at,
        "source": "Complete Remake monthly Drive shards + CRM remakeCaseID chain + BigQuery completed CERAMICS + invoice-note backup",
        "message": "Complete historical Ceramist sidecar built once in Colab; normal maintenance uses the Remake open-month incremental updater.",
        "remakeCacheGeneratedAt": remake_index.get("generatedAt", ""),
        "stats": stats,
        "chainIndex": {
            "version": CHAIN_INDEX_VERSION,
            "updatedAt": generated_at,
            "byCaseId": chain_index,
        },
        "rows": output_rows,
    }

    regression = [row for row in output_rows if case_number(row) == "389666"]
    regression_ok = bool(regression) and all(
        int(float(row.get("previousCaseNumber") or 0)) == 385918
        and int(float(row.get("rootCaseNumber") or 0)) == 385918
        and row.get("attributionStatus") == "attributed"
        and clean(row.get("responsibleCeramistDisplay")) == "Hoseung Han (Jason)"
        for row in regression
    )
    audit = {
        "ok": regression_ok
        and stats["remakeProductRows"] == len(output_rows)
        and not errors,
        "seedVersion": SEED_VERSION,
        "generatedAt": generated_at,
        "rowCount": len(output_rows),
        "stats": stats,
        "regression389666": regression,
        "regression389666Passed": regression_ok,
        "chainErrors": errors,
    }
    print(json.dumps(audit, indent=2, default=str))
    if not audit["ok"]:
        raise RuntimeError("Historical seed audit failed. No Drive file was changed.")

    confirmation = input("Type WRITE to back up and replace the Ceramist cache: ").strip()
    if confirmation != "WRITE":
        print("Stopped without changing Drive.")
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    if ceramist_cache_id:
        metadata = drive.files().get(fileId=ceramist_cache_id, fields="id,name,parents").execute()
        backup_name = f"{metadata.get('name', 'ceramist_remake_cache.json')}.backup-{timestamp}.json"
        backup_body: Dict[str, Any] = {"name": backup_name}
        if metadata.get("parents"):
            backup_body["parents"] = metadata["parents"]
        backup = drive.files().copy(fileId=ceramist_cache_id, body=backup_body, fields="id,name,webViewLink").execute()
        print("Backup created:", backup)
        upload_json_to_existing_file(drive, ceramist_cache_id, payload)
    else:
        ceramist_cache_id = create_json_file(drive, "ceramist_remake_cache.json", payload)

    audit_name = f"ceramist_historical_seed_audit_{timestamp}.json"
    create_json_file(drive, audit_name, audit)
    print("Historical seed complete.")
    print("MT_CERAMIST_REMAKE_CACHE_FILE_ID =", ceramist_cache_id)


if __name__ == "__main__":
    main()
