// Utility functions for frontend

function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
}

function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    return null;
  }
}

const BRANDING_DEFAULTS = {
  siteName: 'Honors Festival',
  logoData: null
};

let brandingSettingsCache = null;
let brandingSettingsPromise = null;

async function fetchBrandingSettings() {
  if (brandingSettingsCache) {
    return brandingSettingsCache;
  }

  if (!brandingSettingsPromise) {
    brandingSettingsPromise = fetch('/api/settings/branding')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load branding settings');
        }
        return res.json();
      })
      .catch(() => BRANDING_DEFAULTS)
      .then(data => {
        brandingSettingsCache = {
          siteName: data.siteName || BRANDING_DEFAULTS.siteName,
          logoData: data.logoData || BRANDING_DEFAULTS.logoData
        };
        brandingSettingsPromise = null;
        return brandingSettingsCache;
      });
  }

  return brandingSettingsPromise;
}

function refreshBrandingCache(data) {
  if (!data) {
    brandingSettingsCache = null;
    brandingSettingsPromise = null;
    return;
  }

  brandingSettingsCache = {
    siteName: data.siteName || BRANDING_DEFAULTS.siteName,
    logoData: data.logoData || BRANDING_DEFAULTS.logoData
  };
  brandingSettingsPromise = null;
}

async function applyBranding(pageTitle) {
  try {
    const branding = await fetchBrandingSettings();
    const siteNameEl = document.getElementById('siteName');
    const pageTitleEl = document.getElementById('pageTitle');
    const logoEl = document.getElementById('siteLogo');

    if (siteNameEl) {
      siteNameEl.textContent = branding.siteName || BRANDING_DEFAULTS.siteName;
    }

    if (pageTitleEl && pageTitle) {
      pageTitleEl.textContent = pageTitle;
    }

    if (logoEl) {
      if (branding.logoData) {
        logoEl.src = branding.logoData;
        logoEl.style.display = 'block';
      } else {
        logoEl.removeAttribute('src');
        logoEl.style.display = 'none';
      }
    }
  } catch (error) {
    console.warn('Unable to apply branding:', error);
    const siteNameEl = document.getElementById('siteName');
    const pageTitleEl = document.getElementById('pageTitle');
    const logoEl = document.getElementById('siteLogo');

    if (siteNameEl) {
      siteNameEl.textContent = BRANDING_DEFAULTS.siteName;
    }
    if (pageTitleEl && pageTitle) {
      pageTitleEl.textContent = pageTitle;
    }
    if (logoEl) {
      logoEl.style.display = 'none';
    }
  }
}

const userDetailsCache = new Map();

