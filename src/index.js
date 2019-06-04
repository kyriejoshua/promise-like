// 既定状态
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

/**
 * 校验是否是函数
 * @param {any} fn
 */
const isFunction = fn => typeof fn === 'function';

export default class PromiseLike {
  // 静态方法 resolve, reject, race, all 等
  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
   * @param {any} value
   */
  static resolve(value) {
    // 当 race, all 等方法调用时，传入的入参是 promise, 无需再封装
    if (value instanceof PromiseLike) { return value }
    return new PromiseLike(resolve => resolve(value))
  }

  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject
   * @param {any} value
   */
  static reject(value) {
    return new PromiseLike((resolve, reject) => reject(value))
  }

  /**
   * 只要有一个 promise 返回，则返回结果，注意，不是数组而是最先 resolve 的值
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
   * @param {Array} list
   */
  static race(list) {
    return new PromiseLike((resolve, reject) => {
      for (let p of list) {
        this.resolve(p)
        .then((res) => {
          resolve(res)
        }, (err) => {
          reject(err)
        })
      }
    })
  }

  /**
   * 返回一个数组，里面是按原输入数组顺序排列的 resolve 或 reject 的值
   * [duringTime] 数组中属性，返回了调用时间
   * 或者可以自定义优先完成的 promise 就继续调用, 见 prefer
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
   * @param {Array} list
   * @param {Number} len
   */
  static all(list, len = list.length) {
    return new PromiseLike((resolve, reject) => {
      const startTime = Date.now()
      let resolvedCount = 0; // 判断何时结束，处理结果 resolve it
      let promiseList = [] // 保存最终的所有的值
      list.map((promise, index) => {
        this.resolve(promise)
        .then((res) => {
          promiseList[index] = res
          resolvedCount++
          // 判断的时机必须在 promise 内，否则在外面的话，同步执行后无法判断是否执行完毕
          if (resolvedCount === len) {
            promiseList.duringTime = Date.now() - startTime + 'ms'
            resolve(promiseList)
          }
        })
        .catch((err) => {
          reject(err)
        })
      })
    })
  }

  /**
   * 自定义优先完成的 promise
   * @param {Array} list
   * @param {Number} num
   */
  static prefer(list, num) {
    if (!Number.isInteger(num)) { throw new Error('PromiseLike.prefer must accpet an int number as a parameter!') }
    num = num < list.length ? num : list.length
    return PromiseLike.all(list, num)
  }

  constructor(executor) {
    if (!isFunction(executor)) {
      throw new Error('PromiseLike must accept a function as parameter!');
    }

    // 默认状态和默认值
    this.PromiseStatus = PENDING;
    this.PromiseValue = undefined;

    // 在既定状态下的回调序列，当状态符合时，内部的所有函数触发
    this.resolveCallbackQueues = [];
    this.rejectCallbackQueues = [];

    try {
      executor(this.resolve, this.reject);
    } catch (error) {
      this.reject(error);
    }
  }

  resolve = (value) => {
    if (this.PromiseStatus !== PENDING) { return; }

    // 符合状态时调用队列中的方法
    const runResolveCallbackQueues = () => {
      let fn;
      while (this.resolveCallbackQueues.length) {
        fn = this.resolveCallbackQueues.shift();
        fn(value);
      }
    }

    const runRejectCallbackQueues = () => {
      let fn;
      while (this.resolveCallbackQueues.length) {
        fn = this.resolveCallbackQueues.shift();
        fn(value);
      }
    }

    const _resolve = () => {
      // 如果传入的值是 promise 实例, 那么当前的状态是依赖于传入的实例的状态的，传参 p 执行到状态变更后，当前状态才会变更
      // promiseB = promiseA.then(data => data)
      // .then(data => { new Promise(() => 1) })
      // promiseB
      // PromiseStatus: pending
      // PromiseValue: undefined
      if (value instanceof PromiseLike) {
        value.then((val) => {
          this.PromiseStatus = FULFILLED
          this.PromiseValue = val
          runResolveCallbackQueues(val)
        }, (err) => {
          this.PromiseStatus = REJECTED
          this.PromiseValue = err
          runRejectCallbackQueues(err)
        })
      } else {
        // 传参正常时执行
        this.PromiseStatus = FULFILLED
        this.PromiseValue = value
        runResolveCallbackQueues(value)
      }
    }

    // 同步调用转为异步调用
    window.setTimeout(_resolve, 0)
  }

  reject = (value) => {
    if (this.PromiseStatus !== PENDING) { return; }

    const _reject = () => {
      this.PromiseStatus = REJECTED;
      this.PromiseValue = value;

      let fn;
      while (this.rejectCallbackQueues.length) {
        fn = this.rejectCallbackQueues.shift();
        fn(value);
      }
    }

    // 支持异步调用
    window.setTimeout(_reject, 0)
  }

  /**
   * 支持链式调用的 then
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
   * @param {Function} onFulfilled
   * @param {Function} onRejected
   */
  then(onFulfilled, onRejected) {
    const { PromiseValue, PromiseStatus } = this;

    return new PromiseLike((onFulfilledNext, onRejectedNext) => {
      const fulfilled = (data) => {
        try {
          if (isFunction(onFulfilled)) {
            // 顺利流程，从上一个 promise 状态里获取结果。再传给下一个调用
            // 但需要考虑结果是 promise 的特殊情况，此时需要等 res 结束，然后继续调用
            const res = onFulfilled(data);
            if (res instanceof PromiseLike) {
              res.then(onFulfilledNext, onRejectedNext)
            } else {
              onFulfilledNext(res);
            }
          } else {
            // 当 onFulfilled 不是函数的时候，但它已经是 fulfilled 状态时，直接跳过，执行当前的 resolve 回调
            onFulfilledNext(data);
          }
        } catch (error) {
          onRejectedNext(error);
        }
      };

      const rejected = (data) => {
        try {
          if (isFunction(onRejected)) {
            const res = onRejected(data);
            if (res instanceof PromiseLike) {
              res.then(onFulfilledNext, onRejectedNext)
            } else {
              onRejectedNext(res);
            }
          } else {
            // 类同上面 resolve 里不是函数的情况，但此时将这次的值传给下个 promise.then 作为参数
            onFulfilledNext(data);
          }
        } catch (error) {
          onRejectedNext(data);
        }
      };

      // pending 状态时保存回调函数
      switch (PromiseStatus) {
        case PENDING:
          this.resolveCallbackQueues.push(fulfilled);
          this.rejectCallbackQueues.push(rejected);
          break;
        case FULFILLED:
          fulfilled(PromiseValue);
          break;
        case REJECTED:
          rejected(PromiseValue);
          break;
        default:
          break;
      }
    });
  }

  /**
   * 对 then 的再次封装
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
   * @param {Function} onRejected
   */
  catch(onRejected) {
    return this.then(undefined, onRejected)
  }

  /**
   * 不管结果如何都会执行，而且不论是否返回，resolve 或 reject 的值会保存
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
   * @param {Function} fn
   */
  finally(fn) {
    return this.then(
      value => PromiseLike.resolve(fn()).then(() => value),
      err => PromiseLike.resolve(fn()).then(() => { throw err })
    )
  }
}
