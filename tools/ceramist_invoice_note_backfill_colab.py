# Ceramist Invoice Notes backfill for Google Colab
# Version: ceramist-invoice-note-backfill-v1.0.0
# Last confirmed: 2026-07-31
#
# Purpose:
#   Repair Invoice Notes evidence in an existing Ceramist historical sidecar
#   after the v1.0.2 seed omitted the case-level InvoiceNotes field.
#
# Safety:
#   - Read-only CRM GET requests.
#   - Credentials are requested with getpass and are never written to Drive.
#   - Existing Ceramist cache is copied to a timestamped backup before write.
#   - No Drive file is changed unless the final confirmation is exactly WRITE.
#   - Case 378035 must resolve through original case 377483 to TECH#19 / Ol Phann.
#
# In Colab, upload this file and run:
#   %run /content/ceramist_invoice_note_backfill_colab_v1.0.0.py

from __future__ import annotations

import getpass
import io
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests
from google.colab import auth
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload


BACKFILL_VERSION = "ceramist-invoice-note-backfill-v1.0.0"
CACHE_VERSION = "CeramistRemakeCache v0.6.0"
RESPONSIBILITY_VERSION = "case-level-v7.8.2"
MAINTENANCE_VERSION = "CeramistIncremental v7.8.2"
MAINTENANCE_MODEL = "historical-seed-plus-open-month-upsert-v7.8.2"
CHAIN_INDEX_VERSION = "crm-remakeCaseID-seed-plus-incremental-v7.8.2"
REQUIRED_SEED_VERSION = "ceramist-colab-seed-v1.0.0"

TASK_BADGE_SPREADSHEET_ID = "1XrJctG1-0RGhKCV6w2jK4esoaahmc7Ji7MjQhZo-nBY"
TASK_BADGE_RANGE = "'Task User Badges'!A2:D"
LEGACY_TECH_RANGE = "'Tech Numbers'!A2:C"
CRM_BASE_URL = "https://crm.caldentalarts.com"

CERAMIST_CACHE_FILE_ID = ""

REQUEST_TIMEOUT_SECONDS = 60
REQUEST_DELAY_SECONDS = 0.08
MAX_HTTP_RETRIES = 7

INVOICE_NOTE_KEYS = (
    "invoiceNotes",
    "InvoiceNotes",
    "Cases_InvoiceNotes",
    "invoiceNote",
    "InvoiceNote",
    "Cases_InvoiceNote",
)


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


def download_drive_bytes(drive: Any, file_id: str) -> bytes:
    request = drive.files().get_media(fileId=file_id)
    stream = io.BytesIO()
    downloader = MediaIoBaseDownload(stream, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return stream.getvalue()


def download_drive_json(drive: Any, file_id: str) -> Dict[str, Any]:
    return json.loads(download_drive_bytes(drive, file_id).decode("utf-8"))


def search_drive_file(drive: Any, name: str) -> List[Dict[str, Any]]:
    escaped = name.replace("'", "\\'")
    response = drive.files().list(
        q=f"name = '{escaped}' and trashed = false",
        fields="files(id,name,modifiedTime,size,webViewLink)",
        orderBy="modifiedTime desc",
        pageSize=100,
    ).execute()
    return response.get("files", [])


def choose_file_id(drive: Any, supplied: str, exact_name: str, label: str) -> str:
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
    value = input(f"Paste the {label} Drive file ID: ").strip()
    if not value:
        raise RuntimeError(f"{label} file ID is required.")
    return value


def authenticate_crm(base_url: str, user_id: str, password: str) -> requests.Session:
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
        body.get("data", {}).get("token")
        if isinstance(body, dict) and isinstance(body.get("data"), dict)
        else None,
    ]
    token = next((clean(item) for item in candidates if clean(item)), "")
    if not token and isinstance(body, str):
        token = body.strip().strip('"')
    if not token:
        raise RuntimeError("MagicTouch authentication returned no bearer token.")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


