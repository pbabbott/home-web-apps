---
'@abbottland/fui-components': patch
---

Rebuild the image so `apk upgrade` picks up the fixed `libxslt` (1.1.43-r4), which clears two HIGH CVEs (CVE-2026-87636, CVE-2026-9947) that fail the Trivy scan on the previously published image.
