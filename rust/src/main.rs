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
mod eval;

use std::fs::File;
use std::io::prelude::*;

use anyhow::Result;

use eval::{Env, Evaluator, Point};

fn main() -> Result<()> {
    let mut env = Env::new_std();
    {
        let mut code = String::new();
        let mut f = File::open("galaxy.txt")?;
        f.read_to_string(&mut code)?;
        env.parse_defs(&code)?;
    }

    let main = env.parse_expr("galaxy")?;
    let state = env.parse_expr(
        "ap ap cons 2 ap ap cons ap ap cons 1 ap ap cons -1 nil ap ap cons 0 ap ap cons nil nil",
    )?;

    let mut eval = Evaluator::new();

    for y in -100..=100 {
        println!("y={}", y);
        for x in -100..=100 {
            let point = Point { x, y };
            let result = eval.to_value(main.apply(state.clone())?.apply(point.into())?)?;
            //result[0].force_modulatable()?;
            //result[1].force_modulatable()?;
        }
    }

    println!("Evals: {}", eval.count);

    Ok(())
}
