---
"@savvy-web/silk-release-action": patch
---

## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/pnpm-plugin-effect | config | updated | 0.7.6 | 0.8.3 |
| @savvy-web/pnpm-plugin-silk | config | updated | 0.34.3 | 0.37.0 |
| @savvy-web/silk-effects | dependency | updated | ^7.5.2 | ^8.0.1 |
| @okfit/plugin | devDependency | added | — | ^0.3.3 |
| @savvy-web/github-action-builder | devDependency | updated | ^2.3.4 | ^2.3.6 |
| @savvy-web/silk | devDependency | updated | ^3.15.2 | ^4.0.1 |
| @vitest-agent/plugin | devDependency | updated | ^3.0.2 | ^4.0.0 |

## Other

- `effect` moves to `4.0.0-rc.115` through the `@effected` catalog; `Config.mapOrFail` became `Config.mapEffect` on the rc line
- The JSON Schema generator pins `onExcessProperty: "error"` so the published documents stay closed after rc.113 flipped core's default open — the committed schemas are unchanged
- The vendored `.repos/effect` reference is repinned to `effect@4.0.0-rc.115`
