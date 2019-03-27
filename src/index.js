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
}
