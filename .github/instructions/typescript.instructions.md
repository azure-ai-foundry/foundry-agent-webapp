---
description: TypeScript and React coding standards
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript Instructions

**Goal**: Write type-safe React components with proper MSAL integration

## TypeScript Config

**Enable**: Strict mode + explicit types (avoid `any`, use `unknown`)

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## React Components

**Use**: Functional components + hooks + typed props

```typescript
interface MessageProps {
  message: string;
  sender: 'user' | 'agent';
}

function Message({ message, sender }: MessageProps) {
  return <div className={`msg-${sender}`}>{message}</div>;
}
```

## MSAL Pattern

**Always**: Try silent first, fallback to popup

```typescript
try {
  const { accessToken } = await instance.acquireTokenSilent({
    ...tokenRequest,
    account: accounts[0]
  });
  return accessToken;
} catch {
  const { accessToken } = await instance.acquireTokenPopup(tokenRequest);
  return accessToken;
}
```

## API Calls

**Always**: Include `Authorization` header + use `async/await`

```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

if (!response.ok) throw new Error(`API error: ${response.status}`);
```

## Environment Variables

**Critical**: Access at module level only (build-time replacement)

```typescript
// ✅ Correct - module level
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;

// ❌ Wrong - inside function
function getClientId() {
  return import.meta.env.VITE_ENTRA_CLIENT_ID; // Won't work after build
}
```

## State Management

**Use**: `useState` (local) or Context API (shared)

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
```

## Hooks Rules

- ✅ Call at top level only
- ✅ Name custom hooks with `use` prefix
- ❌ Never call conditionally or in loops

## npm Dependencies

**React 19**: Use `--legacy-peer-deps` flag

```bash
npm install --legacy-peer-deps
```

**Custom Registries**: Add `.npmrc` to `frontend/` directory

## Common Mistakes

- Accessing `import.meta.env.*` in functions  
- Calling hooks conditionally  
- Using `any` type  
- Storing tokens in component state  
- Forgetting error boundaries  
- Running `npm install` without `--legacy-peer-deps`
