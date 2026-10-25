/**
 * AI Lead Hunter OS - Lead Management Module
 * ==========================================
 * Full CRM-style lead management: CRUD, search, filters,
 * validation, table + card views, modal forms.
 */

import {
    getLeads,
    addLead,
    updateLead,
    deleteLead,
    getLeadById
} from './storage.js';
import { updateDashboard } from './dashboard.js';
import { showToast } from './app.js';
import { calculateScore, getLeadIntelligence, getScoreCategory } from './scoring.js';
import { runFullAudit, generateAuditReport } from './audit.js';

// Current state
let currentFilters = {
    search: '',
    industry: '',
    country: '',
    status: '',
    score: '',
    website: ''
};

let editingId = null;
let deletingId = null;
let viewingId = null;

/**
 * Initialize the leads module
 */
export function initLeads() {
    bindToolbar();
    bindFilters();
    bindModals();
    bindTableActions();

    // Also bind the topbar "Add Lead" button
    const topAddBtn = document.getElementById('addLeadBtn');
    if (topAddBtn) {
        // Remove previous listeners by cloning
        const newBtn = topAddBtn.cloneNode(true);
        topAddBtn.parentNode.replaceChild(newBtn, topAddBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openLeadModal();
        });
    }

    // Render if we're already on the leads section
    if (window.location.hash === '#leads') {
        renderLeads();
    }
}

/**
 * Public: refresh leads UI (called from routing)
 */
export function refreshLeads() {
    populateFilterOptions();
    renderLeads();
}

/**
 * Toolbar bindings
 */
function bindToolbar() {
    const searchInput = document.getElementById('leadsSearch');
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                currentFilters.search = e.target.value.trim().toLowerCase();
                renderLeads();
            }, 250);
        });
    }

    document.getElementById('toggleFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('filtersPanel')?.classList.toggle('open');
    });

    document.getElementById('addLeadBtnLeads')?.addEventListener('click', () => {
        openLeadModal();
    });

    document.getElementById('loadSampleBtn')?.addEventListener('click', loadSampleData);
}

/**
 * Filter bindings
 */
function bindFilters() {
    const filterIds = [
        ['filterIndustry', 'industry'],
        ['filterCountry', 'country'],
        ['filterStatus', 'status'],
        ['filterScore', 'score'],
        ['filterWebsite', 'website']
    ];

    filterIds.forEach(([elId, key]) => {
        document.getElementById(elId)?.addEventListener('change', (e) => {
            currentFilters[key] = e.target.value;
            renderLeads();
        });
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        currentFilters = {
            search: '',
            industry: '',
            country: '',
            status: '',
            score: '',
            website: ''
        };
        const searchInput = document.getElementById('leadsSearch');
        if (searchInput) searchInput.value = '';
        ['filterIndustry', 'filterCountry', 'filterStatus', 'filterScore', 'filterWebsite']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        renderLeads();
    });
}

/**
 * Populate dynamic filter options from existing leads
 */
function populateFilterOptions() {
    const leads = getLeads();
    const industries = [...new Set(leads.map(l => l.industry).filter(Boolean))].sort();
    const countries = [...new Set(leads.map(l => l.country).filter(Boolean))].sort();

    const indSelect = document.getElementById('filterIndustry');
    const ctrySelect = document.getElementById('filterCountry');

    if (indSelect) {
        const current = indSelect.value;
        indSelect.innerHTML = '<option value="">All Industries</option>' +
            industries.map(i => `<option value="${escapeAttr(i)}">${escapeHtml(i)}</option>`).join('');
        indSelect.value = current;
    }

    if (ctrySelect) {
        const current = ctrySelect.value;
        ctrySelect.innerHTML = '<option value="">All Countries</option>' +
            countries.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
        ctrySelect.value = current;
    }
}

/**
 * Apply filters and return filtered list
 */
