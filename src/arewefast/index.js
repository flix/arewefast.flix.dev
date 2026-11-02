///////////////////////////////////////////////////////////////////////////////
// Imports                                                                   //
///////////////////////////////////////////////////////////////////////////////
var execa = require('execa');
var mysql = require('mysql');
var fs = require("fs");

///////////////////////////////////////////////////////////////////////////////
// Paths                                                                     //
///////////////////////////////////////////////////////////////////////////////
var CWD = process.cwd();
var JAR_PATH = CWD + '/flix/out/flix/assembly.dest/out.jar';
var BENCHMARKS_PATH = CWD + '/flix/main/src/resources/benchmark';
var BENCHMARKS_BUILD_PATH = CWD + '/benchmark_build';
var BENCHMARKS_JAR_PATH = CWD + '/benchmark_build/artifact/benchmark_build.jar';
var FLIX_DIR_PATH = CWD + '/flix';
var LIBRARY_PATH = CWD + '/flix/main/src/library';
var SOURCE_PATH = CWD + '/flix/main/src/ca/uwaterloo/flix';
var TEST_PATH = CWD + '/flix/main/test';
var PERF_DIR_PATH = CWD + '/flix/build/perf';
var BIBBLITZ_DIR_PATH = CWD + '/bibblitz';
var BIBBLITZ_SRC_PATH = CWD + '/bibblitz/src';
var BIBBLITZ_JAR_PATH = CWD + '/bibblitz/artifact/bibblitz.jar';

///////////////////////////////////////////////////////////////////////////////
// JVM Arguments                                                             //
///////////////////////////////////////////////////////////////////////////////
// We pin the heap at 8GB for every JVM we start so that heap resizing does not affect the measurements.
// Xperf forces a GC before every timed run (see flix/flix#13630), which only reduces noise when the heap is
// pinned; Xperf warns if it is not.
var JVM_ARGS = ['-Xms8g', '-Xmx8g'];

///////////////////////////////////////////////////////////////////////////////
// Parse Command Line Arguments                                              //
///////////////////////////////////////////////////////////////////////////////
var hostname = process.argv[2]
var username = process.argv[3]
var password = process.argv[4]
var command = process.argv[5]

if (!hostname) {
    throw new Error("Missing hostname.");
}

if (!username) {
    throw new Error("Missing username");
}

if (!password) {
    throw new Error("Missing password");
}

if (!command) {
    throw new Error("Missing command");
}

///////////////////////////////////////////////////////////////////////////////
// Configure Mysql Connection                                                //
///////////////////////////////////////////////////////////////////////////////
function newConnection() {
    return mysql.createConnection({
        host: hostname,
        user: username,
        password: password,
        database: 'flix',
        timezone: 'Z'    // UTC
    });
}

///////////////////////////////////////////////////////////////////////////////
// Timestamp                                                                 //
///////////////////////////////////////////////////////////////////////////////
function getCurrentUnixTime() {
    return (new Date().getTime() / 1000);
}

///////////////////////////////////////////////////////////////////////////////
// Git Clone and Pull                                                        //
///////////////////////////////////////////////////////////////////////////////
function gitClone() {
    execa.sync('git', ['clone', 'https://github.com/flix/flix.git']);
}

function gitPull() {
    execa.sync('git', ['-C', FLIX_DIR_PATH, 'pull']);
}

function gitCloneOrPull() {
    if (!fs.existsSync(FLIX_DIR_PATH)) {
        gitClone()
    } else {
        gitPull()
    }
}

