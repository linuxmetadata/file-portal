const { loadPriceList } = require("../services/priceListLoader");

try {

    const priceList = loadPriceList();

    console.log("Rows Loaded :", priceList.length);

    console.log(priceList[0]);

} catch (err) {

    console.error(err.message);

}