function getFilteredLeads() {
    let leads = getLeads();

    if (currentFilters.search) {
        const q = currentFilters.search;
        leads = leads.filter(l =>
            (l.businessName || '').toLowerCase().includes(q) ||
            (l.city || '').toLowerCase().includes(q) ||
            (l.email || '').toLowerCase().includes(q) ||
            (l.industry || '').toLowerCase().includes(q) ||
            (l.country || '').toLowerCase().includes(q)
        );
    }

    if (currentFilters.industry) {
        leads = leads.filter(l => l.industry === currentFilters.industry);
    }
    if (currentFilters.country) {
        leads = leads.filter(l => l.country === currentFilters.country);
    }
    if (currentFilters.status) {
        leads = leads.filter(l => l.status === currentFilters.status);
    }
    if (currentFilters.score) {
        if (currentFilters.score === 'hot') leads = leads.filter(l => (l.score ?? 0) >= 71);
        else if (currentFilters.score === 'medium') leads = leads.filter(l => (l.score ?? 0) >= 41 && (l.score ?? 0) <= 70);
        else if (currentFilters.score === 'low') leads = leads.filter(l => (l.score ?? 0) <= 40);
    }
    if (currentFilters.website) {
        leads = leads.filter(l => (l.websiteStatus || 'none') === currentFilters.website);
    }

    return leads;
}

/**
 * Main render function
 */
function renderLeads() {
    const leads = getFilteredLeads();
    const countEl = document.getElementById('leadsCount');
    if (countEl) {
        countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
    }

    renderTable(leads);
    renderCards(leads);
}

/**
 * Desktop table
 */
function renderTable(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    if (leads.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="leads-empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p>No leads match your filters.</p>
                        <button class="btn btn-primary btn-sm" id="emptyAddFromTable">Add Lead</button>
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('emptyAddFromTable')?.addEventListener('click', () => openLeadModal());
        return;
    }

    tbody.innerHTML = leads.map(lead => {
        const scoreClass = getScoreClass(lead.score);
        const websiteLabel = formatWebsiteStatus(lead.websiteStatus);
        const statusLabel = formatStatus(lead.status);
        const location = [lead.city, lead.country].filter(Boolean).join(', ') || '—';
        const followUp = lead.followUpDate
            ? new Date(lead.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—';

        return `
            <tr data-id="${lead.id}">
                <td>
                    <div class="fw-600 text-primary">${escapeHtml(lead.businessName)}</div>
                    ${lead.email ? `<div class="text-muted" style="font-size:0.75rem;">${escapeHtml(lead.email)}</div>` : ''}
                </td>
                <td>${escapeHtml(lead.industry || '—')}</td>
                <td>${escapeHtml(location)}</td>
                <td>
                    <span class="website-badge ${lead.websiteStatus || 'none'}">${websiteLabel}</span>
                </td>
                <td>
                    <span class="score-badge ${scoreClass}">${lead.score ?? 0}</span>
                </td>
                <td>
                    <span class="status-badge ${lead.status || 'new'}">${statusLabel}</span>
                </td>
                <td>${followUp}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-ghost btn-sm action-view" data-id="${lead.id}" title="View">View</button>
                        <button class="btn btn-ghost btn-sm action-edit" data-id="${lead.id}" title="Edit">Edit</button>
                        <button class="btn btn-ghost btn-sm action-delete" data-id="${lead.id}" title="Delete">Del</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Mobile card view
 */
function renderCards(leads) {
    const container = document.getElementById('leadsCards');
    if (!container) return;

    if (leads.length === 0) {
        container.innerHTML = `
            <div class="leads-empty">
                <p>No leads match your filters.</p>
                <button class="btn btn-primary btn-sm" id="emptyAddFromCards">Add Lead</button>
            </div>
        `;
        document.getElementById('emptyAddFromCards')?.addEventListener('click', () => openLeadModal());
        return;
    }

    container.innerHTML = leads.map(lead => {
        const scoreClass = getScoreClass(lead.score);
        const websiteLabel = formatWebsiteStatus(lead.websiteStatus);
        const statusLabel = formatStatus(lead.status);
        const location = [lead.city, lead.country].filter(Boolean).join(', ') || '';

        return `
            <div class="lead-card" data-id="${lead.id}">
                <div class="lead-card-header">
                    <div>
                        <div class="lead-card-title">${escapeHtml(lead.businessName)}</div>
                        <div class="lead-card-meta">${escapeHtml(lead.industry || '')}${location ? ' · ' + escapeHtml(location) : ''}</div>
                    </div>
                    <span class="score-badge ${scoreClass}">${lead.score ?? 0}</span>
                </div>
                <div class="lead-card-body">
                    <span class="status-badge ${lead.status || 'new'}">${statusLabel}</span>
                    <span class="website-badge ${lead.websiteStatus || 'none'}">${websiteLabel}</span>
                </div>
                <div class="lead-card-footer">
                    <span class="text-muted" style="font-size:0.75rem;">
                        ${lead.followUpDate ? 'Follow-up: ' + new Date(lead.followUpDate).toLocaleDateString() : 'No follow-up'}
                    </span>
                    <div class="action-btns">
                        <button class="btn btn-ghost btn-sm action-view" data-id="${lead.id}">View</button>
                        <button class="btn btn-ghost btn-sm action-edit" data-id="${lead.id}">Edit</button>
                        <button class="btn btn-ghost btn-sm action-delete" data-id="${lead.id}">Del</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Event delegation for table / cards actions
 */
function bindTableActions() {
    document.getElementById('leads-section')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-id]');
        if (!btn) return;

        const id = btn.dataset.id;
        if (btn.classList.contains('action-view')) {
            openViewModal(id);
        } else if (btn.classList.contains('action-edit')) {
            openLeadModal(id);
        } else if (btn.classList.contains('action-delete')) {
            openDeleteModal(id);
        }
    });
}

/**
 * Modal bindings
 */
function bindModals() {
    document.getElementById('leadModalClose')?.addEventListener('click', closeLeadModal);
    document.getElementById('leadModalCancel')?.addEventListener('click', closeLeadModal);
    document.getElementById('leadModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'leadModal') closeLeadModal();
    });

    document.getElementById('leadForm')?.addEventListener('submit', handleFormSubmit);

    document.getElementById('viewLeadClose')?.addEventListener('click', closeViewModal);
    document.getElementById('viewLeadCloseBtn')?.addEventListener('click', closeViewModal);
    document.getElementById('viewLeadModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'viewLeadModal') closeViewModal();
    });
    document.getElementById('viewLeadEditBtn')?.addEventListener('click', () => {
        closeViewModal();
        if (viewingId) openLeadModal(viewingId);
    });

    document.getElementById('deleteModalClose')?.addEventListener('click', closeDeleteModal);
    document.getElementById('deleteModalCancel')?.addEventListener('click', closeDeleteModal);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });
    document.getElementById('deleteConfirmBtn')?.addEventListener('click', confirmDelete);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLeadModal();
            closeViewModal();
            closeDeleteModal();
        }
    });
}

