/**
 * AI Lead Hunter OS - API Configuration
 * =====================================
 * Central place for all external service credentials and endpoints.
 *
 * IMPORTANT:
 * - Never commit real API keys to version control.
 * - In production, load these from environment variables or a secure backend.
 */

// ============================================
// AI SERVICES
// ============================================

export const AI_API_KEY = "";
export const AI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const AI_MODEL = "gpt-4o-mini";

// ============================================
// SEARCH & LEAD DISCOVERY
// ============================================

/**
 * Provider id: "" | "google_places" | "serpapi" | "outscraper" | "csv"
 * When empty or not ready, discovery.js uses demo/mock results.
 */
export const SEARCH_PROVIDER = "";
export const SEARCH_API_KEY = "";
/** Primary endpoint (alias kept for older name) */
export const SEARCH_ENDPOINT = "";
export const SEARCH_API_ENDPOINT = SEARCH_ENDPOINT; // backward-compatible alias

// ============================================
// WEBSITE ANALYSIS
// ============================================

export const PAGESPEED_API_KEY = "";
export const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export const TECH_DETECT_API_KEY = "";
export const TECH_DETECT_ENDPOINT = "";

// ============================================
// DATABASE / BACKEND
// ============================================

export const DATABASE_API = "";
export const DATABASE_API_KEY = "";

// ============================================
// MESSAGING
// ============================================

export const EMAIL_API_KEY = "";
export const EMAIL_API_ENDPOINT = "";

export const WHATSAPP_API_KEY = "";
export const WHATSAPP_API_ENDPOINT = "";

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
    useRealAI: false,
    usePageSpeed: false,
    useDatabase: false,
    enableAutoDiscovery: false // set true when SEARCH_PROVIDER + SEARCH_API_KEY are set
};

/**
 * @param {'ai'|'pagespeed'|'database'|'search'} service
 */
export function isServiceReady(service) {
    switch (service) {
        case 'ai':
            return FEATURES.useRealAI && AI_API_KEY.length > 0;
        case 'pagespeed':
            return FEATURES.usePageSpeed && PAGESPEED_API_KEY.length > 0;
        case 'database':
            return FEATURES.useDatabase && DATABASE_API.length > 0;
        case 'search':
            return FEATURES.enableAutoDiscovery &&
                SEARCH_PROVIDER.length > 0 &&
                SEARCH_API_KEY.length > 0;
        default:
            return false;
    }
}
