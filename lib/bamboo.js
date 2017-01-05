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

    runner.on('test end', function(test){
        tests.push(test);
    });

    runner.on('suite', function(suite){
        ++indents;
        console.log(color('suite', '%s%s'), indent(), suite.title);
    });

    runner.on('suite end', function(suite){
        --indents;
        if (1 == indents) console.log();
    });

    runner.on('pending', function(test) {
        var fmt = indent() + color('pending', '  - %s');
        console.log(fmt, test.title);
        skipped.push(test);
    });

    runner.on('pass', function(test){
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

    runner.on('fail', function(test){
        cursor.CR();
        console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);
        failures.push(test);
    });

    runner.on('end', function(){
        var obj = {
            stats: self.stats
            , failures: failures.map(clean)
            , passes: passes.map(clean)
            , skipped: skipped.map(clean)
        };
        fs.writeFileSync(filename, JSON.stringify(obj, null, 2), 'utf-8');
    });
    runner.on('start', function() {
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename); // if we die at some point, we don't want bamboo to have a stale results file lying around...
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
        title: test.fullTitle()
        , fullTitle: test.title
        , duration: test.duration
    }
    if (test.hasOwnProperty("err")) {
        o.error = test.err.stack ? test.err.stack.toString() : test.err.toString();
    }
    return o;
}
