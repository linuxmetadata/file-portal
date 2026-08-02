const { tokenize } = require("../matcher/tokenizer");

const samples = [

    "15GM",

    "200ML",

    "4.5GM",

    "100/10",

    "500/50",

    "TAB",

    "CREAM"

];

for (const s of samples) {

    console.log("--------------------------------");

    console.log(s);

    console.log(tokenize(s));

}