def crm_get_json(session: requests.Session, url: str) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in range(MAX_HTTP_RETRIES):
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            if response.status_code in {429, 500, 502, 503, 504}:
                time.sleep(min(30.0, 1.5**attempt))
                continue
            response.raise_for_status()
            time.sleep(REQUEST_DELAY_SECONDS)
            body = response.json()
            return body if isinstance(body, dict) else {}
        except (requests.RequestException, ValueError) as error:
            last_error = error
            time.sleep(min(30.0, 1.5**attempt))
    raise RuntimeError(f"CRM request failed after retries: {url}: {last_error}")


def extract_tech_numbers(text: str) -> List[str]:
    numbers: List[str] = []
    patterns = [
        re.compile(
            r"\btech(?:nician)?(?:\s*(?:number|no\.?|#))?\s*[:\-]?\s*"
            r"((?:\d{1,6})(?:\s*[-/,;&+]\s*\d{1,6})*)",
            re.IGNORECASE,
        ),
        re.compile(
            r"\bcompleted\s+by\s+(?:tech(?:nician)?\s*)?#?\s*"
            r"((?:\d{1,6})(?:\s*[-/,;&+]\s*\d{1,6})*)",
            re.IGNORECASE,
        ),
    ]
    for pattern in patterns:
        for match in pattern.finditer(clean(text)):
            numbers.extend(re.findall(r"\d{1,6}", match.group(1)))
    return unique_strings(numbers)


def extract_note_text_and_tech_numbers(detail: Dict[str, Any]) -> Tuple[str, List[str]]:
    accepted: List[str] = []
    tech_numbers: List[str] = []

    direct_values = unique_strings(detail.get(key) for key in INVOICE_NOTE_KEYS)
    for note_text in direct_values:
        found = extract_tech_numbers(note_text)
        if not found:
            continue
        accepted.append(note_text)
        tech_numbers.extend(found)

    notes = detail.get("notes") if isinstance(detail.get("notes"), list) else []
    for note in notes:
        value = note if isinstance(note, dict) else {"text": note}
        label = " | ".join(
            clean(value.get(key))
            for key in ("type", "noteType", "subject", "title", "category")
            if clean(value.get(key))
        )
        text = " ".join(
            clean(value.get(key))
            for key in ("note", "notes", "text", "body", "description", "message", "comments")
            if clean(value.get(key))
        )
        combined = (label + " | " if label else "") + text
        found = extract_tech_numbers(combined)
        if not found:
            continue
        accepted.append(combined)
        tech_numbers.extend(found)

    return "\n".join(unique_strings(accepted))[:4000], unique_strings(tech_numbers)


def load_badges(sheets: Any) -> Dict[str, Dict[str, Dict[str, str]]]:
    lookup: Dict[str, Dict[str, Dict[str, str]]] = {
        "byTech": {},
        "legacyByTech": {},
    }

    primary = sheets.spreadsheets().values().get(
        spreadsheetId=TASK_BADGE_SPREADSHEET_ID,
        range=TASK_BADGE_RANGE,
    ).execute().get("values", [])

    for row in primary:
        values = list(row) + ["", "", "", ""]
        tech_number = clean(values[0])
        name = clean(values[1])
        technician_type = clean(values[2])
        task_user_id = clean(values[3])
        if not tech_number:
            continue
        lookup["byTech"][tech_number] = {
            "techNumber": tech_number,
            "name": name,
            "technicianType": technician_type,
            "taskUserId": task_user_id,
        }

    legacy = sheets.spreadsheets().values().get(
        spreadsheetId=TASK_BADGE_SPREADSHEET_ID,
        range=LEGACY_TECH_RANGE,
    ).execute().get("values", [])

    for row in legacy:
        values = list(row) + ["", "", ""]
        tech_number = clean(values[0])
        name = clean(values[1])
        technician_type = clean(values[2])
        if not tech_number:
            continue
        lookup["legacyByTech"][tech_number] = {
            "techNumber": tech_number,
            "name": name,
            "technicianType": technician_type,
            "taskUserId": "",
        }

    return lookup


