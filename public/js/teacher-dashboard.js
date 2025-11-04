// Teacher Dashboard - Basic Implementation

let currentUser = null;
let myClasses = [];
let selectedClass = null;
let classRoster = [];

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
  
  // Only Teacher should access this dashboard
  if (user.role !== 'Teacher') {
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
    } else {
      window.location.href = '/student-dashboard.html';
      return;
    }
  }
  
  currentUser = user;
  document.getElementById('userDisplayName').textContent = `${user.firstName} ${user.lastName}`;
  
  await loadMyClasses();
});

async function loadMyClasses() {
  try {
    const response = await fetchWithAuth('/api/classes');
    const allClassesData = await response.json();
    
    // Filter classes for this teacher
    myClasses = allClassesData.filter(cls => cls.TeacherID === currentUser.id);
    
    renderClassesDropdown();
    
    if (myClasses.length > 0) {
      loadClassRoster(myClasses[0].ID);
    }
  } catch (error) {
    console.error('Error loading classes:', error);
    showNotification('Error loading your classes', 'error');
  }
}

function renderClassesDropdown() {
  const select = document.getElementById('classSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Select a class</option>';
  
  myClasses.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls.ID;
    option.textContent = `${cls.HonorName || 'N/A'} - ${cls.LocationName || 'N/A'}`;
    select.appendChild(option);
  });
}

async function loadClassRoster(classId) {
  if (!classId) return;
  
  selectedClass = myClasses.find(c => c.ID === parseInt(classId));
  
  try {
    const response = await fetchWithAuth(`/api/registrations/class/${classId}/roster`);
    classRoster = await response.json();
    
    renderRoster();
  } catch (error) {
    console.error('Error loading roster:', error);
    showNotification('Error loading class roster', 'error');
  }
}

function renderRoster() {
  const container = document.getElementById('rosterList');
  if (!container) return;
  
  if (classRoster.length === 0) {
    container.innerHTML = '<p class="text-center">No students enrolled yet.</p>';
    return;
  }
  
  const tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Club</th>
          <th>Investiture Level</th>
          <th>Attended</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${classRoster.map(student => `
          <tr>
            <td>${student.FirstName} ${student.LastName}</td>
            <td>${student.ClubName || 'No Club'}</td>
            <td>${student.InvestitureLevel || 'N/A'}</td>
            <td>${student.Attended ? '✓' : '-'}</td>
            <td>${student.Completed ? '✓' : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  const mobileCards = classRoster.map(student => {
    return createMobileCard({
      'Student Name': `${student.FirstName} ${student.LastName}`,
      'Club': student.ClubName || 'No Club',
      'Investiture Level': student.InvestitureLevel || 'N/A',
      'Attended': student.Attended ? '✓' : '-',
      'Completed': student.Completed ? '✓' : '-'
    }, `${student.FirstName} ${student.LastName}`);
  }).join('');
  
  container.innerHTML = wrapResponsiveTable(tableHtml, mobileCards);
}

// Make functions globally available
window.loadClassRoster = loadClassRoster;

