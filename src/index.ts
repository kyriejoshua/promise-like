/**
 * Promise 内部状态的枚举
 */
enum PROMISE_STATES {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected'
}

type PromiseStates = PROMISE_STATES.PENDING | PROMISE_STATES.FULFILLED | PROMISE_STATES.REJECTED;

export const isFunction = (fn: any):boolean => typeof fn === 'function';
export const isObject = (obj: any):boolean => typeof obj === 'object';

export interface ICallbackFn {
  (value?: any): any;
}

type CallbackParams = ICallbackFn | null;

export interface IExecutorFn {
  (resolve: ICallbackFn, reject: ICallbackFn): any;
}

export interface IPromiseType {
  then: IExecutorFn;
  catch: ICallbackFn;
  finally: ICallbackFn;
}

class PromiseLike implements IPromiseType {
  protected PromiseState: PromiseStates;
  protected PromiseResult: any;

  resolveCallbackQueues: Array<ICallbackFn>;
  rejectCallbackQueues: Array<ICallbackFn>;

  constructor(executor: IExecutorFn) {
    if (!isFunction(executor)) {
      throw new Error('Promise resolver undefined is not a function');
    }
    this.PromiseState = PROMISE_STATES.PENDING;
    this.PromiseResult = undefined;

    // 分别用于两个注册事件保存的数组
    this.resolveCallbackQueues = [];
    this.rejectCallbackQueues = [];

    try {
      executor(this._resolve, this._reject)
    } catch (error) {
      this._reject(error);
    }
  }

  /**
   * 使状态变更为 fulfilled
   * 调用注册的事件，注意调用后进行清除
   * @param value
   * @returns
   */
  _resolve = (value?: any) => {
    const resolveCb = () => {
      if (this.PromiseState !== PROMISE_STATES.PENDING) {
        return;
      }
      while (this.resolveCallbackQueues.length) {
        const fn = this.resolveCallbackQueues.shift();
        fn && fn(value);
      }
      this.PromiseState = PROMISE_STATES.FULFILLED;
      this.PromiseResult = value;
    }

    // 使任务变成异步的
    queueMicrotask(() => resolveCb());
  }

  /**
   * 使状态变更为 rejected
   * @param value
   */
  _reject = (value?: any) => {
    const rejectCb = () => {
      if (this.PromiseState !== PROMISE_STATES.PENDING) {
        return;
      }
      while (this.rejectCallbackQueues.length) {
        const fn = this.rejectCallbackQueues.shift();
        fn && fn(value);
      }
      this.PromiseState = PROMISE_STATES.REJECTED;
      this.PromiseResult = value;
    }

    queueMicrotask(() => rejectCb());
  }

