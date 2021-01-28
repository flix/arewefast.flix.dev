///////////////////////////////////////////////////////////////////////////////
// Imports                                                                   //
///////////////////////////////////////////////////////////////////////////////
var execa = require('execa');
var mysql = require('mysql');

///////////////////////////////////////////////////////////////////////////////
// Parse Command Line Arguments                                              //
///////////////////////////////////////////////////////////////////////////////
var hostname = process.argv[2]
var username = process.argv[3]
var password = process.argv[4]

if (!hostname) {
    throw new Error("Missing hostname.");
}

if (!username) {
    throw new Error("Missing username");
}

if (!password) {
    throw new Error("Missing password");
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
// Benchmark Throughput                                                      //
///////////////////////////////////////////////////////////////////////////////
function benchmarkThroughput() {
    // Command to execute.
    var result = execa.sync('java', ['-jar', 'flix.jar', '--Xbenchmark-throughput', '--json']);

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
// Benchmark Phases                                                          //
///////////////////////////////////////////////////////////////////////////////
function benchmarkPhases() {
    // Command to execute.
    var result = execa.sync('java', ['-jar', 'flix.jar', '--Xbenchmark-phases', '--json']);

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
// Main                                                                      //
///////////////////////////////////////////////////////////////////////////////
//benchmarkThroughput()
benchmarkPhases()