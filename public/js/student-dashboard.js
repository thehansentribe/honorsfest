// Student Dashboard - Basic Implementation

let currentUser = null;
let allClasses = [];
let myRegistrations = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Clear any previous dashboard state
  if (window.preventBackNavigationInitialized) {
    window.preventBackNavigationInitialized = false;
  }
  if (window.setupVisibilityChecksInitialized) {
    window.setupVisibilityChecksInitialized = false;
  }
  
  // Verify authentication first
  const token = localStorage.getItem('token');
  if (!token) {
    logout();
    return;
  }
  
  // Check token validity
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logout();
      return;
    }
  } catch (error) {
    logout();
    return;
  }
  
  const user = getCurrentUser();
  if (!user || !user.role) {
    logout();
    return;
  }
  
  // Only Student or Staff should access this dashboard
  if (user.role !== 'Student' && user.role !== 'Staff') {
    // Redirect to appropriate dashboard
    if (user.role === 'Admin') {
      window.location.href = '/admin-dashboard.html';
      return;
    } else if (user.role === 'EventAdmin') {
      window.location.href = '/eventadmin-dashboard.html';
      return;
    } else if (user.role === 'ClubDirector') {
      window.location.href = '/clubdirector-dashboard.html';
      return;
    } else if (user.role === 'Teacher') {
      window.location.href = '/teacher-dashboard.html';
      return;
    } else {
      // Unknown role, logout
      logout();
      return;
    }
  }
  
  currentUser = user;
  document.getElementById('userDisplayName').textContent = `${user.firstName} ${user.lastName}`;
  
  await loadMyRegistrations();
  renderRegistrations();
});

async function loadMyRegistrations() {
  try {
    const response = await fetchWithAuth(`/api/registrations/user/${currentUser.id}`);
    const registrations = await response.json();
    
    myRegistrations = registrations.map(reg => ({
      ...reg,
      status: reg.Status || 'enrolled'
    }));
  } catch (error) {
    console.error('Error loading registrations:', error);
    showNotification('Error loading your classes', 'error');
  }
}

function renderRegistrations() {
  const container = document.getElementById('registrationsList');
  if (!container) return;
  
  if (myRegistrations.length === 0) {
    container.innerHTML = '<p class="text-center">No registrations yet. Check back when classes are available.</p>';
    return;
  }
  
  // Helper function to format multi-session badge
  const getMultiSessionBadge = (reg) => {
    if (reg.IsMultiSession && reg.TotalSessions > 1) {
      return `<span class="badge bg-info" style="font-size: 0.7em; margin-left: 5px;" title="Session ${reg.SessionNumber} of ${reg.TotalSessions}">Session ${reg.SessionNumber}/${reg.TotalSessions}</span>`;
    }
    return '';
  };
  
  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Honor Name</th>
          <th>Teacher</th>
          <th>Location</th>
          <th>Date/Time</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${myRegistrations.map(reg => `
          <tr style="${reg.IsMultiSession ? 'background: linear-gradient(to right, #e3f2fd 0%, transparent 100%);' : ''}">
            <td>
              ${reg.HonorName || 'N/A'}
              ${getMultiSessionBadge(reg)}
            </td>
            <td>${reg.TeacherFirstName ? `${reg.TeacherFirstName} ${reg.TeacherLastName}` : 'N/A'}</td>
            <td>${reg.LocationName || 'N/A'}</td>
            <td>${reg.TimeslotDate || 'N/A'} ${reg.TimeslotStartTime ? convertTo12Hour(reg.TimeslotStartTime) : ''}${reg.TimeslotEndTime ? ' - ' + convertTo12Hour(reg.TimeslotEndTime) : ''}</td>
            <td>${reg.status === 'enrolled' || reg.Status === 'Enrolled' ? '<span class="badge bg-success">Enrolled</span>' : '<span class="badge bg-warning">Waitlisted</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

