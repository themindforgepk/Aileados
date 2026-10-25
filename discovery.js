/**
 * AI Lead Hunter OS - Lead Discovery Engine
 * =========================================
 * Search → normalize → preview score → bulk import into CRM.
 * Demo mode works without API keys.
 */

import {
    SEARCH_PROVIDER,
    SEARCH_API_KEY,
    SEARCH_ENDPOINT,
    isServiceReady
} from './api-config.js';
import { getLeads, addLead } from './storage.js';
import { calculateScore, getLeadIntelligence } from './scoring.js';
import { updateDashboard } from './dashboard.js';
import { showToast } from './app.js';
import { refreshLeads } from './leads.js';
import { refreshOutreachLeadSelect, renderPipelineBoard } from './outreach.js';

/** @type {Array<Object>} */
let lastResults = [];
/** @type {Set<string>} */
let selectedIds = new Set();

// ============================================
// PUBLIC API
// ============================================

/**
 * Search businesses by query
 * @param {{ industry?: string, country?: string, city?: string, keywords?: string }} query
 * @returns {Promise<Array>}
 */
export async function searchBusinesses(query) {
    const q = {
        industry: (query.industry || '').trim(),
        country: (query.country || '').trim(),
        city: (query.city || '').trim(),
        keywords: (query.keywords || '').trim()
    };

    if (isServiceReady('search')) {
        try {
            const raw = await searchWithProvider(q);
            return raw.map((item, i) => normalizeBusinessData(item, i));
        } catch (err) {
            console.warn('Search provider failed, falling back to demo:', err);
            showToast('Search API failed — showing demo results', 'warning');
        }
    }

    // Demo / mock provider
    await delay(450);
    return getMockBusinesses(q).map((item, i) => normalizeBusinessData(item, i));
}

/**
 * Normalize provider-specific payload into app lead shape + discovery meta
 */
export function normalizeBusinessData(raw, index = 0) {
    const website = cleanUrl(raw.website || raw.site || raw.url || '');
    const websiteStatus = inferWebsiteStatus(website, raw.websiteStatus);

    const candidate = {
        discoveryId: raw.discoveryId || raw.place_id || raw.id || `disc_${index}_${Date.now().toString(36)}`,
        businessName: (raw.businessName || raw.name || raw.title || 'Unknown Business').trim(),
        industry: (raw.industry || raw.category || raw.type || '').trim(),
        country: (raw.country || '').trim(),
        city: (raw.city || raw.locality || '').trim(),
        website,
        websiteStatus,
        email: (raw.email || '').trim(),
        phone: (raw.phone || raw.phoneNumber || raw.international_phone_number || '').trim(),
        rating: raw.rating != null ? Number(raw.rating) : null,
        reviews: raw.reviews != null ? Number(raw.reviews) : (raw.user_ratings_total != null ? Number(raw.user_ratings_total) : null),
        socialLinks: {
            facebook: raw.facebook || '',
            instagram: raw.instagram || '',
            linkedin: raw.linkedin || ''
        },
        notes: raw.notes || (raw.address ? `Address: ${raw.address}` : ''),
        status: 'new',
        source: raw.source || SEARCH_PROVIDER || 'demo'
    };

    // Preview intelligence via existing scoring engine
    const score = calculateScore(candidate);
    const intel = getLeadIntelligence({ ...candidate, score });

    return {
        ...candidate,
        score,
        scoreCategory: intel.category,
        scoreReasons: intel.reasons,
        opportunity: intel.opportunity,
        priority: intel.priority
    };
}

/**
 * Duplicate check against existing CRM leads
 */
