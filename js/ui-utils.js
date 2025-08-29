// UI Utilities - Common UI helper functions and utilities
class UIUtils {
    constructor() {
        // Initialize any UI utilities
    }

    // HTML escaping
    static escapeHtml(text) {
        if (text == null || text === undefined) {
            return '';
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    // URL normalization
    static normalizeUrl(url) {
        if (!url || !url.trim()) {
            return '';
        }
        
        const trimmedUrl = url.trim();
        
        // Already has protocol
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            return trimmedUrl;
        }
        
        // Default to https://
        return 'https://' + trimmedUrl;
    }

    // Get fallback favicon icon
    static getFallbackIcon() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMzY0NTU0IiByeD0iMiIvPgo8cGF0aCBkPSJNNCA2SDEyVjEwSDRWNloiIGZpbGw9IiM4Qjk1QTEiLz4KPC9zdmc+Cg==';
    }

    // Generate unique ID
    static generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    // Visual effects for new items
    static flashNewItem(selector, delay = 100) {
        setTimeout(() => {
            const element = document.querySelector(selector);
            if (element) {
                element.classList.add('new-item-flash');
                
                setTimeout(() => {
                    element.classList.remove('new-item-flash');
                }, 2500);
            }
        }, delay);
    }

    static flashNewItemByElement(element, delay = 100) {
        if (!element) return;
        
        setTimeout(() => {
            element.classList.add('new-item-flash');
            
            setTimeout(() => {
                element.classList.remove('new-item-flash');
            }, 2500);
        }, delay);
    }

    // Relative time formatting
    static getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    // Toast notification system
    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Modal management utilities
    static openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    static closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = '';
    }

    static closeAnyOpenModal() {
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
            UIUtils.closeModal(openModal.id);
        }
    }

    // Domain extraction for URLs
    static extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    // Regex escaping for search
    static escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Text highlighting utilities
    static highlightText(element, text, query) {
        if (!element || !text || !query) return;
        
        const regex = new RegExp(`(${UIUtils.escapeRegex(query)})`, 'gi');
        const highlightedText = text.replace(regex, '<span class="search-highlight">$1</span>');
        element.innerHTML = highlightedText;
    }

    static removeHighlights(element) {
        const highlights = element.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            highlight.outerHTML = highlight.innerHTML;
        });
    }

    // Grid positioning utilities
    static findFirstAvailableSlot(categories, columnCount) {
        // Create a map of occupied slots
        const occupiedSlots = new Map();
        categories.forEach(category => {
            const key = `${category.column}-${category.position}`;
            occupiedSlots.set(key, true);
        });

        // Find first available slot, column by column, position by position
        for (let column = 0; column < columnCount; column++) {
            for (let position = 0; position < 100; position++) { // Arbitrary high limit
                const key = `${column}-${position}`;
                if (!occupiedSlots.has(key)) {
                    return { column, position };
                }
            }
        }
        
        // Fallback: last column, next available position
        return { column: columnCount - 1, position: 0 };
    }

    // Event delegation utility
    static delegate(element, eventType, selector, handler) {
        element.addEventListener(eventType, (e) => {
            const target = e.target.closest(selector);
            if (target) {
                handler.call(target, e);
            }
        });
    }

    // Debounce utility
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle utility
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // URL validation
    static isValidUrl(string) {
        try {
            new URL(UIUtils.normalizeUrl(string));
            return true;
        } catch (_) {
            return false;
        }
    }

    // Copy to clipboard utility
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    // Animation utilities
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        function animate(timestamp) {
            const elapsed = timestamp - start;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                element.style.opacity = progress;
                requestAnimationFrame(animate);
            } else {
                element.style.opacity = '1';
            }
        }
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300, callback = null) {
        const start = performance.now();
        const startOpacity = parseFloat(window.getComputedStyle(element).opacity);
        
        function animate(timestamp) {
            const elapsed = timestamp - start;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                element.style.opacity = startOpacity * (1 - progress);
                requestAnimationFrame(animate);
            } else {
                element.style.opacity = '0';
                element.style.display = 'none';
                if (callback) callback();
            }
        }
        
        requestAnimationFrame(animate);
    }

    // Element utilities
    static createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }

    static removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    // Local storage utilities with error handling
    static getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Failed to get localStorage item ${key}:`, error);
            return defaultValue;
        }
    }

    static setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Failed to set localStorage item ${key}:`, error);
            return false;
        }
    }

    // Array utilities
    static moveArrayItem(array, fromIndex, toIndex) {
        const item = array[fromIndex];
        array.splice(fromIndex, 1);
        array.splice(toIndex, 0, item);
        return array;
    }

    static removeArrayItem(array, index) {
        if (index >= 0 && index < array.length) {
            return array.splice(index, 1)[0];
        }
        return null;
    }

    // Keyboard event utilities
    static isModifierPressed(event) {
        return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
    }

    static getKeyCombo(event) {
        const keys = [];
        if (event.ctrlKey) keys.push('Ctrl');
        if (event.metaKey) keys.push('Cmd');
        if (event.altKey) keys.push('Alt');
        if (event.shiftKey) keys.push('Shift');
        keys.push(event.key);
        return keys.join('+');
    }
}