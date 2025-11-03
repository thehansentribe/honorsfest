// Student Dashboard - Basic Implementation

let currentUser = null;
let allClasses = [];
let myRegistrations = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) {
    window.location.href = '/login.html';
    return;
  }

  const user = getCurrentUser();
  
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
          <tr>
            <td>${reg.HonorName || 'N/A'}</td>
            <td>${reg.TeacherFirstName ? `${reg.TeacherFirstName} ${reg.TeacherLastName}` : 'N/A'}</td>
            <td>${reg.LocationName || 'N/A'}</td>
            <td>${reg.TimeslotDate || 'N/A'} ${reg.TimeslotStartTime || ''} - ${reg.TimeslotEndTime || ''}</td>
            <td>${reg.status === 'enrolled' ? '<span class="badge bg-success">Enrolled</span>' : '<span class="badge bg-warning">Waitlisted</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

