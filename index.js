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
  .command("extract")
  .alias("e")
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

    subTemplate.Transform = ["AWS::Serverless-2016-10-31"];
    var index = template.Transform.indexOf("AWS::Serverless-2016-10-31");
    if (index !== -1) {
        template.Transform.splice(index, 1);
    }
    if (template.Transform && template.Transform.length) {
      const transformChoices = [];
      for (const transform of template.Transform) {
        let trans;
        if (typeof transform === "object") {
          let params = [];
          if (transform.Parameters) {
            for (const p of Object.keys(transform.Parameters)) {
              params.push(`${p}: ${transform.Parameters[p]}`);
            }
          }
          trans = {
            name: `${transform.Name}\n   ${params.join("\n   ")}`,
            value: transform,
          };
        }
        transformChoices.push(trans || transform);
      }

      const transforms = await inquirer.prompt({
        message: "Select resource",
        choices: transformChoices,
        name: "names",
        type: "checkbox",
        paginated: true,
        pageSize: 10,
      });
      subTemplate.Transform.unshift(...transforms.names);
    }
    subTemplate.Parameters = {};
    subTemplate.Globals = template.Globals;
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

    fs.writeFileSync(
      `${filenameSplit.join(".")}.sub.${extension}`,
      templateFormat === "json"
        ? JSON.stringify(subTemplate, null, 2)
        : YAML.stringify(subTemplate)
    );
  });

function traverse(o, dependencies) {
  for (var i in o) {
    if (!!o[i] && typeof o[i] == "object") {
      switch (i) {
        case "Fn::GetAtt":
        case "DependsOn":
          addDependency(dependencies, o[i][0]);
          traverse(template.Resources[o[i][0]], dependencies);
          break;
      }
      traverse(o[i], dependencies);
    } else {
      if (i === "Ref") {
        addDependency(dependencies, o[i]);
        traverse(template.Resources[o[i]], dependencies);
      }
      if (i === "Fn::Sub") {
        const matches = o[i].match(/\${(.+?)}/gi);
        for (const match of matches) {
          const name = match.replace(/\${(.+)}/, "$1");
          addDependency(dependencies, name);
          traverse(template.Resources[name], dependencies);
        }
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
