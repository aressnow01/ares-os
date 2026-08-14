/* ============================================
   ARES OS — Utilities
   Shared helper functions
   ============================================ */

(function (global) {
    'use strict';

    /* ============ DOM HELPERS ============ */

    function createElement(tag, options = {}) {
        const element = document.createElement(tag);

        if (options.className) {
            element.className = options.className;
        }

        if (options.text !== undefined) {
            element.textContent = options.text;
        }

        if (options.html !== undefined) {
            element.innerHTML = options.html;
        }

        if (options.attrs) {
            Object.keys(options.attrs).forEach(key => {
                const value = options.attrs[key];

                if (value !== null && value !== undefined) {
                    element.setAttribute(key, value);
                }
            });
        }

        if (options.events) {
            Object.keys(options.events).forEach(eventName => {
                if (typeof options.events[eventName] === 'function') {
                    element.addEventListener(
                        eventName,
                        options.events[eventName]
                    );
                }
            });
        }

        return element;
    }

    function clearElement(element) {
        if (!element) return;

        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function delegateEvent(container, eventName, selector, handler) {
        if (!container) return;

        container.addEventListener(eventName, function (event) {
            const target = event.target.closest(selector);

            if (target && container.contains(target)) {
                handler(event, target);
            }
        });
    }

    /* ============ STORAGE ============ */

    function storageGet(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);

            if (value === null) {
                return defaultValue;
            }

            return JSON.parse(value);
        } catch (error) {
            console.warn('Storage read failed:', error);
            return defaultValue;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Storage write failed:', error);
            return false;
        }
    }

    function storageRemove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Storage remove failed:', error);
            return false;
        }
    }

    /* ============ OBJECT HELPERS ============ */

    function deepClone(value) {
        if (value === undefined || value === null) {
            return value;
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            console.warn('Deep clone failed:', error);
            return value;
        }
    }

    function generateId() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 9)
        );
    }

    /* ============ DATE HELPERS ============ */

    function padNumber(number) {
        return String(number).padStart(2, '0');
    }

    function getTodayKey() {
        const date = new Date();

        return (
            date.getFullYear() +
            '-' +
            padNumber(date.getMonth() + 1) +
            '-' +
            padNumber(date.getDate())
        );
    }

    function getDateKey(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }

        return (
            date.getFullYear() +
            '-' +
            padNumber(date.getMonth() + 1) +
            '-' +
            padNumber(date.getDate())
        );
    }

    function getLastNDateKeys(numberOfDays) {
        const dates = [];
        const today = new Date();

        for (let i = numberOfDays - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(getDateKey(date));
        }

        return dates;
    }

    function formatShortDate(dateValue) {
        if (!dateValue) return '';

        const date = new Date(dateValue + 'T00:00:00');

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    }

    function isOverdue(dateValue) {
        if (!dateValue) return false;

        const today = getTodayKey();

        return dateValue < today;
    }

    /* ============ NUMBER HELPERS ============ */

    function clamp(value, min, max) {
        const number = Number(value);

        if (Number.isNaN(number)) {
            return min;
        }

        return Math.min(Math.max(number, min), max);
    }

    function calculatePercentage(value, total) {
        if (!total || total <= 0) {
            return 0;
        }

        return Math.round((value / total) * 100);
    }

    /* ============ HABIT HELPERS ============ */

    function calculateStreak(completions) {
        if (!Array.isArray(completions) || completions.length === 0) {
            return 0;
        }

        const completionSet = new Set(completions);
        let streak = 0;

        const today = new Date();

        // Check today first.
        // If today is not completed, allow the streak to continue
        // from yesterday.
        const todayKey = getDateKey(today);

        if (!completionSet.has(todayKey)) {
            today.setDate(today.getDate() - 1);
        }

        while (true) {
            const key = getDateKey(today);

            if (!completionSet.has(key)) {
                break;
            }

            streak++;
            today.setDate(today.getDate() - 1);
        }

        return streak;
    }

    /* ============ UI HELPERS ============ */

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = String(value);

        return div.innerHTML;
    }

    function applyTheme(theme) {
        const validTheme = theme === 'light' ? 'light' : 'dark';

        document.documentElement.setAttribute(
            'data-theme',
            validTheme
        );

        document.body.classList.toggle(
            'theme-light',
            validTheme === 'light'
        );

        document.body.classList.toggle(
            'theme-dark',
            validTheme === 'dark'
        );
    }

    /* ============ TOAST ============ */

    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');

        if (!container) {
            container = createElement('div', {
                attrs: {
                    id: 'toast-container',
                    'aria-live': 'polite'
                }
            });

            document.body.appendChild(container);
        }

        const toast = createElement('div', {
            className: `toast toast-${type}`,
            text: message
        });

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /* ============ MODAL ============ */

    function openModal(title, content, buttons = []) {
        closeModal();

        const overlay = createElement('div', {
            className: 'modal-overlay',
            attrs: {
                id: 'ares-modal'
            }
        });

        const modal = createElement('div', {
            className: 'modal',
            attrs: {
                role: 'dialog',
                'aria-modal': 'true'
            }
        });

        const header = createElement('div', {
            className: 'modal-header'
        });

        const heading = createElement('h2', {
            className: 'modal-title',
            text: title
        });

        const closeButton = createElement('button', {
            className: 'btn btn-ghost btn-icon',
            attrs: {
                type: 'button',
                'aria-label': 'Close'
            },
            html: `
                <svg width="20" height="20"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            `,
            events: {
                click: closeModal
            }
        });

        header.appendChild(heading);
        header.appendChild(closeButton);

        const body = createElement('div', {
            className: 'modal-body'
        });

        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        modal.appendChild(header);
        modal.appendChild(body);

        if (buttons.length > 0) {
            const footer = createElement('div', {
                className: 'modal-footer'
            });

            buttons.forEach(buttonConfig => {
                const button = createElement('button', {
                    className: `btn ${buttonConfig.className || 'btn-secondary'}`,
                    text: buttonConfig.label || 'Button',
                    attrs: {
                        type: 'button'
                    },
                    events: {
                        click: function () {
                            if (typeof buttonConfig.onClick === 'function') {
                                const result = buttonConfig.onClick();

                                if (result === true) {
                                    closeModal();
                                }
                            }
                        }
                    }
                });

                footer.appendChild(button);
            });

            modal.appendChild(footer);
        }

        overlay.appendChild(modal);

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                closeModal();
            }
        });

        document.body.appendChild(overlay);

        document.addEventListener(
            'keydown',
            handleModalEscape
        );

        setTimeout(() => {
            const firstInput = modal.querySelector(
                'input, textarea, select, button'
            );

            if (firstInput) {
                firstInput.focus();
            }
        }, 50);
    }

    function handleModalEscape(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function closeModal() {
        const modal = document.getElementById('ares-modal');

        if (modal) {
            modal.remove();
        }

        document.removeEventListener(
            'keydown',
            handleModalEscape
        );
    }

    /* ============ CONFIRMATION ============ */

    function showConfirm(
        message,
        onConfirm,
        onCancel,
        options = {}
    ) {
        const title = options.title || 'Confirm Action';
        const confirmLabel = options.confirmLabel || 'Confirm';
        const confirmClass = options.confirmClass || 'btn-primary';

        const content = createElement('div', {
            className: 'confirm-content'
        });

        const messageElement = createElement('p', {
            className: 'confirm-message',
            text: message
        });

        content.appendChild(messageElement);

        openModal(title, content, [
            {
                label: 'Cancel',
                className: 'btn-secondary',
                onClick: function () {
                    if (typeof onCancel === 'function') {
                        onCancel();
                    }

                    return true;
                }
            },
            {
                label: confirmLabel,
                className: confirmClass,
                onClick: function () {
                    if (typeof onConfirm === 'function') {
                        onConfirm();
                    }

                    return true;
                }
            }
        ]);
    }

    /* ============ DEBOUNCE ============ */

    function debounce(callback, delay = 300) {
        let timeoutId = null;

        return function (...args) {
            clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                callback.apply(this, args);
            }, delay);
        };
    }

    /* ============ GLOBAL EXPOSURE ============ */

    const AresUtils = {
        // DOM
        createElement,
        clearElement,
        delegateEvent,

        // Storage
        storageGet,
        storageSet,
        storageRemove,

        // Objects
        deepClone,
        generateId,

        // Dates
        getTodayKey,
        getDateKey,
        getLastNDateKeys,
        formatShortDate,
        isOverdue,

        // Numbers
        clamp,
        calculatePercentage,

        // Habits
        calculateStreak,

        // UI
        escapeHtml,
        applyTheme,

        // Toast
        showToast,

        // Modal
        openModal,
        closeModal,
        showConfirm,

        // Performance
        debounce
    };

    global.AresUtils = AresUtils;

})(typeof window !== 'undefined' ? window : this);
