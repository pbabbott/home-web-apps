---
'@abbottland/yaml-config': patch
'@abbottland/harbor-cleanup': patch
---

Parse `BOOLEAN` environment variables explicitly instead of `Boolean(string)`, where every non-empty value (including `"false"` and `"0"`) was true. Case-insensitive `true`, `1`, `yes`, `on` are true; `false`, `0`, `no`, `off` and empty are false; anything else throws an error naming the variable. `CLEANUP_DRY_RUN: "false"` now really turns harbor-cleanup's dry run off.
