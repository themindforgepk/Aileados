/**
 * AI Lead Hunter OS - Lead Scoring Engine
 * =======================================
 * Explainable, weighted scoring system (0-100).
 * Every score comes with transparent reasons.
 *
 * Future: analyzeLeadWithAI() will enhance scoring with real AI.
 */

import { isServiceReady, AI_API_KEY, AI_API_ENDPOINT, AI_MODEL } from './api-config.js';

// ============================================
// SCORING RULES (configurable weights)
// ============================================

export const SCORE_RULES = {
    // Website opportunity
    noWebsite:        { points: 40, label: 'No website' },
    outdatedWebsite:  { points: 30, label: 'Outdated website' },
    goodWebsite:      { points: 0,  label: 'Modern website' },

    // Conversion gaps
    noBooking:        { points: 15, label: 'No booking system' },
    noContactForm:    { points: 10, label: 'No contact form' },
    noClearCTA:       { points: 10, label: 'No clear CTA' },

    // Business value
    premiumIndustry:  { points: 10, label: 'Premium industry' },
    reviews50:        { points: 10, label: '50+ reviews' },
    reviews100:       { points: 15, label: '100+ reviews' },

    // Activity signals
    activeSocial:     { points: 5,  label: 'Active social media' },
    completeProfile:  { points: 5,  label: 'Complete Google profile' },

    // Negative factors
    recentlyRedesigned: { points: -10, label: 'Recently redesigned website' },
    lowRating:          { points: -10, label: 'Low rating (< 3.5)' }
};

/** Industries considered high-value for web agencies */
export const PREMIUM_INDUSTRIES = [
    'Healthcare', 'Legal', 'Real Estate', 'Fitness',
    'Professional Services', 'Dental', 'Medical',
    'Law Firm', 'Clinic', 'Spa', 'Salon'
];

// ============================================
// CORE ENGINE
// ============================================

/**
 * Calculate score for a lead (0-100)
 * @param {Object} lead
 * @returns {number}
 */
export function calculateScore(lead) {
    const { total } = evaluateLead(lead);
    return total;
}

/**
 * Get category from score
 * @param {number} score
 * @returns {'hot'|'medium'|'low'}
 */
export function getScoreCategory(score) {
    if (score >= 71) return 'hot';
    if (score >= 41) return 'medium';
    return 'low';
}

/**
 * Human-readable priority
 * @param {number} score
 * @returns {{ label: string, emoji: string, class: string }}
 */
export function getPriorityLevel(score) {
    if (score >= 71) {
        return { label: 'Hot Lead', emoji: '🔥', class: 'hot' };
    }
    if (score >= 41) {
        return { label: 'Medium Opportunity', emoji: '⚡', class: 'medium' };
    }
    return { label: 'Low Priority', emoji: '🧊', class: 'low' };
}

/**
 * Return list of reason objects that contributed to the score
 * @param {Object} lead
 * @returns {Array<{ points: number, label: string, type: 'positive'|'negative' }>}
 */
export function getScoreReasons(lead) {
    const { reasons } = evaluateLead(lead);
    return reasons;
}

/**
 * Full intelligence package for a lead
 * @param {Object} lead
 * @returns {Object}
 */
export function getLeadIntelligence(lead) {
    const { total, reasons } = evaluateLead(lead);
    const category = getScoreCategory(total);
    const priority = getPriorityLevel(total);
    const opportunity = generateOpportunitySummary(lead, total, reasons);

    return {
        score: total,
        category,
        priority,
        reasons,
        opportunity
    };
}

// ============================================
// INTERNAL EVALUATION
// ============================================

/**
 * Core evaluation – returns total + reasons array
 */
