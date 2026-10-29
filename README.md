# Salam For Hope API

Express + PostgreSQL + Joi backend for the Salam For Hope website (Arabic / English).

## Quick start

```bash
cp .env.example .env            # set DATABASE_URL and a 32+ char JWT_SECRET
npm install
createdb salam
npm run db:init                 # runs database/schema.sql
npm run create-admin -- admin@salam-sy.org 'StrongPass123' "Site Admin"
npm run dev
```

Health check: `GET http://localhost:5000/api/health`

## Folder structure

```
server.js                 app bootstrap, security headers, CORS, static /uploads, graceful shutdown
config/      env.js (Joi-validated .env), db.js (pg pool + tx helper)
model/       translatable.model.js (generic base+translations model) + one file per entity
controllers/ crud.factory.js (generic CRUD) + one controller per entity
routes/      crud.router.js (standard routes) + one router per entity, index.js mounts them
middleware/  auth, validate (Joi), upload (multer), error, rateLimit
services/    *.validation.service.js (Joi schemas), logger, token, media helpers
utils/       AppError, asyncHandler, slugify
logs/        all.log + one log per module (auth, user, posts, jobs, tenders ...)
scripts/     create-admin.js
database/    schema.sql
```

## Conventions

- **Auth**: In Postman, select **Authorization → Bearer Token** and paste the `token` returned by `POST /api/auth/login` (without adding `Bearer ` yourself). Protected routes require this token; `super_admin` has access to everything, with other roles `editor`, `hr`, and `procurement`.
- **Languages**: send `?lang=ar|en`. Falls back to `DEFAULT_LANG`, then any available translation.
- **Writes** use a `translations` array:

```json
POST /api/posts
{
  "status": "published",
  "category_id": 1,
  "tag_ids": [],
  "translations": [
    { "lang_code": "ar", "title": "عنوان", "content": "<p>...</p>" },
    { "lang_code": "en", "title": "Title", "content": "<p>...</p>" }
  ]
}
```
  Slugs are generated from the title when omitted (Arabic slugs supported).
- **Responses**: `{ success, data }` or `{ success, data: [...], meta: { page, limit, total, pages } }`; errors `{ success: false, message, details? }`.

## Endpoints

| Area | Public | Staff |
|---|---|---|
| Auth | `POST /auth/login` | `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout` |
| Users | – | super_admin: `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `GET /users/roles`; any user: `PATCH /users/me/avatar` |
| Posts (activities) | `GET /posts`, `GET /posts/:idOrSlug`, `GET/POST /posts/:id/comments` | editor: `GET /posts/admin/list`, `GET /posts/admin/:id`, `POST`, `PATCH /:id`, `DELETE /:id`, comment moderation under `/posts/comments/*` |
| Projects | `GET /projects`, `GET /projects/:idOrSlug` | editor: same admin routes |
| Sectors | `GET /sectors`, `GET /sectors/:idOrSlug` | editor |
| Partners | `GET /partners` | editor |
| Jobs | `GET /jobs`, `GET /jobs/:idOrSlug`, `POST /jobs/:id/apply` (multipart, field `cv`) | hr: admin routes, `GET /jobs/:id/applications`, `GET /jobs/applications/:appId/cv`, `PATCH/DELETE /jobs/applications/:appId` |
| Tenders | `GET /tenders`, `GET /tenders/:idOrSlug` (with documents + awards), `GET /tenders/:id/awards` | procurement: admin routes, `POST /tenders/:id/documents`, `POST /tenders/:id/awards` |
| Announcements | `GET /announcements`, `GET /announcements/:idOrSlug` | editor / hr / procurement |
| Contact | `POST /contact` | editor: `GET /contact`, `GET/PATCH/DELETE /contact/:id` |
| Newsletter | `POST /newsletter/subscribe`, `GET /newsletter/confirm/:token`, `GET /newsletter/unsubscribe/:token` | editor: `GET /newsletter/subscribers` |
| Media | – | `GET/POST /media`, `DELETE /media/:id` |

## Notes

- CVs are saved in `PRIVATE_UPLOAD_DIR` (not served statically); only HR can download them via the API.
- Contact/newsletter emails are marked `TODO` (plug in nodemailer or a transactional email provider).
- Add a language: insert a row in `languages` and add its code to `LANGS` in `services/common.validation.service.js` (and `DEFAULT_LANG` in `config/env.js` if needed).
- Add another translatable entity: create a model with `createTranslatableModel`, a controller with `crud.factory`, a router with `crud.router`.