export function checkDuplicateLead(candidate, existingLeads = null) {
    const leads = existingLeads || getLeads();
    const name = (candidate.businessName || '').toLowerCase().trim();
    const city = (candidate.city || '').toLowerCase().trim();
    const website = (candidate.website || '').toLowerCase().replace(/\/$/, '');

    return leads.some(l => {
        const lName = (l.businessName || '').toLowerCase().trim();
        const lCity = (l.city || '').toLowerCase().trim();
        const lWeb = (l.website || '').toLowerCase().replace(/\/$/, '');

        if (website && lWeb && website === lWeb) return true;
        if (name && lName === name && city && lCity === city) return true;
        if (name && lName === name && !city && !lCity) return true;
        return false;
    });
}

/**
 * Import selected discovery rows into CRM
 * @param {Array<Object>} rows
 * @returns {{ imported: number, skipped: number, duplicates: string[] }}
 */
export function importSelectedLeads(rows) {
    const existing = getLeads();
    let imported = 0;
    let skipped = 0;
    const duplicates = [];

    rows.forEach(row => {
        if (checkDuplicateLead(row, existing)) {
            skipped++;
            duplicates.push(row.businessName);
            return;
        }

        const leadData = {
            businessName: row.businessName,
            industry: row.industry,
            country: row.country,
            city: row.city,
            website: row.website,
            websiteStatus: row.websiteStatus || 'none',
            email: row.email || '',
            phone: row.phone || '',
            rating: row.rating,
            reviews: row.reviews,
            socialLinks: row.socialLinks || { facebook: '', instagram: '', linkedin: '' },
            notes: row.notes || `Imported from discovery (${row.source || 'demo'})`,
            status: 'new',
            followUpDate: null,
            score: calculateScore(row)
        };

        const created = addLead(leadData);
        existing.unshift(created);
        imported++;
    });

    return { imported, skipped, duplicates };
}

// ============================================
// UI
// ============================================

export function initDiscovery() {
    document.getElementById('discoverySearchBtn')?.addEventListener('click', handleSearch);
    document.getElementById('discoveryImportSelectedBtn')?.addEventListener('click', () => handleImport(false));
    document.getElementById('discoveryImportAllBtn')?.addEventListener('click', () => handleImport(true));
    document.getElementById('discoverySelectAll')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        selectedIds = new Set();
        if (checked) {
            lastResults.forEach(r => {
                if (!r._isDuplicate) selectedIds.add(r.discoveryId);
            });
        }
        renderResultsTable();
    });

    // Enter key on form
    document.getElementById('discoveryForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSearch();
    });

    updateProviderBadge();
}

export function refreshDiscovery() {
    updateProviderBadge();
    if (lastResults.length) renderResultsTable();
}

function updateProviderBadge() {
    const el = document.getElementById('discoveryProviderBadge');
    if (!el) return;
    if (isServiceReady('search')) {
        el.textContent = `Live · ${SEARCH_PROVIDER}`;
        el.className = 'api-status-badge ready';
    } else {
        el.textContent = 'Demo mode';
        el.className = 'api-status-badge pending';
    }
}

