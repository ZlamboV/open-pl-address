# Contributing to `open-pl-address`

Thank you for your interest in contributing to `open-pl-address`! We welcome contributions to our database pipeline, client SDKs (TypeScript and C#), MCP server, documentation, and recipes.

---

## Code of Conduct
Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Development Setup

### Prerequisites
- Node.js 22+ (for TypeScript execution via `node --experimental-strip-types`)
- (Optional) .NET 8 SDK for building and testing the C# SDK

### Getting Started
```bash
# Clone the repository
git clone https://github.com/open-pl-address/open-pl-address.git
cd open-pl-address

# Build the demo seed database
npm run build:seed

# Run the test suite
npm test
```

---

## Pull Request Guidelines
1. **Micro-Commits**: Keep commits concise and meaningful following Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).
2. **Test Coverage**: Any new feature or bug fix must include automated tests in `packages/ts-sdk/tests` and/or `packages/csharp-sdk/OpenPlAddress.Sdk.Tests`.
3. **No External Network Dependencies in SDK**: Keep client SDKs zero-dependency and embedded. All database lookups must run in-process via SQLite.
4. **License**: By contributing, you agree that your contributions will be licensed under the MIT License.
