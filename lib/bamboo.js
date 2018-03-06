var Base = require('mocha').reporters.Base
    , cursor = Base.cursor
    , color = Base.color
    , fs = require('fs')
    , filename = process.env.MOCHA_FILE || 'mocha.json';

exports = module.exports = BambooJSONReporter;

/**
 * Initialize a new `JSON` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function BambooJSONReporter(runner) {
    Base.call(this, runner);
    var self = this
        , stats = this.stats
        , indents = 0
        , n = 0;
    function indent() {
        return Array(indents).join('  ')
    }


    var tests = []
        , failures = []
        , passes = []
        , skipped = [];

    runner.on('test end', function (test) {
        tests.push(test);
    });

    runner.on('suite', function (suite) {
        ++indents;
        console.log(color('suite', '%s%s'), indent(), suite.title);
    });

    runner.on('suite end', function (suite) {
        --indents;
        if (1 == indents) console.log();
    });

    runner.on('pending', function (test) {
        var fmt = indent() + color('pending', '  - %s');
        console.log(fmt, test.title);
        skipped.push(test);
    });

    runner.on('pass', function (test) {
        if ('fast' == test.speed) {
            var fmt = indent()
                + color('checkmark', '  ' + Base.symbols.ok)
                + color('pass', ' %s ');
            cursor.CR();
            console.log(fmt, test.title);
        } else {
            var fmt = indent()
                + color('checkmark', '  ' + Base.symbols.ok)
                + color('pass', ' %s ')
                + color(test.speed, '(%dms)');
            cursor.CR();
            console.log(fmt, test.title, test.duration);
        }
        passes.push(test);
    });

    runner.on('fail', function (test) {
        cursor.CR();
        console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);
        failures.push(test);
    });

    runner.on('end', function () {
        var obj = {
            stats: self.stats
            , failures: failures.map(clean)
            , passes: passes.map(clean)
            , skipped: skipped.map(clean)
        };
        var jiraObj = {
            stats: {
                "suites": 0,
                "tests": 0,
                "passes": 0,
                "pending": 0,
                "failures": 0,
                "start": self.stats.start,
                "end": self.stats.end,
                "duration": 0
            }
            , failures: []
            , passes: []
            , skipped: []
        };
        var featureCount = 0, scenarioCount = 0;
        var featureDuration = 0, scenarioDuration = 0;
        var currentFeatureTitle = "", currentScenarioTitle = "";
        var featureError = "";
        //count features === Jira Test Case
        //count scenarios === Jira Text Case Steps
        var testLength = tests.length;
        tests.forEach(function eachTest(test, idx) {
            var nextFeatureTitle = "";
            if (test.parent.parent.title !== currentFeatureTitle) {
                featureCount = featureCount + 1;
                featureDuration = 0;
                currentFeatureTitle = test.parent.parent.title;
                featureError = "";
            } else {
                featureDuration = featureDuration + test.duration;
            }
            if (test.hasOwnProperty("err")) {
                featureError = "Test failed: " + test.title;
            }
            if (test.parent.title !== currentScenarioTitle) {
                scenarioCount = scenarioCount + 1;
                scenarioDuration = 0;
                currentScenarioTitle = test.parent.title;
            } else {
                scenarioDuration = scenarioDuration + test.duration;
            }
            //get next feature title
            if (testLength > idx + 1) {
                nextFeatureTitle = tests[idx + 1].parent.parent.title;
            }
            //Add feature if change in next or at end
            if (testLength === idx + 1 || nextFeatureTitle !== currentFeatureTitle) {
                jiraObj.stats.suites = jiraObj.stats.suites + 1;
                jiraObj.stats.tests = jiraObj.stats.tests + 1;
                jiraObj.stats.duration = jiraObj.stats.duration + featureDuration;
                if (featureError !== "") {
                    jiraObj.stats.failures = jiraObj.stats.failures + 1;
                    jiraObj.failures.push({
                        "title": currentFeatureTitle,
                        "fullTitle": "AUTO",
                        "duration": featureDuration,
                        "error": "Test failed: " + test.title
                    });
                } else {
                    jiraObj.stats.passes = jiraObj.stats.passes + 1;
                    jiraObj.passes.push({
                        "title": currentFeatureTitle,
                        "fullTitle": "AUTO",
                        "duration": featureDuration
                    });
                }
            }
        });
        obj.stats.suites = scenarioCount;
        fs.writeFileSync(filename + ".jira.json", JSON.stringify(jiraObj, null, 2), 'utf-8');
        fs.writeFileSync(filename, JSON.stringify(obj, null, 2), 'utf-8');
    });
    runner.on('start', function () {
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename); // if we die at some point, we don't want bamboo to have a stale results file lying around...
        }
        if (fs.existsSync(filename + ".jira.json")) {
            fs.unlinkSync(filename + ".jira.json"); // if we die at some point, we don't want bamboo to have a stale results file lying around...
        }
    });
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @param {Object} test
 * @return {Object}
 * @api private
 */

function clean(test) {
    var o = {
        title: test.title
        , fullTitle: test.parent.parent.title + " -> " + test.parent.title
        , duration: test.duration
        , scenarioTitle: test.parent.title
        , featureTitle: test.parent.parent.title
    }
    if (test.hasOwnProperty("err")) {
        o.error = test.err.stack ? test.err.stack.toString() : test.err.toString();
    }
    return o;
}
