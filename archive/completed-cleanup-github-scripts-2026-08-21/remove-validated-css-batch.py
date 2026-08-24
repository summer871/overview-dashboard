from __future__ import annotations

import hashlib
import re
from pathlib import Path

INDEX_PATH = Path('Index.html')
REPORT_PATH = Path('CSS_BATCH_CLEANUP_REPORT.md')
EXPECTED_SHA256 = '8d5ffa18e86276dda25fb85c444cb239efe592f0d9590ecd12a3a4071cfef894'

TARGETS = [
    (41927, '#tatTabFilterHostV6509 .remakeDropdownButtonV6245::after'),
    (41928, '#tatTabFilterHostV6509 .remakeDropdownButtonV6245:hover, #tatTabFilterHostV6509 .remakeDropdownButtonV6245.active'),
    (41930, '#tatTabFilterHostV6509 .remakeDropdownButtonV6245.active'),
    (41948, '#tatTabFilterHostV6509 .remakeDropdownHeaderV6245 button'),
    (41950, '#tatTabFilterHostV6509 .remakeDropdownSearchV6245'),
    (41951, '#tatTabFilterHostV6509 .remakeDropdownSearchV6245:focus'),
    (41952, '#tatTabFilterHostV6509 .remakeDropdownListV6245'),
    (41953, '#tatTabFilterHostV6509 .remakeDropdownRowV6245'),
    (41954, '#tatTabFilterHostV6509 .remakeDropdownRowV6245:hover, #tatTabFilterHostV6509 .remakeDropdownRowV6245.active'),
    (41956, '#tatTabFilterHostV6509 .remakeDropdownRowV6245 input'),
    (41957, '#tatTabFilterHostV6509 .remakeDropdownLabelV6245'),
    (41958, '#tatTabFilterHostV6509 .remakeDropdownOnlyV6245'),
]


