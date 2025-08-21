# Project: Visual Bookmark Dashboard Chrome Extension

## 1. Core Functionality & Technical Specification

* **Manifest Version:** The extension will use **Manifest V3**.
* **Primary Action:** The extension will override Chrome's default new tab page. The `chrome_url_overrides` key in the `manifest.json` file will be set to point to the main HTML file of the extension (e.g., `dashboard.html`).
    ```json
    "chrome_url_overrides": {
      "newtab": "dashboard.html"
    }
    ```
* **Data Storage:** All user data (categories, bookmarks, layout) will be stored locally using the `chrome.storage.local` API. This ensures user privacy and offline access. No external database or user accounts are required.
* **Permissions:**
    * `storage`: To save and retrieve user's bookmark data.
    * `favicon`: To fetch and display favicons for the bookmarks.

## 2. User Interface (UI) & Look and Feel

The design will be heavily inspired by the provided screenshot and `papaly.css` file, aiming for a clean, dark-themed, and organized dashboard.

* **Overall Layout:**
    * A multi-column, grid-based layout. The main content area will be a container that holds several vertical category columns.
    * The user should be able to add and remove columns as needed.
    * The background color will be a dark grey/charcoal (`#364554` or similar).
* **Header:**
    * A simple, clean header at the top of the page.
    * It will contain a **"+ Create Category"** button to allow users to add new columns.
* **Category Columns ("Boards"):**
    * Each category is represented as a distinct vertical column with a title.
    * The column background will be a slightly lighter shade of the main background (`#2A3642`).
    * The **category title** will be prominent at the top of the column, with a clear, readable font (e.g., font size `1rem`, bold, light grey color like `#C0C9D1`).
    * Each category column will have a subtle border (`#3C4D5E`).
* **Bookmarks ("Links"):**
    * Bookmarks are listed vertically within their respective category columns.
    * Each bookmark will display its **favicon** on the left and the **link title** on the right.
    * The link text color will be a light grey (`#C0C9D1`), changing to a brighter white (`#EBF4FF`) on hover.
    * The background of the link item will change to a darker shade on hover (`#1D252E`) to provide clear visual feedback.
    * Font size for links should be approximately `.85rem` to `.9rem` for readability without clutter.
* **Modals (Pop-ups):**
    * Actions like adding a new category or a new bookmark will trigger a modal dialog.
    * The modal will overlay the main dashboard with a semi-transparent background.
    * The modal itself will have the same dark theme as the category columns (`#2A3642` background, `#3C4D5E` border).
    * Input fields will have a dark background (`#364554`) and light text (`#C0C9D1`).
    * Buttons will follow the theme, with a primary action button having a distinct color (e.g., green `#34C780`).

## 3. Key Features & User Interaction

* **Drag and Drop:**
    * **Bookmarks:** Users must be able to click and drag a bookmark to reorder it within its current category or move it to a different category.
    * **Categories:** Users must be able to click and drag an entire category column to rearrange the layout of the dashboard.
* **Adding Content:**
    * **New Category:** Clicking the "+ Create Category" button in the header opens a modal asking for the category title.
    * **New Bookmark:** Each category should have a "+" or "Add Link" button. Clicking this opens a modal with two input fields: **URL** and **Name**.
        * When a user enters a URL, the extension should attempt to fetch the page's title and favicon automatically to pre-fill the "Name" field and display the icon. The user can then override the name if they wish.
* **Editing & Deleting:**
    * **Bookmarks:** Hovering over a bookmark should reveal "edit" (pencil) and "delete" (trash) icons.
        * Clicking "edit" opens the "Add Bookmark" modal, pre-filled with the existing URL and name for modification.
        * Clicking "delete" will remove the bookmark. A confirmation is not strictly necessary but could be a simple "Undo" toast notification.
    * **Categories:** Hovering over a category title should reveal "edit" and "delete" icons.
        * Clicking "edit" allows the user to rename the category title inline or via a modal.
        * Clicking "delete" will remove the entire category and all bookmarks within it, after a confirmation prompt.
* **Import / Export:**
    * There should be an "Options" or "Settings" menu accessible from the header.
    * **Export:** This option will generate a standard bookmarks HTML file from the user's dashboard data and trigger a download.
    * **Import:** This option will allow the user to select a bookmarks HTML file from their computer. The extension will parse this file and create categories and bookmarks on the dashboard accordingly.