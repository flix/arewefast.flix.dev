///////////////////////////////////////////////////////////////////////////////
// Imports                                                                   //
///////////////////////////////////////////////////////////////////////////////
var execa = require('execa');
var mysql = require('mysql');
var fs = require("fs");

///////////////////////////////////////////////////////////////////////////////
// Paths                                                                     //
///////////////////////////////////////////////////////////////////////////////
var JAR_PATH = './flix/build/libs/flix.jar';

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
    execa.sync('git', ['-C', './flix/', 'pull']);
}

function gitCloneOrPull() {
    if (!fs.existsSync("./flix/")) {
        gitClone()
    } else {
        gitPull()
    }
}

///////////////////////////////////////////////////////////////////////////////
// Gradle Build                                                              //
///////////////////////////////////////////////////////////////////////////////
function gradleBuild() {
    execa.sync('./gradlew', ['clean'], {"cwd": "./flix/"});

    var t = getCurrentUnixTime();
    execa.sync('./gradlew', ['jar'], {"cwd": "./flix/"});
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
    execa.sync('./gradlew', ['test'], {"cwd": "./flix/"});
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
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-throughput', '--json']);

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
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-phases', '--json']);

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
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-incremental', '--json']);

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
    var result = execa.sync('java', ['-jar', JAR_PATH, '--Xbenchmark-code-size', '--json']);

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
    var result = execa.sync('java', ['-jar', JAR_PATH, '--benchmark', '--json', 'flix/main/src/resources/benchmark/BenchmarkList.flix']);

    // Parse the result JSON.
    var json = JSON.parse(result.stdout)
    var threads = json.threads;
    var benchmarks = json.benchmarks;

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
} else {
    throw new Error("Unknown command: " + command)
}
