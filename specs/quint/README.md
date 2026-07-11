# Agent Canvas Quint specifications

This directory contains executable formal models written in
[Quint](https://quint-lang.org/). The first model covers the backend registry,
selection, navigation-section preservation, and backend-scoped data ownership
defined by [`../backend-management.md`](../backend-management.md).

The model is intentionally bounded: three backend identities and four UI
sections are enough to explore registration order, Local-versus-Cloud fallback,
selection changes, and stale-data interleavings without modeling HTTP or React.

## Files

| File                                   | Purpose                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `backend_management.qnt`               | Desired BM-001..BM-003 state machine, invariants, `init`, and nondeterministic `step` |
| `backend_management_tests.qnt`         | Six deterministic desired-behavior scenarios                                          |
| `backend_management_current.qnt`       | Analysis model of the current first-entry/no-backend fallback                         |
| `backend_management_current_tests.qnt` | Two deterministic counterexample witnesses for BM-003                                 |
| `QUINT_PLAN.md`                        | Scope, abstraction choices, and proposed next milestones                              |
| `CHANGELOG.md`                         | Pending discrepancies, dated model changes, and fixes verified by the specs           |
| `MUTATION_REPORT.md`                   | Targeted semantic-mutation evidence for the scenario suite                            |

The desired model and the current-code analysis are separate on purpose. A
passing current-code witness means the undesirable state is reachable; it does
not mean BM-003 is satisfied.

## Authoring references

The file structure and modeling style follow:

- [Ray Myers's Quint authoring prompt](https://gist.github.com/raymyers/7066fb7ebef80df48d48516f3314d663): State records, pure transition functions, thin actions, pre-populated maps, separate scenario modules, and simulation before bounded verification.
- [OpenHands Runtime API PR #487](https://github.com/OpenHands/runtime-api/pull/487) and its [spec changelog](https://github.com/OpenHands/runtime-api/blob/7cf26027c6589279d6e1672274ecdc445b02644f/spec/CHANGELOG.md): README/plan/changelog documentation, explicit race-analysis models, deterministic witnesses, and CI simulation.

This suite improves one reproducibility gap in the example by pinning the Quint
version and type-checking every executable `.qnt` file in CI.

`CHANGELOG.md` follows the Runtime API convention: pending discrepancies and
unmodeled milestones come first, then dated entries appear newest first. When a
pending item is resolved, move it into a new dated entry with links to the
implementation and verification evidence. This is a formal-spec research log,
separate from Agent Canvas product release notes.

## Tool version

All commands and CI pin `@informalsystems/quint` **0.32.0**. Node.js 22.12 or
later matches this repository's supported toolchain.

## Run locally

Type-check every executable file:

```bash
npx --yes @informalsystems/quint@0.32.0 typecheck specs/quint/backend_management.qnt
npx --yes @informalsystems/quint@0.32.0 typecheck specs/quint/backend_management_tests.qnt
npx --yes @informalsystems/quint@0.32.0 typecheck specs/quint/backend_management_current.qnt
npx --yes @informalsystems/quint@0.32.0 typecheck specs/quint/backend_management_current_tests.qnt
```

Run deterministic scenarios:

```bash
npx --yes @informalsystems/quint@0.32.0 test \
  specs/quint/backend_management_tests.qnt \
  --main=backend_management_tests --match='.*Test'

npx --yes @informalsystems/quint@0.32.0 test \
  specs/quint/backend_management_current_tests.qnt \
  --main=backend_management_current_tests --match='.*Test'
```

Explore randomized traces while checking every desired safety property:

```bash
npx --yes @informalsystems/quint@0.32.0 run \
  specs/quint/backend_management.qnt \
  --main=backend_management \
  --invariant=allSafetyProperties \
  --max-steps=30 --max-samples=1000
```

Run bounded verification with Apalache when Java is available:

```bash
npx --yes @informalsystems/quint@0.32.0 verify \
  specs/quint/backend_management.qnt \
  --main=backend_management \
  --invariant=allSafetyProperties \
  --max-steps=12
```

Random simulation can find counterexamples but is not a proof. Bounded
`verify` explores the configured finite model exhaustively up to the supplied
step bound.

## Safety properties

- Registry entries are known and unique while preserving insertion order.
- The active backend is always present and registered.
- Data is either absent during a switch or owned by the active backend.
- Adding a backend selects it without changing the current UI section.
- Switching backends preserves the section and clears stale backend data.
- Removing the active backend selects the first remaining Local backend; if no
  Local fallback exists, the desired transition is rejected.

## Implementation correspondence

- Registry resolution: `src/api/backend-registry/active-store.ts`
- Add/update/remove behavior: `src/contexts/active-backend-context.tsx`
- Section-preserving switch: `src/components/features/backends/backend-selector.tsx`
- Existing behavioral tests: `__tests__/api/backend-registry/active-store.test.ts`,
  `__tests__/contexts/active-backend-context.test.tsx`, and
  `__tests__/components/backends/backend-selector.test.tsx`

Quint deliberately abstracts away React rendering, localStorage serialization,
HTTP payloads, secrets, and concrete URL strings. Those remain covered by the
ordinary TypeScript and browser tests.