/**
 * Open Add / Edit modal
 */
function openLeadModal(id = null) {
    editingId = id;
    const form = document.getElementById('leadForm');
    const title = document.getElementById('leadModalTitle');
    const submitBtn = document.getElementById('leadFormSubmit');

    form.reset();
    clearFormErrors();
    document.getElementById('leadId').value = '';

    if (id) {
        const lead = getLeadById(id);
        if (!lead) return;

        title.textContent = 'Edit Lead';
        submitBtn.textContent = 'Update Lead';

        document.getElementById('leadId').value = lead.id;
        document.getElementById('businessName').value = lead.businessName || '';
        document.getElementById('industry').value = lead.industry || '';
        document.getElementById('websiteStatus').value = lead.websiteStatus || 'none';
        document.getElementById('country').value = lead.country || '';
        document.getElementById('city').value = lead.city || '';
        document.getElementById('website').value = lead.website || '';
        document.getElementById('email').value = lead.email || '';
        document.getElementById('phone').value = lead.phone || '';
        document.getElementById('rating').value = lead.rating ?? '';
        document.getElementById('reviews').value = lead.reviews ?? '';
        document.getElementById('status').value = lead.status || 'new';
        document.getElementById('followUpDate').value = lead.followUpDate || '';
        document.getElementById('socialFacebook').value = lead.socialLinks?.facebook || '';
        document.getElementById('socialInstagram').value = lead.socialLinks?.instagram || '';
        document.getElementById('socialLinkedin').value = lead.socialLinks?.linkedin || '';
        document.getElementById('notes').value = lead.notes || '';
    } else {
        title.textContent = 'Add New Lead';
        submitBtn.textContent = 'Save Lead';
        document.getElementById('websiteStatus').value = 'none';
        document.getElementById('status').value = 'new';
    }

    document.getElementById('leadModal')?.classList.add('open');
    setTimeout(() => document.getElementById('businessName')?.focus(), 100);
}

function closeLeadModal() {
    document.getElementById('leadModal')?.classList.remove('open');
    editingId = null;
}

/**
 * Form validation + submit
 */
function handleFormSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    const businessName = document.getElementById('businessName').value.trim();
    const website = document.getElementById('website').value.trim();
    const email = document.getElementById('email').value.trim();

    let valid = true;

    if (!businessName) {
        showFieldError('businessName', 'Business name is required');
        valid = false;
    }

    if (website && !isValidUrl(website)) {
        showFieldError('website', 'Please enter a valid URL (include https://)');
        valid = false;
    }

    if (email && !isValidEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        valid = false;
    }

    // Duplicate check (business name + city)
    if (businessName) {
        const cityVal = document.getElementById('city').value.trim().toLowerCase();
        const existing = getLeads().find(l =>
            l.businessName.toLowerCase() === businessName.toLowerCase() &&
            (l.city || '').toLowerCase() === cityVal &&
            l.id !== editingId
        );
        if (existing) {
            showFieldError('businessName', 'A lead with this name and city already exists');
            valid = false;
        }
    }

    if (!valid) return;

    const leadData = {
        businessName,
        industry: document.getElementById('industry').value.trim(),
        websiteStatus: document.getElementById('websiteStatus').value,
        country: document.getElementById('country').value.trim(),
        city: document.getElementById('city').value.trim(),
        website: website,
        email: email,
        phone: document.getElementById('phone').value.trim(),
        rating: parseFloat(document.getElementById('rating').value) || null,
        reviews: parseInt(document.getElementById('reviews').value, 10) || null,
        status: document.getElementById('status').value,
        followUpDate: document.getElementById('followUpDate').value || null,
        socialLinks: {
            facebook: document.getElementById('socialFacebook').value.trim(),
            instagram: document.getElementById('socialInstagram').value.trim(),
            linkedin: document.getElementById('socialLinkedin').value.trim()
        },
        notes: document.getElementById('notes').value.trim()
    };

    // Always recalculate score from current data (Phase 3 engine)
    leadData.score = calculateScore(leadData);

    if (editingId) {
        updateLead(editingId, leadData);
        showToast('Lead updated successfully', 'success');
    } else {
        addLead(leadData);
        showToast('Lead added successfully', 'success');
    }

    closeLeadModal();
    populateFilterOptions();
    renderLeads();
    updateDashboard();
}

/**
 * View modal
 */
function openViewModal(id) {
    const lead = getLeadById(id);
    if (!lead) return;

    viewingId = id;
    document.getElementById('viewLeadTitle').textContent = lead.businessName;

    const intel = getLeadIntelligence(lead);
    const scoreClass = intel.category;
    const body = document.getElementById('viewLeadBody');

    const reasonsHtml = intel.reasons.length
        ? intel.reasons.map(r => {
            const sign = r.points > 0 ? '+' : '';
            const cls = r.type === 'positive' ? 'reason-positive' : 'reason-negative';
            return `<div class="score-reason ${cls}"><span class="reason-points">${sign}${r.points}</span> <span class="reason-label">${escapeHtml(r.label)}</span></div>`;
          }).join('')
        : '<div class="text-muted">No scoring factors applied.</div>';

    body.innerHTML = `
        <div class="score-intelligence">
            <div class="score-main">
                <div class="score-circle ${scoreClass}">
                    <span class="score-number">${intel.score}</span>
                    <span class="score-max">/100</span>
                </div>
                <div class="score-meta">
                    <div class="priority-badge ${scoreClass}">${intel.priority.emoji} ${intel.priority.label}</div>
                    <div class="score-bar-track">
                        <div class="score-bar-fill ${scoreClass}" style="width: ${intel.score}%"></div>
                    </div>
                </div>
            </div>
            <div class="score-reasons-block">
                <div class="detail-label">Score Breakdown</div>
                <div class="score-reasons-list">${reasonsHtml}</div>
            </div>
            <div class="opportunity-box">
                <div class="detail-label">Opportunity</div>
                <p>${escapeHtml(intel.opportunity)}</p>
            </div>
        </div>

        <div class="detail-grid" style="margin-top: 1.5rem;">
            <div class="detail-item">
                <span class="detail-label">Industry</span>
                <span class="detail-value">${escapeHtml(lead.industry || '—')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Location</span>
                <span class="detail-value">${escapeHtml([lead.city, lead.country].filter(Boolean).join(', ') || '—')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Website</span>
                <span class="detail-value">
                    ${lead.website
                        ? `<a href="${escapeAttr(lead.website)}" target="_blank" rel="noopener">${escapeHtml(lead.website)}</a>`
                        : '—'}
                    <span class="website-badge ${lead.websiteStatus || 'none'}" style="margin-left:8px;">
                        ${formatWebsiteStatus(lead.websiteStatus)}
                    </span>
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value">
                    <span class="status-badge ${lead.status || 'new'}">${formatStatus(lead.status)}</span>
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Follow-up Date</span>
                <span class="detail-value">${lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : '—'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-value">
                    ${lead.email ? `<a href="mailto:${escapeAttr(lead.email)}">${escapeHtml(lead.email)}</a>` : '—'}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phone</span>
                <span class="detail-value">${escapeHtml(lead.phone || '—')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Google Rating</span>
                <span class="detail-value">${lead.rating != null ? lead.rating + ' ★' : '—'} ${lead.reviews != null ? '(' + lead.reviews + ' reviews)' : ''}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Created</span>
                <span class="detail-value">${lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div class="detail-item full">
                <span class="detail-label">Social Links</span>
                <span class="detail-value">
                    ${lead.socialLinks?.facebook ? `<a href="${escapeAttr(lead.socialLinks.facebook)}" target="_blank">Facebook</a> · ` : ''}
                    ${lead.socialLinks?.instagram ? `<a href="${escapeAttr(lead.socialLinks.instagram)}" target="_blank">Instagram</a> · ` : ''}
                    ${lead.socialLinks?.linkedin ? `<a href="${escapeAttr(lead.socialLinks.linkedin)}" target="_blank">LinkedIn</a>` : ''}
                    ${!lead.socialLinks?.facebook && !lead.socialLinks?.instagram && !lead.socialLinks?.linkedin ? '—' : ''}
                </span>
            </div>
            <div class="detail-item full">
                <span class="detail-label">Notes</span>
                <span class="detail-value">${escapeHtml(lead.notes || 'No notes yet.')}</span>
            </div>
        </div>

        <div class="audit-section" id="auditSection">
            <div class="audit-section-header">
                <h4>Website Audit</h4>
                <button type="button" class="btn btn-primary btn-sm" id="runAuditBtn" ${!lead.website && lead.websiteStatus !== 'none' ? '' : ''}>
                    ${lead.auditResult ? 'Re-run Audit' : 'Run Audit'}
                </button>
            </div>
            <div id="auditReportContainer">
                ${renderAuditBlock(lead)}
            </div>
        </div>
    `;

    document.getElementById('viewLeadModal')?.classList.add('open');

    // Bind audit button
    document.getElementById('runAuditBtn')?.addEventListener('click', () => handleRunAudit(id));
}

