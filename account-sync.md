# LinkShelf Backup & Sync (Local) - Implementation Plan

## Overview
Implement a comprehensive local backup and sync system that maintains LinkShelf's privacy-first approach while providing data protection and cross-device synchronization capabilities.

## Core Features

### 1. Automatic Local Backups
**Purpose**: Protect against data loss from browser issues, extension updates, or user errors

**Implementation**:
- Daily automatic backups to browser's Downloads folder
- Configurable backup frequency (daily, weekly, manual only)
- Rolling backup retention (keep last 7 daily, 4 weekly, 3 monthly)
- Backup filename format: `linkshelf-backup-YYYY-MM-DD-HHMMSS.json`
- Background service worker handles scheduling
- Size-optimized JSON with compression

**Features**:
- Silent background operation
- User notification on backup completion (optional)
- Backup integrity verification
- One-click restore from backup file
- Backup preview before restore (show categories, link count, date)

### 2. Manual Backup & Restore
**Enhanced Current Export/Import**:
- One-click "Create Backup" button in settings
- Drag-and-drop restore interface
- Backup validation and conflict resolution
- Incremental backup options (changes only)
- Backup encryption with user-provided password (optional)

### 3. File-Based Sync Across Devices
**Cloud Storage Integration** (User Chooses):
- Google Drive sync folder
- Dropbox sync folder
- OneDrive sync folder
- Any cloud-synced folder (manual selection)

**Sync Mechanism**:
- Write backup files to selected sync folder
- Monitor folder for changes from other devices
- Automatic conflict resolution with merge strategies
- Last-write-wins or manual merge options
- Sync status indicators in UI

### 4. Cross-Browser Import Support
**Import Sources**:
- Chrome/Edge bookmark HTML export
- Firefox bookmark JSON
- Safari bookmark plist
- Raindrop.io export
- Papaly export (already implemented)
- Other LinkShelf installations

**Smart Import Features**:
- Duplicate detection and merging
- Category mapping and suggestions
- Favicon preservation during import
- Preview import before applying
- Selective import (choose specific folders/categories)

## Technical Implementation

### Storage Architecture
```
linkshelf_backup_settings: {
  autoBackupEnabled: boolean,
  backupFrequency: 'daily' | 'weekly' | 'manual',
  syncEnabled: boolean,
  syncFolder: string,
  lastBackupDate: timestamp,
  backupCount: number,
  encryptionEnabled: boolean
}
```

### Backup File Format
```json
{
  "version": "1.0",
  "timestamp": "2024-01-01T12:00:00Z",
  "device": "chrome-desktop",
  "checksum": "sha256hash",
  "encrypted": false,
  "data": {
    "categories": [...],
    "favourites": [...],
    "inbox": [...],
    "settings": {...}
  }
}
```

### Sync Conflict Resolution
- Timestamp-based merging for non-conflicting changes
- User-prompted resolution for conflicts
- Merge strategies: union, intersection, manual selection
- Conflict history for rollback capabilities

### Security Considerations
- Local encryption using Web Crypto API
- No data sent to external servers (user controls cloud storage)
- Backup integrity verification
- Secure key derivation from user passwords

## Development Phases

### Phase 1: Enhanced Backup System
- Automatic daily backups
- Improved manual backup/restore UI
- Backup validation and integrity checks
- Rolling backup retention

### Phase 2: Cloud Sync Integration
- Folder selection for sync
- File monitoring for changes
- Basic conflict resolution
- Sync status indicators

### Phase 3: Advanced Import/Export
- Multi-format import support
- Smart duplicate detection
- Preview and selective import
- Bulk operations

### Phase 4: Polish & Optimization
- Encryption support
- Advanced conflict resolution
- Performance optimization
- Comprehensive testing

## User Experience

### Settings UI Additions
```
Backup & Sync
├── Automatic Backups
│   ├── ☑️ Enable daily backups
│   ├── 📁 Backup location: Downloads/LinkShelf-Backups/
│   ├── 🔄 Last backup: 2 hours ago
│   └── 🗑️ Keep: 7 daily, 4 weekly backups
├── Cloud Sync (Optional)
│   ├── ☐ Enable cloud sync
│   ├── 📁 Sync folder: [Select Folder]
│   ├── 🔄 Status: Synced 5 minutes ago
│   └── ⚡ Sync now
└── Import/Export
    ├── 💾 Create backup now
    ├── 📁 Restore from backup
    ├── 📥 Import from browser/service
    └── 🔧 Advanced tools
```

### User Benefits
- **Peace of mind**: Never lose bookmark collections
- **Cross-device access**: Same bookmarks everywhere
- **Easy migration**: Move between browsers/devices seamlessly
- **Privacy maintained**: User controls their own data
- **Flexible sync**: Choose your preferred cloud provider
- **Disaster recovery**: Quick restore from any backup

## Technical Constraints & Considerations
- Chrome extension file system limitations
- Browser security policies for file access
- Cloud storage API limitations
- File size limits for large bookmark collections
- Network connectivity requirements for sync
- User permission requirements for file access

This implementation maintains LinkShelf's core philosophy of local-first, privacy-focused bookmark management while adding robust backup and sync capabilities that users control entirely.