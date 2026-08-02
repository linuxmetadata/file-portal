function createLog(statement) {

    return {

        statement,

        steps: [],

        add(step, data = null) {

            this.steps.push({

                step,

                data

            });

        }

    };

}

module.exports = {

    createLog

};