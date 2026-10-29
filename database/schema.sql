-- =====================================================================
-- Salam For Hope - Website Database (PostgreSQL 14+)
-- Bilingual (Arabic / English) content model, easily extendable to more languages.
-- Pattern: language-neutral "base" table + "<table>_translations" table.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy / fast LIKE search

-- ---------------------------------------------------------------------
-- 0. ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE publish_status   AS ENUM ('draft','scheduled','published','archived');
CREATE TYPE user_status      AS ENUM ('active','suspended','invited');
CREATE TYPE project_status   AS ENUM ('planned','ongoing','completed','suspended');
CREATE TYPE job_status       AS ENUM ('draft','open','closed','cancelled');
CREATE TYPE tender_status    AS ENUM ('draft','open','closed','awarded','cancelled');
CREATE TYPE application_status AS ENUM ('received','shortlisted','interviewed','rejected','hired');
CREATE TYPE message_status   AS ENUM ('new','read','replied','spam','archived');
CREATE TYPE comment_status   AS ENUM ('pending','approved','rejected','spam');
CREATE TYPE employment_type  AS ENUM ('full_time','part_time','consultancy','volunteer','internship');
CREATE TYPE tender_type      AS ENUM ('goods','services','works','consultancy','rfq','rfp','itb');
CREATE TYPE announcement_type AS ENUM ('general','recruitment_result','tender_result','notice','policy');
CREATE TYPE office_type      AS ENUM ('head_office','field_office','mobile_team');
CREATE TYPE media_kind       AS ENUM ('image','video','document','audio','other');
CREATE TYPE partner_type     AS ENUM ('donor','partner','network','government');

-- ---------------------------------------------------------------------
-- 1. LANGUAGES & GENERIC HELPERS
-- ---------------------------------------------------------------------
CREATE TABLE languages (
    code        varchar(5) PRIMARY KEY,           -- 'ar', 'en', 'ku'
    name        varchar(50) NOT NULL,             -- display name in its own language
    is_rtl      boolean NOT NULL DEFAULT false,
    is_default  boolean NOT NULL DEFAULT false,
    is_active   boolean NOT NULL DEFAULT true,
    sort_order  smallint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_languages_default ON languages (is_default) WHERE is_default;

INSERT INTO languages (code,name,is_rtl,is_default,sort_order) VALUES
 ('ar','العربية',true,true,1),
 ('en','English',false,false,2);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 2. USERS, ROLES, PERMISSIONS (admin dashboard / CMS)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        varchar(40) UNIQUE NOT NULL,      -- super_admin, editor, hr, procurement
    name        varchar(100) NOT NULL,
    description text
);

CREATE TABLE permissions (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        varchar(80) UNIQUE NOT NULL,      -- e.g. 'posts.publish', 'jobs.manage'
    description text
);

