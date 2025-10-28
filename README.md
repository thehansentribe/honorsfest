# Honors Festival Registration Application

A web-based event registration system for managing Honors Festival classes, student registrations, and attendance tracking.

## Features

- **User Roles**: Admin, Event Administrator, Club Director, Teacher, Student, Staff
- **Event Management**: Create events, locations, clubs, and timeslots
- **Class Management**: Assign honors to teachers with capacity control
- **Registration System**: Students register for classes with waitlist automation
- **Timeslot Conflict Prevention**: Automatically prevents double-booking
- **Attendance Tracking**: Teachers mark attendance and completion
- **CSV Reporting**: Generate reports for clubs and events
- **Mobile Responsive**: Works on phones, tablets, and desktop

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT tokens with bcrypt
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Responsive**: Mobile-first CSS design

## Installation

1. Clone the repository:
```bash
cd Honorsfest
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file (if needed):
```bash
# The .env file is in .gitignore, you can create it with:
cp .env.example .env
```

4. Seed the database with honors:
```bash
npm run seed
```

5. Start the development server:
```bash
npm run dev
```

6. Open your browser to `http://localhost:3000`

## Default Credentials

- **Username**: `admin`
- **Password**: `password123`

## Project Structure

```
/Users/jasonhansen/Documents/Honorsfest/
├── package.json
├── .env
├── .gitignore
├── src/
│   ├── server.js
│   ├── config/
│   │   ├── db.js
│   │   └── seed.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── user.js
│   │   ├── event.js
│   │   ├── class.js
│   │   ├── registration.js
│   │   └── honor.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── events.js
│   │   ├── classes.js
│   │   ├── registrations.js
│   │   ├── attendance.js
│   │   └── reports.js
└── public/
    ├── index.html
    ├── login.html
    ├── student-dashboard.html
    ├── teacher-dashboard.html
    ├── admin-dashboard.html
    ├── clubdirector-dashboard.html
    ├── eventadmin-dashboard.html
    ├── css/
    │   └── styles.css
    └── js/
        ├── utils.js
        ├── auth.js
        ├── admin-dashboard.js
        ├── eventadmin-dashboard.js
        ├── clubdirector-dashboard.js
        ├── teacher-dashboard.js
        └── student-dashboard.js
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and receive JWT token

### Users
- `GET /api/users` - List users with filters
- `POST /api/users` - Create user
- `POST /api/users/bulk` - Bulk create users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event (Admin only)
- `PUT /api/events/:id` - Update event
- `GET /api/events/:eventId/locations` - Get locations
- `GET /api/events/:eventId/clubs` - Get clubs
- `GET /api/events/:eventId/timeslots` - Get timeslots

### Classes
- `GET /api/classes/:eventId` - List classes for event
- `POST /api/classes` - Create class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Deactivate class
- `GET /api/honors` - List all honors
- `GET /api/honors/categories` - List categories

### Registrations
- `POST /api/registrations` - Register for class
- `GET /api/registrations/user/:userId` - Get user's registrations
- `DELETE /api/registrations/:id` - Drop class
- `GET /api/registrations/class/:classId/roster` - Get class roster

### Attendance
- `PUT /api/attendance/:classId/:userId` - Update attendance/completion

### Reports
- `GET /api/reports/club/:clubId` - CSV report for club
- `GET /api/reports/event/:eventId` - CSV report for all clubs (Admin only)

## Workflow

1. **Admin** creates an event with locations, clubs, and timeslots
2. **Admin** or **Event Admin** creates classes (honors) assigned to teachers
3. **Students** register for classes (one per timeslot)
4. When classes are full, students are automatically added to waitlist
5. If a student drops, waitlisted students are automatically enrolled in order
6. **Teachers** mark attendance and completion for their classes
7. **Club Directors** or **Admins** generate CSV reports

## Database Schema

- **Users**: User accounts with roles and club assignments
- **Events**: Event information with status (Live/Closed)
- **Locations**: Event locations with capacity
- **Clubs**: Student clubs with director assignments
- **Timeslots**: Event timeslots (date, start/end time)
- **Honors**: Pre-populated list of 527 honors across 8 categories
- **Classes**: Honors assigned to teachers at locations/timeslots
- **Registrations**: Student enrollments and waitlist
- **Attendance**: Attendance and completion tracking

## Notes

- JWT tokens expire after 24 hours
- Default password for bulk-created users: `password123`
- Username format: `FirstName.LastName` (auto-incremented for duplicates)
- Waitlist is first-come, first-served with conflict checking
- CSV reports include: Student Name, Club, Honor Name, Timeslot, Attended, Completed, Investiture Level

## Development

Run with nodemon for auto-reload:
```bash
npm run dev
```

## Deployment

The application uses SQLite and can be deployed to:
- **Render.com** (supports SQLite with persistent disk)
- **Fly.io**
- Any Node.js hosting platform

Make sure to:
1. Set environment variables: `JWT_SECRET`, `PORT`, `DATABASE_PATH`
2. Run `npm run seed` on initial setup
3. Ensure persistent storage for the SQLite database file

## License

MIT


