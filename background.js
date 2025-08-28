// Background script for LinkShelf extension
// Handles extension icon clicks to add current page to inbox

chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Get current tab info
        const url = tab.url;
        const title = tab.title;
        const faviconUrl = tab.favIconUrl;
        
        // Don't add extension pages or special URLs
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
            return;
        }
        
        // Fetch favicon as data URL if available
        let faviconData = null;
        if (faviconUrl) {
            try {
                const response = await fetch(faviconUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    faviconData = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }
            } catch (error) {
                console.warn('Could not fetch favicon:', error);
            }
        }
        
        // Load existing inbox data
        const result = await chrome.storage.local.get(['linkshelf_inbox']);
        let inbox = result.linkshelf_inbox || [];
        
        // Check if URL already exists in inbox
        const exists = inbox.some(item => item.url === url);
        if (exists) {
            // Show notification that item already exists
            chrome.action.setBadgeText({text: '!', tabId: tab.id});
            chrome.action.setBadgeBackgroundColor({color: '#FFA500', tabId: tab.id});
            setTimeout(() => {
                chrome.action.setBadgeText({text: '', tabId: tab.id});
            }, 2000);
            return;
        }
        
        // Create inbox item
        const inboxItem = {
            id: 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
            name: title || new URL(url).hostname,
            url: url,
            faviconData: faviconData
        };
        
        // Add to inbox
        inbox.push(inboxItem);
        
        // Save to storage
        await chrome.storage.local.set({ linkshelf_inbox: inbox });
        
        // Show success badge
        chrome.action.setBadgeText({text: '✓', tabId: tab.id});
        chrome.action.setBadgeBackgroundColor({color: '#34C780', tabId: tab.id});
        setTimeout(() => {
            chrome.action.setBadgeText({text: '', tabId: tab.id});
        }, 2000);
        
    } catch (error) {
        console.error('Error adding to inbox:', error);
        // Show error badge
        chrome.action.setBadgeText({text: '✗', tabId: tab.id});
        chrome.action.setBadgeBackgroundColor({color: '#E74C3C', tabId: tab.id});
        setTimeout(() => {
            chrome.action.setBadgeText({text: '', tabId: tab.id});
        }, 2000);
    }
});

// Set up context menu items
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'add-to-inbox',
        title: 'Add to LinkShelf Inbox',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'open-linkshelf',
        title: 'Add to LinkShelf',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'add-to-inbox') {
        // Trigger the same function as clicking the extension icon
        chrome.action.onClicked.dispatch(tab);
    } else if (info.menuItemId === 'open-linkshelf') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
        });
    }
});
