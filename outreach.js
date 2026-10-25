/**
 * AI Lead Hunter OS - Outreach Generator
 * ======================================
 * Personalized, human-sounding messages driven by
 * lead data, score, and audit findings.
 *
 * AI-ready via generateWithAI() when API keys are set.
 */

import { isServiceReady, AI_API_KEY, AI_API_ENDPOINT, AI_MODEL } from './api-config.js';
import { generateAuditReport } from './audit.js';
import { getLeadIntelligence } from './scoring.js';
import { getLeads, getLeadById, updateLead, getSettings } from './storage.js';
import { updateDashboard } from './dashboard.js';
import { showToast } from './app.js';

/** Pipeline stages (shared with dashboard labels) */
const PIPELINE_STAGES = [
    { id: 'new',        label: 'New Lead',      color: 'new' },
    { id: 'contacted',  label: 'Contacted',     color: 'contacted' },
    { id: 'replied',    label: 'Replied',       color: 'replied' },
    { id: 'meeting',    label: 'Meeting',       color: 'meeting' },
    { id: 'proposal',   label: 'Proposal Sent', color: 'proposal' },
    { id: 'won',        label: 'Won',           color: 'won' },
    { id: 'lost',       label: 'Lost',          color: 'lost' }
];

// ============================================
// PUBLIC GENERATORS
// ============================================

/**
 * Generate a personalized cold email
 * @param {Object} lead
 * @returns {Promise<{ subject: string, body: string, channel: string }>}
 */
export async function generateEmail(lead) {
    const ctx = buildContext(lead);

    if (isServiceReady('ai')) {
        const ai = await generateWithAI(buildAIPrompt('email', ctx));
        if (ai) return { subject: ai.subject || ctx.defaultSubject, body: ai.body, channel: 'email' };
    }

    return {
        subject: ctx.defaultSubject,
        body: applySignature(buildEmailBody(ctx)),
        channel: 'email'
    };
}

/**
 * Generate a short WhatsApp message
 * @param {Object} lead
 * @returns {Promise<{ body: string, channel: string }>}
 */
export async function generateWhatsApp(lead) {
    const ctx = buildContext(lead);

    if (isServiceReady('ai')) {
        const ai = await generateWithAI(buildAIPrompt('whatsapp', ctx));
        if (ai) return { body: ai.body, channel: 'whatsapp' };
    }

    return {
        body: applySignature(buildWhatsAppBody(ctx)),
        channel: 'whatsapp'
    };
}

/**
 * Generate a LinkedIn connection / InMail style message
 * @param {Object} lead
 * @returns {Promise<{ body: string, channel: string }>}
 */
export async function generateLinkedInMessage(lead) {
    const ctx = buildContext(lead);

    if (isServiceReady('ai')) {
        const ai = await generateWithAI(buildAIPrompt('linkedin', ctx));
        if (ai) return { body: ai.body, channel: 'linkedin' };
    }

    return {
        body: applySignature(buildLinkedInBody(ctx)),
        channel: 'linkedin'
    };
}

/**
 * Generate a follow-up based on stage / day
 * @param {Object} lead
 * @param {string} stage - 'day1' | 'day3' | 'day7' | 'day14' | or pipeline status
 * @returns {Promise<{ subject?: string, body: string, channel: string, stage: string }>}
 */
export async function generateFollowUp(lead, stage = 'day3') {
    const ctx = buildContext(lead);
    const normalized = normalizeFollowUpStage(stage);

    if (isServiceReady('ai')) {
        const ai = await generateWithAI(buildAIPrompt('followup', ctx, normalized));
        if (ai) {
            return {
                subject: ai.subject || `Quick follow-up — ${ctx.name}`,
                body: ai.body,
                channel: 'followup',
                stage: normalized
            };
        }
    }

    return {
        subject: followUpSubject(ctx, normalized),
        body: applySignature(buildFollowUpBody(ctx, normalized)),
        channel: 'followup',
        stage: normalized
    };
}

// ============================================
// CONTEXT BUILDER
// ============================================


function applySignature(body) {
    const s = getSettings();
    const name = s.yourName || '[Your name]';
    let out = body.replace(/\[Your name\]/g, name);
    if (s.emailSignature && !out.includes(s.emailSignature.trim())) {
        // If body ends with name only, append signature block for email-like messages
        if (out.trim().endsWith(name) && s.emailSignature.trim() !== name) {
            out = out.replace(new RegExp(name + '\\s*$'), s.emailSignature.trim());
        }
    }
    return out;
}

function buildContext(lead) {
    const name = lead.businessName || 'your business';
    const industry = lead.industry || 'your industry';
    const intel = getLeadIntelligence(lead);
    const audit = lead.auditResult && !lead.auditResult.error
        ? generateAuditReport(lead.auditResult)
        : null;

    const problems = audit?.problems?.length
        ? audit.problems
        : inferProblemsFromLead(lead);

    const topProblem = problems[0] || 'online experience gaps';
    const recommendation = audit?.recommendation
        || 'a clearer website that turns interest into bookings';

    const hasStrongReviews = (lead.reviews || 0) >= 30 || (lead.rating || 0) >= 4.5;
    const noWebsite = lead.websiteStatus === 'none' || !lead.website;

    return {
        name,
        industry,
        score: intel.score,
        category: intel.category,
        problems,
        topProblem,
        recommendation,
        hasStrongReviews,
        reviews: lead.reviews || 0,
        rating: lead.rating,
        noWebsite,
        city: lead.city || '',
        opportunity: intel.opportunity,
        defaultSubject: buildSubject(name, noWebsite, hasStrongReviews, topProblem)
    };
}

function inferProblemsFromLead(lead) {
    const list = [];
    if (lead.websiteStatus === 'none') list.push('No website');
    if (lead.websiteStatus === 'outdated') list.push('Outdated website');
    if (lead.websiteStatus === 'none' || lead.websiteStatus === 'outdated') {
        list.push('No booking system');
        list.push('Weak conversion path');
    }
    return list;
}

function buildSubject(name, noWebsite, hasStrongReviews, topProblem) {
    if (noWebsite && hasStrongReviews) {
        return `${name} — strong reviews, missing online home`;
    }
    if (noWebsite) {
        return `Idea for ${name}`;
    }
    if (topProblem.toLowerCase().includes('booking')) {
        return `${name} and online bookings`;
    }
    if (topProblem.toLowerCase().includes('mobile')) {
        return `Quick note on ${name}'s mobile experience`;
    }
    return `Noticed something about ${name}`;
}

// ============================================
// MESSAGE TEMPLATES (rule-based, human tone)
// ============================================

function buildEmailBody(ctx) {
    const lines = [];

    lines.push(`Hi,`);
    lines.push('');

    if (ctx.noWebsite && ctx.hasStrongReviews) {
        lines.push(
            `I came across ${ctx.name} and was impressed by the reviews (${ctx.reviews}+). ` +
            `What stood out is that there isn't a clear website to capture that demand.`
        );
        lines.push('');
        lines.push(
            `Businesses in ${ctx.industry.toLowerCase()} with your reputation usually leave money on the table without a simple site that can take enquiries or bookings.`
        );
    } else if (ctx.noWebsite) {
        lines.push(
            `I was looking at ${ctx.name} and noticed you don't have a website yet. ` +
            `For ${ctx.industry.toLowerCase()} businesses, that often means good leads never find a way to contact you online.`
        );
    } else {
        lines.push(
            `I spent a few minutes on ${ctx.name}'s site and noticed ${ctx.topProblem.toLowerCase()}.`
        );
        lines.push('');
        lines.push(
            `That kind of gap usually costs enquiries — especially on mobile — even when the business itself is solid.`
        );
    }

    lines.push('');
    lines.push(
        `If it's useful, I can share a short teardown with 2–3 specific fixes (no pitch deck). Worth a look?`
    );
    lines.push('');
    lines.push(`Best,`);
    lines.push(`[Your name]`);

    return lines.join('\n');
}

