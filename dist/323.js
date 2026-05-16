export const __rspack_esm_id = 323;
export const __rspack_esm_ids = [323];
export const __webpack_modules__ = {
34990(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  OidcTokenError: () => (OidcTokenError),
  OidcTokenIssuer: () => (OidcTokenIssuer),
  OidcTokenIssuerLive: () => (OidcTokenIssuerLive),
  saveToken: () => (saveToken)
});
/* import */ var _effect_platform__rspack_import_5 = __webpack_require__(46192);
/* import */ var _effect_platform__rspack_import_6 = __webpack_require__(29075);
/* import */ var _effect_platform__rspack_import_7 = __webpack_require__(1116);
/* import */ var _effect_platform__rspack_import_9 = __webpack_require__(7096);
/* import */ var effect__rspack_import_0 = __webpack_require__(65279);
/* import */ var effect__rspack_import_1 = __webpack_require__(9064);
/* import */ var effect__rspack_import_2 = __webpack_require__(50256);
/* import */ var effect__rspack_import_3 = __webpack_require__(46330);
/* import */ var effect__rspack_import_4 = __webpack_require__(78518);
/* import */ var effect__rspack_import_8 = __webpack_require__(66707);
/**
 * OIDC token issuer for GitHub Actions.
 *
 * @remarks
 * Fetches an OIDC ID token from the GitHub Actions token service. The
 * runner exposes two environment variables when a workflow has the
 * `id-token: write` permission:
 *
 * - `ACTIONS_ID_TOKEN_REQUEST_TOKEN` — bearer token authorizing the request
 * - `ACTIONS_ID_TOKEN_REQUEST_URL`   — token issuance endpoint
 *
 * Callers pass an audience (e.g. `"sigstore"` for Fulcio cert issuance) and
 * receive a {@link Redacted} JWT. The redacted wrapper keeps the JWT out of
 * default `toString` / log paths; the value is unwrapped only at the point
 * where it crosses the wire to Fulcio or Rekor.
 *
 * The implementation depends on {@link HttpClient.HttpClient} so the service
 * composes with `FetchHttpClient.layer` in production and an in-memory mock
 * layer in tests — no `node:fetch` import means no undici in the bundle.
 */ 

/**
 * Errors raised by {@link OidcTokenIssuer}.
 *
 * @remarks
 * The `reason` discriminator mirrors {@link AttestError} so callers can
 * pattern-match across the full attestation pipeline.
 *
 * - `"env"`     — required `ACTIONS_ID_TOKEN_REQUEST_*` env var missing
 * - `"http"`    — non-2xx response or transport error from the token service
 * - `"decode"`  — token service returned a payload without a `value` field
 * - `"save"`    — failure writing the redacted token to disk
 */ class OidcTokenError extends effect__rspack_import_0.TaggedError("OidcTokenError") {
}
/**
 * Response shape from the GitHub Actions OIDC token service.
 *
 * @internal
 */ const OidcTokenResponse = effect__rspack_import_1.Struct({
    value: effect__rspack_import_1.String,
    count: effect__rspack_import_1.optional(effect__rspack_import_1.Number)
});
/**
 * OIDC token issuer service surface.
 *
 * @public
 */ class OidcTokenIssuer extends effect__rspack_import_2.Tag("github-action-effects/OidcTokenIssuer")() {
}
const ACTIONS_ID_TOKEN_REQUEST_TOKEN = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";
const ACTIONS_ID_TOKEN_REQUEST_URL = "ACTIONS_ID_TOKEN_REQUEST_URL";
const readEnv = (name)=>effect__rspack_import_3.sync(()=>process.env[name]).pipe(effect__rspack_import_3.flatMap((value)=>value && value.length > 0 ? effect__rspack_import_3.succeed(value) : effect__rspack_import_3.fail(new OidcTokenError({
            reason: "env",
            message: `Missing required environment variable ${name}. The workflow needs \`permissions: id-token: write\` for OIDC token issuance.`
        }))));
/**
 * Live {@link OidcTokenIssuer} layer. Requires {@link HttpClient.HttpClient}.
 *
 * @public
 */ const OidcTokenIssuerLive = effect__rspack_import_4.effect(OidcTokenIssuer, effect__rspack_import_3.gen(function*() {
    const http = yield* _effect_platform__rspack_import_5.HttpClient;
    return {
        getToken: (audience)=>effect__rspack_import_3.gen(function*() {
                const bearer = yield* readEnv(ACTIONS_ID_TOKEN_REQUEST_TOKEN);
                const baseUrl = yield* readEnv(ACTIONS_ID_TOKEN_REQUEST_URL);
                const url = new URL(baseUrl);
                url.searchParams.set("audience", audience);
                const request = _effect_platform__rspack_import_6.get(url.toString()).pipe(_effect_platform__rspack_import_6.bearerToken(bearer), _effect_platform__rspack_import_6.acceptJson);
                const response = yield* http.execute(request).pipe(effect__rspack_import_3.mapError((cause)=>new OidcTokenError({
                        reason: "http",
                        message: `OIDC token request failed: ${cause.message}`,
                        cause
                    })));
                if (response.status < 200 || response.status >= 300) {
                    const body = yield* response.text.pipe(effect__rspack_import_3.orElseSucceed(()=>"<unreadable body>"));
                    return yield* effect__rspack_import_3.fail(new OidcTokenError({
                        reason: "http",
                        message: `OIDC token request returned ${response.status}: ${body.slice(0, 200)}`
                    }));
                }
                const parsed = yield* _effect_platform__rspack_import_7.schemaBodyJson(OidcTokenResponse)(response).pipe(effect__rspack_import_3.mapError((cause)=>new OidcTokenError({
                        reason: "decode",
                        message: `OIDC token response did not match the expected shape: ${cause}`,
                        cause
                    })));
                return effect__rspack_import_8.make(parsed.value);
            })
    };
}));
/**
 * Save the redacted OIDC token to disk for local inspection.
 *
 * @remarks
 * Convenience helper used during development to dump the JWT payload so
 * you can decode it (e.g. with `jwt.io`) and inspect the claims. The
 * redacted wrapper is unwrapped at the call site so the value lands on
 * disk as plain text — only use this against a tmpdir.
 *
 * @public
 */ const saveToken = (token, path)=>effect__rspack_import_3.gen(function*() {
        const fs = yield* _effect_platform__rspack_import_9.FileSystem;
        const payload = JSON.stringify({
            token: effect__rspack_import_8.value(token)
        }, null, 2);
        yield* fs.writeFileString(path, payload).pipe(effect__rspack_import_3.mapError((error)=>new OidcTokenError({
                reason: "save",
                message: `Failed to write OIDC token to ${path}: ${error.message}`,
                cause: error
            })));
    });


},
63744(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  CookieTypeId: () => (CookieTypeId),
  CookiesError: () => (CookiesError),
  ErrorTypeId: () => (ErrorTypeId),
  TypeId: () => (TypeId),
  empty: () => (empty),
  fromIterable: () => (fromIterable),
  fromReadonlyRecord: () => (fromReadonlyRecord),
  fromSetCookie: () => (fromSetCookie),
  get: () => (get),
  getValue: () => (getValue),
  isCookies: () => (isCookies),
  isEmpty: () => (isEmpty),
  makeCookie: () => (makeCookie),
  merge: () => (merge),
  parseHeader: () => (parseHeader),
  remove: () => (remove),
  serializeCookie: () => (serializeCookie),
  set: () => (set),
  setAll: () => (setAll),
  setAllCookie: () => (setAllCookie),
  setCookie: () => (setCookie),
  toCookieHeader: () => (toCookieHeader),
  toRecord: () => (toRecord),
  toSetCookieHeaders: () => (toSetCookieHeaders),
  unsafeMakeCookie: () => (unsafeMakeCookie),
  unsafeSet: () => (unsafeSet),
  unsafeSetAll: () => (unsafeSetAll)
});
/* import */ var effect_Duration__rspack_import_6 = __webpack_require__(72895);
/* import */ var effect_Either__rspack_import_7 = __webpack_require__(53266);
/* import */ var effect_Function__rspack_import_8 = __webpack_require__(61279);
/* import */ var effect_Inspectable__rspack_import_2 = __webpack_require__(65051);
/* import */ var effect_Option__rspack_import_5 = __webpack_require__(31706);
/* import */ var effect_Pipeable__rspack_import_4 = __webpack_require__(79083);
/* import */ var effect_Predicate__rspack_import_0 = __webpack_require__(35034);
/* import */ var effect_Record__rspack_import_3 = __webpack_require__(13878);
/* import */ var _Error_js__rspack_import_1 = __webpack_require__(63797);
/**
 * @since 1.0.0
 */









/**
 * @since 1.0.0
 * @category type ids
 */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/Cookies");
/**
 * @since 1.0.0
 * @category refinements
 */
const isCookies = u => effect_Predicate__rspack_import_0.hasProperty(u, TypeId);
/**
 * @since 1.0.0
 * @category type ids
 */
const CookieTypeId = /*#__PURE__*/Symbol.for("@effect/platform/Cookies/Cookie");
/**
 * @since 1.0.0
 * @category type ids
 */
const ErrorTypeId = /*#__PURE__*/Symbol.for("@effect/platform/Cookies/CookieError");
/**
 * @since 1.0.0
 * @category errors
 */
class CookiesError extends /*#__PURE__*/(0,_Error_js__rspack_import_1.TypeIdError)(ErrorTypeId, "CookieError") {
  get message() {
    return this.reason;
  }
}
const Proto = {
  [TypeId]: TypeId,
  ...effect_Inspectable__rspack_import_2.BaseProto,
  toJSON() {
    return {
      _id: "@effect/platform/Cookies",
      cookies: effect_Record__rspack_import_3.map(this.cookies, cookie => cookie.toJSON())
    };
  },
  pipe() {
    return (0,effect_Pipeable__rspack_import_4.pipeArguments)(this, arguments);
  }
};
/**
 * Create a Cookies object from an Iterable
 *
 * @since 1.0.0
 * @category constructors
 */
const fromReadonlyRecord = cookies => {
  const self = Object.create(Proto);
  self.cookies = cookies;
  return self;
};
/**
 * Create a Cookies object from an Iterable
 *
 * @since 1.0.0
 * @category constructors
 */
const fromIterable = cookies => {
  const record = {};
  for (const cookie of cookies) {
    record[cookie.name] = cookie;
  }
  return fromReadonlyRecord(record);
};
/**
 * Create a Cookies object from a set of Set-Cookie headers
 *
 * @since 1.0.0
 * @category constructors
 */
const fromSetCookie = headers => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers;
  const cookies = [];
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim());
    if (effect_Option__rspack_import_5.isSome(cookie)) {
      cookies.push(cookie.value);
    }
  }
  return fromIterable(cookies);
};
function parseSetCookie(header) {
  const parts = header.split(";").map(_ => _.trim()).filter(_ => _ !== "");
  if (parts.length === 0) {
    return effect_Option__rspack_import_5.none();
  }
  const firstEqual = parts[0].indexOf("=");
  if (firstEqual === -1) {
    return effect_Option__rspack_import_5.none();
  }
  const name = parts[0].slice(0, firstEqual);
  if (!fieldContentRegExp.test(name)) {
    return effect_Option__rspack_import_5.none();
  }
  const valueEncoded = parts[0].slice(firstEqual + 1);
  const value = tryDecodeURIComponent(valueEncoded);
  if (parts.length === 1) {
    return effect_Option__rspack_import_5.some(Object.assign(Object.create(CookieProto), {
      name,
      value,
      valueEncoded
    }));
  }
  const options = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const equalIndex = part.indexOf("=");
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim();
    const value = equalIndex === -1 ? undefined : part.slice(equalIndex + 1).trim();
    switch (key.toLowerCase()) {
      case "domain":
        {
          if (value === undefined) {
            break;
          }
          const domain = value.trim().replace(/^\./, "");
          if (domain) {
            options.domain = domain;
          }
          break;
        }
      case "expires":
        {
          if (value === undefined) {
            break;
          }
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            options.expires = date;
          }
          break;
        }
      case "max-age":
        {
          if (value === undefined) {
            break;
          }
          const maxAge = parseInt(value, 10);
          if (!isNaN(maxAge)) {
            options.maxAge = effect_Duration__rspack_import_6.seconds(maxAge);
          }
          break;
        }
      case "path":
        {
          if (value === undefined) {
            break;
          }
          if (value[0] === "/") {
            options.path = value;
          }
          break;
        }
      case "priority":
        {
          if (value === undefined) {
            break;
          }
          switch (value.toLowerCase()) {
            case "low":
              options.priority = "low";
              break;
            case "medium":
              options.priority = "medium";
              break;
            case "high":
              options.priority = "high";
              break;
          }
          break;
        }
      case "httponly":
        {
          options.httpOnly = true;
          break;
        }
      case "secure":
        {
          options.secure = true;
          break;
        }
      case "partitioned":
        {
          options.partitioned = true;
          break;
        }
      case "samesite":
        {
          if (value === undefined) {
            break;
          }
          switch (value.toLowerCase()) {
            case "lax":
              options.sameSite = "lax";
              break;
            case "strict":
              options.sameSite = "strict";
              break;
            case "none":
              options.sameSite = "none";
              break;
          }
          break;
        }
    }
  }
  return effect_Option__rspack_import_5.some(Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded,
    options: Object.keys(options).length > 0 ? options : undefined
  }));
}
/**
 * An empty Cookies object
 *
 * @since 1.0.0
 * @category constructors
 */
