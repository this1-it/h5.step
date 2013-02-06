var should = require('should');
var step = require('../lib');

/**
 * Returns the `arguments` as an `Array`.
 *
 * @param {Arguments} args
 * @return {Array}
 */
function aaa(args)
{
  return Array.prototype.slice.call(args);
}

describe("step", function()
{
  it("should do nothing if no steps are specified", function()
  {
    step();
  });

  it("should do nothing if an empty steps array is specified", function()
  {
    step([]);
  });

  it("should execute a single step synchronously", function()
  {
    var called = 0;

    step(
      function step1()
      {
        ++called;
      }
    );

    called.should.be.equal(1);
  });

  it("should execute all steps synchronously if no actions were used", function()
  {
    var actual = [];

    step(
      function step1()
      {
        actual.push(1);
      },
      function step2()
      {
        actual.push(2);
      },
      function step3()
      {
        actual.push(3);
      }
    );

    actual.should.be.eql([1, 2, 3]);
  });

  it("should pass no arguments to the first step", function()
  {
    var actual;

    step(
      function step1()
      {
        actual = aaa(arguments);
      }
    );

    should.exist(actual);
    actual.should.be.eql([]);
  });

  it("should pass no arguments to the next step if no action was used", function()
  {
    var actual;

    step(
      function step1()
      {

      },
      function step2()
      {
        actual = aaa(arguments);
      }
    );

    should.exist(actual);
    actual.should.be.eql([]);
  });

  it("should not catch exceptions", function()
  {
    function test()
    {
      step(
        function step1()
        {
          throw new Error();
        }
      );
    }

    test.should.throw();
  });

  it("should not execute any more steps after an exception", function()
  {
    var visited = [];

    function test()
    {
      step(
        function step1()
        {
          visited.push(1);
        },
        function step2()
        {
          visited.push(2);

          throw new Error();
        },
        function step3()
        {
          visited.push(3);
        }
      );
    }

    test.should.throw();
    visited.should.be.eql([1, 2])
  });

  it("should have the same context across all steps", function()
  {
    var visited;

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

        visited = this.visited;
      }
    );

    should.exist(visited);
    visited.should.be.eql([1, 2, 3]);
  });

  describe("next()", function()
  {
    it("should not proceed to the next step if the callback was not invoked", function()
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);
        },
        function step2()
        {
          visited.push(2);

          this.next();
        },
        function step3()
        {
          visited.push(3);
        }
      );

      visited.should.be.eql([1, 2]);
    });

    it("should proceed to the next step on the next tick if the callback was invoked synchronously", function(done)
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          this.next()();

          visited.push(10);
        },
        function step2()
        {
          visited.push(2);

          this.next()();

          visited.push(20);
        },
        function step3()
        {
          visited.should.be.eql([1, 10, 2, 20]);

          done();
        }
      );
    });

    it("should throw an Error if any action was already used", function()
    {
      function testWith(action)
      {
        return function()
        {
          step(
            function step1()
            {
              this[action]();
              this.next();
            }
          );
        };
      }

      testWith('skip').should.throw();
      testWith('done').should.throw();
      testWith('parallel').should.throw();
      testWith('group').should.throw();
      testWith('next').should.throw();
    });

    it("should throw an Error if used after next() invoked synchronously", function()
    {
      function test()
      {
        step(
          function step1()
          {
            this.next()();
            this.next();
          }
        );
      }

      test.should.throw();
    });

    it("should ignore multiple callback resolutions", function(done)
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          var cb = this.next();

          cb();
          cb();
          cb();

          visited.push(10);
        },
        function step2()
        {
          visited.push(2);
        },
        function step3()
        {
          visited.should.be.eql([1, 10, 2]);

          done();
        }
      );
    });

    it("should pass the specified arguments to the next step if resolved synchronously", function(done)
    {
      step(
        function step1()
        {
          this.next()(1, 2, 3);
        },
        function step2()
        {
          arguments.should.be.eql([1, 2, 3]);

          done();
        }
      );
    });

    it("should pass the specified arguments to the next step if resolved asynchronously", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.next().bind(null, 1, 2, 3), 1);
        },
        function step2()
        {
          arguments.should.be.eql([1, 2, 3]);

          done();
        }
      );
    });
  });

  describe("skip()", function()
  {
    it("should throw an Error if any action was already used", function()
    {
      function testWith(action)
      {
        return function()
        {
          step(
            function step1()
            {
              this[action]();
              this.skip();
            }
          );
        };
      }

      testWith('done').should.throw();
      testWith('next').should.throw();
      testWith('parallel').should.throw();
      testWith('group').should.throw();
      testWith('skip').should.throw();
    });

    it("should do nothing if invoked in the last step", function()
    {
      step(
        function step1()
        {
          this.skip();
        }
      );
    });

    it("should jump to the last step synchronously", function()
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          this.skip();
        },
        function step2()
        {
          visited.push(2);
        },
        function step3()
        {
          visited.push(3);
        },
        function step4()
        {
          visited.push(4);
        }
      );

      visited.should.be.eql([1, 4]);
    });

    it("should jump to the last step after the current step finishes", function()
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          this.skip();

          visited.push(10);
        },
        function step2()
        {
          visited.push(2);
        },
        function step3()
        {
          visited.push(3);
        }
      );

      visited.should.be.eql([1, 10, 3]);
    });

    it("should pass the specified argument", function(done)
    {
      step(
        function step1()
        {
          this.skip(1);
        },
        function step2()
        {
          throw new Error("Should not be invoked!");
        },
        function step3(a)
        {
          a.should.be.eql(1);

          done();
        }
      );
    });

    it("should pass the specified 2 arguments", function(done)
    {
      step(
        function step1()
        {
          this.skip(1, 2);
        },
        function step2()
        {
          throw new Error("Should not be invoked!");
        },
        function step3(a, b)
        {
          a.should.be.eql(1);
          b.should.be.eql(2);

          done();
        }
      );
    });

    it("should pass the specified multiple arguments", function(done)
    {
      step(
        function step1()
        {
          this.skip(1, 2, 3, 4, 5);
        },
        function step2()
        {
          throw new Error("Should not be invoked!");
        },
        function step3()
        {
          aaa(arguments).should.be.eql([1, 2, 3, 4, 5]);

          done();
        }
      );
    });
  });

  describe("done()", function()
  {
    it("should throw an Error if any action was already used", function()
    {
      function testWith(action)
      {
        return function()
        {
          step(
            function step1()
            {
              this[action]();
              this.done();
            }
          );
        };
      }

      testWith('next').should.throw();
      testWith('skip').should.throw();
      testWith('parallel').should.throw();
      testWith('group').should.throw();
      testWith('done').should.throw();
    });

    it("should invoke the specified function", function(done)
    {
      step(
        function step1()
        {
          this.done(done);
        }
      );
    });

    it("should pass the specified arguments", function(done)
    {
      function assert()
      {
        aaa(arguments).should.be.eql([1, 2, 3, 4]);

        done();
      }

      step(
        function step1()
        {
          this.done(assert, 1, 2, 3, 4);
        }
      )
    });

    it("should not execute the remaining steps", function()
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          this.done();
        },
        function step2()
        {
          visited.push(2);
        },
        function step3()
        {
          visited.push(3);
        }
      );

      visited.should.be.eql([1]);
    });

    it("should ignore the callback argument if it is not a function", function()
    {
      var visited = [];

      step(
        function step1()
        {
          visited.push(1);

          this.done("not a function");
        },
        function step2()
        {
          visited.push(2);
        },
        function step3()
        {
          visited.push(3);
        }
      );

      visited.should.be.eql([1]);
    });
  });

  describe("parallel()", function()
  {
    it("should throw an Error if any other action was already used", function()
    {
      function testWith(action)
      {
        return function()
        {
          step(
            function step1()
            {
              this[action]();
              this.parallel();
            }
          );
        };
      }

      testWith('next').should.throw();
      testWith('skip').should.throw();
      testWith('done').should.throw();
      testWith('group').should.throw();
    });

    it("should work with single synchronous callback", function(done)
    {
      step(
        function step1()
        {
          this.parallel()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should work with single asynchronous callback", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.parallel(), 1);
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step if every callback is resolved synchronously", function(done)
    {
      step(
        function step1()
        {
          this.parallel()();
          this.parallel()();
          this.parallel()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step after every callback is resolved asynchronously", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.parallel(), 1);
          setTimeout(this.parallel(), 1);
          setTimeout(this.parallel(), 1);
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step after every sync and async callback is resolved", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.parallel(), 1);
          this.parallel()();
          setTimeout(this.parallel(), 1);
          this.parallel()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should pass the first truthy value from the first arguments", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.parallel(), 1);
          this.parallel()(null);
          setTimeout(this.parallel(), 1, 'error 3');
          this.parallel()('error 4');
        },
        function step2(err)
        {
          err.should.be.eql('error 3');

          done();
        }
      );
    });

    it("should pass the values of the second argument of each callback in order as individual arguments", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.parallel(), 40, null, 1);
          this.parallel()(null, 2);
          setTimeout(this.parallel(), 20, null, 3);
          this.parallel()(null, 4);
        },
        function step2()
        {
          aaa(arguments).should.be.eql([null, 1, 2, 3, 4]);

          done();
        }
      );
    });
  });

  describe("group()", function()
  {
    it("should throw an Error if any other action was already used", function()
    {
      function testWith(action)
      {
        return function()
        {
          step(
            function step1()
            {
              this[action]();
              this.group();
            }
          );
        };
      }

      testWith('next').should.throw();
      testWith('skip').should.throw();
      testWith('done').should.throw();
      testWith('parallel').should.throw();
    });

    it("should work with single synchronous callback", function(done)
    {
      step(
        function step1()
        {
          this.group()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should work with single asynchronous callback", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.group(), 1);
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step if every callback is resolved synchronously", function(done)
    {
      step(
        function step1()
        {
          this.group()();
          this.group()();
          this.group()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step after every callback is resolved asynchronously", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.group(), 1);
          setTimeout(this.group(), 1);
          setTimeout(this.group(), 1);
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should go to the next step after every sync and async callback is resolved", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.group(), 1);
          this.group()();
          setTimeout(this.group(), 1);
          this.group()();
        },
        function step2()
        {
          done();
        }
      );
    });

    it("should pass the first truthy value from the first arguments", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.group(), 1);
          this.group()(null);
          setTimeout(this.group(), 1, 'error 3');
          this.group()('error 4');
        },
        function step2(err)
        {
          err.should.be.eql('error 3');

          done();
        }
      );
    });

    it("should pass the values of the second argument of each callback in order as an array", function(done)
    {
      step(
        function step1()
        {
          setTimeout(this.group(), 25, null, 1);
          this.group()(null, 2);
          setTimeout(this.group(), 15, null, 3);
          this.group()(null, 4);
        },
        function step2()
        {
          aaa(arguments).should.be.eql([null, [1, 2, 3, 4]]);

          done();
        }
      );
    });
  });
});
