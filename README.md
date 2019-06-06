## Promise like

* A promise library like promise.
* node v11.2.0

### Usage

* A simple example.

```javascript
const promiseA = new PromiseLike((resolve, reject) => {
  setTimeout(() => {
    console.info('A');
    resolve('A');
  }, 3000);
});

console.info(PromiseLike.is(1), PromiseLike.is(PromiseLike.resolve()), PromiseLike.is(Promise.resolve()), promiseA) // expected output: false true false true

// then
const promiseA1 = promiseA.then(data => `${data}1`)
console.info(promiseA1)

// race
const promiseB = new PromiseLike((resolve, reject) => {
  setTimeout(() => {
    console.info('B');
    resolve('B');
  }, 1000);
});
PromiseLike.race([promiseA, promiseB])
.then(res => console.info(res)) // expected output: 'B'

// all
const promiseC = '3C'
PromiseLike.all([promiseA, promiseB, promiseC])
.then(res => console.info(res)) // expected output: Array [0, 'B', '3C', duringTime: '123ms']

const createPromise = (timer, index) => () =>
  new PromiseLike((resolve) => {
    window.setTimeout(() => {
      console.info(`promise${index}`, new Date())
      resolve()
    }, timer)
  })

// sequence
PromiseLike.sequence([createPromise(300, 1), createPromise(200, 2), createPromise(100, 3)])
.then(res => console.info(res)) // expected output: promise1, promise2, promise3

// finally
const finallyResolved = PromiseLike.resolve(4).finally(() => {}) // expected output: fulfilled: 4
const finallyRejected = PromiseLike.reject(444).finally(() => {}) // expected output: rejected: 444
console.info('finallyResolved', `${finallyResolved.PromiseStatus}: ${finallyResolved.PromiseValue}`)
console.info('finallyRejected', `${finallyRejected.PromiseStatus}: ${finallyRejected.PromiseValue}`)
// 早先的版本里是同步调用时，结果如上是实时输出的
// 最新版改为异步调用，在异步进程后显示结果
window.setTimeout(() => {
  console.info('finallyResolved', `${finallyResolved.PromiseStatus}: ${finallyResolved.PromiseValue}`)
  console.info('finallyRejected', `${finallyRejected.PromiseStatus}: ${finallyRejected.PromiseValue}`)
}, 10)
```

### Other

* [Promise/A+](https://promisesaplus.com)
* [ecma262](https://tc39.github.io/ecma262/#sec-promise-objects)
