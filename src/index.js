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
  static resolve(value) {
    // 当 race, all 等方法调用时，传入的入参是 promise, 无需再封装
    if (value instanceof PromiseLike) { return value }
    return new PromiseLike(resolve => resolve(value))
  }

  static reject(value) {
    return new PromiseLike((resolve, reject) => reject(value))
  }

  /**
   * 只要有一个 promise 返回，则返回结果，注意，不是数组而是最先 resolve 的值
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
   * @param {Array} list
   */
  static all(list) {
    return new PromiseLike((resolve, reject) => {
      let resolvedCount = 0; // 判断何时结束，处理结果 resolve it
      let promiseList = [] // 保存最终的所有的值
      list.map((promise, index) => {
        this.resolve(promise)
        .then((res) => {
          promiseList[index] = res
          resolvedCount++
          // 判断的时机必须在 promise 内，否则在外面的话，同步执行后无法判断是否执行完毕
          if (resolvedCount === list.length) {
            resolve(promiseList)
          }
        })
        .catch((err) => {
          reject(err)
        })
      })
    })
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

  reject = (value) => {
    if (this.PromiseStatus !== PENDING) { return; }
    this.PromiseStatus = REJECTED;
    this.PromiseValue = value;

    let fn;
    while (this.rejectCallbackQueues.length) {
      fn = this.rejectCallbackQueues.shift();
      fn(value);
    }
  }

  /**
   * 支持链式调用的 then
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
   * @param {Function} onRejected
   */
  catch(onRejected) {
    return this.then(undefined, onRejected)
  }

  /**
   * 不管结果如何都会执行 TODO
   * @param {Function} fn
   */
  finally(fn) {
    return this.then(
      value => PromiseLike.resolve(fn()).then(() => value),
      err => Promise.reject(fn()).then(() => { throw err })
    )
  }
}