  /**
   * 根据当前不同状态来执行对应逻辑
   * 如果在默认状态就是注册对应事件
   * 如果状态变化则是执行对应事件
   * @param onFulfilled
   * @param onRejected
   * @returns
   */
  then = (onFulfilled?: CallbackParams, onRejected?: CallbackParams) => {
    // 默认处理！！！
    onFulfilled = isFunction(onFulfilled) ? onFulfilled : value => value;
    onRejected = isFunction(onRejected) ? onRejected : err => { throw err };

    /**
     * 该实现遵循 Promise/A+ 规范
     * https://github.com/promises-aplus/promises-spec
     * @param promise
     * @param x
     * @param resolve
     * @param reject
     * @returns
     */
    const resolvePromise = (promise: IPromiseType, x: any, resolve: ICallbackFn, reject: ICallbackFn) => {
      // 返回的 promise 不可以是当前的 promise 否则会造成死循环
      if (newPromise === x) {
        reject(new TypeError('Chaining cycle detected for promise #<Promise>'));
      }
      // 对可能是 thenable 接口实现的对象判断
      if (isObject(x) || isFunction(x)) {
        if (x === null) {
          return resolve(x);
        }
        let thenCb;
        try {
          thenCb = x.then;
        } catch (error) {
          return reject(error);
        }

        // 如果是 thenable 的对象，则调用其 then 方法
        // 这一步涵盖了 Promise 实例的可能性
        if (isFunction(thenCb)) {
          let isCalled = false;
          try {
            thenCb.call(
              x, // 指向当前函数或对象
              (y: any) => {
                // 如果 resolvePromise 和 rejectPromise 都可能被调用
                // 则只需调用第一次（resolvePromise 或 rejectPromise），后续无需再执行
                if (isCalled) return;
                isCalled = true;
                // 传入当前函数，以实现递归展开调用
                resolvePromise(promise, y, resolve, reject);
              },
              (r: any) => {
                // 对应前面任意的调用之后，就不再只需后续逻辑
                if (isCalled) return;
                isCalled = true;
                reject(r);
              }
            )
          } catch (error) {
            if (isCalled) return;
            reject(error);
          }
        } else {
          resolve(x);
        }
      } else {
        resolve(x);
      }
    }

    // 定义变量，用于传参进行比较
    const newPromise = new PromiseLike((resolve, reject) => {
      /**
       * 封装完成回调函数
       * @param val
       */
      const handleFulfilled = (val: any) => {
        try {
          const x = onFulfilled && onFulfilled(val);
          resolvePromise(newPromise, x, resolve, reject);
        } catch (error) {
          // 如果当前执行逻辑内发生异常，则抛出异常
          reject(error);
        };
      };

      /**
       * 封装错误回调函数
       * @param val
       */
      const handleRejected = (val: any) => {
        try {
          const x = onRejected && onRejected(val);
          resolvePromise(newPromise, x, resolve, reject);
        } catch (error) {
          reject(error);
        }
      }

      switch (this.PromiseState) {
        case PROMISE_STATES.PENDING:
          this.resolveCallbackQueues.push(handleFulfilled);
          this.rejectCallbackQueues.push(handleRejected);
          break;
        case PROMISE_STATES.FULFILLED:
          handleFulfilled(this.PromiseResult);
          break;
        case PROMISE_STATES.REJECTED:
          handleRejected(this.PromiseResult);
          break;
      }
    });

    return newPromise;
  }

  /**
   * 错误处理
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
   * @param rejectedCb
   * @returns
   */
  catch = (rejectedCb: CallbackParams) => {
    return this.then(null, rejectedCb);
  }

  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
   * @param finallyCb
   * @returns
   */
  finally = (finallyCb: CallbackParams) => {
    return this.then(
      // 完成回调时，执行注册函数，并且将原来的值传递下去
      // 封装 Promise 类，再调用 then 方法传递
      val => PromiseLike.resolve(finallyCb && finallyCb()).then(() => val),
      // 异常回调时，执行注册函数，并且抛出异常
      err => PromiseLike.resolve(finallyCb && finallyCb()).then(() => { throw err })
    );
  }

  /**
   * 返回相应的类型
   * @returns
   */
  toString() {
    return '[object PromiseLike]'
  }

  /**
   * 判断是否是当前类的实例
   * @param promise
   * @returns
   */
  static is(promise: IPromiseType) {
    return promise instanceof PromiseLike;
  }

  /**
   * 直接实例化 proimse
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
   * @param value
   * @returns
   */
  static resolve(value?: any) {
    if (PromiseLike.is(value)) {
      return value;
    }
    return new PromiseLike((resolve) => resolve(value));
  }

