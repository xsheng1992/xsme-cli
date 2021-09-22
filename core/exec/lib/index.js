'use strict';

module.exports = exec;

const log = require('@xsme-cli/log')
const Package = require('@xsme-cli/package')

// 1、targetPath -> modulePath
// 2、modulePath -> Package(npm模块)
// 3、Package.getRootFile(获取入口文件)
// 4、Package.update / Package.install

const SETTINGS = {
    init: '@xsme-cli/init'
}

function exec() {
    const homePath = process.env.CLI_HOME_PATH
    let targetPath = process.env.CLI_TARGET_PATH
    log.verbose('homePath', homePath)
    log.verbose('targetPath', targetPath)

    const cmdObj = arguments[arguments.length - 1]
    const cmdName = cmdObj.name()
    const packageName = SETTINGS[cmdName]
    const packageVersion = 'latest'

    // 如果路径不存在，生成缓存路径
    if (!targetPath) {
        targetPath = ''
    }

    const pkg = new Package({
        targetPath,
        packageName,
        packageVersion
    })
    console.log(pkg.getRootPath())
}
