const router = require('express').Router();
const db = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'database_unavailable' });
  }
});

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/posts', require('./post.routes'));
router.use('/projects', require('./project.routes'));
router.use('/sectors', require('./sector.routes'));
router.use('/partners', require('./partner.routes'));
router.use('/jobs', require('./job.routes'));
router.use('/tenders', require('./tender.routes'));
router.use('/announcements', require('./announcement.routes'));
router.use('/contact', require('./contact.routes'));
router.use('/newsletter', require('./newsletter.routes'));
router.use('/media', require('./media.routes'));

module.exports = router;
