const program = require("commander");
const inquirer = require("inquirer");
const YAML = require("../shared/yaml-wrapper");
const templateHelper = require("../shared/template-helper");

const fs = require("fs");
let templateFormat;
let template;

program
  .command("merge")
  .alias("m")
  .option("-t, --template <filename>", "Template file name", "template.yaml")
  .action(async (cmd) => {
    if (cmd.template.includes(".sub.")) {
      cmd.template = cmd.template.replace(".sub.", ".");
    }
    const subTemplateName = templateHelper.getSubFilename(cmd.template);
    template = templateHelper.getTemplate(cmd.template);
    const subTemplate = templateHelper.getTemplate(subTemplateName);

    for (const resource of Object.keys(subTemplate.Resources)) {
      template.Resources[resource] = subTemplate.Resources[resource];
    }

    for (const resource of Object.keys(subTemplate.Parameters)) {
      template.Parameters[resource] = subTemplate.Parameters[resource];
    }

    const transforms = [
      ...new Set([
        ...template.Transform.map((p) => JSON.stringify(p)),
        ...subTemplate.Transform.map((p) => JSON.stringify(p)),
      ]),
    ].map((p) => JSON.parse(p));
    template.Transform = transforms;

    templateHelper.saveTemplate(cmd.template, subTemplate);    
  });


