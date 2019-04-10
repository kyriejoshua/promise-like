## Promise like

* A promise library like promise.
* node v11.2.0

### Usage

* A simple example.

```javascript
const promiseA = new PromiseLike((resolve, reject) => {
  let num = 0;
  setTimeout(() => {
    resolve(num);
  }, 3000);
});

// then
const promiseA1 = promiseA.then(data => ++data)
console.info(promiseA1)

// race
const promiseB = new PromiseLike((resolve, reject) => {
  setTimeout(() => {
    resolve('B');
  }, 1000);
});
PromiseLike.race([promiseA, promiseB])
.then(res => console.info(res)) // expected output: 'B'

// all
const promiseC = '3C'
PromiseLike.all([promiseA, promiseB, promiseC])
.then(res => console.info(res)) // expected output: Array [0, 'B', '3C']
```