function buildWhatsAppBody(ctx) {
    if (ctx.noWebsite && ctx.hasStrongReviews) {
        return (
            `Hi — saw ${ctx.name} has great reviews (${ctx.reviews}+) but no website to capture that interest. ` +
            `Happy to send a quick idea for a simple site that takes enquiries. Interested?`
        );
    }
    if (ctx.noWebsite) {
        return (
            `Hi — noticed ${ctx.name} doesn't have a website yet. ` +
            `A lot of ${ctx.industry.toLowerCase()} businesses pick up extra leads with a simple one. Want a short outline?`
        );
    }
    return (
        `Hi — looked at ${ctx.name}'s site. Main thing that stood out: ${ctx.topProblem.toLowerCase()}. ` +
        `I can send 2 quick fixes if useful.`
    );
}

function buildLinkedInBody(ctx) {
    if (ctx.noWebsite) {
        return (
            `Hi — I came across ${ctx.name} while researching ${ctx.industry.toLowerCase()} businesses` +
            (ctx.city ? ` in ${ctx.city}` : '') +
            `. You have solid demand signals, but no web presence to convert them. ` +
            `I put together short notes like this for owners who want a clearer online path — happy to share if relevant.`
        );
    }
    return (
        `Hi — I reviewed ${ctx.name}'s website in the context of ${ctx.industry.toLowerCase()} conversion patterns. ` +
        `One issue kept showing up: ${ctx.topProblem.toLowerCase()}. ` +
        `I share concise teardowns with owners when the gap is clear — open to a quick note?`
    );
}

function normalizeFollowUpStage(stage) {
    const map = {
        day1: 'day1',
        day3: 'day3',
        day7: 'day7',
        day14: 'day14',
        new: 'day1',
        contacted: 'day3',
        replied: 'day7',
        meeting: 'day7',
        proposal: 'day14'
    };
    return map[stage] || stage || 'day3';
}

function followUpSubject(ctx, stage) {
    if (stage === 'day1') return ctx.defaultSubject;
    if (stage === 'day3') return `Re: ${ctx.name}`;
    if (stage === 'day7') return `One idea for ${ctx.name}`;
    return `Closing the loop — ${ctx.name}`;
}

function buildFollowUpBody(ctx, stage) {
    if (stage === 'day1') {
        return buildEmailBody(ctx);
    }

    if (stage === 'day3') {
        return [
            `Hi,`,
            ``,
            `Just bumping this in case it got buried.`,
            ``,
            `Still happy to send a short note on ${ctx.topProblem.toLowerCase()} for ${ctx.name} — only if useful.`,
            ``,
            `Best,`,
            `[Your name]`
        ].join('\n');
    }

    if (stage === 'day7') {
        return [
            `Hi,`,
            ``,
            `Quick value-add instead of another “checking in”:`,
            ``,
            `For ${ctx.industry.toLowerCase()} businesses like ${ctx.name}, fixing “${ctx.topProblem.toLowerCase()}” often unlocks more enquiries than another ad campaign.`,
            ``,
            `I can outline a minimal version of ${ctx.recommendation.toLowerCase()} in a few bullets. Want that?`,
            ``,
            `Best,`,
            `[Your name]`
        ].join('\n');
    }

    // day14 – final
    return [
        `Hi,`,
        ``,
        `I'll keep this as my last note so I don't clutter your inbox.`,
        ``,
        `If ${ctx.name} ever wants a second pair of eyes on the website / booking path, I'm easy to reach.`,
        ``,
        `Either way, wishing you a strong quarter.`,
        ``,
        `Best,`,
        `[Your name]`
    ].join('\n');
}

// ============================================
// AI PLACEHOLDER
// ============================================

/**
 * generateWithAI(prompt)
 * ----------------------
 * Connect OpenAI / Gemini / etc. when ready.
 * Return shape: { subject?: string, body: string } or null
 *
 * @param {string} prompt
 * @returns {Promise<{ subject?: string, body: string }|null>}
 */
