const path = require("path");

const {
    processFolder
} = require("./batchProcessEngine");

async function main() {

    const statementFolder = process.argv[2];
    const priceFile = process.argv[3];

    if (!statementFolder || !priceFile) {

        console.log("");
        console.log("Usage:");
        console.log(
            "node validation/testBatchProcessEngine.js <statementFolder> <priceList>"
        );

        process.exit(1);

    }

    const result = await processFolder({

        statementFolder,

        priceFile,

        portalData: {

            MONTH: "APR-26",

            ZONE: "SOUTH",

            STATE: "TAMIL NADU",

            HQ: "CHENNAI",

            ABMHQ: "CHENNAI",

            RBMHQ: "CHENNAI"

        },

        statementType: "SSS"

    });

    console.log("");

    console.log("======================================");
    console.log("BATCH PROCESS ENGINE");
    console.log("======================================");

    console.log("");

    console.log("Total Files :", result.totalFiles);
    console.log("Processed   :", result.processed);
    console.log("Failed      :", result.failed);

    console.log("");

    console.table(

        result.results.map(r => ({

            File: r.file,

            Success: r.success,

            Products:

                r.success
                    ? r.result.totalProducts
                    : "-",

            Matched:

                r.success
                    ? r.result.matchedProducts
                    : "-",

            Unmatched:

                r.success
                    ? r.result.unmatchedProducts
                    : "-",

            Time:

                r.success
                    ? r.result.processingTime
                    : "-",

            Status:

                r.success
                    ? "Completed"
                    : r.message

        }))

    );

}

main().catch(err => {

    console.log("");

    console.log("======================================");
    console.log("BATCH PROCESS FAILED");
    console.log("======================================");

    console.error(err);

});