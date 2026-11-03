---
'@abbottland/fui-components': patch
---

Rebuild the image so `apk upgrade` picks up `libexpat` 2.10.0, which fixes two HIGH CVEs (CVE-2026-117610, CVE-2026-118370) that fail the Trivy scan on the previously published image.
