/* Usage: node scripts/create-admin.js admin@salam-sy.org 'StrongPass123' "Full Name" */
require('../config/env');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const User = require('../model/User.model');

(async () => {
  const [email, password, ...nameParts] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.js <email> <password> [full name]");
    process.exit(1);
  }
  await db.query(
    `INSERT INTO roles (code, name) VALUES
       ('super_admin','Super Admin'),('editor','Content Editor'),
       ('hr','HR Manager'),('procurement','Procurement Officer')
     ON CONFLICT (code) DO NOTHING`
  );
  const user = await User.create({
    email: email.toLowerCase(),
    password_hash: await bcrypt.hash(password, 12),
    full_name: nameParts.join(' ') || 'Administrator',
    role_code: 'super_admin',
  });
  console.log(`Super admin created: ${user.email}`);
  await db.pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
