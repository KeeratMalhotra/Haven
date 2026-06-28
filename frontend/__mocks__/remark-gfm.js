// Jest mock for the ESM-only `remark-gfm` plugin. It is passed to react-markdown
// (itself mocked in tests), so a no-op default export is sufficient.
module.exports = function remarkGfm() {};
module.exports.default = module.exports;
