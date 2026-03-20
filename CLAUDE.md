# NeoCEG Project Guidelines

## Project Overview

NeoCEG is a modern reimplementation of CEGTest, a Cause-Effect Graph test design tool.
Built from scratch with React Flow for graph editing, TypeScript for type safety.

**Development Approach**: New implementation (not refactoring CEGTest 1.6 source code).
The clear requirements specification enables a clean architecture without legacy constraints.

**Reference**: Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4

## Architecture

```
src/
  components/     # React components
  hooks/          # Custom React hooks
  services/       # Business logic (DSL parser, decision table calculator)
  types/          # TypeScript type definitions
  i18n/           # Internationalization (EN/JA)
```

## Development Commands

- **Dev server**: `npm run dev`
- **Build**: `npm run build` (runs `tsc -b` then `vite build`)
- **Lint**: `npm run lint`
- **Test**: `npx vitest run` (single run) / `npm test` (watch mode)
- **Type check only**: `tsc -b --noEmit`

Before committing:
1. `npx vitest run` — all tests must pass
2. `npm run lint` — no lint errors
3. `npm run build` — build must succeed

## Specifications

Detailed specifications are maintained in `Doc/`. Always refer to these documents as the source of truth — not the source code.

| Question | Document |
|----------|----------|
| DSL syntax, parsing rules, keywords | [DSL_Grammar_Specification.md](Doc/DSL_Grammar_Specification.md) |
| Node model, constraints, functional requirements | [Requirements_Specification.md](Doc/Requirements_Specification.md) |
| UI behavior, keyboard shortcuts, context menus | [GUI_Specification.md](Doc/GUI_Specification.md) |
| Decision table algorithm, coverage calculation | [Algorithm_Design.md](Doc/Algorithm_Design.md) |
| Security policy, CSP, input validation | [Security_Design.md](Doc/Security_Design.md) |

## Documentation Standards

### Language Policy

| What you are writing | Language |
|----------------------|----------|
| Source code comments | English |
| Commit messages | English |
| YAML requirements data | English |
| Markdown specifications (`Doc/`) | Bilingual (English + Japanese) |
| Code review discussion | Japanese |
| DSL keywords in code | English only (`AND`, `OR`, `NOT`, etc.) |
| UI strings (i18n) | Both EN and JA via i18next |

### Requirements Documents
- Data: YAML files in `Doc/requirements/`
- View: Markdown files referencing YAML
- Traceability: mermaid diagrams for visual review

### Writing Style (Value Engineering)
- User Requirements: Task expressions ("Review the graph")
- System Requirements: Verb + Object ("Create a node on canvas")
- Rule Scenarios: Context → Action → Outcome

## Code Standards

### TypeScript
- Strict mode enabled
- No `any` types except for external library interfaces
- Prefer interfaces over type aliases for object shapes

### React
- Functional components only
- Use custom hooks for reusable logic
- React Flow for graph rendering

### Testing
- Unit tests for DSL parser and decision table calculator
- Component tests for critical UI interactions

## Internationalization

- UI: English and Japanese
- Use i18next for translation
- DSL keywords: English only (no localization)

## Security

### Policy
- Follow OWASP Top 10 (latest version) guidelines
- See `Doc/Security_Design.md` for detailed security design

### Key Rules
- **Never use `eval()` or `Function()` with user input**
- **Never use `dangerouslySetInnerHTML` with user input**
- Validate all DSL input through parser (no direct execution)
- Sanitize node labels before rendering
- Keep dependencies updated (`npm audit`)

### Vercel Best Practices
- Security headers configured in `vercel.json`
- HTTPS enforced (automatic)
- No secrets in code (use environment variables)

### AI-Generated Code Risks
When using AI assistance for code generation:
- **Verify all suggested dependencies** before installing (check npm registry, GitHub stars, last update date)
- **Never blindly trust AI-suggested URLs or external resources**
- **Review generated code for injection vulnerabilities** (eval, innerHTML, SQL, shell commands)
- **Check for supply chain attacks** - verify package names are spelled correctly (typosquatting)
- **Validate security-sensitive logic** - authentication, authorization, encryption
- Be aware of **prompt injection** in any user input that may be processed by AI

## Licensing

### Project License
- NeoCEG is released under the **MIT License**
- All contributions must be MIT-compatible

### Dependency License Policy
**CRITICAL**: Before adding any new dependency:
1. **Check the license** - Only MIT, Apache-2.0, BSD, ISC, or similarly permissive licenses are allowed
2. **Avoid GPL/LGPL/AGPL** - These are NOT compatible with MIT for this project
3. **Record in requirements spec** - All dependencies must be listed in `Doc/requirements/system_requirements.yaml`
4. **Verify package authenticity** - Check npm registry, GitHub stars, last update date to avoid typosquatting

### Prohibited
- GPL, LGPL, AGPL licensed code (copyleft is incompatible)
- Code copied from Stack Overflow without license verification
- Proprietary or unlicensed code
- Dependencies with unclear or missing licenses

### Current Dependencies (MIT-compatible)
See `Doc/requirements/system_requirements.yaml` for the full list with license information.

## Git Workflow

- Main branch: `master`
- Commit messages: English, descriptive
- AI-assisted commits must include:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
