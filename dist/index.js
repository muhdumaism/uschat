"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const app = (0, app_1.buildApp)();
const start = async () => {
    try {
        await app.listen({ port: config_1.config.port, host: config_1.config.host });
        console.log(`⚡ USCHAT Backend Server running at http://${config_1.config.host}:${config_1.config.port}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