export async function generateWithAI(prompt) {
    if (!isServiceReady('ai')) {
        return null;
    }

    // --- REAL API CALL (uncomment & adapt) ---
    /*
    const response = await fetch(AI_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You write short, human outreach for a web agency. No spam. No "we are a professional agency". Focus on the prospect problem. Return JSON: { "subject": "...", "body": "..." }'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        })
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    try {
        return JSON.parse(text);
    } catch {
        return { body: text };
    }
    */

    console.log('generateWithAI placeholder — prompt length:', prompt.length);
    return null;
}

function buildAIPrompt(type, ctx, stage) {
    return JSON.stringify({
        type,
        stage: stage || null,
        businessName: ctx.name,
        industry: ctx.industry,
        score: ctx.score,
        problems: ctx.problems,
        recommendation: ctx.recommendation,
        hasStrongReviews: ctx.hasStrongReviews,
        noWebsite: ctx.noWebsite,
        tone: 'human, concise, value-first, no agency clichés'
    });
}

// ============================================
// OUTREACH STATS (dashboard)
// ============================================

/**
 * Derive outreach-related stats from leads
 * Uses status + optional outreachLog on lead
 */
export function getOutreachStats(leads) {
    const list = leads || [];
    const contacted = list.filter(l =>
        ['contacted', 'replied', 'meeting', 'proposal', 'won'].includes(l.status)
    ).length;
    const replied = list.filter(l =>
        ['replied', 'meeting', 'proposal', 'won'].includes(l.status)
    ).length;
    const meetings = list.filter(l =>
        ['meeting', 'proposal', 'won'].includes(l.status)
    ).length;
    const won = list.filter(l => l.status === 'won').length;

    // Optional: count messages if outreachLog exists
    let messagesSent = 0;
    list.forEach(l => {
        if (Array.isArray(l.outreachLog)) messagesSent += l.outreachLog.length;
    });

    return {
        messagesSent,
        contacted,
        replied,
        meetings,
        won,
        replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0
    };
}

/**
 * Append an outreach log entry on a lead object (caller saves)
 */
export function createOutreachLogEntry(channel, preview) {
    return {
        id: 'out_' + Date.now().toString(36),
        channel,
        preview: (preview || '').slice(0, 120),
        sentAt: new Date().toISOString()
    };
}

// ============================================
// UI CONTROLLERS (Outreach section + helpers)
// ============================================


/**
 * Initialize outreach section UI
 */
export function initOutreach() {
    populateLeadSelect();
    document.querySelectorAll('[data-gen]').forEach(btn => {
        btn.addEventListener('click', () => handleGenerate(btn.dataset.gen));
    });
}

export function refreshOutreachLeadSelect() {
    populateLeadSelect();
}

function populateLeadSelect() {
    const select = document.getElementById('outreachLeadSelect');
    if (!select) return;
    const current = select.value;
    const leads = getLeads().filter(l => !['won', 'lost'].includes(l.status));
    select.innerHTML = '<option value="">Choose a lead…</option>' +
        leads.map(l => {
            const score = l.score ?? 0;
            return `<option value="${l.id}">${escapeHtml(l.businessName)} (${score})</option>`;
        }).join('');
    if (current) select.value = current;
}

async function handleGenerate(type) {
    const select = document.getElementById('outreachLeadSelect');
    const leadId = select?.value;
    if (!leadId) {
        showToast('Select a lead first', 'warning');
        return;
    }
    const lead = getLeadById(leadId);
    if (!lead) {
        showToast('Lead not found', 'error');
        return;
    }

    const output = document.getElementById('outreachOutput');
    if (output) {
        output.innerHTML = `<div class="card"><div class="card-body" style="padding:2rem;text-align:center;"><p class="text-muted">Generating…</p></div></div>`;
    }

    try {
        let result;
        if (type === 'email') result = await generateEmail(lead);
        else if (type === 'whatsapp') result = await generateWhatsApp(lead);
        else if (type === 'linkedin') result = await generateLinkedInMessage(lead);
        else if (type === 'followup') {
            const stage = document.getElementById('followUpStage')?.value || 'day3';
            result = await generateFollowUp(lead, stage);
        } else {
            return;
        }

        renderOutreachOutput(result, lead);

        // Log outreach event
        const log = Array.isArray(lead.outreachLog) ? [...lead.outreachLog] : [];
        log.unshift(createOutreachLogEntry(result.channel, result.body || result.subject));
        updateLead(lead.id, {
            outreachLog: log.slice(0, 50),
            lastContactedAt: new Date().toISOString()
        });
        updateDashboard();
    } catch (err) {
        console.error(err);
        showToast('Generation failed', 'error');
    }
}

