/**
 * AI Lead Hunter OS - Application Bootstrap
 * =========================================
 * Entry point. Handles navigation, global events, and initializes modules.
 */

import { updateDashboard } from './dashboard.js';
import { initLeads, refreshLeads } from './leads.js';
import { initOutreach, refreshOutreachLeadSelect, initPipeline, renderPipelineBoard } from './outreach.js';
import { initSettings, refreshSettingsUI } from './settings.js';
import { initDiscovery, refreshDiscovery } from './discovery.js';

/**
 * Page metadata for each section
 */
const SECTION_META = {
    dashboard: {
        title: 'Dashboard',
        subtitle: 'Overview of your lead generation performance'
    },
    leads: {
        title: 'Leads',
        subtitle: 'Manage and track all your potential clients'
    },
    discovery: {
        title: 'Lead Discovery',
        subtitle: 'Find businesses by niche and location, then import into CRM'
    },
    scoring: {
        title: 'Lead Scoring',
        subtitle: 'AI-powered opportunity scoring engine'
    },
    audit: {
        title: 'Website Audit',
        subtitle: 'Analyze prospect websites for opportunities'
    },
    outreach: {
        title: 'Outreach',
        subtitle: 'Generate personalized messages that convert'
    },
    pipeline: {
        title: 'Pipeline',
        subtitle: 'Track deals through every stage'
    },
    settings: {
        title: 'Settings',
        subtitle: 'Configure APIs, preferences and data'
    }
};

/**
 * Initialize the application
 */
function init() {
    console.log('🎯 AI Lead Hunter OS starting...');

    setupNavigation();
    setupMobileMenu();
    setupGlobalSearch();

    // Initialize modules
    initLeads();
    initOutreach();
    initPipeline();
    initSettings();
    initDiscovery();

    // Initial render
    handleRoute();
    updateDashboard();

    // Listen for storage changes (multi-tab support)
    window.addEventListener('storage', (e) => {
        if (e.key === 'ai_lead_hunter_leads') {
            updateDashboard();
            if (window.location.hash === '#leads') {
                refreshLeads();
            }
        }
    });

    console.log('✅ AI Lead Hunter OS ready');
}

/**
 * Hash-based routing
 */
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                window.location.hash = section;
            }
        });
    });

    window.addEventListener('hashchange', handleRoute);

    if (!window.location.hash) {
        window.location.hash = 'dashboard';
    }
}

/**
 * Handle current route / section
 */
function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const section = SECTION_META[hash] ? hash : 'dashboard';

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    // Show correct section
    document.querySelectorAll('.content-section').forEach(el => {
        el.classList.toggle('active', el.id === `${section}-section`);
    });

    // Update page title
    const meta = SECTION_META[section];
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');
    
    if (titleEl) titleEl.textContent = meta.title;
    if (subtitleEl) subtitleEl.textContent = meta.subtitle;

    // Section-specific init
    if (section === 'dashboard') {
        updateDashboard();
    } else if (section === 'leads') {
        refreshLeads();
    } else if (section === 'outreach') {
        refreshOutreachLeadSelect();
    } else if (section === 'pipeline') {
        renderPipelineBoard();
    } else if (section === 'settings') {
        refreshSettingsUI();
    } else if (section === 'discovery') {
        refreshDiscovery();
    }

    // Close mobile menu if open
    closeMobileMenu();
}

/**
 * Mobile sidebar
 */
function setupMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    mobileBtn?.addEventListener('click', () => {
        sidebar?.classList.add('open');
        overlay.classList.add('active');
    });

    overlay.addEventListener('click', closeMobileMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileMenu();
    });
}

function closeMobileMenu() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('active');
}

/**
 * Global search – navigates to leads and focuses search
 */
function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query) {
                window.location.hash = 'leads';
                setTimeout(() => {
                    const leadsSearch = document.getElementById('leadsSearch');
                    if (leadsSearch) {
                        leadsSearch.value = query;
                        leadsSearch.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 100);
            }
        }
    });
}

/**
 * Toast notification system
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);

    const close = () => {
        toast.style.animation = 'slideOut 0.25s ease forwards';
        setTimeout(() => toast.remove(), 250);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', close);
    setTimeout(close, duration);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Boot
document.addEventListener('DOMContentLoaded', init);
