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

// Value is a primitive value.
export type Value = NumberValue | FuncValue | NilValue | ConsValue;

// Expr is an expression.
export type Expr = Value | Thunk;

export interface NumberValue {
    kind: 'number'
    number: bigint
}

export interface FuncValue {
    kind: 'func'
    func: (a: Expr) => Expr
}

export interface NilValue {
    kind: 'nil'
}

export interface ConsValue {
    kind: 'cons'
    car: Expr
    cdr: Expr
}

export interface Thunk {
    kind: 'thunk'
    func?: () => Value
    cache?: Value
}

// Basic constructors.

export function makeNumber(i: bigint): NumberValue {
    return {kind: 'number', number: i};
}

export function makeFunc(func: (a: Expr) => Expr): FuncValue {
    return {kind: 'func', func};
}

export function makeFunc2(func: (a: Expr, b: Expr) => Expr): FuncValue {
    return makeFunc((a) => makeFunc((b) => func(a, b)));
}

export function makeFunc3(func: (a: Expr, b: Expr, c: Expr) => Expr): FuncValue {
    return makeFunc((a) => makeFunc((b) => makeFunc((c) => func(a, b, c))));
}

const theNil: NilValue = {kind: 'nil'};

export function makeNil(): NilValue {
    return theNil;
}

export function makeCons(car: Expr, cdr: Expr): ConsValue {
    return {kind: 'cons', car, cdr};
}

export function makeThunk(func: () => Value): Thunk {
    return {kind: 'thunk', func};
}

// Thunk evaluation and function application.

export let evalCounter = 0;

export function evaluate(expr: Expr): Value {
    if (expr.kind !== 'thunk') {
        return expr;
    }
    if (expr.cache) {
        return expr.cache;
    }
    if (!expr.func) {
        throw new Error('Broken thunk');
    }
    evalCounter++;
    const value = expr.func();
    expr.cache = value;
    expr.func = undefined;
    return value;
}

function apply(lhs: Expr, rhs: Expr): Value {
    const func = evaluate(lhs);
    switch (func.kind) {
        case 'number':
            throw new Error(`Invalid function call: ${func.kind}`);
        case 'nil':
            return makeBoolean(true);
        case 'cons':
            return evaluate(makeApply(rhs, func.car, func.cdr));
        case 'func':
            return evaluate(func.func(rhs));
    }
}

// Popular constructors.

export function makeApply(...args: Array<Expr>): Expr {
    return args.reduce((lhs: Expr, rhs: Expr): Expr => {
        switch (lhs.kind) {
            case 'number':
                throw new Error(`Invalid function call: ${lhs.kind}`);
            case 'nil':
                return makeBoolean(true);
            case 'cons':
                return makeApply(rhs, lhs.car, lhs.cdr);
            case 'func':
                return lhs.func(rhs);
            case 'thunk':
                return makeThunk(() => apply(lhs, rhs));
        }
    });
}

export function makeReference(env: Environment, name: string): Expr {
    const resolved = env.lookup(name);
    if (resolved) {
        return resolved;
    }
    return makeThunk(() => {
        const resolved = env.lookup(name);
        if (!resolved) {
            throw new Error(`Undefined reference ${name}`);
        }
        return evaluate(resolved);
    });
}

const theTrue = makeFunc2((a, b) => a);
const theFalse = makeFunc2((a, b) => b);

export function makeBoolean(b: boolean): FuncValue {
    return b ? theTrue : theFalse;
}

export function makeCar(e: Expr): Expr {
    return makeApply(e, makeBoolean(true));
}

export function makeCdr(e: Expr): Expr {
    return makeApply(e, makeBoolean(false));
}

// Utilities.

export function isNil(expr: Expr): boolean {
    const value = evaluate(expr);
    switch (value.kind) {
        case 'nil':
            return true;
        case 'cons':
        case 'number':
            return false;
        case 'func':
            // This is a tricky case. Follow the definition to test.
            return isNilSlow(value);
    }
}