function evaluateLead(lead) {
    const reasons = [];
    let total = 0;

    // --- Website status ---
    const ws = lead.websiteStatus || (lead.website ? 'outdated' : 'none');

    if (ws === 'none') {
        add(reasons, SCORE_RULES.noWebsite);
        total += SCORE_RULES.noWebsite.points;
    } else if (ws === 'outdated') {
        add(reasons, SCORE_RULES.outdatedWebsite);
        total += SCORE_RULES.outdatedWebsite.points;
    }
    // good = 0 points, no reason needed

    // --- Conversion opportunities ---
    // Prefer real audit data when available (Phase 4)
    const audit = (lead.auditResult && typeof lead.auditResult === 'object' && !lead.auditResult.error)
        ? lead.auditResult
        : null;

    if (audit) {
        if (audit.hasBooking === false) {
            add(reasons, SCORE_RULES.noBooking);
            total += SCORE_RULES.noBooking.points;
        }
        if (audit.hasContactForm === false) {
            add(reasons, SCORE_RULES.noContactForm);
            total += SCORE_RULES.noContactForm.points;
        }
        if (audit.hasClearCTA === false) {
            add(reasons, SCORE_RULES.noClearCTA);
            total += SCORE_RULES.noClearCTA.points;
        }
        // Mobile weakness as extra signal
        if (audit.mobileScore !== '' && audit.mobileScore !== null && Number(audit.mobileScore) < 50) {
            // Map into outdated-style opportunity if not already counted heavily
            if (ws === 'good') {
                add(reasons, { points: 15, label: 'Weak mobile experience (audit)' });
                total += 15;
            }
        }
    } else if (ws === 'none' || ws === 'outdated') {
        // Infer when no audit yet
        add(reasons, SCORE_RULES.noBooking);
        total += SCORE_RULES.noBooking.points;

        if (ws === 'none') {
            add(reasons, SCORE_RULES.noContactForm);
            total += SCORE_RULES.noContactForm.points;
        } else {
            add(reasons, SCORE_RULES.noClearCTA);
            total += SCORE_RULES.noClearCTA.points;
        }
    }

    // --- Business value: Premium industry ---
    if (isPremiumIndustry(lead.industry)) {
        add(reasons, SCORE_RULES.premiumIndustry);
        total += SCORE_RULES.premiumIndustry.points;
    }

    // --- Reviews ---
    const reviews = Number(lead.reviews) || 0;
    if (reviews >= 100) {
        add(reasons, SCORE_RULES.reviews100);
        total += SCORE_RULES.reviews100.points;
    } else if (reviews >= 50) {
        add(reasons, SCORE_RULES.reviews50);
        total += SCORE_RULES.reviews50.points;
    }

    // --- Social activity ---
    if (hasActiveSocial(lead)) {
        add(reasons, SCORE_RULES.activeSocial);
        total += SCORE_RULES.activeSocial.points;
    }

    // --- Complete profile signals (rating + reviews + contact info) ---
    if (isCompleteProfile(lead)) {
        add(reasons, SCORE_RULES.completeProfile);
        total += SCORE_RULES.completeProfile.points;
    }

    // --- Negative: Low rating ---
    const rating = Number(lead.rating);
    if (rating > 0 && rating < 3.5) {
        add(reasons, SCORE_RULES.lowRating);
        total += SCORE_RULES.lowRating.points;
    }

    // --- Negative: Recently redesigned (manual flag via notes or future field) ---
    if (lead.recentlyRedesigned === true) {
        add(reasons, SCORE_RULES.recentlyRedesigned);
        total += SCORE_RULES.recentlyRedesigned.points;
    }

    // Clamp 0–100
    total = Math.max(0, Math.min(100, total));

    return { total, reasons };
}

function add(reasons, rule) {
    reasons.push({
        points: rule.points,
        label: rule.label,
        type: rule.points >= 0 ? 'positive' : 'negative'
    });
}

function isPremiumIndustry(industry) {
    if (!industry) return false;
    const lower = industry.toLowerCase();
    return PREMIUM_INDUSTRIES.some(p => lower.includes(p.toLowerCase()));
}

function hasActiveSocial(lead) {
    const s = lead.socialLinks || {};
    const count = [s.facebook, s.instagram, s.linkedin].filter(Boolean).length;
    return count >= 1;
}

function isCompleteProfile(lead) {
    // Has rating, reviews, and at least one contact method
    const hasRating = lead.rating != null && lead.rating > 0;
    const hasReviews = (lead.reviews || 0) > 0;
    const hasContact = !!(lead.email || lead.phone);
    return hasRating && hasReviews && hasContact;
}

