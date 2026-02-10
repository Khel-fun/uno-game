/**
 * Custom webpack loader that strips `webpackIgnore: true` comments from
 * bb.js browser factory files. This allows webpack to properly process
 * the `new URL('./main.worker.js', import.meta.url)` and
 * `new URL('./thread.worker.js', import.meta.url)` patterns,
 * creating separate worker bundles with resolved dependencies.
 *
 * Without this, webpack copies worker files as raw assets (due to webpackIgnore),
 * but the workers contain bare ESM imports ('comlink', etc.) that browsers can't resolve.
 */
module.exports = function (source) {
  return source.replace(/\/\* webpackIgnore: true \*\/ /g, '');
};