function isNilSlow(value: FuncValue): boolean {
    const bool = evaluate(makeFunc2((a, b) => makeBoolean(false)));
    const trueValue = BigInt(123);
    const falseValue = BigInt(456);
    const result = evaluate(makeApply(value, bool, makeNumber(trueValue), makeNumber(falseValue)));
    if (result.kind !== 'number') {
        throw new Error('Not nil/cons');
    }
    switch (result.number) {
        case trueValue:
            return true;
        case falseValue:
            return false;
        default:
            throw new Error('Not nil/cons');
    }
}

export function parseList(expr: Expr): Array<Expr> {
    const elems = [];
    for (let cur = expr; !isNil(cur); cur = makeCdr(cur)) {
        elems.push(makeCar(cur));
    }
    return elems;
}

export function debugString(expr: Expr): string {
    const value = evaluate(expr);
    switch (value.kind) {
        case 'number':
            return String(value.number);
        case 'nil':
        case 'cons':
        case 'func':
            if (isNil(value)) {
                return 'nil'
            }
            return `ap ap cons ${debugString(makeCar(value))} ${debugString(makeCdr(value))}`;
    }
}

// Environment.

export type Defines = Map<string, Expr>;

export class Environment {
    private defs_: Defines

    constructor(private parent_?: Environment) {
        this.defs_ = new Map<string, Expr>();
    }

    define(name: string, expr: Expr): void {
        if (this.defs_.has(name)) {
            throw new Error(`Duplicated definition: ${name}`);
        }
        this.defs_.set(name, expr);
    }

    defineAll(defs: Defines): void {
        for (const [name, expr] of defs.entries()) {
            this.define(name, expr);
        }
    }

    lookup(name: string): Expr | null {
        const expr = this.defs_.get(name);
        if (expr) {
            return expr;
        }
        if (this.parent_) {
            return this.parent_.lookup(name);
        }
        return null;
    }
}

// Static representation of modulatable data.
export type StaticData = NumberData | ListData | ConsData;

export interface NumberData {
    dataType: 'number'
    number: bigint
}

export interface ListData {
    dataType: 'list'
    elems: Array<StaticData>
}

export interface ConsData {
    dataType: 'cons'
    car: StaticData
    cdr: StaticData
}

export function exprToStaticData(expr: Expr): StaticData {
    const value = evaluate(expr);
    switch (value.kind) {
        case 'number':
            return {dataType: 'number', number: value.number}
        case 'nil':
        case 'cons':
        case 'func':
            const elems: Array<StaticData> = [];
            let cur: Value = value;
            while (true) {
                if (cur.kind === 'number') {
                    elems.push(exprToStaticData(cur));
                    return elems.reduceRight((cdr, car) => ({dataType: 'cons', car, cdr}));
                }
                if (isNil(cur)) {
                    return {dataType: 'list', elems};
                }
                elems.push(exprToStaticData(makeCar(cur)));
                cur = evaluate(makeCdr(cur));
            }
    }
}

export function staticDataEqual(a: StaticData, b: StaticData): boolean {
    switch (a.dataType) {
        case 'number':
            if (b.dataType !== 'number') {
                return false;
            }
            return a.number === b.number;
        case 'list':
            if (b.dataType !== 'list') {
                return false;
            }
            if (a.elems.length !== b.elems.length) {
                return false;
            }
            for (let i = 0; i < a.elems.length; ++i) {
                if (!staticDataEqual(a.elems[i], b.elems[i])) {
                    return false;
                }
            }
            return true;
        case 'cons':
            if (b.dataType !== 'cons') {
                return false;
            }
            return staticDataEqual(a.car, b.car) && staticDataEqual(a.cdr, b.cdr);
    }
}

export function staticDataString(data: StaticData): string {
    switch (data.dataType) {
        case 'number':
            return String(data.number);
        case 'list':
            return `[${data.elems.map(staticDataString).join(', ')}]`;
        case 'cons':
            return `(${staticDataString(data.car)} . ${staticDataString(data.cdr)})`;
    }
}

export interface Point {
    x: number
    y: number
}

export function makePoint(p: Point): Expr {
    return makeCons(makeNumber(BigInt(p.x)), makeNumber(BigInt(p.y)));
}
