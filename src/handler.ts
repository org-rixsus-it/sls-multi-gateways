import type { Color as ChalkColor } from "chalk";
import concurrently from "concurrently";
import cors from "cors";
import express from "express";
import { readFileSync } from "fs";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import YAML from "yaml";

import { Service } from "./types/service";

// reads and parses config file
const readConfigFile = () => {
  const file = readFileSync(
    path.join(process.cwd(), "sls-multi-gateways.yml"),
    "utf8"
  );
  return YAML.parse(file);
};

// runs each services
const runServices = (
  services: Service[],
  httpPort: number,
  stage: string,
  prefixColors: (typeof ChalkColor)[]
): concurrently.CommandObj[] => {
  const commands: concurrently.CommandObj[] = [];

  for (let i = 0; i < services.length; i++) {
    const execCommand = `
            cd  ${process.cwd()}/${services[i].srvSource};
            sls offline start --stage ${stage} --httpPort ${
      httpPort + i
    } --lambdaPort ${httpPort + i + 1000}
        `;

    commands.push({
      command: execCommand,
      name: services[i].srvName,
      prefixColor: i < prefixColors.length ? prefixColors[i] : "gray",
    });
  }

  return commands;
};

// proxy each service
const runProxy = (services: Service[], httpPort: number, stage: string) => {
  const app = express();

  app.use(cors());

  for (let i = 0; i < services.length; i++) {
    const proxyPath = `/${services[i].srvPath}`;
    const stripBasePath = services[i].stripBasePath;

    app.use(
      proxyPath,
      createProxyMiddleware({
        pathRewrite: (path: string) => {
          return stripBasePath ? path.replace(proxyPath, "/") : path;
        },
        target: `http://localhost:${httpPort + i}/${stage}/`,
        changeOrigin: true,
      })
    );
  }

  app.listen(3000);
};

export { readConfigFile, runProxy, runServices };
