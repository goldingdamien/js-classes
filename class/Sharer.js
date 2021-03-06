/**
 * @typedef {Object} SharerSettings
 */

/**
 * @typedef {Object} GroupedDataItem
 * @property {string} name
 * @property {string} description
 * @property {string} image_src
 * @property {HTMLImageElement|null} image
 * @property {(function(...any):void)|null} handle
 */

/**
 * @typedef {Object} ShareMethod
 * @property {string} type
 * @property {function():void} share

/**
 * Data sharing handling.
 * @param {SharerSettings} settings
 */
function Sharer(settings) {
    var sharer = {}
    sharer.sharer_settings = { // TODO: Type check!

        // Visual
        barcode: null,
        ar_code: null,
        url_recognizer: null,
        data_recognizer: null,

        // Audio
        audio_data: null,

        // Wireless
        nfc: null,
        bluetooth: null,
        wifi: null,

        // Account
        facebook: null,
        skype: null,
        line: null,

        // Other
        infrared: null
    }
    /**
     * @type {Object<string, ShareMethod>}
     */
    sharer.share_methods = {}

    /**
     * @param {SharerSettings} settings
     */
    sharer.setup = function (settings) {
        // Settings
        //

        sharer.setupShareMethods()
    }

    sharer.setupShareMethods = function () {
        for (var key in sharer.sharer_settings) {
            sharer.setupShareMethod(key, sharer.sharer_settings[key])
        }
    }

    /**
     * @param {string} key
     * @param {*} data
     */
    sharer.setupShareMethod = function (key, data) {
        sharer.share_methods[key] = sharer.ShareMethod(data)
    }

    /**
     * @param {string} key
     * @return {function}
     */
    sharer.getShareMethod = function (key) {
        var methods = sharer.getShareMethods()
        return methods[key]
    }

    sharer.getShareMethods = function () {
        var methods = sharer.share_methods
        return methods
    }

    sharer.getTypes = function () {
        var types = {
            visual: {},
            audio: {},
            wireless: {},
            account: {},
            other: {}
        }

        return types
    }

    /**
     * @param {HTMLElement} el
     */
    sharer.setShareElement = function (el) {
        el.addEventListener('click', sharer.handleShareClick)
    }

    /**
     * @param {Event} ev
     */
    sharer.handleShareClick = function (ev) {
        sharer.showGroupedData()
    }

    /**
     * @return {HTMLElement}
     */
    sharer.getNewWindow = function () {
        var windowEl = document.createElement('div')

        // Style
        var style = windowEl.style
        style.position = 'fixed'
        style.zIndex = '99999'
        style.width = '100%'
        style.height = '100%'
        style.top = '0'
        style.left = '0'
        style.padding = '10px'
        style.backgroundColor = 'lightGray'
        style.color = 'black'

        return windowEl
    }

    /**
     * @return {HTMLElement}
     */
    sharer.getNewButton = function () {
        var buttonEl = document.createElement('div')

        // Style
        var style = buttonEl.style
        style.border = '1px solid gray'
        style.borderRadius = '3px'
        style.margin = '10px'
        style.padding = '5px'
        style.float = 'left'
        style.clear = 'both'
        style.backgroundPosition = 'center'
        style.backgroundRepeat = 'no-repeat'
        style.backgroundSize = 'contain'

        return buttonEl
    }

    /**
     * @param {HTMLElement} el
     */
    sharer.showWindow = function (el) {
        el.style.display = 'block'
        el.style.visibility = 'visibile'
        if (!el.parentElement) {
            var pEl = document.body
            pEl.appendChild(el)
        }
    }

    /**
     * @param {HTMLElement} el
     */
    sharer.hideWindow = function (el) {
        el.style.display = 'none'
        el.style.visibility = 'hidden'
        if (el.parentElement) {
            var pEl = el.parentElement
            pEl.removeChild(el)
        }
    }

    sharer.showGroupedData = function () {
        var gData = sharer.getGroupedData()
        var item
        var windowEl = sharer.getNewWindow()
        var buttonEl

        for (var key in gData) {
            item = gData[key]
            buttonEl = sharer.getNewButton()

            // Name
            buttonEl.textContent = item.name

            // Description
            buttonEl.setAttribute('title', item.description)

            // Image icon
            if (item.image_src) {
                buttonEl.style.backgroundImage = 'url('
                ' + item.image_src + '
                ')'
            }

            // Listener
            if (item.handle) {
                buttonEl.addEventListener('click', item.handle)
            }

            windowEl.appendChild(buttonEl)
        }

        sharer.showWindow(windowEl)
    }

    sharer.getGroupedData = function () {
        var types = sharer.getTypes()
        /**
         * @type {Object<string, GroupedDataItem>}
         */
        var gData = {}

        for (var key in types) {
            const item = sharer.GroupedDataItem()
            item.name = key
            gData[key] = item
        }

        return gData
    }

    /**
     * @param {Partial<GroupedDataItem>} options
     * @return {GroupedDataItem}
     */
    sharer.GroupedDataItem = function (options = {}) {
        return Object.assign({
            name: '',
            description: '',
            image_src: '',
            image: null,
            handle: null
        }, options)
    }

    /**
     * @param {string} type
     * @return {object}
     */
    sharer.getShareMethodsByType = function (type) {
        var methods = sharer.getShareMethodsByAttr('type', type)
        return methods
    }

    /**
     * @param {string} attr
     * @param {*} value
     * @return {object}
     */
    sharer.getShareMethodsByAttr = function (attr, value) {
        var methods = sharer.getShareMethods()
        var fMethods = {}
        for (var key in methods) {
            if (methods[key][attr] === value) {
                fMethods[key] = methods[key]
            }
        }

        return fMethods
    }

    /**
     * @param {Partial<ShareMethod>} options
     * @return {ShareMethod}
     */
    sharer.ShareMethod = function (options = {}) {
        return Object.assign({
            type: 'visual',
            // Settings
            //
            share: function () { }
        }, options)
    }

    sharer.setup(settings)

    return sharer
}