function renderOutreachOutput(result, lead) {
    const output = document.getElementById('outreachOutput');
    if (!output) return;

    const subjectBlock = result.subject
        ? `<div class="msg-field">
                <div class="msg-label">Subject</div>
                <div class="msg-value" id="msgSubject">${escapeHtml(result.subject)}</div>
                <button type="button" class="btn btn-ghost btn-sm copy-btn" data-copy="msgSubject">Copy</button>
           </div>`
        : '';

    output.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>${escapeHtml(lead.businessName)} · ${escapeHtml(result.channel)}</h3>
            </div>
            <div class="card-body" style="padding: 1.25rem;">
                ${subjectBlock}
                <div class="msg-field">
                    <div class="msg-label">Message</div>
                    <pre class="msg-body" id="msgBody">${escapeHtml(result.body)}</pre>
                    <button type="button" class="btn btn-primary btn-sm copy-btn" data-copy="msgBody">Copy message</button>
                </div>
            </div>
        </div>
    `;

    output.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const el = document.getElementById(btn.dataset.copy);
            const text = el?.innerText || el?.textContent || '';
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copied to clipboard', 'success');
            } catch {
                showToast('Could not copy', 'error');
            }
        });
    });
}

/**
 * Pipeline board
 */
export function initPipeline() {
    document.getElementById('pipelineRefreshBtn')?.addEventListener('click', renderPipelineBoard);
    renderPipelineBoard();
}

export function renderPipelineBoard() {
    const board = document.getElementById('pipelineBoard');
    if (!board) return;

    const leads = getLeads();
    const countEl = document.getElementById('pipelineCount');
    if (countEl) countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''} in pipeline`;

    board.innerHTML = PIPELINE_STAGES.map(stage => {
        const stageLeads = leads.filter(l => (l.status || 'new') === stage.id);
        const cards = stageLeads.length
            ? stageLeads.map(l => pipelineCard(l)).join('')
            : '<div class="pipeline-empty">No leads</div>';

        return `
            <div class="pipeline-column" data-stage="${stage.id}">
                <div class="pipeline-column-header">
                    <span class="pipeline-dot ${stage.color}"></span>
                    <span class="pipeline-column-title">${stage.label}</span>
                    <span class="pipeline-column-count">${stageLeads.length}</span>
                </div>
                <div class="pipeline-column-body">
                    ${cards}
                </div>
            </div>
        `;
    }).join('');

    // Status change via select on cards
    board.querySelectorAll('.pipeline-status-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const newStatus = e.target.value;
            updateLead(id, { status: newStatus });
            showToast('Status updated', 'success');
            renderPipelineBoard();
            updateDashboard();
            populateLeadSelect();
        });
    });
}

function pipelineCard(lead) {
    const score = lead.score ?? 0;
    const scoreClass = score >= 71 ? 'hot' : score >= 41 ? 'medium' : 'low';
    const follow = lead.followUpDate
        ? new Date(lead.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    const options = PIPELINE_STAGES.map(s =>
        `<option value="${s.id}" ${(lead.status || 'new') === s.id ? 'selected' : ''}>${s.label}</option>`
    ).join('');

    return `
        <div class="pipeline-card" data-id="${lead.id}">
            <div class="pipeline-card-top">
                <span class="pipeline-card-name">${escapeHtml(lead.businessName)}</span>
                <span class="score-badge ${scoreClass}">${score}</span>
            </div>
            <div class="pipeline-card-meta">${escapeHtml(lead.industry || '—')}</div>
            ${follow ? `<div class="pipeline-card-follow">Follow-up: ${follow}</div>` : ''}
            <select class="pipeline-status-select" data-id="${lead.id}" title="Move stage">
                ${options}
            </select>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
