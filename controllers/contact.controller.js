const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const ContactMessage = require('../model/ContactMessage.model');
const Newsletter = require('../model/Newsletter.model');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('contact');

/* ----------------------------- Contact form ---------------------------- */

const submit = asyncHandler(async (req, res) => {
  const { website, ...data } = req.validated.body; // honeypot already validated empty
  const ip_hash = crypto.createHash('sha256').update(`${req.ip}${env.JWT_SECRET}`).digest('hex');
  const msg = await ContactMessage.create({ ...data, ip_hash });
  logger.info(`Contact message ${msg.id} received`);
  // TODO: notify info@salam-sy.org by email (nodemailer / transactional email service)
  res.status(201).json({ success: true, message: 'Your message has been sent. Thank you!' });
});

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await ContactMessage.list(req.validated.query)) });
});

const getOne = asyncHandler(async (req, res) => {
  const msg = await ContactMessage.findById(req.validated.params.id);
  if (!msg) throw new AppError('Message not found', 404);
  res.json({ success: true, data: msg });
});

const update = asyncHandler(async (req, res) => {
  const msg = await ContactMessage.update(req.validated.params.id, req.validated.body);
  if (!msg) throw new AppError('Message not found', 404);
  res.json({ success: true, data: msg });
});

const remove = asyncHandler(async (req, res) => {
  if (!(await ContactMessage.remove(req.validated.params.id))) throw new AppError('Message not found', 404);
  logger.info(`Contact message ${req.validated.params.id} deleted by ${req.user.email}`);
  res.json({ success: true, message: 'Message deleted' });
});

/* ------------------------------ Newsletter ----------------------------- */

const subscribe = asyncHandler(async (req, res) => {
  const row = await Newsletter.subscribe(req.validated.body.email, req.validated.body.lang_code || null);
  // TODO: email `row.confirm_token` as a confirmation link. The token is NEVER returned in the API response.
  logger.info(`Newsletter subscription: ${row.email}`);
  res.status(202).json({ success: true, message: 'Please check your email to confirm your subscription' });
});

const confirm = asyncHandler(async (req, res) => {
  if (!(await Newsletter.confirm(req.validated.params.token))) throw new AppError('Invalid or expired link', 404);
  res.json({ success: true, message: 'Subscription confirmed' });
});

const unsubscribe = asyncHandler(async (req, res) => {
  if (!(await Newsletter.unsubscribe(req.validated.params.token))) throw new AppError('Invalid link', 404);
  res.json({ success: true, message: 'You have been unsubscribed' });
});

const subscribers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await Newsletter.list(req.validated.query)) });
});

module.exports = { submit, list, getOne, update, remove, subscribe, confirm, unsubscribe, subscribers };
