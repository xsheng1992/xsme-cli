'use strict';

module.exports = core;

const path = require('path')
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const commander = require('commander')

// commands
const exec = require('@xsme-cli/exec')
const init = require('@xsme-cli/init')

const log = require('@xsme-cli/log')

const pkg = require('../package.json')
const constant = require('./consts')

const program = new commander.Command()

async function core() {
	try {
		await prepare()
		registerCommand()
	} catch (e) {
		log.error(e.message)
	}
}

// 注册指令
function registerCommand () {
	program
		.storeOptionsAsProperties()
		.name(Object.keys(pkg.bin)[0])
		.usage('<command> [options]')
		.version(pkg.version)
		.option('-d --debug', '是否开启调试模式', false)
		.option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

	program
		.command('init [projectName]')
		.option('-f, --force', '是否强制初始化')
		.action(exec)

	// 开启debug模式
	program.on('option:debug', function () {
		const { debug } = this.opts()
		process.env.LOG_LEVEL = debug ? 'verbose' : 'info'
		log.level = process.env.LOG_LEVEL
		log.verbose('test')
	})
	
	// 指定targetPath
	program.on('option:targetPath', function () {
		const { targetPath } = program.opts()
		process.env.CLI_TARGET_PATH = targetPath
	})

	// 对未知命令的监听
	program.on('command:*', function (obj) {
		const availableCommands = program.commands.map(cmd => cmd.name())
		log.error(colors.red('未知的命令：' + obj[0]))
		if (availableCommands.length > 0) {
			log.wran(colors.red('可用的命令：' +availableCommands.join(',')))
		}
	})

	program.parse(process.argv)

	// 如果没有输入命令，就打印帮助文档
	if (program.args && program.args.length < 1) {
		program.outputHelp()
		console.log()
	}
}

// 准备阶段
async function prepare () {
	checkPkgVersion() // 检查脚手架版本
	checkNodeVersion() // 检查node版本
	checkRoot() // 检查是否权限需要降级
	checkUserHome() // 检查用户主目录
	checkEnv() // 检查环境变量
	await checkGlobalUpdate() // 检查全局更新
}

// 检查是否有更新
async function checkGlobalUpdate () {
	// 1.获取当前版本号和模块名
	const currentVersion = pkg.version
	const currentName = pkg.name
	const { getNpmSemverVersions } = require('@xsme-cli/get-npm-info')
	const latestVersion = await getNpmSemverVersions(currentVersion, currentName)
	if (latestVersion && semver.gt(latestVersion, currentVersion)) {
		log.warn('更新信息', colors.yellow(`请手动更新 ${currentName}，当前版本：${currentVersion}，最新版本：${latestVersion}
		更新命令：npm install -g ${currentName}`))
	}
}

// 检查环境变量
function checkEnv () {
	const dotenv = require('dotenv')
	const dotenvPath = path.resolve(userHome, '.env')
	if (pathExists(dotenvPath)) {
		dotenv.config({
			path: dotenvPath
		})
	}
	createDefaultConfig()
}

function createDefaultConfig () {
	process.env.CLI_HOME_PATH = path.join(userHome, constant.DEFAULT_CLI_HOME)
}

// 检查用户运行主目录
function checkUserHome () {
	if (!userHome || !pathExists(userHome)) {
		throw new Error(colors.red('当前登录用户主目录不存在'))
	}
}

// 检查是否是root用户
function checkRoot () {
	const rootCheck = require('root-check')
	rootCheck()
}

// 检查当前node版本号
function checkNodeVersion() {
	const currentVersion = process.version
	const lowestVersion = constant.LOWEST_NODE_VERSION

	if (!semver.gte(currentVersion, lowestVersion)) {
		throw new Error(colors.red(`xsme-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`))
	}
}

// 检查当前版本号
function checkPkgVersion() {
	log.notice('当前 xsme-cli 版本号为 ', pkg.version)
}
