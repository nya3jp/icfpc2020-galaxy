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
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use anyhow::{anyhow, bail, Result};

#[derive(Clone)]
pub enum Value {
    Num(i128),
    Nil,
    Cons(Expr, Expr),
    Func(Rc<dyn Fn(Expr) -> Result<Expr>>),
}

impl Value {
    pub fn new_num(n: i128) -> Value {
        Value::Num(n)
    }

    pub fn new_nil() -> Value {
        Value::Nil
    }

    pub fn new_cons(car: Expr, cdr: Expr) -> Value {
        Value::Cons(car, cdr)
    }

    pub fn new_func(f: impl Fn(Expr) -> Result<Expr> + 'static) -> Value {
        Value::Func(Rc::new(f))
    }

    pub fn new_func2(f: impl Fn(Expr, Expr) -> Result<Expr> + Clone + 'static) -> Value {
        Value::new_func(move |a| {
            let f = f.clone();
            Ok(Value::new_func(move |b| f(a.clone(), b)).into())
        })
    }

    pub fn new_func3(f: impl Fn(Expr, Expr, Expr) -> Result<Expr> + Clone + 'static) -> Value {
        Value::new_func(move |a| {
            let f = f.clone();
            Ok(Value::new_func2(move |b, c| f(a.clone(), b, c)).into())
        })
    }

    pub fn as_num(&self) -> Result<i128> {
        if let Value::Num(n) = self {
            return Ok(*n);
        }
        bail!("not a number");
    }

    pub fn new_bool(f: bool) -> Value {
        if f {
            Value::new_func2(|a, _| Ok(a))
        } else {
            Value::new_func2(|_, b| Ok(b))
        }
    }

    fn apply(&self, arg: Expr) -> Result<Expr> {
        match self {
            Value::Num(_) => bail!("apply: not a func"),
            Value::Func(f) => f(arg),
            Value::Nil => Ok(Value::new_bool(true).into()),
            Value::Cons(car, cdr) => arg.apply(car.clone())?.apply(cdr.clone()),
        }
    }

    fn car(&self) -> Result<Expr> {
        Ok(match self {
            Value::Cons(car, _) => car.clone(),
            _ => bail!("car: not a cons"),
        })
    }

    fn cdr(&self) -> Result<Expr> {
        Ok(match self {
            Value::Cons(_, cdr) => cdr.clone(),
            _ => bail!("cdr: not a cons"),
        })
    }

    pub fn is_nil(&self) -> Result<bool> {
        Ok(match self {
            Value::Nil => true,
            Value::Cons(_, _) => false,
            _ => bail!("isnil: not a nil/cons"),
        })
    }
}

enum ExprData {
    Value(Value),
    Thunk(Rc<dyn Fn(&mut Evaluator) -> Result<Value>>),
}

#[derive(Clone)]
pub struct Expr {
    data: Rc<RefCell<ExprData>>,
}

impl Expr {
    pub fn new_value(v: Value) -> Expr {
        Expr {
            data: Rc::new(RefCell::new(ExprData::Value(v))),
        }
    }

    pub fn new_thunk(f: impl Fn(&mut Evaluator) -> Result<Value> + 'static) -> Expr {
        Expr {
            data: Rc::new(RefCell::new(ExprData::Thunk(Rc::new(f)))),
        }
    }

    pub fn car(&self) -> Result<Expr> {
        let data = self.data.borrow();
        Ok(match *data {
            ExprData::Value(ref v) => v.car()?,
            _ => {
                let cons = self.clone();
                Expr::new_thunk(move |eval| {
                    let value = eval.to_value(cons.clone())?;
                    eval.to_value(value.car()?)
                })
            }
        })
    }

    pub fn cdr(&self) -> Result<Expr> {
        let data = self.data.borrow();
        Ok(match *data {
            ExprData::Value(ref v) => v.cdr()?,
            _ => {
                let cons = self.clone();
                Expr::new_thunk(move |eval| {
                    let value = eval.to_value(cons.clone())?;
                    eval.to_value(value.cdr()?)
                })
            }
        })
    }

    fn parse(env: &Env, code: &str) -> Result<Expr> {
        let (expr, mut iter) = Expr::parse_iter(env, code.split_ascii_whitespace())?;
        if let Some(token) = iter.next() {
            bail!("Excessive token {}", token);
        }
        Ok(expr)
    }

    fn parse_iter<'a, T: Iterator<Item = &'a str>>(env: &Env, mut iter: T) -> Result<(Expr, T)> {
        let name: String = iter.next().ok_or_else(|| anyhow!("Unexpected EOF"))?.into();
        if name == "ap" {
            let (lhs, iter) = Expr::parse_iter(env, iter)?;
            let (rhs, iter) = Expr::parse_iter(env, iter)?;
            Ok((lhs.apply(rhs)?, iter))
        } else if let Ok(n) = name.parse() {
            Ok((Value::new_num(n).into(), iter))
        } else if let Some(expr) = env.lookup(&name) {
            Ok((expr, iter))
        } else {
            let env = env.clone();
            let expr = Expr::new_thunk(move |eval| {
                eval.to_value(
                    env.lookup(&name)
                        .ok_or_else(|| anyhow!("Undefined symbol {}", &name))?,
                )
            });
            Ok((expr, iter))
        }
    }

