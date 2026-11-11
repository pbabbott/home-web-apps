---
'@abbottland/blog': patch
'@abbottland/diagram-maker': patch
'@abbottland/home-hud': patch
'@abbottland/backup-worker': patch
'@abbottland/fui-components': patch
'@abbottland/next-middleware': minor
'@abbottland/express': minor
'@abbottland/abctl': patch
---

Show the running image tag from the pod's `IMAGE_TAG` env at runtime instead of baking it into the build. The three Next apps get `GET /api/version` (prod / preview / dev, date, PR, sha) and a footer that reads it; the Express services get `GET /version` and log the tag at startup. The build no longer takes `IMAGE_TAG`, so build output is identical for every commit and Turbo's cache hits across builds. Rebuilds every deployed image so each gets a new-shape production tag.
