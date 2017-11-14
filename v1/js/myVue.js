function def(obj, key, val, enume) {
    Object.defineProperty(obj, key, {
        value: val,
        enumerable: !!enume,
        writable: true,
        configurable: true
    });
}

function protoAugment(target, src, keys) {
    target.__proto__ = src;
}

function copyAugment(target, src, keys) {
    for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        def(target, key, src[key]);
    }
}

var arrKeys = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
var extendArr = [];

arrKeys.forEach(function (key) {
    def(extendArr, key, function () {
        var result,
            arrProto = Array.prototype,
            ob = this.$Observer,
            arr = arrProto.slice.call(arguments),
            inserted,
            index;

        switch (key) {
            case "push":
                inserted = arr;
                index = this.length;
                break;
            case "unshift":
                inserted = arr;
                index = 0;
                break;
            case "splice":
                inserted = arr.slice(2);
                index = arr[0];
                break;
        }

        result = arrProto[key].apply(this, arguments);

        if (inserted) {
            ob.observeArray(inserted);
        }

        ob.dep.notify();

        return result;
    });
});

var arrayKeys = Object.getOwnPropertyNames(extendArr);

/**
 * 监听器构造函数
 * @param {Object} data 被监听数据 
 */
function Observer(data) {

    this.dep = new Dep();

    if (!data || typeof data !== "object") {
        return;
    }

    // 在每个object上添加一个observer
    def(data, "$Observer", this);

    // 继承变异方法push、pop
    if (Array.isArray(data)) {

        var hasProto = "__proto__" in {};

        // 是否支持__proto__
        var augment = hasProto
            ? protoAugment
            : copyAugment;
        augment(data, extendArr, arrayKeys);
    }
    else {
        this.data = data;
        this.walk(data);
    }
}

Observer.prototype = {
    walk: function (data) {
        var self = this;
        Object.keys(data).forEach(function (key) {
            self.defineReactive(data, key, data[key]);
        });
    },

    defineReactive: function (data, key, val) {
        var dep = new Dep();
        var childObj = observe(val);

        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get: function () {

                // 判断是否需要添加订阅者 什么时候添加订阅者呢？ 与实际页面DOM有关联的data属性才添加相应的订阅者
                if (Dep.target) {
                    // 在这里添加一个订阅者
                    dep.addSub(Dep.target);

                    console.log("订阅者 get data:", val);
                }
                return val;
            },
            set: function (newVal) {
                if (newVal === val) {
                    return;
                }

                val = newVal;

                dep.notify();
                console.log("属性：" + key + "被监听了，现在值为：" + newVal);
            }
        });
    },

    observeArray(items) {
        for (var i = 0, l = items.length; i < l; i++) {
            observe(items[i]);
        }
    }
}

/**
 * 监听器
 * @param {Object} data 被监听对象
 */
function observe(data) {   

    return new Observer(data);
}

/**
 * 订阅器
 */
function Dep() {
    this.subs = [];
    this.target = null;
}

Dep.prototype = {
    addSub: function (sub) {
        this.subs.push(sub);
        console.log("this.subs:", this.subs);
    },
    notify: function () {
        this.subs.forEach(function (sub) {
            sub.update();
        });
    }
}

/**
 * 订阅者
 * @param {Object} vm vue对象
 * @param {String} exp 属性值
 * @param {Function} cb 回调函数
 */
function Watcher(vm, exp, cb) {
    this.cb = cb;
    this.vm = vm;
    this.exp = exp;
    // 将自己添加到订阅器
    this.value = this.get();
}

Watcher.prototype = {
    update: function () {
        this.run();
    },
    run: function () {
        var value = this.traverse(this.vm.data, this.exp);
        var oldVal = this.value;console.log("run...")
        if (value !== oldVal) {
            this.value = value;
            this.cb.call(this.vm, value, oldVal);
        }
    },
    get: function () {
        // 缓存自己 做个标记
        Dep.target = this;

        // 强制执行监听器里的get函数 this.vm.data[this.exp] 调用getter，添加一个订阅者sub，存入到全局变量subs
        var value = this.traverse(this.vm.data, this.exp);

        // 释放自己
        Dep.target = null;

        return value;
    },

    traverse: function(data, exp) {
        var exps = exp.split(".");
        var d = data;

        exps.forEach(function(item) {
            d = d[item];
        });

        return d;
    }
}

/**
 * 编译器构造函数
 * @param {String} el 根元素
 * @param {Object} vm vue对象
 */
function Compile(el, vm) {
    this.vm = vm;
    this.el = document.querySelector(el);
    this.fragment = null;
    this.init();
}