def normalize_selector(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()


def line_starts(text: str) -> list[int]:
    starts = [0]
    starts.extend(match.end() for match in re.finditer(r'\n', text))
    return starts


def skip_comment(text: str, pos: int, end: int) -> int:
    close = text.find('*/', pos + 2, end)
    if close < 0:
        raise RuntimeError('Unterminated CSS comment.')
    return close + 2


def skip_string(text: str, pos: int, end: int) -> int:
    quote = text[pos]
    pos += 1
    while pos < end:
        if text[pos] == '\\':
            pos += 2
            continue
        if text[pos] == quote:
            return pos + 1
        pos += 1
    raise RuntimeError('Unterminated CSS string.')


def find_matching_brace(text: str, open_pos: int, end: int) -> int:
    depth = 1
    pos = open_pos + 1
    while pos < end:
        if text.startswith('/*', pos):
            pos = skip_comment(text, pos, end)
            continue
        if text[pos] in ('"', "'"):
            pos = skip_string(text, pos, end)
            continue
        if text[pos] == '{':
            depth += 1
        elif text[pos] == '}':
            depth -= 1
            if depth == 0:
                return pos
        pos += 1
    raise RuntimeError('Unmatched CSS brace.')


def parse_declarations(body: str) -> dict[str, tuple[bool, str]]:
    declarations: dict[str, tuple[bool, str]] = {}
    token = []
    parts = []
    paren_depth = 0
    pos = 0
    while pos < len(body):
        if body.startswith('/*', pos):
            pos = skip_comment(body, pos, len(body))
            continue
        char = body[pos]
        if char in ('"', "'"):
            end = skip_string(body, pos, len(body))
            token.append(body[pos:end])
            pos = end
            continue
        if char == '(':
            paren_depth += 1
        elif char == ')' and paren_depth:
            paren_depth -= 1
        if char == ';' and paren_depth == 0:
            parts.append(''.join(token))
            token = []
        else:
            token.append(char)
        pos += 1
    if token:
        parts.append(''.join(token))

    for part in parts:
        if ':' not in part:
            continue
        name, value = part.split(':', 1)
        name = name.strip().lower()
        value = value.strip()
        if not name or name.startswith('@'):
            continue
        important = bool(re.search(r'!important\s*$', value, flags=re.I))
        clean_value = re.sub(r'\s*!important\s*$', '', value, flags=re.I).strip()
        declarations[name] = (important, clean_value)
    return declarations


def iter_top_level_rules(css: str, global_offset: int):
    pos = 0
    boundary = 0
    while pos < len(css):
        if css.startswith('/*', pos):
            pos = skip_comment(css, pos, len(css))
            continue
        if css[pos] in ('"', "'"):
            pos = skip_string(css, pos, len(css))
            continue
        if css[pos] == ';':
            boundary = pos + 1
            pos += 1
            continue
        if css[pos] == '{':
            prelude_start = boundary
            prelude = css[prelude_start:pos].strip()
            close = find_matching_brace(css, pos, len(css))
            if prelude and not prelude.startswith('@'):
                raw_start = prelude_start
                while raw_start < pos and css[raw_start] in '\r\n':
                    raw_start += 1
                yield {
                    'selector': normalize_selector(prelude),
                    'start': global_offset + raw_start,
                    'open': global_offset + pos,
                    'close': global_offset + close,
                    'body': css[pos + 1:close],
                }
            boundary = close + 1
            pos = close + 1
            continue
        pos += 1


def all_style_rules(text: str):
    rules = []
    for match in re.finditer(r'<style\b[^>]*>(.*?)</style>', text, flags=re.I | re.S):
        rules.extend(iter_top_level_rules(match.group(1), match.start(1)))
    return rules


def rule_line(text: str, start: int) -> int:
    return text.count('\n', 0, start) + 1


def expand_removal_span(text: str, start: int, close: int) -> tuple[int, int]:
    line_start = text.rfind('\n', 0, start) + 1
    if text[line_start:start].strip() == '':
        start = line_start
    end = close + 1
    while end < len(text) and text[end] in ' \t':
        end += 1
    if end < len(text) and text[end] == '\r':
        end += 1
    if end < len(text) and text[end] == '\n':
        end += 1
    return start, end


def count_markers(text: str) -> dict[str, int]:
    return {
        'style_open': len(re.findall(r'<style\b', text, flags=re.I)),
        'style_close': len(re.findall(r'</style>', text, flags=re.I)),
        'script_open': len(re.findall(r'<script\b', text, flags=re.I)),
        'script_close': len(re.findall(r'</script>', text, flags=re.I)),
        'apps_script_print': text.count('<?='),
        'apps_script_code': text.count('<?'),
    }


def main() -> None:
    raw = INDEX_PATH.read_bytes()
    text = raw.decode('utf-8').replace('\r\n', '\n')
    digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(
            'Index.html does not match the uploaded/current validated baseline. '
            f'Expected {EXPECTED_SHA256}, got {digest}. No file was changed.'
        )

    before_markers = count_markers(text)
    rules = all_style_rules(text)
    indexed = {(rule_line(text, rule['start']), rule['selector']): rule for rule in rules}
    removals = []
    report_rows = []

    for expected_line, expected_selector in TARGETS:
        normalized = normalize_selector(expected_selector)
        rule = indexed.get((expected_line, normalized))
        if rule is None:
            nearby = [
                candidate for candidate in rules
                if candidate['selector'] == normalized
                and abs(rule_line(text, candidate['start']) - expected_line) <= 3
            ]
            if len(nearby) != 1:
                raise SystemExit(
                    f'Could not uniquely locate target at line {expected_line}: {normalized}. '
                    'No file was changed.'
                )
            rule = nearby[0]

        earlier_declarations = parse_declarations(rule['body'])
        if not earlier_declarations:
            raise SystemExit(f'Target has no declarations: {normalized}. No file was changed.')

        later_rules = [
            candidate for candidate in rules
            if candidate['selector'] == normalized and candidate['start'] > rule['close']
        ]
        missing = []
        replacement_lines = []
        for name, (was_important, _) in earlier_declarations.items():
            covered = False
            for later in later_rules:
                later_declarations = parse_declarations(later['body'])
                if name not in later_declarations:
                    continue
                later_important, _ = later_declarations[name]
                if was_important and not later_important:
                    continue
                covered = True
                replacement_lines.append(rule_line(text, later['start']))
                break
            if not covered:
                missing.append(name)

        if missing:
            raise SystemExit(
                f'Validation failed for {normalized}; later coverage missing: {missing}. '
                'No file was changed.'
            )

        start, end = expand_removal_span(text, rule['start'], rule['close'])
        removals.append((start, end))
        report_rows.append({
            'selector': normalized,
            'line': rule_line(text, rule['start']),
            'properties': sorted(earlier_declarations),
            'replacement_lines': sorted(set(replacement_lines)),
            'characters': end - start,
        })

    for start, end in sorted(removals, reverse=True):
        text = text[:start] + text[end:]

    after_markers = count_markers(text)
    if after_markers != before_markers:
        raise SystemExit(
            f'HTML/template marker counts changed: before={before_markers}, after={after_markers}. '
            'No file was written.'
        )

    post_rules = all_style_rules(text)
    if not post_rules:
        raise SystemExit('Post-cleanup CSS parse produced no rules. No file was written.')

    for row in report_rows:
        remaining_early = [
            candidate for candidate in post_rules
            if candidate['selector'] == row['selector']
            and rule_line(text, candidate['start']) <= row['line'] + 2
        ]
        if remaining_early:
            raise SystemExit(
                f'Target still appears near its old location: {row["selector"]}. No file was written.'
            )

    new_text = text
    INDEX_PATH.write_text(new_text, encoding='utf-8', newline='\n')
    new_digest = hashlib.sha256(new_text.encode('utf-8')).hexdigest()
    removed_chars = sum(row['characters'] for row in report_rows)

    report = [
        '# Validated CSS Batch Cleanup Report',
        '',
        '- Scope: TAT dropdown controls only.',
        f'- Rules removed: {len(report_rows)}',
        f'- Characters removed: {removed_chars}',
        f'- Baseline SHA-256: `{digest}`',
        f'- Result SHA-256: `{new_digest}`',
        '- Excluded intentionally: dropdown panel, dropdown header layout, visible-toggle alignment, charts, scripts, HTML, and Apps Script template expressions.',
        '',
        '## Removed rules',
        '',
    ]
    for number, row in enumerate(report_rows, 1):
        report.extend([
            f'{number}. `{row["selector"]}`',
            f'   - Earlier line: {row["line"]}',
            f'   - Properties preserved later: {", ".join(row["properties"])}',
            f'   - Replacement line(s): {", ".join(map(str, row["replacement_lines"]))}',
        ])
    report.extend([
        '',
        '## Structural validation',
        '',
        f'- Marker counts unchanged: `{after_markers}`',
        f'- Parsed top-level CSS rules after cleanup: {len(post_rules)}',
        '- Every removed property was redeclared later by the exact same normalized selector with equal or stronger `!important` status.',
    ])
    REPORT_PATH.write_text('\n'.join(report) + '\n', encoding='utf-8', newline='\n')
    print(f'Removed {len(report_rows)} validated CSS rules; wrote {REPORT_PATH}.')


if __name__ == '__main__':
    main()
