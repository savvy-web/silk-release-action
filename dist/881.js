export const __rspack_esm_id = 881;
export const __rspack_esm_ids = [881];
export const __webpack_modules__ = {
37640(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ConfigProvider: () => (ConfigProvider),
  ConfigProviderTypeId: () => (ConfigProviderTypeId),
  FlatConfigProviderTypeId: () => (FlatConfigProviderTypeId),
  constantCase: () => (constantCase),
  fromEnv: () => (fromEnv),
  fromFlat: () => (fromFlat),
  fromJson: () => (fromJson),
  fromMap: () => (fromMap),
  kebabCase: () => (kebabCase),
  lowerCase: () => (lowerCase),
  make: () => (make),
  makeFlat: () => (makeFlat),
  mapInputPath: () => (mapInputPath),
  nested: () => (nested),
  orElse: () => (orElse),
  snakeCase: () => (snakeCase),
  unnested: () => (unnested),
  upperCase: () => (upperCase),
  within: () => (within)
});
/* import */ var _internal_configProvider_js__rspack_import_0 = __webpack_require__(36406);

/**
 * @since 2.0.0
 * @category symbols
 */
const ConfigProviderTypeId = _internal_configProvider_js__rspack_import_0/* .ConfigProviderTypeId */.tT;
/**
 * @since 2.0.0
 * @category symbols
 */
const FlatConfigProviderTypeId = _internal_configProvider_js__rspack_import_0/* .FlatConfigProviderTypeId */.Ww;
/**
 * The service tag for `ConfigProvider`.
 *
 * @since 2.0.0
 * @category context
 */
const ConfigProvider = _internal_configProvider_js__rspack_import_0/* .configProviderTag */.Am;
/**
 * Creates a new config provider.
 *
 * @since 2.0.0
 * @category constructors
 */
const make = _internal_configProvider_js__rspack_import_0/* .make */.L8;
/**
 * Creates a new flat config provider.
 *
 * @since 2.0.0
 * @category constructors
 */
const makeFlat = _internal_configProvider_js__rspack_import_0/* .makeFlat */.iG;
/**
 * A config provider that loads configuration from context variables
 *
 * **Options**:
 *
 * - `pathDelim`: The delimiter for the path segments (default: `"_"`).
 * - `seqDelim`: The delimiter for the sequence of values (default: `","`).
 *
 * @since 2.0.0
 * @category constructors
 */
const fromEnv = _internal_configProvider_js__rspack_import_0/* .fromEnv */.sF;
/**
 * Constructs a new `ConfigProvider` from a key/value (flat) provider, where
 * nesting is embedded into the string keys.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromFlat = _internal_configProvider_js__rspack_import_0/* .fromFlat */.kg;
/**
 * Constructs a new `ConfigProvider` from a JSON object.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromJson = _internal_configProvider_js__rspack_import_0/* .fromJson */.Rf;
// TODO(4.0): use `_` for nested configs instead of `.` in next major
/**
 * Constructs a ConfigProvider using a map and the specified delimiter string,
 * which determines how to split the keys in the map into path segments.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromMap = _internal_configProvider_js__rspack_import_0/* .fromMap */.xY;
/**
 * Returns a new config provider that will automatically convert all property
 * names to constant case. This can be utilized to adapt the names of
 * configuration properties from the default naming convention of camel case
 * to the naming convention of a config provider.
 *
 * @since 2.0.0
 * @category combinators
 */
const constantCase = _internal_configProvider_js__rspack_import_0/* .constantCase */.FU;
/**
 * Returns a new config provider that will automatically tranform all path
 * configuration names with the specified function. This can be utilized to
 * adapt the names of configuration properties from one naming convention to
 * another.
 *
 * @since 2.0.0
 * @category utils
 */
const mapInputPath = _internal_configProvider_js__rspack_import_0/* .mapInputPath */.Yf;
/**
 * Returns a new config provider that will automatically convert all property
 * names to kebab case. This can be utilized to adapt the names of
 * configuration properties from the default naming convention of camel case
 * to the naming convention of a config provider.
 *
 * @since 2.0.0
 * @category combinators
 */
const kebabCase = _internal_configProvider_js__rspack_import_0/* .kebabCase */.kW;
/**
 * Returns a new config provider that will automatically convert all property
 * names to lower case. This can be utilized to adapt the names of
 * configuration properties from the default naming convention of camel case
 * to the naming convention of a config provider.
 *
 * @since 2.0.0
 * @category combinators
 */
const lowerCase = _internal_configProvider_js__rspack_import_0/* .lowerCase */.gQ;
/**
 * Returns a new config provider that will automatically nest all
 * configuration under the specified property name. This can be utilized to
 * aggregate separate configuration sources that are all required to load a
 * single configuration value.
 *
 * @since 2.0.0
 * @category utils
 */
const nested = _internal_configProvider_js__rspack_import_0/* .nested */.cY;
/**
 * Returns a new config provider that preferentially loads configuration data
 * from this one, but which will fall back to the specified alternate provider
 * if there are any issues loading the configuration from this provider.
 *
 * @since 2.0.0
 * @category utils
 */
const orElse = _internal_configProvider_js__rspack_import_0/* .orElse */.NW;
/**
 * Returns a new config provider that will automatically un-nest all
 * configuration under the specified property name. This can be utilized to
 * de-aggregate separate configuration sources that are all required to load a
 * single configuration value.
 *
 * @since 2.0.0
 * @category utils
 */
const unnested = _internal_configProvider_js__rspack_import_0/* .unnested */.lE;
/**
 * Returns a new config provider that will automatically convert all property
 * names to upper case. This can be utilized to adapt the names of
 * configuration properties from the default naming convention of camel case
 * to the naming convention of a config provider.
 *
 * @since 2.0.0
 * @category combinators
 */
const snakeCase = _internal_configProvider_js__rspack_import_0/* .snakeCase */.LW;
/**
 * Returns a new config provider that will automatically convert all property
 * names to upper case. This can be utilized to adapt the names of
 * configuration properties from the default naming convention of camel case
 * to the naming convention of a config provider.
 *
 * @since 2.0.0
 * @category combinators
 */
const upperCase = _internal_configProvider_js__rspack_import_0/* .upperCase */.lb;
/**
 * Returns a new config provider that transforms the config provider with the
 * specified function within the specified path.
 *
 * @since 2.0.0
 * @category combinators
 */
const within = _internal_configProvider_js__rspack_import_0/* .within */.ux;
//# sourceMappingURL=ConfigProvider.js.map

},
31917(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  andThen: () => (andThen),
  empty: () => (empty),
  mapName: () => (mapName),
  nested: () => (nested),
  unnested: () => (unnested)
});
/* import */ var _internal_configProvider_pathPatch_js__rspack_import_0 = __webpack_require__(69702);
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category constructors
 */
const empty = _internal_configProvider_pathPatch_js__rspack_import_0/* .empty */.Ie;
/**
 * @since 2.0.0
 * @category constructors
 */
const andThen = _internal_configProvider_pathPatch_js__rspack_import_0/* .andThen */.hg;
/**
 * @since 2.0.0
 * @category constructors
 */
const mapName = _internal_configProvider_pathPatch_js__rspack_import_0/* .mapName */._x;
/**
 * @since 2.0.0
 * @category constructors
 */
const nested = _internal_configProvider_pathPatch_js__rspack_import_0/* .nested */.cY;
/**
 * @since 2.0.0
 * @category constructors
 */
const unnested = _internal_configProvider_pathPatch_js__rspack_import_0/* .unnested */.lE;
//# sourceMappingURL=ConfigProviderPathPatch.js.map

},
87046(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  currentServices: () => (currentServices),
  liveServices: () => (liveServices)
});
/* import */ var _internal_defaultServices_js__rspack_import_0 = __webpack_require__(16208);

/**
 * @since 2.0.0
 * @category constructors
 */
const liveServices = _internal_defaultServices_js__rspack_import_0/* .liveServices */.pF;
/**
 * @since 2.0.0
 * @category fiberRefs
 */
const currentServices = _internal_defaultServices_js__rspack_import_0/* .currentServices */.qJ;
//# sourceMappingURL=DefaultServices.js.map

},
44893(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  TypeId: () => (TypeId),
  add: () => (add),
  awaitEmpty: () => (awaitEmpty),
  clear: () => (clear),
  isFiberSet: () => (isFiberSet),
  join: () => (join),
  make: () => (make),
  makeRuntime: () => (makeRuntime),
  makeRuntimePromise: () => (makeRuntimePromise),
  run: () => (run),
  runtime: () => (runtime),
  runtimePromise: () => (runtimePromise),
  size: () => (size),
  unsafeAdd: () => (unsafeAdd)
});
/* import */ var _Cause_js__rspack_import_8 = __webpack_require__(56560);
/* import */ var _Deferred_js__rspack_import_5 = __webpack_require__(64200);
/* import */ var _Effect_js__rspack_import_4 = __webpack_require__(46330);
/* import */ var _Exit_js__rspack_import_11 = __webpack_require__(89895);
/* import */ var _Fiber_js__rspack_import_6 = __webpack_require__(28117);
/* import */ var _FiberId_js__rspack_import_7 = __webpack_require__(42852);
/* import */ var _Function_js__rspack_import_9 = __webpack_require__(61279);
/* import */ var _HashSet_js__rspack_import_10 = __webpack_require__(74975);
/* import */ var _Inspectable_js__rspack_import_2 = __webpack_require__(65051);
/* import */ var _Iterable_js__rspack_import_1 = __webpack_require__(11869);
/* import */ var _Pipeable_js__rspack_import_3 = __webpack_require__(79083);
/* import */ var _Predicate_js__rspack_import_0 = __webpack_require__(35034);
/* import */ var _Runtime_js__rspack_import_12 = __webpack_require__(5619);
/**
 * @since 2.0.0
 */













/**
 * @since 2.0.0
 * @categories type ids
 */
const TypeId = /*#__PURE__*/Symbol.for("effect/FiberSet");
/**
 * @since 2.0.0
 * @categories refinements
 */
const isFiberSet = u => _Predicate_js__rspack_import_0.hasProperty(u, TypeId);
const Proto = {
  [TypeId]: TypeId,
  [Symbol.iterator]() {
    if (this.state._tag === "Closed") {
      return _Iterable_js__rspack_import_1.empty();
    }
    return this.state.backing[Symbol.iterator]();
  },
  toString() {
    return _Inspectable_js__rspack_import_2.format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "FiberMap",
      state: this.state
    };
  },
  [_Inspectable_js__rspack_import_2.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,_Pipeable_js__rspack_import_3.pipeArguments)(this, arguments);
  }
};
const unsafeMake = (backing, deferred) => {
  const self = Object.create(Proto);
  self.state = {
    _tag: "Open",
    backing
  };
  self.deferred = deferred;
  return self;
};
/**
 * A FiberSet can be used to store a collection of fibers.
 * When the associated Scope is closed, all fibers in the set will be interrupted.
 *
 * You can add fibers to the set using `FiberSet.add` or `FiberSet.run`, and the fibers will
 * be automatically removed from the FiberSet when they complete.
 *
 * @example
 * ```ts
 * import { Effect, FiberSet } from "effect"
 *
 * Effect.gen(function*() {
 *   const set = yield* FiberSet.make()
 *
 *   // run some effects and add the fibers to the set
 *   yield* FiberSet.run(set, Effect.never)
 *   yield* FiberSet.run(set, Effect.never)
 *
 *   yield* Effect.sleep(1000)
 * }).pipe(
 *   Effect.scoped // The fibers will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories constructors
 */
const make = () => _Effect_js__rspack_import_4.acquireRelease(_Effect_js__rspack_import_4.map(_Deferred_js__rspack_import_5.make(), deferred => unsafeMake(new Set(), deferred)), set => _Effect_js__rspack_import_4.withFiberRuntime(parent => {
  const state = set.state;
  if (state._tag === "Closed") return _Effect_js__rspack_import_4["void"];
  set.state = {
    _tag: "Closed"
  };
  const fibers = state.backing;
  return _Fiber_js__rspack_import_6.interruptAllAs(fibers, _FiberId_js__rspack_import_7.combine(parent.id(), internalFiberId)).pipe(_Effect_js__rspack_import_4.intoDeferred(set.deferred));
}));
/**
 * Create an Effect run function that is backed by a FiberSet.
 *
 * @since 2.0.0
 * @categories constructors
 */
const makeRuntime = () => _Effect_js__rspack_import_4.flatMap(make(), self => runtime(self)());
/**
 * Create an Effect run function that is backed by a FiberSet.
 *
 * @since 3.13.0
 * @categories constructors
 */
const makeRuntimePromise = () => _Effect_js__rspack_import_4.flatMap(make(), self => runtimePromise(self)());
const internalFiberIdId = -1;
const internalFiberId = /*#__PURE__*/_FiberId_js__rspack_import_7.make(internalFiberIdId, 0);
const isInternalInterruption = /*#__PURE__*/_Cause_js__rspack_import_8.reduceWithContext(undefined, {
  emptyCase: _Function_js__rspack_import_9.constFalse,
  failCase: _Function_js__rspack_import_9.constFalse,
  dieCase: _Function_js__rspack_import_9.constFalse,
  interruptCase: (_, fiberId) => _HashSet_js__rspack_import_10.has(_FiberId_js__rspack_import_7.ids(fiberId), internalFiberIdId),
  sequentialCase: (_, left, right) => left || right,
  parallelCase: (_, left, right) => left || right
});
/**
 * Add a fiber to the FiberSet. When the fiber completes, it will be removed.
 *
 * @since 2.0.0
 * @categories combinators
 */
const unsafeAdd = /*#__PURE__*/(0,_Function_js__rspack_import_9.dual)(args => isFiberSet(args[0]), (self, fiber, options) => {
  if (self.state._tag === "Closed") {
    fiber.unsafeInterruptAsFork(_FiberId_js__rspack_import_7.combine(options?.interruptAs ?? _FiberId_js__rspack_import_7.none, internalFiberId));
    return;
  } else if (self.state.backing.has(fiber)) {
    return;
  }
  self.state.backing.add(fiber);
  fiber.addObserver(exit => {
    if (self.state._tag === "Closed") {
      return;
    }
    self.state.backing.delete(fiber);
    if (_Exit_js__rspack_import_11.isFailure(exit) && (options?.propagateInterruption === true ? !isInternalInterruption(exit.cause) : !_Cause_js__rspack_import_8.isInterruptedOnly(exit.cause))) {
      _Deferred_js__rspack_import_5.unsafeDone(self.deferred, exit);
    }
  });
});
/**
 * Add a fiber to the FiberSet. When the fiber completes, it will be removed.
 *
 * @since 2.0.0
 * @categories combinators
 */
const add = /*#__PURE__*/(0,_Function_js__rspack_import_9.dual)(args => isFiberSet(args[0]), (self, fiber, options) => _Effect_js__rspack_import_4.fiberIdWith(fiberId => _Effect_js__rspack_import_4.sync(() => unsafeAdd(self, fiber, {
  ...options,
  interruptAs: fiberId
}))));
/**
 * @since 2.0.0
 * @categories combinators
 */
const clear = self => _Effect_js__rspack_import_4.withFiberRuntime(clearFiber => {
  if (self.state._tag === "Closed") {
    return _Effect_js__rspack_import_4["void"];
  }
  return _Effect_js__rspack_import_4.forEach(self.state.backing, fiber =>
  // will be removed by the observer
  _Fiber_js__rspack_import_6.interruptAs(fiber, _FiberId_js__rspack_import_7.combine(clearFiber.id(), internalFiberId)));
});
const constInterruptedFiber = /*#__PURE__*/function () {
  let fiber = undefined;
  return () => {
    if (fiber === undefined) {
      fiber = _Effect_js__rspack_import_4.runFork(_Effect_js__rspack_import_4.interrupt);
    }
    return fiber;
  };
}();
/**
 * Fork an Effect and add the forked fiber to the FiberSet.
 * When the fiber completes, it will be removed from the FiberSet.
 *
 * @since 2.0.0
 * @categories combinators
 */
const run = function () {
  const self = arguments[0];
  if (!_Effect_js__rspack_import_4.isEffect(arguments[1])) {
    const options = arguments[1];
    return effect => runImpl(self, effect, options);
  }
  return runImpl(self, arguments[1], arguments[2]);
};
const runImpl = (self, effect, options) => _Effect_js__rspack_import_4.fiberIdWith(fiberId => {
  if (self.state._tag === "Closed") {
    return _Effect_js__rspack_import_4.sync(constInterruptedFiber);
  }
  return _Effect_js__rspack_import_4.tap(_Effect_js__rspack_import_4.forkDaemon(effect), fiber => unsafeAdd(self, fiber, {
    ...options,
    interruptAs: fiberId
  }));
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberSet.
 *
 * @example
 * ```ts
 * import { Context, Effect, FiberSet } from "effect"
 *
 * interface Users {
 *   readonly _: unique symbol
 * }
 * const Users = Context.GenericTag<Users, {
 *    getAll: Effect.Effect<Array<unknown>>
 * }>("Users")
 *
 * Effect.gen(function*() {
 *   const set = yield* FiberSet.make()
 *   const run = yield* FiberSet.runtime(set)<Users>()
 *
 *   // run some effects and add the fibers to the set
 *   run(Effect.andThen(Users, _ => _.getAll))
 * }).pipe(
 *   Effect.scoped // The fibers will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories combinators
 */
const runtime = self => () => _Effect_js__rspack_import_4.map(_Effect_js__rspack_import_4.runtime(), runtime => {
  const runFork = _Runtime_js__rspack_import_12.runFork(runtime);
  return (effect, options) => {
    if (self.state._tag === "Closed") {
      return constInterruptedFiber();
    }
    const fiber = runFork(effect, options);
    unsafeAdd(self, fiber);
    return fiber;
  };
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberSet.
 *
 * The returned run function will return Promise's.
 *
 * @since 3.13.0
 * @categories combinators
 */
const runtimePromise = self => () => _Effect_js__rspack_import_4.map(runtime(self)(), runFork => (effect, options) => new Promise((resolve, reject) => runFork(effect, options).addObserver(exit => {
  if (_Exit_js__rspack_import_11.isSuccess(exit)) {
    resolve(exit.value);
  } else {
    reject(_Cause_js__rspack_import_8.squash(exit.cause));
  }
})));
/**
 * @since 2.0.0
 * @categories combinators
 */
const size = self => _Effect_js__rspack_import_4.sync(() => self.state._tag === "Closed" ? 0 : self.state.backing.size);
/**
 * Join all fibers in the FiberSet. If any of the Fiber's in the set terminate with a failure,
 * the returned Effect will terminate with the first failure that occurred.
 *
 * @since 2.0.0
 * @categories combinators
 * @example
 * ```ts
 * import { Effect, FiberSet } from "effect";
 *
 * Effect.gen(function* (_) {
 *   const set = yield* _(FiberSet.make());
 *   yield* _(FiberSet.add(set, Effect.runFork(Effect.fail("error"))));
 *
 *   // parent fiber will fail with "error"
 *   yield* _(FiberSet.join(set));
 * });
 * ```
 */
const join = self => _Deferred_js__rspack_import_5["await"](self.deferred);
/**
 * Wait until the fiber set is empty.
 *
 * @since 3.13.0
 * @categories combinators
 */
const awaitEmpty = self => _Effect_js__rspack_import_4.whileLoop({
  while: () => self.state._tag === "Open" && self.state.backing.size > 0,
  body: () => _Fiber_js__rspack_import_6["await"](_Iterable_js__rspack_import_1.unsafeHead(self)),
  step: _Function_js__rspack_import_9.constVoid
});
//# sourceMappingURL=FiberSet.js.map

},
50774(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  fromAST: () => (fromAST),
  getMetaSchemaUri: () => (getMetaSchemaUri),
  make: () => (make)
});
/* import */ var _Array_js__rspack_import_4 = __webpack_require__(93118);
/* import */ var _internal_schema_errors_js__rspack_import_6 = __webpack_require__(34234);
/* import */ var _internal_schema_schemaId_js__rspack_import_5 = __webpack_require__(92267);
/* import */ var _Option_js__rspack_import_2 = __webpack_require__(31706);
/* import */ var _ParseResult_js__rspack_import_3 = __webpack_require__(57529);
/* import */ var _Predicate_js__rspack_import_7 = __webpack_require__(35034);
/* import */ var _Record_js__rspack_import_1 = __webpack_require__(13878);
/* import */ var _SchemaAST_js__rspack_import_0 = __webpack_require__(27642);
/**
 * @since 3.10.0
 */








/**
 * Generates a JSON Schema from a schema.
 *
 * **Options**
 *
 * - `target`: The target JSON Schema version. Possible values are:
 *   - `"jsonSchema7"`: JSON Schema draft-07 (default behavior).
 *   - `"jsonSchema2019-09"`: JSON Schema draft-2019-09.
 *   - `"jsonSchema2020-12"`: JSON Schema draft-2020-12.
 *   - `"openApi3.1"`: OpenAPI 3.1.
 *
 * @category encoding
 * @since 3.10.0
 */
const make = (schema, options) => {
  const definitions = {};
  const target = options?.target ?? "jsonSchema7";
  const ast = _SchemaAST_js__rspack_import_0.isTransformation(schema.ast) && isParseJsonTransformation(schema.ast.from)
  // Special case top level `parseJson` transformations
  ? schema.ast.to : schema.ast;
  const jsonSchema = fromAST(ast, {
    definitions,
    target
  });
  const out = {
    $schema: getMetaSchemaUri(target),
    $defs: {},
    ...jsonSchema
  };
  if (_Record_js__rspack_import_1.isEmptyRecord(definitions)) {
    delete out.$defs;
  } else {
    out.$defs = definitions;
  }
  return out;
};
/** @internal */
function getMetaSchemaUri(target) {
  switch (target) {
    case "jsonSchema7":
      return "http://json-schema.org/draft-07/schema#";
    case "jsonSchema2019-09":
      return "https://json-schema.org/draft/2019-09/schema";
    case "jsonSchema2020-12":
    case "openApi3.1":
      return "https://json-schema.org/draft/2020-12/schema";
  }
}
/**
 * Returns a JSON Schema with additional options and definitions.
 *
 * **Warning**
 *
 * This function is experimental and subject to change.
 *
 * **Options**
 *
 * - `definitions`: A record of definitions that are included in the schema.
 * - `definitionPath`: The path to the definitions within the schema (defaults
 *   to "#/$defs/").
 * - `target`: Which spec to target. Possible values are:
 *   - `'jsonSchema7'`: JSON Schema draft-07 (default behavior).
 *   - `'jsonSchema2019-09'`: JSON Schema draft-2019-09.
 *   - `'openApi3.1'`: OpenAPI 3.1.
 * - `topLevelReferenceStrategy`: Controls the handling of the top-level
 *   reference. Possible values are:
 *   - `"keep"`: Keep the top-level reference (default behavior).
 *   - `"skip"`: Skip the top-level reference.
 * - `additionalPropertiesStrategy`: Controls the handling of additional properties. Possible values are:
 *   - `"strict"`: Disallow additional properties (default behavior).
 *   - `"allow"`: Allow additional properties.
 *
 * @category encoding
 * @since 3.11.5
 * @experimental
 */
const fromAST = (ast, options) => {
  const definitionPath = options.definitionPath ?? "#/$defs/";
  const getRef = id => definitionPath + id;
  const target = options.target ?? "jsonSchema7";
  const topLevelReferenceStrategy = options.topLevelReferenceStrategy ?? "keep";
  const additionalPropertiesStrategy = options.additionalPropertiesStrategy ?? "strict";
  return go(ast, options.definitions, "handle-identifier", [], {
    getRef,
    target,
    topLevelReferenceStrategy,
    additionalPropertiesStrategy
  }, "handle-annotation", "handle-errors");
};
const constNever = {
  $id: "/schemas/never",
  not: {}
};
const constAny = {
  $id: "/schemas/any"
};
const constUnknown = {
  $id: "/schemas/unknown"
};
const constVoid = {
  $id: "/schemas/void"
};
const constObject = {
  $id: "/schemas/object",
  "anyOf": [{
    "type": "object"
  }, {
    "type": "array"
  }]
};
const constEmptyStruct = {
  $id: "/schemas/%7B%7D",
  "anyOf": [{
    "type": "object"
  }, {
    "type": "array"
  }]
};
function getRawDescription(annotated) {
  if (annotated !== undefined) return _Option_js__rspack_import_2.getOrUndefined(_SchemaAST_js__rspack_import_0.getDescriptionAnnotation(annotated));
}
function getRawTitle(annotated) {
  if (annotated !== undefined) return _Option_js__rspack_import_2.getOrUndefined(_SchemaAST_js__rspack_import_0.getTitleAnnotation(annotated));
}
function getRawDefault(annotated) {
  if (annotated !== undefined) return _SchemaAST_js__rspack_import_0.getDefaultAnnotation(annotated);
  return _Option_js__rspack_import_2.none();
}
function encodeDefault(ast, def) {
  const getOption = _ParseResult_js__rspack_import_3.getOption(ast, false);
  return getOption(def);
}
function getRawExamples(annotated) {
  if (annotated !== undefined) return _Option_js__rspack_import_2.getOrUndefined(_SchemaAST_js__rspack_import_0.getExamplesAnnotation(annotated));
}
function encodeExamples(ast, examples) {
  const getOption = _ParseResult_js__rspack_import_3.getOption(ast, false);
  const out = _Array_js__rspack_import_4.filterMap(examples, e => getOption(e).pipe(_Option_js__rspack_import_2.filter(isJsonValue)));
  return out.length > 0 ? out : undefined;
}
function filterBuiltIn(ast, annotation, key) {
  if (annotation !== undefined) {
    switch (ast._tag) {
      case "StringKeyword":
        return annotation !== _SchemaAST_js__rspack_import_0.stringKeyword.annotations[key] ? annotation : undefined;
      case "NumberKeyword":
        return annotation !== _SchemaAST_js__rspack_import_0.numberKeyword.annotations[key] ? annotation : undefined;
      case "BooleanKeyword":
        return annotation !== _SchemaAST_js__rspack_import_0.booleanKeyword.annotations[key] ? annotation : undefined;
    }
  }
  return annotation;
}
function isJsonValue(value, visited = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value) || typeof value === "object") {
    // Check for cyclic references
    if (visited.has(value)) {
      return false;
    }
    visited.add(value);
    try {
      if (Array.isArray(value)) {
        return value.every(item => isJsonValue(item, visited));
      }
      // Exclude non-plain objects (Date, RegExp, etc.) by checking constructor
      const proto = Object.getPrototypeOf(value);
      if (proto !== null && proto !== Object.prototype) {
        return false;
      }
      // JSON only allows string keys, so exclude objects with Symbol keys
      if (Object.getOwnPropertySymbols(value).length > 0) {
        return false;
      }
      // Check all values are JSON values
      return Object.values(value).every(v => isJsonValue(v, visited));
    } finally {
      visited.delete(value);
    }
  }
  return false;
}
function pruneJsonSchemaAnnotations(ast, description, title, def, examples) {
  const out = {};
  if (description !== undefined) out.description = description;
  if (title !== undefined) out.title = title;
  if (_Option_js__rspack_import_2.isSome(def)) {
    const o = encodeDefault(ast, def.value);
    if (_Option_js__rspack_import_2.isSome(o) && isJsonValue(o.value)) {
      out.default = o.value;
    }
  }
  if (examples !== undefined) {
    const encodedExamples = encodeExamples(ast, examples);
    if (encodedExamples !== undefined) {
      out.examples = encodedExamples;
    }
  }
  if (Object.keys(out).length === 0) {
    return undefined;
  }
  return out;
}
function getContextJsonSchemaAnnotations(ast, annotated) {
  return pruneJsonSchemaAnnotations(ast, getRawDescription(annotated), getRawTitle(annotated), getRawDefault(annotated), getRawExamples(annotated));
}
function getJsonSchemaAnnotations(ast) {
  return pruneJsonSchemaAnnotations(ast, filterBuiltIn(ast, getRawDescription(ast), _SchemaAST_js__rspack_import_0.DescriptionAnnotationId), filterBuiltIn(ast, getRawTitle(ast), _SchemaAST_js__rspack_import_0.TitleAnnotationId), getRawDefault(ast), getRawExamples(ast));
}
function mergeJsonSchemaAnnotations(jsonSchema, jsonSchemaAnnotations) {
  if (jsonSchemaAnnotations) {
    if ("$ref" in jsonSchema) {
      return {
        allOf: [jsonSchema],
        ...jsonSchemaAnnotations
      };
    }
    return {
      ...jsonSchema,
      ...jsonSchemaAnnotations
    };
  }
  return jsonSchema;
}
const pruneUndefined = ast => {
  if (_Option_js__rspack_import_2.isNone(_SchemaAST_js__rspack_import_0.getJSONSchemaAnnotation(ast))) {
    return _SchemaAST_js__rspack_import_0.pruneUndefined(ast, pruneUndefined, ast => pruneUndefined(ast.from));
  }
};
const isParseJsonTransformation = ast => ast.annotations[_SchemaAST_js__rspack_import_0.SchemaIdAnnotationId] === _SchemaAST_js__rspack_import_0.ParseJsonSchemaId;
const isOverrideAnnotation = (ast, jsonSchema) => {
  if (_SchemaAST_js__rspack_import_0.isRefinement(ast)) {
    const schemaId = ast.annotations[_SchemaAST_js__rspack_import_0.SchemaIdAnnotationId];
    if (schemaId === _internal_schema_schemaId_js__rspack_import_5/* .IntSchemaId */.Se) {
      return "type" in jsonSchema && jsonSchema.type !== "integer";
    }
  }
  return "type" in jsonSchema || "oneOf" in jsonSchema || "anyOf" in jsonSchema || "$ref" in jsonSchema;
};
const mergeRefinements = (from, jsonSchema, ast) => {
  const out = {
    ...from,
    ...getJsonSchemaAnnotations(ast),
    ...jsonSchema
  };
  out.allOf ??= [];
  const handle = (name, filter) => {
    if (name in jsonSchema && name in from) {
      out.allOf.unshift({
        [name]: from[name]
      });
      out.allOf = out.allOf.filter(filter);
    }
  };
  handle("minLength", i => i.minLength > jsonSchema.minLength);
  handle("maxLength", i => i.maxLength < jsonSchema.maxLength);
  handle("pattern", i => i.pattern !== jsonSchema.pattern);
  handle("minItems", i => i.minItems > jsonSchema.minItems);
  handle("maxItems", i => i.maxItems < jsonSchema.maxItems);
  handle("minimum", i => i.minimum > jsonSchema.minimum);
  handle("maximum", i => i.maximum < jsonSchema.maximum);
  handle("exclusiveMinimum", i => i.exclusiveMinimum > jsonSchema.exclusiveMinimum);
  handle("exclusiveMaximum", i => i.exclusiveMaximum < jsonSchema.exclusiveMaximum);
  handle("multipleOf", i => i.multipleOf !== jsonSchema.multipleOf);
  if (out.allOf.length === 0) {
    delete out.allOf;
  }
  return out;
};
function isContentSchemaSupported(options) {
  switch (options.target) {
    case "jsonSchema7":
      return false;
    case "jsonSchema2019-09":
    case "jsonSchema2020-12":
    case "openApi3.1":
      return true;
  }
}
function getAdditionalProperties(options) {
  switch (options.additionalPropertiesStrategy) {
    case "allow":
      return true;
    case "strict":
      return false;
  }
}
function addASTAnnotations(jsonSchema, ast) {
  return addAnnotations(jsonSchema, getJsonSchemaAnnotations(ast));
}
function addAnnotations(jsonSchema, annotations) {
  if (annotations === undefined || Object.keys(annotations).length === 0) {
    return jsonSchema;
  }
  if ("$ref" in jsonSchema) {
    return {
      allOf: [jsonSchema],
      ...annotations
    };
  }
  return {
    ...jsonSchema,
    ...annotations
  };
}
function getIdentifierAnnotation(ast) {
  const identifier = _Option_js__rspack_import_2.getOrUndefined(_SchemaAST_js__rspack_import_0.getJSONIdentifier(ast));
  if (identifier === undefined) {
    if (_SchemaAST_js__rspack_import_0.isSuspend(ast)) {
      return getIdentifierAnnotation(ast.f());
    }
    if (_SchemaAST_js__rspack_import_0.isTransformation(ast) && _SchemaAST_js__rspack_import_0.isTypeLiteral(ast.from) && _SchemaAST_js__rspack_import_0.isDeclaration(ast.to)) {
      const to = ast.to;
      const surrogate = _SchemaAST_js__rspack_import_0.getSurrogateAnnotation(to);
      if (_Option_js__rspack_import_2.isSome(surrogate)) {
        return getIdentifierAnnotation(to);
      }
    }
  }
  return identifier;
}
function go(ast, $defs, identifier, path, options, annotation, errors) {
  if (identifier === "handle-identifier" && (options.topLevelReferenceStrategy !== "skip" || _SchemaAST_js__rspack_import_0.isSuspend(ast))) {
    const id = getIdentifierAnnotation(ast);
    if (id !== undefined) {
      const escapedId = id.replace(/~/ig, "~0").replace(/\//ig, "~1");
      const out = {
        $ref: options.getRef(escapedId)
      };
      if (!_Record_js__rspack_import_1.has($defs, id)) {
        $defs[id] = out;
        $defs[id] = go(ast, $defs, "ignore-identifier", path, options, "handle-annotation", errors);
      }
      return out;
    }
  }
  if (annotation === "handle-annotation") {
    const hook = _SchemaAST_js__rspack_import_0.getJSONSchemaAnnotation(ast);
    if (_Option_js__rspack_import_2.isSome(hook)) {
      const handler = hook.value;
      if (isOverrideAnnotation(ast, handler)) {
        switch (ast._tag) {
          case "Declaration":
            return addASTAnnotations(handler, ast);
          default:
            return handler;
        }
      } else {
        switch (ast._tag) {
          case "Refinement":
            {
              const t = _SchemaAST_js__rspack_import_0.getTransformationFrom(ast);
              if (t === undefined) {
                return mergeRefinements(go(ast.from, $defs, identifier, path, options, "handle-annotation", errors), handler, ast);
              } else {
                return go(t, $defs, identifier, path, options, "handle-annotation", errors);
              }
            }
          default:
            return {
              ...go(ast, $defs, identifier, path, options, "ignore-annotation", errors),
              ...handler
            };
        }
      }
    }
  }
  const surrogate = _SchemaAST_js__rspack_import_0.getSurrogateAnnotation(ast);
  if (_Option_js__rspack_import_2.isSome(surrogate)) {
    return go(surrogate.value, $defs, identifier, path, options, "handle-annotation", errors);
  }
  switch (ast._tag) {
    // Unsupported
    case "Declaration":
    case "UndefinedKeyword":
    case "BigIntKeyword":
    case "UniqueSymbol":
    case "SymbolKeyword":
      {
        if (errors === "ignore-errors") return addASTAnnotations(constAny, ast);
        throw new Error(_internal_schema_errors_js__rspack_import_6/* .getJSONSchemaMissingAnnotationErrorMessage */.e7(path, ast));
      }
    case "Suspend":
      {
        if (identifier === "handle-identifier") {
          if (errors === "ignore-errors") return addASTAnnotations(constAny, ast);
          throw new Error(_internal_schema_errors_js__rspack_import_6/* .getJSONSchemaMissingIdentifierAnnotationErrorMessage */.rh(path, ast));
        }
        return go(ast.f(), $defs, "ignore-identifier", path, options, "handle-annotation", errors);
      }
    // Primitives
    case "NeverKeyword":
      return addASTAnnotations(constNever, ast);
    case "VoidKeyword":
      return addASTAnnotations(constVoid, ast);
    case "UnknownKeyword":
      return addASTAnnotations(constUnknown, ast);
    case "AnyKeyword":
      return addASTAnnotations(constAny, ast);
    case "ObjectKeyword":
      return addASTAnnotations(constObject, ast);
    case "StringKeyword":
      return addASTAnnotations({
        type: "string"
      }, ast);
    case "NumberKeyword":
      return addASTAnnotations({
        type: "number"
      }, ast);
    case "BooleanKeyword":
      return addASTAnnotations({
        type: "boolean"
      }, ast);
    case "Literal":
      {
        const literal = ast.literal;
        if (literal === null) {
          return addASTAnnotations({
            type: "null"
          }, ast);
        } else if (_Predicate_js__rspack_import_7.isString(literal)) {
          return addASTAnnotations({
            type: "string",
            enum: [literal]
          }, ast);
        } else if (_Predicate_js__rspack_import_7.isNumber(literal)) {
          return addASTAnnotations({
            type: "number",
            enum: [literal]
          }, ast);
        } else if (_Predicate_js__rspack_import_7.isBoolean(literal)) {
          return addASTAnnotations({
            type: "boolean",
            enum: [literal]
          }, ast);
        }
        if (errors === "ignore-errors") return addASTAnnotations(constAny, ast);
        throw new Error(_internal_schema_errors_js__rspack_import_6/* .getJSONSchemaMissingAnnotationErrorMessage */.e7(path, ast));
      }
    case "Enums":
      {
        const anyOf = ast.enums.map(e => {
          const type = _Predicate_js__rspack_import_7.isNumber(e[1]) ? "number" : "string";
          return {
            type,
            title: e[0],
            enum: [e[1]]
          };
        });
        return anyOf.length >= 1 ? addASTAnnotations({
          $comment: "/schemas/enums",
          anyOf
        }, ast) : addASTAnnotations(constNever, ast);
      }
    case "TupleType":
      {
        const elements = ast.elements.map((e, i) => mergeJsonSchemaAnnotations(go(e.type, $defs, "handle-identifier", path.concat(i), options, "handle-annotation", errors), getContextJsonSchemaAnnotations(e.type, e)));
        const rest = ast.rest.map(type => mergeJsonSchemaAnnotations(go(type.type, $defs, "handle-identifier", path, options, "handle-annotation", errors), getContextJsonSchemaAnnotations(type.type, type)));
        const output = {
          type: "array"
        };
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        const len = ast.elements.length;
        if (len > 0) {
          output.minItems = len - ast.elements.filter(element => element.isOptional).length;
          if (options.target === "jsonSchema7") {
            output.items = elements;
          } else {
            output.prefixItems = elements;
          }
        }
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        const restLength = rest.length;
        if (restLength > 0) {
          const head = rest[0];
          const isHomogeneous = restLength === 1 && ast.elements.every(e => e.type === ast.rest[0].type);
          if (isHomogeneous) {
            if (options.target === "jsonSchema7") {
              output.items = head;
            } else {
              output.items = head;
              delete output.prefixItems;
            }
          } else {
            if (options.target === "jsonSchema7") {
              output.additionalItems = head;
            } else {
              output.items = head;
            }
          }
          // ---------------------------------------------
          // handle post rest elements
          // ---------------------------------------------
          if (restLength > 1) {
            if (errors === "ignore-errors") return addASTAnnotations(constAny, ast);
            throw new Error(_internal_schema_errors_js__rspack_import_6/* .getJSONSchemaUnsupportedPostRestElementsErrorMessage */.Je(path));
          }
        } else {
          if (len > 0) {
            if (options.target === "jsonSchema7") {
              output.additionalItems = false;
            } else {
              output.items = false;
            }
          } else {
            output.maxItems = 0;
          }
        }
        return addASTAnnotations(output, ast);
      }
    case "TypeLiteral":
      {
        if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
          return addASTAnnotations(constEmptyStruct, ast);
        }
        const output = {
          type: "object",
          required: [],
          properties: {},
          additionalProperties: getAdditionalProperties(options)
        };
        let patternProperties = undefined;
        let propertyNames = undefined;
        for (const is of ast.indexSignatures) {
          const pruned = pruneUndefined(is.type) ?? is.type;
          const parameter = is.parameter;
          switch (parameter._tag) {
            case "StringKeyword":
              {
                output.additionalProperties = go(pruned, $defs, "handle-identifier", path, options, "handle-annotation", errors);
                break;
              }
            case "TemplateLiteral":
              {
                patternProperties = go(pruned, $defs, "handle-identifier", path, options, "handle-annotation", errors);
                propertyNames = {
                  type: "string",
                  pattern: _SchemaAST_js__rspack_import_0.getTemplateLiteralRegExp(parameter).source
                };
                break;
              }
            case "Refinement":
              {
                patternProperties = go(pruned, $defs, "handle-identifier", path, options, "handle-annotation", errors);
                propertyNames = go(parameter, $defs, "handle-identifier", path, options, "handle-annotation", errors);
                break;
              }
            case "SymbolKeyword":
              {
                const indexSignaturePath = path.concat("[symbol]");
                output.additionalProperties = go(pruned, $defs, "handle-identifier", indexSignaturePath, options, "handle-annotation", errors);
                propertyNames = go(parameter, $defs, "handle-identifier", indexSignaturePath, options, "handle-annotation", errors);
                break;
              }
          }
        }
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        for (let i = 0; i < ast.propertySignatures.length; i++) {
          const ps = ast.propertySignatures[i];
          const name = ps.name;
          if (_Predicate_js__rspack_import_7.isString(name)) {
            const pruned = pruneUndefined(ps.type);
            const type = pruned ?? ps.type;
            output.properties[name] = mergeJsonSchemaAnnotations(go(type, $defs, "handle-identifier", path.concat(ps.name), options, "handle-annotation", errors), getContextJsonSchemaAnnotations(type, ps));
            // ---------------------------------------------
            // handle optional property signatures
            // ---------------------------------------------
            if (!ps.isOptional && pruned === undefined) {
              output.required.push(name);
            }
          } else {
            if (errors === "ignore-errors") return addASTAnnotations(constAny, ast);
            throw new Error(_internal_schema_errors_js__rspack_import_6/* .getJSONSchemaUnsupportedKeyErrorMessage */.Dd(name, path));
          }
        }
        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        if (patternProperties !== undefined) {
          delete output.additionalProperties;
          output.patternProperties = {
            "": patternProperties
          };
        }
        if (propertyNames !== undefined) {
          output.propertyNames = propertyNames;
        }
        return addASTAnnotations(output, ast);
      }
    case "Union":
      {
        const members = ast.types.map(t => go(t, $defs, "handle-identifier", path, options, "handle-annotation", errors));
        const anyOf = compactUnion(members);
        switch (anyOf.length) {
          case 0:
            return constNever;
          case 1:
            return addASTAnnotations(anyOf[0], ast);
          default:
            return addASTAnnotations({
              anyOf
            }, ast);
        }
      }
    case "Refinement":
      return go(ast.from, $defs, identifier, path, options, "handle-annotation", errors);
    case "TemplateLiteral":
      {
        const regex = _SchemaAST_js__rspack_import_0.getTemplateLiteralRegExp(ast);
        return addASTAnnotations({
          type: "string",
          title: String(ast),
          description: "a template literal",
          pattern: regex.source
        }, ast);
      }
    case "Transformation":
      {
        if (isParseJsonTransformation(ast.from)) {
          const out = {
            "type": "string",
            "contentMediaType": "application/json"
          };
          if (isContentSchemaSupported(options)) {
            out["contentSchema"] = go(ast.to, $defs, identifier, path, options, "handle-annotation", errors);
          }
          return out;
        }
        const from = go(ast.from, $defs, identifier, path, options, "handle-annotation", errors);
        if (ast.transformation._tag === "TypeLiteralTransformation" && isJsonSchema7Object(from)) {
          const to = go(ast.to, {}, "ignore-identifier", path, options, "handle-annotation", "ignore-errors");
          if (isJsonSchema7Object(to)) {
            for (const t of ast.transformation.propertySignatureTransformations) {
              const toKey = t.to;
              const fromKey = t.from;
              if (_Predicate_js__rspack_import_7.isString(toKey) && _Predicate_js__rspack_import_7.isString(fromKey)) {
                const toProperty = to.properties[toKey];
                if (_Predicate_js__rspack_import_7.isRecord(toProperty)) {
                  const fromProperty = from.properties[fromKey];
                  if (_Predicate_js__rspack_import_7.isRecord(fromProperty)) {
                    const annotations = {};
                    if (_Predicate_js__rspack_import_7.isString(toProperty.title)) annotations.title = toProperty.title;
                    if (_Predicate_js__rspack_import_7.isString(toProperty.description)) annotations.description = toProperty.description;
                    if (Array.isArray(toProperty.examples)) annotations.examples = toProperty.examples;
                    if (Object.hasOwn(toProperty, "default") && toProperty.default !== undefined) {
                      annotations.default = toProperty.default;
                    }
                    from.properties[fromKey] = addAnnotations(fromProperty, annotations);
                  }
                }
              }
            }
          }
        }
        return addASTAnnotations(from, ast);
      }
  }
}
function isJsonSchema7Object(jsonSchema) {
  return _Predicate_js__rspack_import_7.isRecord(jsonSchema) && jsonSchema.type === "object" && _Predicate_js__rspack_import_7.isRecord(jsonSchema.properties);
}
function isNeverWithoutCustomAnnotations(jsonSchema) {
  return jsonSchema === constNever || _Predicate_js__rspack_import_7.hasProperty(jsonSchema, "$id") && jsonSchema.$id === constNever.$id && Object.keys(jsonSchema).length === 3 && jsonSchema.title === _SchemaAST_js__rspack_import_0.neverKeyword.annotations[_SchemaAST_js__rspack_import_0.TitleAnnotationId];
}
function isAny(jsonSchema) {
  return "$id" in jsonSchema && jsonSchema.$id === constAny.$id;
}
function isUnknown(jsonSchema) {
  return "$id" in jsonSchema && jsonSchema.$id === constUnknown.$id;
}
function isVoid(jsonSchema) {
  return "$id" in jsonSchema && jsonSchema.$id === constVoid.$id;
}
function isCompactableLiteral(jsonSchema) {
  return _Predicate_js__rspack_import_7.hasProperty(jsonSchema, "enum") && "type" in jsonSchema && Object.keys(jsonSchema).length === 2;
}
function compactUnion(members) {
  const out = [];
  for (const m of members) {
    if (isNeverWithoutCustomAnnotations(m)) continue;
    if (isAny(m) || isUnknown(m) || isVoid(m)) return [m];
    if (isCompactableLiteral(m) && out.length > 0) {
      const last = out[out.length - 1];
      if (isCompactableLiteral(last) && last.type === m.type) {
        out[out.length - 1] = {
          type: last.type,
          enum: [...last.enum, ...m.enum]
        };
        continue;
      }
    }
    out.push(m);
  }
  return out;
}
//# sourceMappingURL=JSONSchema.js.map

},
32717(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  LoggerTypeId: () => (/* binding */ LoggerTypeId),
  add: () => (/* binding */ add),
  addEffect: () => (/* binding */ addEffect),
  addScoped: () => (/* binding */ addScoped),
  batched: () => (/* binding */ batched),
  defaultLogger: () => (/* binding */ defaultLogger),
  filterLogLevel: () => (/* binding */ filterLogLevel),
  isLogger: () => (/* binding */ isLogger),
  json: () => (/* binding */ json),
  jsonLogger: () => (/* binding */ jsonLogger),
  logFmt: () => (/* binding */ logFmt),
  logfmtLogger: () => (/* binding */ logfmtLogger),
  make: () => (/* binding */ make),
  map: () => (/* binding */ map),
  mapInput: () => (/* binding */ mapInput),
  mapInputOptions: () => (/* binding */ mapInputOptions),
  minimumLogLevel: () => (/* binding */ minimumLogLevel),
  none: () => (/* binding */ none),
  pretty: () => (/* binding */ pretty),
  prettyLogger: () => (/* binding */ prettyLogger),
  prettyLoggerDefault: () => (/* binding */ prettyLoggerDefault),
  remove: () => (/* binding */ remove),
  replace: () => (/* binding */ replace),
  replaceEffect: () => (/* binding */ replaceEffect),
  replaceScoped: () => (/* binding */ replaceScoped),
  simple: () => (/* binding */ simple),
  stringLogger: () => (/* binding */ stringLogger),
  structured: () => (/* binding */ structured),
  structuredLogger: () => (/* binding */ structuredLogger),
  succeed: () => (/* binding */ succeed),
  sync: () => (/* binding */ sync),
  test: () => (/* binding */ Logger_test),
  tracerLogger: () => (/* binding */ tracerLogger),
  withConsoleError: () => (/* binding */ withConsoleError),
  withConsoleLog: () => (/* binding */ withConsoleLog),
  withLeveledConsole: () => (/* binding */ withLeveledConsole),
  withMinimumLogLevel: () => (/* binding */ withMinimumLogLevel),
  withSpanAnnotations: () => (/* binding */ withSpanAnnotations),
  zip: () => (/* binding */ zip),
  zipLeft: () => (/* binding */ zipLeft),
  zipRight: () => (/* binding */ zipRight)
});

// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiberRuntime.js + 2 modules
var fiberRuntime = __webpack_require__(55845);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/layer/circular.js
var circular = __webpack_require__(58998);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cause.js
var Cause = __webpack_require__(56560);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Function.js
var Function = __webpack_require__(61279);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HashMap.js + 1 modules
var HashMap = __webpack_require__(3402);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/List.js
var List = __webpack_require__(57087);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/core.js
var core = __webpack_require__(55294);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiberId.js
var fiberId = __webpack_require__(78562);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiberRefs.js
var fiberRefs = __webpack_require__(29537);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/logger-circular.js







/** @internal */
const test = /*#__PURE__*/(0,Function.dual)(2, (self, input) => self.log({
  fiberId: fiberId/* .none */.dv,
  logLevel: core/* .logLevelInfo */.VEq,
  message: input,
  cause: Cause.empty,
  context: fiberRefs/* .empty */.Ie(),
  spans: List.empty(),
  annotations: HashMap.empty(),
  date: new Date()
}));
//# sourceMappingURL=logger-circular.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/logger.js
var logger = __webpack_require__(24153);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Logger.js




/**
 * @since 2.0.0
 * @category symbols
 */
const LoggerTypeId = logger/* .LoggerTypeId */.y4;
/**
 * Creates a custom logger that formats log messages according to the provided
 * function.
 *
 * @example
 * ```ts
 * import { Effect, Logger, LogLevel } from "effect"
 *
 * const logger = Logger.make(({ logLevel, message }) => {
 *   globalThis.console.log(`[${logLevel.label}] ${message}`)
 * })
 *
 * const task1 = Effect.logDebug("task1 done")
 * const task2 = Effect.logDebug("task2 done")
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("start")
 *   yield* task1
 *   yield* task2
 *   yield* Effect.log("done")
 * }).pipe(
 *   Logger.withMinimumLogLevel(LogLevel.Debug),
 *   Effect.provide(Logger.replace(Logger.defaultLogger, logger))
 * )
 *
 * Effect.runFork(program)
 * // [INFO] start
 * // [DEBUG] task1 done
 * // [DEBUG] task2 done
 * // [INFO] done
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
const make = logger/* .makeLogger */.rY;
/**
 * @since 2.0.0
 * @category context
 */
const add = circular/* .addLogger */.EJ;
/**
 * @since 2.0.0
 * @category context
 */
const addEffect = circular/* .addLoggerEffect */.j3;
/**
 * @since 2.0.0
 * @category context
 */
const addScoped = circular/* .addLoggerScoped */.GG;
/**
 * @since 2.0.0
 * @category mapping
 */
const mapInput = logger/* .mapInput */.zQ;
/**
 * @since 2.0.0
 * @category mapping
 */
const mapInputOptions = logger/* .mapInputOptions */.Tc;
/**
 * Returns a version of this logger that only logs messages when the log level
 * satisfies the specified predicate.
 *
 * @since 2.0.0
 * @category filtering
 */
const filterLogLevel = logger/* .filterLogLevel */.Li;
/**
 * @since 2.0.0
 * @category mapping
 */
const map = logger/* .map */.Tj;
/**
 * Creates a batched logger that groups log messages together and processes them
 * in intervals.
 *
 * @example
 * ```ts
 * import { Console, Effect, Logger } from "effect"
 *
 * const LoggerLive = Logger.replaceScoped(
 *   Logger.defaultLogger,
 *   Logger.logfmtLogger.pipe(
 *     Logger.batched("500 millis", (messages) => Console.log("BATCH", `[\n${messages.join("\n")}\n]`))
 *   )
 * )
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("one")
 *   yield* Effect.log("two")
 *   yield* Effect.log("three")
 * }).pipe(Effect.provide(LoggerLive))
 *
 * Effect.runFork(program)
 * // BATCH [
 * // timestamp=... level=INFO fiber=#0 message=one
 * // timestamp=... level=INFO fiber=#0 message=two
 * // timestamp=... level=INFO fiber=#0 message=three
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category mapping
 */
const batched = fiberRuntime/* .batchedLogger */.sO;
/**
 * @since 2.0.0
 * @category console
 */
const withConsoleLog = fiberRuntime/* .loggerWithConsoleLog */.qI;
/**
 * Takes a `Logger<M, O>` and returns a logger that calls the respective `Console` method
 * based on the log level.
 *
 * @example
 * ```ts
 * import { Logger, Effect } from "effect"
 *
 * const loggerLayer = Logger.replace(
 *   Logger.defaultLogger,
 *   Logger.withLeveledConsole(Logger.stringLogger),
 * )
 *
 * Effect.gen(function* () {
 *   yield* Effect.logError("an error")
 *   yield* Effect.logInfo("an info")
 * }).pipe(Effect.provide(loggerLayer))
 * ```
 *
 * @since 3.8.0
 * @category console
 */
const withLeveledConsole = fiberRuntime/* .loggerWithLeveledLog */.uF;
/**
 * @since 2.0.0
 * @category console
 */
const withConsoleError = fiberRuntime/* .loggerWithConsoleError */.eU;
/**
 * A logger that does nothing in response to logging events.
 *
 * @since 2.0.0
 * @category constructors
 */
const none = logger/* .none */.dv;
/**
 * @since 2.0.0
 * @category context
 */
const remove = circular/* .removeLogger */.vl;
/**
 * @since 2.0.0
 * @category context
 */
const replace = circular/* .replaceLogger */.Tg;
/**
 * @since 2.0.0
 * @category context
 */
const replaceEffect = circular/* .replaceLoggerEffect */.cm;
/**
 * @since 2.0.0
 * @category context
 */
const replaceScoped = circular/* .replaceLoggerScoped */.Pg;
/**
 * @since 2.0.0
 * @category constructors
 */
const simple = logger/* .simple */.bQ;
/**
 * @since 2.0.0
 * @category constructors
 */
const succeed = logger/* .succeed */.Py;
/**
 * @since 2.0.0
 * @category constructors
 */
const sync = logger/* .sync */.OH;
/**
 * @since 2.0.0
 * @category constructors
 */
const Logger_test = test;
/**
 * Sets the minimum log level for subsequent logging operations, allowing
 * control over which log messages are displayed based on their severity.
 *
 * @example
 * ```ts
 * import { Effect, Logger, LogLevel } from "effect"
 *
 * const program = Effect.logDebug("message1").pipe(Logger.withMinimumLogLevel(LogLevel.Debug))
 *
 * Effect.runFork(program)
 * // timestamp=... level=DEBUG fiber=#0 message=message1
 * ```
 *
 * @since 2.0.0
 * @category context
 */
const withMinimumLogLevel = circular/* .withMinimumLogLevel */.Z1;
/**
 * @since 2.0.0
 * @category tracing
 */
const withSpanAnnotations = fiberRuntime/* .loggerWithSpanAnnotations */.By;
/**
 * Combines this logger with the specified logger to produce a new logger that
 * logs to both this logger and that logger.
 *
 * @since 2.0.0
 * @category zipping
 */
const zip = logger/* .zip */.yU;
/**
 * @since 2.0.0
 * @category zipping
 */
const zipLeft = logger/* .zipLeft */.pi;
/**
 * @since 2.0.0
 * @category zipping
 */
const zipRight = logger/* .zipRight */.aN;
/**
 * @since 2.0.0
 * @category constructors
 */
const defaultLogger = fiberRuntime/* .defaultLogger */.Um;
/**
 * The `jsonLogger` logger formats log entries as JSON objects, making them easy to
 * integrate with logging systems that consume JSON data.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.json)))
 * // {"message":["message1","message2"],"logLevel":"INFO","timestamp":"...","annotations":{"key2":"value2","key1":"value1"},"spans":{"myspan":0},"fiberId":"#0"}
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const jsonLogger = logger/* .jsonLogger */.Rz;
/**
 * This logger outputs logs in a human-readable format that is easy to read
 * during development or in a production console.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.logFmt)))
 * // timestamp=... level=INFO fiber=#0 message=message1 message=message2 myspan=0ms key2=value2 key1=value1
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const logfmtLogger = logger/* .logfmtLogger */.mE;
/**
 * @since 2.0.0
 * @category constructors
 */
const stringLogger = logger/* .stringLogger */.oz;
/**
 * The pretty logger utilizes the capabilities of the console API to generate
 * visually engaging and color-enhanced log outputs. This feature is
 * particularly useful for improving the readability of log messages during
 * development and debugging processes.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.pretty)))
 * //         green --v                      v-- bold and cyan
 * // [07:51:54.434] INFO (#0) myspan=1ms: message1
 * //   message2
 * //    v-- bold
 * //   key2: value2
 * //   key1: value1
 * ```
 *
 * @since 3.5.0
 * @category constructors
 */
const prettyLogger = logger/* .prettyLogger */.xW;
/**
 * A default version of the pretty logger.
 *
 * @since 3.8.0
 * @category constructors
 */
const prettyLoggerDefault = logger/* .prettyLoggerDefault */.m5;
/**
 * The structured logger provides detailed log outputs, structured in a way that
 * retains comprehensive traceability of the events, suitable for deeper
 * analysis and troubleshooting.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.structured)))
 * // {
 * //   message: [ 'message1', 'message2' ],
 * //   logLevel: 'INFO',
 * //   timestamp: '2024-07-09T14:05:41.623Z',
 * //   cause: undefined,
 * //   annotations: { key2: 'value2', key1: 'value1' },
 * //   spans: { myspan: 0 },
 * //   fiberId: '#0'
 * // }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const structuredLogger = logger/* .structuredLogger */.SZ;
/**
 * @since 2.0.0
 * @category constructors
 */
const tracerLogger = fiberRuntime/* .tracerLogger */.ek;
/**
 * The `json` logger formats log entries as JSON objects, making them easy to
 * integrate with logging systems that consume JSON data.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.json)))
 * // {"message":["message1","message2"],"logLevel":"INFO","timestamp":"...","annotations":{"key2":"value2","key1":"value1"},"spans":{"myspan":0},"fiberId":"#0"}
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const json = /*#__PURE__*/replace(fiberRuntime/* .defaultLogger */.Um, fiberRuntime/* .jsonLogger */.Rz);
/**
 * This logger outputs logs in a human-readable format that is easy to read
 * during development or in a production console.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.logFmt)))
 * // timestamp=... level=INFO fiber=#0 message=message1 message=message2 myspan=0ms key2=value2 key1=value1
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const logFmt = /*#__PURE__*/replace(fiberRuntime/* .defaultLogger */.Um, fiberRuntime/* .logFmtLogger */.S_);
/**
 * The pretty logger utilizes the capabilities of the console API to generate
 * visually engaging and color-enhanced log outputs. This feature is
 * particularly useful for improving the readability of log messages during
 * development and debugging processes.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.pretty)))
 * //         green --v                      v-- bold and cyan
 * // [07:51:54.434] INFO (#0) myspan=1ms: message1
 * //   message2
 * //    v-- bold
 * //   key2: value2
 * //   key1: value1
 * ```
 *
 * @since 3.5.0
 * @category constructors
 */
const pretty = /*#__PURE__*/replace(fiberRuntime/* .defaultLogger */.Um, fiberRuntime/* .prettyLogger */.xW);
/**
 * The structured logger provides detailed log outputs, structured in a way that
 * retains comprehensive traceability of the events, suitable for deeper
 * analysis and troubleshooting.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * const program = Effect.log("message1", "message2").pipe(
 *   Effect.annotateLogs({ key1: "value1", key2: "value2" }),
 *   Effect.withLogSpan("myspan")
 * )
 *
 * Effect.runFork(program.pipe(Effect.provide(Logger.structured)))
 * // {
 * //   message: [ 'message1', 'message2' ],
 * //   logLevel: 'INFO',
 * //   timestamp: '2024-07-09T14:05:41.623Z',
 * //   cause: undefined,
 * //   annotations: { key2: 'value2', key1: 'value1' },
 * //   spans: { myspan: 0 },
 * //   fiberId: '#0'
 * // }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const structured = /*#__PURE__*/replace(fiberRuntime/* .defaultLogger */.Um, fiberRuntime/* .structuredLogger */.SZ);
/**
 * Sets the minimum log level for logging operations, allowing control over
 * which log messages are displayed based on their severity.
 *
 * @example
 * ```ts
 * import { Effect, Logger, LogLevel } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Executing task...")
 *   yield* Effect.sleep("100 millis")
 *   console.log("task done")
 * })
 *
 * // Logging disabled using a layer
 * Effect.runFork(program.pipe(Effect.provide(Logger.minimumLogLevel(LogLevel.None))))
 * // task done
 * ```
 *
 * @since 2.0.0
 * @category context
 */
const minimumLogLevel = circular/* .minimumLogLevel */.dl;
/**
 * Returns `true` if the specified value is a `Logger`, otherwise returns `false`.
 *
 * @since 1.0.0
 * @category guards
 */
const isLogger = logger/* .isLogger */.jj;
//# sourceMappingURL=Logger.js.map

},
96140(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  ReadonlyTypeId: () => (/* binding */ Mailbox_ReadonlyTypeId),
  TypeId: () => (/* binding */ Mailbox_TypeId),
  fromStream: () => (/* binding */ Mailbox_fromStream),
  into: () => (/* binding */ Mailbox_into),
  isMailbox: () => (/* binding */ Mailbox_isMailbox),
  isReadonlyMailbox: () => (/* binding */ Mailbox_isReadonlyMailbox),
  make: () => (/* binding */ Mailbox_make),
  toChannel: () => (/* binding */ Mailbox_toChannel),
  toStream: () => (/* binding */ Mailbox_toStream)
});

// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Array.js
var esm_Array = __webpack_require__(93118);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cause.js
var Cause = __webpack_require__(56560);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Chunk.js
var Chunk = __webpack_require__(878);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Effectable.js
var Effectable = __webpack_require__(42650);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Function.js
var Function = __webpack_require__(61279);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Inspectable.js
var Inspectable = __webpack_require__(65051);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Option.js
var Option = __webpack_require__(31706);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Pipeable.js
var Pipeable = __webpack_require__(79083);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel.js
var channel = __webpack_require__(1094);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/channelExecutor.js + 2 modules
var channelExecutor = __webpack_require__(91438);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/core-stream.js
var core_stream = __webpack_require__(67671);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/core.js
var core = __webpack_require__(55294);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/effect/circular.js
var circular = __webpack_require__(64262);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiberRuntime.js + 2 modules
var fiberRuntime = __webpack_require__(55845);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stream.js + 9 modules
var stream = __webpack_require__(10251);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/mailbox.js
















/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("effect/Mailbox");
/** @internal */
const ReadonlyTypeId = /*#__PURE__*/Symbol.for("effect/Mailbox/ReadonlyMailbox");
/** @internal */
const isMailbox = u => hasProperty(u, TypeId);
/** @internal */
const isReadonlyMailbox = u => hasProperty(u, ReadonlyTypeId);
const empty = /*#__PURE__*/Chunk.empty();
const exitEmpty = /*#__PURE__*/core/* .exitSucceed */.xtk(empty);
const exitFalse = /*#__PURE__*/core/* .exitSucceed */.xtk(false);
const exitTrue = /*#__PURE__*/core/* .exitSucceed */.xtk(true);
const constDone = [empty, true];
class MailboxImpl extends Effectable.Class {
  scheduler;
  capacity;
  strategy;
  [TypeId] = TypeId;
  [ReadonlyTypeId] = ReadonlyTypeId;
  state = {
    _tag: "Open",
    takers: /*#__PURE__*/new Set(),
    offers: /*#__PURE__*/new Set(),
    awaiters: /*#__PURE__*/new Set()
  };
  messages = [];
  messagesChunk = /*#__PURE__*/Chunk.empty();
  constructor(scheduler, capacity, strategy) {
    super();
    this.scheduler = scheduler;
    this.capacity = capacity;
    this.strategy = strategy;
  }
  offer(message) {
    return core/* .suspend */.DYE(() => {
      if (this.state._tag !== "Open") {
        return exitFalse;
      } else if (this.messages.length + this.messagesChunk.length >= this.capacity) {
        switch (this.strategy) {
          case "dropping":
            return exitFalse;
          case "suspend":
            if (this.capacity <= 0 && this.state.takers.size > 0) {
              this.messages.push(message);
              this.releaseTaker();
              return exitTrue;
            }
            return this.offerRemainingSingle(message);
          case "sliding":
            this.unsafeTake();
            this.messages.push(message);
            return exitTrue;
        }
      }
      this.messages.push(message);
      this.scheduleReleaseTaker();
      return exitTrue;
    });
  }
  unsafeOffer(message) {
    if (this.state._tag !== "Open") {
      return false;
    } else if (this.messages.length + this.messagesChunk.length >= this.capacity) {
      if (this.strategy === "sliding") {
        this.unsafeTake();
        this.messages.push(message);
        return true;
      } else if (this.capacity <= 0 && this.state.takers.size > 0) {
        this.messages.push(message);
        this.releaseTaker();
        return true;
      }
      return false;
    }
    this.messages.push(message);
    this.scheduleReleaseTaker();
    return true;
  }
  offerAll(messages) {
    return core/* .suspend */.DYE(() => {
      if (this.state._tag !== "Open") {
        return core/* .succeed */.PyW(Chunk.fromIterable(messages));
      }
      const remaining = this.unsafeOfferAllArray(messages);
      if (remaining.length === 0) {
        return exitEmpty;
      } else if (this.strategy === "dropping") {
        return core/* .succeed */.PyW(Chunk.unsafeFromArray(remaining));
      }
      return this.offerRemainingArray(remaining);
    });
  }
  unsafeOfferAll(messages) {
    return Chunk.unsafeFromArray(this.unsafeOfferAllArray(messages));
  }
  unsafeOfferAllArray(messages) {
    if (this.state._tag !== "Open") {
      return esm_Array.fromIterable(messages);
    } else if (this.capacity === Number.POSITIVE_INFINITY || this.strategy === "sliding") {
      if (this.messages.length > 0) {
        this.messagesChunk = Chunk.appendAll(this.messagesChunk, Chunk.unsafeFromArray(this.messages));
      }
      if (this.strategy === "sliding") {
        this.messagesChunk = this.messagesChunk.pipe(Chunk.appendAll(Chunk.fromIterable(messages)), Chunk.takeRight(this.capacity));
      } else if (Chunk.isChunk(messages)) {
        this.messagesChunk = Chunk.appendAll(this.messagesChunk, messages);
      } else {
        this.messages = esm_Array.fromIterable(messages);
      }
      this.scheduleReleaseTaker();
      return [];
    }
    const free = this.capacity <= 0 ? this.state.takers.size : this.capacity - this.messages.length - this.messagesChunk.length;
    if (free === 0) {
      return esm_Array.fromIterable(messages);
    }
    const remaining = [];
    let i = 0;
    for (const message of messages) {
      if (i < free) {
        this.messages.push(message);
      } else {
        remaining.push(message);
      }
      i++;
    }
    this.scheduleReleaseTaker();
    return remaining;
  }
  fail(error) {
    return this.done(core/* .exitFail */.Rkt(error));
  }
  failCause(cause) {
    return this.done(core/* .exitFailCause */.cbD(cause));
  }
  unsafeDone(exit) {
    if (this.state._tag !== "Open") {
      return false;
    } else if (this.state.offers.size === 0 && this.messages.length === 0 && this.messagesChunk.length === 0) {
      this.finalize(exit);
      return true;
    }
    this.state = {
      ...this.state,
      _tag: "Closing",
      exit
    };
    return true;
  }
  shutdown = /*#__PURE__*/core/* .sync */.OH5(() => {
    if (this.state._tag === "Done") {
      return true;
    }
    this.messages = [];
    this.messagesChunk = empty;
    const offers = this.state.offers;
    this.finalize(this.state._tag === "Open" ? core/* .exitVoid */.x5l : this.state.exit);
    if (offers.size > 0) {
      for (const entry of offers) {
        if (entry._tag === "Single") {
          entry.resume(exitFalse);
        } else {
          entry.resume(core/* .exitSucceed */.xtk(Chunk.unsafeFromArray(entry.remaining.slice(entry.offset))));
        }
      }
      offers.clear();
    }
    return true;
  });
  done(exit) {
    return core/* .sync */.OH5(() => this.unsafeDone(exit));
  }
  end = /*#__PURE__*/this.done(core/* .exitVoid */.x5l);
  clear = /*#__PURE__*/core/* .suspend */.DYE(() => {
    if (this.state._tag === "Done") {
      return core/* .exitAs */.VuY(this.state.exit, empty);
    }
    const messages = this.unsafeTakeAll();
    this.releaseCapacity();
    return core/* .succeed */.PyW(messages);
  });
  takeAll = /*#__PURE__*/core/* .suspend */.DYE(() => {
    if (this.state._tag === "Done") {
      return core/* .exitAs */.VuY(this.state.exit, constDone);
    }
    const messages = this.unsafeTakeAll();
    if (messages.length === 0) {
      return core/* .zipRight */.aNH(this.awaitTake, this.takeAll);
    }
    return core/* .succeed */.PyW([messages, this.releaseCapacity()]);
  });
  takeN(n) {
    return core/* .suspend */.DYE(() => {
      if (this.state._tag === "Done") {
        return core/* .exitAs */.VuY(this.state.exit, constDone);
      } else if (n <= 0) {
        return core/* .succeed */.PyW([empty, false]);
      }
      n = Math.min(n, this.capacity);
      let messages;
      if (n <= this.messagesChunk.length) {
        messages = Chunk.take(this.messagesChunk, n);
        this.messagesChunk = Chunk.drop(this.messagesChunk, n);
      } else if (n <= this.messages.length + this.messagesChunk.length) {
        this.messagesChunk = Chunk.appendAll(this.messagesChunk, Chunk.unsafeFromArray(this.messages));
        this.messages = [];
        messages = Chunk.take(this.messagesChunk, n);
        this.messagesChunk = Chunk.drop(this.messagesChunk, n);
      } else {
        return core/* .zipRight */.aNH(this.awaitTake, this.takeN(n));
      }
      return core/* .succeed */.PyW([messages, this.releaseCapacity()]);
    });
  }
  unsafeTake() {
    if (this.state._tag === "Done") {
      return core/* .exitZipRight */.il9(this.state.exit, core/* .exitFail */.Rkt(new Cause.NoSuchElementException()));
    }
    let message;
    if (this.messagesChunk.length > 0) {
      message = Chunk.unsafeHead(this.messagesChunk);
      this.messagesChunk = Chunk.drop(this.messagesChunk, 1);
    } else if (this.messages.length > 0) {
      message = this.messages[0];
      this.messagesChunk = Chunk.drop(Chunk.unsafeFromArray(this.messages), 1);
      this.messages = [];
    } else if (this.capacity <= 0 && this.state.offers.size > 0) {
      this.capacity = 1;
      this.releaseCapacity();
      this.capacity = 0;
      return this.messages.length > 0 ? core/* .exitSucceed */.xtk(this.messages.pop()) : undefined;
    } else {
      return undefined;
    }
    this.releaseCapacity();
    return core/* .exitSucceed */.xtk(message);
  }
  take = /*#__PURE__*/core/* .suspend */.DYE(() => this.unsafeTake() ?? core/* .zipRight */.aNH(this.awaitTake, this.take));
  await = /*#__PURE__*/core/* .asyncInterrupt */.QUl(resume => {
    if (this.state._tag === "Done") {
      return resume(this.state.exit);
    }
    this.state.awaiters.add(resume);
    return core/* .sync */.OH5(() => {
      if (this.state._tag !== "Done") {
        this.state.awaiters.delete(resume);
      }
    });
  });
  unsafeSize() {
    const size = this.messages.length + this.messagesChunk.length;
    return this.state._tag === "Done" ? Option.none() : Option.some(size);
  }
  size = /*#__PURE__*/core/* .sync */.OH5(() => this.unsafeSize());
  commit() {
    return this.takeAll;
  }
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
  toJSON() {
    return {
      _id: "effect/Mailbox",
      state: this.state._tag,
      size: this.unsafeSize().toJSON()
    };
  }
  toString() {
    return Inspectable.format(this);
  }
  [Inspectable.NodeInspectSymbol]() {
    return Inspectable.format(this);
  }
  offerRemainingSingle(message) {
    return core/* .asyncInterrupt */.QUl(resume => {
      if (this.state._tag !== "Open") {
        return resume(exitFalse);
      }
      const entry = {
        _tag: "Single",
        message,
        resume
      };
      this.state.offers.add(entry);
      return core/* .sync */.OH5(() => {
        if (this.state._tag === "Open") {
          this.state.offers.delete(entry);
        }
      });
    });
  }
  offerRemainingArray(remaining) {
    return core/* .asyncInterrupt */.QUl(resume => {
      if (this.state._tag !== "Open") {
        return resume(core/* .exitSucceed */.xtk(Chunk.unsafeFromArray(remaining)));
      }
      const entry = {
        _tag: "Array",
        remaining,
        offset: 0,
        resume
      };
      this.state.offers.add(entry);
      return core/* .sync */.OH5(() => {
        if (this.state._tag === "Open") {
          this.state.offers.delete(entry);
        }
      });
    });
  }
  releaseCapacity() {
    if (this.state._tag === "Done") {
      return this.state.exit._tag === "Success";
    } else if (this.state.offers.size === 0) {
      if (this.state._tag === "Closing" && this.messages.length === 0 && this.messagesChunk.length === 0) {
        this.finalize(this.state.exit);
        return this.state.exit._tag === "Success";
      }
      return false;
    }
    let n = this.capacity - this.messages.length - this.messagesChunk.length;
    for (const entry of this.state.offers) {
      if (n === 0) return false;else if (entry._tag === "Single") {
        this.messages.push(entry.message);
        n--;
        entry.resume(exitTrue);
        this.state.offers.delete(entry);
      } else {
        for (; entry.offset < entry.remaining.length; entry.offset++) {
          if (n === 0) return false;
          this.messages.push(entry.remaining[entry.offset]);
          n--;
        }
        entry.resume(exitEmpty);
        this.state.offers.delete(entry);
      }
    }
    return false;
  }
  awaitTake = /*#__PURE__*/core/* .asyncInterrupt */.QUl(resume => {
    if (this.state._tag === "Done") {
      return resume(this.state.exit);
    }
    this.state.takers.add(resume);
    return core/* .sync */.OH5(() => {
      if (this.state._tag !== "Done") {
        this.state.takers.delete(resume);
      }
    });
  });
  scheduleRunning = false;
  scheduleReleaseTaker() {
    if (this.scheduleRunning) {
      return;
    }
    this.scheduleRunning = true;
    this.scheduler.scheduleTask(this.releaseTaker, 0);
  }
  releaseTaker = () => {
    this.scheduleRunning = false;
    if (this.state._tag === "Done") {
      return;
    } else if (this.state.takers.size === 0) {
      return;
    }
    for (const taker of this.state.takers) {
      this.state.takers.delete(taker);
      taker(core/* .exitVoid */.x5l);
      if (this.messages.length + this.messagesChunk.length === 0) {
        break;
      }
    }
  };
  unsafeTakeAll() {
    if (this.messagesChunk.length > 0) {
      const messages = this.messages.length > 0 ? Chunk.appendAll(this.messagesChunk, Chunk.unsafeFromArray(this.messages)) : this.messagesChunk;
      this.messagesChunk = empty;
      this.messages = [];
      return messages;
    } else if (this.messages.length > 0) {
      const messages = Chunk.unsafeFromArray(this.messages);
      this.messages = [];
      return messages;
    } else if (this.state._tag !== "Done" && this.state.offers.size > 0) {
      this.capacity = 1;
      this.releaseCapacity();
      this.capacity = 0;
      return Chunk.of(this.messages.pop());
    }
    return empty;
  }
  finalize(exit) {
    if (this.state._tag === "Done") {
      return;
    }
    const openState = this.state;
    this.state = {
      _tag: "Done",
      exit
    };
    for (const taker of openState.takers) {
      taker(exit);
    }
    openState.takers.clear();
    for (const awaiter of openState.awaiters) {
      awaiter(exit);
    }
    openState.awaiters.clear();
  }
}
/** @internal */
const make = capacity => core/* .withFiberRuntime */.$we(fiber => core/* .succeed */.PyW(new MailboxImpl(fiber.currentScheduler, typeof capacity === "number" ? capacity : capacity?.capacity ?? Number.POSITIVE_INFINITY, typeof capacity === "number" ? "suspend" : capacity?.strategy ?? "suspend")));
/** @internal */
const into = /*#__PURE__*/(0,Function.dual)(2, (effect, self) => core/* .uninterruptibleMask */.FcF(restore => core/* .matchCauseEffect */.khu(restore(effect), {
  onFailure: cause => self.failCause(cause),
  onSuccess: _ => self.end
})));
/** @internal */
const toChannel = self => {
  const loop = core_stream/* .flatMap */.qI(self.takeAll, ([messages, done]) => done ? messages.length === 0 ? core_stream/* ["void"] */.rI : core_stream/* .write */.M9(messages) : channel/* .zipRight */.aN(core_stream/* .write */.M9(messages), loop));
  return loop;
};
/** @internal */
const toStream = self => stream/* .fromChannel */.EfB(toChannel(self));
/** @internal */
const fromStream = /*#__PURE__*/(0,Function.dual)(args => stream/* .isStream */.rLs(args[0]), (self, options) => core/* .tap */.Mim(fiberRuntime/* .acquireRelease */.Q5(make(options), mailbox => mailbox.shutdown), mailbox => {
  const writer = core_stream/* .readWithCause */.u({
    onInput: input => core_stream/* .flatMap */.qI(mailbox.offerAll(input), () => writer),
    onFailure: cause => mailbox.failCause(cause),
    onDone: () => mailbox.end
  });
  return fiberRuntime/* .scopeWith */.NB(scope => stream/* .toChannel */.pr8(self).pipe(core_stream/* .pipeTo */.WK(writer), channelExecutor/* .runIn */.VO(scope), circular/* .forkIn */.ar(scope)));
}));
//# sourceMappingURL=mailbox.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Predicate.js
var Predicate = __webpack_require__(35034);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Mailbox.js


/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
const Mailbox_TypeId = TypeId;
/**
 * @since 3.8.0
 * @experimental
 * @category type ids
 */
const Mailbox_ReadonlyTypeId = ReadonlyTypeId;
/**
 * @since 3.8.0
 * @experimental
 * @category guards
 */
const Mailbox_isMailbox = u => (0,Predicate.hasProperty)(u, Mailbox_TypeId);
/**
 * @since 3.8.0
 * @experimental
 * @category guards
 */
const Mailbox_isReadonlyMailbox = u => (0,Predicate.hasProperty)(u, Mailbox_ReadonlyTypeId);
/**
 * A `Mailbox` is a queue that can be signaled to be done or failed.
 *
 * @since 3.8.0
 * @experimental
 * @category constructors
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Effect, Mailbox } from "effect"
 *
 * Effect.gen(function*() {
 *   const mailbox = yield* Mailbox.make<number, string>()
 *
 *   // add messages to the mailbox
 *   yield* mailbox.offer(1)
 *   yield* mailbox.offer(2)
 *   yield* mailbox.offerAll([3, 4, 5])
 *
 *   // take messages from the mailbox
 *   const [messages, done] = yield* mailbox.takeAll
 *   assert.deepStrictEqual(messages, [1, 2, 3, 4, 5])
 *   assert.strictEqual(done, false)
 *
 *   // signal that the mailbox is done
 *   yield* mailbox.end
 *   const [messages2, done2] = yield* mailbox.takeAll
 *   assert.deepStrictEqual(messages2, [])
 *   assert.strictEqual(done2, true)
 *
 *   // signal that the mailbox has failed
 *   yield* mailbox.fail("boom")
 * })
 * ```
 */
const Mailbox_make = make;
/**
 * Run an `Effect` into a `Mailbox`, where success ends the mailbox and failure
 * fails the mailbox.
 *
 * @since 3.8.0
 * @experimental
 * @category combinators
 */
const Mailbox_into = into;
/**
 * Create a `Channel` from a `Mailbox`.
 *
 * @since 3.8.0
 * @experimental
 * @category conversions
 */
const Mailbox_toChannel = toChannel;
/**
 * Create a `Stream` from a `Mailbox`.
 *
 * @since 3.8.0
 * @experimental
 * @category conversions
 */
const Mailbox_toStream = toStream;
/**
 * Create a `ReadonlyMailbox` from a `Stream`.
 *
 * @since 3.11.0
 * @experimental
 * @category conversions
 */
const Mailbox_fromStream = fromStream;
//# sourceMappingURL=Mailbox.js.map

},
57737(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  PoolTypeId: () => (PoolTypeId),
  get: () => (get),
  invalidate: () => (invalidate),
  isPool: () => (isPool),
  make: () => (make),
  makeWithTTL: () => (makeWithTTL)
});
/* import */ var _internal_pool_js__rspack_import_0 = __webpack_require__(71391);

/**
 * @since 2.0.0
 * @category symbols
 */
const PoolTypeId = _internal_pool_js__rspack_import_0/* .PoolTypeId */.cy;
/**
 * Returns `true` if the specified value is a `Pool`, `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isPool = _internal_pool_js__rspack_import_0/* .isPool */.D6;
/**
 * Makes a new pool of the specified fixed size. The pool is returned in a
 * `Scope`, which governs the lifetime of the pool. When the pool is shutdown
 * because the `Scope` is closed, the individual items allocated by the pool
 * will be released in some unspecified order.
 *
 * By setting the `concurrency` parameter, you can control the level of concurrent
 * access per pool item. By default, the number of permits is set to `1`.
 *
 * `targetUtilization` determines when to create new pool items. It is a value
 * between 0 and 1, where 1 means only create new pool items when all the existing
 * items are fully utilized.
 *
 * A `targetUtilization` of 0.5 will create new pool items when the existing items are
 * 50% utilized.
 *
 * @since 2.0.0
 * @category constructors
 */
const make = _internal_pool_js__rspack_import_0/* .make */.L8;
/**
 * Makes a new pool with the specified minimum and maximum sizes and time to
 * live before a pool whose excess items are not being used will be shrunk
 * down to the minimum size. The pool is returned in a `Scope`, which governs
 * the lifetime of the pool. When the pool is shutdown because the `Scope` is
 * used, the individual items allocated by the pool will be released in some
 * unspecified order.
 *
 * By setting the `concurrency` parameter, you can control the level of concurrent
 * access per pool item. By default, the number of permits is set to `1`.
 *
 * `targetUtilization` determines when to create new pool items. It is a value
 * between 0 and 1, where 1 means only create new pool items when all the existing
 * items are fully utilized.
 *
 * A `targetUtilization` of 0.5 will create new pool items when the existing items are
 * 50% utilized.
 *
 * The `timeToLiveStrategy` determines how items are invalidated. If set to
 * "creation", then items are invalidated based on their creation time. If set
 * to "usage", then items are invalidated based on pool usage.
 *
 * By default, the `timeToLiveStrategy` is set to "usage".
 *
 * ```ts skip-type-checking
 * import { createConnection } from "mysql2";
 * import { Duration, Effect, Pool } from "effect"
 *
 * const acquireDBConnection = Effect.acquireRelease(
 *   Effect.sync(() => createConnection('mysql://...')),
 *   (connection) => Effect.sync(() => connection.end(() => {})),
 * )
 *
 * const connectionPool = Effect.flatMap(
 *  Pool.makeWithTTL({
 *     acquire: acquireDBConnection,
 *     min: 10,
 *     max: 20,
 *     timeToLive: Duration.seconds(60)
 *   }),
 *   (pool) => pool.get
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const makeWithTTL = _internal_pool_js__rspack_import_0/* .makeWithTTL */.Jq;
/**
 * Retrieves an item from the pool in a scoped effect. Note that if
 * acquisition fails, then the returned effect will fail for that same reason.
 * Retrying a failed acquisition attempt will repeat the acquisition attempt.
 *
 * @since 2.0.0
 * @category getters
 */
const get = _internal_pool_js__rspack_import_0/* .get */.Jt;
/**
 * Invalidates the specified item. This will cause the pool to eventually
 * reallocate the item, although this reallocation may occur lazily rather
 * than eagerly.
 *
 * @since 2.0.0
 * @category combinators
 */
const invalidate = _internal_pool_js__rspack_import_0/* .invalidate */.Y1;
//# sourceMappingURL=Pool.js.map

},
59776(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  unify: () => (unify)
});
/* import */ var _Function_js__rspack_import_0 = __webpack_require__(61279);
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */
const unify = _Function_js__rspack_import_0.identity;
//# sourceMappingURL=Unify.js.map

},
84176(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Arbitrary: () => (/* reexport */ Arbitrary_namespaceObject),
  Array: () => (/* reexport */ esm_Array),
  BigDecimal: () => (/* reexport */ BigDecimal),
  BigInt: () => (/* reexport */ esm_BigInt),
  Boolean: () => (/* reexport */ Boolean),
  Brand: () => (/* reexport */ Brand),
  Cache: () => (/* reexport */ Cache_namespaceObject),
  Cause: () => (/* reexport */ Cause),
  Channel: () => (/* reexport */ Channel),
  ChildExecutorDecision: () => (/* reexport */ ChildExecutorDecision_namespaceObject),
  Chunk: () => (/* reexport */ Chunk),
  Clock: () => (/* reexport */ Clock),
  Config: () => (/* reexport */ Config),
  ConfigError: () => (/* reexport */ ConfigError),
  ConfigProvider: () => (/* reexport */ ConfigProvider),
  ConfigProviderPathPatch: () => (/* reexport */ ConfigProviderPathPatch),
  Console: () => (/* reexport */ Console_namespaceObject),
  Context: () => (/* reexport */ Context),
  Cron: () => (/* reexport */ Cron),
  Data: () => (/* reexport */ Data),
  DateTime: () => (/* reexport */ DateTime),
  DefaultServices: () => (/* reexport */ DefaultServices),
  Deferred: () => (/* reexport */ Deferred),
  Differ: () => (/* reexport */ Differ),
  Duration: () => (/* reexport */ Duration),
  Effect: () => (/* reexport */ Effect),
  Effectable: () => (/* reexport */ Effectable),
  Either: () => (/* reexport */ Either),
  Encoding: () => (/* reexport */ Encoding),
  Equal: () => (/* reexport */ Equal),
  Equivalence: () => (/* reexport */ Equivalence),
  ExecutionPlan: () => (/* reexport */ ExecutionPlan_namespaceObject),
  ExecutionStrategy: () => (/* reexport */ ExecutionStrategy),
  Exit: () => (/* reexport */ Exit),
  FastCheck: () => (/* reexport */ FastCheck_namespaceObject),
  Fiber: () => (/* reexport */ Fiber),
  FiberHandle: () => (/* reexport */ FiberHandle_namespaceObject),
  FiberId: () => (/* reexport */ FiberId),
  FiberMap: () => (/* reexport */ FiberMap_namespaceObject),
  FiberRef: () => (/* reexport */ FiberRef),
  FiberRefs: () => (/* reexport */ FiberRefs),
  FiberRefsPatch: () => (/* reexport */ FiberRefsPatch),
  FiberSet: () => (/* reexport */ FiberSet),
  FiberStatus: () => (/* reexport */ FiberStatus),
  Function: () => (/* reexport */ Function),
  GlobalValue: () => (/* reexport */ GlobalValue),
  Graph: () => (/* reexport */ Graph_namespaceObject),
  GroupBy: () => (/* reexport */ GroupBy_namespaceObject),
  HKT: () => (/* reexport */ HKT_namespaceObject),
  Hash: () => (/* reexport */ Hash),
  HashMap: () => (/* reexport */ HashMap),
  HashRing: () => (/* reexport */ HashRing_namespaceObject),
  HashSet: () => (/* reexport */ HashSet),
  Inspectable: () => (/* reexport */ Inspectable),
  Iterable: () => (/* reexport */ Iterable),
  JSONSchema: () => (/* reexport */ JSONSchema),
  KeyedPool: () => (/* reexport */ KeyedPool_namespaceObject),
  Layer: () => (/* reexport */ Layer),
  LayerMap: () => (/* reexport */ LayerMap_namespaceObject),
  List: () => (/* reexport */ List),
  LogLevel: () => (/* reexport */ LogLevel),
  LogSpan: () => (/* reexport */ LogSpan),
  Logger: () => (/* reexport */ Logger),
  Mailbox: () => (/* reexport */ Mailbox),
  ManagedRuntime: () => (/* reexport */ ManagedRuntime_namespaceObject),
  Match: () => (/* reexport */ Match),
  MergeDecision: () => (/* reexport */ MergeDecision),
  MergeState: () => (/* reexport */ MergeState_namespaceObject),
  MergeStrategy: () => (/* reexport */ MergeStrategy_namespaceObject),
  Metric: () => (/* reexport */ Metric_namespaceObject),
  MetricBoundaries: () => (/* reexport */ MetricBoundaries_namespaceObject),
  MetricHook: () => (/* reexport */ MetricHook_namespaceObject),
  MetricKey: () => (/* reexport */ MetricKey_namespaceObject),
  MetricKeyType: () => (/* reexport */ MetricKeyType_namespaceObject),
  MetricLabel: () => (/* reexport */ MetricLabel_namespaceObject),
  MetricPair: () => (/* reexport */ MetricPair_namespaceObject),
  MetricPolling: () => (/* reexport */ MetricPolling_namespaceObject),
  MetricRegistry: () => (/* reexport */ MetricRegistry_namespaceObject),
  MetricState: () => (/* reexport */ MetricState_namespaceObject),
  Micro: () => (/* reexport */ Micro),
  ModuleVersion: () => (/* reexport */ ModuleVersion_namespaceObject),
  MutableHashMap: () => (/* reexport */ MutableHashMap),
  MutableHashSet: () => (/* reexport */ MutableHashSet_namespaceObject),
  MutableList: () => (/* reexport */ MutableList),
  MutableQueue: () => (/* reexport */ MutableQueue),
  MutableRef: () => (/* reexport */ MutableRef),
  NonEmptyIterable: () => (/* reexport */ NonEmptyIterable_namespaceObject),
  Number: () => (/* reexport */ esm_Number),
  Option: () => (/* reexport */ Option),
  Order: () => (/* reexport */ Order),
  Ordering: () => (/* reexport */ Ordering_namespaceObject),
  ParseResult: () => (/* reexport */ ParseResult),
  PartitionedSemaphore: () => (/* reexport */ PartitionedSemaphore_namespaceObject),
  Pipeable: () => (/* reexport */ Pipeable),
  Pool: () => (/* reexport */ Pool),
  Predicate: () => (/* reexport */ Predicate),
  Pretty: () => (/* reexport */ Pretty_namespaceObject),
  PrimaryKey: () => (/* reexport */ PrimaryKey_namespaceObject),
  PubSub: () => (/* reexport */ PubSub),
  Queue: () => (/* reexport */ Queue),
  Random: () => (/* reexport */ Random),
  RateLimiter: () => (/* reexport */ RateLimiter_namespaceObject),
  RcMap: () => (/* reexport */ RcMap_namespaceObject),
  RcRef: () => (/* reexport */ RcRef),
  Readable: () => (/* reexport */ Readable),
  Record: () => (/* reexport */ Record),
  RedBlackTree: () => (/* reexport */ RedBlackTree),
  Redacted: () => (/* reexport */ Redacted),
  Ref: () => (/* reexport */ Ref),
  RegExp: () => (/* reexport */ esm_RegExp),
  Reloadable: () => (/* reexport */ Reloadable_namespaceObject),
  Request: () => (/* reexport */ Request),
  RequestBlock: () => (/* reexport */ RequestBlock_namespaceObject),
  RequestResolver: () => (/* reexport */ RequestResolver),
  Resource: () => (/* reexport */ Resource_namespaceObject),
  Runtime: () => (/* reexport */ Runtime),
  RuntimeFlags: () => (/* reexport */ RuntimeFlags_namespaceObject),
  RuntimeFlagsPatch: () => (/* reexport */ RuntimeFlagsPatch),
  STM: () => (/* reexport */ STM_namespaceObject),
  Schedule: () => (/* reexport */ Schedule),
  ScheduleDecision: () => (/* reexport */ ScheduleDecision),
  ScheduleInterval: () => (/* reexport */ ScheduleInterval),
  ScheduleIntervals: () => (/* reexport */ ScheduleIntervals),
  Scheduler: () => (/* reexport */ Scheduler),
  Schema: () => (/* reexport */ Schema),
  SchemaAST: () => (/* reexport */ SchemaAST),
  Scope: () => (/* reexport */ Scope),
  ScopedCache: () => (/* reexport */ ScopedCache_namespaceObject),
  ScopedRef: () => (/* reexport */ ScopedRef_namespaceObject),
  Secret: () => (/* reexport */ Secret_namespaceObject),
  SingleProducerAsyncInput: () => (/* reexport */ SingleProducerAsyncInput_namespaceObject),
  Sink: () => (/* reexport */ Sink),
  SortedMap: () => (/* reexport */ SortedMap_namespaceObject),
  SortedSet: () => (/* reexport */ SortedSet),
  Stream: () => (/* reexport */ Stream),
  StreamEmit: () => (/* reexport */ StreamEmit_namespaceObject),
  StreamHaltStrategy: () => (/* reexport */ StreamHaltStrategy),
  Streamable: () => (/* reexport */ Streamable_namespaceObject),
  String: () => (/* reexport */ esm_String),
  Struct: () => (/* reexport */ Struct),
  Subscribable: () => (/* reexport */ Subscribable_namespaceObject),
  SubscriptionRef: () => (/* reexport */ SubscriptionRef_namespaceObject),
  Supervisor: () => (/* reexport */ Supervisor_namespaceObject),
  Symbol: () => (/* reexport */ Symbol_namespaceObject),
  SynchronizedRef: () => (/* reexport */ SynchronizedRef_namespaceObject),
  TArray: () => (/* reexport */ TArray_namespaceObject),
  TDeferred: () => (/* reexport */ TDeferred_namespaceObject),
  TMap: () => (/* reexport */ TMap_namespaceObject),
  TPriorityQueue: () => (/* reexport */ TPriorityQueue_namespaceObject),
  TPubSub: () => (/* reexport */ TPubSub),
  TQueue: () => (/* reexport */ TQueue),
  TRandom: () => (/* reexport */ TRandom_namespaceObject),
  TReentrantLock: () => (/* reexport */ TReentrantLock_namespaceObject),
  TRef: () => (/* reexport */ TRef_namespaceObject),
  TSemaphore: () => (/* reexport */ TSemaphore_namespaceObject),
  TSet: () => (/* reexport */ TSet_namespaceObject),
  TSubscriptionRef: () => (/* reexport */ TSubscriptionRef_namespaceObject),
  Take: () => (/* reexport */ Take_namespaceObject),
  TestAnnotation: () => (/* reexport */ TestAnnotation_namespaceObject),
  TestAnnotationMap: () => (/* reexport */ TestAnnotationMap_namespaceObject),
  TestAnnotations: () => (/* reexport */ TestAnnotations_namespaceObject),
  TestClock: () => (/* reexport */ TestClock_namespaceObject),
  TestConfig: () => (/* reexport */ TestConfig_namespaceObject),
  TestContext: () => (/* reexport */ TestContext_namespaceObject),
  TestLive: () => (/* reexport */ TestLive_namespaceObject),
  TestServices: () => (/* reexport */ TestServices_namespaceObject),
  TestSized: () => (/* reexport */ TestSized_namespaceObject),
  Tracer: () => (/* reexport */ Tracer),
  Trie: () => (/* reexport */ Trie_namespaceObject),
  Tuple: () => (/* reexport */ Tuple),
  Types: () => (/* reexport */ Types_namespaceObject),
  Unify: () => (/* reexport */ Unify),
  UpstreamPullRequest: () => (/* reexport */ UpstreamPullRequest_namespaceObject),
  UpstreamPullStrategy: () => (/* reexport */ UpstreamPullStrategy_namespaceObject),
  Utils: () => (/* reexport */ Utils),
  absurd: () => (/* reexport */ Function.absurd),
  flow: () => (/* reexport */ Function.flow),
  hole: () => (/* reexport */ Function.hole),
  identity: () => (/* reexport */ Function.identity),
  pipe: () => (/* reexport */ Function.pipe),
  unsafeCoerce: () => (/* reexport */ Function.unsafeCoerce)
});
// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FastCheck.js
var FastCheck_namespaceObject = {};
__webpack_require__.r(FastCheck_namespaceObject);
__webpack_require__.d(FastCheck_namespaceObject, { 
  Arbitrary: () => (fast_check/* .Arbitrary */.Fk),
  ExecutionStatus: () => (fast_check/* .ExecutionStatus */.rI),
  PreconditionFailure: () => (fast_check/* .PreconditionFailure */.Bn),
  Random: () => (fast_check/* .Random */.o8),
  Stream: () => (fast_check/* .Stream */.Z6),
  Value: () => (fast_check/* .Value */.WT),
  VerbosityLevel: () => (fast_check/* .VerbosityLevel */.mQ),
  __commitHash: () => (fast_check/* .__commitHash */.mf),
  __type: () => (fast_check/* .__type */.Fl),
  __version: () => (fast_check/* .__version */.jv),
  anything: () => (fast_check/* .anything */.D8),
  array: () => (fast_check/* .array */.YO),
  ascii: () => (fast_check/* .ascii */.a),
  asciiString: () => (fast_check/* .asciiString */.fP),
  assert: () => (fast_check/* .assert */.vA),
  asyncDefaultReportMessage: () => (fast_check/* .asyncDefaultReportMessage */.zJ),
  asyncModelRun: () => (fast_check/* .asyncModelRun */.zd),
  asyncProperty: () => (fast_check/* .asyncProperty */.OJ),
  asyncStringify: () => (fast_check/* .asyncStringify */.iY),
  asyncToStringMethod: () => (fast_check/* .asyncToStringMethod */.cM),
  base64: () => (fast_check/* .base64 */.K3),
  base64String: () => (fast_check/* .base64String */.UK),
  bigInt: () => (fast_check/* .bigInt */.we),
  bigInt64Array: () => (fast_check/* .bigInt64Array */["do"]),
  bigIntN: () => (fast_check/* .bigIntN */._W),
  bigUint: () => (fast_check/* .bigUint */.V8),
  bigUint64Array: () => (fast_check/* .bigUint64Array */.Qh),
  bigUintN: () => (fast_check/* .bigUintN */.HN),
  boolean: () => (fast_check/* .boolean */.zM),
  char: () => (fast_check/* .char */.Tp),
  char16bits: () => (fast_check/* .char16bits */.qZ),
  check: () => (fast_check/* .check */.z6),
  clone: () => (fast_check/* .clone */.XK),
  cloneIfNeeded: () => (fast_check/* .cloneIfNeeded */.wj),
  cloneMethod: () => (fast_check/* .cloneMethod */.bQ),
  commands: () => (fast_check/* .commands */.Pi),
  compareBooleanFunc: () => (fast_check/* .compareBooleanFunc */.mb),
  compareFunc: () => (fast_check/* .compareFunc */._d),
  configureGlobal: () => (fast_check/* .configureGlobal */.O0),
  constant: () => (fast_check/* .constant */.dY),
  constantFrom: () => (fast_check/* .constantFrom */.$p),
  context: () => (fast_check/* .context */._O),
  createDepthIdentifier: () => (fast_check/* .createDepthIdentifier */.$v),
  date: () => (fast_check/* .date */.p6),
  defaultReportMessage: () => (fast_check/* .defaultReportMessage */.Z1),
  dictionary: () => (fast_check/* .dictionary */.zz),
  domain: () => (fast_check/* .domain */.bl),
  double: () => (fast_check/* .double */.gd),
  emailAddress: () => (fast_check/* .emailAddress */.tY),
  falsy: () => (fast_check/* .falsy */.me),
  float: () => (fast_check/* .float */.fV),
  float32Array: () => (fast_check/* .float32Array */.fJ),
  float64Array: () => (fast_check/* .float64Array */._S),
  fullUnicode: () => (fast_check/* .fullUnicode */.Dy),
  fullUnicodeString: () => (fast_check/* .fullUnicodeString */.SR),
  func: () => (fast_check/* .func */.Pc),
  gen: () => (fast_check/* .gen */.Jk),
  getDepthContextFor: () => (fast_check/* .getDepthContextFor */.Y4),
  hasAsyncToStringMethod: () => (fast_check/* .hasAsyncToStringMethod */.YL),
  hasCloneMethod: () => (fast_check/* .hasCloneMethod */.FQ),
  hasToStringMethod: () => (fast_check/* .hasToStringMethod */.Wt),
  hash: () => (fast_check/* .hash */.tW),
  hexa: () => (fast_check/* .hexa */.Zq),
  hexaString: () => (fast_check/* .hexaString */.I7),
  infiniteStream: () => (fast_check/* .infiniteStream */.r5),
  int16Array: () => (fast_check/* .int16Array */.uV),
  int32Array: () => (fast_check/* .int32Array */.qU),
  int8Array: () => (fast_check/* .int8Array */.JH),
  integer: () => (fast_check/* .integer */.nd),
  ipV4: () => (fast_check/* .ipV4 */.Cv),
  ipV4Extended: () => (fast_check/* .ipV4Extended */.Fh),
  ipV6: () => (fast_check/* .ipV6 */.QL),
  json: () => (fast_check/* .json */.Pq),
  jsonValue: () => (fast_check/* .jsonValue */.IL),
  letrec: () => (fast_check/* .letrec */.Mv),
  limitShrink: () => (fast_check/* .limitShrink */.bb),
  lorem: () => (fast_check/* .lorem */.kP),
  mapToConstant: () => (fast_check/* .mapToConstant */.U1),
  maxSafeInteger: () => (fast_check/* .maxSafeInteger */.KL),
  maxSafeNat: () => (fast_check/* .maxSafeNat */.tz),
  memo: () => (fast_check/* .memo */.ph),
  mixedCase: () => (fast_check/* .mixedCase */.BE),
  modelRun: () => (fast_check/* .modelRun */.tT),
  nat: () => (fast_check/* .nat */.CK),
  noBias: () => (fast_check/* .noBias */.rc),
  noShrink: () => (fast_check/* .noShrink */.Z9),
  object: () => (fast_check/* .object */.Ik),
  oneof: () => (fast_check/* .oneof */.CV),
  option: () => (fast_check/* .option */.uK),
  pre: () => (fast_check/* .pre */.AS),
  property: () => (fast_check/* .property */.MZ),
  readConfigureGlobal: () => (fast_check/* .readConfigureGlobal */.SE),
  record: () => (fast_check/* .record */.g1),
  resetConfigureGlobal: () => (fast_check/* .resetConfigureGlobal */.pB),
  sample: () => (fast_check/* .sample */.XM),
  scheduledModelRun: () => (fast_check/* .scheduledModelRun */.sk),
  scheduler: () => (fast_check/* .scheduler */.ck),
  schedulerFor: () => (fast_check/* .schedulerFor */.fr),
  shuffledSubarray: () => (fast_check/* .shuffledSubarray */.sT),
  sparseArray: () => (fast_check/* .sparseArray */.ke),
  statistics: () => (fast_check/* .statistics */.oG),
  stream: () => (fast_check/* .stream */.Td),
  string: () => (fast_check/* .string */.Yj),
  string16bits: () => (fast_check/* .string16bits */.P),
  stringMatching: () => (fast_check/* .stringMatching */.zc),
  stringOf: () => (fast_check/* .stringOf */.Je),
  stringify: () => (fast_check/* .stringify */.As),
  subarray: () => (fast_check/* .subarray */.Gl),
  toStringMethod: () => (fast_check/* .toStringMethod */.kr),
  tuple: () => (fast_check/* .tuple */.PV),
  uint16Array: () => (fast_check/* .uint16Array */.pp),
  uint32Array: () => (fast_check/* .uint32Array */.Ph),
  uint8Array: () => (fast_check/* .uint8Array */.wF),
  uint8ClampedArray: () => (fast_check/* .uint8ClampedArray */.ot),
  ulid: () => (fast_check/* .ulid */.Z0),
  unicode: () => (fast_check/* .unicode */.YT),
  unicodeJson: () => (fast_check/* .unicodeJson */.AY),
  unicodeJsonValue: () => (fast_check/* .unicodeJsonValue */.OX),
  unicodeString: () => (fast_check/* .unicodeString */.SA),
  uniqueArray: () => (fast_check/* .uniqueArray */.jw),
  uuid: () => (fast_check/* .uuid */.uR),
  uuidV: () => (fast_check/* .uuidV */.UP),
  webAuthority: () => (fast_check/* .webAuthority */.mZ),
  webFragments: () => (fast_check/* .webFragments */.Ot),
  webPath: () => (fast_check/* .webPath */.Ei),
  webQueryParameters: () => (fast_check/* .webQueryParameters */.DO),
  webSegment: () => (fast_check/* .webSegment */.KV),
  webUrl: () => (fast_check/* .webUrl */.qP) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Arbitrary.js
var Arbitrary_namespaceObject = {};
__webpack_require__.r(Arbitrary_namespaceObject);
__webpack_require__.d(Arbitrary_namespaceObject, { 
  getDescription: () => (getDescription),
  make: () => (make),
  makeArrayConstraints: () => (makeArrayConstraints),
  makeBigIntConstraints: () => (makeBigIntConstraints),
  makeDateConstraints: () => (makeDateConstraints),
  makeLazy: () => (makeLazy),
  makeNumberConstraints: () => (makeNumberConstraints),
  makeStringConstraints: () => (makeStringConstraints) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cache.js
var Cache_namespaceObject = {};
__webpack_require__.r(Cache_namespaceObject);
__webpack_require__.d(Cache_namespaceObject, { 
  CacheTypeId: () => (CacheTypeId),
  ConsumerCacheTypeId: () => (ConsumerCacheTypeId),
  make: () => (Cache_make),
  makeCacheStats: () => (makeCacheStats),
  makeEntryStats: () => (makeEntryStats),
  makeWith: () => (makeWith) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ChildExecutorDecision.js
var ChildExecutorDecision_namespaceObject = {};
__webpack_require__.r(ChildExecutorDecision_namespaceObject);
__webpack_require__.d(ChildExecutorDecision_namespaceObject, { 
  ChildExecutorDecisionTypeId: () => (ChildExecutorDecisionTypeId),
  Close: () => (Close),
  Continue: () => (Continue),
  Yield: () => (Yield),
  isChildExecutorDecision: () => (isChildExecutorDecision),
  isClose: () => (isClose),
  isContinue: () => (isContinue),
  isYield: () => (isYield),
  match: () => (match) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Console.js
var Console_namespaceObject = {};
__webpack_require__.r(Console_namespaceObject);
__webpack_require__.d(Console_namespaceObject, { 
  Console: () => (Console),
  TypeId: () => (TypeId),
  assert: () => (assert),
  clear: () => (clear),
  consoleWith: () => (consoleWith),
  count: () => (Console_count),
  countReset: () => (countReset),
  debug: () => (debug),
  dir: () => (dir),
  dirxml: () => (dirxml),
  error: () => (Console_error),
  group: () => (group),
  info: () => (info),
  log: () => (log),
  setConsole: () => (setConsole),
  table: () => (table),
  time: () => (time),
  timeLog: () => (timeLog),
  trace: () => (trace),
  warn: () => (warn),
  withConsole: () => (withConsole),
  withGroup: () => (withGroup),
  withTime: () => (withTime) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ExecutionPlan.js
var ExecutionPlan_namespaceObject = {};
__webpack_require__.r(ExecutionPlan_namespaceObject);
__webpack_require__.d(ExecutionPlan_namespaceObject, { 
  TypeId: () => (ExecutionPlan_TypeId),
  isExecutionPlan: () => (isExecutionPlan),
  make: () => (ExecutionPlan_make),
  merge: () => (merge) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberHandle.js
var FiberHandle_namespaceObject = {};
__webpack_require__.r(FiberHandle_namespaceObject);
__webpack_require__.d(FiberHandle_namespaceObject, { 
  TypeId: () => (FiberHandle_TypeId),
  awaitEmpty: () => (awaitEmpty),
  clear: () => (FiberHandle_clear),
  get: () => (FiberHandle_get),
  isFiberHandle: () => (isFiberHandle),
  join: () => (join),
  make: () => (FiberHandle_make),
  makeRuntime: () => (makeRuntime),
  makeRuntimePromise: () => (makeRuntimePromise),
  run: () => (run),
  runtime: () => (FiberHandle_runtime),
  runtimePromise: () => (runtimePromise),
  set: () => (FiberHandle_set),
  unsafeGet: () => (unsafeGet),
  unsafeSet: () => (unsafeSet) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberMap.js
var FiberMap_namespaceObject = {};
__webpack_require__.r(FiberMap_namespaceObject);
__webpack_require__.d(FiberMap_namespaceObject, { 
  TypeId: () => (FiberMap_TypeId),
  awaitEmpty: () => (FiberMap_awaitEmpty),
  clear: () => (FiberMap_clear),
  get: () => (FiberMap_get),
  has: () => (has),
  isFiberMap: () => (isFiberMap),
  join: () => (FiberMap_join),
  make: () => (FiberMap_make),
  makeRuntime: () => (FiberMap_makeRuntime),
  makeRuntimePromise: () => (FiberMap_makeRuntimePromise),
  remove: () => (remove),
  run: () => (FiberMap_run),
  runtime: () => (FiberMap_runtime),
  runtimePromise: () => (FiberMap_runtimePromise),
  set: () => (FiberMap_set),
  size: () => (FiberMap_size),
  unsafeGet: () => (FiberMap_unsafeGet),
  unsafeHas: () => (unsafeHas),
  unsafeSet: () => (FiberMap_unsafeSet) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Graph.js
var Graph_namespaceObject = {};
__webpack_require__.r(Graph_namespaceObject);
__webpack_require__.d(Graph_namespaceObject, { 
  Edge: () => (Edge),
  GraphError: () => (GraphError),
  TypeId: () => (Graph_TypeId),
  Walker: () => (Walker),
  addEdge: () => (addEdge),
  addNode: () => (addNode),
  astar: () => (astar),
  beginMutation: () => (beginMutation),
  bellmanFord: () => (bellmanFord),
  bfs: () => (bfs),
  connectedComponents: () => (connectedComponents),
  dfs: () => (dfs),
  dfsPostOrder: () => (dfsPostOrder),
  dijkstra: () => (dijkstra),
  directed: () => (directed),
  edgeCount: () => (edgeCount),
  edges: () => (Graph_edges),
  endMutation: () => (endMutation),
  entries: () => (Graph_entries),
  externals: () => (externals),
  filterEdges: () => (filterEdges),
  filterMapEdges: () => (filterMapEdges),
  filterMapNodes: () => (filterMapNodes),
  filterNodes: () => (filterNodes),
  findEdge: () => (findEdge),
  findEdges: () => (findEdges),
  findNode: () => (findNode),
  findNodes: () => (findNodes),
  floydWarshall: () => (floydWarshall),
  getEdge: () => (getEdge),
  getNode: () => (getNode),
  hasEdge: () => (hasEdge),
  hasNode: () => (hasNode),
  indices: () => (indices),
  isAcyclic: () => (isAcyclic),
  isBipartite: () => (isBipartite),
  isGraph: () => (isGraph),
  mapEdges: () => (mapEdges),
  mapNodes: () => (mapNodes),
  mutate: () => (Graph_mutate),
  neighbors: () => (Graph_neighbors),
  neighborsDirected: () => (neighborsDirected),
  nodeCount: () => (Graph_nodeCount),
  nodes: () => (Graph_nodes),
  removeEdge: () => (removeEdge),
  removeNode: () => (Graph_removeNode),
  reverse: () => (reverse),
  stronglyConnectedComponents: () => (stronglyConnectedComponents),
  toGraphViz: () => (toGraphViz),
  toMermaid: () => (toMermaid),
  topo: () => (topo),
  undirected: () => (undirected),
  updateEdge: () => (updateEdge),
  updateNode: () => (Graph_updateNode),
  values: () => (Graph_values) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/GroupBy.js
var GroupBy_namespaceObject = {};
__webpack_require__.r(GroupBy_namespaceObject);
__webpack_require__.d(GroupBy_namespaceObject, { 
  GroupByTypeId: () => (GroupByTypeId),
  evaluate: () => (GroupBy_evaluate),
  filter: () => (GroupBy_filter),
  first: () => (GroupBy_first),
  make: () => (GroupBy_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HKT.js
var HKT_namespaceObject = {};
__webpack_require__.r(HKT_namespaceObject);

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/PrimaryKey.js
var PrimaryKey_namespaceObject = {};
__webpack_require__.r(PrimaryKey_namespaceObject);
__webpack_require__.d(PrimaryKey_namespaceObject, { 
  symbol: () => (symbol),
  value: () => (PrimaryKey_value) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HashRing.js
var HashRing_namespaceObject = {};
__webpack_require__.r(HashRing_namespaceObject);
__webpack_require__.d(HashRing_namespaceObject, { 
  add: () => (add),
  addMany: () => (addMany),
  get: () => (HashRing_get),
  getShards: () => (getShards),
  has: () => (HashRing_has),
  isHashRing: () => (isHashRing),
  make: () => (HashRing_make),
  remove: () => (HashRing_remove) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/KeyedPool.js
var KeyedPool_namespaceObject = {};
__webpack_require__.r(KeyedPool_namespaceObject);
__webpack_require__.d(KeyedPool_namespaceObject, { 
  KeyedPoolTypeId: () => (KeyedPool_KeyedPoolTypeId),
  get: () => (KeyedPool_get),
  invalidate: () => (KeyedPool_invalidate),
  make: () => (KeyedPool_make),
  makeWith: () => (KeyedPool_makeWith),
  makeWithTTL: () => (KeyedPool_makeWithTTL),
  makeWithTTLBy: () => (KeyedPool_makeWithTTLBy) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RcMap.js
var RcMap_namespaceObject = {};
__webpack_require__.r(RcMap_namespaceObject);
__webpack_require__.d(RcMap_namespaceObject, { 
  TypeId: () => (RcMap_TypeId),
  get: () => (RcMap_get),
  has: () => (RcMap_has),
  invalidate: () => (RcMap_invalidate),
  keys: () => (RcMap_keys),
  make: () => (RcMap_make),
  touch: () => (RcMap_touch) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/LayerMap.js
var LayerMap_namespaceObject = {};
__webpack_require__.r(LayerMap_namespaceObject);
__webpack_require__.d(LayerMap_namespaceObject, { 
  Service: () => (Service),
  TypeId: () => (LayerMap_TypeId),
  fromRecord: () => (fromRecord),
  make: () => (LayerMap_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ManagedRuntime.js
var ManagedRuntime_namespaceObject = {};
__webpack_require__.r(ManagedRuntime_namespaceObject);
__webpack_require__.d(ManagedRuntime_namespaceObject, { 
  TypeId: () => (ManagedRuntime_TypeId),
  isManagedRuntime: () => (ManagedRuntime_isManagedRuntime),
  make: () => (ManagedRuntime_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MergeState.js
var MergeState_namespaceObject = {};
__webpack_require__.r(MergeState_namespaceObject);
__webpack_require__.d(MergeState_namespaceObject, { 
  BothRunning: () => (BothRunning),
  LeftDone: () => (LeftDone),
  MergeStateTypeId: () => (MergeStateTypeId),
  RightDone: () => (RightDone),
  isBothRunning: () => (isBothRunning),
  isLeftDone: () => (isLeftDone),
  isMergeState: () => (isMergeState),
  isRightDone: () => (isRightDone),
  match: () => (MergeState_match) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MergeStrategy.js
var MergeStrategy_namespaceObject = {};
__webpack_require__.r(MergeStrategy_namespaceObject);
__webpack_require__.d(MergeStrategy_namespaceObject, { 
  BackPressure: () => (BackPressure),
  BufferSliding: () => (BufferSliding),
  MergeStrategyTypeId: () => (MergeStrategyTypeId),
  isBackPressure: () => (isBackPressure),
  isBufferSliding: () => (isBufferSliding),
  isMergeStrategy: () => (isMergeStrategy),
  match: () => (MergeStrategy_match) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Metric.js
var Metric_namespaceObject = {};
__webpack_require__.r(Metric_namespaceObject);
__webpack_require__.d(Metric_namespaceObject, { 
  MetricTypeId: () => (MetricTypeId),
  counter: () => (Metric_counter),
  fiberActive: () => (fiberActive),
  fiberFailures: () => (fiberFailures),
  fiberLifetimes: () => (fiberLifetimes),
  fiberStarted: () => (fiberStarted),
  fiberSuccesses: () => (fiberSuccesses),
  frequency: () => (frequency),
  fromMetricKey: () => (fromMetricKey),
  gauge: () => (gauge),
  globalMetricRegistry: () => (globalMetricRegistry),
  histogram: () => (histogram),
  increment: () => (increment),
  incrementBy: () => (incrementBy),
  make: () => (Metric_make),
  map: () => (Metric_map),
  mapInput: () => (mapInput),
  mapType: () => (mapType),
  modify: () => (modify),
  set: () => (Metric_set),
  snapshot: () => (snapshot),
  succeed: () => (succeed),
  summary: () => (summary),
  summaryTimestamp: () => (summaryTimestamp),
  sync: () => (sync),
  tagged: () => (tagged),
  taggedWithLabels: () => (taggedWithLabels),
  taggedWithLabelsInput: () => (taggedWithLabelsInput),
  timer: () => (Metric_timer),
  timerWithBoundaries: () => (timerWithBoundaries),
  trackAll: () => (trackAll),
  trackDefect: () => (trackDefect),
  trackDefectWith: () => (trackDefectWith),
  trackDuration: () => (trackDuration),
  trackDurationWith: () => (trackDurationWith),
  trackError: () => (trackError),
  trackErrorWith: () => (trackErrorWith),
  trackSuccess: () => (trackSuccess),
  trackSuccessWith: () => (trackSuccessWith),
  unsafeSnapshot: () => (unsafeSnapshot),
  update: () => (update),
  value: () => (Metric_value),
  withConstantInput: () => (withConstantInput),
  withNow: () => (withNow),
  zip: () => (zip) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricBoundaries.js
var MetricBoundaries_namespaceObject = {};
__webpack_require__.r(MetricBoundaries_namespaceObject);
__webpack_require__.d(MetricBoundaries_namespaceObject, { 
  MetricBoundariesTypeId: () => (MetricBoundariesTypeId),
  exponential: () => (exponential),
  fromIterable: () => (fromIterable),
  isMetricBoundaries: () => (isMetricBoundaries),
  linear: () => (linear) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricHook.js
var MetricHook_namespaceObject = {};
__webpack_require__.r(MetricHook_namespaceObject);
__webpack_require__.d(MetricHook_namespaceObject, { 
  MetricHookTypeId: () => (MetricHookTypeId),
  counter: () => (MetricHook_counter),
  frequency: () => (MetricHook_frequency),
  gauge: () => (MetricHook_gauge),
  histogram: () => (MetricHook_histogram),
  make: () => (MetricHook_make),
  onModify: () => (onModify),
  onUpdate: () => (onUpdate),
  summary: () => (MetricHook_summary) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricKey.js
var MetricKey_namespaceObject = {};
__webpack_require__.r(MetricKey_namespaceObject);
__webpack_require__.d(MetricKey_namespaceObject, { 
  MetricKeyTypeId: () => (MetricKeyTypeId),
  counter: () => (MetricKey_counter),
  frequency: () => (MetricKey_frequency),
  gauge: () => (MetricKey_gauge),
  histogram: () => (MetricKey_histogram),
  isMetricKey: () => (isMetricKey),
  summary: () => (MetricKey_summary),
  tagged: () => (MetricKey_tagged),
  taggedWithLabels: () => (MetricKey_taggedWithLabels) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricKeyType.js
var MetricKeyType_namespaceObject = {};
__webpack_require__.r(MetricKeyType_namespaceObject);
__webpack_require__.d(MetricKeyType_namespaceObject, { 
  CounterKeyTypeTypeId: () => (CounterKeyTypeTypeId),
  FrequencyKeyTypeTypeId: () => (FrequencyKeyTypeTypeId),
  GaugeKeyTypeTypeId: () => (GaugeKeyTypeTypeId),
  HistogramKeyTypeTypeId: () => (HistogramKeyTypeTypeId),
  MetricKeyTypeTypeId: () => (MetricKeyTypeTypeId),
  SummaryKeyTypeTypeId: () => (SummaryKeyTypeTypeId),
  counter: () => (MetricKeyType_counter),
  frequency: () => (MetricKeyType_frequency),
  gauge: () => (MetricKeyType_gauge),
  histogram: () => (MetricKeyType_histogram),
  isCounterKey: () => (isCounterKey),
  isFrequencyKey: () => (isFrequencyKey),
  isGaugeKey: () => (isGaugeKey),
  isHistogramKey: () => (isHistogramKey),
  isMetricKeyType: () => (isMetricKeyType),
  isSummaryKey: () => (isSummaryKey),
  summary: () => (MetricKeyType_summary) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricLabel.js
var MetricLabel_namespaceObject = {};
__webpack_require__.r(MetricLabel_namespaceObject);
__webpack_require__.d(MetricLabel_namespaceObject, { 
  MetricLabelTypeId: () => (MetricLabelTypeId),
  isMetricLabel: () => (isMetricLabel),
  make: () => (MetricLabel_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricPair.js
var MetricPair_namespaceObject = {};
__webpack_require__.r(MetricPair_namespaceObject);
__webpack_require__.d(MetricPair_namespaceObject, { 
  MetricPairTypeId: () => (MetricPairTypeId),
  make: () => (MetricPair_make),
  unsafeMake: () => (MetricPair_unsafeMake) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricPolling.js
var MetricPolling_namespaceObject = {};
__webpack_require__.r(MetricPolling_namespaceObject);
__webpack_require__.d(MetricPolling_namespaceObject, { 
  MetricPollingTypeId: () => (MetricPolling_MetricPollingTypeId),
  collectAll: () => (MetricPolling_collectAll),
  launch: () => (MetricPolling_launch),
  make: () => (MetricPolling_make),
  poll: () => (MetricPolling_poll),
  pollAndUpdate: () => (MetricPolling_pollAndUpdate),
  retry: () => (MetricPolling_retry),
  zip: () => (MetricPolling_zip) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricRegistry.js
var MetricRegistry_namespaceObject = {};
__webpack_require__.r(MetricRegistry_namespaceObject);
__webpack_require__.d(MetricRegistry_namespaceObject, { 
  MetricRegistryTypeId: () => (MetricRegistryTypeId),
  make: () => (MetricRegistry_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricState.js
var MetricState_namespaceObject = {};
__webpack_require__.r(MetricState_namespaceObject);
__webpack_require__.d(MetricState_namespaceObject, { 
  CounterStateTypeId: () => (CounterStateTypeId),
  FrequencyStateTypeId: () => (FrequencyStateTypeId),
  GaugeStateTypeId: () => (GaugeStateTypeId),
  HistogramStateTypeId: () => (HistogramStateTypeId),
  MetricStateTypeId: () => (MetricStateTypeId),
  SummaryStateTypeId: () => (SummaryStateTypeId),
  counter: () => (MetricState_counter),
  frequency: () => (MetricState_frequency),
  gauge: () => (MetricState_gauge),
  histogram: () => (MetricState_histogram),
  isCounterState: () => (isCounterState),
  isFrequencyState: () => (isFrequencyState),
  isGaugeState: () => (isGaugeState),
  isHistogramState: () => (isHistogramState),
  isMetricState: () => (isMetricState),
  isSummaryState: () => (isSummaryState),
  summary: () => (MetricState_summary) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ModuleVersion.js
var ModuleVersion_namespaceObject = {};
__webpack_require__.r(ModuleVersion_namespaceObject);
__webpack_require__.d(ModuleVersion_namespaceObject, { 
  getCurrentVersion: () => (getCurrentVersion),
  setCurrentVersion: () => (setCurrentVersion) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableHashSet.js
var MutableHashSet_namespaceObject = {};
__webpack_require__.r(MutableHashSet_namespaceObject);
__webpack_require__.d(MutableHashSet_namespaceObject, { 
  add: () => (MutableHashSet_add),
  clear: () => (MutableHashSet_clear),
  empty: () => (empty),
  fromIterable: () => (MutableHashSet_fromIterable),
  has: () => (MutableHashSet_has),
  make: () => (MutableHashSet_make),
  remove: () => (MutableHashSet_remove),
  size: () => (MutableHashSet_size) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/NonEmptyIterable.js
var NonEmptyIterable_namespaceObject = {};
__webpack_require__.r(NonEmptyIterable_namespaceObject);
__webpack_require__.d(NonEmptyIterable_namespaceObject, { 
  unprepend: () => (unprepend) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Ordering.js
var Ordering_namespaceObject = {};
__webpack_require__.r(Ordering_namespaceObject);
__webpack_require__.d(Ordering_namespaceObject, { 
  combine: () => (Ordering_combine),
  combineAll: () => (combineAll),
  combineMany: () => (combineMany),
  match: () => (Ordering_match),
  reverse: () => (Ordering_reverse) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/PartitionedSemaphore.js
var PartitionedSemaphore_namespaceObject = {};
__webpack_require__.r(PartitionedSemaphore_namespaceObject);
__webpack_require__.d(PartitionedSemaphore_namespaceObject, { 
  TypeId: () => (PartitionedSemaphore_TypeId),
  make: () => (PartitionedSemaphore_make),
  makeUnsafe: () => (makeUnsafe) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Pretty.js
var Pretty_namespaceObject = {};
__webpack_require__.r(Pretty_namespaceObject);
__webpack_require__.d(Pretty_namespaceObject, { 
  make: () => (Pretty_make),
  match: () => (Pretty_match) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RateLimiter.js
var RateLimiter_namespaceObject = {};
__webpack_require__.r(RateLimiter_namespaceObject);
__webpack_require__.d(RateLimiter_namespaceObject, { 
  make: () => (RateLimiter_make),
  withCost: () => (RateLimiter_withCost) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Reloadable.js
var Reloadable_namespaceObject = {};
__webpack_require__.r(Reloadable_namespaceObject);
__webpack_require__.d(Reloadable_namespaceObject, { 
  ReloadableTypeId: () => (Reloadable_ReloadableTypeId),
  auto: () => (Reloadable_auto),
  autoFromConfig: () => (Reloadable_autoFromConfig),
  get: () => (Reloadable_get),
  manual: () => (Reloadable_manual),
  reload: () => (Reloadable_reload),
  reloadFork: () => (Reloadable_reloadFork),
  tag: () => (Reloadable_tag) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RequestBlock.js
var RequestBlock_namespaceObject = {};
__webpack_require__.r(RequestBlock_namespaceObject);
__webpack_require__.d(RequestBlock_namespaceObject, { 
  empty: () => (RequestBlock_empty),
  mapRequestResolvers: () => (mapRequestResolvers),
  parallel: () => (parallel),
  reduce: () => (reduce),
  sequential: () => (sequential),
  single: () => (single) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Resource.js
var Resource_namespaceObject = {};
__webpack_require__.r(Resource_namespaceObject);
__webpack_require__.d(Resource_namespaceObject, { 
  ResourceTypeId: () => (Resource_ResourceTypeId),
  auto: () => (Resource_auto),
  get: () => (Resource_get),
  manual: () => (Resource_manual),
  refresh: () => (Resource_refresh) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RuntimeFlags.js
var RuntimeFlags_namespaceObject = {};
__webpack_require__.r(RuntimeFlags_namespaceObject);
__webpack_require__.d(RuntimeFlags_namespaceObject, { 
  CooperativeYielding: () => (CooperativeYielding),
  Interruption: () => (Interruption),
  None: () => (None),
  OpSupervision: () => (OpSupervision),
  RuntimeMetrics: () => (RuntimeMetrics),
  WindDown: () => (WindDown),
  cooperativeYielding: () => (cooperativeYielding),
  diff: () => (diff),
  differ: () => (differ),
  disable: () => (disable),
  disableAll: () => (disableAll),
  disableCooperativeYielding: () => (disableCooperativeYielding),
  disableInterruption: () => (disableInterruption),
  disableOpSupervision: () => (disableOpSupervision),
  disableRuntimeMetrics: () => (disableRuntimeMetrics),
  disableWindDown: () => (disableWindDown),
  enable: () => (enable),
  enableAll: () => (enableAll),
  enableCooperativeYielding: () => (enableCooperativeYielding),
  enableInterruption: () => (enableInterruption),
  enableOpSupervision: () => (enableOpSupervision),
  enableRuntimeMetrics: () => (enableRuntimeMetrics),
  enableWindDown: () => (enableWindDown),
  interruptible: () => (interruptible),
  interruption: () => (interruption),
  isDisabled: () => (isDisabled),
  isEnabled: () => (isEnabled),
  make: () => (RuntimeFlags_make),
  none: () => (none),
  opSupervision: () => (opSupervision),
  patch: () => (RuntimeFlags_patch),
  render: () => (render),
  runtimeMetrics: () => (runtimeMetrics),
  toSet: () => (toSet),
  windDown: () => (windDown) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/STM.js
var STM_namespaceObject = {};
__webpack_require__.r(STM_namespaceObject);
__webpack_require__.d(STM_namespaceObject, { 
  Do: () => (Do),
  STMTypeId: () => (STMTypeId),
  acquireUseRelease: () => (acquireUseRelease),
  all: () => (STM_all),
  as: () => (STM_as),
  asSome: () => (asSome),
  asSomeError: () => (asSomeError),
  asVoid: () => (asVoid),
  attempt: () => (attempt),
  bind: () => (bind),
  bindTo: () => (bindTo),
  catchAll: () => (catchAll),
  catchSome: () => (catchSome),
  catchTag: () => (catchTag),
  catchTags: () => (catchTags),
  check: () => (check),
  collect: () => (collect),
  collectSTM: () => (collectSTM),
  commit: () => (commit),
  commitEither: () => (commitEither),
  cond: () => (cond),
  context: () => (STM_context),
  contextWith: () => (contextWith),
  contextWithSTM: () => (contextWithSTM),
  die: () => (die),
  dieMessage: () => (dieMessage),
  dieSync: () => (dieSync),
  either: () => (STM_either),
  ensuring: () => (ensuring),
  eventually: () => (eventually),
  every: () => (every),
  exists: () => (exists),
  fail: () => (fail),
  failSync: () => (failSync),
  fiberId: () => (STM_fiberId),
  filter: () => (STM_filter),
  filterNot: () => (filterNot),
  filterOrDie: () => (filterOrDie),
  filterOrDieMessage: () => (filterOrDieMessage),
  filterOrElse: () => (filterOrElse),
  filterOrFail: () => (filterOrFail),
  firstSuccessOf: () => (firstSuccessOf),
  flatMap: () => (flatMap),
  flatten: () => (flatten),
  flip: () => (flip),
  flipWith: () => (flipWith),
  forEach: () => (forEach),
  fromEither: () => (fromEither),
  fromOption: () => (fromOption),
  gen: () => (gen),
  head: () => (STM_head),
  "if": () => (if_),
  ignore: () => (ignore),
  interrupt: () => (interrupt),
  interruptAs: () => (interruptAs),
  isFailure: () => (isFailure),
  isSTM: () => (isSTM),
  isSuccess: () => (isSuccess),
  iterate: () => (iterate),
  "let": () => (let_),
  loop: () => (STM_loop),
  map: () => (STM_map),
  mapAttempt: () => (mapAttempt),
  mapBoth: () => (mapBoth),
  mapError: () => (mapError),
  mapInputContext: () => (mapInputContext),
  match: () => (STM_match),
  matchSTM: () => (matchSTM),
  merge: () => (STM_merge),
  mergeAll: () => (mergeAll),
  negate: () => (negate),
  none: () => (STM_none),
  option: () => (STM_option),
  orDie: () => (orDie),
  orDieWith: () => (orDieWith),
  orElse: () => (orElse),
  orElseEither: () => (orElseEither),
  orElseFail: () => (orElseFail),
  orElseOptional: () => (orElseOptional),
  orElseSucceed: () => (orElseSucceed),
  orTry: () => (orTry),
  partition: () => (partition),
  provideContext: () => (provideContext),
  provideService: () => (provideService),
  provideServiceSTM: () => (provideServiceSTM),
  provideSomeContext: () => (provideSomeContext),
  reduce: () => (STM_reduce),
  reduceAll: () => (reduceAll),
  reduceRight: () => (reduceRight),
  refineOrDie: () => (refineOrDie),
  refineOrDieWith: () => (refineOrDieWith),
  reject: () => (STM_reject),
  rejectSTM: () => (rejectSTM),
  repeatUntil: () => (repeatUntil),
  repeatWhile: () => (repeatWhile),
  replicate: () => (replicate),
  replicateSTM: () => (replicateSTM),
  replicateSTMDiscard: () => (replicateSTMDiscard),
  retry: () => (STM_retry),
  retryUntil: () => (retryUntil),
  retryWhile: () => (retryWhile),
  some: () => (some),
  succeed: () => (STM_succeed),
  succeedNone: () => (succeedNone),
  succeedSome: () => (succeedSome),
  summarized: () => (summarized),
  suspend: () => (suspend),
  sync: () => (STM_sync),
  tap: () => (tap),
  tapBoth: () => (tapBoth),
  tapError: () => (tapError),
  "try": () => (try_),
  unless: () => (unless),
  unlessSTM: () => (unlessSTM),
  unsome: () => (unsome),
  validateAll: () => (validateAll),
  validateFirst: () => (validateFirst),
  "void": () => (void_),
  when: () => (when),
  whenSTM: () => (whenSTM),
  zip: () => (STM_zip),
  zipLeft: () => (zipLeft),
  zipRight: () => (zipRight),
  zipWith: () => (zipWith) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScopedCache.js
var ScopedCache_namespaceObject = {};
__webpack_require__.r(ScopedCache_namespaceObject);
__webpack_require__.d(ScopedCache_namespaceObject, { 
  ScopedCacheTypeId: () => (ScopedCache_ScopedCacheTypeId),
  make: () => (ScopedCache_make),
  makeWith: () => (ScopedCache_makeWith) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScopedRef.js
var ScopedRef_namespaceObject = {};
__webpack_require__.r(ScopedRef_namespaceObject);
__webpack_require__.d(ScopedRef_namespaceObject, { 
  ScopedRefTypeId: () => (ScopedRef_ScopedRefTypeId),
  fromAcquire: () => (ScopedRef_fromAcquire),
  get: () => (ScopedRef_get),
  make: () => (ScopedRef_make),
  set: () => (ScopedRef_set) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Secret.js
var Secret_namespaceObject = {};
__webpack_require__.r(Secret_namespaceObject);
__webpack_require__.d(Secret_namespaceObject, { 
  SecretTypeId: () => (SecretTypeId),
  fromIterable: () => (Secret_fromIterable),
  fromString: () => (fromString),
  isSecret: () => (isSecret),
  make: () => (Secret_make),
  unsafeWipe: () => (unsafeWipe),
  value: () => (Secret_value) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SingleProducerAsyncInput.js
var SingleProducerAsyncInput_namespaceObject = {};
__webpack_require__.r(SingleProducerAsyncInput_namespaceObject);
__webpack_require__.d(SingleProducerAsyncInput_namespaceObject, { 
  make: () => (SingleProducerAsyncInput_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SortedMap.js
var SortedMap_namespaceObject = {};
__webpack_require__.r(SortedMap_namespaceObject);
__webpack_require__.d(SortedMap_namespaceObject, { 
  empty: () => (SortedMap_empty),
  entries: () => (SortedMap_entries),
  fromIterable: () => (SortedMap_fromIterable),
  get: () => (SortedMap_get),
  getOrder: () => (getOrder),
  has: () => (SortedMap_has),
  headOption: () => (headOption),
  isEmpty: () => (isEmpty),
  isNonEmpty: () => (isNonEmpty),
  isSortedMap: () => (isSortedMap),
  keys: () => (SortedMap_keys),
  lastOption: () => (lastOption),
  make: () => (SortedMap_make),
  map: () => (SortedMap_map),
  partition: () => (SortedMap_partition),
  reduce: () => (SortedMap_reduce),
  remove: () => (SortedMap_remove),
  set: () => (SortedMap_set),
  size: () => (SortedMap_size),
  values: () => (SortedMap_values) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/StreamEmit.js
var StreamEmit_namespaceObject = {};
__webpack_require__.r(StreamEmit_namespaceObject);

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Streamable.js
var Streamable_namespaceObject = {};
__webpack_require__.r(Streamable_namespaceObject);
__webpack_require__.d(Streamable_namespaceObject, { 
  Class: () => (Class) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Subscribable.js
var Subscribable_namespaceObject = {};
__webpack_require__.r(Subscribable_namespaceObject);
__webpack_require__.d(Subscribable_namespaceObject, { 
  TypeId: () => (Subscribable_TypeId),
  isSubscribable: () => (isSubscribable),
  make: () => (Subscribable_make),
  map: () => (Subscribable_map),
  mapEffect: () => (mapEffect),
  unwrap: () => (unwrap) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SynchronizedRef.js
var SynchronizedRef_namespaceObject = {};
__webpack_require__.r(SynchronizedRef_namespaceObject);
__webpack_require__.d(SynchronizedRef_namespaceObject, { 
  SynchronizedRefTypeId: () => (SynchronizedRefTypeId),
  get: () => (SynchronizedRef_get),
  getAndSet: () => (getAndSet),
  getAndUpdate: () => (getAndUpdate),
  getAndUpdateEffect: () => (getAndUpdateEffect),
  getAndUpdateSome: () => (getAndUpdateSome),
  getAndUpdateSomeEffect: () => (getAndUpdateSomeEffect),
  make: () => (SynchronizedRef_make),
  modify: () => (SynchronizedRef_modify),
  modifyEffect: () => (modifyEffect),
  modifySome: () => (modifySome),
  modifySomeEffect: () => (modifySomeEffect),
  set: () => (SynchronizedRef_set),
  setAndGet: () => (setAndGet),
  unsafeMake: () => (SynchronizedRef_unsafeMake),
  update: () => (SynchronizedRef_update),
  updateAndGet: () => (updateAndGet),
  updateAndGetEffect: () => (updateAndGetEffect),
  updateEffect: () => (updateEffect),
  updateSome: () => (updateSome),
  updateSomeAndGet: () => (updateSomeAndGet),
  updateSomeAndGetEffect: () => (updateSomeAndGetEffect),
  updateSomeEffect: () => (updateSomeEffect) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SubscriptionRef.js
var SubscriptionRef_namespaceObject = {};
__webpack_require__.r(SubscriptionRef_namespaceObject);
__webpack_require__.d(SubscriptionRef_namespaceObject, { 
  SubscriptionRefTypeId: () => (SubscriptionRef_SubscriptionRefTypeId),
  get: () => (SubscriptionRef_get),
  getAndSet: () => (SubscriptionRef_getAndSet),
  getAndUpdate: () => (SubscriptionRef_getAndUpdate),
  getAndUpdateEffect: () => (SubscriptionRef_getAndUpdateEffect),
  getAndUpdateSome: () => (SubscriptionRef_getAndUpdateSome),
  getAndUpdateSomeEffect: () => (SubscriptionRef_getAndUpdateSomeEffect),
  make: () => (SubscriptionRef_make),
  modify: () => (SubscriptionRef_modify),
  modifyEffect: () => (SubscriptionRef_modifyEffect),
  modifySome: () => (SubscriptionRef_modifySome),
  modifySomeEffect: () => (SubscriptionRef_modifySomeEffect),
  set: () => (SubscriptionRef_set),
  setAndGet: () => (SubscriptionRef_setAndGet),
  update: () => (SubscriptionRef_update),
  updateAndGet: () => (SubscriptionRef_updateAndGet),
  updateAndGetEffect: () => (SubscriptionRef_updateAndGetEffect),
  updateEffect: () => (SubscriptionRef_updateEffect),
  updateSome: () => (SubscriptionRef_updateSome),
  updateSomeAndGet: () => (SubscriptionRef_updateSomeAndGet),
  updateSomeAndGetEffect: () => (SubscriptionRef_updateSomeAndGetEffect),
  updateSomeEffect: () => (SubscriptionRef_updateSomeEffect) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Supervisor.js
var Supervisor_namespaceObject = {};
__webpack_require__.r(Supervisor_namespaceObject);
__webpack_require__.d(Supervisor_namespaceObject, { 
  AbstractSupervisor: () => (AbstractSupervisor),
  SupervisorTypeId: () => (SupervisorTypeId),
  addSupervisor: () => (addSupervisor),
  fibersIn: () => (fibersIn),
  fromEffect: () => (fromEffect),
  none: () => (Supervisor_none),
  track: () => (track),
  unsafeTrack: () => (unsafeTrack) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Symbol.js
var Symbol_namespaceObject = {};
__webpack_require__.r(Symbol_namespaceObject);
__webpack_require__.d(Symbol_namespaceObject, { 
  Equivalence: () => (Symbol_Equivalence),
  isSymbol: () => (isSymbol) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TArray.js
var TArray_namespaceObject = {};
__webpack_require__.r(TArray_namespaceObject);
__webpack_require__.d(TArray_namespaceObject, { 
  TArrayTypeId: () => (TArray_TArrayTypeId),
  collectFirst: () => (TArray_collectFirst),
  collectFirstSTM: () => (TArray_collectFirstSTM),
  contains: () => (TArray_contains),
  count: () => (TArray_count),
  countSTM: () => (TArray_countSTM),
  empty: () => (TArray_empty),
  every: () => (TArray_every),
  everySTM: () => (TArray_everySTM),
  findFirst: () => (TArray_findFirst),
  findFirstIndex: () => (TArray_findFirstIndex),
  findFirstIndexFrom: () => (TArray_findFirstIndexFrom),
  findFirstIndexWhere: () => (TArray_findFirstIndexWhere),
  findFirstIndexWhereFrom: () => (TArray_findFirstIndexWhereFrom),
  findFirstIndexWhereFromSTM: () => (TArray_findFirstIndexWhereFromSTM),
  findFirstIndexWhereSTM: () => (TArray_findFirstIndexWhereSTM),
  findFirstSTM: () => (TArray_findFirstSTM),
  findLast: () => (TArray_findLast),
  findLastIndex: () => (TArray_findLastIndex),
  findLastIndexFrom: () => (TArray_findLastIndexFrom),
  findLastSTM: () => (TArray_findLastSTM),
  forEach: () => (TArray_forEach),
  fromIterable: () => (TArray_fromIterable),
  get: () => (TArray_get),
  headOption: () => (TArray_headOption),
  lastOption: () => (TArray_lastOption),
  make: () => (TArray_make),
  maxOption: () => (TArray_maxOption),
  minOption: () => (TArray_minOption),
  reduce: () => (TArray_reduce),
  reduceOption: () => (TArray_reduceOption),
  reduceOptionSTM: () => (TArray_reduceOptionSTM),
  reduceSTM: () => (TArray_reduceSTM),
  size: () => (TArray_size),
  some: () => (TArray_some),
  someSTM: () => (TArray_someSTM),
  toArray: () => (TArray_toArray),
  transform: () => (TArray_transform),
  transformSTM: () => (TArray_transformSTM),
  update: () => (TArray_update),
  updateSTM: () => (TArray_updateSTM) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TDeferred.js
var TDeferred_namespaceObject = {};
__webpack_require__.r(TDeferred_namespaceObject);
__webpack_require__.d(TDeferred_namespaceObject, { 
  TDeferredTypeId: () => (TDeferred_TDeferredTypeId),
  "await": () => (TDeferred_await),
  done: () => (TDeferred_done),
  fail: () => (TDeferred_fail),
  make: () => (TDeferred_make),
  poll: () => (TDeferred_poll),
  succeed: () => (TDeferred_succeed) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TMap.js
var TMap_namespaceObject = {};
__webpack_require__.r(TMap_namespaceObject);
__webpack_require__.d(TMap_namespaceObject, { 
  TMapTypeId: () => (TMap_TMapTypeId),
  empty: () => (TMap_empty),
  find: () => (TMap_find),
  findAll: () => (TMap_findAll),
  findAllSTM: () => (TMap_findAllSTM),
  findSTM: () => (TMap_findSTM),
  forEach: () => (TMap_forEach),
  fromIterable: () => (TMap_fromIterable),
  get: () => (TMap_get),
  getOrElse: () => (TMap_getOrElse),
  has: () => (TMap_has),
  isEmpty: () => (TMap_isEmpty),
  keys: () => (TMap_keys),
  make: () => (TMap_make),
  merge: () => (TMap_merge),
  reduce: () => (TMap_reduce),
  reduceSTM: () => (TMap_reduceSTM),
  remove: () => (TMap_remove),
  removeAll: () => (TMap_removeAll),
  removeIf: () => (TMap_removeIf),
  retainIf: () => (TMap_retainIf),
  set: () => (TMap_set),
  setIfAbsent: () => (TMap_setIfAbsent),
  size: () => (TMap_size),
  takeFirst: () => (TMap_takeFirst),
  takeFirstSTM: () => (TMap_takeFirstSTM),
  takeSome: () => (TMap_takeSome),
  takeSomeSTM: () => (TMap_takeSomeSTM),
  toArray: () => (TMap_toArray),
  toChunk: () => (TMap_toChunk),
  toHashMap: () => (TMap_toHashMap),
  toMap: () => (TMap_toMap),
  transform: () => (TMap_transform),
  transformSTM: () => (TMap_transformSTM),
  transformValues: () => (TMap_transformValues),
  transformValuesSTM: () => (TMap_transformValuesSTM),
  updateWith: () => (TMap_updateWith),
  values: () => (TMap_values) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TPriorityQueue.js
var TPriorityQueue_namespaceObject = {};
__webpack_require__.r(TPriorityQueue_namespaceObject);
__webpack_require__.d(TPriorityQueue_namespaceObject, { 
  TPriorityQueueTypeId: () => (TPriorityQueue_TPriorityQueueTypeId),
  empty: () => (TPriorityQueue_empty),
  fromIterable: () => (TPriorityQueue_fromIterable),
  isEmpty: () => (TPriorityQueue_isEmpty),
  isNonEmpty: () => (TPriorityQueue_isNonEmpty),
  make: () => (TPriorityQueue_make),
  offer: () => (TPriorityQueue_offer),
  offerAll: () => (TPriorityQueue_offerAll),
  peek: () => (TPriorityQueue_peek),
  peekOption: () => (TPriorityQueue_peekOption),
  removeIf: () => (TPriorityQueue_removeIf),
  retainIf: () => (TPriorityQueue_retainIf),
  size: () => (TPriorityQueue_size),
  take: () => (TPriorityQueue_take),
  takeAll: () => (TPriorityQueue_takeAll),
  takeOption: () => (TPriorityQueue_takeOption),
  takeUpTo: () => (TPriorityQueue_takeUpTo),
  toArray: () => (TPriorityQueue_toArray),
  toChunk: () => (TPriorityQueue_toChunk) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TRandom.js
var TRandom_namespaceObject = {};
__webpack_require__.r(TRandom_namespaceObject);
__webpack_require__.d(TRandom_namespaceObject, { 
  TRandomTypeId: () => (TRandom_TRandomTypeId),
  Tag: () => (TRandom_Tag),
  live: () => (TRandom_live),
  next: () => (TRandom_next),
  nextBoolean: () => (TRandom_nextBoolean),
  nextInt: () => (TRandom_nextInt),
  nextIntBetween: () => (TRandom_nextIntBetween),
  nextRange: () => (TRandom_nextRange),
  shuffle: () => (TRandom_shuffle) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TReentrantLock.js
var TReentrantLock_namespaceObject = {};
__webpack_require__.r(TReentrantLock_namespaceObject);
__webpack_require__.d(TReentrantLock_namespaceObject, { 
  TReentrantLockTypeId: () => (TReentrantLock_TReentrantLockTypeId),
  acquireRead: () => (TReentrantLock_acquireRead),
  acquireWrite: () => (TReentrantLock_acquireWrite),
  fiberReadLocks: () => (TReentrantLock_fiberReadLocks),
  fiberWriteLocks: () => (TReentrantLock_fiberWriteLocks),
  lock: () => (TReentrantLock_lock),
  locked: () => (TReentrantLock_locked),
  make: () => (TReentrantLock_make),
  readLock: () => (TReentrantLock_readLock),
  readLocked: () => (TReentrantLock_readLocked),
  readLocks: () => (TReentrantLock_readLocks),
  releaseRead: () => (TReentrantLock_releaseRead),
  releaseWrite: () => (TReentrantLock_releaseWrite),
  withLock: () => (TReentrantLock_withLock),
  withReadLock: () => (TReentrantLock_withReadLock),
  withWriteLock: () => (TReentrantLock_withWriteLock),
  writeLock: () => (TReentrantLock_writeLock),
  writeLocked: () => (TReentrantLock_writeLocked),
  writeLocks: () => (TReentrantLock_writeLocks) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TRef.js
var TRef_namespaceObject = {};
__webpack_require__.r(TRef_namespaceObject);
__webpack_require__.d(TRef_namespaceObject, { 
  TRefTypeId: () => (TRefTypeId),
  get: () => (TRef_get),
  getAndSet: () => (TRef_getAndSet),
  getAndUpdate: () => (TRef_getAndUpdate),
  getAndUpdateSome: () => (TRef_getAndUpdateSome),
  make: () => (TRef_make),
  modify: () => (TRef_modify),
  modifySome: () => (TRef_modifySome),
  set: () => (TRef_set),
  setAndGet: () => (TRef_setAndGet),
  update: () => (TRef_update),
  updateAndGet: () => (TRef_updateAndGet),
  updateSome: () => (TRef_updateSome),
  updateSomeAndGet: () => (TRef_updateSomeAndGet) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSemaphore.js
var TSemaphore_namespaceObject = {};
__webpack_require__.r(TSemaphore_namespaceObject);
__webpack_require__.d(TSemaphore_namespaceObject, { 
  TSemaphoreTypeId: () => (TSemaphore_TSemaphoreTypeId),
  acquire: () => (TSemaphore_acquire),
  acquireN: () => (TSemaphore_acquireN),
  available: () => (TSemaphore_available),
  make: () => (TSemaphore_make),
  release: () => (TSemaphore_release),
  releaseN: () => (TSemaphore_releaseN),
  unsafeMake: () => (TSemaphore_unsafeMake),
  withPermit: () => (TSemaphore_withPermit),
  withPermitScoped: () => (TSemaphore_withPermitScoped),
  withPermits: () => (TSemaphore_withPermits),
  withPermitsScoped: () => (TSemaphore_withPermitsScoped) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSet.js
var TSet_namespaceObject = {};
__webpack_require__.r(TSet_namespaceObject);
__webpack_require__.d(TSet_namespaceObject, { 
  TSetTypeId: () => (TSet_TSetTypeId),
  add: () => (TSet_add),
  difference: () => (TSet_difference),
  empty: () => (TSet_empty),
  forEach: () => (TSet_forEach),
  fromIterable: () => (TSet_fromIterable),
  has: () => (TSet_has),
  intersection: () => (TSet_intersection),
  isEmpty: () => (TSet_isEmpty),
  make: () => (TSet_make),
  reduce: () => (TSet_reduce),
  reduceSTM: () => (TSet_reduceSTM),
  remove: () => (TSet_remove),
  removeAll: () => (TSet_removeAll),
  removeIf: () => (TSet_removeIf),
  retainIf: () => (TSet_retainIf),
  size: () => (TSet_size),
  takeFirst: () => (TSet_takeFirst),
  takeFirstSTM: () => (TSet_takeFirstSTM),
  takeSome: () => (TSet_takeSome),
  takeSomeSTM: () => (TSet_takeSomeSTM),
  toArray: () => (TSet_toArray),
  toChunk: () => (TSet_toChunk),
  toHashSet: () => (TSet_toHashSet),
  toReadonlySet: () => (TSet_toReadonlySet),
  transform: () => (TSet_transform),
  transformSTM: () => (TSet_transformSTM),
  union: () => (TSet_union) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSubscriptionRef.js
var TSubscriptionRef_namespaceObject = {};
__webpack_require__.r(TSubscriptionRef_namespaceObject);
__webpack_require__.d(TSubscriptionRef_namespaceObject, { 
  TSubscriptionRefTypeId: () => (TSubscriptionRef_TSubscriptionRefTypeId),
  changes: () => (changes),
  changesScoped: () => (TSubscriptionRef_changesScoped),
  changesStream: () => (TSubscriptionRef_changesStream),
  get: () => (TSubscriptionRef_get),
  getAndSet: () => (TSubscriptionRef_getAndSet),
  getAndUpdate: () => (TSubscriptionRef_getAndUpdate),
  getAndUpdateSome: () => (TSubscriptionRef_getAndUpdateSome),
  make: () => (TSubscriptionRef_make),
  modify: () => (TSubscriptionRef_modify),
  modifySome: () => (TSubscriptionRef_modifySome),
  set: () => (TSubscriptionRef_set),
  setAndGet: () => (TSubscriptionRef_setAndGet),
  update: () => (TSubscriptionRef_update),
  updateAndGet: () => (TSubscriptionRef_updateAndGet),
  updateSome: () => (TSubscriptionRef_updateSome),
  updateSomeAndGet: () => (TSubscriptionRef_updateSomeAndGet) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Take.js
var Take_namespaceObject = {};
__webpack_require__.r(Take_namespaceObject);
__webpack_require__.d(Take_namespaceObject, { 
  TakeTypeId: () => (TakeTypeId),
  chunk: () => (Take_chunk),
  die: () => (Take_die),
  dieMessage: () => (Take_dieMessage),
  done: () => (Take_done),
  end: () => (Take_end),
  fail: () => (Take_fail),
  failCause: () => (failCause),
  fromEffect: () => (Take_fromEffect),
  fromExit: () => (fromExit),
  fromPull: () => (fromPull),
  isDone: () => (isDone),
  isFailure: () => (Take_isFailure),
  isSuccess: () => (Take_isSuccess),
  make: () => (Take_make),
  map: () => (Take_map),
  match: () => (Take_match),
  matchEffect: () => (matchEffect),
  of: () => (of),
  tap: () => (Take_tap) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotation.js
var TestAnnotation_namespaceObject = {};
__webpack_require__.r(TestAnnotation_namespaceObject);
__webpack_require__.d(TestAnnotation_namespaceObject, { 
  TestAnnotationTypeId: () => (TestAnnotationTypeId),
  compose: () => (compose),
  fibers: () => (TestAnnotation_fibers),
  ignored: () => (ignored),
  isTestAnnotation: () => (isTestAnnotation),
  make: () => (TestAnnotation_make),
  repeated: () => (repeated),
  retried: () => (retried),
  tagged: () => (TestAnnotation_tagged) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotationMap.js
var TestAnnotationMap_namespaceObject = {};
__webpack_require__.r(TestAnnotationMap_namespaceObject);
__webpack_require__.d(TestAnnotationMap_namespaceObject, { 
  TestAnnotationMapTypeId: () => (TestAnnotationMapTypeId),
  annotate: () => (annotate),
  combine: () => (TestAnnotationMap_combine),
  empty: () => (TestAnnotationMap_empty),
  get: () => (TestAnnotationMap_get),
  isTestAnnotationMap: () => (isTestAnnotationMap),
  make: () => (TestAnnotationMap_make),
  overwrite: () => (overwrite),
  update: () => (TestAnnotationMap_update) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotations.js
var TestAnnotations_namespaceObject = {};
__webpack_require__.r(TestAnnotations_namespaceObject);
__webpack_require__.d(TestAnnotations_namespaceObject, { 
  TestAnnotations: () => (TestAnnotations),
  TestAnnotationsTypeId: () => (TestAnnotationsTypeId),
  isTestAnnotations: () => (isTestAnnotations),
  make: () => (TestAnnotations_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestLive.js
var TestLive_namespaceObject = {};
__webpack_require__.r(TestLive_namespaceObject);
__webpack_require__.d(TestLive_namespaceObject, { 
  TestLive: () => (TestLive),
  TestLiveTypeId: () => (TestLiveTypeId),
  make: () => (TestLive_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestClock.js
var TestClock_namespaceObject = {};
__webpack_require__.r(TestClock_namespaceObject);
__webpack_require__.d(TestClock_namespaceObject, { 
  TestClock: () => (TestClock),
  TestClockImpl: () => (TestClockImpl),
  adjust: () => (adjust),
  adjustWith: () => (adjustWith),
  currentTimeMillis: () => (currentTimeMillis),
  defaultTestClock: () => (defaultTestClock),
  live: () => (TestClock_live),
  makeData: () => (makeData),
  save: () => (save),
  setTime: () => (setTime),
  sleep: () => (sleep),
  sleeps: () => (TestClock_sleeps),
  testClock: () => (TestClock_testClock),
  testClockWith: () => (testClockWith) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestConfig.js
var TestConfig_namespaceObject = {};
__webpack_require__.r(TestConfig_namespaceObject);
__webpack_require__.d(TestConfig_namespaceObject, { 
  TestConfig: () => (TestConfig),
  make: () => (TestConfig_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestSized.js
var TestSized_namespaceObject = {};
__webpack_require__.r(TestSized_namespaceObject);
__webpack_require__.d(TestSized_namespaceObject, { 
  TestSized: () => (TestSized),
  TestSizedTypeId: () => (TestSizedTypeId),
  fromFiberRef: () => (fromFiberRef),
  make: () => (TestSized_make) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestServices.js
var TestServices_namespaceObject = {};
__webpack_require__.r(TestServices_namespaceObject);
__webpack_require__.d(TestServices_namespaceObject, { 
  annotate: () => (TestServices_annotate),
  annotations: () => (TestServices_annotations),
  annotationsLayer: () => (annotationsLayer),
  annotationsWith: () => (annotationsWith),
  currentServices: () => (currentServices),
  get: () => (TestServices_get),
  live: () => (TestServices_live),
  liveLayer: () => (liveLayer),
  liveServices: () => (liveServices),
  liveWith: () => (liveWith),
  provideLive: () => (provideLive),
  provideWithLive: () => (provideWithLive),
  repeats: () => (repeats),
  retries: () => (retries),
  samples: () => (samples),
  shrinks: () => (shrinks),
  size: () => (TestServices_size),
  sized: () => (TestServices_sized),
  sizedLayer: () => (sizedLayer),
  sizedWith: () => (sizedWith),
  supervisedFibers: () => (supervisedFibers),
  testConfig: () => (TestServices_testConfig),
  testConfigLayer: () => (testConfigLayer),
  testConfigWith: () => (testConfigWith),
  withAnnotations: () => (withAnnotations),
  withAnnotationsScoped: () => (withAnnotationsScoped),
  withLive: () => (withLive),
  withLiveScoped: () => (withLiveScoped),
  withSize: () => (withSize),
  withSized: () => (withSized),
  withSizedScoped: () => (withSizedScoped),
  withTestConfig: () => (withTestConfig),
  withTestConfigScoped: () => (withTestConfigScoped) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestContext.js
var TestContext_namespaceObject = {};
__webpack_require__.r(TestContext_namespaceObject);
__webpack_require__.d(TestContext_namespaceObject, { 
  LiveContext: () => (LiveContext),
  TestContext: () => (TestContext),
  live: () => (TestContext_live) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Trie.js
var Trie_namespaceObject = {};
__webpack_require__.r(Trie_namespaceObject);
__webpack_require__.d(Trie_namespaceObject, { 
  compact: () => (Trie_compact),
  empty: () => (Trie_empty),
  entries: () => (Trie_entries),
  entriesWithPrefix: () => (Trie_entriesWithPrefix),
  filter: () => (Trie_filter),
  filterMap: () => (Trie_filterMap),
  forEach: () => (Trie_forEach),
  fromIterable: () => (Trie_fromIterable),
  get: () => (Trie_get),
  has: () => (Trie_has),
  insert: () => (Trie_insert),
  insertMany: () => (Trie_insertMany),
  isEmpty: () => (Trie_isEmpty),
  keys: () => (Trie_keys),
  keysWithPrefix: () => (Trie_keysWithPrefix),
  longestPrefixOf: () => (Trie_longestPrefixOf),
  make: () => (Trie_make),
  map: () => (Trie_map),
  modify: () => (Trie_modify),
  reduce: () => (Trie_reduce),
  remove: () => (Trie_remove),
  removeMany: () => (Trie_removeMany),
  size: () => (Trie_size),
  toEntries: () => (toEntries),
  toEntriesWithPrefix: () => (Trie_toEntriesWithPrefix),
  unsafeGet: () => (Trie_unsafeGet),
  values: () => (Trie_values),
  valuesWithPrefix: () => (Trie_valuesWithPrefix) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Types.js
var Types_namespaceObject = {};
__webpack_require__.r(Types_namespaceObject);

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/UpstreamPullRequest.js
var UpstreamPullRequest_namespaceObject = {};
__webpack_require__.r(UpstreamPullRequest_namespaceObject);
__webpack_require__.d(UpstreamPullRequest_namespaceObject, { 
  NoUpstream: () => (NoUpstream),
  Pulled: () => (Pulled),
  UpstreamPullRequestTypeId: () => (UpstreamPullRequestTypeId),
  isNoUpstream: () => (isNoUpstream),
  isPulled: () => (isPulled),
  isUpstreamPullRequest: () => (isUpstreamPullRequest),
  match: () => (UpstreamPullRequest_match) });

// NAMESPACE OBJECT: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/UpstreamPullStrategy.js
var UpstreamPullStrategy_namespaceObject = {};
__webpack_require__.r(UpstreamPullStrategy_namespaceObject);
__webpack_require__.d(UpstreamPullStrategy_namespaceObject, { 
  PullAfterAllEnqueued: () => (PullAfterAllEnqueued),
  PullAfterNext: () => (PullAfterNext),
  UpstreamPullStrategyTypeId: () => (UpstreamPullStrategyTypeId),
  isPullAfterAllEnqueued: () => (isPullAfterAllEnqueued),
  isPullAfterNext: () => (isPullAfterNext),
  isUpstreamPullStrategy: () => (isUpstreamPullStrategy),
  match: () => (UpstreamPullStrategy_match) });


// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Function.js
var Function = __webpack_require__(61279);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Array.js
var esm_Array = __webpack_require__(93118);
// EXTERNAL MODULE: ./node_modules/.pnpm/fast-check@3.23.2/node_modules/fast-check/lib/esm/fast-check.js + 238 modules
var fast_check = __webpack_require__(68479);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FastCheck.js
/**
 * @since 3.10.0
 */
/**
 * @category re-exports
 * @since 3.10.0
 */

//# sourceMappingURL=FastCheck.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/GlobalValue.js
var GlobalValue = __webpack_require__(9091);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/schema/errors.js
var errors = __webpack_require__(34234);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/schema/schemaId.js
var schema_schemaId = __webpack_require__(92267);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/schema/util.js
var util = __webpack_require__(65157);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Option.js
var Option = __webpack_require__(31706);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Predicate.js
var Predicate = __webpack_require__(35034);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SchemaAST.js
var SchemaAST = __webpack_require__(27642);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Arbitrary.js
/**
 * @since 3.10.0
 */









/**
 * Returns a LazyArbitrary for the `A` type of the provided schema.
 *
 * @category arbitrary
 * @since 3.10.0
 */
const makeLazy = schema => {
  const description = getDescription(schema.ast, []);
  return Arbitrary_go(description, {
    maxDepth: 2
  });
};
/**
 * Returns a fast-check Arbitrary for the `A` type of the provided schema.
 *
 * @category arbitrary
 * @since 3.10.0
 */
const make = schema => makeLazy(schema)(FastCheck_namespaceObject);
/** @internal */
const makeStringConstraints = options => {
  const out = {
    _tag: "StringConstraints",
    constraints: {}
  };
  if (Predicate.isNumber(options.minLength)) {
    out.constraints.minLength = options.minLength;
  }
  if (Predicate.isNumber(options.maxLength)) {
    out.constraints.maxLength = options.maxLength;
  }
  if (Predicate.isString(options.pattern)) {
    out.pattern = options.pattern;
  }
  return out;
};
/** @internal */
const makeNumberConstraints = options => {
  const out = {
    _tag: "NumberConstraints",
    constraints: {},
    isInteger: options.isInteger ?? false
  };
  if (Predicate.isNumber(options.min)) {
    out.constraints.min = Math.fround(options.min);
  }
  if (Predicate.isBoolean(options.minExcluded)) {
    out.constraints.minExcluded = options.minExcluded;
  }
  if (Predicate.isNumber(options.max)) {
    out.constraints.max = Math.fround(options.max);
  }
  if (Predicate.isBoolean(options.maxExcluded)) {
    out.constraints.maxExcluded = options.maxExcluded;
  }
  if (Predicate.isBoolean(options.noNaN)) {
    out.constraints.noNaN = options.noNaN;
  }
  if (Predicate.isBoolean(options.noDefaultInfinity)) {
    out.constraints.noDefaultInfinity = options.noDefaultInfinity;
  }
  return out;
};
/** @internal */
const makeBigIntConstraints = options => {
  const out = {
    _tag: "BigIntConstraints",
    constraints: {}
  };
  if (Predicate.isBigInt(options.min)) {
    out.constraints.min = options.min;
  }
  if (Predicate.isBigInt(options.max)) {
    out.constraints.max = options.max;
  }
  return out;
};
/** @internal */
const makeArrayConstraints = options => {
  const out = {
    _tag: "ArrayConstraints",
    constraints: {}
  };
  if (Predicate.isNumber(options.minLength)) {
    out.constraints.minLength = options.minLength;
  }
  if (Predicate.isNumber(options.maxLength)) {
    out.constraints.maxLength = options.maxLength;
  }
  return out;
};
/** @internal */
const makeDateConstraints = options => {
  const out = {
    _tag: "DateConstraints",
    constraints: {}
  };
  if (Predicate.isDate(options.min)) {
    out.constraints.min = options.min;
  }
  if (Predicate.isDate(options.max)) {
    out.constraints.max = options.max;
  }
  if (Predicate.isBoolean(options.noInvalidDate)) {
    out.constraints.noInvalidDate = options.noInvalidDate;
  }
  return out;
};
const getArbitraryAnnotation = /*#__PURE__*/SchemaAST.getAnnotation(SchemaAST.ArbitraryAnnotationId);
const getASTConstraints = ast => {
  const TypeAnnotationId = ast.annotations[SchemaAST.SchemaIdAnnotationId];
  if (Predicate.isPropertyKey(TypeAnnotationId)) {
    const out = ast.annotations[TypeAnnotationId];
    if (Predicate.isReadonlyRecord(out)) {
      return out;
    }
  }
};
const idMemoMap = /*#__PURE__*/(0,GlobalValue.globalValue)(/*#__PURE__*/Symbol.for("effect/Arbitrary/IdMemoMap"), () => new Map());
let counter = 0;
function wrapGetDescription(f, g) {
  return (ast, path) => f(ast, g(ast, path));
}
function parseMeta(ast) {
  const jsonSchema = SchemaAST.getJSONSchemaAnnotation(ast).pipe(Option.filter(Predicate.isReadonlyRecord), Option.getOrUndefined);
  const schemaId = Option.getOrElse(SchemaAST.getSchemaIdAnnotation(ast), () => undefined);
  const schemaParams = Option.fromNullable(schemaId).pipe(Option.map(id => ast.annotations[id]), Option.filter(Predicate.isReadonlyRecord), Option.getOrUndefined);
  return [schemaId, {
    ...schemaParams,
    ...jsonSchema
  }];
}
/** @internal */
const getDescription = /*#__PURE__*/wrapGetDescription((ast, description) => {
  const annotation = getArbitraryAnnotation(ast);
  if (Option.isSome(annotation)) {
    return {
      ...description,
      annotations: [...description.annotations, annotation.value]
    };
  }
  return description;
}, (ast, path) => {
  const [schemaId, meta] = parseMeta(ast);
  switch (ast._tag) {
    case "Refinement":
      {
        const from = getDescription(ast.from, path);
        switch (from._tag) {
          case "StringKeyword":
            return {
              ...from,
              constraints: [...from.constraints, makeStringConstraints(meta)],
              refinements: [...from.refinements, ast]
            };
          case "NumberKeyword":
            {
              const c = schemaId === schema_schemaId/* .NonNaNSchemaId */.Rt ? makeNumberConstraints({
                noNaN: true
              }) : schemaId === schema_schemaId/* .FiniteSchemaId */.EL || schemaId === schema_schemaId/* .JsonNumberSchemaId */.cr ? makeNumberConstraints({
                noDefaultInfinity: true,
                noNaN: true
              }) : makeNumberConstraints({
                isInteger: "type" in meta && meta.type === "integer",
                noNaN: undefined,
                noDefaultInfinity: undefined,
                min: meta.exclusiveMinimum ?? meta.minimum,
                minExcluded: "exclusiveMinimum" in meta ? true : undefined,
                max: meta.exclusiveMaximum ?? meta.maximum,
                maxExcluded: "exclusiveMaximum" in meta ? true : undefined
              });
              return {
                ...from,
                constraints: [...from.constraints, c],
                refinements: [...from.refinements, ast]
              };
            }
          case "BigIntKeyword":
            {
              const c = getASTConstraints(ast);
              return {
                ...from,
                constraints: c !== undefined ? [...from.constraints, makeBigIntConstraints(c)] : from.constraints,
                refinements: [...from.refinements, ast]
              };
            }
          case "TupleType":
            return {
              ...from,
              constraints: [...from.constraints, makeArrayConstraints({
                minLength: meta.minItems,
                maxLength: meta.maxItems
              })],
              refinements: [...from.refinements, ast]
            };
          case "DateFromSelf":
            return {
              ...from,
              constraints: [...from.constraints, makeDateConstraints(meta)],
              refinements: [...from.refinements, ast]
            };
          default:
            return {
              ...from,
              refinements: [...from.refinements, ast]
            };
        }
      }
    case "Declaration":
      {
        if (schemaId === schema_schemaId/* .DateFromSelfSchemaId */.Z) {
          return {
            _tag: "DateFromSelf",
            constraints: [makeDateConstraints(meta)],
            path,
            refinements: [],
            annotations: []
          };
        }
        return {
          _tag: "Declaration",
          typeParameters: ast.typeParameters.map(ast => getDescription(ast, path)),
          path,
          refinements: [],
          annotations: [],
          ast
        };
      }
    case "Literal":
      {
        return {
          _tag: "Literal",
          literal: ast.literal,
          path,
          refinements: [],
          annotations: []
        };
      }
    case "UniqueSymbol":
      {
        return {
          _tag: "UniqueSymbol",
          symbol: ast.symbol,
          path,
          refinements: [],
          annotations: []
        };
      }
    case "Enums":
      {
        return {
          _tag: "Enums",
          enums: ast.enums,
          path,
          refinements: [],
          annotations: [],
          ast
        };
      }
    case "TemplateLiteral":
      {
        return {
          _tag: "TemplateLiteral",
          head: ast.head,
          spans: ast.spans.map(span => ({
            description: getDescription(span.type, path),
            literal: span.literal
          })),
          path,
          refinements: [],
          annotations: []
        };
      }
    case "StringKeyword":
      return {
        _tag: "StringKeyword",
        constraints: [],
        path,
        refinements: [],
        annotations: []
      };
    case "NumberKeyword":
      return {
        _tag: "NumberKeyword",
        constraints: [],
        path,
        refinements: [],
        annotations: []
      };
    case "BigIntKeyword":
      return {
        _tag: "BigIntKeyword",
        constraints: [],
        path,
        refinements: [],
        annotations: []
      };
    case "TupleType":
      return {
        _tag: "TupleType",
        constraints: [],
        elements: ast.elements.map((element, i) => ({
          isOptional: element.isOptional,
          description: getDescription(element.type, [...path, i])
        })),
        rest: ast.rest.map((element, i) => getDescription(element.type, [...path, i])),
        path,
        refinements: [],
        annotations: []
      };
    case "TypeLiteral":
      return {
        _tag: "TypeLiteral",
        propertySignatures: ast.propertySignatures.map(ps => ({
          isOptional: ps.isOptional,
          name: ps.name,
          value: getDescription(ps.type, [...path, ps.name])
        })),
        indexSignatures: ast.indexSignatures.map(is => ({
          parameter: getDescription(is.parameter, path),
          value: getDescription(is.type, path)
        })),
        path,
        refinements: [],
        annotations: []
      };
    case "Union":
      return {
        _tag: "Union",
        members: ast.types.map((member, i) => getDescription(member, [...path, i])),
        path,
        refinements: [],
        annotations: []
      };
    case "Suspend":
      {
        const memoId = idMemoMap.get(ast);
        if (memoId !== undefined) {
          return {
            _tag: "Ref",
            id: memoId,
            ast,
            path,
            refinements: [],
            annotations: []
          };
        }
        counter++;
        const id = `__id-${counter}__`;
        idMemoMap.set(ast, id);
        return {
          _tag: "Suspend",
          id,
          ast,
          description: () => getDescription(ast.f(), path),
          path,
          refinements: [],
          annotations: []
        };
      }
    case "Transformation":
      return getDescription(ast.to, path);
    case "NeverKeyword":
      return {
        _tag: "NeverKeyword",
        path,
        refinements: [],
        annotations: [],
        ast
      };
    default:
      {
        return {
          _tag: "Keyword",
          value: ast._tag,
          path,
          refinements: [],
          annotations: []
        };
      }
  }
});
function getMax(n1, n2) {
  return n1 === undefined ? n2 : n2 === undefined ? n1 : n1 <= n2 ? n2 : n1;
}
function getMin(n1, n2) {
  return n1 === undefined ? n2 : n2 === undefined ? n1 : n1 <= n2 ? n1 : n2;
}
const getOr = (a, b) => {
  return a === undefined ? b : b === undefined ? a : a || b;
};
function mergePattern(pattern1, pattern2) {
  if (pattern1 === undefined) {
    return pattern2;
  }
  if (pattern2 === undefined) {
    return pattern1;
  }
  return `(?:${pattern1})|(?:${pattern2})`;
}
function mergeStringConstraints(c1, c2) {
  return makeStringConstraints({
    minLength: getMax(c1.constraints.minLength, c2.constraints.minLength),
    maxLength: getMin(c1.constraints.maxLength, c2.constraints.maxLength),
    pattern: mergePattern(c1.pattern, c2.pattern)
  });
}
function buildStringConstraints(description) {
  return description.constraints.length === 0 ? undefined : description.constraints.reduce(mergeStringConstraints);
}
function mergeNumberConstraints(c1, c2) {
  return makeNumberConstraints({
    isInteger: c1.isInteger || c2.isInteger,
    min: getMax(c1.constraints.min, c2.constraints.min),
    minExcluded: getOr(c1.constraints.minExcluded, c2.constraints.minExcluded),
    max: getMin(c1.constraints.max, c2.constraints.max),
    maxExcluded: getOr(c1.constraints.maxExcluded, c2.constraints.maxExcluded),
    noNaN: getOr(c1.constraints.noNaN, c2.constraints.noNaN),
    noDefaultInfinity: getOr(c1.constraints.noDefaultInfinity, c2.constraints.noDefaultInfinity)
  });
}
function buildNumberConstraints(description) {
  return description.constraints.length === 0 ? undefined : description.constraints.reduce(mergeNumberConstraints);
}
function mergeBigIntConstraints(c1, c2) {
  return makeBigIntConstraints({
    min: getMax(c1.constraints.min, c2.constraints.min),
    max: getMin(c1.constraints.max, c2.constraints.max)
  });
}
function buildBigIntConstraints(description) {
  return description.constraints.length === 0 ? undefined : description.constraints.reduce(mergeBigIntConstraints);
}
function mergeDateConstraints(c1, c2) {
  return makeDateConstraints({
    min: getMax(c1.constraints.min, c2.constraints.min),
    max: getMin(c1.constraints.max, c2.constraints.max),
    noInvalidDate: getOr(c1.constraints.noInvalidDate, c2.constraints.noInvalidDate)
  });
}
function buildDateConstraints(description) {
  return description.constraints.length === 0 ? undefined : description.constraints.reduce(mergeDateConstraints);
}
const constArrayConstraints = /*#__PURE__*/makeArrayConstraints({});
function mergeArrayConstraints(c1, c2) {
  return makeArrayConstraints({
    minLength: getMax(c1.constraints.minLength, c2.constraints.minLength),
    maxLength: getMin(c1.constraints.maxLength, c2.constraints.maxLength)
  });
}
function buildArrayConstraints(description) {
  return description.constraints.length === 0 ? undefined : description.constraints.reduce(mergeArrayConstraints);
}
const arbitraryMemoMap = /*#__PURE__*/(0,GlobalValue.globalValue)(/*#__PURE__*/Symbol.for("effect/Arbitrary/arbitraryMemoMap"), () => new WeakMap());
function applyFilters(filters, arb) {
  return fc => filters.reduce((arb, filter) => arb.filter(filter), arb(fc));
}
function absurd(message) {
  return () => {
    throw new Error(message);
  };
}
function getContextConstraints(description) {
  switch (description._tag) {
    case "StringKeyword":
      return buildStringConstraints(description);
    case "NumberKeyword":
      return buildNumberConstraints(description);
    case "BigIntKeyword":
      return buildBigIntConstraints(description);
    case "DateFromSelf":
      return buildDateConstraints(description);
    case "TupleType":
      return buildArrayConstraints(description);
  }
}
function wrapGo(f, g) {
  return (description, ctx) => f(description, ctx, g(description, ctx));
}
const Arbitrary_go = /*#__PURE__*/wrapGo((description, ctx, lazyArb) => {
  const annotation = description.annotations[description.annotations.length - 1];
  // error handling
  if (annotation === undefined) {
    switch (description._tag) {
      case "Declaration":
      case "NeverKeyword":
        throw new Error(errors/* .getArbitraryMissingAnnotationErrorMessage */.Jg(description.path, description.ast));
      case "Enums":
        if (description.enums.length === 0) {
          throw new Error(errors/* .getArbitraryEmptyEnumErrorMessage */.Sq(description.path));
        }
    }
  }
  const filters = description.refinements.map(ast => a => Option.isNone(ast.filter(a, SchemaAST.defaultParseOption, ast)));
  if (annotation === undefined) {
    return applyFilters(filters, lazyArb);
  }
  const constraints = getContextConstraints(description);
  if (constraints !== undefined) {
    ctx = {
      ...ctx,
      constraints
    };
  }
  if (description._tag === "Declaration") {
    return applyFilters(filters, annotation(...description.typeParameters.map(p => Arbitrary_go(p, ctx)), ctx));
  }
  if (description.refinements.length > 0) {
    // TODO(4.0): remove the `lazyArb` parameter
    return applyFilters(filters, annotation(lazyArb, ctx));
  }
  return annotation(ctx);
}, (description, ctx) => {
  switch (description._tag) {
    case "DateFromSelf":
      {
        const constraints = buildDateConstraints(description);
        return fc => fc.date(constraints?.constraints);
      }
    case "Declaration":
    case "NeverKeyword":
      return absurd(`BUG: cannot generate an arbitrary for ${description._tag}`);
    case "Literal":
      return fc => fc.constant(description.literal);
    case "UniqueSymbol":
      return fc => fc.constant(description.symbol);
    case "Keyword":
      {
        switch (description.value) {
          case "UndefinedKeyword":
            return fc => fc.constant(undefined);
          case "VoidKeyword":
          case "UnknownKeyword":
          case "AnyKeyword":
            return fc => fc.anything();
          case "BooleanKeyword":
            return fc => fc.boolean();
          case "SymbolKeyword":
            return fc => fc.string().map(s => Symbol.for(s));
          case "ObjectKeyword":
            return fc => fc.oneof(fc.object(), fc.array(fc.anything()));
        }
      }
    case "Enums":
      return fc => fc.oneof(...description.enums.map(([_, value]) => fc.constant(value)));
    case "TemplateLiteral":
      {
        return fc => {
          const string = fc.string({
            maxLength: 5
          });
          const number = fc.float({
            noDefaultInfinity: true,
            noNaN: true
          });
          const getTemplateLiteralArb = description => {
            const components = description.head !== "" ? [fc.constant(description.head)] : [];
            const getTemplateLiteralSpanTypeArb = description => {
              switch (description._tag) {
                case "StringKeyword":
                  return string;
                case "NumberKeyword":
                  return number;
                case "Literal":
                  return fc.constant(String(description.literal));
                case "Union":
                  return fc.oneof(...description.members.map(getTemplateLiteralSpanTypeArb));
                case "TemplateLiteral":
                  return getTemplateLiteralArb(description);
                default:
                  return fc.constant("");
              }
            };
            description.spans.forEach(span => {
              components.push(getTemplateLiteralSpanTypeArb(span.description));
              if (span.literal !== "") {
                components.push(fc.constant(span.literal));
              }
            });
            return fc.tuple(...components).map(spans => spans.join(""));
          };
          return getTemplateLiteralArb(description);
        };
      }
    case "StringKeyword":
      {
        const constraints = buildStringConstraints(description);
        const pattern = constraints?.pattern;
        return pattern !== undefined ? fc => fc.stringMatching(new RegExp(pattern)) : fc => fc.string(constraints?.constraints);
      }
    case "NumberKeyword":
      {
        const constraints = buildNumberConstraints(description);
        return constraints?.isInteger ? fc => fc.integer(constraints.constraints) : fc => fc.float(constraints?.constraints);
      }
    case "BigIntKeyword":
      {
        const constraints = buildBigIntConstraints(description);
        return fc => fc.bigInt(constraints?.constraints ?? {});
      }
    case "TupleType":
      {
        const elements = [];
        let hasOptionals = false;
        for (const element of description.elements) {
          elements.push(Arbitrary_go(element.description, ctx));
          if (element.isOptional) {
            hasOptionals = true;
          }
        }
        const rest = description.rest.map(d => Arbitrary_go(d, ctx));
        return fc => {
          // ---------------------------------------------
          // handle elements
          // ---------------------------------------------
          let output = fc.tuple(...elements.map(arb => arb(fc)));
          if (hasOptionals) {
            const indexes = fc.tuple(...description.elements.map(element => element.isOptional ? fc.boolean() : fc.constant(true)));
            output = output.chain(tuple => indexes.map(booleans => {
              for (const [i, b] of booleans.reverse().entries()) {
                if (!b) {
                  tuple.splice(booleans.length - i, 1);
                }
              }
              return tuple;
            }));
          }
          // ---------------------------------------------
          // handle rest element
          // ---------------------------------------------
          if (esm_Array.isNonEmptyReadonlyArray(rest)) {
            const constraints = buildArrayConstraints(description) ?? constArrayConstraints;
            const [head, ...tail] = rest;
            const item = head(fc);
            output = output.chain(as => {
              const len = as.length;
              // We must adjust the constraints for the rest element
              // because the elements might have generated some values
              const restArrayConstraints = subtractElementsLength(constraints.constraints, len);
              if (restArrayConstraints.maxLength === 0) {
                return fc.constant(as);
              }
              /*
                         `getSuspendedArray` is used to generate less values in
              the context of a recursive schema. Without it, the following schema
              would generate an big amount of values possibly leading to a stack
              overflow:
                         ```ts
              type A = ReadonlyArray<A | null>
                         const schema = S.Array(
                S.NullOr(S.suspend((): S.Schema<A> => schema))
              )
              ```
                       */
              const arr = ctx.depthIdentifier !== undefined ? getSuspendedArray(fc, ctx.depthIdentifier, ctx.maxDepth, item, restArrayConstraints) : fc.array(item, restArrayConstraints);
              if (len === 0) {
                return arr;
              }
              return arr.map(rest => [...as, ...rest]);
            });
            // ---------------------------------------------
            // handle post rest elements
            // ---------------------------------------------
            for (let j = 0; j < tail.length; j++) {
              output = output.chain(as => tail[j](fc).map(a => [...as, a]));
            }
          }
          return output;
        };
      }
    case "TypeLiteral":
      {
        const propertySignatures = [];
        const requiredKeys = [];
        for (const ps of description.propertySignatures) {
          if (!ps.isOptional) {
            requiredKeys.push(ps.name);
          }
          propertySignatures.push(Arbitrary_go(ps.value, ctx));
        }
        const indexSignatures = description.indexSignatures.map(is => [Arbitrary_go(is.parameter, ctx), Arbitrary_go(is.value, ctx)]);
        return fc => {
          const pps = {};
          for (let i = 0; i < propertySignatures.length; i++) {
            const ps = description.propertySignatures[i];
            pps[ps.name] = propertySignatures[i](fc);
          }
          let output = fc.record(pps, {
            requiredKeys
          });
          // ---------------------------------------------
          // handle index signatures
          // ---------------------------------------------
          for (let i = 0; i < indexSignatures.length; i++) {
            const key = indexSignatures[i][0](fc);
            const value = indexSignatures[i][1](fc);
            output = output.chain(o => {
              const item = fc.tuple(key, value);
              /*
                         `getSuspendedArray` is used to generate less key/value pairs in
              the context of a recursive schema. Without it, the following schema
              would generate an big amount of values possibly leading to a stack
              overflow:
                         ```ts
              type A = { [_: string]: A }
                         const schema = S.Record({ key: S.String, value: S.suspend((): S.Schema<A> => schema) })
              ```
                       */
              const arr = ctx.depthIdentifier !== undefined ? getSuspendedArray(fc, ctx.depthIdentifier, ctx.maxDepth, item, {
                maxLength: 2
              }) : fc.array(item);
              return arr.map(tuples => ({
                ...Object.fromEntries(tuples),
                ...o
              }));
            });
          }
          return output;
        };
      }
    case "Union":
      {
        const members = description.members.map(member => Arbitrary_go(member, ctx));
        return fc => fc.oneof(...members.map(arb => arb(fc)));
      }
    case "Suspend":
      {
        const memo = arbitraryMemoMap.get(description.ast);
        if (memo) {
          return memo;
        }
        if (ctx.depthIdentifier === undefined) {
          ctx = {
            ...ctx,
            depthIdentifier: description.id
          };
        }
        const get = util/* .memoizeThunk */.Z4(() => {
          return Arbitrary_go(description.description(), ctx);
        });
        const out = fc => fc.constant(null).chain(() => get()(fc));
        arbitraryMemoMap.set(description.ast, out);
        return out;
      }
    case "Ref":
      {
        const memo = arbitraryMemoMap.get(description.ast);
        if (memo) {
          return memo;
        }
        throw new Error(`BUG: Ref ${JSON.stringify(description.id)} not found`);
      }
  }
});
function subtractElementsLength(constraints, len) {
  if (len === 0 || constraints.minLength === undefined && constraints.maxLength === undefined) {
    return constraints;
  }
  const out = {
    ...constraints
  };
  if (out.minLength !== undefined) {
    out.minLength = Math.max(out.minLength - len, 0);
  }
  if (out.maxLength !== undefined) {
    out.maxLength = Math.max(out.maxLength - len, 0);
  }
  return out;
}
const getSuspendedArray = (fc, depthIdentifier, maxDepth, item, constraints) => {
  // In the context of a recursive schema, we don't want a `maxLength` greater than 2.
  // The only exception is when `minLength` is also set, in which case we set
  // `maxLength` to the minimum value, which is `minLength`.
  const maxLengthLimit = Math.max(2, constraints.minLength ?? 0);
  if (constraints.maxLength !== undefined && constraints.maxLength > maxLengthLimit) {
    constraints = {
      ...constraints,
      maxLength: maxLengthLimit
    };
  }
  return fc.oneof({
    maxDepth,
    depthIdentifier
  }, fc.constant([]), fc.array(item, constraints));
};
//# sourceMappingURL=Arbitrary.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/BigDecimal.js
var BigDecimal = __webpack_require__(97678);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/BigInt.js
var esm_BigInt = __webpack_require__(35724);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Boolean.js
var Boolean = __webpack_require__(41531);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Brand.js
var Brand = __webpack_require__(26110);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/cache.js
var internal_cache = __webpack_require__(3767);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cache.js

/**
 * @since 2.0.0
 * @category symbols
 */
const CacheTypeId = internal_cache/* .CacheTypeId */.qC;
/**
 * @since 3.6.4
 * @category symbols
 */
const ConsumerCacheTypeId = internal_cache/* .ConsumerCacheTypeId */.u8;
/**
 * Constructs a new cache with the specified capacity, time to live, and
 * lookup function.
 *
 * @since 2.0.0
 * @category constructors
 */
const Cache_make = internal_cache/* .make */.L8;
/**
 * Constructs a new cache with the specified capacity, time to live, and
 * lookup function, where the time to live can depend on the `Exit` value
 * returned by the lookup function.
 *
 * @since 2.0.0
 * @category constructors
 */
const makeWith = internal_cache/* .makeWith */.lh;
/**
 * Constructs a new `CacheStats` from the specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const makeCacheStats = internal_cache/* .makeCacheStats */.c8;
/**
 * Constructs a new `EntryStats` from the specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const makeEntryStats = internal_cache/* .makeEntryStats */.Eh;
//# sourceMappingURL=Cache.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cause.js
var Cause = __webpack_require__(56560);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Channel.js
var Channel = __webpack_require__(28800);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/childExecutorDecision.js
var childExecutorDecision = __webpack_require__(2684);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ChildExecutorDecision.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const ChildExecutorDecisionTypeId = childExecutorDecision/* .ChildExecutorDecisionTypeId */.Rh;
/**
 * @since 2.0.0
 * @category constructors
 */
const Continue = childExecutorDecision/* .Continue */.wP;
/**
 * @since 2.0.0
 * @category constructors
 */
const Close = childExecutorDecision/* .Close */.bm;
/**
 * @since 2.0.0
 * @category constructors
 */
const Yield = childExecutorDecision/* .Yield */.GN;
/**
 * Returns `true` if the specified value is a `ChildExecutorDecision`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isChildExecutorDecision = childExecutorDecision/* .isChildExecutorDecision */.eV;
/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Continue`,
 * `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isContinue = childExecutorDecision/* .isContinue */.Wk;
/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Close`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isClose = childExecutorDecision/* .isClose */.Zj;
/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Yield`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isYield = childExecutorDecision/* .isYield */.gw;
/**
 * Folds over a `ChildExecutorDecision` to produce a value of type `A`.
 *
 * @since 2.0.0
 * @category folding
 */
const match = childExecutorDecision/* .match */.YW;
//# sourceMappingURL=ChildExecutorDecision.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Chunk.js
var Chunk = __webpack_require__(878);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Clock.js
var Clock = __webpack_require__(35409);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Config.js + 1 modules
var Config = __webpack_require__(34722);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ConfigError.js
var ConfigError = __webpack_require__(66039);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ConfigProvider.js
var ConfigProvider = __webpack_require__(37640);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ConfigProviderPathPatch.js
var ConfigProviderPathPatch = __webpack_require__(31917);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/console.js
var console = __webpack_require__(15272);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/defaultServices/console.js
var defaultServices_console = __webpack_require__(31622);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Console.js


/**
 * @since 2.0.0
 * @category type ids
 */
const TypeId = defaultServices_console/* .TypeId */.ii;
/**
 * @since 2.0.0
 * @category context
 */
const Console = defaultServices_console/* .consoleTag */.MG;
/**
 * @since 2.0.0
 * @category default services
 */
const withConsole = console/* .withConsole */.QW;
/**
 * @since 2.0.0
 * @category default services
 */
const setConsole = console/* .setConsole */.oV;
/**
 * @since 2.0.0
 * @category accessor
 */
const consoleWith = console/* .consoleWith */.un;
/**
 * @since 2.0.0
 * @category accessor
 */
const assert = console/* .assert */.vA;
/**
 * @since 2.0.0
 * @category accessor
 */
const clear = console/* .clear */.IU;
/**
 * @since 2.0.0
 * @category accessor
 */
const Console_count = console/* .count */.U9;
/**
 * @since 2.0.0
 * @category accessor
 */
const countReset = console/* .countReset */.Ts;
/**
 * @since 2.0.0
 * @category accessor
 */
const debug = console/* .debug */.Yz;
/**
 * @since 2.0.0
 * @category accessor
 */
const dir = console/* .dir */.y_;
/**
 * @since 2.0.0
 * @category accessor
 */
const dirxml = console/* .dirxml */.BU;
/**
 * @since 2.0.0
 * @category accessor
 */
const Console_error = console/* .error */.z3;
/**
 * @since 2.0.0
 * @category accessor
 */
const group = console/* .group */.Os;
/**
 * @since 2.0.0
 * @category accessor
 */
const info = console/* .info */.pq;
/**
 * @since 2.0.0
 * @category accessor
 */
const log = console/* .log */.Rm;
/**
 * @since 2.0.0
 * @category accessor
 */
const table = console/* .table */.tp;
/**
 * @since 2.0.0
 * @category accessor
 */
const time = console/* .time */.kB;
/**
 * @since 2.0.0
 * @category accessor
 */
const timeLog = console/* .timeLog */.al;
/**
 * @since 2.0.0
 * @category accessor
 */
const trace = console/* .trace */.uP;
/**
 * @since 2.0.0
 * @category accessor
 */
const warn = console/* .warn */.R8;
/**
 * @since 2.0.0
 * @category accessor
 */
const withGroup = console/* .withGroup */.I1;
/**
 * @since 2.0.0
 * @category accessor
 */
const withTime = console/* .withTime */.CE;
//# sourceMappingURL=Console.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Context.js
var Context = __webpack_require__(50256);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Cron.js
var Cron = __webpack_require__(98427);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Data.js
var Data = __webpack_require__(65279);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/DateTime.js
var DateTime = __webpack_require__(74046);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/DefaultServices.js
var DefaultServices = __webpack_require__(87046);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Deferred.js
var Deferred = __webpack_require__(64200);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Differ.js
var Differ = __webpack_require__(50587);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Duration.js
var Duration = __webpack_require__(72895);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Effect.js
var Effect = __webpack_require__(46330);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Effectable.js
var Effectable = __webpack_require__(42650);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Either.js
var Either = __webpack_require__(53266);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Encoding.js + 4 modules
var Encoding = __webpack_require__(56727);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Equal.js
var Equal = __webpack_require__(21167);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Equivalence.js
var Equivalence = __webpack_require__(45687);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/executionPlan.js
var executionPlan = __webpack_require__(43560);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Layer.js
var Layer = __webpack_require__(78518);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Pipeable.js
var Pipeable = __webpack_require__(79083);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ExecutionPlan.js




/**
 * @since 3.16.0
 * @category Symbols
 * @experimental
 */
const ExecutionPlan_TypeId = executionPlan/* .TypeId */.ii;
/**
 * @since 3.16.0
 * @category Guards
 * @experimental
 */
const isExecutionPlan = executionPlan/* .isExecutionPlan */.WH;
/**
 * Create an `ExecutionPlan`, which can be used with `Effect.withExecutionPlan` or `Stream.withExecutionPlan`, allowing you to provide different resources for each step of execution until the effect succeeds or the plan is exhausted.
 *
 * ```ts
 * import type { LanguageModel } from "@effect/ai"
 * import type { Layer } from "effect"
 * import { Effect, ExecutionPlan, Schedule } from "effect"
 *
 * declare const layerBad: Layer.Layer<LanguageModel.LanguageModel>
 * declare const layerGood: Layer.Layer<LanguageModel.LanguageModel>
 *
 * const ThePlan = ExecutionPlan.make(
 *   {
 *     // First try with the bad layer 2 times with a 3 second delay between attempts
 *     provide: layerBad,
 *     attempts: 2,
 *     schedule: Schedule.spaced(3000)
 *   },
 *   // Then try with the bad layer 3 times with a 1 second delay between attempts
 *   {
 *     provide: layerBad,
 *     attempts: 3,
 *     schedule: Schedule.spaced(1000)
 *   },
 *   // Finally try with the good layer.
 *   //
 *   // If `attempts` is omitted, the plan will only attempt once, unless a schedule is provided.
 *   {
 *     provide: layerGood
 *   }
 * )
 *
 * declare const effect: Effect.Effect<
 *   void,
 *   never,
 *   LanguageModel.LanguageModel
 * >
 * const withPlan: Effect.Effect<void> = Effect.withExecutionPlan(effect, ThePlan)
 * ```
 *
 * @since 3.16.0
 * @category Constructors
 * @experimental
 */
const ExecutionPlan_make = (...steps) => makeProto(steps.map((options, i) => {
  if (options.attempts && options.attempts < 1) {
    throw new Error(`ExecutionPlan.make: step[${i}].attempts must be greater than 0`);
  }
  return {
    schedule: options.schedule,
    attempts: options.attempts,
    while: options.while ? input => Effect.suspend(() => {
      const result = options.while(input);
      return typeof result === "boolean" ? Effect.succeed(result) : result;
    }) : undefined,
    provide: options.provide
  };
}));
const Proto = {
  [ExecutionPlan_TypeId]: ExecutionPlan_TypeId,
  get withRequirements() {
    const self = this;
    return Effect.contextWith(context => makeProto(self.steps.map(step => ({
      ...step,
      provide: Layer.isLayer(step.provide) ? Layer.provide(step.provide, Layer.succeedContext(context)) : step.provide
    }))));
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const makeProto = steps => {
  const self = Object.create(Proto);
  self.steps = steps;
  return self;
};
/**
 * @since 3.16.0
 * @category Combining
 * @experimental
 */
const merge = (...plans) => makeProto(plans.flatMap(plan => plan.steps));
//# sourceMappingURL=ExecutionPlan.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ExecutionStrategy.js
var ExecutionStrategy = __webpack_require__(77324);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Exit.js
var Exit = __webpack_require__(89895);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Fiber.js
var Fiber = __webpack_require__(28117);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberId.js
var FiberId = __webpack_require__(42852);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HashSet.js
var HashSet = __webpack_require__(74975);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Inspectable.js
var Inspectable = __webpack_require__(65051);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Runtime.js
var Runtime = __webpack_require__(5619);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberHandle.js













/**
 * @since 2.0.0
 * @categories type ids
 */
const FiberHandle_TypeId = /*#__PURE__*/Symbol.for("effect/FiberHandle");
/**
 * @since 2.0.0
 * @categories refinements
 */
const isFiberHandle = u => Predicate.hasProperty(u, FiberHandle_TypeId);
const FiberHandle_Proto = {
  [FiberHandle_TypeId]: FiberHandle_TypeId,
  toString() {
    return Inspectable.format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "FiberHandle",
      state: this.state
    };
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const unsafeMake = deferred => {
  const self = Object.create(FiberHandle_Proto);
  self.state = {
    _tag: "Open",
    fiber: undefined
  };
  self.deferred = deferred;
  return self;
};
/**
 * A FiberHandle can be used to store a single fiber.
 * When the associated Scope is closed, the contained fiber will be interrupted.
 *
 * You can add a fiber to the handle using `FiberHandle.run`, and the fiber will
 * be automatically removed from the FiberHandle when it completes.
 *
 * @example
 * ```ts
 * import { Effect, FiberHandle } from "effect"
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *
 *   // run some effects
 *   yield* FiberHandle.run(handle, Effect.never)
 *   // this will interrupt the previous fiber
 *   yield* FiberHandle.run(handle, Effect.never)
 *
 *   yield* Effect.sleep(1000)
 * }).pipe(
 *   Effect.scoped // The fiber will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories constructors
 */
const FiberHandle_make = () => Effect.acquireRelease(Effect.map(Deferred.make(), deferred => unsafeMake(deferred)), handle => Effect.withFiberRuntime(parent => {
  const state = handle.state;
  if (state._tag === "Closed") return Effect["void"];
  handle.state = {
    _tag: "Closed"
  };
  return state.fiber ? Effect.intoDeferred(Effect.asVoid(Fiber.interruptAs(state.fiber, FiberId.combine(parent.id(), internalFiberId))), handle.deferred) : Deferred.done(handle.deferred, Exit["void"]);
}));
/**
 * Create an Effect run function that is backed by a FiberHandle.
 *
 * @since 2.0.0
 * @categories constructors
 */
const makeRuntime = () => Effect.flatMap(FiberHandle_make(), self => FiberHandle_runtime(self)());
/**
 * Create an Effect run function that is backed by a FiberHandle.
 *
 * @since 3.13.0
 * @categories constructors
 */
const makeRuntimePromise = () => Effect.flatMap(FiberHandle_make(), self => runtimePromise(self)());
const internalFiberIdId = -1;
const internalFiberId = /*#__PURE__*/FiberId.make(internalFiberIdId, 0);
const isInternalInterruption = /*#__PURE__*/Cause.reduceWithContext(undefined, {
  emptyCase: Function.constFalse,
  failCase: Function.constFalse,
  dieCase: Function.constFalse,
  interruptCase: (_, fiberId) => HashSet.has(FiberId.ids(fiberId), internalFiberIdId),
  sequentialCase: (_, left, right) => left || right,
  parallelCase: (_, left, right) => left || right
});
/**
 * Set the fiber in a FiberHandle. When the fiber completes, it will be removed from the FiberHandle.
 * If a fiber is already running, it will be interrupted unless `options.onlyIfMissing` is set.
 *
 * @since 2.0.0
 * @categories combinators
 */
const unsafeSet = /*#__PURE__*/(0,Function.dual)(args => isFiberHandle(args[0]), (self, fiber, options) => {
  if (self.state._tag === "Closed") {
    fiber.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, internalFiberId));
    return;
  } else if (self.state.fiber !== undefined) {
    if (options?.onlyIfMissing === true) {
      fiber.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, internalFiberId));
      return;
    } else if (self.state.fiber === fiber) {
      return;
    }
    self.state.fiber.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, internalFiberId));
    self.state.fiber = undefined;
  }
  self.state.fiber = fiber;
  fiber.addObserver(exit => {
    if (self.state._tag === "Open" && fiber === self.state.fiber) {
      self.state.fiber = undefined;
    }
    if (Exit.isFailure(exit) && (options?.propagateInterruption === true ? !isInternalInterruption(exit.cause) : !Cause.isInterruptedOnly(exit.cause))) {
      Deferred.unsafeDone(self.deferred, exit);
    }
  });
});
/**
 * Set the fiber in the FiberHandle. When the fiber completes, it will be removed from the FiberHandle.
 * If a fiber already exists in the FiberHandle, it will be interrupted unless `options.onlyIfMissing` is set.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberHandle_set = /*#__PURE__*/(0,Function.dual)(args => isFiberHandle(args[0]), (self, fiber, options) => Effect.fiberIdWith(fiberId => Effect.sync(() => unsafeSet(self, fiber, {
  interruptAs: fiberId,
  onlyIfMissing: options?.onlyIfMissing,
  propagateInterruption: options?.propagateInterruption
}))));
/**
 * Retrieve the fiber from the FiberHandle.
 *
 * @since 2.0.0
 * @categories combinators
 */
const unsafeGet = self => self.state._tag === "Closed" ? Option.none() : Option.fromNullable(self.state.fiber);
/**
 * Retrieve the fiber from the FiberHandle.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberHandle_get = self => Effect.suspend(() => unsafeGet(self));
/**
 * @since 2.0.0
 * @categories combinators
 */
const FiberHandle_clear = self => Effect.uninterruptibleMask(restore => Effect.withFiberRuntime(fiber => {
  if (self.state._tag === "Closed" || self.state.fiber === undefined) {
    return Effect["void"];
  }
  return Effect.zipRight(restore(Fiber.interruptAs(self.state.fiber, FiberId.combine(fiber.id(), internalFiberId))), Effect.sync(() => {
    if (self.state._tag === "Open") {
      self.state.fiber = undefined;
    }
  }));
}));
const constInterruptedFiber = /*#__PURE__*/function () {
  let fiber = undefined;
  return () => {
    if (fiber === undefined) {
      fiber = Effect.runFork(Effect.interrupt);
    }
    return fiber;
  };
}();
/**
 * Run an Effect and add the forked fiber to the FiberHandle.
 * When the fiber completes, it will be removed from the FiberHandle.
 *
 * @since 2.0.0
 * @categories combinators
 */
const run = function () {
  const self = arguments[0];
  if (Effect.isEffect(arguments[1])) {
    return runImpl(self, arguments[1], arguments[2]);
  }
  const options = arguments[1];
  return effect => runImpl(self, effect, options);
};
const runImpl = (self, effect, options) => Effect.withFiberRuntime(parent => {
  if (self.state._tag === "Closed") {
    return Effect.interrupt;
  } else if (self.state.fiber !== undefined && options?.onlyIfMissing === true) {
    return Effect.sync(constInterruptedFiber);
  }
  const runtime = Runtime.make({
    context: parent.currentContext,
    fiberRefs: parent.getFiberRefs(),
    runtimeFlags: Runtime.defaultRuntime.runtimeFlags
  });
  const fiber = Runtime.runFork(runtime)(effect);
  unsafeSet(self, fiber, {
    ...options,
    interruptAs: parent.id()
  });
  return Effect.succeed(fiber);
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberHandle.
 *
 * @example
 * ```ts
 * import { Context, Effect, FiberHandle } from "effect"
 *
 * interface Users {
 *   readonly _: unique symbol
 * }
 * const Users = Context.GenericTag<Users, {
 *    getAll: Effect.Effect<Array<unknown>>
 * }>("Users")
 *
 * Effect.gen(function*() {
 *   const handle = yield* FiberHandle.make()
 *   const run = yield* FiberHandle.runtime(handle)<Users>()
 *
 *   // run an effect and set the fiber in the handle
 *   run(Effect.andThen(Users, _ => _.getAll))
 *
 *   // this will interrupt the previous fiber
 *   run(Effect.andThen(Users, _ => _.getAll))
 * }).pipe(
 *   Effect.scoped // The fiber will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberHandle_runtime = self => () => Effect.map(Effect.runtime(), runtime => {
  const runFork = Runtime.runFork(runtime);
  return (effect, options) => {
    if (self.state._tag === "Closed") {
      return constInterruptedFiber();
    } else if (self.state.fiber !== undefined && options?.onlyIfMissing === true) {
      return constInterruptedFiber();
    }
    const fiber = runFork(effect, options);
    unsafeSet(self, fiber, options);
    return fiber;
  };
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberHandle.
 *
 * The returned run function will return Promise's that will resolve when the
 * fiber completes.
 *
 * @since 3.13.0
 * @categories combinators
 */
const runtimePromise = self => () => Effect.map(FiberHandle_runtime(self)(), runFork => (effect, options) => new Promise((resolve, reject) => runFork(effect, options).addObserver(exit => {
  if (Exit.isSuccess(exit)) {
    resolve(exit.value);
  } else {
    reject(Cause.squash(exit.cause));
  }
})));
/**
 * If any of the Fiber's in the handle terminate with a failure,
 * the returned Effect will terminate with the first failure that occurred.
 *
 * @since 2.0.0
 * @categories combinators
 * @example
 * ```ts
 * import { Effect, FiberHandle } from "effect";
 *
 * Effect.gen(function* (_) {
 *   const handle = yield* _(FiberHandle.make());
 *   yield* _(FiberHandle.set(handle, Effect.runFork(Effect.fail("error"))));
 *
 *   // parent fiber will fail with "error"
 *   yield* _(FiberHandle.join(handle));
 * });
 * ```
 */
const join = self => Deferred["await"](self.deferred);
/**
 * Wait for the fiber in the FiberHandle to complete.
 *
 * @since 3.13.0
 * @categories combinators
 */
const awaitEmpty = self => Effect.suspend(() => {
  if (self.state._tag === "Closed" || self.state.fiber === undefined) {
    return Effect["void"];
  }
  return Fiber["await"](self.state.fiber);
});
//# sourceMappingURL=FiberHandle.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Iterable.js
var Iterable = __webpack_require__(11869);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableHashMap.js
var MutableHashMap = __webpack_require__(97711);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberMap.js















/**
 * @since 2.0.0
 * @categories type ids
 */
const FiberMap_TypeId = /*#__PURE__*/Symbol.for("effect/FiberMap");
/**
 * @since 2.0.0
 * @categories refinements
 */
const isFiberMap = u => Predicate.hasProperty(u, FiberMap_TypeId);
const FiberMap_Proto = {
  [FiberMap_TypeId]: FiberMap_TypeId,
  [Symbol.iterator]() {
    if (this.state._tag === "Closed") {
      return Iterable.empty();
    }
    return this.state.backing[Symbol.iterator]();
  },
  toString() {
    return Inspectable.format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "FiberMap",
      state: this.state
    };
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const FiberMap_unsafeMake = (backing, deferred) => {
  const self = Object.create(FiberMap_Proto);
  self.state = {
    _tag: "Open",
    backing
  };
  self.deferred = deferred;
  return self;
};
/**
 * A FiberMap can be used to store a collection of fibers, indexed by some key.
 * When the associated Scope is closed, all fibers in the map will be interrupted.
 *
 * You can add fibers to the map using `FiberMap.set` or `FiberMap.run`, and the fibers will
 * be automatically removed from the FiberMap when they complete.
 *
 * @example
 * ```ts
 * import { Effect, FiberMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* FiberMap.make<string>()
 *
 *   // run some effects and add the fibers to the map
 *   yield* FiberMap.run(map, "fiber a", Effect.never)
 *   yield* FiberMap.run(map, "fiber b", Effect.never)
 *
 *   yield* Effect.sleep(1000)
 * }).pipe(
 *   Effect.scoped // The fibers will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories constructors
 */
const FiberMap_make = () => Effect.acquireRelease(Effect.map(Deferred.make(), deferred => FiberMap_unsafeMake(MutableHashMap.empty(), deferred)), map => Effect.withFiberRuntime(parent => {
  const state = map.state;
  if (state._tag === "Closed") return Effect["void"];
  map.state = {
    _tag: "Closed"
  };
  return Fiber.interruptAllAs(Iterable.map(state.backing, ([, fiber]) => fiber), FiberId.combine(parent.id(), FiberMap_internalFiberId)).pipe(Effect.intoDeferred(map.deferred));
}));
/**
 * Create an Effect run function that is backed by a FiberMap.
 *
 * @since 2.0.0
 * @categories constructors
 */
const FiberMap_makeRuntime = () => Effect.flatMap(FiberMap_make(), self => FiberMap_runtime(self)());
/**
 * Create an Effect run function that is backed by a FiberMap.
 *
 * @since 3.13.0
 * @categories constructors
 */
const FiberMap_makeRuntimePromise = () => Effect.flatMap(FiberMap_make(), self => FiberMap_runtimePromise(self)());
const FiberMap_internalFiberIdId = -1;
const FiberMap_internalFiberId = /*#__PURE__*/FiberId.make(FiberMap_internalFiberIdId, 0);
const FiberMap_isInternalInterruption = /*#__PURE__*/Cause.reduceWithContext(undefined, {
  emptyCase: Function.constFalse,
  failCase: Function.constFalse,
  dieCase: Function.constFalse,
  interruptCase: (_, fiberId) => HashSet.has(FiberId.ids(fiberId), FiberMap_internalFiberIdId),
  sequentialCase: (_, left, right) => left || right,
  parallelCase: (_, left, right) => left || right
});
/**
 * Add a fiber to the FiberMap. When the fiber completes, it will be removed from the FiberMap.
 * If the key already exists in the FiberMap, the previous fiber will be interrupted.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_unsafeSet = /*#__PURE__*/(0,Function.dual)(args => isFiberMap(args[0]), (self, key, fiber, options) => {
  if (self.state._tag === "Closed") {
    fiber.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, FiberMap_internalFiberId));
    return;
  }
  const previous = MutableHashMap.get(self.state.backing, key);
  if (previous._tag === "Some") {
    if (options?.onlyIfMissing === true) {
      fiber.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, FiberMap_internalFiberId));
      return;
    } else if (previous.value === fiber) {
      return;
    }
    previous.value.unsafeInterruptAsFork(FiberId.combine(options?.interruptAs ?? FiberId.none, FiberMap_internalFiberId));
  }
  MutableHashMap.set(self.state.backing, key, fiber);
  fiber.addObserver(exit => {
    if (self.state._tag === "Closed") {
      return;
    }
    const current = MutableHashMap.get(self.state.backing, key);
    if (Option.isSome(current) && fiber === current.value) {
      MutableHashMap.remove(self.state.backing, key);
    }
    if (Exit.isFailure(exit) && (options?.propagateInterruption === true ? !FiberMap_isInternalInterruption(exit.cause) : !Cause.isInterruptedOnly(exit.cause))) {
      Deferred.unsafeDone(self.deferred, exit);
    }
  });
});
/**
 * Add a fiber to the FiberMap. When the fiber completes, it will be removed from the FiberMap.
 * If the key already exists in the FiberMap, the previous fiber will be interrupted.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_set = /*#__PURE__*/(0,Function.dual)(args => isFiberMap(args[0]), (self, key, fiber, options) => Effect.fiberIdWith(fiberId => Effect.sync(() => FiberMap_unsafeSet(self, key, fiber, {
  ...options,
  interruptAs: fiberId
}))));
/**
 * Retrieve a fiber from the FiberMap.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_unsafeGet = /*#__PURE__*/(0,Function.dual)(2, (self, key) => self.state._tag === "Closed" ? Option.none() : MutableHashMap.get(self.state.backing, key));
/**
 * Retrieve a fiber from the FiberMap.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_get = /*#__PURE__*/(0,Function.dual)(2, (self, key) => Effect.suspend(() => FiberMap_unsafeGet(self, key)));
/**
 * Check if a key exists in the FiberMap.
 *
 * @since 2.0.0
 * @categories combinators
 */
const unsafeHas = /*#__PURE__*/(0,Function.dual)(2, (self, key) => self.state._tag === "Closed" ? false : MutableHashMap.has(self.state.backing, key));
/**
 * Check if a key exists in the FiberMap.
 *
 * @since 2.0.0
 * @categories combinators
 */
const has = /*#__PURE__*/(0,Function.dual)(2, (self, key) => Effect.sync(() => unsafeHas(self, key)));
/**
 * Remove a fiber from the FiberMap, interrupting it if it exists.
 *
 * @since 2.0.0
 * @categories combinators
 */
const remove = /*#__PURE__*/(0,Function.dual)(2, (self, key) => Effect.withFiberRuntime(removeFiber => {
  if (self.state._tag === "Closed") {
    return Effect["void"];
  }
  const fiber = MutableHashMap.get(self.state.backing, key);
  if (fiber._tag === "None") {
    return Effect["void"];
  }
  // will be removed by the observer
  return Fiber.interruptAs(fiber.value, FiberId.combine(removeFiber.id(), FiberMap_internalFiberId));
}));
/**
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_clear = self => Effect.withFiberRuntime(clearFiber => {
  if (self.state._tag === "Closed") {
    return Effect["void"];
  }
  return Effect.forEach(self.state.backing, ([, fiber]) =>
  // will be removed by the observer
  Fiber.interruptAs(fiber, FiberId.combine(clearFiber.id(), FiberMap_internalFiberId)));
});
const FiberMap_constInterruptedFiber = /*#__PURE__*/function () {
  let fiber = undefined;
  return () => {
    if (fiber === undefined) {
      fiber = Effect.runFork(Effect.interrupt);
    }
    return fiber;
  };
}();
/**
 * Run an Effect and add the forked fiber to the FiberMap.
 * When the fiber completes, it will be removed from the FiberMap.
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_run = function () {
  const self = arguments[0];
  if (Effect.isEffect(arguments[2])) {
    return FiberMap_runImpl(self, arguments[1], arguments[2], arguments[3]);
  }
  const key = arguments[1];
  const options = arguments[2];
  return effect => FiberMap_runImpl(self, key, effect, options);
};
const FiberMap_runImpl = (self, key, effect, options) => Effect.withFiberRuntime(parent => {
  if (self.state._tag === "Closed") {
    return Effect.interrupt;
  } else if (options?.onlyIfMissing === true && unsafeHas(self, key)) {
    return Effect.sync(FiberMap_constInterruptedFiber);
  }
  const runtime = Runtime.make({
    context: parent.currentContext,
    fiberRefs: parent.getFiberRefs(),
    runtimeFlags: Runtime.defaultRuntime.runtimeFlags
  });
  const fiber = Runtime.runFork(runtime)(effect);
  FiberMap_unsafeSet(self, key, fiber, {
    ...options,
    interruptAs: parent.id()
  });
  return Effect.succeed(fiber);
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberMap.
 *
 * @example
 * ```ts
 * import { Context, Effect, FiberMap } from "effect"
 *
 * interface Users {
 *   readonly _: unique symbol
 * }
 * const Users = Context.GenericTag<Users, {
 *    getAll: Effect.Effect<Array<unknown>>
 * }>("Users")
 *
 * Effect.gen(function*() {
 *   const map = yield* FiberMap.make<string>()
 *   const run = yield* FiberMap.runtime(map)<Users>()
 *
 *   // run some effects and add the fibers to the map
 *   run("effect-a", Effect.andThen(Users, _ => _.getAll))
 *   run("effect-b", Effect.andThen(Users, _ => _.getAll))
 * }).pipe(
 *   Effect.scoped // The fibers will be interrupted when the scope is closed
 * )
 * ```
 *
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_runtime = self => () => Effect.map(Effect.runtime(), runtime => {
  const runFork = Runtime.runFork(runtime);
  return (key, effect, options) => {
    if (self.state._tag === "Closed") {
      return FiberMap_constInterruptedFiber();
    } else if (options?.onlyIfMissing === true && unsafeHas(self, key)) {
      return FiberMap_constInterruptedFiber();
    }
    const fiber = runFork(effect, options);
    FiberMap_unsafeSet(self, key, fiber, options);
    return fiber;
  };
});
/**
 * Capture a Runtime and use it to fork Effect's, adding the forked fibers to the FiberMap.
 *
 * @since 3.13.0
 * @categories combinators
 */
const FiberMap_runtimePromise = self => () => Effect.map(FiberMap_runtime(self)(), runFork => (key, effect, options) => new Promise((resolve, reject) => runFork(key, effect, options).addObserver(exit => {
  if (Exit.isSuccess(exit)) {
    resolve(exit.value);
  } else {
    reject(Cause.squash(exit.cause));
  }
})));
/**
 * @since 2.0.0
 * @categories combinators
 */
const FiberMap_size = self => Effect.sync(() => self.state._tag === "Closed" ? 0 : MutableHashMap.size(self.state.backing));
/**
 * Join all fibers in the FiberMap. If any of the Fiber's in the map terminate with a failure,
 * the returned Effect will terminate with the first failure that occurred.
 *
 * @since 2.0.0
 * @categories combinators
 * @example
 * ```ts
 * import { Effect, FiberMap } from "effect";
 *
 * Effect.gen(function* (_) {
 *   const map = yield* _(FiberMap.make());
 *   yield* _(FiberMap.set(map, "a", Effect.runFork(Effect.fail("error"))));
 *
 *   // parent fiber will fail with "error"
 *   yield* _(FiberMap.join(map));
 * });
 * ```
 */
const FiberMap_join = self => Deferred["await"](self.deferred);
/**
 * Wait for the FiberMap to be empty.
 *
 * @since 3.13.0
 * @categories combinators
 */
const FiberMap_awaitEmpty = self => Effect.whileLoop({
  while: () => self.state._tag === "Open" && MutableHashMap.size(self.state.backing) > 0,
  body: () => Fiber["await"](Iterable.unsafeHead(self)[1]),
  step: Function.constVoid
});
//# sourceMappingURL=FiberMap.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberRef.js
var FiberRef = __webpack_require__(68792);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberRefs.js
var FiberRefs = __webpack_require__(54247);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberRefsPatch.js
var FiberRefsPatch = __webpack_require__(79841);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberSet.js
var FiberSet = __webpack_require__(44893);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/FiberStatus.js + 1 modules
var FiberStatus = __webpack_require__(10622);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Hash.js
var Hash = __webpack_require__(39959);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Graph.js
/**
 * @experimental
 * @since 3.18.0
 */







/**
 * Unique identifier for Graph instances.
 *
 * @since 3.18.0
 * @category symbol
 */
const Graph_TypeId = "~effect/Graph";
/**
 * Edge data containing source, target, and user data.
 *
 * @since 3.18.0
 * @category models
 */
class Edge extends Data.Class {}
// =============================================================================
// Proto Objects
// =============================================================================
/** @internal */
const ProtoGraph = {
  [Graph_TypeId]: Graph_TypeId,
  [Symbol.iterator]() {
    return this.nodes[Symbol.iterator]();
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  [Equal.symbol](that) {
    if (isGraph(that)) {
      if (this.nodes.size !== that.nodes.size || this.edges.size !== that.edges.size || this.type !== that.type) {
        return false;
      }
      // Compare nodes
      for (const [nodeIndex, nodeData] of this.nodes) {
        if (!that.nodes.has(nodeIndex)) {
          return false;
        }
        const otherNodeData = that.nodes.get(nodeIndex);
        if (!Equal.equals(nodeData, otherNodeData)) {
          return false;
        }
      }
      // Compare edges
      for (const [edgeIndex, edgeData] of this.edges) {
        if (!that.edges.has(edgeIndex)) {
          return false;
        }
        const otherEdge = that.edges.get(edgeIndex);
        if (!Equal.equals(edgeData, otherEdge)) {
          return false;
        }
      }
      return true;
    }
    return false;
  },
  [Hash.symbol]() {
    let hash = Hash.string("Graph");
    hash = hash ^ Hash.string(this.type);
    hash = hash ^ Hash.number(this.nodes.size);
    hash = hash ^ Hash.number(this.edges.size);
    for (const [nodeIndex, nodeData] of this.nodes) {
      hash = hash ^ Hash.hash(nodeIndex) + Hash.hash(nodeData);
    }
    for (const [edgeIndex, edgeData] of this.edges) {
      hash = hash ^ Hash.hash(edgeIndex) + Hash.hash(edgeData);
    }
    return hash;
  },
  toJSON() {
    return {
      _id: "Graph",
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      type: this.type
    };
  },
  toString() {
    return (0,Inspectable.format)(this);
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
// =============================================================================
// Errors
// =============================================================================
/**
 * Error thrown when a graph operation fails.
 *
 * @since 3.18.0
 * @category errors
 */
class GraphError extends /*#__PURE__*/Data.TaggedError("GraphError") {}
/** @internal */
const missingNode = node => new GraphError({
  message: `Node ${node} does not exist`
});
// =============================================================================
// Constructors
// =============================================================================
/** @internal */
const isGraph = u => typeof u === "object" && u !== null && Graph_TypeId in u;
/**
 * Creates a directed graph, optionally with initial mutations.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Directed graph with initial nodes and edges
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 * ```
 *
 * @since 3.18.0
 * @category constructors
 */
const directed = mutate => {
  const graph = Object.create(ProtoGraph);
  graph.type = "directed";
  graph.nodes = new Map();
  graph.edges = new Map();
  graph.adjacency = new Map();
  graph.reverseAdjacency = new Map();
  graph.nextNodeIndex = 0;
  graph.nextEdgeIndex = 0;
  graph.isAcyclic = Option.some(true);
  graph.mutable = false;
  if (mutate) {
    const mutable = beginMutation(graph);
    mutate(mutable);
    return endMutation(mutable);
  }
  return graph;
};
/**
 * Creates an undirected graph, optionally with initial mutations.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Undirected graph with initial nodes and edges
 * const graph = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A-B")
 *   Graph.addEdge(mutable, b, c, "B-C")
 * })
 * ```
 *
 * @since 3.18.0
 * @category constructors
 */
const undirected = mutate => {
  const graph = Object.create(ProtoGraph);
  graph.type = "undirected";
  graph.nodes = new Map();
  graph.edges = new Map();
  graph.adjacency = new Map();
  graph.reverseAdjacency = new Map();
  graph.nextNodeIndex = 0;
  graph.nextEdgeIndex = 0;
  graph.isAcyclic = Option.some(true);
  graph.mutable = false;
  if (mutate) {
    const mutable = beginMutation(graph);
    mutate(mutable);
    return endMutation(mutable);
  }
  return graph;
};
// =============================================================================
// Scoped Mutable API
// =============================================================================
/**
 * Creates a mutable scope for safe graph mutations by copying the data structure.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const mutable = Graph.beginMutation(graph)
 * // Now mutable can be safely modified without affecting original graph
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const beginMutation = graph => {
  // Copy adjacency maps with deep cloned arrays
  const adjacency = new Map();
  const reverseAdjacency = new Map();
  for (const [nodeIndex, edges] of graph.adjacency) {
    adjacency.set(nodeIndex, [...edges]);
  }
  for (const [nodeIndex, edges] of graph.reverseAdjacency) {
    reverseAdjacency.set(nodeIndex, [...edges]);
  }
  const mutable = Object.create(ProtoGraph);
  mutable.type = graph.type;
  mutable.nodes = new Map(graph.nodes);
  mutable.edges = new Map(graph.edges);
  mutable.adjacency = adjacency;
  mutable.reverseAdjacency = reverseAdjacency;
  mutable.nextNodeIndex = graph.nextNodeIndex;
  mutable.nextEdgeIndex = graph.nextEdgeIndex;
  mutable.isAcyclic = graph.isAcyclic;
  mutable.mutable = true;
  return mutable;
};
/**
 * Converts a mutable graph back to an immutable graph, ending the mutation scope.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const mutable = Graph.beginMutation(graph)
 * // ... perform mutations on mutable ...
 * const newGraph = Graph.endMutation(mutable)
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const endMutation = mutable => {
  const graph = Object.create(ProtoGraph);
  graph.type = mutable.type;
  graph.nodes = new Map(mutable.nodes);
  graph.edges = new Map(mutable.edges);
  graph.adjacency = mutable.adjacency;
  graph.reverseAdjacency = mutable.reverseAdjacency;
  graph.nextNodeIndex = mutable.nextNodeIndex;
  graph.nextEdgeIndex = mutable.nextEdgeIndex;
  graph.isAcyclic = mutable.isAcyclic;
  graph.mutable = false;
  return graph;
};
/**
 * Performs scoped mutations on a graph, automatically managing the mutation lifecycle.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>()
 * const newGraph = Graph.mutate(graph, (mutable) => {
 *   // Safe mutations go here
 *   // mutable gets automatically converted back to immutable
 * })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const Graph_mutate = /*#__PURE__*/(0,Function.dual)(2, (graph, f) => {
  const mutable = beginMutation(graph);
  f(mutable);
  return endMutation(mutable);
});
// =============================================================================
// Basic Node Operations
// =============================================================================
/**
 * Adds a new node to a mutable graph and returns its index.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   console.log(nodeA) // NodeIndex with value 0
 *   console.log(nodeB) // NodeIndex with value 1
 * })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const addNode = (mutable, data) => {
  const nodeIndex = mutable.nextNodeIndex;
  // Add node data
  mutable.nodes.set(nodeIndex, data);
  // Initialize empty adjacency lists
  mutable.adjacency.set(nodeIndex, []);
  mutable.reverseAdjacency.set(nodeIndex, []);
  // Update graph allocators
  mutable.nextNodeIndex = mutable.nextNodeIndex + 1;
  return nodeIndex;
};
/**
 * Gets the data associated with a node index, if it exists.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 * })
 *
 * const nodeIndex = 0
 * const nodeData = Graph.getNode(graph, nodeIndex)
 *
 * if (Option.isSome(nodeData)) {
 *   console.log(nodeData.value) // "Node A"
 * }
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const getNode = (graph, nodeIndex) => graph.nodes.has(nodeIndex) ? Option.some(graph.nodes.get(nodeIndex)) : Option.none();
/**
 * Checks if a node with the given index exists in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 * })
 *
 * const nodeIndex = 0
 * const exists = Graph.hasNode(graph, nodeIndex)
 * console.log(exists) // true
 *
 * const nonExistentIndex = 999
 * const notExists = Graph.hasNode(graph, nonExistentIndex)
 * console.log(notExists) // false
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const hasNode = (graph, nodeIndex) => graph.nodes.has(nodeIndex);
/**
 * Returns the number of nodes in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const emptyGraph = Graph.directed<string, number>()
 * console.log(Graph.nodeCount(emptyGraph)) // 0
 *
 * const graphWithNodes = Graph.mutate(emptyGraph, (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 *   Graph.addNode(mutable, "Node B")
 *   Graph.addNode(mutable, "Node C")
 * })
 *
 * console.log(Graph.nodeCount(graphWithNodes)) // 3
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const Graph_nodeCount = graph => graph.nodes.size;
/**
 * Finds the first node that matches the given predicate.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Node A")
 *   Graph.addNode(mutable, "Node B")
 *   Graph.addNode(mutable, "Node C")
 * })
 *
 * const result = Graph.findNode(graph, (data) => data.startsWith("Node B"))
 * console.log(result) // Option.some(1)
 *
 * const notFound = Graph.findNode(graph, (data) => data === "Node D")
 * console.log(notFound) // Option.none()
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const findNode = (graph, predicate) => {
  for (const [index, data] of graph.nodes) {
    if (predicate(data)) {
      return Option.some(index);
    }
  }
  return Option.none();
};
/**
 * Finds all nodes that match the given predicate.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   Graph.addNode(mutable, "Start A")
 *   Graph.addNode(mutable, "Node B")
 *   Graph.addNode(mutable, "Start C")
 * })
 *
 * const result = Graph.findNodes(graph, (data) => data.startsWith("Start"))
 * console.log(result) // [0, 2]
 *
 * const empty = Graph.findNodes(graph, (data) => data === "Not Found")
 * console.log(empty) // []
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const findNodes = (graph, predicate) => {
  const results = [];
  for (const [index, data] of graph.nodes) {
    if (predicate(data)) {
      results.push(index);
    }
  }
  return results;
};
/**
 * Finds the first edge that matches the given predicate.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 10)
 *   Graph.addEdge(mutable, nodeB, nodeC, 20)
 * })
 *
 * const result = Graph.findEdge(graph, (data) => data > 15)
 * console.log(result) // Option.some(1)
 *
 * const notFound = Graph.findEdge(graph, (data) => data > 100)
 * console.log(notFound) // Option.none()
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const findEdge = (graph, predicate) => {
  for (const [edgeIndex, edgeData] of graph.edges) {
    if (predicate(edgeData.data, edgeData.source, edgeData.target)) {
      return Option.some(edgeIndex);
    }
  }
  return Option.none();
};
/**
 * Finds all edges that match the given predicate.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 10)
 *   Graph.addEdge(mutable, nodeB, nodeC, 20)
 *   Graph.addEdge(mutable, nodeC, nodeA, 30)
 * })
 *
 * const result = Graph.findEdges(graph, (data) => data >= 20)
 * console.log(result) // [1, 2]
 *
 * const empty = Graph.findEdges(graph, (data) => data > 100)
 * console.log(empty) // []
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const findEdges = (graph, predicate) => {
  const results = [];
  for (const [edgeIndex, edgeData] of graph.edges) {
    if (predicate(edgeData.data, edgeData.source, edgeData.target)) {
      results.push(edgeIndex);
    }
  }
  return results;
};
/**
 * Updates a single node's data by applying a transformation function.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   Graph.addNode(mutable, "Node A")
 *   Graph.addNode(mutable, "Node B")
 *   Graph.updateNode(mutable, 0, (data) => data.toUpperCase())
 * })
 *
 * const nodeData = Graph.getNode(graph, 0)
 * console.log(nodeData) // Option.some("NODE A")
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const Graph_updateNode = (mutable, index, f) => {
  if (!mutable.nodes.has(index)) {
    return;
  }
  const currentData = mutable.nodes.get(index);
  const newData = f(currentData);
  mutable.nodes.set(index, newData);
};
/**
 * Updates a single edge's data by applying a transformation function.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const edgeIndex = Graph.addEdge(mutable, nodeA, nodeB, 10)
 *   Graph.updateEdge(mutable, edgeIndex, (data) => data * 2)
 * })
 *
 * const edgeData = Graph.getEdge(result, 0)
 * console.log(edgeData) // Option.some({ source: 0, target: 1, data: 20 })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const updateEdge = (mutable, edgeIndex, f) => {
  if (!mutable.edges.has(edgeIndex)) {
    return;
  }
  const currentEdge = mutable.edges.get(edgeIndex);
  const newData = f(currentEdge.data);
  mutable.edges.set(edgeIndex, {
    ...currentEdge,
    data: newData
  });
};
/**
 * Creates a new graph with transformed node data using the provided mapping function.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   Graph.addNode(mutable, "node a")
 *   Graph.addNode(mutable, "node b")
 *   Graph.addNode(mutable, "node c")
 *   Graph.mapNodes(mutable, (data) => data.toUpperCase())
 * })
 *
 * const nodeData = Graph.getNode(graph, 0)
 * console.log(nodeData) // Option.some("NODE A")
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const mapNodes = (mutable, f) => {
  // Transform existing node data in place
  for (const [index, data] of mutable.nodes) {
    const newData = f(data);
    mutable.nodes.set(index, newData);
  }
};
/**
 * Transforms all edge data in a mutable graph using the provided mapping function.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 10)
 *   Graph.addEdge(mutable, b, c, 20)
 *   Graph.mapEdges(mutable, (data) => data * 2)
 * })
 *
 * const edgeData = Graph.getEdge(graph, 0)
 * console.log(edgeData) // Option.some({ source: 0, target: 1, data: 20 })
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const mapEdges = (mutable, f) => {
  // Transform existing edge data in place
  for (const [index, edgeData] of mutable.edges) {
    const newData = f(edgeData.data);
    mutable.edges.set(index, {
      ...edgeData,
      data: newData
    });
  }
};
/**
 * Reverses all edge directions in a mutable graph by swapping source and target nodes.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)  // A -> B
 *   Graph.addEdge(mutable, b, c, 2)  // B -> C
 *   Graph.reverse(mutable)           // Now B -> A, C -> B
 * })
 *
 * const edge0 = Graph.getEdge(graph, 0)
 * console.log(edge0) // Option.some({ source: 1, target: 0, data: 1 }) - B -> A
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const reverse = mutable => {
  // Reverse all edges by swapping source and target
  for (const [index, edgeData] of mutable.edges) {
    mutable.edges.set(index, {
      source: edgeData.target,
      target: edgeData.source,
      data: edgeData.data
    });
  }
  // Clear and rebuild adjacency lists with reversed directions
  mutable.adjacency.clear();
  mutable.reverseAdjacency.clear();
  // Rebuild adjacency lists with reversed directions
  for (const [edgeIndex, edgeData] of mutable.edges) {
    // Add to forward adjacency (source -> target)
    const sourceEdges = mutable.adjacency.get(edgeData.source) || [];
    sourceEdges.push(edgeIndex);
    mutable.adjacency.set(edgeData.source, sourceEdges);
    // Add to reverse adjacency (target <- source)
    const targetEdges = mutable.reverseAdjacency.get(edgeData.target) || [];
    targetEdges.push(edgeIndex);
    mutable.reverseAdjacency.set(edgeData.target, targetEdges);
  }
  // Invalidate cycle flag since edge directions changed
  mutable.isAcyclic = Option.none();
};
/**
 * Filters and optionally transforms nodes in a mutable graph using a predicate function.
 * Nodes that return Option.none are removed along with all their connected edges.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "active")
 *   const b = Graph.addNode(mutable, "inactive")
 *   const c = Graph.addNode(mutable, "active")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 2)
 *
 *   // Keep only "active" nodes and transform to uppercase
 *   Graph.filterMapNodes(mutable, (data) =>
 *     data === "active" ? Option.some(data.toUpperCase()) : Option.none()
 *   )
 * })
 *
 * console.log(Graph.nodeCount(graph)) // 2 (only "active" nodes remain)
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const filterMapNodes = (mutable, f) => {
  const nodesToRemove = [];
  // First pass: identify nodes to remove and transform data for nodes to keep
  for (const [index, data] of mutable.nodes) {
    const result = f(data);
    if (Option.isSome(result)) {
      // Transform node data
      mutable.nodes.set(index, result.value);
    } else {
      // Mark for removal
      nodesToRemove.push(index);
    }
  }
  // Second pass: remove filtered out nodes and their edges
  for (const nodeIndex of nodesToRemove) {
    Graph_removeNode(mutable, nodeIndex);
  }
};
/**
 * Filters and optionally transforms edges in a mutable graph using a predicate function.
 * Edges that return Option.none are removed from the graph.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 5)
 *   Graph.addEdge(mutable, b, c, 15)
 *   Graph.addEdge(mutable, c, a, 25)
 *
 *   // Keep only edges with weight >= 10 and double their weight
 *   Graph.filterMapEdges(mutable, (data) =>
 *     data >= 10 ? Option.some(data * 2) : Option.none()
 *   )
 * })
 *
 * console.log(Graph.edgeCount(graph)) // 2 (edges with weight 5 removed)
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const filterMapEdges = (mutable, f) => {
  const edgesToRemove = [];
  // First pass: identify edges to remove and transform data for edges to keep
  for (const [index, edgeData] of mutable.edges) {
    const result = f(edgeData.data);
    if (Option.isSome(result)) {
      // Transform edge data
      mutable.edges.set(index, {
        ...edgeData,
        data: result.value
      });
    } else {
      // Mark for removal
      edgesToRemove.push(index);
    }
  }
  // Second pass: remove filtered out edges
  for (const edgeIndex of edgesToRemove) {
    removeEdge(mutable, edgeIndex);
  }
};
/**
 * Filters nodes by removing those that don't match the predicate.
 * This function modifies the mutable graph in place.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   Graph.addNode(mutable, "active")
 *   Graph.addNode(mutable, "inactive")
 *   Graph.addNode(mutable, "pending")
 *   Graph.addNode(mutable, "active")
 *
 *   // Keep only "active" nodes
 *   Graph.filterNodes(mutable, (data) => data === "active")
 * })
 *
 * console.log(Graph.nodeCount(graph)) // 2 (only "active" nodes remain)
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const filterNodes = (mutable, predicate) => {
  const nodesToRemove = [];
  // Identify nodes to remove
  for (const [index, data] of mutable.nodes) {
    if (!predicate(data)) {
      nodesToRemove.push(index);
    }
  }
  // Remove filtered out nodes (this also removes connected edges)
  for (const nodeIndex of nodesToRemove) {
    Graph_removeNode(mutable, nodeIndex);
  }
};
/**
 * Filters edges by removing those that don't match the predicate.
 * This function modifies the mutable graph in place.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *
 *   Graph.addEdge(mutable, a, b, 5)
 *   Graph.addEdge(mutable, b, c, 15)
 *   Graph.addEdge(mutable, c, a, 25)
 *
 *   // Keep only edges with weight >= 10
 *   Graph.filterEdges(mutable, (data) => data >= 10)
 * })
 *
 * console.log(Graph.edgeCount(graph)) // 2 (edge with weight 5 removed)
 * ```
 *
 * @since 3.18.0
 * @category transformations
 */
const filterEdges = (mutable, predicate) => {
  const edgesToRemove = [];
  // Identify edges to remove
  for (const [index, edgeData] of mutable.edges) {
    if (!predicate(edgeData.data)) {
      edgesToRemove.push(index);
    }
  }
  // Remove filtered out edges
  for (const edgeIndex of edgesToRemove) {
    removeEdge(mutable, edgeIndex);
  }
};
// =============================================================================
// Cycle Flag Management (Internal)
// =============================================================================
/** @internal */
const invalidateCycleFlagOnRemoval = mutable => {
  // Only invalidate if the graph had cycles (removing edges/nodes cannot introduce cycles in acyclic graphs)
  // If already unknown (null) or acyclic (true), no need to change
  if (Option.isSome(mutable.isAcyclic) && mutable.isAcyclic.value === false) {
    mutable.isAcyclic = Option.none();
  }
};
/** @internal */
const invalidateCycleFlagOnAddition = mutable => {
  // Only invalidate if the graph was acyclic (adding edges cannot remove cycles from cyclic graphs)
  // If already unknown (null) or cyclic (false), no need to change
  if (Option.isSome(mutable.isAcyclic) && mutable.isAcyclic.value === true) {
    mutable.isAcyclic = Option.none();
  }
};
// =============================================================================
// Edge Operations
// =============================================================================
/**
 * Adds a new edge to a mutable graph and returns its index.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const edge = Graph.addEdge(mutable, nodeA, nodeB, 42)
 *   console.log(edge) // EdgeIndex with value 0
 * })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const addEdge = (mutable, source, target, data) => {
  // Validate that both nodes exist
  if (!mutable.nodes.has(source)) {
    throw missingNode(source);
  }
  if (!mutable.nodes.has(target)) {
    throw missingNode(target);
  }
  const edgeIndex = mutable.nextEdgeIndex;
  // Create edge data
  const edgeData = new Edge({
    source,
    target,
    data
  });
  mutable.edges.set(edgeIndex, edgeData);
  // Update adjacency lists
  const sourceAdjacency = mutable.adjacency.get(source);
  if (sourceAdjacency !== undefined) {
    sourceAdjacency.push(edgeIndex);
  }
  const targetReverseAdjacency = mutable.reverseAdjacency.get(target);
  if (targetReverseAdjacency !== undefined) {
    targetReverseAdjacency.push(edgeIndex);
  }
  // For undirected graphs, add reverse connections
  if (mutable.type === "undirected") {
    const targetAdjacency = mutable.adjacency.get(target);
    if (targetAdjacency !== undefined) {
      targetAdjacency.push(edgeIndex);
    }
    const sourceReverseAdjacency = mutable.reverseAdjacency.get(source);
    if (sourceReverseAdjacency !== undefined) {
      sourceReverseAdjacency.push(edgeIndex);
    }
  }
  // Update allocators
  mutable.nextEdgeIndex = mutable.nextEdgeIndex + 1;
  // Only invalidate cycle flag if the graph was acyclic
  // Adding edges cannot remove cycles from cyclic graphs
  invalidateCycleFlagOnAddition(mutable);
  return edgeIndex;
};
/**
 * Removes a node and all its incident edges from a mutable graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 *
 *   // Remove nodeA and all edges connected to it
 *   Graph.removeNode(mutable, nodeA)
 * })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const Graph_removeNode = (mutable, nodeIndex) => {
  // Check if node exists
  if (!mutable.nodes.has(nodeIndex)) {
    return; // Node doesn't exist, nothing to remove
  }
  // Collect all incident edges for removal
  const edgesToRemove = [];
  // Get outgoing edges
  const outgoingEdges = mutable.adjacency.get(nodeIndex);
  if (outgoingEdges !== undefined) {
    for (const edge of outgoingEdges) {
      edgesToRemove.push(edge);
    }
  }
  // Get incoming edges
  const incomingEdges = mutable.reverseAdjacency.get(nodeIndex);
  if (incomingEdges !== undefined) {
    for (const edge of incomingEdges) {
      edgesToRemove.push(edge);
    }
  }
  // Remove all incident edges
  for (const edgeIndex of edgesToRemove) {
    removeEdgeInternal(mutable, edgeIndex);
  }
  // Remove the node itself
  mutable.nodes.delete(nodeIndex);
  mutable.adjacency.delete(nodeIndex);
  mutable.reverseAdjacency.delete(nodeIndex);
  // Only invalidate cycle flag if the graph wasn't already known to be acyclic
  // Removing nodes cannot introduce cycles in an acyclic graph
  invalidateCycleFlagOnRemoval(mutable);
};
/**
 * Removes an edge from a mutable graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const result = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const edge = Graph.addEdge(mutable, nodeA, nodeB, 42)
 *
 *   // Remove the edge
 *   Graph.removeEdge(mutable, edge)
 * })
 * ```
 *
 * @since 3.18.0
 * @category mutations
 */
const removeEdge = (mutable, edgeIndex) => {
  const wasRemoved = removeEdgeInternal(mutable, edgeIndex);
  // Only invalidate cycle flag if an edge was actually removed
  // and only if the graph wasn't already known to be acyclic
  if (wasRemoved) {
    invalidateCycleFlagOnRemoval(mutable);
  }
};
/** @internal */
const removeEdgeInternal = (mutable, edgeIndex) => {
  // Get edge data
  const edge = mutable.edges.get(edgeIndex);
  if (edge === undefined) {
    return false; // Edge doesn't exist, no mutation occurred
  }
  const {
    source,
    target
  } = edge;
  // Remove from adjacency lists
  const sourceAdjacency = mutable.adjacency.get(source);
  if (sourceAdjacency !== undefined) {
    const index = sourceAdjacency.indexOf(edgeIndex);
    if (index !== -1) {
      sourceAdjacency.splice(index, 1);
    }
  }
  const targetReverseAdjacency = mutable.reverseAdjacency.get(target);
  if (targetReverseAdjacency !== undefined) {
    const index = targetReverseAdjacency.indexOf(edgeIndex);
    if (index !== -1) {
      targetReverseAdjacency.splice(index, 1);
    }
  }
  // For undirected graphs, remove reverse connections
  if (mutable.type === "undirected") {
    const targetAdjacency = mutable.adjacency.get(target);
    if (targetAdjacency !== undefined) {
      const index = targetAdjacency.indexOf(edgeIndex);
      if (index !== -1) {
        targetAdjacency.splice(index, 1);
      }
    }
    const sourceReverseAdjacency = mutable.reverseAdjacency.get(source);
    if (sourceReverseAdjacency !== undefined) {
      const index = sourceReverseAdjacency.indexOf(edgeIndex);
      if (index !== -1) {
        sourceReverseAdjacency.splice(index, 1);
      }
    }
  }
  // Remove edge data
  mutable.edges.delete(edgeIndex);
  return true; // Edge was successfully removed
};
// =============================================================================
// Edge Query Operations
// =============================================================================
/**
 * Gets the edge data associated with an edge index, if it exists.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 * })
 *
 * const edgeIndex = 0
 * const edgeData = Graph.getEdge(graph, edgeIndex)
 *
 * if (Option.isSome(edgeData)) {
 *   console.log(edgeData.value.data) // 42
 *   console.log(edgeData.value.source) // NodeIndex(0)
 *   console.log(edgeData.value.target) // NodeIndex(1)
 * }
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const getEdge = (graph, edgeIndex) => graph.edges.has(edgeIndex) ? Option.some(graph.edges.get(edgeIndex)) : Option.none();
/**
 * Checks if an edge exists between two nodes in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 42)
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 * const nodeC = 2
 *
 * const hasAB = Graph.hasEdge(graph, nodeA, nodeB)
 * console.log(hasAB) // true
 *
 * const hasAC = Graph.hasEdge(graph, nodeA, nodeC)
 * console.log(hasAC) // false
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const hasEdge = (graph, source, target) => {
  const adjacencyList = graph.adjacency.get(source);
  if (adjacencyList === undefined) {
    return false;
  }
  // Check if any edge in the adjacency list connects to the target
  for (const edgeIndex of adjacencyList) {
    const edge = graph.edges.get(edgeIndex);
    if (edge !== undefined && edge.target === target) {
      return true;
    }
  }
  return false;
};
/**
 * Returns the number of edges in the graph.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const emptyGraph = Graph.directed<string, number>()
 * console.log(Graph.edgeCount(emptyGraph)) // 0
 *
 * const graphWithEdges = Graph.mutate(emptyGraph, (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeB, nodeC, 2)
 *   Graph.addEdge(mutable, nodeC, nodeA, 3)
 * })
 *
 * console.log(Graph.edgeCount(graphWithEdges)) // 3
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const edgeCount = graph => graph.edges.size;
/**
 * Returns the neighboring nodes (targets of outgoing edges) for a given node.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeA, nodeC, 2)
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 * const nodeC = 2
 *
 * const neighborsA = Graph.neighbors(graph, nodeA)
 * console.log(neighborsA) // [NodeIndex(1), NodeIndex(2)]
 *
 * const neighborsB = Graph.neighbors(graph, nodeB)
 * console.log(neighborsB) // []
 * ```
 *
 * @since 3.18.0
 * @category getters
 */
const Graph_neighbors = (graph, nodeIndex) => {
  // For undirected graphs, use the specialized helper that returns the other endpoint
  if (graph.type === "undirected") {
    return getUndirectedNeighbors(graph, nodeIndex);
  }
  const adjacencyList = graph.adjacency.get(nodeIndex);
  if (adjacencyList === undefined) {
    return [];
  }
  const result = [];
  for (const edgeIndex of adjacencyList) {
    const edge = graph.edges.get(edgeIndex);
    if (edge !== undefined) {
      result.push(edge.target);
    }
  }
  return result;
};
/**
 * Get neighbors of a node in a specific direction for bidirectional traversal.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, "A->B")
 * })
 *
 * const nodeA = 0
 * const nodeB = 1
 *
 * // Get outgoing neighbors (nodes that nodeA points to)
 * const outgoing = Graph.neighborsDirected(graph, nodeA, "outgoing")
 *
 * // Get incoming neighbors (nodes that point to nodeB)
 * const incoming = Graph.neighborsDirected(graph, nodeB, "incoming")
 * ```
 *
 * @since 3.18.0
 * @category queries
 */
const neighborsDirected = (graph, nodeIndex, direction) => {
  const adjacencyMap = direction === "incoming" ? graph.reverseAdjacency : graph.adjacency;
  const adjacencyList = adjacencyMap.get(nodeIndex);
  if (adjacencyList === undefined) {
    return [];
  }
  const result = [];
  for (const edgeIndex of adjacencyList) {
    const edge = graph.edges.get(edgeIndex);
    if (edge !== undefined) {
      // For incoming direction, we want the source node instead of target
      const neighborNode = direction === "incoming" ? edge.source : edge.target;
      result.push(neighborNode);
    }
  }
  return result;
};
/**
 * Exports a graph to GraphViz DOT format for visualization.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const nodeA = Graph.addNode(mutable, "Node A")
 *   const nodeB = Graph.addNode(mutable, "Node B")
 *   const nodeC = Graph.addNode(mutable, "Node C")
 *   Graph.addEdge(mutable, nodeA, nodeB, 1)
 *   Graph.addEdge(mutable, nodeB, nodeC, 2)
 *   Graph.addEdge(mutable, nodeC, nodeA, 3)
 * })
 *
 * const dot = Graph.toGraphViz(graph)
 * console.log(dot)
 * // digraph G {
 * //   "0" [label="Node A"];
 * //   "1" [label="Node B"];
 * //   "2" [label="Node C"];
 * //   "0" -> "1" [label="1"];
 * //   "1" -> "2" [label="2"];
 * //   "2" -> "0" [label="3"];
 * // }
 * ```
 *
 * @since 3.18.0
 * @category utils
 */
const toGraphViz = (graph, options) => {
  const {
    edgeLabel = data => String(data),
    graphName = "G",
    nodeLabel = data => String(data)
  } = options ?? {};
  const isDirected = graph.type === "directed";
  const graphType = isDirected ? "digraph" : "graph";
  const edgeOperator = isDirected ? "->" : "--";
  const lines = [];
  lines.push(`${graphType} ${graphName} {`);
  // Add nodes
  for (const [nodeIndex, nodeData] of graph.nodes) {
    const label = nodeLabel(nodeData).replace(/"/g, "\\\"");
    lines.push(`  "${nodeIndex}" [label="${label}"];`);
  }
  // Add edges
  for (const [, edgeData] of graph.edges) {
    const label = edgeLabel(edgeData.data).replace(/"/g, "\\\"");
    lines.push(`  "${edgeData.source}" ${edgeOperator} "${edgeData.target}" [label="${label}"];`);
  }
  lines.push("}");
  return lines.join("\n");
};
/** @internal */
const escapeMermaidLabel = label => {
  // Escape special characters for Mermaid using HTML entity codes
  // According to: https://mermaid.js.org/syntax/flowchart.html#special-characters-that-break-syntax
  return label.replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/&/g, "#amp;").replace(/\[/g, "#91;").replace(/\]/g, "#93;").replace(/\{/g, "#123;").replace(/\}/g, "#125;").replace(/\(/g, "#40;").replace(/\)/g, "#41;").replace(/\|/g, "#124;").replace(/\\/g, "#92;").replace(/\n/g, "<br/>");
};
/** @internal */
const formatMermaidNode = (nodeId, label, shape) => {
  switch (shape) {
    case "rectangle":
      return `${nodeId}["${label}"]`;
    case "rounded":
      return `${nodeId}("${label}")`;
    case "circle":
      return `${nodeId}(("${label}"))`;
    case "diamond":
      return `${nodeId}{"${label}"}`;
    case "hexagon":
      return `${nodeId}{{"${label}"}}`;
    case "stadium":
      return `${nodeId}(["${label}"])`;
    case "subroutine":
      return `${nodeId}[["${label}"]]`;
    case "cylindrical":
      return `${nodeId}[("${label}")]`;
  }
};
/**
 * Exports a graph to Mermaid diagram format for visualization.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.mutate(Graph.directed<string, number>(), (mutable) => {
 *   const app = Graph.addNode(mutable, "App")
 *   const db = Graph.addNode(mutable, "Database")
 *   const cache = Graph.addNode(mutable, "Cache")
 *   Graph.addEdge(mutable, app, db, 1)
 *   Graph.addEdge(mutable, app, cache, 2)
 * })
 *
 * const mermaid = Graph.toMermaid(graph)
 * console.log(mermaid)
 * // flowchart TD
 * //   0["App"]
 * //   1["Database"]
 * //   2["Cache"]
 * //   0 -->|"1"| 1
 * //   0 -->|"2"| 2
 * ```
 *
 * @since 3.18.0
 * @category utils
 */
const toMermaid = (graph, options) => {
  // Extract and validate options with defaults
  const {
    diagramType,
    direction = "TD",
    edgeLabel = data => String(data),
    nodeLabel = data => String(data),
    nodeShape = () => "rectangle"
  } = options ?? {};
  // Auto-detect diagram type if not specified
  const finalDiagramType = diagramType ?? (graph.type === "directed" ? "flowchart" : "graph");
  // Generate diagram header
  const lines = [];
  lines.push(`${finalDiagramType} ${direction}`);
  // Add nodes
  for (const [nodeIndex, nodeData] of graph.nodes) {
    const nodeId = String(nodeIndex);
    const label = escapeMermaidLabel(nodeLabel(nodeData));
    const shape = nodeShape(nodeData);
    const formattedNode = formatMermaidNode(nodeId, label, shape);
    lines.push(`  ${formattedNode}`);
  }
  // Add edges
  const edgeOperator = finalDiagramType === "flowchart" ? "-->" : "---";
  for (const [, edgeData] of graph.edges) {
    const sourceId = String(edgeData.source);
    const targetId = String(edgeData.target);
    const label = escapeMermaidLabel(edgeLabel(edgeData.data));
    if (label) {
      lines.push(`  ${sourceId} ${edgeOperator}|"${label}"| ${targetId}`);
    } else {
      lines.push(`  ${sourceId} ${edgeOperator} ${targetId}`);
    }
  }
  return lines.join("\n");
};
// =============================================================================
// =============================================================================
// Graph Structure Analysis Algorithms (Phase 5A)
// =============================================================================
/**
 * Checks if the graph is acyclic (contains no cycles).
 *
 * Uses depth-first search to detect back edges, which indicate cycles.
 * For directed graphs, any back edge creates a cycle. For undirected graphs,
 * a back edge that doesn't go to the immediate parent creates a cycle.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Acyclic directed graph (DAG)
 * const dag = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 * })
 * console.log(Graph.isAcyclic(dag)) // true
 *
 * // Cyclic directed graph
 * const cyclic = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, a, "B->A") // Creates cycle
 * })
 * console.log(Graph.isAcyclic(cyclic)) // false
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const isAcyclic = graph => {
  // Use existing cycle flag if available
  if (Option.isSome(graph.isAcyclic)) {
    return graph.isAcyclic.value;
  }
  // Stack-safe DFS cycle detection using iterative approach
  const visited = new Set();
  const recursionStack = new Set();
  // Get all nodes to handle disconnected components
  for (const startNode of graph.nodes.keys()) {
    if (visited.has(startNode)) {
      continue; // Already processed this component
    }
    // Iterative DFS with explicit stack
    const stack = [[startNode, [], 0, true]];
    while (stack.length > 0) {
      const [node, neighbors, neighborIndex, isFirstVisit] = stack[stack.length - 1];
      // First visit to this node
      if (isFirstVisit) {
        if (recursionStack.has(node)) {
          // Back edge found - cycle detected
          graph.isAcyclic = Option.some(false);
          return false;
        }
        if (visited.has(node)) {
          stack.pop();
          continue;
        }
        visited.add(node);
        recursionStack.add(node);
        // Get neighbors for this node
        const nodeNeighbors = Array.from(neighborsDirected(graph, node, "outgoing"));
        stack[stack.length - 1] = [node, nodeNeighbors, 0, false];
        continue;
      }
      // Process next neighbor
      if (neighborIndex < neighbors.length) {
        const neighbor = neighbors[neighborIndex];
        stack[stack.length - 1] = [node, neighbors, neighborIndex + 1, false];
        if (recursionStack.has(neighbor)) {
          // Back edge found - cycle detected
          graph.isAcyclic = Option.some(false);
          return false;
        }
        if (!visited.has(neighbor)) {
          stack.push([neighbor, [], 0, true]);
        }
      } else {
        // Done with this node - backtrack
        recursionStack.delete(node);
        stack.pop();
      }
    }
  }
  // Cache the result
  graph.isAcyclic = Option.some(true);
  return true;
};
/**
 * Checks if an undirected graph is bipartite.
 *
 * A bipartite graph is one whose vertices can be divided into two disjoint sets
 * such that no two vertices within the same set are adjacent. Uses BFS coloring
 * to determine bipartiteness.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * // Bipartite graph (alternating coloring possible)
 * const bipartite = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   const d = Graph.addNode(mutable, "D")
 *   Graph.addEdge(mutable, a, b, "edge") // Set 1: {A, C}, Set 2: {B, D}
 *   Graph.addEdge(mutable, b, c, "edge")
 *   Graph.addEdge(mutable, c, d, "edge")
 * })
 * console.log(Graph.isBipartite(bipartite)) // true
 *
 * // Non-bipartite graph (odd cycle)
 * const triangle = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "edge")
 *   Graph.addEdge(mutable, b, c, "edge")
 *   Graph.addEdge(mutable, c, a, "edge") // Triangle (3-cycle)
 * })
 * console.log(Graph.isBipartite(triangle)) // false
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const isBipartite = graph => {
  const coloring = new Map();
  const discovered = new Set();
  let isBipartiteGraph = true;
  // Get all nodes to handle disconnected components
  for (const startNode of graph.nodes.keys()) {
    if (!discovered.has(startNode)) {
      // Start BFS coloring from this component
      const queue = [startNode];
      coloring.set(startNode, 0); // Color start node with 0
      discovered.add(startNode);
      while (queue.length > 0 && isBipartiteGraph) {
        const current = queue.shift();
        const currentColor = coloring.get(current);
        const neighborColor = currentColor === 0 ? 1 : 0;
        // Get all neighbors for undirected graph
        const nodeNeighbors = getUndirectedNeighbors(graph, current);
        for (const neighbor of nodeNeighbors) {
          if (!discovered.has(neighbor)) {
            // Color unvisited neighbor with opposite color
            coloring.set(neighbor, neighborColor);
            discovered.add(neighbor);
            queue.push(neighbor);
          } else {
            // Check if neighbor has the same color (conflict)
            if (coloring.get(neighbor) === currentColor) {
              isBipartiteGraph = false;
              break;
            }
          }
        }
      }
      // Early exit if not bipartite
      if (!isBipartiteGraph) {
        break;
      }
    }
  }
  return isBipartiteGraph;
};
/**
 * Get neighbors for undirected graphs by checking both adjacency and reverse adjacency.
 * For undirected graphs, we need to find the other endpoint of each edge incident to the node.
 */
const getUndirectedNeighbors = (graph, nodeIndex) => {
  const neighbors = new Set();
  // Check edges where this node is the source
  const adjacencyList = graph.adjacency.get(nodeIndex);
  if (adjacencyList !== undefined) {
    for (const edgeIndex of adjacencyList) {
      const edge = graph.edges.get(edgeIndex);
      if (edge !== undefined) {
        // For undirected graphs, the neighbor is the other endpoint
        const otherNode = edge.source === nodeIndex ? edge.target : edge.source;
        neighbors.add(otherNode);
      }
    }
  }
  return Array.from(neighbors);
};
/**
 * Find connected components in an undirected graph.
 * Each component is represented as an array of node indices.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.undirected<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   const d = Graph.addNode(mutable, "D")
 *   Graph.addEdge(mutable, a, b, "edge") // Component 1: A-B
 *   Graph.addEdge(mutable, c, d, "edge") // Component 2: C-D
 * })
 *
 * const components = Graph.connectedComponents(graph)
 * console.log(components) // [[0, 1], [2, 3]]
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const connectedComponents = graph => {
  const visited = new Set();
  const components = [];
  for (const startNode of graph.nodes.keys()) {
    if (!visited.has(startNode)) {
      // DFS to find all nodes in this component
      const component = [];
      const stack = [startNode];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!visited.has(current)) {
          visited.add(current);
          component.push(current);
          // Add all unvisited neighbors to stack
          const nodeNeighbors = getUndirectedNeighbors(graph, current);
          for (const neighbor of nodeNeighbors) {
            if (!visited.has(neighbor)) {
              stack.push(neighbor);
            }
          }
        }
      }
      components.push(component);
    }
  }
  return components;
};
/**
 * Find strongly connected components in a directed graph using Kosaraju's algorithm.
 * Each SCC is represented as an array of node indices.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, "A->B")
 *   Graph.addEdge(mutable, b, c, "B->C")
 *   Graph.addEdge(mutable, c, a, "C->A") // Creates SCC: A-B-C
 * })
 *
 * const sccs = Graph.stronglyConnectedComponents(graph)
 * console.log(sccs) // [[0, 1, 2]]
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const stronglyConnectedComponents = graph => {
  const visited = new Set();
  const finishOrder = [];
  for (const startNode of graph.nodes.keys()) {
    if (visited.has(startNode)) {
      continue;
    }
    const stack = [[startNode, [], 0, true]];
    while (stack.length > 0) {
      const [node, nodeNeighbors, neighborIndex, isFirstVisit] = stack[stack.length - 1];
      if (isFirstVisit) {
        if (visited.has(node)) {
          stack.pop();
          continue;
        }
        visited.add(node);
        const nodeNeighborsList = Graph_neighbors(graph, node);
        stack[stack.length - 1] = [node, nodeNeighborsList, 0, false];
        continue;
      }
      // Process next neighbor
      if (neighborIndex < nodeNeighbors.length) {
        const neighbor = nodeNeighbors[neighborIndex];
        stack[stack.length - 1] = [node, nodeNeighbors, neighborIndex + 1, false];
        if (!visited.has(neighbor)) {
          stack.push([neighbor, [], 0, true]);
        }
      } else {
        // Done with this node - add to finish order (post-order)
        finishOrder.push(node);
        stack.pop();
      }
    }
  }
  // Step 2: Stack-safe DFS on transpose graph in reverse finish order
  visited.clear();
  const sccs = [];
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const startNode = finishOrder[i];
    if (visited.has(startNode)) {
      continue;
    }
    const scc = [];
    const stack = [startNode];
    while (stack.length > 0) {
      const node = stack.pop();
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);
      scc.push(node);
      // Use reverse adjacency (transpose graph)
      const reverseAdjacency = graph.reverseAdjacency.get(node);
      if (reverseAdjacency !== undefined) {
        for (const edgeIndex of reverseAdjacency) {
          const edge = graph.edges.get(edgeIndex);
          if (edge !== undefined) {
            const predecessor = edge.source;
            if (!visited.has(predecessor)) {
              stack.push(predecessor);
            }
          }
        }
      }
    }
    sccs.push(scc);
  }
  return sccs;
};
/**
 * Find the shortest path between two nodes using Dijkstra's algorithm.
 *
 * Dijkstra's algorithm works with non-negative edge weights and finds the shortest
 * path from a source node to a target node in O((V + E) log V) time complexity.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 5)
 *   Graph.addEdge(mutable, a, c, 10)
 *   Graph.addEdge(mutable, b, c, 2)
 * })
 *
 * const result = Graph.dijkstra(graph, { source: 0, target: 2, cost: (edgeData) => edgeData })
 * if (Option.isSome(result)) {
 *   console.log(result.value.path) // [0, 1, 2] - shortest path A->B->C
 *   console.log(result.value.distance) // 7 - total distance
 * }
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const dijkstra = (graph, config) => {
  const {
    cost,
    source,
    target
  } = config;
  // Validate that source and target nodes exist
  if (!graph.nodes.has(source)) {
    throw missingNode(source);
  }
  if (!graph.nodes.has(target)) {
    throw missingNode(target);
  }
  // Early return if source equals target
  if (source === target) {
    return Option.some({
      path: [source],
      distance: 0,
      costs: []
    });
  }
  // Distance tracking and priority queue simulation
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  // Initialize distances
  // Iterate directly over node keys
  for (const node of graph.nodes.keys()) {
    distances.set(node, node === source ? 0 : Infinity);
    previous.set(node, null);
  }
  // Simple priority queue using array (can be optimized with proper heap)
  const priorityQueue = [{
    node: source,
    distance: 0
  }];
  while (priorityQueue.length > 0) {
    // Find minimum distance node (priority queue extract-min)
    let minIndex = 0;
    for (let i = 1; i < priorityQueue.length; i++) {
      if (priorityQueue[i].distance < priorityQueue[minIndex].distance) {
        minIndex = i;
      }
    }
    const current = priorityQueue.splice(minIndex, 1)[0];
    const currentNode = current.node;
    // Skip if already visited (can happen with duplicate entries)
    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);
    // Early termination if we reached the target
    if (currentNode === target) {
      break;
    }
    // Get current distance
    const currentDistance = distances.get(currentNode);
    // Examine all outgoing edges
    const adjacencyList = graph.adjacency.get(currentNode);
    if (adjacencyList !== undefined) {
      for (const edgeIndex of adjacencyList) {
        const edge = graph.edges.get(edgeIndex);
        if (edge !== undefined) {
          const neighbor = edge.target;
          const weight = cost(edge.data);
          // Validate non-negative weights
          if (weight < 0) {
            throw new Error(`Dijkstra's algorithm requires non-negative edge weights, found ${weight}`);
          }
          const newDistance = currentDistance + weight;
          const neighborDistance = distances.get(neighbor);
          // Relaxation step
          if (newDistance < neighborDistance) {
            distances.set(neighbor, newDistance);
            previous.set(neighbor, {
              node: currentNode,
              edgeData: edge.data
            });
            // Add to priority queue if not visited
            if (!visited.has(neighbor)) {
              priorityQueue.push({
                node: neighbor,
                distance: newDistance
              });
            }
          }
        }
      }
    }
  }
  // Check if target is reachable
  const targetDistance = distances.get(target);
  if (targetDistance === Infinity) {
    return Option.none(); // No path exists
  }
  // Reconstruct path
  const path = [];
  const costs = [];
  let currentNode = target;
  while (currentNode !== null) {
    path.unshift(currentNode);
    const prev = previous.get(currentNode);
    if (prev !== null) {
      costs.unshift(prev.edgeData);
      currentNode = prev.node;
    } else {
      currentNode = null;
    }
  }
  return Option.some({
    path,
    distance: targetDistance,
    costs
  });
};
/**
 * Find shortest paths between all pairs of nodes using Floyd-Warshall algorithm.
 *
 * Floyd-Warshall algorithm computes shortest paths between all pairs of nodes in O(V³) time.
 * It can handle negative edge weights and detect negative cycles.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 3)
 *   Graph.addEdge(mutable, b, c, 2)
 *   Graph.addEdge(mutable, a, c, 7)
 * })
 *
 * const result = Graph.floydWarshall(graph, (edgeData) => edgeData)
 * const distanceAToC = result.distances.get(0)?.get(2) // 5 (A->B->C)
 * const pathAToC = result.paths.get(0)?.get(2) // [0, 1, 2]
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const floydWarshall = (graph, cost) => {
  // Get all nodes for Floyd-Warshall algorithm (needs array for nested iteration)
  const allNodes = Array.from(graph.nodes.keys());
  // Initialize distance matrix
  const dist = new Map();
  const next = new Map();
  const edgeMatrix = new Map();
  // Initialize with infinity for all pairs
  for (const i of allNodes) {
    dist.set(i, new Map());
    next.set(i, new Map());
    edgeMatrix.set(i, new Map());
    for (const j of allNodes) {
      dist.get(i).set(j, i === j ? 0 : Infinity);
      next.get(i).set(j, null);
      edgeMatrix.get(i).set(j, null);
    }
  }
  // Set edge weights
  for (const [, edgeData] of graph.edges) {
    const weight = cost(edgeData.data);
    const i = edgeData.source;
    const j = edgeData.target;
    // Use minimum weight if multiple edges exist
    const currentWeight = dist.get(i).get(j);
    if (weight < currentWeight) {
      dist.get(i).set(j, weight);
      next.get(i).set(j, j);
      edgeMatrix.get(i).set(j, edgeData.data);
    }
  }
  // Floyd-Warshall main loop
  for (const k of allNodes) {
    for (const i of allNodes) {
      for (const j of allNodes) {
        const distIK = dist.get(i).get(k);
        const distKJ = dist.get(k).get(j);
        const distIJ = dist.get(i).get(j);
        if (distIK !== Infinity && distKJ !== Infinity && distIK + distKJ < distIJ) {
          dist.get(i).set(j, distIK + distKJ);
          next.get(i).set(j, next.get(i).get(k));
        }
      }
    }
  }
  // Check for negative cycles
  for (const i of allNodes) {
    if (dist.get(i).get(i) < 0) {
      throw new Error(`Negative cycle detected involving node ${i}`);
    }
  }
  // Build result paths and edge weights
  const paths = new Map();
  const resultCosts = new Map();
  for (const i of allNodes) {
    paths.set(i, new Map());
    resultCosts.set(i, new Map());
    for (const j of allNodes) {
      if (i === j) {
        paths.get(i).set(j, [i]);
        resultCosts.get(i).set(j, []);
      } else if (dist.get(i).get(j) === Infinity) {
        paths.get(i).set(j, null);
        resultCosts.get(i).set(j, []);
      } else {
        // Reconstruct path iteratively
        const path = [];
        const weights = [];
        let current = i;
        path.push(current);
        while (current !== j) {
          const nextNode = next.get(current).get(j);
          if (nextNode === null) break;
          const edgeData = edgeMatrix.get(current).get(nextNode);
          if (edgeData !== null) {
            weights.push(edgeData);
          }
          current = nextNode;
          path.push(current);
        }
        paths.get(i).set(j, path);
        resultCosts.get(i).set(j, weights);
      }
    }
  }
  return {
    distances: dist,
    paths,
    costs: resultCosts
  };
};
/**
 * Find the shortest path between two nodes using A* pathfinding algorithm.
 *
 * A* is an extension of Dijkstra's algorithm that uses a heuristic function to guide
 * the search towards the target, potentially finding paths faster than Dijkstra's.
 * The heuristic must be admissible (never overestimate the actual cost).
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.directed<{x: number, y: number}, number>((mutable) => {
 *   const a = Graph.addNode(mutable, {x: 0, y: 0})
 *   const b = Graph.addNode(mutable, {x: 1, y: 0})
 *   const c = Graph.addNode(mutable, {x: 2, y: 0})
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Manhattan distance heuristic
 * const heuristic = (nodeData: {x: number, y: number}, targetData: {x: number, y: number}) =>
 *   Math.abs(nodeData.x - targetData.x) + Math.abs(nodeData.y - targetData.y)
 *
 * const result = Graph.astar(graph, { source: 0, target: 2, cost: (edgeData) => edgeData, heuristic })
 * if (Option.isSome(result)) {
 *   console.log(result.value.path) // [0, 1, 2] - shortest path
 *   console.log(result.value.distance) // 2 - total distance
 * }
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const astar = (graph, config) => {
  const {
    cost,
    heuristic,
    source,
    target
  } = config;
  // Validate that source and target nodes exist
  if (!graph.nodes.has(source)) {
    throw missingNode(source);
  }
  if (!graph.nodes.has(target)) {
    throw missingNode(target);
  }
  // Early return if source equals target
  if (source === target) {
    return Option.some({
      path: [source],
      distance: 0,
      costs: []
    });
  }
  // Get target node data for heuristic calculations
  const targetNodeData = graph.nodes.get(target);
  if (targetNodeData === undefined) {
    throw new Error(`Target node ${target} data not found`);
  }
  // Distance tracking (g-score) and f-score (g + h)
  const gScore = new Map();
  const fScore = new Map();
  const previous = new Map();
  const visited = new Set();
  // Initialize scores
  // Iterate directly over node keys
  for (const node of graph.nodes.keys()) {
    gScore.set(node, node === source ? 0 : Infinity);
    fScore.set(node, Infinity);
    previous.set(node, null);
  }
  // Calculate initial f-score for source
  const sourceNodeData = graph.nodes.get(source);
  if (sourceNodeData !== undefined) {
    const h = heuristic(sourceNodeData, targetNodeData);
    fScore.set(source, h);
  }
  // Priority queue using f-score (total estimated cost)
  const openSet = [{
    node: source,
    fScore: fScore.get(source)
  }];
  while (openSet.length > 0) {
    // Find node with lowest f-score
    let minIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].fScore < openSet[minIndex].fScore) {
        minIndex = i;
      }
    }
    const current = openSet.splice(minIndex, 1)[0];
    const currentNode = current.node;
    // Skip if already visited
    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);
    // Early termination if we reached the target
    if (currentNode === target) {
      break;
    }
    // Get current g-score
    const currentGScore = gScore.get(currentNode);
    // Examine all outgoing edges
    const adjacencyList = graph.adjacency.get(currentNode);
    if (adjacencyList !== undefined) {
      for (const edgeIndex of adjacencyList) {
        const edge = graph.edges.get(edgeIndex);
        if (edge !== undefined) {
          const neighbor = edge.target;
          const weight = cost(edge.data);
          // Validate non-negative weights
          if (weight < 0) {
            throw new Error(`A* algorithm requires non-negative edge weights, found ${weight}`);
          }
          const tentativeGScore = currentGScore + weight;
          const neighborGScore = gScore.get(neighbor);
          // If this path to neighbor is better than any previous one
          if (tentativeGScore < neighborGScore) {
            // Update g-score and previous
            gScore.set(neighbor, tentativeGScore);
            previous.set(neighbor, {
              node: currentNode,
              edgeData: edge.data
            });
            // Calculate f-score using heuristic
            const neighborNodeData = graph.nodes.get(neighbor);
            if (neighborNodeData !== undefined) {
              const h = heuristic(neighborNodeData, targetNodeData);
              const f = tentativeGScore + h;
              fScore.set(neighbor, f);
              // Add to open set if not visited
              if (!visited.has(neighbor)) {
                openSet.push({
                  node: neighbor,
                  fScore: f
                });
              }
            }
          }
        }
      }
    }
  }
  // Check if target is reachable
  const targetGScore = gScore.get(target);
  if (targetGScore === Infinity) {
    return Option.none(); // No path exists
  }
  // Reconstruct path
  const path = [];
  const costs = [];
  let currentNode = target;
  while (currentNode !== null) {
    path.unshift(currentNode);
    const prev = previous.get(currentNode);
    if (prev !== null) {
      costs.unshift(prev.edgeData);
      currentNode = prev.node;
    } else {
      currentNode = null;
    }
  }
  return Option.some({
    path,
    distance: targetGScore,
    costs
  });
};
/**
 * Find the shortest path between two nodes using Bellman-Ford algorithm.
 *
 * Bellman-Ford algorithm can handle negative edge weights and detects negative cycles.
 * It has O(VE) time complexity, slower than Dijkstra's but more versatile.
 * Returns Option.none() if a negative cycle is detected that affects the path.
 *
 * @example
 * ```ts
 * import { Graph, Option } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, -1)  // Negative weight allowed
 *   Graph.addEdge(mutable, b, c, 3)
 *   Graph.addEdge(mutable, a, c, 5)
 * })
 *
 * const result = Graph.bellmanFord(graph, { source: 0, target: 2, cost: (edgeData) => edgeData })
 * if (Option.isSome(result)) {
 *   console.log(result.value.path) // [0, 1, 2] - shortest path A->B->C
 *   console.log(result.value.distance) // 2 - total distance
 * }
 * ```
 *
 * @since 3.18.0
 * @category algorithms
 */
const bellmanFord = (graph, config) => {
  const {
    cost,
    source,
    target
  } = config;
  // Validate that source and target nodes exist
  if (!graph.nodes.has(source)) {
    throw missingNode(source);
  }
  if (!graph.nodes.has(target)) {
    throw missingNode(target);
  }
  // Early return if source equals target
  if (source === target) {
    return Option.some({
      path: [source],
      distance: 0,
      costs: []
    });
  }
  // Initialize distances and predecessors
  const distances = new Map();
  const previous = new Map();
  // Iterate directly over node keys
  for (const node of graph.nodes.keys()) {
    distances.set(node, node === source ? 0 : Infinity);
    previous.set(node, null);
  }
  // Collect all edges for relaxation
  const edges = [];
  for (const [, edgeData] of graph.edges) {
    const weight = cost(edgeData.data);
    edges.push({
      source: edgeData.source,
      target: edgeData.target,
      weight,
      edgeData: edgeData.data
    });
  }
  // Relax edges up to V-1 times
  const nodeCount = graph.nodes.size;
  for (let i = 0; i < nodeCount - 1; i++) {
    let hasUpdate = false;
    for (const edge of edges) {
      const sourceDistance = distances.get(edge.source);
      const targetDistance = distances.get(edge.target);
      // Relaxation step
      if (sourceDistance !== Infinity && sourceDistance + edge.weight < targetDistance) {
        distances.set(edge.target, sourceDistance + edge.weight);
        previous.set(edge.target, {
          node: edge.source,
          edgeData: edge.edgeData
        });
        hasUpdate = true;
      }
    }
    // Early termination if no updates
    if (!hasUpdate) {
      break;
    }
  }
  // Check for negative cycles
  for (const edge of edges) {
    const sourceDistance = distances.get(edge.source);
    const targetDistance = distances.get(edge.target);
    if (sourceDistance !== Infinity && sourceDistance + edge.weight < targetDistance) {
      // Negative cycle detected - check if it affects the path to target
      const affectedNodes = new Set();
      const queue = [edge.target];
      while (queue.length > 0) {
        const node = queue.shift();
        if (affectedNodes.has(node)) continue;
        affectedNodes.add(node);
        // Add all nodes reachable from this node
        const adjacencyList = graph.adjacency.get(node);
        if (adjacencyList !== undefined) {
          for (const edgeIndex of adjacencyList) {
            const edge = graph.edges.get(edgeIndex);
            if (edge !== undefined) {
              queue.push(edge.target);
            }
          }
        }
      }
      // If target is affected by negative cycle, return null
      if (affectedNodes.has(target)) {
        return Option.none();
      }
    }
  }
  // Check if target is reachable
  const targetDistance = distances.get(target);
  if (targetDistance === Infinity) {
    return Option.none(); // No path exists
  }
  // Reconstruct path
  const path = [];
  const costs = [];
  let currentNode = target;
  while (currentNode !== null) {
    path.unshift(currentNode);
    const prev = previous.get(currentNode);
    if (prev !== null) {
      costs.unshift(prev.edgeData);
      currentNode = prev.node;
    } else {
      currentNode = null;
    }
  }
  return Option.some({
    path,
    distance: targetDistance,
    costs
  });
};
/**
 * Concrete class for iterables that produce [NodeIndex, NodeData] tuples.
 *
 * This class provides a common abstraction for all iterables that return node data,
 * including traversal iterators (DFS, BFS, etc.) and element iterators (nodes, externals).
 * It uses a mapEntry function pattern for flexible iteration and transformation.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * // Both traversal and element iterators return NodeWalker
 * const dfsNodes: Graph.NodeWalker<string> = Graph.dfs(graph, { start: [0] })
 * const allNodes: Graph.NodeWalker<string> = Graph.nodes(graph)
 *
 * // Common interface for working with node iterables
 * function processNodes<N>(nodeIterable: Graph.NodeWalker<N>): Array<number> {
 *   return Array.from(Graph.indices(nodeIterable))
 * }
 *
 * // Access node data using values() or entries()
 * const nodeData = Array.from(Graph.values(dfsNodes)) // ["A", "B"]
 * const nodeEntries = Array.from(Graph.entries(allNodes)) // [[0, "A"], [1, "B"]]
 * ```
 *
 * @since 3.18.0
 * @category models
 */
class Walker {
  /**
   * @since 3.18.0
   */
  // @ts-ignore
  [Symbol.iterator];
  /**
   * Visits each element and maps it to a value using the provided function.
   *
   * Takes a function that receives the index and data,
   * and returns an iterable of the mapped values. Skips elements that
   * no longer exist in the graph.
   *
   * @example
   * ```ts
   * import { Graph } from "effect"
   *
   * const graph = Graph.directed<string, number>((mutable) => {
   *   const a = Graph.addNode(mutable, "A")
   *   const b = Graph.addNode(mutable, "B")
   *   Graph.addEdge(mutable, a, b, 1)
   * })
   *
   * const dfs = Graph.dfs(graph, { start: [0] })
   *
   * // Map to just the node data
   * const values = Array.from(dfs.visit((index, data) => data))
   * console.log(values) // ["A", "B"]
   *
   * // Map to custom objects
   * const custom = Array.from(dfs.visit((index, data) => ({ id: index, name: data })))
   * console.log(custom) // [{ id: 0, name: "A" }, { id: 1, name: "B" }]
   * ```
   *
   * @since 3.18.0
   * @category iterators
   */
  visit;
  constructor(
  /**
   * Visits each element and maps it to a value using the provided function.
   *
   * Takes a function that receives the index and data,
   * and returns an iterable of the mapped values. Skips elements that
   * no longer exist in the graph.
   *
   * @example
   * ```ts
   * import { Graph } from "effect"
   *
   * const graph = Graph.directed<string, number>((mutable) => {
   *   const a = Graph.addNode(mutable, "A")
   *   const b = Graph.addNode(mutable, "B")
   *   Graph.addEdge(mutable, a, b, 1)
   * })
   *
   * const dfs = Graph.dfs(graph, { start: [0] })
   *
   * // Map to just the node data
   * const values = Array.from(dfs.visit((index, data) => data))
   * console.log(values) // ["A", "B"]
   *
   * // Map to custom objects
   * const custom = Array.from(dfs.visit((index, data) => ({ id: index, name: data })))
   * console.log(custom) // [{ id: 0, name: "A" }, { id: 1, name: "B" }]
   * ```
   *
   * @since 3.18.0
   * @category iterators
   */
  visit) {
    this.visit = visit;
    this[Symbol.iterator] = visit((index, data) => [index, data])[Symbol.iterator];
  }
}
/**
 * Returns an iterator over the indices in the walker.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const dfs = Graph.dfs(graph, { start: [0] })
 * const indices = Array.from(Graph.indices(dfs))
 * console.log(indices) // [0, 1]
 * ```
 *
 * @since 3.18.0
 * @category utilities
 */
const indices = walker => walker.visit((index, _) => index);
/**
 * Returns an iterator over the values (data) in the walker.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const dfs = Graph.dfs(graph, { start: [0] })
 * const values = Array.from(Graph.values(dfs))
 * console.log(values) // ["A", "B"]
 * ```
 *
 * @since 3.18.0
 * @category utilities
 */
const Graph_values = walker => walker.visit((_, data) => data);
/**
 * Returns an iterator over [index, data] entries in the walker.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const dfs = Graph.dfs(graph, { start: [0] })
 * const entries = Array.from(Graph.entries(dfs))
 * console.log(entries) // [[0, "A"], [1, "B"]]
 * ```
 *
 * @since 3.18.0
 * @category utilities
 */
const Graph_entries = walker => walker.visit((index, data) => [index, data]);
/**
 * Creates a new DFS iterator with optional configuration.
 *
 * The iterator maintains a stack of nodes to visit and tracks discovered nodes.
 * It provides lazy evaluation of the depth-first search.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Start from a specific node
 * const dfs1 = Graph.dfs(graph, { start: [0] })
 * for (const nodeIndex of Graph.indices(dfs1)) {
 *   console.log(nodeIndex) // Traverses in DFS order: 0, 1, 2
 * }
 *
 * // Empty iterator (no starting nodes)
 * const dfs2 = Graph.dfs(graph)
 * // Can be used programmatically
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const dfs = (graph, config = {}) => {
  const start = config.start ?? [];
  const direction = config.direction ?? "outgoing";
  // Validate that all start nodes exist
  for (const nodeIndex of start) {
    if (!hasNode(graph, nodeIndex)) {
      throw missingNode(nodeIndex);
    }
  }
  return new Walker(f => ({
    [Symbol.iterator]: () => {
      const stack = [...start];
      const discovered = new Set();
      const nextMapped = () => {
        while (stack.length > 0) {
          const current = stack.pop();
          if (discovered.has(current)) {
            continue;
          }
          discovered.add(current);
          const nodeDataOption = graph.nodes.get(current);
          if (nodeDataOption === undefined) {
            continue;
          }
          const neighbors = neighborsDirected(graph, current, direction);
          for (let i = neighbors.length - 1; i >= 0; i--) {
            const neighbor = neighbors[i];
            if (!discovered.has(neighbor)) {
              stack.push(neighbor);
            }
          }
          return {
            done: false,
            value: f(current, nodeDataOption)
          };
        }
        return {
          done: true,
          value: undefined
        };
      };
      return {
        next: nextMapped
      };
    }
  }));
};
/**
 * Creates a new BFS iterator with optional configuration.
 *
 * The iterator maintains a queue of nodes to visit and tracks discovered nodes.
 * It provides lazy evaluation of the breadth-first search.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Start from a specific node
 * const bfs1 = Graph.bfs(graph, { start: [0] })
 * for (const nodeIndex of Graph.indices(bfs1)) {
 *   console.log(nodeIndex) // Traverses in BFS order: 0, 1, 2
 * }
 *
 * // Empty iterator (no starting nodes)
 * const bfs2 = Graph.bfs(graph)
 * // Can be used programmatically
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const bfs = (graph, config = {}) => {
  const start = config.start ?? [];
  const direction = config.direction ?? "outgoing";
  // Validate that all start nodes exist
  for (const nodeIndex of start) {
    if (!hasNode(graph, nodeIndex)) {
      throw missingNode(nodeIndex);
    }
  }
  return new Walker(f => ({
    [Symbol.iterator]: () => {
      const queue = [...start];
      const discovered = new Set();
      const nextMapped = () => {
        while (queue.length > 0) {
          const current = queue.shift();
          if (!discovered.has(current)) {
            discovered.add(current);
            const neighbors = neighborsDirected(graph, current, direction);
            for (const neighbor of neighbors) {
              if (!discovered.has(neighbor)) {
                queue.push(neighbor);
              }
            }
            const nodeData = getNode(graph, current);
            if (Option.isSome(nodeData)) {
              return {
                done: false,
                value: f(current, nodeData.value)
              };
            }
            return nextMapped();
          }
        }
        return {
          done: true,
          value: undefined
        };
      };
      return {
        next: nextMapped
      };
    }
  }));
};
/**
 * Creates a new topological sort iterator with optional configuration.
 *
 * The iterator uses Kahn's algorithm to lazily produce nodes in topological order.
 * Throws an error if the graph contains cycles.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 1)
 * })
 *
 * // Standard topological sort
 * const topo1 = Graph.topo(graph)
 * for (const nodeIndex of Graph.indices(topo1)) {
 *   console.log(nodeIndex) // 0, 1, 2 (topological order)
 * }
 *
 * // With initial nodes
 * const topo2 = Graph.topo(graph, { initials: [0] })
 *
 * // Throws error for cyclic graph
 * const cyclicGraph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, a, 2) // Creates cycle
 * })
 *
 * try {
 *   Graph.topo(cyclicGraph) // Throws: "Cannot perform topological sort on cyclic graph"
 * } catch (error) {
 *   console.log((error as Error).message)
 * }
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const topo = (graph, config = {}) => {
  // Check if graph is acyclic first
  if (!isAcyclic(graph)) {
    throw new Error("Cannot perform topological sort on cyclic graph");
  }
  const initials = config.initials ?? [];
  // Validate that all initial nodes exist
  for (const nodeIndex of initials) {
    if (!hasNode(graph, nodeIndex)) {
      throw missingNode(nodeIndex);
    }
  }
  return new Walker(f => ({
    [Symbol.iterator]: () => {
      const inDegree = new Map();
      const remaining = new Set();
      const queue = [...initials];
      // Initialize in-degree counts
      for (const [nodeIndex] of graph.nodes) {
        inDegree.set(nodeIndex, 0);
        remaining.add(nodeIndex);
      }
      // Calculate in-degrees
      for (const [, edgeData] of graph.edges) {
        const currentInDegree = inDegree.get(edgeData.target) || 0;
        inDegree.set(edgeData.target, currentInDegree + 1);
      }
      // Add nodes with zero in-degree to queue if no initials provided
      if (initials.length === 0) {
        for (const [nodeIndex, degree] of inDegree) {
          if (degree === 0) {
            queue.push(nodeIndex);
          }
        }
      }
      const nextMapped = () => {
        while (queue.length > 0) {
          const current = queue.shift();
          if (remaining.has(current)) {
            remaining.delete(current);
            // Process outgoing edges, reducing in-degree of targets
            const neighbors = neighborsDirected(graph, current, "outgoing");
            for (const neighbor of neighbors) {
              if (remaining.has(neighbor)) {
                const currentInDegree = inDegree.get(neighbor) || 0;
                const newInDegree = currentInDegree - 1;
                inDegree.set(neighbor, newInDegree);
                // If in-degree becomes 0, add to queue
                if (newInDegree === 0) {
                  queue.push(neighbor);
                }
              }
            }
            const nodeData = getNode(graph, current);
            if (Option.isSome(nodeData)) {
              return {
                done: false,
                value: f(current, nodeData.value)
              };
            }
            return nextMapped();
          }
        }
        return {
          done: true,
          value: undefined
        };
      };
      return {
        next: nextMapped
      };
    }
  }));
};
/**
 * Creates a new DFS postorder iterator with optional configuration.
 *
 * The iterator maintains a stack with visit state tracking and emits nodes
 * in postorder (after all descendants have been processed). Essential for
 * dependency resolution and tree destruction algorithms.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const root = Graph.addNode(mutable, "root")
 *   const child1 = Graph.addNode(mutable, "child1")
 *   const child2 = Graph.addNode(mutable, "child2")
 *   Graph.addEdge(mutable, root, child1, 1)
 *   Graph.addEdge(mutable, root, child2, 1)
 * })
 *
 * // Postorder: children before parents
 * const postOrder = Graph.dfsPostOrder(graph, { start: [0] })
 * for (const node of postOrder) {
 *   console.log(node) // 1, 2, 0
 * }
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const dfsPostOrder = (graph, config = {}) => {
  const start = config.start ?? [];
  const direction = config.direction ?? "outgoing";
  // Validate that all start nodes exist
  for (const nodeIndex of start) {
    if (!hasNode(graph, nodeIndex)) {
      throw missingNode(nodeIndex);
    }
  }
  return new Walker(f => ({
    [Symbol.iterator]: () => {
      const stack = [];
      const discovered = new Set();
      const finished = new Set();
      // Initialize stack with start nodes
      for (let i = start.length - 1; i >= 0; i--) {
        stack.push({
          node: start[i],
          visitedChildren: false
        });
      }
      const nextMapped = () => {
        while (stack.length > 0) {
          const current = stack[stack.length - 1];
          if (!discovered.has(current.node)) {
            discovered.add(current.node);
            current.visitedChildren = false;
          }
          if (!current.visitedChildren) {
            current.visitedChildren = true;
            const neighbors = neighborsDirected(graph, current.node, direction);
            for (let i = neighbors.length - 1; i >= 0; i--) {
              const neighbor = neighbors[i];
              if (!discovered.has(neighbor) && !finished.has(neighbor)) {
                stack.push({
                  node: neighbor,
                  visitedChildren: false
                });
              }
            }
          } else {
            const nodeToEmit = stack.pop().node;
            if (!finished.has(nodeToEmit)) {
              finished.add(nodeToEmit);
              const nodeData = getNode(graph, nodeToEmit);
              if (Option.isSome(nodeData)) {
                return {
                  done: false,
                  value: f(nodeToEmit, nodeData.value)
                };
              }
              return nextMapped();
            }
          }
        }
        return {
          done: true,
          value: undefined
        };
      };
      return {
        next: nextMapped
      };
    }
  }));
};
/**
 * Creates an iterator over all node indices in the graph.
 *
 * The iterator produces node indices in the order they were added to the graph.
 * This provides access to all nodes regardless of connectivity.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 * })
 *
 * const indices = Array.from(Graph.indices(Graph.nodes(graph)))
 * console.log(indices) // [0, 1, 2]
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const Graph_nodes = graph => new Walker(f => ({
  [Symbol.iterator]() {
    const nodeMap = graph.nodes;
    const iterator = nodeMap.entries();
    return {
      next() {
        const result = iterator.next();
        if (result.done) {
          return {
            done: true,
            value: undefined
          };
        }
        const [nodeIndex, nodeData] = result.value;
        return {
          done: false,
          value: f(nodeIndex, nodeData)
        };
      }
    };
  }
}));
/**
 * Creates an iterator over all edge indices in the graph.
 *
 * The iterator produces edge indices in the order they were added to the graph.
 * This provides access to all edges regardless of connectivity.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const a = Graph.addNode(mutable, "A")
 *   const b = Graph.addNode(mutable, "B")
 *   const c = Graph.addNode(mutable, "C")
 *   Graph.addEdge(mutable, a, b, 1)
 *   Graph.addEdge(mutable, b, c, 2)
 * })
 *
 * const indices = Array.from(Graph.indices(Graph.edges(graph)))
 * console.log(indices) // [0, 1]
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const Graph_edges = graph => new Walker(f => ({
  [Symbol.iterator]() {
    const edgeMap = graph.edges;
    const iterator = edgeMap.entries();
    return {
      next() {
        const result = iterator.next();
        if (result.done) {
          return {
            done: true,
            value: undefined
          };
        }
        const [edgeIndex, edgeData] = result.value;
        return {
          done: false,
          value: f(edgeIndex, edgeData)
        };
      }
    };
  }
}));
/**
 * Creates an iterator over external nodes (nodes without edges in specified direction).
 *
 * External nodes are nodes that have no outgoing edges (direction="outgoing") or
 * no incoming edges (direction="incoming"). These are useful for finding
 * sources, sinks, or isolated nodes.
 *
 * @example
 * ```ts
 * import { Graph } from "effect"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   const source = Graph.addNode(mutable, "source")     // 0 - no incoming
 *   const middle = Graph.addNode(mutable, "middle")     // 1 - has both
 *   const sink = Graph.addNode(mutable, "sink")         // 2 - no outgoing
 *   const isolated = Graph.addNode(mutable, "isolated") // 3 - no edges
 *
 *   Graph.addEdge(mutable, source, middle, 1)
 *   Graph.addEdge(mutable, middle, sink, 2)
 * })
 *
 * // Nodes with no outgoing edges (sinks + isolated)
 * const sinks = Array.from(Graph.indices(Graph.externals(graph, { direction: "outgoing" })))
 * console.log(sinks) // [2, 3]
 *
 * // Nodes with no incoming edges (sources + isolated)
 * const sources = Array.from(Graph.indices(Graph.externals(graph, { direction: "incoming" })))
 * console.log(sources) // [0, 3]
 * ```
 *
 * @since 3.18.0
 * @category iterators
 */
const externals = (graph, config = {}) => {
  const direction = config.direction ?? "outgoing";
  return new Walker(f => ({
    [Symbol.iterator]: () => {
      const nodeMap = graph.nodes;
      const adjacencyMap = direction === "incoming" ? graph.reverseAdjacency : graph.adjacency;
      const nodeIterator = nodeMap.entries();
      const nextMapped = () => {
        let current = nodeIterator.next();
        while (!current.done) {
          const [nodeIndex, nodeData] = current.value;
          const adjacencyList = adjacencyMap.get(nodeIndex);
          // Node is external if it has no edges in the specified direction
          if (adjacencyList === undefined || adjacencyList.length === 0) {
            return {
              done: false,
              value: f(nodeIndex, nodeData)
            };
          }
          current = nodeIterator.next();
        }
        return {
          done: true,
          value: undefined
        };
      };
      return {
        next: nextMapped
      };
    }
  }));
};
//# sourceMappingURL=Graph.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/groupBy.js
var groupBy = __webpack_require__(26819);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/GroupBy.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const GroupByTypeId = groupBy/* .GroupByTypeId */.Yh;
/**
 * Run the function across all groups, collecting the results in an
 * arbitrary order.
 *
 * @since 2.0.0
 * @category destructors
 */
const GroupBy_evaluate = groupBy/* .evaluate */._3;
/**
 * Filter the groups to be processed.
 *
 * @since 2.0.0
 * @category utils
 */
const GroupBy_filter = groupBy/* .filter */.pb;
/**
 * Only consider the first `n` groups found in the `Stream`.
 *
 * @since 2.0.0
 * @category utils
 */
const GroupBy_first = groupBy/* .first */.$1;
/**
 * Constructs a `GroupBy` from a `Stream`.
 *
 * @since 2.0.0
 * @category constructors
 */
const GroupBy_make = groupBy/* .make */.L8;
//# sourceMappingURL=GroupBy.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HKT.js

//# sourceMappingURL=HKT.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HashMap.js + 1 modules
var HashMap = __webpack_require__(3402);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/PrimaryKey.js
/**
 * @since 2.0.0
 */
/**
 * @since 2.0.0
 * @category symbols
 */
const symbol = /*#__PURE__*/Symbol.for("effect/PrimaryKey");
/**
 * @since 2.0.0
 * @category accessors
 */
const PrimaryKey_value = self => self[symbol]();
//# sourceMappingURL=PrimaryKey.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/HashRing.js
/**
 * @since 3.19.0
 * @experimental
 */







const HashRing_TypeId = "~effect/cluster/HashRing";
/**
 * @since 3.19.0
 * @category Guards
 * @experimental
 */
const isHashRing = u => (0,Predicate.hasProperty)(u, HashRing_TypeId);
/**
 * @since 3.19.0
 * @category Constructors
 * @experimental
 */
const HashRing_make = options => {
  const self = Object.create(HashRing_Proto);
  self.baseWeight = Math.max(options?.baseWeight ?? 128, 1);
  self.totalWeightCache = 0;
  self.nodes = new Map();
  self.ring = [];
  return self;
};
const HashRing_Proto = {
  [HashRing_TypeId]: HashRing_TypeId,
  [Symbol.iterator]() {
    return Iterable.map(this.nodes.values(), ([n]) => n)[Symbol.iterator]();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  },
  ...Inspectable.BaseProto,
  toJSON() {
    return {
      _id: "HashRing",
      baseWeight: this.baseWeight,
      nodes: this.ring.map(([, n]) => this.nodes.get(n)[0])
    };
  }
};
/**
 * Add new nodes to the ring. If a node already exists in the ring, it
 * will be updated. For example, you can use this to update the node's weight.
 *
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const addMany = /*#__PURE__*/(0,Function.dual)(args => isHashRing(args[0]), (self, nodes, options) => {
  const weight = Math.max(options?.weight ?? 1, 0.1);
  const keys = [];
  let toRemove;
  for (const node of nodes) {
    const key = PrimaryKey_value(node);
    const entry = self.nodes.get(key);
    if (entry) {
      if (entry[1] === weight) continue;
      toRemove ??= new Set();
      toRemove.add(key);
      self.totalWeightCache -= entry[1];
      self.totalWeightCache += weight;
      entry[1] = weight;
    } else {
      self.nodes.set(key, [node, weight]);
      self.totalWeightCache += weight;
    }
    keys.push(key);
  }
  if (toRemove) {
    self.ring = self.ring.filter(([, n]) => !toRemove.has(n));
  }
  addNodesToRing(self, keys, Math.round(weight * self.baseWeight));
  return self;
});
function addNodesToRing(self, keys, weight) {
  for (let i = weight; i > 0; i--) {
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      self.ring.push([Hash.string(`${key}:${i}`), key]);
    }
  }
  self.ring.sort((a, b) => a[0] - b[0]);
}
/**
 * Add a new node to the ring. If the node already exists in the ring, it
 * will be updated. For example, you can use this to update the node's weight.
 *
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const add = /*#__PURE__*/(0,Function.dual)(args => isHashRing(args[0]), (self, node, options) => addMany(self, [node], options));
/**
 * Removes the node from the ring. No-op's if the node does not exist.
 *
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const HashRing_remove = /*#__PURE__*/(0,Function.dual)(2, (self, node) => {
  const key = PrimaryKey_value(node);
  const entry = self.nodes.get(key);
  if (entry) {
    self.nodes.delete(key);
    self.ring = self.ring.filter(([, n]) => n !== key);
    self.totalWeightCache -= entry[1];
  }
  return self;
});
/**
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const HashRing_has = /*#__PURE__*/(0,Function.dual)(2, (self, node) => self.nodes.has(PrimaryKey_value(node)));
/**
 * Gets the node which should handle the given input. Returns undefined if
 * the hashring has no elements with weight.
 *
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const HashRing_get = (self, input) => {
  if (self.ring.length === 0) {
    return undefined;
  }
  const index = getIndexForInput(self, Hash.string(input))[0];
  const node = self.ring[index][1];
  return self.nodes.get(node)[0];
};
/**
 * Distributes `count` shards across the nodes in the ring, attempting to
 * balance the number of shards allocated to each node. Returns undefined if
 * the hashring has no elements with weight.
 *
 * @since 3.19.0
 * @category Combinators
 * @experimental
 */
const getShards = (self, count) => {
  if (self.ring.length === 0) {
    return undefined;
  }
  const shards = new Array(count);
  // for tracking how many shards have been allocated to each node
  const allocations = new Map();
  // for tracking which shards still need to be allocated
  const remaining = new Set();
  // for tracking which nodes have reached the max allocation
  const exclude = new Set();
  // First pass - allocate the closest nodes, skipping nodes that have reached
  // max
  const distances = new Array(count);
  for (let shard = 0; shard < count; shard++) {
    const hash = shardHashes[shard] ??= Hash.string(`shard-${shard}`);
    const [index, distance] = getIndexForInput(self, hash);
    const node = self.ring[index][1];
    distances[shard] = [shard, node, distance];
    remaining.add(shard);
  }
  distances.sort((a, b) => a[2] - b[2]);
  for (let i = 0; i < count; i++) {
    const [shard, node] = distances[i];
    if (exclude.has(node)) continue;
    const [value, weight] = self.nodes.get(node);
    shards[shard] = value;
    remaining.delete(shard);
    const nodeCount = (allocations.get(node) ?? 0) + 1;
    allocations.set(node, nodeCount);
    const maxPerNode = Math.max(1, Math.floor(count * (weight / self.totalWeightCache)));
    if (nodeCount >= maxPerNode) {
      exclude.add(node);
    }
  }
  // Second pass - allocate any remaining shards, skipping nodes that have
  // reached max
  let allAtMax = exclude.size === self.nodes.size;
  remaining.forEach(shard => {
    const index = getIndexForInput(self, shardHashes[shard], allAtMax ? undefined : exclude)[0];
    const node = self.ring[index][1];
    const [value, weight] = self.nodes.get(node);
    shards[shard] = value;
    if (allAtMax) return;
    const nodeCount = (allocations.get(node) ?? 0) + 1;
    allocations.set(node, nodeCount);
    const maxPerNode = Math.max(1, Math.floor(count * (weight / self.totalWeightCache)));
    if (nodeCount >= maxPerNode) {
      exclude.add(node);
      if (exclude.size === self.nodes.size) {
        allAtMax = true;
      }
    }
  });
  return shards;
};
const shardHashes = [];
function getIndexForInput(self, hash, exclude) {
  const ring = self.ring;
  const len = ring.length;
  let mid;
  let lo = 0;
  let hi = len - 1;
  while (lo <= hi) {
    mid = (lo + hi) / 2 >>> 0;
    if (ring[mid][0] >= hash) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  const a = lo === len ? lo - 1 : lo;
  const distA = Math.abs(ring[a][0] - hash);
  if (exclude === undefined) {
    const b = lo - 1;
    if (b < 0) {
      return [a, distA];
    }
    const distB = Math.abs(ring[b][0] - hash);
    return distA <= distB ? [a, distA] : [b, distB];
  } else if (!exclude.has(ring[a][1])) {
    return [a, distA];
  }
  const range = Math.max(lo, len - lo);
  for (let i = 1; i < range; i++) {
    let index = lo - i;
    if (index >= 0 && index < len && !exclude.has(ring[index][1])) {
      return [index, Math.abs(ring[index][0] - hash)];
    }
    index = lo + i;
    if (index >= 0 && index < len && !exclude.has(ring[index][1])) {
      return [index, Math.abs(ring[index][0] - hash)];
    }
  }
  return [a, distA];
}
//# sourceMappingURL=HashRing.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/JSONSchema.js
var JSONSchema = __webpack_require__(50774);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableRef.js
var MutableRef = __webpack_require__(68776);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/core.js
var core = __webpack_require__(55294);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiberRuntime.js + 2 modules
var fiberRuntime = __webpack_require__(55845);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/pool.js
var internal_pool = __webpack_require__(71391);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/keyedPool.js












/** @internal */
const KeyedPoolSymbolKey = "effect/KeyedPool";
/** @internal */
const KeyedPoolTypeId = /*#__PURE__*/Symbol.for(KeyedPoolSymbolKey);
const KeyedPoolMapValueSymbol = /*#__PURE__*/Symbol.for("effect/KeyedPool/MapValue");
const keyedPoolVariance = {
  /* c8 ignore next */
  _K: _ => _,
  /* c8 ignore next */
  _E: _ => _,
  /* c8 ignore next */
  _A: _ => _
};
class KeyedPoolImpl {
  getOrCreatePool;
  activePools;
  [KeyedPoolTypeId] = keyedPoolVariance;
  constructor(getOrCreatePool, activePools) {
    this.getOrCreatePool = getOrCreatePool;
    this.activePools = activePools;
  }
  get(key) {
    return core/* .flatMap */.qIB(this.getOrCreatePool(key), internal_pool/* .get */.Jt);
  }
  invalidate(item) {
    return core/* .flatMap */.qIB(this.activePools, core/* .forEachSequentialDiscard */.QZV(pool => pool.invalidate(item)));
  }
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
}
class Complete {
  pool;
  _tag = "Complete";
  [KeyedPoolMapValueSymbol] = KeyedPoolMapValueSymbol;
  constructor(pool) {
    this.pool = pool;
  }
  [Hash.symbol]() {
    return (0,Function.pipe)(Hash.string("effect/KeyedPool/Complete"), Hash.combine(Hash.hash(this.pool)), Hash.cached(this));
  }
  [Equal.symbol](u) {
    return isComplete(u) && Equal.equals(this.pool, u.pool);
  }
}
const isComplete = u => Predicate.isTagged(u, "Complete") && KeyedPoolMapValueSymbol in u;
class Pending {
  deferred;
  _tag = "Pending";
  [KeyedPoolMapValueSymbol] = KeyedPoolMapValueSymbol;
  constructor(deferred) {
    this.deferred = deferred;
  }
  [Hash.symbol]() {
    return (0,Function.pipe)(Hash.string("effect/KeyedPool/Pending"), Hash.combine(Hash.hash(this.deferred)), Hash.cached(this));
  }
  [Equal.symbol](u) {
    return isPending(u) && Equal.equals(this.deferred, u.deferred);
  }
}
const isPending = u => Predicate.isTagged(u, "Pending") && KeyedPoolMapValueSymbol in u;
const makeImpl = (get, min, max, timeToLive) => (0,Function.pipe)(fiberRuntime/* .all */.Q7([core/* .context */._OA(), core/* .fiberId */.ABT, core/* .sync */.OH5(() => MutableRef.make(HashMap.empty())), fiberRuntime/* .scopeMake */.RW()]), core/* .map */.TjK(([context, fiberId, map, scope]) => {
  const getOrCreatePool = key => core/* .suspend */.DYE(() => {
    let value = Option.getOrUndefined(HashMap.get(MutableRef.get(map), key));
    if (value === undefined) {
      return core/* .uninterruptibleMask */.FcF(restore => {
        const deferred = core/* .deferredUnsafeMake */.MIt(fiberId);
        value = new Pending(deferred);
        let previous = undefined;
        if (HashMap.has(MutableRef.get(map), key)) {
          previous = Option.getOrUndefined(HashMap.get(MutableRef.get(map), key));
        } else {
          MutableRef.update(map, HashMap.set(key, value));
        }
        if (previous === undefined) {
          return (0,Function.pipe)(restore(fiberRuntime/* .scopeExtend */.v_(internal_pool/* .makeWithTTL */.Jq({
            acquire: core/* .provideContext */.PpN(get(key), context),
            min: min(key),
            max: max(key),
            timeToLive: Option.getOrElse(timeToLive(key), () => Duration.infinity)
          }), scope)), core/* .matchCauseEffect */.khu({
            onFailure: cause => {
              const current = Option.getOrUndefined(HashMap.get(MutableRef.get(map), key));
              if (Equal.equals(current, value)) {
                MutableRef.update(map, HashMap.remove(key));
              }
              return core/* .zipRight */.aNH(core/* .deferredFailCause */.FIO(deferred, cause), core/* .failCause */.ATB(cause));
            },
            onSuccess: pool => {
              MutableRef.update(map, HashMap.set(key, new Complete(pool)));
              return core.as(core/* .deferredSucceed */.syF(deferred, pool), pool);
            }
          }));
        }
        switch (previous._tag) {
          case "Complete":
            {
              return core/* .succeed */.PyW(previous.pool);
            }
          case "Pending":
            {
              return restore(core/* .deferredAwait */.gn0(previous.deferred));
            }
        }
      });
    }
    switch (value._tag) {
      case "Complete":
        {
          return core/* .succeed */.PyW(value.pool);
        }
      case "Pending":
        {
          return core/* .deferredAwait */.gn0(value.deferred);
        }
    }
  });
  const activePools = core/* .suspend */.DYE(() => core/* .forEachSequential */.CFK(HashMap.toValues(MutableRef.get(map)), value => {
    switch (value._tag) {
      case "Complete":
        {
          return core/* .succeed */.PyW(value.pool);
        }
      case "Pending":
        {
          return core/* .deferredAwait */.gn0(value.deferred);
        }
    }
  }));
  return new KeyedPoolImpl(getOrCreatePool, activePools);
}));
/** @internal */
const keyedPool_make = options => makeImpl(options.acquire, () => options.size, () => options.size, () => Option.none());
/** @internal */
const keyedPool_makeWith = options => makeImpl(options.acquire, options.size, options.size, () => Option.none());
/** @internal */
const makeWithTTL = options => {
  const timeToLive = Duration.decode(options.timeToLive);
  return makeImpl(options.acquire, options.min, options.max, () => Option.some(timeToLive));
};
/** @internal */
const makeWithTTLBy = options => makeImpl(options.acquire, options.min, options.max, key => Option.some(Duration.decode(options.timeToLive(key))));
/** @internal */
const keyedPool_get = /*#__PURE__*/(0,Function.dual)(2, (self, key) => self.get(key));
/** @internal */
const invalidate = /*#__PURE__*/(0,Function.dual)(2, (self, item) => self.invalidate(item));
//# sourceMappingURL=keyedPool.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/KeyedPool.js

/**
 * @since 2.0.0
 * @category symbols
 */
const KeyedPool_KeyedPoolTypeId = KeyedPoolTypeId;
/**
 * Makes a new pool of the specified fixed size. The pool is returned in a
 * `Scope`, which governs the lifetime of the pool. When the pool is shutdown
 * because the `Scope` is closed, the individual items allocated by the pool
 * will be released in some unspecified order.
 *
 * @since 2.0.0
 * @category constructors
 */
const KeyedPool_make = keyedPool_make;
/**
 * Makes a new pool of the specified fixed size. The pool is returned in a
 * `Scope`, which governs the lifetime of the pool. When the pool is shutdown
 * because the `Scope` is closed, the individual items allocated by the pool
 * will be released in some unspecified order.
 *
 * The size of the underlying pools can be configured per key.
 *
 * @since 2.0.0
 * @category constructors
 */
const KeyedPool_makeWith = keyedPool_makeWith;
/**
 * Makes a new pool with the specified minimum and maximum sizes and time to
 * live before a pool whose excess items are not being used will be shrunk
 * down to the minimum size. The pool is returned in a `Scope`, which governs
 * the lifetime of the pool. When the pool is shutdown because the `Scope` is
 * used, the individual items allocated by the pool will be released in some
 * unspecified order.
 *
 * The size of the underlying pools can be configured per key.
 *
 * @since 2.0.0
 * @category constructors
 */
const KeyedPool_makeWithTTL = makeWithTTL;
/**
 * Makes a new pool with the specified minimum and maximum sizes and time to
 * live before a pool whose excess items are not being used will be shrunk
 * down to the minimum size. The pool is returned in a `Scope`, which governs
 * the lifetime of the pool. When the pool is shutdown because the `Scope` is
 * used, the individual items allocated by the pool will be released in some
 * unspecified order.
 *
 * The size of the underlying pools can be configured per key.
 *
 * @since 2.0.0
 * @category constructors
 */
const KeyedPool_makeWithTTLBy = makeWithTTLBy;
/**
 * Retrieves an item from the pool belonging to the given key in a scoped
 * effect. Note that if acquisition fails, then the returned effect will fail
 * for that same reason. Retrying a failed acquisition attempt will repeat the
 * acquisition attempt.
 *
 * @since 2.0.0
 * @category combinators
 */
const KeyedPool_get = keyedPool_get;
/**
 * Invalidates the specified item. This will cause the pool to eventually
 * reallocate the item, although this reallocation may occur lazily rather
 * than eagerly.
 *
 * @since 2.0.0
 * @category combinators
 */
const KeyedPool_invalidate = invalidate;
//# sourceMappingURL=KeyedPool.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/core-effect.js
var core_effect = __webpack_require__(13682);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/effect/circular.js
var circular = __webpack_require__(64262);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/rcMap.js









/** @internal */
const rcMap_TypeId = /*#__PURE__*/Symbol.for("effect/RcMap");
const variance = {
  _K: Function.identity,
  _A: Function.identity,
  _E: Function.identity
};
class RcMapImpl {
  lookup;
  context;
  scope;
  idleTimeToLive;
  capacity;
  [rcMap_TypeId];
  state = {
    _tag: "Open",
    map: /*#__PURE__*/MutableHashMap.empty()
  };
  semaphore = /*#__PURE__*/circular/* .unsafeMakeSemaphore */.RI(1);
  constructor(lookup, context, scope, idleTimeToLive, capacity) {
    this.lookup = lookup;
    this.context = context;
    this.scope = scope;
    this.idleTimeToLive = idleTimeToLive;
    this.capacity = capacity;
    this[rcMap_TypeId] = variance;
  }
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
}
/** @internal */
const rcMap_make = options => core/* .withFiberRuntime */.$we(fiber => {
  const context = fiber.getFiberRef(core/* .currentContext */.Fi1);
  const scope = Context.get(context, fiberRuntime/* .scopeTag */.DL);
  const idleTimeToLive = options.idleTimeToLive === undefined ? undefined : typeof options.idleTimeToLive === "function" ? (0,Function.flow)(options.idleTimeToLive, Duration.decode) : (0,Function.constant)(Duration.decode(options.idleTimeToLive));
  const self = new RcMapImpl(options.lookup, context, scope, idleTimeToLive, Math.max(options.capacity ?? Number.POSITIVE_INFINITY, 0));
  return core.as(scope.addFinalizer(() => core/* .suspend */.DYE(() => {
    if (self.state._tag === "Closed") {
      return core/* ["void"] */.rIH;
    }
    const map = self.state.map;
    self.state = {
      _tag: "Closed"
    };
    return core/* .forEachSequentialDiscard */.QZV(map, ([, entry]) => core/* .scopeClose */.vDJ(entry.scope, core/* .exitVoid */.x5l)).pipe(core/* .tap */.Mim(() => {
      MutableHashMap.clear(map);
    }), self.semaphore.withPermits(1));
  })), self);
});
/** @internal */
const rcMap_get = /*#__PURE__*/(0,Function.dual)(2, (self_, key) => {
  const self = self_;
  return core/* .uninterruptibleMask */.FcF(restore => getImpl(self, key, restore));
});
const getImpl = /*#__PURE__*/core/* .fnUntraced */.D9k(function* (self, key, restore) {
  if (self.state._tag === "Closed") {
    return yield* core/* .interrupt */.GaK;
  }
  const state = self.state;
  const o = MutableHashMap.get(state.map, key);
  let entry;
  if (o._tag === "Some") {
    entry = o.value;
    entry.refCount++;
  } else if (Number.isFinite(self.capacity) && MutableHashMap.size(self.state.map) >= self.capacity) {
    return yield* core/* .fail */.fJG(new core/* .ExceededCapacityException */.THF(`RcMap attempted to exceed capacity of ${self.capacity}`));
  } else {
    entry = yield* self.semaphore.withPermits(1)(rcMap_acquire(self, key, restore));
  }
  const scope = yield* fiberRuntime/* .scopeTag */.DL;
  yield* scope.addFinalizer(() => entry.finalizer);
  return yield* restore(core/* .deferredAwait */.gn0(entry.deferred));
});
const rcMap_acquire = /*#__PURE__*/core/* .fnUntraced */.D9k(function* (self, key, restore) {
  const scope = yield* fiberRuntime/* .scopeMake */.RW();
  const deferred = yield* core/* .deferredMake */.WW4();
  const acquire = self.lookup(key);
  const contextMap = new Map(self.context.unsafeMap);
  yield* restore(core/* .mapInputContext */.kyh(acquire, inputContext => {
    inputContext.unsafeMap.forEach((value, key) => {
      contextMap.set(key, value);
    });
    contextMap.set(fiberRuntime/* .scopeTag.key */.DL.key, scope);
    return Context.unsafeMake(contextMap);
  })).pipe(core/* .exit */.NS5, core/* .flatMap */.qIB(exit => core/* .deferredDone */.AsN(deferred, exit)), circular/* .forkIn */.ar(scope));
  const idleTimeToLive = self.idleTimeToLive ? self.idleTimeToLive(key) : Duration.zero;
  const entry = {
    deferred,
    scope,
    finalizer: undefined,
    idleTimeToLive,
    fiber: undefined,
    expiresAt: 0,
    refCount: 1
  };
  entry.finalizer = rcMap_release(self, key, entry);
  if (self.state._tag === "Open") {
    MutableHashMap.set(self.state.map, key, entry);
  }
  return entry;
});
const rcMap_release = (self, key, entry) => core_effect/* .clockWith */.RK(clock => {
  entry.refCount--;
  if (entry.refCount > 0) {
    return core/* ["void"] */.rIH;
  } else if (self.state._tag === "Closed" || !MutableHashMap.has(self.state.map, key) || Duration.isZero(entry.idleTimeToLive)) {
    if (self.state._tag === "Open") {
      MutableHashMap.remove(self.state.map, key);
    }
    return core/* .scopeClose */.vDJ(entry.scope, core/* .exitVoid */.x5l);
  }
  if (!Duration.isFinite(entry.idleTimeToLive)) {
    return core/* ["void"] */.rIH;
  }
  entry.expiresAt = clock.unsafeCurrentTimeMillis() + Duration.toMillis(entry.idleTimeToLive);
  if (entry.fiber) return core/* ["void"] */.rIH;
  return core/* .interruptibleMask */.eMl(function loop(restore) {
    const now = clock.unsafeCurrentTimeMillis();
    const remaining = entry.expiresAt - now;
    if (remaining <= 0) {
      if (self.state._tag === "Closed" || entry.refCount > 0) return core/* ["void"] */.rIH;
      MutableHashMap.remove(self.state.map, key);
      return restore(core/* .scopeClose */.vDJ(entry.scope, core/* .exitVoid */.x5l));
    }
    return core/* .flatMap */.qIB(clock.sleep(Duration.millis(remaining)), () => loop(restore));
  }).pipe(fiberRuntime/* .ensuring */.ye(core/* .sync */.OH5(() => {
    entry.fiber = undefined;
  })), circular/* .forkIn */.ar(self.scope), core/* .tap */.Mim(fiber => {
    entry.fiber = fiber;
  }), self.semaphore.withPermits(1));
});
/** @internal */
const rcMap_keys = self => {
  const impl = self;
  return core/* .suspend */.DYE(() => impl.state._tag === "Closed" ? core/* .interrupt */.GaK : core/* .succeed */.PyW(MutableHashMap.keys(impl.state.map)));
};
/** @internal */
const rcMap_invalidate = /*#__PURE__*/(0,Function.dual)(2, /*#__PURE__*/core/* .fnUntraced */.D9k(function* (self_, key) {
  const self = self_;
  if (self.state._tag === "Closed") return;
  const o = MutableHashMap.get(self.state.map, key);
  if (o._tag === "None") return;
  const entry = o.value;
  MutableHashMap.remove(self.state.map, key);
  if (entry.refCount > 0) return;
  yield* core/* .scopeClose */.vDJ(entry.scope, core/* .exitVoid */.x5l);
  if (entry.fiber) yield* core/* .interruptFiber */.OLv(entry.fiber);
}));
/** @internal */
const rcMap_has = /*#__PURE__*/(0,Function.dual)(2, (self_, key) => {
  const self = self_;
  return core/* .sync */.OH5(() => {
    if (self.state._tag === "Closed") return false;
    return MutableHashMap.has(self.state.map, key);
  });
});
/** @internal */
const touch = /*#__PURE__*/(0,Function.dual)(2, (self_, key) => core_effect/* .clockWith */.RK(clock => {
  const self = self_;
  if (self.state._tag === "Closed") return core/* ["void"] */.rIH;
  const o = MutableHashMap.get(self.state.map, key);
  if (o._tag === "None") return core/* ["void"] */.rIH;
  const entry = o.value;
  if (Duration.isZero(entry.idleTimeToLive)) return core/* ["void"] */.rIH;
  entry.expiresAt = clock.unsafeCurrentTimeMillis() + Duration.toMillis(entry.idleTimeToLive);
  return core/* ["void"] */.rIH;
}));
//# sourceMappingURL=rcMap.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RcMap.js

/**
 * @since 3.5.0
 * @category type ids
 */
const RcMap_TypeId = rcMap_TypeId;
/**
 * An `RcMap` can contain multiple reference counted resources that can be indexed
 * by a key. The resources are lazily acquired on the first call to `get` and
 * released when the last reference is released.
 *
 * Complex keys can extend `Equal` and `Hash` to allow lookups by value.
 *
 * **Options**
 *
 * - `capacity`: The maximum number of resources that can be held in the map.
 * - `idleTimeToLive`: When the reference count reaches zero, the resource will be released after this duration.
 *   Can be a static duration or a function that returns a duration based on the key.
 *
 * @since 3.5.0
 * @category models
 * @example
 * ```ts
 * import { Effect, RcMap } from "effect"
 *
 * Effect.gen(function*() {
 *   const map = yield* RcMap.make({
 *     lookup: (key: string) =>
 *       Effect.acquireRelease(
 *         Effect.succeed(`acquired ${key}`),
 *         () => Effect.log(`releasing ${key}`)
 *       )
 *   })
 *
 *   // Get "foo" from the map twice, which will only acquire it once.
 *   // It will then be released once the scope closes.
 *   yield* RcMap.get(map, "foo").pipe(
 *     Effect.andThen(RcMap.get(map, "foo")),
 *     Effect.scoped
 *   )
 * })
 * ```
 */
const RcMap_make = rcMap_make;
/**
 * @since 3.5.0
 * @category combinators
 */
const RcMap_get = rcMap_get;
/**
 * @since 3.17.7
 * @category combinators
 */
const RcMap_has = rcMap_has;
/**
 * @since 3.8.0
 * @category combinators
 */
const RcMap_keys = rcMap_keys;
/**
 * @since 3.13.0
 * @category combinators
 */
const RcMap_invalidate = rcMap_invalidate;
/**
 * @since 3.13.0
 * @category combinators
 */
const RcMap_touch = touch;
//# sourceMappingURL=RcMap.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Scope.js
var Scope = __webpack_require__(90555);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/LayerMap.js
/**
 * @since 3.14.0
 * @experimental
 */









/**
 * @since 3.14.0
 * @category Symbols
 */
const LayerMap_TypeId = /*#__PURE__*/Symbol.for("effect/LayerMap");
/**
 * @since 3.14.0
 * @category Constructors
 * @experimental
 *
 * A `LayerMap` allows you to create a map of Layer's that can be used to
 * dynamically access resources based on a key.
 *
 * ```ts
 * import { NodeRuntime } from "@effect/platform-node"
 * import { Context, Effect, FiberRef, Layer, LayerMap } from "effect"
 *
 * class Greeter extends Context.Tag("Greeter")<Greeter, {
 *   greet: Effect.Effect<string>
 * }>() {}
 *
 * // create a service that wraps a LayerMap
 * class GreeterMap extends LayerMap.Service<GreeterMap>()("GreeterMap", {
 *   // define the lookup function for the layer map
 *   //
 *   // The returned Layer will be used to provide the Greeter service for the
 *   // given name.
 *   lookup: (name: string) =>
 *     Layer.succeed(Greeter, {
 *       greet: Effect.succeed(`Hello, ${name}!`)
 *     }).pipe(
 *       Layer.merge(Layer.locallyScoped(FiberRef.currentConcurrency, 123))
 *     ),
 *
 *   // If a layer is not used for a certain amount of time, it can be removed
 *   idleTimeToLive: "5 seconds",
 *
 *   // Supply the dependencies for the layers in the LayerMap
 *   dependencies: []
 * }) {}
 *
 * // usage
 * const program: Effect.Effect<void, never, GreeterMap> = Effect.gen(function*() {
 *   // access and use the Greeter service
 *   const greeter = yield* Greeter
 *   yield* Effect.log(yield* greeter.greet)
 * }).pipe(
 *   // use the GreeterMap service to provide a variant of the Greeter service
 *   Effect.provide(GreeterMap.get("John"))
 * )
 *
 * // run the program
 * program.pipe(
 *   Effect.provide(GreeterMap.Default),
 *   NodeRuntime.runMain
 * )
 * ```
 */
const LayerMap_make = /*#__PURE__*/Effect.fnUntraced(function* (lookup, options) {
  const context = yield* Effect.context();
  // If we are inside another layer build, use the current memo map,
  // otherwise create a new one.
  const memoMap = context.unsafeMap.has(Layer.CurrentMemoMap.key) ? Context.get(context, Layer.CurrentMemoMap) : yield* Layer.makeMemoMap;
  const rcMap = yield* RcMap_make({
    lookup: key => Effect.scopeWith(scope => Effect.diffFiberRefs(Layer.buildWithMemoMap(lookup(key), memoMap, scope))).pipe(Effect.map(([patch, context]) => ({
      layer: Layer.scopedContext(core/* .withFiberRuntime */.$we(fiber => {
        const scope = Context.unsafeGet(fiber.currentContext, Scope.Scope);
        const oldRefs = fiber.getFiberRefs();
        const newRefs = FiberRefsPatch.patch(patch, fiber.id(), oldRefs);
        const revert = FiberRefsPatch.diff(newRefs, oldRefs);
        fiber.setFiberRefs(newRefs);
        return Effect.as(Scope.addFinalizerExit(scope, () => {
          fiber.setFiberRefs(FiberRefsPatch.patch(revert, fiber.id(), fiber.getFiberRefs()));
          return Effect["void"];
        }), context);
      })),
      runtimeEffect: Effect.withFiberRuntime(fiber => {
        const fiberRefs = FiberRefsPatch.patch(patch, fiber.id(), fiber.getFiberRefs());
        return Effect.succeed(Runtime.make({
          context,
          fiberRefs,
          runtimeFlags: Runtime.defaultRuntime.runtimeFlags
        }));
      })
    }))),
    idleTimeToLive: options?.idleTimeToLive
  });
  if (options?.preloadKeys) {
    for (const key of options.preloadKeys) {
      yield* RcMap_get(rcMap, key);
    }
  }
  return (0,Function.identity)({
    [LayerMap_TypeId]: LayerMap_TypeId,
    rcMap,
    get: key => Layer.unwrapScoped(Effect.map(RcMap_get(rcMap, key), ({
      layer
    }) => layer)),
    runtime: key => Effect.flatMap(RcMap_get(rcMap, key), ({
      runtimeEffect
    }) => runtimeEffect),
    invalidate: key => RcMap_invalidate(rcMap, key)
  });
});
/**
 * @since 3.14.0
 * @category Constructors
 * @experimental
 */
const fromRecord = (layers, options) => LayerMap_make(key => layers[key], {
  ...options,
  preloadKeys: options?.preload ? Object.keys(layers) : undefined
});
/**
 * @since 3.14.0
 * @category Service
 * @experimental
 *
 * Create a `LayerMap` service that provides a dynamic set of resources based on
 * a key.
 *
 * ```ts
 * import { NodeRuntime } from "@effect/platform-node"
 * import { Context, Effect, FiberRef, Layer, LayerMap } from "effect"
 *
 * class Greeter extends Context.Tag("Greeter")<Greeter, {
 *   greet: Effect.Effect<string>
 * }>() {}
 *
 * // create a service that wraps a LayerMap
 * class GreeterMap extends LayerMap.Service<GreeterMap>()("GreeterMap", {
 *   // define the lookup function for the layer map
 *   //
 *   // The returned Layer will be used to provide the Greeter service for the
 *   // given name.
 *   lookup: (name: string) =>
 *     Layer.succeed(Greeter, {
 *       greet: Effect.succeed(`Hello, ${name}!`)
 *     }).pipe(
 *       Layer.merge(Layer.locallyScoped(FiberRef.currentConcurrency, 123))
 *     ),
 *
 *   // If a layer is not used for a certain amount of time, it can be removed
 *   idleTimeToLive: "5 seconds",
 *
 *   // Supply the dependencies for the layers in the LayerMap
 *   dependencies: []
 * }) {}
 *
 * // usage
 * const program: Effect.Effect<void, never, GreeterMap> = Effect.gen(function*() {
 *   // access and use the Greeter service
 *   const greeter = yield* Greeter
 *   yield* Effect.log(yield* greeter.greet)
 * }).pipe(
 *   // use the GreeterMap service to provide a variant of the Greeter service
 *   Effect.provide(GreeterMap.get("John"))
 * )
 *
 * // run the program
 * program.pipe(
 *   Effect.provide(GreeterMap.Default),
 *   NodeRuntime.runMain
 * )
 * ```
 */
const Service = () => (id, options) => {
  const Err = globalThis.Error;
  const limit = Err.stackTraceLimit;
  Err.stackTraceLimit = 2;
  const creationError = new Err();
  Err.stackTraceLimit = limit;
  function TagClass() {}
  const TagClass_ = TagClass;
  Object.setPrototypeOf(TagClass, Object.getPrototypeOf(Context.GenericTag(id)));
  TagClass.key = id;
  Object.defineProperty(TagClass, "stack", {
    get() {
      return creationError.stack;
    }
  });
  TagClass_.DefaultWithoutDependencies = Layer.scoped(TagClass_, "lookup" in options ? LayerMap_make(options.lookup, options) : fromRecord(options.layers, options));
  TagClass_.Default = options.dependencies && options.dependencies.length > 0 ? Layer.provide(TagClass_.DefaultWithoutDependencies, options.dependencies) : TagClass_.DefaultWithoutDependencies;
  TagClass_.get = key => Layer.unwrapScoped(Effect.map(TagClass_, layerMap => layerMap.get(key)));
  TagClass_.runtime = key => Effect.flatMap(TagClass_, layerMap => layerMap.runtime(key));
  TagClass_.invalidate = key => Effect.flatMap(TagClass_, layerMap => layerMap.invalidate(key));
  return TagClass;
};
//# sourceMappingURL=LayerMap.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/List.js
var List = __webpack_require__(57087);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/LogLevel.js
var LogLevel = __webpack_require__(81911);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/LogSpan.js
var LogSpan = __webpack_require__(39109);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Logger.js + 1 modules
var Logger = __webpack_require__(32717);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Mailbox.js + 1 modules
var Mailbox = __webpack_require__(96140);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Scheduler.js
var Scheduler = __webpack_require__(42310);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/layer.js + 1 modules
var internal_layer = __webpack_require__(35736);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/managedRuntime/circular.js
var managedRuntime_circular = __webpack_require__(60884);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/runtime.js
var internal_runtime = __webpack_require__(54405);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/managedRuntime.js










/** @internal */
const isManagedRuntime = u => (0,Predicate.hasProperty)(u, managedRuntime_circular/* .TypeId */.i);
function provide(managed, effect) {
  return core/* .flatMap */.qIB(managed.runtimeEffect, rt => core/* .withFiberRuntime */.$we(fiber => {
    fiber.setFiberRefs(rt.fiberRefs);
    fiber.currentRuntimeFlags = rt.runtimeFlags;
    return core/* .provideContext */.PpN(effect, rt.context);
  }));
}
const ManagedRuntimeProto = {
  ...Effectable.CommitPrototype,
  [managedRuntime_circular/* .TypeId */.i]: managedRuntime_circular/* .TypeId */.i,
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  },
  commit() {
    return this.runtimeEffect;
  }
};
/** @internal */
const managedRuntime_make = (layer, memoMap) => {
  memoMap = memoMap ?? internal_layer/* .unsafeMakeMemoMap */.$M();
  const scope = internal_runtime/* .unsafeRunSyncEffect */.wg(fiberRuntime/* .scopeMake */.RW());
  let buildFiber;
  const runtimeEffect = core/* .suspend */.DYE(() => {
    if (!buildFiber) {
      const scheduler = new Scheduler.SyncScheduler();
      buildFiber = internal_runtime/* .unsafeForkEffect */.C9(core/* .tap */.Mim(Scope.extend(internal_layer/* .toRuntimeWithMemoMap */.Yp(layer, memoMap), scope), rt => {
        self.cachedRuntime = rt;
      }), {
        scope,
        scheduler
      });
      scheduler.flush();
    }
    return core/* .flatten */.Bqz(buildFiber.await);
  });
  const self = Object.assign(Object.create(ManagedRuntimeProto), {
    memoMap,
    scope,
    runtimeEffect,
    cachedRuntime: undefined,
    runtime() {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunPromiseEffect */.w$(self.runtimeEffect) : Promise.resolve(self.cachedRuntime);
    },
    dispose() {
      return internal_runtime/* .unsafeRunPromiseEffect */.w$(self.disposeEffect);
    },
    disposeEffect: core/* .suspend */.DYE(() => {
      ;
      self.runtimeEffect = core/* .die */.F_Q("ManagedRuntime disposed");
      self.cachedRuntime = undefined;
      return Scope.close(self.scope, core/* .exitVoid */.x5l);
    }),
    runFork(effect, options) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeForkEffect */.C9(provide(self, effect), options) : internal_runtime/* .unsafeFork */.vI(self.cachedRuntime)(effect, options);
    },
    runSyncExit(effect) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunSyncExitEffect */.ej(provide(self, effect)) : internal_runtime/* .unsafeRunSyncExit */.NV(self.cachedRuntime)(effect);
    },
    runSync(effect) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunSyncEffect */.wg(provide(self, effect)) : internal_runtime/* .unsafeRunSync */.FZ(self.cachedRuntime)(effect);
    },
    runPromiseExit(effect, options) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunPromiseExitEffect */.MN(provide(self, effect), options) : internal_runtime/* .unsafeRunPromiseExit */.Vk(self.cachedRuntime)(effect, options);
    },
    runCallback(effect, options) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunCallback */.B5(internal_runtime/* .defaultRuntime */.KD)(provide(self, effect), options) : internal_runtime/* .unsafeRunCallback */.B5(self.cachedRuntime)(effect, options);
    },
    runPromise(effect, options) {
      return self.cachedRuntime === undefined ? internal_runtime/* .unsafeRunPromiseEffect */.w$(provide(self, effect), options) : internal_runtime/* .unsafeRunPromise */.LP(self.cachedRuntime)(effect, options);
    }
  });
  return self;
};
//# sourceMappingURL=managedRuntime.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ManagedRuntime.js


/**
 * @since 3.9.0
 * @category symbol
 */
const ManagedRuntime_TypeId = managedRuntime_circular/* .TypeId */.i;
/**
 * Checks if the provided argument is a `ManagedRuntime`.
 *
 * @since 3.9.0
 * @category guards
 */
const ManagedRuntime_isManagedRuntime = isManagedRuntime;
/**
 * Convert a Layer into an ManagedRuntime, that can be used to run Effect's using
 * your services.
 *
 * @since 2.0.0
 * @category runtime class
 * @example
 * ```ts
 * import { Console, Effect, Layer, ManagedRuntime } from "effect"
 *
 * class Notifications extends Effect.Tag("Notifications")<
 *   Notifications,
 *   { readonly notify: (message: string) => Effect.Effect<void> }
 * >() {
 *   static Live = Layer.succeed(this, { notify: (message) => Console.log(message) })
 * }
 *
 * async function main() {
 *   const runtime = ManagedRuntime.make(Notifications.Live)
 *   await runtime.runPromise(Notifications.notify("Hello, world!"))
 *   await runtime.dispose()
 * }
 *
 * main()
 * ```
 */
const ManagedRuntime_make = managedRuntime_make;
//# sourceMappingURL=ManagedRuntime.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Match.js + 1 modules
var Match = __webpack_require__(66171);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MergeDecision.js
var MergeDecision = __webpack_require__(24885);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/mergeState.js
var mergeState = __webpack_require__(16320);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MergeState.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MergeStateTypeId = mergeState/* .MergeStateTypeId */.Bk;
/**
 * @since 2.0.0
 * @category constructors
 */
const BothRunning = mergeState/* .BothRunning */.PN;
/**
 * @since 2.0.0
 * @category constructors
 */
const LeftDone = mergeState/* .LeftDone */.wx;
/**
 * @since 2.0.0
 * @category constructors
 */
const RightDone = mergeState/* .RightDone */.l8;
/**
 * Returns `true` if the specified value is a `MergeState`, `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isMergeState = mergeState/* .isMergeState */.MB;
/**
 * Returns `true` if the specified `MergeState` is a `BothRunning`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isBothRunning = mergeState/* .isBothRunning */.Z;
/**
 * Returns `true` if the specified `MergeState` is a `LeftDone`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isLeftDone = mergeState/* .isLeftDone */.oR;
/**
 * Returns `true` if the specified `MergeState` is a `RightDone`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isRightDone = mergeState/* .isRightDone */.XB;
/**
 * @since 2.0.0
 * @category folding
 */
const MergeState_match = mergeState/* .match */.YW;
//# sourceMappingURL=MergeState.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/mergeStrategy.js + 1 modules
var mergeStrategy = __webpack_require__(91777);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MergeStrategy.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const MergeStrategyTypeId = mergeStrategy/* .MergeStrategyTypeId */.JZ;
/**
 * @since 2.0.0
 * @category constructors
 */
const BackPressure = mergeStrategy/* .BackPressure */.N4;
/**
 * @since 2.0.0
 * @category constructors
 */
const BufferSliding = mergeStrategy/* .BufferSliding */.$u;
/**
 * Returns `true` if the specified value is a `MergeStrategy`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isMergeStrategy = mergeStrategy/* .isMergeStrategy */.Ic;
/**
 * Returns `true` if the specified `MergeStrategy` is a `BackPressure`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isBackPressure = mergeStrategy/* .isBackPressure */.v7;
/**
 * Returns `true` if the specified `MergeStrategy` is a `BufferSliding`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isBufferSliding = mergeStrategy/* .isBufferSliding */.bA;
/**
 * Folds an `MergeStrategy` into a value of type `A`.
 *
 * @since 2.0.0
 * @category folding
 */
const MergeStrategy_match = mergeStrategy/* .match */.YW;
//# sourceMappingURL=MergeStrategy.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric.js
var internal_metric = __webpack_require__(52561);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Metric.js


/**
 * @since 2.0.0
 * @category symbols
 */
const MetricTypeId = internal_metric/* .MetricTypeId */.is;
/**
 * @since 2.0.0
 * @category globals
 */
const globalMetricRegistry = internal_metric/* .globalMetricRegistry */.jx;
/**
 * @since 2.0.0
 * @category constructors
 */
const Metric_make = internal_metric/* .make */.L8;
/**
 * Returns a new metric that is powered by this one, but which accepts updates
 * of the specified new type, which must be transformable to the input type of
 * this metric.
 *
 * @since 2.0.0
 * @category mapping
 */
const mapInput = internal_metric/* .mapInput */.zQ;
/**
 * Represents a Counter metric that tracks cumulative numerical values over time.
 * Counters can be incremented and decremented and provide a running total of changes.
 *
 * **Options**
 *
 * - description - A description of the counter.
 * - bigint - Indicates if the counter uses 'bigint' data type.
 * - incremental - Set to 'true' for a counter that only increases. With this configuration, Effect ensures that non-incremental updates have no impact on the counter, making it exclusively suitable for counting upwards.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const numberCounter = Metric.counter("count", {
 *   description: "A number counter"
 * });
 *
 * const bigintCounter = Metric.counter("count", {
 *   description: "A bigint counter",
 *   bigint: true
 * });
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const Metric_counter = internal_metric/* .counter */.hJ;
/**
 * Creates a Frequency metric to count occurrences of events.
 * Frequency metrics are used to count the number of times specific events or incidents occur.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const errorFrequency = Metric.frequency("error_frequency", {
 *    description: "Counts the occurrences of errors."
 * });
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const frequency = internal_metric/* .frequency */.X7;
/**
 * Returns a new metric that is powered by this one, but which accepts updates
 * of any type, and translates them to updates with the specified constant
 * update value.
 *
 * @since 2.0.0
 * @category constructors
 */
const withConstantInput = internal_metric/* .withConstantInput */.Xg;
/**
 * @since 2.0.0
 * @category constructors
 */
const fromMetricKey = internal_metric/* .fromMetricKey */.Eh;
/**
 * Represents a Gauge metric that tracks and reports a single numerical value at a specific moment.
 * Gauges are suitable for metrics that represent instantaneous values, such as memory usage or CPU load.
 *
 * **Options**
 *
 * - description - A description of the gauge metric.
 * - bigint - Indicates if the counter uses 'bigint' data type.
 *
 * @example
 * ```ts
 * import { Metric } from "effect"
 *
 * const numberGauge = Metric.gauge("memory_usage", {
 *   description: "A gauge for memory usage"
 * });
 *
 * const bigintGauge = Metric.gauge("cpu_load", {
 *   description: "A gauge for CPU load",
 *   bigint: true
 * });
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const gauge = internal_metric/* .gauge */.uI;
/**
 * Represents a Histogram metric that records observations in specified value boundaries.
 * Histogram metrics are useful for measuring the distribution of values within a range.
 *
 * @example
 * ```ts
 * import { Metric, MetricBoundaries } from "effect"
 *
 * const latencyHistogram = Metric.histogram("latency_histogram",
 *   MetricBoundaries.linear({ start: 0, width: 10, count: 11 }),
 *   "Measures the distribution of request latency."
 * );
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const histogram = internal_metric/* .histogram */.JW;
/**
 * @since 2.0.0
 * @category combinators
 */
const increment = internal_metric/* .increment */.GV;
/**
 * @since 2.0.0
 * @category combinators
 */
const incrementBy = internal_metric/* .incrementBy */.xv;
/**
 * Returns a new metric that is powered by this one, but which outputs a new
 * state type, determined by transforming the state type of this metric by the
 * specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
const Metric_map = internal_metric/* .map */.Tj;
/**
 * @since 2.0.0
 * @category mapping
 */
const mapType = internal_metric/* .mapType */.H$;
/**
 * Modifies the metric with the specified update message. For example, if the
 * metric were a gauge, the update would increment the method by the provided
 * amount.
 *
 * @since 3.6.5
 * @category utils
 */
const modify = internal_metric/* .modify */.JP;
/**
 * @since 2.0.0
 * @category aspects
 */
const Metric_set = internal_metric/* .set */.hZ;
/**
 * Captures a snapshot of all metrics recorded by the application.
 *
 * @since 2.0.0
 * @category getters
 */
const snapshot = internal_metric/* .snapshot */.P9;
/**
 * Creates a metric that ignores input and produces constant output.
 *
 * @since 2.0.0
 * @category constructors
 */
const succeed = internal_metric/* .succeed */.Py;
/**
 * Creates a metric that ignores input and produces constant output.
 *
 * @since 2.0.0
 * @category constructors
 */
const sync = internal_metric/* .sync */.OH;
/**
 * Creates a Summary metric that records observations and calculates quantiles.
 * Summary metrics provide statistical information about a set of values, including quantiles.
 *
 * **Options**
 *
 * - name - The name of the Summary metric.
 * - maxAge - The maximum age of observations to retain.
 * - maxSize - The maximum number of observations to keep.
 * - error - The error percentage when calculating quantiles.
 * - quantiles - An `Chunk` of quantiles to calculate (e.g., [0.5, 0.9]).
 * - description - An optional description of the Summary metric.
 *
 * @example
 * ```ts
 * import { Metric, Chunk } from "effect"
 *
 * const responseTimesSummary = Metric.summary({
 *   name: "response_times_summary",
 *   maxAge: "60 seconds", // Retain observations for 60 seconds.
 *   maxSize: 1000, // Keep a maximum of 1000 observations.
 *   error: 0.01, // Allow a 1% error when calculating quantiles.
 *   quantiles: [0.5, 0.9, 0.99], // Calculate 50th, 90th, and 99th percentiles.
 *   description: "Measures the distribution of response times."
 * });
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const summary = internal_metric/* .summary */.z;
/**
 * @since 2.0.0
 * @category constructors
 */
const summaryTimestamp // readonly because contravariant
= internal_metric/* .summaryTimestamp */.nj;
/**
 * Returns a new metric, which is identical in every way to this one, except
 * the specified tags have been added to the tags of this metric.
 *
 * @since 2.0.0
 * @category utils
 */
const tagged = internal_metric/* .tagged */.VK;
/**
 * Returns a new metric, which is identical in every way to this one, except
 * dynamic tags are added based on the update values. Note that the metric
 * returned by this method does not return any useful information, due to the
 * dynamic nature of the added tags.
 *
 * @since 2.0.0
 * @category utils
 */
const taggedWithLabelsInput = internal_metric/* .taggedWithLabelsInput */.GH;
/**
 * Returns a new metric, which is identical in every way to this one, except
 * the specified tags have been added to the tags of this metric.
 *
 * @since 2.0.0
 * @category utils
 */
const taggedWithLabels = internal_metric/* .taggedWithLabels */.m9;
/**
 * Creates a timer metric, based on a histogram, which keeps track of
 * durations in milliseconds. The unit of time will automatically be added to
 * the metric as a tag (i.e. `"time_unit: milliseconds"`).
 *
 * @since 2.0.0
 * @category constructors
 */
const Metric_timer = internal_metric/* .timer */.O1;
/**
 * Creates a timer metric, based on a histogram created from the provided
 * boundaries, which keeps track of durations in milliseconds. The unit of time
 * will automatically be added to the metric as a tag (i.e.
 * `"time_unit: milliseconds"`).
 *
 * @since 2.0.0
 * @category constructors
 */
const timerWithBoundaries = internal_metric/* .timerWithBoundaries */.AP;
/**
 * Returns an aspect that will update this metric with the specified constant
 * value every time the aspect is applied to an effect, regardless of whether
 * that effect fails or succeeds.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackAll = internal_metric/* .trackAll */.Ps;
/**
 * Returns an aspect that will update this metric with the defects of the
 * effects that it is applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackDefect = internal_metric/* .trackDefect */.HT;
/**
 * Returns an aspect that will update this metric with the result of applying
 * the specified function to the defect throwables of the effects that the
 * aspect is applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackDefectWith = internal_metric/* .trackDefectWith */.tK;
/**
 * Returns an aspect that will update this metric with the duration that the
 * effect takes to execute. To call this method, the input type of the metric
 * must be `Duration`.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackDuration = internal_metric/* .trackDuration */.cV;
/**
 * Returns an aspect that will update this metric with the duration that the
 * effect takes to execute. To call this method, you must supply a function
 * that can convert the `Duration` to the input type of this metric.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackDurationWith = internal_metric/* .trackDurationWith */.KO;
/**
 * Returns an aspect that will update this metric with the failure value of
 * the effects that it is applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackError = internal_metric/* .trackError */.Oz;
/**
 * Returns an aspect that will update this metric with the result of applying
 * the specified function to the error value of the effects that the aspect is
 * applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackErrorWith = internal_metric/* .trackErrorWith */.eL;
/**
 * Returns an aspect that will update this metric with the success value of
 * the effects that it is applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackSuccess = internal_metric/* .trackSuccess */.BV;
/**
 * Returns an aspect that will update this metric with the result of applying
 * the specified function to the success value of the effects that the aspect is
 * applied to.
 *
 * @since 2.0.0
 * @category aspects
 */
const trackSuccessWith = internal_metric/* .trackSuccessWith */.rY;
/**
 * Updates the metric with the specified update message. For example, if the
 * metric were a counter, the update would increment the method by the
 * provided amount.
 *
 * @since 2.0.0
 * @category utils
 */
const update = internal_metric/* .update */.yo;
/**
 * Retrieves a snapshot of the value of the metric at this moment in time.
 *
 * @since 2.0.0
 * @category getters
 */
const Metric_value = internal_metric/* .value */.Uq;
/**
 * @since 2.0.0
 * @category utils
 */
const withNow = internal_metric/* .withNow */.nU;
/**
 * @since 2.0.0
 * @category zipping
 */
const zip = internal_metric/* .zip */.yU;
/**
 * Unsafely captures a snapshot of all metrics recorded by the application.
 *
 * @since 2.0.0
 * @category unsafe
 */
const unsafeSnapshot = internal_metric/* .unsafeSnapshot */.DO;
/**
 * @since 2.0.0
 * @category metrics
 */
const fiberStarted = fiberRuntime/* .fiberStarted */.Iw;
/**
 * @since 2.0.0
 * @category metrics
 */
const fiberSuccesses = fiberRuntime/* .fiberSuccesses */.gF;
/**
 * @since 2.0.0
 * @category metrics
 */
const fiberFailures = fiberRuntime/* .fiberFailures */.QA;
/**
 * @since 2.0.0
 * @category metrics
 */
const fiberLifetimes = fiberRuntime/* .fiberLifetimes */.f6;
/**
 * @since 2.0.0
 * @category metrics
 */
const fiberActive = fiberRuntime/* .fiberActive */.bu;
//# sourceMappingURL=Metric.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/boundaries.js
var boundaries = __webpack_require__(19090);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricBoundaries.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricBoundariesTypeId = boundaries/* .MetricBoundariesTypeId */.Yy;
/**
 * @since 2.0.0
 * @category refinements
 */
const isMetricBoundaries = boundaries/* .isMetricBoundaries */.vE;
/**
 * @since 2.0.0
 * @category constructors
 */
const fromIterable = boundaries/* .fromIterable */.Ts;
/**
 * A helper method to create histogram bucket boundaries for a histogram
 * with linear increasing values.
 *
 * @since 2.0.0
 * @category constructors
 */
const linear = boundaries/* .linear */.sn;
/**
 * A helper method to create histogram bucket boundaries for a histogram
 * with exponentially increasing values.
 *
 * @since 2.0.0
 * @category constructors
 */
const exponential = boundaries/* .exponential */.EV;
//# sourceMappingURL=MetricBoundaries.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/hook.js
var metric_hook = __webpack_require__(67707);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricHook.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricHookTypeId = metric_hook/* .MetricHookTypeId */.h$;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_make = metric_hook/* .make */.L8;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_counter = metric_hook/* .counter */.hJ;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_frequency = metric_hook/* .frequency */.X7;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_gauge = metric_hook/* .gauge */.uI;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_histogram = metric_hook/* .histogram */.JW;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricHook_summary = metric_hook/* .summary */.z;
/**
 * @since 2.0.0
 * @category utils
 */
const onUpdate = metric_hook/* .onUpdate */.Lv;
/**
 * @since 3.6.5
 * @category utils
 */
const onModify = metric_hook/* .onModify */.A4;
//# sourceMappingURL=MetricHook.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/key.js
var metric_key = __webpack_require__(18469);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricKey.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricKeyTypeId = metric_key/* .MetricKeyTypeId */.lY;
/**
 * @since 2.0.0
 * @category refinements
 */
const isMetricKey = metric_key/* .isMetricKey */.wd;
/**
 * Creates a metric key for a counter, with the specified name.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_counter = metric_key/* .counter */.hJ;
/**
 * Creates a metric key for a categorical frequency table, with the specified
 * name.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_frequency = metric_key/* .frequency */.X7;
/**
 * Creates a metric key for a gauge, with the specified name.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_gauge = metric_key/* .gauge */.uI;
/**
 * Creates a metric key for a histogram, with the specified name and boundaries.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_histogram = metric_key/* .histogram */.JW;
/**
 * Creates a metric key for a summary, with the specified name, maxAge,
 * maxSize, error, and quantiles.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_summary = metric_key/* .summary */.z;
/**
 * Returns a new `MetricKey` with the specified tag appended.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_tagged = metric_key/* .tagged */.VK;
/**
 * Returns a new `MetricKey` with the specified tags appended.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricKey_taggedWithLabels = metric_key/* .taggedWithLabels */.m9;
//# sourceMappingURL=MetricKey.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/keyType.js
var keyType = __webpack_require__(78341);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricKeyType.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricKeyTypeTypeId = keyType/* .MetricKeyTypeTypeId */.V4;
/**
 * @since 2.0.0
 * @category symbols
 */
const CounterKeyTypeTypeId = keyType/* .CounterKeyTypeTypeId */.f;
/**
 * @since 2.0.0
 * @category symbols
 */
const FrequencyKeyTypeTypeId = keyType/* .FrequencyKeyTypeTypeId */.Lx;
/**
 * @since 2.0.0
 * @category symbols
 */
const GaugeKeyTypeTypeId = keyType/* .GaugeKeyTypeTypeId */.qj;
/**
 * @since 2.0.0
 * @category symbols
 */
const HistogramKeyTypeTypeId = keyType/* .HistogramKeyTypeTypeId */.jr;
/**
 * @since 2.0.0
 * @category symbols
 */
const SummaryKeyTypeTypeId = keyType/* .SummaryKeyTypeTypeId */.jI;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricKeyType_counter = keyType/* .counter */.hJ;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricKeyType_frequency = keyType/* .frequency */.X7;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricKeyType_gauge = keyType/* .gauge */.uI;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricKeyType_histogram = keyType/* .histogram */.JW;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricKeyType_summary = keyType/* .summary */.z;
/**
 * @since 2.0.0
 * @category refinements
 */
const isMetricKeyType = keyType/* .isMetricKeyType */.Ul;
/**
 * @since 2.0.0
 * @category refinements
 */
const isCounterKey = keyType/* .isCounterKey */.gC;
/**
 * @since 2.0.0
 * @category refinements
 */
const isFrequencyKey = keyType/* .isFrequencyKey */.YP;
/**
 * @since 2.0.0
 * @category refinements
 */
const isGaugeKey = keyType/* .isGaugeKey */.Bd;
/**
 * @since 2.0.0
 * @category refinements
 */
const isHistogramKey = keyType/* .isHistogramKey */.SI;
/**
 * @since 2.0.0
 * @category refinements
 */
const isSummaryKey = keyType/* .isSummaryKey */.cA;
//# sourceMappingURL=MetricKeyType.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/label.js
var metric_label = __webpack_require__(39128);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricLabel.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricLabelTypeId = metric_label/* .MetricLabelTypeId */.eS;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricLabel_make = metric_label/* .make */.L8;
/**
 * @since 2.0.0
 * @category refinements
 */
const isMetricLabel = metric_label/* .isMetricLabel */.Jm;
//# sourceMappingURL=MetricLabel.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/pair.js
var pair = __webpack_require__(41856);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricPair.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricPairTypeId = pair/* .MetricPairTypeId */.e6;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricPair_make = pair/* .make */.L8;
/**
 * @since 2.0.0
 * @category unsafe
 */
const MetricPair_unsafeMake = pair/* .unsafeMake */.$N;
//# sourceMappingURL=MetricPair.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/schedule.js
var internal_schedule = __webpack_require__(39892);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/polling.js





/** @internal */
const MetricPollingSymbolKey = "effect/MetricPolling";
/** @internal */
const MetricPollingTypeId = /*#__PURE__*/Symbol.for(MetricPollingSymbolKey);
/** @internal */
const polling_make = (metric, poll) => {
  return {
    [MetricPollingTypeId]: MetricPollingTypeId,
    pipe() {
      return (0,Pipeable.pipeArguments)(this, arguments);
    },
    metric,
    poll
  };
};
/** @internal */
const collectAll = iterable => {
  const metrics = Array.from(iterable);
  return {
    [MetricPollingTypeId]: MetricPollingTypeId,
    pipe() {
      return (0,Pipeable.pipeArguments)(this, arguments);
    },
    metric: internal_metric/* .make */.L8(Array.of(void 0), (inputs, extraTags) => {
      for (let i = 0; i < inputs.length; i++) {
        const pollingMetric = metrics[i];
        const input = (0,Function.pipe)(inputs, x => x[i]);
        pollingMetric.metric.unsafeUpdate(input, extraTags);
      }
    }, extraTags => Array.from(metrics.map(pollingMetric => pollingMetric.metric.unsafeValue(extraTags))), (inputs, extraTags) => {
      for (let i = 0; i < inputs.length; i++) {
        const pollingMetric = metrics[i];
        const input = (0,Function.pipe)(inputs, x => x[i]);
        pollingMetric.metric.unsafeModify(input, extraTags);
      }
    }),
    poll: core/* .forEachSequential */.CFK(metrics, metric => metric.poll)
  };
};
/** @internal */
const launch = /*#__PURE__*/(0,Function.dual)(2, (self, schedule) => (0,Function.pipe)(pollAndUpdate(self), core/* .zipRight */.aNH(internal_metric/* .value */.Uq(self.metric)), internal_schedule/* .scheduleForked */.Rq(schedule)));
/** @internal */
const polling_poll = self => self.poll;
/** @internal */
const pollAndUpdate = self => core/* .flatMap */.qIB(self.poll, value => internal_metric/* .update */.yo(self.metric, value));
/** @internal */
const retry = /*#__PURE__*/(0,Function.dual)(2, (self, policy) => ({
  [MetricPollingTypeId]: MetricPollingTypeId,
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  },
  metric: self.metric,
  poll: internal_schedule/* .retry_Effect */.Po(self.poll, policy)
}));
/** @internal */
const polling_zip = /*#__PURE__*/(0,Function.dual)(2, (self, that) => ({
  [MetricPollingTypeId]: MetricPollingTypeId,
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  },
  metric: (0,Function.pipe)(self.metric, internal_metric/* .zip */.yU(that.metric)),
  poll: core/* .zip */.yU6(self.poll, that.poll)
}));
//# sourceMappingURL=polling.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricPolling.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricPolling_MetricPollingTypeId = MetricPollingTypeId;
/**
 * Constructs a new polling metric from a metric and poll effect.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricPolling_make = polling_make;
/**
 * Collects all of the polling metrics into a single polling metric, which
 * polls for, updates, and produces the outputs of all individual metrics.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricPolling_collectAll = collectAll;
/**
 * Returns an effect that will launch the polling metric in a background
 * fiber, using the specified schedule.
 *
 * @since 2.0.0
 * @category utils
 */
const MetricPolling_launch = launch;
/**
 * An effect that polls a value that may be fed to the metric.
 *
 * @since 2.0.0
 * @category utils
 */
const MetricPolling_poll = polling_poll;
/**
 * An effect that polls for a value and uses the value to update the metric.
 *
 * @since 2.0.0
 * @category utils
 */
const MetricPolling_pollAndUpdate = pollAndUpdate;
/**
 * Returns a new polling metric whose poll function will be retried with the
 * specified retry policy.
 *
 * @since 2.0.0
 * @category constructors
 */
const MetricPolling_retry = retry;
/**
 * Zips this polling metric with the specified polling metric.
 *
 * @since 2.0.0
 * @category utils
 */
const MetricPolling_zip = polling_zip;
//# sourceMappingURL=MetricPolling.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/registry.js
var registry = __webpack_require__(99307);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricRegistry.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricRegistryTypeId = registry/* .MetricRegistryTypeId */.p;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricRegistry_make = registry/* .make */.L;
//# sourceMappingURL=MetricRegistry.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/metric/state.js
var metric_state = __webpack_require__(55923);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MetricState.js

/**
 * @since 2.0.0
 * @category symbols
 */
const MetricStateTypeId = metric_state/* .MetricStateTypeId */.B7;
/**
 * @since 2.0.0
 * @category symbols
 */
const CounterStateTypeId = metric_state/* .CounterStateTypeId */.DX;
/**
 * @since 2.0.0
 * @category symbols
 */
const FrequencyStateTypeId = metric_state/* .FrequencyStateTypeId */.Hc;
/**
 * @since 2.0.0
 * @category symbols
 */
const GaugeStateTypeId = metric_state/* .GaugeStateTypeId */.iO;
/**
 * @since 2.0.0
 * @category symbols
 */
const HistogramStateTypeId = metric_state/* .HistogramStateTypeId */.ZN;
/**
 * @since 2.0.0
 * @category symbols
 */
const SummaryStateTypeId = metric_state/* .SummaryStateTypeId */.Xl;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricState_counter = metric_state/* .counter */.hJ;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricState_frequency = metric_state/* .frequency */.X7;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricState_gauge = metric_state/* .gauge */.uI;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricState_histogram = metric_state/* .histogram */.JW;
/**
 * @since 2.0.0
 * @category constructors
 */
const MetricState_summary = metric_state/* .summary */.z;
/**
 * @since 2.0.0
 * @category refinements
 */
const isMetricState = metric_state/* .isMetricState */.mp;
/**
 * @since 2.0.0
 * @category refinements
 */
const isCounterState = metric_state/* .isCounterState */._8;
/**
 * @since 2.0.0
 * @category refinements
 */
const isFrequencyState = metric_state/* .isFrequencyState */.yn;
/**
 * @since 2.0.0
 * @category refinements
 */
const isGaugeState = metric_state/* .isGaugeState */.Dd;
/**
 * @since 2.0.0
 * @category refinements
 */
const isHistogramState = metric_state/* .isHistogramState */.WP;
/**
 * @since 2.0.0
 * @category refinements
 */
const isSummaryState = metric_state/* .isSummaryState */.EL;
//# sourceMappingURL=MetricState.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Micro.js
var Micro = __webpack_require__(59235);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/version.js
var version = __webpack_require__(70169);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ModuleVersion.js
/**
 * @since 2.0.0
 *
 * Enables low level framework authors to run on their own isolated effect version
 */

/**
 * @since 2.0.0
 * @category version
 */
const getCurrentVersion = version/* .getCurrentVersion */.M;
/**
 * @since 2.0.0
 * @category version
 */
const setCurrentVersion = version/* .setCurrentVersion */.s;
//# sourceMappingURL=ModuleVersion.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableHashSet.js
/**
 * # MutableHashSet
 *
 * A mutable `MutableHashSet` provides a collection of unique values with
 * efficient lookup, insertion and removal. Unlike its immutable sibling
 * {@link module:HashSet}, a `MutableHashSet` can be modified in-place;
 * operations like add, remove, and clear directly modify the original set
 * rather than creating a new one. This mutability offers benefits like improved
 * performance in scenarios where you need to build or modify a set
 * incrementally.
 *
 * ## What Problem Does It Solve?
 *
 * `MutableHashSet` solves the problem of maintaining an unsorted collection
 * where each value appears exactly once, with fast operations for checking
 * membership and adding/removing values, in contexts where mutability is
 * preferred for performance or implementation simplicity.
 *
 * ## When to Use
 *
 * Use `MutableHashSet` when you need:
 *
 * - A collection with no duplicate values
 * - Efficient membership testing (**`O(1)`** average complexity)
 * - In-place modifications for better performance
 * - A set that will be built or modified incrementally
 * - Local mutability in otherwise immutable code
 *
 * ## Advanced Features
 *
 * MutableHashSet provides operations for:
 *
 * - Adding and removing elements with direct mutation
 * - Checking for element existence
 * - Clearing all elements at once
 * - Converting to/from other collection types
 *
 * ## Performance Characteristics
 *
 * - **Lookup** operations ({@link module:MutableHashSet.has}): **`O(1)`** average
 *   time complexity
 * - **Insertion** operations ({@link module:MutableHashSet.add}): **`O(1)`**
 *   average time complexity
 * - **Removal** operations ({@link module:MutableHashSet.remove}): **`O(1)`**
 *   average time complexity
 * - **Iteration**: **`O(n)`** where n is the size of the set
 *
 * The MutableHashSet data structure implements the following traits:
 *
 * - {@link Iterable}: allows iterating over the values in the set
 * - {@link Pipeable}: allows chaining operations with the pipe operator
 * - {@link Inspectable}: allows inspecting the contents of the set
 *
 * ## Operations Reference
 *
 * | Category     | Operation                                  | Description                         | Complexity |
 * | ------------ | ------------------------------------------ | ----------------------------------- | ---------- |
 * | constructors | {@link module:MutableHashSet.empty}        | Creates an empty MutableHashSet     | O(1)       |
 * | constructors | {@link module:MutableHashSet.fromIterable} | Creates a set from an iterable      | O(n)       |
 * | constructors | {@link module:MutableHashSet.make}         | Creates a set from multiple values  | O(n)       |
 * |              |                                            |                                     |            |
 * | elements     | {@link module:MutableHashSet.has}          | Checks if a value exists in the set | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.add}          | Adds a value to the set             | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.remove}       | Removes a value from the set        | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.size}         | Gets the number of elements         | O(1)       |
 * | elements     | {@link module:MutableHashSet.clear}        | Removes all values from the set     | O(1)       |
 *
 * ## Notes
 *
 * ### Mutability Considerations:
 *
 * Unlike most data structures in the Effect ecosystem, `MutableHashSet` is
 * mutable. This means that operations like `add`, `remove`, and `clear` modify
 * the original set rather than creating a new one. This can lead to more
 * efficient code in some scenarios, but requires careful handling to avoid
 * unexpected side effects.
 *
 * ### When to Choose `MutableHashSet` vs {@link module:HashSet}:
 *
 * - Use `MutableHashSet` when you need to build or modify a set incrementally and
 *   performance is a priority
 * - Use `HashSet` when you want immutability guarantees and functional
 *   programming patterns
 * - Consider using {@link module:HashSet}'s bounded mutation context (via
 *   {@link module:HashSet.beginMutation}, {@link module:HashSet.endMutation}, and
 *   {@link module:HashSet.mutate} methods) when you need temporary mutability
 *   within an otherwise immutable context - this approach might be sufficient
 *   for many use cases without requiring a separate `MutableHashSet`
 * - `MutableHashSet` is often useful for local operations where the mutability is
 *   contained and doesn't leak into the broader application
 *
 * @module MutableHashSet
 * @since 2.0.0
 */




const MutableHashSet_TypeId = /*#__PURE__*/Symbol.for("effect/MutableHashSet");
const MutableHashSetProto = {
  [MutableHashSet_TypeId]: MutableHashSet_TypeId,
  [Symbol.iterator]() {
    return Array.from(this.keyMap).map(([_]) => _)[Symbol.iterator]();
  },
  toString() {
    return (0,Inspectable.format)(this.toJSON());
  },
  toJSON() {
    return {
      _id: "MutableHashSet",
      values: Array.from(this).map(Inspectable.toJSON)
    };
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const fromHashMap = keyMap => {
  const set = Object.create(MutableHashSetProto);
  set.keyMap = keyMap;
  return set;
};
/**
 * Creates an empty mutable hash set.
 *
 * This function initializes and returns an empty `MutableHashSet` instance,
 * which allows for efficient storage and manipulation of unique elements.
 *
 * Time complexity: **`O(1)`**
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category constructors
 * @example
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 *
 * type T = unknown // replace with your type
 *
 * // in places where the type can't be inferred, replace with your type
 * const set: MutableHashSet.MutableHashSet<T> = MutableHashSet.empty<T>()
 * ```
 *
 * @template K - The type of the elements to be stored in the hash set. Defaults
 *   to `never` if not specified.
 * @returns A new mutable instance of `MutableHashSet` containing no elements
 *   for the specified type `K`.
 * @see Other `MutableHashSet` constructors are {@link module:MutableHashSet.make} {@link module:MutableHashSet.fromIterable}
 */
const empty = () => fromHashMap(MutableHashMap.empty());
/**
 * Creates a new `MutableHashSet` from an iterable collection of values.
 * Duplicate values are omitted.
 *
 * Time complexity: **`O(n)`** where n is the number of elements in the iterable
 *
 * Creating a `MutableHashSet` from an {@link Array}
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 *
 * const array: Iterable<number> = [1, 2, 3, 4, 5, 1, 2, 3] // Array<T> is also Iterable<T>
 * const mutableHashSet: MutableHashSet.MutableHashSet<number> =
 *   MutableHashSet.fromIterable(array)
 *
 * console.log(
 *   // MutableHashSet.MutableHashSet<T> is also an Iterable<T>
 *   Array.from(mutableHashSet)
 * ) // Output: [1, 2, 3, 4, 5]
 * ```
 *
 * Creating a `MutableHashSet` from a {@link Set}
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 *
 * console.log(
 *   pipe(
 *     // Set<string> is an Iterable<string>
 *     new Set(["apple", "banana", "orange", "apple"]),
 *     // constructs MutableHashSet from an Iterable Set
 *     MutableHashSet.fromIterable,
 *     // since MutableHashSet it is itself an Iterable, we can pass it to other functions expecting an Iterable
 *     Array.from
 *   )
 * ) // Output: ["apple", "banana", "orange"]
 * ```
 *
 * Creating a `MutableHashSet` from a {@link Generator}
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 *
 * // Generator functions return iterables
 * function* fibonacci(n: number): Generator<number, void, never> {
 *   let [a, b] = [0, 1]
 *   for (let i = 0; i < n; i++) {
 *     yield a
 *     ;[a, b] = [b, a + b]
 *   }
 * }
 *
 * // Create a MutableHashSet from the first 10 Fibonacci numbers
 * const fibonacciSet = MutableHashSet.fromIterable(fibonacci(10))
 *
 * console.log(Array.from(fibonacciSet))
 * // Outputs: [0, 1, 2, 3, 5, 8, 13, 21, 34] but in unsorted order
 * ```
 *
 * Creating a `MutableHashSet` from another {@link module:MutableHashSet}
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 *
 * console.log(
 *   pipe(
 *     MutableHashSet.make(1, 2, 3, 4),
 *     MutableHashSet.fromIterable,
 *     Array.from
 *   )
 * ) // Output: [1, 2, 3, 4]
 * ```
 *
 * Creating a `MutableHashSet` from an {@link module:HashSet}
 *
 * ```ts
 * import { HashSet, MutableHashSet, pipe } from "effect"
 *
 * console.log(
 *   pipe(
 *     HashSet.make(1, 2, 3, 4), // it works also with its immutable HashSet sibling
 *     MutableHashSet.fromIterable,
 *     Array.from
 *   )
 * ) // Output: [1, 2, 3, 4]
 * ```
 *
 * Creating a `MutableHashSet` from other Effect's data structures like
 * {@link Chunk}
 *
 * ```ts
 * import { Chunk, MutableHashSet, pipe } from "effect"
 *
 * console.log(
 *   pipe(
 *     Chunk.make(1, 2, 3, 4), //  Chunk is also an Iterable<T>
 *     MutableHashSet.fromIterable,
 *     Array.from
 *   )
 * ) // Outputs: [1, 2, 3, 4]
 * ```
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category constructors
 * @template K - The type of elements to be stored in the resulting
 *   `MutableHashSet`.
 * @param keys - An `Iterable` collection containing the keys to be added to the
 *   `MutableHashSet`.
 * @returns A new `MutableHashSet` containing just the unique elements from the
 *   provided iterable.
 * @see Other `MutableHashSet` constructors are {@link module:MutableHashSet.empty} {@link module:MutableHashSet.make}
 */
const MutableHashSet_fromIterable = keys => fromHashMap(MutableHashMap.fromIterable(Array.from(keys).map(k => [k, true])));
/**
 * Construct a new `MutableHashSet` from a variable number of values.
 *
 * Time complexity: **`O(n)`** where n is the number of elements
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category constructors
 * @example
 *
 * ```ts
 * import { Equal, Hash, MutableHashSet } from "effect"
 * import assert from "node:assert/strict"
 *
 * class Character implements Equal.Equal {
 *   readonly name: string
 *   readonly trait: string
 *
 *   constructor(name: string, trait: string) {
 *     this.name = name
 *     this.trait = trait
 *   }
 *
 *   // Define equality based on name, and trait
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     if (that instanceof Character) {
 *       return (
 *         Equal.equals(this.name, that.name) &&
 *         Equal.equals(this.trait, that.trait)
 *       )
 *     }
 *     return false
 *   }
 *
 *   // Generate a hash code based on the sum of the character's name and trait
 *   [Hash.symbol](): number {
 *     return Hash.hash(this.name + this.trait)
 *   }
 *
 *   static readonly of = (name: string, trait: string): Character => {
 *     return new Character(name, trait)
 *   }
 * }
 *
 * const mutableCharacterHashSet = MutableHashSet.make(
 *   Character.of("Alice", "Curious"),
 *   Character.of("Alice", "Curious"),
 *   Character.of("White Rabbit", "Always late"),
 *   Character.of("Mad Hatter", "Tea enthusiast")
 * )
 *
 * assert.equal(
 *   MutableHashSet.has(
 *     mutableCharacterHashSet,
 *     Character.of("Alice", "Curious")
 *   ),
 *   true
 * )
 * assert.equal(
 *   MutableHashSet.has(
 *     mutableCharacterHashSet,
 *     Character.of("Fluffy", "Kind")
 *   ),
 *   false
 * )
 * ```
 *
 * @see Other `MutableHashSet` constructors are {@link module:MutableHashSet.fromIterable} {@link module:MutableHashSet.empty}
 */
const MutableHashSet_make = (...keys) => MutableHashSet_fromIterable(keys);
/**
 * **Checks** whether the `MutableHashSet` contains the given element, and
 * **adds** it if not.
 *
 * Time complexity: **`O(1)`** average
 *
 * **Syntax**
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 *
 * // with data-last, a.k.a. pipeable API
 * pipe(
 *   MutableHashSet.empty(),
 *   MutableHashSet.add(0),
 *   MutableHashSet.add(0)
 * )
 *
 * // or piped with the pipe function
 * MutableHashSet.empty().pipe(MutableHashSet.add(0))
 *
 * // or with data-first API
 * MutableHashSet.add(MutableHashSet.empty(), 0)
 * ```
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category elements
 * @see Other `MutableHashSet` elements are {@link module:MutableHashSet.remove} {@link module:MutableHashSet.size} {@link module:MutableHashSet.clear} {@link module:MutableHashSet.has}
 */
const MutableHashSet_add = /*#__PURE__*/Function.dual(2, (self, key) => (MutableHashMap.set(self.keyMap, key, true), self));
/**
 * Checks if the specified value exists in the `MutableHashSet`.
 *
 * Time complexity: `O(1)` average
 *
 * **Syntax**
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 * import assert from "node:assert/strict"
 *
 * assert.equal(
 *   // with `data-last`, a.k.a. `pipeable` API
 *   pipe(MutableHashSet.make(0, 1, 2), MutableHashSet.has(3)),
 *   false
 * )
 *
 * assert.equal(
 *   // or piped with the pipe function
 *   MutableHashSet.make(0, 1, 2).pipe(MutableHashSet.has(3)),
 *   false
 * )
 *
 * assert.equal(
 *   // or with `data-first` API
 *   MutableHashSet.has(MutableHashSet.make(0, 1, 2), 3),
 *   false
 * )
 * ```
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category elements
 * @see Other `MutableHashSet` elements are {@link module:MutableHashSet.add} {@link module:MutableHashSet.remove} {@link module:MutableHashSet.size} {@link module:MutableHashSet.clear}
 */
const MutableHashSet_has = /*#__PURE__*/Function.dual(2, (self, key) => MutableHashMap.has(self.keyMap, key));
/**
 * Removes a value from the `MutableHashSet`.
 *
 * Time complexity: **`O(1)`** average
 *
 * **Syntax**
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 * import assert from "node:assert/strict"
 *
 * assert.equal(
 *   // with `data-last`, a.k.a. `pipeable` API
 *   pipe(
 *     MutableHashSet.make(0, 1, 2),
 *     MutableHashSet.remove(0),
 *     MutableHashSet.has(0)
 *   ),
 *   false
 * )
 *
 * assert.equal(
 *   // or piped with the pipe function
 *   MutableHashSet.make(0, 1, 2).pipe(
 *     MutableHashSet.remove(0),
 *     MutableHashSet.has(0)
 *   ),
 *   false
 * )
 *
 * assert.equal(
 *   // or with `data-first` API
 *   MutableHashSet.remove(MutableHashSet.make(0, 1, 2), 0).pipe(
 *     MutableHashSet.has(0)
 *   ),
 *   false
 * )
 * ```
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category elements
 * @see Other `MutableHashSet` elements are {@link module:MutableHashSet.add} {@link module:MutableHashSet.has} {@link module:MutableHashSet.size} {@link module:MutableHashSet.clear}
 */
const MutableHashSet_remove = /*#__PURE__*/Function.dual(2, (self, key) => (MutableHashMap.remove(self.keyMap, key), self));
/**
 * Calculates the number of values in the `HashSet`.
 *
 * Time complexity: **`O(1)`**
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category elements
 * @example
 *
 * ```ts
 * import { MutableHashSet } from "effect"
 * import assert from "node:assert/strict"
 *
 * assert.equal(MutableHashSet.size(MutableHashSet.empty()), 0)
 *
 * assert.equal(
 *   MutableHashSet.size(MutableHashSet.make(1, 2, 2, 3, 4, 3)),
 *   4
 * )
 * ```
 *
 * @template V - The type of the elements to be stored in the `MutableHashSet`.
 * @param self - The `MutableHashSet` instance for which the size is to be
 *   determined.
 * @returns The total number of elements within the `MutableHashSet`.
 * @see Other `MutableHashSet` elements are {@link module:MutableHashSet.add} {@link module:MutableHashSet.has} {@link module:MutableHashSet.remove} {@link module:MutableHashSet.clear}
 */
const MutableHashSet_size = self => MutableHashMap.size(self.keyMap);
/**
 * Removes all values from the `MutableHashSet`.
 *
 * This function operates by delegating the clearing action to the underlying
 * key map associated with the given `MutableHashSet`. It ensures that the hash
 * set becomes empty while maintaining its existence and structure.
 *
 * @memberof MutableHashSet
 * @since 2.0.0
 * @category elements
 * @example
 *
 * ```ts
 * import { MutableHashSet, pipe } from "effect"
 * import assert from "node:assert/strict"
 *
 * assert.deepStrictEqual(
 *   pipe(
 *     MutableHashSet.make(1, 2, 3, 4),
 *     MutableHashSet.clear,
 *     MutableHashSet.size
 *   ),
 *   0
 * )
 * ```
 *
 * @param self - The `MutableHashSet` to clear.
 * @returns The same `MutableHashSet` after all elements have been removed.
 * @see Other `MutableHashSet` elements are {@link module:MutableHashSet.add} {@link module:MutableHashSet.has} {@link module:MutableHashSet.remove} {@link module:MutableHashSet.size}
 */
const MutableHashSet_clear = self => (MutableHashMap.clear(self.keyMap), self);
//# sourceMappingURL=MutableHashSet.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableList.js
var MutableList = __webpack_require__(58601);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/MutableQueue.js
var MutableQueue = __webpack_require__(43070);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/NonEmptyIterable.js
/**
 * @since 2.0.0
 */
/**
 * @category getters
 * @since 2.0.0
 */
const unprepend = self => {
  const iterator = self[Symbol.iterator]();
  const next = iterator.next();
  if (next.done) {
    throw new Error("BUG: NonEmptyIterator should not be empty - please report an issue at https://github.com/Effect-TS/effect/issues");
  }
  return [next.value, iterator];
};
//# sourceMappingURL=NonEmptyIterable.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Number.js
var esm_Number = __webpack_require__(15618);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Order.js
var Order = __webpack_require__(91599);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Ordering.js

/**
 * Inverts the ordering of the input `Ordering`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { reverse } from "effect/Ordering"
 *
 * assert.deepStrictEqual(reverse(1), -1)
 * assert.deepStrictEqual(reverse(-1), 1)
 * assert.deepStrictEqual(reverse(0), 0)
 * ```
 *
 * @since 2.0.0
 */
const Ordering_reverse = o => o === -1 ? 1 : o === 1 ? -1 : 0;
/**
 * Depending on the `Ordering` parameter given to it, returns a value produced by one of the 3 functions provided as parameters.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Ordering } from "effect"
 * import { constant } from "effect/Function"
 *
 * const toMessage = Ordering.match({
 *   onLessThan: constant('less than'),
 *   onEqual: constant('equal'),
 *   onGreaterThan: constant('greater than')
 * })
 *
 * assert.deepStrictEqual(toMessage(-1), "less than")
 * assert.deepStrictEqual(toMessage(0), "equal")
 * assert.deepStrictEqual(toMessage(1), "greater than")
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
 */
const Ordering_match = /*#__PURE__*/(0,Function.dual)(2, (self, {
  onEqual,
  onGreaterThan,
  onLessThan
}) => self === -1 ? onLessThan() : self === 0 ? onEqual() : onGreaterThan());
/**
 * @category combining
 * @since 2.0.0
 */
const Ordering_combine = /*#__PURE__*/(0,Function.dual)(2, (self, that) => self !== 0 ? self : that);
/**
 * @category combining
 * @since 2.0.0
 */
const combineMany = /*#__PURE__*/(0,Function.dual)(2, (self, collection) => {
  let ordering = self;
  if (ordering !== 0) {
    return ordering;
  }
  for (ordering of collection) {
    if (ordering !== 0) {
      return ordering;
    }
  }
  return ordering;
});
/**
 * @category combining
 * @since 2.0.0
 */
const combineAll = collection => combineMany(0, collection);
//# sourceMappingURL=Ordering.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ParseResult.js
var ParseResult = __webpack_require__(57529);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/PartitionedSemaphore.js
/**
 * @since 3.19.4
 * @experimental
 */




/**
 * @since 3.19.4
 * @category Models
 * @experimental
 */
const PartitionedSemaphore_TypeId = "~effect/PartitionedSemaphore";
/**
 * A `PartitionedSemaphore` is a concurrency primitive that can be used to
 * control concurrent access to a resource across multiple partitions identified
 * by keys.
 *
 * The total number of permits is shared across all partitions, with waiting
 * permits equally distributed among partitions using a round-robin strategy.
 *
 * This is useful when you want to limit the total number of concurrent accesses
 * to a resource, while still allowing for fair distribution of access across
 * different partitions.
 *
 * @since 3.19.4
 * @category Constructors
 * @experimental
 */
const makeUnsafe = options => {
  const maxPermits = Math.max(0, options.permits);
  if (!Number.isFinite(maxPermits)) {
    return {
      [PartitionedSemaphore_TypeId]: PartitionedSemaphore_TypeId,
      withPermits: () => effect => effect
    };
  }
  let totalPermits = maxPermits;
  let waitingPermits = 0;
  const partitions = MutableHashMap.empty();
  const take = (key, permits) => Effect.async(resume => {
    if (maxPermits < permits) {
      return resume(Effect.never);
    } else if (totalPermits >= permits) {
      totalPermits -= permits;
      return resume(Effect["void"]);
    }
    const needed = permits - totalPermits;
    const taken = permits - needed;
    if (totalPermits > 0) {
      totalPermits = 0;
    }
    waitingPermits += needed;
    const waiters = Option.getOrElse(MutableHashMap.get(partitions, key), () => {
      const set = new Set();
      MutableHashMap.set(partitions, key, set);
      return set;
    });
    const entry = {
      permits: needed,
      resume() {
        cleanup();
        resume(Effect["void"]);
      }
    };
    function cleanup() {
      waiters.delete(entry);
      if (waiters.size === 0) {
        MutableHashMap.remove(partitions, key);
      }
    }
    waiters.add(entry);
    return Effect.sync(() => {
      cleanup();
      waitingPermits -= entry.permits;
      if (taken > 0) {
        releaseUnsafe(taken);
      }
    });
  });
  let iterator = partitions[Symbol.iterator]();
  const releaseUnsafe = permits => {
    while (permits > 0) {
      if (waitingPermits === 0) {
        totalPermits += permits;
        return;
      }
      let state = iterator.next();
      if (state.done) {
        iterator = partitions[Symbol.iterator]();
        state = iterator.next();
        if (state.done) return;
      }
      const entry = Iterable.unsafeHead(state.value[1]);
      entry.permits--;
      waitingPermits--;
      if (entry.permits === 0) entry.resume();
      permits--;
    }
  };
  return {
    [PartitionedSemaphore_TypeId]: PartitionedSemaphore_TypeId,
    withPermits: (key, permits) => {
      const takePermits = take(key, permits);
      const release = Effect.matchCauseEffect({
        onFailure(cause) {
          releaseUnsafe(permits);
          return Effect.failCause(cause);
        },
        onSuccess(value) {
          releaseUnsafe(permits);
          return Effect.succeed(value);
        }
      });
      return effect => Effect.uninterruptibleMask(restore => Effect.flatMap(restore(takePermits), () => release(restore(effect))));
    }
  };
};
/**
 * A `PartitionedSemaphore` is a concurrency primitive that can be used to
 * control concurrent access to a resource across multiple partitions identified
 * by keys.
 *
 * The total number of permits is shared across all partitions, with waiting
 * permits equally distributed among partitions using a round-robin strategy.
 *
 * This is useful when you want to limit the total number of concurrent accesses
 * to a resource, while still allowing for fair distribution of access across
 * different partitions.
 *
 * @since 3.19.4
 * @category Constructors
 * @experimental
 */
const PartitionedSemaphore_make = options => Effect.sync(() => makeUnsafe(options));
//# sourceMappingURL=PartitionedSemaphore.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Pool.js
var Pool = __webpack_require__(57737);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Pretty.js
/**
 * @since 3.10.0
 */







/**
 * @category prettify
 * @since 3.10.0
 */
const Pretty_make = schema => compile(schema.ast, []);
const getPrettyAnnotation = /*#__PURE__*/SchemaAST.getAnnotation(SchemaAST.PrettyAnnotationId);
const getMatcher = defaultPretty => ast => Option.match(getPrettyAnnotation(ast), {
  onNone: () => defaultPretty,
  onSome: handler => handler()
});
const Pretty_toString = /*#__PURE__*/getMatcher(a => String(a));
const stringify = /*#__PURE__*/getMatcher(a => JSON.stringify(a));
const formatUnknown = /*#__PURE__*/getMatcher(Inspectable.formatUnknown);
/**
 * @since 3.10.0
 */
const Pretty_match = {
  "Declaration": (ast, go, path) => {
    const annotation = getPrettyAnnotation(ast);
    if (Option.isSome(annotation)) {
      return annotation.value(...ast.typeParameters.map(tp => go(tp, path)));
    }
    throw new Error(errors/* .getPrettyMissingAnnotationErrorMessage */.T5(path, ast));
  },
  "VoidKeyword": /*#__PURE__*/getMatcher(() => "void(0)"),
  "NeverKeyword": /*#__PURE__*/getMatcher(() => {
    throw new Error(errors/* .getPrettyNeverErrorMessage */.Kn);
  }),
  "Literal": /*#__PURE__*/getMatcher(literal => typeof literal === "bigint" ? `${String(literal)}n` : JSON.stringify(literal)),
  "SymbolKeyword": Pretty_toString,
  "UniqueSymbol": Pretty_toString,
  "TemplateLiteral": stringify,
  "UndefinedKeyword": Pretty_toString,
  "UnknownKeyword": formatUnknown,
  "AnyKeyword": formatUnknown,
  "ObjectKeyword": formatUnknown,
  "StringKeyword": stringify,
  "NumberKeyword": Pretty_toString,
  "BooleanKeyword": Pretty_toString,
  "BigIntKeyword": /*#__PURE__*/getMatcher(a => `${String(a)}n`),
  "Enums": stringify,
  "TupleType": (ast, go, path) => {
    const hook = getPrettyAnnotation(ast);
    if (Option.isSome(hook)) {
      return hook.value();
    }
    const elements = ast.elements.map((e, i) => go(e.type, path.concat(i)));
    const rest = ast.rest.map(annotatedAST => go(annotatedAST.type, path));
    return input => {
      const output = [];
      let i = 0;
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      for (; i < elements.length; i++) {
        if (input.length < i + 1) {
          if (ast.elements[i].isOptional) {
            continue;
          }
        } else {
          output.push(elements[i](input[i]));
        }
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      if (esm_Array.isNonEmptyReadonlyArray(rest)) {
        const [head, ...tail] = rest;
        for (; i < input.length - tail.length; i++) {
          output.push(head(input[i]));
        }
        // ---------------------------------------------
        // handle post rest elements
        // ---------------------------------------------
        for (let j = 0; j < tail.length; j++) {
          i += j;
          output.push(tail[j](input[i]));
        }
      }
      return "[" + output.join(", ") + "]";
    };
  },
  "TypeLiteral": (ast, go, path) => {
    const hook = getPrettyAnnotation(ast);
    if (Option.isSome(hook)) {
      return hook.value();
    }
    const propertySignaturesTypes = ast.propertySignatures.map(ps => go(ps.type, path.concat(ps.name)));
    const indexSignatureTypes = ast.indexSignatures.map(is => go(is.type, path));
    const expectedKeys = {};
    for (let i = 0; i < propertySignaturesTypes.length; i++) {
      expectedKeys[ast.propertySignatures[i].name] = null;
    }
    return input => {
      const output = [];
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      for (let i = 0; i < propertySignaturesTypes.length; i++) {
        const ps = ast.propertySignatures[i];
        const name = ps.name;
        if (ps.isOptional && !Object.prototype.hasOwnProperty.call(input, name)) {
          continue;
        }
        output.push(`${Inspectable.formatPropertyKey(name)}: ${propertySignaturesTypes[i](input[name])}`);
      }
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      if (indexSignatureTypes.length > 0) {
        for (let i = 0; i < indexSignatureTypes.length; i++) {
          const type = indexSignatureTypes[i];
          const keys = util/* .getKeysForIndexSignature */.SC(input, ast.indexSignatures[i].parameter);
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(expectedKeys, key)) {
              continue;
            }
            output.push(`${Inspectable.formatPropertyKey(key)}: ${type(input[key])}`);
          }
        }
      }
      return esm_Array.isNonEmptyReadonlyArray(output) ? "{ " + output.join(", ") + " }" : "{}";
    };
  },
  "Union": (ast, go, path) => {
    const hook = getPrettyAnnotation(ast);
    if (Option.isSome(hook)) {
      return hook.value();
    }
    const types = ast.types.map(ast => [ParseResult.is({
      ast
    }), go(ast, path)]);
    return a => {
      const index = types.findIndex(([is]) => is(a));
      if (index === -1) {
        throw new Error(errors/* .getPrettyNoMatchingSchemaErrorMessage */.vR(a, path, ast));
      }
      return types[index][1](a);
    };
  },
  "Suspend": (ast, go, path) => {
    return Option.match(getPrettyAnnotation(ast), {
      onNone: () => {
        const get = util/* .memoizeThunk */.Z4(() => go(ast.f(), path));
        return a => get()(a);
      },
      onSome: handler => handler()
    });
  },
  "Refinement": (ast, go, path) => {
    return Option.match(getPrettyAnnotation(ast), {
      onNone: () => go(ast.from, path),
      onSome: handler => handler()
    });
  },
  "Transformation": (ast, go, path) => {
    return Option.match(getPrettyAnnotation(ast), {
      onNone: () => go(ast.to, path),
      onSome: handler => handler()
    });
  }
};
const compile = /*#__PURE__*/SchemaAST.getCompiler(Pretty_match);
//# sourceMappingURL=Pretty.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/PubSub.js + 1 modules
var PubSub = __webpack_require__(81443);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Queue.js
var Queue = __webpack_require__(98956);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Random.js
var Random = __webpack_require__(24300);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/rateLimiter.js





/** @internal */
const rateLimiter_make = ({
  algorithm = "token-bucket",
  interval,
  limit
}) => {
  switch (algorithm) {
    case "fixed-window":
      {
        return fixedWindow(limit, interval);
      }
    case "token-bucket":
      {
        return tokenBucket(limit, interval);
      }
  }
};
const tokenBucket = (limit, window) => Effect.gen(function* () {
  const millisPerToken = Math.ceil(Duration.toMillis(window) / limit);
  const semaphore = yield* Effect.makeSemaphore(limit);
  const latch = yield* Effect.makeSemaphore(0);
  const refill = Effect.sleep(millisPerToken).pipe(Effect.zipRight(latch.releaseAll), Effect.zipRight(semaphore.release(1)), Effect.flatMap(free => free === limit ? Effect["void"] : refill));
  yield* (0,Function.pipe)(latch.take(1), Effect.zipRight(refill), Effect.forever, Effect.forkScoped, Effect.interruptible);
  const take = Effect.uninterruptibleMask(restore => Effect.flatMap(FiberRef.get(currentCost), cost => Effect.zipRight(restore(semaphore.take(cost)), latch.release(1))));
  return effect => Effect.zipRight(take, effect);
});
const fixedWindow = (limit, window) => Effect.gen(function* () {
  const semaphore = yield* Effect.makeSemaphore(limit);
  const latch = yield* Effect.makeSemaphore(0);
  yield* (0,Function.pipe)(latch.take(1), Effect.zipRight(Effect.sleep(window)), Effect.zipRight(latch.releaseAll), Effect.zipRight(semaphore.releaseAll), Effect.forever, Effect.forkScoped, Effect.interruptible);
  const take = Effect.uninterruptibleMask(restore => Effect.flatMap(FiberRef.get(currentCost), cost => Effect.zipRight(restore(semaphore.take(cost)), latch.release(1))));
  return effect => Effect.zipRight(take, effect);
});
/** @internal */
const currentCost = /*#__PURE__*/(0,GlobalValue.globalValue)(/*#__PURE__*/Symbol.for("effect/RateLimiter/currentCost"), () => FiberRef.unsafeMake(1));
/** @internal */
const withCost = cost => Effect.locally(currentCost, cost);
//# sourceMappingURL=rateLimiter.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RateLimiter.js

/**
 * Constructs a new `RateLimiter` which will utilize the specified algorithm
 * to limit requests (defaults to `token-bucket`).
 *
 * Notes
 * - Only the moment of starting the effect is rate limited. The number of concurrent executions is not bounded.
 * - Instances of `RateLimiter` can be composed.
 * - The "cost" per effect can be changed. See {@link withCost}
 *
 * @example
 * ```ts
 * import { Effect, RateLimiter } from "effect";
 * import { compose } from "effect/Function"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function* ($) {
 *     const perMinuteRL = yield* $(RateLimiter.make({ limit: 30, interval: "1 minutes" }))
 *     const perSecondRL = yield* $(RateLimiter.make({ limit: 2, interval: "1 seconds" }))
 *
 *     // This rate limiter respects both the 30 calls per minute
 *     // and the 2 calls per second constraints.
 *      const rateLimit = compose(perMinuteRL, perSecondRL)
 *
 *     // simulate repeated calls
 *     for (let n = 0; n < 100; n++) {
 *       // wrap the effect we want to limit with rateLimit
 *       yield* $(rateLimit(Effect.log("Calling RateLimited Effect")));
 *     }
 *   })
 * );
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const RateLimiter_make = rateLimiter_make;
/**
 * Alters the per-effect cost of the rate-limiter.
 *
 * This can be used for "credit" based rate-limiting where different API endpoints
 * cost a different number of credits within a time window.
 * Eg: 1000 credits / hour, where a query costs 1 credit and a mutation costs 5 credits.
 *
 * @example
 * ```ts
 * import { Effect, RateLimiter } from "effect";
 * import { compose } from "effect/Function";
 *
 * const program = Effect.scoped(
 *   Effect.gen(function* ($) {
 *     // Create a rate limiter that has an hourly limit of 1000 credits
 *     const rateLimiter = yield* $(RateLimiter.make({ limit: 1000, interval: "1 hours" }));
 *     // Query API costs 1 credit per call ( 1 is the default cost )
 *     const queryAPIRL = compose(rateLimiter, RateLimiter.withCost(1));
 *     // Mutation API costs 5 credits per call
 *     const mutationAPIRL = compose(rateLimiter, RateLimiter.withCost(5));

 *     // Use the pre-defined rate limiters
 *     yield* $(queryAPIRL(Effect.log("Sample Query")));
 *     yield* $(mutationAPIRL(Effect.log("Sample Mutation")));
 *
 *     // Or set a cost on-the-fly
 *     yield* $(
 *       rateLimiter(Effect.log("Another query with a different cost")).pipe(
 *         RateLimiter.withCost(3)
 *       )
 *     );
 *   })
 * );
 * ```
 *
 * @since 2.0.0
 * @category combinators
 */
const RateLimiter_withCost = withCost;
//# sourceMappingURL=RateLimiter.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RcRef.js + 1 modules
var RcRef = __webpack_require__(5241);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Readable.js
var Readable = __webpack_require__(67531);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Record.js
var Record = __webpack_require__(13878);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RedBlackTree.js + 3 modules
var RedBlackTree = __webpack_require__(63395);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Redacted.js
var Redacted = __webpack_require__(66707);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Ref.js
var Ref = __webpack_require__(83614);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RegExp.js
var esm_RegExp = __webpack_require__(57150);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/effectable.js
var effectable = __webpack_require__(99312);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/ref.js
var internal_ref = __webpack_require__(26576);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/synchronizedRef.js
var synchronizedRef = __webpack_require__(33546);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/scopedRef.js








/** @internal */
const ScopedRefSymbolKey = "effect/ScopedRef";
/** @internal */
const ScopedRefTypeId = /*#__PURE__*/Symbol.for(ScopedRefSymbolKey);
/** @internal */
const scopedRefVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal  */
const proto = {
  ...effectable/* .CommitPrototype */.Em,
  commit() {
    return scopedRef_get(this);
  },
  [ScopedRefTypeId]: scopedRefVariance
};
/** @internal  */
const scopedRef_close = self => core/* .flatMap */.qIB(internal_ref/* .get */.Jt(self.ref), tuple => tuple[0].close(core/* .exitVoid */.x5l));
/** @internal */
const fromAcquire = acquire => core/* .uninterruptible */.rfi(fiberRuntime/* .scopeMake */.RW().pipe(core/* .flatMap */.qIB(newScope => acquire.pipe(core/* .mapInputContext */.kyh(Context.add(fiberRuntime/* .scopeTag */.DL, newScope)), core/* .onError */.S5A(cause => newScope.close(core/* .exitFail */.Rkt(cause))), core/* .flatMap */.qIB(value => circular/* .makeSynchronized */.PJ([newScope, value]).pipe(core/* .flatMap */.qIB(ref => {
  const scopedRef = Object.create(proto);
  scopedRef.ref = ref;
  return (0,Function.pipe)(fiberRuntime/* .addFinalizer */.U9(() => scopedRef_close(scopedRef)), core.as(scopedRef));
})))))));
/** @internal */
const scopedRef_get = self => core/* .map */.TjK(internal_ref/* .get */.Jt(self.ref), tuple => tuple[1]);
/** @internal */
const scopedRef_make = evaluate => fromAcquire(core/* .sync */.OH5(evaluate));
/** @internal */
const scopedRef_set = /*#__PURE__*/(0,Function.dual)(2, (self, acquire) => core/* .flatten */.Bqz(synchronizedRef/* .modifyEffect */.Gt(self.ref, ([oldScope, value]) => core/* .uninterruptible */.rfi(core/* .scopeClose */.vDJ(oldScope, core/* .exitVoid */.x5l).pipe(core/* .zipRight */.aNH(fiberRuntime/* .scopeMake */.RW()), core/* .flatMap */.qIB(newScope => core/* .exit */.NS5(fiberRuntime/* .scopeExtend */.v_(acquire, newScope)).pipe(core/* .flatMap */.qIB(exit => core/* .exitMatch */.Wtn(exit, {
  onFailure: cause => core/* .scopeClose */.vDJ(newScope, core/* .exitVoid */.x5l).pipe(core.as([core/* .failCause */.ATB(cause), [oldScope, value]])),
  onSuccess: value => core/* .succeed */.PyW([core/* ["void"] */.rIH, [newScope, value]])
})))))))));
//# sourceMappingURL=scopedRef.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/reloadable.js








/** @internal */
const ReloadableSymbolKey = "effect/Reloadable";
/** @internal */
const ReloadableTypeId = /*#__PURE__*/Symbol.for(ReloadableSymbolKey);
const reloadableVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
const auto = (tag, options) => internal_layer/* .scoped */.P1(reloadableTag(tag), (0,Function.pipe)(internal_layer/* .build */.jq(reloadable_manual(tag, {
  layer: options.layer
})), core/* .map */.TjK(Context.unsafeGet(reloadableTag(tag))), core/* .tap */.Mim(reloadable => fiberRuntime/* .acquireRelease */.Q5((0,Function.pipe)(reloadable.reload, core_effect/* .ignoreLogged */.XP, internal_schedule/* .schedule_Effect */.mg(options.schedule), fiberRuntime/* .forkDaemon */.LX), core/* .interruptFiber */.OLv))));
/** @internal */
const autoFromConfig = (tag, options) => internal_layer/* .scoped */.P1(reloadableTag(tag), (0,Function.pipe)(core/* .context */._OA(), core/* .flatMap */.qIB(env => (0,Function.pipe)(internal_layer/* .build */.jq(auto(tag, {
  layer: options.layer,
  schedule: options.scheduleFromConfig(env)
})), core/* .map */.TjK(Context.unsafeGet(reloadableTag(tag)))))));
/** @internal */
const reloadable_get = tag => core/* .flatMap */.qIB(reloadableTag(tag), reloadable => scopedRef_get(reloadable.scopedRef));
/** @internal */
const reloadable_manual = (tag, options) => internal_layer/* .scoped */.P1(reloadableTag(tag), (0,Function.pipe)(core/* .context */._OA(), core/* .flatMap */.qIB(env => (0,Function.pipe)(fromAcquire((0,Function.pipe)(internal_layer/* .build */.jq(options.layer), core/* .map */.TjK(Context.unsafeGet(tag)))), core/* .map */.TjK(ref => ({
  [ReloadableTypeId]: reloadableVariance,
  scopedRef: ref,
  reload: (0,Function.pipe)(scopedRef_set(ref, (0,Function.pipe)(internal_layer/* .build */.jq(options.layer), core/* .map */.TjK(Context.unsafeGet(tag)))), core/* .provideContext */.PpN(env))
}))))));
/** @internal */
const reloadableTag = tag => {
  return Context.GenericTag(`effect/Reloadable<${tag.key}>`);
};
/** @internal */
const reload = tag => core/* .flatMap */.qIB(reloadableTag(tag), reloadable => reloadable.reload);
/** @internal */
const reloadFork = tag => core/* .flatMap */.qIB(reloadableTag(tag), reloadable => (0,Function.pipe)(reloadable.reload, core_effect/* .ignoreLogged */.XP, fiberRuntime/* .forkDaemon */.LX, core/* .asVoid */.NLW));
//# sourceMappingURL=reloadable.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Reloadable.js

/**
 * @since 2.0.0
 * @category symbols
 */
const Reloadable_ReloadableTypeId = ReloadableTypeId;
/**
 * Makes a new reloadable service from a layer that describes the construction
 * of a static service. The service is automatically reloaded according to the
 * provided schedule.
 *
 * @since 2.0.0
 * @category constructors
 */
const Reloadable_auto = auto;
/**
 * Makes a new reloadable service from a layer that describes the construction
 * of a static service. The service is automatically reloaded according to a
 * schedule, which is extracted from the input to the layer.
 *
 * @since 2.0.0
 * @category constructors
 */
const Reloadable_autoFromConfig = autoFromConfig;
/**
 * Retrieves the current version of the reloadable service.
 *
 * @since 2.0.0
 * @category getters
 */
const Reloadable_get = reloadable_get;
/**
 * Makes a new reloadable service from a layer that describes the construction
 * of a static service.
 *
 * @since 2.0.0
 * @category constructors
 */
const Reloadable_manual = reloadable_manual;
/**
 * Reloads the specified service.
 *
 * @since 2.0.0
 * @category constructors
 */
const Reloadable_reload = reload;
/**
 * @since 2.0.0
 * @category context
 */
const Reloadable_tag = reloadableTag;
/**
 * Forks the reload of the service in the background, ignoring any errors.
 *
 * @since 2.0.0
 * @category constructors
 */
const Reloadable_reloadFork = reloadFork;
//# sourceMappingURL=Reloadable.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Request.js
var Request = __webpack_require__(54698);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/blockedRequests.js
var blockedRequests = __webpack_require__(1511);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RequestBlock.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category constructors
 */
const single = blockedRequests/* .single */.J0;
/**
 * @since 2.0.0
 * @category constructors
 */
const RequestBlock_empty = blockedRequests/* .empty */.Ie;
/**
 * @since 2.0.0
 * @category constructors
 */
const mapRequestResolvers = blockedRequests/* .mapRequestResolvers */.Zo;
/**
 * @since 2.0.0
 * @category constructors
 */
const parallel = blockedRequests/* .par */.eM;
/**
 * @since 2.0.0
 * @category constructors
 */
const reduce = blockedRequests/* .reduce */.TS;
/**
 * @since 2.0.0
 * @category constructors
 */
const sequential = blockedRequests/* .seq */.O6;
//# sourceMappingURL=RequestBlock.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RequestResolver.js + 1 modules
var RequestResolver = __webpack_require__(39750);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/resource.js






/** @internal */
const ResourceSymbolKey = "effect/Resource";
/** @internal */
const ResourceTypeId = /*#__PURE__*/Symbol.for(ResourceSymbolKey);
const resourceVariance = {
  /* c8 ignore next */
  _E: _ => _,
  /* c8 ignore next */
  _A: _ => _
};
/** @internal  */
const resource_proto = {
  ...effectable/* .CommitPrototype */.Em,
  commit() {
    return resource_get(this);
  },
  [ResourceTypeId]: resourceVariance
};
/** @internal */
const resource_auto = (acquire, policy) => core/* .tap */.Mim(resource_manual(acquire), manual => fiberRuntime/* .acquireRelease */.Q5((0,Function.pipe)(refresh(manual), internal_schedule/* .schedule_Effect */.mg(policy), core/* .interruptible */.Inz, fiberRuntime/* .forkDaemon */.LX), core/* .interruptFiber */.OLv));
/** @internal */
const resource_manual = acquire => core/* .flatMap */.qIB(core/* .context */._OA(), env => (0,Function.pipe)(fromAcquire(core/* .exit */.NS5(acquire)), core/* .map */.TjK(ref => {
  const resource = Object.create(resource_proto);
  resource.scopedRef = ref;
  resource.acquire = core/* .provideContext */.PpN(acquire, env);
  return resource;
})));
/** @internal */
const resource_get = self => core/* .flatMap */.qIB(scopedRef_get(self.scopedRef), Function.identity);
/** @internal */
const refresh = self => scopedRef_set(self.scopedRef, core/* .map */.TjK(self.acquire, core/* .exitSucceed */.xtk));
//# sourceMappingURL=resource.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Resource.js

/**
 * @since 2.0.0
 * @category symbols
 */
const Resource_ResourceTypeId = ResourceTypeId;
/**
 * Creates a new `Resource` value that is automatically refreshed according to
 * the specified policy. Note that error retrying is not performed
 * automatically, so if you want to retry on errors, you should first apply
 * retry policies to the acquisition effect before passing it to this
 * constructor.
 *
 * @since 2.0.0
 * @category constructors
 */
const Resource_auto = resource_auto;
/**
 * Retrieves the current value stored in the cache.
 *
 * @since 2.0.0
 * @category getters
 */
const Resource_get = resource_get;
/**
 * Creates a new `Resource` value that must be manually refreshed by calling
 * the refresh method. Note that error retrying is not performed
 * automatically, so if you want to retry on errors, you should first apply
 * retry policies to the acquisition effect before passing it to this
 * constructor.
 *
 * @since 2.0.0
 * @category constructors
 */
const Resource_manual = resource_manual;
/**
 * Refreshes the cache. This method will not return until either the refresh
 * is successful, or the refresh operation fails.
 *
 * @since 2.0.0
 * @category utils
 */
const Resource_refresh = refresh;
//# sourceMappingURL=Resource.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/layer/circular.js
var layer_circular = __webpack_require__(58998);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/runtimeFlags.js
var runtimeFlags = __webpack_require__(35662);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RuntimeFlags.js
/**
 * @since 2.0.0
 */


/**
 * No runtime flags.
 *
 * @since 2.0.0
 * @category constructors
 */
const None = runtimeFlags/* .None */.NV;
/**
 * The interruption flag determines whether or not the Effect runtime system will
 * interrupt a fiber.
 *
 * @since 2.0.0
 * @category constructors
 */
const Interruption = runtimeFlags/* .Interruption */._n;
/**
 * The op supervision flag determines whether or not the Effect runtime system
 * will supervise all operations of the Effect runtime. Use of this flag will
 * negatively impact performance, but is required for some operations, such as
 * profiling.
 *
 * @since 2.0.0
 * @category constructors
 */
const OpSupervision = runtimeFlags/* .OpSupervision */.zb;
/**
 * The runtime metrics flag determines whether or not the Effect runtime system
 * will collect metrics about the Effect runtime. Use of this flag will have a
 * very small negative impact on performance, but generates very helpful
 * operational insight into running Effect applications that can be exported to
 * Prometheus or other tools via Effect Metrics.
 *
 * @since 2.0.0
 * @category constructors
 */
const RuntimeMetrics = runtimeFlags/* .RuntimeMetrics */.sd;
/**
 * The wind down flag determines whether the Effect runtime system will execute
 * effects in wind-down mode. In wind-down mode, even if interruption is
 * enabled and a fiber has been interrupted, the fiber will continue its
 * execution uninterrupted.
 *
 * @since 2.0.0
 * @category constructors
 */
const WindDown = runtimeFlags/* .WindDown */.rS;
/**
 * The cooperative yielding flag determines whether the Effect runtime will
 * yield to another fiber.
 *
 * @since 2.0.0
 * @category constructors
 */
const CooperativeYielding = runtimeFlags/* .CooperativeYielding */.Zd;
/**
 * Returns `true` if the `CooperativeYielding` `RuntimeFlag` is enabled, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
const cooperativeYielding = runtimeFlags/* .cooperativeYielding */.Ps;
/**
 * Creates a `RuntimeFlagsPatch` which describes the difference between `self`
 * and `that`.
 *
 * @since 2.0.0
 * @category diffing
 */
const diff = runtimeFlags/* .diff */.Ui;
/**
 * Constructs a differ that knows how to diff `RuntimeFlags` values.
 *
 * @since 2.0.0
 * @category utils
 */
const differ = runtimeFlags/* .differ */.Tx;
/**
 * Disables the specified `RuntimeFlag`.
 *
 * @since 2.0.0
 * @category utils
 */
const disable = runtimeFlags/* .disable */.b8;
/**
 * Disables all of the `RuntimeFlag`s in the specified set of `RuntimeFlags`.
 *
 * @since 2.0.0
 * @category utils
 */
const disableAll = runtimeFlags/* .disableAll */.O$;
/**
 * @since 2.0.0
 * @category context
 */
const disableCooperativeYielding = layer_circular/* .disableCooperativeYielding */.d_;
/**
 * @since 2.0.0
 * @category context
 */
const disableInterruption = layer_circular/* .disableInterruption */.SM;
/**
 * @since 2.0.0
 * @category context
 */
const disableOpSupervision = layer_circular/* .disableOpSupervision */.Xq;
/**
 * @since 2.0.0
 * @category context
 */
const disableRuntimeMetrics = layer_circular/* .disableRuntimeMetrics */.uD;
/**
 * @since 2.0.0
 * @category context
 */
const disableWindDown = layer_circular/* .disableWindDown */.jz;
/**
 * Enables the specified `RuntimeFlag`.
 *
 * @since 2.0.0
 * @category utils
 */
const enable = runtimeFlags/* .enable */.sS;
/**
 * Enables all of the `RuntimeFlag`s in the specified set of `RuntimeFlags`.
 *
 * @since 2.0.0
 * @category utils
 */
const enableAll = runtimeFlags/* .enableAll */.Fu;
/**
 * @since 2.0.0
 * @category context
 */
const enableCooperativeYielding = layer_circular/* .enableCooperativeYielding */.YY;
/**
 * @since 2.0.0
 * @category context
 */
const enableInterruption = layer_circular/* .enableInterruption */.Ln;
/**
 * @since 2.0.0
 * @category context
 */
const enableOpSupervision = layer_circular/* .enableOpSupervision */.W8;
/**
 * @since 2.0.0
 * @category context
 */
const enableRuntimeMetrics = layer_circular/* .enableRuntimeMetrics */.$g;
/**
 * @since 2.0.0
 * @category context
 */
const enableWindDown = layer_circular/* .enableWindDown */.Wy;
/**
 * Returns true only if the `Interruption` flag is **enabled** and the
 * `WindDown` flag is **disabled**.
 *
 * A fiber is said to be interruptible if interruption is enabled and the fiber
 * is not in its wind-down phase, in which it takes care of cleanup activities
 * related to fiber shutdown.
 *
 * @since 2.0.0
 * @category getters
 */
const interruptible = runtimeFlags/* .interruptible */.In;
/**
 * Returns `true` if the `Interruption` `RuntimeFlag` is enabled, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
const interruption = runtimeFlags/* .interruption */.YW;
/**
 * Returns `true` if the specified `RuntimeFlag` is enabled, `false` otherwise.
 *
 * @since 2.0.0
 * @category elements
 */
const isEnabled = runtimeFlags/* .isEnabled */.Ol;
/**
 * Returns `true` if the specified `RuntimeFlag` is disabled, `false` otherwise.
 *
 * @since 2.0.0
 * @category elements
 */
const isDisabled = runtimeFlags/* .isDisabled */.d6;
/**
 * @since 2.0.0
 * @category constructors
 */
const RuntimeFlags_make = runtimeFlags/* .make */.L8;
/**
 * @since 2.0.0
 * @category constructors
 */
const none = runtimeFlags/* .none */.dv;
/**
 * Returns `true` if the `OpSupervision` `RuntimeFlag` is enabled, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
const opSupervision = runtimeFlags/* .opSupervision */.hC;
/**
 * Patches a set of `RuntimeFlag`s with a `RuntimeFlagsPatch`, returning the
 * patched set of `RuntimeFlag`s.
 *
 * @since 2.0.0
 * @category utils
 */
const RuntimeFlags_patch = runtimeFlags/* .patch */.F6;
/**
 * Converts the provided `RuntimeFlags` into a `string`.
 *
 * @category conversions
 * @since 2.0.0
 */
const render = runtimeFlags/* .render */.XX;
/**
 * Returns `true` if the `RuntimeMetrics` `RuntimeFlag` is enabled, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
const runtimeMetrics = runtimeFlags/* .runtimeMetrics */.qg;
/**
 * Converts the provided `RuntimeFlags` into a `ReadonlySet<number>`.
 *
 * @category conversions
 * @since 2.0.0
 */
const toSet = runtimeFlags/* .toSet */.M1;
/**
 * Returns `true` if the `WindDown` `RuntimeFlag` is enabled, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
const windDown = runtimeFlags/* .windDown */.zq;
//# sourceMappingURL=RuntimeFlags.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/RuntimeFlagsPatch.js
var RuntimeFlagsPatch = __webpack_require__(41128);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/core.js + 5 modules
var stm_core = __webpack_require__(50621);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/stm.js
var stm = __webpack_require__(7590);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/STM.js
/**
 * @since 2.0.0
 */




/**
 * @since 2.0.0
 * @category symbols
 */
const STMTypeId = stm_core/* .STMTypeId */.Cg;
/**
 * Returns `true` if the provided value is an `STM`, `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isSTM = stm_core/* .isSTM */.Bc;
/**
 * Treats the specified `acquire` transaction as the acquisition of a
 * resource. The `acquire` transaction will be executed interruptibly. If it
 * is a success and is committed the specified `release` workflow will be
 * executed uninterruptibly as soon as the `use` workflow completes execution.
 *
 * @since 2.0.0
 * @category constructors
 */
const acquireUseRelease = stm/* .acquireUseRelease */.jG;
/**
 * Runs all the provided transactional effects in sequence respecting the
 * structure provided in input.
 *
 * Supports multiple arguments, a single argument tuple / array or record /
 * struct.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_all = stm/* .all */.Q7;
/**
 * Maps the success value of this effect to the specified constant value.
 *
 * @since 2.0.0
 * @category mapping
 */
const STM_as = stm.as;
/**
 * Maps the success value of this effect to an optional value.
 *
 * @since 2.0.0
 * @category mapping
 */
const asSome = stm/* .asSome */.Xx;
/**
 * Maps the error value of this effect to an optional value.
 *
 * @since 2.0.0
 * @category mapping
 */
const asSomeError = stm/* .asSomeError */.t2;
/**
 * This function maps the success value of an `STM` to `void`. If the original
 * `STM` succeeds, the returned `STM` will also succeed. If the original `STM`
 * fails, the returned `STM` will fail with the same error.
 *
 * @since 2.0.0
 * @category mapping
 */
const asVoid = stm/* .asVoid */.NL;
/**
 * Creates an `STM` value from a partial (but pure) function.
 *
 * @since 2.0.0
 * @category constructors
 */
const attempt = stm/* .attempt */.CD;
/**
 * Recovers from all errors.
 *
 * @since 2.0.0
 * @category error handling
 */
const catchAll = stm_core/* .catchAll */.h9;
/**
 * Recovers from some or all of the error cases.
 *
 * @since 2.0.0
 * @category error handling
 */
const catchSome = stm/* .catchSome */._O;
/**
 * Recovers from the specified tagged error.
 *
 * @since 2.0.0
 * @category error handling
 */
const catchTag = stm/* .catchTag */.Ku;
/**
 * Recovers from multiple tagged errors.
 *
 * @since 2.0.0
 * @category error handling
 */
const catchTags = stm/* .catchTags */.lo;
/**
 * Checks the condition, and if it's true, returns unit, otherwise, retries.
 *
 * @since 2.0.0
 * @category constructors
 */
const check = stm/* .check */.z6;
/**
 * Simultaneously filters and maps the value produced by this effect.
 *
 * @since 2.0.0
 * @category mutations
 */
const collect = stm/* .collect */.Fo;
/**
 * Simultaneously filters and maps the value produced by this effect.
 *
 * @since 2.0.0
 * @category mutations
 */
const collectSTM = stm/* .collectSTM */.R0;
/**
 * Commits this transaction atomically.
 *
 * @since 2.0.0
 * @category destructors
 */
const commit = stm_core/* .commit */.cd;
/**
 * Commits this transaction atomically, regardless of whether the transaction
 * is a success or a failure.
 *
 * @since 2.0.0
 * @category destructors
 */
const commitEither = stm/* .commitEither */.JE;
/**
 * Similar to Either.cond, evaluate the predicate, return the given A as
 * success if predicate returns true, and the given E as error otherwise
 *
 * @since 2.0.0
 * @category constructors
 */
const cond = stm/* .cond */.j1;
/**
 * Retrieves the environment inside an stm.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_context = stm_core/* .context */._O;
/**
 * Accesses the environment of the transaction to perform a transaction.
 *
 * @since 2.0.0
 * @category constructors
 */
const contextWith = stm_core/* .contextWith */.sx;
/**
 * Accesses the environment of the transaction to perform a transaction.
 *
 * @since 2.0.0
 * @category constructors
 */
const contextWithSTM = stm_core/* .contextWithSTM */.SJ;
/**
 * Transforms the environment being provided to this effect with the specified
 * function.
 *
 * @since 2.0.0
 * @category context
 */
const mapInputContext = stm_core/* .mapInputContext */.ky;
/**
 * Fails the transactional effect with the specified defect.
 *
 * @since 2.0.0
 * @category constructors
 */
const die = stm_core/* .die */.F_;
/**
 * Kills the fiber running the effect with a `Cause.RuntimeException` that
 * contains the specified message.
 *
 * @since 2.0.0
 * @category constructors
 */
const dieMessage = stm_core/* .dieMessage */.GS;
/**
 * Fails the transactional effect with the specified lazily evaluated defect.
 *
 * @since 2.0.0
 * @category constructors
 */
const dieSync = stm_core/* .dieSync */.Kb;
/**
 * Converts the failure channel into an `Either`.
 *
 * @since 2.0.0
 * @category mutations
 */
const STM_either = stm/* .either */.gP;
/**
 * Executes the specified finalization transaction whether or not this effect
 * succeeds. Note that as with all STM transactions, if the full transaction
 * fails, everything will be rolled back.
 *
 * @since 2.0.0
 * @category finalization
 */
const ensuring = stm_core/* .ensuring */.ye;
/**
 * Returns an effect that ignores errors and runs repeatedly until it
 * eventually succeeds.
 *
 * @since 2.0.0
 * @category mutations
 */
const eventually = stm/* .eventually */.u4;
/**
 * Determines whether all elements of the `Iterable<A>` satisfy the effectual
 * predicate.
 *
 * @since 2.0.0
 * @category constructors
 */
const every = stm/* .every */.Si;
/**
 * Determines whether any element of the `Iterable[A]` satisfies the effectual
 * predicate `f`.
 *
 * @since 2.0.0
 * @category constructors
 */
const exists = stm/* .exists */.Mn;
/**
 * Fails the transactional effect with the specified error.
 *
 * @since 2.0.0
 * @category constructors
 */
const fail = stm_core/* .fail */.fJ;
/**
 * Fails the transactional effect with the specified lazily evaluated error.
 *
 * @since 2.0.0
 * @category constructors
 */
const failSync = stm_core/* .failSync */.gO;
/**
 * Returns the fiber id of the fiber committing the transaction.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_fiberId = stm/* .fiberId */.AB;
/**
 * Filters the collection using the specified effectual predicate.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_filter = stm/* .filter */.pb;
/**
 * Filters the collection using the specified effectual predicate, removing
 * all elements that satisfy the predicate.
 *
 * @since 2.0.0
 * @category constructors
 */
const filterNot = stm/* .filterNot */.MR;
/**
 * Dies with specified defect if the predicate fails.
 *
 * @since 2.0.0
 * @category filtering
 */
const filterOrDie = stm/* .filterOrDie */.kr;
/**
 * Dies with a `Cause.RuntimeException` having the specified  message if the
 * predicate fails.
 *
 * @since 2.0.0
 * @category filtering
 */
const filterOrDieMessage = stm/* .filterOrDieMessage */.Nf;
/**
 * Supplies `orElse` if the predicate fails.
 *
 * @since 2.0.0
 * @category filtering
 */
const filterOrElse = stm/* .filterOrElse */.Pm;
/**
 * Fails with the specified error if the predicate fails.
 *
 * @since 2.0.0
 * @category filtering
 */
const filterOrFail = stm/* .filterOrFail */.W$;
/**
 * Feeds the value produced by this effect to the specified function, and then
 * runs the returned effect as well to produce its results.
 *
 * @since 2.0.0
 * @category sequencing
 */
const flatMap = stm_core/* .flatMap */.qI;
/**
 * Flattens out a nested `STM` effect.
 *
 * @since 2.0.0
 * @category sequencing
 */
const flatten = stm/* .flatten */.Bq;
/**
 * Flips the success and failure channels of this transactional effect. This
 * allows you to use all methods on the error channel, possibly before
 * flipping back.
 *
 * @since 2.0.0
 * @category mutations
 */
const flip = stm/* .flip */.UU;
/**
 * Swaps the error/value parameters, applies the function `f` and flips the
 * parameters back
 *
 * @since 2.0.0
 * @category mutations
 */
const flipWith = stm/* .flipWith */.AA;
/**
 * Folds over the `STM` effect, handling both failure and success, but not
 * retry.
 *
 * @since 2.0.0
 * @category folding
 */
const STM_match = stm/* .match */.YW;
/**
 * Effectfully folds over the `STM` effect, handling both failure and success.
 *
 * @since 2.0.0
 * @category folding
 */
const matchSTM = stm_core/* .matchSTM */.Gs;
/**
 * Applies the function `f` to each element of the `Iterable<A>` and returns
 * a transactional effect that produces a new `Chunk<A2>`.
 *
 * @since 2.0.0
 * @category traversing
 */
const forEach = stm/* .forEach */.jJ;
/**
 * Lifts an `Either` into a `STM`.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromEither = stm/* .fromEither */.Mr;
/**
 * Lifts an `Option` into a `STM`.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromOption = stm/* .fromOption */.sV;
/**
 * @since 2.0.0
 * @category constructors
 */
const gen = stm/* .gen */.Jk;
/**
 * Returns a successful effect with the head of the list if the list is
 * non-empty or fails with the error `None` if the list is empty.
 *
 * @since 2.0.0
 * @category getters
 */
const STM_head = stm/* .head */.d5;
const if_ = stm/* .if_ */.tD;

/**
 * Returns a new effect that ignores the success or failure of this effect.
 *
 * @since 2.0.0
 * @category mutations
 */
const ignore = stm/* .ignore */.Xe;
/**
 * Interrupts the fiber running the effect.
 *
 * @since 2.0.0
 * @category constructors
 */
const interrupt = stm_core/* .interrupt */.G;
/**
 * Interrupts the fiber running the effect with the specified `FiberId`.
 *
 * @since 2.0.0
 * @category constructors
 */
const interruptAs = stm_core/* .interruptAs */.yS;
/**
 * Returns whether this transactional effect is a failure.
 *
 * @since 2.0.0
 * @category getters
 */
const isFailure = stm/* .isFailure */.N6;
/**
 * Returns whether this transactional effect is a success.
 *
 * @since 2.0.0
 * @category getters
 */
const isSuccess = stm/* .isSuccess */.oJ;
/**
 * Iterates with the specified transactional function. The moral equivalent
 * of:
 *
 * ```ts skip-type-checking
 * const s = initial
 *
 * while (cont(s)) {
 *   s = body(s)
 * }
 *
 * return s
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const iterate = stm/* .iterate */.nl;
/**
 * Loops with the specified transactional function, collecting the results
 * into a list. The moral equivalent of:
 *
 * ```ts skip-type-checking
 * const as = []
 * let s  = initial
 *
 * while (cont(s)) {
 *   as.push(body(s))
 *   s  = inc(s)
 * }
 *
 * return as
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_loop = stm/* .loop */.HW;
/**
 * Maps the value produced by the effect.
 *
 * @since 2.0.0
 * @category mapping
 */
const STM_map = stm_core/* .map */.Tj;
/**
 * Maps the value produced by the effect with the specified function that may
 * throw exceptions but is otherwise pure, translating any thrown exceptions
 * into typed failed effects.
 *
 * @since 2.0.0
 * @category mapping
 */
const mapAttempt = stm/* .mapAttempt */.IY;
/**
 * Returns an `STM` effect whose failure and success channels have been mapped
 * by the specified pair of functions, `f` and `g`.
 *
 * @since 2.0.0
 * @category mapping
 */
const mapBoth = stm/* .mapBoth */.Uc;
/**
 * Maps from one error type to another.
 *
 * @since 2.0.0
 * @category mapping
 */
const mapError = stm/* .mapError */.xm;
/**
 * Returns a new effect where the error channel has been merged into the
 * success channel to their common combined type.
 *
 * @since 2.0.0
 * @category mutations
 */
const STM_merge = stm/* .merge */.h1;
/**
 * Merges an `Iterable<STM>` to a single `STM`, working sequentially.
 *
 * @since 2.0.0
 * @category constructors
 */
const mergeAll = stm/* .mergeAll */.Um;
/**
 * Returns a new effect where boolean value of this effect is negated.
 *
 * @since 2.0.0
 * @category mutations
 */
const negate = stm/* .negate */.ze;
/**
 * Requires the option produced by this value to be `None`.
 *
 * @since 2.0.0
 * @category mutations
 */
const STM_none = stm/* .none */.dv;
/**
 * Converts the failure channel into an `Option`.
 *
 * @since 2.0.0
 * @category mutations
 */
const STM_option = stm/* .option */.uK;
/**
 * Translates `STM` effect failure into death of the fiber, making all
 * failures unchecked and not a part of the type of the effect.
 *
 * @since 2.0.0
 * @category error handling
 */
const orDie = stm/* .orDie */.Qg;
/**
 * Keeps none of the errors, and terminates the fiber running the `STM` effect
 * with them, using the specified function to convert the `E` into a defect.
 *
 * @since 2.0.0
 * @category error handling
 */
const orDieWith = stm/* .orDieWith */.kS;
/**
 * Tries this effect first, and if it fails or retries, tries the other
 * effect.
 *
 * @since 2.0.0
 * @category error handling
 */
const orElse = stm/* .orElse */.NW;
/**
 * Returns a transactional effect that will produce the value of this effect
 * in left side, unless it fails or retries, in which case, it will produce
 * the value of the specified effect in right side.
 *
 * @since 2.0.0
 * @category error handling
 */
const orElseEither = stm/* .orElseEither */.Gg;
/**
 * Tries this effect first, and if it fails or retries, fails with the
 * specified error.
 *
 * @since 2.0.0
 * @category error handling
 */
const orElseFail = stm/* .orElseFail */.xS;
/**
 * Returns an effect that will produce the value of this effect, unless it
 * fails with the `None` value, in which case it will produce the value of the
 * specified effect.
 *
 * @since 2.0.0
 * @category error handling
 */
const orElseOptional = stm/* .orElseOptional */.Pp;
/**
 * Tries this effect first, and if it fails or retries, succeeds with the
 * specified value.
 *
 * @since 2.0.0
 * @category error handling
 */
const orElseSucceed = stm/* .orElseSucceed */.DM;
/**
 * Tries this effect first, and if it enters retry, then it tries the other
 * effect. This is an equivalent of Haskell's orElse.
 *
 * @since 2.0.0
 * @category error handling
 */
const orTry = stm_core/* .orTry */.ft;
/**
 * Feeds elements of type `A` to a function `f` that returns an effect.
 * Collects all successes and failures in a tupled fashion.
 *
 * @since 2.0.0
 * @category traversing
 */
const partition = stm/* .partition */.jB;
/**
 * Provides the transaction its required environment, which eliminates its
 * dependency on `R`.
 *
 * @since 2.0.0
 * @category context
 */
const provideContext = stm/* .provideContext */.gN;
/**
 * Splits the context into two parts, providing one part using the
 * specified layer and leaving the remainder `R0`.
 *
 * @since 2.0.0
 * @category context
 */
const provideSomeContext = stm/* .provideSomeContext */.$1;
/**
 * Provides the effect with the single service it requires. If the transactional
 * effect requires more than one service use `provideEnvironment` instead.
 *
 * @since 2.0.0
 * @category context
 */
const provideService = stm/* .provideService */.Pf;
/**
 * Provides the effect with the single service it requires. If the transactional
 * effect requires more than one service use `provideEnvironment` instead.
 *
 * @since 2.0.0
 * @category context
 */
const provideServiceSTM = stm/* .provideServiceSTM */.PH;
/**
 * Folds an `Iterable<A>` using an effectual function f, working sequentially
 * from left to right.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_reduce = stm/* .reduce */.TS;
/**
 * Reduces an `Iterable<STM>` to a single `STM`, working sequentially.
 *
 * @since 2.0.0
 * @category constructors
 */
const reduceAll = stm/* .reduceAll */.Yg;
/**
 * Folds an `Iterable<A>` using an effectual function f, working sequentially
 * from right to left.
 *
 * @since 2.0.0
 * @category constructors
 */
const reduceRight = stm/* .reduceRight */.XK;
/**
 * Keeps some of the errors, and terminates the fiber with the rest.
 *
 * @since 2.0.0
 * @category mutations
 */
const refineOrDie = stm/* .refineOrDie */.xQ;
/**
 * Keeps some of the errors, and terminates the fiber with the rest, using the
 * specified function to convert the `E` into a `Throwable`.
 *
 * @since 2.0.0
 * @category mutations
 */
const refineOrDieWith = stm/* .refineOrDieWith */.fV;
/**
 * Fail with the returned value if the `PartialFunction` matches, otherwise
 * continue with our held value.
 *
 * @since 2.0.0
 * @category mutations
 */
const STM_reject = stm/* .reject */.ku;
/**
 * Continue with the returned computation if the specified partial function
 * matches, translating the successful match into a failure, otherwise continue
 * with our held value.
 *
 * @since 2.0.0
 * @category mutations
 */
const rejectSTM = stm/* .rejectSTM */.u8;
/**
 * Repeats this `STM` effect until its result satisfies the specified
 * predicate.
 *
 * **WARNING**: `repeatUntil` uses a busy loop to repeat the effect and will
 * consume a thread until it completes (it cannot yield). This is because STM
 * describes a single atomic transaction which must either complete, retry or
 * fail a transaction before yielding back to the Effect runtime.
 *   - Use `retryUntil` instead if you don't need to maintain transaction
 *     state for repeats.
 *   - Ensure repeating the STM effect will eventually satisfy the predicate.
 *
 * @since 2.0.0
 * @category mutations
 */
const repeatUntil = stm/* .repeatUntil */.Mi;
/**
 * Repeats this `STM` effect while its result satisfies the specified
 * predicate.
 *
 * **WARNING**: `repeatWhile` uses a busy loop to repeat the effect and will
 * consume a thread until it completes (it cannot yield). This is because STM
 * describes a single atomic transaction which must either complete, retry or
 * fail a transaction before yielding back to the Effect runtime.
 *   - Use `retryWhile` instead if you don't need to maintain transaction
 *     state for repeats.
 *   - Ensure repeating the STM effect will eventually not satisfy the
 *     predicate.
 *
 * @since 2.0.0
 * @category mutations
 */
const repeatWhile = stm/* .repeatWhile */.Nz;
/**
 * Replicates the given effect n times. If 0 or negative numbers are given, an
 * empty `Chunk` will be returned.
 *
 * @since 2.0.0
 * @category constructors
 */
const replicate = stm/* .replicate */.aA;
/**
 * Performs this transaction the specified number of times and collects the
 * results.
 *
 * @since 2.0.0
 * @category constructors
 */
const replicateSTM = stm/* .replicateSTM */.U4;
/**
 * Performs this transaction the specified number of times, discarding the
 * results.
 *
 * @since 2.0.0
 * @category constructors
 */
const replicateSTMDiscard = stm/* .replicateSTMDiscard */.Ur;
/**
 * Abort and retry the whole transaction when any of the underlying
 * transactional variables have changed.
 *
 * @since 2.0.0
 * @category error handling
 */
const STM_retry = stm_core/* .retry */.L5;
/**
 * Filters the value produced by this effect, retrying the transaction until
 * the predicate returns `true` for the value.
 *
 * @since 2.0.0
 * @category mutations
 */
const retryUntil = stm/* .retryUntil */.v6;
/**
 * Filters the value produced by this effect, retrying the transaction while
 * the predicate returns `true` for the value.
 *
 * @since 2.0.0
 * @category mutations
 */
const retryWhile = stm/* .retryWhile */.i9;
/**
 * Converts an option on values into an option on errors.
 *
 * @since 2.0.0
 * @category getters
 */
const some = stm/* .some */.zN;
/**
 * Returns an `STM` effect that succeeds with the specified value.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_succeed = stm_core/* .succeed */.Py;
/**
 * Returns an effect with the empty value.
 *
 * @since 2.0.0
 * @category constructors
 */
const succeedNone = stm/* .succeedNone */.lw;
/**
 * Returns an effect with the optional value.
 *
 * @since 2.0.0
 * @category constructors
 */
const succeedSome = stm/* .succeedSome */.nG;
/**
 * Summarizes a `STM` effect by computing a provided value before and after
 * execution, and then combining the values to produce a summary, together
 * with the result of execution.
 *
 * @since 2.0.0
 * @category mutations
 */
const summarized = stm/* .summarized */.Uy;
/**
 * Suspends creation of the specified transaction lazily.
 *
 * @since 2.0.0
 * @category constructors
 */
const suspend = stm/* .suspend */.DY;
/**
 * Returns an `STM` effect that succeeds with the specified lazily evaluated
 * value.
 *
 * @since 2.0.0
 * @category constructors
 */
const STM_sync = stm_core/* .sync */.OH;
/**
 * "Peeks" at the success of transactional effect.
 *
 * @since 2.0.0
 * @category sequencing
 */
const tap = stm/* .tap */.tX;
/**
 * "Peeks" at both sides of an transactional effect.
 *
 * @since 2.0.0
 * @category sequencing
 */
const tapBoth = stm/* .tapBoth */.Bi;
/**
 * "Peeks" at the error of the transactional effect.
 *
 * @since 2.0.0
 * @category sequencing
 */
const tapError = stm/* .tapError */.sF;
const try_ = stm/* .try_ */.bS;

/**
 * The moral equivalent of `if (!p) exp`
 *
 * @since 2.0.0
 * @category mutations
 */
const unless = stm/* .unless */.NJ;
/**
 * The moral equivalent of `if (!p) exp` when `p` has side-effects
 *
 * @since 2.0.0
 * @category mutations
 */
const unlessSTM = stm/* .unlessSTM */.tj;
/**
 * Converts an option on errors into an option on values.
 *
 * @since 2.0.0
 * @category getters
 */
const unsome = stm/* .unsome */.co;
const void_ = stm/* ["void"] */.rI;

/**
 * Feeds elements of type `A` to `f` and accumulates all errors in error
 * channel or successes in success channel.
 *
 * This combinator is lossy meaning that if there are errors all successes
 * will be lost. To retain all information please use `STM.partition`.
 *
 * @since 2.0.0
 * @category mutations
 */
const validateAll = stm/* .validateAll */.wM;
/**
 * Feeds elements of type `A` to `f` until it succeeds. Returns first success
 * or the accumulation of all errors.
 *
 * @since 2.0.0
 * @category mutations
 */
const validateFirst = stm/* .validateFirst */.nO;
/**
 * The moral equivalent of `if (p) exp`.
 *
 * @since 2.0.0
 * @category mutations
 */
const when = stm/* .when */.z7;
/**
 * The moral equivalent of `if (p) exp` when `p` has side-effects.
 *
 * @since 2.0.0
 * @category mutations
 */
const whenSTM = stm/* .whenSTM */.T1;
/**
 * Sequentially zips this value with the specified one.
 *
 * @since 2.0.0
 * @category zipping
 */
const STM_zip = stm_core/* .zip */.yU;
/**
 * Sequentially zips this value with the specified one, discarding the second
 * element of the tuple.
 *
 * @since 2.0.0
 * @category zipping
 */
const zipLeft = stm_core/* .zipLeft */.pi;
/**
 * Sequentially zips this value with the specified one, discarding the first
 * element of the tuple.
 *
 * @since 2.0.0
 * @category zipping
 */
const zipRight = stm_core/* .zipRight */.aN;
/**
 * Sequentially zips this value with the specified one, combining the values
 * using the specified combiner function.
 *
 * @since 2.0.0
 * @category zipping
 */
const zipWith = stm_core/* .zipWith */.OY;
/**
 * This function takes an iterable of `STM` values and returns a new
 * `STM` value that represents the first `STM` value in the iterable
 * that succeeds. If all of the `Effect` values in the iterable fail, then
 * the resulting `STM` value will fail as well.
 *
 * This function is sequential, meaning that the `STM` values in the
 * iterable will be executed in sequence, and the first one that succeeds
 * will determine the outcome of the resulting `STM` value.
 *
 * Returns a new `STM` value that represents the first successful
 * `STM` value in the iterable, or a failed `STM` value if all of the
 * `STM` values in the iterable fail.
 *
 * @since 2.0.0
 * @category elements
 */
const firstSuccessOf = effects => suspend(() => {
  const list = Chunk.fromIterable(effects);
  if (!Chunk.isNonEmpty(list)) {
    return dieSync(() => new Cause.IllegalArgumentException(`Received an empty collection of effects`));
  }
  return Chunk.reduce(Chunk.tailNonEmpty(list), Chunk.headNonEmpty(list), (left, right) => orElse(left, () => right));
});
/**
 * @category do notation
 * @since 2.0.0
 */
const Do = /*#__PURE__*/STM_succeed({});
/**
 * @category do notation
 * @since 2.0.0
 */
const bind = stm/* .bind */.oI;
const let_ = stm/* .let_ */.zM;

/**
 * @category do notation
 * @since 2.0.0
 */
const bindTo = stm/* .bindTo */.Jr;
//# sourceMappingURL=STM.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Schedule.js
var Schedule = __webpack_require__(34222);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScheduleDecision.js + 1 modules
var ScheduleDecision = __webpack_require__(62703);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScheduleInterval.js + 1 modules
var ScheduleInterval = __webpack_require__(32289);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScheduleIntervals.js + 1 modules
var ScheduleIntervals = __webpack_require__(9553);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Schema.js
var Schema = __webpack_require__(9064);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/scopedCache.js

















/** @internal */
const makeCacheState = (map, keys, accesses, updating, hits, misses) => ({
  map,
  keys,
  accesses,
  updating,
  hits,
  misses
});
/**
 * Constructs an initial cache state.
 *
 * @internal
 */
const initialCacheState = () => makeCacheState(MutableHashMap.empty(), internal_cache/* .makeKeySet */.A(), MutableQueue.unbounded(), MutableRef.make(false), 0, 0);
/** @internal */
const scopedCache_complete = (key, exit, ownerCount, entryStats, timeToLive) => Data.struct({
  _tag: "Complete",
  key,
  exit,
  ownerCount,
  entryStats,
  timeToLive
});
/** @internal */
const pending = (key, scoped) => Data.struct({
  _tag: "Pending",
  key,
  scoped
});
/** @internal */
const refreshing = (scoped, complete) => Data.struct({
  _tag: "Refreshing",
  scoped,
  complete
});
/** @internal */
const toScoped = self => Exit.matchEffect(self.exit, {
  onFailure: cause => core/* .failCause */.ATB(cause),
  onSuccess: ([value]) => fiberRuntime/* .acquireRelease */.Q5(core.as(core/* .sync */.OH5(() => MutableRef.incrementAndGet(self.ownerCount)), value), () => releaseOwner(self))
});
/** @internal */
const releaseOwner = self => Exit.matchEffect(self.exit, {
  onFailure: () => core/* ["void"] */.rIH,
  onSuccess: ([, finalizer]) => core/* .flatMap */.qIB(core/* .sync */.OH5(() => MutableRef.decrementAndGet(self.ownerCount)), numOwner => core_effect/* .when */.z7(finalizer(Exit["void"]), () => numOwner === 0))
});
/** @internal */
const ScopedCacheSymbolKey = "effect/ScopedCache";
/** @internal */
const ScopedCacheTypeId = /*#__PURE__*/Symbol.for(ScopedCacheSymbolKey);
const scopedCacheVariance = {
  /* c8 ignore next */
  _Key: _ => _,
  /* c8 ignore next */
  _Error: _ => _,
  /* c8 ignore next */
  _Value: _ => _
};
class ScopedCacheImpl {
  capacity;
  scopedLookup;
  clock;
  timeToLive;
  context;
  [ScopedCacheTypeId] = scopedCacheVariance;
  cacheState;
  constructor(capacity, scopedLookup, clock, timeToLive, context) {
    this.capacity = capacity;
    this.scopedLookup = scopedLookup;
    this.clock = clock;
    this.timeToLive = timeToLive;
    this.context = context;
    this.cacheState = initialCacheState();
  }
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
  get cacheStats() {
    return core/* .sync */.OH5(() => internal_cache/* .makeCacheStats */.c8({
      hits: this.cacheState.hits,
      misses: this.cacheState.misses,
      size: MutableHashMap.size(this.cacheState.map)
    }));
  }
  getOption(key) {
    return core/* .suspend */.DYE(() => Option.match(MutableHashMap.get(this.cacheState.map, key), {
      onNone: () => core_effect/* .succeedNone */.lw,
      onSome: value => core/* .flatten */.Bqz(this.resolveMapValue(value))
    }));
  }
  getOptionComplete(key) {
    return core/* .suspend */.DYE(() => Option.match(MutableHashMap.get(this.cacheState.map, key), {
      onNone: () => core_effect/* .succeedNone */.lw,
      onSome: value => core/* .flatten */.Bqz(this.resolveMapValue(value, true))
    }));
  }
  contains(key) {
    return core/* .sync */.OH5(() => MutableHashMap.has(this.cacheState.map, key));
  }
  entryStats(key) {
    return core/* .sync */.OH5(() => {
      const value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
      if (value === undefined) {
        return Option.none();
      }
      switch (value._tag) {
        case "Complete":
          {
            return Option.some(internal_cache/* .makeEntryStats */.Eh(value.entryStats.loadedMillis));
          }
        case "Pending":
          {
            return Option.none();
          }
        case "Refreshing":
          {
            return Option.some(internal_cache/* .makeEntryStats */.Eh(value.complete.entryStats.loadedMillis));
          }
      }
    });
  }
  get(key) {
    return (0,Function.pipe)(this.lookupValueOf(key), core_effect/* .memoize */.Bj, core/* .flatMap */.qIB(lookupValue => core/* .suspend */.DYE(() => {
      let k = undefined;
      let value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
      if (value === undefined) {
        k = internal_cache/* .makeMapKey */.qJ(key);
        if (MutableHashMap.has(this.cacheState.map, key)) {
          value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
        } else {
          MutableHashMap.set(this.cacheState.map, key, pending(k, lookupValue));
        }
      }
      if (value === undefined) {
        this.trackMiss();
        return core/* .zipRight */.aNH(this.ensureMapSizeNotExceeded(k), lookupValue);
      }
      return core/* .map */.TjK(this.resolveMapValue(value), core/* .flatMap */.qIB(Option.match({
        onNone: () => {
          const val = value;
          const current = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
          if (Equal.equals(current, value)) {
            MutableHashMap.remove(this.cacheState.map, key);
          }
          return (0,Function.pipe)(this.ensureMapSizeNotExceeded(val.key), core/* .zipRight */.aNH(releaseOwner(val)), core/* .zipRight */.aNH(this.get(key)));
        },
        onSome: core/* .succeed */.PyW
      })));
    })), core/* .flatten */.Bqz);
  }
  invalidate(key) {
    return core/* .suspend */.DYE(() => {
      if (MutableHashMap.has(this.cacheState.map, key)) {
        const mapValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
        MutableHashMap.remove(this.cacheState.map, key);
        switch (mapValue._tag) {
          case "Complete":
            {
              return releaseOwner(mapValue);
            }
          case "Pending":
            {
              return core/* ["void"] */.rIH;
            }
          case "Refreshing":
            {
              return releaseOwner(mapValue.complete);
            }
        }
      }
      return core/* ["void"] */.rIH;
    });
  }
  get invalidateAll() {
    return fiberRuntime/* .forEachConcurrentDiscard */.Kd(HashSet.fromIterable(Array.from(this.cacheState.map).map(([key]) => key)), key => this.invalidate(key), false, false);
  }
  refresh(key) {
    return (0,Function.pipe)(this.lookupValueOf(key), core_effect/* .memoize */.Bj, core/* .flatMap */.qIB(scoped => {
      let value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
      let newKey = undefined;
      if (value === undefined) {
        newKey = internal_cache/* .makeMapKey */.qJ(key);
        if (MutableHashMap.has(this.cacheState.map, key)) {
          value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
        } else {
          MutableHashMap.set(this.cacheState.map, key, pending(newKey, scoped));
        }
      }
      let finalScoped;
      if (value === undefined) {
        finalScoped = core/* .zipRight */.aNH(this.ensureMapSizeNotExceeded(newKey), scoped);
      } else {
        switch (value._tag) {
          case "Complete":
            {
              if (this.hasExpired(value.timeToLive)) {
                finalScoped = core/* .succeed */.PyW(this.get(key));
              } else {
                const current = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
                if (Equal.equals(current, value)) {
                  const mapValue = refreshing(scoped, value);
                  MutableHashMap.set(this.cacheState.map, key, mapValue);
                  finalScoped = scoped;
                } else {
                  finalScoped = core/* .succeed */.PyW(this.get(key));
                }
              }
              break;
            }
          case "Pending":
            {
              finalScoped = value.scoped;
              break;
            }
          case "Refreshing":
            {
              finalScoped = value.scoped;
              break;
            }
        }
      }
      return core/* .flatMap */.qIB(finalScoped, s => fiberRuntime/* .scopedEffect */.sZ(core/* .asVoid */.NLW(s)));
    }));
  }
  get size() {
    return core/* .sync */.OH5(() => MutableHashMap.size(this.cacheState.map));
  }
  resolveMapValue(value, ignorePending = false) {
    switch (value._tag) {
      case "Complete":
        {
          this.trackHit();
          if (this.hasExpired(value.timeToLive)) {
            return core/* .succeed */.PyW(core_effect/* .succeedNone */.lw);
          }
          return core.as(this.ensureMapSizeNotExceeded(value.key), core_effect/* .asSome */.Xx(toScoped(value)));
        }
      case "Pending":
        {
          this.trackHit();
          if (ignorePending) {
            return core/* .succeed */.PyW(core_effect/* .succeedNone */.lw);
          }
          return core/* .zipRight */.aNH(this.ensureMapSizeNotExceeded(value.key), core/* .map */.TjK(value.scoped, core_effect/* .asSome */.Xx));
        }
      case "Refreshing":
        {
          this.trackHit();
          if (this.hasExpired(value.complete.timeToLive)) {
            if (ignorePending) {
              return core/* .succeed */.PyW(core_effect/* .succeedNone */.lw);
            }
            return core/* .zipRight */.aNH(this.ensureMapSizeNotExceeded(value.complete.key), core/* .map */.TjK(value.scoped, core_effect/* .asSome */.Xx));
          }
          return core.as(this.ensureMapSizeNotExceeded(value.complete.key), core_effect/* .asSome */.Xx(toScoped(value.complete)));
        }
    }
  }
  lookupValueOf(key) {
    return (0,Function.pipe)(core/* .onInterrupt */.nAr(core/* .flatMap */.qIB(Scope.make(), scope => (0,Function.pipe)(this.scopedLookup(key), core/* .provideContext */.PpN((0,Function.pipe)(this.context, Context.add(Scope.Scope, scope))), core/* .exit */.NS5, core/* .map */.TjK(exit => [exit, exit => Scope.close(scope, exit)]))), () => core/* .sync */.OH5(() => MutableHashMap.remove(this.cacheState.map, key))), core/* .flatMap */.qIB(([exit, release]) => {
      const now = this.clock.unsafeCurrentTimeMillis();
      const expiredAt = now + Duration.toMillis(this.timeToLive(exit));
      switch (exit._tag) {
        case "Success":
          {
            const exitWithFinalizer = Exit.succeed([exit.value, release]);
            const completedResult = scopedCache_complete(internal_cache/* .makeMapKey */.qJ(key), exitWithFinalizer, MutableRef.make(1), internal_cache/* .makeEntryStats */.Eh(now), expiredAt);
            let previousValue = undefined;
            if (MutableHashMap.has(this.cacheState.map, key)) {
              previousValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
            }
            MutableHashMap.set(this.cacheState.map, key, completedResult);
            return core/* .sync */.OH5(() => core/* .flatten */.Bqz(core.as(this.cleanMapValue(previousValue), toScoped(completedResult))));
          }
        case "Failure":
          {
            const completedResult = scopedCache_complete(internal_cache/* .makeMapKey */.qJ(key), exit, MutableRef.make(0), internal_cache/* .makeEntryStats */.Eh(now), expiredAt);
            let previousValue = undefined;
            if (MutableHashMap.has(this.cacheState.map, key)) {
              previousValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key));
            }
            MutableHashMap.set(this.cacheState.map, key, completedResult);
            return core/* .zipRight */.aNH(release(exit), core/* .sync */.OH5(() => core/* .flatten */.Bqz(core.as(this.cleanMapValue(previousValue), toScoped(completedResult)))));
          }
      }
    }), core_effect/* .memoize */.Bj, core/* .flatten */.Bqz);
  }
  hasExpired(timeToLive) {
    return this.clock.unsafeCurrentTimeMillis() > timeToLive;
  }
  trackHit() {
    this.cacheState.hits = this.cacheState.hits + 1;
  }
  trackMiss() {
    this.cacheState.misses = this.cacheState.misses + 1;
  }
  trackAccess(key) {
    const cleanedKeys = [];
    MutableQueue.offer(this.cacheState.accesses, key);
    if (MutableRef.compareAndSet(this.cacheState.updating, false, true)) {
      let loop = true;
      while (loop) {
        const key = MutableQueue.poll(this.cacheState.accesses, MutableQueue.EmptyMutableQueue);
        if (key === MutableQueue.EmptyMutableQueue) {
          loop = false;
        } else {
          this.cacheState.keys.add(key);
        }
      }
      let size = MutableHashMap.size(this.cacheState.map);
      loop = size > this.capacity;
      while (loop) {
        const key = this.cacheState.keys.remove();
        if (key === undefined) {
          loop = false;
        } else {
          if (MutableHashMap.has(this.cacheState.map, key.current)) {
            const removed = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key.current));
            MutableHashMap.remove(this.cacheState.map, key.current);
            size = size - 1;
            cleanedKeys.push(removed);
            loop = size > this.capacity;
          }
        }
      }
      MutableRef.set(this.cacheState.updating, false);
    }
    return cleanedKeys;
  }
  cleanMapValue(mapValue) {
    if (mapValue === undefined) {
      return core/* ["void"] */.rIH;
    }
    switch (mapValue._tag) {
      case "Complete":
        {
          return releaseOwner(mapValue);
        }
      case "Pending":
        {
          return core/* ["void"] */.rIH;
        }
      case "Refreshing":
        {
          return releaseOwner(mapValue.complete);
        }
    }
  }
  ensureMapSizeNotExceeded(key) {
    return fiberRuntime/* .forEachConcurrentDiscard */.Kd(this.trackAccess(key), cleanedMapValue => this.cleanMapValue(cleanedMapValue), false, false);
  }
}
/** @internal */
const scopedCache_make = options => {
  const timeToLive = Duration.decode(options.timeToLive);
  return scopedCache_makeWith({
    capacity: options.capacity,
    lookup: options.lookup,
    timeToLive: () => timeToLive
  });
};
/** @internal */
const scopedCache_makeWith = options => core/* .flatMap */.qIB(core_effect/* .clock */.pm, clock => buildWith(options.capacity, options.lookup, clock, exit => Duration.decode(options.timeToLive(exit))));
const buildWith = (capacity, scopedLookup, clock, timeToLive) => fiberRuntime/* .acquireRelease */.Q5(core/* .flatMap */.qIB(core/* .context */._OA(), context => core/* .sync */.OH5(() => new ScopedCacheImpl(capacity, scopedLookup, clock, timeToLive, context))), cache => cache.invalidateAll);
//# sourceMappingURL=scopedCache.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScopedCache.js

/**
 * @since 2.0.0
 * @category symbols
 */
const ScopedCache_ScopedCacheTypeId = ScopedCacheTypeId;
/**
 * Constructs a new cache with the specified capacity, time to live, and
 * lookup function.
 *
 * @since 2.0.0
 * @category constructors
 */
const ScopedCache_make = scopedCache_make;
/**
 * Constructs a new cache with the specified capacity, time to live, and
 * lookup function, where the time to live can depend on the `Exit` value
 * returned by the lookup function.
 *
 * @since 2.0.0
 * @category constructors
 */
const ScopedCache_makeWith = scopedCache_makeWith;
//# sourceMappingURL=ScopedCache.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/ScopedRef.js

/**
 * @since 2.0.0
 * @category symbols
 */
const ScopedRef_ScopedRefTypeId = ScopedRefTypeId;
/**
 * Creates a new `ScopedRef` from an effect that resourcefully produces a
 * value.
 *
 * @since 2.0.0
 * @category constructors
 */
const ScopedRef_fromAcquire = fromAcquire;
/**
 * Retrieves the current value of the scoped reference.
 *
 * @since 2.0.0
 * @category getters
 */
const ScopedRef_get = scopedRef_get;
/**
 * Creates a new `ScopedRef` from the specified value. This method should
 * not be used for values whose creation require the acquisition of resources.
 *
 * @since 2.0.0
 * @category constructors
 */
const ScopedRef_make = scopedRef_make;
/**
 * Sets the value of this reference to the specified resourcefully-created
 * value. Any resources associated with the old value will be released.
 *
 * This method will not return until either the reference is successfully
 * changed to the new value, with old resources released, or until the attempt
 * to acquire a new value fails.
 *
 * @since 2.0.0
 * @category getters
 */
const ScopedRef_set = scopedRef_set;
//# sourceMappingURL=ScopedRef.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/secret.js
var secret = __webpack_require__(6261);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Secret.js

/**
 * @since 2.0.0
 * @category symbols
 * @deprecated
 */
const SecretTypeId = secret/* .SecretTypeId */.gn;
/**
 * @since 2.0.0
 * @category refinements
 * @deprecated
 */
const isSecret = secret/* .isSecret */.$f;
/**
 * @since 2.0.0
 * @category constructors
 * @deprecated
 */
const Secret_make = secret/* .make */.L8;
/**
 * @since 2.0.0
 * @category constructors
 * @deprecated
 */
const Secret_fromIterable = secret/* .fromIterable */.Ts;
/**
 * @since 2.0.0
 * @category constructors
 * @deprecated
 */
const fromString = secret/* .fromString */.sH;
/**
 * @since 2.0.0
 * @category getters
 * @deprecated
 */
const Secret_value = secret/* .value */.Uq;
/**
 * @since 2.0.0
 * @category unsafe
 * @deprecated
 */
const unsafeWipe = secret/* .unsafeWipe */.Yd;
//# sourceMappingURL=Secret.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/singleProducerAsyncInput.js
var singleProducerAsyncInput = __webpack_require__(24111);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SingleProducerAsyncInput.js

/**
 * @since 2.0.0
 * @category constructors
 */
const SingleProducerAsyncInput_make = singleProducerAsyncInput/* .make */.L;
//# sourceMappingURL=SingleProducerAsyncInput.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Sink.js
var Sink = __webpack_require__(76424);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SortedMap.js
/**
 * @since 2.0.0
 */









const SortedMap_TypeId = /*#__PURE__*/Symbol.for("effect/SortedMap");
const SortedMapProto = {
  [SortedMap_TypeId]: {
    _K: _ => _,
    _V: _ => _
  },
  [Hash.symbol]() {
    return (0,Function.pipe)(Hash.hash(this.tree), Hash.combine(Hash.hash("effect/SortedMap")), Hash.cached(this));
  },
  [Equal.symbol](that) {
    return isSortedMap(that) && Equal.equals(this.tree, that.tree);
  },
  [Symbol.iterator]() {
    return this.tree[Symbol.iterator]();
  },
  toString() {
    return (0,Inspectable.format)(this.toJSON());
  },
  toJSON() {
    return {
      _id: "SortedMap",
      values: Array.from(this).map(Inspectable.toJSON)
    };
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const SortedMap_makeImpl = tree => {
  const self = Object.create(SortedMapProto);
  self.tree = tree;
  return self;
};
/**
 * @since 2.0.0
 * @category refinements
 */
const isSortedMap = u => (0,Predicate.hasProperty)(u, SortedMap_TypeId);
/**
 * @since 2.0.0
 * @category constructors
 */
const SortedMap_empty = ord => SortedMap_makeImpl(RedBlackTree.empty(ord));
/**
 * Creates a new `SortedMap` from an iterable collection of key/value pairs.
 *
 * @since 2.0.0
 * @category constructors
 */
const SortedMap_fromIterable = /*#__PURE__*/Function.dual(2, (iterable, ord) => SortedMap_makeImpl(RedBlackTree.fromIterable(iterable, ord)));
/**
 * @since 2.0.0
 * @category constructors
 */
const SortedMap_make = ord => (...entries) => SortedMap_fromIterable(ord)(entries);
/**
 * @since 2.0.0
 * @category predicates
 */
const isEmpty = self => SortedMap_size(self) === 0;
/**
 * @since 2.0.0
 * @category predicates
 */
const isNonEmpty = self => SortedMap_size(self) > 0;
/**
 * @since 2.0.0
 * @category elements
 */
const SortedMap_get = /*#__PURE__*/Function.dual(2, (self, key) => RedBlackTree.findFirst(self.tree, key));
/**
 * Gets the `Order<K>` that the `SortedMap<K, V>` is using.
 *
 * @since 2.0.0
 * @category getters
 */
const getOrder = self => RedBlackTree.getOrder(self.tree);
/**
 * @since 2.0.0
 * @category elements
 */
const SortedMap_has = /*#__PURE__*/Function.dual(2, (self, key) => Option.isSome(SortedMap_get(self, key)));
/**
 * @since 2.0.0
 * @category elements
 */
const headOption = self => RedBlackTree.first(self.tree);
/**
 * @since 2.0.0
 * @category mapping
 */
const SortedMap_map = /*#__PURE__*/Function.dual(2, (self, f) => SortedMap_reduce(self, SortedMap_empty(RedBlackTree.getOrder(self.tree)), (acc, v, k) => SortedMap_set(acc, k, f(v, k))));
/**
 * @since 2.0.0
 * @category folding
 */
const SortedMap_reduce = /*#__PURE__*/Function.dual(3, (self, zero, f) => RedBlackTree.reduce(self.tree, zero, f));
/**
 * @since 2.0.0
 * @category elements
 */
const SortedMap_remove = /*#__PURE__*/Function.dual(2, (self, key) => SortedMap_makeImpl(RedBlackTree.removeFirst(self.tree, key)));
/**
 * @since 2.0.0
 * @category elements
 */
const SortedMap_set = /*#__PURE__*/Function.dual(3, (self, key, value) => RedBlackTree.has(self.tree, key) ? SortedMap_makeImpl(RedBlackTree.insert(RedBlackTree.removeFirst(self.tree, key), key, value)) : SortedMap_makeImpl(RedBlackTree.insert(self.tree, key, value)));
/**
 * @since 2.0.0
 * @category getters
 */
const SortedMap_size = self => RedBlackTree.size(self.tree);
/**
 * @since 2.0.0
 * @category getters
 */
const SortedMap_keys = self => RedBlackTree.keys(self.tree);
/**
 * @since 2.0.0
 * @category getters
 */
const SortedMap_values = self => RedBlackTree.values(self.tree);
/**
 * @since 2.0.0
 * @category getters
 */
const SortedMap_entries = self => {
  const iterator = self.tree[Symbol.iterator]();
  iterator[Symbol.iterator] = () => SortedMap_entries(self);
  return iterator;
};
/**
 * @since 3.1.0
 * @category elements
 */
const lastOption = self => RedBlackTree.last(self.tree);
/**
 * @since 3.1.0
 * @category filtering
 */
const SortedMap_partition = /*#__PURE__*/Function.dual(2, (self, predicate) => {
  const ord = RedBlackTree.getOrder(self.tree);
  let right = SortedMap_empty(ord);
  let left = SortedMap_empty(ord);
  for (const value of self) {
    if (predicate(value[0])) {
      right = SortedMap_set(right, value[0], value[1]);
    } else {
      left = SortedMap_set(left, value[0], value[1]);
    }
  }
  return [left, right];
});
//# sourceMappingURL=SortedMap.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SortedSet.js
var SortedSet = __webpack_require__(5456);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Stream.js
var Stream = __webpack_require__(14287);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/StreamEmit.js

//# sourceMappingURL=StreamEmit.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/StreamHaltStrategy.js
var StreamHaltStrategy = __webpack_require__(39505);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Streamable.js
/**
 * @since 2.0.0
 */


const streamVariance = {
  /* c8 ignore next */
  _R: _ => _,
  /* c8 ignore next */
  _E: _ => _,
  /* c8 ignore next */
  _A: _ => _
};
/**
 * @since 2.0.0
 * @category constructors
 */
class Class {
  /**
   * @since 2.0.0
   */
  [Stream.StreamTypeId] = streamVariance;
  /**
   * @since 2.0.0
   */
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
  /**
   * @internal
   */
  get channel() {
    return Stream.toChannel(this.toStream());
  }
}
//# sourceMappingURL=Streamable.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/String.js
var esm_String = __webpack_require__(4562);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Struct.js
var Struct = __webpack_require__(20706);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Subscribable.js
/**
 * @since 2.0.0
 */






/**
 * @since 2.0.0
 * @category type ids
 */
const Subscribable_TypeId = /*#__PURE__*/Symbol.for("effect/Subscribable");
/**
 * @since 2.0.0
 * @category refinements
 */
const isSubscribable = u => (0,Predicate.hasProperty)(u, Subscribable_TypeId);
const Subscribable_Proto = {
  [Readable.TypeId]: Readable.TypeId,
  [Subscribable_TypeId]: Subscribable_TypeId,
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
/**
 * @since 2.0.0
 * @category constructors
 */
const Subscribable_make = options => Object.assign(Object.create(Subscribable_Proto), options);
/**
 * @since 2.0.0
 * @category combinators
 */
const Subscribable_map = /*#__PURE__*/(0,Function.dual)(2, (self, f) => Subscribable_make({
  get: Effect.map(self.get, f),
  changes: Stream.map(self.changes, f)
}));
/**
 * @since 2.0.0
 * @category combinators
 */
const mapEffect = /*#__PURE__*/(0,Function.dual)(2, (self, f) => Subscribable_make({
  get: Effect.flatMap(self.get, f),
  changes: Stream.mapEffect(self.changes, f)
}));
/**
 * @since 2.0.0
 * @category constructors
 */
const unwrap = effect => Subscribable_make({
  get: Effect.flatMap(effect, s => s.get),
  changes: Stream.unwrap(Effect.map(effect, s => s.changes))
});
//# sourceMappingURL=Subscribable.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SynchronizedRef.js



/**
 * @since 2.0.0
 * @category symbols
 */
const SynchronizedRefTypeId = circular/* .SynchronizedTypeId */.KX;
/**
 * @since 2.0.0
 * @category constructors
 */
const SynchronizedRef_make = circular/* .makeSynchronized */.PJ;
/**
 * @since 2.0.0
 * @category getters
 */
const SynchronizedRef_get = internal_ref/* .get */.Jt;
/**
 * @since 2.0.0
 * @category utils
 */
const getAndSet = internal_ref/* .getAndSet */.C2;
/**
 * @since 2.0.0
 * @category utils
 */
const getAndUpdate = internal_ref/* .getAndUpdate */.Ru;
/**
 * @since 2.0.0
 * @category utils
 */
const getAndUpdateEffect = synchronizedRef/* .getAndUpdateEffect */.cH;
/**
 * @since 2.0.0
 * @category utils
 */
const getAndUpdateSome = internal_ref/* .getAndUpdateSome */.$N;
/**
 * @since 2.0.0
 * @category utils
 */
const getAndUpdateSomeEffect = synchronizedRef/* .getAndUpdateSomeEffect */.Y3;
/**
 * @since 2.0.0
 * @category utils
 */
const SynchronizedRef_modify = synchronizedRef/* .modify */.JP;
/**
 * @since 2.0.0
 * @category utils
 */
const modifyEffect = synchronizedRef/* .modifyEffect */.Gt;
/**
 * @since 2.0.0
 * @category utils
 */
const modifySome = internal_ref/* .modifySome */.ni;
/**
 * @since 2.0.0
 * @category utils
 */
const modifySomeEffect = synchronizedRef/* .modifySomeEffect */.sY;
/**
 * @since 2.0.0
 * @category utils
 */
const SynchronizedRef_set = internal_ref/* .set */.hZ;
/**
 * @since 2.0.0
 * @category utils
 */
const setAndGet = internal_ref/* .setAndGet */._c;
/**
 * @since 2.0.0
 * @category utils
 */
const SynchronizedRef_update = internal_ref/* .update */.yo;
/**
 * @since 2.0.0
 * @category utils
 */
const updateEffect = synchronizedRef/* .updateEffect */.BQ;
/**
 * @since 2.0.0
 * @category utils
 */
const updateAndGet = internal_ref/* .updateAndGet */.lF;
/**
 * @since 2.0.0
 * @category utils
 */
const updateAndGetEffect = synchronizedRef/* .updateAndGetEffect */.Wz;
/**
 * @since 2.0.0
 * @category utils
 */
const updateSome = internal_ref/* .updateSome */.gH;
/**
 * @since 2.0.0
 * @category utils
 */
const updateSomeEffect = synchronizedRef/* .updateSomeEffect */.pu;
/**
 * @since 2.0.0
 * @category utils
 */
const updateSomeAndGet = internal_ref/* .updateSomeAndGet */.VH;
/**
 * @since 2.0.0
 * @category utils
 */
const updateSomeAndGetEffect = circular/* .updateSomeAndGetEffectSynchronized */.oD;
/**
 * @since 2.0.0
 * @category unsafe
 */
const SynchronizedRef_unsafeMake = circular/* .unsafeMakeSynchronized */.Do;
//# sourceMappingURL=SynchronizedRef.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stream.js + 9 modules
var stream = __webpack_require__(10251);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/subscriptionRef.js











/** @internal */
const SubscriptionRefSymbolKey = "effect/SubscriptionRef";
/** @internal */
const SubscriptionRefTypeId = /*#__PURE__*/Symbol.for(SubscriptionRefSymbolKey);
const subscriptionRefVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
class SubscriptionRefImpl extends Effectable.Class {
  ref;
  pubsub;
  semaphore;
  [Readable.TypeId] = Readable.TypeId;
  [Subscribable_TypeId] = Subscribable_TypeId;
  [Ref.RefTypeId] = internal_ref/* .refVariance */.VO;
  [SynchronizedRefTypeId] = circular/* .synchronizedVariance */.kd;
  [SubscriptionRefTypeId] = subscriptionRefVariance;
  constructor(ref, pubsub, semaphore) {
    super();
    this.ref = ref;
    this.pubsub = pubsub;
    this.semaphore = semaphore;
    this.get = Ref.get(this.ref);
  }
  commit() {
    return this.get;
  }
  get;
  get changes() {
    return (0,Function.pipe)(Ref.get(this.ref), Effect.flatMap(a => Effect.map(stream/* .fromPubSub */.qdp(this.pubsub, {
      scoped: true
    }), s => stream/* .concat */.xWs(stream/* .make */.L8n(a), s))), this.semaphore.withPermits(1), stream/* .unwrapScoped */.A2M);
  }
  modify(f) {
    return this.modifyEffect(a => Effect.succeed(f(a)));
  }
  modifyEffect(f) {
    return (0,Function.pipe)(Ref.get(this.ref), Effect.flatMap(f), Effect.flatMap(([b, a]) => (0,Function.pipe)(Ref.set(this.ref, a), Effect.as(b), Effect.zipLeft(PubSub.publish(this.pubsub, a)))), this.semaphore.withPermits(1));
  }
}
/** @internal */
const subscriptionRef_get = self => Ref.get(self.ref);
/** @internal */
const subscriptionRef_make = value => (0,Function.pipe)(Effect.all([PubSub.unbounded(), Ref.make(value), Effect.makeSemaphore(1)]), Effect.map(([pubsub, ref, semaphore]) => new SubscriptionRefImpl(ref, pubsub, semaphore)));
/** @internal */
const subscriptionRef_modify = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(f));
/** @internal */
const subscriptionRef_modifyEffect = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modifyEffect(f));
/** @internal */
const subscriptionRef_set = /*#__PURE__*/(0,Function.dual)(2, (self, value) => (0,Function.pipe)(Ref.set(self.ref, value), Effect.zipLeft(PubSub.publish(self.pubsub, value)), self.semaphore.withPermits(1)));
//# sourceMappingURL=subscriptionRef.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/SubscriptionRef.js



/**
 * @since 2.0.0
 * @category symbols
 */
const SubscriptionRef_SubscriptionRefTypeId = SubscriptionRefTypeId;
/**
 * @since 2.0.0
 * @category getters
 */
const SubscriptionRef_get = subscriptionRef_get;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_getAndSet = Ref.getAndSet;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_getAndUpdate = Ref.getAndUpdate;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_getAndUpdateEffect = getAndUpdateEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_getAndUpdateSome = Ref.getAndUpdateSome;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_getAndUpdateSomeEffect = getAndUpdateSomeEffect;
/**
 * Creates a new `SubscriptionRef` with the specified value.
 *
 * @since 2.0.0
 * @category constructors
 */
const SubscriptionRef_make = subscriptionRef_make;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_modify = subscriptionRef_modify;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_modifyEffect = subscriptionRef_modifyEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_modifySome = Ref.modifySome;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_modifySomeEffect = modifySomeEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_set = subscriptionRef_set;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_setAndGet = Ref.setAndGet;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_update = Ref.update;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateEffect = updateEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateAndGet = Ref.updateAndGet;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateAndGetEffect = updateAndGetEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateSome = Ref.updateSome;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateSomeEffect = updateSomeEffect;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateSomeAndGet = Ref.updateSomeAndGet;
/**
 * @since 2.0.0
 * @category utils
 */
const SubscriptionRef_updateSomeAndGetEffect = updateSomeAndGetEffect;
//# sourceMappingURL=SubscriptionRef.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/supervisor.js
var supervisor = __webpack_require__(14131);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Supervisor.js



/**
 * @since 2.0.0
 * @category symbols
 */
const SupervisorTypeId = supervisor/* .SupervisorTypeId */.uJ;
/**
 * @since 2.0.0
 * @category context
 */
const addSupervisor = layer_circular/* .addSupervisor */.C1;
/**
 * Creates a new supervisor that tracks children in a set.
 *
 * @since 2.0.0
 * @category constructors
 */
const fibersIn = supervisor/* .fibersIn */.Pt;
/**
 * Creates a new supervisor that constantly yields effect when polled
 *
 * @since 2.0.0
 * @category constructors
 */
const fromEffect = supervisor/* .fromEffect */.uS;
/**
 * A supervisor that doesn't do anything in response to supervision events.
 *
 * @since 2.0.0
 * @category constructors
 */
const Supervisor_none = supervisor/* .none */.dv;
/**
 * Creates a new supervisor that tracks children in a set.
 *
 * @since 2.0.0
 * @category constructors
 */
const track = supervisor/* .track */.u4;
/**
 * Unsafely creates a new supervisor that tracks children in a set.
 *
 * @since 2.0.0
 * @category unsafe
 */
const unsafeTrack = supervisor/* .unsafeTrack */.Oh;
/**
 * @since 2.0.0
 * @category constructors
 */
class AbstractSupervisor {
  /**
   * @since 2.0.0
   */
  onStart(_context, _effect, _parent, _fiber) {
    //
  }
  /**
   * @since 2.0.0
   */
  onEnd(_value, _fiber) {
    //
  }
  /**
   * @since 2.0.0
   */
  onEffect(_fiber, _effect) {
    //
  }
  /**
   * @since 2.0.0
   */
  onSuspend(_fiber) {
    //
  }
  /**
   * @since 2.0.0
   */
  onResume(_fiber) {
    //
  }
  /**
   * @since 2.0.0
   */
  map(f) {
    return new supervisor/* .ProxySupervisor */.rL(this, core/* .map */.TjK(this.value, f));
  }
  /**
   * @since 2.0.0
   */
  zip(right) {
    return new supervisor/* .Zip */.qQ(this, right);
  }
  /**
   * @since 2.0.0
   */
  onRun(execution, _fiber) {
    return execution();
  }
  /**
   * @since 2.0.0
   */
  [SupervisorTypeId] = supervisor/* .supervisorVariance */.cH;
}
//# sourceMappingURL=Supervisor.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Symbol.js
/**
 * @since 2.0.0
 */


/**
 * Tests if a value is a `symbol`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Predicate } from "effect"
 *
 * assert.deepStrictEqual(Predicate.isSymbol(Symbol.for("a")), true)
 * assert.deepStrictEqual(Predicate.isSymbol("a"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
const isSymbol = Predicate.isSymbol;
/**
 * @category instances
 * @since 2.0.0
 */
const Symbol_Equivalence = Equivalence.symbol;
//# sourceMappingURL=Symbol.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tRef.js
var tRef = __webpack_require__(81035);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tArray.js







/** @internal */
const TArraySymbolKey = "effect/TArray";
/** @internal */
const TArrayTypeId = /*#__PURE__*/Symbol.for(TArraySymbolKey);
const tArrayVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
class TArrayImpl {
  chunk;
  [TArrayTypeId] = tArrayVariance;
  constructor(chunk) {
    this.chunk = chunk;
  }
}
/** @internal */
const collectFirst = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => collectFirstSTM(self, a => (0,Function.pipe)(pf(a), Option.map(stm_core/* .succeed */.Py))));
/** @internal */
const collectFirstSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => stm_core/* .withSTMRuntime */.DG(runtime => {
  let index = 0;
  let result = Option.none();
  while (Option.isNone(result) && index < self.chunk.length) {
    const element = (0,Function.pipe)(self.chunk[index], tRef/* .unsafeGet */.$v(runtime.journal));
    const option = pf(element);
    if (Option.isSome(option)) {
      result = option;
    }
    index = index + 1;
  }
  return (0,Function.pipe)(result, Option.match({
    onNone: () => stm/* .succeedNone */.lw,
    onSome: stm_core/* .map */.Tj(Option.some)
  }));
}));
/** @internal */
const contains = /*#__PURE__*/(0,Function.dual)(2, (self, value) => tArray_some(self, a => Equal.equals(a)(value)));
/** @internal */
const tArray_count = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => tArray_reduce(self, 0, (n, a) => predicate(a) ? n + 1 : n));
/** @internal */
const countSTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => reduceSTM(self, 0, (n, a) => stm_core/* .map */.Tj(predicate(a), bool => bool ? n + 1 : n)));
/** @internal */
const tArray_empty = () => tArray_fromIterable([]);
/** @internal */
const tArray_every = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => stm/* .negate */.ze(tArray_some(self, a => !predicate(a))));
/** @internal */
const everySTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => stm_core/* .map */.Tj(countSTM(self, predicate), count => count === self.chunk.length));
/** @internal */
const findFirst = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => collectFirst(self, a => predicate(a) ? Option.some(a) : Option.none()));
/** @internal */
const findFirstIndex = /*#__PURE__*/(0,Function.dual)(2, (self, value) => findFirstIndexFrom(self, value, 0));
/** @internal */
const findFirstIndexFrom = /*#__PURE__*/(0,Function.dual)(3, (self, value, from) => findFirstIndexWhereFrom(self, a => Equal.equals(a)(value), from));
/** @internal */
const findFirstIndexWhere = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => findFirstIndexWhereFrom(self, predicate, 0));
/** @internal */
const findFirstIndexWhereFrom = /*#__PURE__*/(0,Function.dual)(3, (self, predicate, from) => {
  if (from < 0) {
    return stm/* .succeedNone */.lw;
  }
  return stm_core/* .effect */.QZ(journal => {
    let index = from;
    let found = false;
    while (!found && index < self.chunk.length) {
      const element = tRef/* .unsafeGet */.$v(self.chunk[index], journal);
      found = predicate(element);
      index = index + 1;
    }
    if (found) {
      return Option.some(index - 1);
    }
    return Option.none();
  });
});
/** @internal */
const findFirstIndexWhereSTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => findFirstIndexWhereFromSTM(self, predicate, 0));
/** @internal */
const findFirstIndexWhereFromSTM = /*#__PURE__*/(0,Function.dual)(3, (self, predicate, from) => {
  const forIndex = index => index < self.chunk.length ? (0,Function.pipe)(tRef/* .get */.Jt(self.chunk[index]), stm_core/* .flatMap */.qI(predicate), stm_core/* .flatMap */.qI(bool => bool ? stm_core/* .succeed */.Py(Option.some(index)) : forIndex(index + 1))) : stm/* .succeedNone */.lw;
  return from < 0 ? stm/* .succeedNone */.lw : forIndex(from);
});
/** @internal */
const findFirstSTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => {
  const init = [Option.none(), 0];
  const cont = state => Option.isNone(state[0]) && state[1] < self.chunk.length - 1;
  return stm_core/* .map */.Tj(stm/* .iterate */.nl(init, {
    while: cont,
    body: state => {
      const index = state[1];
      return (0,Function.pipe)(tRef/* .get */.Jt(self.chunk[index]), stm_core/* .flatMap */.qI(value => stm_core/* .map */.Tj(predicate(value), bool => [bool ? Option.some(value) : Option.none(), index + 1])));
    }
  }), state => state[0]);
});
/** @internal */
const findLast = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => stm_core/* .effect */.QZ(journal => {
  let index = self.chunk.length - 1;
  let result = Option.none();
  while (Option.isNone(result) && index >= 0) {
    const element = tRef/* .unsafeGet */.$v(self.chunk[index], journal);
    if (predicate(element)) {
      result = Option.some(element);
    }
    index = index - 1;
  }
  return result;
}));
/** @internal */
const findLastIndex = /*#__PURE__*/(0,Function.dual)(2, (self, value) => findLastIndexFrom(self, value, self.chunk.length - 1));
/** @internal */
const findLastIndexFrom = /*#__PURE__*/(0,Function.dual)(3, (self, value, end) => {
  if (end >= self.chunk.length) {
    return stm/* .succeedNone */.lw;
  }
  return stm_core/* .effect */.QZ(journal => {
    let index = end;
    let found = false;
    while (!found && index >= 0) {
      const element = tRef/* .unsafeGet */.$v(self.chunk[index], journal);
      found = Equal.equals(element)(value);
      index = index - 1;
    }
    if (found) {
      return Option.some(index + 1);
    }
    return Option.none();
  });
});
/** @internal */
const findLastSTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => {
  const init = [Option.none(), self.chunk.length - 1];
  const cont = state => Option.isNone(state[0]) && state[1] >= 0;
  return stm_core/* .map */.Tj(stm/* .iterate */.nl(init, {
    while: cont,
    body: state => {
      const index = state[1];
      return (0,Function.pipe)(tRef/* .get */.Jt(self.chunk[index]), stm_core/* .flatMap */.qI(value => stm_core/* .map */.Tj(predicate(value), bool => [bool ? Option.some(value) : Option.none(), index - 1])));
    }
  }), state => state[0]);
});
/** @internal */
const tArray_forEach = /*#__PURE__*/(0,Function.dual)(2, (self, f) => reduceSTM(self, void 0, (_, a) => f(a)));
/** @internal */
const tArray_fromIterable = iterable => stm_core/* .map */.Tj(stm/* .forEach */.jJ(iterable, tRef/* .make */.L8), chunk => new TArrayImpl(chunk));
/** @internal */
const tArray_get = /*#__PURE__*/(0,Function.dual)(2, (self, index) => {
  if (index < 0 || index >= self.chunk.length) {
    return stm_core/* .dieMessage */.GS("Index out of bounds");
  }
  return tRef/* .get */.Jt(self.chunk[index]);
});
/** @internal */
const tArray_headOption = self => self.chunk.length === 0 ? stm_core/* .succeed */.Py(Option.none()) : stm_core/* .map */.Tj(tRef/* .get */.Jt(self.chunk[0]), Option.some);
/** @internal */
const tArray_lastOption = self => self.chunk.length === 0 ? stm/* .succeedNone */.lw : stm_core/* .map */.Tj(tRef/* .get */.Jt(self.chunk[self.chunk.length - 1]), Option.some);
/** @internal */
const tArray_make = (...elements) => tArray_fromIterable(elements);
/** @internal */
const maxOption = /*#__PURE__*/(0,Function.dual)(2, (self, order) => {
  const greaterThan = Order.greaterThan(order);
  return reduceOption(self, (acc, curr) => greaterThan(acc)(curr) ? curr : acc);
});
/** @internal */
const minOption = /*#__PURE__*/(0,Function.dual)(2, (self, order) => {
  const lessThan = Order.lessThan(order);
  return reduceOption(self, (acc, curr) => lessThan(acc)(curr) ? curr : acc);
});
/** @internal */
const tArray_reduce = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => stm_core/* .effect */.QZ(journal => {
  let index = 0;
  let result = zero;
  while (index < self.chunk.length) {
    const element = tRef/* .unsafeGet */.$v(self.chunk[index], journal);
    result = f(result, element);
    index = index + 1;
  }
  return result;
}));
/** @internal */
const reduceOption = /*#__PURE__*/(0,Function.dual)(2, (self, f) => stm_core/* .effect */.QZ(journal => {
  let index = 0;
  let result = undefined;
  while (index < self.chunk.length) {
    const element = tRef/* .unsafeGet */.$v(self.chunk[index], journal);
    result = result === undefined ? element : f(result, element);
    index = index + 1;
  }
  return Option.fromNullable(result);
}));
/** @internal */
const reduceOptionSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => reduceSTM(self, Option.none(), (acc, curr) => Option.isSome(acc) ? stm_core/* .map */.Tj(f(acc.value, curr), Option.some) : stm/* .succeedSome */.nG(curr)));
/** @internal */
const reduceSTM = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => stm_core/* .flatMap */.qI(toArray(self), stm/* .reduce */.TS(zero, f)));
/** @internal */
const tArray_size = self => self.chunk.length;
/** @internal */
const tArray_some = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => stm_core/* .map */.Tj(findFirst(self, predicate), Option.isSome));
/** @internal */
const someSTM = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => stm_core/* .map */.Tj(countSTM(self, predicate), n => n > 0));
/** @internal */
const toArray = self => stm/* .forEach */.jJ(self.chunk, tRef/* .get */.Jt);
/** @internal */
const transform = /*#__PURE__*/(0,Function.dual)(2, (self, f) => stm_core/* .effect */.QZ(journal => {
  let index = 0;
  while (index < self.chunk.length) {
    const ref = self.chunk[index];
    tRef/* .unsafeSet */.lA(ref, f(tRef/* .unsafeGet */.$v(ref, journal)), journal);
    index = index + 1;
  }
  return void 0;
}));
/** @internal */
const transformSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => stm_core/* .flatMap */.qI(stm/* .forEach */.jJ(self.chunk, ref => stm_core/* .flatMap */.qI(tRef/* .get */.Jt(ref), f)), chunk => stm_core/* .effect */.QZ(journal => {
  const iterator = chunk[Symbol.iterator]();
  let index = 0;
  let next;
  while ((next = iterator.next()) && !next.done) {
    tRef/* .unsafeSet */.lA(self.chunk[index], next.value, journal);
    index = index + 1;
  }
  return void 0;
})));
/** @internal */
const tArray_update = /*#__PURE__*/(0,Function.dual)(3, (self, index, f) => {
  if (index < 0 || index >= self.chunk.length) {
    return stm_core/* .dieMessage */.GS("Index out of bounds");
  }
  return tRef/* .update */.yo(self.chunk[index], f);
});
/** @internal */
const updateSTM = /*#__PURE__*/(0,Function.dual)(3, (self, index, f) => {
  if (index < 0 || index >= self.chunk.length) {
    return stm_core/* .dieMessage */.GS("Index out of bounds");
  }
  return (0,Function.pipe)(tRef/* .get */.Jt(self.chunk[index]), stm_core/* .flatMap */.qI(f), stm_core/* .flatMap */.qI(updated => tRef/* .set */.hZ(self.chunk[index], updated)));
});
//# sourceMappingURL=tArray.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TArray.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const TArray_TArrayTypeId = TArrayTypeId;
/**
 * Finds the result of applying a partial function to the first value in its
 * domain.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_collectFirst = collectFirst;
/**
 * Finds the result of applying an transactional partial function to the first
 * value in its domain.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_collectFirstSTM = collectFirstSTM;
/**
 * Determine if the array contains a specified value.
 *
 * @macro trace
 * @since 2.0.0
 * @category elements
 */
const TArray_contains = contains;
/**
 * Count the values in the array matching a predicate.
 *
 * @macro trace
 * @since 2.0.0
 * @category folding
 */
const TArray_count = tArray_count;
/**
 * Count the values in the array matching a transactional predicate.
 *
 * @macro trace
 * @since 2.0.0
 * @category folding
 */
const TArray_countSTM = countSTM;
/**
 * Makes an empty `TArray`.
 *
 * @since 2.0.0
 * @category constructors
 */
const TArray_empty = tArray_empty;
/**
 * Atomically evaluate the conjunction of a predicate across the members of
 * the array.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_every = tArray_every;
/**
 * Atomically evaluate the conjunction of a transactional predicate across the
 * members of the array.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_everySTM = everySTM;
/**
 * Find the first element in the array matching the specified predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirst = findFirst;
/**
 * Get the first index of a specific value in the array.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndex = findFirstIndex;
/**
 * Get the first index of a specific value in the array starting from the
 * specified index.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndexFrom = findFirstIndexFrom;
/**
 * Get the index of the first entry in the array matching a predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndexWhere = findFirstIndexWhere;
/**
 * Get the index of the first entry in the array starting from the specified
 * index, matching a predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndexWhereFrom = findFirstIndexWhereFrom;
/**
 * Get the index of the next entry that matches a transactional predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndexWhereSTM = findFirstIndexWhereSTM;
/**
 * Starting at specified index, get the index of the next entry that matches a
 * transactional predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstIndexWhereFromSTM = findFirstIndexWhereFromSTM;
/**
 * Find the first element in the array matching a transactional predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findFirstSTM = findFirstSTM;
/**
 * Find the last element in the array matching a predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findLast = findLast;
/**
 * Get the last index of a specific value in the array bounded above by a
 * specific index.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findLastIndex = findLastIndex;
/**
 * Get the last index of a specific value in the array bounded above by a
 * specific index.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findLastIndexFrom = findLastIndexFrom;
/**
 * Find the last element in the array matching a transactional predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_findLastSTM = findLastSTM;
/**
 * Atomically performs transactional effect for each item in array.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_forEach = tArray_forEach;
/**
 * Creates a new `TArray` from an iterable collection of values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TArray_fromIterable = tArray_fromIterable;
/**
 * Extracts value from ref in array.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_get = tArray_get;
/**
 * The first entry of the array, if it exists.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_headOption = tArray_headOption;
/**
 * The last entry in the array, if it exists.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_lastOption = tArray_lastOption;
/**
 * Makes a new `TArray` that is initialized with specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TArray_make = tArray_make;
/**
 * Atomically compute the greatest element in the array, if it exists.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_maxOption = maxOption;
/**
 * Atomically compute the least element in the array, if it exists.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_minOption = minOption;
/**
 * Atomically folds using a pure function.
 *
 * @since 2.0.0
 * @category folding
 */
const TArray_reduce = tArray_reduce;
/**
 * Atomically reduce the array, if non-empty, by a binary operator.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_reduceOption = reduceOption;
/**
 * Atomically reduce the non-empty array using a transactional binary
 * operator.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_reduceOptionSTM = reduceOptionSTM;
/**
 * Atomically folds using a transactional function.
 *
 * @macro trace
 * @since 2.0.0
 * @category folding
 */
const TArray_reduceSTM = reduceSTM;
/**
 * Returns the size of the `TArray`.
 *
 * @since 2.0.0
 * @category getters
 */
const TArray_size = tArray_size;
/**
 * Determine if the array contains a value satisfying a predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_some = tArray_some;
/**
 * Determine if the array contains a value satisfying a transactional
 * predicate.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_someSTM = someSTM;
/**
 * Collects all elements into a chunk.
 *
 * @since 2.0.0
 * @since 2.0.0
 * @category destructors
 */
const TArray_toArray = toArray;
/**
 * Atomically updates all elements using a pure function.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_transform = transform;
/**
 * Atomically updates all elements using a transactional effect.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_transformSTM = transformSTM;
/**
 * Updates element in the array with given function.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_update = tArray_update;
/**
 * Atomically updates element in the array with given transactional effect.
 *
 * @since 2.0.0
 * @category elements
 */
const TArray_updateSTM = updateSTM;
//# sourceMappingURL=TArray.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tDeferred.js






/** @internal */
const TDeferredSymbolKey = "effect/TDeferred";
/** @internal */
const TDeferredTypeId = /*#__PURE__*/Symbol.for(TDeferredSymbolKey);
/** @internal */
const tDeferredVariance = {
  /* c8 ignore next */
  _A: _ => _,
  /* c8 ignore next */
  _E: _ => _
};
/** @internal */
class TDeferredImpl {
  ref;
  [TDeferredTypeId] = tDeferredVariance;
  constructor(ref) {
    this.ref = ref;
  }
}
/** @internal */
const _await = self => stm/* .flatten */.Bq(stm/* .collect */.Fo(tRef/* .get */.Jt(self.ref), option => Option.isSome(option) ? Option.some(stm/* .fromEither */.Mr(option.value)) : Option.none()));
/** @internal */
const done = /*#__PURE__*/(0,Function.dual)(2, (self, either) => stm_core/* .flatMap */.qI(tRef/* .get */.Jt(self.ref), Option.match({
  onNone: () => stm_core/* .zipRight */.aN(tRef/* .set */.hZ(self.ref, Option.some(either)), stm_core/* .succeed */.Py(true)),
  onSome: () => stm_core/* .succeed */.Py(false)
})));
/** @internal */
const tDeferred_fail = /*#__PURE__*/(0,Function.dual)(2, (self, error) => done(self, Either.left(error)));
/** @internal */
const tDeferred_make = () => stm_core/* .map */.Tj(tRef/* .make */.L8(Option.none()), ref => new TDeferredImpl(ref));
/** @internal */
const tDeferred_poll = self => tRef/* .get */.Jt(self.ref);
/** @internal */
const tDeferred_succeed = /*#__PURE__*/(0,Function.dual)(2, (self, value) => done(self, Either.right(value)));
//# sourceMappingURL=tDeferred.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TDeferred.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TDeferred_TDeferredTypeId = TDeferredTypeId;
const TDeferred_await = _await;

/**
 * @since 2.0.0
 * @category mutations
 */
const TDeferred_done = done;
/**
 * @since 2.0.0
 * @category mutations
 */
const TDeferred_fail = tDeferred_fail;
/**
 * @since 2.0.0
 * @category constructors
 */
const TDeferred_make = tDeferred_make;
/**
 * @since 2.0.0
 * @category getters
 */
const TDeferred_poll = tDeferred_poll;
/**
 * @since 2.0.0
 * @category mutations
 */
const TDeferred_succeed = tDeferred_succeed;
//# sourceMappingURL=TDeferred.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tMap.js













/** @internal */
const TMapSymbolKey = "effect/TMap";
/** @internal */
const TMapTypeId = /*#__PURE__*/Symbol.for(TMapSymbolKey);
const tMapVariance = {
  /* c8 ignore next */
  _K: _ => _,
  /* c8 ignore next */
  _V: _ => _
};
/** @internal */
class TMapImpl {
  tBuckets;
  tSize;
  [TMapTypeId] = tMapVariance;
  constructor(tBuckets, tSize) {
    this.tBuckets = tBuckets;
    this.tSize = tSize;
  }
}
const isTMap = u => (0,Predicate.hasProperty)(u, TMapTypeId);
/** @internal */
const InitialCapacity = 16;
const LoadFactor = 0.75;
/** @internal */
const nextPowerOfTwo = size => {
  const n = -1 >>> Math.clz32(size - 1);
  return n < 0 ? 1 : n + 1;
};
/** @internal */
const tMap_hash = key => {
  const h = Hash.hash(key);
  return h ^ h >>> 16;
};
/** @internal */
const indexOf = (k, capacity) => tMap_hash(k) & capacity - 1;
/** @internal */
const allocate = (capacity, data) => {
  const buckets = Array.from({
    length: capacity
  }, () => Chunk.empty());
  const distinct = new Map(data);
  let size = 0;
  for (const entry of distinct) {
    const index = indexOf(entry[0], capacity);
    buckets[index] = (0,Function.pipe)(buckets[index], Chunk.prepend(entry));
    size = size + 1;
  }
  return (0,Function.pipe)(tArray_fromIterable(buckets), stm_core/* .flatMap */.qI(buckets => (0,Function.pipe)(tRef/* .make */.L8(buckets), stm_core/* .flatMap */.qI(tBuckets => (0,Function.pipe)(tRef/* .make */.L8(size), stm_core/* .map */.Tj(tSize => new TMapImpl(tBuckets, tSize)))))));
};
/** @internal */
const tMap_empty = () => tMap_fromIterable([]);
/** @internal */
const find = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => findSTM(self, (key, value) => {
  const option = pf(key, value);
  if (Option.isSome(option)) {
    return stm_core/* .succeed */.Py(option.value);
  }
  return stm_core/* .fail */.fJ(Option.none());
}));
/** @internal */
const findSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_reduceSTM(self, Option.none(), (acc, value, key) => Option.isNone(acc) ? stm_core/* .matchSTM */.Gs(f(key, value), {
  onFailure: Option.match({
    onNone: () => stm/* .succeedNone */.lw,
    onSome: stm_core/* .fail */.fJ
  }),
  onSuccess: stm/* .succeedSome */.nG
}) : STM_succeed(acc)));
/** @internal */
const findAll = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => findAllSTM(self, (key, value) => {
  const option = pf(key, value);
  if (Option.isSome(option)) {
    return stm_core/* .succeed */.Py(option.value);
  }
  return stm_core/* .fail */.fJ(Option.none());
}));
/** @internal */
const findAllSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => stm_core/* .map */.Tj(tMap_reduceSTM(self, Chunk.empty(), (acc, value, key) => stm_core/* .matchSTM */.Gs(pf(key, value), {
  onFailure: Option.match({
    onNone: () => stm_core/* .succeed */.Py(acc),
    onSome: stm_core/* .fail */.fJ
  }),
  onSuccess: a => stm_core/* .succeed */.Py(Chunk.append(acc, a))
})), a => Array.from(a)));
/** @internal */
const tMap_forEach = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_reduceSTM(self, void 0, (_, value, key) => stm/* .asVoid */.NL(f(key, value))));
/** @internal */
const tMap_fromIterable = iterable => stm/* .suspend */.DY(() => {
  const data = Chunk.fromIterable(iterable);
  const capacity = data.length < InitialCapacity ? InitialCapacity : nextPowerOfTwo(data.length);
  return allocate(capacity, data);
});
/** @internal */
const tMap_get = /*#__PURE__*/(0,Function.dual)(2, (self, key) => stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const index = indexOf(key, buckets.chunk.length);
  const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
  return (0,Function.pipe)(Chunk.findFirst(bucket, entry => Equal.equals(entry[0])(key)), Option.map(entry => entry[1]));
}));
/** @internal */
const getOrElse = /*#__PURE__*/(0,Function.dual)(3, (self, key, fallback) => stm_core/* .map */.Tj(tMap_get(self, key), Option.getOrElse(fallback)));
/** @internal */
const tMap_has = /*#__PURE__*/(0,Function.dual)(2, (self, key) => stm_core/* .map */.Tj(tMap_get(self, key), Option.isSome));
/** @internal */
const tMap_isEmpty = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.tSize), size => size === 0);
/** @internal */
const tMap_keys = self => stm_core/* .map */.Tj(toReadonlyArray(self), esm_Array.map(entry => entry[0]));
/** @internal */
const tMap_make = (...entries) => tMap_fromIterable(entries);
/** @internal */
const tMap_merge = /*#__PURE__*/(0,Function.dual)(4, (self, key, value, f) => stm_core/* .flatMap */.qI(tMap_get(self, key), Option.match({
  onNone: () => stm.as(tMap_set(self, key, value), value),
  onSome: v0 => {
    const v1 = f(v0, value);
    return stm.as(tMap_set(self, key, v1), v1);
  }
})));
/** @internal */
const tMap_reduce = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  let result = zero;
  let index = 0;
  while (index < buckets.chunk.length) {
    const bucket = buckets.chunk[index];
    const items = tRef/* .unsafeGet */.$v(bucket, journal);
    result = Chunk.reduce(items, result, (acc, entry) => f(acc, entry[1], entry[0]));
    index = index + 1;
  }
  return result;
}));
/** @internal */
const tMap_reduceSTM = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => stm_core/* .flatMap */.qI(toReadonlyArray(self), stm/* .reduce */.TS(zero, (acc, entry) => f(acc, entry[1], entry[0]))));
/** @internal */
const tMap_remove = /*#__PURE__*/(0,Function.dual)(2, (self, key) => stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const index = indexOf(key, buckets.chunk.length);
  const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
  const [toRemove, toRetain] = Chunk.partition(bucket, entry => Equal.equals(entry[1], key));
  if (Chunk.isNonEmpty(toRemove)) {
    const currentSize = tRef/* .unsafeGet */.$v(self.tSize, journal);
    tRef/* .unsafeSet */.lA(buckets.chunk[index], toRetain, journal);
    tRef/* .unsafeSet */.lA(self.tSize, currentSize - 1, journal);
  }
}));
/** @internal */
const removeAll = /*#__PURE__*/(0,Function.dual)(2, (self, keys) => stm_core/* .effect */.QZ(journal => {
  const iterator = keys[Symbol.iterator]();
  let next;
  while ((next = iterator.next()) && !next.done) {
    const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
    const index = indexOf(next.value, buckets.chunk.length);
    const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
    const [toRemove, toRetain] = Chunk.partition(bucket, entry => Equal.equals(next.value)(entry[0]));
    if (Chunk.isNonEmpty(toRemove)) {
      const currentSize = tRef/* .unsafeGet */.$v(self.tSize, journal);
      tRef/* .unsafeSet */.lA(buckets.chunk[index], toRetain, journal);
      tRef/* .unsafeSet */.lA(self.tSize, currentSize - 1, journal);
    }
  }
}));
/** @internal */
const removeIf = /*#__PURE__*/(0,Function.dual)(args => isTMap(args[0]), (self, predicate, options) => stm_core/* .effect */.QZ(journal => {
  const discard = options?.discard === true;
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const capacity = buckets.chunk.length;
  const removed = [];
  let index = 0;
  let newSize = 0;
  while (index < capacity) {
    const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
    const iterator = bucket[Symbol.iterator]();
    let next;
    let newBucket = Chunk.empty();
    while ((next = iterator.next()) && !next.done) {
      const [k, v] = next.value;
      if (!predicate(k, v)) {
        newBucket = Chunk.prepend(newBucket, next.value);
        newSize = newSize + 1;
      } else {
        if (!discard) {
          removed.push([k, v]);
        }
      }
    }
    tRef/* .unsafeSet */.lA(buckets.chunk[index], newBucket, journal);
    index = index + 1;
  }
  tRef/* .unsafeSet */.lA(self.tSize, newSize, journal);
  if (!discard) {
    return removed;
  }
}));
/** @internal */
const retainIf = /*#__PURE__*/(0,Function.dual)(args => isTMap(args[0]), (self, predicate, options) => removeIf(self, (key, value) => !predicate(key, value), options));
/** @internal */
const tMap_set = /*#__PURE__*/(0,Function.dual)(3, (self, key, value) => {
  const resize = (journal, buckets) => {
    const capacity = buckets.chunk.length;
    const newCapacity = capacity << 1;
    const newBuckets = Array.from({
      length: newCapacity
    }, () => Chunk.empty());
    let index = 0;
    while (index < capacity) {
      const pairs = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
      const iterator = pairs[Symbol.iterator]();
      let next;
      while ((next = iterator.next()) && !next.done) {
        const newIndex = indexOf(next.value[0], newCapacity);
        newBuckets[newIndex] = Chunk.prepend(newBuckets[newIndex], next.value);
      }
      index = index + 1;
    }
    // insert new pair
    const newIndex = indexOf(key, newCapacity);
    newBuckets[newIndex] = Chunk.prepend(newBuckets[newIndex], [key, value]);
    const newArray = [];
    index = 0;
    while (index < newCapacity) {
      newArray[index] = new tRef/* .TRefImpl */.Cl(newBuckets[index]);
      index = index + 1;
    }
    const newTArray = new TArrayImpl(newArray);
    tRef/* .unsafeSet */.lA(self.tBuckets, newTArray, journal);
  };
  return stm_core/* .effect */.QZ(journal => {
    const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
    const capacity = buckets.chunk.length;
    const index = indexOf(key, capacity);
    const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
    const shouldUpdate = Chunk.some(bucket, entry => Equal.equals(key)(entry[0]));
    if (shouldUpdate) {
      const newBucket = Chunk.map(bucket, entry => Equal.equals(key)(entry[0]) ? [key, value] : entry);
      tRef/* .unsafeSet */.lA(buckets.chunk[index], newBucket, journal);
    } else {
      const newSize = tRef/* .unsafeGet */.$v(self.tSize, journal) + 1;
      tRef/* .unsafeSet */.lA(self.tSize, newSize, journal);
      if (capacity * LoadFactor < newSize) {
        resize(journal, buckets);
      } else {
        const newBucket = Chunk.prepend(bucket, [key, value]);
        tRef/* .unsafeSet */.lA(buckets.chunk[index], newBucket, journal);
      }
    }
  });
});
/** @internal */
const setIfAbsent = /*#__PURE__*/(0,Function.dual)(3, (self, key, value) => stm_core/* .flatMap */.qI(tMap_get(self, key), Option.match({
  onNone: () => tMap_set(self, key, value),
  onSome: () => stm/* ["void"] */.rI
})));
/** @internal */
const tMap_size = self => tRef/* .get */.Jt(self.tSize);
/** @internal */
const takeFirst = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => (0,Function.pipe)(stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const capacity = buckets.chunk.length;
  const size = tRef/* .unsafeGet */.$v(self.tSize, journal);
  let result = Option.none();
  let index = 0;
  while (index < capacity && Option.isNone(result)) {
    const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
    const recreate = Chunk.some(bucket, entry => Option.isSome(pf(entry[0], entry[1])));
    if (recreate) {
      const iterator = bucket[Symbol.iterator]();
      let newBucket = Chunk.empty();
      let next;
      while ((next = iterator.next()) && !next.done && Option.isNone(result)) {
        const option = pf(next.value[0], next.value[1]);
        if (Option.isSome(option) && Option.isNone(result)) {
          result = option;
        } else {
          newBucket = Chunk.prepend(newBucket, next.value);
        }
      }
      tRef/* .unsafeSet */.lA(buckets.chunk[index], newBucket, journal);
    }
    index = index + 1;
  }
  if (Option.isSome(result)) {
    tRef/* .unsafeSet */.lA(self.tSize, size - 1, journal);
  }
  return result;
}), stm/* .collect */.Fo(option => Option.isSome(option) ? Option.some(option.value) : Option.none())));
/** @internal */
const takeFirstSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => (0,Function.pipe)(findSTM(self, (key, value) => stm_core/* .map */.Tj(pf(key, value), a => [key, a])), stm/* .collect */.Fo(option => Option.isSome(option) ? Option.some(option.value) : Option.none()), stm_core/* .flatMap */.qI(entry => stm.as(tMap_remove(self, entry[0]), entry[1]))));
/** @internal */
const takeSome = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => (0,Function.pipe)(stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const capacity = buckets.chunk.length;
  const builder = [];
  let newSize = 0;
  let index = 0;
  while (index < capacity) {
    const bucket = tRef/* .unsafeGet */.$v(buckets.chunk[index], journal);
    const recreate = Chunk.some(bucket, entry => Option.isSome(pf(entry[0], entry[1])));
    if (recreate) {
      const iterator = bucket[Symbol.iterator]();
      let newBucket = Chunk.empty();
      let next;
      while ((next = iterator.next()) && !next.done) {
        const option = pf(next.value[0], next.value[1]);
        if (Option.isSome(option)) {
          builder.push(option.value);
        } else {
          newBucket = Chunk.prepend(newBucket, next.value);
          newSize = newSize + 1;
        }
      }
      tRef/* .unsafeSet */.lA(buckets.chunk[index], newBucket, journal);
    } else {
      newSize = newSize + bucket.length;
    }
    index = index + 1;
  }
  tRef/* .unsafeSet */.lA(self.tSize, newSize, journal);
  if (builder.length > 0) {
    return Option.some(builder);
  }
  return Option.none();
}), stm/* .collect */.Fo(option => Option.isSome(option) ? Option.some(option.value) : Option.none())));
/** @internal */
const takeSomeSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => (0,Function.pipe)(findAllSTM(self, (key, value) => stm_core/* .map */.Tj(pf(key, value), a => [key, a])), stm_core/* .map */.Tj(chunk => esm_Array.isNonEmptyArray(chunk) ? Option.some(chunk) : Option.none()), stm/* .collect */.Fo(option => Option.isSome(option) ? Option.some(option.value) : Option.none()), stm_core/* .flatMap */.qI(entries => stm.as(removeAll(self, entries.map(entry => entry[0])), esm_Array.map(entries, entry => entry[1])))));
const toReadonlyArray = self => stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const capacity = buckets.chunk.length;
  const builder = [];
  let index = 0;
  while (index < capacity) {
    const bucket = buckets.chunk[index];
    for (const entry of tRef/* .unsafeGet */.$v(bucket, journal)) {
      builder.push(entry);
    }
    index = index + 1;
  }
  return builder;
});
/** @internal */
const toChunk = self => tMap_reduce(self, Chunk.empty(), (acc, value, key) => Chunk.append(acc, [key, value]));
/** @internal */
const toHashMap = self => tMap_reduce(self, HashMap.empty(), (acc, value, key) => (0,Function.pipe)(acc, HashMap.set(key, value)));
/** @internal */
const tMap_toArray = self => tMap_reduce(self, [], (acc, value, key) => {
  acc.unshift([key, value]);
  return acc;
});
/** @internal */
const toMap = self => tMap_reduce(self, new Map(), (acc, value, key) => acc.set(key, value));
/** @internal */
const tMap_transform = /*#__PURE__*/(0,Function.dual)(2, (self, f) => stm_core/* .effect */.QZ(journal => {
  const buckets = (0,Function.pipe)(self.tBuckets, tRef/* .unsafeGet */.$v(journal));
  const capacity = buckets.chunk.length;
  const newBuckets = Array.from({
    length: capacity
  }, () => Chunk.empty());
  let newSize = 0;
  let index = 0;
  while (index < capacity) {
    const bucket = buckets.chunk[index];
    const pairs = tRef/* .unsafeGet */.$v(bucket, journal);
    const iterator = pairs[Symbol.iterator]();
    let next;
    while ((next = iterator.next()) && !next.done) {
      const newPair = f(next.value[0], next.value[1]);
      const index = indexOf(newPair[0], capacity);
      const newBucket = newBuckets[index];
      if (!Chunk.some(newBucket, entry => Equal.equals(entry[0], newPair[0]))) {
        newBuckets[index] = Chunk.prepend(newBucket, newPair);
        newSize = newSize + 1;
      }
    }
    index = index + 1;
  }
  index = 0;
  while (index < capacity) {
    tRef/* .unsafeSet */.lA(buckets.chunk[index], newBuckets[index], journal);
    index = index + 1;
  }
  tRef/* .unsafeSet */.lA(self.tSize, newSize, journal);
}));
/** @internal */
const tMap_transformSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => (0,Function.pipe)(stm_core/* .flatMap */.qI(toReadonlyArray(self), stm/* .forEach */.jJ(entry => f(entry[0], entry[1]))), stm_core/* .flatMap */.qI(newData => stm_core/* .effect */.QZ(journal => {
  const buckets = tRef/* .unsafeGet */.$v(self.tBuckets, journal);
  const capacity = buckets.chunk.length;
  const newBuckets = Array.from({
    length: capacity
  }, () => Chunk.empty());
  const iterator = newData[Symbol.iterator]();
  let newSize = 0;
  let next;
  while ((next = iterator.next()) && !next.done) {
    const index = indexOf(next.value[0], capacity);
    const newBucket = newBuckets[index];
    if (!Chunk.some(newBucket, entry => Equal.equals(entry[0])(next.value[0]))) {
      newBuckets[index] = Chunk.prepend(newBucket, next.value);
      newSize = newSize + 1;
    }
  }
  let index = 0;
  while (index < capacity) {
    tRef/* .unsafeSet */.lA(buckets.chunk[index], newBuckets[index], journal);
    index = index + 1;
  }
  tRef/* .unsafeSet */.lA(self.tSize, newSize, journal);
}))));
/** @internal */
const transformValues = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_transform(self, (key, value) => [key, f(value)]));
/** @internal */
const transformValuesSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_transformSTM(self, (key, value) => stm_core/* .map */.Tj(f(value), value => [key, value])));
/** @internal */
const updateWith = /*#__PURE__*/(0,Function.dual)(3, (self, key, f) => stm_core/* .flatMap */.qI(tMap_get(self, key), option => Option.match(f(option), {
  onNone: () => stm.as(tMap_remove(self, key), Option.none()),
  onSome: value => stm.as(tMap_set(self, key, value), Option.some(value))
})));
/** @internal */
const tMap_values = self => stm_core/* .map */.Tj(toReadonlyArray(self), esm_Array.map(entry => entry[1]));
//# sourceMappingURL=tMap.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TMap.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TMap_TMapTypeId = TMapTypeId;
/**
 * Makes an empty `TMap`.
 *
 * @since 2.0.0
 * @category constructors
 */
const TMap_empty = tMap_empty;
/**
 * Finds the key/value pair matching the specified predicate, and uses the
 * provided function to extract a value out of it.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_find = find;
/**
 * Finds the key/value pair matching the specified predicate, and uses the
 * provided effectful function to extract a value out of it.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_findSTM = findSTM;
/**
 * Finds all the key/value pairs matching the specified predicate, and uses
 * the provided function to extract values out them.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_findAll = findAll;
/**
 * Finds all the key/value pairs matching the specified predicate, and uses
 * the provided effectful function to extract values out of them..
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_findAllSTM = findAllSTM;
/**
 * Atomically performs transactional-effect for each binding present in map.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_forEach = tMap_forEach;
/**
 * Creates a new `TMap` from an iterable collection of key/value pairs.
 *
 * @since 2.0.0
 * @category constructors
 */
const TMap_fromIterable = tMap_fromIterable;
/**
 * Retrieves value associated with given key.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_get = tMap_get;
/**
 * Retrieves value associated with given key or default value, in case the key
 * isn't present.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_getOrElse = getOrElse;
/**
 * Tests whether or not map contains a key.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_has = tMap_has;
/**
 * Tests if the map is empty or not.
 *
 * @since 2.0.0
 * @category getters
 */
const TMap_isEmpty = tMap_isEmpty;
/**
 * Collects all keys stored in map.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_keys = tMap_keys;
/**
 * Makes a new `TMap` that is initialized with specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TMap_make = tMap_make;
/**
 * If the key is not already associated with a value, stores the provided value,
 * otherwise merge the existing value with the new one using function `f` and
 * store the result.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_merge = tMap_merge;
/**
 * Atomically folds using a pure function.
 *
 * @since 2.0.0
 * @category folding
 */
const TMap_reduce = tMap_reduce;
/**
 * Atomically folds using a transactional function.
 *
 * @since 2.0.0
 * @category folding
 */
const TMap_reduceSTM = tMap_reduceSTM;
/**
 * Removes binding for given key.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_remove = tMap_remove;
/**
 * Deletes all entries associated with the specified keys.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_removeAll = removeAll;
/**
 * Removes entries from a `TMap` that satisfy the specified predicate and returns the removed entries
 * (or `void` if `discard = true`).
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_removeIf = removeIf;
/**
 * Retains entries in a `TMap` that satisfy the specified predicate and returns the removed entries
 * (or `void` if `discard = true`).
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_retainIf = retainIf;
/**
 * Stores new binding into the map.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_set = tMap_set;
/**
 * Stores new binding in the map if it does not already exist.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_setIfAbsent = setIfAbsent;
/**
 * Returns the number of bindings.
 *
 * @since 2.0.0
 * @category getters
 */
const TMap_size = tMap_size;
/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_takeFirst = takeFirst;
/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_takeFirstSTM = takeFirstSTM;
/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_takeSome = takeSome;
/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_takeSomeSTM = takeSomeSTM;
/**
 * Collects all bindings into a `Chunk`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TMap_toChunk = toChunk;
/**
 * Collects all bindings into a `HashMap`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TMap_toHashMap = toHashMap;
/**
 * Collects all bindings into an `Array`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TMap_toArray = tMap_toArray;
/**
 * Collects all bindings into a `Map`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TMap_toMap = toMap;
/**
 * Atomically updates all bindings using a pure function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_transform = tMap_transform;
/**
 * Atomically updates all bindings using a transactional function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_transformSTM = tMap_transformSTM;
/**
 * Atomically updates all values using a pure function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_transformValues = transformValues;
/**
 * Atomically updates all values using a transactional function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_transformValuesSTM = transformValuesSTM;
/**
 * Updates the mapping for the specified key with the specified function,
 * which takes the current value of the key as an input, if it exists, and
 * either returns `Some` with a new value to indicate to update the value in
 * the map or `None` to remove the value from the map. Returns `Some` with the
 * updated value or `None` if the value was removed from the map.
 *
 * @since 2.0.0
 * @category mutations
 */
const TMap_updateWith = updateWith;
/**
 * Collects all values stored in map.
 *
 * @since 2.0.0
 * @category elements
 */
const TMap_values = tMap_values;
//# sourceMappingURL=TMap.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tPriorityQueue.js







/** @internal */
const TPriorityQueueSymbolKey = "effect/TPriorityQueue";
/** @internal */
const TPriorityQueueTypeId = /*#__PURE__*/Symbol.for(TPriorityQueueSymbolKey);
const tPriorityQueueVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
class TPriorityQueueImpl {
  ref;
  [TPriorityQueueTypeId] = tPriorityQueueVariance;
  constructor(ref) {
    this.ref = ref;
  }
}
/** @internal */
const tPriorityQueue_empty = order => (0,Function.pipe)(tRef/* .make */.L8(SortedMap_empty(order)), stm_core/* .map */.Tj(ref => new TPriorityQueueImpl(ref)));
/** @internal */
const tPriorityQueue_fromIterable = order => iterable => (0,Function.pipe)(tRef/* .make */.L8(esm_Array.fromIterable(iterable).reduce((map, value) => (0,Function.pipe)(map, SortedMap_set(value, (0,Function.pipe)(map, SortedMap_get(value), Option.match({
  onNone: () => esm_Array.of(value),
  onSome: esm_Array.prepend(value)
})))), SortedMap_empty(order))), stm_core/* .map */.Tj(ref => new TPriorityQueueImpl(ref)));
/** @internal */
const tPriorityQueue_isEmpty = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.ref), isEmpty);
/** @internal */
const tPriorityQueue_isNonEmpty = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.ref), isNonEmpty);
/** @internal */
const tPriorityQueue_make = order => (...elements) => tPriorityQueue_fromIterable(order)(elements);
/** @internal */
const offer = /*#__PURE__*/(0,Function.dual)(2, (self, value) => tRef/* .update */.yo(self.ref, map => SortedMap_set(map, value, Option.match(SortedMap_get(map, value), {
  onNone: () => esm_Array.of(value),
  onSome: esm_Array.prepend(value)
}))));
/** @internal */
const offerAll = /*#__PURE__*/(0,Function.dual)(2, (self, values) => tRef/* .update */.yo(self.ref, map => esm_Array.fromIterable(values).reduce((map, value) => SortedMap_set(map, value, Option.match(SortedMap_get(map, value), {
  onNone: () => esm_Array.of(value),
  onSome: esm_Array.prepend(value)
})), map)));
/** @internal */
const peek = self => stm_core/* .withSTMRuntime */.DG(runtime => {
  const map = tRef/* .unsafeGet */.$v(self.ref, runtime.journal);
  return Option.match(headOption(map), {
    onNone: () => stm_core/* .retry */.L5,
    onSome: elements => stm_core/* .succeed */.Py(elements[0])
  });
});
/** @internal */
const peekOption = self => tRef/* .modify */.JP(self.ref, map => [Option.map(headOption(map), elements => elements[0]), map]);
/** @internal */
const tPriorityQueue_removeIf = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => tPriorityQueue_retainIf(self, a => !predicate(a)));
/** @internal */
const tPriorityQueue_retainIf = /*#__PURE__*/(0,Function.dual)(2, (self, predicate) => tRef/* .update */.yo(self.ref, map => SortedMap_reduce(map, SortedMap_empty(getOrder(map)), (map, value, key) => {
  const filtered = esm_Array.filter(value, predicate);
  return filtered.length > 0 ? SortedMap_set(map, key, filtered) : SortedMap_remove(map, key);
})));
/** @internal */
const tPriorityQueue_size = self => tRef/* .modify */.JP(self.ref, map => [SortedMap_reduce(map, 0, (n, as) => n + as.length), map]);
/** @internal */
const tPriorityQueue_take = self => stm_core/* .withSTMRuntime */.DG(runtime => {
  const map = tRef/* .unsafeGet */.$v(self.ref, runtime.journal);
  return Option.match(headOption(map), {
    onNone: () => stm_core/* .retry */.L5,
    onSome: values => {
      const head = values[1][0];
      const tail = values[1].slice(1);
      tRef/* .unsafeSet */.lA(self.ref, tail.length > 0 ? SortedMap_set(map, head, tail) : SortedMap_remove(map, head), runtime.journal);
      return stm_core/* .succeed */.Py(head);
    }
  });
});
/** @internal */
const takeAll = self => tRef/* .modify */.JP(self.ref, map => {
  const builder = [];
  for (const entry of map) {
    for (const value of entry[1]) {
      builder.push(value);
    }
  }
  return [builder, SortedMap_empty(getOrder(map))];
});
/** @internal */
const takeOption = self => stm_core/* .effect */.QZ(journal => {
  const map = (0,Function.pipe)(self.ref, tRef/* .unsafeGet */.$v(journal));
  return Option.match(headOption(map), {
    onNone: () => Option.none(),
    onSome: ([key, value]) => {
      const tail = value.slice(1);
      tRef/* .unsafeSet */.lA(self.ref, tail.length > 0 ? SortedMap_set(map, key, tail) : SortedMap_remove(map, key), journal);
      return Option.some(value[0]);
    }
  });
});
/** @internal */
const takeUpTo = /*#__PURE__*/(0,Function.dual)(2, (self, n) => tRef/* .modify */.JP(self.ref, map => {
  const builder = [];
  const iterator = map[Symbol.iterator]();
  let updated = map;
  let index = 0;
  let next;
  while ((next = iterator.next()) && !next.done && index < n) {
    const [key, value] = next.value;
    const [left, right] = (0,Function.pipe)(value, esm_Array.splitAt(n - index));
    for (const value of left) {
      builder.push(value);
    }
    if (right.length > 0) {
      updated = SortedMap_set(updated, key, right);
    } else {
      updated = SortedMap_remove(updated, key);
    }
    index = index + left.length;
  }
  return [builder, updated];
}));
/** @internal */
const tPriorityQueue_toChunk = self => tRef/* .modify */.JP(self.ref, map => {
  const builder = [];
  for (const entry of map) {
    for (const value of entry[1]) {
      builder.push(value);
    }
  }
  return [Chunk.unsafeFromArray(builder), map];
});
/** @internal */
const tPriorityQueue_toArray = self => tRef/* .modify */.JP(self.ref, map => {
  const builder = [];
  for (const entry of map) {
    for (const value of entry[1]) {
      builder.push(value);
    }
  }
  return [builder, map];
});
//# sourceMappingURL=tPriorityQueue.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TPriorityQueue.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TPriorityQueue_TPriorityQueueTypeId = TPriorityQueueTypeId;
/**
 * Constructs a new empty `TPriorityQueue` with the specified `Order`.
 *
 * @since 2.0.0
 * @category constructors
 */
const TPriorityQueue_empty = tPriorityQueue_empty;
/**
 * Creates a new `TPriorityQueue` from an iterable collection of values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TPriorityQueue_fromIterable = tPriorityQueue_fromIterable;
/**
 * Checks whether the queue is empty.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_isEmpty = tPriorityQueue_isEmpty;
/**
 * Checks whether the queue is not empty.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_isNonEmpty = tPriorityQueue_isNonEmpty;
/**
 * Makes a new `TPriorityQueue` that is initialized with specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TPriorityQueue_make = tPriorityQueue_make;
/**
 * Offers the specified value to the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_offer = offer;
/**
 * Offers all of the elements in the specified collection to the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_offerAll = offerAll;
/**
 * Peeks at the first value in the queue without removing it, retrying until a
 * value is in the queue.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_peek = peek;
/**
 * Peeks at the first value in the queue without removing it, returning `None`
 * if there is not a value in the queue.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_peekOption = peekOption;
/**
 * Removes all elements from the queue matching the specified predicate.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_removeIf = tPriorityQueue_removeIf;
/**
 * Retains only elements from the queue matching the specified predicate.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_retainIf = tPriorityQueue_retainIf;
/**
 * Returns the size of the queue.
 *
 * @since 2.0.0
 * @category getters
 */
const TPriorityQueue_size = tPriorityQueue_size;
/**
 * Takes a value from the queue, retrying until a value is in the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_take = tPriorityQueue_take;
/**
 * Takes all values from the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_takeAll = takeAll;
/**
 * Takes a value from the queue, returning `None` if there is not a value in
 * the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_takeOption = takeOption;
/**
 * Takes up to the specified maximum number of elements from the queue.
 *
 * @since 2.0.0
 * @category mutations
 */
const TPriorityQueue_takeUpTo = takeUpTo;
/**
 * Collects all values into a `Chunk`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TPriorityQueue_toChunk = tPriorityQueue_toChunk;
/**
 * Collects all values into an array.
 *
 * @since 2.0.0
 * @category destructors
 */
const TPriorityQueue_toArray = tPriorityQueue_toArray;
//# sourceMappingURL=TPriorityQueue.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TPubSub.js + 1 modules
var TPubSub = __webpack_require__(81877);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TQueue.js
var TQueue = __webpack_require__(61480);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Utils.js
var Utils = __webpack_require__(41222);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tRandom.js








const TRandomSymbolKey = "effect/TRandom";
/** @internal */
const TRandomTypeId = /*#__PURE__*/Symbol.for(TRandomSymbolKey);
const randomInteger = state => {
  const prng = new Utils.PCGRandom();
  prng.setState(state);
  return [prng.integer(0), prng.getState()];
};
const randomIntegerBetween = (low, high) => {
  return state => {
    const prng = new Utils.PCGRandom();
    prng.setState(state);
    return [prng.integer(high - low) + low, prng.getState()];
  };
};
const randomNumber = state => {
  const prng = new Utils.PCGRandom();
  prng.setState(state);
  return [prng.number(), prng.getState()];
};
const withState = (state, f) => {
  return (0,Function.pipe)(state, tRef/* .modify */.JP(f));
};
const shuffleWith = (iterable, nextIntBounded) => {
  const swap = (buffer, index1, index2) => (0,Function.pipe)(buffer, tArray_get(index1), stm_core/* .flatMap */.qI(tmp => (0,Function.pipe)(buffer, updateSTM(index1, () => (0,Function.pipe)(buffer, tArray_get(index2))), stm_core/* .zipRight */.aN((0,Function.pipe)(buffer, tArray_update(index2, () => tmp))))));
  return (0,Function.pipe)(tArray_fromIterable(iterable), stm_core/* .flatMap */.qI(buffer => {
    const array = [];
    for (let i = array.length; i >= 2; i = i - 1) {
      array.push(i);
    }
    return (0,Function.pipe)(array, stm/* .forEach */.jJ(n => (0,Function.pipe)(nextIntBounded(n), stm_core/* .flatMap */.qI(k => swap(buffer, n - 1, k))), {
      discard: true
    }), stm_core/* .zipRight */.aN(toArray(buffer)));
  }));
};
/** @internal */
const Tag = /*#__PURE__*/Context.GenericTag("effect/TRandom");
class TRandomImpl {
  state;
  [TRandomTypeId] = TRandomTypeId;
  constructor(state) {
    this.state = state;
    this.next = withState(this.state, randomNumber);
    this.nextBoolean = stm_core/* .flatMap */.qI(this.next, n => stm_core/* .succeed */.Py(n > 0.5));
    this.nextInt = withState(this.state, randomInteger);
  }
  next;
  nextBoolean;
  nextInt;
  nextRange(min, max) {
    return stm_core/* .flatMap */.qI(this.next, n => stm_core/* .succeed */.Py((max - min) * n + min));
  }
  nextIntBetween(low, high) {
    return withState(this.state, randomIntegerBetween(low, high));
  }
  shuffle(elements) {
    return shuffleWith(elements, n => this.nextIntBetween(0, n));
  }
}
/** @internal */
const tRandom_live = /*#__PURE__*/Layer.effect(Tag, /*#__PURE__*/(0,Function.pipe)(/*#__PURE__*/tRef/* .make */.L8(/*#__PURE__*/new Utils.PCGRandom(Math.random() * 4294967296 >>> 0).getState()), /*#__PURE__*/stm_core/* .map */.Tj(seed => new TRandomImpl(seed)), stm_core/* .commit */.cd));
/** @internal */
const tRandom_next = /*#__PURE__*/stm_core/* .flatMap */.qI(Tag, random => random.next);
/** @internal */
const nextBoolean = /*#__PURE__*/stm_core/* .flatMap */.qI(Tag, random => random.nextBoolean);
/** @internal */
const nextInt = /*#__PURE__*/stm_core/* .flatMap */.qI(Tag, random => random.nextInt);
/** @internal */
const nextIntBetween = (low, high) => stm_core/* .flatMap */.qI(Tag, random => random.nextIntBetween(low, high));
/** @internal */
const nextRange = (min, max) => stm_core/* .flatMap */.qI(Tag, random => random.nextRange(min, max));
/** @internal */
const shuffle = elements => stm_core/* .flatMap */.qI(Tag, random => random.shuffle(elements));
//# sourceMappingURL=tRandom.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TRandom.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TRandom_TRandomTypeId = TRandomTypeId;
/**
 * The service tag used to access `TRandom` in the environment of an effect.
 *
 * @since 2.0.0
 * @category context
 */
const TRandom_Tag = Tag;
/**
 * The "live" `TRandom` service wrapped into a `Layer`.
 *
 * @since 2.0.0
 * @category context
 */
const TRandom_live = tRandom_live;
/**
 * Returns the next number from the pseudo-random number generator.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_next = tRandom_next;
/**
 * Returns the next boolean value from the pseudo-random number generator.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_nextBoolean = nextBoolean;
/**
 * Returns the next integer from the pseudo-random number generator.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_nextInt = nextInt;
/**
 * Returns the next integer in the specified range from the pseudo-random number
 * generator.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_nextIntBetween = nextIntBetween;
/**
 * Returns the next number in the specified range from the pseudo-random number
 * generator.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_nextRange = nextRange;
/**
 * Uses the pseudo-random number generator to shuffle the specified iterable.
 *
 * @since 2.0.0
 * @category random
 */
const TRandom_shuffle = shuffle;
//# sourceMappingURL=TRandom.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tReentrantLock.js








const TReentrantLockSymbolKey = "effect/TReentrantLock";
/** @internal */
const TReentrantLockTypeId = /*#__PURE__*/Symbol.for(TReentrantLockSymbolKey);
const WriteLockTypeId = /*#__PURE__*/Symbol.for("effect/TReentrantLock/WriteLock");
const ReadLockTypeId = /*#__PURE__*/Symbol.for("effect/TReentrantLock/ReadLock");
class TReentranLockImpl {
  state;
  [TReentrantLockTypeId] = TReentrantLockTypeId;
  constructor(state) {
    this.state = state;
  }
}
/**
 * This data structure describes the state of the lock when multiple fibers
 * have acquired read locks. The state is tracked as a map from fiber identity
 * to number of read locks acquired by the fiber. This level of detail permits
 * upgrading a read lock to a write lock.
 *
 * @internal
 */
class ReadLock {
  readers;
  [ReadLockTypeId] = ReadLockTypeId;
  constructor(readers) {
    this.readers = readers;
  }
  get readLocks() {
    return Array.from(this.readers).reduce((acc, curr) => acc + curr[1], 0);
  }
  get writeLocks() {
    return 0;
  }
  readLocksHeld(fiberId) {
    return Option.getOrElse(HashMap.get(this.readers, fiberId), () => 0);
  }
  writeLocksHeld(_fiberId) {
    return 0;
  }
}
/**
 * This data structure describes the state of the lock when a single fiber has
 * a write lock. The fiber has an identity, and may also have acquired a
 * certain number of read locks.
 *
 * @internal
 */
class WriteLock {
  readLocks;
  writeLocks;
  fiberId;
  [WriteLockTypeId] = WriteLockTypeId;
  constructor(readLocks, writeLocks, fiberId) {
    this.readLocks = readLocks;
    this.writeLocks = writeLocks;
    this.fiberId = fiberId;
  }
  readLocksHeld(fiberId) {
    return Equal.equals(fiberId)(this.fiberId) ? this.readLocks : 0;
  }
  writeLocksHeld(fiberId) {
    return Equal.equals(fiberId)(this.fiberId) ? this.writeLocks : 0;
  }
}
const isReadLock = lock => {
  return ReadLockTypeId in lock;
};
const isWriteLock = lock => {
  return WriteLockTypeId in lock;
};
/**
 * An empty read lock state, in which no fiber holds any read locks.
 */
const emptyReadLock = /*#__PURE__*/new ReadLock(/*#__PURE__*/HashMap.empty());
/**
 * Creates a new read lock where the specified fiber holds the specified
 * number of read locks.
 */
const makeReadLock = (fiberId, count) => {
  if (count <= 0) {
    return emptyReadLock;
  }
  return new ReadLock(HashMap.make([fiberId, count]));
};
/**
 * Determines if there is no other holder of read locks aside from the
 * specified fiber id. If there are no other holders of read locks aside
 * from the specified fiber id, then it is safe to upgrade the read lock
 * into a write lock.
 */
const noOtherHolder = (readLock, fiberId) => {
  return HashMap.isEmpty(readLock.readers) || HashMap.size(readLock.readers) === 1 && HashMap.has(readLock.readers, fiberId);
};
/**
 * Adjusts the number of read locks held by the specified fiber id.
 */
const adjustReadLock = (readLock, fiberId, adjustment) => {
  const total = readLock.readLocksHeld(fiberId);
  const newTotal = total + adjustment;
  if (newTotal < 0) {
    throw new Error("BUG - TReentrantLock.ReadLock.adjust - please report an issue at https://github.com/Effect-TS/effect/issues");
  }
  if (newTotal === 0) {
    return new ReadLock(HashMap.remove(readLock.readers, fiberId));
  }
  return new ReadLock(HashMap.set(readLock.readers, fiberId, newTotal));
};
const adjustRead = (self, delta) => stm_core/* .withSTMRuntime */.DG(runtime => {
  const lock = tRef/* .unsafeGet */.$v(self.state, runtime.journal);
  if (isReadLock(lock)) {
    const result = adjustReadLock(lock, runtime.fiberId, delta);
    tRef/* .unsafeSet */.lA(self.state, result, runtime.journal);
    return stm_core/* .succeed */.Py(result.readLocksHeld(runtime.fiberId));
  }
  if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
    const newTotal = lock.readLocks + delta;
    if (newTotal < 0) {
      throw new Error(`Defect: Fiber ${FiberId.threadName(runtime.fiberId)} releasing read locks it does not hold, newTotal: ${newTotal}`);
    }
    tRef/* .unsafeSet */.lA(self.state, new WriteLock(newTotal, lock.writeLocks, runtime.fiberId), runtime.journal);
    return stm_core/* .succeed */.Py(newTotal);
  }
  return stm_core/* .retry */.L5;
});
/** @internal */
const acquireRead = self => adjustRead(self, 1);
/** @internal */
const acquireWrite = self => stm_core/* .withSTMRuntime */.DG(runtime => {
  const lock = tRef/* .unsafeGet */.$v(self.state, runtime.journal);
  if (isReadLock(lock) && noOtherHolder(lock, runtime.fiberId)) {
    tRef/* .unsafeSet */.lA(self.state, new WriteLock(lock.readLocksHeld(runtime.fiberId), 1, runtime.fiberId), runtime.journal);
    return stm_core/* .succeed */.Py(1);
  }
  if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
    tRef/* .unsafeSet */.lA(self.state, new WriteLock(lock.readLocks, lock.writeLocks + 1, runtime.fiberId), runtime.journal);
    return stm_core/* .succeed */.Py(lock.writeLocks + 1);
  }
  return stm_core/* .retry */.L5;
});
/** @internal */
const fiberReadLocks = self => stm_core/* .effect */.QZ((journal, fiberId) => tRef/* .unsafeGet */.$v(self.state, journal).readLocksHeld(fiberId));
/** @internal */
const fiberWriteLocks = self => stm_core/* .effect */.QZ((journal, fiberId) => tRef/* .unsafeGet */.$v(self.state, journal).writeLocksHeld(fiberId));
/** @internal */
const tReentrantLock_lock = self => writeLock(self);
/** @internal */
const locked = self => stm_core/* .zipWith */.OY(readLocked(self), writeLocked(self), (x, y) => x || y);
/** @internal */
const tReentrantLock_make = /*#__PURE__*/stm_core/* .map */.Tj(/*#__PURE__*/tRef/* .make */.L8(emptyReadLock), readLock => new TReentranLockImpl(readLock));
/** @internal */
const tReentrantLock_readLock = self => Effect.acquireRelease(stm_core/* .commit */.cd(acquireRead(self)), () => stm_core/* .commit */.cd(releaseRead(self)));
/** @internal */
const tReentrantLock_readLocks = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.state), state => state.readLocks);
/** @internal */
const readLocked = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.state), state => state.readLocks > 0);
/** @internal */
const releaseRead = self => adjustRead(self, -1);
/** @internal */
const releaseWrite = self => stm_core/* .withSTMRuntime */.DG(runtime => {
  const lock = tRef/* .unsafeGet */.$v(self.state, runtime.journal);
  if (isWriteLock(lock) && lock.writeLocks === 1 && Equal.equals(runtime.fiberId)(lock.fiberId)) {
    const result = makeReadLock(lock.fiberId, lock.readLocks);
    tRef/* .unsafeSet */.lA(self.state, result, runtime.journal);
    return stm_core/* .succeed */.Py(result.writeLocksHeld(runtime.fiberId));
  }
  if (isWriteLock(lock) && Equal.equals(runtime.fiberId)(lock.fiberId)) {
    const result = new WriteLock(lock.readLocks, lock.writeLocks - 1, runtime.fiberId);
    tRef/* .unsafeSet */.lA(self.state, result, runtime.journal);
    return stm_core/* .succeed */.Py(result.writeLocksHeld(runtime.fiberId));
  }
  throw new Error(`Defect: Fiber ${FiberId.threadName(runtime.fiberId)} releasing write lock it does not hold`);
});
/** @internal */
const withLock = /*#__PURE__*/(0,Function.dual)(2, (effect, self) => withWriteLock(effect, self));
/** @internal */
const withReadLock = /*#__PURE__*/(0,Function.dual)(2, (effect, self) => Effect.uninterruptibleMask(restore => Effect.zipRight(restore(stm_core/* .commit */.cd(acquireRead(self))), Effect.ensuring(effect, stm_core/* .commit */.cd(releaseRead(self))))));
/** @internal */
const withWriteLock = /*#__PURE__*/(0,Function.dual)(2, (effect, self) => Effect.uninterruptibleMask(restore => Effect.zipRight(restore(stm_core/* .commit */.cd(acquireWrite(self))), Effect.ensuring(effect, stm_core/* .commit */.cd(releaseWrite(self))))));
/** @internal */
const writeLock = self => Effect.acquireRelease(stm_core/* .commit */.cd(acquireWrite(self)), () => stm_core/* .commit */.cd(releaseWrite(self)));
/** @internal */
const writeLocked = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.state), state => state.writeLocks > 0);
/** @internal */
const tReentrantLock_writeLocks = self => stm_core/* .map */.Tj(tRef/* .get */.Jt(self.state), state => state.writeLocks);
//# sourceMappingURL=tReentrantLock.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TReentrantLock.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TReentrantLock_TReentrantLockTypeId = TReentrantLockTypeId;
/**
 * Acquires a read lock. The transaction will suspend until no other fiber is
 * holding a write lock. Succeeds with the number of read locks held by this
 * fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_acquireRead = acquireRead;
/**
 * Acquires a write lock. The transaction will suspend until no other fibers
 * are holding read or write locks. Succeeds with the number of write locks
 * held by this fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_acquireWrite = acquireWrite;
/**
 * Retrieves the number of acquired read locks for this fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_fiberReadLocks = fiberReadLocks;
/**
 * Retrieves the number of acquired write locks for this fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_fiberWriteLocks = fiberWriteLocks;
/**
 * Just a convenience method for applications that only need reentrant locks,
 * without needing a distinction between readers / writers.
 *
 * See `TReentrantLock.writeLock`.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_lock = tReentrantLock_lock;
/**
 * Determines if any fiber has a read or write lock.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_locked = locked;
/**
 * Makes a new reentrant read/write lock.
 *
 * @since 2.0.0
 * @category constructors
 */
const TReentrantLock_make = tReentrantLock_make;
/**
 * Obtains a read lock in a scoped context.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_readLock = tReentrantLock_readLock;
/**
 * Retrieves the total number of acquired read locks.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_readLocks = tReentrantLock_readLocks;
/**
 * Determines if any fiber has a read lock.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_readLocked = readLocked;
/**
 * Releases a read lock held by this fiber. Succeeds with the outstanding
 * number of read locks held by this fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_releaseRead = releaseRead;
/**
 * Releases a write lock held by this fiber. Succeeds with the outstanding
 * number of write locks held by this fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_releaseWrite = releaseWrite;
/**
 * Runs the specified workflow with a lock.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_withLock = withLock;
/**
 * Runs the specified workflow with a read lock.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_withReadLock = withReadLock;
/**
 * Runs the specified workflow with a write lock.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_withWriteLock = withWriteLock;
/**
 * Obtains a write lock in a scoped context.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_writeLock = writeLock;
/**
 * Determines if a write lock is held by some fiber.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_writeLocked = writeLocked;
/**
 * Computes the number of write locks held by fibers.
 *
 * @since 2.0.0
 * @category mutations
 */
const TReentrantLock_writeLocks = tReentrantLock_writeLocks;
//# sourceMappingURL=TReentrantLock.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TRef.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const TRefTypeId = tRef/* .TRefTypeId */.x_;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_get = tRef/* .get */.Jt;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_getAndSet = tRef/* .getAndSet */.C2;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_getAndUpdate = tRef/* .getAndUpdate */.Ru;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_getAndUpdateSome = tRef/* .getAndUpdateSome */.$N;
/**
 * @since 2.0.0
 * @category constructors
 */
const TRef_make = tRef/* .make */.L8;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_modify = tRef/* .modify */.JP;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_modifySome = tRef/* .modifySome */.ni;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_set = tRef/* .set */.hZ;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_setAndGet = tRef/* .setAndGet */._c;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_update = tRef/* .update */.yo;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_updateAndGet = tRef/* .updateAndGet */.lF;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_updateSome = tRef/* .updateSome */.gH;
/**
 * @since 2.0.0
 * @category mutations
 */
const TRef_updateSomeAndGet = tRef/* .updateSomeAndGet */.VH;
//# sourceMappingURL=TRef.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tSemaphore.js






/** @internal */
const TSemaphoreSymbolKey = "effect/TSemaphore";
/** @internal */
const TSemaphoreTypeId = /*#__PURE__*/Symbol.for(TSemaphoreSymbolKey);
/** @internal */
class TSemaphoreImpl {
  permits;
  [TSemaphoreTypeId] = TSemaphoreTypeId;
  constructor(permits) {
    this.permits = permits;
  }
}
/** @internal */
const tSemaphore_make = permits => STM_map(tRef/* .make */.L8(permits), permits => new TSemaphoreImpl(permits));
/** @internal */
const tSemaphore_acquire = self => acquireN(self, 1);
/** @internal */
const acquireN = /*#__PURE__*/(0,Function.dual)(2, (self, n) => stm_core/* .withSTMRuntime */.DG(driver => {
  if (n < 0) {
    throw new Cause.IllegalArgumentException(`Unexpected negative value ${n} passed to Semaphore.acquireN`);
  }
  const value = tRef/* .unsafeGet */.$v(self.permits, driver.journal);
  if (value < n) {
    return STM_retry;
  } else {
    return STM_succeed(tRef/* .unsafeSet */.lA(self.permits, value - n, driver.journal));
  }
}));
/** @internal */
const available = self => tRef/* .get */.Jt(self.permits);
/** @internal */
const tSemaphore_release = self => releaseN(self, 1);
/** @internal */
const releaseN = /*#__PURE__*/(0,Function.dual)(2, (self, n) => stm_core/* .withSTMRuntime */.DG(driver => {
  if (n < 0) {
    throw new Cause.IllegalArgumentException(`Unexpected negative value ${n} passed to Semaphore.releaseN`);
  }
  const current = tRef/* .unsafeGet */.$v(self.permits, driver.journal);
  return STM_succeed(tRef/* .unsafeSet */.lA(self.permits, current + n, driver.journal));
}));
/** @internal */
const withPermit = /*#__PURE__*/(0,Function.dual)(2, (self, semaphore) => withPermits(self, semaphore, 1));
/** @internal */
const withPermits = /*#__PURE__*/(0,Function.dual)(3, (self, semaphore, permits) => Effect.uninterruptibleMask(restore => Effect.zipRight(restore(stm_core/* .commit */.cd(acquireN(permits)(semaphore))), Effect.ensuring(self, stm_core/* .commit */.cd(releaseN(permits)(semaphore))))));
/** @internal */
const withPermitScoped = self => withPermitsScoped(self, 1);
/** @internal */
const withPermitsScoped = /*#__PURE__*/(0,Function.dual)(2, (self, permits) => Effect.acquireReleaseInterruptible(stm_core/* .commit */.cd(acquireN(self, permits)), () => stm_core/* .commit */.cd(releaseN(self, permits))));
/** @internal */
const unsafeMakeSemaphore = permits => {
  return new TSemaphoreImpl(new tRef/* .TRefImpl */.Cl(permits));
};
//# sourceMappingURL=tSemaphore.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSemaphore.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const TSemaphore_TSemaphoreTypeId = TSemaphoreTypeId;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_acquire = tSemaphore_acquire;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_acquireN = acquireN;
/**
 * @since 2.0.0
 * @category getters
 */
const TSemaphore_available = available;
/**
 * @since 2.0.0
 * @category constructors
 */
const TSemaphore_make = tSemaphore_make;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_release = tSemaphore_release;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_releaseN = releaseN;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_withPermit = withPermit;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_withPermits = withPermits;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_withPermitScoped = withPermitScoped;
/**
 * @since 2.0.0
 * @category mutations
 */
const TSemaphore_withPermitsScoped = withPermitsScoped;
/**
 * @since 2.0.0
 * @category unsafe
 */
const TSemaphore_unsafeMake = unsafeMakeSemaphore;
//# sourceMappingURL=TSemaphore.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tSet.js








/** @internal */
const TSetSymbolKey = "effect/TSet";
/** @internal */
const TSetTypeId = /*#__PURE__*/Symbol.for(TSetSymbolKey);
const tSetVariance = {
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
class TSetImpl {
  tMap;
  [TSetTypeId] = tSetVariance;
  constructor(tMap) {
    this.tMap = tMap;
  }
}
const isTSet = u => (0,Predicate.hasProperty)(u, TSetTypeId);
/** @internal */
const tSet_add = /*#__PURE__*/(0,Function.dual)(2, (self, value) => tMap_set(self.tMap, value, void 0));
/** @internal */
const difference = /*#__PURE__*/(0,Function.dual)(2, (self, other) => stm_core/* .flatMap */.qI(toHashSet(other), values => tSet_removeIf(self, value => HashSet.has(values, value), {
  discard: true
})));
/** @internal */
const tSet_empty = () => tSet_fromIterable([]);
/** @internal */
const tSet_forEach = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tSet_reduceSTM(self, void 0, (_, value) => f(value)));
/** @internal */
const tSet_fromIterable = iterable => stm_core/* .map */.Tj(tMap_fromIterable(Array.from(iterable).map(a => [a, void 0])), tMap => new TSetImpl(tMap));
/** @internal */
const tSet_has = /*#__PURE__*/(0,Function.dual)(2, (self, value) => tMap_has(self.tMap, value));
/** @internal */
const intersection = /*#__PURE__*/(0,Function.dual)(2, (self, other) => stm_core/* .flatMap */.qI(toHashSet(other), values => (0,Function.pipe)(self, tSet_retainIf(value => (0,Function.pipe)(values, HashSet.has(value)), {
  discard: true
}))));
/** @internal */
const tSet_isEmpty = self => tMap_isEmpty(self.tMap);
/** @internal */
const tSet_make = (...elements) => tSet_fromIterable(elements);
/** @internal */
const tSet_reduce = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => tMap_reduce(self.tMap, zero, (acc, _, key) => f(acc, key)));
/** @internal */
const tSet_reduceSTM = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => tMap_reduceSTM(self.tMap, zero, (acc, _, key) => f(acc, key)));
/** @internal */
const tSet_remove = /*#__PURE__*/(0,Function.dual)(2, (self, value) => tMap_remove(self.tMap, value));
/** @internal */
const tSet_removeAll = /*#__PURE__*/(0,Function.dual)(2, (self, iterable) => removeAll(self.tMap, iterable));
/** @internal */
const tSet_removeIf = /*#__PURE__*/(0,Function.dual)(args => isTSet(args[0]), (self, predicate, options) => options?.discard === true ? removeIf(self.tMap, key => predicate(key), {
  discard: true
}) : (0,Function.pipe)(removeIf(self.tMap, key => predicate(key)), stm_core/* .map */.Tj(esm_Array.map(entry => entry[0]))));
/** @internal */
const tSet_retainIf = /*#__PURE__*/(0,Function.dual)(args => isTSet(args[0]), (self, predicate, options) => options?.discard === true ? retainIf(self.tMap, key => predicate(key), {
  discard: true
}) : (0,Function.pipe)(retainIf(self.tMap, key => predicate(key)), stm_core/* .map */.Tj(esm_Array.map(entry => entry[0]))));
/** @internal */
const tSet_size = self => stm_core/* .map */.Tj(tSet_toChunk(self), chunk => chunk.length);
/** @internal */
const tSet_takeFirst = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => takeFirst(self.tMap, key => pf(key)));
/** @internal */
const tSet_takeFirstSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => takeFirstSTM(self.tMap, key => pf(key)));
/** @internal */
const tSet_takeSome = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => takeSome(self.tMap, key => pf(key)));
/** @internal */
const tSet_takeSomeSTM = /*#__PURE__*/(0,Function.dual)(2, (self, pf) => takeSomeSTM(self.tMap, key => pf(key)));
/** @internal */
const tSet_toChunk = self => tMap_keys(self.tMap).pipe(STM_map(Chunk.unsafeFromArray));
/** @internal */
const toHashSet = self => tSet_reduce(self, HashSet.empty(), (acc, value) => (0,Function.pipe)(acc, HashSet.add(value)));
/** @internal */
const tSet_toArray = self => tSet_reduce(self, [], (acc, value) => [...acc, value]);
/** @internal */
const toReadonlySet = self => stm_core/* .map */.Tj(tSet_toArray(self), values => new Set(values));
/** @internal */
const tSet_transform = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_transform(self.tMap, (key, value) => [f(key), value]));
/** @internal */
const tSet_transformSTM = /*#__PURE__*/(0,Function.dual)(2, (self, f) => tMap_transformSTM(self.tMap, (key, value) => stm_core/* .map */.Tj(f(key), a => [a, value])));
/** @internal */
const union = /*#__PURE__*/(0,Function.dual)(2, (self, other) => tSet_forEach(other, value => tSet_add(self, value)));
//# sourceMappingURL=tSet.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSet.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TSet_TSetTypeId = TSetTypeId;
/**
 * Stores new element in the set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_add = tSet_add;
/**
 * Atomically transforms the set into the difference of itself and the
 * provided set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_difference = difference;
/**
 * Makes an empty `TSet`.
 *
 * @since 2.0.0
 * @category constructors
 */
const TSet_empty = tSet_empty;
/**
 * Atomically performs transactional-effect for each element in set.
 *
 * @since 2.0.0
 * @category elements
 */
const TSet_forEach = tSet_forEach;
/**
 * Creates a new `TSet` from an iterable collection of values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TSet_fromIterable = tSet_fromIterable;
/**
 * Tests whether or not set contains an element.
 *
 * @since 2.0.0
 * @category elements
 */
const TSet_has = tSet_has;
/**
 * Atomically transforms the set into the intersection of itself and the
 * provided set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_intersection = intersection;
/**
 * Tests if the set is empty or not
 *
 * @since 2.0.0
 * @category getters
 */
const TSet_isEmpty = tSet_isEmpty;
/**
 * Makes a new `TSet` that is initialized with specified values.
 *
 * @since 2.0.0
 * @category constructors
 */
const TSet_make = tSet_make;
/**
 * Atomically folds using a pure function.
 *
 * @since 2.0.0
 * @category folding
 */
const TSet_reduce = tSet_reduce;
/**
 * Atomically folds using a transactional function.
 *
 * @since 2.0.0
 * @category folding
 */
const TSet_reduceSTM = tSet_reduceSTM;
/**
 * Removes a single element from the set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_remove = tSet_remove;
/**
 * Removes elements from the set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_removeAll = tSet_removeAll;
/**
 * Removes entries from a `TSet` that satisfy the specified predicate and returns the removed entries
 * (or `void` if `discard = true`).
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_removeIf = tSet_removeIf;
/**
 * Retains entries in a `TSet` that satisfy the specified predicate and returns the removed entries
 * (or `void` if `discard = true`).
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_retainIf = tSet_retainIf;
/**
 * Returns the set's cardinality.
 *
 * @since 2.0.0
 * @category getters
 */
const TSet_size = tSet_size;
/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_takeFirst = tSet_takeFirst;
/**
 * Takes the first matching value, or retries until there is one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_takeFirstSTM = tSet_takeFirstSTM;
/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_takeSome = tSet_takeSome;
/**
 * Takes all matching values, or retries until there is at least one.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_takeSomeSTM = tSet_takeSomeSTM;
/**
 * Collects all elements into a `Chunk`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TSet_toChunk = tSet_toChunk;
/**
 * Collects all elements into a `HashSet`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TSet_toHashSet = toHashSet;
/**
 * Collects all elements into a `Array`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TSet_toArray = tSet_toArray;
/**
 * Collects all elements into a `ReadonlySet`.
 *
 * @since 2.0.0
 * @category destructors
 */
const TSet_toReadonlySet = toReadonlySet;
/**
 * Atomically updates all elements using a pure function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_transform = tSet_transform;
/**
 * Atomically updates all elements using a transactional function.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_transformSTM = tSet_transformSTM;
/**
 * Atomically transforms the set into the union of itself and the provided
 * set.
 *
 * @since 2.0.0
 * @category mutations
 */
const TSet_union = union;
//# sourceMappingURL=TSet.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tQueue.js
var tQueue = __webpack_require__(58541);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/stm/tSubscriptionRef.js











/** @internal */
const TSubscriptionRefSymbolKey = "effect/TSubscriptionRef";
/** @internal */
const TSubscriptionRefTypeId = /*#__PURE__*/Symbol.for(TSubscriptionRefSymbolKey);
const TSubscriptionRefVariance = {
  /* c8 ignore next */
  _A: _ => _
};
class TDequeueMerge {
  first;
  second;
  [TQueue.TDequeueTypeId] = tQueue/* .tDequeueVariance */.Mx;
  constructor(first, second) {
    this.first = first;
    this.second = second;
  }
  peek = /*#__PURE__*/gen(this, function* () {
    const first = yield* this.peekOption;
    if (first._tag === "Some") {
      return first.value;
    }
    return yield* STM_retry;
  });
  peekOption = /*#__PURE__*/gen(this, function* () {
    const first = yield* this.first.peekOption;
    if (first._tag === "Some") {
      return first;
    }
    const second = yield* this.second.peekOption;
    if (second._tag === "Some") {
      return second;
    }
    return Option.none();
  });
  take = /*#__PURE__*/gen(this, function* () {
    if (!(yield* this.first.isEmpty)) {
      return yield* this.first.take;
    }
    if (!(yield* this.second.isEmpty)) {
      return yield* this.second.take;
    }
    return yield* STM_retry;
  });
  takeAll = /*#__PURE__*/gen(this, function* () {
    return [...(yield* this.first.takeAll), ...(yield* this.second.takeAll)];
  });
  takeUpTo(max) {
    return gen(this, function* () {
      const first = yield* this.first.takeUpTo(max);
      if (first.length >= max) {
        return first;
      }
      return [...first, ...(yield* this.second.takeUpTo(max - first.length))];
    });
  }
  capacity() {
    return this.first.capacity() + this.second.capacity();
  }
  size = /*#__PURE__*/gen(this, function* () {
    return (yield* this.first.size) + (yield* this.second.size);
  });
  isFull = /*#__PURE__*/gen(this, function* () {
    return (yield* this.first.isFull) && (yield* this.second.isFull);
  });
  isEmpty = /*#__PURE__*/gen(this, function* () {
    return (yield* this.first.isEmpty) && (yield* this.second.isEmpty);
  });
  shutdown = /*#__PURE__*/gen(this, function* () {
    yield* this.first.shutdown;
    yield* this.second.shutdown;
  });
  isShutdown = /*#__PURE__*/gen(this, function* () {
    return (yield* this.first.isShutdown) && (yield* this.second.isShutdown);
  });
  awaitShutdown = /*#__PURE__*/gen(this, function* () {
    yield* this.first.awaitShutdown;
    yield* this.second.awaitShutdown;
  });
}
/** @internal */
class TSubscriptionRefImpl {
  ref;
  pubsub;
  [TSubscriptionRefTypeId] = TSubscriptionRefVariance;
  [TRefTypeId] = tRef/* .tRefVariance */.tB;
  constructor(ref, pubsub) {
    this.ref = ref;
    this.pubsub = pubsub;
  }
  get todos() {
    return this.ref.todos;
  }
  get versioned() {
    return this.ref.versioned;
  }
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
  get changes() {
    return gen(this, function* () {
      const first = yield* TQueue.unbounded();
      yield* TQueue.offer(first, yield* TRef_get(this.ref));
      return new TDequeueMerge(first, yield* TPubSub.subscribe(this.pubsub));
    });
  }
  modify(f) {
    return (0,Function.pipe)(TRef_get(this.ref), STM_map(f), flatMap(([b, a]) => (0,Function.pipe)(TRef_set(this.ref, a), STM_as(b), zipLeft(TPubSub.publish(this.pubsub, a)))));
  }
}
/** @internal */
const tSubscriptionRef_make = value => (0,Function.pipe)(STM_all([TPubSub.unbounded(), TRef_make(value)]), STM_map(([pubsub, ref]) => new TSubscriptionRefImpl(ref, pubsub)));
/** @internal */
const tSubscriptionRef_get = self => TRef_get(self.ref);
/** @internal */
const tSubscriptionRef_set = /*#__PURE__*/(0,Function.dual)(2, (self, value) => self.modify(() => [void 0, value]));
/** @internal */
const tSubscriptionRef_getAndSet = /*#__PURE__*/(0,Function.dual)(2, (self, value) => self.modify(a => [a, value]));
/** @internal */
const tSubscriptionRef_getAndUpdate = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => [a, f(a)]));
/** @internal */
const tSubscriptionRef_getAndUpdateSome = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => Option.match(f(a), {
  onNone: () => [a, a],
  onSome: b => [a, b]
})));
/** @internal */
const tSubscriptionRef_setAndGet = /*#__PURE__*/(0,Function.dual)(2, (self, value) => self.modify(() => [value, value]));
/** @internal */
const tSubscriptionRef_modify = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(f));
/** @internal */
const tSubscriptionRef_modifySome = /*#__PURE__*/(0,Function.dual)(3, (self, fallback, f) => self.modify(a => Option.match(f(a), {
  onNone: () => [fallback, a],
  onSome: b => b
})));
/** @internal */
const tSubscriptionRef_update = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => [void 0, f(a)]));
/** @internal */
const tSubscriptionRef_updateAndGet = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => {
  const b = f(a);
  return [b, b];
}));
/** @internal */
const tSubscriptionRef_updateSome = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => [void 0, Option.match(f(a), {
  onNone: () => a,
  onSome: b => b
})]));
/** @internal */
const tSubscriptionRef_updateSomeAndGet = /*#__PURE__*/(0,Function.dual)(2, (self, f) => self.modify(a => Option.match(f(a), {
  onNone: () => [a, a],
  onSome: b => [b, b]
})));
/** @internal */
const changesScoped = self => Effect.acquireRelease(self.changes, TQueue.shutdown);
/** @internal */
const changesStream = self => stream/* .unwrap */.oAg(Effect.map(self.changes, stream/* .fromTQueue */.c2));
//# sourceMappingURL=tSubscriptionRef.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TSubscriptionRef.js

/**
 * @since 3.10.0
 * @category symbols
 */
const TSubscriptionRef_TSubscriptionRefTypeId = TSubscriptionRefTypeId;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_get = tSubscriptionRef_get;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_getAndSet = tSubscriptionRef_getAndSet;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_getAndUpdate = tSubscriptionRef_getAndUpdate;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_getAndUpdateSome = tSubscriptionRef_getAndUpdateSome;
/**
 * @since 3.10.0
 * @category constructors
 */
const TSubscriptionRef_make = tSubscriptionRef_make;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_modify = tSubscriptionRef_modify;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_modifySome = tSubscriptionRef_modifySome;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_set = tSubscriptionRef_set;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_setAndGet = tSubscriptionRef_setAndGet;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_update = tSubscriptionRef_update;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_updateAndGet = tSubscriptionRef_updateAndGet;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_updateSome = tSubscriptionRef_updateSome;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_updateSomeAndGet = tSubscriptionRef_updateSomeAndGet;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_changesScoped = changesScoped;
/**
 * @since 3.10.0
 * @category mutations
 */
const TSubscriptionRef_changesStream = changesStream;
/**
 * @since 3.10.0
 * @category mutations
 */
const changes = self => self.changes;
//# sourceMappingURL=TSubscriptionRef.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/take.js
var internal_take = __webpack_require__(22138);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Take.js

/**
 * @since 2.0.0
 * @category symbols
 */
const TakeTypeId = internal_take/* .TakeTypeId */.Zn;
/**
 * Creates a `Take` with the specified chunk.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_chunk = internal_take/* .chunk */.iv;
/**
 * Creates a failing `Take` with the specified defect.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_die = internal_take/* .die */.F_;
/**
 * Creates a failing `Take` with the specified error message.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_dieMessage = internal_take/* .dieMessage */.GS;
/**
 * Transforms a `Take<A, E>` to an `Effect<A, E>`.
 *
 * @since 2.0.0
 * @category destructors
 */
const Take_done = internal_take/* .done */.Vw;
/**
 * Represents the end-of-stream marker.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_end = internal_take/* .end */._N;
/**
 * Creates a failing `Take` with the specified error.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_fail = internal_take/* .fail */.fJ;
/**
 * Creates a failing `Take` with the specified cause.
 *
 * @since 2.0.0
 * @category constructors
 */
const failCause = internal_take/* .failCause */.AT;
/**
 * Creates an effect from `Effect<A, E, R>` that does not fail, but succeeds with
 * the `Take<A, E>`. Error from stream when pulling is converted to
 * `Take.failCause`. Creates a single value chunk.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_fromEffect = internal_take/* .fromEffect */.uS;
/**
 * Creates a `Take` from an `Exit`.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromExit = internal_take/* .fromExit */.XL;
/**
 * Creates effect from `Effect<Chunk<A>, Option<E>, R>` that does not fail, but
 * succeeds with the `Take<A, E>`. Errors from stream when pulling are converted
 * to `Take.failCause`, and the end-of-stream is converted to `Take.end`.
 *
 * @since 2.0.0
 * @category constructors
 */
const fromPull = internal_take/* .fromPull */.OB;
/**
 * Checks if this `take` is done (`Take.end`).
 *
 * @since 2.0.0
 * @category getters
 */
const isDone = internal_take/* .isDone */.$L;
/**
 * Checks if this `take` is a failure.
 *
 * @since 2.0.0
 * @category getters
 */
const Take_isFailure = internal_take/* .isFailure */.N6;
/**
 * Checks if this `take` is a success.
 *
 * @since 2.0.0
 * @category getters
 */
const Take_isSuccess = internal_take/* .isSuccess */.oJ;
/**
 * Constructs a `Take`.
 *
 * @since 2.0.0
 * @category constructors
 */
const Take_make = internal_take/* .make */.L8;
/**
 * Transforms `Take<A, E>` to `Take<B, A>` by applying function `f`.
 *
 * @since 2.0.0
 * @category mapping
 */
const Take_map = internal_take/* .map */.Tj;
/**
 * Folds over the failure cause, success value and end-of-stream marker to
 * yield a value.
 *
 * @since 2.0.0
 * @category destructors
 */
const Take_match = internal_take/* .match */.YW;
/**
 * Effectful version of `Take.fold`.
 *
 * Folds over the failure cause, success value and end-of-stream marker to
 * yield an effect.
 *
 * @since 2.0.0
 * @category destructors
 */
const matchEffect = internal_take/* .matchEffect */.tv;
/**
 * Creates a `Take` with a single value chunk.
 *
 * @since 2.0.0
 * @category constructors
 */
const of = internal_take.of;
/**
 * Returns an effect that effectfully "peeks" at the success of this take.
 *
 * @since 2.0.0
 * @category sequencing
 */
const Take_tap = internal_take/* .tap */.Mi;
//# sourceMappingURL=Take.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/errors.js
var internal_errors = __webpack_require__(81662);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotation.js
/**
 * @since 2.0.0
 */








/** @internal */
const TestAnnotationSymbolKey = "effect/TestAnnotation";
/**
 * @since 2.0.0
 */
const TestAnnotationTypeId = /*#__PURE__*/Symbol.for(TestAnnotationSymbolKey);
/** @internal */
class TestAnnotationImpl {
  identifier;
  initial;
  combine;
  [TestAnnotationTypeId] = {
    _A: _ => _
  };
  constructor(identifier, initial, combine) {
    this.identifier = identifier;
    this.initial = initial;
    this.combine = combine;
  }
  [Hash.symbol]() {
    return (0,Function.pipe)(Hash.hash(TestAnnotationSymbolKey), Hash.combine(Hash.hash(this.identifier)), Hash.cached(this));
  }
  [Equal.symbol](that) {
    return isTestAnnotation(that) && this.identifier === that.identifier;
  }
}
/**
 * @since 2.0.0
 */
const isTestAnnotation = u => (0,Predicate.hasProperty)(u, TestAnnotationTypeId);
/**
 * @since 2.0.0
 */
const TestAnnotation_make = (identifier, initial, combine) => {
  return new TestAnnotationImpl(identifier, initial, combine);
};
/**
 * @since 2.0.0
 */
const compose = (left, right) => {
  if (Either.isLeft(left) && Either.isLeft(right)) {
    return Either.left(left.left + right.left);
  }
  if (Either.isRight(left) && Either.isRight(right)) {
    return Either.right((0,Function.pipe)(left.right, Chunk.appendAll(right.right)));
  }
  if (Either.isRight(left) && Either.isLeft(right)) {
    return right;
  }
  if (Either.isLeft(left) && Either.isRight(right)) {
    return right;
  }
  throw new Error((0,internal_errors/* .getBugErrorMessage */.k)("TestAnnotation.compose"));
};
/**
 * @since 2.0.0
 */
const TestAnnotation_fibers = /*#__PURE__*/TestAnnotation_make("fibers", /*#__PURE__*/Either.left(0), compose);
/**
 * An annotation which counts ignored tests.
 *
 * @since 2.0.0
 */
const ignored = /*#__PURE__*/TestAnnotation_make("ignored", 0, (a, b) => a + b);
/**
 * An annotation which counts repeated tests.
 *
 * @since 2.0.0
 */
const repeated = /*#__PURE__*/TestAnnotation_make("repeated", 0, (a, b) => a + b);
/**
 * An annotation which counts retried tests.
 *
 * @since 2.0.0
 */
const retried = /*#__PURE__*/TestAnnotation_make("retried", 0, (a, b) => a + b);
/**
 * An annotation which tags tests with strings.
 *
 * @since 2.0.0
 */
const TestAnnotation_tagged = /*#__PURE__*/TestAnnotation_make("tagged", /*#__PURE__*/HashSet.empty(), (a, b) => (0,Function.pipe)(a, HashSet.union(b)));
//# sourceMappingURL=TestAnnotation.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotationMap.js
/**
 * @since 2.0.0
 */



/**
 * @since 2.0.0
 */
const TestAnnotationMapTypeId = /*#__PURE__*/Symbol.for("effect/TestAnnotationMap");
/** @internal */
class TestAnnotationMapImpl {
  map;
  [TestAnnotationMapTypeId] = TestAnnotationMapTypeId;
  constructor(map) {
    this.map = map;
  }
}
/**
 * @since 2.0.0
 */
const isTestAnnotationMap = u => (0,Predicate.hasProperty)(u, TestAnnotationMapTypeId);
/**
 * @since 2.0.0
 */
const TestAnnotationMap_empty = () => new TestAnnotationMapImpl(HashMap.empty());
/**
 * @since 2.0.0
 */
const TestAnnotationMap_make = map => {
  return new TestAnnotationMapImpl(map);
};
/**
 * @since 2.0.0
 */
const overwrite = /*#__PURE__*/(0,Function.dual)(3, (self, key, value) => TestAnnotationMap_make(HashMap.set(self.map, key, value)));
/**
 * @since 2.0.0
 */
const TestAnnotationMap_update = /*#__PURE__*/(0,Function.dual)(3, (self, key, f) => {
  let value = key.initial;
  if (HashMap.has(self.map, key)) {
    value = HashMap.unsafeGet(self.map, key);
  }
  return overwrite(self, key, f(value));
});
/**
 * Retrieves the annotation of the specified type, or its default value if
 * there is none.
 *
 * @since 2.0.0
 */
const TestAnnotationMap_get = /*#__PURE__*/(0,Function.dual)(2, (self, key) => {
  if (HashMap.has(self.map, key)) {
    return HashMap.unsafeGet(self.map, key);
  }
  return key.initial;
});
/**
 * Appends the specified annotation to the annotation map.
 *
 * @since 2.0.0
 */
const annotate = /*#__PURE__*/(0,Function.dual)(3, (self, key, value) => TestAnnotationMap_update(self, key, _ => key.combine(_, value)));
/**
 * @since 2.0.0
 */
const TestAnnotationMap_combine = /*#__PURE__*/(0,Function.dual)(2, (self, that) => {
  let result = self.map;
  for (const entry of that.map) {
    if (HashMap.has(result, entry[0])) {
      const value = HashMap.get(result, entry[0]);
      result = HashMap.set(result, entry[0], entry[0].combine(value, entry[1]));
    } else {
      result = HashMap.set(result, entry[0], entry[1]);
    }
  }
  return TestAnnotationMap_make(result);
});
//# sourceMappingURL=TestAnnotationMap.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/fiber.js
var internal_fiber = __webpack_require__(80387);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestAnnotations.js
/**
 * @since 2.0.0
 */













/**
 * @since 2.0.0
 */
const TestAnnotationsTypeId = /*#__PURE__*/Symbol.for("effect/TestAnnotations");
/** @internal */
class AnnotationsImpl {
  ref;
  [TestAnnotationsTypeId] = TestAnnotationsTypeId;
  constructor(ref) {
    this.ref = ref;
  }
  get(key) {
    return core/* .map */.TjK(Ref.get(this.ref), TestAnnotationMap_get(key));
  }
  annotate(key, value) {
    return Ref.update(this.ref, annotate(key, value));
  }
  get supervisedFibers() {
    return core_effect/* .descriptorWith */.U$(descriptor => core/* .flatMap */.qIB(this.get(TestAnnotation_fibers), either => {
      switch (either._tag) {
        case "Left":
          {
            return core/* .succeed */.PyW(SortedSet.empty(internal_fiber/* .Order */.pH));
          }
        case "Right":
          {
            return (0,Function.pipe)(either.right, core/* .forEachSequential */.CFK(ref => core/* .sync */.OH5(() => MutableRef.get(ref))), core/* .map */.TjK(esm_Array.reduce(SortedSet.empty(internal_fiber/* .Order */.pH), (a, b) => SortedSet.union(a, b))), core/* .map */.TjK(SortedSet.filter(fiber => !Equal.equals(fiber.id(), descriptor.id))));
          }
      }
    }));
  }
}
/**
 * @since 2.0.0
 */
const TestAnnotations = /*#__PURE__*/Context.GenericTag("effect/Annotations");
/**
 * @since 2.0.0
 */
const isTestAnnotations = u => (0,Predicate.hasProperty)(u, TestAnnotationsTypeId);
/**
 * @since 2.0.0
 */
const TestAnnotations_make = ref => new AnnotationsImpl(ref);
//# sourceMappingURL=TestAnnotations.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/clock.js
var internal_clock = __webpack_require__(51891);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/defaultServices.js
var defaultServices = __webpack_require__(16208);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/testing/suspendedWarningData.js
/** @internal */
const OP_SUSPENDED_WARNING_DATA_START = "Start";
/** @internal */
const OP_SUSPENDED_WARNING_DATA_PENDING = "Pending";
/** @internal */
const OP_SUSPENDED_WARNING_DATA_DONE = "Done";
/**
 * State indicating that a test has not adjusted the clock.
 *
 * @internal
 */
const suspendedWarningData_start = {
  _tag: OP_SUSPENDED_WARNING_DATA_START
};
/**
 * State indicating that a test has adjusted the clock but a fiber is still
 * running with a reference to the fiber that will display the warning
 * message.
 *
 * @internal
 */
const suspendedWarningData_pending = fiber => {
  return {
    _tag: OP_SUSPENDED_WARNING_DATA_PENDING,
    fiber
  };
};
/**
 * State indicating that the warning message has already been displayed.
 *
 * @internal
 */
const suspendedWarningData_done = {
  _tag: OP_SUSPENDED_WARNING_DATA_DONE
};
/** @internal */
const isStart = self => {
  return self._tag === OP_SUSPENDED_WARNING_DATA_START;
};
/** @internal */
const suspendedWarningData_isPending = self => {
  return self._tag === OP_SUSPENDED_WARNING_DATA_PENDING;
};
/** @internal */
const suspendedWarningData_isDone = self => {
  return self._tag === OP_SUSPENDED_WARNING_DATA_DONE;
};
//# sourceMappingURL=suspendedWarningData.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/testing/warningData.js
/** @internal */
const OP_WARNING_DATA_START = "Start";
/** @internal */
const OP_WARNING_DATA_PENDING = "Pending";
/** @internal */
const OP_WARNING_DATA_DONE = "Done";
/**
 * State indicating that a test has not used time.
 *
 * @internal
 */
const warningData_start = {
  _tag: OP_WARNING_DATA_START
};
/**
 * State indicating that a test has used time but has not adjusted the
 * `TestClock` with a reference to the fiber that will display the warning
 * message.
 *
 * @internal
 */
const warningData_pending = fiber => {
  return {
    _tag: OP_WARNING_DATA_PENDING,
    fiber
  };
};
/**
 * State indicating that a test has used time or the warning message has
 * already been displayed.
 *
 * @internal
 */
const warningData_done = {
  _tag: OP_WARNING_DATA_DONE
};
/** @internal */
const warningData_isStart = self => {
  return self._tag === OP_WARNING_DATA_START;
};
/** @internal */
const warningData_isPending = self => {
  return self._tag === OP_WARNING_DATA_PENDING;
};
/** @internal */
const warningData_isDone = self => {
  return self._tag === OP_WARNING_DATA_DONE;
};
//# sourceMappingURL=warningData.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestLive.js
/**
 * @since 2.0.0
 */



/**
 * @since 2.0.0
 */
const TestLiveTypeId = /*#__PURE__*/Symbol.for("effect/TestLive");
/**
 * @since 2.0.0
 */
const TestLive = /*#__PURE__*/Context.GenericTag("effect/TestLive");
/** @internal */
class LiveImpl {
  services;
  [TestLiveTypeId] = TestLiveTypeId;
  constructor(services) {
    this.services = services;
  }
  provide(effect) {
    return core/* .fiberRefLocallyWith */.q1t(defaultServices/* .currentServices */.qJ, Context.merge(this.services))(effect);
  }
}
/**
 * @since 2.0.0
 */
const TestLive_make = services => new LiveImpl(services);
//# sourceMappingURL=TestLive.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestClock.js
/**
 * @since 2.0.0
 */
























/**
 * @since 2.0.0
 */
const makeData = (instant, sleeps) => ({
  instant,
  sleeps
});
/**
 * @since 2.0.0
 */
const TestClock = /*#__PURE__*/Context.GenericTag("effect/TestClock");
/**
 * The warning message that will be displayed if a test is using time but is
 * not advancing the `TestClock`.
 *
 * @internal
 */
const warning = "Warning: A test is using time, but is not advancing " + "the test clock, which may result in the test hanging. Use TestClock.adjust to " + "manually advance the time.";
/**
 * The warning message that will be displayed if a test is advancing the clock
 * but a fiber is still running.
 *
 * @internal
 */
const suspendedWarning = "Warning: A test is advancing the test clock, " + "but a fiber is not suspending, which may result in the test hanging. Use " + "TestAspect.diagnose to identity the fiber that is not suspending.";
/** @internal */
class TestClockImpl {
  clockState;
  live;
  annotations;
  warningState;
  suspendedWarningState;
  [internal_clock/* .ClockTypeId */.iu] = internal_clock/* .ClockTypeId */.iu;
  constructor(clockState, live, annotations, warningState, suspendedWarningState) {
    this.clockState = clockState;
    this.live = live;
    this.annotations = annotations;
    this.warningState = warningState;
    this.suspendedWarningState = suspendedWarningState;
    this.currentTimeMillis = core/* .map */.TjK(internal_ref/* .get */.Jt(this.clockState), data => data.instant);
    this.currentTimeNanos = core/* .map */.TjK(internal_ref/* .get */.Jt(this.clockState), data => BigInt(data.instant * 1000000));
  }
  /**
   * Unsafely returns the current time in milliseconds.
   */
  unsafeCurrentTimeMillis() {
    return internal_ref/* .unsafeGet */.$v(this.clockState).instant;
  }
  /**
   * Unsafely returns the current time in nanoseconds.
   */
  unsafeCurrentTimeNanos() {
    return BigInt(Math.floor(this.unsafeCurrentTimeMillis() * 1000000));
  }
  /**
   * Returns the current clock time in milliseconds.
   */
  currentTimeMillis;
  /**
   * Returns the current clock time in nanoseconds.
   */
  currentTimeNanos;
  /**
   * Saves the `TestClock`'s current state in an effect which, when run, will
   * restore the `TestClock` state to the saved state.
   */
  get save() {
    return core/* .map */.TjK(internal_ref/* .get */.Jt(this.clockState), data => internal_ref/* .set */.hZ(this.clockState, data));
  }
  /**
   * Sets the current clock time to the specified instant. Any effects that
   * were scheduled to occur on or before the new time will be run in order.
   */
  setTime(instant) {
    return core/* .zipRight */.aNH(this.warningDone(), this.run(() => instant));
  }
  /**
   * Semantically blocks the current fiber until the clock time is equal to or
   * greater than the specified duration. Once the clock time is adjusted to
   * on or after the duration, the fiber will automatically be resumed.
   */
  sleep(durationInput) {
    const duration = Duration.decode(durationInput);
    return core/* .flatMap */.qIB(core/* .deferredMake */.WW4(), deferred => (0,Function.pipe)(internal_ref/* .modify */.JP(this.clockState, data => {
      const end = data.instant + Duration.toMillis(duration);
      if (end > data.instant) {
        return [true, makeData(data.instant, (0,Function.pipe)(data.sleeps, Chunk.prepend([end, deferred])))];
      }
      return [false, data];
    }), core/* .flatMap */.qIB(shouldAwait => shouldAwait ? (0,Function.pipe)(this.warningStart(), core/* .zipRight */.aNH(core/* .deferredAwait */.gn0(deferred))) : (0,Function.pipe)(core/* .deferredSucceed */.syF(deferred, void 0), core/* .asVoid */.NLW))));
  }
  /**
   * Returns a list of the times at which all queued effects are scheduled to
   * resume.
   */
  get sleeps() {
    return core/* .map */.TjK(internal_ref/* .get */.Jt(this.clockState), data => Chunk.map(data.sleeps, _ => _[0]));
  }
  /**
   * Increments the current clock time by the specified duration. Any effects
   * that were scheduled to occur on or before the new time will be run in
   * order.
   */
  adjust(durationInput) {
    const duration = Duration.decode(durationInput);
    return core/* .zipRight */.aNH(this.warningDone(), this.run(n => n + Duration.toMillis(duration)));
  }
  /**
   * Increments the current clock time by the specified duration. Any effects
   * that were scheduled to occur on or before the new time will be run in
   * order.
   */
  adjustWith(durationInput) {
    const duration = Duration.decode(durationInput);
    return effect => fiberRuntime/* .zipLeftOptions */.Ne(effect, this.adjust(duration), {
      concurrent: true
    });
  }
  /**
   * Returns a set of all fibers in this test.
   */
  supervisedFibers() {
    return this.annotations.supervisedFibers;
  }
  /**
   * Captures a "snapshot" of the identifier and status of all fibers in this
   * test other than the current fiber. Fails with the `void` value if any of
   * these fibers are not done or suspended. Note that because we cannot
   * synchronize on the status of multiple fibers at the same time this
   * snapshot may not be fully consistent.
   */
  freeze() {
    return core/* .flatMap */.qIB(this.supervisedFibers(), fibers => (0,Function.pipe)(fibers, core_effect/* .reduce */.TS(HashMap.empty(), (map, fiber) => (0,Function.pipe)(fiber.status, core/* .flatMap */.qIB(status => {
      if (FiberStatus.isDone(status)) {
        return core/* .succeed */.PyW(HashMap.set(map, fiber.id(), status));
      }
      if (FiberStatus.isSuspended(status)) {
        return core/* .succeed */.PyW(HashMap.set(map, fiber.id(), status));
      }
      return core/* .fail */.fJG(void 0);
    })))));
  }
  /**
   * Forks a fiber that will display a warning message if a test is using time
   * but is not advancing the `TestClock`.
   */
  warningStart() {
    return synchronizedRef/* .updateSomeEffect */.pu(this.warningState, data => warningData_isStart(data) ? Option.some((0,Function.pipe)(this.live.provide((0,Function.pipe)(core_effect/* .logWarning */.FF(warning), core_effect/* .delay */.cb(Duration.seconds(5)))), core/* .interruptible */.Inz, fiberRuntime/* .fork */.Zy, core/* .map */.TjK(fiber => warningData_pending(fiber)))) : Option.none());
  }
  /**
   * Cancels the warning message that is displayed if a test is using time but
   * is not advancing the `TestClock`.
   */
  warningDone() {
    return synchronizedRef/* .updateSomeEffect */.pu(this.warningState, warningData => {
      if (warningData_isStart(warningData)) {
        return Option.some(core/* .succeed */.PyW(warningData_done));
      }
      if (warningData_isPending(warningData)) {
        return Option.some((0,Function.pipe)(core/* .interruptFiber */.OLv(warningData.fiber), core.as(warningData_done)));
      }
      return Option.none();
    });
  }
  yieldTimer = /*#__PURE__*/core/* .async */.bIC(resume => {
    const timer = setTimeout(() => {
      resume(core/* ["void"] */.rIH);
    }, 0);
    return core/* .sync */.OH5(() => clearTimeout(timer));
  });
  /**
   * Returns whether all descendants of this fiber are done or suspended.
   */
  suspended() {
    return (0,Function.pipe)(this.freeze(), core/* .zip */.yU6((0,Function.pipe)(this.yieldTimer, core/* .zipRight */.aNH(this.freeze()))), core/* .flatMap */.qIB(([first, last]) => Equal.equals(first, last) ? core/* .succeed */.PyW(first) : core/* .fail */.fJG(void 0)));
  }
  /**
   * Polls until all descendants of this fiber are done or suspended.
   */
  awaitSuspended() {
    return (0,Function.pipe)(this.suspendedWarningStart(), core/* .zipRight */.aNH((0,Function.pipe)(this.suspended(), core/* .zipWith */.OYO((0,Function.pipe)(this.yieldTimer, core/* .zipRight */.aNH(this.suspended())), Equal.equals), core_effect/* .filterOrFail */.W$(Function.identity, Function.constVoid), core_effect/* .eventually */.u4)), core/* .zipRight */.aNH(this.suspendedWarningDone()));
  }
  /**
   * Forks a fiber that will display a warning message if a test is advancing
   * the `TestClock` but a fiber is not suspending.
   */
  suspendedWarningStart() {
    return synchronizedRef/* .updateSomeEffect */.pu(this.suspendedWarningState, suspendedWarningData => {
      if (isStart(suspendedWarningData)) {
        return Option.some((0,Function.pipe)(this.live.provide((0,Function.pipe)(core_effect/* .logWarning */.FF(suspendedWarning), core/* .zipRight */.aNH(internal_ref/* .set */.hZ(this.suspendedWarningState, suspendedWarningData_done)), core_effect/* .delay */.cb(Duration.seconds(5)))), core/* .interruptible */.Inz, fiberRuntime/* .fork */.Zy, core/* .map */.TjK(fiber => suspendedWarningData_pending(fiber))));
      }
      return Option.none();
    });
  }
  /**
   * Cancels the warning message that is displayed if a test is advancing the
   * `TestClock` but a fiber is not suspending.
   */
  suspendedWarningDone() {
    return synchronizedRef/* .updateSomeEffect */.pu(this.suspendedWarningState, suspendedWarningData => {
      if (suspendedWarningData_isPending(suspendedWarningData)) {
        return Option.some((0,Function.pipe)(core/* .interruptFiber */.OLv(suspendedWarningData.fiber), core.as(suspendedWarningData_start)));
      }
      return Option.none();
    });
  }
  /**
   * Runs all effects scheduled to occur on or before the specified instant,
   * which may depend on the current time, in order.
   */
  run(f) {
    return (0,Function.pipe)(this.awaitSuspended(), core/* .zipRight */.aNH((0,Function.pipe)(internal_ref/* .modify */.JP(this.clockState, data => {
      const end = f(data.instant);
      const sorted = (0,Function.pipe)(data.sleeps, Chunk.sort((0,Function.pipe)(esm_Number.Order, Order.mapInput(_ => _[0]))));
      if (Chunk.isNonEmpty(sorted)) {
        const [instant, deferred] = Chunk.headNonEmpty(sorted);
        if (instant <= end) {
          return [Option.some([end, deferred]), makeData(instant, Chunk.tailNonEmpty(sorted))];
        }
      }
      return [Option.none(), makeData(end, data.sleeps)];
    }), core/* .flatMap */.qIB(option => {
      switch (option._tag) {
        case "None":
          {
            return core/* ["void"] */.rIH;
          }
        case "Some":
          {
            const [end, deferred] = option.value;
            return (0,Function.pipe)(core/* .deferredSucceed */.syF(deferred, void 0), core/* .zipRight */.aNH(core/* .yieldNow */.m9E()), core/* .zipRight */.aNH(this.run(() => end)));
          }
      }
    }))));
  }
}
/**
 * @since 2.0.0
 */
const TestClock_live = data => internal_layer/* .scoped */.P1(TestClock, core/* .gen */.JkU(function* () {
  const live = yield* TestLive;
  const annotations = yield* TestAnnotations;
  const clockState = yield* core/* .sync */.OH5(() => internal_ref/* .unsafeMake */.s$(data));
  const warningState = yield* circular/* .makeSynchronized */.PJ(warningData_start);
  const suspendedWarningState = yield* circular/* .makeSynchronized */.PJ(suspendedWarningData_start);
  const testClock = new TestClockImpl(clockState, live, annotations, warningState, suspendedWarningState);
  yield* fiberRuntime/* .withClockScoped */.rh(testClock);
  yield* fiberRuntime/* .addFinalizer */.U9(() => core/* .zipRight */.aNH(testClock.warningDone(), testClock.suspendedWarningDone()));
  return testClock;
}));
/**
 * @since 2.0.0
 */
const defaultTestClock = /*#__PURE__*/TestClock_live(/*#__PURE__*/makeData(/*#__PURE__*/new Date(0).getTime(), /*#__PURE__*/Chunk.empty()));
/**
 * Accesses a `TestClock` instance in the context and increments the time
 * by the specified duration, running any actions scheduled for on or before
 * the new time in order.
 *
 * @since 2.0.0
 */
const adjust = durationInput => {
  const duration = Duration.decode(durationInput);
  return testClockWith(testClock => testClock.adjust(duration));
};
/**
 * @since 2.0.0
 */
const adjustWith = /*#__PURE__*/(0,Function.dual)(2, (effect, durationInput) => {
  const duration = Duration.decode(durationInput);
  return testClockWith(testClock => testClock.adjustWith(duration)(effect));
});
/**
 * Accesses a `TestClock` instance in the context and saves the clock
 * state in an effect which, when run, will restore the `TestClock` to the
 * saved state.
 *
 * @since 2.0.0
 */
const save = () => testClockWith(testClock => testClock.save);
/**
 * Accesses a `TestClock` instance in the context and sets the clock time
 * to the specified `Instant` or `Date`, running any actions scheduled for on or before
 * the new time in order.
 *
 * @since 2.0.0
 */
const setTime = input => testClockWith(testClock => testClock.setTime(typeof input === "number" ? input : DateTime.unsafeMake(input).epochMillis));
/**
 * Semantically blocks the current fiber until the clock time is equal to or
 * greater than the specified duration. Once the clock time is adjusted to
 * on or after the duration, the fiber will automatically be resumed.
 *
 * @since 2.0.0
 */
const sleep = durationInput => {
  const duration = Duration.decode(durationInput);
  return testClockWith(testClock => testClock.sleep(duration));
};
/**
 * Accesses a `TestClock` instance in the context and returns a list of
 * times that effects are scheduled to run.
 *
 * @since 2.0.0
 */
const TestClock_sleeps = () => testClockWith(testClock => testClock.sleeps);
/**
 * Retrieves the `TestClock` service for this test.
 *
 * @since 2.0.0
 */
const TestClock_testClock = () => testClockWith(core/* .succeed */.PyW);
/**
 * Retrieves the `TestClock` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
const testClockWith = f => core/* .fiberRefGetWith */.uPR(defaultServices/* .currentServices */.qJ, services => f((0,Function.pipe)(services, Context.get(internal_clock/* .clockTag */.hV))));
/**
 * Accesses the current time of a `TestClock` instance in the context in
 * milliseconds.
 *
 * @since 2.0.0
 */
const currentTimeMillis = /*#__PURE__*/testClockWith(testClock => testClock.currentTimeMillis);
//# sourceMappingURL=TestClock.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestConfig.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */
const TestConfig = /*#__PURE__*/Context.GenericTag("effect/TestConfig");
/**
 * @since 2.0.0
 */
const TestConfig_make = params => params;
//# sourceMappingURL=TestConfig.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestSized.js
/**
 * @since 2.0.0
 */


/**
 * @since 2.0.0
 */
const TestSizedTypeId = /*#__PURE__*/Symbol.for("effect/TestSized");
/**
 * @since 2.0.0
 */
const TestSized = /*#__PURE__*/Context.GenericTag("effect/TestSized");
/** @internal */
class SizedImpl {
  fiberRef;
  [TestSizedTypeId] = TestSizedTypeId;
  constructor(fiberRef) {
    this.fiberRef = fiberRef;
  }
  get size() {
    return core/* .fiberRefGet */.U8_(this.fiberRef);
  }
  withSize(size) {
    return effect => core/* .fiberRefLocally */.woH(this.fiberRef, size)(effect);
  }
}
/**
 * @since 2.0.0
 */
const TestSized_make = size => new SizedImpl(core/* .fiberRefUnsafeMake */.QID(size));
/**
 * @since 2.0.0
 */
const fromFiberRef = fiberRef => new SizedImpl(fiberRef);
//# sourceMappingURL=TestSized.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestServices.js
/**
 * @since 2.0.0
 */













/**
 * The default Effect test services.
 *
 * @since 2.0.0
 */
const liveServices = /*#__PURE__*/(0,Function.pipe)(/*#__PURE__*/Context.make(TestAnnotations, /*#__PURE__*/TestAnnotations_make(/*#__PURE__*/internal_ref/* .unsafeMake */.s$(/*#__PURE__*/TestAnnotationMap_empty()))), /*#__PURE__*/Context.add(TestLive, /*#__PURE__*/TestLive_make(defaultServices/* .liveServices */.pF)), /*#__PURE__*/Context.add(TestSized, /*#__PURE__*/TestSized_make(100)), /*#__PURE__*/Context.add(TestConfig, /*#__PURE__*/TestConfig_make({
  repeats: 100,
  retries: 100,
  samples: 200,
  shrinks: 1000
})));
/**
 * @since 2.0.0
 */
const currentServices = /*#__PURE__*/core/* .fiberRefUnsafeMakeContext */.bzD(liveServices);
/**
 * Retrieves the `Annotations` service for this test.
 *
 * @since 2.0.0
 */
const TestServices_annotations = () => annotationsWith(core/* .succeed */.PyW);
/**
 * Retrieves the `Annotations` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
const annotationsWith = f => core/* .fiberRefGetWith */.uPR(currentServices, services => f(Context.get(services, TestAnnotations)));
/**
 * Executes the specified workflow with the specified implementation of the
 * annotations service.
 *
 * @since 2.0.0
 */
const withAnnotations = /*#__PURE__*/(0,Function.dual)(2, (effect, annotations) => core/* .fiberRefLocallyWith */.q1t(currentServices, Context.add(TestAnnotations, annotations))(effect));
/**
 * Sets the implementation of the annotations service to the specified value
 * and restores it to its original value when the scope is closed.
 *
 * @since 2.0.0
 */
const withAnnotationsScoped = annotations => fiberRuntime/* .fiberRefLocallyScopedWith */._1(currentServices, Context.add(TestAnnotations, annotations));
/**
 * Constructs a new `Annotations` service wrapped in a layer.
 *
 * @since 2.0.0
 */
const annotationsLayer = () => internal_layer/* .scoped */.P1(TestAnnotations, (0,Function.pipe)(core/* .sync */.OH5(() => internal_ref/* .unsafeMake */.s$(TestAnnotationMap_empty())), core/* .map */.TjK(TestAnnotations_make), core/* .tap */.Mim(withAnnotationsScoped)));
/**
 * Accesses an `Annotations` instance in the context and retrieves the
 * annotation of the specified type, or its default value if there is none.
 *
 * @since 2.0.0
 */
const TestServices_get = key => annotationsWith(annotations => annotations.get(key));
/**
 * Accesses an `Annotations` instance in the context and appends the
 * specified annotation to the annotation map.
 *
 * @since 2.0.0
 */
const TestServices_annotate = (key, value) => annotationsWith(annotations => annotations.annotate(key, value));
/**
 * Returns the set of all fibers in this test.
 *
 * @since 2.0.0
 */
const supervisedFibers = () => annotationsWith(annotations => annotations.supervisedFibers);
/**
 * Retrieves the `Live` service for this test and uses it to run the specified
 * workflow.
 *
 * @since 2.0.0
 */
const liveWith = f => core/* .fiberRefGetWith */.uPR(currentServices, services => f(Context.get(services, TestLive)));
/**
 * Retrieves the `Live` service for this test.
 *
 * @since 2.0.0
 */
const TestServices_live = /*#__PURE__*/liveWith(core/* .succeed */.PyW);
/**
 * Executes the specified workflow with the specified implementation of the
 * live service.
 *
 * @since 2.0.0
 */
const withLive = /*#__PURE__*/(0,Function.dual)(2, (effect, live) => core/* .fiberRefLocallyWith */.q1t(currentServices, Context.add(TestLive, live))(effect));
/**
 * Sets the implementation of the live service to the specified value and
 * restores it to its original value when the scope is closed.
 *
 * @since 2.0.0
 */
const withLiveScoped = live => fiberRuntime/* .fiberRefLocallyScopedWith */._1(currentServices, Context.add(TestLive, live));
/**
 * Constructs a new `Live` service wrapped in a layer.
 *
 * @since 2.0.0
 */
const liveLayer = () => internal_layer/* .scoped */.P1(TestLive, (0,Function.pipe)(core/* .context */._OA(), core/* .map */.TjK(TestLive_make), core/* .tap */.Mim(withLiveScoped)));
/**
 * Provides a workflow with the "live" default Effect services.
 *
 * @since 2.0.0
 */
const provideLive = effect => liveWith(live => live.provide(effect));
/**
 * Runs a transformation function with the live default Effect services while
 * ensuring that the workflow itself is run with the test services.
 *
 * @since 2.0.0
 */
const provideWithLive = /*#__PURE__*/(0,Function.dual)(2, (self, f) => core/* .fiberRefGetWith */.uPR(defaultServices/* .currentServices */.qJ, services => provideLive(f(core/* .fiberRefLocally */.woH(defaultServices/* .currentServices */.qJ, services)(self)))));
/**
 * Retrieves the `Sized` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
const sizedWith = f => core/* .fiberRefGetWith */.uPR(currentServices, services => f(Context.get(services, TestSized)));
/**
 * Retrieves the `Sized` service for this test.
 *
 * @since 2.0.0
 */
const TestServices_sized = /*#__PURE__*/sizedWith(core/* .succeed */.PyW);
/**
 * Executes the specified workflow with the specified implementation of the
 * sized service.
 *
 * @since 2.0.0
 */
const withSized = /*#__PURE__*/(0,Function.dual)(2, (effect, sized) => core/* .fiberRefLocallyWith */.q1t(currentServices, Context.add(TestSized, sized))(effect));
/**
 * Sets the implementation of the sized service to the specified value and
 * restores it to its original value when the scope is closed.
 *
 * @since 2.0.0
 */
const withSizedScoped = sized => fiberRuntime/* .fiberRefLocallyScopedWith */._1(currentServices, Context.add(TestSized, sized));
/**
 * @since 2.0.0
 */
const sizedLayer = size => internal_layer/* .scoped */.P1(TestSized, (0,Function.pipe)(fiberRuntime/* .fiberRefMake */.wT(size), core/* .map */.TjK(fromFiberRef), core/* .tap */.Mim(withSizedScoped)));
/**
 * @since 2.0.0
 */
const TestServices_size = /*#__PURE__*/sizedWith(sized => sized.size);
/**
 * @since 2.0.0
 */
const withSize = /*#__PURE__*/(0,Function.dual)(2, (effect, size) => sizedWith(sized => sized.withSize(size)(effect)));
/**
 * Retrieves the `TestConfig` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
const testConfigWith = f => core/* .fiberRefGetWith */.uPR(currentServices, services => f(Context.get(services, TestConfig)));
/**
 * Retrieves the `TestConfig` service for this test.
 *
 * @since 2.0.0
 */
const TestServices_testConfig = /*#__PURE__*/testConfigWith(core/* .succeed */.PyW);
/**
 * Executes the specified workflow with the specified implementation of the
 * config service.
 *
 * @since 2.0.0
 */
const withTestConfig = /*#__PURE__*/(0,Function.dual)(2, (effect, config) => core/* .fiberRefLocallyWith */.q1t(currentServices, Context.add(TestConfig, config))(effect));
/**
 * Sets the implementation of the config service to the specified value and
 * restores it to its original value when the scope is closed.
 *
 * @since 2.0.0
 */
const withTestConfigScoped = config => fiberRuntime/* .fiberRefLocallyScopedWith */._1(currentServices, Context.add(TestConfig, config));
/**
 * Constructs a new `TestConfig` service with the specified settings.
 *
 * @since 2.0.0
 */
const testConfigLayer = params => internal_layer/* .scoped */.P1(TestConfig, Effect.suspend(() => {
  const testConfig = TestConfig_make(params);
  return (0,Function.pipe)(withTestConfigScoped(testConfig), core.as(testConfig));
}));
/**
 * The number of times to repeat tests to ensure they are stable.
 *
 * @since 2.0.0
 */
const repeats = /*#__PURE__*/testConfigWith(config => core/* .succeed */.PyW(config.repeats));
/**
 * The number of times to retry flaky tests.
 *
 * @since 2.0.0
 */
const retries = /*#__PURE__*/testConfigWith(config => core/* .succeed */.PyW(config.retries));
/**
 * The number of sufficient samples to check for a random variable.
 *
 * @since 2.0.0
 */
const samples = /*#__PURE__*/testConfigWith(config => core/* .succeed */.PyW(config.samples));
/**
 * The maximum number of shrinkings to minimize large failures.
 *
 * @since 2.0.0
 */
const shrinks = /*#__PURE__*/testConfigWith(config => core/* .succeed */.PyW(config.shrinks));
//# sourceMappingURL=TestServices.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/TestContext.js





/** @internal */
const TestContext_live = /*#__PURE__*/(0,Function.pipe)(/*#__PURE__*/annotationsLayer(), /*#__PURE__*/internal_layer/* .merge */.h1(/*#__PURE__*/liveLayer()), /*#__PURE__*/internal_layer/* .merge */.h1(/*#__PURE__*/sizedLayer(100)), /*#__PURE__*/internal_layer/* .merge */.h1(/*#__PURE__*/(0,Function.pipe)(defaultTestClock, /*#__PURE__*/internal_layer/* .provideMerge */.S5(/*#__PURE__*/internal_layer/* .merge */.h1(/*#__PURE__*/liveLayer(), /*#__PURE__*/annotationsLayer())))), /*#__PURE__*/internal_layer/* .merge */.h1(/*#__PURE__*/testConfigLayer({
  repeats: 100,
  retries: 100,
  samples: 200,
  shrinks: 1000
})));
/**
 * @since 2.0.0
 */
const LiveContext = /*#__PURE__*/internal_layer/* .syncContext */.Jc(() => defaultServices/* .liveServices */.pF);
/**
 * @since 2.0.0
 */
const TestContext = /*#__PURE__*/internal_layer/* .provideMerge */.S5(TestContext_live, LiveContext);
//# sourceMappingURL=TestContext.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Tracer.js
var Tracer = __webpack_require__(52882);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/trie.js







const TrieSymbolKey = "effect/Trie";
/** @internal */
const TrieTypeId = /*#__PURE__*/Symbol.for(TrieSymbolKey);
const trieVariance = {
  /* c8 ignore next */
  _Value: _ => _
};
const TrieProto = {
  [TrieTypeId]: trieVariance,
  [Symbol.iterator]() {
    return new TrieIterator(this, (k, v) => [k, v], () => true);
  },
  [Hash.symbol]() {
    let hash = Hash.hash(TrieSymbolKey);
    for (const item of this) {
      hash ^= (0,Function.pipe)(Hash.hash(item[0]), Hash.combine(Hash.hash(item[1])));
    }
    return Hash.cached(this, hash);
  },
  [Equal.symbol](that) {
    if (isTrie(that)) {
      const entries = Array.from(that);
      return Array.from(this).every((itemSelf, i) => {
        const itemThat = entries[i];
        return Equal.equals(itemSelf[0], itemThat[0]) && Equal.equals(itemSelf[1], itemThat[1]);
      });
    }
    return false;
  },
  toString() {
    return (0,Inspectable.format)(this.toJSON());
  },
  toJSON() {
    return {
      _id: "Trie",
      values: Array.from(this).map(Inspectable.toJSON)
    };
  },
  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return (0,Pipeable.pipeArguments)(this, arguments);
  }
};
const trie_makeImpl = root => {
  const trie = Object.create(TrieProto);
  trie._root = root;
  trie._count = root?.count ?? 0;
  return trie;
};
class TrieIterator {
  trie;
  f;
  filter;
  stack = [];
  constructor(trie, f, filter) {
    this.trie = trie;
    this.f = f;
    this.filter = filter;
    const root = trie._root !== undefined ? trie._root : undefined;
    if (root !== undefined) {
      this.stack.push([root, "", false]);
    }
  }
  next() {
    while (this.stack.length > 0) {
      const [node, keyString, isAdded] = this.stack.pop();
      if (isAdded) {
        const value = node.value;
        if (value !== undefined) {
          const key = keyString + node.key;
          if (this.filter(key, value)) {
            return {
              done: false,
              value: this.f(key, value)
            };
          }
        }
      } else {
        this.addToStack(node, keyString);
      }
    }
    return {
      done: true,
      value: undefined
    };
  }
  addToStack(node, keyString) {
    if (node.right !== undefined) {
      this.stack.push([node.right, keyString, false]);
    }
    if (node.mid !== undefined) {
      this.stack.push([node.mid, keyString + node.key, false]);
    }
    this.stack.push([node, keyString, true]);
    if (node.left !== undefined) {
      this.stack.push([node.left, keyString, false]);
    }
  }
  [Symbol.iterator]() {
    return new TrieIterator(this.trie, this.f, this.filter);
  }
}
/** @internal */
const isTrie = u => (0,Predicate.hasProperty)(u, TrieTypeId);
/** @internal */
const trie_empty = () => trie_makeImpl(undefined);
/** @internal */
const trie_fromIterable = entries => {
  let trie = trie_empty();
  for (const [key, value] of entries) {
    trie = insert(trie, key, value);
  }
  return trie;
};
/** @internal */
const trie_make = (...entries) => {
  return trie_fromIterable(entries);
};
/** @internal */
const insert = /*#__PURE__*/(0,Function.dual)(3, (self, key, value) => {
  if (key.length === 0) return self;
  // -1:left | 0:mid | 1:right
  const dStack = [];
  const nStack = [];
  let n = self._root ?? {
    key: key[0],
    count: 0
  };
  const count = n.count + 1;
  let cIndex = 0;
  while (cIndex < key.length) {
    const c = key[cIndex];
    nStack.push(n);
    if (c > n.key) {
      dStack.push(1);
      if (n.right === undefined) {
        n = {
          key: c,
          count
        };
      } else {
        n = n.right;
      }
    } else if (c < n.key) {
      dStack.push(-1);
      if (n.left === undefined) {
        n = {
          key: c,
          count
        };
      } else {
        n = n.left;
      }
    } else {
      if (cIndex === key.length - 1) {
        n.value = value;
      } else if (n.mid === undefined) {
        dStack.push(0);
        n = {
          key: key[cIndex + 1],
          count
        };
      } else {
        dStack.push(0);
        n = n.mid;
      }
      cIndex += 1;
    }
  }
  // Rebuild path to leaf node (Path-copying immutability)
  for (let s = nStack.length - 2; s >= 0; --s) {
    const n2 = nStack[s];
    const d = dStack[s];
    if (d === -1) {
      // left
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: nStack[s + 1],
        mid: n2.mid,
        right: n2.right
      };
    } else if (d === 1) {
      // right
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: n2.left,
        mid: n2.mid,
        right: nStack[s + 1]
      };
    } else {
      // mid
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: n2.left,
        mid: nStack[s + 1],
        right: n2.right
      };
    }
  }
  nStack[0].count = count;
  return trie_makeImpl(nStack[0]);
});
/** @internal */
const trie_size = self => self._root?.count ?? 0;
/** @internal */
const trie_isEmpty = self => trie_size(self) === 0;
/** @internal */
const trie_keys = self => new TrieIterator(self, key => key, () => true);
/** @internal */
const trie_values = self => new TrieIterator(self, (_, value) => value, () => true);
/** @internal */
const trie_entries = self => new TrieIterator(self, (key, value) => [key, value], () => true);
/** @internal */
const trie_reduce = /*#__PURE__*/(0,Function.dual)(3, (self, zero, f) => {
  let accumulator = zero;
  for (const entry of self) {
    accumulator = f(accumulator, entry[1], entry[0]);
  }
  return accumulator;
});
/** @internal */
const trie_map = /*#__PURE__*/(0,Function.dual)(2, (self, f) => trie_reduce(self, trie_empty(), (trie, value, key) => insert(trie, key, f(value, key))));
/** @internal */
const trie_filter = /*#__PURE__*/(0,Function.dual)(2, (self, f) => trie_reduce(self, trie_empty(), (trie, value, key) => f(value, key) ? insert(trie, key, value) : trie));
/** @internal */
const filterMap = /*#__PURE__*/(0,Function.dual)(2, (self, f) => trie_reduce(self, trie_empty(), (trie, value, key) => {
  const option = f(value, key);
  return Option.isSome(option) ? insert(trie, key, option.value) : trie;
}));
/** @internal */
const compact = self => filterMap(self, Function.identity);
/** @internal */
const trie_forEach = /*#__PURE__*/(0,Function.dual)(2, (self, f) => trie_reduce(self, void 0, (_, value, key) => f(value, key)));
/** @internal */
const keysWithPrefix = /*#__PURE__*/(0,Function.dual)(2, (self, prefix) => new TrieIterator(self, key => key, key => key.startsWith(prefix)));
/** @internal */
const valuesWithPrefix = /*#__PURE__*/(0,Function.dual)(2, (self, prefix) => new TrieIterator(self, (_, value) => value, key => key.startsWith(prefix)));
/** @internal */
const entriesWithPrefix = /*#__PURE__*/(0,Function.dual)(2, (self, prefix) => new TrieIterator(self, (key, value) => [key, value], key => key.startsWith(prefix)));
/** @internal */
const toEntriesWithPrefix = /*#__PURE__*/(0,Function.dual)(2, (self, prefix) => Array.from(entriesWithPrefix(self, prefix)));
/** @internal */
const trie_get = /*#__PURE__*/(0,Function.dual)(2, (self, key) => {
  let n = self._root;
  if (n === undefined || key.length === 0) return Option.none();
  let cIndex = 0;
  while (cIndex < key.length) {
    const c = key[cIndex];
    if (c > n.key) {
      if (n.right === undefined) {
        return Option.none();
      } else {
        n = n.right;
      }
    } else if (c < n.key) {
      if (n.left === undefined) {
        return Option.none();
      } else {
        n = n.left;
      }
    } else {
      if (cIndex === key.length - 1) {
        return Option.fromNullable(n.value);
      } else {
        if (n.mid === undefined) {
          return Option.none();
        } else {
          n = n.mid;
          cIndex += 1;
        }
      }
    }
  }
  return Option.none();
});
/** @internal */
const trie_has = /*#__PURE__*/(0,Function.dual)(2, (self, key) => Option.isSome(trie_get(self, key)));
/** @internal */
const trie_unsafeGet = /*#__PURE__*/(0,Function.dual)(2, (self, key) => {
  const element = trie_get(self, key);
  if (Option.isNone(element)) {
    throw new Error("Expected trie to contain key");
  }
  return element.value;
});
/** @internal */
const trie_remove = /*#__PURE__*/(0,Function.dual)(2, (self, key) => {
  let n = self._root;
  if (n === undefined || key.length === 0) return self;
  const count = n.count - 1;
  // -1:left | 0:mid | 1:right
  const dStack = [];
  const nStack = [];
  let cIndex = 0;
  while (cIndex < key.length) {
    const c = key[cIndex];
    if (c > n.key) {
      if (n.right === undefined) {
        return self;
      } else {
        nStack.push(n);
        dStack.push(1);
        n = n.right;
      }
    } else if (c < n.key) {
      if (n.left === undefined) {
        return self;
      } else {
        nStack.push(n);
        dStack.push(-1);
        n = n.left;
      }
    } else {
      if (cIndex === key.length - 1) {
        if (n.value !== undefined) {
          nStack.push(n);
          dStack.push(0);
          cIndex += 1;
        } else {
          return self;
        }
      } else {
        if (n.mid === undefined) {
          return self;
        } else {
          nStack.push(n);
          dStack.push(0);
          n = n.mid;
          cIndex += 1;
        }
      }
    }
  }
  const removeNode = nStack[nStack.length - 1];
  nStack[nStack.length - 1] = {
    key: removeNode.key,
    count,
    left: removeNode.left,
    mid: removeNode.mid,
    right: removeNode.right
  };
  // Rebuild path to leaf node (Path-copying immutability)
  for (let s = nStack.length - 2; s >= 0; --s) {
    const n2 = nStack[s];
    const d = dStack[s];
    const child = nStack[s + 1];
    const nc = child.left === undefined && child.mid === undefined && child.right === undefined ? undefined : child;
    if (d === -1) {
      // left
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: nc,
        mid: n2.mid,
        right: n2.right
      };
    } else if (d === 1) {
      // right
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: n2.left,
        mid: n2.mid,
        right: nc
      };
    } else {
      // mid
      nStack[s] = {
        key: n2.key,
        count,
        value: n2.value,
        left: n2.left,
        mid: nc,
        right: n2.right
      };
    }
  }
  nStack[0].count = count;
  return trie_makeImpl(nStack[0]);
});
/** @internal */
const removeMany = /*#__PURE__*/(0,Function.dual)(2, (self, keys) => {
  let trie = self;
  for (const key of keys) {
    trie = trie_remove(key)(trie);
  }
  return trie;
});
/** @internal */
const insertMany = /*#__PURE__*/(0,Function.dual)(2, (self, iter) => {
  let trie = self;
  for (const [key, value] of iter) {
    trie = insert(key, value)(trie);
  }
  return trie;
});
/** @internal */
const trie_modify = /*#__PURE__*/(0,Function.dual)(3, (self, key, f) => {
  let n = self._root;
  if (n === undefined || key.length === 0) return self;
  // -1:left | 0:mid | 1:right
  const dStack = [];
  const nStack = [];
  let cIndex = 0;
  while (cIndex < key.length) {
    const c = key[cIndex];
    if (c > n.key) {
      if (n.right === undefined) {
        return self;
      } else {
        nStack.push(n);
        dStack.push(1);
        n = n.right;
      }
    } else if (c < n.key) {
      if (n.left === undefined) {
        return self;
      } else {
        nStack.push(n);
        dStack.push(-1);
        n = n.left;
      }
    } else {
      if (cIndex === key.length - 1) {
        if (n.value !== undefined) {
          nStack.push(n);
          dStack.push(0);
          cIndex += 1;
        } else {
          return self;
        }
      } else {
        if (n.mid === undefined) {
          return self;
        } else {
          nStack.push(n);
          dStack.push(0);
          n = n.mid;
          cIndex += 1;
        }
      }
    }
  }
  const updateNode = nStack[nStack.length - 1];
  if (updateNode.value === undefined) {
    return self;
  }
  nStack[nStack.length - 1] = {
    key: updateNode.key,
    count: updateNode.count,
    value: f(updateNode.value),
    // Update
    left: updateNode.left,
    mid: updateNode.mid,
    right: updateNode.right
  };
  // Rebuild path to leaf node (Path-copying immutability)
  for (let s = nStack.length - 2; s >= 0; --s) {
    const n2 = nStack[s];
    const d = dStack[s];
    const child = nStack[s + 1];
    if (d === -1) {
      // left
      nStack[s] = {
        key: n2.key,
        count: n2.count,
        value: n2.value,
        left: child,
        mid: n2.mid,
        right: n2.right
      };
    } else if (d === 1) {
      // right
      nStack[s] = {
        key: n2.key,
        count: n2.count,
        value: n2.value,
        left: n2.left,
        mid: n2.mid,
        right: child
      };
    } else {
      // mid
      nStack[s] = {
        key: n2.key,
        count: n2.count,
        value: n2.value,
        left: n2.left,
        mid: child,
        right: n2.right
      };
    }
  }
  return trie_makeImpl(nStack[0]);
});
/** @internal */
const longestPrefixOf = /*#__PURE__*/(0,Function.dual)(2, (self, key) => {
  let n = self._root;
  if (n === undefined || key.length === 0) return Option.none();
  let longestPrefixNode = undefined;
  let cIndex = 0;
  while (cIndex < key.length) {
    const c = key[cIndex];
    if (n.value !== undefined) {
      longestPrefixNode = [key.slice(0, cIndex + 1), n.value];
    }
    if (c > n.key) {
      if (n.right === undefined) {
        break;
      } else {
        n = n.right;
      }
    } else if (c < n.key) {
      if (n.left === undefined) {
        break;
      } else {
        n = n.left;
      }
    } else {
      if (n.mid === undefined) {
        break;
      } else {
        n = n.mid;
        cIndex += 1;
      }
    }
  }
  return Option.fromNullable(longestPrefixNode);
});
//# sourceMappingURL=trie.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Trie.js

const Trie_TypeId = TrieTypeId;
/**
 * Creates an empty `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.empty<string>()
 *
 * assert.equal(Trie.size(trie), 0)
 * assert.deepStrictEqual(Array.from(trie), [])
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const Trie_empty = trie_empty;
/**
 * Creates a new `Trie` from an iterable collection of key/value pairs (e.g. `Array<[string, V]>`).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const iterable: Array<readonly [string, number]> = [["call", 0], ["me", 1], ["mind", 2], ["mid", 3]]
 * const trie = Trie.fromIterable(iterable)
 *
 * // The entries in the `Trie` are extracted in alphabetical order, regardless of the insertion order
 * assert.deepStrictEqual(Array.from(trie), [["call", 0], ["me", 1], ["mid", 3], ["mind", 2]])
 * assert.equal(Equal.equals(Trie.make(["call", 0], ["me", 1], ["mind", 2], ["mid", 3]), trie), true)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const Trie_fromIterable = trie_fromIterable;
/**
 * Constructs a new `Trie` from the specified entries (`[string, V]`).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.make(["ca", 0], ["me", 1])
 *
 * assert.deepStrictEqual(Array.from(trie), [["ca", 0], ["me", 1]])
 * assert.equal(Equal.equals(Trie.fromIterable([["ca", 0], ["me", 1]]), trie), true)
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
const Trie_make = trie_make;
/**
 * Insert a new entry in the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie1 = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0)
 * )
 * const trie2 = trie1.pipe(Trie.insert("me", 1))
 * const trie3 = trie2.pipe(Trie.insert("mind", 2))
 * const trie4 = trie3.pipe(Trie.insert("mid", 3))
 *
 * assert.deepStrictEqual(Array.from(trie1), [["call", 0]])
 * assert.deepStrictEqual(Array.from(trie2), [["call", 0], ["me", 1]])
 * assert.deepStrictEqual(Array.from(trie3), [["call", 0], ["me", 1], ["mind", 2]])
 * assert.deepStrictEqual(Array.from(trie4), [["call", 0], ["me", 1], ["mid", 3], ["mind", 2]])
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
const Trie_insert = insert;
/**
 * Returns an `IterableIterator` of the keys within the `Trie`.
 *
 * The keys are returned in alphabetical order, regardless of insertion order.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("cab", 0),
 *   Trie.insert("abc", 1),
 *   Trie.insert("bca", 2)
 * )
 *
 * const result = Array.from(Trie.keys(trie))
 * assert.deepStrictEqual(result, ["abc", "bca", "cab"])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_keys = trie_keys;
/**
 * Returns an `IterableIterator` of the values within the `Trie`.
 *
 * Values are ordered based on their key in alphabetical order, regardless of insertion order.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1),
 *   Trie.insert("and", 2)
 * )
 *
 * const result = Array.from(Trie.values(trie))
 * assert.deepStrictEqual(result, [2, 0, 1])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_values = trie_values;
/**
 * Returns an `IterableIterator` of the entries within the `Trie`.
 *
 * The entries are returned by keys in alphabetical order, regardless of insertion order.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1)
 * )
 *
 * const result = Array.from(Trie.entries(trie))
 * assert.deepStrictEqual(result, [["call", 0], ["me", 1]])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_entries = trie_entries;
/**
 * Returns an `Array<[K, V]>` of the entries within the `Trie`.
 *
 * Equivalent to `Array.from(Trie.entries(trie))`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1)
 * )
 * const result = Trie.toEntries(trie)
 *
 * assert.deepStrictEqual(result, [["call", 0], ["me", 1]])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const toEntries = self => Array.from(Trie_entries(self));
/**
 * Returns an `IterableIterator` of the keys within the `Trie`
 * that have `prefix` as prefix (`prefix` included if it exists).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("she", 0),
 *   Trie.insert("shells", 1),
 *   Trie.insert("sea", 2),
 *   Trie.insert("shore", 3)
 * )
 *
 * const result = Array.from(Trie.keysWithPrefix(trie, "she"))
 * assert.deepStrictEqual(result, ["she", "shells"])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_keysWithPrefix = keysWithPrefix;
/**
 * Returns an `IterableIterator` of the values within the `Trie`
 * that have `prefix` as prefix (`prefix` included if it exists).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("she", 0),
 *   Trie.insert("shells", 1),
 *   Trie.insert("sea", 2),
 *   Trie.insert("shore", 3)
 * )
 *
 * const result = Array.from(Trie.valuesWithPrefix(trie, "she"))
 *
 * // 0: "she", 1: "shells"
 * assert.deepStrictEqual(result, [0, 1])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_valuesWithPrefix = valuesWithPrefix;
/**
 * Returns an `IterableIterator` of the entries within the `Trie`
 * that have `prefix` as prefix (`prefix` included if it exists).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("she", 0),
 *   Trie.insert("shells", 1),
 *   Trie.insert("sea", 2),
 *   Trie.insert("shore", 3)
 * )
 *
 * const result = Array.from(Trie.entriesWithPrefix(trie, "she"))
 * assert.deepStrictEqual(result, [["she", 0], ["shells", 1]])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_entriesWithPrefix = entriesWithPrefix;
/**
 * Returns `Array<[K, V]>` of the entries within the `Trie`
 * that have `prefix` as prefix (`prefix` included if it exists).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("sea", 2),
 *   Trie.insert("she", 3)
 * )
 *
 * const result = Trie.toEntriesWithPrefix(trie, "she")
 * assert.deepStrictEqual(result, [["she", 3], ["shells", 0]])
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_toEntriesWithPrefix = toEntriesWithPrefix;
/**
 * Returns the longest key/value in the `Trie`
 * that is a prefix of that `key` if it exists, `None` otherwise.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Option } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * assert.deepStrictEqual(Trie.longestPrefixOf(trie, "sell"), Option.none())
 * assert.deepStrictEqual(Trie.longestPrefixOf(trie, "sells"), Option.some(["sells", 1]))
 * assert.deepStrictEqual(Trie.longestPrefixOf(trie, "shell"), Option.some(["she", 2]))
 * assert.deepStrictEqual(Trie.longestPrefixOf(trie, "shellsort"), Option.some(["shells", 0]))
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_longestPrefixOf = longestPrefixOf;
/**
 * Returns the size of the `Trie` (number of entries in the `Trie`).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("a", 0),
 *   Trie.insert("b", 1)
 * )
 *
 * assert.equal(Trie.size(trie), 2)
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
const Trie_size = trie_size;
/**
 * Safely lookup the value for the specified key in the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Option } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1),
 *   Trie.insert("mind", 2),
 *   Trie.insert("mid", 3)
 * )
 *
 * assert.deepStrictEqual(Trie.get(trie, "call"), Option.some(0))
 * assert.deepStrictEqual(Trie.get(trie, "me"), Option.some(1))
 * assert.deepStrictEqual(Trie.get(trie, "mind"), Option.some(2))
 * assert.deepStrictEqual(Trie.get(trie, "mid"), Option.some(3))
 * assert.deepStrictEqual(Trie.get(trie, "cale"), Option.none())
 * assert.deepStrictEqual(Trie.get(trie, "ma"), Option.none())
 * assert.deepStrictEqual(Trie.get(trie, "midn"), Option.none())
 * assert.deepStrictEqual(Trie.get(trie, "mea"), Option.none())
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
const Trie_get = trie_get;
/**
 * Check if the given key exists in the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1),
 *   Trie.insert("mind", 2),
 *   Trie.insert("mid", 3)
 * )
 *
 * assert.equal(Trie.has(trie, "call"), true)
 * assert.equal(Trie.has(trie, "me"), true)
 * assert.equal(Trie.has(trie, "mind"), true)
 * assert.equal(Trie.has(trie, "mid"), true)
 * assert.equal(Trie.has(trie, "cale"), false)
 * assert.equal(Trie.has(trie, "ma"), false)
 * assert.equal(Trie.has(trie, "midn"), false)
 * assert.equal(Trie.has(trie, "mea"), false)
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
const Trie_has = trie_has;
/**
 * Checks if the `Trie` contains any entries.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>()
 * const trie1 = trie.pipe(Trie.insert("ma", 0))
 *
 * assert.equal(Trie.isEmpty(trie), true)
 * assert.equal(Trie.isEmpty(trie1), false)
 * ```
 *
 * @since 2.0.0
 * @category elements
 */
const Trie_isEmpty = trie_isEmpty;
/**
 * Unsafely lookup the value for the specified key in the `Trie`.
 *
 * `unsafeGet` will throw if the key is not found. Use `get` instead to safely
 * get a value from the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1)
 * )
 *
 * assert.throws(() => Trie.unsafeGet(trie, "mae"))
 * ```
 *
 * @since 2.0.0
 * @category unsafe
 */
const Trie_unsafeGet = trie_unsafeGet;
/**
 * Remove the entry for the specified key in the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Option } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("call", 0),
 *   Trie.insert("me", 1),
 *   Trie.insert("mind", 2),
 *   Trie.insert("mid", 3)
 * )
 *
 * const trie1 = trie.pipe(Trie.remove("call"))
 * const trie2 = trie1.pipe(Trie.remove("mea"))
 *
 * assert.deepStrictEqual(Trie.get(trie, "call"), Option.some(0))
 * assert.deepStrictEqual(Trie.get(trie1, "call"), Option.none())
 * assert.deepStrictEqual(Trie.get(trie2, "call"), Option.none())
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
const Trie_remove = trie_remove;
/**
 * Reduce a state over the entries of the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * assert.equal(
 *   trie.pipe(
 *     Trie.reduce(0, (acc, n) => acc + n)
 *   ),
 *   3
 * )
 * assert.equal(
 *   trie.pipe(
 *     Trie.reduce(10, (acc, n) => acc + n)
 *   ),
 *   13
 * )
 * assert.equal(
 *   trie.pipe(
 *     Trie.reduce("", (acc, _, key) => acc + key)
 *   ),
 *   "sellssheshells"
 * )
 * ```
 *
 * @since 2.0.0
 * @category folding
 */
const Trie_reduce = trie_reduce;
/**
 * Maps over the entries of the `Trie` using the specified function.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * const trieMapV = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 1),
 *   Trie.insert("sells", 2),
 *   Trie.insert("she", 3)
 * )
 *
 * const trieMapK = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 6),
 *   Trie.insert("sells", 5),
 *   Trie.insert("she", 3)
 * )
 *
 * assert.equal(Equal.equals(Trie.map(trie, (v) => v + 1), trieMapV), true)
 * assert.equal(Equal.equals(Trie.map(trie, (_, k) => k.length), trieMapK), true)
 * ```
 *
 * @since 2.0.0
 * @category folding
 */
const Trie_map = trie_map;
/**
 * Filters entries out of a `Trie` using the specified predicate.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * const trieMapV = Trie.empty<number>().pipe(
 *   Trie.insert("she", 2)
 * )
 *
 * const trieMapK = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1)
 * )
 *
 * assert.equal(Equal.equals(Trie.filter(trie, (v) => v > 1), trieMapV), true)
 * assert.equal(Equal.equals(Trie.filter(trie, (_, k) => k.length > 3), trieMapK), true)
 * ```
 *
 * @since 2.0.0
 * @category filtering
 */
const Trie_filter = trie_filter;
/**
 * Maps over the entries of the `Trie` using the specified partial function
 * and filters out `None` values.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal, Option } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * const trieMapV = Trie.empty<number>().pipe(
 *   Trie.insert("she", 2)
 * )
 *
 * const trieMapK = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1)
 * )
 *
 * assert.equal(Equal.equals(Trie.filterMap(trie, (v) => v > 1 ? Option.some(v) : Option.none()), trieMapV), true)
 * assert.equal(
 *   Equal.equals(Trie.filterMap(trie, (v, k) => k.length > 3 ? Option.some(v) : Option.none()), trieMapK),
 *   true
 * )
 * ```
 *
 * @since 2.0.0
 * @category filtering
 */
const Trie_filterMap = filterMap;
/**
 * Filters out `None` values from a `Trie` of `Options`s.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal, Option } from "effect"
 *
 * const trie = Trie.empty<Option.Option<number>>().pipe(
 *   Trie.insert("shells", Option.some(0)),
 *   Trie.insert("sells", Option.none()),
 *   Trie.insert("she", Option.some(2))
 * )
 *
 * const trieMapV = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("she", 2)
 * )
 *
 * assert.equal(Equal.equals(Trie.compact(trie), trieMapV), true)
 * ```
 *
 * @since 2.0.0
 * @category filtering
 */
const Trie_compact = compact;
/**
 * Applies the specified function to the entries of the `Trie`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie } from "effect"
 *
 * let value = 0
 *
 * Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2),
 *   Trie.forEach((n, key) => {
 *     value += n + key.length
 *   })
 * )
 *
 * assert.equal(value, 17)
 * ```
 *
 * @since 2.0.0
 * @category traversing
 */
const Trie_forEach = trie_forEach;
/**
 * Updates the value of the specified key within the `Trie` if it exists.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal, Option } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * assert.deepStrictEqual(trie.pipe(Trie.modify("she", (v) => v + 10), Trie.get("she")), Option.some(12))
 *
 * assert.equal(Equal.equals(trie.pipe(Trie.modify("me", (v) => v)), trie), true)
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
const Trie_modify = trie_modify;
/**
 * Removes all entries in the `Trie` which have the specified keys.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * assert.equal(
 *   Equal.equals(trie.pipe(Trie.removeMany(["she", "sells"])), Trie.empty<number>().pipe(Trie.insert("shells", 0))),
 *   true
 * )
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
const Trie_removeMany = removeMany;
/**
 * Insert multiple entries in the `Trie` at once.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { Trie, Equal } from "effect"
 *
 * const trie = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insert("sells", 1),
 *   Trie.insert("she", 2)
 * )
 *
 * const trieInsert = Trie.empty<number>().pipe(
 *   Trie.insert("shells", 0),
 *   Trie.insertMany(
 *     [["sells", 1], ["she", 2]]
 *   )
 * )
 *
 * assert.equal(
 *   Equal.equals(trie, trieInsert),
 *   true
 * )
 * ```
 *
 * @since 2.0.0
 * @category mutations
 */
const Trie_insertMany = insertMany;
//# sourceMappingURL=Trie.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Tuple.js
var Tuple = __webpack_require__(64321);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Types.js
/**
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */

//# sourceMappingURL=Types.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Unify.js
var Unify = __webpack_require__(59776);
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/upstreamPullRequest.js + 1 modules
var upstreamPullRequest = __webpack_require__(37349);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/UpstreamPullRequest.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const UpstreamPullRequestTypeId = upstreamPullRequest/* .UpstreamPullRequestTypeId */.$F;
/**
 * @since 2.0.0
 * @category constructors
 */
const Pulled = upstreamPullRequest/* .Pulled */.HQ;
/**
 * @since 2.0.0
 * @category constructors
 */
const NoUpstream = upstreamPullRequest/* .NoUpstream */.Vz;
/**
 * Returns `true` if the specified value is an `UpstreamPullRequest`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isUpstreamPullRequest = upstreamPullRequest/* .isUpstreamPullRequest */.aG;
/**
 * Returns `true` if the specified `UpstreamPullRequest` is a `Pulled`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isPulled = upstreamPullRequest/* .isPulled */.NP;
/**
 * Returns `true` if the specified `UpstreamPullRequest` is a `NoUpstream`,
 * `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isNoUpstream = upstreamPullRequest/* .isNoUpstream */.dJ;
/**
 * Folds an `UpstreamPullRequest<A>` into a value of type `Z`.
 *
 * @since 2.0.0
 * @category folding
 */
const UpstreamPullRequest_match = upstreamPullRequest/* .match */.YW;
//# sourceMappingURL=UpstreamPullRequest.js.map
// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/internal/channel/upstreamPullStrategy.js
var upstreamPullStrategy = __webpack_require__(64874);
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/UpstreamPullStrategy.js
/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @category symbols
 */
const UpstreamPullStrategyTypeId = upstreamPullStrategy/* .UpstreamPullStrategyTypeId */.BJ;
/**
 * @since 2.0.0
 * @category constructors
 */
const PullAfterNext = upstreamPullStrategy/* .PullAfterNext */.rb;
/**
 * @since 2.0.0
 * @category constructors
 */
const PullAfterAllEnqueued = upstreamPullStrategy/* .PullAfterAllEnqueued */.vv;
/**
 * Returns `true` if the specified value is an `UpstreamPullStrategy`, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isUpstreamPullStrategy = upstreamPullStrategy/* .isUpstreamPullStrategy */.YE;
/**
 * Returns `true` if the specified `UpstreamPullStrategy` is a `PullAfterNext`,
 * `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isPullAfterNext = upstreamPullStrategy/* .isPullAfterNext */.fB;
/**
 * Returns `true` if the specified `UpstreamPullStrategy` is a
 * `PullAfterAllEnqueued`, `false` otherwise.
 *
 * @since 2.0.0
 * @category refinements
 */
const isPullAfterAllEnqueued = upstreamPullStrategy/* .isPullAfterAllEnqueued */.zx;
/**
 * Folds an `UpstreamPullStrategy<A>` into a value of type `Z`.
 *
 * @since 2.0.0
 * @category folding
 */
const UpstreamPullStrategy_match = upstreamPullStrategy/* .match */.YW;
//# sourceMappingURL=UpstreamPullStrategy.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/index.js
/**
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * This module provides utility functions for working with arrays in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * This module provides utility functions and type class instances for working with the `BigDecimal` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for `Equivalence` and `Order`.
 *
 * A `BigDecimal` allows storing any real number to arbitrary precision; which avoids common floating point errors
 * (such as 0.1 + 0.2 ≠ 0.3) at the cost of complexity.
 *
 * Internally, `BigDecimal` uses a `BigInt` object, paired with a 64-bit integer which determines the position of the
 * decimal point. Therefore, the precision *is not* actually arbitrary, but limited to 2<sup>63</sup> decimal places.
 *
 * It is not recommended to convert a floating point number to a decimal directly, as the floating point representation
 * may be unexpected.
 *
 * @module BigDecimal
 * @since 2.0.0
 * @see {@link module:BigInt} for more similar operations on `bigint` types
 * @see {@link module:Number} for more similar operations on `number` types
 */

/**
 * This module provides utility functions and type class instances for working with the `bigint` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @module BigInt
 * @since 2.0.0
 * @see {@link module:BigDecimal} for more similar operations on `BigDecimal` types
 * @see {@link module:Number} for more similar operations on `number` types
 */

/**
 * This module provides utility functions and type class instances for working with the `boolean` type in TypeScript.
 * It includes functions for basic boolean operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */

/**
 * This module provides types and utility functions to create and work with branded types,
 * which are TypeScript types with an added type tag to prevent accidental usage of a value in the wrong context.
 *
 * The `refined` and `nominal` functions are both used to create branded types in TypeScript.
 * The main difference between them is that `refined` allows for validation of the data, while `nominal` does not.
 *
 * The `nominal` function is used to create a new branded type that has the same underlying type as the input, but with a different name.
 * This is useful when you want to distinguish between two values of the same type that have different meanings.
 * The `nominal` function does not perform any validation of the input data.
 *
 * On the other hand, the `refined` function is used to create a new branded type that has the same underlying type as the input,
 * but with a different name, and it also allows for validation of the input data.
 * The `refined` function takes a predicate that is used to validate the input data.
 * If the input data fails the validation, a `BrandErrors` is returned, which provides information about the specific validation failure.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * The `Effect<A, E, R>` type is polymorphic in values of type `E` and we can
 * work with any error type that we want. However, there is a lot of information
 * that is not inside an arbitrary `E` value. So as a result, an `Effect` needs
 * somewhere to store things like unexpected errors or defects, stack and
 * execution traces, causes of fiber interruptions, and so forth.
 *
 * Effect-TS is very strict about preserving the full information related to a
 * failure. It captures all type of errors into the `Cause` data type. `Effect`
 * uses the `Cause<E>` data type to store the full story of failure. So its
 * error model is lossless. It doesn't throw information related to the failure
 * result. So we can figure out exactly what happened during the operation of
 * our effects.
 *
 * It is important to note that `Cause` is an underlying data type representing
 * errors occuring within an `Effect` workflow. Thus, we don't usually deal with
 * `Cause`s directly. Even though it is not a data type that we deal with very
 * often, the `Cause` of a failing `Effect` workflow can be accessed at any
 * time, which gives us total access to all parallel and sequential errors in
 * occurring within our codebase.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides a data structure called `Context` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Tag`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `Context` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `Context`, as well as a number of utility types for working with tags and services.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.6.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides encoding & decoding functionality for:
 *
 * - base64 (RFC4648)
 * - base64 (URL)
 * - hex
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides an implementation of the `Equivalence` type class, which defines a binary relation
 * that is reflexive, symmetric, and transitive. In other words, it defines a notion of equivalence between values of a certain type.
 * These properties are also known in mathematics as an "equivalence relation".
 *
 * @since 2.0.0
 */

/**
 * @since 3.16.0
 * @experimental
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * The `GlobalValue` module ensures that a single instance of a value is created globally,
 * even when modules are imported multiple times (e.g., due to mixing CommonJS and ESM builds)
 * or during hot-reloading in development environments like Next.js or Remix.
 *
 * It achieves this by using a versioned global store, identified by a unique `Symbol` tied to
 * the current version of the `effect` library. The store holds values that are keyed by an identifier,
 * allowing the reuse of previously computed instances across imports or reloads.
 *
 * This pattern is particularly useful in scenarios where frequent reloading can cause services or
 * single-instance objects to be recreated unnecessarily, such as in development environments with hot-reloading.
 *
 * @since 2.0.0
 */

/**
 * @experimental
 * @since 3.18.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.19.0
 * @experimental
 */

/**
 * # HashSet
 *
 * An immutable `HashSet` provides a collection of unique values with efficient
 * lookup, insertion and removal. Once created, a `HashSet` cannot be modified;
 * any operation that would alter the set instead returns a new `HashSet` with
 * the changes. This immutability offers benefits like predictable state
 * management and easier reasoning about your code.
 *
 * ## What Problem Does It Solve?
 *
 * `HashSet` solves the problem of maintaining an unsorted collection where each
 * value appears exactly once, with fast operations for checking membership and
 * adding/removing values.
 *
 * ## When to Use
 *
 * Use `HashSet` when you need:
 *
 * - A collection with no duplicate values
 * - Efficient membership testing (**`O(1)`** average complexity)
 * - Set operations like union, intersection, and difference
 * - An immutable data structure that preserves functional programming patterns
 *
 * ## Advanced Features
 *
 * HashSet provides operations for:
 *
 * - Transforming sets with map and flatMap
 * - Filtering elements with filter
 * - Combining sets with union, intersection and difference
 * - Performance optimizations via mutable operations in controlled contexts
 *
 * ## Performance Characteristics
 *
 * - **Lookup** operations ({@link module:HashSet.has}): **`O(1)`** average time
 *   complexity
 * - **Insertion** operations ({@link module:HashSet.add}): **`O(1)`** average time
 *   complexity
 * - **Removal** operations ({@link module:HashSet.remove}): **`O(1)`** average
 *   time complexity
 * - **Set** operations ({@link module:HashSet.union},
 *   {@link module:HashSet.intersection}): **`O(n)`** where n is the size of the
 *   smaller set
 * - **Iteration**: **`O(n)`** where n is the size of the set
 *
 * The HashSet data structure implements the following traits:
 *
 * - {@link Iterable}: allows iterating over the values in the set
 * - {@link Equal}: allows comparing two sets for value-based equality
 * - {@link Pipeable}: allows chaining operations with the pipe operator
 * - {@link Inspectable}: allows inspecting the contents of the set
 *
 * ## Operations Reference
 *
 * | Category     | Operation                           | Description                                 | Complexity |
 * | ------------ | ----------------------------------- | ------------------------------------------- | ---------- |
 * | constructors | {@link module:HashSet.empty}        | Creates an empty HashSet                    | O(1)       |
 * | constructors | {@link module:HashSet.fromIterable} | Creates a HashSet from an iterable          | O(n)       |
 * | constructors | {@link module:HashSet.make}         | Creates a HashSet from multiple values      | O(n)       |
 * |              |                                     |                                             |            |
 * | elements     | {@link module:HashSet.has}          | Checks if a value exists in the set         | O(1) avg   |
 * | elements     | {@link module:HashSet.some}         | Checks if any element satisfies a predicate | O(n)       |
 * | elements     | {@link module:HashSet.every}        | Checks if all elements satisfy a predicate  | O(n)       |
 * | elements     | {@link module:HashSet.isSubset}     | Checks if a set is a subset of another      | O(n)       |
 * |              |                                     |                                             |            |
 * | getters      | {@link module:HashSet.values}       | Gets an iterator of all values              | O(1)       |
 * | getters      | {@link module:HashSet.toValues}     | Gets an array of all values                 | O(n)       |
 * | getters      | {@link module:HashSet.size}         | Gets the number of elements                 | O(1)       |
 * |              |                                     |                                             |            |
 * | mutations    | {@link module:HashSet.add}          | Adds a value to the set                     | O(1) avg   |
 * | mutations    | {@link module:HashSet.remove}       | Removes a value from the set                | O(1) avg   |
 * | mutations    | {@link module:HashSet.toggle}       | Toggles a value's presence                  | O(1) avg   |
 * |              |                                     |                                             |            |
 * | operations   | {@link module:HashSet.difference}   | Computes set difference (A - B)             | O(n)       |
 * | operations   | {@link module:HashSet.intersection} | Computes set intersection (A ∩ B)           | O(n)       |
 * | operations   | {@link module:HashSet.union}        | Computes set union (A ∪ B)                  | O(n)       |
 * |              |                                     |                                             |            |
 * | mapping      | {@link module:HashSet.map}          | Transforms each element                     | O(n)       |
 * |              |                                     |                                             |            |
 * | sequencing   | {@link module:HashSet.flatMap}      | Transforms and flattens elements            | O(n)       |
 * |              |                                     |                                             |            |
 * | traversing   | {@link module:HashSet.forEach}      | Applies a function to each element          | O(n)       |
 * |              |                                     |                                             |            |
 * | folding      | {@link module:HashSet.reduce}       | Reduces the set to a single value           | O(n)       |
 * |              |                                     |                                             |            |
 * | filtering    | {@link module:HashSet.filter}       | Keeps elements that satisfy a predicate     | O(n)       |
 * |              |                                     |                                             |            |
 * | partitioning | {@link module:HashSet.partition}    | Splits into two sets by a predicate         | O(n)       |
 *
 * ## Notes
 *
 * ### Composability with the Effect Ecosystem:
 *
 * This `HashSet` is designed to work seamlessly within the Effect ecosystem. It
 * implements the {@link Iterable}, {@link Equal}, {@link Pipeable}, and
 * {@link Inspectable} traits from Effect. This ensures compatibility with other
 * Effect data structures and functionalities. For example, you can easily use
 * Effect's `pipe` method to chain operations on the `HashSet`.
 *
 * **Equality of Elements with Effect's {@link Equal `Equal`} Trait:**
 *
 * This `HashSet` relies on Effect's {@link Equal} trait to determine the
 * uniqueness of elements within the set. The way equality is checked depends on
 * the type of the elements:
 *
 * - **Primitive Values:** For primitive JavaScript values like strings, numbers,
 *   booleans, `null`, and `undefined`, equality is determined by their value
 *   (similar to the `===` operator).
 * - **Objects and Custom Types:** For objects and other custom types, equality is
 *   determined by whether those types implement the {@link Equal} interface
 *   themselves. If an element type implements `Equal`, the `HashSet` will
 *   delegate to that implementation to perform the equality check. This allows
 *   you to define custom logic for determining when two instances of your
 *   objects should be considered equal based on their properties, rather than
 *   just their object identity.
 *
 * ```ts
 * import { Equal, Hash, HashSet } from "effect"
 *
 * class Person implements Equal.Equal {
 *   constructor(
 *     readonly id: number, // Unique identifier
 *     readonly name: string,
 *     readonly age: number
 *   ) {}
 *
 *   // Define equality based on id, name, and age
 *   [Equal.symbol](that: Equal.Equal): boolean {
 *     if (that instanceof Person) {
 *       return (
 *         Equal.equals(this.id, that.id) &&
 *         Equal.equals(this.name, that.name) &&
 *         Equal.equals(this.age, that.age)
 *       )
 *     }
 *     return false
 *   }
 *
 *   // Generate a hash code based on the unique id
 *   [Hash.symbol](): number {
 *     return Hash.hash(this.id)
 *   }
 * }
 *
 * // Creating a HashSet with objects that implement the Equal interface
 * const set = HashSet.empty().pipe(
 *   HashSet.add(new Person(1, "Alice", 30)),
 *   HashSet.add(new Person(1, "Alice", 30))
 * )
 *
 * // HashSet recognizes them as equal, so only one element is stored
 * console.log(HashSet.size(set))
 * // Output: 1
 * ```
 *
 * **Simplifying Equality and Hashing with `Data` and `Schema`:**
 *
 * Effect's {@link Data} and {@link Schema `Schema.Data`} modules offer powerful
 * ways to automatically handle the implementation of both the {@link Equal} and
 * {@link Hash} traits for your custom data structures.
 *
 * - **`Data` Module:** By using constructors like `Data.struct`, `Data.tuple`,
 *   `Data.array`, or `Data.case` to define your data types, Effect
 *   automatically generates the necessary implementations for value-based
 *   equality and consistent hashing. This significantly reduces boilerplate and
 *   ensures correctness.
 *
 * ```ts
 * import { HashSet, Data, Equal } from "effect"
 * import assert from "node:assert/strict"
 *
 * // Data.* implements the `Equal` traits for us
 * const person1 = Data.struct({ id: 1, name: "Alice", age: 30 })
 * const person2 = Data.struct({ id: 1, name: "Alice", age: 30 })
 *
 * assert(Equal.equals(person1, person2))
 *
 * const set = HashSet.empty().pipe(
 *   HashSet.add(person1),
 *   HashSet.add(person2)
 * )
 *
 * // HashSet recognizes them as equal, so only one element is stored
 * console.log(HashSet.size(set)) // Output: 1
 * ```
 *
 * - **`Schema` Module:** When defining data schemas using the {@link Schema}
 *   module, you can use `Schema.Data` to automatically include the `Equal` and
 *   `Hash` traits in the decoded objects. This is particularly important when
 *   working with `HashSet`. **For decoded objects to be correctly recognized as
 *   equal within a `HashSet`, ensure that the schema for those objects is
 *   defined using `Schema.Data`.**
 *
 * ```ts
 * import { Equal, HashSet, Schema } from "effect"
 * import assert from "node:assert/strict"
 *
 * // Schema.Data implements the `Equal` traits for us
 * const PersonSchema = Schema.Data(
 *   Schema.Struct({
 *     id: Schema.Number,
 *     name: Schema.String,
 *     age: Schema.Number
 *   })
 * )
 *
 * const Person = Schema.decode(PersonSchema)
 *
 * const person1 = Person({ id: 1, name: "Alice", age: 30 })
 * const person2 = Person({ id: 1, name: "Alice", age: 30 })
 *
 * assert(Equal.equals(person1, person2)) // Output: true
 *
 * const set = HashSet.empty().pipe(
 *   HashSet.add(person1),
 *   HashSet.add(person2)
 * )
 *
 * // HashSet thanks to Schema.Data implementation of the `Equal` trait, recognizes the two Person as equal, so only one element is stored
 * console.log(HashSet.size(set)) // Output: 1
 * ```
 *
 * ### Interoperability with the JavaScript Runtime:
 *
 * To interoperate with the regular JavaScript runtime, Effect's `HashSet`
 * provides methods to access its elements in formats readily usable by
 * JavaScript APIs: {@link values `HashSet.values`},
 * {@link toValues `HashSet.toValues`}
 *
 * ```ts
 * import { HashSet } from "effect"
 *
 * const hashSet: HashSet.HashSet<number> = HashSet.make(1, 2, 3)
 *
 * // Using HashSet.values to convert HashSet.HashSet<A> to IterableIterator<A>
 * const iterable: IterableIterator<number> = HashSet.values(hashSet)
 *
 * console.log(...iterable) // Logs:  1 2 3
 *
 * // Using HashSet.toValues to convert HashSet.HashSet<A> to Array<A>
 * const array: Array<number> = HashSet.toValues(hashSet)
 *
 * console.log(array) // Logs: [ 1, 2, 3 ]
 * ```
 *
 * Be mindful of performance implications (both time and space complexity) when
 * frequently converting between Effect's immutable HashSet and mutable
 * JavaScript data structures, especially for large collections.
 *
 * @module HashSet
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides utility functions for working with Iterables in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 2.0.0
 */

/**
 * A `Layer<ROut, E, RIn>` describes how to build one or more services in your
 * application. Services can be injected into effects via
 * `Effect.provideService`. Effects can require services via `Effect.service`.
 *
 * Layer can be thought of as recipes for producing bundles of services, given
 * their dependencies (other services).
 *
 * Construction of services can be effectful and utilize resources that must be
 * acquired and safely released when the services are done being utilized.
 *
 * By default layers are shared, meaning that if the same layer is used twice
 * the layer will only be allocated a single time.
 *
 * Because of their excellent composition properties, layers are the idiomatic
 * way in Effect-TS to create services that depend on other services.
 *
 * @since 2.0.0
 */

/**
 * @since 3.14.0
 * @experimental
 */

/**
 * A data type for immutable linked lists representing ordered collections of elements of type `A`.
 *
 * This data type is optimal for last-in-first-out (LIFO), stack-like access patterns. If you need another access pattern, for example, random access or FIFO, consider using a collection more suited to this than `List`.
 *
 * **Performance**
 *
 * - Time: `List` has `O(1)` prepend and head/tail access. Most other operations are `O(n)` on the number of elements in the list. This includes the index-based lookup of elements, `length`, `append` and `reverse`.
 * - Space: `List` implements structural sharing of the tail list. This means that many operations are either zero- or constant-memory cost.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.8.0
 * @experimental
 */

/**
 * @since 2.0.0
 */

/**
 * The `effect/match` module provides a type-safe pattern matching system for
 * TypeScript. Inspired by functional programming, it simplifies conditional
 * logic by replacing verbose if/else or switch statements with a structured and
 * expressive API.
 *
 * This module supports matching against types, values, and discriminated unions
 * while enforcing exhaustiveness checking to ensure all cases are handled.
 *
 * Although pattern matching is not yet a native JavaScript feature,
 * `effect/match` offers a reliable implementation that is available today.
 *
 * **How Pattern Matching Works**
 *
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @since 1.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * A lightweight alternative to the `Effect` data type, with a subset of the functionality.
 *
 * @since 3.4.0
 * @experimental
 */

/**
 * @since 2.0.0
 *
 * Enables low level framework authors to run on their own isolated effect version
 */

/**
 * @since 2.0.0
 */

/**
 * # MutableHashSet
 *
 * A mutable `MutableHashSet` provides a collection of unique values with
 * efficient lookup, insertion and removal. Unlike its immutable sibling
 * {@link module:HashSet}, a `MutableHashSet` can be modified in-place;
 * operations like add, remove, and clear directly modify the original set
 * rather than creating a new one. This mutability offers benefits like improved
 * performance in scenarios where you need to build or modify a set
 * incrementally.
 *
 * ## What Problem Does It Solve?
 *
 * `MutableHashSet` solves the problem of maintaining an unsorted collection
 * where each value appears exactly once, with fast operations for checking
 * membership and adding/removing values, in contexts where mutability is
 * preferred for performance or implementation simplicity.
 *
 * ## When to Use
 *
 * Use `MutableHashSet` when you need:
 *
 * - A collection with no duplicate values
 * - Efficient membership testing (**`O(1)`** average complexity)
 * - In-place modifications for better performance
 * - A set that will be built or modified incrementally
 * - Local mutability in otherwise immutable code
 *
 * ## Advanced Features
 *
 * MutableHashSet provides operations for:
 *
 * - Adding and removing elements with direct mutation
 * - Checking for element existence
 * - Clearing all elements at once
 * - Converting to/from other collection types
 *
 * ## Performance Characteristics
 *
 * - **Lookup** operations ({@link module:MutableHashSet.has}): **`O(1)`** average
 *   time complexity
 * - **Insertion** operations ({@link module:MutableHashSet.add}): **`O(1)`**
 *   average time complexity
 * - **Removal** operations ({@link module:MutableHashSet.remove}): **`O(1)`**
 *   average time complexity
 * - **Iteration**: **`O(n)`** where n is the size of the set
 *
 * The MutableHashSet data structure implements the following traits:
 *
 * - {@link Iterable}: allows iterating over the values in the set
 * - {@link Pipeable}: allows chaining operations with the pipe operator
 * - {@link Inspectable}: allows inspecting the contents of the set
 *
 * ## Operations Reference
 *
 * | Category     | Operation                                  | Description                         | Complexity |
 * | ------------ | ------------------------------------------ | ----------------------------------- | ---------- |
 * | constructors | {@link module:MutableHashSet.empty}        | Creates an empty MutableHashSet     | O(1)       |
 * | constructors | {@link module:MutableHashSet.fromIterable} | Creates a set from an iterable      | O(n)       |
 * | constructors | {@link module:MutableHashSet.make}         | Creates a set from multiple values  | O(n)       |
 * |              |                                            |                                     |            |
 * | elements     | {@link module:MutableHashSet.has}          | Checks if a value exists in the set | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.add}          | Adds a value to the set             | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.remove}       | Removes a value from the set        | O(1) avg   |
 * | elements     | {@link module:MutableHashSet.size}         | Gets the number of elements         | O(1)       |
 * | elements     | {@link module:MutableHashSet.clear}        | Removes all values from the set     | O(1)       |
 *
 * ## Notes
 *
 * ### Mutability Considerations:
 *
 * Unlike most data structures in the Effect ecosystem, `MutableHashSet` is
 * mutable. This means that operations like `add`, `remove`, and `clear` modify
 * the original set rather than creating a new one. This can lead to more
 * efficient code in some scenarios, but requires careful handling to avoid
 * unexpected side effects.
 *
 * ### When to Choose `MutableHashSet` vs {@link module:HashSet}:
 *
 * - Use `MutableHashSet` when you need to build or modify a set incrementally and
 *   performance is a priority
 * - Use `HashSet` when you want immutability guarantees and functional
 *   programming patterns
 * - Consider using {@link module:HashSet}'s bounded mutation context (via
 *   {@link module:HashSet.beginMutation}, {@link module:HashSet.endMutation}, and
 *   {@link module:HashSet.mutate} methods) when you need temporary mutability
 *   within an otherwise immutable context - this approach might be sufficient
 *   for many use cases without requiring a separate `MutableHashSet`
 * - `MutableHashSet` is often useful for local operations where the mutability is
 *   contained and doesn't leak into the broader application
 *
 * @module MutableHashSet
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * # Number
 *
 * This module provides utility functions and type class instances for working
 * with the `number` type in TypeScript. It includes functions for basic
 * arithmetic operations, as well as type class instances for `Equivalence` and
 * `Order`.
 *
 * ## Operations Reference
 *
 * | Category     | Operation                                  | Description                                             | Domain                         | Co-domain             |
 * | ------------ | ------------------------------------------ | ------------------------------------------------------- | ------------------------------ | --------------------- |
 * | constructors | {@link module:Number.parse}                | Safely parses a string to a number                      | `string`                       | `Option<number>`      |
 * |              |                                            |                                                         |                                |                       |
 * | math         | {@link module:Number.sum}                  | Adds two numbers                                        | `number`, `number`             | `number`              |
 * | math         | {@link module:Number.sumAll}               | Sums all numbers in a collection                        | `Iterable<number>`             | `number`              |
 * | math         | {@link module:Number.subtract}             | Subtracts one number from another                       | `number`, `number`             | `number`              |
 * | math         | {@link module:Number.multiply}             | Multiplies two numbers                                  | `number`, `number`             | `number`              |
 * | math         | {@link module:Number.multiplyAll}          | Multiplies all numbers in a collection                  | `Iterable<number>`             | `number`              |
 * | math         | {@link module:Number.divide}               | Safely divides handling division by zero                | `number`, `number`             | `Option<number>`      |
 * | math         | {@link module:Number.unsafeDivide}         | Divides but misbehaves for division by zero             | `number`, `number`             | `number`              |
 * | math         | {@link module:Number.remainder}            | Calculates remainder of division                        | `number`, `number`             | `number`              |
 * | math         | {@link module:Number.increment}            | Adds 1 to a number                                      | `number`                       | `number`              |
 * | math         | {@link module:Number.decrement}            | Subtracts 1 from a number                               | `number`                       | `number`              |
 * | math         | {@link module:Number.sign}                 | Determines the sign of a number                         | `number`                       | `Ordering`            |
 * | math         | {@link module:Number.nextPow2}             | Finds the next power of 2                               | `number`                       | `number`              |
 * | math         | {@link module:Number.round}                | Rounds a number with specified precision                | `number`, `number`             | `number`              |
 * |              |                                            |                                                         |                                |                       |
 * | predicates   | {@link module:Number.between}              | Checks if a number is in a range                        | `number`, `{minimum, maximum}` | `boolean`             |
 * | predicates   | {@link module:Number.lessThan}             | Checks if one number is less than another               | `number`, `number`             | `boolean`             |
 * | predicates   | {@link module:Number.lessThanOrEqualTo}    | Checks if one number is less than or equal              | `number`, `number`             | `boolean`             |
 * | predicates   | {@link module:Number.greaterThan}          | Checks if one number is greater than another            | `number`, `number`             | `boolean`             |
 * | predicates   | {@link module:Number.greaterThanOrEqualTo} | Checks if one number is greater or equal                | `number`, `number`             | `boolean`             |
 * |              |                                            |                                                         |                                |                       |
 * | guards       | {@link module:Number.isNumber}             | Type guard for JavaScript numbers                       | `unknown`                      | `boolean`             |
 * |              |                                            |                                                         |                                |                       |
 * | comparison   | {@link module:Number.min}                  | Returns the minimum of two numbers                      | `number`, `number`             | `number`              |
 * | comparison   | {@link module:Number.max}                  | Returns the maximum of two numbers                      | `number`, `number`             | `number`              |
 * | comparison   | {@link module:Number.clamp}                | Restricts a number to a range                           | `number`, `{minimum, maximum}` | `number`              |
 * |              |                                            |                                                         |                                |                       |
 * | instances    | {@link module:Number.Equivalence}          | Equivalence instance for numbers                        |                                | `Equivalence<number>` |
 * | instances    | {@link module:Number.Order}                | Order instance for numbers                              |                                | `Order<number>`       |
 * |              |                                            |                                                         |                                |                       |
 * | errors       | {@link module:Number.DivisionByZeroError}  | Error thrown by unsafeDivide                            |                                |                       |
 *
 * ## Composition Patterns and Type Safety
 *
 * When building function pipelines, understanding how types flow through
 * operations is critical:
 *
 * ### Composing with type-preserving operations
 *
 * Most operations in this module are type-preserving (`number → number`),
 * making them easily composable in pipelines:
 *
 * ```ts
 * import { pipe } from "effect"
 * import * as Number from "effect/Number"
 *
 * const result = pipe(
 *   10,
 *   Number.increment, // number → number
 *   Number.multiply(2), // number → number
 *   Number.round(1) // number → number
 * ) // Result: number (21)
 * ```
 *
 * ### Working with Option results
 *
 * Operations that might fail (like division by zero) return Option types and
 * require Option combinators:
 *
 * ```ts
 * import { pipe, Option } from "effect"
 * import * as Number from "effect/Number"
 *
 * const result = pipe(
 *   10,
 *   Number.divide(0), // number → Option<number>
 *   Option.getOrElse(() => 0) // Option<number> → number
 * ) // Result: number (0)
 * ```
 *
 * ### Composition best practices
 *
 * - Chain type-preserving operations for maximum composability
 * - Use Option combinators when working with potentially failing operations
 * - Consider using Effect for operations that might fail with specific errors
 * - Remember that all operations maintain JavaScript's floating-point precision
 *   limitations
 *
 * @module Number
 * @since 2.0.0
 * @see {@link module:BigInt} for more similar operations on `bigint` types
 * @see {@link module:BigDecimal} for more similar operations on `BigDecimal` types
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides an implementation of the `Order` type class which is used to define a total ordering on some type `A`.
 * An order is defined by a relation `<=`, which obeys the following laws:
 *
 * - either `x <= y` or `y <= x` (totality)
 * - if `x <= y` and `y <= x`, then `x == y` (antisymmetry)
 * - if `x <= y` and `y <= z`, then `x <= z` (transitivity)
 *
 * The truth table for compare is defined as follows:
 *
 * | `x <= y` | `x >= y` | Ordering |                       |
 * | -------- | -------- | -------- | --------------------- |
 * | `true`   | `true`   | `0`      | corresponds to x == y |
 * | `true`   | `false`  | `< 0`    | corresponds to x < y  |
 * | `false`  | `true`   | `> 0`    | corresponds to x > y  |
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 3.19.4
 * @experimental
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides a collection of functions for working with predicates and refinements.
 *
 * A `Predicate<A>` is a function that takes a value of type `A` and returns a boolean.
 * It is used to check if a value satisfies a certain condition.
 *
 * A `Refinement<A, B>` is a special type of predicate that not only checks a condition
 * but also provides a type guard, allowing TypeScript to narrow the type of the input
 * value from `A` to a more specific type `B` within a conditional block.
 *
 * The module includes:
 * - Basic predicates and refinements for common types (e.g., `isString`, `isNumber`).
 * - Combinators to create new predicates from existing ones (e.g., `and`, `or`, `not`).
 * - Advanced combinators for working with data structures (e.g., `tuple`, `struct`).
 * - Type-level utilities for inspecting predicate and refinement types.
 *
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * Limits the number of calls to a resource to a maximum amount in some interval.
 *
 * @since 2.0.0
 */

/**
 * @since 3.5.0
 */

/**
 * @since 3.5.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides utility functions for working with records in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * The Redacted module provides functionality for handling sensitive information
 * securely within your application. By using the `Redacted` data type, you can
 * ensure that sensitive values are not accidentally exposed in logs or error
 * messages.
 *
 * @since 3.3.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides utility functions for working with RegExp in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 * @deprecated
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * This module provides utility functions and type class instances for working with the `string` type in TypeScript.
 * It includes functions for basic string manipulation, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */

/**
 * This module provides utility functions for working with structs in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * A `Supervisor<T>` is allowed to supervise the launching and termination of
 * fibers, producing some visible value of type `T` from the supervision.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 3.10.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * A `Trie` is used for locating specific `string` keys from within a set.
 *
 * It works similar to `HashMap`, but with keys required to be `string`.
 * This constraint unlocks some performance optimizations and new methods to get string prefixes (e.g. `keysWithPrefix`, `longestPrefixOf`).
 *
 * Prefix search is also the main feature that makes a `Trie` more suited than `HashMap` for certain usecases.
 *
 * A `Trie` is often used to store a dictionary (list of words) that can be searched
 * in a manner that allows for efficient generation of completion lists
 * (e.g. predict the rest of a word a user is typing).
 *
 * A `Trie` has O(n) lookup time where `n` is the size of the key,
 * or even less than `n` on search misses.
 *
 * @since 2.0.0
 */

/**
 * This module provides utility functions for working with tuples in TypeScript.
 *
 * @since 2.0.0
 */

/**
 * A collection of types that are commonly used types.
 *
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

/**
 * @since 2.0.0
 */

//# sourceMappingURL=index.js.map

},
71391(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  D6: () => (isPool),
  Jq: () => (makeWithTTL),
  Jt: () => (get),
  L8: () => (make),
  Y1: () => (invalidate),
  cy: () => (PoolTypeId)
});
/* import */ var _Context_js__rspack_import_2 = __webpack_require__(50256);
/* import */ var _Duration_js__rspack_import_13 = __webpack_require__(72895);
/* import */ var _Effectable_js__rspack_import_5 = __webpack_require__(42650);
/* import */ var _Function_js__rspack_import_4 = __webpack_require__(61279);
/* import */ var _Iterable_js__rspack_import_8 = __webpack_require__(11869);
/* import */ var _Option_js__rspack_import_7 = __webpack_require__(31706);
/* import */ var _Pipeable_js__rspack_import_9 = __webpack_require__(79083);
/* import */ var _Predicate_js__rspack_import_0 = __webpack_require__(35034);
/* import */ var _core_effect_js__rspack_import_10 = __webpack_require__(13682);
/* import */ var _core_js__rspack_import_1 = __webpack_require__(55294);
/* import */ var _defaultServices_js__rspack_import_11 = __webpack_require__(16208);
/* import */ var _effect_circular_js__rspack_import_6 = __webpack_require__(64262);
/* import */ var _fiberRuntime_js__rspack_import_3 = __webpack_require__(55845);
/* import */ var _queue_js__rspack_import_12 = __webpack_require__(22630);














/** @internal */
const PoolTypeId = /*#__PURE__*/Symbol.for("effect/Pool");
const poolVariance = {
  /* c8 ignore next */
  _E: _ => _,
  /* c8 ignore next */
  _A: _ => _
};
/** @internal */
const isPool = u => (0,_Predicate_js__rspack_import_0.hasProperty)(u, PoolTypeId);
/** @internal */
const makeWith = options => _core_js__rspack_import_1/* .uninterruptibleMask */.FcF(restore => _core_js__rspack_import_1/* .flatMap */.qIB(_core_js__rspack_import_1/* .context */._OA(), context => {
  const scope = _Context_js__rspack_import_2.get(context, _fiberRuntime_js__rspack_import_3/* .scopeTag */.DL);
  const acquire = _core_js__rspack_import_1/* .mapInputContext */.kyh(options.acquire, input => _Context_js__rspack_import_2.merge(context, input));
  const pool = new PoolImpl(scope, acquire, options.concurrency ?? 1, options.min, options.max, options.strategy, Math.min(Math.max(options.targetUtilization ?? 1, 0.1), 1));
  const initialize = _core_js__rspack_import_1/* .tap */.Mim(_fiberRuntime_js__rspack_import_3/* .forkDaemon */.LX(restore(pool.resize)), fiber => scope.addFinalizer(() => _core_js__rspack_import_1/* .interruptFiber */.OLv(fiber)));
  const runStrategy = _core_js__rspack_import_1/* .tap */.Mim(_fiberRuntime_js__rspack_import_3/* .forkDaemon */.LX(restore(options.strategy.run(pool))), fiber => scope.addFinalizer(() => _core_js__rspack_import_1/* .interruptFiber */.OLv(fiber)));
  return _core_js__rspack_import_1/* .succeed */.PyW(pool).pipe(_core_js__rspack_import_1/* .zipLeft */.piH(scope.addFinalizer(() => pool.shutdown)), _core_js__rspack_import_1/* .zipLeft */.piH(initialize), _core_js__rspack_import_1/* .zipLeft */.piH(runStrategy));
}));
/** @internal */
const make = options => makeWith({
  ...options,
  min: options.size,
  max: options.size,
  strategy: strategyNoop()
});
/** @internal */
const makeWithTTL = options => _core_js__rspack_import_1/* .flatMap */.qIB(options.timeToLiveStrategy === "creation" ? strategyCreationTTL(options.timeToLive) : strategyUsageTTL(options.timeToLive), strategy => makeWith({
  ...options,
  strategy
}));
/** @internal */
const get = self => self.get;
/** @internal */
const invalidate = /*#__PURE__*/(0,_Function_js__rspack_import_4.dual)(2, (self, item) => self.invalidate(item));
class PoolImpl extends _Effectable_js__rspack_import_5.Class {
  scope;
  acquire;
  concurrency;
  minSize;
  maxSize;
  strategy;
  targetUtilization;
  [PoolTypeId];
  isShuttingDown = false;
  semaphore;
  items = /*#__PURE__*/new Set();
  available = /*#__PURE__*/new Set();
  availableLatch = /*#__PURE__*/_effect_circular_js__rspack_import_6/* .unsafeMakeLatch */.d_(false);
  invalidated = /*#__PURE__*/new Set();
  waiters = 0;
  constructor(scope, acquire, concurrency, minSize, maxSize, strategy, targetUtilization) {
    super();
    this.scope = scope;
    this.acquire = acquire;
    this.concurrency = concurrency;
    this.minSize = minSize;
    this.maxSize = maxSize;
    this.strategy = strategy;
    this.targetUtilization = targetUtilization;
    this[PoolTypeId] = poolVariance;
    this.semaphore = _effect_circular_js__rspack_import_6/* .unsafeMakeSemaphore */.RI(concurrency * maxSize);
  }
  allocate = /*#__PURE__*/_core_js__rspack_import_1/* .acquireUseRelease */.jGc(/*#__PURE__*/_fiberRuntime_js__rspack_import_3/* .scopeMake */.RW(), scope => this.acquire.pipe(_fiberRuntime_js__rspack_import_3/* .scopeExtend */.v_(scope), _core_js__rspack_import_1/* .exit */.NS5, _core_js__rspack_import_1/* .flatMap */.qIB(exit => {
    const item = {
      exit,
      finalizer: _core_js__rspack_import_1/* .catchAllCause */.uPo(scope.close(exit), reportUnhandledError),
      refCount: 0,
      disableReclaim: false
    };
    this.items.add(item);
    this.available.add(item);
    return _core_js__rspack_import_1.as(exit._tag === "Success" ? this.strategy.onAcquire(item) : _core_js__rspack_import_1/* .zipRight */.aNH(item.finalizer, this.strategy.onAcquire(item)), item);
  })), (scope, exit) => exit._tag === "Failure" ? scope.close(exit) : _core_js__rspack_import_1/* ["void"] */.rIH);
  get currentUsage() {
    let count = this.waiters;
    for (const item of this.items) {
      count += item.refCount;
    }
    return count;
  }
  get targetSize() {
    if (this.isShuttingDown) return 0;
    const utilization = this.currentUsage / this.targetUtilization;
    const target = Math.ceil(utilization / this.concurrency);
    return Math.min(Math.max(this.minSize, target), this.maxSize);
  }
  get activeSize() {
    return this.items.size - this.invalidated.size;
  }
  resizeLoop = /*#__PURE__*/_core_js__rspack_import_1/* .suspend */.DYE(() => {
    if (this.activeSize >= this.targetSize) {
      return _core_js__rspack_import_1/* ["void"] */.rIH;
    }
    const toAcquire = this.targetSize - this.activeSize;
    return this.strategy.reclaim(this).pipe(_core_js__rspack_import_1/* .flatMap */.qIB(_Option_js__rspack_import_7.match({
      onNone: () => this.allocate,
      onSome: _core_js__rspack_import_1/* .succeed */.PyW
    })), _fiberRuntime_js__rspack_import_3/* .replicateEffect */.Xr(toAcquire, {
      concurrency: toAcquire
    }), _core_js__rspack_import_1/* .zipLeft */.piH(this.availableLatch.open), _core_js__rspack_import_1/* .flatMap */.qIB(items => items.some(_ => _.exit._tag === "Failure") ? _core_js__rspack_import_1/* ["void"] */.rIH : this.resizeLoop));
  });
  resizeSemaphore = /*#__PURE__*/_effect_circular_js__rspack_import_6/* .unsafeMakeSemaphore */.RI(1);
  resize = /*#__PURE__*/this.resizeSemaphore.withPermits(1)(this.resizeLoop);
  getPoolItem = /*#__PURE__*/_core_js__rspack_import_1/* .uninterruptibleMask */.FcF(restore => restore(this.semaphore.take(1)).pipe(_core_js__rspack_import_1/* .zipRight */.aNH(_fiberRuntime_js__rspack_import_3/* .scopeTag */.DL), _core_js__rspack_import_1/* .flatMap */.qIB(scope => _core_js__rspack_import_1/* .suspend */.DYE(() => {
    this.waiters++;
    if (this.isShuttingDown) {
      return _core_js__rspack_import_1/* .interrupt */.GaK;
    } else if (this.targetSize > this.activeSize) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      return _core_js__rspack_import_1/* .flatMap */.qIB(this.resizeSemaphore.withPermitsIfAvailable(1)(_effect_circular_js__rspack_import_6/* .forkIn */.ar(_core_js__rspack_import_1/* .interruptible */.Inz(this.resize), this.scope)), function loop() {
        if (self.isShuttingDown) {
          return _core_js__rspack_import_1/* .interrupt */.GaK;
        } else if (self.available.size > 0) {
          return _core_js__rspack_import_1/* .succeed */.PyW(_Iterable_js__rspack_import_8.unsafeHead(self.available));
        }
        self.availableLatch.unsafeClose();
        return _core_js__rspack_import_1/* .flatMap */.qIB(self.availableLatch.await, loop);
      });
    }
    return _core_js__rspack_import_1/* .succeed */.PyW(_Iterable_js__rspack_import_8.unsafeHead(this.available));
  }).pipe(_fiberRuntime_js__rspack_import_3/* .ensuring */.ye(_core_js__rspack_import_1/* .sync */.OH5(() => this.waiters--)), _core_js__rspack_import_1/* .tap */.Mim(item => {
    if (item.exit._tag === "Failure") {
      this.items.delete(item);
      this.invalidated.delete(item);
      this.available.delete(item);
      return this.semaphore.release(1);
    }
    item.refCount++;
    this.available.delete(item);
    if (item.refCount < this.concurrency) {
      this.available.add(item);
    }
    return scope.addFinalizer(() => _core_js__rspack_import_1/* .zipRight */.aNH(_core_js__rspack_import_1/* .suspend */.DYE(() => {
      item.refCount--;
      if (this.invalidated.has(item)) {
        return this.invalidatePoolItem(item);
      }
      this.available.add(item);
      return _core_js__rspack_import_1/* .exitVoid */.x5l;
    }), this.semaphore.release(1)));
  }), _core_js__rspack_import_1/* .onInterrupt */.nAr(() => this.semaphore.release(1))))));
  commit() {
    return this.get;
  }
  get = /*#__PURE__*/_core_js__rspack_import_1/* .flatMap */.qIB(/*#__PURE__*/_core_js__rspack_import_1/* .suspend */.DYE(() => this.isShuttingDown ? _core_js__rspack_import_1/* .interrupt */.GaK : this.getPoolItem), _ => _.exit);
  invalidate(item) {
    return _core_js__rspack_import_1/* .suspend */.DYE(() => {
      if (this.isShuttingDown) return _core_js__rspack_import_1/* ["void"] */.rIH;
      for (const poolItem of this.items) {
        if (poolItem.exit._tag === "Success" && poolItem.exit.value === item) {
          poolItem.disableReclaim = true;
          return _core_js__rspack_import_1/* .uninterruptible */.rfi(this.invalidatePoolItem(poolItem));
        }
      }
      return _core_js__rspack_import_1/* ["void"] */.rIH;
    });
  }
  invalidatePoolItem(poolItem) {
    return _core_js__rspack_import_1/* .suspend */.DYE(() => {
      if (!this.items.has(poolItem)) {
        return _core_js__rspack_import_1/* ["void"] */.rIH;
      } else if (poolItem.refCount === 0) {
        this.items.delete(poolItem);
        this.available.delete(poolItem);
        this.invalidated.delete(poolItem);
        return _core_js__rspack_import_1/* .zipRight */.aNH(poolItem.finalizer, _effect_circular_js__rspack_import_6/* .forkIn */.ar(_core_js__rspack_import_1/* .interruptible */.Inz(this.resize), this.scope));
      }
      this.invalidated.add(poolItem);
      this.available.delete(poolItem);
      return _core_js__rspack_import_1/* ["void"] */.rIH;
    });
  }
  get shutdown() {
    return _core_js__rspack_import_1/* .suspend */.DYE(() => {
      if (this.isShuttingDown) return _core_js__rspack_import_1/* ["void"] */.rIH;
      this.isShuttingDown = true;
      const size = this.items.size;
      const semaphore = _effect_circular_js__rspack_import_6/* .unsafeMakeSemaphore */.RI(size);
      return _core_js__rspack_import_1/* .forEachSequentialDiscard */.QZV(this.items, item => {
        if (item.refCount > 0) {
          item.finalizer = _core_js__rspack_import_1/* .zipLeft */.piH(item.finalizer, semaphore.release(1));
          this.invalidated.add(item);
          return semaphore.take(1);
        }
        this.items.delete(item);
        this.available.delete(item);
        this.invalidated.delete(item);
        return item.finalizer;
      }).pipe(_core_js__rspack_import_1/* .zipRight */.aNH(this.semaphore.releaseAll), _core_js__rspack_import_1/* .zipRight */.aNH(this.availableLatch.open), _core_js__rspack_import_1/* .zipRight */.aNH(semaphore.take(size)));
    });
  }
  pipe() {
    return (0,_Pipeable_js__rspack_import_9.pipeArguments)(this, arguments);
  }
}
const strategyNoop = () => ({
  run: _ => _core_js__rspack_import_1/* ["void"] */.rIH,
  onAcquire: _ => _core_js__rspack_import_1/* ["void"] */.rIH,
  reclaim: _ => _core_effect_js__rspack_import_10/* .succeedNone */.lw
});
const strategyCreationTTL = ttl => _defaultServices_js__rspack_import_11/* .clockWith */.RK(clock => _core_js__rspack_import_1/* .map */.TjK(_queue_js__rspack_import_12/* .unbounded */.dT(), queue => {
  const ttlMillis = _Duration_js__rspack_import_13.toMillis(ttl);
  const creationTimes = new WeakMap();
  return (0,_Function_js__rspack_import_4.identity)({
    run: pool => {
      const process = item => _core_js__rspack_import_1/* .suspend */.DYE(() => {
        if (!pool.items.has(item) || pool.invalidated.has(item)) {
          return _core_js__rspack_import_1/* ["void"] */.rIH;
        }
        const now = clock.unsafeCurrentTimeMillis();
        const created = creationTimes.get(item);
        const remaining = ttlMillis - (now - created);
        return remaining > 0 ? _core_effect_js__rspack_import_10/* .delay */.cb(process(item), remaining) : pool.invalidatePoolItem(item);
      });
      return queue.take.pipe(_core_js__rspack_import_1/* .tap */.Mim(process), _core_effect_js__rspack_import_10/* .forever */.i4);
    },
    onAcquire: item => _core_js__rspack_import_1/* .suspend */.DYE(() => {
      creationTimes.set(item, clock.unsafeCurrentTimeMillis());
      return queue.offer(item);
    }),
    reclaim: _ => _core_effect_js__rspack_import_10/* .succeedNone */.lw
  });
}));
const strategyUsageTTL = ttl => _core_js__rspack_import_1/* .map */.TjK(_queue_js__rspack_import_12/* .unbounded */.dT(), queue => {
  return (0,_Function_js__rspack_import_4.identity)({
    run: pool => {
      const process = _core_js__rspack_import_1/* .suspend */.DYE(() => {
        const excess = pool.activeSize - pool.targetSize;
        if (excess <= 0) return _core_js__rspack_import_1/* ["void"] */.rIH;
        return queue.take.pipe(_core_js__rspack_import_1/* .tap */.Mim(item => pool.invalidatePoolItem(item)), _core_js__rspack_import_1/* .zipRight */.aNH(process));
      });
      return process.pipe(_core_effect_js__rspack_import_10/* .delay */.cb(ttl), _core_effect_js__rspack_import_10/* .forever */.i4);
    },
    onAcquire: item => queue.offer(item),
    reclaim(pool) {
      return _core_js__rspack_import_1/* .suspend */.DYE(() => {
        if (pool.invalidated.size === 0) {
          return _core_effect_js__rspack_import_10/* .succeedNone */.lw;
        }
        const item = _Iterable_js__rspack_import_8.head(_Iterable_js__rspack_import_8.filter(pool.invalidated, item => !item.disableReclaim));
        if (item._tag === "None") {
          return _core_effect_js__rspack_import_10/* .succeedNone */.lw;
        }
        pool.invalidated.delete(item.value);
        if (item.value.refCount < pool.concurrency) {
          pool.available.add(item.value);
        }
        return _core_js__rspack_import_1.as(queue.offer(item.value), item);
      });
    }
  });
});
const reportUnhandledError = cause => _core_js__rspack_import_1/* .withFiberRuntime */.$we(fiber => {
  const unhandledLogLevel = fiber.getFiberRef(_core_js__rspack_import_1/* .currentUnhandledErrorLogLevel */.bRS);
  if (unhandledLogLevel._tag === "Some") {
    fiber.log("Unhandled error in pool finalizer", cause, unhandledLogLevel);
  }
  return _core_js__rspack_import_1/* ["void"] */.rIH;
});
//# sourceMappingURL=pool.js.map

},

};
