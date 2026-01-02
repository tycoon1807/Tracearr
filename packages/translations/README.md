# @tracearr/translations

Shared i18n for Tracearr web and mobile apps. Built on [i18next](https://www.i18next.com/).

## Quick Start

```tsx
import { initI18n, useTranslation } from '@tracearr/translations';

// Initialize once at app startup
await initI18n();

// Use in components
function SaveButton() {
  const { t } = useTranslation();
  return <button>{t('common.actions.save')}</button>;
}
```

## Namespaces

Translations are split into namespaces:

| Namespace       | What's in it                        |
| --------------- | ----------------------------------- |
| `common`        | Buttons, states, errors, validation |
| `rules`         | Rule types and descriptions         |
| `sessions`      | Playback states, quality labels     |
| `notifications` | Toasts and alerts                   |
| `settings`      | Settings page UI                    |
| `nav`           | Navigation menu                     |

Switch namespaces with the hook:

```tsx
const { t } = useTranslation('rules');
t('types.impossible_travel'); // "Impossible Travel"
```

## Pluralization

Use `count` for plurals:

```tsx
t('common.count.user', { count: 1 }); // "1 user"
t('common.count.user', { count: 5 }); // "5 users"
```

Available: `user`, `session`, `stream`, `server`, `rule`, `violation`, `item`, `result`, `selected`.

## Formatting

Locale-aware formatting utilities:

```tsx
import { formatDate, formatRelativeTime, formatBytes } from '@tracearr/translations';

formatDate(new Date(), 'long'); // "January 2, 2026"
formatRelativeTime(Date.now() - 3600000); // "1 hour ago"
formatBytes(1536000); // "1.5 MB"
```

Also: `formatTime`, `formatDateTime`, `formatDuration`, `formatNumber`, `formatPercent`, `formatBitrate`.

## Language Detection

Detects user language automatically:

1. Stored preference (localStorage on web, AsyncStorage on mobile)
2. Browser/device language
3. Falls back to English

```tsx
import { detectLanguage, changeLanguage, languageNames } from '@tracearr/translations';

const lang = await detectLanguage();
await changeLanguage('es');

// Build a language picker
Object.entries(languageNames).map(([code, name]) => ({ code, name }));
```

## Adding a New Language

1. Copy the template folder:

   ```bash
   cp -r src/locales/_template src/locales/es
   ```

2. Translate all JSON files in your new folder. Keep the keys, translate the values.

3. Import in `src/config.ts`:

   ```typescript
   import commonEs from './locales/es/common.json' with { type: 'json' };
   import rulesEs from './locales/es/rules.json' with { type: 'json' };
   // ... all namespaces
   ```

4. Add to the `resources` object:

   ```typescript
   export const resources = {
     en: { ... },
     es: {
       common: commonEs,
       rules: rulesEs,
       // ... all namespaces
     },
   };
   ```

5. Add the display name in `src/language.ts`:

   ```typescript
   export const languageNames = {
     en: 'English',
     es: 'Español',
   };
   ```

6. Build and verify:
   ```bash
   pnpm build && pnpm typecheck
   ```

## Translation Guidelines

- Keep interpolation variables: `{{name}}`, `{{count}}`
- Plurals use `_one` and `_other` suffixes
- Don't translate unit abbreviations (km, MB, etc.)
- Match the tone of existing translations

## Type Safety

The package provides full TypeScript support. Typos in translation keys show up as build errors:

```tsx
t('common.actions.svae'); // Error: typo caught at build time
```

## Files

```
src/
├── config.ts      # i18next setup
├── language.ts    # Detection and switching
├── formatting.ts  # Date/number utilities
├── types.ts       # TypeScript definitions
├── index.ts       # Public API
└── locales/
    ├── en/        # English (source of truth)
    └── _template/ # Copy this for new languages
```