    pub fn apply(&self, arg: Expr) -> Result<Expr> {
        let data = self.data.borrow();
        Ok(match *data {
            ExprData::Value(ref v) => v.apply(arg)?,
            _ => {
                let lhs = self.clone();
                let rhs = arg;
                Expr::new_thunk(move |eval| {
                    let lhs = eval.to_value(lhs.clone())?;
                    eval.to_value(lhs.apply(rhs.clone())?)
                })
            }
        })
    }
}

impl From<Value> for Expr {
    fn from(v: Value) -> Expr {
        Expr::new_value(v)
    }
}

#[derive(Debug)]
pub struct Evaluator {
    pub count: i64,
}

impl Evaluator {
    pub fn new() -> Evaluator {
        Evaluator { count: 0 }
    }

    pub fn to_value(&mut self, expr: Expr) -> Result<Value> {
        let mut data = expr.data.borrow_mut();
        Ok(match *data {
            ExprData::Value(ref v) => v.clone(),
            ExprData::Thunk(ref f) => {
                let v = f(self)?;
                self.count += 1;
                *data = ExprData::Value(v.clone());
                v
            }
        })
    }

    pub fn to_list(&mut self, expr: Expr) -> Result<Vec<Expr>> {
        Ok({
            let mut cur = expr;
            let mut elems = vec![];
            loop {
                let value = self.to_value(cur)?;
                if let Value::Num(_) = value {
                    bail!("Not a list");
                }
                if value.is_nil()? {
                    break elems;
                }
                elems.push(value.car()?);
                cur = value.cdr()?;
            }
        })
    }

    pub fn to_modulatable(&mut self, expr: Expr) -> Result<Modulatable> {
        Ok({
            let mut cur = expr;
            let mut elems = vec![];
            loop {
                let value = self.to_value(cur)?;
                if let Value::Num(n) = value {
                    break elems
                        .into_iter()
                        .rev()
                        .fold(Modulatable::Num(n), |cdr, car| {
                            Modulatable::Cons(car, Box::new(cdr))
                        });
                }
                if value.is_nil()? {
                    break Modulatable::List(elems);
                }
                elems.push(Box::new(self.to_modulatable(value.car()?)?));
                cur = value.cdr()?;
            }
        })
    }

    pub fn to_string(&mut self, expr: Expr) -> Result<String> {
        Ok(self.to_modulatable(expr)?.to_string())
    }
}

pub enum Modulatable {
    Num(i128),
    List(Vec<Box<Modulatable>>),
    Cons(Box<Modulatable>, Box<Modulatable>),
}

impl Modulatable {
    pub fn to_string(&self) -> String {
        match self {
            Modulatable::Num(n) => n.to_string(),
            Modulatable::List(elems) => format!(
                "[{}]",
                elems
                    .iter()
                    .map(|e| e.to_string())
                    .collect::<Vec<String>>()
                    .join(", ")
            ),
            Modulatable::Cons(car, cdr) => format!("({} . {})", car.to_string(), cdr.to_string()),
        }
    }
}

struct EnvData {
    defs: HashMap<String, Expr>,
}

#[derive(Clone)]
pub struct Env {
    data: Rc<RefCell<EnvData>>,
}

impl Env {
    pub fn new() -> Env {
        Env {
            data: Rc::new(RefCell::new(EnvData {
                defs: HashMap::new(),
            })),
        }
    }

    pub fn new_std() -> Env {
        let mut env = Env::new();
        define_builtins(&mut env).expect("Conflict");
        env
    }

    pub fn define(&mut self, name: &str, value: Expr) -> Result<()> {
        let mut data = self.data.borrow_mut();
        if data.defs.insert(name.into(), value).is_some() {
            bail!("Duplicated symbol: {}", name);
        }
        Ok(())
    }

    pub fn lookup(&self, name: &str) -> Option<Expr> {
        let data = self.data.borrow();
        if let Some(expr) = data.defs.get(name) {
            return Some(expr.clone());
        }
        None
    }

    pub fn parse_expr(&self, code: &str) -> Result<Expr> {
        Expr::parse(self, code)
    }

    pub fn parse_defs(&mut self, code: &str) -> Result<()> {
        for line in code.lines() {
            let v: Vec<&str> = line.split(" = ").collect();
            if v.len() != 2 {
                bail!("Syntax error");
            }
            self.define(v[0], Expr::parse(self, v[1])?)?;
        }
        Ok(())
    }
}

