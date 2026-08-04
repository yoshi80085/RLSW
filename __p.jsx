import { renderToStaticMarkup } from "react-dom/server";
import { Pickles } from "./src/ui/Pickles.jsx";
import fs from "fs";
fs.writeFileSync("/tmp/pickles.html", renderToStaticMarkup(<Pickles x={120} y={120} size={160} talking={true} lookAt={{x:400,y:140}}/>));
console.log("ok");
