#!/usr/bin/env python3
"""Verify the built VSIX has exactly the expected content and matching files."""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'package.json').read_text())
archive = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist' / f'{manifest["name"]}-{manifest["version"]}.vsix'
payload = {
    'package.json': 'package.json', 'README.md': 'readme.md',
    'CHANGELOG.md': 'changelog.md', 'LICENSE': 'LICENSE.txt',
    'language-configuration.json': 'language-configuration.json',
    'syntaxes/larp.tmLanguage.json': 'syntaxes/larp.tmLanguage.json',
    'snippets/larp.code-snippets': 'snippets/larp.code-snippets',
}
with zipfile.ZipFile(archive) as vsix:
    names = vsix.namelist()
    expected = {'[Content_Types].xml', 'extension.vsixmanifest'} | {'extension/' + p for p in payload.values()}
    assert len(names) == len(set(names)), 'duplicate archive members'
    assert set(names) == expected, f'Unexpected archive contents: {set(names) ^ expected}'
    assert vsix.testzip() is None, 'corrupt ZIP member'
    for name, packaged_name in payload.items():
        # vsce may normalize README links and package metadata, checked below.
        if name not in {'package.json', 'README.md'}:
            assert vsix.read('extension/' + packaged_name) == (root / name).read_bytes(), name
    packaged = json.loads(vsix.read('extension/package.json'))
    for field in ['name', 'publisher', 'version', 'engines', 'contributes', 'capabilities']:
        assert packaged[field] == manifest[field], field
    assert not packaged.get('main') and not packaged.get('browser'), 'unexpected executable entry'
    xml = ET.fromstring(vsix.read('extension.vsixmanifest'))
    ns = {'v': 'http://schemas.microsoft.com/developer/vsx-schema/2011'}
    identity = xml.find('v:Metadata/v:Identity', ns)
    assert identity is not None
    for field, key in [('Id', 'name'), ('Publisher', 'publisher'), ('Version', 'version')]:
        assert identity.attrib[field] == manifest[key], field
    ET.fromstring(vsix.read('[Content_Types].xml'))
print(f'Validated {archive.name}: {len(payload)} extension files, no bundled dependencies or tests.')
