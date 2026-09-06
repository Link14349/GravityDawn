/** Headless access to the same ES modules Webpack uses, without browser stubs. */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const original = require.extensions['.js'];
require.extensions['.js'] = (mod, file) => {
  if (!file.startsWith(__dirname + path.sep)) return original(mod, file);
  mod._compile(babel.transformSync(fs.readFileSync(file,'utf8'), {filename:file,configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
};
module.exports={...require('./level.js'),...require('./flight-simulation.js'),...require('./building.js')};