CREATE TABLE role_permissions (
    role_id       smallint REFERENCES roles(id) ON DELETE CASCADE,
    permission_id smallint REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext UNIQUE NOT NULL,
    password_hash text NOT NULL,                  -- argon2/bcrypt, never plain text
    full_name     varchar(150) NOT NULL,
    avatar_media_id uuid,                         -- FK added after media table
    role_id       smallint NOT NULL REFERENCES roles(id),
    preferred_lang varchar(5) REFERENCES languages(code),
    status        user_status NOT NULL DEFAULT 'active',
    two_factor_secret text,
    last_login_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3. MEDIA LIBRARY (replaces wp-content/uploads)
-- ---------------------------------------------------------------------
CREATE TABLE media (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         media_kind NOT NULL,
    storage_key  text NOT NULL,                   -- path/key in S3 / local storage
    url          text NOT NULL,
    mime_type    varchar(100),
    size_bytes   bigint,
    width        int,
    height       int,
    duration_sec int,                             -- video/audio
    checksum     varchar(64),
    uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_media_id) REFERENCES media(id) ON DELETE SET NULL;

CREATE TABLE media_translations (
    media_id  uuid REFERENCES media(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    alt_text  varchar(300),                       -- accessibility + SEO
    caption   text,
    PRIMARY KEY (media_id, lang_code)
);

-- ---------------------------------------------------------------------
-- 4. GEOGRAPHY & OFFICES
-- ---------------------------------------------------------------------
CREATE TABLE locations (                          -- governorate / district / city / camp
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id  int REFERENCES locations(id) ON DELETE SET NULL,
    level      varchar(20) NOT NULL,              -- country, governorate, district, city, camp
    pcode      varchar(20) UNIQUE,                -- OCHA P-code (standard in humanitarian work)
    latitude   numeric(9,6),
    longitude  numeric(9,6)
);
CREATE TABLE location_translations (
    location_id int REFERENCES locations(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    name        varchar(150) NOT NULL,
    PRIMARY KEY (location_id, lang_code)
);

CREATE TABLE offices (
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        office_type NOT NULL,
    location_id int REFERENCES locations(id),
    phone       varchar(40),
    email       citext,
    latitude    numeric(9,6),
    longitude   numeric(9,6),
    sort_order  smallint NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true
);
CREATE TABLE office_translations (
    office_id  int REFERENCES offices(id) ON DELETE CASCADE,
    lang_code  varchar(5) REFERENCES languages(code),
    name       varchar(150) NOT NULL,
    address    text,
    PRIMARY KEY (office_id, lang_code)
);

-- ---------------------------------------------------------------------
-- 5. SITE SETTINGS, SOCIAL LINKS, MENUS, STATIC PAGES
-- ---------------------------------------------------------------------
CREATE TABLE site_settings (
    key         varchar(100) PRIMARY KEY,         -- 'contact_email','logo_media_id','footer_copyright'
    value       jsonb NOT NULL,
    is_public   boolean NOT NULL DEFAULT true,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_setting_translations (
    key        varchar(100) REFERENCES site_settings(key) ON DELETE CASCADE,
    lang_code  varchar(5) REFERENCES languages(code),
    value      text NOT NULL,                     -- tagline, footer text, etc.
    PRIMARY KEY (key, lang_code)
);

CREATE TABLE social_links (
    id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform   varchar(30) NOT NULL,              -- facebook, linkedin, youtube, instagram, tiktok
    url        text NOT NULL,
    sort_order smallint NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE menus (
    id       smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location varchar(30) UNIQUE NOT NULL          -- 'header','footer'
);
CREATE TABLE menu_items (
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    menu_id    smallint NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    parent_id  int REFERENCES menu_items(id) ON DELETE CASCADE,   -- Jobs & Tenders > sub-items
    page_id    int,                                -- FK added after pages
    custom_url text,
    sort_order smallint NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true
);
CREATE TABLE menu_item_translations (
    menu_item_id int REFERENCES menu_items(id) ON DELETE CASCADE,
    lang_code    varchar(5) REFERENCES languages(code),
    label        varchar(100) NOT NULL,
    PRIMARY KEY (menu_item_id, lang_code)
);

CREATE TABLE pages (                              -- About Us, Services page, Privacy, etc.
    id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template      varchar(40) NOT NULL DEFAULT 'default',   -- home, about, listing...
    status        publish_status NOT NULL DEFAULT 'draft',
    featured_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    published_at  timestamptz,
    created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_pages_upd BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TABLE page_translations (
    page_id          int REFERENCES pages(id) ON DELETE CASCADE,
    lang_code        varchar(5) REFERENCES languages(code),
    slug             varchar(200) NOT NULL,
    title            varchar(250) NOT NULL,
    content          text,                         -- HTML / Markdown / JSON blocks
    meta_title       varchar(200),
    meta_description varchar(320),
    og_media_id      uuid REFERENCES media(id) ON DELETE SET NULL,
    PRIMARY KEY (page_id, lang_code),
    UNIQUE (lang_code, slug)
);
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL;

-- Homepage blocks: hero, mission/vision/definition tabs, video, etc. (editable without code)
CREATE TABLE page_sections (
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_id    int NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    section_key varchar(50) NOT NULL,             -- 'hero','vision','mission','definition','video'
    media_id   uuid REFERENCES media(id) ON DELETE SET NULL,
    settings   jsonb NOT NULL DEFAULT '{}',       -- button url, video url...
    sort_order smallint NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true,
    UNIQUE (page_id, section_key)
);
CREATE TABLE page_section_translations (
    section_id int REFERENCES page_sections(id) ON DELETE CASCADE,
    lang_code  varchar(5) REFERENCES languages(code),
    title      varchar(250),
    body       text,
    button_label varchar(80),
    PRIMARY KEY (section_id, lang_code)
);

-- ---------------------------------------------------------------------
-- 6. ABOUT: VALUES, TIMELINE, TEAM / BOARD, STATS, FAQ
-- ---------------------------------------------------------------------
CREATE TABLE core_values (                        -- Independence, Accountability, ...
    id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    icon_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE core_value_translations (
    value_id  smallint REFERENCES core_values(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    title     varchar(100) NOT NULL,
    description text,
    PRIMARY KEY (value_id, lang_code)
);

CREATE TABLE timeline_events (                    -- 2015 founded, 2023 rebrand, 2025 licensed
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year       smallint NOT NULL,
    month      smallint,
    sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE timeline_event_translations (
    event_id  int REFERENCES timeline_events(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    title     varchar(200) NOT NULL,
    description text,
    PRIMARY KEY (event_id, lang_code)
);

CREATE TABLE team_members (                       -- management / board
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    photo_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    group_name varchar(30) NOT NULL DEFAULT 'management',  -- board, management, advisors
    linkedin_url text,
    sort_order smallint NOT NULL DEFAULT 0,
    is_active  boolean NOT NULL DEFAULT true
);
CREATE TABLE team_member_translations (
    member_id int REFERENCES team_members(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    full_name varchar(150) NOT NULL,
    position  varchar(150),
    bio       text,
    PRIMARY KEY (member_id, lang_code)
);

CREATE TABLE impact_stats (                       -- animated counters on home page
    id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key        varchar(50) UNIQUE NOT NULL,       -- years_experience, projects, beneficiaries, sectors
    value      bigint NOT NULL,
    suffix     varchar(5) DEFAULT '+',            -- '+', 'k+'
    is_auto    boolean NOT NULL DEFAULT false,    -- true = computed from projects table
    sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE impact_stat_translations (
    stat_id   smallint REFERENCES impact_stats(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    label     varchar(100) NOT NULL,
    PRIMARY KEY (stat_id, lang_code)
);

CREATE TABLE faq_categories (
    id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE faq_category_translations (
    category_id smallint REFERENCES faq_categories(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    name        varchar(100) NOT NULL,
    PRIMARY KEY (category_id, lang_code)
);
CREATE TABLE faqs (
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id smallint REFERENCES faq_categories(id) ON DELETE SET NULL,
    sort_order  smallint NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true
);
CREATE TABLE faq_translations (
    faq_id    int REFERENCES faqs(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    question  text NOT NULL,
    answer    text NOT NULL,
    PRIMARY KEY (faq_id, lang_code)
);

-- ---------------------------------------------------------------------
-- 7. PROGRAMS (SECTORS) & PROJECTS
-- ---------------------------------------------------------------------
CREATE TABLE sectors (                            -- Child Protection, WASH, GBV, Mine Action...
    id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          varchar(30) UNIQUE NOT NULL,    -- 'child_protection'
    icon_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    sort_order    smallint NOT NULL DEFAULT 0,
    is_active     boolean NOT NULL DEFAULT true
);
CREATE TABLE sector_translations (
    sector_id   smallint REFERENCES sectors(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    slug        varchar(120) NOT NULL,
    name        varchar(120) NOT NULL,
    summary     text,
    description text,
    meta_title  varchar(200),
    meta_description varchar(320),
    PRIMARY KEY (sector_id, lang_code),
    UNIQUE (lang_code, slug)
);

CREATE TABLE projects (
    id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          varchar(40) UNIQUE,             -- internal grant / project code
    status        project_status NOT NULL DEFAULT 'ongoing',
    start_date    date,
    end_date      date,
    budget_amount numeric(14,2),
    budget_currency char(3) DEFAULT 'USD',
    show_budget   boolean NOT NULL DEFAULT false, -- publicly display or not
    beneficiaries_total int,
    beneficiaries_women int,
    beneficiaries_men   int,
    beneficiaries_girls int,
    beneficiaries_boys  int,
    cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    is_featured   boolean NOT NULL DEFAULT false,
    visibility    publish_status NOT NULL DEFAULT 'draft',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TRIGGER trg_projects_upd BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TABLE project_translations (
    project_id  int REFERENCES projects(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    slug        varchar(200) NOT NULL,
    title       varchar(250) NOT NULL,
    summary     text,
    objectives  text,
    description text,
    results     text,
    meta_title  varchar(200),
    meta_description varchar(320),
    PRIMARY KEY (project_id, lang_code),
    UNIQUE (lang_code, slug)
);
CREATE TABLE project_sectors (
    project_id int REFERENCES projects(id) ON DELETE CASCADE,
    sector_id  smallint REFERENCES sectors(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, sector_id)
);
CREATE TABLE project_locations (
    project_id  int REFERENCES projects(id) ON DELETE CASCADE,
    location_id int REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, location_id)
);
CREATE TABLE project_media (
    project_id int REFERENCES projects(id) ON DELETE CASCADE,
    media_id   uuid REFERENCES media(id) ON DELETE CASCADE,
    sort_order smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, media_id)
);

-- ---------------------------------------------------------------------
-- 8. PARTNERS & DONORS
-- ---------------------------------------------------------------------
CREATE TABLE partners (
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        partner_type NOT NULL DEFAULT 'donor',
    logo_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    website_url text,
    sort_order  smallint NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    show_on_home boolean NOT NULL DEFAULT true
);
CREATE TABLE partner_translations (
    partner_id  int REFERENCES partners(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    name        varchar(200) NOT NULL,
    description text,
    PRIMARY KEY (partner_id, lang_code)
);
CREATE TABLE project_partners (                   -- which donor funds which project
    project_id int REFERENCES projects(id) ON DELETE CASCADE,
    partner_id int REFERENCES partners(id) ON DELETE CASCADE,
    role       varchar(30) NOT NULL DEFAULT 'donor',  -- donor, implementing_partner
    PRIMARY KEY (project_id, partner_id, role)
);

-- ---------------------------------------------------------------------
-- 9. ACTIVITIES / NEWS / STORIES (blog)
-- ---------------------------------------------------------------------
CREATE TABLE post_categories (
    id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id  smallint REFERENCES post_categories(id) ON DELETE SET NULL,
    code       varchar(40) UNIQUE NOT NULL,       -- activities, success_stories, press, reports
    sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE post_category_translations (
    category_id smallint REFERENCES post_categories(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    slug        varchar(120) NOT NULL,
    name        varchar(120) NOT NULL,
    PRIMARY KEY (category_id, lang_code),
    UNIQUE (lang_code, slug)
);

CREATE TABLE posts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   smallint REFERENCES post_categories(id) ON DELETE SET NULL,
    project_id    int REFERENCES projects(id) ON DELETE SET NULL,   -- link activity -> project
    sector_id     smallint REFERENCES sectors(id) ON DELETE SET NULL,
    location_id   int REFERENCES locations(id) ON DELETE SET NULL,
    author_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    featured_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    status        publish_status NOT NULL DEFAULT 'draft',
    is_featured   boolean NOT NULL DEFAULT false,
    allow_comments boolean NOT NULL DEFAULT false,
    event_date    date,                           -- date the activity happened
    published_at  timestamptz,                    -- also used for scheduling
    view_count    int NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_posts_upd BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_posts_list ON posts (status, published_at DESC);
CREATE INDEX idx_posts_cat  ON posts (category_id, published_at DESC);

CREATE TABLE post_translations (
    post_id    uuid REFERENCES posts(id) ON DELETE CASCADE,
    lang_code  varchar(5) REFERENCES languages(code),
    slug       varchar(300) NOT NULL,             -- Arabic slugs supported (UTF-8)
    title      varchar(300) NOT NULL,
    excerpt    text,
    content    text NOT NULL,
    meta_title varchar(200),
    meta_description varchar(320),
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,''))
    ) STORED,
    PRIMARY KEY (post_id, lang_code),
    UNIQUE (lang_code, slug)
);
CREATE INDEX idx_post_tr_search ON post_translations USING gin (search_vector);
CREATE INDEX idx_post_tr_title_trgm ON post_translations USING gin (title gin_trgm_ops);

CREATE TABLE tags (
    id   int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code varchar(60) UNIQUE NOT NULL
);
CREATE TABLE tag_translations (
    tag_id    int REFERENCES tags(id) ON DELETE CASCADE,
    lang_code varchar(5) REFERENCES languages(code),
    name      varchar(80) NOT NULL,
    PRIMARY KEY (tag_id, lang_code)
);
CREATE TABLE post_tags (
    post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  int  REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);
CREATE TABLE post_media (                         -- gallery
    post_id    uuid REFERENCES posts(id) ON DELETE CASCADE,
    media_id   uuid REFERENCES media(id) ON DELETE CASCADE,
    sort_order smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, media_id)
);

CREATE TABLE comments (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id   bigint REFERENCES comments(id) ON DELETE CASCADE,
    author_name varchar(100) NOT NULL,
    author_email citext NOT NULL,
    body        text NOT NULL,
    status      comment_status NOT NULL DEFAULT 'pending',
    ip_hash     varchar(64),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON comments (post_id, status);

-- ---------------------------------------------------------------------
-- 10. REPORTS & PUBLICATIONS (annual reports, policies, research)
-- ---------------------------------------------------------------------
CREATE TABLE publications (
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        varchar(30) NOT NULL,             -- annual_report, policy, research, factsheet
    year        smallint,
    cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    file_media_id  uuid REFERENCES media(id) ON DELETE SET NULL,
    sector_id   smallint REFERENCES sectors(id) ON DELETE SET NULL,
    status      publish_status NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    download_count int NOT NULL DEFAULT 0
);
CREATE TABLE publication_translations (
    publication_id int REFERENCES publications(id) ON DELETE CASCADE,
    lang_code      varchar(5) REFERENCES languages(code),
    slug           varchar(200) NOT NULL,
    title          varchar(250) NOT NULL,
    description    text,
    file_media_id  uuid REFERENCES media(id) ON DELETE SET NULL,   -- language-specific file
    PRIMARY KEY (publication_id, lang_code),
    UNIQUE (lang_code, slug)
);

-- ---------------------------------------------------------------------
-- 11. JOBS & RECRUITMENT
-- ---------------------------------------------------------------------
CREATE TABLE jobs (
    id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_no  varchar(50) UNIQUE NOT NULL,     -- e.g. SFH-2026-014
    office_id     int REFERENCES offices(id) ON DELETE SET NULL,
    location_id   int REFERENCES locations(id) ON DELETE SET NULL,
    sector_id     smallint REFERENCES sectors(id) ON DELETE SET NULL,
    project_id    int REFERENCES projects(id) ON DELETE SET NULL,
    employment_type employment_type NOT NULL DEFAULT 'full_time',
    openings      smallint NOT NULL DEFAULT 1,
    posted_at     timestamptz,
    deadline_at   timestamptz NOT NULL,
    status        job_status NOT NULL DEFAULT 'draft',
    attachment_media_id uuid REFERENCES media(id) ON DELETE SET NULL,  -- full ToR PDF
    apply_url     text,                            -- external form optional
    created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_jobs_upd BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_jobs_open ON jobs (status, deadline_at);
CREATE TABLE job_translations (
    job_id       int REFERENCES jobs(id) ON DELETE CASCADE,
    lang_code    varchar(5) REFERENCES languages(code),
    slug         varchar(250) NOT NULL,
    title        varchar(250) NOT NULL,
    summary      text,
    responsibilities text,
    qualifications   text,
    how_to_apply     text,
    PRIMARY KEY (job_id, lang_code),
    UNIQUE (lang_code, slug)
);

CREATE TABLE job_applications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       int NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    full_name    varchar(150) NOT NULL,
    email        citext NOT NULL,
    phone        varchar(40),
    cover_letter text,
    cv_media_id  uuid REFERENCES media(id) ON DELETE SET NULL,
    status       application_status NOT NULL DEFAULT 'received',
    hr_notes     text,
    consent_given boolean NOT NULL DEFAULT false,  -- GDPR-style consent
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, email)                         -- prevent duplicate applications
);
CREATE INDEX idx_apps_job ON job_applications (job_id, status);

-- ---------------------------------------------------------------------
-- 12. TENDERS & BIDS
-- ---------------------------------------------------------------------
CREATE TABLE tenders (
    id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_no  varchar(50) UNIQUE NOT NULL,
    type          tender_type NOT NULL,
    project_id    int REFERENCES projects(id) ON DELETE SET NULL,
    location_id   int REFERENCES locations(id) ON DELETE SET NULL,
    published_at  timestamptz,
    clarification_deadline timestamptz,
    submission_deadline    timestamptz NOT NULL,
    opening_date  timestamptz,
    submission_email citext,
    status        tender_status NOT NULL DEFAULT 'draft',
    created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenders_upd BEFORE UPDATE ON tenders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_tenders_open ON tenders (status, submission_deadline);
CREATE TABLE tender_translations (
    tender_id   int REFERENCES tenders(id) ON DELETE CASCADE,
    lang_code   varchar(5) REFERENCES languages(code),
    slug        varchar(250) NOT NULL,
    title       varchar(300) NOT NULL,
    description text,
    instructions text,
    PRIMARY KEY (tender_id, lang_code),
    UNIQUE (lang_code, slug)
);
CREATE TABLE tender_documents (                   -- ITB, BoQ, specs, forms, addenda
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tender_id  int NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    media_id   uuid NOT NULL REFERENCES media(id),
    doc_type   varchar(30) NOT NULL DEFAULT 'tender_document',  -- addendum, boq, result
    lang_code  varchar(5) REFERENCES languages(code),
    title      varchar(250),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tender_awards (                      -- transparency: publish results
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tender_id   int NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    supplier_name varchar(250) NOT NULL,
    award_amount numeric(14,2),
    currency    char(3) DEFAULT 'USD',
    awarded_at  date,
    is_public   boolean NOT NULL DEFAULT true
);
CREATE TABLE vendor_registrations (               -- supplier pre-qualification
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name varchar(250) NOT NULL,
    contact_name varchar(150),
    email       citext NOT NULL,
    phone       varchar(40),
    categories  text[],
    documents_media_ids uuid[],
    status      varchar(20) NOT NULL DEFAULT 'pending',   -- pending, approved, rejected
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 13. PUBLIC ANNOUNCEMENTS
-- ---------------------------------------------------------------------
CREATE TABLE announcements (
    id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        announcement_type NOT NULL DEFAULT 'general',
    job_id      int REFERENCES jobs(id) ON DELETE SET NULL,
    tender_id   int REFERENCES tenders(id) ON DELETE SET NULL,
    attachment_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    status      publish_status NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    expires_at  timestamptz,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE announcement_translations (
    announcement_id int REFERENCES announcements(id) ON DELETE CASCADE,
    lang_code  varchar(5) REFERENCES languages(code),
    slug       varchar(250) NOT NULL,
    title      varchar(300) NOT NULL,
    body       text,
    PRIMARY KEY (announcement_id, lang_code),
    UNIQUE (lang_code, slug)
);

-- ---------------------------------------------------------------------
-- 14. CONTACT, FEEDBACK & COMPLAINTS (CHM), NEWSLETTER
-- ---------------------------------------------------------------------
CREATE TABLE contact_messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(150) NOT NULL,
    email      citext NOT NULL,
    phone      varchar(40),
    subject    varchar(250),
    message    text NOT NULL,
    status     message_status NOT NULL DEFAULT 'new',
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    ip_hash    varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_status ON contact_messages (status, created_at DESC);

-- Humanitarian standard: Complaints & Feedback Mechanism (CHS Commitment 5) & PSEA reporting
CREATE TABLE feedback_complaints (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number varchar(30) UNIQUE NOT NULL,
    category    varchar(40) NOT NULL,             -- feedback, complaint, psea, fraud, request
    is_anonymous boolean NOT NULL DEFAULT true,
    reporter_name varchar(150),
    reporter_contact varchar(150),
    location_id int REFERENCES locations(id) ON DELETE SET NULL,
    project_id  int REFERENCES projects(id) ON DELETE SET NULL,
    description text NOT NULL,                    -- encrypt at app level if sensitive
    status      varchar(20) NOT NULL DEFAULT 'received',
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE TABLE newsletter_subscribers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       citext UNIQUE NOT NULL,
    lang_code   varchar(5) REFERENCES languages(code),
    is_confirmed boolean NOT NULL DEFAULT false,
    confirm_token varchar(64),
    unsubscribed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Optional donation / volunteer intake
CREATE TABLE volunteer_requests (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name  varchar(150) NOT NULL,
    email      citext NOT NULL,
    phone      varchar(40),
    skills     text,
    location_id int REFERENCES locations(id),
    status     varchar(20) NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 15. SEO, REDIRECTS, ANALYTICS, AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE redirects (                          -- keep old WordPress URLs alive after migration
    id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_path  text UNIQUE NOT NULL,              -- '/?page_id=50', '/activities-2/'
    to_path    text NOT NULL,
    status_code smallint NOT NULL DEFAULT 301,
    hit_count  int NOT NULL DEFAULT 0
);

CREATE TABLE page_views (                         -- lightweight, privacy-friendly analytics (optional)
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_type varchar(30) NOT NULL,             -- post, job, tender, project
    entity_id   text NOT NULL,
    lang_code   varchar(5),
    referrer    text,
    created_at  timestamptz NOT NULL DEFAULT now()
) ;
CREATE INDEX idx_views_entity ON page_views (entity_type, entity_id, created_at);

CREATE TABLE audit_logs (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    action     varchar(50) NOT NULL,              -- create, update, delete, publish, login
    entity_type varchar(50) NOT NULL,
    entity_id  text,
    changes    jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 16. USEFUL VIEWS
-- ---------------------------------------------------------------------
CREATE VIEW v_open_jobs AS
SELECT j.* FROM jobs j WHERE j.status = 'open' AND j.deadline_at > now();

CREATE VIEW v_open_tenders AS
SELECT t.* FROM tenders t WHERE t.status = 'open' AND t.submission_deadline > now();

CREATE VIEW v_published_posts AS
SELECT p.* FROM posts p
WHERE p.status = 'published' AND p.published_at <= now();

-- Auto-compute home-page counters from real data
CREATE VIEW v_live_impact AS
SELECT
  (SELECT count(*) FROM projects WHERE visibility='published')                          AS projects_count,
  (SELECT coalesce(sum(beneficiaries_total),0) FROM projects WHERE visibility='published') AS beneficiaries_count,
  (SELECT count(*) FROM sectors WHERE is_active)                                         AS sectors_count,
  (EXTRACT(year FROM now())::int - 2015)                                                 AS years_experience;

-- ---------------------------------------------------------------------
-- 17. SEED DATA (from the current website)
-- ---------------------------------------------------------------------
INSERT INTO roles (code,name) VALUES
 ('super_admin','Super Admin'),('editor','Content Editor'),
 ('hr','HR Manager'),('procurement','Procurement Officer');

INSERT INTO sectors (code,sort_order) VALUES
 ('child_protection',1),('peace_building',2),('livelihood',3),('wash',4),
 ('gbv',5),('missing_people',6),('protection',7),('mine_action',8),
 ('advocacy_research',9),('education',10),('health',11),('emergency',12);

INSERT INTO sector_translations (sector_id,lang_code,slug,name)
SELECT s.id,'en',replace(s.code,'_','-'),v.name
FROM sectors s JOIN (VALUES
 ('child_protection','Child Protection'),('peace_building','Peace Building'),
 ('livelihood','Livelihood'),('wash','WASH'),('gbv','GBV'),
 ('missing_people','Missing People'),('protection','Protection'),
 ('mine_action','Mine Action'),('advocacy_research','Advocacy and Research'),
 ('education','Education'),('health','Health'),('emergency','Emergency')
) AS v(code,name) ON v.code = s.code;

INSERT INTO post_categories (code,sort_order) VALUES ('activities',1),('success_stories',2);

INSERT INTO social_links (platform,url,sort_order) VALUES
 ('facebook','https://www.facebook.com/salam.sy.org',1),
 ('linkedin','https://www.linkedin.com/company/salam-sy-org/',2),
 ('youtube','https://youtube.com/@salamforhope',3),
 ('instagram','https://www.instagram.com/salamforhope/',4),
 ('tiktok','https://www.tiktok.com/@salamforhope',5);

INSERT INTO menus (location) VALUES ('header'),('footer');

INSERT INTO impact_stats (key,value,suffix,sort_order) VALUES
 ('years_experience',10,'+',1),('projects',0,'+',2),
 ('beneficiaries',0,'k+',3),('sectors',12,'+',4);

INSERT INTO core_values (sort_order) VALUES (1),(2),(3),(4),(5);
INSERT INTO core_value_translations (value_id,lang_code,title)
SELECT id,'en',t FROM core_values
JOIN (VALUES (1,'Independence'),(2,'Accountability'),(3,'Non-discrimination'),
             (4,'Integrity and Transparency'),(5,'Participation')) v(i,t) ON v.i = core_values.id;

INSERT INTO timeline_events (year,sort_order) VALUES (2015,1),(2023,2),(2025,3);
INSERT INTO timeline_event_translations (event_id,lang_code,title)
SELECT id,'en',t FROM timeline_events
JOIN (VALUES (2015,'Founded as the Peace and Civil Society Center'),
             (2023,'Re-branded as the Salam Organization'),
             (2025,'Licensed as Salam For Hope Foundation in Damascus')) v(y,t) ON v.y = timeline_events.year;

INSERT INTO offices (type,sort_order) VALUES
 ('head_office',1),('field_office',2),('field_office',3),('mobile_team',4),('mobile_team',5);
INSERT INTO office_translations (office_id,lang_code,name)
SELECT o.id,'en',v.n FROM offices o
JOIN (VALUES (1,'Al-Hasakah (Main Office)'),(2,'Raqqa'),(3,'Deir Ezzor'),
             (4,'Damascus (Mobile Team)'),(5,'Latakia (Mobile Team)')) v(i,n) ON v.i = o.id;
