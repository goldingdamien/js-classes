const {
  Utility
} = require('js-functions')
const ObjectTraverser = require('object-traverser')

/**
 * @typedef {Object} Wrap
 * @property {string|null} preparationName
 * @property {boolean} preparing
 * @property {boolean} executingWrappedFunction
 * @property {function[]} wrapped
 */

/**
 * @typedef {Function} WrapperFunction
 * @property {WrapStatus} __wrapStatus
 * @property {boolean} __wrapped
 */

/**
 * @typedef {Object} WrapStatus
 * @property {*} status
 * @property {*} old
 * @property {*[]} references
 */

/**
 * @typedef {Object} CommonEventData
 * @property {(function():void)|null} event
 * @property {string} logTitle
 * @property {string} name
 * @property {*} data
 * @property {*} options
 */

/**
 * Dependencies: utility.js
 * Function wrapping functions.
 * FunctionWrapper functions not allowed to be wrapped.
 * Any function from FunctionWrapper should not be stack traced.
 */
var FunctionWrapper = function () {
  var wrapper = {}
  wrapper.settings = {
    events: {
      start: 'onStart',
      complete: 'onComplete'
    }
  }
  wrapper.status = {
    /**
     * @type {StackTraceData[]}
     */
    stackTrace: [],
    /**
     * @type {Wrap}
     */
    wrap: {
      preparationName: null,
      preparing: false,
      executingWrappedFunction: false,
      wrapped: []
    },
    disableStackTrace: false // Only during special functions
  }

  /**
     * @typedef {Object} WrapperOptions
     * @property {Object<string, string|null>} events
     * @property {boolean} log
     * @property {boolean} logPossiblyBadOnly
     * @property {boolean} wrapFunctionArguments
     * @property {boolean} wrapReturnFunctions
     * @property {boolean} allowMultipleWrap
     * @property {boolean} stackTrace
     */

  /**
   * @param {Partial<WrapperOptions>} options
     * @return {WrapperOptions}
     */
  wrapper.wrapperOptions = function (options = {}) {
    return Object.assign({
      events: {
        start: null,
        complete: null,
        check: null
      },
      log: false,
      logPossiblyBadOnly: true,
      wrapFunctionArguments: false,
      wrapReturnFunctions: false,
      allowMultipleWrap: false,
      stackTrace: false
    }, options)
  }

  /**
     * @typedef {object} FunctionData
     * @property {function|null} function
     * @property {Array} arguments
     * @property {*} return
     * @property {boolean} returned
     */

  /**
     * @return {FunctionData}
     */
  wrapper.functionData = function () {
    return {
      function: null,
      arguments: [],
      return: null,
      returned: false
    }
  }

  /**
     * @typedef {object} StackTraceData
     * @property {*} caller
     * @property {string|null} callerName
     * @property {string|null} name
     * @property {(function():void)|null} function
     * @property {number|null} time
     */

  /**
     * All info is non-wrap function info.
     * @return {StackTraceData}
     */
  wrapper.stackTraceData = function () {
    return {
      caller: null,
      callerName: null,
      name: null,
      function: null,
      time: null
    }
  }

  /**
     * @return {{parent: HTMLElement|null, key: string|null}}
     */
  wrapper.Reference = function () {
    return {
      parent: null,
      key: null
    }
  }

  /**
     * @return {WrapStatus}
     */
  wrapper.WrapStatus = function () {
    return {

      // Common
      status: null,

      // This function
      old: null,

      // This object(Multiple possible. For unwrapping.)
      references: []
    }
  }

  wrapper.setup = function () {
    //
  }

  /**
     * @param {function} func
     * @param {function|undefined} before
     * @param {function|undefined} after
     * @return {*}
     */
  wrapper.simpleWrapFunction = function (func, before = undefined, after = undefined) {
    // Do not wrap this function

    return function () {
      if (before) {
        before(arguments)
      }
      var returnData = func.apply(this, arguments)
      if (after) {
        after(arguments)
      }

      return returnData
    }
  }

  /**
     * @param {string} name
     * @param {boolean} inPreparation
     * @return {boolean}
     */
  wrapper.handlePreparation = function (name, inPreparation) {
    // No name
    if (!name) {
      return false
    }

    // Wrong name
    if (
      wrapper.status.wrap.preparationName &&
      wrapper.status.wrap.preparationName !== name
    ) {
      return false
    }

    if (inPreparation) { // Start
      wrapper.status.wrap.preparationName = name
      wrapper.status.wrap.preparing = true
    } else { // End
      wrapper.status.wrap.preparationName = null
      wrapper.status.wrap.preparing = false
    }

    return true
  }

  /**
     * @param {WrapperFunction} wrapperFunction
     * @param {function} func
     */
  wrapper.setupWrapStatus = function (wrapperFunction, func) {
    // Create new
    if (!wrapperFunction.__wrapStatus) {
      wrapperFunction.__wrapped = true

      wrapperFunction.__wrapStatus = wrapper.WrapStatus()
      wrapperFunction.__wrapStatus.status = wrapper.status.wrap
      wrapperFunction.__wrapStatus.old = func

      wrapper.status.wrap.wrapped.push(wrapperFunction)
    }
  }

  /**
     * @param {function} wrapperFunction
     * @param {object} reference
     */
  wrapper.handleWrapReference = function (wrapperFunction, reference) {
    // Add reference
    if (reference) {
      wrapperFunction.__wrapStatus.references.push(reference)
    }

    // Auto-set
    if (reference && reference.parent && reference.key !== undefined) {
      reference.parent[reference.key] = wrapperFunction
    }
  }

  /**
     * @public
     * @param {function} func
     * @param {object} reference
     * @param {Partial<WrapperOptions>|undefined} wrapperOptions
     * @return {function}
     */
  wrapper.wrapFunction = function (func, reference, wrapperOptions = {}) {
    /*
        Wraps function with ability to handle arguments and return values.
        parent and key should be passed to reference to be able to unwrap.
        Setting to existing function automatically done if reference.parent + reference.key is parent.
        Already wrapped must not be wrapped, but must be set to object key.
        */

    /**
     * @type {function}
     */
    var wrapperFunction = false

    const options = wrapper.wrapperOptions(wrapperOptions)

    // Not allowed
    if (wrapper.isWrapForbidden(func)) {
      return false
    }

    if (wrapper.isWrapped(func) && !options.allowMultipleWrap) { // Already wrapped handling
      wrapperFunction = func
    } else { // Wrap
      wrapperFunction = wrapper.createWrapFunction(func, options)
    }

    // Reference
    wrapper.handleWrapReference(wrapperFunction, reference)

    return wrapperFunction
  }

  /**
     * @param {function} func
     * @param {object} options
     * @return {function}
     */
  wrapper.createWrapFunction = function (func, options) {
    /*
        func = old function
        wrapperFunction = wrapping function
        */
    var wrapperFunction = function () {
      // TODO: bug: loopObject has no func.__wrapStatus. Why?
      if (func.name === 'loopObject' || !wrapperFunction.__wrapStatus) {
        /*
                console.log(func.name)
                console.log(wrapperFunction.__wrapStatus)
                */
      }

      var ignoreWrap = false
      var ignoreStackTrace = false
      ignoreWrap = (!!wrapperFunction.__wrapStatus.status.executingWrappedFunction) // TODO: This is preventing nested functions from being stackTraced.

      if (!ignoreStackTrace) {
        if (options.stackTrace && !wrapper.status.disableStackTrace && !wrapper.status.wrap.preparing) {
          wrapper.stackTrace(func)
        } else {
          //
        }
      }

      if (!ignoreWrap) {
        console.log('not ignored', func.name)
        wrapper.status.wrap.executingWrappedFunction = true

        // Arguments wrap
        if (options.wrapFunctionArguments) {
          wrapper.wrapObjectFunctions(arguments)
        }

        var startData = wrapper.getFunctionData(func, arguments)
        wrapper.handleEvent('start', [startData, options])
      }

      var returnVal = func.apply(this, arguments)

      if (!ignoreWrap) {
        var completeData = wrapper.getFunctionData(func, arguments, returnVal)
        wrapper.handleEvent('complete', [completeData, options])

        // Return wrap
        if (options.wrapReturnFunctions) {
          returnVal = wrapper.attemptWrapFunction(returnVal, null, options) // Return function can not have object/key because unknown.
        }

        wrapper.status.wrap.executingWrappedFunction = false
      }

      return returnVal
    }

    // Status
    wrapper.setupWrapStatus(wrapperFunction, func)

    return wrapperFunction
  }

  /**
     * @public
     * @param {Array} funcs
     * @param {function} callback
     * @param {object} obj
     * @return {false|undefined}
     */
  wrapper.stackTraceFunctionCombinations = function (funcs, callback, obj) {
    /*
        Goal: Get every possible function that is executed in functions.
        This requires handling every function which may require varying arguments.
        */

    /*
        Example:
        var alertSomething = function(type){
         var something;
         if(type === 1){
          something = "hello";
         }else{
          something = "bye";
         }
         alert(something);
        }

        var funcs = [
          function(callback){
           alertSomething(1);
           callback();
          },
          function(callback){
           alertSomething();
           callback();
          };
        ]

        wrapper.stackTraceFunctionCombinations(funcs, callback);
        */

    // Setup
    /**
     * @type {StackTraceData[]}
     */
    const stackTraces = []
    const index = 0
    const cur = funcs[0]

    // No data
    if (!cur) {
      callback([])
      return false
    }

    // Handle
    var handle = function () {
      wrapper.stackTraceFunction(cur, function (stackTrace) {
        stackTraces.push(stackTrace)

        index++
        cur = funcs[index]

        if (cur) {
          handle()
        } else {
          callback(stackTraces)
        }
      }, obj)
    }

    // Start
    handle()
  }

  /**
     * @param {function} func
     * @param {function} returnHandle
     * @param {object} obj
     * @return {function}
     */
  wrapper.stackTraceFunction = function (func, returnHandle, obj) {
    /*
        func: Function taking a callback argument to execute on complete
        returnHandle: Execute on end
        obj: Optional object for the scope to watch. Use if possible because default is global window which can be slow.

        Example:
        var alertSomething = function(){
         var something = "Hello";
         alert(something);
        }

        var func = function(callback){ // onComplete
         alertSomething();
         callback();
        }

        wrapper.stackTraceFunction(func, callback);
        */

    wrapper.startStackTrace(obj)
    var onComplete = function () {
      var stackTrace = wrapper.stopStackTrace()
      // Omit func
      stackTrace.shift()

      returnHandle(stackTrace)
    }
    func(onComplete)

    return onComplete
  }

  /**
     * @param {Object<string, *>} obj
     */
  wrapper.startStackTrace = function (obj) {
    /*
        Goal: Handle all function calls and record stack trace.
        Problems: Overriding .call doesn't seem to work because only works when explicitly using .call.
        Fix: Wrapping each function should fix most cases.
        */

    wrapper.handlePreparation('stacktrace', true)

    // Allow overriding object to start wrapping from(Ex: Class/modules)
    if (!obj) {
      obj = window
    }

    wrapper.status.stackTrace = []

    /**
     * @type {Partial<WrapperOptions>}
     */
    const options = {
      stackTrace: true,
      wrapFunctionArguments: true,
      wrapReturnFunctions: true
    }

    wrapper.deepWrapObjectFunctions(obj, options)

    wrapper.handlePreparation('stacktrace', false)
  }

  /**
     * TODO
     */
  wrapper.stopStackTrace = function () {
    wrapper.unwrapFunctions()
    return wrapper.status.stackTrace
  }

  /**
     * @public
     */
  wrapper.unwrapFunctions = function () {
    // console.log('unwrap') // TODO
    var wrapped = wrapper.status.wrap.wrapped
    for (var i = 0; i < wrapped.length; i++) {
      wrapper.unwrapFunction(wrapped[i])
    }

    wrapper.status.wrap.wrapped = []
  }

  /**
     * @public
     * @param {function} wrapperFunction
     */
  wrapper.unwrapFunction = function (wrapperFunction) {
    // TODO: Bug, should always have __wrapStatus
    if (!wrapperFunction.__wrapStatus) {
      console.log('has no __wrapStatus: ', wrapperFunction)
    }

    //
    if (wrapperFunction.__wrapStatus && wrapperFunction.__wrapStatus.references) {
      for (var i = 0; i < wrapperFunction.__wrapStatus.references.length; i++) {
        wrapperFunction.__wrapStatus.references[i].parent[wrapperFunction.__wrapStatus.references[i].key] = wrapperFunction.__wrapStatus.old
      }
      wrapperFunction.__wrapStatus.references = []
    }

    // Delete metadata
    delete wrapperFunction.__wrapped
    delete wrapperFunction.__wrapStatus
  }

  /**
     * @param {function} func
     * @return {object}
     */
  wrapper.stackTrace = function (func) {
    var trace = wrapper.stackTraceData()

    trace.caller = func.caller
    trace.callerName = ((func.caller) ? func.caller.name : null)
    trace.name = func.name
    trace.function = func
    trace.time = window.performance.now()

    // Add
    wrapper.status.stackTrace.push(trace)

    return trace
  }

  /**
     * @param {{options: WrapperOptions, data: *}} obj
     * @return {boolean}
     */
  wrapper.isBad = function (obj) {
    if (obj.options.events.check) {
      return !obj.options.events.check(obj.data)
    } else {
      return wrapper.isPossibleBad(obj.data)
    }
  }

  /**
     * @param {FunctionData} funcData
     * @return {boolean}
     */
  wrapper.isPossibleBad = function (funcData) {
    // Default check. Doesn't need to be 100% accurate. Main goal is to filter out functions unlikely to be bad to reduce logs.

    if (funcData.arguments.length === 0) {
      return true
    }

    if ((funcData.returned && funcData.return === null) || funcData.return === undefined) {
      return true
    }

    return false
  }

  /**
     * @param {string} eventType
     * @param {Array} args
     * @return {*}
     */
  wrapper.handleEvent = function (eventType, args = []) {
    var key = wrapper.settings.events[eventType]
    return wrapper[key].apply(this, args)
  }

  /**
     * @param {object} obj
     * @param {object} options
     */
  wrapper.wrapObjectFunctions = function (obj, options) {
    for (var key in obj) {
      wrapper.attemptWrapObjectFunction(obj, key, options)
    }
  }

  /**
     * @param {Object<string, *>} parentObj
     * @param {Partial<WrapperOptions>} options
     */
  wrapper.deepWrapObjectFunctions = function (parentObj, options) {
    ObjectTraverser.loopObject(parentObj, function (obj, key /*, val */) {
      wrapper.attemptWrapObjectFunction(obj, key, options)

      return obj[key]
    })
  }

  /**
     * @param {Object<string, *>} obj
     * @param {string} key
     * @param {Partial<WrapperOptions>} options
     */
  wrapper.attemptWrapObjectFunction = function (obj, key, options) {
    return wrapper.attemptWrapFunction(obj[key], {
      parent: obj,
      key: key
    }, options)
  }

  /**
     * @param {*} data
     * @param {*} reference
     * @param {Partial<WrapperOptions>} options
     * @return {*}
     */
  wrapper.attemptWrapFunction = function (data, reference, options) {
    /*
        Returns original data on failure for easy setting.
        However, this can not be used for everywhere due to problems like resetting location leading to page reload.
        */

    if (
      typeof data === 'function' &&
      !wrapper.isWrapperFunction(data)
    ) {
      var func = data
      var wrappedFunction = wrapper.wrapFunction(func, reference, options)
      if (wrappedFunction) {
        data = wrappedFunction
      }
    }

    return data
  }

  /**
     * @param {*} data
     * @return {boolean}
     */
  wrapper.isWrapperFunction = function (data) {
    if (typeof data !== 'function') {
      return false
    }

    for (var key in wrapper) {
      if (wrapper[key] === data) {
        return true
      }
    }

    return false
  }

  /**
     * @param {function} func
     * @return {boolean}
     */
  wrapper.isWrapForbidden = function (func) {
    // Disallow this class so doesn't stackTrace
    if (func === FunctionWrapper) {
      return true
    }

    // Disallow special functions used in wrapper function
    if (func === Utility.isLogFunction) {
      return true
    }

    // Disallow all forms of logging by default
    if (Utility.isLogFunction(func)) {
      return true
    }

    return false
  }

  /**
     * @param {WrapperFunction} func
     * @return {boolean}
     */
  wrapper.isWrapped = function (func) {
    return !!func.__wrapped
  }

  /**
     * @param {function} func
     * @param {*[]} args
     * @param {*} returnVal
     * @return {*}
     */
  wrapper.getFunctionData = function (func, args, returnVal = undefined) {
    var data = wrapper.functionData()

    /**
     * @param {*[]} args 
     */
    var sortArgs = function (args) {
      args = Array.prototype.slice.call(args)
      return args.sort()
    }

    data.name = func.name
    data.function = func
    data.arguments = sortArgs(args)
    data.return = returnVal

    if (arguments.length === wrapper.getFunctionData.length) {
      data.returned = true
    }

    return data
  }

  /**
     * @param {{options: WrapperOptions, event: string, data: string, logTitle: string}} obj
     * @return {boolean}
     */
  wrapper.handleCommonEvent = function (obj) {
    if (obj.options.events && obj.options.events[obj.event]) {
      obj.options.events[obj.data].apply(this, [obj.data])
    }

    if (obj.options.log) {
      if (obj.options.logPossiblyBadOnly) {
        if (wrapper.isBad(obj)) {
          return false
        }
      }

      // Log
      console.log(obj.logTitle)
      wrapper.logFunction(obj)
    }

    return true
  }

  /**
     * @param {Partial<CommonEventData>} objOptions
     * @param {FunctionData} funcData
     * @param {object} options
     * @return {object}
     */
  wrapper.getCommonEventData = function (objOptions, funcData, options) {
    /**
     * @type {CommonEventData}
     */
    var obj = {
      event: null,
      logTitle: 'Unknown:',
      name: funcData.name,
      data: funcData,
      options: options
    }

    if (objOptions) {
      for (var key in objOptions) {
        obj[key] = objOptions[key]
      }
    }

    return obj
  }

  /**
     * @param {object} funcData
     * @param {object} options
     * @return {boolean}
     */
  wrapper.onStart = function (funcData, options) {
    var obj = wrapper.getCommonEventData({
      event: 'start',
      logTitle: 'Start event:'
    }, funcData, options)
    return wrapper.handleCommonEvent(obj)
  }

  /**
     * @param {FunctionData} funcData
     * @param {object} options
     * @return {boolean}
     */
  wrapper.onComplete = function (funcData, options) {
    var obj = wrapper.getCommonEventData({
      event: 'complete',
      logTitle: 'Complete event:'
    }, funcData, options)
    return wrapper.handleCommonEvent(obj)
  }

  /**
     * @param {object} funcData
     * @return {object}
     */
  wrapper.logFunction = function (funcData) {
    if (window.logObjectOnSingleLine) {
      window.logObjectOnSingleLine(funcData)
    } else {
      console.log(funcData)
    }
  }

  wrapper.setup()

  return wrapper
}

if (typeof window === 'object') {
  window.FunctionWrapper = FunctionWrapper
}
if (typeof module !== 'undefined') {
  module.exports = FunctionWrapper
}
