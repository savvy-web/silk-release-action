# Glossary

* [byte-group](byte-group.md) - A set of registries sharing one build directory because their published bytes are identical — the unit publish and release actually pack and asset-name by, not a per-registry publish dir.
* [characterization test](characterization-test.md) - A test marked CHARACTERIZATION that pins what the code does today rather than what it should do, names the issue, and is written to fail — not to be deleted — when the fix lands.
* [github-only](github-only.md) - A workspace that resolved zero publish targets — versioned, tagged and released on GitHub, published nowhere, and the intended steady state, not a degraded release.
