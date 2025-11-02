# Honors Festival Registration System - Version 1.0

## 📋 Table of Contents

- [Overview](#overview)
- [System Specifications](#system-specifications)
- [Features & Functionality](#features--functionality)
- [User Roles & Permissions](#user-roles--permissions)
- [Workflows](#workflows)
- [Dependencies](#dependencies)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [File Structure](#file-structure)

---

## Overview

The Honors Festival Registration System is a comprehensive web-based event management platform designed for managing multi-event honors festival registrations. The system supports clubs participating in multiple events throughout the year, provides role-based access control, class registration with waitlist automation, attendance tracking, and hybrid authentication with Stytch integration.

### Key Capabilities

- **Multi-Event Support**: Clubs can participate in multiple events over the year
- **Hybrid Authentication**: Supports both local (bcrypt) and Stytch password authentication
- **Magic Link Login**: Email-based passwordless authentication for Stytch users
- **Role-Based Access**: Six distinct user roles with specific permissions
- **Event State Management**: Three-tier event control (Active/Inactive, Live/Closed)
- **Automated Waitlist**: Automatic enrollment when spots become available
- **Registration Codes**: Secure code-based registration system
- **Attendance Tracking**: Teacher-based attendance and completion tracking
- **CSV Reporting**: Comprehensive reporting for clubs and events

---

## System Specifications

### Technology Stack

- **Backend**: Node.js 18+ with Express.js 4.18+
- **Database**: SQLite 3 (better-sqlite3 12.4+)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Authentication**: JWT (jsonwebtoken 9.0+), bcrypt 5.1+, Stytch 12.42+
- **Server**: Express.js with static file serving
- **Environment**: Production-ready with Render.com deployment support

### Architecture

- **Pattern**: MVC (Model-View-Controller)
- **Database**: SQLite with foreign key constraints
- **API**: RESTful JSON API
- **Authentication**: JWT tokens with 24-hour expiration
- **Session Management**: Stateless JWT-based authentication

### Performance

- **Database**: SQLite with optimized indexes
- **Caching**: None (stateless architecture)
- **Concurrent Users**: Supports typical festival-scale usage
- **Response Time**: Optimized queries with proper indexing

---

## Features & Functionality

### Event Management

- **Multi-Event Support**: Events are independent entities
- **Event States**:
  - **Active/Inactive**: Controls event visibility
  - **Live/Closed**: Controls registration capability
  - Active + Live: Full functionality
  - Active + Closed: View-only mode
  - Inactive: Hidden from users
- **Event Creation**: Admin can create events with dates, locations, and coordinators
- **Event Toggle Controls**: Quick toggle buttons for event and registration status

### Club Management

- **Multi-Event Clubs**: Clubs can participate in multiple events via junction table
- **Club-Event Linking**: Many-to-many relationship between Clubs and Events
- **Club Directors**: Each club has an assigned director with management capabilities
- **Event Selector**: Club Directors can switch between events in their dashboard

### User Management

- **Six User Roles**: Admin, EventAdmin, ClubDirector, Teacher, Student, Staff
- **Bulk User Creation**: Admins can create multiple users at once
- **User Activation**: Users can be activated/deactivated
- **Background Checks**: Track background check status
- **Check-In Numbers**: Unique check-in numbers for attendance
- **Investiture Levels**: Track user investiture progression

### Class Management

- **Honor-Based Classes**: 527 pre-populated honors across 8 categories
- **Capacity Management**: Dual capacity limits (location and teacher)
- **Timeslot Assignment**: Classes assigned to specific timeslots
- **Teacher Assignment**: Classes linked to teachers
- **Location Assignment**: Classes assigned to event locations
- **Active/Inactive**: Classes can be deactivated without deletion

### Registration System

- **Code-Based Registration**: Secure registration code system
- **Event-Specific Codes**: Codes generated per club per event
- **Code Expiration**: Time-based code expiration
- **Password-First Registration**: Users set password during registration
- **Conflict Detection**: Prevents double-booking in same timeslot
- **Waitlist Automation**: Automatic enrollment when spots open
- **Waitlist Ordering**: FIFO (First In, First Out) waitlist management

### Attendance Tracking

- **Teacher-Based**: Teachers mark attendance for their classes
- **Completion Tracking**: Track both attendance and completion status
- **Event-Based Locking**: Attendance locked when event is closed
- **Roster Viewing**: Teachers can view full class rosters

### Reporting

- **Club Reports**: CSV export of club registrations
- **Event Reports**: Comprehensive event-wide reports
- **User Data**: Full user information in reports
- **Registration Status**: Enrolled vs. waitlisted status

### Authentication & Security

- **Hybrid Authentication**:
  - Local: bcrypt-hashed passwords (legacy users)
  - Stytch: Cloud-based password authentication (new users)
- **Magic Link Login**: Email-based passwordless authentication
- **Password Reset**: Stytch-powered password reset flow
- **JWT Tokens**: Secure stateless authentication
- **Role-Based Authorization**: Middleware-enforced permissions
- **Session Security**: Token expiration and validation

---

## User Roles & Permissions

### Admin

**Full System Access**
- Create, edit, and manage all events
- Manage all users across all clubs
- Create and manage all clubs
- Manage all classes
- Generate system-wide reports
- Reset and reseed database
- Toggle event active/registration status
- Manage locations and timeslots
- Access all club director and teacher functions

**Dashboard Features**:
- Event management with toggle controls
- User management (create, edit, deactivate)
- Club management (create, link to events)
- Class management (create, edit, deactivate)
- Location and timeslot management
- System-wide reporting

### EventAdmin

**Event-Specific Management**
- Manage users within their assigned event
- View and manage classes for their event
- Manage locations and timeslots for their event
- Generate reports for their event
- Create users with roles: Student, Teacher, Staff, ClubDirector
- Limited to users with matching EventID

**Dashboard Features**:
- Event-specific user management
- Class management for assigned event
- Location and timeslot management
- Event-specific reporting

### ClubDirector

**Club-Specific Management**
- Manage users within their club
- Create users for their club (Student, Teacher, Staff)
- Generate registration codes for their club
- Manage classes for their club
- Generate club-specific reports
- View multiple events (if club participates in multiple)
- Event selector for multi-event clubs

**Dashboard Features**:
- Club user management
- Registration code generation
- Club class management
- Club-specific reporting
- Event selector (if multiple events)

### Teacher

**Class Management**
- View assigned classes
- View class rosters with student information
- Mark attendance for students
- Mark completion status for students
- View student investiture levels
- Attendance locked when event is closed

**Dashboard Features**:
- Class selection
- Roster viewing
- Attendance marking (attended/completed checkboxes)

### Student

**Self-Service Registration**
- View available classes for active events
- Filter classes by honor, category, teacher, location, timeslot
- Register for classes (one per timeslot)
- Join waitlists when classes are full
- View personal schedule
- Drop classes (triggers waitlist enrollment)
- View registered and waitlisted classes

**Dashboard Features**:
- Class browsing with filters
- Registration interface
- Personal schedule view
- Registered classes list
- Waitlisted classes list

### Staff

**Limited Access**
- View system information
- Limited dashboard functionality
- No class management capabilities

---

## Workflows

### Event Creation Workflow

1. **Admin creates event**:
   - Enter event name, dates, coordinator
   - Set initial status (Active/Inactive, Live/Closed)
   - Add location descriptions

2. **Admin creates locations**:
   - Add locations with capacity limits
   - Link locations to event

3. **Admin creates timeslots**:
   - Create timeslots for each event day
   - Set start and end times

4. **Admin creates/links clubs**:
   - Create new clubs or link existing clubs to event
   - Assign club directors
   - Clubs linked via ClubEvents junction table

5. **Admin/EventAdmin creates classes**:
   - Select honor, teacher, location, timeslot
   - Set capacity limits
   - Activate classes

6. **Event activation**:
   - Admin sets event to "Active"
   - Admin sets registration to "Live"
   - Students can now register

### Registration Workflow

1. **Registration code generation**:
   - Club Director generates code for their club and selected event
   - Code includes expiration date
   - Code sent via email to director

2. **User registration**:
   - User enters registration code
   - System validates code (not expired, not used, correct club/event)
   - User enters personal information
   - User sets password (Stytch or local)
   - Account created with appropriate role and club assignment

3. **Class registration**:
   - Student browses available classes
   - Applies filters (honor, category, teacher, timeslot, location)
   - Selects class
   - System checks for conflicts (same timeslot)
   - If class has capacity: Student enrolled
   - If class is full: Student added to waitlist

4. **Waitlist management**:
   - When student drops class, first waitlisted student is automatically enrolled
   - Waitlist maintains FIFO order
   - System notifies (if notification system implemented)

5. **Dropping classes**:
   - Student can drop enrolled classes
   - Dropping triggers waitlist enrollment
   - Student cannot drop after event closes

### Attendance Workflow

1. **Class begins**:
   - Teacher logs into dashboard
   - Selects their class
   - Views roster with student names and investiture levels

2. **Attendance marking**:
   - Teacher marks "Attended" for present students
   - Teacher marks "Completed" for students who completed requirements
   - System saves attendance data

3. **Event closure**:
   - When event status set to "Closed", attendance checkboxes are locked
   - No further changes allowed

### Multi-Event Club Workflow

1. **Club participates in multiple events**:
   - Admin links club to multiple events via ClubEvents junction table
   - Club Director sees event selector in dashboard

2. **Event selection**:
   - Club Director selects active event from dropdown
   - Dashboard updates to show data for selected event
   - Classes, codes, reports all filter by selected event

3. **Event-specific operations**:
   - Registration codes generated per event
   - Classes viewed/managed per event
   - Reports generated per event

### Authentication Workflow

1. **User login**:
   - User enters username and password
   - System checks auth_method:
     - `local`: Validates with bcrypt
     - `stytch`: Validates with Stytch API
   - On success: JWT token issued (24-hour expiration)

2. **Magic link login** (Stytch users):
   - User requests magic link via email
   - System sends link to registered email
   - User clicks link, authenticated via Stytch
   - JWT token issued on callback

3. **Password reset** (Stytch users):
   - User requests password reset
   - System sends reset link via Stytch
   - User clicks link, sets new password
   - Password updated in Stytch, login enabled

---

## Dependencies

### Production Dependencies

```json
{
  "@stytch/vanilla-js": "^5.40.0",     // Stytch frontend SDK (optional, not actively used)
  "bcrypt": "^5.1.1",                  // Password hashing for local authentication
  "better-sqlite3": "^12.4.1",        // SQLite database driver
  "dotenv": "^16.3.1",                 // Environment variable management
  "express": "^4.18.2",                // Web framework
  "jsonwebtoken": "^9.0.2",            // JWT token generation/verification
  "stytch": "^12.42.1"                 // Stytch authentication SDK
}
```

### Development Dependencies

```json
{
  "nodemon": "^3.0.1"                  // Auto-restart server during development
}
```

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Operating System**: Linux, macOS, or Windows
- **Database**: SQLite 3 (included with better-sqlite3)
- **Memory**: Minimum 512MB, recommended 1GB+
- **Disk Space**: Minimum 100MB for database and dependencies

---

## Requirements

### Functional Requirements

1. **Multi-Event Support**
   - Clubs must be able to participate in multiple events
   - Each event operates independently
   - Club Directors can switch between events

2. **Authentication**
   - Support for legacy local authentication (bcrypt)
   - Support for Stytch password authentication
   - Magic link authentication for Stytch users
   - Password reset functionality

3. **User Management**
   - Role-based access control (6 roles)
   - Bulk user creation
   - User activation/deactivation
   - Background check tracking

4. **Event Management**
   - Three-tier event state control
   - Event visibility control
   - Registration capability control
   - Multi-day event support

5. **Registration**
   - Code-based registration system
   - Conflict detection (one class per timeslot)
   - Automated waitlist management
   - Registration code expiration

6. **Class Management**
   - Honor-based classes
   - Capacity management
   - Teacher assignment
   - Location assignment

7. **Attendance Tracking**
   - Teacher-based attendance marking
   - Completion tracking
   - Event-based locking

8. **Reporting**
   - CSV export functionality
   - Club-specific reports
   - Event-wide reports

### Non-Functional Requirements

1. **Security**
   - JWT token authentication
   - Password hashing (bcrypt)
   - Role-based authorization
   - SQL injection prevention (parameterized queries)
   - HTTPS support in production

2. **Performance**
   - Database indexes on foreign keys
   - Optimized queries
   - Efficient waitlist processing

3. **Reliability**
   - Foreign key constraints
   - Data validation
   - Error handling

4. **Usability**
   - Responsive design
   - Intuitive navigation
   - Clear error messages

5. **Maintainability**
   - Modular code structure
   - Clear separation of concerns
   - Comprehensive error logging (production-appropriate)

---

## Installation & Setup

### Prerequisites

1. **Install Node.js**: Download from [nodejs.org](https://nodejs.org/) (v18+)
2. **Install Git**: For cloning the repository
3. **Create Stytch Account**: Required for Stytch authentication (or use local-only)

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/thehansentribe/honorsfest.git
   cd honorsfest
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Initialize database**:
   ```bash
   npm start
   # Database will auto-initialize on first run
   ```

6. **Seed database** (optional):
   ```bash
   npm run seed
   ```

7. **Start development server**:
   ```bash
   npm run dev
   # Or for production:
   npm start
   ```

### Stytch Setup

1. **Create Stytch Project**:
   - Sign up at [stytch.com](https://stytch.com)
   - Create a new project (Test or Live)
   - Note your Project ID, Secret, and Public Token

2. **Configure Redirect URLs**:
   - Login: `http://localhost:3000/authenticate.html` (local)
   - Login: `https://yourdomain.com/authenticate.html` (production)
   - Signup: Same as Login
   - Reset Password: `http://localhost:3000/reset-password.html` (local)
   - Reset Password: `https://yourdomain.com/reset-password.html` (production)

3. **Enable Features**:
   - Enable "Email Magic Links" for passwordless login
   - Enable "Passwords" for password authentication
   - Configure email templates (optional)

---

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production                    # or 'development'

# Database
DATABASE_PATH=./database.sqlite        # Local path, or /var/lib/render/database.sqlite for Render

# JWT Authentication
JWT_SECRET=your-secret-key-here        # Change in production! Use strong random string

# Stytch Authentication (Required for Stytch features)
STYTCH_PROJECT_ID=project-test-xxxxx   # Your Stytch Project ID
STYTCH_SECRET=secret-test-xxxxx       # Your Stytch Secret
STYTCH_PUBLIC_TOKEN=public-token-xxx  # Your Stytch Public Token (optional)
STYTCH_ENV=test                       # 'test' or 'live'
```

### Database Configuration

- **Local**: Database file stored at `DATABASE_PATH`
- **Render**: Database stored at `/var/lib/render/database.sqlite` (persistent storage)

### Stytch Configuration

- **Project ID**: Auto-detects environment (test/live) from Project ID prefix
- **Secret**: Must match Project ID environment (test secret for test project)
- **Environment**: Can be overridden with `STYTCH_ENV` env var

---

## Database Schema

### Tables

#### Users
- `ID` (PRIMARY KEY)
- `FirstName`, `LastName`, `Username` (UNIQUE)
- `DateOfBirth`, `Email`, `Phone`
- `PasswordHash` (NOT NULL)
- `Role` (Admin, EventAdmin, ClubDirector, Teacher, Student, Staff)
- `InvestitureLevel` (Friend, Companion, Explorer, Ranger, Voyager, Guide, MasterGuide, None)
- `ClubID`, `EventID` (Foreign Keys)
- `Active` (BOOLEAN)
- `BackgroundCheck` (BOOLEAN)
- `CheckInNumber` (UNIQUE)
- `CheckedIn` (BOOLEAN)
- `stytch_user_id` (TEXT, nullable)
- `auth_method` (TEXT: 'local' or 'stytch', default 'local')

#### Events
- `ID` (PRIMARY KEY)
- `Name`, `StartDate`, `EndDate`
- `Status` (Live, Closed)
- `Active` (BOOLEAN)
- `Description`, `CoordinatorName`
- `LocationDescription`, `Street`, `City`, `State`, `ZIP`
- `RoleLabel*` fields for custom role labels

#### Clubs
- `ID` (PRIMARY KEY)
- `Name`, `Church`
- `DirectorID` (Foreign Key to Users)

#### ClubEvents (Junction Table)
- `ID` (PRIMARY KEY)
- `ClubID` (Foreign Key to Clubs)
- `EventID` (Foreign Key to Events)
- `CreatedAt` (TIMESTAMP)
- UNIQUE constraint on (ClubID, EventID)

#### Locations
- `ID` (PRIMARY KEY)
- `EventID` (Foreign Key)
- `Name`, `Description`
- `MaxCapacity`

#### Timeslots
- `ID` (PRIMARY KEY)
- `EventID` (Foreign Key)
- `Date`, `StartTime`, `EndTime`

#### Honors
- `ID` (PRIMARY KEY)
- `Name`, `Category`
- 527 pre-populated honors

#### Classes
- `ID` (PRIMARY KEY)
- `EventID`, `HonorID`, `TeacherID`, `LocationID`, `TimeslotID` (Foreign Keys)
- `MaxCapacity`, `TeacherMaxStudents`
- `Active` (BOOLEAN)
- `CreatedBy` (Foreign Key to Users)

#### Registrations
- `ID` (PRIMARY KEY)
- `UserID`, `ClassID` (Foreign Keys)
- `Status` (Enrolled, Waitlisted)
- `WaitlistOrder` (INTEGER, nullable)

#### Attendance
- `ID` (PRIMARY KEY)
- `ClassID`, `UserID` (Foreign Keys)
- `Attended` (BOOLEAN)
- `Completed` (BOOLEAN)

#### RegistrationCodes
- `ID` (PRIMARY KEY)
- `Code` (UNIQUE)
- `ClubID`, `EventID`, `CreatedBy` (Foreign Keys)
- `CreatedAt`, `ExpiresAt` (TIMESTAMP)
- `Used` (BOOLEAN)
- `UsedAt` (TIMESTAMP, nullable)

### Indexes

- `idx_club_events_club` on ClubEvents(ClubID)
- `idx_club_events_event` on ClubEvents(EventID)
- Foreign key indexes (automatic)

---

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/magic/send` - Send magic link email (Stytch users)
- `POST /api/auth/password-reset/request` - Request password reset (Stytch users)
- `POST /api/auth/password-reset/confirm` - Confirm password reset (Stytch users)
- `POST /api/auth/stytch/callback` - Magic link callback handler

### Users

- `GET /api/users` - List users (with filters: role, clubId, eventId, search)
- `GET /api/users/me` - Get current user
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/checkin/:number` - Get user by check-in number (Admin only)
- `POST /api/users` - Create user (Admin, EventAdmin, ClubDirector)
- `PUT /api/users/:id` - Update user
- `POST /api/users/bulk` - Bulk create users (Admin only)

### Events

- `GET /api/events` - List events (filtered by active status)
- `GET /api/events/my` - Get events for current user's club
- `GET /api/events/:id` - Get event by ID
- `GET /api/events/current/status` - Get current active events
- `POST /api/events` - Create event (Admin only)
- `PUT /api/events/:id` - Update event (Admin only)
- `GET /api/events/:eventId/clubs` - Get clubs for event
- `POST /api/events/:eventId/clubs` - Add club to event (Admin only)

### Clubs

- `GET /api/clubs` - List all clubs
- `GET /api/clubs/event/:eventId` - Get clubs for event
- `GET /api/clubs/:id` - Get club by ID
- `GET /api/clubs/:id/events` - Get events for club
- `POST /api/clubs` - Create club (Admin only)
- `POST /api/clubs/:id/events` - Link club to event (Admin only)
- `DELETE /api/clubs/:id/events/:eventId` - Unlink club from event (Admin only)
- `PUT /api/clubs/:id` - Update club (Admin only)

### Classes

- `GET /api/classes/:eventId` - List classes for event
- `GET /api/classes/:id/roster` - Get class roster
- `POST /api/classes` - Create class (Admin, EventAdmin, ClubDirector)
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Deactivate class

### Honors

- `GET /api/honors` - List all honors
- `GET /api/honors/categories` - List honor categories

### Registrations

- `POST /api/registrations` - Register for class
- `GET /api/registrations/user/:userId` - Get user's registrations
- `GET /api/registrations/user/:userId?eventId=:eventId` - Get user's registrations for event
- `DELETE /api/registrations/:id` - Drop class
- `GET /api/registrations/class/:classId/roster` - Get class roster

### Registration Codes

- `POST /api/codes` - Generate registration code (ClubDirector)
- `GET /api/codes/club/:clubId` - Get codes for club
- `GET /api/codes/club/:clubId?eventId=:eventId` - Get codes for club and event
- `POST /api/codes/register` - Register with code
- `GET /api/codes/:code` - Validate code

### Attendance

- `PUT /api/attendance/:classId/:userId` - Update attendance/completion

### Reports

- `GET /api/reports/club/:clubId` - CSV report for club
- `GET /api/reports/club/:clubId?eventId=:eventId` - CSV report for club and event
- `GET /api/reports/event/:eventId` - CSV report for event (Admin only)

### Admin

- `POST /api/admin/reseed` - Reset and reseed database (Admin only)

### Locations

- `GET /api/locations/event/:eventId` - Get locations for event
- `POST /api/locations` - Create location (Admin, EventAdmin)
- `PUT /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Delete location

### Timeslots

- `GET /api/timeslots/event/:eventId` - Get timeslots for event
- `POST /api/timeslots` - Create timeslot (Admin, EventAdmin)
- `PUT /api/timeslots/:id` - Update timeslot
- `DELETE /api/timeslots/:id` - Delete timeslot

---

## Authentication

### Local Authentication

For users with `auth_method = 'local'`:
- Passwords hashed with bcrypt (10 rounds)
- Username/password login
- Password stored in local database

### Stytch Authentication

For users with `auth_method = 'stytch'`:
- Password stored in Stytch cloud
- Username/password login (validated via Stytch API)
- Magic link login (passwordless)
- Password reset via Stytch

### Authentication Flow

1. **User Login**:
   - User submits username/password
   - System checks `auth_method`:
     - `local`: Validates with bcrypt
     - `stytch`: Validates with Stytch API
   - On success: JWT token issued (24-hour expiration)

2. **Magic Link Login**:
   - User requests magic link
   - System sends link via Stytch
   - User clicks link, authenticated via Stytch callback
   - JWT token issued

3. **Password Reset**:
   - User requests reset (Stytch users only)
   - System sends reset link via Stytch
   - User sets new password
   - Password updated in Stytch

### JWT Token

- **Expiration**: 24 hours
- **Claims**: userId, username, role, clubId, eventId
- **Storage**: localStorage (frontend)
- **Validation**: Middleware checks token on each API request

---

## Deployment

### Render.com Deployment

1. **Create Render Service**:
   - New Web Service
   - Connect GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`

2. **Environment Variables**:
   - Add all variables from `.env`
   - Set `DATABASE_PATH=/var/lib/render/database.sqlite`
   - Set `NODE_ENV=production`

3. **Persistent Storage**:
   - Add disk mount: `/var/lib/render`
   - Database stored at: `/var/lib/render/database.sqlite`

4. **Stytch Redirect URLs**:
   - Update Stytch dashboard with production URLs:
     - Login/Signup: `https://yourdomain.onrender.com/authenticate.html`
     - Reset Password: `https://yourdomain.onrender.com/reset-password.html`

5. **HTTPS Support**:
   - Render provides HTTPS automatically
   - Trust proxy enabled for correct protocol detection

### Local Deployment

1. **Production Build**:
   ```bash
   npm install --production
   ```

2. **Start Server**:
   ```bash
   NODE_ENV=production npm start
   ```

3. **Reverse Proxy** (Optional):
   - Use nginx or similar
   - Configure SSL certificates
   - Set `trust proxy` in Express (already configured)

---

## File Structure

```
honorsfest/
├── package.json                 # Dependencies and scripts
├── .env                        # Environment variables (not in git)
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── database.sqlite            # SQLite database (not in git)
│
├── public/                     # Frontend files
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── authenticate.html      # Stytch magic link callback
│   ├── forgot-password.html    # Password reset request
│   ├── reset-password.html    # Password reset confirmation
│   ├── admin-dashboard.html   # Admin dashboard
│   ├── eventadmin-dashboard.html
│   ├── clubdirector-dashboard.html
│   ├── teacher-dashboard.html
│   ├── student-dashboard.html
│   ├── css/
│   │   └── styles.css         # Stylesheet
│   └── js/
│       ├── utils.js           # Shared utilities
│       ├── admin-dashboard.js
│       ├── clubdirector-dashboard.js
│       ├── eventadmin-dashboard.js
│       ├── teacher-dashboard.js
│       └── student-dashboard.js
│
├── src/                        # Backend source
│   ├── server.js               # Express server setup
│   ├── config/
│   │   ├── db.js              # Database initialization
│   │   ├── migrate.js         # Migration runner
│   │   ├── migrate-club-events.js
│   │   ├── migrate-event-active.js
│   │   └── seed.js            # Database seeding
│   ├── middleware/
│   │   └── auth.js            # JWT & role middleware
│   ├── models/                 # Data models
│   │   ├── user.js
│   │   ├── event.js
│   │   ├── club.js
│   │   ├── class.js
│   │   ├── honor.js
│   │   ├── location.js
│   │   ├── timeslot.js
│   │   ├── registration.js
│   │   └── registrationCode.js
│   ├── routes/                 # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── events.js
│   │   ├── clubs.js
│   │   ├── classes.js
│   │   ├── registrations.js
│   │   ├── registrationCodes.js
│   │   ├── attendance.js
│   │   ├── reports.js
│   │   ├── locations.js
│   │   ├── timeslots.js
│   │   └── admin.js
│   ├── services/
│   │   └── stytch.js          # Stytch authentication service
│   └── utils/
│       └── authHelper.js      # Auth method determination
│
└── Honorslist.rtf              # Honor data source (optional)
```

---

## Version History

- **v1.0** (Current) - Production release with multi-event support, Stytch authentication, production-ready logging
- **v0.3** - Stytch authentication integration
- **v0.2** - Multi-event club implementation
- **v0.1** - Initial stable version

---

## Support & Maintenance

### Default Admin Credentials

After seeding:
- **Username**: `jason.hansen`, `jamie.jesse`, or `valerie.rexin`
- **Password**: `password123`
- **Note**: Change passwords immediately in production!

### Database Reset

Admin can reset database via dashboard:
- Navigate to Admin Dashboard
- Click "Reset & Reseed Database"
- Confirms action
- Database cleared and reseeded

### Backup Recommendations

- **Local**: Copy `database.sqlite` file regularly
- **Render**: Database stored in persistent storage (auto-backed up by Render)
- **Manual**: Export data via CSV reports

---

## License

[Specify your license here]

---

## Contact

[Add contact information]

---

**Version 1.0 - Production Release**
*Last Updated: [Current Date]*
