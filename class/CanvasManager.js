/**
 * @typedef {object} SimpleDOMRect
 * @property {number} top
 * @property {number} bottom
 * @property {number} left
 * @property {number} right
 */

/**
 * @typedef {object} CanvasRendererObject
 * @property {function|null} renderable
 * @property {HTMLCanvasElement|null} canvas
 * @property {CanvasRenderingContext2D|null} context
 * @property {number} rate
 * @property {number|null} interval
 * @property {boolean} muted
 */

/**
 * @typedef {HTMLCanvasElement & {_context: CanvasRenderingContext2D|null|undefined}} CachedHTMLCanvasElement
 */

/**
 * @typedef {Object} CanvasImageOptions
 * @property {string} format
 * @property {'data_url'|'image'} serialization
 * @property {function(...any):any} on_load
 * @property {number|null} conversion_options
 */

/**
 * @typedef {Object} RGBASelection
 * @property {boolean} r
 * @property {boolean} g
 * @property {boolean} b
 * @property {boolean} a
 */

/**
 * @type {CanvasRendererObject}
 */
const defaultCanvasRenderer = {
  renderable: null,
  canvas: null,
  context: null,
  rate: 1000 / 20,
  interval: null,
  muted: false // Allows for keeping rate
}

class CanvasRenderer {
  /**
     * @param {Partial<CanvasRendererObject>} settings
     */
  constructor(settings) {
    Object.assign(this, defaultCanvasRenderer)
    for (var key in settings) {
      this[key] = settings[key]
    }
  }

  /**
     * @return {number}
     */
  start() {
    if (!this.interval) {
      this.interval = window.setInterval(this.render, this.rate)
    }

    return this.interval
  }

  mute() {
    this.muted = true
  }

  unmute() {
    this.muted = false
  }

  stop() {
    if (this.interval) {
      window.clearInterval(this.interval)
      this.interval = null
    }
  }

  /**
     * @return {undefined|false}
     */
  render() {
    if (this.muted) {
      return false
    }

    this.renderable()
  }
}

/**
 * @template T
 * @param {T} value
 */
function failOnFalsy(value) {
  if (!value) {
    throw new Error(`${value} expected to be non-falsy failed check.`)
  }
  return value
}

/**
 * Collection of static canvas functions.
 * TODO: Change to CanvasHelper with static functions, and deprecate CanvasManager.
 */
