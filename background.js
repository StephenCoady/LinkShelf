// Background script for LinkShelf extension
// Handles extension icon clicks to add current page to inbox

// Shared function for adding current page to inbox
async function addCurrentPageToInbox(tab) {
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
        
        // Create inbox item with timestamp for sorting
        const inboxItem = {
            id: 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
            name: title || new URL(url).hostname,
            url: url,
            faviconData: faviconData,
            addedAt: Date.now() // Add timestamp for sorting newest first
        };
        
        // Add to beginning of inbox (newest first)
        inbox.unshift(inboxItem);
        
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
}

// Handle extension icon clicks
chrome.action.onClicked.addListener(addCurrentPageToInbox);

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'quick-add-bookmark') {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await addCurrentPageToInbox(tab);
        }
    }
});

// Function to add bookmark directly to category
async function addCurrentPageToCategory(tab, categoryIndex, subcategoryIndex = null) {
    try {
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
        
        // Load categories data
        const result = await chrome.storage.local.get(['linkshelf_categories']);
        let categories = result.linkshelf_categories || [];
        
        if (!categories[categoryIndex]) {
            throw new Error('Category not found');
        }
        
        // Create link item
        const linkItem = {
            id: 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
            name: title || new URL(url).hostname,
            url: url,
            faviconData: faviconData
        };
        
        // Add to appropriate location
        if (subcategoryIndex !== null && categories[categoryIndex].subcategories?.[subcategoryIndex]) {
            // Add to subcategory
            if (!categories[categoryIndex].subcategories[subcategoryIndex].links) {
                categories[categoryIndex].subcategories[subcategoryIndex].links = [];
            }
            categories[categoryIndex].subcategories[subcategoryIndex].links.push(linkItem);
        } else {
            // Add to main category
            if (!categories[categoryIndex].links) {
                categories[categoryIndex].links = [];
            }
            categories[categoryIndex].links.push(linkItem);
        }
        
        // Save to storage
        await chrome.storage.local.set({ linkshelf_categories: categories });
        
        // Show success badge
        chrome.action.setBadgeText({text: '✓', tabId: tab.id});
        chrome.action.setBadgeBackgroundColor({color: '#34C780', tabId: tab.id});
        setTimeout(() => {
            chrome.action.setBadgeText({text: '', tabId: tab.id});
        }, 2000);
        
    } catch (error) {
        console.error('Error adding to category:', error);
        // Show error badge
        chrome.action.setBadgeText({text: '✗', tabId: tab.id});
        chrome.action.setBadgeBackgroundColor({color: '#E74C3C', tabId: tab.id});
        setTimeout(() => {
            chrome.action.setBadgeText({text: '', tabId: tab.id});
        }, 2000);
    }
}

// Function to create context menu based on current categories
async function createContextMenu() {
    // Clear existing menu items
    chrome.contextMenus.removeAll();
    
    // Create main menu items
    chrome.contextMenus.create({
        id: 'add-to-inbox',
        title: 'Add to LinkShelf Inbox',
        contexts: ['page']
    });
    
    chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['page']
    });
    
    // Load categories for submenu
    try {
        const result = await chrome.storage.local.get(['linkshelf_categories']);
        const categories = result.linkshelf_categories || [];
        
        if (categories.length > 0) {
            chrome.contextMenus.create({
                id: 'add-to-category',
                title: 'Add to Category',
                contexts: ['page']
            });
            
            // Add category options (limit to first 8 to avoid menu overflow)
            categories.slice(0, 8).forEach((category, index) => {
                chrome.contextMenus.create({
                    id: `category-${index}`,
                    parentId: 'add-to-category',
                    title: category.name,
                    contexts: ['page']
                });
                
                // Add subcategories if they exist (limit to first 5)
                if (category.subcategories && category.subcategories.length > 0) {
                    category.subcategories.slice(0, 5).forEach((subcategory, subIndex) => {
                        chrome.contextMenus.create({
                            id: `category-${index}-sub-${subIndex}`,
                            parentId: `category-${index}`,
                            title: subcategory.name,
                            contexts: ['page']
                        });
                    });
                }
            });
            
            chrome.contextMenus.create({
                id: 'separator2',
                type: 'separator',
                contexts: ['page']
            });
        }
    } catch (error) {
        console.warn('Error loading categories for context menu:', error);
    }
    
    chrome.contextMenus.create({
        id: 'open-linkshelf',
        title: 'Open LinkShelf',
        contexts: ['page']
    });
}

// Set up context menu items
chrome.runtime.onInstalled.addListener(createContextMenu);

// Update context menu when categories change
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.linkshelf_categories) {
        createContextMenu();
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-inbox') {
        // Add to inbox
        await addCurrentPageToInbox(tab);
    } else if (info.menuItemId === 'open-linkshelf') {
        // Open LinkShelf dashboard
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
        });
    } else if (info.menuItemId.startsWith('category-')) {
        // Parse category and subcategory indices
        const parts = info.menuItemId.split('-');
        const categoryIndex = parseInt(parts[1]);
        
        if (parts[2] === 'sub') {
            // Adding to subcategory
            const subcategoryIndex = parseInt(parts[3]);
            await addCurrentPageToCategory(tab, categoryIndex, subcategoryIndex);
        } else {
            // Adding to main category
            await addCurrentPageToCategory(tab, categoryIndex);
        }
    }
});
