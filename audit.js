/**
 * AI Lead Hunter OS - Website Audit Module
 * ========================================
 * Structured website analysis framework.
 * API-ready for PageSpeed, Lighthouse, and AI Vision.
 *
 * Current mode: Intelligent heuristic analysis
 * (works offline; upgrades automatically when APIs are configured)
 */

import {
    isServiceReady,
    PAGESPEED_API_KEY,
    PAGESPEED_ENDPOINT,
    AI_API_KEY,
    AI_API_ENDPOINT,
    AI_MODEL,
    FEATURES
} from './api-config.js';

// ============================================
// PUBLIC API
// ============================================

/**
 * Analyze a website URL and return a structured audit result.
 * @param {string} url
 * @param {Object} [leadContext] - optional lead data for better inference
 * @returns {Promise<Object>} audit result
 */
export async function analyzeWebsite(url, leadContext = {}) {
    const normalized = normalizeUrl(url);

    // No website case — structured "no presence" audit (still valuable for sales)
    if (!normalized && (leadContext.websiteStatus === 'none' || !url)) {
        const audit = {
            url: '',
            checkedAt: new Date().toISOString(),
            mobileScore: 0,
            designQuality: 'poor',
            speed: 'unknown',
            hasSSL: false,
            hasBooking: false,
            hasContactForm: false,
            hasClearCTA: false,
            hasSocialProof: false,
            seoIssues: ['No website to index'],
            recommendations: [
                'Build a modern responsive website',
                'Add online booking or contact form',
                'Establish basic SEO foundation',
                'Surface reviews and trust elements'
            ],
            source: 'no-website',
            opportunityScore: 0,
            aiInsight: null,
            error: null
        };
        audit.opportunityScore = calculateOpportunityScore(audit);
        return audit;
    }

    if (!normalized) {
        return createEmptyAudit('', {
            error: 'Invalid or missing URL',
            recommendations: ['Add a valid website URL to run an audit.']
        });
    }

    // 1) Try real PageSpeed API if configured
    let pageSpeedData = null;
    if (isServiceReady('pagespeed')) {
        try {
            pageSpeedData = await fetchPageSpeed(normalized);
        } catch (err) {
            console.warn('PageSpeed API failed, falling back to heuristic:', err.message);
        }
    }

    // 2) Build structured audit (API data + heuristics + lead context)
    const audit = await buildAuditResult(normalized, pageSpeedData, leadContext);

    // 3) Optional AI enhancement placeholder
    if (isServiceReady('ai')) {
        try {
            const aiNotes = await enhanceWithAI(audit, leadContext);
            if (aiNotes) {
                audit.aiInsight = aiNotes;
            }
        } catch (err) {
            console.warn('AI enhancement skipped:', err.message);
        }
    }

    return audit;
}

/**
 * Turn raw audit result into a display-ready report object.
 * @param {Object} result - from analyzeWebsite
 * @returns {Object}
 */
