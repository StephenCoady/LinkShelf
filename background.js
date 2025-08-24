// Background script for LinkShelf extension
// Handles extension icon clicks to open dashboard in new tab

chrome.action.onClicked.addListener((tab) => {
    // Open the dashboard in a new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
    });
});

// Optional: Set up context menu item as alternative access method
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'open-linkshelf',
        title: 'Open LinkShelf Dashboard',
        contexts: ['action']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'open-linkshelf') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
        });
    }
});
