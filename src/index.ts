import { resolve } from 'path'
import type { Module } from '@nuxt/types'
import type { CloudConfig } from '@cld-apis/types'
import defu from 'defu'
import chalk from 'chalk'
import { logger } from './utilties/logger'
import { ServerApi } from './runtime/server'
import type { ClientApi } from './runtime/client'

type Exclude<T, U> = T extends U ? never : T

type RequireOne<T, K extends keyof T> = {
  [X in Exclude<keyof T, K>]?: T[X]
} & {
  [P in K]-?: T[P]
}

export interface ModuleOptions extends RequireOne<CloudConfig, 'cloudName'>{
  useComponent?: boolean
}

function cloudinaryModule (moduleOptions): Module<ModuleOptions> {
  const privateCdn = this.options.cloudinary.privateCDN || (moduleOptions as any).privateCDN || false
  const options = defu<ModuleOptions>(this.options.cloudinary, moduleOptions, { privateCdn })

  if (!options.cloudName) {
    logger.error(`You need to provide ${chalk.yellow('cloudName')} to set up Cloudinary. See 👉 https://cloudinary.com/documentation/how_to_integrate_cloudinary for more info.`)
    return
  }

  if (options.secure === undefined) {
    options.secure = true
  }

  const build = this.nuxt.options.build
  const extend = build.extend ? build.extend : () => {}

  build.extend = (config, ctx) => {
    if (ctx.isClient) {
      config.node = {
        fs: 'empty'
      }
    }

    extend(config, ctx)
  }

  const $cloudinary = new ServerApi(options)

  // Transpile and alias runtime
  const runtimeDir = resolve(__dirname, 'runtime')
  this.nuxt.options.alias['~cloudinary'] = runtimeDir
  this.nuxt.options.build.transpile.push(runtimeDir, '@nuxtjs/cloudinary')

  // Add server plugin
  this.addPlugin({
    src: resolve(__dirname, './runtime/plugin.server.js'),
    fileName: 'cloudinary/plugin.server.js',
    options
  })

  // Add client plugin
  this.addPlugin({
    src: resolve(__dirname, './runtime/plugin.client.js'),
    fileName: 'cloudinary/plugin.client.js',
    options
  })

  if (!options.apiKey || !options.apiSecret) {
    logger.warn(`${chalk.yellow('apiKey')} and ${chalk.yellow('apiSecret')} will be needed to set up upload to Cloudinary on build and hook. See 👉 https://cloudinary.com/documentation/how_to_integrate_cloudinary for more info.`)
  }

  module.exports.$cloudinary = $cloudinary
}

;(cloudinaryModule as any).meta = require('../package.json')

declare module '@nuxt/types' {
  interface NuxtConfig { cloudinary?: ModuleOptions } // Nuxt 2.14+
  interface Configuration { cloudinary?: ModuleOptions } // Nuxt 2.9 - 2.13
  interface Context {
    $cloudinary: ServerApi
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $cloudinary: ClientApi
  }
}

export type { ImageApi, VideoApi, VideoThumbnail } from './runtime/api'

export type { CloudinaryApi } from './runtime/api'

export type { ClientApi, ServerApi }

export default cloudinaryModule
