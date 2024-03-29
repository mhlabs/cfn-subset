const program = require("commander");
const inquirer = require("inquirer");
const templateHelper = require("../shared/template-helper");
const fs = require("fs");
const sentencer = require("sentencer");
let template;

program
  .command("extract")
  .alias("e")
  .option("-t, --template <filename>", "Template file name", "template.yaml")
  .option("-st, --sub-template <filename>", "Template file name", "template.sub.yaml")
  .action(async (cmd) => {
    template = templateHelper.getTemplate(cmd.template);
    const resource = await inquirer.prompt({
      message: "Select resource(s)",
      choices: Object.keys(template.Resources).sort((a, b) => (a > b ? 1 : -1)).map(p => ({ name: `${p} (${template.Resources[p].Type})`, value: p })),
      name: "names",
      type: "checkbox",
    });

    const dependencies = [...resource.names];
    for (const dep of resource.names) {
      traverse(template.Resources[dep], dependencies);
    }

    const subTemplate = {};

    if (template.Transform) {
      subTemplate.Transform = ["AWS::Serverless-2016-10-31"];
      if (!Array.isArray(template.Transform)) {
        template.Transform = [template.Transform];
      }
      var index = template.Transform.indexOf("AWS::Serverless-2016-10-31");
      if (index !== -1) {
        template.Transform.splice(index, 1);
      }
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
            name: `${transform.Name}\n\t${params.join("\n\t")}`,
            value: transform,
          };
        }
        transformChoices.push(trans || transform);
      }

      const transforms = await inquirer.prompt({
        message: "Select resource(s)",
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
    const fileName = cmd.subTemplate || templateHelper.getSubFilename(cmd.template);
    templateHelper.saveTemplate(fileName, subTemplate);
    const tomlExists = fs.existsSync("samconfig.toml");
    if (tomlExists) {
      let tomlFile = fs.readFileSync("samconfig.toml").toString();
      tomlFile = tomlFile.replace(
        /stack_name = "(.+?)"/g,
        'stack_name = "sub--$1-' +
          sentencer.make("{{ adjective }}-{{ noun }}") +
          '"'
      ).replace(/\s=\s/g, "=");;
      fs.writeFileSync("samconfig.sub.toml", tomlFile);
    }

    console.log(
      `Subset successfully created. Run 'sam deploy --template-file ${fileName} ${
        tomlExists ? "--config-file samconfig.sub.toml" : "--guided"
      }' to deploy as a separate stack`
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
