// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config")
const { resolve } = require("path")
const exclusionList = require("metro-config/private/defaults/exclusionList").default
const pkg = require("../package.json")

const root = resolve(__dirname, "..")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

module.exports = {
  ...config,
  watchFolders: [root, __dirname],
  resolver: {
    ...config.resolver,
    blockList: exclusionList([
      new RegExp(
        `^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/node_modules/${pkg.name}/.*$`,
      ),
    ]),
    extraNodeModules: {
      ...config.resolver.extraNodeModules,
      [pkg.name]: root,
    },
  },
}
