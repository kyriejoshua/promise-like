const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

const isFunction = fn => typeof fn === 'function';

export default class PromiseLike {
  constructor(executor) {
    if (!isFunction(executor)) {
      throw new Error('PromiseLike must accept a function as parameter!');
    }

    this.status = PENDING;
    this.value = undefined;

    try {
      executor(this.resolve.bind(this), this.reject.bind(this));
    } catch (error) {
      this.reject(error);
    }
  }

  resolve(value) {
    if (this.status !== PENDING) { return; }
    this.status = FULFILLED;
    this.value = value;
  }

  reject(value) {
    if (this.status !== PENDING) { return; }
    this.status = REJECTED;
    this.value = value;
  }
}
