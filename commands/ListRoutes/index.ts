/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

import { BaseCommand, flags } from '@adonisjs/ace'
import type { RouteNode } from '@ioc:Adonis/Core/Route'

import { RoutesTableRenderer } from './Renderers/TableRenderer'
import { RoutesPrettyRenderer } from './Renderers/PrettyRenderer'

/**
 * Shape of a route serialized by the ListRoute JSON serializer
 */
export type SerializedRoute = {
  domain: string
  name: string
  pattern: string
  handler: string
  methods: string[]
  middleware: string[]
}

/**
 * A command to display a list of routes
 */
export default class ListRoutes extends BaseCommand {
  public static commandName = 'list:routes'
  public static description = 'List application routes'

  @flags.boolean({ name: 'verbose', description: 'Display more information' })
  public verbose: boolean

  @flags.boolean({ alias: 'r', name: 'reverse', description: 'Reverse routes display' })
  public reverse: boolean

  @flags.string({ alias: 'm', name: 'method', description: 'Filter routes by method' })
  public methodFilter: string

  @flags.string({ alias: 'p', name: 'pattern', description: 'Filter routes by the route pattern' })
  public patternFilter: string

  @flags.string({ alias: 'n', name: 'name', description: 'Filter routes by name' })
  public nameFilter: string

  @flags.boolean({ description: 'Output as JSON' })
  public json: boolean

  @flags.boolean({ description: 'Output as Table' })
  public table: boolean

  @flags.number({ description: 'Specify maximum rendering width. Ignored for JSON Output' })
  public maxWidth: number

  /**
   * Load application
   */
  public static settings = {
    loadApp: true,
  }

  /**
   * Returns the display handler name
   */
  private getHandlerName(route: RouteNode) {
    const resolvedHandler = route.meta.resolvedHandler!
    if (resolvedHandler.type === 'function') {
      return 'Closure'
    }

    const defaultControllersNamespace = this.application.namespacesMap.get('httpControllers')

    return `${resolvedHandler.namespace.replace(
      new RegExp(`^${defaultControllersNamespace}\/`),
      ''
    )}.${resolvedHandler.method}`
  }

  /**
   * Apply the method filter on the route
   */
  private hasPassedMethodFilter(route: SerializedRoute): boolean {
    return this.methodFilter ? route.methods.includes(this.methodFilter.toUpperCase()) : true
  }

  /**
   * Apply the pattern filter on the route
   */
  private hasPassedPatternFilter(route: SerializedRoute): boolean {
    return this.patternFilter ? route.pattern.includes(this.patternFilter) : true
  }

  /**
   * Apply the name filter on the route
   */
  private hasPassedNameFilter(route: SerializedRoute): boolean {
    return this.nameFilter ? route.name.includes(this.nameFilter) : true
  }

  /**
   * Log message
   */
  private log(message: string) {
    if (this.application.environment === 'test') {
      this.logger.log(message)
    } else {
      console.log(message)
    }
  }

  /**
   * Serialize route to JSON
   */
  public serializeRoute(route: RouteNode & { methods: string[] }, domain: string) {
    return {
      domain,
      name: route.name || '',
      pattern: route.pattern,
      methods: route.methods,
      handler: this.getHandlerName(route),
      middleware: route.middleware.map((one) => (typeof one === 'function' ? 'Closure' : one)),
    }
  }

  /**
   * Returns an array of routes as JSON, filtered according to the
   * flags passed to the command
   */
  public serializeRoutes() {
    const Router = this.application.container.use('Adonis/Core/Route')
    Router.commit()

    const routes = Router.toJSON()
    return Object.keys(routes).reduce<Record<string, SerializedRoute[]>>((result, domain) => {
      const domainRoutes = routes[domain]
        .map((route) => this.serializeRoute(route, domain))
        .filter((route) => {
          return (
            this.hasPassedMethodFilter(route) &&
            this.hasPassedNameFilter(route) &&
            this.hasPassedPatternFilter(route)
          )
        })

      if (this.reverse) {
        domainRoutes.reverse()
      }

      result[domain] = domainRoutes
      return result
    }, {})
  }

  public async run() {
    if (this.json) {
      this.log(JSON.stringify(this.serializeRoutes(), null, 2))
    } else if (this.table) {
      new RoutesTableRenderer(this).render()
    } else {
      new RoutesPrettyRenderer(this).render()
    }
  }
}