async function fetchUserDetails(userId) {
  if (!userId) return null;
  if (userDetailsCache.has(userId)) {
    return userDetailsCache.get(userId);
  }

  try {
    const response = await fetchWithAuth(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user ${userId}`);
    }
    const data = await response.json();
    userDetailsCache.set(userId, data);
    return data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

function setClubName(clubName) {
  const el = document.getElementById('clubNameDisplay');
  if (!el) return;

  if (clubName) {
    el.textContent = `Club: ${clubName}`;
    el.style.display = '';
  } else {
    el.textContent = 'Club: None';
    el.style.display = '';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatAddress(location) {
  if (!location) return '';
  const parts = [location.Name, location.Street, location.City, location.State, location.ZIP]
    .filter(p => p);
  return parts.join(', ');
}

function formatDateTime(dateStr, startTime, endTime) {
  if (!dateStr || !startTime) return '';
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${formattedDate} ${startTime} - ${endTime}`;
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function logout() {
  // Clear all localStorage
  localStorage.clear();
  
  // Clear all sessionStorage
  sessionStorage.clear();
  
  // Clear any cached data
  if (window.allEvents) window.allEvents = [];
  if (window.allUsers) window.allUsers = [];
  if (window.allClubs) window.allClubs = [];
  if (window.allClasses) window.allClasses = [];
  if (window.allLocations) window.allLocations = [];
  if (window.allTimeslots) window.allTimeslots = [];
  if (window.currentUser) window.currentUser = null;
  
  // Clear any global state flags
  if (window.preventBackNavigationInitialized) {
    window.preventBackNavigationInitialized = false;
  }
  if (window.setupVisibilityChecksInitialized) {
    window.setupVisibilityChecksInitialized = false;
  }
  
  // Prevent back navigation
  window.history.replaceState(null, '', '/login.html');
  
  // Use replace instead of href to prevent back button access
  window.location.replace('/login.html');
}

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function redirectToDashboard(role) {
  const dashboards = {
    'Admin': 'admin-dashboard.html',
    'EventAdmin': 'eventadmin-dashboard.html',
    'ClubDirector': 'clubdirector-dashboard.html',
    'Teacher': 'teacher-dashboard.html',
    'Student': 'student-dashboard.html',
    'Staff': 'student-dashboard.html'
  };
  
  const dashboard = dashboards[role];
  if (dashboard) {
    window.location.href = '/' + dashboard;
  } else {
    window.location.href = '/login.html';
  }
}

/**
 * Convert table row data to mobile card HTML
 * @param {Object} rowData - Object with label: value pairs
 * @param {string} headerText - Optional header text for the card
 * @param {string} actionsHtml - Optional HTML for action buttons
 * @returns {string} Mobile card HTML
 */
function createMobileCard(rowData, headerText = null, actionsHtml = '') {
  const header = headerText ? `<div class="card-row-header">${headerText}</div>` : '';
  const items = Object.entries(rowData)
    .filter(([key, value]) => key !== 'actions' && key !== 'id' && value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `
      <div class="card-row-item">
        <span class="card-row-label">${label}:</span>
        <span class="card-row-value">${value}</span>
      </div>
    `).join('');
  
  const actions = actionsHtml ? `<div class="card-row-actions">${actionsHtml}</div>` : '';
  
  return `
    <div class="card-row">
      ${header}
      ${items}
      ${actions}
    </div>
  `;
}

window.fetchBrandingSettings = fetchBrandingSettings;
window.applyBranding = applyBranding;
window.refreshBrandingCache = refreshBrandingCache;
window.fetchUserDetails = fetchUserDetails;
window.setClubName = setClubName;

/**
 * Wrap table HTML with responsive wrapper and add mobile card view
 * @param {string} tableHtml - The table HTML
 * @param {string} mobileCardHtml - The mobile card HTML
 * @returns {string} Wrapped HTML with both table and mobile view
 */
function wrapResponsiveTable(tableHtml, mobileCardHtml = '') {
  if (mobileCardHtml) {
    return `
      <div class="table-responsive">
        ${tableHtml}
        <div class="table-mobile-card">
          ${mobileCardHtml}
        </div>
      </div>
    `;
  }
  // For tables that need scrolling (like bulk-add)
  return `<div class="table-scroll">${tableHtml}</div>`;
}

/**
 * Prevent back navigation from dashboard pages
 * Makes the page idempotent to prevent multiple listeners
 */
function preventBackNavigation() {
  if (window.preventBackNavigationInitialized) {
    return; // Already initialized
  }
  window.preventBackNavigationInitialized = true;
  
  // Push current state to history
  history.pushState(null, '', location.href);
  
  // Listen for popstate (back button)
  window.addEventListener('popstate', function(event) {
    // Push the state back onto the stack
    history.pushState(null, '', location.href);
  });
}

/**
 * Setup visibility checks to verify auth on tab focus
 */
function setupVisibilityChecks() {
  if (window.setupVisibilityChecksInitialized) {
    return; // Already initialized
  }
  window.setupVisibilityChecksInitialized = true;
  
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      // Page became visible, verify auth
      if (!verifyAuth()) {
        if (!checkAuth()) {
          logout();
        }
      }
    }
  });
  
  window.addEventListener('focus', async () => {
    // Window gained focus, verify auth
    if (!verifyAuth()) {
      if (!checkAuth()) {
        logout();
      }
    }
  });
}

/**
 * Verify authentication with backend
 */
async function verifyAuth() {
  try {
    const response = await fetchWithAuth('/api/users/me');
    if (!response.ok) {
      return false;
    }
    return true;
  } catch (error) {
    // Network error, don't aggressively logout
    return true;
  }
}

// Make functions globally available
window.logout = logout;
window.preventBackNavigation = preventBackNavigation;
window.setupVisibilityChecks = setupVisibilityChecks;
window.verifyAuth = verifyAuth;
