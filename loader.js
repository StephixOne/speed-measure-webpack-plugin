/**
 * speed-measure-plugin配套的loader
 * 会自动加在所有loader列表前面
 * 它会hack require方法，如果require某一个loader，会给loader加上时间记录的逻辑
 */
const path = require("path");
const fs = require("fs");
const { hackWrapLoaders } = require("./utils");

let id = 0;

const NS = path.dirname(fs.realpathSync(__filename));

const getLoaderName = (path) => {
  const standardPath = path.replace(/\\/g, "/");
  const nodeModuleName = /\/node_modules\/([^\/]+)/.exec(standardPath);
  return (nodeModuleName && nodeModuleName[1]) || "";
};

module.exports.pitch = function () {
  const callback = this[NS];
  const module = this.resourcePath;
  const loaderPaths = this.loaders
    .map((l) => l.path)
    .filter((l) => !l.includes("speed-measure-webpack-plugin"));

  // hack require方法，用于修改loader代码内容
  // Hack ourselves to overwrite the `require` method so we can override the
  // loadLoaders
  hackWrapLoaders(loaderPaths, (loader, path) => {
    const loaderName = getLoaderName(path);
    const wrapFunc = (func) =>
      function () {
        const loaderId = id++;
        const almostThis = Object.assign({}, this, {
          async: function () {
            const asyncCallback = this.async.apply(this, arguments);

            return function () {
              callback({
                id: loaderId,
                type: "end",
              });
              return asyncCallback.apply(this, arguments);
            };
          }.bind(this),
        });
        // 统计loader开始转化时间 
        callback({
          module,
          loaderName,
          id: loaderId,
          type: "start",
        });
        const ret = func.apply(almostThis, arguments);
        callback({
          id: loaderId,
          type: "end",
        });
        return ret;
      };

    if (loader.normal) loader.normal = wrapFunc(loader.normal);
    if (loader.default) loader.default = wrapFunc(loader.default);
    if (loader.pitch) loader.pitch = wrapFunc(loader.pitch);
    if (typeof loader === "function") return wrapFunc(loader);
    return loader;
  });
};
