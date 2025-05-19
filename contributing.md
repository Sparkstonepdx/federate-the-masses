# Contributing to Federate the Masses

Thank you for your interest in contributing!

**Federate the Masses** is a local-first, federated application framework. It's modular, schema-driven, and designed for secure peer-to-peer data sharing. The project is in active early development — all forms of feedback, testing, and collaboration are welcome.

---

## 📦 Project Structure

This is a **monorepo managed with [pnpm](https://pnpm.io/)**. Key directories:

- **`packages/experiments/`**  
  A self-contained workspace for development and prototyping.

  - `lib/`: Core framework logic — federation engine, record store, schema handling, sync DAG, etc.
  - `src/`: Basic frontend interface (e.g. Vite/TypeScript UI).
  - `public/`: Static assets.
  - `sync.md` & `sync.pdf`: Federation design overview and diagrams.

- **`readme.md`, `roadmap.md`**  
  Project overview and goals.

- **`docs/`** _(planned)_  
  Will include API references, usage examples, and architecture documentation.

---

## 🧪 Getting Started

1. **Clone the repo**:

   ```bash
   git clone https://github.com/yourusername/federate-the-masses.git
   cd federate-the-masses
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Run the example app**:

   ```bash
   pnpm --filter experiments dev
   ```

4. **Run tests** (located in `lib/*.test.ts`):

   ```bash
   pnpm --filter experiments test
   ```

---

## ✅ Contribution Guidelines

- Open an issue first if you're proposing a major change.
- Keep PRs focused — ideally one feature or fix at a time.
- Add or update tests for new behavior.
- Use descriptive commit messages.
- Stick to the current TypeScript and formatting conventions.

---

## 💡 Contribution Ideas

- Improve federation logic or DAG sync edge cases
- Expand schema and record features
- Create new mock data or example object types
- Help document API methods and federation architecture
- Create a real-world demo app in `examples/`
- Improve test coverage or refactor test structure

---

## 🧑‍🤝‍🧑 Community Standards

All contributors are expected to follow our [Code of Conduct](./code_of_conduct.md).
We are committed to fostering a welcoming, respectful, and harassment-free environment.

---

## 📄 License

This project is licensed under the **AGPL-3.0**.
A documented API is provided to support integration and plugin development without tightly coupling external systems to the core.

By submitting a contribution, you agree that it will be licensed under the same terms.

---

Thanks for helping build the foundations of federated, user-controlled software.
