/**
 * AI Lead Hunter OS - Dashboard Module
 * ====================================
 * Handles all dashboard metrics, recent leads, and pipeline overview.
 */

import { getLeads } from './storage.js';
import { getScoringStats, getPriorityLevel } from './scoring.js';

/**
 * Pipeline stages definition
 */
export const PIPELINE_STAGES = [
    { id: 'new',        label: 'New Lead',      color: 'new' },
    { id: 'contacted',  label: 'Contacted',     color: 'contacted' },
    { id: 'replied',    label: 'Replied',       color: 'replied' },
    { id: 'meeting',    label: 'Meeting',       color: 'meeting' },
    { id: 'proposal',   label: 'Proposal Sent', color: 'proposal' },
    { id: 'won',        label: 'Won',           color: 'won' },
    { id: 'lost',       label: 'Lost',          color: 'lost' }
];

/**
 * Calculate all dashboard metrics from leads
 */
export function calculateMetrics(leads = null) {
    const allLeads = leads || getLeads();

    const total = allLeads.length;
    const hot = allLeads.filter(l => l.score >= 71).length;
    const medium = allLeads.filter(l => l.score >= 41 && l.score <= 70).length;
    const low = allLeads.filter(l => l.score <= 40).length;

    // Follow-ups: leads with followUpDate in the past or today, and not won/lost
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const followUps = allLeads.filter(l => {
        if (!l.followUpDate) return false;
        if (['won', 'lost'].includes(l.status)) return false;
        return new Date(l.followUpDate) <= now;
    }).length;

    // Conversion rates
    const contacted = allLeads.filter(l => 
        ['contacted', 'replied', 'meeting', 'proposal', 'won'].includes(l.status)
    ).length;
    const replied = allLeads.filter(l => 
        ['replied', 'meeting', 'proposal', 'won'].includes(l.status)
    ).length;
    const won = allLeads.filter(l => l.status === 'won').length;

    const contactedRate = total > 0 ? Math.round((contacted / total) * 100) : 0;
    const repliedRate = total > 0 ? Math.round((replied / total) * 100) : 0;
    const wonRate = total > 0 ? Math.round((won / total) * 100) : 0;

    // Pipeline counts
    const pipeline = {};
    PIPELINE_STAGES.forEach(stage => {
        pipeline[stage.id] = allLeads.filter(l => l.status === stage.id).length;
    });

    // Recent leads (last 5)
    const recent = [...allLeads]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    // This week count
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = allLeads.filter(l => new Date(l.createdAt) >= oneWeekAgo).length;

    const scoringStats = getScoringStats(allLeads);

    return {
        total,
        hot,
        medium,
        low,
        followUps,
        contactedRate,
        repliedRate,
        wonRate,
        pipeline,
        recent,
        thisWeek,
        averageScore: scoringStats.averageScore,
        distribution: scoringStats.distribution,
        topOpportunities: scoringStats.topOpportunities,
        outreach: (() => {
            const contacted = allLeads.filter(l => ['contacted','replied','meeting','proposal','won'].includes(l.status)).length;
            const replied = allLeads.filter(l => ['replied','meeting','proposal','won'].includes(l.status)).length;
            const meetings = allLeads.filter(l => ['meeting','proposal','won'].includes(l.status)).length;
            let messagesSent = 0;
            allLeads.forEach(l => { if (Array.isArray(l.outreachLog)) messagesSent += l.outreachLog.length; });
            return {
                messagesSent,
                contacted,
                replied,
                meetings,
                won: allLeads.filter(l => l.status === 'won').length,
                replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0
            };
        })()
    };
}

/**
 * Update all dashboard UI elements
 */
export function updateDashboard() {
    const metrics = calculateMetrics();

    // Primary metrics
    setText('metricTotalLeads', metrics.total);
    setText('metricHotLeads', metrics.hot);
    setText('metricMediumLeads', metrics.medium);
    setText('metricFollowUps', metrics.followUps);

    setText('metricTotalChange', `+${metrics.thisWeek} this week`);
    
    const followUpEl = document.getElementById('metricFollowUpChange');
    if (followUpEl) {
        followUpEl.textContent = metrics.followUps > 0 ? 'Needs attention' : 'All clear';
        followUpEl.className = metrics.followUps > 0 ? 'metric-change warning' : 'metric-change positive';
    }

    // Conversion bars
    setWidth('conversionContacted', metrics.contactedRate + '%');
    setText('conversionContactedValue', metrics.contactedRate + '%');

    setWidth('conversionReplied', metrics.repliedRate + '%');
    setText('conversionRepliedValue', metrics.repliedRate + '%');

    setWidth('conversionWon', metrics.wonRate + '%');
    setText('conversionWonValue', metrics.wonRate + '%');

    // Pipeline overview
    renderPipelineStages(metrics.pipeline);

    // Recent leads table
    renderRecentLeads(metrics.recent);

    // Scoring intelligence widgets
    setText('metricAvgScore', metrics.averageScore);
    renderScoreDistribution(metrics.distribution, metrics.total);
    renderTopOpportunities(metrics.topOpportunities);

    // Outreach funnel (optional elements)
    if (metrics.outreach) {
        setText('statMessagesSent', metrics.outreach.messagesSent);
        setText('statReplyRate', metrics.outreach.replyRate + '%');
        setText('statMeetings', metrics.outreach.meetings);
    }
}