/**
 * Render audit report HTML for a lead
 */
function renderAuditBlock(lead) {
    if (!lead.website && lead.websiteStatus === 'none') {
        return `
            <div class="audit-empty">
                <p class="text-muted">No website URL on file. This lead scores high partly because they have no online presence — a full build is the opportunity.</p>
            </div>
        `;
    }

    if (!lead.auditResult) {
        return `
            <div class="audit-empty">
                <p class="text-muted">No audit yet. Run an audit to detect conversion gaps and feed the scoring engine.</p>
            </div>
        `;
    }

    const report = generateAuditReport(lead.auditResult);
    const problemsHtml = report.problems.length
        ? report.problems.map(p => `<div class="audit-problem">❌ ${escapeHtml(p)}</div>`).join('')
        : '<div class="text-muted">No major problems flagged.</div>';
    const strengthsHtml = report.strengths.length
        ? report.strengths.map(s => `<div class="audit-strength">✅ ${escapeHtml(s)}</div>`).join('')
        : '';

    return `
        <div class="audit-report">
            <div class="audit-score-row">
                <div class="audit-opp-score">
                    <span class="audit-opp-label">Website Opportunity</span>
                    <span class="audit-opp-value">${report.opportunityScore}<small>/100</small></span>
                </div>
                <div class="audit-meta-info">
                    <span class="text-muted">${escapeHtml(report.summary || '')}</span>
                    ${lead.auditResult.checkedAt ? `<span class="text-muted"> · ${new Date(lead.auditResult.checkedAt).toLocaleString()}</span>` : ''}
                </div>
            </div>
            <div class="audit-columns">
                <div class="audit-col">
                    <div class="detail-label">Problems Found</div>
                    ${problemsHtml}
                </div>
                <div class="audit-col">
                    <div class="detail-label">Strengths</div>
                    ${strengthsHtml || '<div class="text-muted">—</div>'}
                </div>
            </div>
            <div class="opportunity-box" style="margin-top:1rem;">
                <div class="detail-label">Recommended Solution</div>
                <p>${escapeHtml(report.recommendation)}</p>
            </div>
        </div>
    `;
}

/**
 * Run audit for a lead, save result, recalculate score
 */