const empty = /*#__PURE__*/fromIterable([]);
/**
 * @since 1.0.0
 * @category refinements
 */
const isEmpty = self => effect_Record__rspack_import_3.isEmptyRecord(self.cookies);
// eslint-disable-next-line no-control-regex
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...effect_Inspectable__rspack_import_2.BaseProto,
  toJSON() {
    return {
      _id: "@effect/platform/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options
    };
  }
};
/**
 * Create a new cookie
 *
 * @since 1.0.0
 * @category constructors
 */
function makeCookie(name, value, options) {
  if (!fieldContentRegExp.test(name)) {
    return effect_Either__rspack_import_7.left(new CookiesError({
      reason: "InvalidName"
    }));
  }
  const encodedValue = encodeURIComponent(value);
  if (encodedValue && !fieldContentRegExp.test(encodedValue)) {
    return effect_Either__rspack_import_7.left(new CookiesError({
      reason: "InvalidValue"
    }));
  }
  if (options !== undefined) {
    if (options.domain !== undefined && !fieldContentRegExp.test(options.domain)) {
      return effect_Either__rspack_import_7.left(new CookiesError({
        reason: "InvalidDomain"
      }));
    }
    if (options.path !== undefined && !fieldContentRegExp.test(options.path)) {
      return effect_Either__rspack_import_7.left(new CookiesError({
        reason: "InvalidPath"
      }));
    }
    if (options.maxAge !== undefined && !effect_Duration__rspack_import_6.isFinite(effect_Duration__rspack_import_6.decode(options.maxAge))) {
      return effect_Either__rspack_import_7.left(new CookiesError({
        reason: "InfinityMaxAge"
      }));
    }
  }
  return effect_Either__rspack_import_7.right(Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded: encodedValue,
    options
  }));
}
/**
 * Create a new cookie, throwing an error if invalid
 *
 * @since 1.0.0
 * @category constructors
 */
const unsafeMakeCookie = (name, value, options) => effect_Either__rspack_import_7.getOrThrowWith(makeCookie(name, value, options), effect_Function__rspack_import_8.identity);
/**
 * Add a cookie to a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const setCookie = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, cookie) => fromReadonlyRecord(effect_Record__rspack_import_3.set(self.cookies, cookie.name, cookie)));
/**
 * Add multiple cookies to a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const setAllCookie = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, cookies) => {
  const record = {
    ...self.cookies
  };
  for (const cookie of cookies) {
    record[cookie.name] = cookie;
  }
  return fromReadonlyRecord(record);
});
/**
 * Combine two Cookies objects, removing duplicates from the first
 *
 * @since 1.0.0
 * @category combinators
 */
const merge = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, that) => fromReadonlyRecord({
  ...self.cookies,
  ...that.cookies
}));
/**
 * Remove a cookie by name
 *
 * @since 1.0.0
 * @category combinators
 */
const remove = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, name) => fromReadonlyRecord(effect_Record__rspack_import_3.remove(self.cookies, name)));
/**
 * Get a cookie from a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const get = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(args => isCookies(args[0]), (self, name) => effect_Record__rspack_import_3.get(self.cookies, name));
/**
 * Get a cookie from a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const getValue = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(args => isCookies(args[0]), (self, name) => effect_Option__rspack_import_5.map(effect_Record__rspack_import_3.get(self.cookies, name), cookie => cookie.value));
/**
 * Add a cookie to a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const set = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(args => isCookies(args[0]), (self, name, value, options) => effect_Either__rspack_import_7.map(makeCookie(name, value, options), cookie => fromReadonlyRecord(effect_Record__rspack_import_3.set(self.cookies, name, cookie))));
/**
 * Add a cookie to a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const unsafeSet = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(args => isCookies(args[0]), (self, name, value, options) => fromReadonlyRecord(effect_Record__rspack_import_3.set(self.cookies, name, unsafeMakeCookie(name, value, options))));
/**
 * Add multiple cookies to a Cookies object
 *
 * @since 1.0.0
 * @category combinators
 */
const setAll = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, cookies) => {
  const record = {
    ...self.cookies
  };
  for (const [name, value, options] of cookies) {
    const either = makeCookie(name, value, options);
    if (effect_Either__rspack_import_7.isLeft(either)) {
      return either;
    }
    record[name] = either.right;
  }
  return effect_Either__rspack_import_7.right(fromReadonlyRecord(record));
});
/**
 * Add multiple cookies to a Cookies object, throwing an error if invalid
 *
 * @since 1.0.0
 * @category combinators
 */
const unsafeSetAll = /*#__PURE__*/(0,effect_Function__rspack_import_8.dual)(2, (self, cookies) => effect_Either__rspack_import_7.getOrThrowWith(setAll(self, cookies), effect_Function__rspack_import_8.identity));
/**
 * Serialize a cookie into a string
 *
 * Adapted from https://github.com/fastify/fastify-cookie under MIT License
 *
 * @since 1.0.0
 * @category encoding
 */
function serializeCookie(self) {
  let str = self.name + "=" + self.valueEncoded;
  if (self.options === undefined) {
    return str;
  }
  const options = self.options;
  if (options.maxAge !== undefined) {
    const maxAge = effect_Duration__rspack_import_6.toSeconds(options.maxAge);
    str += "; Max-Age=" + Math.trunc(maxAge);
  }
  if (options.domain !== undefined) {
    str += "; Domain=" + options.domain;
  }
  if (options.path !== undefined) {
    str += "; Path=" + options.path;
  }
  if (options.priority !== undefined) {
    switch (options.priority) {
      case "low":
        str += "; Priority=Low";
        break;
      case "medium":
        str += "; Priority=Medium";
        break;
      case "high":
        str += "; Priority=High";
        break;
    }
  }
  if (options.expires !== undefined) {
    str += "; Expires=" + options.expires.toUTCString();
  }
  if (options.httpOnly) {
    str += "; HttpOnly";
  }
  if (options.secure) {
    str += "; Secure";
  }
  // Draft implementation to support Chrome from 2024-Q1 forward.
  // See https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies#section-2.1
  if (options.partitioned) {
    str += "; Partitioned";
  }
  if (options.sameSite !== undefined) {
    switch (options.sameSite) {
      case "lax":
        str += "; SameSite=Lax";
        break;
      case "strict":
        str += "; SameSite=Strict";
        break;
      case "none":
        str += "; SameSite=None";
        break;
    }
  }
  return str;
}
/**
 * Serialize a Cookies object into a Cookie header
 *
 * @since 1.0.0
 * @category encoding
 */
const toCookieHeader = self => Object.values(self.cookies).map(cookie => `${cookie.name}=${cookie.valueEncoded}`).join("; ");
/**
 * To record
 *
 * @since 1.0.0
 * @category encoding
 */
const toRecord = self => {
  const record = {};
  const cookies = Object.values(self.cookies);
  for (let index = 0; index < cookies.length; index++) {
    const cookie = cookies[index];
    record[cookie.name] = cookie.value;
  }
  return record;
};
/**
 * Serialize a Cookies object into Headers object containing one or more Set-Cookie headers
 *
 * @since 1.0.0
 * @category encoding
 */
const toSetCookieHeaders = self => Object.values(self.cookies).map(serializeCookie);
/**
 * Parse a cookie header into a record of key-value pairs
 *
 * Adapted from https://github.com/fastify/fastify-cookie under MIT License
 *
 * @since 1.0.0
 * @category decoding
 */
function parseHeader(header) {
  const result = {};
  const strLen = header.length;
  let pos = 0;
  let terminatorPos = 0;
  while (true) {
    if (terminatorPos === strLen) break;
    terminatorPos = header.indexOf(";", pos);
    if (terminatorPos === -1) terminatorPos = strLen; // This is the last pair
    let eqIdx = header.indexOf("=", pos);
    if (eqIdx === -1) break; // No key-value pairs left
    if (eqIdx > terminatorPos) {
      // Malformed key-value pair
      pos = terminatorPos + 1;
      continue;
    }
    const key = header.substring(pos, eqIdx++).trim();
    if (result[key] === undefined) {
      const val = header.charCodeAt(eqIdx) === 0x22 ? header.substring(eqIdx + 1, terminatorPos - 1).trim() : header.substring(eqIdx, terminatorPos).trim();
      result[key] = !(val.indexOf("%") === -1) ? tryDecodeURIComponent(val) : val;
    }
    pos = terminatorPos + 1;
  }
  return result;
}
const tryDecodeURIComponent = str => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};
//# sourceMappingURL=Cookies.js.map

},
22649(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  HeadersTypeId: () => (HeadersTypeId),
  currentRedactedNames: () => (currentRedactedNames),
  empty: () => (empty),
  fromInput: () => (fromInput),
  get: () => (get),
  has: () => (has),
  isHeaders: () => (isHeaders),
  merge: () => (merge),
  redact: () => (redact),
  remove: () => (remove),
  schema: () => (schema),
  schemaFromSelf: () => (schemaFromSelf),
  set: () => (set),
  setAll: () => (setAll),
  unsafeFromRecord: () => (unsafeFromRecord)
});
/* import */ var effect_FiberRef__rspack_import_9 = __webpack_require__(68792);
/* import */ var effect_FiberRefs__rspack_import_2 = __webpack_require__(54247);
/* import */ var effect_Function__rspack_import_6 = __webpack_require__(61279);
/* import */ var effect_GlobalValue__rspack_import_8 = __webpack_require__(9091);
/* import */ var effect_Inspectable__rspack_import_1 = __webpack_require__(65051);
/* import */ var effect_Predicate__rspack_import_0 = __webpack_require__(35034);
/* import */ var effect_Record__rspack_import_4 = __webpack_require__(13878);
/* import */ var effect_Redacted__rspack_import_7 = __webpack_require__(66707);
/* import */ var effect_Schema__rspack_import_3 = __webpack_require__(9064);
/* import */ var effect_String__rspack_import_5 = __webpack_require__(4562);
/**
 * @since 1.0.0
 */










/**
 * @since 1.0.0
 * @category type ids
 */
const HeadersTypeId = /*#__PURE__*/Symbol.for("@effect/platform/Headers");
/**
 * @since 1.0.0
 * @category refinements
 */
const isHeaders = u => effect_Predicate__rspack_import_0.hasProperty(u, HeadersTypeId);
const Proto = /*#__PURE__*/Object.assign(/*#__PURE__*/Object.create(null), {
  [HeadersTypeId]: HeadersTypeId,
  [effect_Inspectable__rspack_import_1.symbolRedactable](fiberRefs) {
    return redact(this, effect_FiberRefs__rspack_import_2.getOrDefault(fiberRefs, currentRedactedNames));
  }
});
const make = input => Object.assign(Object.create(Proto), input);
/**
 * @since 1.0.0
 * @category schemas
 */
const schemaFromSelf = /*#__PURE__*/effect_Schema__rspack_import_3.declare(isHeaders, {
  typeConstructor: {
    _tag: "effect/platform/Headers"
  },
  identifier: "Headers",
  equivalence: () => effect_Record__rspack_import_4.getEquivalence(effect_String__rspack_import_5.Equivalence)
});
/**
 * @since 1.0.0
 * @category schemas
 */
const schema = /*#__PURE__*/effect_Schema__rspack_import_3.transform(/*#__PURE__*/effect_Schema__rspack_import_3.Record({
  key: effect_Schema__rspack_import_3.String,
  value: effect_Schema__rspack_import_3.String
}), schemaFromSelf, {
  strict: true,
  decode: record => fromInput(record),
  encode: effect_Function__rspack_import_6.identity
});
/**
 * @since 1.0.0
 * @category constructors
 */
const empty = /*#__PURE__*/Object.create(Proto);
/**
 * @since 1.0.0
 * @category constructors
 */
const fromInput = input => {
  if (input === undefined) {
    return empty;
  } else if (Symbol.iterator in input) {
    const out = Object.create(Proto);
    for (const [k, v] of input) {
      out[k.toLowerCase()] = v;
    }
    return out;
  }
  const out = Object.create(Proto);
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.join(", ");
    } else if (v !== undefined) {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
};
/**
 * @since 1.0.0
 * @category constructors
 */
const unsafeFromRecord = input => Object.setPrototypeOf(input, Proto);
/**
 * @since 1.0.0
 * @category combinators
 */
const has = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, key) => key.toLowerCase() in self);
/**
 * @since 1.0.0
 * @category combinators
 */
const get = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, key) => effect_Record__rspack_import_4.get(self, key.toLowerCase()));
/**
 * @since 1.0.0
 * @category combinators
 */
const set = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(3, (self, key, value) => {
  const out = make(self);
  out[key.toLowerCase()] = value;
  return out;
});
/**
 * @since 1.0.0
 * @category combinators
 */
const setAll = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, headers) => make({
  ...self,
  ...fromInput(headers)
}));
/**
 * @since 1.0.0
 * @category combinators
 */
const merge = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, headers) => {
  const out = make(self);
  Object.assign(out, headers);
  return out;
});
/**
 * @since 1.0.0
 * @category combinators
 */
const remove = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, key) => {
  const out = make(self);
  const modify = key => {
    if (typeof key === "string") {
      const k = key.toLowerCase();
      if (k in self) {
        delete out[k];
      }
    } else {
      for (const name in self) {
        if (key.test(name)) {
          delete out[name];
        }
      }
    }
  };
  if (Array.isArray(key)) {
    for (let i = 0; i < key.length; i++) {
      modify(key[i]);
    }
  } else {
    modify(key);
  }
  return out;
});
/**
 * @since 1.0.0
 * @category combinators
 */
