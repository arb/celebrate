<h1 align="center">
  Lite Celebrate
</h1>

<h2 align="center">
  <a href="https://www.npmjs.org/package/celebrate">
      <img alt="npm" src="https://flat.badgen.net/npm/v/celebrate?icon=npm">
  </a>

  <a href="https://travis-ci.org/arb/celebrate">
      <img alt="npm" src="https://flat.badgen.net/travis/arb/celebrate?icon=travis">
  </a>

  <a href="https://github.com/airbnb/javascript">
      <img alt="npm" src="https://flat.badgen.net/badge/eslint/airbnb/ff5a5f?icon=airbnb">
  </a>

  <a href="https://codecov.io/gh/arb/celebrate">
      <img alt="npm" src="https://flat.badgen.net/codecov/c/github/arb/celebrate?icon=codecov">
  </a>
</h2>

A fork from [arb/celebrate](https://github.com/arb/celebrate)

Quoted from [arb/celebrate](https://github.com/arb/celebrate) docs
> celebrate lists joi as a formal dependency. This means that celebrate will always use a predictable, known version of joi during the validation and compilation steps. There are two reasons for this:
> 1. To ensure that celebrate can always use the latest version of joi as soon as it's published
> 2. So that celebrate can export the version of joi it uses to the consumer to maximize compatibility

While understanding the motive behind this decision, coupling `Joi` within the lib and being forced to use it from `celebrate` doesn't seem like a good idea for me, this fork declares `joi` as a peer dependency, allowing injecting your own `joi` version

## Docs
Refer to the [original docs](https://github.com/arb/celebrate)
