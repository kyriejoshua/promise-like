"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = exports.isFunction = void 0;
/**
 * Promise 内部状态的枚举
 */
var PROMISE_STATES;
(function (PROMISE_STATES) {
    PROMISE_STATES["PENDING"] = "pending";
    PROMISE_STATES["FULFILLED"] = "fulfilled";
    PROMISE_STATES["REJECTED"] = "rejected";
})(PROMISE_STATES || (PROMISE_STATES = {}));
exports.isFunction = function (fn) { return typeof fn === 'function'; };
exports.isObject = function (obj) { return typeof obj === 'object'; };
var PromiseLike = /** @class */ (function () {
    function PromiseLike(executor) {
        var _this = this;
        /**
         * 使状态变更为 fulfilled
         * 调用注册的事件，注意调用后进行清除
         * @param value
         * @returns
         */
        this._resolve = function (value) {
            var resolveCb = function () {
                if (_this.PromiseState !== PROMISE_STATES.PENDING) {
                    return;
                }
                while (_this.resolveCallbackQueues.length) {
                    var fn = _this.resolveCallbackQueues.shift();
                    fn && fn(value);
                }
                _this.PromiseState = PROMISE_STATES.FULFILLED;
                _this.PromiseResult = value;
            };
            // 使任务变成异步的
            queueMicrotask(function () { return resolveCb(); });
        };
        /**
         * 使状态变更为 rejected
         * @param value
         */
        this._reject = function (value) {
            var rejectCb = function () {
                if (_this.PromiseState !== PROMISE_STATES.PENDING) {
                    return;
                }
                while (_this.rejectCallbackQueues.length) {
                    var fn = _this.rejectCallbackQueues.shift();
                    fn && fn(value);
                }
                _this.PromiseState = PROMISE_STATES.REJECTED;
                _this.PromiseResult = value;
            };
            queueMicrotask(function () { return rejectCb(); });
        };
        /**
         * 根据当前不同状态来执行对应逻辑
         * 如果在默认状态就是注册对应事件
         * 如果状态变化则是执行对应事件
         * @param onFulfilled
         * @param onRejected
         * @returns
         */
        this.then = function (onFulfilled, onRejected) {
            // 默认处理！！！
            onFulfilled = exports.isFunction(onFulfilled) ? onFulfilled : function (value) { return value; };
            onRejected = exports.isFunction(onRejected) ? onRejected : function (err) { throw err; };
            /**
             * 该实现遵循 Promise/A+ 规范
             * https://github.com/promises-aplus/promises-spec
             * @param promise
             * @param x
             * @param resolve
             * @param reject
             * @returns
             */
            var resolvePromise = function (promise, x, resolve, reject) {
                // 返回的 promise 不可以是当前的 promise 否则会造成死循环
                if (newPromise === x) {
                    reject(new TypeError('Chaining cycle detected for promise #<Promise>'));
                }
                // 对可能是 thenable 接口实现的对象判断
                if (exports.isObject(x) || exports.isFunction(x)) {
                    if (x === null) {
                        return resolve(x);
                    }
                    var thenCb = void 0;
                    try {
                        thenCb = x.then;
                    }
                    catch (error) {
                        return reject(error);
                    }
                    // 如果是 thenable 的对象，则调用其 then 方法
                    // 这一步涵盖了 Promise 实例的可能性
                    if (exports.isFunction(thenCb)) {
                        var isCalled_1 = false;
                        try {
                            thenCb.call(x, // 指向当前函数或对象
                            function (y) {
                                // 如果 resolvePromise 和 rejectPromise 都可能被调用
                                // 则只需调用第一次（resolvePromise 或 rejectPromise），后续无需再执行
                                if (isCalled_1)
                                    return;
                                isCalled_1 = true;
                                // 传入当前函数，以实现递归展开调用
                                resolvePromise(promise, y, resolve, reject);
                            }, function (r) {
                                // 对应前面任意的调用之后，就不再只需后续逻辑
                                if (isCalled_1)
                                    return;
                                isCalled_1 = true;
                                reject(r);
                            });
                        }
                        catch (error) {
                            if (isCalled_1)
                                return;
                            reject(error);
                        }
                    }
                    else {
                        resolve(x);
                    }
                }
                else {
                    resolve(x);
                }
            };
            // 定义变量，用于传参进行比较
            var newPromise = new PromiseLike(function (resolve, reject) {
                /**
                 * 封装完成回调函数
                 * @param val
                 */
                var handleFulfilled = function (val) {
                    try {
                        var x = onFulfilled && onFulfilled(val);
                        resolvePromise(newPromise, x, resolve, reject);
                    }
                    catch (error) {
                        // 如果当前执行逻辑内发生异常，则抛出异常
                        reject(error);
                    }
                    ;
                };
                /**
                 * 封装错误回调函数
                 * @param val
                 */
                var handleRejected = function (val) {
                    try {
                        var x = onRejected && onRejected(val);
                        resolvePromise(newPromise, x, resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                };
                switch (_this.PromiseState) {
                    case PROMISE_STATES.PENDING:
                        _this.resolveCallbackQueues.push(handleFulfilled);
                        _this.rejectCallbackQueues.push(handleRejected);
                        break;
                    case PROMISE_STATES.FULFILLED:
                        handleFulfilled(_this.PromiseResult);
                        break;
                    case PROMISE_STATES.REJECTED:
                        handleRejected(_this.PromiseResult);
                        break;
                }
            });
            return newPromise;
        };
        /**
         * 错误处理
         * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
         * @param rejectedCb
         * @returns
         */
        this.catch = function (rejectedCb) {
            return _this.then(null, rejectedCb);
        };
        /**
         * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
         * @param finallyCb
         * @returns
         */
        this.finally = function (finallyCb) {
            return _this.then(
            // 完成回调时，执行注册函数，并且将原来的值传递下去
            // 封装 Promise 类，再调用 then 方法传递
            function (val) { return PromiseLike.resolve(finallyCb && finallyCb()).then(function () { return val; }); }, 
            // 异常回调时，执行注册函数，并且抛出异常
            function (err) { return PromiseLike.resolve(finallyCb && finallyCb()).then(function () { throw err; }); });
        };
        if (!exports.isFunction(executor)) {
            throw new Error('Promise resolver undefined is not a function');
        }
        this.PromiseState = PROMISE_STATES.PENDING;
        this.PromiseResult = undefined;
        // 分别用于两个注册事件保存的数组
        this.resolveCallbackQueues = [];
        this.rejectCallbackQueues = [];
        try {
            executor(this._resolve, this._reject);
        }
        catch (error) {
            this._reject(error);
        }
    }
    /**
     * 返回相应的类型
     * @returns
     */
    PromiseLike.prototype.toString = function () {
        return '[object PromiseLike]';
    };
    /**
     * 判断是否是当前类的实例
     * @param promise
     * @returns
     */
    PromiseLike.is = function (promise) {
        return promise instanceof PromiseLike;
    };
    /**
     * 直接实例化 proimse
     * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
     * @param value
     * @returns
     */
    PromiseLike.resolve = function (value) {
        if (PromiseLike.is(value)) {
            return value;
        }
        return new PromiseLike(function (resolve, reject) {
            // 如果传入了实现 thenable 接口的对象，则将其展开并作为返回值
            if (value && exports.isObject(value) && exports.isFunction(value.then)) {
                return queueMicrotask(function () {
                    try {
                        value.then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            }
            return resolve(value);
        });
    };
    PromiseLike.reject = function (value) {
        return new PromiseLike(function (resolve, reject) { return reject(value); });
    };
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
     * @param promises 严格意义上来说，参数是可迭代对象，为了简化实现这里统一成数组
     * @returns
     */
    PromiseLike.all = function (promises) {
        // 支持链式调用
        return new PromiseLike(function (resolve, reject) {
            var len = promises.length;
            var resolvedPromisesCount = 0;
            var resolvedPromisesResult = [];
            var _loop_1 = function (i) {
                var currentPromise = promises[i];
                // 如果不是 Promise 实例，则需要包装一份；
                // 但因为直接包装 Promise 类的效果是幂等的，所以这里不需要判断，直接处理即可
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolvedPromisesCount++;
                    resolvedPromisesResult[i] = res;
                    // 当所有值都 resolve 之后， 返回对应数组
                    if (resolvedPromisesCount === len) {
                        resolve(resolvedPromisesResult);
                    }
                })
                    // 如果有任意一个异常，则直接推出
                    .catch(function (err) {
                    reject(err);
                });
            };
            for (var i = 0; i < len; i++) {
                _loop_1(i);
            }
        });
    };
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
     * @param promises
     * @returns
     */
    PromiseLike.race = function (promises) {
        return new PromiseLike(function (resolve, reject) {
            for (var i = 0; i < promises.length; i++) {
                var currentPromise = promises[i];
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolve(res);
                })
                    .catch(function (err) {
                    reject(err);
                });
            }
        });
    };
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
     * @param promises 严格意义上来说，参数是可迭代对象，为了简化实现这里统一成数组
     * @returns
     */
    PromiseLike.allSettled = function (promises) {
        // 支持链式调用
        return new PromiseLike(function (resolve, reject) {
            var len = promises.length;
            var startTime = Date.now();
            var resolvedPromisesCount = 0;
            var resolvedPromisesResult = [];
            var _loop_2 = function (i) {
                var currentPromise = promises[i];
                // 如果不是 Promise 实例，则需要包装一份；
                // 但因为直接包装 Promise 类的效果是幂等的，所以这里不需要判断，直接处理即可
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolvedPromisesCount++;
                    resolvedPromisesResult[i] = {
                        status: PROMISE_STATES.FULFILLED,
                        value: res
                    };
                    // 当所有 promises 完成后，返回数组；多封装了一个属性用于显示执行时间
                    if (resolvedPromisesCount === len) {
                        resolvedPromisesResult.duringTime = Date.now() - startTime + 'ms';
                        resolve(resolvedPromisesResult);
                    }
                })
                    // 如果有任意一个异常，则直接推出
                    .catch(function (err) {
                    resolvedPromisesCount++;
                    resolvedPromisesResult[i] = {
                        status: PROMISE_STATES.REJECTED,
                        reason: err
                    };
                    if (resolvedPromisesCount === len) {
                        resolvedPromisesResult.duringTime = Date.now() - startTime + 'ms';
                        resolve(resolvedPromisesResult);
                    }
                });
            };
            for (var i = 0; i < len; i++) {
                _loop_2(i);
            }
        });
    };
    /**
     * 2021 年刚纳入规范的 any
     * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
     * @param promises
     * @returns
     */
    PromiseLike.any = function (promises) {
        return new PromiseLike(function (resolve, reject) {
            var len = promises.length;
            var rejectedPromisesCount = 0;
            var rejectedPromisesResult = [];
            var _loop_3 = function (i) {
                var currentPromise = promises[i];
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolve(res);
                })
                    .catch(function (err) {
                    rejectedPromisesCount++;
                    rejectedPromisesResult[i] = err;
                    if (rejectedPromisesCount === len) {
                        // 如果浏览器支持，则直接抛出这个新对象，否则则直接抛出异常
                        if (exports.isFunction(AggregateError)) {
                            throw new AggregateError(rejectedPromisesResult, 'All promises were rejected');
                        }
                        else {
                            throw (rejectedPromisesResult);
                        }
                    }
                });
            };
            for (var i = 0; i < promises.length; i++) {
                _loop_3(i);
            }
        });
    };
    /**
     * 返回最后一个完成的值或者异常
     * @param promises
     * @returns
     */
    PromiseLike.anyLast = function (promises) {
        return new PromiseLike(function (resolve, reject) {
            var len = promises.length;
            var startTime = Date.now();
            var resolvedPromisesCount = 0;
            for (var i = 0; i < len; i++) {
                var currentPromise = promises[i];
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolvedPromisesCount++;
                    // 当所有 promises 完成后，返回最后一个值；封装一个属性用于显示执行时间
                    if (resolvedPromisesCount === len) {
                        exports.isObject(res) && (res.duringTime = Date.now() - startTime + 'ms');
                        resolve(res);
                    }
                })
                    // 如果有任意一个异常，则直接推出
                    .catch(function (err) {
                    resolvedPromisesCount++;
                    if (resolvedPromisesCount === len) {
                        err.duringTime = Date.now() - startTime + 'ms';
                        reject(err);
                    }
                });
            }
        });
    };
    /**
     * 返回最后一个完成的值，可以自行决定是否忽略异常
     * 如果不忽略，异常优先抛出
     * 如果忽略，返回完成值
     * @param promises
     * @param ignoreRejected
     * @returns
     */
    PromiseLike.last = function (promises, ignoreRejected) {
        if (ignoreRejected === void 0) { ignoreRejected = false; }
        return new PromiseLike(function (resolve, reject) {
            var len = promises.length;
            var startTime = Date.now();
            var resolvedPromisesCount = 0;
            for (var i = 0; i < len; i++) {
                var currentPromise = promises[i];
                PromiseLike.resolve(currentPromise)
                    .then(function (res) {
                    resolvedPromisesCount++;
                    // 当所有 promises 完成后，返回最后一个值；封装一个属性用于显示执行时间
                    if (resolvedPromisesCount === len) {
                        exports.isObject(res) && (res.duringTime = Date.now() - startTime + 'ms');
                        resolve(res);
                    }
                })
                    // 如果有任意一个异常，则直接推出
                    .catch(function (err) {
                    if (ignoreRejected) {
                        resolvedPromisesCount++;
                    }
                    else {
                        reject(err);
                    }
                });
            }
        });
    };
    /**
     * 把不是 promise 实例的函数包装成 promise 实例
     * 例如 ajax 请求
     * const request = Promise.wrap(ajax);
     * ajax.then(callback);
     * @param fn
     * @returns
     */
    PromiseLike.wrap = function (fn) {
        if (!exports.isFunction(fn)) {
            return fn;
        }
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return new PromiseLike(function (resolve) {
                fn.apply(null, args.concat(function (res, err) {
                    res && resolve(res);
                    err && resolve(err);
                }));
            });
        };
    };
    /**
     * 顺序执行传入的普通函数
     * @param promises
     * @returns
     */
    PromiseLike.sequenceWithInit = function (fns, initValue) {
        return fns.reduce(function (acc, fn) {
            if (!exports.isFunction(fn)) {
                fn = function (x) { return x; };
            }
            return acc.then(fn).catch(function (err) { throw err; });
        }, PromiseLike.resolve(initValue));
    };
    /**
     * 组合多个函数，返回一个函数来执行
     * @param fns
     * @returns
     */
    PromiseLike.sequence = function (fns) {
        return function (x) { return fns.reduce(function (acc, fn) {
            if (!exports.isFunction(fn)) {
                fn = function (x) { return x; };
            }
            return acc.then(fn).catch(function (err) { throw err; });
        }, PromiseLike.resolve(x)); };
    };
    /**
     * 串行执行所有 promises,并返回按返回顺序排列的数组
     * 注意接收的参数是返回 promise 实例的函数组成的数组
     * @param promises
     * @returns
     */
    PromiseLike.sequenceByOrder = function (promises) {
        return new PromiseLike(function (resolve) {
            var promiseResults = [];
            var reduceRes = promises.reduce(function (prevPromise, currentPromise, currentIndex) {
                return prevPromise.then(function (val) {
                    promiseResults.push(val);
                    var newVal = currentPromise(val);
                    // 最后一次循环时保存，并剔除第一个值（默认 undefined)
                    if (currentIndex === promises.length - 1) {
                        promiseResults.unshift();
                    }
                    return newVal;
                });
            }, PromiseLike.resolve());
            reduceRes.then(function (val) {
                promiseResults.push(val);
                resolve(promiseResults);
            });
        });
    };
    /**
     * Promise.race([Promise.observe(p, cleanup// 处理函数), timeoutFn //超时函数])
     * @param promise
     * @param fn
     * @returns
     */
    PromiseLike.observe = function (promise, fn) {
        promise
            .then(function (res) {
            PromiseLike.resolve(res).then(fn);
        }, function (err) {
            PromiseLike.resolve(err).then(fn);
        });
        return promise;
    };
    /**
     * 对每个 promise 的值进行特定的处理
     * Promise.map([p1, p2, p3], (val, resolve) => {
     *   resolve(val + 1);
     * })
     * @param promises
     * @param fn
     * @returns
     */
    PromiseLike.map = function (promises, fn) {
        return PromiseLike.all(promises.map(function (currentPromise) {
            return new PromiseLike(function (resolve) {
                if (!exports.isFunction(fn)) {
                    fn = function (val, resolve) { return resolve(val); };
                }
                fn(currentPromise, resolve);
            });
        }));
    };
    /**
     * 三方库验证
     * @returns
     */
    PromiseLike.deferred = function () {
        var defer = {};
        defer.promise = new PromiseLike(function (resolve, reject) {
            defer.resolve = resolve;
            defer.reject = reject;
        });
        return defer;
    };
    return PromiseLike;
}());
exports.default = PromiseLike;