Compile.prototype = {
    /**
     * 初始
     */
    init: function () {
        if (this.el) {
            console.log("this.el:", this.el);
            // 移除页面元素生成文档碎片
            this.fragment = this.nodeToFragment(this.el);
            // 编译文档碎片
            this.compileElement(this.fragment);
            this.el.appendChild(this.fragment);
        }
        else {
            console.log("DOM Selector is not exist");
        }
    },

    /**
     * 页面DOM节点转化成文档碎片
     */
    nodeToFragment: function (el) {
        var fragment = document.createDocumentFragment();
        var child = el.firstChild;

        // 此处添加打印，出来的不是页面中原始的DOM，而是编译后的？
        // NodeList是引用关系，在编译后相应的值被替换了，这里打印出来的NodeList是后来被引用更新了的
        console.log("el:", el);
        // console.log("el.firstChild:", el.firstChild.nodeValue);
        while (child) {
            // append后，原el上的子节点被删除了，挂载在文档碎片上
            fragment.appendChild(child);
            child = el.firstChild;
        }

        return fragment;
    },
    /**
     * 编译文档碎片，遍历到当前是文本节点则去编译文本节点，如果当前是元素节点，并且存在子节点，则继续递归遍历
     */
    compileElement: function (fragment) {
        var childNodes = fragment.childNodes;
        var self = this;
        [].slice.call(childNodes).forEach(function (node) {
            // var reg = /\{\{\s*(.+)\s*\}\}/g;
            var reg = /\{\{\s*((?:.|\n)+?)\s*\}\}/g;
            var text = node.textContent;

            if (self.isElementNode(node)) {
                self.compileAttr(node);
            }
            else if (self.isTextNode(node) && reg.test(text)) {
                reg.lastIndex = 0
                
                /* var match;
                while(match = reg.exec(text)) {
                    self.compileText(node, match[1]);
                } */

                self.compileText(node, reg.exec(text)[1]);
            }

            if (node.childNodes && node.childNodes.length) {
                self.compileElement(node);
            }
        });
    },

    /**
     * 编译属性
     */
    compileAttr: function (node) {
        var nodeAttrs = node.attributes;
        var self = this;

        Array.prototype.forEach.call(nodeAttrs, function (attr) {
            var attrName = attr.name;

            // 只对vue本身指令进行操作
            if (self.isDirective(attrName)) {
                var exp = attr.value;

                // 事件指令
                if (self.isEventDirective(attrName)) {
                    self.compileEvent(node, self.vm, exp, attrName);
                }
                // v-model
                else if (self.isModelDirective(attrName)) {
                    self.compileModel(node, self.vm, exp, attrName);
                }

                node.removeAttribute(attrName);
            }
        })
    },

    /**
     * 编译文档碎片节点文本，即对标记替换
     */
    compileText: function (node, exp) {
        var self = this;
        var exps = exp.split(".");
        var initText = this.vm;

        exps.forEach(function (item) {
            initText = initText[item];
        });

        if(typeof initText == "undefined") {
            return
        }

        this.updateText(node, initText);

        var w = new Watcher(this.vm, exp, function (val) {
            self.updateText(node, val);
        });
    },

    /**
     * 编译事件指令
     */
    compileEvent: function (node, vm, exp, attrName) {
        // @xxx v-on:xxx
        var onRE = /^@|^v-on:/;
        var eventType = attrName.replace(onRE, "");

        var cb = vm.methods[exp];

        if (eventType && cb) {
            node.addEventListener(eventType, cb.bind(vm), false);
        }
    },

    /**
     * 编译v-model指令
     */
    compileModel: function (node, vm, exp, attrName) {
        var self = this;
        var val = this.vm[exp];
        this.modelUpdater(node, val);
        new Watcher(this.vm, exp, function (value) {
            self.modelUpdater(node, value);
        });

        node.addEventListener("input", function (e) {
            var newVal = e.target.value;
            if (val === newVal) {
                return;
            }
            self.vm[exp] = newVal;
            // val = newVal;
        });
    },

    /**
     * 更新文档碎片相应的文本节点
     */
    updateText: function (node, val) {
        node.textContent = typeof val === "undefined" ? "" : val;
    },

    /**
     * model更新节点
     */
    modelUpdater: function (node, val, oldVal) {
        node.value = typeof val == "undefined" ? "" : val;
    },

    /**
     * 属性是否是vue指令，包括v-xxx:,:xxx,@xxx
     */
    isDirective: function (attrName) {
        var dirRE = /^v-|^@|^:/;
        return dirRE.test(attrName);
    },

    /**
     * 属性是否是事件指令，v-on:,@
     */
    isEventDirective: function (attrName) {
        var onRE = /^v-on:|^@/;
        return onRE.test(attrName);
    },

    /**
     * 属性是否是v-model指令
     */
    isModelDirective: function (attrName) {
        var mdRE = /^v-model/;
        return mdRE.test(attrName);
    },

    /**
     * 判断元素节点
     */
    isElementNode: function (node) {
        return node.nodeType == 1;
    },

    /**
     * 判断文本节点
     */
    isTextNode: function (node) {
        return node.nodeType == 3;
    }
}

function MyVue(options) {
    var self = this;

    this.vm = this;

    this.methods = options.methods;

    this.data = options.data;

    // 把data属性的监听代理到根
    Object.keys(this.data).forEach(function (key) {
        self.proxy(key);
    });

    observe(this.data);

    new Compile(options.el, this.vm);

    return this;
}


/**
 * 将数据拓展到vue的根，方便读取和设置
 */
MyVue.prototype.proxy = function (key) {
    var self = this;

    Object.defineProperty(this, key, {
        enumerable: true,
        configurable: true,
        get: function proxyGetter() {
            return self.data[key];
        },
        set: function proxySetter(newVal) {
            self.data[key] = newVal;
        }
    });
}

/**
 * vue的set方法，用于外部新增属性 Vue.$set(target, key, val)
 * @param {Object} target 数据
 * @param {String} key 属性
 * @param {*} val 值
 */
function set(target, key, val) {
    if (Array.isArray(target)) {
        target.length = Math.max(target.length, key);
        target.splice(key, 1, val);
        return val
    }
    if (this.hasOwnProperty(key)) {
        target[key] = val;
        return val
    }
    var ob = (target).$Observer;
    
    if (!ob) {
        target[key] = val;
        return val
    }

    ob.defineReactive(target, key, val);

    ob.dep.notify();
    
    return val
}

MyVue.prototype.$set = set;