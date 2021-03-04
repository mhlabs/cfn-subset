#!/usr/bin/env node
const program = require("commander");
const package = require("./package.json");
require("./src/commands/extract");
require("./src/commands/merge");

program.version(package.version, "-v, --vers", "output the current version");

// eslint-disable-next-line no-undef
program.parse(process.argv);
