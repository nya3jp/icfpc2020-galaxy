import { makeApply, makePoint, exprToStaticData, parseList, evalCounter } from "./data";
import { parseExpr } from "./parser";
import { galaxyEnv, galaxyMain } from "./galaxy";

function main(): void {
    const state = parseExpr(galaxyEnv, 'ap ap cons 2 ap ap cons ap ap cons 1 ap ap cons -1 nil ap ap cons 0 ap ap cons nil nil');
    
    console.time('Time');
    for (let y = -100; y <= 100; y++) {
        console.log(`y=${y}`);
        for (let x = -100; x <= 100; x++) {
            const result = parseList(makeApply(galaxyMain, state, makePoint({x, y})));
            exprToStaticData(result[0]);
            exprToStaticData(result[1]);
        }
    }
    console.timeEnd('Time');

    console.log(`Evals: ${evalCounter}`);
}

main();
