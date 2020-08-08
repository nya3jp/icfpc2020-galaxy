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

export class NumberValue {
    readonly kind = 'number'

    constructor(public readonly number: bigint) {}

    apply(arg: Expr): Expr {
        throw new Error('Not a func');
    }

    uncons(): [Expr, Expr] {
        throw new Error('Not a cons');
    }

    isNil(): boolean {
        throw new Error('Not a nil/cons');
    }
}

export class NilValue {
    readonly kind = 'nil'

    private constructor() {}

    apply(arg: Expr): Expr {
        return makeBoolean(true);
    }

    uncons(): [Expr, Expr] {
        throw new Error('Not a cons');
    }

    isNil(): boolean {
        return true;
    }

    private static theInstance = new NilValue();

    static getInstance(): NilValue {
        return NilValue.theInstance;
    }
}

export class ConsValue {
    readonly kind = 'cons'

    constructor(public readonly car: Expr, public readonly cdr: Expr) {}

    apply(arg: Expr): Expr {
        return arg.apply(this.car).apply(this.cdr);
    }

    uncons(): [Expr, Expr] {
        return [this.car, this.cdr];
    }

    isNil(): boolean {
        return false;
    }
}

export class FuncValue {
    readonly kind = 'func'

    constructor(public readonly func: (a: Expr) => Expr) {}

    static make2(func: (a: Expr, b: Expr) => Expr): FuncValue {
        return new FuncValue((a) => new FuncValue((b) => func(a, b)));
    }

    static make3(func: (a: Expr, b: Expr, c: Expr) => Expr): FuncValue {
        return new FuncValue((a) => new FuncValue((b) => new FuncValue((c) => func(a, b, c))));
    }

    apply(arg: Expr): Expr {
        return this.func(arg);
    }

    uncons(): [Expr, Expr] {
        throw new Error('Not a cons');
    }

    isNil(): boolean {
        throw new Error('Not a nil/cons');
    }
}

export class Thunk {
    readonly kind = 'thunk'
    func?: (ev: Evaluator) => Value
    cache?: Value

    constructor(func: (ev: Evaluator) => Value) {
        this.func = func
    }

    apply(arg: Expr): Expr {
        if (this.cache) {
            return this.cache.apply(arg);
        }
        return new Thunk((ev) => ev.forceValue(ev.forceValue(this).apply(arg)));
    }

    uncons(): [Expr, Expr] {
        if (this.cache) {
            return this.cache.uncons();
        }
        return [
            new Thunk((ev) => ev.forceValue(ev.forceValue(this).uncons()[0])),
            new Thunk((ev) => ev.forceValue(ev.forceValue(this).uncons()[1])),
        ]
    }
}

// Thunk evaluation.

export class Evaluator {
    counter = 0

    constructor() {}

    forceValue(expr: Expr): Value {
        if (expr.kind !== 'thunk') {
            return expr;
        }
        if (expr.cache) {
            return expr.cache;
        }
        if (!expr.func) {
            throw new Error('Broken thunk');
        }
        this.counter++;
        const value = expr.func(this);
        expr.cache = value;
        expr.func = undefined;
        return value;
    }

    forceList(expr: Expr): Expr[] {
        const elems = [];
        for (let cur = this.forceValue(expr); !cur.isNil(); cur = this.forceValue(cur.uncons()[1])) {
            elems.push(cur.uncons()[0]);
        }
        return elems;
    }

    forceModulatable(expr: Expr): Modulatable {
        const elems = [];
        let cur = this.forceValue(expr)
        while (true) {
            switch (cur.kind) {
                case 'number':
                    elems.push(new NumberModulatable(cur.number));
                    return elems.reduceRight((cdr, car) => new ConsModulatable(car, cdr));
                case 'nil':
                    return new ListModulatable(elems);
                case 'cons':
                    const [car, cdr] = cur.uncons();
                    elems.push(this.forceModulatable(car));
                    cur = this.forceValue(cdr);
                    break;
                case 'func':
                    throw new Error('Not modulatable');
            }
        }
    }
}

// Popular constructors.

const theTrue = FuncValue.make2((a, _) => a);
const theFalse = FuncValue.make2((_, b) => b);

export function makeBoolean(b: boolean): FuncValue {
    return b ? theTrue : theFalse;
}

export function makeReference(env: Environment, name: string): Expr {
    const resolved = env.lookup(name);
    if (resolved) {
        return resolved;
    }
    return new Thunk((ev) => {
        const resolved = env.lookup(name);
        if (!resolved) {
            throw new Error(`Undefined reference ${name}`);
        }
        return ev.forceValue(resolved);
    });
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
export type Modulatable = NumberModulatable | ListModulatable | ConsModulatable;

export class NumberModulatable {
    readonly dataType = 'number'

    constructor(public readonly number: bigint) {}
}

export class ListModulatable {
    readonly dataType = 'list'

    constructor(public readonly elems: Modulatable[]) {}
}

export class ConsModulatable {
    readonly dataType = 'cons'

    constructor(public readonly car: Modulatable, public readonly cdr: Modulatable) {}
}

export class Point {
    constructor(public readonly x: number, public readonly y: number) {}
}

export function makePoint(p: Point): Expr {
    return new ConsValue(new NumberValue(BigInt(p.x)), new NumberValue(BigInt(p.y)));
}
