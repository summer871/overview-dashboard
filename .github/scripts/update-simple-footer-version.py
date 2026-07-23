from __future__ import annotations

import re
from pathlib import Path

INDEX_PATH = Path('Index.html')
VERSION = 'v6.528'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}. No file was changed.')
    return text.replace(old, new, 1)


def main() -> None:
    original = INDEX_PATH.read_text(encoding='utf-8')
    text = original

    text = replace_once(
        text,
        "#remakeFactorPage.cleanRemakeV6230 .remakeWorkerFooterStampV6367::after { content:'•'; display:inline-block; margin-left:8px; color:#c1c7d0; }",
        "#remakeFactorPage.cleanRemakeV6230 .remakeWorkerFooterStampV6367::after, #remakeFactorPage.cleanRemakeV6230 .remakeMainFooterStampV6367::after { content:'•'; display:inline-block; margin-left:8px; color:#c1c7d0; }",
        'footer separators',
    )

    text = replace_once(
        text,
        "#remakeFactorPage.cleanRemakeV6230 .remakeWorkerFooterStampV6367::after{display:none!important;}",
        "#remakeFactorPage.cleanRemakeV6230 .remakeWorkerFooterStampV6367::after,#remakeFactorPage.cleanRemakeV6230 .remakeMainFooterStampV6367::after{display:none!important;}",
        'mobile footer separators',
    )

    text = replace_once(
        text,
        '<span id="remakeCeramistStatusV6342" class="remakeRefreshStamp remakeFooterStampV6338 remakeWorkerFooterStampV6367" title="This is when the worker cache was rebuilt, not the latest case invoice date.">Worker cache: not loaded</span>\n          <span id="remakeLastRefresh" class="remakeRefreshStamp remakeFooterStampV6338 remakeMainFooterStampV6367">${escV6230(uiV6230.lastStamp || \'Not loaded\')}</span>',
        '<span id="remakeCeramistStatusV6342" class="remakeRefreshStamp remakeFooterStampV6338 remakeWorkerFooterStampV6367" title="Worker data time.">Worker: Not loaded</span>\n          <span id="remakeLastRefresh" class="remakeRefreshStamp remakeFooterStampV6338 remakeMainFooterStampV6367" title="Main data time.">${escV6230(uiV6230.lastStamp || \'Cache: Not loaded\')}</span>\n          <span class="remakeRefreshStamp remakeFooterStampV6338 remakeVersionFooterStampV6528" title="Dashboard frontend version.">Version: ' + VERSION + '</span>',
        'footer markup',
    )

    text = replace_once(
        text,
        "ceramistStateV6342.statusText = 'Worker cache updated: ' + (stamp ? ceramistCacheStampV6342(stamp) : 'date unavailable') + (fromBrowser ? ' · saved browser copy' : ' · nightly source');",
        "ceramistStateV6342.statusText = 'Worker: ' + (stamp ? ceramistCacheStampV6342(stamp) : 'Unavailable');",
        'worker normal timestamp',
    )

    text = replace_once(
        text,
        "setCeramistStatusTextV6364('Worker cache updated: ' + (stamp ? ceramistCacheStampV6342(stamp) : 'date unavailable') + ' · saved copy is current');",
        "setCeramistStatusTextV6364('Worker: ' + (stamp ? ceramistCacheStampV6342(stamp) : 'Unavailable'));",
        'worker cached timestamp',
    )

    text = replace_once(
        text,
        "setStampV6230((fromBrowser ? 'Browser cache: ' : 'Last refreshed: ') + (stamp || 'Loaded'));",
        "setStampV6230('Cache: ' + (stamp || 'Loaded'));",
        'main timestamp',
    )

    text = replace_once(
        text,
        "setStampV6230('Browser cache current: ' + (stamp || 'verified'));",
        "setStampV6230('Cache: ' + (stamp || 'Verified'));",
        'main verified timestamp',
    )

    if text.count('Version: ' + VERSION) != 1:
        raise SystemExit('Version label validation failed. No file was changed.')
    if text.count("'Worker: '") < 2 or text.count("'Cache: '") < 2:
        raise SystemExit('Simple timestamp wording validation failed. No file was changed.')

    before_markers = {
        'style_open': len(re.findall(r'<style\\b', original, flags=re.I)),
        'style_close': len(re.findall(r'</style>', original, flags=re.I)),
        'script_open': len(re.findall(r'<script\\b', original, flags=re.I)),
        'script_close': len(re.findall(r'</script>', original, flags=re.I)),
        'apps_script_print': original.count('<?='),
        'apps_script_code': original.count('<?'),
    }
    after_markers = {
        'style_open': len(re.findall(r'<style\\b', text, flags=re.I)),
        'style_close': len(re.findall(r'</style>', text, flags=re.I)),
        'script_open': len(re.findall(r'<script\\b', text, flags=re.I)),
        'script_close': len(re.findall(r'</script>', text, flags=re.I)),
        'apps_script_print': text.count('<?='),
        'apps_script_code': text.count('<?'),
    }
    if before_markers != after_markers:
        raise SystemExit(f'Structural marker counts changed: {before_markers} -> {after_markers}. No file was changed.')

    INDEX_PATH.write_text(text, encoding='utf-8', newline='\n')
    print(f'Updated footer timestamps and added Version: {VERSION}.')


if __name__ == '__main__':
    main()
