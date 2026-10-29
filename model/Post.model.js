const db = require('../config/db');
const createTranslatableModel = require('./translatable.model');

const Post = createTranslatableModel({
  table: 'posts',
  trTable: 'post_translations',
  fk: 'post_id',
  idType: 'uuid',
  cols: [
    'category_id', 'project_id', 'sector_id', 'location_id', 'author_id', 'featured_media_id',
    'status', 'is_featured', 'allow_comments', 'event_date', 'published_at',
  ],
  trCols: ['slug', 'title', 'excerpt', 'content', 'meta_title', 'meta_description'],
  filterCols: ['category_id', 'project_id', 'sector_id', 'location_id', 'status', 'is_featured'],
  searchCols: ['title', 'excerpt'],
  sortable: ['published_at', 'created_at', 'view_count', 'event_date'],
  defaultOrder: 'b.published_at DESC NULLS LAST, b.created_at DESC',
  publicWhere: `b.status = 'published' AND b.published_at <= now()`,
  slugFrom: 'title',
  extraJoin: 'LEFT JOIN media fm ON fm.id = b.featured_media_id',
  extraSelect: ', fm.url AS featured_image',
  relations: [{ name: 'tag_ids', table: 'post_tags', fk: 'post_id', col: 'tag_id', type: 'int' }],
});

Post.incrementViews = (id) => db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [id]);

/* ------------------------------ Comments ------------------------------ */

/** postId optional: omit to list across all posts (moderation queue). */
Post.comments = async ({ postId, status = 'approved', page = 1, limit = 20, includeEmail = false } = {}) => {
  const params = [status];
  let where = 'WHERE c.status = $1';
  if (postId) {
    params.push(postId);
    where += ` AND c.post_id = $${params.length}`;
  }
  const total = (await db.query(`SELECT count(*)::int AS n FROM comments c ${where}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT c.id, c.post_id, c.parent_id, c.author_name, ${includeEmail ? 'c.author_email,' : ''}
            c.body, c.status, c.created_at
     FROM comments c ${where}
     ORDER BY c.created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

Post.addComment = async (postId, d) =>
  (
    await db.query(
      `INSERT INTO comments (post_id, parent_id, author_name, author_email, body, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, created_at`,
      [postId, d.parent_id || null, d.author_name, d.author_email, d.body, d.ip_hash]
    )
  ).rows[0];

Post.moderateComment = async (id, status) =>
  (await db.query('UPDATE comments SET status = $1 WHERE id = $2 RETURNING id, status', [status, id])).rows[0] || null;

Post.removeComment = async (id) => (await db.query('DELETE FROM comments WHERE id = $1', [id])).rowCount > 0;

module.exports = Post;
