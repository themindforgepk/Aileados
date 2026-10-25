/**
 * AI Lead Hunter OS - Settings Module
 * ===================================
 * Agency preferences, data export/import, API status.
 */

import {
    getSettings,
    saveSettings,
    createBackup,
    restoreBackup,
    clearAllData,
    exportLeadsCSV,
    getLeads
} from './storage.js';
import { isServiceReady, FEATURES, AI_API_KEY, PAGESPEED_API_KEY, DATABASE_API } from './api-config.js';
import { updateDashboard } from './dashboard.js';
import { showToast } from './app.js';
import { refreshLeads } from './leads.js';
import { refreshOutreachLeadSelect, renderPipelineBoard } from './outreach.js';

/**
 * Initialize settings page
 */
export function initSettings() {
    bindSettingsForm();
    bindDataActions();
    refreshSettingsUI();
}

export function refreshSettingsUI() {
    const s = getSettings();
    setVal('settingAgencyName', s.agencyName || '');
    setVal('settingYourName', s.yourName || '');
    setVal('settingSignature', s.emailSignature || '');
    setVal('settingTone', s.outreachTone || 'consultative');
    setVal('settingCountry', s.defaultCountry || '');

    // API status
    setStatus('apiStatusAI', isServiceReady('ai'), AI_API_KEY ? 'Key present' : 'Not configured');
    setStatus('apiStatusPageSpeed', isServiceReady('pagespeed'), PAGESPEED_API_KEY ? 'Key present' : 'Not configured');
    setStatus('apiStatusDB', isServiceReady('database'), DATABASE_API ? 'Endpoint set' : 'LocalStorage only');

    const leads = getLeads();
    const countEl = document.getElementById('settingsLeadCount');
    if (countEl) countEl.textContent = String(leads.length);
}

function bindSettingsForm() {
    document.getElementById('settingsSaveBtn')?.addEventListener('click', () => {
        const current = getSettings();
        const updated = {
            ...current,
            agencyName: val('settingAgencyName') || 'My Web Agency',
            yourName: val('settingYourName'),
            emailSignature: val('settingSignature'),
            outreachTone: val('settingTone') || 'consultative',
            defaultCountry: val('settingCountry')
        };
        saveSettings(updated);
        showToast('Settings saved', 'success');
        // Update sidebar agency label if present
        const nameEl = document.querySelector('.user-name');
        if (nameEl && updated.yourName) nameEl.textContent = updated.yourName;
        const roleEl = document.querySelector('.user-role');
        if (roleEl && updated.agencyName) roleEl.textContent = updated.agencyName;
    });
}

function bindDataActions() {
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        const csv = exportLeadsCSV();
        if (!csv || csv.split('\n').length < 2) {
            showToast('No leads to export', 'warning');
            return;
        }
        downloadFile(csv, `leads-${dateStamp()}.csv`, 'text/csv');
        showToast('CSV downloaded', 'success');
    });

    document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
        const backup = createBackup();
        downloadFile(JSON.stringify(backup, null, 2), `lead-hunter-backup-${dateStamp()}.json`, 'application/json');
        showToast('Backup downloaded', 'success');
    });

    document.getElementById('importJsonBtn')?.addEventListener('click', () => {
        document.getElementById('importFileInput')?.click();
    });

    document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.leads || !Array.isArray(data.leads)) {
                showToast('Invalid backup file', 'error');
                return;
            }
            const merge = document.getElementById('importMergeCheck')?.checked;
            restoreBackup(data, !!merge);
            showToast(merge ? 'Backup merged' : 'Backup restored', 'success');
            refreshAll();
        } catch (err) {
            console.error(err);
            showToast('Import failed — invalid JSON', 'error');
        }
        e.target.value = '';
    });

    document.getElementById('clearDataBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('clearDataModal');
        modal?.classList.add('open');
    });

    document.getElementById('clearDataCancel')?.addEventListener('click', () => {
        document.getElementById('clearDataModal')?.classList.remove('open');
    });
    document.getElementById('clearDataClose')?.addEventListener('click', () => {
        document.getElementById('clearDataModal')?.classList.remove('open');
    });
    document.getElementById('clearDataModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'clearDataModal') {
            document.getElementById('clearDataModal')?.classList.remove('open');
        }
    });

    document.getElementById('clearDataConfirm')?.addEventListener('click', () => {
        const includeSettings = document.getElementById('clearIncludeSettings')?.checked;
        clearAllData(!!includeSettings);
        document.getElementById('clearDataModal')?.classList.remove('open');
        showToast('All data cleared', 'success');
        refreshAll();
    });
}

function refreshAll() {
    refreshSettingsUI();
    updateDashboard();
    try { refreshLeads(); } catch (_) {}
    try { refreshOutreachLeadSelect(); } catch (_) {}
    try { renderPipelineBoard(); } catch (_) {}
}

function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function dateStamp() {
    return new Date().toISOString().slice(0, 10);
}

function val(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function setStatus(id, ready, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = ready ? `Connected · ${label}` : label;
    el.className = 'api-status-badge ' + (ready ? 'ready' : 'pending');
}
