const kb = require("./knowledgeBase.json");

function normalizeWord(word) {

    word = word.toUpperCase();

    return kb.synonyms[word] || word;

}

function isModifier(word) {

    return kb.modifiers.includes(word.toUpperCase());

}

function isUnit(word) {

    return kb.units.includes(word.toUpperCase());

}

module.exports = {

    normalizeWord,

    isModifier,

    isUnit,

    kb

};