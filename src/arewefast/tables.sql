CREATE TABLE `benchmark_ext`
(
    `time`     datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `threads`  bigint(20)   NOT NULL,
    `name`     varchar(255) NOT NULL,
    `duration` int(11)               DEFAULT NULL
);

CREATE TABLE `build`
(
    `task`     varchar(255) NOT NULL,
    `time`     datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `duration` int(11)               DEFAULT NULL
);


CREATE TABLE `phase_ext`
(
    `time`       datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `phase`      varchar(255) NOT NULL,
    `lines`      bigint(20)   NOT NULL,
    `threads`    bigint(20)   NOT NULL,
    `iterations` bigint(20)   NOT NULL,
    `duration`   bigint(20)   NOT NULL
);

CREATE TABLE `playground`
(
    `time`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` varchar(255) NOT NULL,
    `count`  int(11)               DEFAULT NULL
);

CREATE TABLE `throughput_ext`
(
    `time`             datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `lines`            bigint(20) NOT NULL,
    `threads`          bigint(20) NOT NULL,
    `iterations`       bigint(20) NOT NULL,
    `minThroughput`    bigint(20) NOT NULL,
    `maxThroughput`    bigint(20) NOT NULL,
    `avgThroughput`    bigint(20) NOT NULL,
    `medianThroughput` bigint(20) NOT NULL
);
