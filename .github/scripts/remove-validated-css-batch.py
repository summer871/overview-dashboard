from __future__ import annotations

import hashlib
import re
from pathlib import Path

INDEX_PATH = Path("Index.html")
REPORT_PATH = Path("CSS_BATCH_CLEANUP_REPORT.md")
EXPECTED_SHA256 = "8d5ffa18e86276dda25fb85c444cb239efe592f0d9590ecd12a3a4071cfef894"
TARGETS = [
    (41927, "#tatTabFilterHostV6509 .remakeDropdownButtonV6245::after"),
    (41928, "#tatTabFilterHostV6509 .remakeDropdownButtonV6245:hover, #tatTabFilterHostV6509 .remakeDropdownButtonV6245.active"),
    (41930, "#tatTabFilterHostV6509 .remakeDropdownButtonV6245.active"),
    (41948, "#tatTabFilterHostV6509 .remakeDropdownHeaderV6245 button"),
    (41950, "#tatTabFilterHostV6509 .remakeDropdownSearchV6245"),
    (41951, "#tatTabFilterHostV6509 .remakeDropdownSearchV6245:focus"),
    (41952, "#tatTabFilterHostV6509 .remakeDropdownListV6245"),
    (41953, "#tatTabFilterHostV6509 .remakeDropdownRowV6245"),
    (41954, "#tatTabFilterHostV6509 .remakeDropdownRowV6245:hover, #tatTabFilterHostV6509 .remakeDropdownRowV6245.active"),
    (41956, "#tatTabFilterHostV6509 .remakeDropdownRowV6245 input"),
    (41957, "#tatTabFilterHostV6509 .remakeDropdownLabelV6245"),
    (41958, "#tatTabFilterHostV6509 .remakeDropdownOnlyV6245"),
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def declarations(body: str) -> dict[str, bool]:
    result = {}
    for part in body.split(";"):
        if ":" not in part:
            continue
        name, value = part.split(":", 1)
        name = name.strip().lower()
        if name and not name.startswith("@"):
            result[name] = bool(re.search(r"!important\s*$", value, re.I))
    return result


def style_rules(text: str) -> list[dict]:
    rules = []
    for style in re.finditer(r"<style\b[^>]*>(.*?)</style>", text, re.I | re.S):
        css = style.group(1)
        offset = style.start(1)
        depth = 0
        start = 0
        quote = None
        comment = False
        i = 0
        while i < len(css):
            if comment:
                if css.startswith("*/", i):
                    comment = False
                    i += 2
                    continue
                i += 1
                continue
            if quote:
                if css[i] == "\\":
                    i += 2
                    continue
                if css[i] == quote:
                    quote = None
                i += 1
                continue
            if css.startswith("/*", i):
                comment = True
                i += 2
                continue
            if css[i] in ("'", '"'):
                quote = css[i]
                i += 1
                continue
            if css[i] == "{" and depth == 0:
                selector_start = start
                selector = css[selector_start:i].strip()
                open_pos = i
                depth = 1
                i += 1
                while i < len(css) and depth:
                    if css.startswith("/*", i):
                        close_comment = css.find("*/", i + 2)
                        if close_comment < 0:
                            raise SystemExit("Unterminated CSS comment; no file changed.")
                        i = close_comment + 2
                        continue
                    if css[i] in ("'", '"'):
                        q = css[i]
                        i += 1
                        while i < len(css):
                            if css[i] == "\\":
                                i += 2
                                continue
                            if css[i] == q:
                                i += 1
                                break
                            i += 1
                        continue
                    if css[i] == "{":
                        depth += 1
                    elif css[i] == "}":
                        depth -= 1
                    i += 1
                close_pos = i - 1
                if selector and not selector.startswith("@"):
                    raw_start = selector_start
                    while raw_start < open_pos and css[raw_start] in "\r\n":
                        raw_start += 1
                    rules.append({
                        "selector": normalize(selector),
                        "start": offset + raw_start,
                        "open": offset + open_pos,
                        "close": offset + close_pos,
                        "body": css[open_pos + 1:close_pos],
                    })
                start = i
                continue
            if css[i] == ";" and depth == 0:
                start = i + 1
            i += 1
    return rules


def line_number(text: str, position: int) -> int:
    return text.count("\n", 0, position) + 1


def marker_counts(text: str) -> tuple[int, ...]:
    return (
        len(re.findall(r"<style\b", text, re.I)),
        len(re.findall(r"</style>", text, re.I)),
        len(re.findall(r"<script\b", text, re.I)),
        len(re.findall(r"</script>", text, re.I)),
        text.count("<?="),
        text.count("<?"),
    )


def main() -> None:
    text = INDEX_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"Baseline mismatch: expected {EXPECTED_SHA256}, got {digest}. No file changed.")

    before_markers = marker_counts(text)
    rules = style_rules(text)
    removals = []
    report_rows = []

    for expected_line, selector in TARGETS:
        selector = normalize(selector)
        matches = [r for r in rules if r["selector"] == selector and abs(line_number(text, r["start"]) - expected_line) <= 3]
        if len(matches) != 1:
            raise SystemExit(f"Could not uniquely locate line {expected_line}: {selector}. No file changed.")
        target = matches[0]
        props = declarations(target["body"])
        later = [r for r in rules if r["selector"] == selector and r["start"] > target["close"]]
        replacement_lines = []
        for prop, required_important in props.items():
            covered = False
            for candidate in later:
                candidate_props = declarations(candidate["body"])
                if prop in candidate_props and (not required_important or candidate_props[prop]):
                    covered = True
                    replacement_lines.append(line_number(text, candidate["start"]))
                    break
            if not covered:
                raise SystemExit(f"Later coverage missing for {selector}: {prop}. No file changed.")

        start = text.rfind("\n", 0, target["start"]) + 1
        if text[start:target["start"]].strip():
            start = target["start"]
        end = target["close"] + 1
        while end < len(text) and text[end] in " \t\r":
            end += 1
        if end < len(text) and text[end] == "\n":
            end += 1
        removals.append((start, end))
        report_rows.append((selector, line_number(text, target["start"]), sorted(props), sorted(set(replacement_lines))))

    for start, end in sorted(removals, reverse=True):
        text = text[:start] + text[end:]

    if marker_counts(text) != before_markers:
        raise SystemExit("HTML/template marker counts changed. No file written.")
    if not style_rules(text):
        raise SystemExit("CSS validation returned no rules. No file written.")

    INDEX_PATH.write_text(text, encoding="utf-8", newline="\n")
    result_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    report = [
        "# Validated CSS Batch Cleanup Report",
        "",
        "- Scope: TAT dropdown controls only.",
        f"- Rules removed: {len(report_rows)}",
        f"- Baseline SHA-256: `{digest}`",
        f"- Result SHA-256: `{result_hash}`",
        "- Excluded intentionally: dropdown panel, dropdown header layout, visible-toggle alignment, charts, scripts, HTML, and Apps Script template expressions.",
        "",
        "## Removed rules",
        "",
    ]
    for number, (selector, line, props, replacement_lines) in enumerate(report_rows, 1):
        report.extend([
            f"{number}. `{selector}`",
            f"   - Earlier line: {line}",
            f"   - Properties preserved later: {', '.join(props)}",
            f"   - Replacement line(s): {', '.join(map(str, replacement_lines))}",
        ])
    report.extend(["", "## Structural validation", "", f"- Marker counts unchanged: `{before_markers}`", "- Every removed property has later exact-selector coverage with equal or stronger `!important` status."])
    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8", newline="\n")
    print(f"Removed {len(report_rows)} validated CSS rules.")


if __name__ == "__main__":
    main()