/**
 * Generate a short opportunity summary in plain English
 */
function generateOpportunitySummary(lead, score, reasons) {
    const name = lead.businessName || 'This business';
    const category = getScoreCategory(score);

    if (category === 'hot') {
        const hasNoSite = reasons.some(r => r.label === 'No website');
        const hasOutdated = reasons.some(r => r.label === 'Outdated website');
        const hasReviews = reasons.some(r => r.label.includes('reviews'));

        if (hasNoSite && hasReviews) {
            return `${name} has strong reputation but no website. High potential client — they need a full online presence to convert existing trust into leads.`;
        }
        if (hasOutdated) {
            return `${name} runs on an outdated site with conversion gaps. Strong opportunity to modernize and add booking/contact systems.`;
        }
        return `High potential client. Strong signals across reputation and online gaps. Prioritize outreach.`;
    }

    if (category === 'medium') {
        return `${name} shows moderate opportunity. Worth a personalized outreach with a focused value proposition around their biggest gap.`;
    }

    return `${name} is lower priority right now. Revisit if website status or review volume improves.`;
}

// ============================================
// FUTURE AI ANALYSIS (placeholder)
// ============================================

/**
 * analyzeLeadWithAI(lead)
 * -----------------------
 * Future: Send lead data + optional website screenshot to an LLM
 * for deeper opportunity analysis and custom messaging angles.
 *
 * When ready:
 * 1. Set AI_API_KEY in api-config.js
 * 2. Set FEATURES.useRealAI = true
 * 3. This function will call the configured endpoint
 *
 * @param {Object} lead
 * @returns {Promise<Object>} AI-enhanced intelligence
 */
export async function analyzeLeadWithAI(lead) {
    if (!isServiceReady('ai')) {
        // Fallback to rule-based intelligence
        return {
            source: 'rules',
            ...getLeadIntelligence(lead),
            aiInsight: null,
            message: 'AI analysis not configured. Using rule-based scoring.'
        };
    }

    // --- PLACEHOLDER FOR REAL API CALL ---
    // Example structure (uncomment and adapt when connecting):
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
                    content: 'You are a lead scoring analyst for a web development agency...'
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        businessName: lead.businessName,
                        industry: lead.industry,
                        websiteStatus: lead.websiteStatus,
                        reviews: lead.reviews,
                        rating: lead.rating,
                        notes: lead.notes
                    })
                }
            ]
        })
    });
    const data = await response.json();
    // Parse AI response into structured insight
    */

    return {
        source: 'ai',
        ...getLeadIntelligence(lead),
        aiInsight: 'AI analysis placeholder — connect your API key to enable.',
        message: 'AI endpoint ready for connection.'
    };
}

// ============================================
// AGGREGATE METRICS (for dashboard)
// ============================================

/**
 * Compute scoring-related dashboard stats
 * @param {Array} leads
 * @returns {Object}
 */
export function getScoringStats(leads) {
    if (!leads || leads.length === 0) {
        return {
            averageScore: 0,
            hotCount: 0,
            mediumCount: 0,
            lowCount: 0,
            distribution: { hot: 0, medium: 0, low: 0 },
            topOpportunities: []
        };
    }

    const scores = leads.map(l => l.score ?? 0);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const hotCount = leads.filter(l => (l.score ?? 0) >= 71).length;
    const mediumCount = leads.filter(l => (l.score ?? 0) >= 41 && (l.score ?? 0) <= 70).length;
    const lowCount = leads.filter(l => (l.score ?? 0) <= 40).length;

    // Top 5 by score (excluding won/lost)
    const topOpportunities = [...leads]
        .filter(l => !['won', 'lost'].includes(l.status))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map(l => ({
            id: l.id,
            businessName: l.businessName,
            score: l.score ?? 0,
            category: getScoreCategory(l.score ?? 0),
            industry: l.industry,
            status: l.status
        }));

    return {
        averageScore,
        hotCount,
        mediumCount,
        lowCount,
        distribution: {
            hot: hotCount,
            medium: mediumCount,
            low: lowCount
        },
        topOpportunities
    };
}
