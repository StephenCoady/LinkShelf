// Storage Manager - Handles all Chrome storage operations and data management
class StorageManager {
    constructor() {
        this.storage = chrome.storage.local;
    }

    // Load all data from storage
    async loadData() {
        try {
            const result = await this.storage.get([
                'linkshelf_shelves',
                'linkshelf_current_shelf_id',
                'linkshelf_categories', 
                'linkshelf_column_count',
                'linkshelf_favourites',
                'linkshelf_show_favourites',
                'linkshelf_open_links_new_tab',
                'linkshelf_inbox'
            ]);
            
            return result;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    // Save data to storage
    async saveData(data) {
        try {
            await this.storage.set(data);
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    // Setup storage change listener
    setupStorageListener(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.linkshelf_inbox) {
                callback(changes.linkshelf_inbox.newValue || []);
            }
        });
    }

    // Clear specific storage keys
    async removeStorageKeys(keys) {
        try {
            await this.storage.remove(keys);
        } catch (error) {
            console.error('Error removing storage keys:', error);
            throw error;
        }
    }

    // Load sidebar state from localStorage
    loadSidebarState() {
        try {
            const saved = localStorage.getItem('linkshelf_sidebar_open');
            return saved === 'true';
        } catch (error) {
            console.warn('Failed to load sidebar state:', error);
            return false;
        }
    }

    // Save sidebar state to localStorage
    saveSidebarState(isOpen) {
        try {
            localStorage.setItem('linkshelf_sidebar_open', isOpen.toString());
        } catch (error) {
            console.warn('Failed to save sidebar state:', error);
        }
    }
}