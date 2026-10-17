"""Normalize Windows aapt2 asset entry separators before alignment/signing."""
from pathlib import Path
import sys
import zipfile

apk = Path(sys.argv[1])
temp = apk.with_suffix('.normalized.apk')
with zipfile.ZipFile(apk) as source, zipfile.ZipFile(temp, 'w') as target:
    for item in source.infolist():
        payload = source.read(item)
        item.filename = item.filename.replace('\\', '/')
        target.writestr(item, payload)
temp.replace(apk)
