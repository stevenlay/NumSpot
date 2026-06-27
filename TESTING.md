# Testing

## Stack

- **[Vitest](https://vitest.dev/)** — test runner (Vite-native, Jest-compatible API)
- **[React Testing Library](https://testing-library.com/react)** — component rendering and interaction
- **[@testing-library/user-event](https://testing-library.com/docs/user-event/intro)** — realistic user interactions (typing, clicking)
- **[@testing-library/jest-dom](https://github.com/testing-library/jest-dom)** — DOM matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.)

## Running tests

From the `frontend` directory:

```bash
# Watch mode (re-runs on file change)
npm test

# Single run (CI / pre-commit)
npm run test:run
```

## What's covered

### `src/pages/Home.test.tsx`

| Area | Cases |
|------|-------|
| Rendering | Title, slogan |
| Tabs | Create Room active by default, Join Room reveals room code input |
| Name validation | Empty, too short (< 2 chars), invalid characters, error clears on type |
| Room code validation | Empty code when joining |
| Form submission | `connect(name)` on create, `connect(name, code)` on join |
| Server errors | Error message from store renders in alert banner |

## Philosophy

Tests assert **behavior from the user's perspective** — what appears on screen and what happens when the user interacts with it. Implementation details (state shape, internal functions) are not tested directly.

## Adding tests

- Place test files alongside the component they test: `Foo.tsx` → `Foo.test.tsx`
- Mock the game store with `vi.mock('../store/gameStore')` and use a selector-compatible mock (see `Home.test.tsx` for the pattern)
- Wrap components that use routing in `<MemoryRouter>`