const redact = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, key) => {
  const out = {
    ...self
  };
  const modify = key => {
    if (typeof key === "string") {
      const k = key.toLowerCase();
      if (k in self) {
        out[k] = effect_Redacted__rspack_import_7.make(self[k]);
      }
    } else {
      for (const name in self) {
        if (key.test(name)) {
          out[name] = effect_Redacted__rspack_import_7.make(self[name]);
        }
      }
    }
  };
  if (Array.isArray(key)) {
    for (let i = 0; i < key.length; i++) {
      modify(key[i]);
    }
  } else {
    modify(key);
  }
  return out;
});
/**
 * @since 1.0.0
 * @category fiber refs
 */
const currentRedactedNames = /*#__PURE__*/(0,effect_GlobalValue__rspack_import_8.globalValue)("@effect/platform/Headers/currentRedactedNames", () => effect_FiberRef__rspack_import_9.unsafeMake(["authorization", "cookie", "set-cookie", "x-api-key"]));
//# sourceMappingURL=Headers.js.map

},
46192(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  HttpClient: () => (HttpClient),
  SpanNameGenerator: () => (SpanNameGenerator),
  TypeId: () => (TypeId),
  catchAll: () => (catchAll),
  catchTag: () => (catchTag),
  catchTags: () => (catchTags),
  currentTracerDisabledWhen: () => (currentTracerDisabledWhen),
  currentTracerPropagation: () => (currentTracerPropagation),
  del: () => (del),
  execute: () => (execute),
  filterOrElse: () => (filterOrElse),
  filterOrFail: () => (filterOrFail),
  filterStatus: () => (filterStatus),
  filterStatusOk: () => (filterStatusOk),
  followRedirects: () => (followRedirects),
  get: () => (get),
  head: () => (head),
  layerMergedContext: () => (layerMergedContext),
  make: () => (make),
  makeWith: () => (makeWith),
  mapRequest: () => (mapRequest),
  mapRequestEffect: () => (mapRequestEffect),
  mapRequestInput: () => (mapRequestInput),
  mapRequestInputEffect: () => (mapRequestInputEffect),
  options: () => (options),
  patch: () => (patch),
  post: () => (post),
  put: () => (put),
  retry: () => (retry),
  retryTransient: () => (retryTransient),
  tap: () => (tap),
  tapError: () => (tapError),
  tapRequest: () => (tapRequest),
  transform: () => (transform),
  transformResponse: () => (transformResponse),
  withCookiesRef: () => (withCookiesRef),
  withScope: () => (withScope),
  withSpanNameGenerator: () => (withSpanNameGenerator),
  withTracerDisabledWhen: () => (withTracerDisabledWhen),
  withTracerPropagation: () => (withTracerPropagation)
});
/* import */ var _internal_httpClient_js__rspack_import_0 = __webpack_require__(78158);

/**
 * @since 1.0.0
 * @category type ids
 */
const TypeId = _internal_httpClient_js__rspack_import_0/* .TypeId */.ii;
/**
 * @since 1.0.0
 * @category tags
 */
const HttpClient = _internal_httpClient_js__rspack_import_0/* .tag */.Tc;
/**
 * @since 1.0.0
 * @category accessors
 */
const execute = _internal_httpClient_js__rspack_import_0/* .execute */.g7;
/**
 * @since 1.0.0
 * @category accessors
 */
const get = _internal_httpClient_js__rspack_import_0/* .get */.Jt;
/**
 * @since 1.0.0
 * @category accessors
 */
const head = _internal_httpClient_js__rspack_import_0/* .head */.d5;
/**
 * @since 1.0.0
 * @category accessors
 */
const post = _internal_httpClient_js__rspack_import_0/* .post */.bE;
/**
 * @since 1.0.0
 * @category accessors
 */
const patch = _internal_httpClient_js__rspack_import_0/* .patch */.F6;
/**
 * @since 1.0.0
 * @category accessors
 */
const put = _internal_httpClient_js__rspack_import_0/* .put */.yJ;
/**
 * @since 1.0.0
 * @category accessors
 */
const del = _internal_httpClient_js__rspack_import_0/* .del */.yH;
/**
 * @since 1.0.0
 * @category accessors
 */
const options = _internal_httpClient_js__rspack_import_0/* .options */.fF;
/**
 * @since 1.0.0
 * @category error handling
 */
const catchAll = _internal_httpClient_js__rspack_import_0/* .catchAll */.h9;
/**
 * @since 1.0.0
 * @category error handling
 */
const catchTag = _internal_httpClient_js__rspack_import_0/* .catchTag */.Ku;
/**
 * @since 1.0.0
 * @category error handling
 */
const catchTags = _internal_httpClient_js__rspack_import_0/* .catchTags */.lo;
/**
 * Filters the result of a response, or runs an alternative effect if the predicate fails.
 *
 * @since 1.0.0
 * @category filters
 */
const filterOrElse = _internal_httpClient_js__rspack_import_0/* .filterOrElse */.Pm;
/**
 * Filters the result of a response, or throws an error if the predicate fails.
 *
 * @since 1.0.0
 * @category filters
 */
const filterOrFail = _internal_httpClient_js__rspack_import_0/* .filterOrFail */.W$;
/**
 * Filters responses by HTTP status code.
 *
 * @since 1.0.0
 * @category filters
 */
const filterStatus = _internal_httpClient_js__rspack_import_0/* .filterStatus */.ti;
/**
 * Filters responses that return a 2xx status code.
 *
 * @since 1.0.0
 * @category filters
 */
const filterStatusOk = _internal_httpClient_js__rspack_import_0/* .filterStatusOk */.p$;
/**
 * @since 1.0.0
 * @category constructors
 */
const makeWith = _internal_httpClient_js__rspack_import_0/* .makeWith */.lh;
/**
 * @since 1.0.0
 * @category constructors
 */
const make = _internal_httpClient_js__rspack_import_0/* .make */.L8;
/**
 * @since 1.0.0
 * @category mapping & sequencing
 */
const transform = _internal_httpClient_js__rspack_import_0/* .transform */.pd;
/**
 * @since 1.0.0
 * @category mapping & sequencing
 */
const transformResponse = _internal_httpClient_js__rspack_import_0/* .transformResponse */.SA;
/**
 * Appends a transformation of the request object before sending it.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const mapRequest = _internal_httpClient_js__rspack_import_0/* .mapRequest */.WR;
/**
 * Appends an effectful transformation of the request object before sending it.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const mapRequestEffect = _internal_httpClient_js__rspack_import_0/* .mapRequestEffect */.tn;
/**
 * Prepends a transformation of the request object before sending it.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const mapRequestInput = _internal_httpClient_js__rspack_import_0/* .mapRequestInput */.ex;
/**
 * Prepends an effectful transformation of the request object before sending it.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const mapRequestInputEffect = _internal_httpClient_js__rspack_import_0/* .mapRequestInputEffect */.L4;
/**
 * Retries the request based on a provided schedule or policy.
 *
 * @since 1.0.0
 * @category error handling
 */
const retry = _internal_httpClient_js__rspack_import_0/* .retry */.L5;
/**
 * Retries common transient errors, such as rate limiting, timeouts or network issues.
 *
 * Specifying a `while` predicate allows you to consider other errors as
 * transient.
 *
 * @since 1.0.0
 * @category error handling
 */
const retryTransient = _internal_httpClient_js__rspack_import_0/* .retryTransient */.jh;
/**
 * Performs an additional effect after a successful request.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const tap = _internal_httpClient_js__rspack_import_0/* .tap */.Mi;
/**
 * Performs an additional effect after an unsuccessful request.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const tapError = _internal_httpClient_js__rspack_import_0/* .tapError */.sF;
/**
 * Performs an additional effect on the request before sending it.
 *
 * @since 1.0.0
 * @category mapping & sequencing
 */
const tapRequest = _internal_httpClient_js__rspack_import_0/* .tapRequest */.dF;
/**
 * Associates a `Ref` of cookies with the client for handling cookies across requests.
 *
 * @since 1.0.0
 * @category cookies
 */
const withCookiesRef = _internal_httpClient_js__rspack_import_0/* .withCookiesRef */.Hv;
/**
 * Follows HTTP redirects up to a specified number of times.
 *
 * @since 1.0.0
 * @category redirects
 */
const followRedirects = _internal_httpClient_js__rspack_import_0/* .followRedirects */.FE;
/**
 * @since 1.0.0
 * @category Tracing
 */
const currentTracerDisabledWhen = _internal_httpClient_js__rspack_import_0/* .currentTracerDisabledWhen */.j4;
/**
 * Disables tracing for specific requests based on a provided predicate.
 *
 * @since 1.0.0
 * @category Tracing
 */
const withTracerDisabledWhen = _internal_httpClient_js__rspack_import_0/* .withTracerDisabledWhen */.y4;
/**
 * @since 1.0.0
 * @category Tracing
 */
const currentTracerPropagation = _internal_httpClient_js__rspack_import_0/* .currentTracerPropagation */.vs;
/**
 * Enables or disables tracing propagation for the request.
 *
 * @since 1.0.0
 * @category Tracing
 */
const withTracerPropagation = _internal_httpClient_js__rspack_import_0/* .withTracerPropagation */.Qe;
/**
 * @since 1.0.0
 */
const layerMergedContext = _internal_httpClient_js__rspack_import_0/* .layerMergedContext */.$T;
/**
 * @since 1.0.0
 * @category Tracing
 */
const SpanNameGenerator = _internal_httpClient_js__rspack_import_0/* .SpanNameGenerator */.rg;
/**
 * Customizes the span names for tracing.
 *
 * ```ts
 * import { FetchHttpClient, HttpClient } from "@effect/platform"
 * import { NodeRuntime } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * Effect.gen(function* () {
 *   const client = (yield* HttpClient.HttpClient).pipe(
 *     // Customize the span names for this HttpClient
 *     HttpClient.withSpanNameGenerator(
 *       (request) => `http.client ${request.method} ${request.url}`
 *     )
 *   )
 *
 *   yield* client.get("https://jsonplaceholder.typicode.com/posts/1")
 * }).pipe(Effect.provide(FetchHttpClient.layer), NodeRuntime.runMain)
 * ```
 *
 * @since 1.0.0
 * @category Tracing
 */
const withSpanNameGenerator = _internal_httpClient_js__rspack_import_0/* .withSpanNameGenerator */.zO;
/**
 * Ties the lifetime of the `HttpClientRequest` to a `Scope`.
 *
 * @since 1.0.0
 * @category Scope
 */
const withScope = _internal_httpClient_js__rspack_import_0/* .withScope */.v4;
//# sourceMappingURL=HttpClient.js.map

},
46400(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  RequestError: () => (/* binding */ RequestError),
  ResponseError: () => (/* binding */ ResponseError),
  TypeId: () => (/* binding */ HttpClientError_TypeId),
  isHttpClientError: () => (/* binding */ isHttpClientError)
});

// EXTERNAL MODULE: ./node_modules/.pnpm/effect@3.21.2/node_modules/effect/dist/esm/Predicate.js
var Predicate = __webpack_require__(35034);
// EXTERNAL MODULE: ./node_modules/.pnpm/@effect+platform@0.96.1_effect@3.21.2/node_modules/@effect/platform/dist/esm/Error.js
var Error = __webpack_require__(63797);
;// CONCATENATED MODULE: ./node_modules/.pnpm/@effect+platform@0.96.1_effect@3.21.2/node_modules/@effect/platform/dist/esm/internal/httpClientError.js
/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpClientError");
//# sourceMappingURL=httpClientError.js.map
;// CONCATENATED MODULE: ./node_modules/.pnpm/@effect+platform@0.96.1_effect@3.21.2/node_modules/@effect/platform/dist/esm/HttpClientError.js
/**
 * @since 1.0.0
 */



/**
 * @since 1.0.0
 * @category type id
 */
const HttpClientError_TypeId = TypeId;
/**
 * @since 1.0.0
 * @category guards
 */
const isHttpClientError = u => (0,Predicate.hasProperty)(u, HttpClientError_TypeId);
/**
 * @since 1.0.0
 * @category error
 */
class RequestError extends /*#__PURE__*/Error.TypeIdError(HttpClientError_TypeId, "RequestError") {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    return this.description ? `${this.reason}: ${this.description} (${this.methodAndUrl})` : `${this.reason} error (${this.methodAndUrl})`;
  }
}
/**
 * @since 1.0.0
 * @category error
 */
class ResponseError extends /*#__PURE__*/Error.TypeIdError(HttpClientError_TypeId, "ResponseError") {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return this.description ? `${this.reason}: ${this.description} (${info})` : `${this.reason} error (${info})`;
  }
}
//# sourceMappingURL=HttpClientError.js.map

},
29075(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  TypeId: () => (TypeId),
  accept: () => (accept),
  acceptJson: () => (acceptJson),
  appendUrl: () => (appendUrl),
  appendUrlParam: () => (appendUrlParam),
  appendUrlParams: () => (appendUrlParams),
  basicAuth: () => (basicAuth),
  bearerToken: () => (bearerToken),
  bodyFile: () => (bodyFile),
  bodyFileWeb: () => (bodyFileWeb),
  bodyFormData: () => (bodyFormData),
  bodyFormDataRecord: () => (bodyFormDataRecord),
  bodyJson: () => (bodyJson),
  bodyStream: () => (bodyStream),
  bodyText: () => (bodyText),
  bodyUint8Array: () => (bodyUint8Array),
  bodyUnsafeJson: () => (bodyUnsafeJson),
  bodyUrlParams: () => (bodyUrlParams),
  del: () => (del),
  get: () => (get),
  head: () => (head),
  make: () => (make),
  modify: () => (modify),
  options: () => (options),
  patch: () => (patch),
  post: () => (post),
  prependUrl: () => (prependUrl),
  put: () => (put),
  removeHash: () => (removeHash),
  schemaBodyJson: () => (schemaBodyJson),
  setBody: () => (setBody),
  setHash: () => (setHash),
  setHeader: () => (setHeader),
  setHeaders: () => (setHeaders),
  setMethod: () => (setMethod),
  setUrl: () => (setUrl),
  setUrlParam: () => (setUrlParam),
  setUrlParams: () => (setUrlParams),
  toUrl: () => (toUrl),
  updateUrl: () => (updateUrl)
});
/* import */ var _internal_httpClientRequest_js__rspack_import_0 = __webpack_require__(20165);

