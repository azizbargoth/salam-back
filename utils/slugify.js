/** Unicode-aware slug (keeps Arabic letters, strips diacritics/tatweel). */
module.exports = function slugify(text = '') {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
};
