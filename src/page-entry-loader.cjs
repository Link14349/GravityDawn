// Bundle the actual inline module of a demo; demos contain no duplicated engine.
const path = require('path');
module.exports = function(source) {
  const scripts = [...source.matchAll(/<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g)];
  return scripts.map(m => m[1]).join('\n').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, quote, request) => `from ${JSON.stringify(path.resolve(path.dirname(this.resourcePath), request))}`);
};