/**
 * @since 1.0.0
 * @category type ids
 */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpClientRequest");
/**
 * @since 1.0.0
 * @category constructors
 */
const make = _internal_httpClientRequest_js__rspack_import_0/* .make */.L8;
/**
 * @since 1.0.0
 * @category constructors
 */
const get = _internal_httpClientRequest_js__rspack_import_0/* .get */.Jt;
/**
 * @since 1.0.0
 * @category constructors
 */
const post = _internal_httpClientRequest_js__rspack_import_0/* .post */.bE;
/**
 * @since 1.0.0
 * @category constructors
 */
const patch = _internal_httpClientRequest_js__rspack_import_0/* .patch */.F6;
/**
 * @since 1.0.0
 * @category constructors
 */
const put = _internal_httpClientRequest_js__rspack_import_0/* .put */.yJ;
/**
 * @since 1.0.0
 * @category constructors
 */
const del = _internal_httpClientRequest_js__rspack_import_0/* .del */.yH;
/**
 * @since 1.0.0
 * @category constructors
 */
const head = _internal_httpClientRequest_js__rspack_import_0/* .head */.d5;
/**
 * @since 1.0.0
 * @category constructors
 */
const options = _internal_httpClientRequest_js__rspack_import_0/* .options */.fF;
/**
 * @since 1.0.0
 * @category combinators
 */
const modify = _internal_httpClientRequest_js__rspack_import_0/* .modify */.JP;
/**
 * @since 1.0.0
 * @category combinators
 */
const setMethod = _internal_httpClientRequest_js__rspack_import_0/* .setMethod */.U0;
/**
 * @since 1.0.0
 * @category combinators
 */
const setHeader = _internal_httpClientRequest_js__rspack_import_0/* .setHeader */.WH;
/**
 * @since 1.0.0
 * @category combinators
 */
const setHeaders = _internal_httpClientRequest_js__rspack_import_0/* .setHeaders */.lL;
/**
 * @since 1.0.0
 * @category combinators
 */
const basicAuth = _internal_httpClientRequest_js__rspack_import_0/* .basicAuth */.tB;
/**
 * @since 1.0.0
 * @category combinators
 */
const bearerToken = _internal_httpClientRequest_js__rspack_import_0/* .bearerToken */.hC;
/**
 * @since 1.0.0
 * @category combinators
 */
const accept = _internal_httpClientRequest_js__rspack_import_0/* .accept */.Ju;
/**
 * @since 1.0.0
 * @category combinators
 */
const acceptJson = _internal_httpClientRequest_js__rspack_import_0/* .acceptJson */.TK;
/**
 * @since 1.0.0
 * @category combinators
 */
const setUrl = _internal_httpClientRequest_js__rspack_import_0/* .setUrl */.cV;
/**
 * @since 1.0.0
 * @category combinators
 */
const prependUrl = _internal_httpClientRequest_js__rspack_import_0/* .prependUrl */.c5;
/**
 * @since 1.0.0
 * @category combinators
 */
const appendUrl = _internal_httpClientRequest_js__rspack_import_0/* .appendUrl */.i9;
/**
 * @since 1.0.0
 * @category combinators
 */
const updateUrl = _internal_httpClientRequest_js__rspack_import_0/* .updateUrl */.bj;
/**
 * @since 1.0.0
 * @category combinators
 */
const setUrlParam = _internal_httpClientRequest_js__rspack_import_0/* .setUrlParam */.Bg;
/**
 * @since 1.0.0
 * @category combinators
 */
const setUrlParams = _internal_httpClientRequest_js__rspack_import_0/* .setUrlParams */.uR;
/**
 * @since 1.0.0
 * @category combinators
 */
const appendUrlParam = _internal_httpClientRequest_js__rspack_import_0/* .appendUrlParam */.Dc;
/**
 * @since 1.0.0
 * @category combinators
 */
const appendUrlParams = _internal_httpClientRequest_js__rspack_import_0/* .appendUrlParams */.EZ;
/**
 * @since 1.0.0
 * @category combinators
 */
const setHash = _internal_httpClientRequest_js__rspack_import_0/* .setHash */.hd;
/**
 * @since 1.0.0
 * @category combinators
 */
const removeHash = _internal_httpClientRequest_js__rspack_import_0/* .removeHash */.fr;
/**
 * @since 1.0.0
 * @category combinators
 */
const toUrl = _internal_httpClientRequest_js__rspack_import_0/* .toUrl */.bb;
/**
 * @since 1.0.0
 * @category combinators
 */
const setBody = _internal_httpClientRequest_js__rspack_import_0/* .setBody */.ju;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyUint8Array = _internal_httpClientRequest_js__rspack_import_0/* .bodyUint8Array */.yK;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyText = _internal_httpClientRequest_js__rspack_import_0/* .bodyText */.G3;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyJson = _internal_httpClientRequest_js__rspack_import_0/* .bodyJson */.zW;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyUnsafeJson = _internal_httpClientRequest_js__rspack_import_0/* .bodyUnsafeJson */.jH;
/**
 * @since 1.0.0
 * @category combinators
 */
const schemaBodyJson = _internal_httpClientRequest_js__rspack_import_0/* .schemaBodyJson */._u;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyUrlParams = _internal_httpClientRequest_js__rspack_import_0/* .bodyUrlParams */.wb;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyFormData = _internal_httpClientRequest_js__rspack_import_0/* .bodyFormData */.p1;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyFormDataRecord = _internal_httpClientRequest_js__rspack_import_0/* .bodyFormDataRecord */.m5;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyStream = _internal_httpClientRequest_js__rspack_import_0/* .bodyStream */.XL;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyFile = _internal_httpClientRequest_js__rspack_import_0/* .bodyFile */.pF;
/**
 * @since 1.0.0
 * @category combinators
 */
const bodyFileWeb = _internal_httpClientRequest_js__rspack_import_0/* .bodyFileWeb */.hx;
//# sourceMappingURL=HttpClientRequest.js.map

},
1116(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  MaxBodySize: () => (MaxBodySize),
  TypeId: () => (TypeId),
  inspect: () => (inspect),
  schemaBodyJson: () => (schemaBodyJson),
  schemaBodyUrlParams: () => (schemaBodyUrlParams),
  schemaHeaders: () => (schemaHeaders),
  withMaxBodySize: () => (withMaxBodySize)
});
/* import */ var effect_Context__rspack_import_3 = __webpack_require__(50256);
/* import */ var effect_Effect__rspack_import_1 = __webpack_require__(46330);
/* import */ var effect_Function__rspack_import_5 = __webpack_require__(61279);
/* import */ var effect_Inspectable__rspack_import_7 = __webpack_require__(65051);
/* import */ var effect_Option__rspack_import_4 = __webpack_require__(31706);
/* import */ var effect_Schema__rspack_import_0 = __webpack_require__(9064);
/* import */ var _FileSystem_js__rspack_import_6 = __webpack_require__(7096);
/* import */ var _UrlParams_js__rspack_import_2 = __webpack_require__(11672);
/**
 * @since 1.0.0
 */








/**
 * @since 1.0.0
 * @category type ids
 */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpIncomingMessage");
/**
 * @since 1.0.0
 * @category schema
 */
const schemaBodyJson = (schema, options) => {
  const parse = effect_Schema__rspack_import_0.decodeUnknown(schema, options);
  return self => effect_Effect__rspack_import_1.flatMap(self.json, parse);
};
/**
 * @since 1.0.0
 * @category schema
 */
const schemaBodyUrlParams = (schema, options) => {
  const decode = _UrlParams_js__rspack_import_2.schemaStruct(schema, options);
  return self => effect_Effect__rspack_import_1.flatMap(self.urlParamsBody, decode);
};
/**
 * @since 1.0.0
 * @category schema
 */
const schemaHeaders = (schema, options) => {
  const parse = effect_Schema__rspack_import_0.decodeUnknown(schema, options);
  return self => parse(self.headers);
};
/**
 * @since 1.0.0
 * @category fiber refs
 */
class MaxBodySize extends /*#__PURE__*/effect_Context__rspack_import_3.Reference()("@effect/platform/HttpIncomingMessage/MaxBodySize", {
  defaultValue: effect_Option__rspack_import_4.none
}) {}
/**
 * @since 1.0.0
 * @category fiber refs
 */
const withMaxBodySize = /*#__PURE__*/(0,effect_Function__rspack_import_5.dual)(2, (effect, size) => effect_Effect__rspack_import_1.provideService(effect, MaxBodySize, effect_Option__rspack_import_4.map(size, _FileSystem_js__rspack_import_6.Size)));
/**
 * @since 1.0.0
 */
const inspect = (self, that) => {
  const contentType = self.headers["content-type"] ?? "";
  let body;
  if (contentType.includes("application/json")) {
    try {
      body = effect_Effect__rspack_import_1.runSync(self.json);
    } catch {
      //
    }
  } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
    try {
      body = effect_Effect__rspack_import_1.runSync(self.text);
    } catch {
      //
    }
  }
  const obj = {
    ...that,
    headers: effect_Inspectable__rspack_import_7.redact(self.headers),
    remoteAddress: self.remoteAddress.toJSON()
  };
  if (body !== undefined) {
    obj.body = body;
  }
  return obj;
};
//# sourceMappingURL=HttpIncomingMessage.js.map

},
67459(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  b3: () => (b3),
  fromHeaders: () => (fromHeaders),
  toHeaders: () => (toHeaders),
  w3c: () => (w3c),
  xb3: () => (xb3)
});
/* import */ var effect_Option__rspack_import_1 = __webpack_require__(31706);
/* import */ var effect_Tracer__rspack_import_2 = __webpack_require__(52882);
/* import */ var _Headers_js__rspack_import_0 = __webpack_require__(22649);
/**
 * @since 1.0.0
 */



/**
 * @since 1.0.0
 * @category encoding
 */
const toHeaders = span => _Headers_js__rspack_import_0.unsafeFromRecord({
  b3: `${span.traceId}-${span.spanId}-${span.sampled ? "1" : "0"}${span.parent._tag === "Some" ? `-${span.parent.value.spanId}` : ""}`,
  traceparent: `00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`
});
/**
 * @since 1.0.0
 * @category decoding
 */
const fromHeaders = headers => {
  let span = w3c(headers);
  if (span._tag === "Some") {
    return span;
  }
  span = b3(headers);
  if (span._tag === "Some") {
    return span;
  }
  return xb3(headers);
};
/**
 * @since 1.0.0
 * @category decoding
 */
const b3 = headers => {
  if (!("b3" in headers)) {
    return effect_Option__rspack_import_1.none();
  }
  const parts = headers["b3"].split("-");
  if (parts.length < 2) {
    return effect_Option__rspack_import_1.none();
  }
  return effect_Option__rspack_import_1.some(effect_Tracer__rspack_import_2.externalSpan({
    traceId: parts[0],
    spanId: parts[1],
    sampled: parts[2] ? parts[2] === "1" : true
  }));
};
/**
 * @since 1.0.0
 * @category decoding
 */
const xb3 = headers => {
  if (!headers["x-b3-traceid"] || !headers["x-b3-spanid"]) {
    return effect_Option__rspack_import_1.none();
  }
  return effect_Option__rspack_import_1.some(effect_Tracer__rspack_import_2.externalSpan({
    traceId: headers["x-b3-traceid"],
    spanId: headers["x-b3-spanid"],
    sampled: headers["x-b3-sampled"] ? headers["x-b3-sampled"] === "1" : true
  }));
};
const w3cTraceId = /^[0-9a-f]{32}$/i;
const w3cSpanId = /^[0-9a-f]{16}$/i;
/**
 * @since 1.0.0
 * @category decoding
 */