export function generateAuditReport(result) {
    if (!result || result.error) {
        return {
            opportunityScore: 0,
            problems: result?.recommendations || ['Unable to audit this website.'],
            strengths: [],
            recommendation: 'Fix the URL or try again later.',
            summary: result?.error || 'Audit failed'
        };
    }

    const problems = [];
    const strengths = [];

    // Website foundation
    if (result.hasSSL === false) problems.push('No SSL (not HTTPS)');
    else if (result.hasSSL === true) strengths.push('SSL enabled');

    if (result.mobileScore !== '' && result.mobileScore !== null) {
        if (result.mobileScore < 50) problems.push('Weak mobile experience');
        else if (result.mobileScore >= 80) strengths.push('Strong mobile score');
        else problems.push('Mobile experience needs improvement');
    }

    if (result.designQuality === 'poor' || result.designQuality === 'outdated') {
        problems.push(`Design quality: ${result.designQuality}`);
    } else if (result.designQuality === 'modern') {
        strengths.push('Modern design');
    }

    if (result.speed === 'slow') problems.push('Slow loading speed');
    else if (result.speed === 'fast') strengths.push('Fast loading speed');

    // Conversion
    if (result.hasBooking === false) problems.push('No booking system');
    else if (result.hasBooking === true) strengths.push('Booking system present');

    if (result.hasContactForm === false) problems.push('No contact form detected');
    else if (result.hasContactForm === true) strengths.push('Contact form present');

    if (result.hasClearCTA === false) problems.push('Missing or weak CTA');
    else if (result.hasClearCTA === true) strengths.push('Clear calls-to-action');

    if (result.hasSocialProof === false) problems.push('Weak social proof / trust elements');
    else if (result.hasSocialProof === true) strengths.push('Social proof present');

    // SEO
    if (Array.isArray(result.seoIssues) && result.seoIssues.length) {
        result.seoIssues.forEach(issue => problems.push(`SEO: ${issue}`));
    }

    const opportunityScore = calculateOpportunityScore(result);

    const recommendation = buildRecommendation(result, problems, opportunityScore);

    return {
        opportunityScore,
        problems,
        strengths,
        recommendation,
        summary: buildSummary(result, opportunityScore, problems.length),
        checkedAt: result.checkedAt,
        url: result.url
    };
}

/**
 * Calculate opportunity score from audit (higher = more sales opportunity).
 * 0–100 scale aligned with lead scoring philosophy.
 * @param {Object} auditResult
 * @returns {number}
 */
export function calculateOpportunityScore(auditResult) {
    if (!auditResult || auditResult.error) return 0;

    let score = 20; // base

    // Bigger problems = bigger opportunity for a web agency
    if (auditResult.hasSSL === false) score += 10;
    if (auditResult.mobileScore !== '' && auditResult.mobileScore < 50) score += 15;
    else if (auditResult.mobileScore !== '' && auditResult.mobileScore < 80) score += 8;

    if (auditResult.designQuality === 'poor') score += 20;
    else if (auditResult.designQuality === 'outdated') score += 15;
    else if (auditResult.designQuality === 'average') score += 5;

    if (auditResult.speed === 'slow') score += 10;
    else if (auditResult.speed === 'average') score += 4;

    if (auditResult.hasBooking === false) score += 12;
    if (auditResult.hasContactForm === false) score += 8;
    if (auditResult.hasClearCTA === false) score += 8;
    if (auditResult.hasSocialProof === false) score += 5;

    if (Array.isArray(auditResult.seoIssues)) {
        score += Math.min(15, auditResult.seoIssues.length * 4);
    }

    // Cap
    return Math.max(0, Math.min(100, score));
}

// ============================================
// AUDIT BUILDER
// ============================================

