/**
 * Copyright 2020 Google LLC
 * Copyright 2020 Team Spacecat
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    Environment,
    Expr,
    makeBoolean,
    Thunk,
    NumberValue,
    FuncValue,
    ConsValue,
    NilValue,
} from './data';

function builtinInc(a: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        if (x.kind !== 'number') {
            throw new Error(`inc: wrong types: ${x.kind}`);
        }
        return new NumberValue(x.number + BigInt(1));
    });
}

function builtinDec(a: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        if (x.kind !== 'number') {
            throw new Error(`dec: wrong types: ${x.kind}`);
        }
        return new NumberValue(x.number - BigInt(1));
    });
}

function builtinAdd(a: Expr, b: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        const y = ev.forceValue(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`add: wrong types: ${x.kind} ${y.kind}`);
        }
        return new NumberValue(x.number + y.number);
    });
}

function builtinMul(a: Expr, b: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        const y = ev.forceValue(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`mul: wrong types: ${x.kind} ${y.kind}`);
        }
        return new NumberValue(x.number * y.number);
    });
}

function builtinDiv(a: Expr, b: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        const y = ev.forceValue(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`div: wrong types: ${x.kind} ${y.kind}`);
        }
        return new NumberValue(x.number / y.number);
    });
}

function builtinEq(a: Expr, b: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        const y = ev.forceValue(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`eq: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeBoolean(x.number === y.number);
    });
}

function builtinLt(a: Expr, b: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        const y = ev.forceValue(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`lt: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeBoolean(x.number < y.number);
    });
}

function builtinNeg(a: Expr): Expr {
    return new Thunk((ev) => {
        const x = ev.forceValue(a);
        if (x.kind !== 'number') {
            throw new Error(`neg: wrong types: ${x.kind}`);
        }
        return new NumberValue(-x.number);
    });
}

function builtinS(a: Expr, b: Expr, c: Expr): Expr {
    return new Thunk((ev) => ev.forceValue(a.apply(c).apply(b.apply(c))));
}

function builtinC(a: Expr, b: Expr, c: Expr): Expr {
    return a.apply(c).apply(b);
}

function builtinB(a: Expr, b: Expr, c: Expr): Expr {
    return a.apply(b.apply(c));
}

function builtinI(a: Expr): Expr {
    return a
}

function builtinCons(car: Expr, cdr: Expr): Expr {
    return new ConsValue(car, cdr);
}

function builtinCar(a: Expr): Expr {
    return a.uncons()[0];
}

function builtinCdr(a: Expr): Expr {
    return a.uncons()[1];
}

function builtinIsNil(a: Expr): Expr {
    return new Thunk((ev) => {
        return makeBoolean(ev.forceValue(a).isNil());
    });
}

function newStandardEnvironment(): Environment {
    const env = new Environment();
    env.define('inc', new FuncValue(builtinInc));
    env.define('dec', new FuncValue(builtinDec));
    env.define('add', FuncValue.make2(builtinAdd));
    env.define('mul', FuncValue.make2(builtinMul));
    env.define('div', FuncValue.make2(builtinDiv));
    env.define('eq', FuncValue.make2(builtinEq));
    env.define('lt', FuncValue.make2(builtinLt));
    env.define('neg', new FuncValue(builtinNeg));
    env.define('s', FuncValue.make3(builtinS));
    env.define('c', FuncValue.make3(builtinC));
    env.define('b', FuncValue.make3(builtinB));
    env.define('t', makeBoolean(true));
    env.define('f', makeBoolean(false));
    env.define('i', new FuncValue(builtinI));
    env.define('cons', FuncValue.make2(builtinCons));
    env.define('car', new FuncValue(builtinCar));
    env.define('cdr', new FuncValue(builtinCdr));
    env.define('nil', NilValue.getInstance());
    env.define('isnil', new FuncValue(builtinIsNil));
    return env;
}

export const stdEnv = newStandardEnvironment();
