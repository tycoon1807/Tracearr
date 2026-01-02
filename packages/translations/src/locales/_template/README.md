# Adding a New Language

To add a new language to Tracearr, follow these steps:

## 1. Create the language folder

Copy this entire `_template` folder and rename it to your language code (ISO 639-1):

```bash
cp -r src/locales/_template src/locales/es  # Spanish
cp -r src/locales/_template src/locales/fr  # French
cp -r src/locales/_template src/locales/de  # German
```

## 2. Translate all JSON files

Each JSON file in your new folder needs to be translated. The files are:

| File                 | Description                                         |
| -------------------- | --------------------------------------------------- |
| `common.json`        | Common actions, states, errors, validation messages |
| `rules.json`         | Rule types, descriptions, and form labels           |
| `sessions.json`      | Session states, quality labels, playback info       |
| `notifications.json` | Toast messages, push notifications                  |
| `settings.json`      | Settings page tabs, forms, account labels           |
| `nav.json`           | Navigation menu items                               |

**Important:**

- Keep the same JSON structure and keys
- Only translate the values (right side of `:`)
- Preserve interpolation variables like `{{name}}` and `{{count}}`
- Delete this README.md file from your language folder

## 3. Update the configuration

In `src/config.ts`:

1. Import your translations at the top:

```typescript
import commonEs from './locales/es/common.json' with { type: 'json' };
import rulesEs from './locales/es/rules.json' with { type: 'json' };
import sessionsEs from './locales/es/sessions.json' with { type: 'json' };
import notificationsEs from './locales/es/notifications.json' with { type: 'json' };
import settingsEs from './locales/es/settings.json' with { type: 'json' };
import navEs from './locales/es/nav.json' with { type: 'json' };
```

2. Add to the `resources` object:

```typescript
export const resources = {
  en: { ... },
  es: {
    common: commonEs,
    rules: rulesEs,
    sessions: sessionsEs,
    notifications: notificationsEs,
    settings: settingsEs,
    nav: navEs,
  },
};
```

## 4. Add the display name

In `src/language.ts`, add your language to `languageNames`:

```typescript
export const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Español', // Add this line
};
```

## 5. Build and test

```bash
pnpm build
pnpm typecheck
```

## Language Codes

Use ISO 639-1 two-letter codes:

| Code | Language   |
| ---- | ---------- |
| en   | English    |
| es   | Spanish    |
| fr   | French     |
| de   | German     |
| pt   | Portuguese |
| it   | Italian    |
| ja   | Japanese   |
| zh   | Chinese    |
| ko   | Korean     |
| ru   | Russian    |
| ar   | Arabic     |
| hi   | Hindi      |

## Questions?

Open an issue on GitHub if you need help with translations.