async function buildAuditResult(url, pageSpeedData, leadContext) {
    const now = new Date().toISOString();

    // Defaults from lead context (websiteStatus) and heuristics
    const ws = leadContext.websiteStatus || 'outdated';

    let mobileScore = '';
    let speed = 'unknown';
    let designQuality = mapDesignFromStatus(ws);
    let hasSSL = url.startsWith('https://');

    // PageSpeed / Lighthouse data if available
    if (pageSpeedData) {
        const lh = pageSpeedData.lighthouseResult || {};
        const cats = lh.categories || {};
        const audits = lh.audits || {};

        if (cats.performance?.score != null) {
            const perf = Math.round(cats.performance.score * 100);
            speed = perf >= 80 ? 'fast' : perf >= 50 ? 'average' : 'slow';
        }

        if (cats['accessibility']?.score != null) {
            // not primary but useful
        }

        // Mobile-friendly approximation from performance + viewport
        if (audits['viewport']?.score === 1 && cats.performance?.score != null) {
            mobileScore = Math.round((cats.performance.score * 0.7 + (audits['viewport']?.score || 0) * 30) * 100) / 1;
            // simplify
            mobileScore = Math.round(cats.performance.score * 100);
        } else if (cats.performance?.score != null) {
            mobileScore = Math.round(cats.performance.score * 100);
        }

        // Design quality heuristic from performance + best-practices
        const bp = cats['best-practices']?.score;
        if (bp != null) {
            const bpPct = bp * 100;
            if (bpPct >= 85 && (mobileScore === '' || mobileScore >= 70)) designQuality = 'modern';
            else if (bpPct >= 60) designQuality = 'average';
            else designQuality = 'outdated';
        }
    } else {
        // Heuristic fallback when no API
        mobileScore = heuristicMobileScore(ws, leadContext);
        speed = heuristicSpeed(ws);
    }

    // Conversion signals: prefer explicit audit fields later;
    // for now infer from website status + industry patterns
    const conversion = inferConversionSignals(ws, leadContext);

    const seoIssues = inferSeoIssues(ws, pageSpeedData);

    const recommendations = buildRecommendationsList({
        designQuality,
        mobileScore,
        speed,
        hasSSL,
        ...conversion,
        seoIssues
    });

    return {
        url,
        checkedAt: now,
        mobileScore,
        designQuality,
        speed,
        hasSSL,
        hasBooking: conversion.hasBooking,
        hasContactForm: conversion.hasContactForm,
        hasClearCTA: conversion.hasClearCTA,
        hasSocialProof: conversion.hasSocialProof,
        seoIssues,
        recommendations,
        source: pageSpeedData ? 'pagespeed+heuristic' : 'heuristic',
        opportunityScore: 0, // filled below
        aiInsight: null
    };
}

function createEmptyAudit(url, extra = {}) {
    return {
        url: url || '',
        checkedAt: new Date().toISOString(),
        mobileScore: '',
        designQuality: '',
        speed: '',
        hasSSL: '',
        hasBooking: '',
        hasContactForm: '',
        hasClearCTA: '',
        hasSocialProof: '',
        seoIssues: [],
        recommendations: extra.recommendations || [],
        error: extra.error || null,
        source: 'none',
        opportunityScore: 0,
        aiInsight: null
    };
}

// ============================================
// API CONNECTORS (placeholders)
// ============================================

/**
 * Google PageSpeed Insights API
 * Docs: https://developers.google.com/speed/docs/insights/v5/get-started
 */
async function fetchPageSpeed(url) {
    // --- REAL IMPLEMENTATION (active when key is set) ---
    const endpoint = `${PAGESPEED_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo&key=${PAGESPEED_API_KEY}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.status}`);
    }
    return response.json();
}

/**
 * Future: AI Vision / LLM enhancement
 * Analyze screenshots or HTML summary for design & conversion issues.
 */
async function enhanceWithAI(audit, leadContext) {
    // Placeholder – structure only
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
                    content: 'You are a conversion-focused web auditor for agencies...'
                },
                {
                    role: 'user',
                    content: JSON.stringify({ audit, business: leadContext.businessName, industry: leadContext.industry })
                }
            ]
        })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
    */
    return null;
}

// ============================================
// HEURISTICS (offline-capable)
// ============================================

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) {
        u = 'https://' + u;
    }
    try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

function mapDesignFromStatus(ws) {
    if (ws === 'none') return 'poor';
    if (ws === 'outdated') return 'outdated';
    if (ws === 'good') return 'modern';
    return 'average';
}

function heuristicMobileScore(ws, lead) {
    if (ws === 'none') return 0;
    if (ws === 'outdated') return 38;
    if (ws === 'good') return 82;
    return 55;
}

function heuristicSpeed(ws) {
    if (ws === 'none') return 'unknown';
    if (ws === 'outdated') return 'slow';
    if (ws === 'good') return 'fast';
    return 'average';
}

