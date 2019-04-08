// 既定状态
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

/**
 * 校验是否是函数
 * @param {*} fn
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
   * 只要有一个 promise 返回，则返回结果
   * @param {*} list
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
    this.status = PENDING;
    this.value = undefined;

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
    if (this.status !== PENDING) { return; }
    this.status = FULFILLED;
    this.value = value;

    // 符合状态时调用队列中的方法
    let fn;
    while (this.resolveCallbackQueues.length) {
      fn = this.resolveCallbackQueues.shift();
      fn(value);
    }
  }

  reject = (value) => {
    if (this.status !== PENDING) { return; }
    this.status = REJECTED;
    this.value = value;

    let fn;
    while (this.rejectCallbackQueues.length) {
      fn = this.rejectCallbackQueues.shift();
      fn(value);
    }
  }

  then(onFulfilled, onRejected) {
    const { value, status } = this;

    return new PromiseLike((onFulfilledNext, onRejectNext) => {
      const fulfilled = (data) => {
        try {
          if (isFunction(onFulfilled)) {
            // 顺利流程，从上一个 promise 状态里获取结果。再传给下一个调用
            const res = onFulfilled(data);
            onFulfilledNext(res);
          } else {
            // 当 onFulfilled 不是函数的时候，但它已经是 fulfilled 状态时，直接跳过，执行当前的 resolve 回调
            onFulfilledNext(data);
          }
        } catch (error) {
          onRejectNext(error);
        }
      };

      const rejected = (data) => {
        try {
          if (isFunction(onRejected)) {
            const res = onRejected(data);
            onRejectNext(res);
          } else {
            // 类同上面 resolve 里不是函数的情况，但此时将这次的值传给下个 promise.then 作为参数
            onFulfilledNext(data);
          }
        } catch (error) {
          onRejectNext(data);
        }
      };

      switch (status) {
        case PENDING:
          this.resolveCallbackQueues.push(fulfilled);
          this.rejectCallbackQueues.push(rejected);
          break;
        case FULFILLED:
          fulfilled(value);
          break;
        case REJECTED:
          rejected(value);
          break;
        default:
          break;
      }
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected)
  }
}
