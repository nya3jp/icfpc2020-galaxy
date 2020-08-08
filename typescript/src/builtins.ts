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
    evaluate,
    Expr,
    isNil,
    makeApply,
    makeBoolean,
    makeCar,
    makeCdr,
    makeCons,
    makeFunc,
    makeFunc2,
    makeFunc3,
    makeNil,
    makeNumber,
    makeThunk,
} from './data';

function builtinInc(a: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        if (x.kind !== 'number') {
            throw new Error(`inc: wrong types: ${x.kind}`);
        }
        return makeNumber(x.number + BigInt(1));
    });
}

function builtinDec(a: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        if (x.kind !== 'number') {
            throw new Error(`dec: wrong types: ${x.kind}`);
        }
        return makeNumber(x.number - BigInt(1));
    });
}

function builtinAdd(a: Expr, b: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        const y = evaluate(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`add: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeNumber(x.number + y.number);
    });
}

function builtinMul(a: Expr, b: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        const y = evaluate(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`mul: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeNumber(x.number * y.number);
    });
}

function builtinDiv(a: Expr, b: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        const y = evaluate(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`div: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeNumber(x.number / y.number);
    });
}

function builtinEq(a: Expr, b: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        const y = evaluate(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`eq: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeBoolean(x.number === y.number);
    });
}

function builtinLt(a: Expr, b: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        const y = evaluate(b);
        if (x.kind !== 'number' || y.kind !== 'number') {
            throw new Error(`lt: wrong types: ${x.kind} ${y.kind}`);
        }
        return makeBoolean(x.number < y.number);
    });
}

function builtinNeg(a: Expr): Expr {
    return makeThunk(() => {
        const x = evaluate(a);
        if (x.kind !== 'number') {
            throw new Error(`neg: wrong types: ${x.kind}`);
        }
        return makeNumber(-x.number);
    });
}

function builtinS(a: Expr, b: Expr, c: Expr): Expr {
    return makeThunk(() => evaluate(makeApply(makeApply(a, c), makeApply(b, c))));
}

function builtinC(a: Expr, b: Expr, c: Expr): Expr {
    return makeApply(a, c, b);
}

function builtinB(a: Expr, b: Expr, c: Expr): Expr {
    return makeApply(a, makeApply(b, c))
}

function builtinI(a: Expr): Expr {
    return a
}

function builtinIsNil(a: Expr): Expr {
    return makeThunk(() => {
        return makeBoolean(isNil(a));
    });
}

function newStandardEnvironment(): Environment {
    const env = new Environment();
    env.define('inc', makeFunc(builtinInc));
    env.define('dec', makeFunc(builtinDec));
    env.define('add', makeFunc2(builtinAdd));
    env.define('mul', makeFunc2(builtinMul));
    env.define('div', makeFunc2(builtinDiv));
    env.define('eq', makeFunc2(builtinEq));
    env.define('lt', makeFunc2(builtinLt));
    env.define('neg', makeFunc(builtinNeg));
    env.define('s', makeFunc3(builtinS));
    env.define('c', makeFunc3(builtinC));
    env.define('b', makeFunc3(builtinB));
    env.define('t', makeBoolean(true));
    env.define('f', makeBoolean(false));
    env.define('i', makeFunc(builtinI));
    env.define('cons', makeFunc2(makeCons));
    env.define('car', makeFunc(makeCar));
    env.define('cdr', makeFunc(makeCdr));
    env.define('nil', makeNil());
    env.define('isnil', makeFunc(builtinIsNil));
    return env;
}

export const stdEnv = newStandardEnvironment();
