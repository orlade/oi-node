import 'colors'
import registry from './registry'
import * as log from 'winston'
import _ from 'lodash'
import moment from 'moment'
import {reportResult, getAllPublicPropertyNames} from '../utils/util'

/**
 * A module maps a name onto a collection of actions, and registers itself with Oi to list the
 * available actions.
 */
export default class Module {

  /**
   * Creates a new module.
   *
   * @param {{id, command: string, description: string}} options
   */
  constructor(options) {
    if (!options.command) {
      throw("Module must be created with a command");
    }
    var id = options.command;

    log.debug(`Initializing module ${id.cyan} with ${JSON.stringify(options)}...`);
    _.merge(this, options, {id});
    _.defaults(this, {
      name: id,
      command: id,
      describe: this.describe || this.description || `Perform ${id}`,
    });

    if (this.actions) {
      this.builder = this._builder.bind(this);
    } else if (this.handler) {
      log.debug("Decorating handler to be invoked with module hooks...");
      if (this.command in this) {
        throw Error(`Command cannot shadow Module property ${this.command} (for now)`);
      }

      this[this.command] = this.handler;
      this.handler = this._invoke.bind(this, this.command);
    } else {
      const methodNames = _.without(getAllPublicPropertyNames(options), 'command', 'describe');
      if (!methodNames.length) {
        throw Error("No actions, handler or methods to use as subcommands")
      }
      log.debug(`No actions or handler, binding ${methodNames.length} methods as subcommands (${methodNames.join(', ')})...`);
      this.actions = _.zipObject(methodNames, methodNames.map((command) => ({
        command,
        describe: `Performs ${command}`,
        handler: this._invoke.bind(this, command)
      })));
      this.builder = this._builder.bind(this);
    }
  }

  /**
   * Yargs builder function.
   *
   * @param yargs
   * @param {Object[]} actions Optional list of actions. Defaults to this.actions.
   * @private
   */
  _builder(yargs, actions) {
    actions = actions || this.actions;
    log.debug(`Building subcommands ${_.keys(actions).join(', ')}...`);
    _.keys(actions).map(this._buildSubmodule, this).forEach(yargs.command);
    this.handler || yargs.demand(1).strict();
  }

  /**
   * Creates a Module for a subcommand of this module.
   *
   * @param {string} subcommand
   * @private
   */
  _buildSubmodule(subcommand) {
    return new Module(_.merge({command: subcommand}, {parent: this}, this.actions[subcommand]));
  }

  /**
   * Invokes a method with some scaffolding.
   *
   * @param {string} methodName The name of the method on the task runner to invoke.
   * @param {object} argv The command line arguments parsed by yargs, to be applied to the method.
   * @protected
   */
  _invoke(methodName, argv) {
    const [, ...args] = argv._;
    const kwargs = _.pickBy(argv, (p) => p !== '_');
    log.debug(`Invoking ${methodName.magenta} on ${this.id.cyan} with args ${args}, ${JSON.stringify(kwargs)}...`);
    return this.runTask(methodName, args.concat([kwargs]));
  }

  /**
   * Hook that runs before a task method is run when invoked through the runTask method.
   *
   * @param task The name of the task being run.
   * @param args The arguments to be passed to the method.
   */
  beforeTask(task, args) {
    this.startTime = moment();
  }

  /**
   * Runs a task (by method name or function) between the before and after hooks.
   *
   * @param {string|function} task The task to run.
   * @param {?Array.<object>} args The arguments to apply to the task.
   * @returns {object} The result of running the task.
   */
  runTask(task, args) {
    if (this.beforeTask(task, args)) {
      return false;
    }
    log.debug(`Applying task ${task.magenta} to ${this.name.cyan}...`);
    const result = this[task].apply(this, args);
    // TODO(ladeo): Handle async invocation.
    this.afterTask(task, result);
    return result;
  }

  /**
   * Hook that runs after the completion of a task run through the runTask method.
   *
   * @param task The name of the task that just finished running.
   * @param result The output of the completed task.
   * @return {*} Some output object that can be used to determine the success of the task.
   */
  afterTask(task, result) {
    return this._report(task, result);
  }

  /**
   * Logs the result of running a task.
   *
   * @param {string} task The name of the task being run.
   * @param {object} result The result object from <code>shelljs.exec</code>.
   * @protected
   */
  _report(task, result) {
    const time = moment.duration(moment().diff(this.startTime));
    if (this.parent) {
      task = `${this.parent.command} ${task}`;
    }
    reportResult(task, result, time);
    return result;
  }

  /**
   * Registers the module with the singleton registry.
   */
  register() {
    registry.register(this);
  }

}