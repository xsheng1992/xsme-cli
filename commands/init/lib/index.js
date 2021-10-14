'use strict';

const fs = require('fs')
const path = require("path");
const inquirer = require('inquirer')
const fse = require('fs-extra')
const glob = require('glob')
const ejs = require('ejs')
const semver = require('semver')
const userHome = require('user-home')

const Command = require('@xsme-cli/command')
const log = require('@xsme-cli/log')
const { spinnerStart, sleep, execAsync } = require('@xsme-cli/utils')

const getProjectTemplate = require('./getProjectTemplate')
const Package = require("@xsme-cli/package");

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

const WHITE_COMMAND = ['npm', 'cnpm', 'yarn']

class InitCommand extends Command {
  init () {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd.force
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  async exec () {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare()
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo)
        this.projectInfo = projectInfo
        await this.downloadTemplate()
        // 3. 安装模板
        await this.installTemplate()
      }
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }

  async installTemplate () {
    log.verbose('templateInfo', this.templateInfo)
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        await this.installNormalTemplate()
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        await this.installCustomTemplate()
      } else {
        throw new Error('项目模版类型无法识别！')
      }
    } else {
      throw new Error('项目模版信息不存在！')
    }
  }

  checkCommand (cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd
    }
    return null
  }

  async execCommand (command, errorMsg) {
    let commandRet
    if (command) {
      const cmdArray = command.split(' ')
      const cmd = this.checkCommand(cmdArray[0])
      if (!cmd) {
        throw new Error('命令不存在！命令：' + command)
      }
      const args = cmdArray.slice(1)
      try {
        commandRet = await execAsync(cmd, args, {
          cwd: process.cwd(),
          stdio: 'inherit'
        })
      } catch (e) {
        throw e
      }
    }
    // 判断结果
    if (commandRet !== 0) {
      throw new Error(errorMsg)
    }
    return commandRet
  }

  async ejsRender (options) {
    const dir = process.cwd()
    return new Promise((resolve, reject) => {
      glob('**', {
        cwd: dir,
        ignore: options.ignore || '',
        nodir: true
      }, (err, files) => {
        if (err) reject(err)
        Promise.all(files.map(file => {
          const filePath = path.join(dir, file)
          return new Promise(((resolve1, reject1) => {
            ejs.renderFile(filePath, this.projectInfo, {}, (err, result) => {
              if (err) {
                reject1(err)
              } else {
                fse.writeFileSync(filePath, result)
                resolve1(result)
              }
            })
          }))
        }))
          .then(() => resolve())
          .catch(err => reject(err))
      })
    })
  }

  async installNormalTemplate () {
    log.verbose('templateNpm', this.templateNpm)
    let spinner = spinnerStart('正在安装模版...')
    await sleep()
    try {
      // 拷贝模版代码至当前目录
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
      const targetPath = process.cwd()
      fse.ensureDirSync(templatePath)
      fse.ensureDirSync(targetPath)
      fse.copySync(templatePath, targetPath)
    } catch (e) {
      throw e
    } finally {
      spinner.stop(true)
      log.success('模版安装成功')
    }

    // ejs渲染
    const templateIgnore = this.templateInfo.ignore || []
    const ignore = ['**/node_modules/**', ...templateIgnore]
    await this.ejsRender({ ignore })

    // 依赖安装
    const { installCommand, startCommand } = this.templateInfo
    await this.execCommand(installCommand, '依赖安装过程失败')
    // 启动命令执行
    await this.execCommand(startCommand, '项目启动过程失败')
  }

  async installCustomTemplate () {
    // 查询自定义模版的入口文件
    if (await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath()
      if (fs.existsSync(rootFile)) {
        log.notice('开始执行自定义模版')
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd()
        }
        const code = `require('${rootFile}')(${JSON.stringify(options)})`
        log.verbose('code', code)
        await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() })
        log.success('自定义模版安装成功')
      } else {
        throw new Error('自定义模版入口文件不存在！')
      }
    }
  }

  async downloadTemplate () {
    // 1. 通过项目模版API获取项目模版信息
    // 1.1 通过egg.js搭建一套后端系统
    // 1.2 通过npm存储项目模版
    // 1.3 将项目模版信息存储到mongdb数据库中
    // 1/4 通过egg.js获取mongdb中的数据并且通过API返回
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    log.verbose('templateInfo', templateInfo)
    const targetPath = path.resolve(userHome, '.xsme-cli', 'template')
    const storeDir = path.resolve(userHome, '.xsme-cli', 'template', 'node_modules')
    this.templateInfo = templateInfo
    const { npmName, version } = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })

    if (await templateNpm.exists()) {
      const spinner = spinnerStart('正在更新模版...')
      await sleep()
      try {
        // 更新package
        await templateNpm.update()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('模版更新成功')
          this.templateNpm = templateNpm
        }
      }
    } else {
      const spinner = spinnerStart('正在下载模版...')
      await sleep()
      try {
        // 安装package
        await templateNpm.install()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('模版下载成功')
          this.templateNpm = templateNpm
        }
      }
    }
  }

  // 准备阶段
  async prepare () {
    // 0. 判断项目模版是否存在
    const template = await getProjectTemplate()
    if (!template || template.length === 0) {
      throw new Error('项目模版不存在')
    }
    this.template = template
    // 1. 判断当前目录是否为空
    const localPath = process.cwd()
    if (!this.isDirEmpty(localPath)) {
      let ifContinue =  false
      if (!this.force) {
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？'
        })).ifContinue
        // 不再执行
        if (!ifContinue) return false
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？'
        })
        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath)
        }
      }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo () {
    function isValidName (v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
    }
    let projectInfo = {}
    let isProjectNameValid = false
    if (isValidName(this.projectName)) {
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }
    // 1. 选择项目或组件模板
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [{
        name: '项目',
        value: TYPE_PROJECT
      }, {
        name: '组件',
        value: TYPE_COMPONENT
      }]
    })
    log.verbose('type', type)
    const title = type === TYPE_PROJECT ? '项目' : '组件'
    this.template = this.template.filter(template => template.tag.includes(type))
    // 2. 获取信息流程封装
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        const done = this.async()
        setTimeout(function () {
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称:\n   1.首字符必须为英文字符\n   2.尾字符必须为英文或数字，不能为字符\n   3。字符仅允许"-_"`)
            return false
          }
          done(null, true)
        }, 0)
      },
      filter: function (v) {
        return v
      }
    }
    let projectPrompt = []
    if (!isProjectNameValid) {
      projectPrompt.push(projectNamePrompt)
    }
    projectPrompt = projectPrompt.concat([{
      type: 'input',
      name: 'projectVersion',
      message: `请输入${title}版本号`,
      default: '1.0.0',
      validate: function (v) {
        const done = this.async()
        setTimeout(function () {
          if (!semver.valid(v)) {
            done(`请输入合法的${title}版本号`)
            return false
          }
          done(null, true)
        }, 0)
      },
      filter: function (v) {
        return semver.valid(v) || v
      }
    }, {
      type: 'list',
      name: 'projectTemplate',
      message: `请选择${title}模版`,
      choices: this.createTemplateChioces()
    }])
    if (type === TYPE_PROJECT) {
      // 3.1 获取项目的基本信息
      const project = await inquirer.prompt(projectPrompt)
      projectInfo = {
        type,
        ...projectInfo,
        ...project
      }
    } else if (type === TYPE_COMPONENT) {
      // 增加描述
      const descriptionPropmt = {
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate: function (v) {
          const done = this.async()
          setTimeout(function () {
            if (!v) {
              done('请输入组件描述')
              return false
            }
            done(null, true)
          }, 0)
        }
      }
      projectPrompt.push(descriptionPropmt)
      // 3.2 获取组件信息
      const component = await inquirer.prompt(projectPrompt)
      projectInfo = {
        type,
        ...projectInfo,
        ...component
      }
    }
    // 3. 返回项目基本信息
    // 生成classname
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '')
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription
    }
    return projectInfo
  }

  createTemplateChioces () {
    return this.template.map(template => ({
      name: template.name,
      value: template.npmName
    }))
  }

  isDirEmpty (localPath) {
    let fileList = fs.readdirSync(localPath)
    // 对一些文件进行过滤
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) === -1
    ))
    return !fileList || fileList.length <= 0
  }
}

function init (argv) {
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand
