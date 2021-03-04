const fs = require("fs");
const YAML = require("../shared/yaml-wrapper");

let templateFormat;

function getSubFilename(templateName) {
  const filenameSplit = templateName.split(".");
  const extension = filenameSplit.pop();
  const fileName = `${filenameSplit.join(".")}.sub.${extension}`;
  return fileName;
}

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

function saveTemplate(fileName, subTemplate) {
  fs.writeFileSync(
    fileName,
    templateFormat === "json"
      ? JSON.stringify(subTemplate, null, 2)
      : YAML.stringify(subTemplate)
  );
}

module.exports = {
  getSubFilename,
  getTemplate,
  templateFormat,
  saveTemplate
};
