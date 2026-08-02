const { validate } = require("../matcher/validator");

const results = [

    { matched: true, stage: "RAW" },

    { matched: true, stage: "ORIGINAL" },

    { matched: true, stage: "NORMALIZED" },

    { matched: true, stage: "ADVANCED" },

    { matched: false, stage: "NONE" },

    { matched: false, stage: "NONE" }

];

console.table(validate(results));