/**
 * Score distribution bars
 */
function renderScoreDistribution(dist, total) {
    const hotPct = total > 0 ? Math.round((dist.hot / total) * 100) : 0;
    const medPct = total > 0 ? Math.round((dist.medium / total) * 100) : 0;
    const lowPct = total > 0 ? Math.round((dist.low / total) * 100) : 0;

    setWidth('distHotBar', hotPct + '%');
    setWidth('distMedBar', medPct + '%');
    setWidth('distLowBar', lowPct + '%');
    setText('distHotValue', dist.hot + ' (' + hotPct + '%)');
    setText('distMedValue', dist.medium + ' (' + medPct + '%)');
    setText('distLowValue', dist.low + ' (' + lowPct + '%)');
}

/**
 * Top opportunities list
 */
function renderTopOpportunities(items) {
    const container = document.getElementById('topOpportunities');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="text-muted" style="padding:1rem 0;font-size:0.875rem;">No opportunities yet. Add leads to see rankings.</div>';
        return;
    }

    container.innerHTML = items.map((item, i) => {
        const priority = getPriorityLevel(item.score);
        return `
            <div class="top-opp-item">
                <span class="top-opp-rank">${i + 1}</span>
                <div class="top-opp-info">
                    <div class="top-opp-name">${escapeHtml(item.businessName)}</div>
                    <div class="top-opp-meta">${escapeHtml(item.industry || '—')} · ${formatStatus(item.status)}</div>
                </div>
                <span class="score-badge ${priority.class}">${item.score}</span>
            </div>
        `;
    }).join('');
}

/**
 * Render pipeline stage summary
 */
function renderPipelineStages(pipelineCounts) {
    const container = document.getElementById('pipelineStages');
    if (!container) return;

    container.innerHTML = PIPELINE_STAGES.map(stage => `
        <div class="pipeline-stage">
            <div class="pipeline-stage-info">
                <span class="pipeline-dot ${stage.color}"></span>
                <span class="pipeline-stage-name">${stage.label}</span>
            </div>
            <span class="pipeline-stage-count">${pipelineCounts[stage.id] || 0}</span>
        </div>
    `).join('');
}

/**
 * Render recent leads table
 */
function renderRecentLeads(leads) {
    const tbody = document.getElementById('recentLeadsBody');
    if (!tbody) return;

    if (!leads || leads.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-message">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p>No leads yet. Add your first lead to get started.</p>
                        <button class="btn btn-primary btn-sm" id="emptyAddLeadBtn">
                            Add First Lead
                        </button>
                    </div>
                </td>
            </tr>
        `;
        
        // Re-bind the empty state button
        const emptyBtn = document.getElementById('emptyAddLeadBtn');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => {
                document.getElementById('addLeadBtn')?.click();
            });
        }
        return;
    }

    tbody.innerHTML = leads.map(lead => {
        const scoreClass = getScoreClass(lead.score);
        const statusLabel = formatStatus(lead.status);
        const date = formatDate(lead.createdAt);

        return `
            <tr data-id="${lead.id}">
                <td>
                    <div class="fw-600 text-primary">${escapeHtml(lead.businessName || 'Unnamed')}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(lead.city || '')}${lead.city && lead.country ? ', ' : ''}${escapeHtml(lead.country || '')}</div>
                </td>
                <td>${escapeHtml(lead.industry || '—')}</td>
                <td>
                    <span class="score-badge ${scoreClass}">${lead.score ?? 0}</span>
                </td>
                <td>
                    <span class="status-badge ${lead.status || 'new'}">${statusLabel}</span>
                </td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-ghost btn-sm view-lead-btn" data-id="${lead.id}" title="View">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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
        new: 'New',
        contacted: 'Contacted',
        replied: 'Replied',
        meeting: 'Meeting',
        proposal: 'Proposal',
        won: 'Won',
        lost: 'Lost'
    };
    return map[status] || status || 'New';
}

function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setWidth(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.width = value;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
