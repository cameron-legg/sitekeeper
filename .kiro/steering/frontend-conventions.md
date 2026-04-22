---
inclusion: always
---

# Frontend Conventions

## Key rules

### Navigation
- `RootNavigator` switches between `AuthStack` and `AppStack` based on `useAuthStore().token`
- **Never** call `navigation.reset()` after login/logout — just update the auth store and the navigator reacts automatically
- Use `navigationRef` (from `src/navigation/navigationRef.ts`) for navigation outside components (e.g. 401 interceptor)

### API calls
- All API calls go through `src/api/client.ts` (Axios with auth interceptor)
- Use TanStack Query hooks from `src/api/hooks/` — never call `apiClient` directly in screens
- Query keys follow the pattern: `['resource']`, `['resource', id]`, `['resource', id, 'sub-resource']`
- Always invalidate the correct query keys in `onSuccess` of mutations

### Cross-platform compatibility
- **Never use `Alert.prompt`** — it is iOS-only and silently does nothing on Android/web
- Use a `Modal` + `TextInput` instead (see `HomeScreen.tsx` for the pattern)
- Test UI on Android or web, not just iOS simulator

### Environment variables
- Expo bakes `EXPO_PUBLIC_*` vars into the bundle at build time
- After changing `frontend/.env`, always restart Expo with `--clear` to pick up changes
- For physical device testing: set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, not `localhost`

### State management
- **Server state**: TanStack Query (all API data)
- **Client state**: Zustand auth store only (`token`, `userId`)
- Do not put server-derived data in Zustand

## Adding a new screen
1. Add the screen name and params to `src/navigation/types.ts` (`RootStackParamList`)
2. Create the screen file in `src/screens/auth/` or `src/screens/app/`
3. Register it in `src/navigation/RootNavigator.tsx`
4. Create any needed hooks in `src/api/hooks/`

## Component patterns
- `MarkdownEditor` — edit/preview toggle for note bodies; use `react-native-markdown-display` for rendering
- `LineItemEditor` — collapsible card for a single line item with its material/hours entries; handles add/edit/delete entries inline
- Modals for create/edit flows use `animationType="fade"` for simple dialogs and `animationType="slide"` for full-screen forms