const w3c = headers => {
  if (!headers["traceparent"]) {
    return effect_Option__rspack_import_1.none();
  }
  const parts = headers["traceparent"].split("-");
  if (parts.length !== 4) {
    return effect_Option__rspack_import_1.none();
  }
  const [version, traceId, spanId, flags] = parts;
  switch (version) {
    case "00":
      {
        if (w3cTraceId.test(traceId) === false || w3cSpanId.test(spanId) === false) {
          return effect_Option__rspack_import_1.none();
        }
        return effect_Option__rspack_import_1.some(effect_Tracer__rspack_import_2.externalSpan({
          traceId,
          spanId,
          sampled: (parseInt(flags, 16) & 1) === 1
        }));
      }
    default:
      {
        return effect_Option__rspack_import_1.none();
      }
  }
};
//# sourceMappingURL=HttpTraceContext.js.map

},
11672(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  append: () => (append),
  appendAll: () => (appendAll),
  empty: () => (empty),
  fromInput: () => (fromInput),
  getAll: () => (getAll),
  getFirst: () => (getFirst),
  getLast: () => (getLast),
  makeUrl: () => (makeUrl),
  remove: () => (remove),
  schemaFromSelf: () => (schemaFromSelf),
  schemaFromString: () => (schemaFromString),
  schemaJson: () => (schemaJson),
  schemaParse: () => (schemaParse),
  schemaRecord: () => (schemaRecord),
  schemaStruct: () => (schemaStruct),
  set: () => (set),
  setAll: () => (setAll),
  toRecord: () => (toRecord),
  toString: () => (toString)
});
/* import */ var effect_Array__rspack_import_0 = __webpack_require__(93118);
/* import */ var effect_Either__rspack_import_4 = __webpack_require__(53266);
/* import */ var effect_Function__rspack_import_2 = __webpack_require__(61279);
/* import */ var effect_Option__rspack_import_3 = __webpack_require__(31706);
/* import */ var effect_Schema__rspack_import_1 = __webpack_require__(9064);
/**
 * @since 1.0.0
 */





/**
 * @since 1.0.0
 * @category constructors
 */
const fromInput = input => {
  const parsed = fromInputNested(input);
  const out = [];
  for (let i = 0; i < parsed.length; i++) {
    if (Array.isArray(parsed[i][0])) {
      const [keys, value] = parsed[i];
      out.push([`${keys[0]}[${keys.slice(1).join("][")}]`, value]);
    } else {
      out.push(parsed[i]);
    }
  }
  return out;
};
const fromInputNested = input => {
  const entries = Symbol.iterator in input ? effect_Array__rspack_import_0.fromIterable(input) : Object.entries(input);
  const out = [];
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== undefined) {
          out.push([key, String(value[i])]);
        }
      }
    } else if (typeof value === "object") {
      const nested = fromInputNested(value);
      for (const [k, v] of nested) {
        out.push([[key, ...(typeof k === "string" ? [k] : k)], v]);
      }
    } else if (value !== undefined) {
      out.push([key, String(value)]);
    }
  }
  return out;
};
/**
 * @since 1.0.0
 * @category schemas
 */
const schemaFromSelf = /*#__PURE__*/effect_Schema__rspack_import_1.Array(effect_Schema__rspack_import_1.Tuple(effect_Schema__rspack_import_1.String, effect_Schema__rspack_import_1.String)).annotations({
  identifier: "UrlParams"
});
/**
 * @since 1.0.0
 * @category constructors
 */
const empty = [];
/**
 * @since 1.0.0
 * @category combinators
 */
const getAll = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, key) => effect_Array__rspack_import_0.reduce(self, [], (acc, [k, value]) => {
  if (k === key) {
    acc.push(value);
  }
  return acc;
}));
/**
 * @since 1.0.0
 * @category combinators
 */
const getFirst = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, key) => effect_Option__rspack_import_3.map(effect_Array__rspack_import_0.findFirst(self, ([k]) => k === key), ([, value]) => value));
/**
 * @since 1.0.0
 * @category combinators
 */
const getLast = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, key) => effect_Option__rspack_import_3.map(effect_Array__rspack_import_0.findLast(self, ([k]) => k === key), ([, value]) => value));
/**
 * @since 1.0.0
 * @category combinators
 */
const set = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(3, (self, key, value) => effect_Array__rspack_import_0.append(effect_Array__rspack_import_0.filter(self, ([k]) => k !== key), [key, String(value)]));
/**
 * @since 1.0.0
 * @category combinators
 */
const setAll = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, input) => {
  const out = fromInput(input);
  const keys = new Set();
  for (let i = 0; i < out.length; i++) {
    keys.add(out[i][0]);
  }
  for (let i = 0; i < self.length; i++) {
    if (keys.has(self[i][0])) continue;
    out.push(self[i]);
  }
  return out;
});
/**
 * @since 1.0.0
 * @category combinators
 */
const append = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(3, (self, key, value) => effect_Array__rspack_import_0.append(self, [key, String(value)]));
/**
 * @since 1.0.0
 * @category combinators
 */
const appendAll = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, input) => effect_Array__rspack_import_0.appendAll(self, fromInput(input)));
/**
 * @since 1.0.0
 * @category combinators
 */
const remove = /*#__PURE__*/(0,effect_Function__rspack_import_2.dual)(2, (self, key) => effect_Array__rspack_import_0.filter(self, ([k]) => k !== key));
/**
 * @since 1.0.0
 * @category conversions
 */
const makeUrl = (url, params, hash) => {
  try {
    const urlInstance = new URL(url, baseUrl());
    for (let i = 0; i < params.length; i++) {
      const [key, value] = params[i];
      if (value !== undefined) {
        urlInstance.searchParams.append(key, value);
      }
    }
    if (hash._tag === "Some") {
      urlInstance.hash = hash.value;
    }
    return effect_Either__rspack_import_4.right(urlInstance);
  } catch (e) {
    return effect_Either__rspack_import_4.left(e);
  }
};
/**
 * @since 1.0.0
 * @category conversions
 */
const toString = self => new URLSearchParams(self).toString();
const baseUrl = () => {
  if ("location" in globalThis && globalThis.location !== undefined && globalThis.location.origin !== undefined && globalThis.location.pathname !== undefined) {
    return location.origin + location.pathname;
  }
  return undefined;
};
/**
 * Builds a `Record` containing all the key-value pairs in the given `UrlParams`
 * as `string` (if only one value for a key) or a `NonEmptyArray<string>`
 * (when more than one value for a key)
 *
 * **Example**
 *
 * ```ts
 * import * as assert from "node:assert"
 * import { UrlParams } from "@effect/platform"
 *
 * const urlParams = UrlParams.fromInput({ a: 1, b: true, c: "string", e: [1, 2, 3] })
 * const result = UrlParams.toRecord(urlParams)
 *
 * assert.deepStrictEqual(
 *   result,
 *   { "a": "1", "b": "true", "c": "string", "e": ["1", "2", "3"] }
 * )
 * ```
 *
 * @since 1.0.0
 * @category conversions
 */
const toRecord = self => {
  const out = Object.create(null);
  for (const [k, value] of self) {
    const curr = out[k];
    if (curr === undefined) {
      out[k] = value;
    } else if (typeof curr === "string") {
      out[k] = [curr, value];
    } else {
      curr.push(value);
    }
  }
  return {
    ...out
  };
};
/**
 * @since 1.0.0
 * @category schema
 */
const schemaJson = (schema, options) => {
  const parse = effect_Schema__rspack_import_1.decodeUnknown(effect_Schema__rspack_import_1.parseJson(schema), options);
  return (0,effect_Function__rspack_import_2.dual)(2, (self, field) => parse(effect_Option__rspack_import_3.getOrElse(getLast(self, field), () => "")));
};
/**
 * Extract schema from all key-value pairs in the given `UrlParams`.
 *
 * **Example**
 *
 * ```ts
 * import * as assert from "node:assert"
 * import { Effect, Schema } from "effect"
 * import { UrlParams } from "@effect/platform"
 *
 * Effect.gen(function* () {
 *   const urlParams = UrlParams.fromInput({ "a": [10, "string"], "b": false })
 *   const result = yield* UrlParams.schemaStruct(Schema.Struct({
 *     a: Schema.Tuple(Schema.NumberFromString, Schema.String),
 *     b: Schema.BooleanFromString
 *   }))(urlParams)
 *
 *   assert.deepStrictEqual(result, {
 *     a: [10, "string"],
 *     b: false
 *   })
 * })
 * ```
 *
 * @since 1.0.0
 * @category schema
 */
const schemaStruct = (schema, options) => self => {
  const parse = effect_Schema__rspack_import_1.decodeUnknown(schema, options);
  return parse(toRecord(self));
};
/**
 * @since 1.0.0
 * @category schema
 */
const schemaFromString = /*#__PURE__*/effect_Schema__rspack_import_1.transform(effect_Schema__rspack_import_1.String, schemaFromSelf, {
  decode(fromA) {
    return fromInput(new URLSearchParams(fromA));
  },
  encode(toI) {
    return toString(toI);
  }
});
/**
 * @since 1.0.0
 * @category schema
 */
const schemaRecord = schema => effect_Schema__rspack_import_1.transform(schemaFromSelf, schema, {
  decode(fromA) {
    return toRecord(fromA);
  },
  encode(toI) {
    return fromInput(toI);
  }
});
/**
 * @since 1.0.0
 * @category schema
 */
const schemaParse = schema => effect_Schema__rspack_import_1.compose(schemaFromString, schemaRecord(schema));
//# sourceMappingURL=UrlParams.js.map

},
59045(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  Ie: () => (empty),
  NJ: () => (file),
  Og: () => (jsonSchema),
  P8: () => (fileWeb),
  Pq: () => (json),
  Qq: () => (text),
  Td: () => (stream),
  XE: () => (fileInfo),
  ZN: () => (formData),
  _S: () => (urlParams),
  gT: () => (ErrorTypeId),
  hQ: () => (HttpBodyError),
  ii: () => (TypeId),
  jz: () => (unsafeJson),
  lS: () => (raw),
  uv: () => (formDataRecord),
  wF: () => (uint8Array)
});
/* import */ var effect_Data__rspack_import_0 = __webpack_require__(65279);
/* import */ var effect_Effect__rspack_import_2 = __webpack_require__(46330);
/* import */ var effect_Function__rspack_import_7 = __webpack_require__(61279);
/* import */ var effect_Inspectable__rspack_import_1 = __webpack_require__(65051);
/* import */ var effect_Schema__rspack_import_4 = __webpack_require__(9064);
/* import */ var effect_Stream__rspack_import_6 = __webpack_require__(14287);
/* import */ var _FileSystem_js__rspack_import_5 = __webpack_require__(7096);
/* import */ var _UrlParams_js__rspack_import_3 = __webpack_require__(11672);








