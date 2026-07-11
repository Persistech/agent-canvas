# Quint scenario mutation report

Date: 2026-07-11
Quint: `@informalsystems/quint@0.32.0`

The repository does not currently provide an automated Quint mutation-testing
tool. Four targeted semantic mutants were applied to temporary copies of
`backend_management.qnt`, and the desired-behavior scenario suite was run
against each copy.

| Mutant | Behavioral change                                                   | Killing scenario                                    | Result |
| ------ | ------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| M1     | Adding a backend keeps the old active selection                     | `bm001AddAutoSwitchTest`                            | Killed |
| M2     | Switching retains visible data owned by the old backend             | `bm002SwitchPreservesSectionAndClearsStaleDataTest` | Killed |
| M3     | Active removal prefers Cloud instead of a remaining Local backend   | `bm003ActiveRemovalUsesLocalFallbackTest`           | Killed |
| M4     | Removing the final active backend succeeds and selects `NO_BACKEND` | `bm003LastActiveBackendRemovalFailsTest`            | Killed |

Mutation score: **4/4 killed (100%)**.

This is focused semantic mutation analysis, not an exhaustive mutation pass.
The selected mutations correspond to every externally observable rule in
BM-001..BM-003 and to both current-code findings documented in `CHANGELOG.md`.