def note_worker(
    record: Dict[str, Any],
    badges: Dict[str, Dict[str, Dict[str, str]]],
) -> Optional[Dict[str, str]]:
    numbers = unique_strings(record.get("invoiceNoteTechNumbers") or [])
    if not numbers:
        return None

    candidates: List[Dict[str, str]] = []
    for tech in numbers:
        badge = badges["byTech"].get(tech) or badges["legacyByTech"].get(tech)
        if not badge or not clean(badge.get("name")):
            continue
        candidates.append({
            "techNumber": tech,
            "name": clean(badge.get("name")),
            "technicianType": clean(badge.get("technicianType")),
            "taskUserId": clean(badge.get("taskUserId")) or f"TECH#{tech}",
        })

    if len(numbers) == 1:
        return candidates[0] if candidates else None

    ceramists = [
        candidate
        for candidate in candidates
        if clean(candidate.get("technicianType")).lower() == "ceramist"
    ]
    return ceramists[0] if len(ceramists) == 1 else None


def worker_identity(worker: Optional[Dict[str, str]]) -> str:
    if not worker:
        return ""
    return clean(
        worker.get("taskUserId")
        or worker.get("techNumber")
        or worker.get("name")
    ).lower()


def chain_map(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    source = payload.get("chainIndex") or {}
    by_case_id = source.get("byCaseId") if isinstance(source, dict) else {}
    if not isinstance(by_case_id, dict):
        by_case_id = source if isinstance(source, dict) else {}
    return {
        clean(key).lower(): dict(value)
        for key, value in by_case_id.items()
        if clean(key) and isinstance(value, dict)
    }


def has_note_evidence(record: Dict[str, Any]) -> bool:
    return bool(
        clean(record.get("invoiceNote"))
        or unique_strings(record.get("invoiceNoteTechNumbers") or [])
    )


def set_worker_fields(
    row: Dict[str, Any],
    prefix: str,
    worker: Dict[str, str],
) -> None:
    task_user_id = clean(worker.get("taskUserId")) or f"TECH#{clean(worker.get('techNumber'))}"
    display = clean(worker.get("name")) or task_user_id
    tech_number = clean(worker.get("techNumber"))
    technician_type = clean(worker.get("technicianType"))

    row[prefix + "Ceramist"] = task_user_id
    row[prefix + "CeramistDisplay"] = display
    row[prefix + "CeramistTechnicianNumber"] = tech_number
    row[prefix + "CeramistTechnicianType"] = technician_type
    row[prefix + "CeramistSource"] = "invoice_note"


def apply_invoice_note_attribution(
    row: Dict[str, Any],
    index: Dict[str, Dict[str, Any]],
    badges: Dict[str, Dict[str, Dict[str, str]]],
) -> bool:
    current_id = case_id(row)
    previous_id = clean(row.get("previousCaseId"))
    root_id = clean(row.get("rootCaseId"))

    current_record = index.get(current_id.lower(), {}) if current_id else {}
    previous_record = index.get(previous_id.lower(), {}) if previous_id else {}
    root_record = index.get(root_id.lower(), {}) if root_id else {}

    current_worker = note_worker(current_record, badges)
    previous_worker = note_worker(previous_record, badges)
    root_worker = note_worker(root_record, badges)

    if current_worker and not clean(row.get("currentCeramist")):
        set_worker_fields(row, "current", current_worker)
        row["currentCompletedViaInvoiceNote"] = True

    if str(row.get("attributionStatus") or "") == "attributed":
        return False

    if has_note_evidence(previous_record) or has_note_evidence(root_record):
        row["invoiceNoteTechEvidence"] = True

    chosen_source = ""
    chosen: Optional[Dict[str, str]] = None

    if root_worker and previous_worker:
        differs = worker_identity(root_worker) != worker_identity(previous_worker)
        if int(row.get("chainDepth") or 0) > 1 and differs:
            chosen_source, chosen = "previous", previous_worker
        else:
            chosen_source, chosen = "root", root_worker
    elif previous_worker:
        chosen_source, chosen = "previous", previous_worker
    elif root_worker:
        chosen_source, chosen = "root", root_worker

    if not chosen:
        return False

    set_worker_fields(row, "responsible", chosen)
    row["responsibleTechnicianNumber"] = clean(chosen.get("techNumber"))
    row["responsibleTechnicianType"] = clean(chosen.get("technicianType"))
    row["responsibleCompletedViaInvoiceNote"] = True
    row["invoiceNoteCompletionAccepted"] = True
    row["invoiceNoteTechEvidence"] = True
    row["invoiceNoteUsedForAttribution"] = True
    row["attributionStatus"] = "attributed"
    row["attributionBasis"] = chosen_source + "_invoice_note_tech_completed"
    row["attributionReason"] = ""

    technician_type = clean(chosen.get("technicianType"))
    row["responsibleWorkerType"] = technician_type
    row["responsibleWorkerCategory"] = (
        "Ceramist" if technician_type.lower() == "ceramist"
        else (technician_type or "Technician - Review")
    )
    row["responsibleWorkerSection"] = (
        "Ceramists" if technician_type.lower() == "ceramist"
        else "Technicians / Try-ins"
    )

    if chosen_source == "root":
        set_worker_fields(row, "root", chosen)
        row["rootCeramicsMissing"] = False
        row["rootCompletedViaInvoiceNote"] = True

    if chosen_source == "previous":
        set_worker_fields(row, "previous", chosen)
        row["previousCeramicsMissing"] = False
        row["previousCompletedViaInvoiceNote"] = True

    return True


def hydrate_row_note_fields(
    row: Dict[str, Any],
    index: Dict[str, Dict[str, Any]],
) -> None:
    pairs = (
        ("current", case_id(row)),
        ("previous", clean(row.get("previousCaseId"))),
        ("root", clean(row.get("rootCaseId"))),
    )
    for prefix, record_id in pairs:
        if not record_id:
            continue
        record = index.get(record_id.lower()) or {}
        row[prefix + "InvoiceNote"] = clean(record.get("invoiceNote"))
        row[prefix + "InvoiceNoteTechNumbers"] = unique_strings(
            record.get("invoiceNoteTechNumbers") or []
        )


def update_stats(
    payload: Dict[str, Any],
    rows: Sequence[Dict[str, Any]],
    api_calls: int,
    newly_attributed_rows: int,
) -> None:
    stats = dict(payload.get("stats") or {})
    case_keys = {case_number(row) for row in rows if case_number(row)}
    attributed_rows = [
        row for row in rows
        if str(row.get("attributionStatus") or "") == "attributed"
    ]
    attributed_cases = {
        case_number(row)
        for row in attributed_rows
        if case_number(row)
    }

    stats.update({
        "caseLevelRows": len(rows),
        "caseLevelAttributedRows": len(attributed_rows),
        "caseLevelUnattributedRows": len(rows) - len(attributed_rows),
        "attributedCases": len(attributed_cases),
        "attributionCoveragePct": (
            round(100 * len(attributed_cases) / len(case_keys), 2)
            if case_keys else 0
        ),
        "invoiceNoteEvidenceProductRows": sum(
            1 for row in rows
            if row.get("invoiceNoteTechEvidence") is True
        ),
        "invoiceNoteAttributedProductRows": sum(
            1 for row in rows
            if row.get("invoiceNoteUsedForAttribution") is True
        ),
        "invoiceNoteBackfillVersion": BACKFILL_VERSION,
        "invoiceNoteBackfillApiCalls": api_calls,
        "invoiceNoteBackfillNewlyAttributedRows": newly_attributed_rows,
    })
    payload["stats"] = stats


def upload_json_to_existing_file(
    drive: Any,
    file_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    media = MediaIoBaseUpload(
        io.BytesIO(raw),
        mimetype="application/json",
        resumable=True,
    )
    request = drive.files().update(
        fileId=file_id,
        media_body=media,
        fields="id,name,modifiedTime,size,webViewLink",
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    return response


def create_json_file(
    drive: Any,
    name: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    media = MediaIoBaseUpload(
        io.BytesIO(raw),
        mimetype="application/json",
        resumable=True,
    )
    return drive.files().create(
        body={"name": name},
        media_body=media,
        fields="id,name,webViewLink",
    ).execute()


def main() -> None:
    print("Authenticating Google account...")
    auth.authenticate_user()
    drive = build("drive", "v3")
    sheets = build("sheets", "v4")

    cache_id = choose_file_id(
        drive,
        CERAMIST_CACHE_FILE_ID,
        "ceramist_remake_preview_cache.json",
        "Ceramist cache",
    )

    payload = download_drive_json(drive, cache_id)
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    if not rows:
        raise RuntimeError("The Ceramist cache contains no rows.")

    seed_version = clean(payload.get("historicalSeedVersion"))
    if seed_version != REQUIRED_SEED_VERSION:
        raise RuntimeError(
            "The expected historical seed is not installed. "
            f"Expected {REQUIRED_SEED_VERSION}; found {seed_version or '[blank]'}."
        )

    badges = load_badges(sheets)

    parser_note, parser_numbers = extract_note_text_and_tech_numbers({
        "invoiceNotes": "TECH#44-21"
    })
    parser_record = {
        "invoiceNote": parser_note,
        "invoiceNoteTechNumbers": parser_numbers,
    }
    parser_worker = note_worker(parser_record, badges)
    parser_ok = (
        parser_numbers == ["44", "21"]
        and parser_worker is not None
        and parser_worker.get("techNumber") == "21"
        and clean(parser_worker.get("technicianType")).lower() == "ceramist"
    )
    if not parser_ok:
        raise RuntimeError(
            "Invoice-note parser preflight failed for TECH#44-21. "
            f"Numbers={parser_numbers}, worker={parser_worker}"
        )

    index = chain_map(payload)

    requested: Dict[str, bool] = {}
    for row in rows:
        if str(row.get("attributionStatus") or "") == "attributed":
            continue
        for record_id in (
            case_id(row),
            clean(row.get("previousCaseId")),
            clean(row.get("rootCaseId")),
        ):
            if not record_id:
                continue
            record = index.get(record_id.lower()) or {}
            if not has_note_evidence(record):
                requested[record_id] = True

    print(
        "Unattributed rows:",
        f"{sum(1 for row in rows if str(row.get('attributionStatus') or '') != 'attributed'):,}",
    )
    print(
        "Unique CRM case details to check for Invoice Notes:",
        f"{len(requested):,}",
    )

    crm_user = getpass.getpass("MagicTouch API user ID: ")
    crm_password = getpass.getpass("MagicTouch API password: ")
    session = authenticate_crm(CRM_BASE_URL, crm_user, crm_password)

    errors: List[str] = []
    found_notes = 0
    for position, record_id in enumerate(sorted(requested), start=1):
        try:
            detail = crm_get_json(
                session,
                CRM_BASE_URL.rstrip("/")
                + "/api/Cases/"
                + requests.utils.quote(record_id, safe=""),
            )
            note, numbers = extract_note_text_and_tech_numbers(detail)
            record = dict(index.get(record_id.lower()) or {})
            record.update({
                "caseId": record_id,
                "caseNumber": clean(
                    detail.get("caseNumber")
                    or detail.get("caseNo")
                    or record.get("caseNumber")
                ),
                "invoiceNote": note,
                "invoiceNoteTechNumbers": numbers,
                "invoiceNoteCheckedAt": utc_now(),
                "invoiceNoteSource": "MagicTouch case detail InvoiceNotes",
            })
            index[record_id.lower()] = record
            if numbers:
                found_notes += 1
        except Exception as error:
            errors.append(f"{record_id}: {error}")

        if position % 25 == 0 or position == len(requested):
            print(
                f"Checked {position:,}/{len(requested):,}; "
                f"notes with TECH evidence={found_notes:,}; errors={len(errors):,}"
            )

    if errors:
        print(json.dumps(errors[:25], indent=2))
        raise RuntimeError(
            f"Invoice-note backfill stopped because {len(errors)} CRM reads failed. "
            "No Drive file was changed."
        )

    newly_attributed_rows = 0
    for row in rows:
        hydrate_row_note_fields(row, index)
        if apply_invoice_note_attribution(row, index, badges):
            newly_attributed_rows += 1

    target_rows = [row for row in rows if case_number(row) == "378035"]
    regression = {
        "found": bool(target_rows),
        "rootCaseNumbers": sorted({
            clean(row.get("rootCaseNumber"))
            for row in target_rows
            if clean(row.get("rootCaseNumber"))
        }),
        "workers": sorted({
            clean(row.get("responsibleCeramistDisplay"))
            for row in target_rows
            if clean(row.get("responsibleCeramistDisplay"))
        }),
        "statuses": sorted({
            clean(row.get("attributionStatus"))
            for row in target_rows
            if clean(row.get("attributionStatus"))
        }),
        "bases": sorted({
            clean(row.get("attributionBasis"))
            for row in target_rows
            if clean(row.get("attributionBasis"))
        }),
        "rootInvoiceNotes": sorted({
            clean(row.get("rootInvoiceNote"))
            for row in target_rows
            if clean(row.get("rootInvoiceNote"))
        }),
        "rootInvoiceNoteTechNumbers": sorted({
            number
            for row in target_rows
            for number in unique_strings(row.get("rootInvoiceNoteTechNumbers") or [])
        }),
    }
    regression["passed"] = (
        regression["found"]
        and regression["rootCaseNumbers"] == ["377483"]
        and "Ol Phann" in regression["workers"]
        and regression["statuses"] == ["attributed"]
        and "root_invoice_note_tech_completed" in regression["bases"]
        and "19" in regression["rootInvoiceNoteTechNumbers"]
    )

    if not regression["passed"]:
        print(json.dumps(regression, indent=2))
        raise RuntimeError(
            "378035 -> 377483 -> TECH#19 / Ol Phann regression failed. "
            "No Drive file was changed."
        )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    refreshed_at = utc_now()

    payload["ok"] = True
    payload["version"] = CACHE_VERSION
    payload["responsibilityVersion"] = RESPONSIBILITY_VERSION
    payload["maintenanceVersion"] = MAINTENANCE_VERSION
    payload["maintenanceModel"] = MAINTENANCE_MODEL
    payload["caseLevelRefreshedAt"] = refreshed_at
    payload["invoiceNoteBackfilledAt"] = refreshed_at
    payload["invoiceNoteBackfillVersion"] = BACKFILL_VERSION
    payload["rows"] = rows
    payload["chainIndex"] = {
        "version": CHAIN_INDEX_VERSION,
        "updatedAt": refreshed_at,
        "byCaseId": index,
    }

    update_stats(
        payload,
        rows,
        api_calls=len(requested),
        newly_attributed_rows=newly_attributed_rows,
    )

    audit = {
        "ok": True,
        "version": BACKFILL_VERSION,
        "generatedAt": refreshed_at,
        "cacheFileId": cache_id,
        "rows": len(rows),
        "crmCasesChecked": len(requested),
        "notesWithTechEvidence": found_notes,
        "newlyAttributedRows": newly_attributed_rows,
        "parserRegression": {
            "input": "TECH#44-21",
            "numbers": parser_numbers,
            "selectedTechNumber": parser_worker.get("techNumber") if parser_worker else "",
            "selectedWorker": parser_worker.get("name") if parser_worker else "",
            "passed": parser_ok,
        },
        "case378035Regression": regression,
        "stats": payload.get("stats") or {},
        "errors": [],
    }

    print("\nFinal audit:")
    print(json.dumps(audit, indent=2))

    confirmation = input(
        "\nType WRITE to back up and replace the Ceramist cache: "
    ).strip()
    if confirmation != "WRITE":
        print("No Drive file was changed.")
        return

    source_meta = drive.files().get(
        fileId=cache_id,
        fields="id,name",
    ).execute()
    source_name = clean(source_meta.get("name")) or "ceramist_remake_preview_cache.json"
    stem = source_name[:-5] if source_name.lower().endswith(".json") else source_name
    backup_name = f"{stem}.backup-{timestamp}.json"

    backup = drive.files().copy(
        fileId=cache_id,
        body={"name": backup_name},
        fields="id,name,webViewLink",
    ).execute()
    updated = upload_json_to_existing_file(drive, cache_id, payload)
    audit_file = create_json_file(
        drive,
        f"ceramist_invoice_note_backfill_audit_{timestamp}.json",
        audit,
    )

    print("Backup created:", backup)
    print("Updated:", updated)
    print("Audit created:", audit_file)
    print("Invoice Notes backfill complete.")
    print("MT_CERAMIST_REMAKE_CACHE_FILE_ID =", cache_id)


if __name__ == "__main__":
    main()