async function handleSearch() {
    const query = {
        industry: document.getElementById('discoveryIndustry')?.value || '',
        country: document.getElementById('discoveryCountry')?.value || '',
        city: document.getElementById('discoveryCity')?.value || '',
        keywords: document.getElementById('discoveryKeywords')?.value || ''
    };

    if (!query.industry && !query.keywords && !query.city) {
        showToast('Enter at least industry, city, or keywords', 'warning');
        return;
    }

    const tbody = document.getElementById('discoveryResultsBody');
    const empty = document.getElementById('discoveryEmpty');
    const loading = document.getElementById('discoveryLoading');
    const countEl = document.getElementById('discoveryResultCount');

    if (loading) loading.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';
    selectedIds = new Set();
    lastResults = [];

    try {
        const results = await searchBusinesses(query);
        const existing = getLeads();

        lastResults = results.map(r => ({
            ...r,
            _isDuplicate: checkDuplicateLead(r, existing)
        }));

        if (countEl) countEl.textContent = `${lastResults.length} result${lastResults.length !== 1 ? 's' : ''}`;
        renderResultsTable();

        if (!lastResults.length && empty) empty.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showToast('Search failed', 'error');
        if (empty) empty.classList.remove('hidden');
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function renderResultsTable() {
    const tbody = document.getElementById('discoveryResultsBody');
    if (!tbody) return;

    if (!lastResults.length) {
        tbody.innerHTML = '';
        return;
    }

    tbody.innerHTML = lastResults.map(r => {
        const cat = r.scoreCategory || 'low';
        const loc = [r.city, r.country].filter(Boolean).join(', ') || '—';
        const ws = formatWebsiteStatus(r.websiteStatus);
        const disabled = r._isDuplicate ? 'disabled' : '';
        const checked = selectedIds.has(r.discoveryId) ? 'checked' : '';
        const reasons = (r.scoreReasons || []).slice(0, 3)
            .map(x => `${x.points > 0 ? '+' : ''}${x.points} ${escapeHtml(x.label)}`)
            .join(' · ');

        return `
            <tr class="${r._isDuplicate ? 'row-duplicate' : ''}" data-id="${escapeAttr(r.discoveryId)}">
                <td>
                    <input type="checkbox" class="discovery-check" data-id="${escapeAttr(r.discoveryId)}" ${checked} ${disabled}>
                </td>
                <td>
                    <div class="fw-600 text-primary">${escapeHtml(r.businessName)}</div>
                    ${r._isDuplicate ? '<div class="text-muted" style="font-size:0.7rem;">Already in CRM</div>' : ''}
                    ${reasons ? `<div class="disc-reasons">${reasons}</div>` : ''}
                </td>
                <td class="cell-clip">${r.website ? `<a href="${escapeAttr(r.website)}" target="_blank" rel="noopener">${escapeHtml(truncate(r.website, 28))}</a>` : '—'}</td>
                <td>${escapeHtml(r.phone || '—')}</td>
                <td>${r.rating != null ? r.rating + ' ★' : '—'}</td>
                <td>${r.reviews != null ? r.reviews : '—'}</td>
                <td>${escapeHtml(loc)}</td>
                <td><span class="website-badge ${r.websiteStatus || 'none'}">${ws}</span></td>
                <td>
                    <span class="score-badge ${cat}">${r.score ?? 0}</span>
                    <div class="text-muted" style="font-size:0.65rem;margin-top:2px;">${escapeHtml(r.priority?.label || cat)}</div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.discovery-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            syncSelectAll();
        });
    });

    syncSelectAll();
}

function syncSelectAll() {
    const selectAll = document.getElementById('discoverySelectAll');
    if (!selectAll) return;
    const selectable = lastResults.filter(r => !r._isDuplicate);
    selectAll.checked = selectable.length > 0 && selectedIds.size === selectable.length;
    selectAll.indeterminate = selectedIds.size > 0 && selectedIds.size < selectable.length;
}

function handleImport(all) {
    let rows;
    if (all) {
        rows = lastResults.filter(r => !r._isDuplicate);
    } else {
        rows = lastResults.filter(r => selectedIds.has(r.discoveryId) && !r._isDuplicate);
    }

    if (!rows.length) {
        showToast(all ? 'No new leads to import' : 'Select at least one lead', 'warning');
        return;
    }

    const result = importSelectedLeads(rows);

    if (result.imported > 0) {
        showToast(`Imported ${result.imported} lead${result.imported > 1 ? 's' : ''}${result.skipped ? ` · ${result.skipped} skipped` : ''}`, 'success');
        updateDashboard();
        try { refreshLeads(); } catch (_) {}
        try { refreshOutreachLeadSelect(); } catch (_) {}
        try { renderPipelineBoard(); } catch (_) {}

        // Mark imported as duplicates in current results
        const existing = getLeads();
        lastResults = lastResults.map(r => ({
            ...r,
            _isDuplicate: checkDuplicateLead(r, existing)
        }));
        selectedIds = new Set();
        renderResultsTable();
    } else {
        showToast(`No leads imported · ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''}`, 'info');
    }
}

// ============================================
// PROVIDER ADAPTER (placeholder)
// ============================================

async function searchWithProvider(query) {
    const endpoint = SEARCH_ENDPOINT || '';
    const provider = SEARCH_PROVIDER;

    // --- Google Places example (enable when configured) ---
    if (provider === 'google_places') {
        /*
        const url = `${endpoint}?query=${encodeURIComponent(
            [query.industry, query.keywords, query.city, query.country].filter(Boolean).join(' ')
        )}&key=${SEARCH_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.results || []).map(place => ({
            place_id: place.place_id,
            name: place.name,
            website: place.website,
            phone: place.formatted_phone_number,
            rating: place.rating,
            reviews: place.user_ratings_total,
            address: place.formatted_address,
            city: query.city,
            country: query.country,
            industry: query.industry,
            source: 'google_places'
        }));
        */
        throw new Error('Google Places adapter not fully configured — set endpoint and uncomment fetch');
    }

    // --- SerpAPI / generic JSON list ---
    if (provider === 'serpapi' || provider === 'generic') {
        /*
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SEARCH_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });
        const data = await res.json();
        return data.results || data || [];
        */
        throw new Error('Generic search adapter not fully configured');
    }

    throw new Error(`Unknown SEARCH_PROVIDER: ${provider}`);
}

// ============================================
// DEMO DATA
// ============================================

function getMockBusinesses(query) {
    const industry = query.industry || query.keywords || 'Business';
    const city = query.city || 'Metro';
    const country = query.country || 'Australia';

    const templates = [
        { name: `${city} Premium ${industry}`, website: '', reviews: 86, rating: 4.7, phone: '+61 3 9000 1001', status: 'none' },
        { name: `${industry} Hub ${city}`, website: `https://www.${slug(city)}-${slug(industry)}.example`, reviews: 124, rating: 4.8, phone: '+61 3 9000 1002', status: 'outdated' },
        { name: `North ${city} ${industry}`, website: '', reviews: 42, rating: 4.4, phone: '+61 3 9000 1003', status: 'none' },
        { name: `${industry} Partners`, website: `https://old-${slug(industry)}.example`, reviews: 18, rating: 3.9, phone: '+61 3 9000 1004', status: 'outdated' },
        { name: `Elite ${industry} ${city}`, website: `https://www.elite-${slug(industry)}.example`, reviews: 210, rating: 4.9, phone: '+61 3 9000 1005', status: 'good' },
        { name: `${city} Family ${industry}`, website: '', reviews: 67, rating: 4.6, phone: '+61 3 9000 1006', status: 'none' },
        { name: `Downtown ${industry} Group`, website: `https://downtown-${slug(industry)}.example`, reviews: 33, rating: 4.1, phone: '+61 3 9000 1007', status: 'outdated' },
        { name: `${industry} Works ${city}`, website: '', reviews: 9, rating: 3.2, phone: '+61 3 9000 1008', status: 'none' }
    ];

    return templates.map((t, i) => ({
        discoveryId: `mock_${slug(city)}_${i}`,
        name: t.name,
        industry: industry,
        country,
        city,
        website: t.website,
        websiteStatus: t.status,
        phone: t.phone,
        rating: t.rating,
        reviews: t.reviews,
        source: 'demo',
        notes: `Demo discovery result for ${industry} in ${city}, ${country}`
    }));
}

// ============================================
// HELPERS
// ============================================

function inferWebsiteStatus(website, explicit) {
    if (explicit === 'none' || explicit === 'outdated' || explicit === 'good') return explicit;
    if (!website) return 'none';
    return 'outdated';
}

function cleanUrl(url) {
    if (!url) return '';
    let u = String(url).trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
        return new URL(u).href;
    } catch {
        return '';
    }
}

function formatWebsiteStatus(status) {
    const map = { none: 'No Website', outdated: 'Outdated', good: 'Good' };
    return map[status] || 'No Website';
}

function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
