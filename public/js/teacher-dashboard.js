// Teacher Dashboard - Basic Implementation

let currentUser = null;
let myClasses = [];
let selectedClass = null;
let classRoster = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) {
    window.location.href = '/login.html';
    return;
  }

  const user = getCurrentUser();
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
  
  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Investiture Level</th>
          <th>Attended</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${classRoster.map(student => `
          <tr>
            <td>${student.FirstName} ${student.LastName}</td>
            <td>${student.InvestitureLevel || 'N/A'}</td>
            <td>${student.Attended ? '✓' : '-'}</td>
            <td>${student.Completed ? '✓' : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Make functions globally available
window.loadClassRoster = loadClassRoster;

