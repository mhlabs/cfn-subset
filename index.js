#!/usr/bin/env node
const program = require("commander");
const package = require("./package.json");
const inquirer = require("inquirer");
const YAML = require("./yaml-wrapper");

const fs = require("fs");
let templateFormat;
let template;

program.version(package.version, "-v, --vers", "output the current version");

program
  .option("-t, --template <filename>", "Template file name", "template.yaml")
  .action(async (cmd) => {
    template = getTemplate(cmd.template);
    const resource = await inquirer.prompt({
      message: "Select resource",
      choices: Object.keys(template.Resources).sort((a, b) => (a > b ? 1 : -1)),
      name: "names",
      type: "checkbox",
    });

    const dependencies = [...resource.names];
    for (const dep of resource.names) {
      traverse(template.Resources[dep], dependencies);
    }

    const subTemplate = {};

    subTemplate.Transforms = ["AWS::Serverless-2016-10-31"];
    subTemplate.Parameters = {};
    subTemplate.Resources = {};
    for (const dependency of dependencies) {
      if (template.Resources[dependency]) {
        subTemplate.Resources[dependency] = template.Resources[dependency];
      } else if (template.Parameters[dependency]) {
        subTemplate.Parameters[dependency] = template.Parameters[dependency];
      }
    }
    const filenameSplit = cmd.template.split(".");
    const extension = filenameSplit.pop();

    console.log(filenameSplit);
    fs.writeFileSync(
      `${filenameSplit.join(".")}.sub.${extension}`,
      JSON.stringify(subTemplate, null, 2)
    );
  });

function traverse(o, dependencies) {
  for (var i in o) {
    if (!!o[i] && typeof o[i] == "object") {
      switch (i) {
        case "Fn::GetAtt":
          addDependency(dependencies, o[i][0]);
          traverse(template.Resources[o[i][0]], dependencies);
          break;
      }
      traverse(o[i], dependencies);
    } else {
      if (i == "Ref") {
        addDependency(dependencies, o[i]);
        console;
        traverse(template.Resources[o[i]], dependencies);
        console.log(i, o[i]);
      }
    }
  }
}

function addDependency(dependencies, dep) {
  if (!dependencies.includes(dep)) {
    dependencies.push(dep);
  }
}
// eslint-disable-next-line no-undef
program.parse(process.argv);

function getTemplate(templatePath) {
  let template = null;
  if (fs.existsSync(templatePath)) {
    const file = fs.readFileSync(templatePath).toString();
    try {
      template = JSON.parse(file);
      templateFormat = "json";
    } catch (err) {
      template = YAML.parse(file);
      templateFormat = "yaml";
    }
  }

  return template;
}
