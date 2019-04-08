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
promiseA.then((data) => {
  console.info(data++)
  return data
})
.then((data) => {
  console.info(data++)
})

// race
const promiseB = new PromiseLike((resolve, reject) => {
  setTimeout(() => {
    resolve('B');
  }, 1000);
});
PromiseLike.race([promiseA, promiseB])
.then((res) => {
  console.info(res) // expected output: 'B'
})

// all
const promiseC = '3C'
PromiseLike.all([promiseA, promiseB, promiseC])
.then((res) => {
  console.info(res) // expected output: Array [0, 'B', '3C']
})
```