async function handleRunAudit(leadId) {
    const lead = getLeadById(leadId);
    if (!lead) return;

    const btn = document.getElementById('runAuditBtn');
    const container = document.getElementById('auditReportContainer');

    // Allow audit with no URL when status is "none" (no online presence)
    if (!lead.website && lead.websiteStatus !== 'none') {
        showToast('Add a website URL before running an audit', 'warning');
        return;
    }

    const url = lead.website || '';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Auditing...';
    }
    if (container) {
        container.innerHTML = '<div class="audit-loading">Analyzing website…</div>';
    }

    try {
        const auditResult = await runFullAudit(url, {
            businessName: lead.businessName,
            industry: lead.industry,
            websiteStatus: lead.websiteStatus,
            reviews: lead.reviews,
            rating: lead.rating
        });

        // Persist + recalculate score with audit signals
        const updated = {
            ...lead,
            auditResult,
            score: 0 // will set next
        };
        updated.score = calculateScore(updated);

        updateLead(leadId, {
            auditResult,
            score: updated.score
        });

        showToast('Audit complete — score updated', 'success');
        updateDashboard();

        // Refresh view modal content
        openViewModal(leadId);
        // Also refresh table if visible
        if (typeof renderLeads === 'function') {
            // renderLeads is in module scope
        }
        refreshLeadsView();
    } catch (err) {
        console.error(err);
        showToast('Audit failed: ' + (err.message || 'Unknown error'), 'error');
        if (container) {
            container.innerHTML = '<div class="audit-empty"><p class="text-muted">Audit failed. Try again.</p></div>';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Re-run Audit';
        }
    }
}

function refreshLeadsView() {
    // Re-render table/cards without full route change
    try {
        const event = new CustomEvent('leads:refresh');
        document.dispatchEvent(event);
    } catch (_) {}
}


function closeViewModal() {
    document.getElementById('viewLeadModal')?.classList.remove('open');
    viewingId = null;
}

/**
 * Delete flow
 */
function openDeleteModal(id) {
    const lead = getLeadById(id);
    if (!lead) return;
    deletingId = id;
    document.getElementById('deleteLeadName').textContent = lead.businessName;
    document.getElementById('deleteModal')?.classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('deleteModal')?.classList.remove('open');
    deletingId = null;
}

function confirmDelete() {
    if (!deletingId) return;
    const success = deleteLead(deletingId);
    if (success) {
        showToast('Lead deleted', 'success');
        closeDeleteModal();
        populateFilterOptions();
        renderLeads();
        updateDashboard();
    } else {
        showToast('Failed to delete lead', 'error');
    }
}

/**
 * Load sample data from JSON file
 */
async function loadSampleData() {
    try {
        const res = await fetch('sample-leads.json');
        if (!res.ok) throw new Error('Failed to fetch sample data');
        const samples = await res.json();

        const existing = getLeads();
        const existingNames = new Set(existing.map(l => l.businessName.toLowerCase()));

        let added = 0;
        samples.forEach(sample => {
            if (!existingNames.has(sample.businessName.toLowerCase())) {
                if (!sample.websiteStatus) {
                    sample.websiteStatus = sample.website ? 'outdated' : 'none';
                }
                // Recalculate with Phase 3 engine for consistency
                sample.score = calculateScore(sample);
                addLead(sample);
                added++;
            }
        });

        if (added > 0) {
            showToast(`Loaded ${added} sample lead${added > 1 ? 's' : ''}`, 'success');
            populateFilterOptions();
            renderLeads();
            updateDashboard();
        } else {
            showToast('Sample leads already loaded', 'info');
        }
    } catch (err) {
        console.error(err);
        showToast('Could not load sample data', 'error');
    }
}

/**
 * Helpers
 */
function getScoreClass(score) {
    if (score >= 71) return 'hot';
    if (score >= 41) return 'medium';
    return 'low';
}

function formatStatus(status) {
    const map = {
        new: 'New', contacted: 'Contacted', replied: 'Replied',
        meeting: 'Meeting', proposal: 'Proposal Sent', won: 'Won', lost: 'Lost'
    };
    return map[status] || status || 'New';
}

function formatWebsiteStatus(status) {
    const map = { none: 'No Website', outdated: 'Outdated', good: 'Good' };
    return map[status] || 'No Website';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorId = 'error' + fieldId.charAt(0).toUpperCase() + fieldId.slice(1);
    const errorEl = document.getElementById(errorId);
    if (input) input.closest('.form-group')?.classList.add('has-error');
    if (errorEl) errorEl.textContent = message;
}

function clearFormErrors() {
    document.querySelectorAll('.form-group.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
