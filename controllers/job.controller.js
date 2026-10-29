const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const Job = require('../model/Job.model');
const JobApplication = require('../model/JobApplication.model');
const Media = require('../model/Media.model');
const crudController = require('./crud.factory');
const { toMediaData, deleteFile, resolveStoragePath } = require('../services/media.service');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('jobs');

const crud = crudController(Job, {
  name: 'Job',
  logger,
  prepare: (data, req, { isUpdate }) => {
    const out = { ...data };
    if (!isUpdate) out.created_by = req.user.id;
    if (out.status === 'open' && !out.posted_at) out.posted_at = new Date();
    return out;
  },
});

/** POST /jobs/:id/apply  (public, multipart: fields + file "cv") */
const apply = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('CV file is required (pdf, doc or docx, field "cv")', 400);
  const jobId = req.validated.params.id;

  const job = await Job.findById(jobId, { publicOnly: false });
  if (!job || job.status !== 'open' || new Date(job.deadline_at) < new Date()) {
    throw new AppError('This vacancy is not open for applications', 409);
  }

  const application = await db
    .tx(async (c) => {
      const media = await Media.create(toMediaData(req.file, null, { isPrivate: true }), c);
      return JobApplication.create({ ...req.validated.body, job_id: jobId, cv_media_id: media.id }, c);
    })
    .catch((err) => {
      if (err.code === '23505') throw new AppError('You have already applied for this vacancy', 409);
      throw err;
    });

  logger.info(`Application ${application.id} received for job ${jobId}`);
  res.status(201).json({ success: true, message: 'Application received', data: { id: application.id } });
});

const listApplications = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await JobApplication.listByJob(req.validated.params.id, req.validated.query)) });
});

const updateApplication = asyncHandler(async (req, res) => {
  const row = await JobApplication.update(req.validated.params.appId, req.validated.body);
  if (!row) throw new AppError('Application not found', 404);
  logger.info(`Application ${row.id} -> ${row.status} by ${req.user.email}`);
  const { cv_key, ...safe } = row;
  res.json({ success: true, data: safe });
});

/** GET /jobs/applications/:appId/cv  (HR only — CVs are private files) */
const downloadCv = asyncHandler(async (req, res) => {
  const app = await JobApplication.findById(req.validated.params.appId);
  if (!app || !app.cv_key) throw new AppError('CV not found', 404);
  logger.info(`CV of application ${app.id} downloaded by ${req.user.email}`);
  res.download(resolveStoragePath(app.cv_key), `cv-${app.id}${path.extname(app.cv_key)}`);
});

const removeApplication = asyncHandler(async (req, res) => {
  const { found, storage_key } = await JobApplication.remove(req.validated.params.appId);
  if (!found) throw new AppError('Application not found', 404);
  await deleteFile(storage_key);
  logger.info(`Application ${req.validated.params.appId} deleted by ${req.user.email}`);
  res.json({ success: true, message: 'Application deleted' });
});

module.exports = { ...crud, apply, listApplications, updateApplication, downloadCv, removeApplication };
