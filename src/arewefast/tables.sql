 CREATE TABLE `build` (
  `task` varchar(255) NOT NULL,
  `time` datetime NOT NULL,
  `duration` int(11) DEFAULT NULL
);

CREATE TABLE `phase` (
  `phase` varchar(255) NOT NULL,
  `time` datetime NOT NULL,
  `duration` bigint(20) NOT NULL
);

 CREATE TABLE `throughput` (
  `time` datetime NOT NULL,
  `rate` bigint(20) NOT NULL
);
