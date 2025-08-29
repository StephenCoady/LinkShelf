# Cloud Sync & Backup

## Overview
Enable automatic synchronization and backup of LinkShelf data to cloud storage providers, allowing users to access their bookmarks across multiple devices and ensuring data safety.

## Motivation
Currently, LinkShelf data is stored only locally in Chrome's storage, which means:
- Users lose all bookmarks if they switch computers or reinstall Chrome
- No way to sync bookmarks between multiple devices (work laptop, home computer, etc.)
- Risk of data loss if Chrome storage is corrupted or cleared
- No backup mechanism for disaster recovery

## Proposed Solution

### Cloud Providers
Support multiple cloud storage providers:
- **Google Drive** (primary, since most Chrome users have Google accounts)
- **Dropbox** 
- **OneDrive**
- **iCloud Drive** (for Mac users)

### Features
1. **One-click Setup**: Easy OAuth integration with cloud providers
2. **Automatic Sync**: Real-time sync whenever bookmarks are modified
3. **Conflict Resolution**: Smart merging when same shelf is modified on multiple devices
4. **Backup Scheduling**: Automatic daily/weekly backups with versioning
5. **Selective Sync**: Choose which shelves to sync vs keep local-only
6. **Offline Mode**: Continue working offline, sync when connection returns

### Technical Implementation
- Add new permissions to `manifest.json` for cloud API access
- Create `CloudSyncManager` class in `dashboard.js`
- Store cloud credentials securely using Chrome's storage API
- Use cloud provider APIs (Google Drive API, Dropbox API, etc.)
- Implement conflict resolution using timestamps and merge strategies
- Add sync status indicators in the UI

### User Interface
- New "Cloud Sync" section in Settings modal
- Sync status indicator in header (synced/syncing/offline)
- Cloud provider selection and account linking
- Backup history viewer with restore options
- Conflict resolution dialog when merge conflicts occur

### Data Format
- Store LinkShelf data as encrypted JSON files in cloud storage
- Use standardized file naming: `linkshelf-backup-{timestamp}.json`
- Include metadata: device info, Chrome extension version, sync timestamp

## Benefits
- **Cross-device accessibility**: Access bookmarks from any device
- **Data safety**: Automatic backups prevent data loss
- **Team sharing**: Share bookmark collections with team members
- **Migration support**: Easy migration when switching computers
- **Peace of mind**: Users never worry about losing their bookmark organization

## Implementation Priority
**High** - This addresses a major pain point and significantly increases the value proposition of LinkShelf over built-in browser bookmarks.