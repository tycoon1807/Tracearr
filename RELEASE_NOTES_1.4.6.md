@everyone **HAPPY SATURDAY!**

# Tracearr v1.4.6 - Media Statistics, Public API, Translations, and More!

### Media Statistics

New section under Stats for library insights:

- **Growth** - Track collection expansion over time (movies, episodes, music)
- **Quality Evolution** - Watch the shift from SD to 4K over months/years
- **Storage Trends** - Predictive charts for space planning
- **Codec/Resolution** - HEVC vs H.264 vs AV1, 4K/1080p/720p/SD breakdown
- **Stale Content** - Find unwatched media
- **Most Watched** - Top movies and shows by plays and watch time
- **Duplicates** - Detect duplicate files
- **ROI Analysis** - Storage vs watch time value

Snapshots backfill automatically so charts show historical data immediately.

### Public API

REST API with Bearer token auth, API key management in Settings, and interactive Swagger docs at `/api-docs`.

### Translations

German complete. Frontend and mobile fully internationalized. Infrastructure ready for community contributions.

### Account Inactivity Rules

New rule type that flags users who haven't streamed in a configurable number of days.

### Bulk Actions

Multi-select rows in Violations, Users, Rules, and History tables for mass operations.

### Enhanced Geolocation

ASN data and ISP/network provider info now shown in session details.

### Draggable Servers

Reorder connected servers in Settings. Display order persists across the app.

### Mobile App

Drawer navigation, History screen with filters, User profile viewing.

### Fixes

- Plex/Emby transcode showing wrong source resolution/bitrate
- 4:3 aspect 1080p content incorrectly labeled as 720p
- Map only working with primary server
- JellyStat import and music library handling
- Drizzle Kit on Windows
- Memory usage during large imports

\_\_

Thanks for your continued feedback and support!

- @gallapagos
