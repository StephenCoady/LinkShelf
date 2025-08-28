# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkShelf is a Chrome extension (Manifest V3) that provides a visual bookmark dashboard replacing the new tab page. It's built with vanilla JavaScript, HTML, and CSS with no external dependencies or build tools required.

## Development Commands

This project has no build system or package management. Development is done by:

1. **Loading the extension**: Load the project folder as an unpacked extension in Chrome's developer mode at `chrome://extensions/`
2. **Testing changes**: Reload the extension in Chrome after making code changes
3. **Debugging**: Use Chrome DevTools on the new tab page or background script

## Project Architecture

### Core Components

- **manifest.json**: Extension configuration and permissions
- **background.js**: Service worker handling extension icon clicks and context menus
- **dashboard.html**: Main HTML template for the new tab page
- **dashboard.css**: All styling including dark theme and responsive layout
- **dashboard.js**: Main application logic (~3700 lines)

### Key Classes and Systems

- **LinkShelfDashboard**: Main class containing all application logic
- **Chrome Storage API**: Data persistence using `chrome.storage.local`
- **Drag & Drop System**: Complex implementation for reordering bookmarks, categories, and subcategories
- **Import/Export**: Supports both LinkShelf JSON format and standard Netscape HTML bookmarks

### Data Structure

Categories contain:
- Top-level links (stored in `links` array)
- Subcategories (nested structure with their own links)
- Grid positioning data (`column`, `position`)

Additional data:
- Favourites bar (separate from categories)
- Inbox (temporary storage for quick bookmarking)
- User preferences (column count, theme settings)

### Storage Keys

All data is stored in Chrome's local storage with prefixed keys:
- `linkshelf_categories`: Main category data
- `linkshelf_favourites`: Favourites bar items
- `linkshelf_inbox`: Temporary bookmark storage
- `linkshelf_column_count`: Grid layout configuration
- `linkshelf_show_favourites`: UI preference
- `linkshelf_open_links_new_tab`: Link behavior preference

### Extension Features

- **New Tab Override**: Replaces default new tab with bookmark dashboard
- **Quick Add**: Extension icon/context menu adds current page to inbox
- **Favicon Fetching**: Automatic favicon retrieval with fallback handling
- **Drag & Drop**: Multi-level drag and drop between categories, subcategories, and inbox
- **Import/Export**: Supports Papaly, Netscape, and native formats

### Key Implementation Notes

- No build process - direct file editing and Chrome extension reload
- Extensive error handling for favicon fetching with domain fallback chains
- Complex drag and drop with visual feedback and position calculation
- Migration system for data structure changes
- Special handling for Google service favicons