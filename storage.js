/**
 * AI Lead Hunter OS - Storage Layer
 * =================================
 * Abstraction over data persistence.
 * Currently uses LocalStorage.
 * Designed to be swapped with real API calls later.
 */

const STORAGE_KEY = 'ai_lead_hunter_leads';
const SETTINGS_KEY = 'ai_lead_hunter_settings';

/**
 * Get all leads
 * @returns {Array} Array of lead objects
 */
export function getLeads() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading leads from storage:', error);
        return [];
    }
}

/**
 * Save all leads
 * @param {Array} leads 
 */
export function saveLeads(leads) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
        return true;
    } catch (error) {
        console.error('Error saving leads to storage:', error);
        return false;
    }
}

/**
 * Get a single lead by ID
 * @param {string} id 
 * @returns {Object|null}
 */
export function getLeadById(id) {
    const leads = getLeads();
    return leads.find(lead => lead.id === id) || null;
}

/**
 * Add a new lead
 * @param {Object} leadData 
 * @returns {Object} The created lead with id and timestamps
 */
export function addLead(leadData) {
    const leads = getLeads();
    
    const newLead = {
        id: generateId(),
        ...leadData,
        score: leadData.score ?? 0,
        status: leadData.status || 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        followUpDate: leadData.followUpDate || null,
        notes: leadData.notes || '',
        auditResult: null
    };

    leads.unshift(newLead); // newest first
    saveLeads(leads);
    return newLead;
}

/**
 * Update an existing lead
 * @param {string} id 
 * @param {Object} updates 
 * @returns {Object|null} Updated lead or null if not found
 */
export function updateLead(id, updates) {
    const leads = getLeads();
    const index = leads.findIndex(lead => lead.id === id);
    
    if (index === -1) return null;

    leads[index] = {
        ...leads[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    saveLeads(leads);
    return leads[index];
}

/**
 * Delete a lead
 * @param {string} id 
 * @returns {boolean}
 */
export function deleteLead(id) {
    const leads = getLeads();
    const filtered = leads.filter(lead => lead.id !== id);
    
    if (filtered.length === leads.length) return false;
    
    saveLeads(filtered);
    return true;
}

/**
 * Get app settings
 */
export function getSettings() {
    try {
        const data = localStorage.getItem(SETTINGS_KEY);
        return data ? JSON.parse(data) : getDefaultSettings();
    } catch {
        return getDefaultSettings();
    }
}

/**
 * Save app settings
 */
export function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getDefaultSettings() {
    return {
        agencyName: 'My Web Agency',
        yourName: '',
        emailSignature: '',
        defaultCountry: '',
        outreachTone: 'consultative',
        scoreWeights: {
            noWebsite: 40,
            outdatedWebsite: 30,
            noMobile: 20,
            noBooking: 15,
            highReviews: 10,
            premiumIndustry: 10
        }
    };
}

/**
 * Generate a simple unique ID
 */
function generateId() {
    return 'lead_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Export all data as JSON (for backup)
 */
export function exportData() {
    return {
        leads: getLeads(),
        settings: getSettings(),
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
    };
}

/**
 * Import data from JSON backup
 * @param {Object} data 
 * @param {boolean} merge - if true, merge with existing; if false, replace
 */
export function importData(data, merge = false) {
    if (!data || !Array.isArray(data.leads)) {
        throw new Error('Invalid import data format');
    }

    if (merge) {
        const existing = getLeads();
        const existingIds = new Set(existing.map(l => l.id));
        const newLeads = data.leads.filter(l => !existingIds.has(l.id));
        saveLeads([...newLeads, ...existing]);
    } else {
        saveLeads(data.leads);
    }

    if (data.settings) {
        saveSettings(data.settings);
    }

    return true;
}

/**
 * Clear all leads (use with caution)
 */
export function clearAllLeads() {
    localStorage.removeItem(STORAGE_KEY);
}

// ============================================
// FUTURE: API-based storage methods
// ============================================
// When ready to switch to a real backend, implement:
//
// export async function getLeads() {
//     const response = await fetch(`${DATABASE_API}/leads`, {
//         headers: { 'Authorization': `Bearer ${DATABASE_API_KEY}` }
//     });
//     return response.json();
// }
//
// Same pattern for addLead, updateLead, deleteLead, etc.
// Then set FEATURES.useDatabase = true in api-config.js


/**
 * Create a full backup object (leads + settings + meta)
 */
export function createBackup() {
    return {
        leads: getLeads(),
        settings: getSettings(),
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        app: 'AI Lead Hunter OS'
    };
}

/**
 * Restore from backup object
 * @param {Object} data
 * @param {boolean} merge
 */
export function restoreBackup(data, merge = false) {
    return importData(data, merge);
}

/**
 * Clear all application data (leads + optional settings)
 * @param {boolean} includeSettings
 */
export function clearAllData(includeSettings = false) {
    clearAllLeads();
    if (includeSettings) {
        localStorage.removeItem(SETTINGS_KEY);
    }
    return true;
}

/**
 * Export leads as CSV string
 */
export function exportLeadsCSV() {
    const leads = getLeads();
    const headers = [
        'Business Name', 'Industry', 'Country', 'City', 'Website', 'Email', 'Phone',
        'Score', 'Category', 'Status', 'Website Status',
        'Audit Opportunity Score', 'Main Problems',
        'Last Contacted', 'Follow-up Date', 'Messages Sent'
    ];

    const rows = leads.map(l => {
        const score = l.score ?? 0;
        const category = score >= 71 ? 'Hot' : score >= 41 ? 'Medium' : 'Low';
        const auditScore = l.auditResult?.opportunityScore ?? '';
        let problems = '';
        if (l.auditResult && !l.auditResult.error) {
            const parts = [];
            if (l.auditResult.hasBooking === false) parts.push('No booking');
            if (l.auditResult.hasClearCTA === false) parts.push('Weak CTA');
            if (l.auditResult.hasContactForm === false) parts.push('No contact form');
            if (l.auditResult.mobileScore !== '' && Number(l.auditResult.mobileScore) < 50) parts.push('Weak mobile');
            if (l.websiteStatus === 'none') parts.push('No website');
            if (l.websiteStatus === 'outdated') parts.push('Outdated site');
            problems = parts.join('; ');
        } else if (l.websiteStatus === 'none') {
            problems = 'No website';
        } else if (l.websiteStatus === 'outdated') {
            problems = 'Outdated website';
        }
        const messagesSent = Array.isArray(l.outreachLog) ? l.outreachLog.length : 0;

        const cols = [
            l.businessName || '',
            l.industry || '',
            l.country || '',
            l.city || '',
            l.website || '',
            l.email || '',
            l.phone || '',
            score,
            category,
            l.status || 'new',
            l.websiteStatus || '',
            auditScore,
            problems,
            l.lastContactedAt || '',
            l.followUpDate || '',
            messagesSent
        ];
        return cols.map(csvEscape).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

function csvEscape(val) {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}
