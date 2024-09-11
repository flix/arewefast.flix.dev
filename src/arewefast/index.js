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
var JAR_PATH = CWD + '/flix/build/libs/flix.jar';
var BENCHMARKS_PATH = CWD + '/flix/main/src/resources/benchmark';
var BENCHMARKS_BUILD_PATH = CWD + '/benchmark_build';
var BENCHMARKS_JAR_PATH = CWD + '/benchmark_build/artifact/benchmark_build.jar';
var FLIX_DIR_PATH = CWD + '/flix';

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
        database: 'flix'
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
// Gradle Build                                                              //
///////////////////////////////////////////////////////////////////////////////
function gradleBuild() {
    execa.sync('./gradlew', ['clean'], {"cwd": FLIX_DIR_PATH});

    var t = getCurrentUnixTime();
    execa.sync('./gradlew', ['jar'], {"cwd": FLIX_DIR_PATH});
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
// Gradle Test                                                               //
///////////////////////////////////////////////////////////////////////////////
function gradleTest() {
    var t = getCurrentUnixTime();
    execa.sync('./gradlew', ['test'], {"cwd": FLIX_DIR_PATH});
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
// Throughput                                                                //
///////////////////////////////////////////////////////////////////////////////
function benchmarkThroughput() {
    // Command to execute.
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-throughput', '--json'], {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var lines = json.lines;
    var threads = json.threads;
    var iterations = json.iterations;
    var minThroughput = json.throughput.min;
    var maxThroughput = json.throughput.max;
    var avgThroughput = json.throughput.avg;
    var medianThroughput = json.throughput.median;

    // Connect and Insert into MySQL.
    var connection = newConnection()
    connection.connect();
    connection.query(
        "INSERT INTO throughput_ext VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)",
        [lines, threads, iterations, minThroughput, maxThroughput, avgThroughput, medianThroughput],
        function (error, results, fields) {
            if (error) throw error;
        });
    connection.end();
}

///////////////////////////////////////////////////////////////////////////////
// Phases                                                                    //
///////////////////////////////////////////////////////////////////////////////
function benchmarkPhases() {
    // Command to execute.
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-phases', '--json'], {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var lines = json.lines;
    var threads = json.threads;
    var iterations = json.iterations;
    var phases = json.phases;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();
    phases.forEach(function (elm) {
        var phase = elm.phase;
        var time = elm.time;

        // Insert into MySQL.
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
// Phases Incremental                                                        //
///////////////////////////////////////////////////////////////////////////////
function benchmarkPhasesIncremental() {
    // Command to execute.
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-incremental', '--json'], {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var lines = json.lines;
    var threads = json.threads;
    var iterations = json.iterations;
    var phases = json.phases;

    // Connect to MySQL.
    var connection = newConnection()
    connection.connect();
    phases.forEach(function (elm) {
        var phase = elm.phase;
        var time = elm.time;

        // Insert into MySQL.
        connection.query(
            "INSERT INTO phase_incremental VALUES (NOW(), ?, ?, ?, ?, ?)",
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
    // Command to execute.
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-code-size', '--json'], {"cwd": FLIX_DIR_PATH});

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var lines = json.lines;
    var bytes = json.codeSize;

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
    execa.sync('java', ['-jar', JAR_PATH, 'build'], {"cwd": BENCHMARKS_BUILD_PATH});

    // Build the jar.
    execa.sync('java', ['-jar', JAR_PATH, 'build-jar'], {"cwd": BENCHMARKS_BUILD_PATH});
    // Run the benchmarks.
    var result = execa.sync('java', ['-jar', BENCHMARKS_JAR_PATH], {"cwd": BENCHMARKS_PATH});

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
// Benchmarks                                                                //
///////////////////////////////////////////////////////////////////////////////
function commits() {
    // Pull the log in format (hash <tab> time <tab> message)
    // Limit to the last month
    var result = execa.sync('git', ['-C', FLIX_DIR_PATH, 'log', '--pretty=%H\t%ct\t%s', '--since=1 month ago']);

    // Parse the command output
    var lines = result.stdout.split("\n");
    var rows = lines.map((line) => line.split("\t"));

    // Connect tot MySQL
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
            "REPLACE INTO commits VALUES (?, FROM_UNIXTIME(?), ?, NULL)",
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
    var result = execa.sync('java', ['-jar', JAR_PATH, 'Xmemory', '--json'], {"cwd": FLIX_DIR_PATH});

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
// Main                                                                      //
///////////////////////////////////////////////////////////////////////////////

// Always clone or pull.
gitCloneOrPull()

// Branch on the command.
if (command === "build") {
    gradleBuild()
} else if (command === "test") {
    gradleTest()
} else if (command === "throughput") {
    benchmarkThroughput()
} else if (command === "phases") {
    benchmarkPhases()
} else if (command === "incremental") {
    benchmarkPhasesIncremental()
} else if (command === "codesize") {
    benchmarkCodeSize();
} else if (command === "benchmarks") {
    benchmarkBenchmarks()
} else if (command === "commits") {
    commits()
} else if (command === "memory") {
    benchmarkMemory();
} else {
    throw new Error("Unknown command: " + command)
}