/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpBody");
/** @internal */
const ErrorTypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpBody/HttpBodyError");
const bodyError = /*#__PURE__*/effect_Data__rspack_import_0.tagged("HttpBodyError");
/** @internal */
const HttpBodyError = reason => bodyError({
  [ErrorTypeId]: ErrorTypeId,
  reason
});
class BodyBase {
  [TypeId];
  constructor() {
    this[TypeId] = TypeId;
  }
  [effect_Inspectable__rspack_import_1.NodeInspectSymbol]() {
    return this.toJSON();
  }
  toString() {
    return effect_Inspectable__rspack_import_1.format(this);
  }
}
class EmptyImpl extends BodyBase {
  _tag = "Empty";
  toJSON() {
    return {
      _id: "@effect/platform/HttpBody",
      _tag: "Empty"
    };
  }
}
/** @internal */
const empty = /*#__PURE__*/new EmptyImpl();
class RawImpl extends BodyBase {
  body;
  contentType;
  contentLength;
  _tag = "Raw";
  constructor(body, contentType, contentLength) {
    super();
    this.body = body;
    this.contentType = contentType;
    this.contentLength = contentLength;
  }
  toJSON() {
    return {
      _id: "@effect/platform/HttpBody",
      _tag: "Raw",
      body: this.body,
      contentType: this.contentType,
      contentLength: this.contentLength
    };
  }
}
/** @internal */
const raw = (body, options) => new RawImpl(body, options?.contentType, options?.contentLength);
class Uint8ArrayImpl extends BodyBase {
  body;
  contentType;
  _tag = "Uint8Array";
  constructor(body, contentType) {
    super();
    this.body = body;
    this.contentType = contentType;
  }
  get contentLength() {
    return this.body.length;
  }
  toJSON() {
    const toString = this.contentType.startsWith("text/") || this.contentType.endsWith("json");
    return {
      _id: "@effect/platform/HttpBody",
      _tag: "Uint8Array",
      body: toString ? new TextDecoder().decode(this.body) : `Uint8Array(${this.body.length})`,
      contentType: this.contentType,
      contentLength: this.contentLength
    };
  }
}
/** @internal */
const uint8Array = (body, contentType) => new Uint8ArrayImpl(body, contentType ?? "application/octet-stream");
const encoder = /*#__PURE__*/new TextEncoder();
/** @internal */
const text = (body, contentType) => uint8Array(encoder.encode(body), contentType ?? "text/plain");
/** @internal */
const unsafeJson = (body, contentType) => text(JSON.stringify(body), contentType ?? "application/json");
/** @internal */
const json = (body, contentType) => effect_Effect__rspack_import_2["try"]({
  try: () => unsafeJson(body, contentType),
  catch: error => HttpBodyError({
    _tag: "JsonError",
    error
  })
});
/** @internal */
const urlParams = (urlParams, contentType) => text(_UrlParams_js__rspack_import_3.toString(urlParams), contentType ?? "application/x-www-form-urlencoded");
/** @internal */
const jsonSchema = (schema, options) => {
  const encode = effect_Schema__rspack_import_4.encode(schema, options);
  return (body, contentType) => effect_Effect__rspack_import_2.flatMap(effect_Effect__rspack_import_2.mapError(encode(body), error => HttpBodyError({
    _tag: "SchemaError",
    error
  })), body => json(body, contentType));
};
/** @internal */
const file = (path, options) => effect_Effect__rspack_import_2.flatMap(_FileSystem_js__rspack_import_5.FileSystem, fs => effect_Effect__rspack_import_2.map(fs.stat(path), info => stream(fs.stream(path, options), options?.contentType, Number(info.size))));
/** @internal */
const fileInfo = (path, info, options) => effect_Effect__rspack_import_2.map(_FileSystem_js__rspack_import_5.FileSystem, fs => stream(fs.stream(path, options), options?.contentType, Number(info.size)));
/** @internal */
const fileWeb = file => stream(effect_Stream__rspack_import_6.fromReadableStream(() => file.stream(), effect_Function__rspack_import_7.identity), file.type, file.size);
class FormDataImpl extends BodyBase {
  formData;
  _tag = "FormData";
  constructor(formData) {
    super();
    this.formData = formData;
  }
  toJSON() {
    return {
      _id: "@effect/platform/HttpBody",
      _tag: "FormData",
      formData: this.formData
    };
  }
}
/** @internal */
const formData = body => new FormDataImpl(body);
/** @internal */
const formDataRecord = entries => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null) continue;
        formData.append(key, typeof value === "object" ? item : String(item));
      }
    } else if (value != null) {
      formData.append(key, typeof value === "object" ? value : String(value));
    }
  }
  return new FormDataImpl(formData);
};
class StreamImpl extends BodyBase {
  stream;
  contentType;
  contentLength;
  _tag = "Stream";
  constructor(stream, contentType, contentLength) {
    super();
    this.stream = stream;
    this.contentType = contentType;
    this.contentLength = contentLength;
  }
  toJSON() {
    return {
      _id: "@effect/platform/HttpBody",
      _tag: "Stream",
      contentType: this.contentType,
      contentLength: this.contentLength
    };
  }
}
/** @internal */
const stream = (body, contentType, contentLength) => new StreamImpl(body, contentType ?? "application/octet-stream", contentLength);
//# sourceMappingURL=httpBody.js.map

},
78158(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  $T: () => (layerMergedContext),
  F6: () => (patch),
  FE: () => (followRedirects),
  Hv: () => (withCookiesRef),
  Jt: () => (get),
  Ku: () => (catchTag),
  L4: () => (mapRequestInputEffect),
  L5: () => (retry),
  L8: () => (make),
  Mi: () => (tap),
  Pm: () => (filterOrElse),
  Qe: () => (withTracerPropagation),
  SA: () => (transformResponse),
  Tc: () => (tag),
  W$: () => (filterOrFail),
  WR: () => (mapRequest),
  bE: () => (post),
  d5: () => (head),
  dF: () => (tapRequest),
  ex: () => (mapRequestInput),
  fF: () => (options),
  g7: () => (execute),
  h9: () => (catchAll),
  ii: () => (TypeId),
  j4: () => (currentTracerDisabledWhen),
  jh: () => (retryTransient),
  lh: () => (makeWith),
  lo: () => (catchTags),
  p$: () => (filterStatusOk),
  pd: () => (transform),
  rg: () => (SpanNameGenerator),
  sF: () => (tapError),
  ti: () => (filterStatus),
  tn: () => (mapRequestEffect),
  v4: () => (withScope),
  vs: () => (currentTracerPropagation),
  y4: () => (withTracerDisabledWhen),
  yH: () => (del),
  yJ: () => (put),
  zO: () => (withSpanNameGenerator)
});
/* import */ var effect_Cause__rspack_import_11 = __webpack_require__(56560);
/* import */ var effect_Context__rspack_import_0 = __webpack_require__(50256);
/* import */ var effect_Effect__rspack_import_4 = __webpack_require__(46330);
/* import */ var effect_FiberRef__rspack_import_2 = __webpack_require__(68792);
/* import */ var effect_Function__rspack_import_3 = __webpack_require__(61279);
/* import */ var effect_GlobalValue__rspack_import_1 = __webpack_require__(9091);
/* import */ var effect_Inspectable__rspack_import_6 = __webpack_require__(65051);
/* import */ var effect_Layer__rspack_import_21 = __webpack_require__(78518);
/* import */ var effect_Pipeable__rspack_import_5 = __webpack_require__(79083);
/* import */ var effect_Predicate__rspack_import_8 = __webpack_require__(35034);
/* import */ var effect_Ref__rspack_import_19 = __webpack_require__(83614);
/* import */ var effect_Schedule__rspack_import_18 = __webpack_require__(34222);
/* import */ var effect_Scope__rspack_import_17 = __webpack_require__(90555);
/* import */ var effect_Stream__rspack_import_16 = __webpack_require__(14287);
/* import */ var _Cookies_js__rspack_import_20 = __webpack_require__(63744);
/* import */ var _Headers_js__rspack_import_12 = __webpack_require__(22649);
/* import */ var _HttpClientError_js__rspack_import_10 = __webpack_require__(46400);
/* import */ var _HttpIncomingMessage_js__rspack_import_15 = __webpack_require__(1116);
/* import */ var _HttpTraceContext_js__rspack_import_13 = __webpack_require__(67459);
/* import */ var _UrlParams_js__rspack_import_9 = __webpack_require__(11672);
/* import */ var _httpClientRequest_js__rspack_import_7 = __webpack_require__(20165);
/* import */ var _httpClientResponse_js__rspack_import_14 = __webpack_require__(87713);






















