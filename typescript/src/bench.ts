import { parseExpr } from "./parser";
import { galaxyEnv, galaxyMain } from "./galaxy";
import { Evaluator, Point, makePoint } from "./data";

function main(): void {
    const ev = new Evaluator();
    const state = parseExpr(galaxyEnv, 'ap ap cons 2 ap ap cons ap ap cons 1 ap ap cons -1 nil ap ap cons 0 ap ap cons nil nil');
    
    console.time('Time');
    for (let y = -100; y <= 100; y++) {
        console.log(`y=${y}`);
        for (let x = -100; x <= 100; x++) {
            const result = ev.forceList(galaxyMain.apply(state).apply(makePoint(new Point(x, y))));
            ev.forceModulatable(result[0]);
            ev.forceModulatable(result[1]);
        }
    }
    console.timeEnd('Time');

    console.log(`Evals: ${ev.counter}`);
}

main();