function CanvasManager() {
  var cManager = {}

  /**
   * @param {Partial<RGBASelection>} options
   */
  cManager.RGBASelection = function (options) {
    return Object.assign({
      r: true,
      g: true,
      b: true,
      a: false
    }, options)
  }

  /**
   * Caching allows for higher speed.
     * @param {CachedHTMLCanvasElement} canvas
     * @return {CanvasRenderingContext2D}
     */
  cManager.getContext = function (canvas) {
    // Set cache
    if (!canvas._context) {
      canvas._context = canvas.getContext('2d')
    }
    if (!canvas._context) {
      throw new Error('Unexpectedly did not assign context')
    }

    return canvas._context
  }

  /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} fps
     * @return {MediaStream|boolean}
     */
  cManager.canvasToStream = function (canvas, fps) {
    if (canvas.captureStream) {
      if (fps) {
        return canvas.captureStream(fps)
      } else {
        return canvas.captureStream()
      }
    } else {
      return false
    }
  }

  /**
     * Abstract canvas to image function
     * @param {HTMLCanvasElement} canvas
     * @param {Partial<CanvasImageOptions>} options
     * @return {*}
     */
  cManager.canvasToImage = function (canvas, options) {
    var returnData

    // Defaults
    var format = 'png'
    var serialization = 'image' // data_url
    var onLoad = null
    var conversionOptions = null

    // Options
    if (!options) {
      options = {}
    }
    for (var key in options) {
      if (key === 'format') {
        format = options[key]
      }
      if (key === 'serialization') {
        serialization = options[key]
      }
      if (key === 'on_load') {
        onLoad = options[key]
      }
      if (key === 'conversion_options') {
        conversionOptions = options[key]
      }
    }

    // Data URL
    if (serialization === 'data_url') {
      returnData = cManager.canvasToDataURL(canvas, format, conversionOptions)
      // Onload finished
      if (onLoad) {
        onLoad(returnData)
      }
    } else if (serialization === 'image') {
      returnData = cManager.canvasToImageFile(canvas, format, conversionOptions, onLoad)
    }

    return returnData
  }

  // Imaging
  /**
     * @param {*} drawable
     * @return {HTMLImageElement}
     */
  cManager.drawableToImage = function (drawable) {
    var dataURL = cManager.drawableToDataURL(drawable)
    var image = new window.Image()
    image.src = dataURL

    return image
  }

  /**
     * @param {string} src
     * @param {function} onLoad
     * @param {string} format
     * @param {number|undefined} conversionOptions
     */
  cManager.ImageSrcToDataURL = function (src, onLoad, format, conversionOptions) {
    var image = new window.Image()
    image.src = src
    image.onload = function () {
      var drawable = image
      var dataUrl = cManager.drawableToDataURL(drawable, format, conversionOptions)
      onLoad(dataUrl)
    }
  }

  /**
     * @param {CanvasImageSource} drawable
     * @param {undefined|HTMLCanvasElement} startCanvas
     * @return {HTMLCanvasElement}
     */
  cManager.drawableToCanvas = function (drawable, startCanvas = undefined) {
    const canvas = startCanvas || document.createElement('canvas')
    canvas.width = drawable.width || drawable.videoWidth || 0
    canvas.height = drawable.height || drawable.videoHeight || 0
    failOnFalsy(cManager.getContext(canvas)).drawImage(drawable, 0, 0)

    return canvas
  }

  /**
     * @param {CanvasImageSource} drawable
     * @param {string|undefined} format
     * @param {number|undefined} conversionOptions
     * @return {string}
     */
  cManager.drawableToDataURL = function (drawable, format = undefined, conversionOptions = undefined) {
    var canvas = cManager.drawableToCanvas(drawable)
    return cManager.canvasToDataURL(canvas, format, conversionOptions)
  }

  /**
     * @param {HTMLCanvasElement} canvas
     * @param {string|undefined} format
     * @param {number|undefined} encoderOptions https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
     * @return {string}
     */
  cManager.canvasToDataURL = function (canvas, format = undefined, encoderOptions = undefined) {
    var dataURL = canvas.toDataURL(format, encoderOptions)
    return dataURL
  }

  /**
     * @param {HTMLCanvasElement} canvas
     * @param {string} format
     * @param {number|undefined} conversionOptions
     * @param {function} onLoad
     * @return {HTMLImageElement}
     */
  cManager.canvasToImageFile = function (canvas, format, conversionOptions, onLoad) {
    var img = new window.Image()
    var dataURL = cManager.canvasToDataURL(canvas, format, conversionOptions)

    img.onload = function () {
      console.log('worked')
      if (onLoad) {
        onLoad(img)
      }
    }
    img.onerror = function (err) {
      console.error('canvasToImageFile error', err)
    }
    img.src = dataURL

    return img
  }

  /**
     * Watches for canvas stop, usual for WebRTC connection problems in older browsers.
     * Stops on first stop.
     * @param {HTMLCanvasElement} canvas
     * @param {function} onStop
     * @param {{interval: number}} options
     */
  cManager.watchForCanvasStop = function (canvas, onStop, options) {
    var ms = options.interval || 2000

    var ctx = failOnFalsy(canvas.getContext('2d'))

    var getImageData = function () {
      return ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
    var prevImgData = getImageData()

    var interval = window.setInterval(function () {
      var imgData = getImageData()
      if (cManager.isImageDataSame(imgData, prevImgData)) {
        window.clearInterval(interval)
        onStop()
      }
      prevImgData = imgData
    }, ms)
  }

  /**
     * Returns boolean for quick imageData checking.
     * @param {ImageData} imgData1
     * @param {ImageData} imgData2
     * @return {boolean}
     */
  cManager.isImageDataSame = function (imgData1, imgData2) {
    if (imgData1.data.length !== imgData2.data.length) {
      return false
    }

    let val1, val2
    for (let i = 0; i < imgData1.data.length; i++) {
      val1 = imgData1.data[i]
      val2 = imgData2.data[i]
      if (val1 !== val2) {
        return false
      }
    }

    return true
  }

  /**
     * @param {HTMLCanvasElement} canvas
     * @param {Partial<RGBASelection>} rgbaOptions
     * @return {boolean}
     */
  cManager.canvasHasColorData = function (canvas, rgbaOptions = {}) {
    const options = cManager.RGBASelection(rgbaOptions)
    var ctx = failOnFalsy(canvas.getContext('2d'))
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    var step = 4

    for (var i = 0; i < data.length; i += step) {
      if (options.r && data[i + 0]) {
        return true
      }
      if (options.g && data[i + 1]) {
        return true
      }
      if (options.b && data[i + 2]) {
        return true
      }
      if (options.a && data[i + 3]) {
        return true
      }
    }

    // FAILED
    return false
  }

  /**
     * @param {HTMLCanvasElement} canvas
     * @param {SimpleDOMRect} boundingRect
     * @return {HTMLCanvasElement}
     */
  cManager.fitCanvasToBoundingRect = function (canvas, boundingRect) {
    var canvas2 = document.createElement('canvas')
    canvas2.width = boundingRect.right - boundingRect.left
    canvas2.height = boundingRect.bottom - boundingRect.top
    failOnFalsy(canvas2.getContext('2d')).drawImage(canvas, boundingRect.left, boundingRect.top, canvas2.width, canvas2.height, 0, 0, canvas2.width, canvas2.height)

    canvas.width = canvas2.width
    canvas.height = canvas2.height
    failOnFalsy(canvas.getContext('2d')).drawImage(canvas2, 0, 0)

    return canvas
  }

  /**
     * @param {CanvasRenderingContext2D} ctx
     * @return {DOMRect}
     */
  cManager.getContextBoundingRect = function (ctx) {
    const boundingRect = cManager.BoundingRect()
    const canvas = ctx.canvas
    const cWidth = canvas.width
    const cHeight = canvas.height
    const data = ctx.getImageData(0, 0, cWidth, cHeight).data

    const step = 4

    for (let i = 0; i < data.length; i += step) {
      if (data[i + 0] || data[i + 1] || data[i + 2]) { // Has a color value
        const index = i / step
        const x = index % cHeight
        const y = Math.floor(index / cWidth)

        if (boundingRect.top === 0 || y < boundingRect.top) {
          boundingRect.top = y
        }
        if (boundingRect.bottom === 0 || y > boundingRect.bottom) {
          boundingRect.bottom = y
        }
        if (boundingRect.left === 0 || x < boundingRect.left) {
          boundingRect.left = x
        }
        if (boundingRect.right === 0 || x > boundingRect.right) {
          boundingRect.right = x
        }
      }
    }

    return boundingRect
  }

  /**
     * @return {SimpleDOMRect}
     */
  cManager.BoundingRect = function () {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    }
  }

  cManager.CanvasRenderer = CanvasRenderer

  /**
     * @param {MediaStream} stream
     * @param {number} updateRate
     * @return {object}
     */
  cManager.streamToCanvasRenderer = function (stream, updateRate) {
    // Abstract here

    var settings = {
      renderable: stream,
      rate: updateRate
    }

    var cRender = new cManager.CanvasRenderer(settings)
    return cRender
  }

  return cManager
}

if (typeof window === 'object') {
  window.CanvasManager = CanvasManager
}
if (typeof module !== 'undefined') {
  module.exports = CanvasManager
}
