document.addEventListener('DOMContentLoaded', async () => {
  const loadingDiv = document.getElementById('loading');
  const authSetupDiv = document.getElementById('auth-setup');
  const mainContentDiv = document.getElementById('main-content');
  const saveAuthBtn = document.getElementById('save-auth');
  const workspaceUrlInput = document.getElementById('workspace-url');
  const apiTokenInput = document.getElementById('api-token');
  const authErrorDiv = document.getElementById('auth-error');
  const syncBtn = document.getElementById('sync-crm-btn');
  const pitchBtn = document.getElementById('pitch-btn');
  const actionStatusDiv = document.getElementById('action-status');

  let activeProspect = null;
  let workspaceUrl = '';
  let apiToken = '';

  // 1. Resolve Auth Credentials
  try {
    const localAuth = await getStorageData(['workspaceUrl', 'apiToken']);
    workspaceUrl = localAuth.workspaceUrl || '';
    apiToken = localAuth.apiToken || '';

    // If local storage is empty, check config.json fallback (embedded during ZIP package download)
    if (!workspaceUrl || !apiToken) {
      const configRes = await fetch(chrome.runtime.getURL('config.json')).catch(() => null);
      if (configRes && configRes.ok) {
        const config = await configRes.json();
        workspaceUrl = config.workspaceUrl || '';
        apiToken = config.apiToken || '';
        if (workspaceUrl && apiToken) {
          await setStorageData({ workspaceUrl, apiToken });
        }
      }
    }
  } catch (err) {
    console.error('Failed to load credentials:', err);
  }

  if (!workspaceUrl || !apiToken) {
    showAuthSetup();
    return;
  }

  // 2. Perform Active Tab Scan
  try {
    const tabs = await queryActiveTabs();
    if (tabs.length === 0 || !tabs[0].url) {
      showError('No active browser tab found.');
      return;
    }

    const currentUrl = tabs[0].url;
    if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
      showError('Cannot scan non-web page URLs.');
      return;
    }

    // Call SmartSapp Scan Endpoint
    const scanUrl = `${workspaceUrl}/api/lead-intelligence/extension/scan?url=${encodeURIComponent(currentUrl)}`;
    const response = await fetch(scanUrl, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        showError('Invalid or expired Authentication Token.');
        showAuthSetup();
        return;
      }
      showError(`Scan failed: ${response.statusText}`);
      return;
    }

    const result = await response.json();
    activeProspect = result.prospect;
    renderProspect(activeProspect);

  } catch (err) {
    console.error('Scan Error:', err);
    showError('Network error connecting to SmartSapp workspace.');
  }

  // Action listeners
  saveAuthBtn.addEventListener('click', async () => {
    const url = workspaceUrlInput.value.trim();
    const token = apiTokenInput.value.trim();
    if (!url || !token) {
      authErrorDiv.textContent = 'All fields are required.';
      authErrorDiv.style.display = 'block';
      return;
    }
    try {
      await setStorageData({ workspaceUrl: url, apiToken: token });
      authErrorDiv.style.display = 'none';
      window.location.reload();
    } catch (err) {
      authErrorDiv.textContent = 'Failed to save credentials.';
      authErrorDiv.style.display = 'block';
    }
  });

  syncBtn.addEventListener('click', async () => {
    if (!activeProspect) return;
    syncBtn.disabled = true;
    actionStatusDiv.textContent = 'Syncing lead to SmartSapp CRM...';

    try {
      const syncUrl = `${workspaceUrl}/api/lead-intelligence/extension/sync`;
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ prospect: activeProspect })
      });

      if (response.ok) {
        const resData = await response.json();
        actionStatusDiv.textContent = 'Lead synced successfully!';
        syncBtn.textContent = 'Synced ✓';
      } else {
        actionStatusDiv.textContent = `Sync failed: ${response.statusText}`;
        syncBtn.disabled = false;
      }
    } catch (err) {
      actionStatusDiv.textContent = 'Error connecting to workspace API.';
      syncBtn.disabled = false;
    }
  });

  pitchBtn.addEventListener('click', () => {
    if (!activeProspect || !activeProspect.aiInsights) return;
    const pitch = activeProspect.aiInsights.recommendedPitch;
    alert(`Recommended Sales Pitch:\n\n${pitch}`);
  });

  // Helper functions
  function showAuthSetup() {
    loadingDiv.style.display = 'none';
    mainContentDiv.style.display = 'none';
    authSetupDiv.style.display = 'block';
    workspaceUrlInput.value = workspaceUrl;
  }

  function showError(msg) {
    loadingDiv.textContent = msg;
    loadingDiv.style.color = '#ef4444';
  }

  function renderProspect(prospect) {
    loadingDiv.style.display = 'none';
    authSetupDiv.style.display = 'none';
    mainContentDiv.style.display = 'block';

    document.getElementById('lead-name').textContent = prospect.name;
    document.getElementById('lead-domain').textContent = prospect.domain;
    document.getElementById('lead-score-badge').textContent = `${prospect.scoring.overallScore}% Need`;

    if (prospect.aiInsights) {
      document.getElementById('lead-summary').textContent = prospect.aiInsights.summary;
      
      const oppsDiv = document.getElementById('lead-opportunities');
      oppsDiv.innerHTML = prospect.aiInsights.opportunities.map(o => `✓ ${o}`).join('<br>');
    }

    if (prospect.contacts && prospect.contacts.length > 0) {
      const contactsDiv = document.getElementById('lead-contacts');
      contactsDiv.innerHTML = prospect.contacts.map(c => `✉ ${c.email} (${c.role})`).join('<br>');
    }

    const techDiv = document.getElementById('lead-tech');
    techDiv.innerHTML = '';
    if (prospect.websiteScan && prospect.websiteScan.technologies) {
      prospect.websiteScan.technologies.slice(0, 6).forEach(tech => {
        const tag = document.createElement('span');
        tag.className = 'tech-tag';
        tag.textContent = tech;
        techDiv.appendChild(tag);
      });
    }

    if (prospect.syncStatus === 'synced') {
      syncBtn.textContent = 'Synced ✓';
      syncBtn.disabled = true;
    }
  }

  // Storage and chrome wrapper promises
  function getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (items) => {
        resolve(items);
      });
    });
  }

  function setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  function queryActiveTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs || []);
      });
    });
  }
});
