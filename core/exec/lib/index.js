'use strict';

module.exports = exec;

const path = require('path')

const log = require('@xsme-cli/log')
const Package = require('@xsme-cli/package')

// 1、targetPath -> modulePath
// 2、modulePath -> Package(npm模块)
// 3、Package.getRootFile(获取入口文件)
// 4、Package.update / Package.install

const SETTINGS = {
  init: '@imooc-cli/init'
}

const CACHE_DIR = 'dependencies'

async function exec() {
  const homePath = process.env.CLI_HOME_PATH
  let targetPath = process.env.CLI_TARGET_PATH
  let storeDir = ''
  let pkg
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)

  const cmdObj = arguments[arguments.length - 1]
  const cmdName = cmdObj.name()
  const packageName = SETTINGS[cmdName]
  const packageVersion = 'latest'

  // 如果路径不存在，生成缓存路径
  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR)
    storeDir = path.resolve(targetPath, 'node_modules')
    log.verbose('targetPath', targetPath)
    log.verbose('storeDir', storeDir)

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })

    if (await pkg.exists()) {
      // 更新package
      pkg.update()
    } else {
      // 安装package
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootPath()
  if (rootFile) {
    require(rootFile).apply(null, arguments)
  }
}