pub fn define_builtins(env: &mut Env) -> Result<()> {
    let defs = vec![
        (
            "inc",
            Value::new_func(|a| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(eval.to_value(a.clone())?.as_num()? + 1))
                }))
            }),
        ),
        (
            "dec",
            Value::new_func(|a| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(eval.to_value(a.clone())?.as_num()? - 1))
                }))
            }),
        ),
        (
            "add",
            Value::new_func2(|a, b| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(
                        eval.to_value(a.clone())?.as_num()? + eval.to_value(b.clone())?.as_num()?,
                    ))
                }))
            }),
        ),
        (
            "mul",
            Value::new_func2(|a, b| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(
                        eval.to_value(a.clone())?.as_num()? * eval.to_value(b.clone())?.as_num()?,
                    ))
                }))
            }),
        ),
        (
            "div",
            Value::new_func2(|a, b| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(
                        eval.to_value(a.clone())?.as_num()? / eval.to_value(b.clone())?.as_num()?,
                    ))
                }))
            }),
        ),
        (
            "eq",
            Value::new_func2(|a, b| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_bool(
                        eval.to_value(a.clone())?.as_num()?
                            == eval.to_value(b.clone())?.as_num()?,
                    ))
                }))
            }),
        ),
        (
            "lt",
            Value::new_func2(|a, b| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_bool(
                        eval.to_value(a.clone())?.as_num()? < eval.to_value(b.clone())?.as_num()?,
                    ))
                }))
            }),
        ),
        (
            "neg",
            Value::new_func(|a| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_num(-eval.to_value(a.clone())?.as_num()?))
                }))
            }),
        ),
        (
            "s",
            Value::new_func3(|a, b, c| {
                Ok(Expr::new_thunk(move |eval| {
                    eval.to_value(a.apply(c.clone())?.apply(b.apply(c.clone())?)?)
                }))
            }),
        ),
        (
            "c",
            Value::new_func3(|a, b, c| a.apply(c.clone())?.apply(b.clone())),
        ),
        (
            "b",
            Value::new_func3(|a, b, c| a.apply(b.apply(c.clone())?)),
        ),
        ("t", Value::new_bool(true)),
        ("f", Value::new_bool(false)),
        ("i", Value::new_func(|a| Ok(a))),
        (
            "cons",
            Value::new_func2(|a, b| Ok(Value::new_cons(a, b).into())),
        ),
        ("car", Value::new_func(|a| a.car())),
        ("cdr", Value::new_func(|a| a.cdr())),
        ("nil", Value::new_nil()),
        (
            "isnil",
            Value::new_func(|a| {
                Ok(Expr::new_thunk(move |eval| {
                    Ok(Value::new_bool(eval.to_value(a.clone())?.is_nil()?))
                }))
            }),
        ),
    ];
    defs.into_iter()
        .map(|p| env.define(p.0, p.1.into()))
        .collect()
}

#[derive(Clone, Debug)]
pub struct Point {
    pub x: i128,
    pub y: i128,
}

impl Into<Expr> for Point {
    fn into(self) -> Expr {
        Value::new_cons(Value::new_num(self.x).into(), Value::new_num(self.y).into()).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cons() -> Result<()> {
        let env = Env::new_std();
        let mut eval = Evaluator::new();
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap ap cons 1 2")?)?,
            "(1 . 2)"
        );
        assert_eq!(
            eval.to_string(Expr::parse(
                &env,
                "ap ap cons ap ap cons 1 2 ap ap cons 3 4"
            )?)?,
            "((1 . 2) . (3 . 4))"
        );
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap ap cons 1 ap ap cons 2 nil")?)?,
            "[1, 2]"
        );
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap car ap ap cons 1 2")?)?,
            "1"
        );
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap cdr ap ap cons 1 2")?)?,
            "2"
        );
        Ok(())
    }

    #[test]
    fn test_infinite_list() -> Result<()> {
        let mut env = Env::new_std();
        let mut eval = Evaluator::new();
        env.parse_defs(":inf = ap ap cons 1 :inf")?;
        assert_eq!(eval.to_string(Expr::parse(&env, "ap car :inf")?)?, "1");
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap car ap cdr :inf")?)?,
            "1"
        );
        Ok(())
    }

    #[test]
    fn test_lazy() -> Result<()> {
        let env = Env::new_std();
        let mut eval = Evaluator::new();
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap car ap ap cons 1 :fail")?)?,
            "1"
        );
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap cdr ap ap cons :fail 1")?)?,
            "1"
        );
        Ok(())
    }

    #[test]
    fn test_infinite_loop() -> Result<()> {
        let env = Env::new_std();
        let mut eval = Evaluator::new();
        assert_eq!(
            eval.to_string(Expr::parse(&env, "ap ap t 1 ap ap ap s i i ap ap s i i")?)?,
            "1"
        );
        Ok(())
    }
}
