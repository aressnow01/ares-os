/* ============================================
   ARES OS — Router
   Hash-based navigation & view management
   ============================================ */

(function (global) {
    'use strict';

    const ROUTES = {
        dashboard: {
            title: 'Home',
            renderer: null
        },
        tasks: {
            title: 'Tasks',
            renderer: null
        },
        focus: {
            title: 'Focus',
            renderer: null
        },
        notes: {
            title: 'Notes',
            renderer: null
        },
        habits: {
            title: 'Habits',
            renderer: null
        },
        goals: {
            title: 'Goals',
            renderer: null
        },
        settings: {
            title: 'Settings',
            renderer: null
        },
        more: {
            title: 'More',
            renderer: null
        }
    };

    const DEFAULT_ROUTE = 'dashboard';
    let currentRoute = null;
    let isInitialized = false;
    let navigationHistory = [];

    /* ============ ROUTE MANAGEMENT ============ */

    function init() {
        if (isInitialized) return;

        autoRegisterRenderers();

        global.addEventListener('hashchange', handleHashChange);

        attachNavigationListeners();

        const initialRoute = getRouteFromHash();
        renderRoute(initialRoute);

        isInitialized = true;
    }

    function navigate(route) {
        if (!ROUTES[route]) {
            console.warn(
                `Invalid route: ${route}, falling back to ${DEFAULT_ROUTE}`
            );
            route = DEFAULT_ROUTE;
        }

        if (getRouteFromHash() !== route) {
            global.location.hash = route;
        } else {
            renderRoute(route);
        }
    }

    function getCurrentRoute() {
        return currentRoute || DEFAULT_ROUTE;
    }

    function registerRoute(route, renderer) {
        if (!ROUTES[route]) {
            console.warn(`Cannot register unknown route: ${route}`);
            return false;
        }

        if (typeof renderer !== 'function') {
            console.warn(`Renderer for ${route} must be a function`);
            return false;
        }

        ROUTES[route].renderer = renderer;
        return true;
    }

    function render() {
        const route = getCurrentRoute();
        return renderRoute(route);
    }

    function updateNavigation(route) {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const view = item.getAttribute('data-view');

            if (
                view === route ||
                (route === 'more' && view === 'more')
            ) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            } else if (
                route === 'habits' ||
                route === 'goals' ||
                route === 'settings'
            ) {
                if (view === 'more') {
                    item.classList.add('active');
                    item.setAttribute('aria-current', 'page');
                } else {
                    item.classList.remove('active');
                    item.removeAttribute('aria-current');
                }
            } else {
                item.classList.remove('active');
                item.removeAttribute('aria-current');
            }
        });
    }

    function handleHashChange() {
        const route = getRouteFromHash();
        renderRoute(route);
    }

    function goBack() {
        if (navigationHistory.length > 1) {
            navigationHistory.pop();

            const previousRoute =
                navigationHistory[navigationHistory.length - 1];

            if (previousRoute && ROUTES[previousRoute]) {
                navigate(previousRoute);
            } else {
                global.history.back();
            }
        } else {
            global.history.back();
        }
    }

    function goForward() {
        global.history.forward();
    }

    /* ============ INTERNAL FUNCTIONS ============ */

    function getRouteFromHash() {
        const hash = global.location.hash
            .replace('#', '')
            .trim();

        if (hash && ROUTES[hash]) {
            return hash;
        }

        if (hash) {
            const parts = hash.split('/');

            if (parts[0] && ROUTES[parts[0]]) {
                return parts[0];
            }
        }

        return DEFAULT_ROUTE;
    }

    function renderRoute(route) {
        const viewContainer =
            document.getElementById('view-container');

        if (!viewContainer) {
            console.warn('View container not found');
            return false;
        }

        if (!ROUTES[route]) {
            console.warn(`Unknown route: ${route}`);
            route = DEFAULT_ROUTE;
        }

        currentRoute = route;

        if (
            navigationHistory[navigationHistory.length - 1] !== route
        ) {
            navigationHistory.push(route);

            if (navigationHistory.length > 50) {
                navigationHistory =
                    navigationHistory.slice(-50);
            }
        }

        updateNavigation(route);
        updateDocumentTitle(route);

        AresUtils.clearElement(viewContainer);

        const renderer = ROUTES[route].renderer;

        try {
            let renderedContent = null;

            if (renderer && typeof renderer === 'function') {
                renderedContent = renderer();
            } else {
                renderedContent = createPlaceholder(route);
            }

            if (
                renderedContent !== null &&
                renderedContent !== undefined
            ) {
                if (typeof renderedContent === 'string') {
                    viewContainer.innerHTML = renderedContent;
                } else if (
                    renderedContent instanceof HTMLElement
                ) {
                    viewContainer.appendChild(renderedContent);
                } else {
                    viewContainer.innerHTML =
                        createPlaceholder(route);
                }
            } else {
                viewContainer.innerHTML =
                    createPlaceholder(route);
            }

            viewContainer.classList.add('animate-slide-in');

            setTimeout(() => {
                viewContainer.classList.remove(
                    'animate-slide-in'
                );
            }, 300);

            scrollToTop();

            dispatchRouteChangedEvent(route);

            return true;

        } catch (error) {
            console.warn(
                `Error rendering route ${route}:`,
                error
            );

            viewContainer.innerHTML =
                createErrorState(route);

            return false;
        }
    }

    function createPlaceholder(route) {
        const title = ROUTES[route]
            ? ROUTES[route].title
            : route;

        return `
            <div class="empty-state-card">
                <div class="empty-state-icon">
