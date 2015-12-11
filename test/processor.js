import test from 'tape';
import processor, { ARG_NOT_A_GENERATOR_ERROR } from '../src/processor'

const DELAY = 50;
const later = (val, ms) => new Promise(resolve => {
  setTimeout(() => resolve(val), ms)
})


test('processor output', assert => {
  assert.plan(1);

  try {
    processor(() => {});
  } catch(error) {
    assert.equal(error.message, ARG_NOT_A_GENERATOR_ERROR, 'processor must throw if not provided with a Generator function' );
  }

  try {
    processor(function*() {}, [], () => {});
  } catch(error) {
    assert.fail("processor must not throw if provided with a Generator function");
  }

  assert.end();

});

test('processor output handling', assert => {
  assert.plan(1);

  let actual = [];
  const output = v => actual.push(v)

  const proc = processor(function* genFn(y, arg) {
    yield arg
    yield 2;
  }, ['arg'], output)

  const expected = ['arg', 2];
  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must handle generator output"
    );
    assert.end();
  }, DELAY)

});

test('processor promise handling', assert => {
  assert.plan(1);

  let actual = [];

  function* genFn({ input }) {
    actual.push(yield later(1, 4))
    actual.push(yield later(2, 8))
  }

  const proc = processor(genFn, [], () => {})

  const expected = [1,2];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill promises effects"
    );
    assert.end();
  }, DELAY)

});

test('processor declarative call handling', assert => {
  assert.plan(1);

  let actual = [];

  function* genFn({ call }) {
    actual.push( yield call(later, 1, 4)  )
  }

  const proc = processor(genFn, [], () => {})

  const expected = [1];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill declarative call effects"
    );
    assert.end();
  }, DELAY)

});



test('processor input handling', assert => {
  assert.plan(1);

  let actual = [];

  function* genFn({ input }) {
    actual.push( yield input() )
    actual.push( yield input('action-1') )
    actual.push( yield input('action-2', 'action-2222') )
    actual.push( yield input(a => a.isAction) )
    actual.push( yield input('action-2222') )
  }

  const proc = processor(genFn, [1], () => {})

  Promise.resolve(1)
    .then(() => proc({type: 'action-*'}))
    .then(() => proc({type: 'action-1'}))
    .then(() => proc({type: 'action-2'}))
    .then(() => proc({isAction: true}))
    .then(() => proc({type: 'action-3'}))
    .catch(assert.fail)

  const expected = [{type: 'action-*'}, {type: 'action-1'}, {type: 'action-2'}, {isAction: true}];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill input queries from the generator"
    );
    assert.end();
  }, DELAY)

});

test('processor thunk handling', assert => {
  assert.plan(1);

  let actual = [];

  function* genFn({ input }) {
    try {
      yield () => actual.push('call 1')
      actual.push( yield () => later('call 2', 4) )
      yield cb => { actual.push('call 3'); cb('err') }
      actual.push('call 4')
    } catch(err) {
      actual.push('call ' + err)
    }
  }

  const proc = processor(genFn, [], () => {})

  const expected = ['call 1', 'call 2', 'call 3', 'call err'];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill thunk effects"
    );
    assert.end();
  }, DELAY)

});

test('processor array of effects handling', assert => {
  assert.plan(1);

  let actual;

  function* genFn({ input }) {
    actual = yield [
      later(1, 4),
      () => later(2, 8),
      cb => setTimeout(() => cb(null, 3), 12),
      input('action')
    ]
  }

  const proc = processor(genFn, [], () => {})
  setTimeout(() => proc({type: 'action'}), 5)

  const expected = [1,2,3,{type: 'action'}];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill parallel effects"
    );
    assert.end();
  }, DELAY)

});

test('processor race between effects handling', assert => {
  assert.plan(1);

  let actual = [];

  function* genFn({ race, input }) {
    actual.push( yield race({
      event: input('action'),
      timeout: later(1, 4)
    }) )
  }

  const proc = processor(genFn, [], () => {})
  setTimeout(() => proc({type: 'action'}), 16)

  const expected = [{timeout: 1}];

  setTimeout(() => {
    assert.deepEqual(actual, expected,
      "processor must fullfill race between effects"
    );
    assert.end();
  }, DELAY)

});
