# LinkShelf - Visual Bookmark Dashboard

A beautiful, visual bookmark dashboard Chrome extension that replaces your new tab page with organized categories and drag-and-drop functionality.

## Features

- **Visual Dashboard**: Replace your new tab page with a clean, organized bookmark dashboard
- **Category Organization**: Create custom categories to organize your bookmarks
- **Drag & Drop**: Easily move bookmarks between categories and reorder them
- **Dark Theme**: Beautiful dark theme with modern UI design
- **Favicon Display**: Automatically fetches and displays website favicons
- **Import/Export**: Import from and export to standard bookmark HTML files
- **Local Storage**: All data is stored locally using Chrome's storage API - no external servers

## Installation

1. **Download or Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right corner
4. **Click "Load unpacked"** and select the LinkShelf folder
5. **Open a new tab** to see your LinkShelf dashboard

## Usage

### Creating Categories
1. Click the **"+ Create Category"** button in the header
2. Enter a name for your category
3. Click **"Create Category"**

### Adding Bookmarks
1. Click the **"+ Add Link"** button in any category
2. Enter the URL - the extension will automatically fetch the page title and favicon
3. Customize the name if desired
4. Click **"Save Bookmark"**

### Organizing Bookmarks
- **Drag bookmarks** within a category to reorder them
- **Drag bookmarks** between categories to move them
- **Drag entire categories** to reorder them
- **Hover over items** to see edit and delete options

### Editing and Deleting
- **Edit bookmarks**: Hover over a bookmark and click the edit (✏️) icon
- **Delete bookmarks**: Hover over a bookmark and click the delete (🗑️) icon
- **Edit categories**: Hover over a category title and click the edit icon
- **Delete categories**: Hover over a category title and click the delete icon

### Import/Export
1. Click the **"⚙️ Settings"** button in the header
2. **Export**: Download your bookmarks as an HTML file
3. **Import**: Upload a standard bookmarks HTML file to import bookmarks

## Technical Details

- **Manifest Version**: V3 (latest Chrome extension format)
- **Permissions**: 
  - `storage` - For saving bookmark data locally
  - `favicon` - For fetching website favicons
- **Storage**: Uses `chrome.storage.local` API for data persistence
- **Privacy**: No external servers or data collection - everything stays on your device

## File Structure

```
LinkShelf/
├── manifest.json          # Extension configuration
├── dashboard.html         # Main dashboard HTML
├── dashboard.css          # Styling and theme
├── dashboard.js           # Core functionality
├── icons/                 # Extension icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
├── specification.md       # Project requirements
└── README.md             # This file
```

## Browser Compatibility

- **Chrome**: Fully supported (Manifest V3)
- **Edge**: Should work with minor modifications
- **Firefox**: Would require conversion to Manifest V2

## Development

The extension is built with vanilla JavaScript, HTML, and CSS for maximum compatibility and performance. No external dependencies or build tools required.

### Key Components

- **LinkShelfDashboard Class**: Main application logic
- **Chrome Storage API**: Data persistence
- **Drag & Drop API**: Bookmark and category reordering
- **Fetch API**: Favicon and title retrieval

## Troubleshooting

**Extension not loading**: Ensure all files are in the same directory and Developer Mode is enabled

**Bookmarks not saving**: Check that the extension has storage permissions

**Favicons not loading**: Some sites may block favicon requests; this is normal

**Drag & Drop not working**: Make sure you're clicking and holding on the bookmark or category title area

## Contributing

Feel free to submit issues and enhancement requests! The codebase is designed to be easily extensible.

## License

This project is open source and available under the MIT License.