function inferConversionSignals(ws, lead) {
    // When no website, everything is missing
    if (ws === 'none') {
        return {
            hasBooking: false,
            hasContactForm: false,
            hasClearCTA: false,
            hasSocialProof: false
        };
    }

    // Outdated sites typically lack modern conversion tools
    if (ws === 'outdated') {
        return {
            hasBooking: false,
            hasContactForm: true,   // older sites often have basic contact
            hasClearCTA: false,
            hasSocialProof: (lead.reviews || 0) >= 20
        };
    }

    // Good website – assume better conversion baseline
    return {
        hasBooking: null, // unknown without real crawl
        hasContactForm: true,
        hasClearCTA: true,
        hasSocialProof: (lead.reviews || 0) >= 10
    };
}

function inferSeoIssues(ws, pageSpeedData) {
    const issues = [];

    if (ws === 'none') {
        issues.push('No website to index');
        return issues;
    }

    if (pageSpeedData?.lighthouseResult?.audits) {
        const a = pageSpeedData.lighthouseResult.audits;
        if (a['document-title']?.score === 0) issues.push('Missing or poor title tag');
        if (a['meta-description']?.score === 0) issues.push('Missing meta description');
        if (a['is-crawlable']?.score === 0) issues.push('Page may be blocked from indexing');
        if (a['hreflang']?.score === 0) { /* optional */ }
    } else {
        // Heuristic SEO flags
        if (ws === 'outdated') {
            issues.push('Likely outdated on-page SEO');
            issues.push('Meta description may be missing or weak');
        }
    }

    return issues;
}

function buildRecommendationsList(flags) {
    const recs = [];

    if (flags.designQuality === 'poor' || flags.designQuality === 'outdated') {
        recs.push('Redesign with a modern, conversion-focused layout');
    }
    if (flags.mobileScore !== '' && flags.mobileScore < 70) {
        recs.push('Improve mobile responsiveness and touch targets');
    }
    if (flags.speed === 'slow') {
        recs.push('Optimize images, caching, and core web vitals');
    }
    if (flags.hasSSL === false) {
        recs.push('Enable HTTPS / SSL certificate');
    }
    if (flags.hasBooking === false) {
        recs.push('Add online booking or appointment scheduling');
    }
    if (flags.hasContactForm === false) {
        recs.push('Add a prominent contact form');
    }
    if (flags.hasClearCTA === false) {
        recs.push('Add clear primary CTAs above the fold');
    }
    if (flags.hasSocialProof === false) {
        recs.push('Surface reviews, testimonials, and trust badges');
    }
    if (flags.seoIssues?.length) {
        recs.push('Fix basic on-page SEO (title, meta, headings)');
    }

    if (recs.length === 0) {
        recs.push('Run a deeper conversion audit and A/B test key pages');
    }

    return recs;
}

function buildRecommendation(result, problems, opportunityScore) {
    if (opportunityScore >= 70) {
        return 'High-priority rebuild: modern responsive site with booking, strong CTAs, and conversion optimization.';
    }
    if (opportunityScore >= 45) {
        return 'Targeted improvements: fix the top conversion gaps and modernize key pages.';
    }
    if (problems.length === 0) {
        return 'Site is relatively solid — focus on CRO testing and content upgrades.';
    }
    return 'Address listed issues in priority order, starting with mobile and primary CTAs.';
}

function buildSummary(result, opportunityScore, problemCount) {
    if (result.source === 'heuristic') {
        return `Heuristic audit · Opportunity ${opportunityScore}/100 · ${problemCount} issue${problemCount !== 1 ? 's' : ''} flagged`;
    }
    return `PageSpeed-assisted audit · Opportunity ${opportunityScore}/100 · ${problemCount} issue${problemCount !== 1 ? 's' : ''} flagged`;
}

// Finalize opportunity score on the audit object after build
export async function runFullAudit(url, leadContext = {}) {
    const audit = await analyzeWebsite(url, leadContext);
    audit.opportunityScore = calculateOpportunityScore(audit);
    return audit;
}