const ATTR_HTTP_REQUEST_HEADER = key => `http.request.header.${key}`;
const ATTR_HTTP_REQUEST_METHOD = "http.request.method";
const ATTR_HTTP_RESPONSE_HEADER = key => `http.response.header.${key}`;
const ATTR_HTTP_RESPONSE_STATUS_CODE = "http.response.status_code";
const ATTR_SERVER_ADDRESS = "server.address";
const ATTR_SERVER_PORT = "server.port";
const ATTR_URL_FULL = "url.full";
const ATTR_URL_PATH = "url.path";
const ATTR_URL_SCHEME = "url.scheme";
const ATTR_URL_QUERY = "url.query";
/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpClient");
/** @internal */
const tag = /*#__PURE__*/effect_Context__rspack_import_0.GenericTag("@effect/platform/HttpClient");
/** @internal */
const currentTracerDisabledWhen = /*#__PURE__*/(0,effect_GlobalValue__rspack_import_1.globalValue)(/*#__PURE__*/Symbol.for("@effect/platform/HttpClient/tracerDisabledWhen"), () => effect_FiberRef__rspack_import_2.unsafeMake(effect_Function__rspack_import_3.constFalse));
/** @internal */
const withTracerDisabledWhen = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, pred) => transformResponse(self, effect_Effect__rspack_import_4.locally(currentTracerDisabledWhen, pred)));
/** @internal */
const currentTracerPropagation = /*#__PURE__*/(0,effect_GlobalValue__rspack_import_1.globalValue)(/*#__PURE__*/Symbol.for("@effect/platform/HttpClient/currentTracerPropagation"), () => effect_FiberRef__rspack_import_2.unsafeMake(true));
/** @internal */
const withTracerPropagation = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, enabled) => transformResponse(self, effect_Effect__rspack_import_4.locally(currentTracerPropagation, enabled)));
/** @internal */
const SpanNameGenerator = /*#__PURE__*/effect_Context__rspack_import_0.Reference()("@effect/platform/HttpClient/SpanNameGenerator", {
  defaultValue: () => request => `http.client ${request.method}`
});
/** @internal */
const withSpanNameGenerator = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => transformResponse(self, effect_Effect__rspack_import_4.provideService(SpanNameGenerator, f)));
const ClientProto = {
  [TypeId]: TypeId,
  pipe() {
    return (0,effect_Pipeable__rspack_import_5.pipeArguments)(this, arguments);
  },
  ...effect_Inspectable__rspack_import_6.BaseProto,
  toJSON() {
    return {
      _id: "@effect/platform/HttpClient"
    };
  },
  get(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .get */.Jt(url, options));
  },
  head(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .head */.d5(url, options));
  },
  post(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .post */.bE(url, options));
  },
  put(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .put */.yJ(url, options));
  },
  patch(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .patch */.F6(url, options));
  },
  del(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .del */.yH(url, options));
  },
  options(url, options) {
    return this.execute(_httpClientRequest_js__rspack_import_7/* .options */.fF(url, options));
  }
};
const isClient = u => effect_Predicate__rspack_import_8.hasProperty(u, TypeId);
/** @internal */
const makeWith = (postprocess, preprocess) => {
  const self = Object.create(ClientProto);
  self.preprocess = preprocess;
  self.postprocess = postprocess;
  self.execute = function (request) {
    return postprocess(preprocess(request));
  };
  return self;
};
const responseRegistry = /*#__PURE__*/(0,effect_GlobalValue__rspack_import_1.globalValue)("@effect/platform/HttpClient/responseRegistry", () => {
  if ("FinalizationRegistry" in globalThis && globalThis.FinalizationRegistry) {
    const registry = new FinalizationRegistry(controller => {
      controller.abort();
    });
    return {
      register(response, controller) {
        registry.register(response, controller, response);
      },
      unregister(response) {
        registry.unregister(response);
      }
    };
  }
  const timers = new Map();
  return {
    register(response, controller) {
      timers.set(response, setTimeout(() => controller.abort(), 5000));
    },
    unregister(response) {
      const timer = timers.get(response);
      if (timer === undefined) return;
      clearTimeout(timer);
      timers.delete(response);
    }
  };
});
const scopedRequests = /*#__PURE__*/(0,effect_GlobalValue__rspack_import_1.globalValue)("@effect/platform/HttpClient/scopedRequests", () => new WeakMap());
/** @internal */
const make = f => makeWith(effect => effect_Effect__rspack_import_4.flatMap(effect, request => effect_Effect__rspack_import_4.withFiberRuntime(fiber => {
  const scopedController = scopedRequests.get(request);
  const controller = scopedController ?? new AbortController();
  const urlResult = _UrlParams_js__rspack_import_9.makeUrl(request.url, request.urlParams, request.hash);
  if (urlResult._tag === "Left") {
    return effect_Effect__rspack_import_4.fail(new _HttpClientError_js__rspack_import_10.RequestError({
      request,
      reason: "InvalidUrl",
      cause: urlResult.left
    }));
  }
  const url = urlResult.right;
  const tracerDisabled = !fiber.getFiberRef(effect_FiberRef__rspack_import_2.currentTracerEnabled) || fiber.getFiberRef(currentTracerDisabledWhen)(request);
  if (tracerDisabled) {
    const effect = f(request, url, controller.signal, fiber);
    if (scopedController) return effect;
    return effect_Effect__rspack_import_4.uninterruptibleMask(restore => effect_Effect__rspack_import_4.matchCauseEffect(restore(effect), {
      onSuccess(response) {
        responseRegistry.register(response, controller);
        return effect_Effect__rspack_import_4.succeed(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (effect_Cause__rspack_import_11.isInterrupted(cause)) {
          controller.abort();
        }
        return effect_Effect__rspack_import_4.failCause(cause);
      }
    }));
  }
  const nameGenerator = effect_Context__rspack_import_0.get(fiber.currentContext, SpanNameGenerator);
  return effect_Effect__rspack_import_4.useSpan(nameGenerator(request), {
    kind: "client",
    captureStackTrace: false
  }, span => {
    span.attribute(ATTR_HTTP_REQUEST_METHOD, request.method);
    span.attribute(ATTR_SERVER_ADDRESS, url.origin);
    if (url.port !== "") {
      span.attribute(ATTR_SERVER_PORT, +url.port);
    }
    span.attribute(ATTR_URL_FULL, url.toString());
    span.attribute(ATTR_URL_PATH, url.pathname);
    span.attribute(ATTR_URL_SCHEME, url.protocol.slice(0, -1));
    const query = url.search.slice(1);
    if (query !== "") {
      span.attribute(ATTR_URL_QUERY, query);
    }
    const redactedHeaderNames = fiber.getFiberRef(_Headers_js__rspack_import_12.currentRedactedNames);
    const redactedHeaders = _Headers_js__rspack_import_12.redact(request.headers, redactedHeaderNames);
    for (const name in redactedHeaders) {
      span.attribute(ATTR_HTTP_REQUEST_HEADER(name), String(redactedHeaders[name]));
    }
    request = fiber.getFiberRef(currentTracerPropagation) ? _httpClientRequest_js__rspack_import_7/* .setHeaders */.lL(request, _HttpTraceContext_js__rspack_import_13.toHeaders(span)) : request;
    return effect_Effect__rspack_import_4.uninterruptibleMask(restore => restore(f(request, url, controller.signal, fiber)).pipe(effect_Effect__rspack_import_4.withParentSpan(span), effect_Effect__rspack_import_4.matchCauseEffect({
      onSuccess: response => {
        span.attribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
        const redactedHeaders = _Headers_js__rspack_import_12.redact(response.headers, redactedHeaderNames);
        for (const name in redactedHeaders) {
          span.attribute(ATTR_HTTP_RESPONSE_HEADER(name), String(redactedHeaders[name]));
        }
        if (scopedController) return effect_Effect__rspack_import_4.succeed(response);
        responseRegistry.register(response, controller);
        return effect_Effect__rspack_import_4.succeed(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (!scopedController && effect_Cause__rspack_import_11.isInterrupted(cause)) {
          controller.abort();
        }
        return effect_Effect__rspack_import_4.failCause(cause);
      }
    })));
  });
})), effect_Effect__rspack_import_4.succeed);
class InterruptibleResponse {
  original;
  controller;
  constructor(original, controller) {
    this.original = original;
    this.controller = controller;
  }
  [_httpClientResponse_js__rspack_import_14/* .TypeId */.ii] = _httpClientResponse_js__rspack_import_14/* .TypeId */.ii;
  [_HttpIncomingMessage_js__rspack_import_15.TypeId] = _HttpIncomingMessage_js__rspack_import_15.TypeId;
  applyInterrupt(effect) {
    return effect_Effect__rspack_import_4.suspend(() => {
      responseRegistry.unregister(this.original);
      return effect_Effect__rspack_import_4.onInterrupt(effect, () => effect_Effect__rspack_import_4.sync(() => {
        this.controller.abort();
      }));
    });
  }
  get request() {
    return this.original.request;
  }
  get status() {
    return this.original.status;
  }
  get headers() {
    return this.original.headers;
  }
  get cookies() {
    return this.original.cookies;
  }
  get remoteAddress() {
    return this.original.remoteAddress;
  }
  get formData() {
    return this.applyInterrupt(this.original.formData);
  }
  get text() {
    return this.applyInterrupt(this.original.text);
  }
  get json() {
    return this.applyInterrupt(this.original.json);
  }
  get urlParamsBody() {
    return this.applyInterrupt(this.original.urlParamsBody);
  }
  get arrayBuffer() {
    return this.applyInterrupt(this.original.arrayBuffer);
  }
  get stream() {
    return effect_Stream__rspack_import_16.suspend(() => {
      responseRegistry.unregister(this.original);
      return effect_Stream__rspack_import_16.ensuring(this.original.stream, effect_Effect__rspack_import_4.sync(() => {
        this.controller.abort();
      }));
    });
  }
  toJSON() {
    return this.original.toJSON();
  }
  [effect_Inspectable__rspack_import_6.NodeInspectSymbol]() {
    return this.original[effect_Inspectable__rspack_import_6.NodeInspectSymbol]();
  }
}
/** @internal */
const withScope = self => transform(self, (effect, request) => {
  const controller = new AbortController();
  scopedRequests.set(request, controller);
  return effect_Effect__rspack_import_4.zipRight(effect_Effect__rspack_import_4.scopeWith(scope => effect_Scope__rspack_import_17.addFinalizer(scope, effect_Effect__rspack_import_4.sync(() => controller.abort()))), effect);
});
const {
  /** @internal */
  del,
  /** @internal */
  execute,
  /** @internal */
  get,
  /** @internal */
  head,
  /** @internal */
  options,
  /** @internal */
  patch,
  /** @internal */
  post,
  /** @internal */
  put
} = /*#__PURE__*/effect_Effect__rspack_import_4.serviceFunctions(tag);
/** @internal */
const transform = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(effect_Effect__rspack_import_4.flatMap(request => f(client.postprocess(effect_Effect__rspack_import_4.succeed(request)), request)), client.preprocess);
});
/** @internal */
const filterStatus = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => transformResponse(self, effect_Effect__rspack_import_4.flatMap(_httpClientResponse_js__rspack_import_14/* .filterStatus */.ti(f))));
/** @internal */
const filterStatusOk = self => transformResponse(self, effect_Effect__rspack_import_4.flatMap(_httpClientResponse_js__rspack_import_14/* .filterStatusOk */.p$));
/** @internal */
const transformResponse = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(request => f(client.postprocess(request)), client.preprocess);
});
/** @internal */
const catchTag = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(3, (self, tag, f) => transformResponse(self, effect_Effect__rspack_import_4.catchTag(tag, f)));
/** @internal */
const catchTags = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, cases) => transformResponse(self, effect_Effect__rspack_import_4.catchTags(cases)));
/** @internal */
const catchAll = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => transformResponse(self, effect_Effect__rspack_import_4.catchAll(f)));
/** @internal */
const filterOrElse = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(3, (self, f, orElse) => transformResponse(self, effect_Effect__rspack_import_4.filterOrElse(f, orElse)));
/** @internal */
const filterOrFail = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(3, (self, f, orFailWith) => transformResponse(self, effect_Effect__rspack_import_4.filterOrFail(f, orFailWith)));
/** @internal */
const mapRequest = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(client.postprocess, request => effect_Effect__rspack_import_4.map(client.preprocess(request), f));
});
/** @internal */
const mapRequestEffect = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(client.postprocess, request => effect_Effect__rspack_import_4.flatMap(client.preprocess(request), f));
});
/** @internal */
const mapRequestInput = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(client.postprocess, request => client.preprocess(f(request)));
});
/** @internal */
const mapRequestInputEffect = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(client.postprocess, request => effect_Effect__rspack_import_4.flatMap(f(request), client.preprocess));
});
/** @internal */
const retry = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, policy) => transformResponse(self, effect_Effect__rspack_import_4.retry(policy)));
/** @internal */
const retryTransient = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, options) => {
  const isOnlySchedule = effect_Schedule__rspack_import_18.ScheduleTypeId in options;
  const mode = isOnlySchedule ? "both" : options.mode ?? "both";
  const schedule = isOnlySchedule ? options : options.schedule;
  const passthroughSchedule = schedule && effect_Schedule__rspack_import_18.passthrough(schedule);
  const times = isOnlySchedule ? undefined : options.times;
  return transformResponse(self, (0,effect_Function__rspack_import_3.flow)(mode === "errors-only" ? effect_Function__rspack_import_3.identity : effect_Effect__rspack_import_4.repeat({
    schedule: passthroughSchedule,
    times,
    while: isTransientResponse
  }), mode === "response-only" ? effect_Function__rspack_import_3.identity : effect_Effect__rspack_import_4.retry({
    while: isOnlySchedule || options.while === undefined ? isTransientError : effect_Predicate__rspack_import_8.or(isTransientError, options.while),
    schedule,
    times
  })));
});
const isTransientError = error => effect_Predicate__rspack_import_8.hasProperty(error, effect_Cause__rspack_import_11.TimeoutExceptionTypeId) || isTransientHttpError(error);
const isTransientHttpError = error => _HttpClientError_js__rspack_import_10.isHttpClientError(error) && (error._tag === "RequestError" && error.reason === "Transport" || error._tag === "ResponseError" && isTransientResponse(error.response));
const isTransientResponse = response => response.status === 408 || response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
/** @internal */
const tap = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => transformResponse(self, effect_Effect__rspack_import_4.tap(f)));
/** @internal */
const tapError = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => transformResponse(self, effect_Effect__rspack_import_4.tapError(f)));
/** @internal */
const tapRequest = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, f) => {
  const client = self;
  return makeWith(client.postprocess, request => effect_Effect__rspack_import_4.tap(client.preprocess(request), f));
});
/** @internal */
const withCookiesRef = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(2, (self, ref) => {
  const client = self;
  return makeWith(request => effect_Effect__rspack_import_4.tap(client.postprocess(request), response => effect_Ref__rspack_import_19.update(ref, cookies => _Cookies_js__rspack_import_20.merge(cookies, response.cookies))), request => effect_Effect__rspack_import_4.flatMap(client.preprocess(request), request => effect_Effect__rspack_import_4.map(effect_Ref__rspack_import_19.get(ref), cookies => _Cookies_js__rspack_import_20.isEmpty(cookies) ? request : _httpClientRequest_js__rspack_import_7/* .setHeader */.WH(request, "cookie", _Cookies_js__rspack_import_20.toCookieHeader(cookies)))));
});
/** @internal */
const followRedirects = /*#__PURE__*/(0,effect_Function__rspack_import_3.dual)(args => isClient(args[0]), (self, maxRedirects) => {
  const client = self;
  return makeWith(request => {
    const loop = (request, redirects) => effect_Effect__rspack_import_4.flatMap(client.postprocess(effect_Effect__rspack_import_4.succeed(request)), response => response.status >= 300 && response.status < 400 && response.headers.location && redirects < (maxRedirects ?? 10) ? loop(_httpClientRequest_js__rspack_import_7/* .setUrl */.cV(request, new URL(response.headers.location, response.request.url)), redirects + 1) : effect_Effect__rspack_import_4.succeed(response));
    return effect_Effect__rspack_import_4.flatMap(request, request => loop(request, 0));
  }, client.preprocess);
});
/** @internal */
const layerMergedContext = effect => effect_Layer__rspack_import_21.effect(tag, effect_Effect__rspack_import_4.flatMap(effect_Effect__rspack_import_4.context(), context => effect_Effect__rspack_import_4.map(effect, client => transformResponse(client, effect_Effect__rspack_import_4.mapInputContext(input => effect_Context__rspack_import_0.merge(context, input))))));
//# sourceMappingURL=httpClient.js.map

},
20165(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  Bg: () => (setUrlParam),
  Dc: () => (appendUrlParam),
  EZ: () => (appendUrlParams),
  F6: () => (patch),
  G3: () => (bodyText),
  JP: () => (modify),
  Jt: () => (get),
  Ju: () => (accept),
  L8: () => (make),
  TK: () => (acceptJson),
  U0: () => (setMethod),
  WH: () => (setHeader),
  XL: () => (bodyStream),
  _u: () => (schemaBodyJson),
  bE: () => (post),
  bb: () => (toUrl),
  bj: () => (updateUrl),
  c5: () => (prependUrl),
  cV: () => (setUrl),
  d5: () => (head),
  fF: () => (options),
  fr: () => (removeHash),
  hC: () => (bearerToken),
  hd: () => (setHash),
  hx: () => (bodyFileWeb),
  i9: () => (appendUrl),
  jH: () => (bodyUnsafeJson),
  ju: () => (setBody),
  lL: () => (setHeaders),
  m5: () => (bodyFormDataRecord),
  p1: () => (bodyFormData),
  pF: () => (bodyFile),
  tB: () => (basicAuth),
  uR: () => (setUrlParams),
  wb: () => (bodyUrlParams),
  yH: () => (del),
  yJ: () => (put),
  yK: () => (bodyUint8Array),
  zW: () => (bodyJson)
});
/* import */ var effect_Effect__rspack_import_9 = __webpack_require__(46330);
/* import */ var effect_Either__rspack_import_8 = __webpack_require__(53266);
/* import */ var effect_Function__rspack_import_6 = __webpack_require__(61279);
/* import */ var effect_Inspectable__rspack_import_0 = __webpack_require__(65051);
/* import */ var effect_Option__rspack_import_3 = __webpack_require__(31706);
/* import */ var effect_Pipeable__rspack_import_1 = __webpack_require__(79083);
/* import */ var effect_Redacted__rspack_import_7 = __webpack_require__(66707);
/* import */ var _Headers_js__rspack_import_4 = __webpack_require__(22649);
/* import */ var _UrlParams_js__rspack_import_2 = __webpack_require__(11672);
/* import */ var _httpBody_js__rspack_import_5 = __webpack_require__(59045);










