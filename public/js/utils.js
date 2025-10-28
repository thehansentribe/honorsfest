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
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
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


