
module.exports = step;

var ACTION_NONE = 'none';
var ACTION_NEXT = 'next';
var ACTION_SKIP = 'skip';
var ACTION_DONE = 'done';
var ACTION_GROUP = 'group';
var ACTION_PARALLEL = 'parallel';

var slice = Array.prototype.slice;

function step()
{
  var steps = Array.isArray(arguments[0]) ? arguments[0] : arguments;
  var stepsNumber = steps.length;

  if (stepsNumber === 0)
  {
    return;
  }

  var currentStepIndex = -1;
  var nextAction = ACTION_NONE;
  var nextActionArgs = null;
  var deferred = false;
  var deferredArgs = null;
  var totalCallbacks = 0;
  var resolvedCallbacks = 0;
  var callbacksArgs = null;

  var context = {};

  Object.defineProperties(context, {
    next: {
      value: function()
      {
        if (currentStepIndex !== -1)
        {
          assertAction(ACTION_NEXT, nextAction);

          nextAction = ACTION_NEXT;
        }

        return nextStep;
      }
    },
    skip: {
      value: function()
      {
        assertAction(ACTION_SKIP, nextAction);

        nextAction = ACTION_SKIP;
        nextActionArgs = arguments;
      }
    },
    done: {
      value: function()
      {
        assertAction(ACTION_DONE, nextAction);

        nextAction = ACTION_DONE;
        nextActionArgs = arguments;
      }
    },
    parallel: {
      value: function()
      {
        if (nextAction === ACTION_PARALLEL)
        {
          ++totalCallbacks;
        }
        else
        {
          assertAction(ACTION_PARALLEL, nextAction);

          nextAction = ACTION_PARALLEL;

          totalCallbacks = 1;
          resolvedCallbacks = 0;
          callbacksArgs = [];
        }

        var callbackId = totalCallbacks - 1;

        return function()
        {
          callbacksArgs[callbackId] = slice.call(arguments);

          ++resolvedCallbacks;

          if (nextAction === ACTION_NONE
            && resolvedCallbacks === totalCallbacks)
          {
            nextStepWithParallelArgs();
          }
        };
      }
    },
    group: {
      value: function()
      {
        if (nextAction === ACTION_GROUP)
        {
          ++totalCallbacks;
        }
        else
        {
          assertAction(ACTION_GROUP, nextAction);

          nextAction = ACTION_GROUP;

          totalCallbacks = 1;
          resolvedCallbacks = 0;
          callbacksArgs = [];
        }

        var callbackId = totalCallbacks - 1;

        return function()
        {
          callbacksArgs[callbackId] = slice.call(arguments);

          ++resolvedCallbacks;

          if (nextAction === ACTION_NONE
            && resolvedCallbacks === totalCallbacks)
          {
            nextStepWithGroupArgs();
          }
        };
      }
    }
  });

  function nextStep()
  {
    if (nextAction !== ACTION_NONE)
    {
      if (deferred)
      {
        return;
      }

      deferred = true;
      deferredArgs = slice.call(arguments);

      return process.nextTick(function()
      {
        nextAction = ACTION_NONE;

        var args = deferredArgs;

        deferred = false;
        deferredArgs = null;

        return nextStep.apply(null, args);
      });
    }

    ++currentStepIndex;

    if (currentStepIndex >= stepsNumber)
    {
      return;
    }

    var step = steps[currentStepIndex];

    step.apply(context, arguments);

    var resultAction = nextAction;
    var resultActionArgs = nextActionArgs;

    nextAction = ACTION_NONE;
    nextActionArgs = null;

    switch (resultAction)
    {
      case ACTION_NEXT:
        return;

      case ACTION_NONE:
        return nextStep();

      case ACTION_SKIP:
      {
        var lastStepIndex = stepsNumber - 1;

        if (currentStepIndex < lastStepIndex)
        {
          currentStepIndex = lastStepIndex - 1;

          return nextStep.apply(null, slice.call(resultActionArgs));
        }

        break;
      }

      case ACTION_DONE:
      {
        if (resultActionArgs.length === 0)
        {
          return;
        }

        var cb = resultActionArgs[0];

        if (typeof cb !== 'function')
        {
          return;
        }

        return cb.apply(null, slice.call(resultActionArgs, 1));
      }

      case ACTION_PARALLEL:
        if (totalCallbacks === resolvedCallbacks)
        {
          return nextStepWithParallelArgs();
        }
        break;

      case ACTION_GROUP:
        if (totalCallbacks === resolvedCallbacks)
        {
          return nextStepWithGroupArgs();
        }
        break;
    }
  }

  function nextStepWithParallelArgs()
  {
    var args = [null];

    for (var callbackId = 0; callbackId < totalCallbacks; ++callbackId)
    {
      var callbackArgs = callbacksArgs[callbackId];

      if (args[0] === null && callbackArgs[0])
      {
        args[0] = callbackArgs[0];
      }

      args.push(callbackArgs[1]);
    }

    nextStep.apply(null, args);
  }

  function nextStepWithGroupArgs()
  {
    var err = null;
    var args = [];

    for (var callbackId = 0; callbackId < totalCallbacks; ++callbackId)
    {
      var callbackArgs = callbacksArgs[callbackId];

      if (err === null && callbackArgs[0])
      {
        err = callbackArgs[0];
      }

      args.push(callbackArgs[1]);
    }

    nextStep.call(null, err, args);
  }

  nextStep();
}

/**
 * @param {string} requestedAction
 * @param {string} nextAction
 * @throws {Error}
 */
function assertAction(requestedAction, nextAction)
{
  if (nextAction !== ACTION_NONE)
  {
    throw new Error(
      requestedAction
        + "() cannot be used because "
        + nextAction
        + "() was already invoked."
    );
  }
}
