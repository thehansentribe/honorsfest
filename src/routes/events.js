const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Event = require('../models/event');
const Location = require('../models/location');
const Club = require('../models/club');
const Timeslot = require('../models/timeslot');

const router = express.Router();

// GET /api/events/current/status - Get current event status (for banners) - Public route
router.get('/current/status', (req, res) => {
  try {
    const events = Event.getAll();
    // Find the first Live event, or the most recent event if none are Live
    const liveEvent = events.find(e => e.Status === 'Live');
    const currentEvent = liveEvent || events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate))[0];
    
    if (currentEvent) {
      res.json({ status: currentEvent.Status, eventId: currentEvent.ID, eventName: currentEvent.Name });
    } else {
      res.json({ status: null, eventId: null, eventName: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply auth middleware to all routes after this
router.use(verifyToken);

// GET /api/events - List all events
router.get('/', (req, res) => {
  try {
    const events = Event.getAll();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', (req, res) => {
  try {
    const event = Event.findById(parseInt(req.params.id));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events - Create event (Admin only)
router.post('/', requireRole('Admin'), (req, res) => {
  try {
    console.log('Received event data:', req.body);
    
    // Validate required fields
    if (!req.body.Name || !req.body.StartDate || !req.body.EndDate || !req.body.CoordinatorName) {
      return res.status(400).json({ 
        error: 'Missing required fields. Name, StartDate, EndDate, and CoordinatorName are required.' 
      });
    }
    
    const event = Event.create(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', requireRole('Admin'), (req, res) => {
  try {
    const event = Event.update(parseInt(req.params.id), req.body);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/events/:eventId/locations - Get locations for event
router.get('/:eventId/locations', (req, res) => {
  try {
    const locations = Location.findByEvent(parseInt(req.params.eventId));
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/locations - Create location (Admin, EventAdmin)
router.post('/:eventId/locations', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const location = Location.create({ EventID: parseInt(req.params.eventId), ...req.body });
    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/events/:eventId/clubs - Get clubs for event
router.get('/:eventId/clubs', (req, res) => {
  try {
    const clubs = Club.findByEvent(parseInt(req.params.eventId));
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/clubs - Create club (Admin, EventAdmin)
router.post('/:eventId/clubs', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const club = Club.create({ EventID: parseInt(req.params.eventId), ...req.body });
    res.status(201).json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:eventId/timeslots - Get timeslots for event
router.get('/:eventId/timeslots', (req, res) => {
  try {
    const timeslots = Timeslot.findByEvent(parseInt(req.params.eventId));
    res.json(timeslots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/timeslots - Create timeslot (Admin, EventAdmin)
router.post('/:eventId/timeslots', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const timeslot = Timeslot.create({ EventID: parseInt(req.params.eventId), ...req.body });
    res.status(201).json(timeslot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

