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

promiseA.then((data) => {
  console.info(data++)
  return data
})
.then((data) => {
  console.info(data++)
})
```
