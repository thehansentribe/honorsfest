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

/**
 * Convert 24-hour time format (HH:MM) to 12-hour format with AM/PM
 * @param {string} time24 - Time in 24-hour format (e.g., "14:30")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
function convertTo12Hour(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDateTime(dateStr, startTime, endTime) {
  if (!dateStr || !startTime) return '';
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const startTime12 = convertTo12Hour(startTime);
  const endTime12 = endTime ? convertTo12Hour(endTime) : '';
  return `${formattedDate} ${startTime12}${endTime12 ? ' - ' + endTime12 : ''}`;
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

/**
 * Close a modal by ID
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}

/**
 * Show profile edit modal for current user
 */
async function showEditMyProfile() {
  const user = getCurrentUser();
  if (!user) {
    showNotification('User not found', 'error');
    return;
  }

  // Fetch full user details
  const response = await fetchWithAuth(`/api/users/${user.id}`);
  if (!response.ok) {
    showNotification('Error loading user details', 'error');
    return;
  }

  const userData = await response.json();
  const authMethod = userData.auth_method || 'local';

  const modal = document.createElement('div');
  modal.id = 'editMyProfileModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit My Profile</h2>
        <button onclick="closeModal('editMyProfileModal')" class="btn btn-outline">×</button>
      </div>
      <form id="editMyProfileForm" onsubmit="handleUpdateMyProfile(event)">
        <div class="form-group">
          <label>Username</label>
          <input type="text" value="${userData.Username}" class="form-control" disabled>
          <small style="color: var(--text-light);">Username cannot be changed</small>
        </div>
        <div class="form-group">
          <label for="editMyFirstName">First Name *</label>
          <input type="text" id="editMyFirstName" name="editMyFirstName" class="form-control" value="${userData.FirstName || ''}" required>
        </div>
        <div class="form-group">
          <label for="editMyLastName">Last Name *</label>
          <input type="text" id="editMyLastName" name="editMyLastName" class="form-control" value="${userData.LastName || ''}" required>
        </div>
        <div class="form-group">
          <label for="editMyEmail">Email ${['Admin', 'EventAdmin', 'ClubDirector'].includes(userData.Role) ? '*' : ''}</label>
          <input type="email" id="editMyEmail" name="editMyEmail" class="form-control" value="${userData.Email || ''}" ${['Admin', 'EventAdmin', 'ClubDirector'].includes(userData.Role) ? 'required' : ''}>
          <small style="color: var(--text-light);">${['Admin', 'EventAdmin', 'ClubDirector'].includes(userData.Role) ? 'Required for ' + userData.Role : 'Optional'}</small>
          ${authMethod === 'stytch' ? `<small style="color: #856404; display: block; margin-top: 5px;">⚠️ For Stytch users, changing email will send a verification email to the new address. You must verify the new email to complete the update.</small>` : ''}
        </div>
        <div class="form-group">
          <label for="editMyPhone">Phone</label>
          <input type="text" id="editMyPhone" name="editMyPhone" class="form-control" value="${userData.Phone || ''}">
        </div>
        <div class="form-group">
          <label for="editMyInvestitureLevel">Investiture Level</label>
          <select id="editMyInvestitureLevel" name="editMyInvestitureLevel" class="form-control">
            <option value="None" ${userData.InvestitureLevel === 'None' ? 'selected' : ''}>None</option>
            <option value="Friend" ${userData.InvestitureLevel === 'Friend' ? 'selected' : ''}>Friend</option>
            <option value="Companion" ${userData.InvestitureLevel === 'Companion' ? 'selected' : ''}>Companion</option>
            <option value="Explorer" ${userData.InvestitureLevel === 'Explorer' ? 'selected' : ''}>Explorer</option>
            <option value="Ranger" ${userData.InvestitureLevel === 'Ranger' ? 'selected' : ''}>Ranger</option>
            <option value="Voyager" ${userData.InvestitureLevel === 'Voyager' ? 'selected' : ''}>Voyager</option>
            <option value="Guide" ${userData.InvestitureLevel === 'Guide' ? 'selected' : ''}>Guide</option>
            <option value="MasterGuide" ${userData.InvestitureLevel === 'MasterGuide' ? 'selected' : ''}>Master Guide</option>
          </select>
        </div>
        <div class="form-group">
          <label>Password Reset</label>
          ${authMethod === 'stytch' ? `
            <div style="padding: 10px; background: #f5f5f5; border-radius: 5px; margin-bottom: 10px;">
              <small style="color: var(--text-light); display: block; margin-bottom: 5px;">Your account uses Stytch authentication. Password changes must be done through Stytch.</small>
              <button type="button" onclick="window.location.href='/forgot-password.html'" class="btn btn-secondary" style="width: 100%;">Reset Password via Stytch</button>
            </div>
          ` : `
            <input type="password" id="editMyPassword" name="editMyPassword" class="form-control" placeholder="Leave blank to keep current password">
            <small style="color: var(--text-light);">Enter new password to change it, or leave blank to keep current password</small>
          `}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Update Profile</button>
          <button type="button" onclick="closeModal('editMyProfileModal')" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Handle profile update form submission
 */
async function handleUpdateMyProfile(e) {
  e.preventDefault();
  const form = e.target;

  const userData = {
    FirstName: form.editMyFirstName?.value?.trim() || '',
    LastName: form.editMyLastName?.value?.trim() || '',
    Email: form.editMyEmail?.value?.trim() || null,
    Phone: form.editMyPhone?.value?.trim() || null,
    InvestitureLevel: form.editMyInvestitureLevel?.value || 'None'
  };

  // Add password if provided (only for local auth users)
  const newPassword = form.editMyPassword?.value?.trim();
  if (newPassword) {
    userData.Password = newPassword;
  }

  // Validate
  if (!userData.FirstName || !userData.LastName) {
    showNotification('First Name and Last Name are required', 'error');
    return;
  }

  try {
    const response = await fetchWithAuth('/api/users/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.ok) {
      // Show email verification message if Stytch user email was updated
      if (result.emailVerificationSent && result.emailVerificationMessage) {
        showNotification(result.emailVerificationMessage, 'success');
      } else {
        showNotification('Profile updated successfully', 'success');
      }
      
      // If token was refreshed, update it
      if (result.token) {
        localStorage.setItem('token', result.token);
        
        // Update user display name in banner
        const userDisplayNameEl = document.getElementById('userDisplayName');
        if (userDisplayNameEl) {
          userDisplayNameEl.textContent = `${userData.FirstName} ${userData.LastName}`;
        }
      }
      
      closeModal('editMyProfileModal');
      
      // Reload page to reflect changes in any cached data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      showNotification(result.error || 'Error updating profile', 'error');
    }
  } catch (error) {
    showNotification('Error updating profile: ' + error.message, 'error');
  }
}

// Make functions globally available
window.logout = logout;
window.preventBackNavigation = preventBackNavigation;
window.setupVisibilityChecks = setupVisibilityChecks;
window.verifyAuth = verifyAuth;
window.closeModal = closeModal;
window.showEditMyProfile = showEditMyProfile;
window.handleUpdateMyProfile = handleUpdateMyProfile;
window.convertTo12Hour = convertTo12Hour;