/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpClientRequest");
const Proto = {
  [TypeId]: TypeId,
  ...effect_Inspectable__rspack_import_0.BaseProto,
  toJSON() {
    return {
      _id: "@effect/platform/HttpClientRequest",
      method: this.method,
      url: this.url,
      urlParams: this.urlParams,
      hash: this.hash,
      headers: effect_Inspectable__rspack_import_0.redact(this.headers),
      body: this.body.toJSON()
    };
  },
  pipe() {
    return (0,effect_Pipeable__rspack_import_1.pipeArguments)(this, arguments);
  }
};
function makeInternal(method, url, urlParams, hash, headers, body) {
  const self = Object.create(Proto);
  self.method = method;
  self.url = url;
  self.urlParams = urlParams;
  self.hash = hash;
  self.headers = headers;
  self.body = body;
  return self;
}
/** @internal */
const isClientRequest = u => typeof u === "object" && u !== null && TypeId in u;
/** @internal */
const empty = /*#__PURE__*/makeInternal("GET", "", _UrlParams_js__rspack_import_2.empty, /*#__PURE__*/effect_Option__rspack_import_3.none(), _Headers_js__rspack_import_4.empty, _httpBody_js__rspack_import_5/* .empty */.Ie);
/** @internal */
const make = method => (url, options) => modify(empty, {
  method,
  url,
  ...(options ?? undefined)
});
/** @internal */
const get = /*#__PURE__*/make("GET");
/** @internal */
const post = /*#__PURE__*/make("POST");
/** @internal */
const put = /*#__PURE__*/make("PUT");
/** @internal */
const patch = /*#__PURE__*/make("PATCH");
/** @internal */
const del = /*#__PURE__*/make("DELETE");
/** @internal */
const head = /*#__PURE__*/make("HEAD");
/** @internal */
const options = /*#__PURE__*/make("OPTIONS");
/** @internal */
const modify = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, options) => {
  let result = self;
  if (options.method) {
    result = setMethod(result, options.method);
  }
  if (options.url) {
    result = setUrl(result, options.url);
  }
  if (options.headers) {
    result = setHeaders(result, options.headers);
  }
  if (options.urlParams) {
    result = setUrlParams(result, options.urlParams);
  }
  if (options.hash) {
    result = setHash(result, options.hash);
  }
  if (options.body) {
    result = setBody(result, options.body);
  }
  if (options.accept) {
    result = accept(result, options.accept);
  }
  if (options.acceptJson) {
    result = acceptJson(result);
  }
  return result;
});
/** @internal */
const setHeader = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(3, (self, key, value) => makeInternal(self.method, self.url, self.urlParams, self.hash, _Headers_js__rspack_import_4.set(self.headers, key, value), self.body));
/** @internal */
const setHeaders = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, input) => makeInternal(self.method, self.url, self.urlParams, self.hash, _Headers_js__rspack_import_4.setAll(self.headers, input), self.body));
const stringOrRedacted = value => typeof value === "string" ? value : effect_Redacted__rspack_import_7.value(value);
/** @internal */
const basicAuth = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(3, (self, username, password) => setHeader(self, "Authorization", `Basic ${btoa(`${stringOrRedacted(username)}:${stringOrRedacted(password)}`)}`));
/** @internal */
const bearerToken = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, token) => setHeader(self, "Authorization", `Bearer ${stringOrRedacted(token)}`));
/** @internal */
const accept = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, mediaType) => setHeader(self, "Accept", mediaType));
/** @internal */
const acceptJson = /*#__PURE__*/accept("application/json");
/** @internal */
const setMethod = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, method) => makeInternal(method, self.url, self.urlParams, self.hash, self.headers, self.body));
/** @internal */
const setUrl = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, url) => {
  if (typeof url === "string") {
    return makeInternal(self.method, url, self.urlParams, self.hash, self.headers, self.body);
  }
  const clone = new URL(url.toString());
  const urlParams = _UrlParams_js__rspack_import_2.fromInput(clone.searchParams);
  const hash = clone.hash ? effect_Option__rspack_import_3.some(clone.hash.slice(1)) : effect_Option__rspack_import_3.none();
  clone.search = "";
  clone.hash = "";
  return makeInternal(self.method, clone.toString(), urlParams, hash, self.headers, self.body);
});
/** @internal */
const appendUrl = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, path) => {
  if (path === "") {
    return self;
  }
  const baseUrl = self.url.endsWith("/") ? self.url : self.url + "/";
  const pathSegment = path.startsWith("/") ? path.slice(1) : path;
  return makeInternal(self.method, baseUrl + pathSegment, self.urlParams, self.hash, self.headers, self.body);
});
/** @internal */
const prependUrl = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, url) => makeInternal(self.method, url.endsWith("/") && self.url.startsWith("/") ? url + self.url.slice(1) : url + self.url, self.urlParams, self.hash, self.headers, self.body));
/** @internal */
const updateUrl = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, f) => makeInternal(self.method, f(self.url), self.urlParams, self.hash, self.headers, self.body));
/** @internal */
const appendUrlParam = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(3, (self, key, value) => makeInternal(self.method, self.url, _UrlParams_js__rspack_import_2.append(self.urlParams, key, value), self.hash, self.headers, self.body));
/** @internal */
const appendUrlParams = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, input) => makeInternal(self.method, self.url, _UrlParams_js__rspack_import_2.appendAll(self.urlParams, input), self.hash, self.headers, self.body));
/** @internal */
const setUrlParam = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(3, (self, key, value) => makeInternal(self.method, self.url, _UrlParams_js__rspack_import_2.set(self.urlParams, key, value), self.hash, self.headers, self.body));
/** @internal */
const setUrlParams = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, input) => makeInternal(self.method, self.url, _UrlParams_js__rspack_import_2.setAll(self.urlParams, input), self.hash, self.headers, self.body));
/** @internal */
const setHash = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, hash) => makeInternal(self.method, self.url, self.urlParams, effect_Option__rspack_import_3.some(hash), self.headers, self.body));
/** @internal */
const removeHash = self => makeInternal(self.method, self.url, self.urlParams, effect_Option__rspack_import_3.none(), self.headers, self.body);
/** @internal */
const toUrl = self => effect_Either__rspack_import_8.getRight(_UrlParams_js__rspack_import_2.makeUrl(self.url, self.urlParams, self.hash));
/** @internal */
const setBody = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, body) => {
  let headers = self.headers;
  if (body._tag === "Empty" || body._tag === "FormData") {
    headers = _Headers_js__rspack_import_4.remove(headers, ["Content-type", "Content-length"]);
  } else {
    const contentType = body.contentType;
    if (contentType) {
      headers = _Headers_js__rspack_import_4.set(headers, "content-type", contentType);
    }
    const contentLength = body.contentLength;
    if (contentLength) {
      headers = _Headers_js__rspack_import_4.set(headers, "content-length", contentLength.toString());
    }
  }
  return makeInternal(self.method, self.url, self.urlParams, self.hash, headers, body);
});
/** @internal */
const bodyUint8Array = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(args => isClientRequest(args[0]), (self, body, contentType = "application/octet-stream") => setBody(self, _httpBody_js__rspack_import_5/* .uint8Array */.wF(body, contentType)));
/** @internal */
const bodyText = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(args => isClientRequest(args[0]), (self, body, contentType = "text/plain") => setBody(self, _httpBody_js__rspack_import_5/* .text */.Qq(body, contentType)));
/** @internal */
const bodyJson = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, body) => effect_Effect__rspack_import_9.map(_httpBody_js__rspack_import_5/* .json */.Pq(body), body => setBody(self, body)));
/** @internal */
const bodyUnsafeJson = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, body) => setBody(self, _httpBody_js__rspack_import_5/* .unsafeJson */.jz(body)));
/** @internal */
const bodyFile = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(args => isClientRequest(args[0]), (self, path, options) => effect_Effect__rspack_import_9.map(_httpBody_js__rspack_import_5/* .file */.NJ(path, options), body => setBody(self, body)));
/** @internal */
const bodyFileWeb = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, file) => setBody(self, _httpBody_js__rspack_import_5/* .fileWeb */.P8(file)));
/** @internal */
const schemaBodyJson = (schema, options) => {
  const encode = _httpBody_js__rspack_import_5/* .jsonSchema */.Og(schema, options);
  return (0,effect_Function__rspack_import_6.dual)(2, (self, body) => effect_Effect__rspack_import_9.map(encode(body), body => setBody(self, body)));
};
/** @internal */
const bodyUrlParams = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, body) => setBody(self, _httpBody_js__rspack_import_5/* .text */.Qq(_UrlParams_js__rspack_import_2.toString(_UrlParams_js__rspack_import_2.fromInput(body)), "application/x-www-form-urlencoded")));
/** @internal */
const bodyFormData = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, body) => setBody(self, _httpBody_js__rspack_import_5/* .formData */.ZN(body)));
/** @internal */
const bodyFormDataRecord = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(2, (self, entries) => setBody(self, _httpBody_js__rspack_import_5/* .formDataRecord */.uv(entries)));
/** @internal */
const bodyStream = /*#__PURE__*/(0,effect_Function__rspack_import_6.dual)(args => isClientRequest(args[0]), (self, body, {
  contentLength,
  contentType = "application/octet-stream"
} = {}) => setBody(self, _httpBody_js__rspack_import_5/* .stream */.Td(body, contentType, contentLength)));
//# sourceMappingURL=httpClientRequest.js.map

},
87713(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.d(__webpack_exports__, {
  CM: () => (schemaJson),
  Ge: () => (matchStatus),
  Td: () => (stream),
  XL: () => (schemaNoBody),
  ii: () => (TypeId),
  p$: () => (filterStatusOk),
  tO: () => (fromWeb),
  ti: () => (filterStatus)
});
/* import */ var effect_Effect__rspack_import_7 = __webpack_require__(46330);
/* import */ var effect_Function__rspack_import_10 = __webpack_require__(61279);
/* import */ var effect_Inspectable__rspack_import_0 = __webpack_require__(65051);
/* import */ var effect_Option__rspack_import_4 = __webpack_require__(31706);
/* import */ var effect_Schema__rspack_import_9 = __webpack_require__(9064);
/* import */ var effect_Stream__rspack_import_5 = __webpack_require__(14287);
/* import */ var _Cookies_js__rspack_import_3 = __webpack_require__(63744);
/* import */ var _Headers_js__rspack_import_2 = __webpack_require__(22649);
/* import */ var _HttpClientError_js__rspack_import_6 = __webpack_require__(46400);
/* import */ var _HttpIncomingMessage_js__rspack_import_1 = __webpack_require__(1116);
/* import */ var _UrlParams_js__rspack_import_8 = __webpack_require__(11672);











/** @internal */
const TypeId = /*#__PURE__*/Symbol.for("@effect/platform/HttpClientResponse");
/** @internal */
const fromWeb = (request, source) => new ClientResponseImpl(request, source);
class ClientResponseImpl extends effect_Inspectable__rspack_import_0.Class {
  request;
  source;
  [_HttpIncomingMessage_js__rspack_import_1.TypeId];
  [TypeId];
  constructor(request, source) {
    super();
    this.request = request;
    this.source = source;
    this[_HttpIncomingMessage_js__rspack_import_1.TypeId] = _HttpIncomingMessage_js__rspack_import_1.TypeId;
    this[TypeId] = TypeId;
  }
  toJSON() {
    return _HttpIncomingMessage_js__rspack_import_1.inspect(this, {
      _id: "@effect/platform/HttpClientResponse",
      request: this.request.toJSON(),
      status: this.status
    });
  }
  get status() {
    return this.source.status;
  }
  get headers() {
    return _Headers_js__rspack_import_2.fromInput(this.source.headers);
  }
  cachedCookies;
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies;
    }
    return this.cachedCookies = _Cookies_js__rspack_import_3.fromSetCookie(this.source.headers.getSetCookie());
  }
  get remoteAddress() {
    return effect_Option__rspack_import_4.none();
  }
  get stream() {
    return this.source.body ? effect_Stream__rspack_import_5.fromReadableStream(() => this.source.body, cause => new _HttpClientError_js__rspack_import_6.ResponseError({
      request: this.request,
      response: this,
      reason: "Decode",
      cause
    })) : effect_Stream__rspack_import_5.fail(new _HttpClientError_js__rspack_import_6.ResponseError({
      request: this.request,
      response: this,
      reason: "EmptyBody",
      description: "can not create stream from empty body"
    }));
  }
  get json() {
    return effect_Effect__rspack_import_7.tryMap(this.text, {
      try: text => text === "" ? null : JSON.parse(text),
      catch: cause => new _HttpClientError_js__rspack_import_6.ResponseError({
        request: this.request,
        response: this,
        reason: "Decode",
        cause
      })
    });
  }
  textBody;
  get text() {
    return this.textBody ??= effect_Effect__rspack_import_7.tryPromise({
      try: () => this.source.text(),
      catch: cause => new _HttpClientError_js__rspack_import_6.ResponseError({
        request: this.request,
        response: this,
        reason: "Decode",
        cause
      })
    }).pipe(effect_Effect__rspack_import_7.cached, effect_Effect__rspack_import_7.runSync);
  }
  get urlParamsBody() {
    return effect_Effect__rspack_import_7.flatMap(this.text, _ => effect_Effect__rspack_import_7["try"]({
      try: () => _UrlParams_js__rspack_import_8.fromInput(new URLSearchParams(_)),
      catch: cause => new _HttpClientError_js__rspack_import_6.ResponseError({
        request: this.request,
        response: this,
        reason: "Decode",
        cause
      })
    }));
  }
  formDataBody;
  get formData() {
    return this.formDataBody ??= effect_Effect__rspack_import_7.tryPromise({
      try: () => this.source.formData(),
      catch: cause => new _HttpClientError_js__rspack_import_6.ResponseError({
        request: this.request,
        response: this,
        reason: "Decode",
        cause
      })
    }).pipe(effect_Effect__rspack_import_7.cached, effect_Effect__rspack_import_7.runSync);
  }
  arrayBufferBody;
  get arrayBuffer() {
    return this.arrayBufferBody ??= effect_Effect__rspack_import_7.tryPromise({
      try: () => this.source.arrayBuffer(),
      catch: cause => new _HttpClientError_js__rspack_import_6.ResponseError({
        request: this.request,
        response: this,
        reason: "Decode",
        cause
      })
    }).pipe(effect_Effect__rspack_import_7.cached, effect_Effect__rspack_import_7.runSync);
  }
}
/** @internal */
const schemaJson = (schema, options) => {
  const parse = effect_Schema__rspack_import_9.decodeUnknown(schema, options);
  return self => effect_Effect__rspack_import_7.flatMap(self.json, body => parse({
    status: self.status,
    headers: self.headers,
    body
  }));
};
/** @internal */
const schemaNoBody = (schema, options) => {
  const parse = effect_Schema__rspack_import_9.decodeUnknown(schema, options);
  return self => parse({
    status: self.status,
    headers: self.headers
  });
};
/** @internal */
const stream = effect => effect_Stream__rspack_import_5.unwrap(effect_Effect__rspack_import_7.map(effect, _ => _.stream));
/** @internal */
const matchStatus = /*#__PURE__*/(0,effect_Function__rspack_import_10.dual)(2, (self, cases) => {
  const status = self.status;
  if (cases[status]) {
    return cases[status](self);
  } else if (status >= 200 && status < 300 && cases["2xx"]) {
    return cases["2xx"](self);
  } else if (status >= 300 && status < 400 && cases["3xx"]) {
    return cases["3xx"](self);
  } else if (status >= 400 && status < 500 && cases["4xx"]) {
    return cases["4xx"](self);
  } else if (status >= 500 && status < 600 && cases["5xx"]) {
    return cases["5xx"](self);
  }
  return cases.orElse(self);
});
/** @internal */
const filterStatus = /*#__PURE__*/(0,effect_Function__rspack_import_10.dual)(2, (self, f) => effect_Effect__rspack_import_7.suspend(() => f(self.status) ? effect_Effect__rspack_import_7.succeed(self) : effect_Effect__rspack_import_7.fail(new _HttpClientError_js__rspack_import_6.ResponseError({
  response: self,
  request: self.request,
  reason: "StatusCode",
  description: "invalid status code"
}))));
/** @internal */
const filterStatusOk = self => self.status >= 200 && self.status < 300 ? effect_Effect__rspack_import_7.succeed(self) : effect_Effect__rspack_import_7.fail(new _HttpClientError_js__rspack_import_6.ResponseError({
  response: self,
  request: self.request,
  reason: "StatusCode",
  description: "non 2xx status code"
}));
//# sourceMappingURL=httpClientResponse.js.map

},

};
