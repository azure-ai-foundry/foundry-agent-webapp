# Frontend - React + TypeScript + Vite

**Context**: See `.github/copilot-instructions.md` for overall architecture.

This folder contains the single-page chat interface served by the ASP.NET Core backend. Technology stack:

- **React 19** + TypeScript
- **Fluent UI v9** and Fluent Copilot chat components
- **MSAL.js** for authentication (PKCE flow, redirect pattern)
- **Vite** for dev server with HMR

## Architecture

| Concern | Implementation |
|---------|----------------|
| **State Management** | Centralized Context + `useReducer` (`AppContext`) with discriminated action union |
| **Authentication** | MSAL redirect flow; silent token refresh; `useAuth` hook for token acquisition |
| **Chat Streaming** | Server-Sent Events (SSE) in `ChatService` with abort controllers for cancellation |
| **Accessibility** | Live region (`aria-live`) for assistant updates, proper aria labels, focus management |
| **Error Handling** | Error boundary (`ErrorBoundary`) + structured error actions with retry support |
| **Logging** | Dev-only diff-based logger (no verbose production console noise) |
| **Performance** | Memoized message components and stable service instances via `useMemo` |

## Environment Variables

Required at build/runtime (auto-generated in `.env` after `azd up`):

```bash
VITE_ENTRA_SPA_CLIENT_ID=...
VITE_ENTRA_TENANT_ID=...
VITE_API_URL=/api
```

**Critical**: Access `import.meta.env.*` at module level only (not inside functions).

## Key Components

| Component | Purpose |
|-----------|---------||
| `AgentPreview.tsx` | Container wiring chat state to controlled `ChatInterface` |
| `ChatInterface.v2.tsx` | Stateless controlled UI; renders messages, input, errors |
| `chat/AssistantMessage.tsx` | Memoized assistant message with streaming support |
| `chat/UserMessage.tsx` | Memoized user message with image thumbnail previews |
| `chat/ChatInput.tsx` | File uploads (select + paste + drag), character counter, cancel streaming button, focus management |
| `chat/FilePreview.tsx` | Thumbnail preview grid for attached files before sending |
| `core/ErrorBoundary.tsx` | Catches runtime errors and displays fallback UI |
| `core/Markdown.tsx` | Sanitized markdown rendering with syntax highlighting |
| `core/AgentIcon.tsx` | Agent avatar with optional custom logo URL support |

## File Upload Validation

**Limits**: 5MB per file, max 5 files total

**Supported formats**: PNG, JPEG, GIF, WebP

**See**:
- `frontend/src/utils/fileAttachments.ts` for `validateImageFile()` and `validateFileCount()` functions
- `frontend/src/components/chat/ChatInput.tsx` for usage in file select, paste, and drag handlers

**Key points**:
- User-friendly error messages (e.g., "file.jpg is 8.5MB. Maximum file size is 5MB")
- Toast notifications for validation feedback
- Separate validation functions for count and individual files

## Character Counter

**See**: `frontend/src/components/chat/ChatInput.tsx`

**Thresholds**: 3000 (warning), 3500 (danger), 4000 (recommended max)

**Behavior**: 
- Counter appears at 3000+ characters
- Color changes from yellow to orange as limit approaches
- Informational only - doesn't block submission
- Linked to input via `aria-describedby` for accessibility

## Agent Logo Support

**See**: 
- `frontend/src/components/core/AgentIcon.tsx` for logo rendering logic
- `frontend/src/components/AgentPreview.tsx`, `ChatInterface.tsx`, `StarterMessages.tsx`, `AssistantMessage.tsx` for prop threading

**Pattern**: Optional `agentLogo` URL passed through component tree, falls back to default bot icon if not provided.

## MSAL Configuration

**See**: 
- `frontend/src/config/authConfig.ts` for MSAL configuration
- `frontend/src/hooks/useAuth.ts` for token acquisition pattern
- `.github/instructions/typescript.instructions.md` for detailed patterns

**Key points**:
- Environment variables accessed at module level only
- Token acquisition: silent first, fallback to popup
- Authorization header format: `Bearer ${token}`

## Action Flow (Send Message)

```
CHAT_SEND_MESSAGE 
  → CHAT_ADD_ASSISTANT_MESSAGE 
  → CHAT_START_STREAM 
  → (repeat CHAT_STREAM_CHUNK) 
  → CHAT_STREAM_COMPLETE
```

If user cancels: `CHAT_CANCEL_STREAM` sets status back to `idle` and re-enables input.

## Adding a New Feature

1. **Extend state**: Add discriminated action to `AppAction` union in `types/appState.ts`
2. **Handle in reducer**: Update `appReducer.ts` (keep pure, no side effects)
3. **Create service method**: Add to `ChatService` if network interaction needed
4. **Wire container**: Update `AgentPreview.tsx` to dispatch actions
5. **Update UI**: Pass callbacks to controlled component (`ChatInterface.v2.tsx`)
6. **Test**: Validate with local dev and check console diff logs

## Error Handling

All recoverable errors dispatch `CHAT_ERROR` with `AppError` containing:
- Error message
- Optional retry action
- Timestamp

Clear errors with `CHAT_CLEAR_ERROR`.

## Dev Logging

Visible only in development mode. Each state change prints:

```
🔄 [HH:MM:SS] ACTION_TYPE
Action: { … }
Changes: { field: before → after }
```

## Accessibility Checklist

- ✅ Live region announces latest assistant message
- ✅ Live region announces streaming status changes ("Assistant is responding")
- ✅ `aria-busy` attribute on messages container during streaming
- ✅ Buttons have `aria-label` when icon-only
- ✅ Focus returns to input after sending
- ✅ File removal buttons announce target file name
- ✅ Loading states announced to screen readers
- ✅ Character counter linked via `aria-describedby`
- ✅ File preview list has `role="list"` and `aria-label`

## Local Development

Use unified script (recommended):

```powershell
.\deployment\scripts\start-local-dev.ps1
```

Or manually:

```powershell
# Backend
cd backend/WebApp.Api
dotnet run

# Frontend (separate terminal)
cd frontend
npm run dev
```

Open `http://localhost:5173` (Vite proxies `/api` to `http://localhost:8080`).

## Vite Proxy Configuration

```typescript
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
```

## Building for Production

```powershell
npm run build
```

Outputs static assets to `dist/` (copied to `wwwroot` in Docker build).

## Contributing

Follow existing patterns:
- **Controlled components** for UI
- **Context-driven state** management
- **Pure reducer** functions
- **Service isolation** for API calls
- Test streaming scenarios before committing
