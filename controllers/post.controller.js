const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Post = require('../model/Post.model');
const crudController = require('./crud.factory');
const { getLogger } = require('../services/logger.service');
const crypto = require('crypto');
const env = require('../config/env');

const logger = getLogger('posts');

const crud = crudController(Post, {
  name: 'Post',
  logger,
  idType: 'uuid',
  prepare: (data, req, { isUpdate }) => {
    const out = { ...data };
    if (!isUpdate) out.author_id = req.user.id;
    // publishing without a date -> publish now
    if (out.status === 'published' && !out.published_at) out.published_at = new Date();
    return out;
  },
  decorate: async (item) => {
    Post.incrementViews(item.id).catch(() => {}); // fire and forget
    return item;
  },
});

/* ------------------------------ Comments ------------------------------ */

const listComments = asyncHandler(async (req, res) => {
  const { page, limit } = req.validated.query;
  res.json({ success: true, ...(await Post.comments({ postId: req.validated.params.id, status: 'approved', page, limit })) });
});

const addComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.validated.params.id, { publicOnly: true });
  if (!post) throw new AppError('Post not found', 404);
  if (!post.allow_comments) throw new AppError('Comments are disabled for this post', 403);
  const ip_hash = crypto.createHash('sha256').update(`${req.ip}${env.JWT_SECRET}`).digest('hex');
  const c = await Post.addComment(post.id, { ...req.validated.body, ip_hash });
  res.status(201).json({ success: true, message: 'Comment submitted and awaiting moderation', data: { id: c.id } });
});

const moderationList = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.validated.query;
  res.json({ success: true, ...(await Post.comments({ status: status || 'pending', page, limit, includeEmail: true })) });
});

const moderateComment = asyncHandler(async (req, res) => {
  const row = await Post.moderateComment(req.validated.params.commentId, req.validated.body.status);
  if (!row) throw new AppError('Comment not found', 404);
  logger.info(`Comment ${row.id} -> ${row.status} by ${req.user.email}`);
  res.json({ success: true, data: row });
});

const removeComment = asyncHandler(async (req, res) => {
  if (!(await Post.removeComment(req.validated.params.commentId))) throw new AppError('Comment not found', 404);
  res.json({ success: true, message: 'Comment deleted' });
});

module.exports = { ...crud, listComments, addComment, moderationList, moderateComment, removeComment };
