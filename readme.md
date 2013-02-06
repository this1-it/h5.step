# h5.step

Flow control for node.js and the browser.

## Installation

```
npm install h5.step
```

## Usage

Require the `h5.step` module:

```js
var step = require('h5.step');
```

Call the `step()` function with individual step functions as arguments:

```js
step(
  function step1()
  {
    console.log("Step 1");
  },
  function step2()
  {
    console.log("Step 2");
  },
  function step3()
  {
    console.log("Step 3");
  }
);
```

Each step is executed in a shared context (`this` variable). That context is an
object with a few predefined properties (actions) that are used to change
the control flow (see API). Only one type of action can be used per step, i.e.
one cannot call `done()` and then `next()` in the same step function.
For example, this is invalid (`done()` AND `next()` are called):

```js
function stepN()
{
  this.done();
  this.next();
}
```

But this is allowed (`done()` OR `next()` is called):

```js
function stepN(err)
{
  if (err)
  {
    return this.done();
  }

  setTimeout(this.next(), 1000);
}
```

One can also set custom properties on the context object in one step
and use them in the next steps:

```js
step(
  function step1()
  {
    this.visited = [1];
  },
  function step2()
  {
   this.visited.push(2);
  },
  function step3()
  {
    this.visited.push(3);

    console.log("Visited: %s", this.visited.join(', '));
  }
);
```

Differently from other flow control libraries, `h5.step` doesn't catch any
exceptions to pass them as the first argument to the next step.

## Usage in a browser (AMD only)

To use the library in a browser, one must install the development dependencies
(or have [r.js](https://github.com/jrburke/r.js/) available in `PATH`):

```
cd node_modules/h5.step/
npm install
```

And then run the `amd` script:

```
npm run-script amd
```

Copy the `lib-amd/h5.step/` directory to your project.

## API

### next()

Returns a function that must be called before the next step is executed.
All arguments specified to that function will be passed as arguments to
the next step.

The callback can be resolved asynchronously as well as synchronously. Even if
the callback was resolved synchronously, the next step will be executed after
the current step has finished executing.

Only one `next()` call can be used per step function (as opposed to `group()`
or `parallel()`).

Should be used when only one operation must be run before executing the next
step.

```js
var step = require('h5.step');

step(
  function step1()
  {
    setTimeout(this.next(), 1000, 'foo');

    console.log("#1");
  },
  function step2(a)
  {
    console.log("#2 a=%s", a);

    setTimeout(this.next(), 1000, a, 'bar');
  },
  function step3(a, b)
  {
    console.log("#3 a=%s b=%s", a, b);
  }
);

// Should result in:
// #1
// #2 a=foo
// #3 a=foo b=bar
```

### skip()

Skips to the last step when the current one finishes executing. All arguments
specified to `skip()` will be passed as arguments to the last step.

Can be used to delegate the error handling to the last step.

```js
var step = require('h5.step');

step(
  function step1()
  {
    this.skip("Hello World!");

    console.log("#1");
  },
  function step2(a)
  {
    console.log("#2");
  },
  function step3(a)
  {
    console.log("#3: %s", a);
  }
);

// Should result in:
// #1
// #3: Hello World!
```

### done()

Invokes the specified callback when the current step finishes executing and
stops executing any other steps. All arguments after the first one will be
passed as arguments to the specified callback. If no callback was specified or
the first argument is not a function, then simply stops the chain of execution.

Should be used to early call an external callback in case of an error.

```js
var step = require('h5.step');

function cb(message)
{
  console.log(message);
}

step(
  function step1()
  {
    this.done(cb, "Done!");

    console.log("#1");
  },
  function step2()
  {
    console.log("#2");
  },
  function step3()
  {
    console.log("#3");
  }
);

// Should result in:
// #1
// Done!
```

### parallel()

Returns a function that must be called before the next step is executed. Can
be used multiple times (as opposed to `next()`) and in that case, the next
step is executed only after all functions have been called.

The callbacks are expected to be called with at most two arguments, where the
first one is an `Error` (or `null`) and the second - a result of the operation.

`parallel()` collects arguments of all callbacks and when they're all resolved,
the next step is called with the first truthy argument value of any callback as
the first argument and the next arguments as values of the second argument of
each callback (in order of `parallel()` calls).

Should be used when multiple, fixed number of operations must be run before
executing the next step.

`parallel()` differs from `group()` only in a way the resulting values are
passed to the next step.

```js
var step = require('h5.step');

step(
  function step1()
  {
    console.log("#1.0");

    setTimeout(this.parallel(), 200, null, 1);
    setTimeout(this.parallel(), 400, null, 2);
    setTimeout(this.parallel(), 600, '#3', 3);
    setTimeout(this.parallel(), 800, null, 4);

    console.log("#1.1");
  },
  function step2(err, a, b, c, d)
  {
    console.log("err=%s a=%d b=%d c=%d d=%d", err, a, b, c, d);
  }
);

// Should result in:
// #1.0
// #1.1
// err=#3 a=1 b=2 c=3 d=4
```

### group()

Returns a function that must be called before the next step is executed. Can
be used multiple times (as opposed to `next()`) and in that case, the next
step is executed only after all functions have been called.

The callbacks are expected to be called with at most two arguments, where the
first one is an `Error` (or `null`) and the second - a result of the operation.

`group()` collects arguments of all callbacks and when they're all resolved,
the next step is called with the first truthy argument value of any callback as
the first argument, and an array of results (in order of `group()` calls)
as the second argument.

Should be used when dynamic number of operations must be run before executing
the next step.

`group()` differs from `parallel()` only in a way the resulting values are
passed to the next step.

```js
var step = require('h5.step');

step(
  function step1()
  {
    console.log("#1.0");

    for (var i = 1; i <= 4; ++i)
    {
      setTimeout(this.group(), i * 200, i === 3 ? '#3' : null, i);
    }

    console.log("#1.1");
  },
  function step2(err, results)
  {
    console.log("err=%s results=[%s]", err, results.join(', '));
  }
);

// Should result in:
// #1.0
// #1.1
// err=#3 results=[1, 2, 3, 4]
```

## Tests

To run the tests, clone the repository:

```
git clone git://github.com/morkai/h5.step.git
```

Install the development dependencies:

```
cd h5.step/
npm install
```

And execute the `test` script:

```
npm test
```

To also generate the code coverage report, include the `--coverage` argument:

```
npm test --coverage
```

The coverage report will be generated to `coverage/` directory and can be viewed
in the browser by opening the `h5.step/coverage/lcov-report/index.html` file.

## License

This project is released under the
[MIT License](https://raw.github.com/morkai/h5.step/master/license.md).