///////////////////////////////////////////////////////////////////////////////
// Mill Build                                                              //
///////////////////////////////////////////////////////////////////////////////
function millBuild() {
    execa.sync('./mill', ['clean'], {"cwd": FLIX_DIR_PATH});

    var t = getCurrentUnixTime();
    execa.sync('./mill', ['flix.assembly'], {"cwd": FLIX_DIR_PATH});
    var e = getCurrentUnixTime() - t;

    // Connect and Insert into MySQL.
    var connection = newConnection()
    connection.connect();
    connection.query(
        "INSERT INTO build VALUES (?, NOW(), ?)",
        ["build", e],
        function (error, results, fields) {
            if (error) throw error;
        });
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Mill Test
///////////////////////////////////////////////////////////////////////////////
function millTest() {
    var t = getCurrentUnixTime();
    execa.sync('./mill', ['flix.test'], {"cwd": FLIX_DIR_PATH});
    var e = getCurrentUnixTime() - t;

    // Connect and Insert into MySQL.
    var connection = newConnection()
    connection.connect();
    connection.query(
        "INSERT INTO build VALUES (?, NOW(), ?)",
        ["test", e],
        function (error, results, fields) {
            if (error) throw error;
        });
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Perf (Throughput and Phases)                                              //
///////////////////////////////////////////////////////////////////////////////
function benchmarkPerf() {
    // Command to execute.
    // Xperf ignores --json and instead writes its results as JSON files to ./build/perf/.
    // With --par only the multi-threaded, non-incremental experiment is run.
    // We use 250 iterations so the reported min/max/median are less sensitive to a few noisy runs.
    execa.sync('java', JVM_ARGS.concat(['-jar', JAR_PATH, 'Xperf', '--par', '--n', '250']), {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    // Note: Xperf currently writes summary.json double-encoded (a JSON string that contains JSON),
    // so we parse a second time if the first parse yields a string. This also works once that is fixed.
    var summary = JSON.parse(fs.readFileSync(PERF_DIR_PATH + '/summary.json', 'utf8'));
    if (typeof summary === 'string') {
        summary = JSON.parse(summary);
    }
    var timeWithPar = JSON.parse(fs.readFileSync(PERF_DIR_PATH + '/timeWithPar.json', 'utf8'));
    var lines = summary.lines;
    var threads = summary.threads;
    var iterations = summary.iterations;
    var phases = timeWithPar.results;

    // The throughput statistics keyed by kind: 'frontend', 'backend' and 'overall' (see flix/flix#13627).
    // With --frontend only 'frontend' is present. Before #13627 the object was a single flat set of
    // statistics for the overall throughput, so we wrap that shape as 'overall'.
    var throughput = summary.throughput;
    var throughputByKind = (throughput.min !== undefined) ? {overall: throughput} : throughput;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();

    // Insert throughput into MySQL: one row per kind, in a single statement so all rows share the same time.
    var placeholders = [];
    var params = [];
    Object.keys(throughputByKind).forEach(function (kind) {
        var stats = throughputByKind[kind];
        placeholders.push("(NOW(), ?, ?, ?, ?, ?, ?, ?, ?)");
        params.push(kind, lines, threads, iterations, stats.min, stats.max, stats.avg, stats.median);
    });
    connection.query(
        "INSERT INTO `throughput` (`time`, `kind`, `lines`, `threads`, `iterations`, `minThroughput`, `maxThroughput`, `avgThroughput`, `medianThroughput`) VALUES " + placeholders.join(", "),
        params,
        function (error, results, fields) {
            if (error) throw error;
        });

    // Insert phases into MySQL.
    phases.forEach(function (elm) {
        var phase = elm.phase;
        // Xperf reports phase times in milliseconds, but phase_ext.duration is in nanoseconds.
        var time = Math.round(elm.time * 1e6);

        connection.query(
            "INSERT INTO phase_ext VALUES (NOW(), ?, ?, ?, ?, ?)",
            [phase, lines, threads, iterations, time],
            function (error, results, fields) {
                if (error) throw error;
            });
    })
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Code Size                                                                 //
///////////////////////////////////////////////////////////////////////////////
function benchmarkCodeSize() {
    // Clone or pull BibBlitz.
    if (!fs.existsSync(BIBBLITZ_DIR_PATH)) {
        execa.sync('git', ['clone', 'https://github.com/magnus-madsen/bibblitz.git']);
    } else {
        execa.sync('git', ['-C', BIBBLITZ_DIR_PATH, 'pull']);
    }

    // Count the lines of Flix source code.
    var linesResult = execa.sync('./countLines.sh', [BIBBLITZ_SRC_PATH, "-name", "*.flix"]);
    var lines = parseInt(linesResult.stdout);

    // Build the fatjar with the freshly built compiler.
    execa.sync('java', JVM_ARGS.concat(['-jar', JAR_PATH, 'build-fatjar']), {"cwd": BIBBLITZ_DIR_PATH});

    // Measure the size of the fatjar.
    var bytes = fs.statSync(BIBBLITZ_JAR_PATH).size;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();

    // Insert into MySQL.
    connection.query(
        "INSERT INTO codesize VALUES (NOW(), ?, ?)",
        [lines, bytes],
        function (error, results, fields) {
            if (error) throw error;
        });
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Benchmarks                                                                //
///////////////////////////////////////////////////////////////////////////////
function benchmarkBenchmarks() {
    // Command to execute.
    // First copy the benchmarks to a new directory
    execa.sync('cp', ['-r', BENCHMARKS_PATH, BENCHMARKS_BUILD_PATH]);

    // Build the benchmarks.
    execa.sync('java', JVM_ARGS.concat(['-jar', JAR_PATH, 'build']), {"cwd": BENCHMARKS_BUILD_PATH});

    // Build the jar.
    execa.sync('java', JVM_ARGS.concat(['-jar', JAR_PATH, 'build-jar']), {"cwd": BENCHMARKS_BUILD_PATH});
    // Run the benchmarks.
    var result = execa.sync('java', JVM_ARGS.concat(['-jar', BENCHMARKS_JAR_PATH]), {"cwd": BENCHMARKS_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var threads = -1;
    var benchmarks = json;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();
    benchmarks.forEach(function (elm) {
        var name = elm.name;
        var time = elm.time;

        // Insert into MySQL.
        connection.query(
            "INSERT INTO benchmark_ext VALUES (NOW(), ?, ?, ?)",
            [threads, name, time],
            function (error, results, fields) {
                if (error) throw error;
            });
    })
    connection.end();
}


///////////////////////////////////////////////////////////////////////////////
// Commits                                                                   //
///////////////////////////////////////////////////////////////////////////////
function commits() {
    // Pull the log in format (hash <tab> time <tab> message)
    // Limit to the last month
    var result = execa.sync('git', ['-C', FLIX_DIR_PATH, 'log', '--pretty=%H\t%ct\t%s', '--since=1 month ago']);

    // Parse the command output
    var lines = result.stdout.split("\n");
    var rows = lines.map((line) => line.split("\t"));

    // Connect to MySQL
    var connection = newConnection();
    connection.connect();
    // Add each log message to the database
    rows.forEach((row) => {
        var hash = row[0];
        var time = row[1];
        var full_message = row[2];
        // truncate the message to 255 characters
        var message = full_message.substring(0, 255);

        connection.query(
            "REPLACE INTO commits (sha, time, message) VALUES (?, FROM_UNIXTIME(?), ?)",
            [hash, time, message],
            function (error, results, fields) {
                if (error) throw error;
            });
    })
    connection.end();

}

///////////////////////////////////////////////////////////////////////////////
// Memory Usage                                                              //
///////////////////////////////////////////////////////////////////////////////
function benchmarkMemory() {
    // Command to execute.
    var result = execa.sync('java', JVM_ARGS.concat(['-jar', JAR_PATH, 'Xmemory', '--json']), {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var bytes = json.bytes;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();

    // Insert into MySQL.
    connection.query(
        "INSERT INTO memory_usage VALUES (NOW(), ?)",
        [bytes],
        function (error, results, fields) {
            if (error) throw error;
        });
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Lines                                                                     //
///////////////////////////////////////////////////////////////////////////////
function lines() {
    // For source code, we only care about scala files.
    var sourceResult = execa.sync('./countLines.sh', [SOURCE_PATH, "-name", "*.scala"]);
    var libResult = execa.sync('./countLines.sh', [LIBRARY_PATH, "-name", "*.flix"]);
    var flixTestResult = execa.sync('./countLines.sh', [TEST_PATH, "-name", "*.flix"]);
    var scalaTestResult = execa.sync('./countLines.sh', [TEST_PATH, "-name", "*.scala"]);

    var data = [
        ["source", parseInt(sourceResult.stdout)],
        ["lib", parseInt(libResult.stdout)],
        ["test_flix", parseInt(flixTestResult.stdout)],
        ["test_scala", parseInt(scalaTestResult.stdout)],
    ];

    // Add the results to the DB
    var connection = newConnection();
    connection.connect();
    for ([kind, numLines] of data) {
        connection.query(
            "INSERT INTO line_count VALUES (NOW(), ?, ?)",
            [kind, numLines],
            function (error, results, fields) {
                if (error) throw error;
            });
    }
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Main                                                                      //
///////////////////////////////////////////////////////////////////////////////

// Always clone or pull.
gitCloneOrPull()

// Branch on the command.
if (command === "build") {
    millBuild()
} else if (command === "test") {
    millTest()
} else if (command === "perf") {
    benchmarkPerf()
} else if (command === "codesize") {
    benchmarkCodeSize();
} else if (command === "benchmarks") {
    benchmarkBenchmarks()
} else if (command === "commits") {
    commits()
} else if (command === "memory") {
    benchmarkMemory();
} else if (command === "lines") {
    lines()
} else {
    throw new Error("Unknown command: " + command)
}