  static reject(value?: any) {
    return new PromiseLike((resolve, reject) => reject(value));
  }

  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
   * @param promises 严格意义上来说，参数是可迭代对象，为了简化实现这里统一成数组
   * @returns
   */
  static all(promises: Array<IPromiseType>) {
    // 支持链式调用
    return new PromiseLike((resolve, reject) => {
      const len = promises.length;
      let resolvedPromisesCount = 0;
      let resolvedPromisesResult = <any>[];
      for (let i = 0; i < len; i++) {
        const currentPromise = promises[i];
        // 如果不是 Promise 实例，则需要包装一份；
        // 但因为直接包装 Promise 类的效果是幂等的，所以这里不需要判断，直接处理即可
        PromiseLike.resolve(currentPromise)
        .then((res: any) => {
          resolvedPromisesCount++;
          resolvedPromisesResult[i] = res;
          // 当所有值都 resolve 之后， 返回对应数组
          if (resolvedPromisesCount === len) {
            resolve(resolvedPromisesResult);
          }
        })
        // 如果有任意一个异常，则直接推出
        .catch((err: any) => {
          reject(err);
        });
      }
    });
  }

  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
   * @param promises
   * @returns
   */
  static race(promises: Array<IPromiseType>) {
    return new PromiseLike((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const currentPromise = promises[i];
        PromiseLike.resolve(currentPromise)
          .then((res: any) => {
            resolve(res);
          })
          .catch((err: any) => {
            reject(err);
          });
      }
    });
  }

  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
   * @param promises 严格意义上来说，参数是可迭代对象，为了简化实现这里统一成数组
   * @returns
   */
   static allSettled(promises: Array<IPromiseType>) {
    // 支持链式调用
    return new PromiseLike((resolve, reject) => {
      const len = promises.length;
      const startTime = Date.now();
      let resolvedPromisesCount = 0;
      let resolvedPromisesResult = <any>[];

      for (let i = 0; i < len; i++) {
        const currentPromise = promises[i];
        // 如果不是 Promise 实例，则需要包装一份；
        // 但因为直接包装 Promise 类的效果是幂等的，所以这里不需要判断，直接处理即可
        PromiseLike.resolve(currentPromise)
        .then((res: any) => {
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
        .catch((err: any) => {
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
      }
    });
  }

  /**
   * 2021 年刚纳入规范的 any
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
   * @param promises
   * @returns
   */
  static any(promises: Array<IPromiseType>) {
    return new PromiseLike((resolve, reject) => {
      const len = promises.length;
      let rejectedPromisesCount = 0;
      let rejectedPromisesResult = <any>[];
      for (let i = 0; i < promises.length; i++) {
        const currentPromise = promises[i];
        PromiseLike.resolve(currentPromise)
          .then((res: any) => {
            resolve(res);
          })
          .catch((err: any) => {
            rejectedPromisesCount++;
            rejectedPromisesResult[i] = err;
            if (rejectedPromisesCount === len) {
              // 如果浏览器支持，则直接抛出这个新对象，否则则直接抛出异常
              if (isFunction(AggregateError)) {
                throw new AggregateError(rejectedPromisesResult, 'All promises were rejected');
              } else {
                throw (rejectedPromisesResult);
              }
            }
          });
      }
    })
  }

  /**
   * 返回最后一个完成的值或者异常
   * @param promises
   * @returns
   */
  static anyLast(promises: Array<IPromiseType>) {
    return new PromiseLike((resolve, reject) => {
      const len = promises.length;
      const startTime = Date.now();
      let resolvedPromisesCount = 0;

      for (let i = 0; i < len; i++) {
        const currentPromise = promises[i];
        PromiseLike.resolve(currentPromise)
        .then((res: any) => {
          resolvedPromisesCount++;
          // 当所有 promises 完成后，返回最后一个值；封装一个属性用于显示执行时间
          if (resolvedPromisesCount === len) {
            isObject(res) && (res.duringTime = Date.now() - startTime + 'ms');
            resolve(res);
          }
        })
        // 如果有任意一个异常，则直接推出
        .catch((err: any) => {
          resolvedPromisesCount++;
          if (resolvedPromisesCount === len) {
            err.duringTime = Date.now() - startTime + 'ms';
            reject(err);
          }
        });
      }
    });
  }

  /**
   * 返回最后一个完成的值，可以自行决定是否忽略异常
   * 如果不忽略，异常优先抛出
   * 如果忽略，返回完成值
   * @param promises
   * @param ignoreRejected
   * @returns
   */
  static last(promises: Array<IPromiseType>, ignoreRejected: boolean = false) {
    return new PromiseLike((resolve, reject) => {
      const len = promises.length;
      const startTime = Date.now();
      let resolvedPromisesCount = 0;

      for (let i = 0; i < len; i++) {
        const currentPromise = promises[i];
        PromiseLike.resolve(currentPromise)
        .then((res: any) => {
          resolvedPromisesCount++;
          // 当所有 promises 完成后，返回最后一个值；封装一个属性用于显示执行时间
          if (resolvedPromisesCount === len) {
            isObject(res) && (res.duringTime = Date.now() - startTime + 'ms');
            resolve(res);
          }
        })
        // 如果有任意一个异常，则直接推出
        .catch((err: any) => {
          if (ignoreRejected) {
            resolvedPromisesCount++;
          } else {
            reject(err)
          }
        });
      }
    });
  }

  /**
   * 把不是 promise 实例的函数包装成 promise 实例
   * 例如 ajax 请求
   * const request = Promise.wrap(ajax);
   * ajax.then(callback);
   * @param fn
   * @returns
   */
  static wrap(fn: any) {
    if (!isFunction(fn)) {
      return fn;
    }
    return function () {
      const args: any[] = Array.prototype.slice.call(arguments);
      return new PromiseLike((resolve) => {
        fn.apply(null, args.concat(function (res: any, err: any) {
          res && resolve(res);
          err && resolve(err);
        }));
      })
    }
  }

  /**
   * 顺序执行传入的普通函数
   * @param promises
   * @returns
   */
  static sequenceWithInit(fns: Array<ICallbackFn>, initValue: number) {
    return fns.reduce((acc, fn: ICallbackFn) => {
      if (!isFunction(fn)) {
        fn = x => x;
      }
      return acc.then(fn).catch((err: any) => { throw err });
    }, PromiseLike.resolve(initValue))
  }

  /**
   * 组合多个函数，返回一个函数来执行
   * @param fns
   * @returns
   */
  static sequence(fns: Array<ICallbackFn>) {
    return (x: number) => fns.reduce((acc, fn: ICallbackFn) => {
      if (!isFunction(fn)) {
        fn = x => x;
      }
      return acc.then(fn).catch((err: any) => { throw err });
    }, PromiseLike.resolve(x));
  }

  /**
   * 串行执行所有 promises,并返回按返回顺序排列的数组
   * 注意接收的参数是返回 promise 实例的函数组成的数组
   * @param promises
   * @returns
   */
  static sequenceByOrder(promises: Array<ICallbackFn>) {
    return new PromiseLike((resolve) => {
      let promiseResults: any = [];
      const reduceRes = promises.reduce((prevPromise, currentPromise: ICallbackFn, currentIndex: number) => {
        return prevPromise.then((val: any) => {
          promiseResults.push(val);
          const newVal = currentPromise(val);
          // 最后一次循环时保存，并剔除第一个值（默认 undefined)
          if (currentIndex === promises.length - 1) {
            promiseResults.unshift();
          }
          return newVal;
        });
      }, PromiseLike.resolve());
      reduceRes.then((val: any) => {
        promiseResults.push(val);
        resolve(promiseResults);
      });
    });
  }

  /**
   * Promise.race([Promise.observe(p, cleanup// 处理函数), timeoutFn //超时函数])
   * @param promise
   * @param fn
   * @returns
   */
  static observe(promise: IPromiseType, fn: ICallbackFn) {
    promise
    .then((res: any) => {
      PromiseLike.resolve(res).then(fn);
    }, (err) => {
      PromiseLike.resolve(err).then(fn);
    });
    return promise;
  }

  /**
   * 对每个 promise 的值进行特定的处理
   * Promise.map([p1, p2, p3], (val, resolve) => {
   *   resolve(val + 1);
   * })
   * @param promises
   * @param fn
   * @returns
   */
  static map(promises: Array<IPromiseType>, fn: any) {
    return PromiseLike.all(promises.map((currentPromise) => {
      return new PromiseLike((resolve) => {
        if (!isFunction(fn)) {
          fn = (val:any, resolve: ICallbackFn) => resolve(val);
        }
        fn(currentPromise, resolve);
      })
    }));
  }

  /**
   * 三方库验证
   * @returns
   */
  static deferred() {
    let defer: any = {};
    defer.promise = new PromiseLike((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });
    return defer;
  }
}

export default PromiseLike;
