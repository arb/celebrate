/**
 * Reverse argument order (lodash-compatible flip for variadic calls).
 */
function flip(fn) {
  return function flipped(...args) {
    return fn.apply(this, [...args].reverse());
  };
}

/**
 * Curry a function to arity `n` (lodash-compatible partial application).
 */
function curry(fn, arity) {
  return function curried(...args) {
    if (args.length >= arity) {
      return fn.apply(this, args.slice(0, arity));
    }
    return function curriedPartial(...more) {
      return curried.apply(this, args.concat(more));
    };
  };
}

module.exports = {
  curry,
  flip,
};
